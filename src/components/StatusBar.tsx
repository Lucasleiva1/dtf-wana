import { Cpu, HardDrive, ShieldCheck } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import type { SystemCapabilities } from "../lib/commandBus";

export function StatusBar({ system }: { system: SystemCapabilities | null }) {
  const document = useStudioStore((state) => state.document);
  const camera = useStudioStore((state) => state.camera);
  return (
    <footer className="statusbar">
      <span>{document ? document.name : "Sin documento"}</span>
      {document && <><i /><span>{document.width} × {document.height} px</span><span>{(document.sizeBytes / 1024 / 1024).toFixed(2)} MB</span></>}
      <span className="status-spacer" />
      <span title={system?.cpu}><Cpu size={12} />{system ? `${system.logicalCores} hilos` : "Detectando"}</span>
      <span><HardDrive size={12} />Local</span>
      <span><ShieldCheck size={12} />Original intacto</span>
      <b>{Math.round(camera.zoom * 100)}%</b>
    </footer>
  );
}
