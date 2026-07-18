import { describe, expect, it } from "vitest";
import { convertMeasurement, measurementToPixels, pixelsToMeasurement, roundPixels } from "./measurements";

describe("physical measurements", () => {
  it("converts the mandatory 38 cm preset to 4488 pixels at 300 ppi", () => {
    expect(roundPixels(measurementToPixels(38, "cm", 300))).toBe(4488);
  });

  it("round-trips every physical unit", () => {
    for (const unit of ["cm", "mm", "in", "pt", "pc"] as const) {
      expect(pixelsToMeasurement(measurementToPixels(12.345, unit, 300), unit, 300)).toBeCloseTo(12.345, 10);
    }
  });

  it("converts inches to centimeters independently of ppi", () => {
    expect(convertMeasurement(1, "in", "cm", 72)).toBeCloseTo(2.54, 10);
  });
});
