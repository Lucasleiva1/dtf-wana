import { useState } from "react";
import { Download, FolderOpen, LoaderCircle, Redo2, RotateCcw, Save, Settings2, Undo2 } from "lucide-react";
import { exportVerifiedDocument } from "../lib/alphaService";
import { changePixelHistory } from "../lib/historyService";
import { useStudioStore } from "../stores/studioStore";

export function TopBar({ onOpen }: { onOpen: () => void }) {
  const history = useStudioStore((state) => state.history);
  const future = useStudioStore((state) => state.future);
  const document = useStudioStore((state) => state.document);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const setModule = useStudioStore((state) => state.setModule);
  const setNotification = useStudioStore((state) => state.setNotification);
  const [exporting, setExporting] = useState(false);
  const exportDocument = async () => {
    if (!document) return;
    if (!analysis) {
      setModule("transparency");
      setNotification({ kind: "error", text: "Analizá el alfa antes de exportar para DTF." });
      return;
    }
    if (!analysis.verifiedSolidAlpha) {
      setModule("transparency");
      setNotification({ kind: "error", text: `Exportación bloqueada: quedan ${analysis.partialAlphaPixels.toLocaleString("es-AR")} píxeles semitransparentes.` });
      return;
    }
    setExporting(true);
    try {
      const result = await exportVerifiedDocument(document);
      if (result) setNotification({ kind: "success", text: `PNG reabierto y verificado: cero semitransparencias · ${result.dpi} PPP.` });
    } catch (reason) {
      setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
    } finally { setExporting(false); }
  };
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">D</span><b>DTF Pro Studio</b></div>
      <nav className="app-menu" aria-label="Menú principal"><button>Archivo</button><button>Editar</button><button>Ver</button></nav>
      <div className="quick-actions">
        <button onClick={onOpen} title="Abrir (Ctrl+O)"><FolderOpen size={16} /><span>Abrir</span></button>
        <button disabled={!document} title="Guardar proyecto"><Save size={16} /><span>Guardar</span></button>
        <i />
        <button onClick={() => void changePixelHistory("undo")} disabled={history.length <= 1} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
        <button onClick={() => void changePixelHistory("redo")} disabled={!future.length} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
        <button onClick={() => useStudioStore.setState({ camera: { x: 120, y: 80, zoom: 1 } })} title="Restablecer vista"><RotateCcw size={16} /></button>
      </div>
      <div className="topbar-end"><button title="Configuración"><Settings2 size={16} /><span>Ajustes</span></button><button className="export-button" disabled={!document || exporting} onClick={exportDocument}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}<span>{exporting ? "Verificando" : "Exportar"}</span></button></div>
    </header>
  );
}
