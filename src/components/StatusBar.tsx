import { Cpu, HardDrive, MonitorCog, ShieldCheck } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import type { SystemCapabilities } from "../lib/commandBus";
import { artboardFor, formatMeasurement, physicalSize } from "../lib/measurements";

export function StatusBar({ system }: { system: SystemCapabilities | null }) {
  const document = useStudioStore((state) => state.document);
  const camera = useStudioStore((state) => state.camera);
  const renderDevice = useStudioStore((state) => state.renderDevice);
  const activeRenderDevice = useStudioStore((state) => state.activeRenderDevice);
  const rendererInfo = useStudioStore((state) => state.rendererInfo);
  const displayedRenderDevice = activeRenderDevice ?? renderDevice;
  const artboard = document ? artboardFor(document) : null;
  const physical = document ? physicalSize(document) : null;
  return (
    <footer className="statusbar">
      <span>{document ? document.name : "Sin documento"}</span>
      {document && artboard && physical && <><i /><span>{artboard.widthPx.toLocaleString("es-AR")} × {artboard.heightPx.toLocaleString("es-AR")} px</span><span>{formatMeasurement(physical.width, physical.unit)} × {formatMeasurement(physical.height, physical.unit)} {physical.unit}</span><span>{artboard.ppi} PPP</span>{document.sizeBytes > 0 && <span>{(document.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>}</>}
      <span className="status-spacer" />
      <span title={system?.cpu}><Cpu size={12} />{system ? `${system.logicalCores} hilos` : "Detectando"}</span>
      <span title={rendererInfo}>{displayedRenderDevice === "gpu" ? <MonitorCog size={12} /> : <Cpu size={12} />}{displayedRenderDevice.toUpperCase()}</span>
      <span><HardDrive size={12} />Local</span>
      <span><ShieldCheck size={12} />Original intacto</span>
      <b>{Math.round(camera.zoom * 100)}%</b>
    </footer>
  );
}
