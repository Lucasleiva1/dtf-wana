import { Brush, WandSparkles } from "lucide-react";
import { useStudioStore } from "../../../stores/studioStore";
import type { ToolId } from "../../../types/document";
import { useBackgroundRemovalStore } from "../state/backgroundRemovalStore";
import type { SelectionMode } from "../types";

const brushToolLabels: Partial<Record<ToolId, string>> = {
  "background-protect": "Proteger sujeto",
  "background-mark": "Marcar fondo",
  "background-never": "Nunca borrar",
  "background-refine": "Pincel de borde",
  "background-add": "Añadir sujeto",
  "background-subtract": "Quitar sujeto",
  "background-eraser": "Borrador de fondo",
};

const selectionModeLabels: Record<SelectionMode, string> = {
  new: "Nueva",
  add: "Sumar",
  subtract: "Restar",
  intersect: "Intersec.",
};

export function hasBackgroundContextOptions(tool: ToolId) {
  return tool === "background-wand" || Boolean(brushToolLabels[tool]);
}

export function BackgroundRemovalContextControls() {
  const activeTool = useStudioStore((state) => state.activeTool);
  const brushSize = useBackgroundRemovalStore((state) => state.brushSize);
  const brushOpacity = useBackgroundRemovalStore((state) => state.brushOpacity);
  const selectionMode = useBackgroundRemovalStore((state) => state.selectionMode);
  const wand = useBackgroundRemovalStore((state) => state.wand);
  const setBrushSize = useBackgroundRemovalStore((state) => state.setBrushSize);
  const setBrushOpacity = useBackgroundRemovalStore((state) => state.setBrushOpacity);
  const setSelectionMode = useBackgroundRemovalStore((state) => state.setSelectionMode);
  const setWand = useBackgroundRemovalStore((state) => state.setWand);

  if (activeTool === "background-wand") {
    return <div className="background-context-options wand-options" aria-label="Opciones de Varita mágica">
      <span className="context-tool-title"><WandSparkles size={14} /><b>VARITA</b></span>
      <div className="context-segmented" aria-label="Modo de selección">
        {(Object.keys(selectionModeLabels) as SelectionMode[]).map((mode) => <button
          key={mode}
          className={selectionMode === mode ? "active" : ""}
          onClick={() => setSelectionMode(mode)}
          title={`Selección: ${selectionModeLabels[mode]}`}
        >{selectionModeLabels[mode]}</button>)}
      </div>
      <label className="context-slider"><span>Tolerancia</span><input aria-label="Tolerancia de Varita mágica" type="range" min="1" max="100" value={wand.tolerance} onChange={(event) => setWand({ tolerance: Number(event.target.value) })} /></label>
      <label className="context-number"><input aria-label="Tolerancia numérica de Varita mágica" type="number" min="1" max="100" value={wand.tolerance} onChange={(event) => setWand({ tolerance: Number(event.target.value) })} /></label>
      <label className="context-check"><input type="checkbox" checked={wand.contiguous} onChange={(event) => setWand({ contiguous: event.target.checked })} /><span>Contiguo</span></label>
    </div>;
  }

  const toolLabel = brushToolLabels[activeTool];
  if (!toolLabel) return null;
  return <div className="background-context-options brush-options" aria-label={`Opciones de ${toolLabel}`}>
    <span className="context-tool-title"><Brush size={14} /><b>PINCEL</b><em>{toolLabel}</em></span>
    <label className="context-slider"><span>Tamaño</span><input aria-label="Tamaño contextual del pincel" type="range" min="1" max="500" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
    <label className="context-number"><input aria-label="Tamaño numérico contextual del pincel" type="number" min="1" max="500" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><span>px</span></label>
    <label className="context-slider opacity"><span>Opacidad</span><input aria-label="Opacidad contextual del pincel" type="range" min="5" max="100" value={brushOpacity * 100} onChange={(event) => setBrushOpacity(Number(event.target.value) / 100)} /></label>
    <label className="context-number"><input aria-label="Opacidad numérica contextual del pincel" type="number" min="5" max="100" value={Math.round(brushOpacity * 100)} onChange={(event) => setBrushOpacity(Number(event.target.value) / 100)} /><span>%</span></label>
    <small className="context-shortcut"><kbd>Alt</kbd> + arrastrar ↔</small>
  </div>;
}
