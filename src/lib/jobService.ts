import { invoke } from "@tauri-apps/api/core";
import type { AlphaAnalysis, AlphaTreatment, EdgePolishImpact, EdgePolishOptions, EdgePolishResult, ExportFormat, ExportVerification, JobSnapshot, TreatmentImpact, TreatmentResult } from "../types/alpha";
import type { StudioDocument } from "../types/document";
import type { MaskSummary, ResidueApplyResult, ResidueCleanupOptions } from "../types/residue";
import { rgbaBytesToBitmap } from "./bitmapService";

type StartedJob = { jobId: string };

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function watchJob<TResult>(
  started: Promise<StartedJob>,
  onProgress: (job: JobSnapshot<TResult>) => void,
): Promise<JobSnapshot<TResult>> {
  const { jobId } = await started;
  while (true) {
    const job = await invoke<JobSnapshot<TResult>>("get_job_status", { jobId });
    onProgress(job);
    if (job.status === "completed") return job;
    if (job.status === "cancelled") throw new Error("Operación cancelada.");
    if (job.status === "failed") throw new Error(job.error ?? "La operación no pudo completarse.");
    await delay(90);
  }
}

export async function runAnalysisJob(
  document: StudioDocument,
  onProgress: (job: JobSnapshot<AlphaAnalysis>) => void,
): Promise<AlphaAnalysis> {
  const job = await watchJob<AlphaAnalysis>(
    invoke<StartedJob>("start_alpha_analysis_job", { documentId: document.id }),
    onProgress,
  );
  if (!job.result) throw new Error("El análisis terminó sin resultado.");
  return job.result;
}

export async function runPreviewJob(
  document: StudioDocument,
  treatment: AlphaTreatment,
  onProgress: (job: JobSnapshot<TreatmentImpact>) => void,
): Promise<{ impact: TreatmentImpact; bitmap: ImageBitmap }> {
  const job = await watchJob<TreatmentImpact>(
    invoke<StartedJob>("start_alpha_preview_job", {
      documentId: document.id,
      treatment,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La previsualización terminó sin estadísticas.");
  const bytes = await invoke<ArrayBuffer>("get_job_binary", { jobId: job.id });
  return { impact: job.result, bitmap: await rgbaBytesToBitmap(bytes, document.width, document.height) };
}

export async function runTreatmentJob(
  document: StudioDocument,
  treatment: AlphaTreatment,
  onProgress: (job: JobSnapshot<TreatmentResult>) => void,
): Promise<TreatmentResult> {
  const job = await watchJob<TreatmentResult>(
    invoke<StartedJob>("start_alpha_treatment_job", {
      documentId: document.id,
      treatment,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("El tratamiento terminó sin resultado verificable.");
  return job.result;
}

export async function runEdgePolishPreviewJob(
  document: StudioDocument,
  options: EdgePolishOptions,
  onProgress: (job: JobSnapshot<EdgePolishImpact>) => void,
): Promise<{ impact: EdgePolishImpact; bitmap: ImageBitmap }> {
  const job = await watchJob<EdgePolishImpact>(
    invoke<StartedJob>("start_edge_polish_preview_job", {
      documentId: document.id,
      options,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La previsualización de borde terminó sin estadísticas.");
  const bytes = await invoke<ArrayBuffer>("get_job_binary", { jobId: job.id });
  return { impact: job.result, bitmap: await rgbaBytesToBitmap(bytes, document.width, document.height) };
}

export async function runEdgePolishApplyJob(
  document: StudioDocument,
  options: EdgePolishOptions,
  onProgress: (job: JobSnapshot<EdgePolishResult>) => void,
): Promise<EdgePolishResult> {
  const job = await watchJob<EdgePolishResult>(
    invoke<StartedJob>("start_edge_polish_apply_job", {
      documentId: document.id,
      options,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("El pulido terminó sin verificación técnica.");
  return job.result;
}

export async function runResidueCleanupJob(
  document: StudioDocument,
  options: ResidueCleanupOptions,
  onProgress: (job: JobSnapshot<MaskSummary>) => void,
): Promise<{ summary: MaskSummary; mask: Uint8Array }> {
  const job = await watchJob<MaskSummary>(
    invoke<StartedJob>("start_residue_cleanup_job", {
      documentId: document.id,
      options,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La detección de residuos terminó sin resultado.");
  const bytes = await invoke<ArrayBuffer>("get_job_binary", { jobId: job.id });
  return { summary: job.result, mask: new Uint8Array(bytes) };
}

export async function runApplyResidueJob(
  document: StudioDocument,
  onProgress: (job: JobSnapshot<ResidueApplyResult>) => void,
): Promise<ResidueApplyResult> {
  const job = await watchJob<ResidueApplyResult>(
    invoke<StartedJob>("start_apply_residue_job", {
      documentId: document.id,
      expectedRevision: document.revision,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La limpieza terminó sin verificación.");
  return job.result;
}

export async function runExportJob(
  document: StudioDocument,
  path: string,
  onProgress: (job: JobSnapshot<ExportVerification>) => void,
  options: { format?: ExportFormat; dpi?: number; avoidOverwrite?: boolean } = {},
): Promise<ExportVerification> {
  const job = await watchJob<ExportVerification>(
    invoke<StartedJob>("start_export_job", {
      documentId: document.id,
      path,
      expectedRevision: document.revision,
      dpi: options.dpi ?? 300,
      format: options.format,
      avoidOverwrite: options.avoidOverwrite,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La exportación terminó sin verificación.");
  return job.result;
}

export async function cancelJob(jobId: string): Promise<void> {
  await invoke("cancel_job", { jobId });
}
