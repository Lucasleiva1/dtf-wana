import { describe, expect, it } from "vitest";
import { brushSizeFromHorizontalDrag } from "./brushSizing";

describe("brushSizeFromHorizontalDrag", () => {
  it("grows to the right and shrinks to the left", () => {
    expect(brushSizeFromHorizontalDrag(32, 18, 1)).toBe(50);
    expect(brushSizeFromHorizontalDrag(32, -18, 1)).toBe(14);
  });

  it("keeps the on-screen diameter response consistent with zoom", () => {
    expect(brushSizeFromHorizontalDrag(40, 20, 2)).toBe(50);
    expect(brushSizeFromHorizontalDrag(40, 20, 0.5)).toBe(80);
  });

  it("clamps the professional brush range", () => {
    expect(brushSizeFromHorizontalDrag(10, -1000, 1)).toBe(1);
    expect(brushSizeFromHorizontalDrag(490, 1000, 1)).toBe(500);
  });
});
