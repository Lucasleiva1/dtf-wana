import type { AlphaAnalysis } from "../types/alpha";
import { useStudioStore } from "../stores/studioStore";
import { dispatchCommand } from "./commandBus";
import { getDocumentPreview } from "./alphaService";

type HistoryResult = {
  changed: boolean;
  revision: number;
  analysis: AlphaAnalysis;
};

let historyChangeInProgress = false;

export async function changePixelHistory(direction: "undo" | "redo"): Promise<void> {
  if (historyChangeInProgress) return;

  const state = useStudioStore.getState();
  const document = state.document;
  if (!document) return;
  if (direction === "undo" && state.history.length <= 1) return;
  if (direction === "redo" && state.future.length === 0) return;

  historyChangeInProgress = true;
  state.setAlphaStatus("applying");
  try {
    const response = await dispatchCommand<{ documentId: string }, HistoryResult>(
      `document.${direction}`,
      { documentId: document.id },
      { expectedRevision: document.revision },
    );
    if (!response.ok || !response.data) {
      throw new Error(response.error?.message ?? `No se pudo ${direction === "undo" ? "deshacer" : "rehacer"}.`);
    }
    if (!response.data.changed) return;

    const latest = useStudioStore.getState();
    const preview = latest.previewMode === "original"
      ? document.sourceFile
      : await getDocumentPreview(document.id, latest.previewMode);
    latest.updateDocument({
      revision: response.data.revision,
      dirty: response.data.revision > 0,
      renderBlob: preview,
      renderRevision: document.renderRevision + 1,
    });
    latest.setAlphaAnalysis(response.data.analysis);
    if (direction === "undo") latest.undo();
    else latest.redo();
    latest.setAlphaStatus("complete");
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    const latest = useStudioStore.getState();
    latest.setAlphaStatus("error", message);
    latest.setNotification({ kind: "error", text: message });
  } finally {
    historyChangeInProgress = false;
  }
}
