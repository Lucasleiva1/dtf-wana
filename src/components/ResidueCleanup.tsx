import { useEffect, useState } from "react";
import { BoxSelect, CircleDot, Eraser, Eye, Lasso, MousePointer2, Paintbrush, Redo2, ShieldOff, Trash2, Undo2 } from "lucide-react";
import { getDocumentPreview } from "../lib/alphaService";
import { runApplyResidueJob, runResidueCleanupJob } from "../lib/jobService";
import { editResidueMask, refreshResiduePreview } from "../lib/residueService";
import { useStudioStore } from "../stores/studioStore";
import type { ToolId } from "../types/document";
import type { MaskEdit, ResidueCleanupOptions } from "../types/residue";
import type { BatchConfiguration } from "../types/batch";

const number = new Intl.NumberFormat("es-AR");

const initialOptions: ResidueCleanupOptions = {
  isolatedParticles: true,
  weakEdgeFragments: true,
  exteriorContourRemains: true,
  includeProtectedSelected: false,
  maxRegionSize: 900,
  maxDistance: 48,
  minimumConnectionThickness: 2,
  contourSensitivity: 55,
  protectedRegionIds: [],
};

type BatchResidueMode = {
  enabled: boolean;
  running: boolean;
  options: BatchConfiguration["residue"];
  onChange: (options: BatchConfiguration["residue"]) => void;
};

export function ResidueCleanup({ protectedRegionIds, onUnprotectCurrent, batch }: { protectedRegionIds: string[]; onUnprotectCurrent: () => void; batch?: BatchResidueMode }) {
  if (batch) return <BatchResidueOptions batch={batch} />;
  return <ManualResidueCleanup protectedRegionIds={protectedRegionIds} onUnprotectCurrent={onUnprotectCurrent} />;
}

