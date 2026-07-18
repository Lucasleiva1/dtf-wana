import { invoke } from "@tauri-apps/api/core";
import type { AlphaTreatment } from "../types/alpha";
import type { BatchAlphaConfig, BatchConfiguration, BatchImageEntry } from "../types/batch";

export const defaultBatchConfiguration: BatchConfiguration = {
  alphaEnabled: true,
  alpha: {
    thresholdPercent: 50,
    reconstructRadius: 2,
    reconstructionMode: "automatic",
    protections: {
      protectConnectedTexture: true,
      protectFineLines: true,
      protectGrunge: true,
      onlyIsolatedParticles: false,
    },
  },
  residueEnabled: false,
  residue: {
    isolatedParticles: true,
    weakEdgeFragments: true,
    exteriorContourRemains: true,
    includeProtectedSelected: false,
    maxRegionSize: 900,
    maxDistance: 48,
    minimumConnectionThickness: 2,
    contourSensitivity: 55,
  },
  polishEnabled: false,
  polish: {
    intensity: "soft",
    radius: 1,
    method: "binary_smoothing",
    protectFineDetail: true,
    protectConnectedTexture: true,
  },
  format: "png",
  dpi: 300,
};

export async function scanBatchFolder(path: string): Promise<BatchImageEntry[]> {
  return invoke<BatchImageEntry[]>("scan_image_folder", { path });
}

export async function loadBatchThumbnail(path: string): Promise<Blob> {
  const bytes = await invoke<ArrayBuffer>("read_batch_thumbnail", { path });
  return new Blob([bytes], { type: "image/png" });
}

export function buildBatchTreatment(maxAlpha: number, config: BatchAlphaConfig): AlphaTreatment {
  const maximumThreshold = Math.max(1, maxAlpha - 1);
  const threshold = Math.max(1, Math.min(maximumThreshold, Math.round(maxAlpha * config.thresholdPercent / 100)));
  return {
    action: "threshold",
    threshold,
    reconstructRadius: config.reconstructRadius,
    reconstructionMode: config.reconstructionMode,
    protections: { ...config.protections, preservedRegionIds: [] },
  };
}

export function batchOutputPath(image: BatchImageEntry, outputFolder: string | null, format: BatchConfiguration["format"]): string {
  const directory = outputFolder || image.parentPath;
  const separator = directory.includes("\\") ? "\\" : "/";
  const baseName = image.name.replace(/\.[^.]+$/, "") || "imagen";
  const extension = format === "tiff" ? "tif" : format;
  return `${directory.replace(/[\\/]$/, "")}${separator}${baseName}_dtf.${extension}`;
}
