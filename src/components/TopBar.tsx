import { useState } from "react";
import { Check, Download, FilePlus2, FolderOpen, ImageMinus, Info, Layers3, LoaderCircle, Redo2, RotateCcw, Save, Settings2, Trash2, Undo2 } from "lucide-react";
import { exportVerifiedDocument } from "../lib/alphaService";
import { changePixelHistory } from "../lib/historyService";
import { useStudioStore } from "../stores/studioStore";
import { UpdatePanel } from "./UpdatePanel";
import { exportBackgroundResult, redoBackgroundMask, undoBackgroundMask } from "../features/background-removal/commands/backgroundRemovalService";
import { useBackgroundRemovalStore } from "../features/background-removal/state/backgroundRemovalStore";

export function TopBar({ onNew, onOpen, onRemove, onProperties, onBatch, importingImage = false, batchMode = false, batchRunning = false }: { onNew: () => void; onOpen: () => void; onRemove: () => void; onProperties: () => void; onBatch: () => void; importingImage?: boolean; batchMode?: boolean; batchRunning?: boolean }) {
  const history = useStudioStore((state) => state.history);
  const future = useStudioStore((state) => state.future);
  const transformPast = useStudioStore((state) => state.transformPast);
  const transformFuture = useStudioStore((state) => state.transformFuture);
  const undoPlacedImageTransform = useStudioStore((state) => state.undoPlacedImageTransform);
  const redoPlacedImageTransform = useStudioStore((state) => state.redoPlacedImageTransform);
  const document = useStudioStore((state) => state.document);
  const selectedItemId = useStudioStore((state) => state.selectedItemId);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const setModule = useStudioStore((state) => state.setModule);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const visualReviewComplete = useStudioStore((state) => state.visualReviewComplete);
  const activeModule = useStudioStore((state) => state.activeModule);
  const backgroundSummary = useBackgroundRemovalStore((state) => state.summary);
  const backgroundOutputAlpha = useBackgroundRemovalStore((state) => state.outputAlpha);
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const showRulers = useStudioStore((state) => state.showRulers);
  const showGuides = useStudioStore((state) => state.showGuides);
  const guidesLocked = useStudioStore((state) => state.guidesLocked);
  const snapToGuides = useStudioStore((state) => state.snapToGuides);
  const smartGuidesEnabled = useStudioStore((state) => state.smartGuidesEnabled);
  const setShowRulers = useStudioStore((state) => state.setShowRulers);
  const setShowGuides = useStudioStore((state) => state.setShowGuides);
  const setGuidesLocked = useStudioStore((state) => state.setGuidesLocked);
  const setSnapToGuides = useStudioStore((state) => state.setSnapToGuides);
  const setSmartGuidesEnabled = useStudioStore((state) => state.setSmartGuidesEnabled);
  const clearGuides = useStudioStore((state) => state.clearGuides);
  const exportDocument = async () => {
    if (!document) return;
    if (!selectedItemId) {
      setNotification({ kind: "info", text: "Seleccioná la imagen con un clic antes de exportar." });
      return;
    }
    if (activeModule === "background") {
      if (!backgroundSummary.selectedPixels) {
        setNotification({ kind: "info", text: "Seleccioná el fondo con la varita, el detector de bordes o el pincel antes de exportar." });
        return;
      }
      setExporting(true);
      try {
        const result = await exportBackgroundResult(document, backgroundOutputAlpha, (job) => setActiveJob(job));
        if (result) setNotification({ kind: "success", text: `PNG sin fondo reabierto y verificado · ${result.width.toLocaleString("es-AR")} × ${result.height.toLocaleString("es-AR")} px · ${result.dpi} PPP.` });
      } catch (reason) {
        setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
      } finally { setActiveJob(null); setExporting(false); }
      return;
    }
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
      <nav className="app-menu" aria-label="Menú principal"><button>Archivo</button><button>Editar</button><span className="view-menu-anchor"><button className={viewMenuOpen ? "active" : ""} onClick={() => setViewMenuOpen((open) => !open)}>Ver</button>{viewMenuOpen && <div className="view-menu-popover">
        <button onClick={() => setShowRulers(!showRulers)}><i>{showRulers && <Check size={12} />}</i> Mostrar reglas</button>
        <button onClick={() => setShowGuides(!showGuides)}><i>{showGuides && <Check size={12} />}</i> Mostrar guías</button>
        <button onClick={() => setGuidesLocked(!guidesLocked)}><i>{guidesLocked && <Check size={12} />}</i> Bloquear guías</button>
        <button onClick={() => setSnapToGuides(!snapToGuides)}><i>{snapToGuides && <Check size={12} />}</i> Ajustar a guías</button>
        <button onClick={() => setSmartGuidesEnabled(!smartGuidesEnabled)}><i>{smartGuidesEnabled && <Check size={12} />}</i> Guías inteligentes</button>
        <hr />
        <button className="danger" disabled={!document?.guides?.length} onClick={() => { clearGuides(); setViewMenuOpen(false); }}><i><Trash2 size={12} /></i> Borrar todas las guías</button>
      </div>}</span></nav>
      <div className="quick-actions">
        <button onClick={onNew} disabled={importingImage || batchMode} title="Nuevo documento (Ctrl+N)"><FilePlus2 size={16} /><span>Nuevo</span></button>
        <button onClick={onOpen} disabled={importingImage || batchMode} title="Abrir o reemplazar imagen (Ctrl+O)"><FolderOpen size={16} /><span>Abrir</span></button>
        <button className={batchMode ? "batch-mode-button active" : "batch-mode-button"} disabled={batchRunning} onClick={onBatch} title={batchMode ? "Salir del modo lote" : "Procesar una carpeta completa"}><Layers3 size={16} /><span>{batchMode ? "Salir del lote" : "Por lote"}</span></button>
        <button onClick={onRemove} disabled={!document?.placedImage || importingImage || batchMode} title="Quitar imagen del espacio de trabajo"><ImageMinus size={16} /><span>Quitar imagen</span></button>
        <button disabled={!document} title="Guardar proyecto"><Save size={16} /><span>Guardar</span></button>
        <button disabled={!document} onClick={onProperties} title="Propiedades del documento"><Info size={16} /><span>Propiedades</span></button>
        <i />
        <button onClick={() => activeModule === "background" && document ? void undoBackgroundMask(document) : transformPast.length ? undoPlacedImageTransform() : void changePixelHistory("undo")} disabled={activeModule === "background" ? !backgroundSummary.canUndo : history.length <= 1 && !transformPast.length} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
        <button onClick={() => activeModule === "background" && document ? void redoBackgroundMask(document) : transformFuture.length ? redoPlacedImageTransform() : void changePixelHistory("redo")} disabled={activeModule === "background" ? !backgroundSummary.canRedo : !future.length && !transformFuture.length} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
        <button onClick={() => useStudioStore.setState({ camera: { x: 120, y: 80, zoom: 1 } })} title="Restablecer vista"><RotateCcw size={16} /></button>
      </div>
      <div className="topbar-end"><button title="Configuración y actualizaciones" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /><span>Ajustes</span></button><button className="export-button" disabled={!document || document.engineReady === false || exporting || batchMode} onClick={exportDocument}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}<span>{exporting ? "Verificando" : "Exportar"}</span></button></div>
    </header>
    {settingsOpen && <UpdatePanel onClose={() => setSettingsOpen(false)} />}
  </>;
}
