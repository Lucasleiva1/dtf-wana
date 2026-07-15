import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { ImagePlus, MousePointer2 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";

export function CanvasWorkspace({ onOpen }: { onOpen: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<{ app: Application; world: Container; artboard: Graphics; sprite?: Sprite } | null>(null);
  const [rendererError, setRendererError] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const document = useStudioStore((state) => state.document);
  const camera = useStudioStore((state) => state.camera);
  const previewBackground = useStudioStore((state) => state.previewBackground);
  const activeTool = useStudioStore((state) => state.activeTool);
  const setViewport = useStudioStore((state) => state.setViewport);
  const panBy = useStudioStore((state) => state.panBy);
  const setZoomAt = useStudioStore((state) => state.setZoomAt);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const world = new Container();
    const artboard = new Graphics();
    void app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, resolution: Math.min(devicePixelRatio, 2), autoDensity: true })
      .then(() => {
        initialized = true;
        if (disposed) return app.destroy(true);
        host.appendChild(app.canvas);
        app.stage.addChild(world);
        world.addChild(artboard);
        pixiRef.current = { app, world, artboard };
        setViewport({ width: host.clientWidth, height: host.clientHeight });
      })
      .catch(() => setRendererError(true));

    const observer = new ResizeObserver(() => setViewport({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    return () => {
      disposed = true;
      observer.disconnect();
      pixiRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, [setViewport]);

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
    const load = async () => {
      setImageError(null);
      if (pixi.sprite) {
        pixi.world.removeChild(pixi.sprite);
        pixi.sprite.destroy({ texture: true, textureSource: true });
        pixi.sprite = undefined;
      }
      pixi.artboard.clear();
      if (!document) return;
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
      pixi.world.addChild(sprite);
      pixi.sprite = sprite;
    };
    void load().catch((reason) => setImageError(reason instanceof Error ? reason.message : "No se pudo mostrar la imagen."));
    return () => { cancelled = true; };
  }, [document]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      if (activeTool !== "hand" && event.button !== 1 && !event.altKey) return;
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

  return (
    <div ref={hostRef} className={`canvas-workspace tool-${activeTool} background-${previewBackground}`} aria-label="Lienzo de trabajo">
      {!document && (
        <button className="empty-canvas" onClick={onOpen}>
          <ImagePlus size={34} strokeWidth={1.3} />
          <span>Abrir una imagen</span>
          <small>PNG, JPG, WebP, TIFF o BMP</small>
        </button>
      )}
      {document && <div className="canvas-hint"><MousePointer2 size={13} /> Rueda: zoom · Mano: desplazar</div>}
      {rendererError && <div className="renderer-error">WebGL no está disponible. Se habilitará el fallback 2D.</div>}
      {imageError && <div className="renderer-error">No se pudo crear la vista previa: {imageError}</div>}
    </div>
  );
}
