use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SelectionMode {
    New,
    Add,
    Subtract,
    Intersect,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MaskTarget {
    ForegroundLock,
    BackgroundLock,
    NeverRemove,
    UnknownBand,
    UserAdd,
    UserSubtract,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StrokeMode {
    Paint,
    Erase,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SelectionAction {
    SelectAll,
    Clear,
    Invert,
    Expand,
    Contract,
    Smooth,
    Delete,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundView {
    Selection,
    QuickMask,
    Protections,
    Mask,
    Alpha,
    Result,
    ResultWhite,
    ResultBlack,
    ResultGray,
    UnknownBand,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OutputAlphaMode {
    Natural,
    SolidDtf,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaskPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WandSettings {
    pub tolerance: f32,
    pub contiguous: bool,
    pub anti_alias: bool,
    pub connectivity: u8,
    pub minimum_region_size: u32,
    pub protect_edges: bool,
    pub stop_at_strong_edge: bool,
    pub edge_barrier_strength: f32,
    pub luminance_range: f32,
    pub saturation_range: f32,
    pub precise_color: bool,
    #[serde(default)]
    pub sample_all_visible_layers: bool,
}

impl Default for WandSettings {
    fn default() -> Self {
        Self {
            tolerance: 18.0,
            contiguous: true,
            anti_alias: true,
            connectivity: 8,
            minimum_region_size: 1,
            protect_edges: true,
            stop_at_strong_edge: true,
            edge_barrier_strength: 65.0,
            luminance_range: 100.0,
            saturation_range: 100.0,
            precise_color: true,
            sample_all_visible_layers: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicWandRequest {
    pub x: u32,
    pub y: u32,
    pub mode: SelectionMode,
    pub settings: WandSettings,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokeRequest {
    pub target: MaskTarget,
    pub mode: StrokeMode,
    pub points: Vec<MaskPoint>,
    pub radius: u32,
    pub opacity: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundEraserRequest {
    pub points: Vec<MaskPoint>,
    pub radius: u32,
    pub tolerance: f32,
    pub opacity: f32,
    pub find_edges: bool,
    pub protect_foreground: bool,
    pub sampling_once: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefineSettings {
    pub radius: u32,
    pub sensitivity: f32,
    pub smoothness: u32,
    pub contrast: f32,
    pub shift: i32,
    pub preserve_hair: bool,
    pub preserve_fine_lines: bool,
    pub protect_corners: bool,
}

impl Default for RefineSettings {
    fn default() -> Self {
        Self {
            radius: 6,
            sensitivity: 55.0,
            smoothness: 2,
            contrast: 12.0,
            shift: 0,
            preserve_hair: true,
            preserve_fine_lines: true,
            protect_corners: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupSettings {
    pub minimum_particle_size: u32,
    pub fill_holes: bool,
    pub remove_islands: bool,
}

impl Default for CleanupSettings {
    fn default() -> Self {
        Self {
            minimum_particle_size: 24,
            fill_holes: true,
            remove_islands: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundRemovalSummary {
    pub mask_revision: u64,
    pub selected_pixels: u64,
    pub foreground_locked_pixels: u64,
    pub background_locked_pixels: u64,
    pub never_remove_pixels: u64,
    pub unknown_pixels: u64,
    pub user_added_pixels: u64,
    pub user_subtracted_pixels: u64,
    pub partial_alpha_pixels: u64,
    pub can_undo: bool,
    pub can_redo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundRemovalUpdate {
    pub summary: BackgroundRemovalSummary,
    pub changed_pixels: u64,
    pub truncated_by_protection: u64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundarySegment {
    pub x1: u32,
    pub y1: u32,
    pub x2: u32,
    pub y2: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub installed: bool,
    pub ready: bool,
    pub model_id: String,
    pub provider: String,
    pub path: Option<String>,
    pub reason: String,
}
