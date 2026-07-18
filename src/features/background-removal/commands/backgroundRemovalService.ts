import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { StudioDocument } from "../../../types/document";
import type { ExportVerification, JobSnapshot } from "../../../types/alpha";
import { useStudioStore } from "../../../stores/studioStore";
import { useBackgroundRemovalStore } from "../state/backgroundRemovalStore";
import type {
  BackgroundRemovalSummary, BackgroundRemovalUpdate, BackgroundView, BoundarySegment,
  BackgroundEraserRequest, CleanupSettings, MagicWandRequest, ModelStatus, OutputAlphaMode,
  RefineSettings, SelectionAction, StrokeRequest,
} from "../types";

async function synchronize(document: StudioDocument, update: BackgroundRemovalUpdate): Promise<BackgroundRemovalUpdate> {
  const store = useBackgroundRemovalStore.getState();
  if (store.documentId !== document.id) return update;
  store.setSummary(update.summary);
  const contours = update.summary.selectedPixels > 0
    ? await invoke<BoundarySegment[]>("background_get_contours", { documentId: document.id })
    : [];
  const latest = useBackgroundRemovalStore.getState();
  if (latest.documentId === document.id && latest.summary.maskRevision === update.summary.maskRevision) latest.setContours(contours);
  if (update.truncatedByProtection > 0) {
    useStudioStore.getState().setNotification({ kind: "info", text: `${update.truncatedByProtection.toLocaleString("es-AR")} píxeles protegidos no fueron modificados.` });
  }
  return update;
}

async function runUpdate(label: string, operation: () => Promise<BackgroundRemovalUpdate>, document: StudioDocument) {
  const store = useBackgroundRemovalStore.getState();
  store.setBusy(label);
  store.setError(null);
  try {
    return await synchronize(document, await operation());
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    useBackgroundRemovalStore.getState().setError(message);
    throw reason;
  } finally {
    useBackgroundRemovalStore.getState().setBusy(null);
  }
}

export async function initializeBackgroundRemoval(document: StudioDocument): Promise<BackgroundRemovalSummary> {
  const store = useBackgroundRemovalStore.getState();
  store.resetForDocument(document.id);
  const [summary, model] = await Promise.all([
    invoke<BackgroundRemovalSummary>("background_get_state", { documentId: document.id }),
    invoke<ModelStatus>("background_model_status"),
  ]);
  const latest = useBackgroundRemovalStore.getState();
  if (latest.documentId === document.id) {
    latest.setSummary(summary);
    latest.setModel(model);
    latest.setContours(summary.selectedPixels ? await invoke<BoundarySegment[]>("background_get_contours", { documentId: document.id }) : []);
  }
  return summary;
}

export function magicWand(document: StudioDocument, request: MagicWandRequest) {
  return runUpdate("Calculando varita", () => invoke<BackgroundRemovalUpdate>("background_magic_wand", { documentId: document.id, request, expectedRevision: document.revision }), document);
}

export function selectBackgroundFromBorders(document: StudioDocument) {
  return runUpdate("Detectando fondo desde los bordes", () => {
    const settings = { ...useBackgroundRemovalStore.getState().wand, contiguous: true };
    return invoke<BackgroundRemovalUpdate>("background_select_from_borders", {
      documentId: document.id,
      settings,
      expectedRevision: document.revision,
    });
  }, document);
}

export function applyBackgroundStroke(document: StudioDocument, request: StrokeRequest) {
  return runUpdate("Aplicando trazo", () => invoke<BackgroundRemovalUpdate>("background_apply_stroke", { documentId: document.id, request, expectedRevision: document.revision }), document);
}

export function applyBackgroundEraser(document: StudioDocument, request: BackgroundEraserRequest) {
  return runUpdate("Borrando fondo por color", () => invoke<BackgroundRemovalUpdate>("background_eraser_stroke", { documentId: document.id, request, expectedRevision: document.revision }), document);
}

export function modifyBackgroundSelection(document: StudioDocument, action: SelectionAction, radius = 1) {
  return runUpdate("Modificando selección", () => invoke<BackgroundRemovalUpdate>("background_selection_action", { documentId: document.id, action, radius, expectedRevision: document.revision }), document);
}

export async function deleteBackgroundSelection(document: StudioDocument) {
  const update = await runUpdate("Borrando fondo seleccionado", () => invoke<BackgroundRemovalUpdate>("background_selection_action", {
    documentId: document.id,
    action: "delete",
    radius: 1,
    expectedRevision: document.revision,
  }), document);
  useBackgroundRemovalStore.getState().setView("result");
  return update;
}

export function generateUnknownBand(document: StudioDocument, radius: number) {
  return runUpdate("Generando banda incierta", () => invoke<BackgroundRemovalUpdate>("background_generate_unknown_band", { documentId: document.id, radius, expectedRevision: document.revision }), document);
}

export function refineBackgroundEdge(document: StudioDocument, settings: RefineSettings) {
  return runUpdate("Refinando borde", () => invoke<BackgroundRemovalUpdate>("background_refine_edge", { documentId: document.id, settings, expectedRevision: document.revision }), document);
}

export function cleanupBackgroundMask(document: StudioDocument, settings: CleanupSettings) {
  return runUpdate("Limpiando máscara", () => invoke<BackgroundRemovalUpdate>("background_cleanup", { documentId: document.id, settings, expectedRevision: document.revision }), document);
}

export function undoBackgroundMask(document: StudioDocument) {
  return runUpdate("Deshaciendo máscara", () => invoke<BackgroundRemovalUpdate>("background_undo", { documentId: document.id, expectedRevision: document.revision }), document);
}

export function redoBackgroundMask(document: StudioDocument) {
  return runUpdate("Rehaciendo máscara", () => invoke<BackgroundRemovalUpdate>("background_redo", { documentId: document.id, expectedRevision: document.revision }), document);
}

export async function getBackgroundOverlay(documentId: string, view: BackgroundView, outputAlpha: OutputAlphaMode): Promise<Uint8Array> {
  return new Uint8Array(await invoke<ArrayBuffer>("background_get_overlay", { documentId, view, outputAlpha }));
}

export async function exportBackgroundResult(
  document: StudioDocument,
  outputAlpha: OutputAlphaMode,
  onProgress: (job: JobSnapshot<ExportVerification>) => void,
): Promise<ExportVerification | null> {
  if (!window.__TAURI_INTERNALS__) throw new Error("La exportación verificada requiere la aplicación de escritorio.");
  const baseName = document.name.replace(/\.[^.]+$/, "");
  let path = await save({
    title: "Exportar PNG con fondo eliminado",
    defaultPath: `${baseName}_sin_fondo.png`,
    filters: [{ name: "PNG RGBA sin pérdida", extensions: ["png"] }],
  });
  if (!path) return null;
  if (!path.toLowerCase().endsWith(".png")) path += ".png";
  const { jobId } = await invoke<{ jobId: string }>("start_background_export_job", {
    documentId: document.id,
    path,
    outputAlpha,
    expectedRevision: document.revision,
    dpi: document.artboard?.ppi ?? 300,
  });
  while (true) {
    const job = await invoke<JobSnapshot<ExportVerification>>("get_job_status", { jobId });
    onProgress(job);
    if (job.status === "completed") {
      if (!job.result?.reopenedAndVerified) throw new Error("La exportación no devolvió una verificación completa.");
      return job.result;
    }
    if (job.status === "cancelled") throw new Error("Exportación cancelada.");
    if (job.status === "failed") throw new Error(job.error ?? "No se pudo exportar la máscara.");
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }
}
