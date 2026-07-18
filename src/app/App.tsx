import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FileImage, LoaderCircle } from "lucide-react";
import { CanvasWorkspace } from "../canvas/CanvasWorkspace";
import { CanvasControls } from "../components/CanvasControls";
import { Inspector } from "../components/Inspector";
import { StatusBar } from "../components/StatusBar";
import { ToolRail } from "../components/ToolRail";
import { TopBar } from "../components/TopBar";
import { BatchQueueStrip, useBatchController } from "../components/BatchPanel";
import { JobProgress } from "../components/Inspector";
import { dispatchCommand, type SystemCapabilities } from "../lib/commandBus";
import { changePixelHistory } from "../lib/historyService";
import { useStudioStore } from "../stores/studioStore";
import { closeEngineDocument, importDroppedImagePath, importImageFile } from "./importImage";
import { cancelJob } from "../lib/jobService";
import { editResidueMask, refreshResiduePreview } from "../lib/residueService";

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const importing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [importingImage, setImportingImage] = useState(false);
  const [system, setSystem] = useState<SystemCapabilities | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const batch = useBatchController();
  const setDocument = useStudioStore((state) => state.setDocument);
  const notification = useStudioStore((state) => state.notification);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setModule = useStudioStore((state) => state.setModule);
  const activeJob = useStudioStore((state) => state.activeJob);
  const open = () => { if (!batchOpen) inputRef.current?.click(); };

  const cancelRunningJob = useCallback(async () => {
    const state = useStudioStore.getState();
    const job = state.activeJob;
    if (job && (job.status === "queued" || job.status === "running")) {
      try { await cancelJob(job.id); } catch { /* el documento igualmente puede cerrarse */ }
      state.setActiveJob(null);
    }
  }, []);

  const installImage = useCallback(async (loader: () => Promise<Awaited<ReturnType<typeof importImageFile>>>) => {
    if (importing.current || batchOpen) return;
    importing.current = true;
    setImportingImage(true);
    setError(null);
    try {
      await cancelRunningJob();
      const previous = useStudioStore.getState().document;
      const next = await loader();
      setDocument(next);
      if (previous) void closeEngineDocument(previous.id).catch(() => {
        setNotification({ kind: "error", text: "La imagen cambió, pero no se pudo liberar el documento anterior del motor." });
      });
      setNotification({ kind: "success", text: previous ? `Imagen reemplazada por ${next.name}.` : `${next.name} abierta correctamente.` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir la imagen.");
    } finally {
      importing.current = false;
      setImportingImage(false);
      setDropActive(false);
    }
  }, [batchOpen, cancelRunningJob, setDocument, setNotification]);

  const removeImage = useCallback(async () => {
    const current = useStudioStore.getState().document;
    if (!current) return;
    await cancelRunningJob();
    setDocument(null);
    try {
      await closeEngineDocument(current.id);
      setNotification({ kind: "info", text: "Imagen quitada del espacio de trabajo. El archivo original no fue borrado del disco." });
    } catch (reason) {
      setNotification({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
    }
  }, [cancelRunningJob, setDocument, setNotification]);

  useEffect(() => {
    void dispatchCommand<Record<string, never>, SystemCapabilities>("system.capabilities", {}).then((result) => {
      if (result.ok && result.data) setSystem(result.data);
    });
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDropActive(true);
      } else if (event.payload.type === "leave") {
        setDropActive(false);
      } else if (event.payload.type === "drop") {
        setDropActive(false);
        const path = event.payload.paths[0];
        if (path) void installImage(() => importDroppedImagePath(path));
      }
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [installImage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (event.ctrlKey && event.key.toLowerCase() === "o") { event.preventDefault(); open(); }
      const state = useStudioStore.getState();
      const editMaskHistory = async (action: "undo" | "redo") => {
        const latest = useStudioStore.getState();
        if (!latest.document) return;
        const summary = await editResidueMask(latest.document, { action });
        await refreshResiduePreview(latest.document, summary);
      };
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (state.residueMask.canUndo) void editMaskHistory("undo"); else void changePixelHistory("undo");
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        if (state.residueMask.canRedo) void editMaskHistory("redo"); else void changePixelHistory("redo");
      }
      if ((event.key === "Delete" || event.key === "Backspace") && state.residueMask.hasSelection) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("dtf:apply-residue"));
      }
      if (event.key === "[") state.setResidueBrushSize(state.residueBrushSize - Math.max(1, Math.round(state.residueBrushSize * 0.12)));
      if (event.key === "]") state.setResidueBrushSize(state.residueBrushSize + Math.max(1, Math.round(state.residueBrushSize * 0.12)));
      if (event.key === "0") useStudioStore.getState().fitDocument();
      if (event.key === "1") useStudioStore.getState().actualSize();
      const toolKeys = { h: "hand", z: "zoom", b: "residue-brush", e: "eraser", v: "transform", l: "residue-lasso", m: "residue-rectangle", w: "residue-region" } as const;
      const tool = toolKeys[event.key.toLowerCase() as keyof typeof toolKeys];
      if (tool) useStudioStore.getState().setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    void installImage(() => importImageFile(file));
  };

  const onDragEnter = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDropActive(true);
  };
  const onDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropActive(false);
  };
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void installImage(() => importImageFile(file));
  };

  return (
    <div className={`studio-shell${dropActive ? " file-drop-active" : ""}${batchOpen ? " batch-open" : ""}${batch.running ? " batch-running" : ""}`} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input ref={inputRef} className="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,image/*" onChange={onFile} />
      <TopBar onOpen={open} onRemove={() => void removeImage()} onBatch={() => {
        if (batch.running) return;
        setBatchOpen((current) => {
          if (!current) setModule("transparency");
          return !current;
        });
      }} importingImage={importingImage} batchMode={batchOpen} batchRunning={batch.running} />
      <CanvasControls />
      <main className="workspace-layout">
        <ToolRail />
        <CanvasWorkspace onOpen={open} onRemove={() => void removeImage()} />
        <Inspector batchMode={batchOpen} batch={batchOpen ? batch : undefined} onExitBatch={() => setBatchOpen(false)} />
        {batchOpen && <BatchQueueStrip batch={batch} />}
      </main>
      <StatusBar system={system} />
      {dropActive && <div className="file-drop-overlay"><FileImage size={38} /><b>Soltá la imagen para abrirla</b><span>Reemplazará la imagen actual sin borrar el archivo original</span></div>}
      {importingImage && <div className="image-import-indicator"><LoaderCircle className="spin" size={16} /> Preparando imagen…</div>}
      {error && <div className="toast error" role="alert"><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}
      {notification && <div className={`toast ${notification.kind}`} role="status"><span>{notification.text}</span><button onClick={() => setNotification(null)}>×</button></div>}
      {activeJob && (activeJob.status === "queued" || activeJob.status === "running") && <div className="global-job-progress"><JobProgress job={activeJob} onCancel={() => void cancelJob(activeJob.id)} /></div>}
    </div>
  );
}
