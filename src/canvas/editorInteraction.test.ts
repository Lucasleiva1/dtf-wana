import { describe, expect, it } from "vitest";
import { guideOrientationFromRuler, makeAxisTicks, snapGuideToCenter } from "./PrecisionOverlay";
import { resizeProportionally, snapPlacedImage, type ResizeHandle } from "./CanvasWorkspace";
import type { PlacedImage } from "../types/document";

const image: PlacedImage = {
  id: "image-1", name: "test.png", sourceWidth: 400, sourceHeight: 200,
  sourcePpi: 300,
  x: -40, y: 30, width: 400, height: 200, rotation: 0, lockAspect: true,
};

describe("Illustrator-like editor interactions", () => {
  it("creates horizontal guides from the top and vertical guides from the left", () => {
    expect(guideOrientationFromRuler("top")).toBe("horizontal");
    expect(guideOrientationFromRuler("left")).toBe("vertical");
  });

  it("numbers rulers continuously around a centered zero", () => {
    const ticks = makeAxisTicks(1000, 400, 1, 100, 10, 5);
    const majorValues = ticks.filter((tick) => tick.major).map((tick) => tick.value);
    expect(majorValues).toContain(0);
    expect(majorValues.some((value) => value < 0)).toBe(true);
    expect(majorValues.some((value) => value > 0)).toBe(true);
    expect(majorValues.length).toBeGreaterThan(10);
  });

  it("magnetizes a manual guide to the centered zero and releases outside tolerance", () => {
    expect(snapGuideToCenter(497, 500, 1)).toEqual({ position: 500, snapped: true });
    expect(snapGuideToCenter(480, 500, 1)).toEqual({ position: 480, snapped: false });
  });

  it("keeps the image proportional from every corner and side handle", () => {
    for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]) {
      const resized = resizeProportionally(image, handle, 40, 25);
      expect(resized.width / resized.height).toBeCloseTo(2, 10);
      expect(resized.lockAspect).toBe(true);
    }
  });

  it("allows negative coordinates when snapping is disabled", () => {
    const result = snapPlacedImage(image, 1000, 1000, [], 1, false, false);
    expect(result.item.x).toBe(-40);
    expect(result.item.y).toBe(30);
  });

  it("shows a temporary smart guide and snaps near the artboard center", () => {
    const nearCenter = { ...image, x: 302, width: 400 };
    const result = snapPlacedImage(nearCenter, 1000, 1000, [], 1, true, true);
    expect(result.item.x).toBe(300);
    expect(result.lines.vertical).toBe(500);
  });
});
