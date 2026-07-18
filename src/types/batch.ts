import type { EdgePolishOptions, ExportFormat, ProtectionOptions, ReconstructionMode } from "./alpha";
import type { ResidueCleanupOptions } from "./residue";

export type BatchImageEntry = {
  path: string;
  name: string;
  parentPath: string;
  relativePath: string;
  sizeBytes: number;
};

export type BatchQueueStatus = "pending" | "processing" | "error";

export type BatchQueueItem = BatchImageEntry & {
  status: BatchQueueStatus;
  stage: string;
  percent: number;
  error?: string;
};

export type BatchAlphaConfig = {
  thresholdPercent: number;
  reconstructRadius: number;
  reconstructionMode: ReconstructionMode;
  protections: Omit<ProtectionOptions, "preservedRegionIds">;
};

export type BatchConfiguration = {
  alphaEnabled: boolean;
  alpha: BatchAlphaConfig;
  residueEnabled: boolean;
  residue: Omit<ResidueCleanupOptions, "protectedRegionIds">;
  polishEnabled: boolean;
  polish: EdgePolishOptions;
  format: ExportFormat;
  dpi: number;
};
