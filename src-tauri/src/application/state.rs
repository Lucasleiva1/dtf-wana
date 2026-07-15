use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
};

use super::jobs::JobManager;
use crate::image_engine::document::ImageDocument;

#[derive(Clone, Default)]
pub struct AppState {
    documents: Arc<RwLock<HashMap<String, Arc<Mutex<ImageDocument>>>>>,
    pub jobs: JobManager,
}

impl AppState {
    pub fn insert(&self, document: ImageDocument) -> Result<(), String> {
        let mut documents = self
            .documents
            .write()
            .map_err(|_| "No se pudo bloquear el registro de documentos".to_string())?;
        documents.insert(document.id.clone(), Arc::new(Mutex::new(document)));
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Arc<Mutex<ImageDocument>>, String> {
        let documents = self
            .documents
            .read()
            .map_err(|_| "No se pudo leer el registro de documentos".to_string())?;
        documents
            .get(id)
            .cloned()
            .ok_or_else(|| "Documento no encontrado".to_string())
    }

    pub fn remove(&self, id: &str) -> Result<bool, String> {
        let mut documents = self
            .documents
            .write()
            .map_err(|_| "No se pudo bloquear el registro de documentos".to_string())?;
        Ok(documents.remove(id).is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_releases_document_from_registry() {
        let state = AppState::default();
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 1, 1);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[10, 20, 30, 255]).unwrap();
        }
        let (document, _) =
            ImageDocument::decode("fixture".into(), "fixture.png".into(), bytes).unwrap();
        state.insert(document).unwrap();
        assert!(state.get("fixture").is_ok());
        assert!(state.remove("fixture").unwrap());
        assert!(state.get("fixture").is_err());
        assert!(!state.remove("fixture").unwrap());
    }
}
