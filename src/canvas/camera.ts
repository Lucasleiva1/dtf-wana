import type { Camera } from "../types/document";

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomAt(camera: Camera, nextZoom: number, point: { x: number; y: number }): Camera {
  const zoom = clampZoom(nextZoom);
  const worldX = (point.x - camera.x) / camera.zoom;
  const worldY = (point.y - camera.y) / camera.zoom;
  return {
    zoom,
    x: point.x - worldX * zoom,
    y: point.y - worldY * zoom,
  };
}

export function fitRect(container: { width: number; height: number }, rect: { width: number; height: number }, padding = 72): Camera {
  const availableWidth = Math.max(1, container.width - padding * 2);
  const availableHeight = Math.max(1, container.height - padding * 2);
  const zoom = clampZoom(Math.min(availableWidth / rect.width, availableHeight / rect.height));
  return {
    zoom,
    x: (container.width - rect.width * zoom) / 2,
    y: (container.height - rect.height * zoom) / 2,
  };
}
