export type ModuleId = "background" | "transparency" | "separation";
export type RenderDevice = "gpu" | "cpu";
export type PreviewBackground = "checker-small" | "checker-large" | "white" | "black" | "gray" | "custom";
export type MeasurementUnit = "px" | "cm" | "mm" | "in" | "pt" | "pc";
export type ColorProfile = "sRGB" | "Display P3" | "Adobe RGB";
export type GuideOrientation = "horizontal" | "vertical";

export type Artboard = {
  id: string;
  name: string;
  widthPx: number;
  heightPx: number;
  ppi: number;
  preferredUnit: MeasurementUnit;
  background: "transparent" | "white" | "black" | "custom";
  backgroundColor?: string;
};

export type PlacedImage = {
  id: string;
  name: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Physical resolution declared by the source image, or the disclosed fallback. */
  sourcePpi: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  lockAspect: boolean;
};

export type DocumentGuide = {
  id: string;
  orientation: GuideOrientation;
  /** Position in document pixels, relative to the artboard origin. */
  position: number;
  locked?: boolean;
};
export type ToolId =
  | "select" | "transform" | "hand" | "zoom" | "brush" | "eraser" | "analyze"
  | "residue-region" | "residue-rectangle" | "residue-lasso" | "residue-brush";

export type StudioDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  previewUrl: string;
  sourceFile: File;
  renderBlob: Blob | ImageBitmap;
  renderRevision: number;
  format: string;
  bitDepth: 8 | 16;
  revision: number;
  dirty: boolean;
  /** False for a new, empty document that has not been uploaded to the Rust image engine. */
  engineReady?: boolean;
  artboard?: Artboard;
  placedImage?: PlacedImage | null;
  guides?: DocumentGuide[];
  colorProfile?: ColorProfile;
  ppiAssumed?: boolean;
  sourcePath?: string;
  createdAt?: string;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};
