import { Grid3X3, Maximize, Maximize2, ZoomIn } from "lucide-react";
import { useRef } from "react";
import { useStudioStore } from "../stores/studioStore";
import { artboardFor, formatMeasurement, measurementToPixels, pixelsToMeasurement } from "../lib/measurements";
import type { MeasurementUnit, PlacedImage, PreviewBackground } from "../types/document";
import { BackgroundRemovalContextControls, hasBackgroundContextOptions } from "../features/background-removal/components/BackgroundRemovalContextControls";

const backgrounds: Array<[PreviewBackground, string, string]> = [
  ["checker-small", "Cuadrícula pequeña", "checker small"],
  ["checker-large", "Cuadrícula grande", "checker large"],
  ["white", "Blanco", "swatch white"],
  ["gray", "Gris 50 %", "swatch gray"],
  ["black", "Negro", "swatch black"],
];

export function CanvasControls() {
  const camera = useStudioStore((state) => state.camera);
  const setZoom = useStudioStore((state) => state.setZoom);
  const fitDocument = useStudioStore((state) => state.fitDocument);
  const actualSize = useStudioStore((state) => state.actualSize);
  const background = useStudioStore((state) => state.previewBackground);
  const setBackground = useStudioStore((state) => state.setPreviewBackground);
  const customColor = useStudioStore((state) => state.customBackgroundColor);
  const setCustomColor = useStudioStore((state) => state.setCustomBackgroundColor);
  const document = useStudioStore((state) => state.document);
  const activeModule = useStudioStore((state) => state.activeModule);
  const activeTool = useStudioStore((state) => state.activeTool);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const updatePlacedImage = useStudioStore((state) => state.updatePlacedImage);
  const commitPlacedImageTransform = useStudioStore((state) => state.commitPlacedImageTransform);
  const selectedItemId = useStudioStore((state) => state.selectedItemId);
  const editStart = useRef<PlacedImage | null>(null);
  const artboard = document ? artboardFor(document) : null;
  const item = selectedItemId && document?.placedImage?.id === selectedItemId ? document.placedImage : null;
  const showBackgroundOptions = activeModule === "background" && Boolean(item) && hasBackgroundContextOptions(activeTool);
  const unit = artboard?.preferredUnit ?? "px";
  const toUnit = (pixels: number) => artboard ? pixelsToMeasurement(pixels, unit, artboard.ppi) : pixels;
  const toPixels = (value: number) => artboard ? measurementToPixels(value, unit, artboard.ppi) : value;
  const updateSize = (key: "width" | "height", value: number) => {
    if (!item) return;
    const pixels = Math.max(1, toPixels(value));
    if (key === "width") updatePlacedImage({ width: pixels, height: pixels * item.sourceHeight / item.sourceWidth, lockAspect: true });
    else updatePlacedImage({ height: pixels, width: pixels * item.sourceWidth / item.sourceHeight, lockAspect: true });
  };
  return (
    <div className="canvas-controls">
      {artboard && <div className="transform-controls">
        {showBackgroundOptions ? <BackgroundRemovalContextControls /> : item ? <>
          <b>IMAGEN</b>
          <label>X <input aria-label="Posición X" type="number" step="0.01" value={Number(toUnit(item.x).toFixed(3))} onFocus={() => { editStart.current = structuredClone(item); }} onBlur={() => { if (editStart.current) commitPlacedImageTransform(editStart.current); editStart.current = null; }} onChange={(event) => updatePlacedImage({ x: toPixels(Number(event.target.value)) })} /></label>
          <label>Y <input aria-label="Posición Y" type="number" step="0.01" value={Number(toUnit(item.y).toFixed(3))} onFocus={() => { editStart.current = structuredClone(item); }} onBlur={() => { if (editStart.current) commitPlacedImageTransform(editStart.current); editStart.current = null; }} onChange={(event) => updatePlacedImage({ y: toPixels(Number(event.target.value)) })} /></label>
          <label>W <input aria-label="Ancho del elemento" type="number" min="0.001" step="0.01" value={Number(toUnit(item.width).toFixed(3))} onFocus={() => { editStart.current = structuredClone(item); }} onBlur={() => { if (editStart.current) commitPlacedImageTransform(editStart.current); editStart.current = null; }} onChange={(event) => updateSize("width", Number(event.target.value))} /></label>
          <label>H <input aria-label="Alto del elemento" type="number" min="0.001" step="0.01" value={Number(toUnit(item.height).toFixed(3))} onFocus={() => { editStart.current = structuredClone(item); }} onBlur={() => { if (editStart.current) commitPlacedImageTransform(editStart.current); editStart.current = null; }} onChange={(event) => updateSize("height", Number(event.target.value))} /></label>
          <button className="active" title="Proporción siempre bloqueada" disabled>⛓</button>
          <label>° <input aria-label="Rotación" type="number" step="0.1" value={item.rotation} onFocus={() => { editStart.current = structuredClone(item); }} onBlur={() => { if (editStart.current) commitPlacedImageTransform(editStart.current); editStart.current = null; }} onChange={(event) => updatePlacedImage({ rotation: Number(event.target.value) })} /></label>
        </> : <span><b>MESA</b> · {formatMeasurement(toUnit(artboard.widthPx), unit)} × {formatMeasurement(toUnit(artboard.heightPx), unit)} {unit} · {artboard.widthPx.toLocaleString("es-AR")} × {artboard.heightPx.toLocaleString("es-AR")} px · {artboard.ppi} PPP</span>}
        {!showBackgroundOptions && <select aria-label="Unidad de trabajo" value={unit} onChange={(event) => updateDocument({ artboard: { ...artboard, preferredUnit: event.target.value as MeasurementUnit } })}><option value="px">px</option><option value="cm">cm</option><option value="mm">mm</option><option value="in">in</option><option value="pt">pt</option><option value="pc">pc</option></select>}
      </div>}
      <div className="background-controls"><Grid3X3 size={14} /><span>Fondo</span>{backgrounds.map(([id, label, className]) => <button key={id} title={label} aria-label={label} className={`${className} ${background === id ? "active" : ""}`} onClick={() => setBackground(id)} />)}<label className={`custom-background ${background === "custom" ? "active" : ""}`} title="Fondo personalizado"><input aria-label="Color de fondo personalizado" type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} /></label></div>
      <div className="zoom-controls"><button title="Encajar artboard" onClick={fitDocument}><Maximize size={14} /></button><button title="Vista al 100 %" onClick={actualSize}><Maximize2 size={14} /></button><ZoomIn size={14} /><input aria-label="Zoom" type="range" min="2" max="800" value={Math.min(800, Math.round(camera.zoom * 100))} onChange={(event) => setZoom(Number(event.target.value) / 100)} /><output>{Math.round(camera.zoom * 100)}%</output></div>
    </div>
  );
}
