use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sysinfo::System;

use super::permissions::ControlProfile;

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
    fn success(request_id: String, data: Value) -> Self {
        Self { protocol_version: 1, request_id, ok: true, data: Some(data), error: None }
    }

    fn failure(request_id: String, code: &str, message: &str, recoverable: bool) -> Self {
        Self {
            protocol_version: 1,
            request_id,
            ok: false,
            data: None,
            error: Some(CommandError { code: code.into(), message: message.into(), recoverable }),
        }
    }
}

#[derive(Default)]
pub struct ApplicationCommandBus;

impl ApplicationCommandBus {
    pub fn execute(&self, request: CommandRequest) -> CommandResult {
        if request.protocol_version != 1 {
            return CommandResult::failure(request.request_id, "PROTOCOL_UNSUPPORTED", "Versión de protocolo no admitida", false);
        }
        let _execution_metadata = (&request.expected_revision, request.dry_run, &request.client);
        match request.command.as_str() {
            "system.capabilities" => self.system_capabilities(request.request_id),
            _ => CommandResult::failure(request.request_id, "COMMAND_UNKNOWN", "Comando desconocido", true),
        }
    }

    fn system_capabilities(&self, request_id: String) -> CommandResult {
        let mut system = System::new_all();
        system.refresh_all();
        let cpu = system.cpus().first().map(|item| item.brand().trim().to_string()).unwrap_or_else(|| "CPU no detectada".into());
        CommandResult::success(request_id, json!({
            "os": System::long_os_version().unwrap_or_else(|| "Windows".into()),
            "cpu": cpu,
            "logicalCores": system.cpus().len(),
            "totalMemoryBytes": system.total_memory(),
            "tauri": true
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_protocol() {
        let result = ApplicationCommandBus.execute(CommandRequest {
            protocol_version: 9,
            request_id: "r1".into(),
            command: "system.capabilities".into(),
            payload: json!({}),
            expected_revision: None,
            dry_run: false,
            client: None,
        });
        assert!(!result.ok);
        assert_eq!(result.protocol_version, 1);
    }
}
