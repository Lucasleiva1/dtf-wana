import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { ImageMinus, ImagePlus, MousePointer2 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import { editResidueMask, refreshResiduePreview } from "../lib/residueService";
import type { MaskMode, MaskPoint } from "../types/residue";

type ResidueGesture = { tool: "residue-rectangle" | "residue-lasso" | "residue-brush"; points: MaskPoint[]; mode: MaskMode; pointerId: number };
type PixiWorkspace = {
  app: Application;
  world: Container;
  artboard: Graphics;
  baseSprite?: Sprite;
  overlayTiles: Map<string, Sprite>;
};

const MASK_TILE_SIZE = 512;

export function CanvasWorkspace({ onOpen, onRemove }: { onOpen: () => void; onRemove: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiWorkspace | null>(null);
  const [rendererReady, setRendererReady] = useState(0);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [residueGesture, setResidueGesture] = useState<ResidueGesture | null>(null);
  const gestureRef = useRef<ResidueGesture | null>(null);
  const [cursorPoint, setCursorPoint] = useState<MaskPoint | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showMaskActivity, setShowMaskActivity] = useState(false);
  const pendingMaskEdits = useRef(0);
  const document = useStudioStore((state) => state.document);
  const camera = useStudioStore((state) => state.camera);
  const previewBackground = useStudioStore((state) => state.previewBackground);
  const customBackgroundColor = useStudioStore((state) => state.customBackgroundColor);
  const activeTool = useStudioStore((state) => state.activeTool);
  const activeJob = useStudioStore((state) => state.activeJob);
  const setViewport = useStudioStore((state) => state.setViewport);
  const panBy = useStudioStore((state) => state.panBy);
  const setZoomAt = useStudioStore((state) => state.setZoomAt);
  const residueMode = useStudioStore((state) => state.residueMaskMode);
  const residueBrushSize = useStudioStore((state) => state.residueBrushSize);
  const setResidueMaskMode = useStudioStore((state) => state.setResidueMaskMode);
  const setRendererInfo = useStudioStore((state) => state.setRendererInfo);
  const residueOverlay = useStudioStore((state) => state.residueOverlay);
  const residueOverlayVisible = useStudioStore((state) => state.residueOverlayVisible);
  const scanning = activeJob?.operation === "alpha_analysis" && (activeJob.status === "queued" || activeJob.status === "running");
  const scanRatio = !activeJob || activeJob.stageIndex < 2
    ? 0
    : activeJob.stageIndex > 2
      ? 1
      : activeJob.processedUnits / Math.max(1, activeJob.totalUnits);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const world = new Container();
    const artboard = new Graphics();
    setRendererError(null);
    void app.init({
      resizeTo: host,
      preference: ["webgl"],
      // This remains hardware WebGL. Omitting the optional adapter hint avoids
      // a WebView2/driver failure while Windows selects the working GPU.
      antialias: false,
      backgroundAlpha: 0,
      resolution: Math.min(devicePixelRatio, 1.5),
      autoDensity: true,
    })
      .then(() => {
        initialized = true;
        if (disposed) return app.destroy(true);
        host.appendChild(app.canvas);
        app.stage.addChild(world);
        world.sortableChildren = true;
        artboard.zIndex = 10;
        world.addChild(artboard);
        pixiRef.current = { app, world, artboard, overlayTiles: new Map() };
        const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
        const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
        const gpuName = gl && debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "WebGL acelerado";
        setRendererInfo(gpuName);
        setRendererReady((value) => value + 1);
        setViewport({ width: host.clientWidth, height: host.clientHeight });
      })
      .catch((reason: unknown) => {
        const detail = reason instanceof Error ? reason.message : String(reason);
        console.error("No se pudo iniciar el renderizador WebGL", reason);
        setRendererInfo("WebGL no iniciado");
        setRendererError(detail);
      });

    const observer = new ResizeObserver(() => setViewport({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    return () => {
      disposed = true;
      observer.disconnect();
      pixiRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, [setRendererInfo, setViewport]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    pixi.world.position.set(camera.x, camera.y);
    pixi.world.scale.set(camera.zoom);
  }, [camera]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    let cancelled = false;
    let swapped = false;
    const load = async () => {
      setImageError(null);
      if (!document) {
        if (pixi.baseSprite) {
          pixi.world.removeChild(pixi.baseSprite);
          pixi.baseSprite.destroy({ texture: true, textureSource: true });
          pixi.baseSprite = undefined;
        }
        pixi.artboard.clear();
        return;
      }
      pixi.artboard.clear();
      pixi.artboard.rect(0, 0, document.width, document.height).stroke({ color: 0x8f8a83, width: 1 });
      const bitmap = await createImageBitmap(document.renderBlob);
      if (cancelled || !pixiRef.current || pixiRef.current !== pixi) {
        bitmap.close();
        return;
      }
      const texture = Texture.from(bitmap);
      const sprite = new Sprite(texture);
      sprite.width = document.width;
      sprite.height = document.height;
      sprite.zIndex = 0;
      sprite.visible = false;
      pixi.world.addChild(sprite);
      const previous = pixi.baseSprite;
      requestAnimationFrame(() => {
        if (cancelled || pixiRef.current !== pixi) {
          pixi.world.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
          return;
        }
        sprite.visible = true;
        pixi.baseSprite = sprite;
        swapped = true;
        if (previous && previous !== sprite) {
          pixi.world.removeChild(previous);
          previous.destroy({ texture: true, textureSource: true });
        }
      });
    };
    void load().catch((reason) => setImageError(reason instanceof Error ? reason.message : "No se pudo mostrar la imagen."));
    return () => { cancelled = true; if (!swapped) { /* la textura anterior permanece visible */ } };
  }, [document?.id, document?.renderRevision, rendererReady]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi || !document || !residueOverlay || residueOverlay.documentId !== document.id) return;
    let cancelled = false;
    const replaceTile = async (x: number, y: number, width: number, height: number, mask: Uint8Array) => {
      const key = `${x}:${y}`;
      const previous = pixi.overlayTiles.get(key);
      let hasSelection = false;
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] === 0) continue;
        hasSelection = true;
        const offset = index * 4;
        rgba[offset] = 255;
        rgba[offset + 1] = 35;
        rgba[offset + 2] = 45;
        rgba[offset + 3] = 210;
      }
      if (!hasSelection) {
        if (previous) {
          pixi.overlayTiles.delete(key);
          pixi.world.removeChild(previous);
          previous.destroy({ texture: true, textureSource: true });
        }
        return;
      }
      const bitmap = await createImageBitmap(new ImageData(rgba, width, height));
      if (cancelled || pixiRef.current !== pixi) { bitmap.close(); return; }
      const sprite = new Sprite(Texture.from(bitmap));
      sprite.x = x;
      sprite.y = y;
      sprite.width = width;
      sprite.height = height;
      sprite.zIndex = 20;
      sprite.visible = false;
      pixi.world.addChild(sprite);
      requestAnimationFrame(() => {
        if (cancelled || pixiRef.current !== pixi) {
          pixi.world.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
          return;
        }
        sprite.visible = residueOverlayVisible;
        pixi.overlayTiles.set(key, sprite);
        if (previous && previous !== sprite) {
          pixi.world.removeChild(previous);
          previous.destroy({ texture: true, textureSource: true });
        }
      });
    };
    const update = async () => {
      const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (residueOverlay.clear) {
        for (const sprite of pixi.overlayTiles.values()) {
          pixi.world.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
        }
        pixi.overlayTiles.clear();
        return;
      }
      if (residueOverlay.fullMask) {
        const nextKeys = new Set<string>();
        let processedTiles = 0;
        for (let y = 0; y < residueOverlay.height; y += MASK_TILE_SIZE) {
          for (let x = 0; x < residueOverlay.width; x += MASK_TILE_SIZE) {
            const width = Math.min(MASK_TILE_SIZE, residueOverlay.width - x);
            const height = Math.min(MASK_TILE_SIZE, residueOverlay.height - y);
            const tile = new Uint8Array(width * height);
            for (let row = 0; row < height; row += 1) {
              const sourceStart = (y + row) * residueOverlay.width + x;
              tile.set(residueOverlay.fullMask.subarray(sourceStart, sourceStart + width), row * width);
            }
            nextKeys.add(`${x}:${y}`);
            await replaceTile(x, y, width, height, tile);
            processedTiles += 1;
            if (processedTiles % 2 === 0) await yieldFrame();
          }
        }
        for (const [key, sprite] of pixi.overlayTiles) {
          if (nextKeys.has(key)) continue;
          pixi.overlayTiles.delete(key);
          pixi.world.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
        }
      } else if (residueOverlay.tiles) {
        for (const tile of residueOverlay.tiles) {
          await replaceTile(tile.x, tile.y, tile.width, tile.height, tile.bytes);
        }
      }
    };
    void update().catch((reason) => setImageError(reason instanceof Error ? reason.message : "No se pudo actualizar la máscara GPU."));
    return () => { cancelled = true; };
  }, [document?.id, rendererReady, residueOverlay?.revision]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    for (const sprite of pixi.overlayTiles.values()) sprite.visible = residueOverlayVisible;
  }, [residueOverlayVisible]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !document) return;
    const context = (event: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const current = useStudioStore.getState().camera;
      const x = (event.clientX - rect.left - current.x) / current.zoom;
      const y = (event.clientY - rect.top - current.y) / current.zoom;
      if (x < 0 || y < 0 || x >= document.width || y >= document.height) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    host.addEventListener("contextmenu", context);
    return () => host.removeEventListener("contextmenu", context);
  }, [document]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      const residueTool = activeTool.startsWith("residue-");
      if (activeTool !== "hand" && event.button !== 1 && (!event.altKey || residueTool)) return;
      dragging = true;
      last = { x: event.clientX, y: event.clientY };
      host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      panBy(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    };
    const up = () => { dragging = false; };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const current = useStudioStore.getState().camera;
      setZoomAt(current.zoom * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", wheel, { passive: false });
    return () => {
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("wheel", wheel);
    };
  }, [activeTool, panBy, setZoomAt]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !document) return;
    const isResidueTool = activeTool === "residue-region" || activeTool === "residue-rectangle" || activeTool === "residue-lasso" || activeTool === "residue-brush";
    if (!isResidueTool) {
      setResidueGesture(null);
      gestureRef.current = null;
      setCursorPoint(null);
      return;
    }
    const imagePoint = (event: PointerEvent): MaskPoint | null => {
      const rect = host.getBoundingClientRect();
      const current = useStudioStore.getState().camera;
      const x = (event.clientX - rect.left - current.x) / current.zoom;
      const y = (event.clientY - rect.top - current.y) / current.zoom;
      if (x < 0 || y < 0 || x >= document.width || y >= document.height) return null;
      return { x, y };
    };
    const edit = async (maskEdit: Parameters<typeof editResidueMask>[1]) => {
      pendingMaskEdits.current += 1;
      const activityTimer = window.setTimeout(() => setShowMaskActivity(true), 150);
      try {
        const latest = useStudioStore.getState().document;
        if (!latest) return;
        const summary = await editResidueMask(latest, maskEdit);
        await refreshResiduePreview(latest, summary);
      } catch (reason) {
        useStudioStore.getState().setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
      } finally {
        window.clearTimeout(activityTimer);
        pendingMaskEdits.current -= 1;
        if (pendingMaskEdits.current === 0) setShowMaskActivity(false);
      }
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = imagePoint(event);
      if (!point) return;
      event.preventDefault();
      setContextMenu(null);
      const mode: MaskMode = event.altKey ? "subtract" : event.shiftKey ? "add" : residueMode;
      if (activeTool === "residue-region") {
        void edit({ action: "component", x: Math.floor(point.x), y: Math.floor(point.y), mode });
        return;
      }
      const gesture: ResidueGesture = { tool: activeTool, points: [point], mode, pointerId: event.pointerId };
      gestureRef.current = gesture;
      setResidueGesture(gesture);
      host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const point = imagePoint(event);
      setCursorPoint(point);
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId || !point) return;
      const previous = gesture.points[gesture.points.length - 1];
      const minimumDistance = gesture.tool === "residue-brush" ? Math.max(0.5, residueBrushSize / 8) : 1;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < minimumDistance) return;
      const updated = { ...gesture, points: [...gesture.points, point] };
      gestureRef.current = updated;
      setResidueGesture(updated);
    };
    const up = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gestureRef.current = null;
      let operation: Promise<void> | null = null;
      if (gesture.tool === "residue-rectangle") {
        operation = edit({ action: "rectangle", start: gesture.points[0], end: gesture.points[gesture.points.length - 1], mode: gesture.mode });
      } else if (gesture.tool === "residue-lasso" && gesture.points.length >= 3) {
        operation = edit({ action: "lasso", points: gesture.points, mode: gesture.mode });
      } else if (gesture.tool === "residue-brush") {
        operation = edit({ action: "brush", points: gesture.points, radius: Math.max(1, Math.round(residueBrushSize / 2)), mode: gesture.mode });
      }
      if (operation) void operation.finally(() => setResidueGesture(null));
      else setResidueGesture(null);
    };
    const leave = () => { if (!gestureRef.current) setCursorPoint(null); };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("pointerleave", leave);
    };
  }, [activeTool, document, residueBrushSize, residueMode]);

  return (
    <div ref={hostRef} className={`canvas-workspace tool-${activeTool} background-${previewBackground}`} style={previewBackground === "custom" ? { background: customBackgroundColor } : undefined} aria-label="Lienzo de trabajo" onPointerDown={() => setContextMenu(null)}>
      {!document && (
        <button className="empty-canvas" onClick={onOpen}>
          <ImagePlus size={34} strokeWidth={1.3} />
          <span>Abrir una imagen</span>
          <small>PNG, JPG, WebP, TIFF o BMP</small>
        </button>
      )}
      {document && <div className="canvas-hint"><MousePointer2 size={13} /> Rueda: zoom · Mano: desplazar</div>}
      {document && scanning && <div className={`scanner-overlay ${activeJob.stageIndex >= 3 ? "grouping" : ""}`} style={{
        left: camera.x,
        top: camera.y,
        width: document.width * camera.zoom,
        height: document.height * camera.zoom,
        "--scan-real-progress": `${Math.max(0, Math.min(1, scanRatio)) * 100}%`,
      } as React.CSSProperties}><div /><i /><span>{activeJob.stage}<small>{activeJob.percent.toFixed(0)} %</small></span></div>}
      {document && residueGesture && <svg className="residue-gesture-overlay" style={{ left: camera.x, top: camera.y, width: document.width * camera.zoom, height: document.height * camera.zoom }} viewBox={`0 0 ${document.width} ${document.height}`} preserveAspectRatio="none">
        {residueGesture.tool === "residue-rectangle" ? <rect x={residueGesture.points[0].x} y={residueGesture.points[0].y} width={residueGesture.points[residueGesture.points.length - 1].x - residueGesture.points[0].x} height={residueGesture.points[residueGesture.points.length - 1].y - residueGesture.points[0].y} /> : <polyline points={residueGesture.points.map((point) => `${point.x},${point.y}`).join(" ")} className={residueGesture.tool === "residue-brush" ? "brush-stroke" : "lasso-stroke"} style={residueGesture.tool === "residue-brush" ? { strokeWidth: residueBrushSize } : undefined} />}
      </svg>}
      {activeTool === "residue-brush" && cursorPoint && <div className={`brush-cursor mode-${residueMode}`} style={{ left: camera.x + cursorPoint.x * camera.zoom, top: camera.y + cursorPoint.y * camera.zoom, width: Math.max(2, residueBrushSize * camera.zoom), height: Math.max(2, residueBrushSize * camera.zoom) }} />}
      {contextMenu && <div className="canvas-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={() => { window.dispatchEvent(new CustomEvent("dtf:apply-residue")); setContextMenu(null); }}>Forzar transparente <kbd>Supr</kbd></button>
        <button onClick={() => { setResidueMaskMode("add"); setContextMenu(null); }}>Añadir a eliminación</button>
        <button onClick={() => { setResidueMaskMode("subtract"); setContextMenu(null); }}>Quitar de eliminación</button>
        <button onClick={() => { const latest = useStudioStore.getState().document; if (latest) void editResidueMask(latest, { action: "clear" }).then((summary) => refreshResiduePreview(latest, summary)); setContextMenu(null); }}>Deseleccionar todo</button>
        <i />
        <button className="remove-image" onClick={() => { setContextMenu(null); onRemove(); }}><span><ImageMinus size={14} /> Quitar imagen</span><small>No borra el archivo</small></button>
      </div>}
      {showMaskActivity && <div className="mask-update-indicator">Actualizando máscara…</div>}
      {rendererError && <div className="renderer-error">No se pudo iniciar WebGL: {rendererError}</div>}
      {imageError && <div className="renderer-error">No se pudo crear la vista previa: {imageError}</div>}
    </div>
  );
}
