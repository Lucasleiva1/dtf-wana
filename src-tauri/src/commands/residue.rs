use tauri::{ipc::Response, State};

use crate::{
    application::{revisions, state::AppState},
    residue_engine::{MaskEdit, MaskSummary},
};

#[tauri::command]
pub async fn edit_residue_mask(
    document_id: String,
    edit: MaskEdit,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<MaskSummary, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        revisions::verify(Some(expected_revision), document.revision).map_err(|conflict| {
            format!(
                "{}: revisión actual {}",
                conflict.code, conflict.current_revision
            )
        })?;
        Ok(document.edit_residue_mask(&edit))
    })
    .await
    .map_err(|error| format!("Falló la edición de la máscara: {error}"))?
}

#[tauri::command]
pub async fn get_residue_mask_preview(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        document.residue_preview_png()
    })
    .await
    .map_err(|error| format!("Falló la previsualización de residuos: {error}"))??;
    Ok(Response::new(bytes))
}
