import { describe, expect, it } from "vitest";
import { createDtfExportFileNameGenerator, formatDtfExportFileName } from "./exportFileName";

describe("DTF export file names", () => {
  it("formats exactly eight digits and the PNG extension", () => {
    expect(formatDtfExportFileName(42)).toBe("DTF_00000042.png");
    expect(formatDtfExportFileName(12345678)).toBe("DTF_12345678.png");
  });

  it("does not repeat a generated name within the same session", () => {
    const createName = createDtfExportFileNameGenerator(() => 0.12345678);

    expect(createName()).toBe("DTF_12345678.png");
    expect(createName()).toBe("DTF_12345679.png");
  });
});
