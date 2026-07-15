import { describe, expect, it } from "vitest";
import { fileNameFromPath, isAcceptedImageFile } from "./importImage";

describe("image import helpers", () => {
  it("accepts supported image files by MIME or extension", () => {
    expect(isAcceptedImageFile({ name: "diseño.png", type: "image/png" })).toBe(true);
    expect(isAcceptedImageFile({ name: "impresion.TIFF", type: "" })).toBe(true);
    expect(isAcceptedImageFile({ name: "notas.pdf", type: "application/pdf" })).toBe(false);
  });

  it("extracts a file name from Windows and Unix drop paths", () => {
    expect(fileNameFromPath("C:\\Users\\studio\\diseño dtf.png")).toBe("diseño dtf.png");
    expect(fileNameFromPath("/home/studio/diseño.webp")).toBe("diseño.webp");
  });
});
