import {
  Brush, Eraser, Hand, LockKeyhole, MousePointer2, PaintBucket, ScanSearch,
  Shield, Sparkles, SprayCan, Trash2, WandSparkles, ZoomIn,
} from "lucide-react";
import { useStudioStore } from "../../../stores/studioStore";
import type { ToolId } from "../../../types/document";

const tools: Array<[ToolId, string, string, typeof Hand]> = [
  ["select", "Selección", "V", MousePointer2],
  ["background-wand", "Varita mágica", "W", WandSparkles],
  ["background-auto", "Quitar fondo automático", "A", Sparkles],
  ["background-protect", "Proteger sujeto", "P", Shield],
  ["background-mark", "Marcar fondo", "F", PaintBucket],
  ["background-never", "Nunca borrar", "N", LockKeyhole],
  ["background-refine", "Refinar borde guiado", "R", ScanSearch],
  ["background-add", "Pincel agregar sujeto", "B", Brush],
  ["background-subtract", "Pincel quitar sujeto", "E", Eraser],
  ["background-eraser", "Borrador de fondo", "K", SprayCan],
  ["background-cleanup", "Limpiar partículas", "C", Trash2],
  ["hand", "Mano", "H", Hand],
  ["zoom", "Zoom", "Z", ZoomIn],
];

export function BackgroundRemovalToolRail() {
  const activeTool = useStudioStore((state) => state.activeTool);
  const setTool = useStudioStore((state) => state.setTool);
  return <aside className="tool-rail background-tool-rail" aria-label="Herramientas de Quitar fondo">
    {tools.map(([id, label, shortcut, Icon], index) => <button
      key={id}
      className={activeTool === id ? "active" : ""}
      onClick={() => setTool(id)}
      title={`${label} (${shortcut})`}
      aria-label={`${label} (${shortcut})`}
    >
      <Icon size={18} strokeWidth={1.55} />
      {(index === 0 || index === 10) && <span className="tool-divider" />}
    </button>)}
  </aside>;
}
