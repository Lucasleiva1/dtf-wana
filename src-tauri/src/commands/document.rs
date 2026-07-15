use tauri::{ipc::{InvokeBody, Request, Response}, State};

use crate::{application::state::AppState, image_engine::document::{ImageDocument, ImportedDocument}};

#[tauri::command]
pub async fn upload_document_bytes(request: Request<'_>, state: State<'_, AppState>) -> Result<ImportedDocument, String> {
    let document_id = request.headers().get("x-dtf-document-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty() && value.len() <= 128)
        .ok_or_else(|| "Falta el identificador seguro del documento".to_string())?
        .to_string();
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("La importación requiere bytes binarios".into()),
    };
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (document, imported) = ImageDocument::decode(document_id.clone(), document_id, bytes)?;
        state.insert(document)?;
        Ok(imported)
    }).await.map_err(|error| format!("Falló la tarea de importación: {error}"))?
}

#[tauri::command]
pub async fn get_document_preview(document_id: String, mode: String, state: State<'_, AppState>) -> Result<Response, String> {
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document.lock().map_err(|_| "No se pudo bloquear el documento".to_string())?;
        document.preview_png(&mode)
    }).await.map_err(|error| format!("Falló la vista previa: {error}"))??;
    Ok(Response::new(bytes))
}
