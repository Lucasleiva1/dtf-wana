import { useRef, useState } from "react";
import { BoxSelect, Brush, Eraser, Hand, Lasso, MousePointer2, Paintbrush, ScanSearch, Search, Sparkles, SquareMousePointer, WandSparkles, ZoomIn } from "lucide-react";
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
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [flyoutPosition, setFlyoutPosition] = useState({ left: 42, top: 0 });
  const holdTimer = useRef<number | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const cleanupTools: Array<[ToolId, string, typeof Hand]> = [
    ["residue-region", "Seleccionar residuo por clic", MousePointer2],
    ["residue-rectangle", "Selección rectangular", BoxSelect],
    ["residue-lasso", "Lazo para residuos", Lasso],
    ["residue-brush", "Pincel de selección", Paintbrush],
  ];
  const cleanupActive = cleanupTools.some(([id]) => id === activeTool);
  const cleanupCurrent = cleanupTools.find(([id]) => id === activeTool) ?? cleanupTools[0];
  const CleanupIcon = cleanupCurrent[2];
  const openCleanup = () => {
    const rect = groupRef.current?.getBoundingClientRect();
    if (rect) setFlyoutPosition({ left: rect.right + 2, top: Math.max(4, Math.min(window.innerHeight - 136, rect.top)) });
    setCleanupOpen(true);
  };
  const startHold = () => {
    holdTimer.current = window.setTimeout(openCleanup, 320);
  };
  const cancelHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  return (
    <aside className="tool-rail" aria-label="Herramientas">
      {[...common, ...moduleTools[module]].map(([id, label, Icon], index) => (
        <button key={`${id}-${label}`} className={activeTool === id ? "active" : ""} onClick={() => setTool(id)} title={label} aria-label={label}>
          <Icon size={18} strokeWidth={1.6} />
          {index === common.length - 1 && <span className="tool-divider" />}
        </button>
      ))}
      {module === "transparency" && <div className="tool-group" ref={groupRef}>
        <button
          className={cleanupActive ? "active" : ""}
          onClick={() => setTool(cleanupCurrent[0])}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onContextMenu={(event) => { event.preventDefault(); openCleanup(); }}
          title={`${cleanupCurrent[1]} · mantener presionado para más opciones`}
          aria-label="Herramientas de limpieza manual"
        >
          <CleanupIcon size={18} strokeWidth={1.6} /><i className="tool-flyout-mark" />
        </button>
        {cleanupOpen && <div className="tool-flyout" style={flyoutPosition} onPointerLeave={() => setCleanupOpen(false)}>
          {cleanupTools.map(([id, label, Icon]) => <button key={id} className={activeTool === id ? "active" : ""} onClick={() => { setTool(id); setCleanupOpen(false); }}>
            <Icon size={16} /><span>{label}</span>
          </button>)}
        </div>}
      </div>}
    </aside>
  );
}
