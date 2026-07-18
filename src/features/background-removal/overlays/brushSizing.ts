export const MIN_BACKGROUND_BRUSH_SIZE = 1;
export const MAX_BACKGROUND_BRUSH_SIZE = 500;

export function brushSizeFromHorizontalDrag(initialSize: number, screenDeltaX: number, zoom: number) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const nextSize = Math.round(initialSize + screenDeltaX / safeZoom);
  return Math.max(MIN_BACKGROUND_BRUSH_SIZE, Math.min(MAX_BACKGROUND_BRUSH_SIZE, nextSize));
}
