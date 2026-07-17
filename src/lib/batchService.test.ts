import { describe, expect, it } from "vitest";
import { batchOutputPath, buildBatchTreatment } from "./batchService";
import type { BatchAlphaConfig, BatchImageEntry } from "../types/batch";

const alpha: BatchAlphaConfig = {
  thresholdPercent: 50,
  reconstructRadius: 3,
  reconstructionMode: "manual",
  protections: {
    protectConnectedTexture: true,
    protectFineLines: true,
    protectGrunge: false,
    onlyIsolatedParticles: false,
  },
};

const image: BatchImageEntry = {
  path: "C:\\entrada\\sub\\diseño.final.png",
  parentPath: "C:\\entrada\\sub",
  relativePath: "sub\\diseño.final.png",
  name: "diseño.final.png",
  sizeBytes: 1200,
};

describe("batchService", () => {
  it("normalizes one threshold percentage for 8 and 16 bit alpha", () => {
    expect(buildBatchTreatment(255, alpha)).toMatchObject({ action: "threshold", threshold: 128, reconstructRadius: 3 });
    expect(buildBatchTreatment(65535, alpha)).toMatchObject({ action: "threshold", threshold: 32768, reconstructRadius: 3 });
  });

  it("uses the source folder when no output folder is selected", () => {
    expect(batchOutputPath(image, null, "png")).toBe("C:\\entrada\\sub\\diseño.final_dtf.png");
  });

  it("uses the selected output folder and the canonical TIFF extension", () => {
    expect(batchOutputPath(image, "D:\\terminadas\\", "tiff")).toBe("D:\\terminadas\\diseño.final_dtf.tif");
  });
});
