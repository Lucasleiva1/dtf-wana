use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ControlProfile {
    ReadOnly,
    Supervised,
    Advanced,
}

impl Default for ControlProfile {
    fn default() -> Self {
        Self::Supervised
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    AppRead,
    SystemRead,
    DocumentRead,
    ViewControl,
    DocumentAnalyze,
    DocumentModify,
    ElementsModify,
    ProjectOpen,
    ProjectWrite,
    ExportWrite,
    ModelsRead,
    ModelsManage,
    UpdatesRead,
    UpdatesInstall,
}
