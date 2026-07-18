import { describe, expect, it } from "vitest";
import { hidesOriginalForBackgroundPreview, previewMatte } from "./backgroundPreview";

describe("background removal result preview", () => {
  it("uses real transparency and hides the original image below it", () => {
    expect(previewMatte("result")).toBeNull();
    expect(hidesOriginalForBackgroundPreview("background", "result")).toBe(true);
  });

  it("only adds a matte in explicit inspection views", () => {
    expect(previewMatte("result_white")).toBe("#ffffff");
    expect(previewMatte("result_black")).toBe("#050505");
    expect(hidesOriginalForBackgroundPreview("background", "selection")).toBe(false);
  });
});
