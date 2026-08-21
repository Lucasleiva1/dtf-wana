import { describe, expect, it } from "vitest";
import { createDtfExportFileNameGenerator, formatDocumentSemiExportFileName, formatDtfExportFileName, formatSemiExportFileName } from "./exportFileName";

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

  it("preserves the imported base name and appends the SEMI suffix", () => {
    expect(formatSemiExportFileName("medida 30x40.png")).toBe("medida 30x40-semi.png");
    expect(formatSemiExportFileName("diseño.final.jpg")).toBe("diseño.final-semi.png");
  });

  it("uses the placed image name instead of an untitled document name", () => {
    expect(formatDocumentSemiExportFileName({
      name: "Documento sin título",
      sourceFile: { name: "Documento sin título.dtf" },
      placedImage: { name: "katseye.png" },
    })).toBe("katseye-semi.png");
  });
});
