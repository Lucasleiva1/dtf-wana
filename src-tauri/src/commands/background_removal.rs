use std::{
    path::{Path, PathBuf},
    sync::atomic::Ordering,
};

use tauri::{ipc::Response, Manager, State};

use crate::{
    application::{revisions, state::AppState},
    background_removal::types::{
        BackgroundEraserRequest, BackgroundRemovalSummary, BackgroundRemovalUpdate, BackgroundView,
        BoundarySegment, CleanupSettings, MagicWandRequest, ModelStatus, OutputAlphaMode,
        RefineSettings, SelectionAction, StrokeRequest, WandSettings,
    },
    commands::jobs::StartedJob,
};

fn verify_revision(expected: u64, current: u64) -> Result<(), String> {
    revisions::verify(Some(expected), current).map_err(|conflict| {
        format!(
            "{}: revisión actual {}",
            conflict.code, conflict.current_revision
        )
    })
}

#[tauri::command]
pub async fn background_get_state(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalSummary, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok(document.background_removal.summary())
    })
    .await
    .map_err(|error| format!("Falló la lectura de Quitar fondo: {error}"))?
}

#[tauri::command]
pub async fn background_magic_wand(
    document_id: String,
    request: MagicWandRequest,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let width = document.width;
        let height = document.height;
        let pixels = document.working.clone();
        Ok(document
            .background_removal
            .magic_wand(&pixels, width, height, &request))
    })
    .await
    .map_err(|error| format!("Falló la varita mágica: {error}"))?
}

#[tauri::command]
pub async fn background_select_from_borders(
    document_id: String,
    settings: WandSettings,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let pixels = document.working.clone();
        let (width, height) = (document.width, document.height);
        Ok(document
            .background_removal
            .select_from_borders(&pixels, width, height, &settings))
    })
    .await
    .map_err(|error| format!("Falló la detección rápida desde bordes: {error}"))?
}

#[tauri::command]
pub async fn background_selection_action(
    document_id: String,
    action: SelectionAction,
    radius: u32,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        Ok(document
            .background_removal
            .selection_action(action, radius, width, height))
    })
    .await
    .map_err(|error| format!("Falló la edición de selección: {error}"))?
}

#[tauri::command]
pub async fn background_apply_stroke(
    document_id: String,
    request: StrokeRequest,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        Ok(document
            .background_removal
            .apply_stroke(&request, width, height))
    })
    .await
    .map_err(|error| format!("Falló el trazo de máscara: {error}"))?
}

#[tauri::command]
pub async fn background_eraser_stroke(
    document_id: String,
    request: BackgroundEraserRequest,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        let pixels = document.working.clone();
        Ok(document
            .background_removal
            .background_eraser(&pixels, &request, width, height))
    })
    .await
    .map_err(|error| format!("Falló el borrador de fondo: {error}"))?
}

#[tauri::command]
pub async fn background_generate_unknown_band(
    document_id: String,
    radius: u32,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        Ok(document
            .background_removal
            .generate_unknown_band(radius, width, height))
    })
    .await
    .map_err(|error| format!("Falló la generación de la banda incierta: {error}"))?
}

#[tauri::command]
pub async fn background_refine_edge(
    document_id: String,
    settings: RefineSettings,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        let pixels = document.working.clone();
        Ok(document
            .background_removal
            .refine_edge(&pixels, &settings, width, height))
    })
    .await
    .map_err(|error| format!("Falló el refinamiento de borde: {error}"))?
}

#[tauri::command]
pub async fn background_cleanup(
    document_id: String,
    settings: CleanupSettings,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        let (width, height) = (document.width, document.height);
        Ok(document
            .background_removal
            .cleanup(&settings, width, height))
    })
    .await
    .map_err(|error| format!("Falló la limpieza de máscara: {error}"))?
}

#[tauri::command]
pub async fn background_undo(
    document_id: String,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    history_action(document_id, expected_revision, state, false).await
}

#[tauri::command]
pub async fn background_redo(
    document_id: String,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<BackgroundRemovalUpdate, String> {
    history_action(document_id, expected_revision, state, true).await
}

async fn history_action(
    document_id: String,
    expected_revision: u64,
    state: State<'_, AppState>,
    redo: bool,
) -> Result<BackgroundRemovalUpdate, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        verify_revision(expected_revision, document.revision)?;
        Ok(if redo {
            document.background_removal.redo()
        } else {
            document.background_removal.undo()
        })
    })
    .await
    .map_err(|error| format!("Falló el historial de Quitar fondo: {error}"))?
}

#[tauri::command]
pub async fn background_get_overlay(
    document_id: String,
    view: BackgroundView,
    output_alpha: OutputAlphaMode,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok::<_, String>(document.background_removal.overlay_rgba8(
            &document.working,
            view,
            output_alpha,
        ))
    })
    .await
    .map_err(|error| format!("Falló la vista de Quitar fondo: {error}"))??;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn background_get_contours(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<BoundarySegment>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok(document
            .background_removal
            .contours(document.width, document.height))
    })
    .await
    .map_err(|error| format!("Falló el contorno de selección: {error}"))?
}

#[tauri::command]
pub fn start_background_export_job(
    document_id: String,
    path: String,
    output_alpha: OutputAlphaMode,
    expected_revision: u64,
    dpi: u32,
    state: State<'_, AppState>,
) -> Result<StartedJob, String> {
    let state = state.inner().clone();
    let requested = PathBuf::from(path);
    if requested
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("png"))
        != Some(true)
    {
        return Err("Quitar fondo exporta únicamente PNG RGBA verificado".into());
    }
    let output_path = available_output_path(&requested);
    let document = state.get(&document_id)?;
    let memory = document
        .lock()
        .map_err(|_| "No se pudo leer el documento".to_string())?
        .operation_memory_bytes()
        .saturating_mul(2);
    let job_id = state
        .jobs
        .create("background_export", "Exportar Quitar fondo", 7, memory)?;
    let worker_job_id = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let cancel = state.jobs.cancellation_flag(&worker_job_id)?;
            let document = document
                .lock()
                .map_err(|_| "No se pudo bloquear el documento".to_string())?;
            verify_revision(expected_revision, document.revision)?;
            let result = document.export_background_verified_with_progress(
                &output_path,
                output_alpha,
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
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("imagen_sin_fondo");
    for index in 2..=10_000 {
        let candidate = parent.join(format!("{stem}_{index}.png"));
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{stem}_{}.png", std::process::id()))
}

#[tauri::command]
pub fn background_model_status(app: tauri::AppHandle) -> ModelStatus {
    let resource_candidate = app
        .path()
        .resource_dir()
        .ok()
        .map(|path| path.join("models/background-removal/birefnet-lite.onnx"));
    let development_candidate = std::env::current_dir()
        .ok()
        .map(|path| path.join("models/background-removal/birefnet-lite.onnx"));
    let installed_path: Option<PathBuf> = resource_candidate
        .into_iter()
        .chain(development_candidate)
        .find(|path| path.is_file());
    let installed = installed_path.is_some();
    ModelStatus {
        installed,
        ready: false,
        model_id: "birefnet-lite".into(),
        provider: "CPU".into(),
        path: installed_path.map(|path| path.to_string_lossy().to_string()),
        reason: if installed {
            "El archivo existe, pero ONNX Runtime todavía no fue habilitado para esta compilación."
                .into()
        } else {
            "BiRefNet Lite no está instalado. DTF Pro Studio no descarga modelos silenciosamente."
                .into()
        },
    }
}
