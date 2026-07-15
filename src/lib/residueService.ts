import { invoke } from "@tauri-apps/api/core";
import type { StudioDocument } from "../types/document";
import type { MaskEdit, MaskSummary } from "../types/residue";
import { useStudioStore } from "../stores/studioStore";

let previewSequence = 0;

export async function editResidueMask(document: StudioDocument, edit: MaskEdit): Promise<MaskSummary> {
  return invoke<MaskSummary>("edit_residue_mask", {
    documentId: document.id,
    edit,
    expectedRevision: document.revision,
  });
}

export async function getResidueMaskPreview(documentId: string): Promise<Blob> {
  const bytes = await invoke<ArrayBuffer>("get_residue_mask_preview", { documentId });
  return new Blob([bytes], { type: "image/png" });
}

export async function refreshResiduePreview(document: StudioDocument, summary: MaskSummary): Promise<void> {
  const sequence = ++previewSequence;
  const blob = await getResidueMaskPreview(document.id);
  if (sequence !== previewSequence) return;
  const latest = useStudioStore.getState();
  if (latest.document?.id !== document.id) return;
  latest.setResidueMask(summary);
  latest.updateDocument({ renderBlob: blob, renderRevision: latest.document.renderRevision + 1 });
}
