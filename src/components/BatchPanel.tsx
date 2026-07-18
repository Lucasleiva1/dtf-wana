import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ChevronLeft, ChevronRight, CircleAlert, FileImage, FolderInput, FolderOutput, ImageIcon, LoaderCircle,
  Play, RotateCcw, Square, Trash2, X,
} from "lucide-react";
import { closeEngineDocument, importDroppedImagePath } from "../app/importImage";
import { getDocumentPreview } from "../lib/alphaService";
import {
  batchOutputPath, buildBatchTreatment, defaultBatchConfiguration,
  loadBatchThumbnail, scanBatchFolder,
} from "../lib/batchService";
import {
  cancelJob, runAnalysisJob, runApplyResidueJob, runEdgePolishApplyJob,
  runExportJob, runResidueCleanupJob, runTreatmentJob,
} from "../lib/jobService";
import { useStudioStore } from "../stores/studioStore";
import type { ExportFormat, JobSnapshot } from "../types/alpha";
import type { BatchConfiguration, BatchQueueItem } from "../types/batch";

const number = new Intl.NumberFormat("es-AR");
let thumbnailPipeline = Promise.resolve();

function loadThumbnailSequentially(path: string): Promise<Blob> {
  const result = thumbnailPipeline.then(() => loadBatchThumbnail(path));
  thumbnailPipeline = result.then(() => undefined, () => undefined);
  return result;
}

