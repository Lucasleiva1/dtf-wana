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
}
