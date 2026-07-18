import { ChevronDown, GripVertical, Power } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DropPosition, InspectorZoneId } from "../lib/inspectorLayout";

interface InspectorZoneProps {
  id: InspectorZoneId;
  title: string;
  summary: string;
  icon: ReactNode;
  collapsed: boolean;
  dragging: boolean;
  dropPosition: DropPosition | null;
  children: ReactNode;
  onToggle: () => void;
  onDragStart: (id: InspectorZoneId, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (commit: boolean) => void;
  batchEnabled?: boolean;
  batchRunning?: boolean;
  onBatchEnabledChange?: (enabled: boolean) => void;
}

export function InspectorZone({
  id, title, summary, icon, collapsed, dragging, dropPosition, children,
  onToggle, onDragStart, onDragMove, onDragEnd,
  batchEnabled, batchRunning = false, onBatchEnabledChange,
}: InspectorZoneProps) {
  const suppressClick = useRef(false);

  const beginPointerDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!started && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
      if (!started) {
        started = true;
        suppressClick.current = true;
        onDragStart(id, moveEvent.clientX, moveEvent.clientY);
      }
      moveEvent.preventDefault();
      onDragMove(moveEvent.clientX, moveEvent.clientY);
    };

    const finish = (finishEvent: PointerEvent, commit: boolean) => {
      if (finishEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      if (started) onDragEnd(commit);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    };
    const pointerUp = (upEvent: PointerEvent) => finish(upEvent, true);
    const pointerCancel = (cancelEvent: PointerEvent) => finish(cancelEvent, false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
  };

  const toggle = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (suppressClick.current) { event.preventDefault(); return; }
    onToggle();
  };

  return <div
    className={`inspector-zone inspector-zone-${id}${collapsed ? " collapsed" : ""}${dragging ? " dragging" : ""}${dropPosition ? ` drop-${dropPosition}` : ""}`}
    data-zone-id={id}
  >
    <header className="inspector-zone-header" onPointerDown={beginPointerDrag} title="Arrastrar para cambiar el orden">
      <span className="zone-drag-handle" aria-hidden="true"><GripVertical size={15} /></span>
      <button className="zone-heading" onPointerUp={toggle} aria-expanded={!collapsed} aria-controls={`zone-body-${id}`}>
        <span className="zone-icon">{icon}</span>
        <span><b>{title}</b><small>{summary}</small></span>
      </button>
      <div className="zone-order-controls">
        {onBatchEnabledChange && <button
          className={`zone-batch-toggle${batchEnabled ? " enabled" : ""}`}
          disabled={batchRunning}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => { event.stopPropagation(); onBatchEnabledChange(!batchEnabled); }}
          title={batchEnabled ? `${title}: incluido en el lote` : `${title}: excluido del lote`}
          aria-label={batchEnabled ? `Excluir ${title} del lote` : `Incluir ${title} en el lote`}
        ><Power size={11} />{batchEnabled ? "SÍ" : "NO"}</button>}
        <button className="zone-collapse" onPointerUp={toggle} title={collapsed ? "Desplegar" : "Plegar"} aria-label={`${collapsed ? "Desplegar" : "Plegar"} ${title}`}><ChevronDown size={16} /></button>
      </div>
    </header>
    <div id={`zone-body-${id}`} className="inspector-zone-body" hidden={collapsed}>{children}</div>
  </div>;
}
