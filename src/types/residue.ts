import type { AlphaAnalysis } from "./alpha";

export type MaskMode = "add" | "subtract";
export type MaskPoint = { x: number; y: number };

export type MaskEdit =
  | { action: "component"; x: number; y: number; mode: MaskMode }
  | { action: "rectangle"; start: MaskPoint; end: MaskPoint; mode: MaskMode }
  | { action: "lasso"; points: MaskPoint[]; mode: MaskMode }
  | { action: "brush"; points: MaskPoint[]; radius: number; mode: MaskMode }
  | { action: "clear" | "select_all" | "invert" | "undo" | "redo" };

export type MaskSummary = {
  selectedPixels: number;
  selectedRegions: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

export type ResidueCleanupOptions = {
  isolatedParticles: boolean;
  weakEdgeFragments: boolean;
  exteriorContourRemains: boolean;
  includeProtectedSelected: boolean;
  maxRegionSize: number;
  maxDistance: number;
  minimumConnectionThickness: number;
  contourSensitivity: number;
  protectedRegionIds: string[];
};

export type ResidueApplyResult = {
  revision: number;
  removedPixels: number;
  removedRegions: number;
  analysis: AlphaAnalysis;
};

