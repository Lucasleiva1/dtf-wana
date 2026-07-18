export type BackgroundRemovalTool =
  | "background-wand"
  | "background-auto"
  | "background-protect"
  | "background-mark"
  | "background-never"
  | "background-refine"
  | "background-add"
  | "background-subtract"
  | "background-eraser"
  | "background-cleanup";

export type SelectionMode = "new" | "add" | "subtract" | "intersect";
export type MaskTarget = "foreground_lock" | "background_lock" | "never_remove" | "unknown_band" | "user_add" | "user_subtract";
export type StrokeMode = "paint" | "erase";
export type SelectionAction = "select_all" | "clear" | "invert" | "expand" | "contract" | "smooth" | "delete";
export type BackgroundView = "selection" | "quick_mask" | "protections" | "mask" | "alpha" | "result" | "result_white" | "result_black" | "result_gray" | "unknown_band";
export type OutputAlphaMode = "natural" | "solid_dtf";
export type MaskPoint = { x: number; y: number };

export type WandSettings = {
  tolerance: number;
  contiguous: boolean;
  antiAlias: boolean;
  connectivity: 4 | 8;
  minimumRegionSize: number;
  protectEdges: boolean;
  stopAtStrongEdge: boolean;
  edgeBarrierStrength: number;
  luminanceRange: number;
  saturationRange: number;
  preciseColor: boolean;
  sampleAllVisibleLayers: boolean;
};

export type MagicWandRequest = {
  x: number;
  y: number;
  mode: SelectionMode;
  settings: WandSettings;
};

export type StrokeRequest = {
  target: MaskTarget;
  mode: StrokeMode;
  points: MaskPoint[];
  radius: number;
  opacity: number;
};

export type BackgroundEraserRequest = {
  points: MaskPoint[];
  radius: number;
  tolerance: number;
  opacity: number;
  findEdges: boolean;
  protectForeground: boolean;
  samplingOnce: boolean;
};

export type BackgroundEraserSettings = Omit<BackgroundEraserRequest, "points" | "radius" | "opacity">;

export type RefineSettings = {
  radius: number;
  sensitivity: number;
  smoothness: number;
  contrast: number;
  shift: number;
  preserveHair: boolean;
  preserveFineLines: boolean;
  protectCorners: boolean;
};

export type CleanupSettings = {
  minimumParticleSize: number;
  fillHoles: boolean;
  removeIslands: boolean;
};

export type BackgroundRemovalSummary = {
  maskRevision: number;
  aiMaskActive: boolean;
  selectedPixels: number;
  foregroundLockedPixels: number;
  backgroundLockedPixels: number;
  neverRemovePixels: number;
  unknownPixels: number;
  userAddedPixels: number;
  userSubtractedPixels: number;
  partialAlphaPixels: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type BackgroundRemovalUpdate = {
  summary: BackgroundRemovalSummary;
  changedPixels: number;
  truncatedByProtection: number;
};

export type BoundarySegment = { x1: number; y1: number; x2: number; y2: number };

export type ModelStatus = {
  installed: boolean;
  ready: boolean;
  modelId: string;
  provider: string;
  path: string | null;
  reason: string;
};

export type InferenceDevice = "gpu" | "cpu";

export type AiRemovalResult = {
  update: BackgroundRemovalUpdate;
  provider: string;
  inferenceMs: number;
};

export const backgroundToolTarget: Partial<Record<BackgroundRemovalTool, MaskTarget>> = {
  "background-protect": "foreground_lock",
  "background-mark": "background_lock",
  "background-never": "never_remove",
  "background-refine": "unknown_band",
  "background-add": "user_add",
  "background-subtract": "user_subtract",
  "background-eraser": "user_subtract",
};

export const emptyBackgroundSummary: BackgroundRemovalSummary = {
  maskRevision: 0,
  aiMaskActive: false,
  selectedPixels: 0,
  foregroundLockedPixels: 0,
  backgroundLockedPixels: 0,
  neverRemovePixels: 0,
  unknownPixels: 0,
  userAddedPixels: 0,
  userSubtractedPixels: 0,
  partialAlphaPixels: 0,
  canUndo: false,
  canRedo: false,
};
