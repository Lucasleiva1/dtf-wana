use tauri::{ipc::Response, State};

use crate::{
    application::{revisions, state::AppState},
    residue_engine::{DirtyRect, MaskEdit, MaskEditResult, MaskSummary},
};

#[tauri::command]
pub async fn edit_residue_mask(
    document_id: String,
    edit: MaskEdit,
    expected_revision: u64,
    state: State<'_, AppState>,
) -> Result<MaskEditResult, String> {
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
pub async fn get_residue_mask_summary(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<MaskSummary, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let mut document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok(document.refresh_residue_mask_summary())
    })
    .await
    .map_err(|error| format!("Falló el recuento diferido de regiones: {error}"))?
}

#[tauri::command]
pub async fn get_residue_mask_tile(
    document_id: String,
    rect: DirtyRect,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    if rect.width == 0 || rect.height == 0 || rect.width > 1024 || rect.height > 1024 {
        return Err("El tile solicitado no es válido".into());
    }
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok::<_, String>(document.residue_mask_tile(rect))
    })
    .await
    .map_err(|error| format!("Falló la lectura incremental de la máscara: {error}"))??;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn get_residue_mask_bytes(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok::<_, String>(document.residue_mask_bytes())
    })
    .await
    .map_err(|error| format!("Falló la lectura de la máscara: {error}"))??;
    Ok(Response::new(bytes))
}
