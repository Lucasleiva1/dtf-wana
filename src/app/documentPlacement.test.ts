import { describe, expect, it } from "vitest";
import type { StudioDocument } from "../types/document";
import { assignPlacedImagePpi, documentWithoutPlacedImage, naturalPlacedSize, placeImageOnExistingArtboard } from "./documentPlacement";

const file = new File([], "imagen.png", { type: "image/png" });

function documentFixture(overrides: Partial<StudioDocument> = {}): StudioDocument {
  return {
    id: "doc-1", name: "Mesa DTF", mimeType: "image/png", sizeBytes: 100,
    width: 900, height: 600, previewUrl: "blob:test", sourceFile: file, renderBlob: file,
    renderRevision: 0, format: "PNG", bitDepth: 8, revision: 0, dirty: false, engineReady: true,
    artboard: { id: "board-1", name: "Mesa 1", widthPx: 4488, heightPx: 4488, ppi: 300, preferredUnit: "cm", background: "transparent" },
    placedImage: { id: "image-1", name: "imagen.png", sourceWidth: 900, sourceHeight: 600, sourcePpi: 150, x: 0, y: 0, width: 900, height: 600, rotation: 0, lockAspect: true },
    guides: [{ id: "guide-1", orientation: "vertical", position: 2244 }], colorProfile: "sRGB", ppiAssumed: false,
    ...overrides,
  };
}

describe("real physical image placement", () => {
  it("converts source pixels and source PPI to the target artboard without fitting to it", () => {
    const natural = naturalPlacedSize({ sourceWidth: 900, sourceHeight: 600, sourcePpi: 150 }, 300);
    expect(natural).toEqual({ width: 1800, height: 1200 });
    expect(natural.width / 300 * 2.54).toBeCloseTo(15.24, 10);
  });

  it("preserves the 38 cm artboard and centers the image at its real physical size", () => {
    const current = documentFixture({ engineReady: false, placedImage: null });
    const placed = placeImageOnExistingArtboard(documentFixture(), current);
    expect(placed.artboard).toBe(current.artboard);
    expect(placed.placedImage?.width).toBe(1800);
    expect(placed.placedImage?.height).toBe(1200);
    expect(placed.placedImage?.x).toBe(1344);
    expect(placed.placedImage?.y).toBe(1644);
  });

  it("removes only the image and keeps the artboard and guides ready for another image", () => {
    const current = documentFixture();
    const empty = documentWithoutPlacedImage(current);
    expect(empty).not.toBeNull();
    expect(empty.artboard).toBe(current.artboard);
    expect(empty.guides).toEqual(current.guides);
    expect(empty.placedImage).toBeNull();
    expect(empty.engineReady).toBe(false);
    expect(empty.width).toBe(4488);
    expect(empty.height).toBe(4488);
  });

  it("assigns 300 PPI explicitly without inventing pixels and recalculates printed centimeters", () => {
    const current = documentFixture();
    const converted = assignPlacedImagePpi(current, 300);
    expect(converted.placedImage?.sourceWidth).toBe(900);
    expect(converted.placedImage?.sourceHeight).toBe(600);
    expect(converted.placedImage?.sourcePpi).toBe(300);
    expect(converted.placedImage?.width).toBe(900);
    expect(converted.placedImage?.height).toBe(600);
    expect(converted.ppiAssumed).toBe(false);
    expect((converted.placedImage?.width ?? 0) / 300 * 2.54).toBeCloseTo(7.62, 10);
  });
});
