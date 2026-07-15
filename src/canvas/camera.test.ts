import { describe, expect, it } from "vitest";
import { clampZoom, fitRect, zoomAt } from "./camera";

describe("camera", () => {
  it("limits zoom to the required 2–6400 percent range", () => {
    expect(clampZoom(0)).toBe(0.02);
    expect(clampZoom(100)).toBe(64);
  });

  it("keeps the point under the cursor fixed", () => {
    const before = { x: 100, y: 50, zoom: 1 };
    const cursor = { x: 300, y: 250 };
    const after = zoomAt(before, 2, cursor);
    expect((cursor.x - after.x) / after.zoom).toBe((cursor.x - before.x) / before.zoom);
    expect((cursor.y - after.y) / after.zoom).toBe((cursor.y - before.y) / before.zoom);
  });

  it("fits an artboard in low-resolution workspaces", () => {
    const camera = fitRect({ width: 600, height: 420 }, { width: 4200, height: 5400 }, 40);
    expect(camera.zoom).toBeGreaterThanOrEqual(0.02);
    expect(camera.y).toBeCloseTo(40);
  });
});
