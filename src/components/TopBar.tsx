import { useState } from "react";
import { Download, FolderOpen, ImageMinus, Layers3, LoaderCircle, Redo2, RotateCcw, Save, Settings2, Undo2 } from "lucide-react";
import { exportVerifiedDocument } from "../lib/alphaService";
import { changePixelHistory } from "../lib/historyService";
import { useStudioStore } from "../stores/studioStore";
import { UpdatePanel } from "./UpdatePanel";

export function TopBar({ onOpen, onRemove, onBatch, importingImage = false, batchMode = false, batchRunning = false }: { onOpen: () => void; onRemove: () => void; onBatch: () => void; importingImage?: boolean; batchMode?: boolean; batchRunning?: boolean }) {
  const history = useStudioStore((state) => state.history);
  const future = useStudioStore((state) => state.future);
  const document = useStudioStore((state) => state.document);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const setModule = useStudioStore((state) => state.setModule);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const visualReviewComplete = useStudioStore((state) => state.visualReviewComplete);
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    if (!visualReviewComplete) {
      setModule("transparency");
      setNotification({ kind: "error", text: "Completá la revisión visual de bordes antes de exportar." });
      return;
    }
    setExporting(true);
    try {
      const result = await exportVerifiedDocument(document, (job) => setActiveJob(job));
      if (result) setNotification({ kind: "success", text: `PNG reabierto y verificado: cero semitransparencias · ${result.dpi} PPP.` });
    } catch (reason) {
      setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
    } finally { setExporting(false); }
  };
  return <>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">D</span><b>DTF Pro Studio</b></div>
      <nav className="app-menu" aria-label="Menú principal"><button>Archivo</button><button>Editar</button><button>Ver</button></nav>
      <div className="quick-actions">
        <button onClick={onOpen} disabled={importingImage || batchMode} title="Abrir o reemplazar imagen (Ctrl+O)"><FolderOpen size={16} /><span>Abrir</span></button>
        <button className={batchMode ? "batch-mode-button active" : "batch-mode-button"} disabled={batchRunning} onClick={onBatch} title={batchMode ? "Salir del modo lote" : "Procesar una carpeta completa"}><Layers3 size={16} /><span>{batchMode ? "Salir del lote" : "Por lote"}</span></button>
        <button onClick={onRemove} disabled={!document || importingImage || batchMode} title="Quitar imagen del espacio de trabajo"><ImageMinus size={16} /><span>Quitar imagen</span></button>
        <button disabled={!document} title="Guardar proyecto"><Save size={16} /><span>Guardar</span></button>
        <i />
        <button onClick={() => void changePixelHistory("undo")} disabled={history.length <= 1} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
        <button onClick={() => void changePixelHistory("redo")} disabled={!future.length} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
        <button onClick={() => useStudioStore.setState({ camera: { x: 120, y: 80, zoom: 1 } })} title="Restablecer vista"><RotateCcw size={16} /></button>
      </div>
      <div className="topbar-end"><button title="Configuración y actualizaciones" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /><span>Ajustes</span></button><button className="export-button" disabled={!document || exporting || batchMode} onClick={exportDocument}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}<span>{exporting ? "Verificando" : "Exportar"}</span></button></div>
    </header>
    {settingsOpen && <UpdatePanel onClose={() => setSettingsOpen(false)} />}
  </>;
}