export function useBatchController() {
  const [inputFolder, setInputFolder] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [queue, setQueue] = useState<BatchQueueItem[]>([]);
  const [config, setConfig] = useState<BatchConfiguration>(() => structuredClone(defaultBatchConfiguration));
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [batchError, setBatchError] = useState<string | null>(null);
  const cancelRequested = useRef(false);

  const setDocument = useStudioStore((state) => state.setDocument);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const setAnalysis = useStudioStore((state) => state.setAlphaAnalysis);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const setNotification = useStudioStore((state) => state.setNotification);

  const updateItem = (path: string, patch: Partial<BatchQueueItem>) => {
    setQueue((current) => current.map((item) => item.path === path ? { ...item, ...patch } : item));
  };

  const selectInputFolder = async () => {
    if (running) return;
    const selected = await open({ title: "Elegir carpeta de entrada", directory: true, multiple: false });
    if (typeof selected !== "string") return;
    setScanning(true);
    setBatchError(null);
    try {
      const images = await scanBatchFolder(selected);
      setInputFolder(selected);
      setQueue(images.map((image) => ({ ...image, status: "pending", stage: "En espera", percent: 0 })));
      setCompleted(0);
      if (!images.length) setBatchError("La carpeta no contiene imágenes PNG, JPG, WebP, TIFF o BMP.");
    } catch (reason) {
      setBatchError(messageOf(reason));
    } finally {
      setScanning(false);
    }
  };

  const selectOutputFolder = async () => {
    if (running) return;
    const selected = await open({ title: "Elegir carpeta de salida", directory: true, multiple: false });
    if (typeof selected === "string") setOutputFolder(selected);
  };

  const jobProgress = <T,>(path: string, prefix: string, base: number, span: number) => (job: JobSnapshot<T>) => {
    setActiveJob(job);
    updateItem(path, {
      stage: `${prefix} · ${job.stage}`,
      percent: Math.min(99, base + job.percent * span / 100),
    });
  };

  const startBatch = async () => {
    if (running || !inputFolder || !queue.length) return;
    cancelRequested.current = false;
    setRunning(true);
    setBatchError(null);
    setQueue((current) => current.map((item) => item.status === "error"
      ? { ...item, status: "pending", stage: "En espera", percent: 0, error: undefined }
      : item));

    const previous = useStudioStore.getState().document;
    if (previous) {
      useStudioStore.getState().setDocument(null);
      await closeEngineDocument(previous.id).catch(() => undefined);
    }

    const work = queue.filter((item) => item.status !== "processing");
    let completedThisRun = 0;
    let failedThisRun = 0;

    for (const item of work) {
      if (cancelRequested.current) break;
      let openedDocument: Awaited<ReturnType<typeof importDroppedImagePath>> | null = null;
      updateItem(item.path, { status: "processing", stage: "Abriendo imagen", percent: 0, error: undefined });
      try {
        openedDocument = await importDroppedImagePath(item.path);
        if (cancelRequested.current) break;
        setDocument(openedDocument);
        let working = openedDocument;
        const needsAnalysis = config.alphaEnabled || config.residueEnabled || config.polishEnabled;
        let analysis = needsAnalysis
          ? await runAnalysisJob(working, jobProgress(item.path, "Analizando alfa", 0, 15))
          : null;
        if (analysis) setAnalysis(analysis);

        if (config.alphaEnabled && analysis?.partialAlphaPixels) {
          const treatment = buildBatchTreatment(analysis.maxAlpha, config.alpha);
          const treated = await runTreatmentJob(working, treatment, jobProgress(item.path, "Resolviendo transparencias", 15, 30));
          analysis = treated.analysis;
          working = { ...working, revision: treated.revision, dirty: true };
          updateDocument({ revision: treated.revision, dirty: true });
          setAnalysis(analysis);
        } else if (config.alphaEnabled) {
          updateItem(item.path, { stage: "Alfa binario; no requiere cambios", percent: 45 });
        } else {
          updateItem(item.path, { stage: "Transparencias excluidas del lote", percent: 45 });
        }

        if (config.alphaEnabled && analysis && !analysis.verifiedSolidAlpha) {
          throw new Error(`Quedaron ${number.format(analysis.partialAlphaPixels)} píxeles semitransparentes con esta configuración.`);
        }
        if (!config.alphaEnabled && analysis && !analysis.verifiedSolidAlpha && (config.residueEnabled || config.polishEnabled)) {
          throw new Error("Limpieza y pulido requieren alfa binario. Incluí Transparencias en el lote o excluí esas etapas.");
        }

        if (config.residueEnabled) {
          const detected = await runResidueCleanupJob(
            working,
            { ...config.residue, protectedRegionIds: [] },
            jobProgress(item.path, "Detectando residuos", 45, 15),
          );
          if (detected.summary.hasSelection) {
            const cleaned = await runApplyResidueJob(working, jobProgress(item.path, "Quitando residuos", 60, 15));
            analysis = cleaned.analysis;
            working = { ...working, revision: cleaned.revision, dirty: true };
            updateDocument({ revision: cleaned.revision, dirty: true });
            setAnalysis(analysis);
          } else {
            updateItem(item.path, { stage: "Sin residuos detectados", percent: 75 });
          }
        } else {
          updateItem(item.path, { stage: "Limpieza excluida del lote", percent: 75 });
        }

        if (config.polishEnabled) {
          const polished = await runEdgePolishApplyJob(
            working,
            config.polish,
            jobProgress(item.path, "Puliendo borde", 75, 15),
          );
          analysis = polished.analysis;
          working = { ...working, revision: polished.revision, dirty: true };
          updateDocument({ revision: polished.revision, dirty: true });
          setAnalysis(analysis);
        } else {
          updateItem(item.path, { stage: "Pulido excluido del lote", percent: 90 });
        }

        const preview = await getDocumentPreview(working, "result");
        updateDocument({ renderBlob: preview, renderRevision: working.renderRevision + 1 });
        await runExportJob(
          working,
          batchOutputPath(item, outputFolder, config.format),
          jobProgress(item.path, "Exportando", 90, 10),
          { format: config.format, dpi: config.dpi, avoidOverwrite: true },
        );
        completedThisRun += 1;
        setCompleted((value) => value + 1);
        setQueue((current) => current.filter((queued) => queued.path !== item.path));
      } catch (reason) {
        if (cancelRequested.current) {
          updateItem(item.path, { status: "pending", stage: "En espera", percent: 0, error: undefined });
          break;
        }
        failedThisRun += 1;
        updateItem(item.path, { status: "error", stage: "No se pudo completar", error: messageOf(reason) });
      } finally {
        if (openedDocument) {
          if (useStudioStore.getState().document?.id === openedDocument.id) setDocument(null);
          await closeEngineDocument(openedDocument.id).catch(() => undefined);
        }
      }
    }

    setActiveJob(null);
    setRunning(false);
    const cancelled = cancelRequested.current;
    setNotification({
      kind: failedThisRun ? "error" : cancelled ? "info" : "success",
      text: cancelled
        ? `Lote detenido. ${completedThisRun} imágenes completadas; lo pendiente permanece en la cola.`
        : failedThisRun
          ? `Lote terminado: ${completedThisRun} exportadas y ${failedThisRun} con error para revisar.`
          : `Lote terminado: ${completedThisRun} imágenes procesadas y exportadas.`,
    });
  };

  const stopBatch = async () => {
    cancelRequested.current = true;
    const active = useStudioStore.getState().activeJob;
    if (active && (active.status === "queued" || active.status === "running")) {
      await cancelJob(active.id).catch(() => undefined);
    }
  };

  const clearQueue = () => {
    if (running) return;
    setQueue([]);
    setCompleted(0);
    setBatchError(null);
  };

  return {
    inputFolder, outputFolder, queue, config, scanning, running, completed, batchError,
    setConfig, setOutputFolder, selectInputFolder, selectOutputFolder, startBatch, stopBatch, clearQueue,
  };
}

export type BatchController = ReturnType<typeof useBatchController>;

