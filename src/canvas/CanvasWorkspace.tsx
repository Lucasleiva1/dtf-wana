import { useEffect, useRef, useState } from "react";
// Installs PixiJS' CSP-safe shader/uniform generators before creating a renderer.
// Tauri intentionally disallows `unsafe-eval` in production.
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { ImageMinus, ImagePlus, MousePointer2 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import { editResidueMask, refreshResiduePreview } from "../lib/residueService";
import type { MaskMode, MaskPoint } from "../types/residue";
import type { DocumentGuide, PlacedImage } from "../types/document";
import { artboardFor } from "../lib/measurements";
import { PrecisionOverlay } from "./PrecisionOverlay";

type ResidueGesture = { tool: "residue-rectangle" | "residue-lasso" | "residue-brush"; points: MaskPoint[]; mode: MaskMode; pointerId: number };
type PixiWorkspace = {
  app: Application;
  world: Container;
  artboard: Graphics;
  content: Container;
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
  const [spaceHand, setSpaceHand] = useState(false);
  const [smartGuideLines, setSmartGuideLines] = useState<{ vertical?: number; horizontal?: number }>({});
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
  const renderDevice = useStudioStore((state) => state.renderDevice);
  const setResidueMaskMode = useStudioStore((state) => state.setResidueMaskMode);
  const setActiveRenderDevice = useStudioStore((state) => state.setActiveRenderDevice);
  const setRendererInfo = useStudioStore((state) => state.setRendererInfo);
  const updatePlacedImage = useStudioStore((state) => state.updatePlacedImage);
  const selectedItemId = useStudioStore((state) => state.selectedItemId);
  const setSelectedItem = useStudioStore((state) => state.setSelectedItem);
  const commitPlacedImageTransform = useStudioStore((state) => state.commitPlacedImageTransform);
  const snapToGuides = useStudioStore((state) => state.snapToGuides);
  const smartGuidesEnabled = useStudioStore((state) => state.smartGuidesEnabled);
  const residueOverlay = useStudioStore((state) => state.residueOverlay);
  const residueOverlayVisible = useStudioStore((state) => state.residueOverlayVisible);
  const scanning = activeJob?.operation === "alpha_analysis" && (activeJob.status === "queued" || activeJob.status === "running");
  const workspaceArtboard = document ? artboardFor(document) : null;
  const scanRatio = !activeJob || activeJob.stageIndex < 2
    ? 0
    : activeJob.stageIndex > 2
      ? 1
      : activeJob.processedUnits / Math.max(1, activeJob.totalUnits);
  const projectImagePoint = (point: MaskPoint) => {
    const item = document?.placedImage;
    if (!item) return { x: camera.x + point.x * camera.zoom, y: camera.y + point.y * camera.zoom, scale: camera.zoom };
    const localX = point.x * item.width / item.sourceWidth - item.width / 2;
    const localY = point.y * item.height / item.sourceHeight - item.height / 2;
    const radians = item.rotation * Math.PI / 180;
    return {
      x: camera.x + (item.x + item.width / 2 + localX * Math.cos(radians) - localY * Math.sin(radians)) * camera.zoom,
      y: camera.y + (item.y + item.height / 2 + localX * Math.sin(radians) + localY * Math.cos(radians)) * camera.zoom,
      scale: camera.zoom * ((item.width / item.sourceWidth + item.height / item.sourceHeight) / 2),
    };
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || (event.target as HTMLElement).matches("input, textarea, select")) return;
      event.preventDefault();
      setSpaceHand(true);
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceHand(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => setSpaceHand(false), { once: true });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!selectedItemId || (activeTool !== "select" && activeTool !== "transform") || (event.target as HTMLElement).matches("input, textarea, select")) return;
      if (!event.key.startsWith("Arrow")) return;
      const item = useStudioStore.getState().document?.placedImage;
      if (!item || item.id !== selectedItemId) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      updatePlacedImage({ x: item.x + dx, y: item.y + dy });
      commitPlacedImageTransform(item);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeTool, commitPlacedImageTransform, selectedItemId, updatePlacedImage]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const world = new Container();
    const artboard = new Graphics();
    const content = new Container();
    const preference: Array<"webgl" | "canvas"> = renderDevice === "gpu" ? ["webgl", "canvas"] : ["canvas"];
    setRendererError(null);
    setActiveRenderDevice(null);
    setRendererInfo(renderDevice === "gpu" ? "Inicializando GPU" : "Inicializando CPU");
    void app.init({
      resizeTo: host,
      preference,
      powerPreference: renderDevice === "gpu" ? "high-performance" : undefined,
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
        artboard.zIndex = -10;
        content.zIndex = 0;
        content.sortableChildren = true;
        world.addChild(artboard, content);
        pixiRef.current = { app, world, artboard, content, overlayTiles: new Map() };
        const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
        if (gl) {
          const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
          const gpuName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "WebGL acelerado";
          setActiveRenderDevice("gpu");
          setRendererInfo(gpuName);
        } else {
          setActiveRenderDevice("cpu");
          setRendererInfo(renderDevice === "gpu" ? "CPU · Canvas 2D (respaldo automático)" : "CPU · Canvas 2D");
        }
        setRendererReady((value) => value + 1);
        setViewport({ width: host.clientWidth, height: host.clientHeight });
      })
      .catch((reason: unknown) => {
        const detail = reason instanceof Error ? reason.message : String(reason);
        console.error("No se pudo iniciar el renderizador", reason);
        setActiveRenderDevice(null);
        setRendererInfo("Renderizador no iniciado");
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
  }, [renderDevice, setActiveRenderDevice, setRendererInfo, setViewport]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    pixi.world.position.set(camera.x, camera.y);
    pixi.world.scale.set(camera.zoom);
  }, [camera]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    pixi.artboard.clear();
    if (!document) return;
    const artboard = artboardFor(document);
    const background = artboard.background === "white" ? 0xffffff : artboard.background === "black" ? 0x050505 : artboard.background === "custom" ? Number.parseInt((artboard.backgroundColor ?? "#ffffff").slice(1), 16) : 0xffffff;
    const alpha = artboard.background === "transparent" ? 0.045 : 1;
    pixi.artboard.rect(0, 0, artboard.widthPx, artboard.heightPx).fill({ color: background, alpha }).stroke({ color: 0xbab2a7, width: Math.max(1, 1 / camera.zoom), alpha: 0.9 });
  }, [document?.id, document?.artboard, camera.zoom, rendererReady]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi || !document) return;
    const item = document.placedImage ?? (document.engineReady === false ? null : { sourceWidth: document.width, sourceHeight: document.height, x: 0, y: 0, width: document.width, height: document.height, rotation: 0 });
    pixi.content.visible = Boolean(item);
    if (!item) return;
    pixi.content.pivot.set(item.sourceWidth / 2, item.sourceHeight / 2);
    pixi.content.position.set(item.x + item.width / 2, item.y + item.height / 2);
    pixi.content.scale.set(item.width / item.sourceWidth, item.height / item.sourceHeight);
    pixi.content.rotation = item.rotation * Math.PI / 180;
  }, [document?.id, document?.placedImage, rendererReady]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    let cancelled = false;
    let swapped = false;
    const load = async () => {
      setImageError(null);
      if (!document || document.engineReady === false || document.placedImage === null) {
        if (pixi.baseSprite) {
          pixi.content.removeChild(pixi.baseSprite);
          pixi.baseSprite.destroy({ texture: true, textureSource: true });
          pixi.baseSprite = undefined;
        }
        return;
      }
      const bitmap = await createImageBitmap(document.renderBlob);
      if (cancelled || !pixiRef.current || pixiRef.current !== pixi) {
        bitmap.close();
        return;
      }
      const texture = Texture.from(bitmap);
      const sprite = new Sprite(texture);
      sprite.eventMode = "static";
      sprite.cursor = "move";
      sprite.width = document.width;
      sprite.height = document.height;
      sprite.zIndex = 0;
      sprite.visible = false;
      pixi.content.addChild(sprite);
      const previous = pixi.baseSprite;
      requestAnimationFrame(() => {
        if (cancelled || pixiRef.current !== pixi) {
          pixi.content.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
          return;
        }
        sprite.visible = true;
        pixi.baseSprite = sprite;
        swapped = true;
        if (previous && previous !== sprite) {
          pixi.content.removeChild(previous);
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
          pixi.content.removeChild(previous);
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
      pixi.content.addChild(sprite);
      requestAnimationFrame(() => {
        if (cancelled || pixiRef.current !== pixi) {
          pixi.content.removeChild(sprite);
          sprite.destroy({ texture: true, textureSource: true });
          return;
        }
        sprite.visible = residueOverlayVisible;
        pixi.overlayTiles.set(key, sprite);
        if (previous && previous !== sprite) {
          pixi.content.removeChild(previous);
          previous.destroy({ texture: true, textureSource: true });
        }
      });
    };
    const update = async () => {
      const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (residueOverlay.clear) {
        for (const sprite of pixi.overlayTiles.values()) {
          pixi.content.removeChild(sprite);
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
          pixi.content.removeChild(sprite);
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
      const item = document.placedImage;
      if (!item) return;
      const radians = -item.rotation * Math.PI / 180;
      const dx = x - (item.x + item.width / 2);
      const dy = y - (item.y + item.height / 2);
      const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
      const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
      if (Math.abs(localX) > item.width / 2 || Math.abs(localY) > item.height / 2) return;
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
      if (activeTool !== "hand" && event.button !== 1 && !spaceHand) return;
      if ((event.target as Element).closest(".precision-overlay")) return;
      event.preventDefault();
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
  }, [activeTool, panBy, setZoomAt, spaceHand]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !document?.placedImage || (activeTool !== "select" && activeTool !== "transform")) return;
    let drag: { pointerId: number; worldX: number; worldY: number; before: PlacedImage; mode: "move" | "resize"; handle?: ResizeHandle } | null = null;
    let pendingPoint: { x: number; y: number } | null = null;
    let animationFrame: number | null = null;
    const worldPoint = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const current = useStudioStore.getState().camera;
      return { x: (event.clientX - rect.left - current.x) / current.zoom, y: (event.clientY - rect.top - current.y) / current.zoom };
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || spaceHand) return;
      if ((event.target as Element).closest(".precision-overlay")) return;
      const latest = useStudioStore.getState().document?.placedImage;
      if (!latest) return;
      const point = worldPoint(event);
      const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-resize]")?.dataset.resize as ResizeHandle | undefined;
      const radians = -latest.rotation * Math.PI / 180;
      const dx = point.x - (latest.x + latest.width / 2);
      const dy = point.y - (latest.y + latest.height / 2);
      const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
      const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
      const hit = Math.abs(localX) <= latest.width / 2 && Math.abs(localY) <= latest.height / 2;
      if (!handle && !hit) {
        setSelectedItem(null);
        setSmartGuideLines({});
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setSelectedItem(latest.id);
      drag = { pointerId: event.pointerId, worldX: point.x, worldY: point.y, before: structuredClone(latest), mode: handle ? "resize" : "move", handle };
      host.setPointerCapture(event.pointerId);
    };
    const applyPendingMove = () => {
      animationFrame = null;
      const activeDrag = drag;
      const point = pendingPoint;
      pendingPoint = null;
      if (!activeDrag || !point) return;
      const dx = point.x - activeDrag.worldX;
      const dy = point.y - activeDrag.worldY;
      const transformed = activeDrag.mode === "resize" && activeDrag.handle
        ? resizeProportionally(activeDrag.before, activeDrag.handle, dx, dy)
        : { ...activeDrag.before, x: activeDrag.before.x + dx, y: activeDrag.before.y + dy };
      const latestState = useStudioStore.getState();
      const latestDocument = latestState.document;
      if (!latestDocument) return;
      const artboard = artboardFor(latestDocument);
      const snapped = snapPlacedImage(transformed, artboard.widthPx, artboard.heightPx, latestDocument.guides ?? [], latestState.camera.zoom, latestState.snapToGuides, latestState.smartGuidesEnabled);
      updatePlacedImage({ ...snapped.item, lockAspect: true });
      setSmartGuideLines(latestState.smartGuidesEnabled ? snapped.lines : {});
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      pendingPoint = worldPoint(event);
      if (animationFrame === null) animationFrame = requestAnimationFrame(applyPendingMove);
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      if (pendingPoint) applyPendingMove();
      commitPlacedImageTransform(drag.before);
      drag = null;
      pendingPoint = null;
      animationFrame = null;
      setSmartGuideLines({});
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    return () => { if (animationFrame !== null) cancelAnimationFrame(animationFrame); host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move); host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", up); };
  }, [activeTool, camera.zoom, commitPlacedImageTransform, document?.id, setSelectedItem, smartGuidesEnabled, snapToGuides, spaceHand, updatePlacedImage]);

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
      const worldX = (event.clientX - rect.left - current.x) / current.zoom;
      const worldY = (event.clientY - rect.top - current.y) / current.zoom;
      const item = document.placedImage;
      if (!item) return null;
      const radians = -item.rotation * Math.PI / 180;
      const dx = worldX - (item.x + item.width / 2);
      const dy = worldY - (item.y + item.height / 2);
      const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
      const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
      const x = (rotatedX + item.width / 2) * item.sourceWidth / item.width;
      const y = (rotatedY + item.height / 2) * item.sourceHeight / item.height;
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
    <div ref={hostRef} className={`canvas-workspace tool-${activeTool}${spaceHand ? " temporary-hand" : ""} background-${previewBackground}`} style={previewBackground === "custom" ? { background: customBackgroundColor } : undefined} aria-label="Lienzo de trabajo" onPointerDown={() => setContextMenu(null)}>
      <PrecisionOverlay />
      {!document && (
        <button className="empty-canvas" onClick={onOpen}>
          <ImagePlus size={34} strokeWidth={1.3} />
          <span>Abrir una imagen</span>
          <small>PNG, JPG, WebP, TIFF o BMP</small>
        </button>
      )}
      {document && !document.placedImage && (
        <button className="empty-canvas" onClick={onOpen}>
          <ImagePlus size={34} strokeWidth={1.3} />
          <span>Abrir otra imagen</span>
          <small>La mesa y sus medidas se conservan</small>
        </button>
      )}
      {document && <div className="canvas-hint"><MousePointer2 size={13} /> Rueda: zoom · Mano: desplazar</div>}
      {document?.placedImage && selectedItemId === document.placedImage.id && <div className="placed-image-selection" style={{ left: camera.x + document.placedImage.x * camera.zoom, top: camera.y + document.placedImage.y * camera.zoom, width: document.placedImage.width * camera.zoom, height: document.placedImage.height * camera.zoom, transform: `rotate(${document.placedImage.rotation}deg)` }}>
        {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]).map((handle) => <i key={handle} className={`selection-handle handle-${handle}`} data-resize={handle} />)}
      </div>}
      {document?.placedImage && smartGuideLines.vertical !== undefined && <div className="smart-guide vertical" style={{ left: camera.x + smartGuideLines.vertical * camera.zoom, top: camera.y + (document.placedImage.y + document.placedImage.height / 2) * camera.zoom - 22, height: 44 }} />}
      {document?.placedImage && smartGuideLines.horizontal !== undefined && <div className="smart-guide horizontal" style={{ top: camera.y + smartGuideLines.horizontal * camera.zoom, left: camera.x + (document.placedImage.x + document.placedImage.width / 2) * camera.zoom - 22, width: 44 }} />}
      {document?.placedImage && workspaceArtboard && (smartGuideLines.vertical === workspaceArtboard.widthPx / 2 || smartGuideLines.horizontal === workspaceArtboard.heightPx / 2) && <div className="smart-center-badge" style={{ left: camera.x + (document.placedImage.x + document.placedImage.width / 2) * camera.zoom, top: camera.y + (document.placedImage.y + document.placedImage.height / 2) * camera.zoom }}>centro</div>}
      {document && scanning && <div className={`scanner-overlay ${activeJob.stageIndex >= 3 ? "grouping" : ""}`} style={{
        left: camera.x + (document.placedImage?.x ?? 0) * camera.zoom,
        top: camera.y + (document.placedImage?.y ?? 0) * camera.zoom,
        width: (document.placedImage?.width ?? document.width) * camera.zoom,
        height: (document.placedImage?.height ?? document.height) * camera.zoom,
        transform: `rotate(${document.placedImage?.rotation ?? 0}deg)`,
        transformOrigin: "center",
        "--scan-real-progress": `${Math.max(0, Math.min(1, scanRatio)) * 100}%`,
      } as React.CSSProperties}><div /><i /><span>{activeJob.stage}<small>{activeJob.percent.toFixed(0)} %</small></span></div>}
      {document && residueGesture && <svg className="residue-gesture-overlay" style={{ left: camera.x + (document.placedImage?.x ?? 0) * camera.zoom, top: camera.y + (document.placedImage?.y ?? 0) * camera.zoom, width: (document.placedImage?.width ?? document.width) * camera.zoom, height: (document.placedImage?.height ?? document.height) * camera.zoom, transform: `rotate(${document.placedImage?.rotation ?? 0}deg)`, transformOrigin: "center" }} viewBox={`0 0 ${document.width} ${document.height}`} preserveAspectRatio="none">
        {residueGesture.tool === "residue-rectangle" ? <rect x={residueGesture.points[0].x} y={residueGesture.points[0].y} width={residueGesture.points[residueGesture.points.length - 1].x - residueGesture.points[0].x} height={residueGesture.points[residueGesture.points.length - 1].y - residueGesture.points[0].y} /> : <polyline points={residueGesture.points.map((point) => `${point.x},${point.y}`).join(" ")} className={residueGesture.tool === "residue-brush" ? "brush-stroke" : "lasso-stroke"} style={residueGesture.tool === "residue-brush" ? { strokeWidth: residueBrushSize } : undefined} />}
      </svg>}
      {activeTool === "residue-brush" && cursorPoint && <div className={`brush-cursor mode-${residueMode}`} style={{ left: projectImagePoint(cursorPoint).x, top: projectImagePoint(cursorPoint).y, width: Math.max(2, residueBrushSize * projectImagePoint(cursorPoint).scale), height: Math.max(2, residueBrushSize * projectImagePoint(cursorPoint).scale) }} />}
      {contextMenu && <div className="canvas-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={() => { window.dispatchEvent(new CustomEvent("dtf:apply-residue")); setContextMenu(null); }}>Forzar transparente <kbd>Supr</kbd></button>
        <button onClick={() => { setResidueMaskMode("add"); setContextMenu(null); }}>Añadir a eliminación</button>
        <button onClick={() => { setResidueMaskMode("subtract"); setContextMenu(null); }}>Quitar de eliminación</button>
        <button onClick={() => { const latest = useStudioStore.getState().document; if (latest) void editResidueMask(latest, { action: "clear" }).then((summary) => refreshResiduePreview(latest, summary)); setContextMenu(null); }}>Deseleccionar todo</button>
        <i />
        <button className="remove-image" onClick={() => { setContextMenu(null); onRemove(); }}><span><ImageMinus size={14} /> Quitar imagen</span><small>No borra el archivo</small></button>
      </div>}
      {showMaskActivity && <div className="mask-update-indicator">Actualizando máscara…</div>}
      {rendererError && <div className="renderer-error">No se pudo iniciar el renderizador: {rendererError}</div>}
      {imageError && <div className="renderer-error">No se pudo crear la vista previa: {imageError}</div>}
    </div>
  );
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function resizeProportionally(item: PlacedImage, handle: ResizeHandle, dx: number, dy: number): PlacedImage {
  const horizontalScale = handle.includes("w") ? 1 - dx / item.width : handle.includes("e") ? 1 + dx / item.width : 1;
  const verticalScale = handle.includes("n") ? 1 - dy / item.height : handle.includes("s") ? 1 + dy / item.height : 1;
  let scale: number;
  if (handle === "e" || handle === "w") scale = horizontalScale;
  else if (handle === "n" || handle === "s") scale = verticalScale;
  else scale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1) ? horizontalScale : verticalScale;
  scale = Math.max(8 / Math.max(item.width, item.height), scale);
  const width = item.width * scale;
  const height = item.height * scale;
  let x = item.x;
  let y = item.y;
  if (handle.includes("w")) x = item.x + item.width - width;
  else if (handle === "n" || handle === "s") x = item.x + (item.width - width) / 2;
  if (handle.includes("n")) y = item.y + item.height - height;
  else if (handle === "e" || handle === "w") y = item.y + (item.height - height) / 2;
  return { ...item, x, y, width, height, lockAspect: true };
}

