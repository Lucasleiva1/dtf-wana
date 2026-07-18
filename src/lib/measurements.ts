import type { Artboard, MeasurementUnit, StudioDocument } from "../types/document";

export const MEASUREMENT_UNITS: readonly MeasurementUnit[] = ["px", "cm", "mm", "in", "pt", "pc"];

const inchesPerUnit: Record<Exclude<MeasurementUnit, "px">, number> = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
  pt: 1 / 72,
  pc: 1 / 6,
};

export function measurementToPixels(value: number, unit: MeasurementUnit, ppi: number): number {
  if (unit === "px") return value;
  return value * inchesPerUnit[unit] * ppi;
}

export function pixelsToMeasurement(pixels: number, unit: MeasurementUnit, ppi: number): number {
  if (unit === "px") return pixels;
  return pixels / ppi / inchesPerUnit[unit];
}

export function convertMeasurement(value: number, from: MeasurementUnit, to: MeasurementUnit, ppi: number): number {
  return pixelsToMeasurement(measurementToPixels(value, from, ppi), to, ppi);
}

export function roundPixels(value: number): number {
  return Math.max(1, Math.round(value));
}

export function formatMeasurement(value: number, unit: MeasurementUnit, maximumFractionDigits = unit === "px" ? 0 : 3): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function artboardFor(document: StudioDocument): Artboard {
  return document.artboard ?? {
    id: `${document.id}-artboard`,
    name: "Mesa 1",
    widthPx: document.width,
    heightPx: document.height,
    ppi: 300,
    preferredUnit: "cm",
    background: "transparent",
  };
}

export function physicalSize(document: StudioDocument, unit?: MeasurementUnit): { width: number; height: number; unit: MeasurementUnit } {
  const artboard = artboardFor(document);
  const targetUnit = unit ?? artboard.preferredUnit;
  return {
    width: pixelsToMeasurement(artboard.widthPx, targetUnit, artboard.ppi),
    height: pixelsToMeasurement(artboard.heightPx, targetUnit, artboard.ppi),
    unit: targetUnit,
  };
}

export type DocumentPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: MeasurementUnit;
  ppi: number;
};

export const DOCUMENT_PRESETS: readonly DocumentPreset[] = [
  { id: "dtf-38", label: "DTF 38 × 38 cm", width: 38, height: 38, unit: "cm", ppi: 300 },
  { id: "dtf-a3", label: "DTF A3 · 29,7 × 42 cm", width: 29.7, height: 42, unit: "cm", ppi: 300 },
  { id: "dtf-a4", label: "DTF A4 · 21 × 29,7 cm", width: 21, height: 29.7, unit: "cm", ppi: 300 },
  { id: "square-30", label: "Cuadrado 30 × 30 cm", width: 30, height: 30, unit: "cm", ppi: 300 },
];

export function estimatedRgbaMemory(widthPx: number, heightPx: number, bitDepth: 8 | 16): number {
  return widthPx * heightPx * 4 * (bitDepth / 8);
}
