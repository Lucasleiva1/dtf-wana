import { Brush, Eraser, Hand, ScanSearch, Search, Sparkles, SquareMousePointer, WandSparkles, ZoomIn } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import type { ModuleId, ToolId } from "../types/document";

const common: Array<[ToolId, string, typeof Hand]> = [
  ["select", "Seleccionar", SquareMousePointer],
  ["transform", "Transformar", Sparkles],
  ["hand", "Mano (H)", Hand],
  ["zoom", "Zoom (Z)", ZoomIn],
];

const moduleTools: Record<ModuleId, Array<[ToolId, string, typeof Hand]>> = {
  background: [["analyze", "Varita de fondo", WandSparkles], ["brush", "Conservar", Brush], ["eraser", "Eliminar", Eraser]],
  transparency: [["analyze", "Analizar alfa", ScanSearch], ["brush", "Volver opaco", Brush], ["eraser", "Volver transparente", Eraser]],
  separation: [["analyze", "Escanear elementos", Search], ["brush", "Añadir a elemento", Brush], ["eraser", "Restar de elemento", Eraser]],
};

export function ToolRail() {
  const module = useStudioStore((state) => state.activeModule);
  const activeTool = useStudioStore((state) => state.activeTool);
  const setTool = useStudioStore((state) => state.setTool);
  return (
    <aside className="tool-rail" aria-label="Herramientas">
      {[...common, ...moduleTools[module]].map(([id, label, Icon], index) => (
        <button key={`${id}-${label}`} className={activeTool === id ? "active" : ""} onClick={() => setTool(id)} title={label} aria-label={label}>
          <Icon size={18} strokeWidth={1.6} />
          {index === common.length - 1 && <span className="tool-divider" />}
        </button>
      ))}
    </aside>
  );
}
