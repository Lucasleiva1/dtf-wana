import { measurementToPixels, roundPixels } from "../lib/measurements";
import type { ColorProfile, MeasurementUnit, StudioDocument } from "../types/document";

export type NewDocumentValues = {
  name: string;
  width: number;
  height: number;
  unit: MeasurementUnit;
  ppi: number;
  bitDepth: 8 | 16;
  colorProfile: ColorProfile;
  background: "transparent" | "white" | "black";
};

export function createEmptyDocument(values: NewDocumentValues): StudioDocument {
  const id = crypto.randomUUID();
  const width = roundPixels(measurementToPixels(values.width, values.unit, values.ppi));
  const height = roundPixels(measurementToPixels(values.height, values.unit, values.ppi));
  const emptyFile = new File([], `${values.name}.dtf`, { type: "application/x-dtf-project" });
  return {
    id,
    name: values.name,
    mimeType: emptyFile.type,
    sizeBytes: 0,
    width,
    height,
    previewUrl: "",
    sourceFile: emptyFile,
    renderBlob: emptyFile,
    renderRevision: 0,
    format: "Documento DTF",
    bitDepth: values.bitDepth,
    revision: 0,
    dirty: false,
    engineReady: false,
    artboard: {
      id: `${id}-artboard`,
      name: "Mesa 1",
      widthPx: width,
      heightPx: height,
      ppi: values.ppi,
      preferredUnit: values.unit,
      background: values.background,
    },
    placedImage: null,
    guides: [],
    colorProfile: values.colorProfile,
    ppiAssumed: false,
    createdAt: new Date().toISOString(),
  };
}
