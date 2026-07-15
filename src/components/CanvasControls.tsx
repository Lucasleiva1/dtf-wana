import { Grid3X3, Maximize, Maximize2, ZoomIn } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import type { PreviewBackground } from "../types/document";

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
  return (
    <div className="canvas-controls">
      <div className="background-controls"><Grid3X3 size={14} /><span>Fondo</span>{backgrounds.map(([id, label, className]) => <button key={id} title={label} aria-label={label} className={`${className} ${background === id ? "active" : ""}`} onClick={() => setBackground(id)} />)}</div>
      <div className="zoom-controls"><button title="Encajar artboard" onClick={fitDocument}><Maximize size={14} /></button><button title="Vista al 100 %" onClick={actualSize}><Maximize2 size={14} /></button><ZoomIn size={14} /><input aria-label="Zoom" type="range" min="2" max="800" value={Math.min(800, Math.round(camera.zoom * 100))} onChange={(event) => setZoom(Number(event.target.value) / 100)} /><output>{Math.round(camera.zoom * 100)}%</output></div>
    </div>
  );
}
