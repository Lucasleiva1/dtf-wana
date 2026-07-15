use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, RwLock,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::Value;

static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub id: String,
    pub operation: String,
    pub name: String,
    pub status: JobStatus,
    pub stage: String,
    pub stage_index: u8,
    pub total_stages: u8,
    pub percent: f64,
    pub processed_units: u64,
    pub total_units: u64,
    pub unit_label: String,
    pub elapsed_ms: u64,
    pub memory_bytes: u64,
    pub cancellable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

struct JobRecord {
    snapshot: JobSnapshot,
    started: Instant,
    cancel: Arc<AtomicBool>,
    binary_result: Option<Vec<u8>>,
}

#[derive(Clone, Default)]
pub struct JobManager {
    records: Arc<RwLock<HashMap<String, JobRecord>>>,
}

impl JobManager {
    pub fn create(
        &self,
        operation: &str,
        name: &str,
        total_stages: u8,
        memory_bytes: u64,
    ) -> Result<String, String> {
        let epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let sequence = JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let id = format!("job-{epoch}-{sequence}");
        let record = JobRecord {
            snapshot: JobSnapshot {
                id: id.clone(),
                operation: operation.into(),
                name: name.into(),
                status: JobStatus::Queued,
                stage: "En cola".into(),
                stage_index: 0,
                total_stages,
                percent: 0.0,
                processed_units: 0,
                total_units: 1,
                unit_label: "unidades".into(),
                elapsed_ms: 0,
                memory_bytes,
                cancellable: true,
                result: None,
                error: None,
            },
            started: Instant::now(),
            cancel: Arc::new(AtomicBool::new(false)),
            binary_result: None,
        };
        let mut records = self
            .records
            .write()
            .map_err(|_| "No se pudo registrar el trabajo".to_string())?;
        records.retain(|_, existing| {
            matches!(
                existing.snapshot.status,
                JobStatus::Queued | JobStatus::Running
            ) || existing.started.elapsed().as_secs() < 300
        });
        if records.len() >= 48 {
            let removable: Vec<String> = records
                .iter()
                .filter(|(_, existing)| {
                    !matches!(
                        existing.snapshot.status,
                        JobStatus::Queued | JobStatus::Running
                    )
                })
                .take(records.len().saturating_sub(47))
                .map(|(key, _)| key.clone())
                .collect();
            for key in removable {
                records.remove(&key);
            }
        }
        records.insert(id.clone(), record);
        Ok(id)
    }

    pub fn cancellation_flag(&self, id: &str) -> Result<Arc<AtomicBool>, String> {
        self.records
            .read()
            .map_err(|_| "No se pudo leer el trabajo".to_string())?
            .get(id)
            .map(|record| record.cancel.clone())
            .ok_or_else(|| "Trabajo no encontrado".to_string())
    }

    pub fn progress(
        &self,
        id: &str,
        stage: &str,
        stage_index: u8,
        processed: u64,
        total: u64,
        unit: &str,
    ) -> Result<(), String> {
        let mut records = self
            .records
            .write()
            .map_err(|_| "No se pudo actualizar el trabajo".to_string())?;
        let record = records
            .get_mut(id)
            .ok_or_else(|| "Trabajo no encontrado".to_string())?;
        if record.cancel.load(Ordering::Relaxed) {
            return Err("JOB_CANCELLED".into());
        }
        let total = total.max(1);
        let stage_fraction = (processed.min(total) as f64) / total as f64;
        let completed_stages = stage_index.saturating_sub(1) as f64;
        record.snapshot.status = JobStatus::Running;
        record.snapshot.stage = stage.into();
        record.snapshot.stage_index = stage_index;
        record.snapshot.percent = ((completed_stages + stage_fraction)
            / record.snapshot.total_stages.max(1) as f64
            * 100.0)
            .clamp(0.0, 99.9);
        record.snapshot.processed_units = processed;
        record.snapshot.total_units = total;
        record.snapshot.unit_label = unit.into();
        record.snapshot.elapsed_ms = record.started.elapsed().as_millis() as u64;
        Ok(())
    }

    pub fn complete(
        &self,
        id: &str,
        result: Value,
        binary_result: Option<Vec<u8>>,
    ) -> Result<(), String> {
        let mut records = self
            .records
            .write()
            .map_err(|_| "No se pudo completar el trabajo".to_string())?;
        let record = records
            .get_mut(id)
            .ok_or_else(|| "Trabajo no encontrado".to_string())?;
        record.snapshot.status = JobStatus::Completed;
        record.snapshot.stage = "Finalizado".into();
        record.snapshot.stage_index = record.snapshot.total_stages;
        record.snapshot.percent = 100.0;
        record.snapshot.processed_units = record.snapshot.total_units;
        record.snapshot.elapsed_ms = record.started.elapsed().as_millis() as u64;
        record.snapshot.cancellable = false;
        record.snapshot.result = Some(result);
        record.binary_result = binary_result;
        Ok(())
    }

    pub fn fail(&self, id: &str, error: &str) {
        if let Ok(mut records) = self.records.write() {
            if let Some(record) = records.get_mut(id) {
                let cancelled = error == "JOB_CANCELLED" || record.cancel.load(Ordering::Relaxed);
                record.snapshot.status = if cancelled {
                    JobStatus::Cancelled
                } else {
                    JobStatus::Failed
                };
                record.snapshot.stage = if cancelled {
                    "Cancelado".into()
                } else {
                    "Error".into()
                };
                record.snapshot.elapsed_ms = record.started.elapsed().as_millis() as u64;
                record.snapshot.cancellable = false;
                record.snapshot.error = (!cancelled).then(|| error.to_string());
            }
        }
    }

    pub fn cancel(&self, id: &str) -> Result<(), String> {
        let records = self
            .records
            .read()
            .map_err(|_| "No se pudo cancelar el trabajo".to_string())?;
        let record = records
            .get(id)
            .ok_or_else(|| "Trabajo no encontrado".to_string())?;
        if record.snapshot.cancellable {
            record.cancel.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    pub fn snapshot(&self, id: &str) -> Result<JobSnapshot, String> {
        let records = self
            .records
            .read()
            .map_err(|_| "No se pudo leer el trabajo".to_string())?;
        let record = records
            .get(id)
            .ok_or_else(|| "Trabajo no encontrado".to_string())?;
        let mut snapshot = record.snapshot.clone();
        if matches!(snapshot.status, JobStatus::Queued | JobStatus::Running) {
            snapshot.elapsed_ms = record.started.elapsed().as_millis() as u64;
        }
        Ok(snapshot)
    }

    pub fn binary_result(&self, id: &str) -> Result<Vec<u8>, String> {
        self.records
            .write()
            .map_err(|_| "No se pudo leer el trabajo".to_string())?
            .get_mut(id)
            .and_then(|record| record.binary_result.take())
            .ok_or_else(|| "El trabajo no produjo una vista previa".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_is_visible_to_running_work() {
        let jobs = JobManager::default();
        let id = jobs.create("test", "Trabajo", 3, 1024).unwrap();
        jobs.progress(&id, "Etapa", 1, 20, 100, "píxeles").unwrap();
        jobs.cancel(&id).unwrap();
        assert_eq!(
            jobs.progress(&id, "Etapa", 1, 21, 100, "píxeles")
                .unwrap_err(),
            "JOB_CANCELLED"
        );
        jobs.fail(&id, "JOB_CANCELLED");
        let snapshot = jobs.snapshot(&id).unwrap();
        assert_eq!(snapshot.status, JobStatus::Cancelled);
        assert!(!snapshot.cancellable);
    }
}
