export type ModuleId = "background" | "transparency" | "separation";
export type PreviewBackground = "checker-small" | "checker-large" | "white" | "black" | "gray";
export type ToolId = "select" | "transform" | "hand" | "zoom" | "brush" | "eraser" | "analyze";

export type StudioDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  previewUrl: string;
  sourceFile: File;
  renderBlob: Blob;
  renderRevision: number;
  format: string;
  bitDepth: 8 | 16;
  revision: number;
  dirty: boolean;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};
