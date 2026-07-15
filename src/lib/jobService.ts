import { invoke } from "@tauri-apps/api/core";
import type { AlphaAnalysis, AlphaTreatment, ExportVerification, JobSnapshot, TreatmentImpact, TreatmentResult } from "../types/alpha";
import type { StudioDocument } from "../types/document";

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
): Promise<{ impact: TreatmentImpact; blob: Blob }> {
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
  return { impact: job.result, blob: new Blob([bytes], { type: "image/png" }) };
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

export async function runExportJob(
  document: StudioDocument,
  path: string,
  onProgress: (job: JobSnapshot<ExportVerification>) => void,
): Promise<ExportVerification> {
  const job = await watchJob<ExportVerification>(
    invoke<StartedJob>("start_export_job", {
      documentId: document.id,
      path,
      expectedRevision: document.revision,
      dpi: 300,
    }),
    onProgress,
  );
  if (!job.result) throw new Error("La exportación terminó sin verificación.");
  return job.result;
}

export async function cancelJob(jobId: string): Promise<void> {
  await invoke("cancel_job", { jobId });
}
