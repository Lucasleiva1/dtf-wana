export type HistogramBin = {
  start: number;
  end: number;
  count: number;
};

export type AlphaRegion = {
  id: string;
  pixelCount: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  minAlpha: number;
  maxAlpha: number;
};

export type AlphaAnalysis = {
  schemaVersion: "1.0";
  documentId: string;
  revision: number;
  width: number;
  height: number;
  bitDepth: 8 | 16;
  maxAlpha: number;
  totalPixels: number;
  transparentPixels: number;
  partialAlphaPixels: number;
  opaquePixels: number;
  partialAlphaMin: number | null;
  partialAlphaMax: number | null;
  partialAlphaPercent: number;
  affectedRegions: number;
  verifiedSolidAlpha: boolean;
  histogram: HistogramBin[];
  regions: AlphaRegion[];
};

export type AlphaTreatment =
  | { action: "make_transparent" }
  | { action: "make_opaque"; reconstructRadius: number }
  | { action: "threshold"; threshold: number; reconstructRadius: number };

export type TreatmentImpact = {
  willModifyPixels: number;
  willBecomeTransparent: number;
  willBecomeOpaque: number;
  requiresConfirmation: boolean;
};

export type TreatmentResult = {
  revision: number;
  impact: TreatmentImpact;
  analysis: AlphaAnalysis;
};

export type PreviewMode = "original" | "result" | "partial_overlay" | "alpha";

export type ExportVerification = {
  path: string;
  width: number;
  height: number;
  bitDepth: 8 | 16;
  dpi: number;
  fileSizeBytes: number;
  partialAlphaPixels: number;
  verifiedSolidAlpha: boolean;
  reopenedAndVerified: boolean;
};
