use tauri::{
    ipc::{InvokeBody, Request, Response},
    State,
};
use serde::Serialize;
use std::{io::Cursor, path::{Path, PathBuf}};

use crate::{
    application::state::AppState,
    image_engine::document::{ImageDocument, ImportedDocument},
};

const MAX_BATCH_IMAGES: usize = 25_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImageEntry {
    pub path: String,
    pub name: String,
    pub parent_path: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub async fn upload_document_bytes(
    request: Request<'_>,
    state: State<'_, AppState>,
) -> Result<ImportedDocument, String> {
    let document_id = request
        .headers()
        .get("x-dtf-document-id")
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
    })
    .await
    .map_err(|error| format!("Falló la tarea de importación: {error}"))?
}

#[tauri::command]
pub async fn get_document_preview(
    document_id: String,
    mode: String,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let state = state.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let document = state.get(&document_id)?;
        let document = document
            .lock()
            .map_err(|_| "No se pudo bloquear el documento".to_string())?;
        Ok::<Vec<u8>, String>(document.preview_rgba8(&mode))
    })
    .await
    .map_err(|error| format!("Falló la vista previa: {error}"))??;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn close_document(document_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.remove(&document_id)
}

#[tauri::command]
pub async fn read_dropped_image(path: String) -> Result<Response, String> {
    let path = std::path::PathBuf::from(path);
    if !is_supported_image_path(&path) {
        return Err("Formato no admitido. Usá PNG, JPG, WebP, TIFF o BMP.".into());
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path)
            .map_err(|error| format!("No se pudo leer el archivo arrastrado: {error}"))?;
        if !metadata.is_file() {
            return Err("El elemento arrastrado no es un archivo de imagen".into());
        }
        if metadata.len() > 512 * 1024 * 1024 {
            return Err("La imagen supera el límite de seguridad de 512 MB".into());
        }
        std::fs::read(path)
            .map_err(|error| format!("No se pudo abrir la imagen arrastrada: {error}"))
    })
    .await
    .map_err(|error| format!("Falló la lectura del archivo arrastrado: {error}"))??;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn scan_image_folder(path: String) -> Result<Vec<BatchImageEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(path)
            .canonicalize()
            .map_err(|error| format!("No se pudo abrir la carpeta de entrada: {error}"))?;
        if !root.is_dir() {
            return Err("La ruta de entrada no es una carpeta".into());
        }
        let mut files = Vec::new();
        collect_images(&root, &root, &mut files)?;
        files.sort_by(|left, right| {
            left.relative_path
                .to_lowercase()
                .cmp(&right.relative_path.to_lowercase())
        });
        Ok(files)
    })
    .await
    .map_err(|error| format!("Falló la detección de imágenes: {error}"))?
}

#[tauri::command]
pub async fn read_batch_thumbnail(path: String) -> Result<Response, String> {
    let path = PathBuf::from(path);
    if !is_supported_image_path(&path) {
        return Err("No se puede generar la miniatura de este formato".into());
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path)
            .map_err(|error| format!("No se pudo leer la imagen: {error}"))?;
        if !metadata.is_file() || metadata.len() > 512 * 1024 * 1024 {
            return Err("La imagen no es válida para la cola".into());
        }
        let thumbnail = image::open(&path)
            .map_err(|error| format!("No se pudo decodificar la miniatura: {error}"))?
            .thumbnail(112, 80);
        let mut cursor = Cursor::new(Vec::new());
        thumbnail
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|error| format!("No se pudo codificar la miniatura: {error}"))?;
        Ok::<Vec<u8>, String>(cursor.into_inner())
    })
    .await
    .map_err(|error| format!("Falló la miniatura: {error}"))??;
    Ok(Response::new(bytes))
}

fn collect_images(root: &Path, directory: &Path, files: &mut Vec<BatchImageEntry>) -> Result<(), String> {
    let entries = std::fs::read_dir(directory)
        .map_err(|error| format!("No se pudo leer {}: {error}", directory.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("No se pudo leer una entrada: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("No se pudo identificar una entrada: {error}"))?;
        let path = entry.path();
        if file_type.is_dir() {
            collect_images(root, &path, files)?;
            continue;
        }
        if !file_type.is_file() || !is_supported_image_path(&path) {
            continue;
        }
        if files.len() >= MAX_BATCH_IMAGES {
            return Err(format!("La carpeta supera el límite de {MAX_BATCH_IMAGES} imágenes"));
        }
        let metadata = entry
            .metadata()
            .map_err(|error| format!("No se pudo leer el tamaño de {}: {error}", path.display()))?;
        if metadata.len() > 512 * 1024 * 1024 {
            continue;
        }
        let relative = path.strip_prefix(root).unwrap_or(&path);
        files.push(BatchImageEntry {
            path: path.to_string_lossy().into_owned(),
            name: entry.file_name().to_string_lossy().into_owned(),
            parent_path: path.parent().unwrap_or(root).to_string_lossy().into_owned(),
            relative_path: relative.to_string_lossy().into_owned(),
            size_bytes: metadata.len(),
        });
    }
    Ok(())
}

fn is_supported_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "bmp" | "tif" | "tiff"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_scan_is_recursive_sorted_and_ignores_other_files() {
        let root = std::env::temp_dir().join(format!("dtf-folder-scan-{}", std::process::id()));
        let nested = root.join("sub");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(root.join("b.PNG"), b"fixture").unwrap();
        std::fs::write(nested.join("a.webp"), b"fixture").unwrap();
        std::fs::write(root.join("not-image.txt"), b"fixture").unwrap();
        let mut files = Vec::new();
        collect_images(&root, &root, &mut files).unwrap();
        files.sort_by(|left, right| left.relative_path.to_lowercase().cmp(&right.relative_path.to_lowercase()));
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].name, "b.PNG");
        assert_eq!(files[1].relative_path, format!("sub{}a.webp", std::path::MAIN_SEPARATOR));
        let _ = std::fs::remove_dir_all(root);
    }
}
