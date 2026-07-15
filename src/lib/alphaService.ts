import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { AlphaAnalysis, AlphaTreatment, ExportVerification, PreviewMode, TreatmentImpact, TreatmentResult } from "../types/alpha";
import type { StudioDocument } from "../types/document";
import { dispatchCommand } from "./commandBus";

export type ImportedEngineDocument = {
  documentId: string;
  format: string;
  width: number;
  height: number;
  bitDepth: 8 | 16;
  revision: number;
  sourceByteLength: number;
};

export async function uploadDocument(file: File, documentId: string): Promise<ImportedEngineDocument | null> {
  if (!window.__TAURI_INTERNALS__) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return invoke<ImportedEngineDocument>("upload_document_bytes", bytes, {
    headers: { "x-dtf-document-id": documentId },
  });
}

export async function analyzeDocument(document: StudioDocument): Promise<AlphaAnalysis> {
  const result = await dispatchCommand<{ documentId: string }, AlphaAnalysis>("alpha.analyze", { documentId: document.id });
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No se pudo analizar el alfa.");
  return result.data;
}

export async function estimateTreatment(document: StudioDocument, treatment: AlphaTreatment): Promise<TreatmentImpact> {
  const result = await dispatchCommand("alpha.apply_treatment", { documentId: document.id, treatment }, {
    expectedRevision: document.revision,
    dryRun: true,
  });
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No se pudo simular el tratamiento.");
  return result.data as TreatmentImpact;
}

export async function applyTreatment(document: StudioDocument, treatment: AlphaTreatment): Promise<TreatmentResult> {
  const result = await dispatchCommand("alpha.apply_treatment", { documentId: document.id, treatment }, {
    expectedRevision: document.revision,
  });
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No se pudo aplicar el tratamiento.");
  return result.data as TreatmentResult;
}

export async function getDocumentPreview(documentId: string, mode: PreviewMode): Promise<Blob> {
  if (!window.__TAURI_INTERNALS__) throw new Error("La vista procesada requiere la aplicación de escritorio.");
  const bytes = await invoke<ArrayBuffer>("get_document_preview", { documentId, mode });
  return new Blob([bytes], { type: "image/png" });
}

export async function exportVerifiedDocument(document: StudioDocument): Promise<ExportVerification | null> {
  if (!window.__TAURI_INTERNALS__) throw new Error("La exportación verificada requiere la aplicación de escritorio.");
  const baseName = document.name.replace(/\.[^.]+$/, "");
  let path = await save({
    title: "Exportar PNG verificado para DTF",
    defaultPath: `${baseName}_dtf.png`,
    filters: [{ name: "PNG RGBA sin pérdida", extensions: ["png"] }],
  });
  if (!path) return null;
  if (!path.toLowerCase().endsWith(".png")) path += ".png";
  const result = await dispatchCommand("export.document", {
    documentId: document.id,
    path,
    requireSolidAlpha: true,
    dpi: 300,
  }, { expectedRevision: document.revision });
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "La exportación no pudo verificarse.");
  return result.data as ExportVerification;
}