export function BatchSetupPanel({ batch, onClose }: { batch: BatchController; onClose: () => void }) {
  const errors = batch.queue.filter((item) => item.status === "error").length;
  const pending = batch.queue.length - errors;
  return <section className="batch-setup-zone" aria-label="Configuración del procesamiento por lote">
    <header className="batch-mode-heading">
      <div><b>PROCESAMIENTO POR LOTE</b><span>{batch.completed} completadas · {pending} pendientes{errors ? ` · ${errors} con error` : ""}</span></div>
      <button disabled={batch.running} onClick={onClose} title="Salir del modo lote"><X size={15} /></button>
    </header>
    <div className="batch-setup-body">
      <PathButton icon={<FolderInput size={17} />} label="Carpeta de entrada" path={batch.inputFolder} action={batch.scanning ? "Detectando…" : "Elegir carpeta"} disabled={batch.running || batch.scanning} onClick={() => void batch.selectInputFolder()} />
      <PathButton icon={<FolderOutput size={17} />} label="Carpeta de salida" path={batch.outputFolder} action="Elegir carpeta" disabled={batch.running} onClick={() => void batch.selectOutputFolder()} />
      <button className="batch-same-folder" disabled={batch.running || !batch.outputFolder} onClick={() => batch.setOutputFolder(null)}><RotateCcw size={13} /> Usar la misma carpeta de cada original</button>
      <div className="batch-export-row">
        <label>Formato<select disabled={batch.running} value={batch.config.format} onChange={(event) => batch.setConfig({ ...batch.config, format: event.target.value as ExportFormat })}>
          <option value="png">PNG</option><option value="webp">WebP sin pérdida</option><option value="tiff">TIFF</option><option value="bmp">BMP</option>
        </select></label>
        <label>PPP<input disabled={batch.running || batch.config.format !== "png"} type="number" min="1" max="2400" value={batch.config.dpi} onChange={(event) => batch.setConfig({ ...batch.config, dpi: clamp(Number(event.target.value), 1, 2400) })} /></label>
      </div>
      <small>Salida automática como <b>nombre_dtf</b>. Nunca se sobrescribe un archivo existente.</small>
      {batch.batchError && <div className="batch-error"><CircleAlert size={14} />{batch.batchError}</div>}
      <div className="batch-mode-actions">
        {batch.running
          ? <button className="batch-stop" onClick={() => void batch.stopBatch()}><Square size={13} /> Detener lote</button>
          : <button className="batch-start" disabled={!batch.queue.length || batch.scanning} onClick={() => void batch.startBatch()}><Play size={14} /> {errors ? "Reintentar lote" : "Procesar lote"}</button>}
        <button className="batch-clear" disabled={batch.running || !batch.queue.length} onClick={batch.clearQueue}><Trash2 size={13} /> Vaciar cola</button>
      </div>
    </div>
  </section>;
}

export function BatchQueueStrip({ batch }: { batch: BatchController }) {
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const scrollOne = (direction: -1 | 1) => {
    const list = listRef.current;
    const card = list?.querySelector<HTMLElement>(".batch-card");
    if (!list || !card) return;
    list.scrollBy({ left: direction * (card.offsetWidth + 8), behavior: "smooth" });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !listRef.current) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: listRef.current.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !listRef.current) return;
    event.preventDefault();
    listRef.current.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  return <section className="batch-queue-strip" aria-label="Imágenes pendientes del lote">
    <button className="batch-carousel-button previous" disabled={batch.queue.length < 2} onClick={() => scrollOne(-1)} title="Imagen anterior" aria-label="Imagen anterior"><ChevronLeft size={17} /></button>
    <div
      ref={listRef}
      className={`batch-queue-list${dragging ? " dragging" : ""}`}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onDragStart={(event) => event.preventDefault()}
    >
      {batch.queue.map((item) => <article key={item.path} className={`batch-card status-${item.status}`} title={item.error || item.relativePath}>
        <BatchThumbnail path={item.path} />
        <div className="batch-card-body"><b>{item.name}</b><span>{item.stage}</span><progress max="100" value={item.percent} />{item.error && <small>{item.error}</small>}</div>
        {item.status === "processing" && <LoaderCircle className="spin batch-card-spinner" size={15} />}
        {item.status === "error" && <CircleAlert className="batch-card-error-icon" size={15} />}
      </article>)}
      {!batch.queue.length && <div className="batch-empty"><FileImage size={25} /><b>{batch.completed ? "Todas las imágenes terminaron" : "Elegí una carpeta de entrada"}</b><span>{batch.completed ? `${batch.completed} archivos exportados correctamente.` : "Las imágenes pendientes aparecerán solamente en esta franja."}</span></div>}
    </div>
    <button className="batch-carousel-button next" disabled={batch.queue.length < 2} onClick={() => scrollOne(1)} title="Imagen siguiente" aria-label="Imagen siguiente"><ChevronRight size={17} /></button>
  </section>;
}

function BatchThumbnail({ path }: { path: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let objectUrl: string | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadThumbnailSequentially(path).then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => undefined);
    }, { rootMargin: "120px" });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return <div ref={host} className="batch-thumbnail">{source ? <img src={source} alt="" /> : <ImageIcon size={22} />}</div>;
}

function PathButton({ icon, label, path, action, disabled, onClick }: { icon: React.ReactNode; label: string; path: string | null; action: string; disabled: boolean; onClick: () => void }) {
  return <button className="batch-path-button" disabled={disabled} onClick={onClick}><span>{icon}</span><div><b>{label}</b><small title={path ?? undefined}>{path ?? (label.includes("salida") ? "Misma carpeta que el original" : "Sin seleccionar")}</small></div><em>{action}</em></button>;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
