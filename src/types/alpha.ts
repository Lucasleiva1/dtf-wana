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
  recommendation: AlphaRecommendation | null;
};

export type RiskLevel = "low" | "medium" | "high";

export type AlphaRecommendation = {
  recommendedThreshold: number;
  safeMin: number;
  safeMax: number;
  explanation: string;
  estimatedTransparent: number;
  estimatedOpaque: number;
  edgeAffectedPercent: number;
  risk: RiskLevel;
  conservative: { name: string; threshold: number; description: string };
  balanced: { name: string; threshold: number; description: string };
  aggressive: { name: string; threshold: number; description: string };
  connectedEdgePixels: number;
  fineDetailPixels: number;
  isolatedComponentPixels: number;
  recommendedRadius: number;
  contaminationRisk: RiskLevel;
};

export type ProtectionOptions = {
  protectConnectedTexture: boolean;
  protectFineLines: boolean;
  protectGrunge: boolean;
  onlyIsolatedParticles: boolean;
  preservedRegionIds: string[];
};

export type ReconstructionMode = "automatic" | "manual";

export type AlphaTreatment =
  | { action: "make_transparent" }
  | { action: "make_opaque"; reconstructRadius: number; reconstructionMode: ReconstructionMode }
  | { action: "threshold"; threshold: number; reconstructRadius: number; reconstructionMode: ReconstructionMode; protections: ProtectionOptions };

export type TreatmentImpact = {
  willModifyPixels: number;
  willBecomeTransparent: number;
  willBecomeOpaque: number;
  requiresConfirmation: boolean;
  protectedPixels: number;
  pendingPixels: number;
  edgeAffectedPercent: number;
  reconstructedPixels: number;
  estimatedRadius: number;
  contaminationRisk: RiskLevel;
};

export type TreatmentResult = {
  revision: number;
  impact: TreatmentImpact;
  analysis: AlphaAnalysis;
};

export type PreviewMode = "original" | "result" | "partial_overlay" | "impact_overlay" | "alpha";

export type JobStatus = "queued" | "running" | "completed" | "cancelled" | "failed";

export type JobSnapshot<TResult = unknown> = {
  id: string;
  operation: "alpha_analysis" | "alpha_preview" | "alpha_treatment" | "export_document" | string;
  name: string;
  status: JobStatus;
  stage: string;
  stageIndex: number;
  totalStages: number;
  percent: number;
  processedUnits: number;
  totalUnits: number;
  unitLabel: string;
  elapsedMs: number;
  memoryBytes: number;
  cancellable: boolean;
  result?: TResult;
  error?: string;
};

export type TransparencyFlowState =
  | "unprocessed"
  | "analyzing"
  | "analysis_complete"
  | "recommendation_available"
  | "previewing"
  | "preview_ready"
  | "applying"
  | "verifying"
  | "technical_result"
  | "visual_review"
  | "ready_to_export";

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
