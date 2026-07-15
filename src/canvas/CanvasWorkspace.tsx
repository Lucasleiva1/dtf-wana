import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { ImagePlus, MousePointer2 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";

const backgroundColor: Record<string, number> = {
  white: 0xffffff,
  black: 0x080808,
  gray: 0x7f7f7f,
  "checker-small": 0x202020,
  "checker-large": 0x202020,
};

export function CanvasWorkspace({ onOpen }: { onOpen: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<{ app: Application; world: Container; artboard: Graphics; sprite?: Sprite } | null>(null);
  const [rendererError, setRendererError] = useState(false);
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
    const app = new Application();
    const world = new Container();
    const artboard = new Graphics();
    void app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, resolution: Math.min(devicePixelRatio, 2), autoDensity: true })
      .then(() => {
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
      app.destroy(true, { children: true });
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
    const load = async () => {
      if (pixi.sprite) {
        pixi.world.removeChild(pixi.sprite);
        pixi.sprite.destroy();
        pixi.sprite = undefined;
      }
      pixi.artboard.clear();
      if (!document) return;
      const checker = previewBackground.startsWith("checker");
      pixi.artboard.rect(0, 0, document.width, document.height).fill(backgroundColor[previewBackground]);
      if (checker) {
        const size = previewBackground === "checker-large" ? 32 : 16;
        const cols = Math.ceil(document.width / size);
        const rows = Math.ceil(document.height / size);
        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < cols; x += 1) {
            if ((x + y) % 2 === 0) pixi.artboard.rect(x * size, y * size, size, size).fill(0x3a3a3a);
          }
        }
      }
      pixi.artboard.rect(0, 0, document.width, document.height).stroke({ color: 0x8f8a83, width: 1 / Math.max(camera.zoom, 0.02) });
      const texture = await Assets.load<Texture>(document.previewUrl);
      if (!pixiRef.current || pixiRef.current !== pixi) return;
      const sprite = new Sprite(texture);
      sprite.width = document.width;
      sprite.height = document.height;
      pixi.world.addChild(sprite);
      pixi.sprite = sprite;
    };
    void load();
  }, [document, previewBackground, camera.zoom]);

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
    <div ref={hostRef} className={`canvas-workspace tool-${activeTool}`} aria-label="Lienzo de trabajo">
      {!document && (
        <button className="empty-canvas" onClick={onOpen}>
          <ImagePlus size={34} strokeWidth={1.3} />
          <span>Abrir una imagen</span>
          <small>PNG, JPG, WebP, TIFF o BMP</small>
        </button>
      )}
      {document && <div className="canvas-hint"><MousePointer2 size={13} /> Rueda: zoom · Mano: desplazar</div>}
      {rendererError && <div className="renderer-error">WebGL no está disponible. Se habilitará el fallback 2D.</div>}
    </div>
  );
}
