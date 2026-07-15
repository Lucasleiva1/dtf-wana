import { invoke } from "@tauri-apps/api/core";
import type { StudioDocument } from "../types/document";
import type { DirtyRect, MaskEdit, MaskEditResult, MaskTilePatch } from "../types/residue";
import { useStudioStore } from "../stores/studioStore";

let previewSequence = 0;
let summarySequence = 0;
let summaryTimer: number | null = null;
const TILE_SIZE = 512;

export async function editResidueMask(document: StudioDocument, edit: MaskEdit): Promise<MaskEditResult> {
  return invoke<MaskEditResult>("edit_residue_mask", {
    documentId: document.id,
    edit,
    expectedRevision: document.revision,
  });
}

async function getMaskTile(documentId: string, rect: DirtyRect): Promise<MaskTilePatch> {
  const bytes = await invoke<ArrayBuffer>("get_residue_mask_tile", { documentId, rect });
  return { ...rect, bytes: new Uint8Array(bytes) };
}

export async function getResidueMaskBytes(documentId: string): Promise<Uint8Array> {
  return new Uint8Array(await invoke<ArrayBuffer>("get_residue_mask_bytes", { documentId }));
}

function tileRects(dirty: DirtyRect, width: number, height: number): DirtyRect[] {
  const minTileX = Math.floor(dirty.x / TILE_SIZE);
  const minTileY = Math.floor(dirty.y / TILE_SIZE);
  const maxTileX = Math.floor((dirty.x + dirty.width - 1) / TILE_SIZE);
  const maxTileY = Math.floor((dirty.y + dirty.height - 1) / TILE_SIZE);
  const rects: DirtyRect[] = [];
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const x = tileX * TILE_SIZE;
      const y = tileY * TILE_SIZE;
      rects.push({ x, y, width: Math.min(TILE_SIZE, width - x), height: Math.min(TILE_SIZE, height - y) });
    }
  }
  return rects;
}

export async function refreshResiduePreview(document: StudioDocument, result: MaskEditResult): Promise<void> {
  const sequence = ++previewSequence;
  const dirty = result.dirtyRect;
  const dirtyArea = dirty ? dirty.width * dirty.height : 0;
  const documentArea = document.width * document.height;
  let fullMask: Uint8Array | undefined;
  let tiles: MaskTilePatch[] | undefined;
  if (dirty && dirtyArea > documentArea * 0.3) {
    fullMask = await getResidueMaskBytes(document.id);
  } else if (dirty) {
    tiles = await Promise.all(tileRects(dirty, document.width, document.height).map((rect) => getMaskTile(document.id, rect)));
  }
  if (sequence !== previewSequence) return;
  const latest = useStudioStore.getState();
  if (latest.document?.id !== document.id) return;
  latest.setResidueMask(result.summary);
  if (dirty) {
    latest.setResidueOverlay({ documentId: document.id, width: document.width, height: document.height, fullMask, tiles });
  }
  if (summaryTimer !== null) window.clearTimeout(summaryTimer);
  const scheduledSequence = ++summarySequence;
  summaryTimer = window.setTimeout(() => {
    void invoke<MaskEditResult["summary"]>("get_residue_mask_summary", { documentId: document.id })
      .then((summary) => {
        const current = useStudioStore.getState();
        if (scheduledSequence === summarySequence && current.document?.id === document.id) current.setResidueMask(summary);
      })
      .catch(() => { /* una nueva edición o documento invalida este recuento secundario */ });
  }, 750);
}
