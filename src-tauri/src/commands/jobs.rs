use std::{path::{Path, PathBuf}, sync::atomic::Ordering};

use serde::Serialize;
use tauri::{ipc::Response, State};

use crate::{
    alpha_engine::AlphaTreatment,
    application::{jobs::JobSnapshot, revisions, state::AppState},
    edge_polish_engine::EdgePolishOptions,
    image_engine::document::ExportFormat,
    residue_engine::ResidueCleanupOptions,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedJob {
    pub job_id: String,
}

#[tauri::command]
pub fn start_alpha_analysis_job(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes();
    let job_id = state
        .jobs
        .create("alpha_analysis", "Analizar transparencias", 6, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            let analysis =
                document.analyze_with_progress(&mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        if stage == 1 {
                            "imagen"
                        } else {
                            "filas/píxeles"
                        },
                    )
                })?;
            state.jobs.progress(
                &worker_job_id,
                "Generando previsualización",
                5,
                0,
                1,
                "vista",
            )?;
            let _preview = document.preview_rgba8("partial_overlay");
            state.jobs.progress(
                &worker_job_id,
                "Generando previsualización",
                5,
                1,
                1,
                "vista",
            )?;
            serde_json::to_value(analysis).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => {
                let _ = state.jobs.complete(&worker_job_id, value, None);
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_alpha_preview_job(
    document_id: String,
    treatment: AlphaTreatment,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes();
    let job_id = state
        .jobs
        .create("alpha_preview", "Previsualizar impacto", 4, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let (preview, impact) = document.treatment_preview_rgba8(
                &treatment,
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "píxeles/filas",
                    )
                },
            )?;
            let result = serde_json::to_value(impact).map_err(|error| error.to_string())?;
            Ok::<_, String>((result, preview))
        })();
        match result {
            Ok((value, preview)) => {
                let _ = state.jobs.complete(&worker_job_id, value, Some(preview));
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_alpha_treatment_job(
    document_id: String,
    treatment: AlphaTreatment,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes()
        .saturating_mul(2);
    let job_id = state
        .jobs
        .create("alpha_treatment", "Eliminar semitransparencias", 5, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let result = document.apply_treatment_with_progress(
                &treatment,
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "píxeles/filas",
                    )
                },
            )?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => {
                let _ = state.jobs.complete(&worker_job_id, value, None);
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_residue_cleanup_job(
    document_id: String,
    options: ResidueCleanupOptions,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes();
    let job_id = state
        .jobs
        .create("residue_cleanup", "Detectar residuos", 5, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let summary = document.classify_residues_with_progress(
                &options,
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "regiones/filas",
                    )
                },
            )?;
            let mask = document.residue_mask_bytes();
            Ok::<_, String>((
                serde_json::to_value(summary).map_err(|e| e.to_string())?,
                mask,
            ))
        })();
        match result {
            Ok((value, preview)) => {
                let _ = state.jobs.complete(&worker_job_id, value, Some(preview));
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_apply_residue_job(
    document_id: String,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes()
        .saturating_mul(2);
    let job_id = state.jobs.create(
        "residue_apply",
        "Eliminar residuos seleccionados",
        2,
        memory,
    )?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let result = document.apply_residue_mask_with_progress(
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "píxeles/filas",
                    )
                },
            )?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => {
                let _ = state.jobs.complete(&worker_job_id, value, None);
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_edge_polish_preview_job(
    document_id: String,
    options: EdgePolishOptions,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes()
        .saturating_mul(2);
    let job_id = state.jobs.create(
        "edge_polish_preview",
        "Previsualizar pulido de borde",
        4,
        memory,
    )?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let (preview, impact) = document.edge_polish_preview_rgba8(
                &options,
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "filas/píxeles",
                    )
                },
            )?;
            Ok::<_, String>((
                serde_json::to_value(impact).map_err(|error| error.to_string())?,
                preview,
            ))
        })();
        match result {
            Ok((value, preview)) => {
                let _ = state.jobs.complete(&worker_job_id, value, Some(preview));
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_edge_polish_apply_job(
    document_id: String,
    options: EdgePolishOptions,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes()
        .saturating_mul(2);
    let job_id = state
        .jobs
        .create("edge_polish_apply", "Aplicar y verificar pulido", 5, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let mut document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let result = document.apply_edge_polish_with_progress(
                &options,
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "filas/píxeles",
                    )
                },
            )?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => {
                let _ = state.jobs.complete(&worker_job_id, value, None);
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

#[tauri::command]
pub fn start_export_job(
    document_id: String,
    path: String,
    expected_revision: u64,
    dpi: u32,
    format: Option<ExportFormat>,
    avoid_overwrite: Option<bool>,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let format = format.unwrap_or_default();
    let requested_path = PathBuf::from(path);
    let output_path = if avoid_overwrite.unwrap_or(false) {
        available_output_path(&requested_path)
    } else {
        requested_path
    };
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes();
    let job_name = format!("Exportar y verificar {}", format.label());
    let job_id = state
        .jobs
        .create("export_document", &job_name, 7, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
                format!(
                    "{}: revisión actual {}",
                    conflict.code, conflict.current_revision
                )
            })?;
            let result = document.export_verified_as_with_progress(
                &output_path,
                format,
                true,
                dpi.clamp(1, 2400),
                &mut |stage, label, processed, total| {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("JOB_CANCELLED".into());
                    }
                    state.jobs.progress(
                        &worker_job_id,
                        label,
                        stage,
                        processed,
                        total,
                        "bytes/unidades",
                    )
                },
            )?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        })();
        match result {
            Ok(value) => {
                let _ = state.jobs.complete(&worker_job_id, value, None);
            }
            Err(error) => state.jobs.fail(&worker_job_id, &error),
        }
    });
    Ok(StartedJob { job_id })
}

fn available_output_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("imagen_dtf");
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 2..=10_000 {
        let name = match extension {
            Some(extension) => format!("{stem}_{index}.{extension}"),
            None => format!("{stem}_{index}"),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{stem}_{}", std::process::id()))
}

#[tauri::command]
pub fn get_job_status(job_id: String, state: State<'_, AppState>) -> Result<JobSnapshot, String> {
    state.jobs.snapshot(&job_id)
}

#[tauri::command]
pub fn cancel_job(job_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.jobs.cancel(&job_id)
}

#[tauri::command]
pub fn get_job_binary(job_id: String, state: State<'_, AppState>) -> Result<Response, String> {
    Ok(Response::new(state.jobs.binary_result(&job_id)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_output_never_overwrites_an_existing_file() {
        let directory = std::env::temp_dir().join(format!("dtf-batch-path-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let requested = directory.join("imagen_dtf.png");
        std::fs::write(&requested, b"existing").unwrap();
        let available = available_output_path(&requested);
        assert_eq!(available.file_name().unwrap(), "imagen_dtf_2.png");
        let _ = std::fs::remove_dir_all(directory);
    }
}