function ManualResidueCleanup({ protectedRegionIds, onUnprotectCurrent }: { protectedRegionIds: string[]; onUnprotectCurrent: () => void }) {
  const document = useStudioStore((state) => state.document);
  const summary = useStudioStore((state) => state.residueMask);
  const activeTool = useStudioStore((state) => state.activeTool);
  const mode = useStudioStore((state) => state.residueMaskMode);
  const brushSize = useStudioStore((state) => state.residueBrushSize);
  const busy = useStudioStore((state) => state.activeJob?.status === "queued" || state.activeJob?.status === "running");
  const setTool = useStudioStore((state) => state.setTool);
  const setMode = useStudioStore((state) => state.setResidueMaskMode);
  const setBrushSize = useStudioStore((state) => state.setResidueBrushSize);
  const setSummary = useStudioStore((state) => state.setResidueMask);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const setAnalysis = useStudioStore((state) => state.setAlphaAnalysis);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const pushHistory = useStudioStore((state) => state.pushHistory);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setFlow = useStudioStore((state) => state.setTransparencyFlow);
  const setVisualReviewComplete = useStudioStore((state) => state.setVisualReviewComplete);
  const setResidueOverlay = useStudioStore((state) => state.setResidueOverlay);
  const clearResidueOverlay = useStudioStore((state) => state.clearResidueOverlay);
  const setResidueOverlayVisible = useStudioStore((state) => state.setResidueOverlayVisible);
  const [options, setOptions] = useState(initialOptions);

  useEffect(() => setOptions((current) => ({ ...current, protectedRegionIds })), [protectedRegionIds]);

  const runEdit = async (edit: MaskEdit) => {
    if (!document || busy) return;
    try {
      const result = await editResidueMask(document, edit);
      await refreshResiduePreview(document, result);
    } catch (reason) {
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };

  const detect = async () => {
    if (!document || busy) return;
    try {
      const result = await runResidueCleanupJob(document, { ...options, protectedRegionIds }, setActiveJob);
      setSummary(result.summary);
      setResidueOverlay({ documentId: document.id, width: document.width, height: document.height, fullMask: result.mask });
      setNotification({ kind: "info", text: result.summary.hasSelection
        ? `Previsualización lista: ${number.format(result.summary.selectedPixels)} píxeles en ${number.format(result.summary.selectedRegions)} regiones.`
        : "No se detectaron residuos con estos parámetros." });
    } catch (reason) {
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };

  const apply = async () => {
    const latest = useStudioStore.getState().document;
    if (!latest || !useStudioStore.getState().residueMask.hasSelection || busy) return;
    try {
      setFlow("applying");
      const result = await runApplyResidueJob(latest, (job) => {
        setActiveJob(job);
        if (job.stageIndex >= 2) setFlow("verifying");
      });
      const blob = await getDocumentPreview(latest, "result");
      updateDocument({ revision: result.revision, dirty: true, renderBlob: blob, renderRevision: latest.renderRevision + 1 });
      setAnalysis(result.analysis);
      setSummary({ selectedPixels: 0, selectedRegions: 0, hasSelection: false, canUndo: false, canRedo: false });
      clearResidueOverlay();
      setVisualReviewComplete(false);
      pushHistory(`Limpiar ${number.format(result.removedRegions)} regiones de residuos`);
      setFlow(result.analysis.verifiedSolidAlpha ? "technical_result" : "recommendation_available");
      setNotification({ kind: "success", text: `Limpieza aplicada: ${number.format(result.removedPixels)} píxeles pasaron exactamente a alfa 0. No se generaron semitransparencias nuevas.` });
    } catch (reason) {
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };

  useEffect(() => {
    const listener = () => void apply();
    window.addEventListener("dtf:apply-residue", listener);
    return () => window.removeEventListener("dtf:apply-residue", listener);
  });

  const compare = (showOriginal: boolean) => setResidueOverlayVisible(!showOriginal);

  const toolButtons: Array<[ToolId, string, typeof MousePointer2]> = [
    ["residue-region", "Clic", MousePointer2],
    ["residue-rectangle", "Rectángulo", BoxSelect],
    ["residue-lasso", "Lazo", Lasso],
    ["residue-brush", "Pincel", Paintbrush],
  ];

  return <section className="residue-cleanup">
    <div className="section-title"><span>LIMPIEZA DE RESIDUOS</span><Trash2 size={14} /></div>
    <p className="microcopy">Selecciona puntos exteriores, fragmentos débiles o cualquier zona protegida. Todo se muestra en rojo y no modifica el documento hasta confirmar.</p>

    <div className="residue-options">
      <Check label="Partículas aisladas" checked={options.isolatedParticles} onChange={(value) => setOptions({ ...options, isolatedParticles: value })} />
      <Check label="Fragmentos débiles conectados al borde" checked={options.weakEdgeFragments} onChange={(value) => setOptions({ ...options, weakEdgeFragments: value })} />
      <Check label="Restos exteriores del contorno" checked={options.exteriorContourRemains} onChange={(value) => setOptions({ ...options, exteriorContourRemains: value })} />
      <Check label="Incluir zonas protegidas seleccionadas" checked={options.includeProtectedSelected} onChange={(value) => setOptions({ ...options, includeProtectedSelected: value })} />
    </div>

    <div className="residue-parameters">
      <NumberField label="Tamaño máximo de región" value={options.maxRegionSize} min={1} max={250000} onChange={(value) => setOptions({ ...options, maxRegionSize: value })} />
      <NumberField label="Distancia máxima al diseño" value={options.maxDistance} min={0} max={2048} onChange={(value) => setOptions({ ...options, maxDistance: value })} />
      <NumberField label="Grosor mínimo de conexión" value={options.minimumConnectionThickness} min={1} max={32} onChange={(value) => setOptions({ ...options, minimumConnectionThickness: value })} />
      <label className="field-label">Sensibilidad del contorno: {options.contourSensitivity}<input type="range" min="1" max="100" value={options.contourSensitivity} onChange={(event) => setOptions({ ...options, contourSensitivity: Number(event.target.value) })} /></label>
    </div>
    <button className="primary-action" disabled={!document || busy} onClick={() => void detect()}><CircleDot size={14} /> DETECTAR Y MOSTRAR EN ROJO</button>

    <div className="manual-cleanup-title"><b>Limpieza manual</b><span>Shift suma · Alt resta</span></div>
    <div className="manual-tools">
      {toolButtons.map(([id, label, Icon]) => <button key={id} className={activeTool === id ? "active" : ""} onClick={() => setTool(id)} title={label}><Icon size={15} /><span>{label}</span></button>)}
    </div>
    <div className="segmented residue-mask-modes">
      <button className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}>Añadir a eliminación</button>
      <button className={mode === "subtract" ? "active" : ""} onClick={() => setMode("subtract")}>Quitar de eliminación</button>
    </div>
    {activeTool === "residue-brush" && <label className="brush-size-control"><span>Tamaño del pincel</span><input type="range" min="1" max="500" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><input aria-label="Tamaño numérico del pincel" type="number" min="1" max="500" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><small>[ y ]</small></label>}

    <div className="mask-actions">
      <button onClick={() => void runEdit({ action: "select_all" })}>Seleccionar todo</button>
      <button onClick={() => void runEdit({ action: "clear" })}>Deseleccionar</button>
      <button onClick={() => void runEdit({ action: "invert" })}>Invertir</button>
      <button disabled={!summary.canUndo} onClick={() => void runEdit({ action: "undo" })}><Undo2 size={13} /> Deshacer</button>
      <button disabled={!summary.canRedo} onClick={() => void runEdit({ action: "redo" })}><Redo2 size={13} /> Rehacer</button>
      <button disabled={!protectedRegionIds.length} onClick={onUnprotectCurrent}><ShieldOff size={13} /> Desproteger región</button>
    </div>

    <div className="residue-summary">
      <div><span className="red-dot" /><span>Píxeles que pasarán a alfa 0</span><b>{number.format(summary.selectedPixels)}</b></div>
      <div><span className="red-dot" /><span>Regiones seleccionadas</span><b>{number.format(summary.selectedRegions)}</b></div>
    </div>
    <button className="hold-compare" disabled={!summary.hasSelection} onPointerDown={() => compare(true)} onPointerUp={() => compare(false)} onPointerLeave={() => compare(false)}><Eye size={13} /> Mantener presionado para ver Antes</button>
    <button className="danger-action" disabled={!summary.hasSelection || busy} onClick={() => void apply()}><Eraser size={14} /> FORZAR TRANSPARENTE</button>
    <small className="microcopy">También puedes hacer clic derecho sobre el lienzo o presionar Supr. Sólo la selección pasa a alfa 0; el resto queda intacto.</small>
  </section>;
}

function BatchResidueOptions({ batch }: { batch: BatchResidueMode }) {
  const options = batch.options;
  const setOption = <K extends keyof typeof options>(key: K, value: (typeof options)[K]) => batch.onChange({ ...options, [key]: value });
  return <fieldset className="batch-stage-fields" disabled={batch.running || !batch.enabled}>
    <section className="residue-cleanup">
      <div className="section-title"><span>LIMPIEZA AUTOMÁTICA DE RESIDUOS</span><Trash2 size={14} /></div>
      <p className="microcopy">La misma detección se aplicará automáticamente a cada imagen y la selección encontrada pasará a alfa 0.</p>
      <div className="residue-options">
        <Check label="Partículas aisladas" checked={options.isolatedParticles} onChange={(value) => setOption("isolatedParticles", value)} />
        <Check label="Fragmentos débiles conectados al borde" checked={options.weakEdgeFragments} onChange={(value) => setOption("weakEdgeFragments", value)} />
        <Check label="Restos exteriores del contorno" checked={options.exteriorContourRemains} onChange={(value) => setOption("exteriorContourRemains", value)} />
        <Check label="Incluir zonas protegidas seleccionadas" checked={options.includeProtectedSelected} onChange={(value) => setOption("includeProtectedSelected", value)} />
      </div>
      <div className="residue-parameters">
        <NumberField label="Tamaño máximo de región" value={options.maxRegionSize} min={1} max={250000} onChange={(value) => setOption("maxRegionSize", value)} />
        <NumberField label="Distancia máxima al diseño" value={options.maxDistance} min={0} max={2048} onChange={(value) => setOption("maxDistance", value)} />
        <NumberField label="Grosor mínimo de conexión" value={options.minimumConnectionThickness} min={1} max={32} onChange={(value) => setOption("minimumConnectionThickness", value)} />
        <label className="field-label">Sensibilidad del contorno: {options.contourSensitivity}<input type="range" min="1" max="100" value={options.contourSensitivity} onChange={(event) => setOption("contourSensitivity", Number(event.target.value))} /></label>
      </div>
      {!batch.enabled && <p className="batch-stage-off">Esta etapa está excluida del procesamiento automático.</p>}
    </section>
  </fieldset>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="compact-number"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /></label>;
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