export function snapPlacedImage(item: PlacedImage, artboardWidth: number, artboardHeight: number, guides: DocumentGuide[], zoom: number, snapToGuides: boolean, smartGuides: boolean) {
  const threshold = 5 / Math.max(zoom, 0.001);
  const verticalTargets = [
    ...(smartGuides ? [0, artboardWidth / 2, artboardWidth] : []),
    ...(snapToGuides ? guides.filter((guide) => guide.orientation === "vertical").map((guide) => guide.position) : []),
  ];
  const horizontalTargets = [
    ...(smartGuides ? [0, artboardHeight / 2, artboardHeight] : []),
    ...(snapToGuides ? guides.filter((guide) => guide.orientation === "horizontal").map((guide) => guide.position) : []),
  ];
  const xSnap = nearestAlignment(item.x, [0, item.width / 2, item.width], verticalTargets, threshold);
  const ySnap = nearestAlignment(item.y, [0, item.height / 2, item.height], horizontalTargets, threshold);
  return {
    item: { ...item, x: item.x + (xSnap?.delta ?? 0), y: item.y + (ySnap?.delta ?? 0) },
    lines: { vertical: xSnap?.target, horizontal: ySnap?.target },
  };
}

function nearestAlignment(origin: number, offsets: number[], targets: number[], threshold: number): { delta: number; target: number } | null {
  let best: { delta: number; target: number } | null = null;
  for (const target of targets) {
    for (const offset of offsets) {
      const delta = target - (origin + offset);
      if (Math.abs(delta) > threshold || (best && Math.abs(best.delta) <= Math.abs(delta))) continue;
      best = { delta, target };
    }
  }
  return best;
}
