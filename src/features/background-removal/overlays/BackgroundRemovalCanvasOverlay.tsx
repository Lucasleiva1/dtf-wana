import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useStudioStore } from "../../../stores/studioStore";
import { applyBackgroundEraser, applyBackgroundStroke, getBackgroundOverlay, magicWand } from "../commands/backgroundRemovalService";
import { useBackgroundRemovalStore } from "../state/backgroundRemovalStore";
import { backgroundToolTarget, type BackgroundView, type MaskPoint, type SelectionMode } from "../types";
import { buildMarchingAntPath } from "../selection/buildMarchingAntPath";
import { previewMatte } from "./backgroundPreview";
import { brushSizeFromHorizontalDrag } from "./brushSizing";
import "../styles/selection.css";

type StrokeGesture = { kind: "stroke"; pointerId: number; points: MaskPoint[] };
type ResizeGesture = { kind: "resize"; pointerId: number; point: MaskPoint; startClientX: number; startClientY: number; startSize: number; moved: boolean };
type Gesture = StrokeGesture | ResizeGesture;

export function BackgroundRemovalCanvasOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [cursor, setCursor] = useState<MaskPoint | null>(null);
  const [rendering, setRendering] = useState(false);
  const [antsPaused, setAntsPaused] = useState(false);
  const document = useStudioStore((state) => state.document);
  const activeModule = useStudioStore((state) => state.activeModule);
  const activeTool = useStudioStore((state) => state.activeTool);
  const selectedItemId = useStudioStore((state) => state.selectedItemId);
  const camera = useStudioStore((state) => state.camera);
  const setNotification = useStudioStore((state) => state.setNotification);
  const state = useBackgroundRemovalStore();
  const item = document?.placedImage;
  const active = activeModule === "background" && Boolean(document && item && item.visible !== false && selectedItemId === item.id);
  const drawingTarget = activeTool.startsWith("background-") ? backgroundToolTarget[activeTool as keyof typeof backgroundToolTarget] : undefined;
  const interactive = active && !item?.maskLocked && !item?.contentLocked && (activeTool === "background-wand" || Boolean(drawingTarget));
  const resultView = state.view === "result" || state.view === "result_white" || state.view === "result_black" || state.view === "result_gray" || state.view === "mask" || state.view === "alpha";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || !document) return;
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
    setRendering(true);
    void getBackgroundOverlay(document.id, state.view, state.outputAlpha).then(async (bytes) => {
      if (cancelled || bytes.length !== document.width * document.height * 4) return;
      canvas.width = document.width;
      canvas.height = document.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (resultView) paintPreviewBackground(context, canvas.width, canvas.height, state.view);
      bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(bytes), document.width, document.height));
      if (cancelled) { bitmap.close(); return; }
      context.drawImage(bitmap, 0, 0);
    }).catch((reason) => {
      if (!cancelled) setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
    }).finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; bitmap?.close(); };
  }, [active, document?.id, state.visualRevision, state.view, state.outputAlpha]);

  useEffect(() => {
    if (!active) { setCursor(null); setGesture(null); gestureRef.current = null; }
  }, [active]);

  useEffect(() => {
    const updateMotion = () => setAntsPaused(globalThis.document.hidden || !globalThis.document.hasFocus());
    updateMotion();
    globalThis.document.addEventListener("visibilitychange", updateMotion);
    window.addEventListener("focus", updateMotion);
    window.addEventListener("blur", updateMotion);
    return () => {
      globalThis.document.removeEventListener("visibilitychange", updateMotion);
      window.removeEventListener("focus", updateMotion);
      window.removeEventListener("blur", updateMotion);
    };
  }, []);

  const contourPath = useMemo(() => buildMarchingAntPath(state.contours), [state.contours]);
  if (!active || !document || !item) return null;

  const style: React.CSSProperties = {
    left: camera.x + item.x * camera.zoom,
    top: camera.y + item.y * camera.zoom,
    width: item.width * camera.zoom,
    height: item.height * camera.zoom,
    transform: `rotate(${item.rotation}deg)`,
    transformOrigin: "center",
  };
  const localPoint = (event: React.PointerEvent<SVGSVGElement>): MaskPoint | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    if (local.x < 0 || local.y < 0 || local.x >= document.width || local.y >= document.height) return null;
    return { x: local.x, y: local.y };
  };
  const effectiveSelectionMode = (event: React.PointerEvent): SelectionMode => event.shiftKey && event.altKey ? "intersect" : event.altKey ? "subtract" : event.shiftKey ? "add" : state.selectionMode;
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    if (activeTool === "background-wand") {
      void magicWand(document, { x: Math.floor(point.x), y: Math.floor(point.y), mode: effectiveSelectionMode(event), settings: state.wand })
        .catch((reason) => setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) }));
      return;
    }
    const started: Gesture = drawingTarget && event.altKey
      ? { kind: "resize", pointerId: event.pointerId, point, startClientX: event.clientX, startClientY: event.clientY, startSize: state.brushSize, moved: false }
      : { kind: "stroke", pointerId: event.pointerId, points: [point] };
    gestureRef.current = started;
    setGesture(started);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = localPoint(event);
    setCursor(point);
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === "resize") {
      const deltaX = event.clientX - current.startClientX;
      const moved = current.moved || Math.hypot(deltaX, event.clientY - current.startClientY) >= 3;
      state.setBrushSize(brushSizeFromHorizontalDrag(current.startSize, deltaX, camera.zoom));
      if (moved !== current.moved) {
        const updated = { ...current, moved };
        gestureRef.current = updated;
        setGesture(updated);
      }
      return;
    }
    if (!point) return;
    const previous = current.points[current.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < Math.max(0.5, state.brushSize / 8)) return;
    const updated = { ...current, points: [...current.points, point] };
    gestureRef.current = updated;
    setGesture(updated);
  };
  const finishGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId || !drawingTarget) return;
    gestureRef.current = null;
    setGesture(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.kind === "resize") {
      if (current.moved) return;
      const operation = activeTool === "background-eraser"
        ? applyBackgroundEraser(document, {
          points: [current.point],
          radius: Math.max(1, Math.round(state.brushSize / 2)),
          opacity: state.brushOpacity,
          ...state.eraser,
        })
        : applyBackgroundStroke(document, {
          target: drawingTarget,
          mode: "erase",
          points: [current.point],
          radius: Math.max(1, Math.round(state.brushSize / 2)),
          opacity: state.brushOpacity,
        });
      void operation.catch((reason) => setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) }));
      return;
    }
    const operation = activeTool === "background-eraser"
      ? applyBackgroundEraser(document, {
        points: current.points,
        radius: Math.max(1, Math.round(state.brushSize / 2)),
        opacity: state.brushOpacity,
        ...state.eraser,
      })
      : applyBackgroundStroke(document, {
        target: drawingTarget,
        mode: event.altKey ? "erase" : "paint",
        points: current.points,
        radius: Math.max(1, Math.round(state.brushSize / 2)),
        opacity: state.brushOpacity,
      });
    void operation.catch((reason) => setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) }));
  };
  const cancelGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setGesture(null);
  };

  return <>
    <canvas className={`background-result-canvas view-${state.view}`} ref={canvasRef} style={{ ...style, opacity: state.overlayVisible || resultView ? 1 : 0 }} />
    <svg
      ref={svgRef}
      className={`background-interaction-overlay tool-${activeTool}${interactive ? " interactive" : ""}${gesture?.kind === "resize" ? " resizing-brush" : ""}`}
      style={style}
      viewBox={`0 0 ${document.width} ${document.height}`}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={cancelGesture}
      onPointerLeave={() => { if (!gestureRef.current) setCursor(null); }}
    >
      {state.showMarchingAnts && state.summary.selectedPixels > 0 && <g className={`marching-ants${antsPaused ? " paused" : ""}`} aria-label="Contorno animado de selección"><path className="ants-contrast" d={contourPath} vectorEffect="non-scaling-stroke" /><path className="ants-light" d={contourPath} vectorEffect="non-scaling-stroke" /></g>}
      {gesture?.kind === "stroke" && <polyline className="background-stroke-preview" points={gesture.points.map((point) => `${point.x},${point.y}`).join(" ")} style={{ strokeWidth: state.brushSize }} />}
      {cursor && drawingTarget && <circle className={`background-brush-cursor target-${drawingTarget}`} cx={cursor.x} cy={cursor.y} r={state.brushSize / 2} vectorEffect="non-scaling-stroke" />}
      {cursor && activeTool === "background-wand" && <g className="wand-cursor" transform={`translate(${cursor.x} ${cursor.y})`}><circle r={5} vectorEffect="non-scaling-stroke" /><path d="M-8 0H8M0-8V8" vectorEffect="non-scaling-stroke" /></g>}
    </svg>
    {rendering && <div className="background-overlay-busy" style={{ left: style.left, top: style.top }}><LoaderCircle className="spin" size={13} />Actualizando vista…</div>}
  </>;
}

function paintPreviewBackground(context: CanvasRenderingContext2D, width: number, height: number, view: BackgroundView) {
  const matte = previewMatte(view);
  if (matte === null) return;
  context.fillStyle = matte;
  context.fillRect(0, 0, width, height);
}
