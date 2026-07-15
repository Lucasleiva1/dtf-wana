use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sysinfo::System;

use super::permissions::ControlProfile;
use super::{revisions, state::AppState};
use crate::alpha_engine::AlphaTreatment;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandClient {
    pub id: String,
    pub name: String,
    pub transport: String,
    #[serde(default)]
    pub profile: ControlProfile,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRequest {
    pub protocol_version: u8,
    pub request_id: String,
    pub command: String,
    #[serde(default)]
    pub payload: Value,
    #[serde(default)]
    pub expected_revision: Option<u64>,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default)]
    pub client: Option<CommandClient>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub protocol_version: u8,
    pub request_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CommandError>,
}

impl CommandResult {
    pub fn success(request_id: String, data: Value) -> Self {
        Self {
            protocol_version: 1,
            request_id,
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn failure(request_id: String, code: &str, message: &str, recoverable: bool) -> Self {
        Self {
            protocol_version: 1,
            request_id,
            ok: false,
            data: None,
            error: Some(CommandError {
                code: code.into(),
                message: message.into(),
                recoverable,
            }),
        }
    }
}

#[derive(Default)]
pub struct ApplicationCommandBus;

impl ApplicationCommandBus {
    pub fn execute(&self, state: &AppState, request: CommandRequest) -> CommandResult {
        if request.protocol_version != 1 {
            return CommandResult::failure(
                request.request_id,
                "PROTOCOL_UNSUPPORTED",
                "Versión de protocolo no admitida",
                false,
            );
        }
        let _execution_metadata = (&request.expected_revision, request.dry_run, &request.client);
        match request.command.as_str() {
            "system.capabilities" => self.system_capabilities(request.request_id),
            "alpha.analyze" => self.analyze_alpha(state, request),
            "alpha.apply_treatment" => self.apply_alpha_treatment(state, request),
            "document.undo" => self.change_history(state, request, false),
            "document.redo" => self.change_history(state, request, true),
            "export.document" => self.export_document(state, request),
            _ => CommandResult::failure(
                request.request_id,
                "COMMAND_UNKNOWN",
                "Comando desconocido",
                true,
            ),
        }
    }

    fn system_capabilities(&self, request_id: String) -> CommandResult {
        let mut system = System::new_all();
        system.refresh_all();
        let cpu = system
            .cpus()
            .first()
            .map(|item| item.brand().trim().to_string())
            .unwrap_or_else(|| "CPU no detectada".into());
        CommandResult::success(
            request_id,
            json!({
                "os": System::long_os_version().unwrap_or_else(|| "Windows".into()),
                "cpu": cpu,
                "logicalCores": system.cpus().len(),
                "totalMemoryBytes": system.total_memory(),
                "tauri": true
            }),
        )
    }

    fn analyze_alpha(&self, state: &AppState, request: CommandRequest) -> CommandResult {
        let Some(document_id) = request.payload.get("documentId").and_then(Value::as_str) else {
            return CommandResult::failure(
                request.request_id,
                "INVALID_ARGUMENT",
                "Falta documentId",
                true,
            );
        };
        let result = (|| {
            let document = state.get(document_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            serde_json::to_value(document.analyze()).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => CommandResult::success(request.request_id, value),
            Err(message) => {
                CommandResult::failure(request.request_id, "ALPHA_ANALYSIS_FAILED", &message, true)
            }
        }
    }

    fn apply_alpha_treatment(&self, state: &AppState, request: CommandRequest) -> CommandResult {
        let Some(document_id) = request.payload.get("documentId").and_then(Value::as_str) else {
            return CommandResult::failure(
                request.request_id,
                "INVALID_ARGUMENT",
                "Falta documentId",
                true,
            );
        };
        let treatment: AlphaTreatment = match request
            .payload
            .get("treatment")
            .cloned()
            .ok_or_else(|| "Falta treatment".to_string())
            .and_then(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
        {
            Ok(value) => value,
            Err(message) => {
                return CommandResult::failure(
                    request.request_id,
                    "INVALID_TREATMENT",
                    &message,
                    true,
                )
            }
        };
        let result = (|| {
            let document = state.get(document_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(request.expected_revision, document.revision).map_err(
                |conflict| {
                    format!(
                        "{}: revisión actual {}",
                        conflict.code, conflict.current_revision
                    )
                },
            )?;
            if request.dry_run {
                serde_json::to_value(document.treatment_impact(&treatment))
                    .map_err(|error| error.to_string())
            } else {
                serde_json::to_value(document.apply_treatment(&treatment))
                    .map_err(|error| error.to_string())
            }
        })();
        match result {
            Ok(value) => CommandResult::success(request.request_id, value),
            Err(message) if message.starts_with("DOCUMENT_REVISION_CONFLICT") => {
                CommandResult::failure(
                    request.request_id,
                    "DOCUMENT_REVISION_CONFLICT",
                    &message,
                    true,
                )
            }
            Err(message) => {
                CommandResult::failure(request.request_id, "ALPHA_TREATMENT_FAILED", &message, true)
            }
        }
    }

    fn change_history(
        &self,
        state: &AppState,
        request: CommandRequest,
        redo: bool,
    ) -> CommandResult {
        let Some(document_id) = request.payload.get("documentId").and_then(Value::as_str) else {
            return CommandResult::failure(
                request.request_id,
                "INVALID_ARGUMENT",
                "Falta documentId",
                true,
            );
        };
        let result = (|| {
            let document = state.get(document_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(request.expected_revision, document.revision).map_err(
                |conflict| {
                    format!(
                        "{}: revisión actual {}",
                        conflict.code, conflict.current_revision
                    )
                },
            )?;
            let changed = if redo {
                document.redo()
            } else {
                document.undo()
            };
            let analysis = document.analyze();
            Ok::<_, String>(
                json!({ "changed": changed, "revision": document.revision, "analysis": analysis }),
            )
        })();
        match result {
            Ok(value) => CommandResult::success(request.request_id, value),
            Err(message) => {
                CommandResult::failure(request.request_id, "HISTORY_FAILED", &message, true)
            }
        }
    }

    fn export_document(&self, state: &AppState, request: CommandRequest) -> CommandResult {
        let Some(document_id) = request.payload.get("documentId").and_then(Value::as_str) else {
            return CommandResult::failure(
                request.request_id,
                "INVALID_ARGUMENT",
                "Falta documentId",
                true,
            );
        };
        let Some(path) = request.payload.get("path").and_then(Value::as_str) else {
            return CommandResult::failure(
                request.request_id,
                "INVALID_ARGUMENT",
                "Falta la ruta elegida",
                true,
            );
        };
        let require_solid = request
            .payload
            .get("requireSolidAlpha")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        let dpi = request
            .payload
            .get("dpi")
            .and_then(Value::as_u64)
            .unwrap_or(300)
            .clamp(1, 2400) as u32;
        let result = (|| {
            let document = state.get(document_id)?;
            let document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(request.expected_revision, document.revision).map_err(
                |conflict| {
                    format!(
                        "{}: revisión actual {}",
                        conflict.code, conflict.current_revision
                    )
                },
            )?;
            document
                .export_verified(std::path::Path::new(path), require_solid, dpi)
                .and_then(|result| serde_json::to_value(result).map_err(|error| error.to_string()))
        })();
        match result {
            Ok(value) => CommandResult::success(request.request_id, value),
            Err(message) if message.starts_with("EXPORT_BLOCKED_PARTIAL_ALPHA") => {
                CommandResult::failure(
                    request.request_id,
                    "EXPORT_BLOCKED_PARTIAL_ALPHA",
                    &message,
                    true,
                )
            }
            Err(message) => CommandResult::failure(
                request.request_id,
                "EXPORT_VERIFICATION_FAILED",
                &message,
                true,
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_protocol() {
        let result = ApplicationCommandBus.execute(
            &AppState::default(),
            CommandRequest {
                protocol_version: 9,
                request_id: "r1".into(),
                command: "system.capabilities".into(),
                payload: json!({}),
                expected_revision: None,
                dry_run: false,
                client: None,
            },
        );
        assert!(!result.ok);
        assert_eq!(result.protocol_version, 1);
    }
}
