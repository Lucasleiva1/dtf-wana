import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Clock3, Eye, Layers3,
  LoaderCircle, MemoryStick, Pause, ScanSearch, ShieldCheck, Sparkles, Trash2, WandSparkles, X,
} from "lucide-react";
import { getDocumentPreview } from "../lib/alphaService";
import { cancelJob, runAnalysisJob, runPreviewJob, runTreatmentJob } from "../lib/jobService";
import {
  defaultInspectorZoneLayout, normalizeInspectorZoneLayout, placeInspectorZone,
  type DropPosition, type InspectorZoneId, type InspectorZoneLayout,
} from "../lib/inspectorLayout";
import { useStudioStore } from "../stores/studioStore";
import type {
  AlphaTreatment, JobSnapshot, PreviewMode, ProtectionOptions, ReconstructionMode,
  RiskLevel, TreatmentImpact,
} from "../types/alpha";
import type { ModuleId } from "../types/document";
import { InspectorZone } from "./InspectorZone";
import { ResidueCleanup } from "./ResidueCleanup";
import { EdgePolish } from "./EdgePolish";
import { BatchSetupPanel, type BatchController } from "./BatchPanel";

const tabs: Array<[ModuleId, string]> = [["background", "Quitar fondo"], ["transparency", "Transparencias"], ["separation", "Separar"]];
const number = new Intl.NumberFormat("es-AR");
const inspectorLayoutStorageKey = "dtf-pro-studio.inspector-layout.v1";
interface ZoneDragState {
  source: InspectorZoneId;
  target: InspectorZoneId;
  position: DropPosition;
  x: number;
  y: number;
}
const defaultProtections: ProtectionOptions = {
  protectConnectedTexture: true,
  protectFineLines: true,
  protectGrunge: true,
  onlyIsolatedParticles: false,
  preservedRegionIds: [],
};

export function Inspector({ batchMode = false, batch, onExitBatch }: { batchMode?: boolean; batch?: BatchController; onExitBatch?: () => void }) {
  const activeModule = useStudioStore((state) => state.activeModule);
  const setModule = useStudioStore((state) => state.setModule);
  return (
    <aside className="inspector">
      <div className="module-tabs" role="tablist" aria-label="Módulos">
        {tabs.map(([id, label]) => <button role="tab" disabled={batchMode && id !== "transparency"} aria-selected={activeModule === id} className={activeModule === id ? "active" : ""} onClick={() => setModule(id)} key={id}>{label}</button>)}
      </div>
      {activeModule === "transparency" && <TransparencyInspector batch={batchMode ? batch : undefined} onExitBatch={onExitBatch} />}
      {activeModule === "background" && <ModulePlaceholder icon={<CircleCheck size={24} />} title="Quitar fondo" text="Primero manual y varita. La IA se habilita sólo después de cerrar Transparencias." />}
      {activeModule === "separation" && <ModulePlaceholder icon={<Layers3 size={24} />} title="Separar elementos" text="SAM, capas y exportación individual se implementan al final para proteger estabilidad y memoria." />}
    </aside>
  );
}

function TransparencyInspector({ batch, onExitBatch }: { batch?: BatchController; onExitBatch?: () => void }) {
  const document = useStudioStore((state) => state.document);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const error = useStudioStore((state) => state.alphaError);
  const regionIndex = useStudioStore((state) => state.alphaRegionIndex);
  const previewMode = useStudioStore((state) => state.previewMode);
  const activeJob = useStudioStore((state) => state.activeJob);
  const flow = useStudioStore((state) => state.transparencyFlow);
  const setAnalysis = useStudioStore((state) => state.setAlphaAnalysis);
  const setStatus = useStudioStore((state) => state.setAlphaStatus);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const setPreviewMode = useStudioStore((state) => state.setPreviewMode);
  const setRegionIndex = useStudioStore((state) => state.setRegionIndex);
  const focusRect = useStudioStore((state) => state.focusRect);
  const pushHistory = useStudioStore((state) => state.pushHistory);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const setFlow = useStudioStore((state) => state.setTransparencyFlow);
  const setVisualReviewComplete = useStudioStore((state) => state.setVisualReviewComplete);
  const residueMask = useStudioStore((state) => state.residueMask);

  const [threshold, setThreshold] = useState(128);
  const [radius, setRadius] = useState(2);
  const [reconstructionMode, setReconstructionMode] = useState<ReconstructionMode>("automatic");
  const [protections, setProtections] = useState(defaultProtections);
  const [impact, setImpact] = useState<TreatmentImpact | null>(null);
  const [impactBlob, setImpactBlob] = useState<ImageBitmap | null>(null);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [visualReviewed, setVisualReviewed] = useState(false);
  const [zoneLayout, setZoneLayout] = useState<InspectorZoneLayout>(() => {
    try {
      const saved = window.localStorage.getItem(inspectorLayoutStorageKey);
      return saved ? normalizeInspectorZoneLayout(JSON.parse(saved)) : structuredClone(defaultInspectorZoneLayout);
    } catch {
      return structuredClone(defaultInspectorZoneLayout);
    }
  });
  const previewSequence = useRef(0);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const zoneDragRef = useRef<ZoneDragState | null>(null);

  useEffect(() => {
    window.localStorage.setItem(inspectorLayoutStorageKey, JSON.stringify(zoneLayout));
  }, [zoneLayout]);

  const recommendation = analysis?.recommendation ?? null;
  const treatment = useMemo<AlphaTreatment>(() => ({
    action: "threshold",
    threshold,
    reconstructRadius: radius,
    reconstructionMode,
    protections,
  }), [protections, radius, reconstructionMode, threshold]);

  useEffect(() => {
    if (!previewDirty || !analysis?.partialAlphaPixels || !document) return;
    const timer = window.setTimeout(() => void previewImpact(), 280);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, radius, reconstructionMode, protections, previewDirty]);

  const analyze = async () => {
    if (!document) return;
    setStatus("analyzing");
    setFlow("analyzing");
    setImpact(null);
    setImpactBlob(null);
    try {
      const result = await runAnalysisJob(document, (job) => setActiveJob(job));
      setAnalysis(result);
      setStatus("complete");
      setFlow(result.partialAlphaPixels ? "recommendation_available" : "technical_result");
      if (result.recommendation) {
        setThreshold(result.recommendation.recommendedThreshold);
        setRadius(result.recommendation.recommendedRadius);
      }
    } catch (reason) {
      setStatus("error", messageOf(reason));
      setFlow("unprocessed");
    }
  };

  const previewImpact = async () => {
    if (!document || !analysis?.partialAlphaPixels) return;
    const sequence = ++previewSequence.current;
    const runningJob = useStudioStore.getState().activeJob;
    if (runningJob?.operation === "alpha_preview" && (runningJob.status === "queued" || runningJob.status === "running")) {
      await cancelJob(runningJob.id);
    }
    setPreviewDirty(false);
    setStatus("applying");
    setFlow("previewing");
    try {
      const result = await runPreviewJob(document, treatment, (job) => setActiveJob(job));
      if (sequence !== previewSequence.current) return;
      setImpact(result.impact);
      setImpactBlob(result.bitmap);
      updateDocument({ renderBlob: result.bitmap, renderRevision: document.renderRevision + 1 });
      setPreviewMode("impact_overlay");
      setStatus("complete");
      setFlow("preview_ready");
    } catch (reason) {
      if (sequence !== previewSequence.current) return;
      setStatus("error", messageOf(reason));
    }
  };

  const confirmTreatment = async () => {
    if (!document || !impact) return;
    setStatus("applying");
    setFlow("applying");
    try {
      const result = await runTreatmentJob(document, treatment, (job) => {
        setActiveJob(job);
        if (job.stageIndex >= 5) setFlow("verifying");
      });
      const blob = await getDocumentPreview(document, "result");
      updateDocument({ revision: result.revision, dirty: true, renderBlob: blob, renderRevision: document.renderRevision + 1 });
      setAnalysis(result.analysis);
      setVisualReviewComplete(false);
      setPreviewMode("result");
      pushHistory("Eliminar semitransparencias con protección de detalle");
      setImpact(null);
      setImpactBlob(null);
      setStatus("complete");
      setFlow(result.analysis.verifiedSolidAlpha ? "technical_result" : "recommendation_available");
      setNotification({
        kind: result.analysis.verifiedSolidAlpha ? "success" : "error",
        text: result.analysis.verifiedSolidAlpha
          ? "Verificación técnica finalizada: cero semitransparencias."
          : `Quedan ${number.format(result.analysis.partialAlphaPixels)} píxeles parciales. Revisá el modo de partículas aisladas.`,
      });
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const changePreview = async (mode: PreviewMode) => {
    if (!document) return;
    try {
      const blob = mode === "original"
        ? document.sourceFile
        : mode === "impact_overlay" && impactBlob
          ? impactBlob
          : await getDocumentPreview(document, mode === "impact_overlay" ? "result" : mode);
      updateDocument({ renderBlob: blob, renderRevision: document.renderRevision + 1 });
      setPreviewMode(mode);
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const compare = (showOriginal: boolean) => {
    if (!document || !impactBlob) return;
    updateDocument({ renderBlob: showOriginal ? document.sourceFile : impactBlob, renderRevision: document.renderRevision + 1 });
  };

  const navigate = (direction: -1 | 1) => {
    if (!analysis?.regions.length) return;
    const next = (regionIndex + direction + analysis.regions.length) % analysis.regions.length;
    setRegionIndex(next);
    focusRect(analysis.regions[next]);
  };

  const usePreset = (value: number) => {
    setThreshold(value);
    setPreviewDirty(true);
    setImpact(null);
  };

  const setProtection = (key: keyof Omit<ProtectionOptions, "preservedRegionIds">, value: boolean) => {
    setProtections((current) => ({ ...current, [key]: value }));
    setPreviewDirty(true);
    setImpact(null);
  };

  const preserveCurrentRegion = () => {
    const region = analysis?.regions[regionIndex];
    if (!region) return;
    setProtections((current) => ({
      ...current,
      preservedRegionIds: current.preservedRegionIds.includes(region.id)
        ? current.preservedRegionIds.filter((id) => id !== region.id)
        : [...current.preservedRegionIds, region.id],
    }));
    setPreviewDirty(true);
    setImpact(null);
  };

  const recommendationPosition = recommendation ? recommendation.recommendedThreshold / analysis!.maxAlpha * 100 : 50;
  const safeStart = recommendation ? recommendation.safeMin / analysis!.maxAlpha * 100 : 40;
  const safeEnd = recommendation ? recommendation.safeMax / analysis!.maxAlpha * 100 : 60;
  const busy = activeJob?.status === "queued" || activeJob?.status === "running";

  const toggleZone = (id: InspectorZoneId) => setZoneLayout((current) => ({
    ...current,
    collapsed: { ...current.collapsed, [id]: !current.collapsed[id] },
  }));

  const locateZoneDrop = (y: number) => {
    const zones = Array.from(window.document.querySelectorAll<HTMLElement>(".inspector-zone"))
      .map((zone) => {
        const id = zone.dataset.zoneId as InspectorZoneId | undefined;
        const header = zone.querySelector<HTMLElement>(".inspector-zone-header");
        return id && header ? { id, rect: header.getBoundingClientRect() } : null;
      })
      .filter((zone): zone is { id: InspectorZoneId; rect: DOMRect } => zone !== null);
    if (!zones.length) return null;
    const nearest = zones.reduce((best, zone) => Math.abs(y - (zone.rect.top + zone.rect.height / 2)) < Math.abs(y - (best.rect.top + best.rect.height / 2)) ? zone : best);
    return { target: nearest.id, position: (y < nearest.rect.top + nearest.rect.height / 2 ? "before" : "after") as DropPosition };
  };

  const startZoneDrag = (source: InspectorZoneId, x: number, y: number) => {
    const location = locateZoneDrop(y) ?? { target: source, position: "after" as DropPosition };
    const next = { source, ...location, x, y };
    zoneDragRef.current = next;
    setZoneDrag(next);
  };

  const moveZoneDrag = (x: number, y: number) => {
    const current = zoneDragRef.current;
    const location = locateZoneDrop(y);
    if (!current || !location) return;
    const next = { ...current, ...location, x, y };
    zoneDragRef.current = next;
    setZoneDrag(next);
  };

  const finishZoneDrag = (commit: boolean) => {
    const current = zoneDragRef.current;
    zoneDragRef.current = null;
    setZoneDrag(null);
    if (!commit || !current) return;
    setZoneLayout((layout) => ({ ...layout, order: placeInspectorZone(layout.order, current.source, current.target, current.position) }));
  };

  const unprotectCurrentRegion = () => {
    const region = analysis?.regions[regionIndex];
    if (!region) return;
    setProtections((current) => ({ ...current, preservedRegionIds: current.preservedRegionIds.filter((id) => id !== region.id) }));
    setNotification({ kind: "info", text: "La protección manual de la región fue retirada. Una selección manual puede eliminarla." });
  };

  const alphaSummary = !document
    ? "Sin imagen"
    : !analysis
      ? "Sin analizar"
      : analysis.partialAlphaPixels
        ? `${number.format(analysis.partialAlphaPixels)} semitransparencias`
        : "Cero semitransparencias";
  const residueSummary = residueMask.hasSelection
    ? `${number.format(residueMask.selectedPixels)} px seleccionados`
    : analysis
      ? "Máscara temporal sin aplicar"
      : "Disponible después del análisis";
  const polishSummary = !analysis
    ? "Bloqueado hasta verificar"
    : analysis.verifiedSolidAlpha
      ? "Opcional · alfa 0/255 verificado"
      : `${number.format(analysis.partialAlphaPixels)} semitransparencias pendientes`;
  const zoneMeta: Record<InspectorZoneId, { title: string; summary: string; icon: React.ReactNode }> = {
    alpha: { title: "Tratamiento de transparencias", summary: batch ? (batch.config.alphaEnabled ? `Incluido · umbral ${batch.config.alpha.thresholdPercent}%` : "Excluido del lote") : alphaSummary, icon: <ScanSearch size={15} /> },
    residue: { title: "Limpieza de residuos", summary: batch ? (batch.config.residueEnabled ? "Incluida en el lote" : "Excluida del lote") : residueSummary, icon: <Trash2 size={15} /> },
    polish: { title: "Pulido de borde", summary: batch ? (batch.config.polishEnabled ? "Incluido en el lote" : "Excluido del lote") : polishSummary, icon: <WandSparkles size={15} /> },
  };

  return (
    <div className="inspector-content transparency-inspector">
      <div className={`inspector-zone-stack${zoneDrag ? " is-reordering" : ""}`}>
        {batch && <BatchSetupPanel batch={batch} onClose={onExitBatch ?? (() => undefined)} />}
        {zoneDrag && <div className="zone-drag-ghost" style={{ left: zoneDrag.x + 10, top: zoneDrag.y + 10 }}>{zoneMeta[zoneDrag.source].title}</div>}
        {zoneLayout.order.map((zoneId) => <InspectorZone
          key={zoneId}
          id={zoneId}
          title={zoneMeta[zoneId].title}
          summary={zoneMeta[zoneId].summary}
          icon={zoneMeta[zoneId].icon}
          collapsed={zoneLayout.collapsed[zoneId]}
          dragging={zoneDrag?.source === zoneId}
          dropPosition={zoneDrag?.target === zoneId ? zoneDrag.position : null}
          onToggle={() => toggleZone(zoneId)}
          onDragStart={startZoneDrag}
          onDragMove={moveZoneDrag}
          onDragEnd={finishZoneDrag}
          batchEnabled={batch ? zoneId === "alpha" ? batch.config.alphaEnabled : zoneId === "residue" ? batch.config.residueEnabled : batch.config.polishEnabled : undefined}
          batchRunning={batch?.running}
          onBatchEnabledChange={batch ? (enabled) => batch.setConfig(zoneId === "alpha"
            ? { ...batch.config, alphaEnabled: enabled }
            : zoneId === "residue"
              ? { ...batch.config, residueEnabled: enabled }
              : { ...batch.config, polishEnabled: enabled }) : undefined}
        >
          {batch ? zoneId === "alpha" ? <BatchAlphaOptions batch={batch} /> : zoneId === "residue" ? <ResidueCleanup
            protectedRegionIds={[]}
            onUnprotectCurrent={() => undefined}
            batch={{ enabled: batch.config.residueEnabled, running: batch.running, options: batch.config.residue, onChange: (options) => batch.setConfig({ ...batch.config, residue: options }) }}
          /> : <EdgePolish batch={{ enabled: batch.config.polishEnabled, running: batch.running, options: batch.config.polish, onChange: (options) => batch.setConfig({ ...batch.config, polish: options }) }} /> : zoneId === "alpha" ? <>
      <FlowStatus flow={flow} />

      <section>
        <div className="section-title"><span>ANÁLISIS DE TRANSPARENCIA</span><ScanSearch size={14} /></div>
        {document ? <dl className="metrics compact">
          <div><dt>Imagen</dt><dd>{number.format(document.width)} × {number.format(document.height)}</dd></div>
          <div><dt>Semitransparentes</dt><dd className={analysis?.partialAlphaPixels ? "alpha-text" : "success-text"}>{analysis ? number.format(analysis.partialAlphaPixels) : "Sin analizar"}</dd></div>
          <div><dt>Zonas</dt><dd>{analysis ? number.format(analysis.affectedRegions) : "—"}</dd></div>
          <div><dt>Profundidad</dt><dd>{analysis?.bitDepth ?? document.bitDepth} bits</dd></div>
        </dl> : <p className="muted">Abrí una imagen para comenzar.</p>}
        <button className="primary-action" disabled={!document || busy} onClick={analyze}>
          {flow === "analyzing" ? <><LoaderCircle className="spin" size={14} /> ANALIZANDO…</> : "ANALIZAR ALFA"}
        </button>
        {error && <p className="inline-error">{error}</p>}
      </section>

      {analysis && <section>
        <div className="section-title"><span>HISTOGRAMA ALFA · {analysis.bitDepth} BITS</span><ChevronRight size={14} /></div>
        <Histogram bins={analysis.histogram} />
        <div className="histogram-range"><span>Transparente</span><span>Opaco</span></div>
      </section>}

      {analysis?.verifiedSolidAlpha && <ZeroAlphaState visualReviewed={visualReviewed} onReviewed={(checked) => {
        setVisualReviewed(checked);
        setVisualReviewComplete(checked);
        setFlow(checked ? "ready_to_export" : "visual_review");
      }} onView={(mode) => void changePreview(mode)} />}

      {analysis && !analysis.verifiedSolidAlpha && recommendation && <>
        <section className="recommendation-card">
          <div className="section-title"><span>RECOMENDACIÓN</span><Sparkles size={14} /></div>
          <div className="recommendation-head"><strong>{recommendation.recommendedThreshold}</strong><RiskBadge risk={recommendation.risk} /></div>
          <p>{recommendation.explanation}</p>
          <dl className="impact-grid">
            <div><dt>Rango seguro</dt><dd>{recommendation.safeMin}–{recommendation.safeMax}</dd></div>
            <div><dt>Borde afectado</dt><dd>{recommendation.edgeAffectedPercent.toFixed(1)} %</dd></div>
            <div><dt>Detalle fino</dt><dd>{number.format(recommendation.fineDetailPixels)} px</dd></div>
            <div><dt>Radio automático</dt><dd>{recommendation.recommendedRadius} px</dd></div>
            <div className="red"><dt>Serán transparentes</dt><dd>{number.format(recommendation.estimatedTransparent)}</dd></div>
            <div className="cyan"><dt>Serán opacos</dt><dd>{number.format(recommendation.estimatedOpaque)}</dd></div>
          </dl>
          <div className="preset-buttons">
            {[recommendation.conservative, recommendation.balanced, recommendation.aggressive].map((preset) => (
              <button key={preset.name} className={threshold === preset.threshold ? "active" : ""} title={preset.description} onClick={() => usePreset(preset.threshold)}>{preset.name}<b>{preset.threshold}</b></button>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title"><span>¿QUÉ SE CONSERVA?</span><ShieldCheck size={14} /></div>
          <div className="threshold-explanation"><span>Se vuelve transparente</span><span>Se vuelve opaco</span></div>
          <div className="threshold-control" style={{ "--recommendation": `${recommendationPosition}%`, "--safe-start": `${safeStart}%`, "--safe-end": `${safeEnd}%` } as React.CSSProperties}>
            <div className="risk-track"><i /><b /></div>
            <input aria-label="Umbral de transparencia" type="range" min="1" max={analysis.maxAlpha - 1} value={threshold} onChange={(event) => { setThreshold(Number(event.target.value)); setPreviewDirty(true); setImpact(null); }} />
          </div>
          <label className="numeric-threshold">Valor editable<input type="number" min="1" max={analysis.maxAlpha - 1} value={threshold} onChange={(event) => { setThreshold(Math.max(1, Math.min(analysis.maxAlpha - 1, Number(event.target.value)))); setPreviewDirty(true); setImpact(null); }} /></label>
          <small className="microcopy">Menor valor conserva más detalle. Mayor valor elimina más borde tenue.</small>
        </section>

        <section>
          <div className="section-title"><span>PROTECCIÓN DE DETALLES</span><ShieldCheck size={14} /></div>
          <Check label="Proteger textura conectada" checked={protections.protectConnectedTexture} onChange={(value) => setProtection("protectConnectedTexture", value)} />
          <Check label="Proteger líneas finas" checked={protections.protectFineLines} onChange={(value) => setProtection("protectFineLines", value)} />
          <Check label="Proteger grunge" checked={protections.protectGrunge} onChange={(value) => setProtection("protectGrunge", value)} />
          <Check label="Eliminar solamente partículas aisladas" checked={protections.onlyIsolatedParticles} onChange={(value) => setProtection("onlyIsolatedParticles", value)} />
          <div className="region-nav">
            <button onClick={() => navigate(-1)}><ChevronLeft size={15} /></button>
            <span>Zona {regionIndex + 1} de {analysis.regions.length}</span>
            <button onClick={() => navigate(1)}><ChevronRight size={15} /></button>
          </div>
          <button className="secondary-action" onClick={preserveCurrentRegion}>{protections.preservedRegionIds.includes(analysis.regions[regionIndex]?.id) ? "Dejar de conservar esta zona" : "Conservar esta zona manualmente"}</button>
          {protections.preservedRegionIds.length > 0 && <small className="microcopy">{protections.preservedRegionIds.length} regiones marcadas para conservar.</small>}
        </section>

        <section>
          <div className="section-title"><span>RECONSTRUCCIÓN DE BORDES</span><ChevronRight size={14} /></div>
          <div className="segmented reconstruction-modes">
            <button className={reconstructionMode === "automatic" ? "active" : ""} onClick={() => { setReconstructionMode("automatic"); setPreviewDirty(true); }}>Automático</button>
            <button className={reconstructionMode === "manual" ? "active" : ""} onClick={() => { setReconstructionMode("manual"); setPreviewDirty(true); }}>Manual</button>
          </div>
          {reconstructionMode === "automatic" ? <p className="microcopy">Radio adaptativo estimado: <b>{recommendation.recommendedRadius} px</b>. Se limita para evitar halos.</p> : <label className="field-label">Radio manual: {radius} px<input type="range" min="1" max="16" value={radius} onChange={(event) => { setRadius(Number(event.target.value)); setPreviewDirty(true); setImpact(null); }} /></label>}
          <p className="microcopy">Riesgo de contaminación: <RiskBadge risk={impact?.contaminationRisk ?? recommendation.contaminationRisk} /></p>
        </section>

        <section>
          <div className="section-title"><span>PREVISUALIZACIÓN DE IMPACTO</span><Eye size={14} /></div>
          <div className="impact-legend"><span className="red">Transparente</span><span className="cyan">Opaco</span><span className="magenta">Protegido/pendiente</span></div>
          <div className="segmented preview-modes">
            <button className={previewMode === "original" ? "active" : ""} onClick={() => void changePreview("original")}>Antes</button>
            <button className={previewMode === "impact_overlay" ? "active" : ""} disabled={!impactBlob} onClick={() => void changePreview("impact_overlay")}>Impacto</button>
            <button className={previewMode === "result" ? "active" : ""} onClick={() => void changePreview("result")}>Resultado</button>
            <button className={previewMode === "alpha" ? "active" : ""} onClick={() => void changePreview("alpha")}>Canal alfa</button>
          </div>
          <button className="primary-action" disabled={busy} onClick={() => void previewImpact()}>PREVISUALIZAR RESULTADO</button>
          <button className="hold-compare" disabled={!impactBlob} onPointerDown={() => compare(true)} onPointerUp={() => compare(false)} onPointerLeave={() => compare(false)}><Pause size={13} /> Mantener presionado para ver Antes</button>
          {impact && <dl className="impact-summary">
            <div className="red"><dt>Desaparecerán</dt><dd>{number.format(impact.willBecomeTransparent)}</dd></div>
            <div className="cyan"><dt>Serán opacos</dt><dd>{number.format(impact.willBecomeOpaque)}</dd></div>
            <div className="magenta"><dt>Protegidos</dt><dd>{number.format(impact.protectedPixels)}</dd></div>
            <div><dt>Borde afectado</dt><dd>{impact.edgeAffectedPercent.toFixed(1)} %</dd></div>
            <div><dt>Reconstruidos</dt><dd>{number.format(impact.reconstructedPixels)}</dd></div>
            <div><dt>Pendientes</dt><dd>{number.format(impact.pendingPixels)}</dd></div>
          </dl>}
        </section>

        <section>
          <button className="danger-action" disabled={!impact || busy} onClick={() => void confirmTreatment()}>APLICAR Y VERIFICAR CERO SEMITRANSPARENCIAS</button>
          <small className="microcopy">El documento no cambia hasta confirmar. La operación completa puede deshacerse.</small>
        </section>
      </>}
          </> : zoneId === "residue" ? analysis ? <ResidueCleanup
            protectedRegionIds={protections.preservedRegionIds}
            onUnprotectCurrent={unprotectCurrentRegion}
          /> : <section className="residue-unavailable">
            <Trash2 size={20} />
            <b>Limpieza manual preparada</b>
            <p className="microcopy">Analizá primero el canal alfa para habilitar la detección y la máscara temporal de residuos.</p>
          </section> : <EdgePolish />}
        </InspectorZone>)}
      </div>
    </div>
  );
}

function BatchAlphaOptions({ batch }: { batch: BatchController }) {
  const alpha = batch.config.alpha;
  const disabled = batch.running || !batch.config.alphaEnabled;
  const updateAlpha = (patch: Partial<typeof alpha>) => batch.setConfig({ ...batch.config, alpha: { ...alpha, ...patch } });
  const updateProtection = (key: keyof typeof alpha.protections, value: boolean) => updateAlpha({ protections: { ...alpha.protections, [key]: value } });
  return <fieldset className="batch-stage-fields" disabled={disabled}>
    <section>
      <div className="section-title"><span>UMBRAL COMÚN PARA EL LOTE</span><ScanSearch size={14} /></div>
      <label className="field-label">Umbral de transparencia: {alpha.thresholdPercent}%
        <input type="range" min="1" max="99" value={alpha.thresholdPercent} onChange={(event) => updateAlpha({ thresholdPercent: Number(event.target.value) })} />
      </label>
      <label className="numeric-threshold">Porcentaje editable<input type="number" min="1" max="99" value={alpha.thresholdPercent} onChange={(event) => updateAlpha({ thresholdPercent: Math.max(1, Math.min(99, Number(event.target.value))) })} /></label>
      <small className="microcopy">Se adapta automáticamente a imágenes alfa de 8 y 16 bits.</small>
    </section>
    <section>
      <div className="section-title"><span>PROTECCIÓN DE DETALLES</span><ShieldCheck size={14} /></div>
      <Check label="Proteger textura conectada" checked={alpha.protections.protectConnectedTexture} onChange={(value) => updateProtection("protectConnectedTexture", value)} />
      <Check label="Proteger líneas finas" checked={alpha.protections.protectFineLines} onChange={(value) => updateProtection("protectFineLines", value)} />
      <Check label="Proteger grunge" checked={alpha.protections.protectGrunge} onChange={(value) => updateProtection("protectGrunge", value)} />
      <Check label="Eliminar solamente partículas aisladas" checked={alpha.protections.onlyIsolatedParticles} onChange={(value) => updateProtection("onlyIsolatedParticles", value)} />
    </section>
    <section>
      <div className="section-title"><span>RECONSTRUCCIÓN DE BORDES</span><ChevronRight size={14} /></div>
      <div className="segmented reconstruction-modes">
        <button className={alpha.reconstructionMode === "automatic" ? "active" : ""} onClick={() => updateAlpha({ reconstructionMode: "automatic" })}>Automático</button>
        <button className={alpha.reconstructionMode === "manual" ? "active" : ""} onClick={() => updateAlpha({ reconstructionMode: "manual" })}>Manual</button>
      </div>
      {alpha.reconstructionMode === "automatic"
        ? <p className="microcopy">El radio se adapta a cada imagen del lote.</p>
        : <label className="field-label">Radio manual: {alpha.reconstructRadius} px<input type="range" min="1" max="16" value={alpha.reconstructRadius} onChange={(event) => updateAlpha({ reconstructRadius: Number(event.target.value) })} /></label>}
    </section>
    {!batch.config.alphaEnabled && <p className="batch-stage-off">Esta etapa está excluida del procesamiento automático.</p>}
  </fieldset>;
}

function FlowStatus({ flow }: { flow: string }) {
  const labels: Record<string, string> = {
    unprocessed: "Sin analizar", analyzing: "Analizando", analysis_complete: "Análisis terminado",
    recommendation_available: "Recomendación disponible", previewing: "Generando previsualización",
    preview_ready: "Previsualización lista", applying: "Aplicando", verifying: "Verificando",
    technical_result: "Resultado técnico", visual_review: "Revisión visual", ready_to_export: "Listo para exportar",
  };
  return <div className={`flow-status state-${flow}`}><i />{labels[flow] ?? flow}</div>;
}

export function JobProgress({ job, onCancel }: { job: JobSnapshot; onCancel: () => void }) {
  const seconds = (job.elapsedMs / 1000).toFixed(1);
  const memory = job.memoryBytes ? `${(job.memoryBytes / 1024 / 1024).toFixed(0)} MB` : "—";
  return <section className={`job-progress job-${job.status}`}>
    <div className="job-head"><div>{job.status === "running" || job.status === "queued" ? <LoaderCircle className="spin" size={15} /> : <CircleCheck size={15} />}<b>{job.name}</b></div>{job.cancellable && <button onClick={onCancel} title="Cancelar"><X size={15} /></button>}</div>
    <span>{job.stageIndex}/{job.totalStages} · {job.stage}</span>
    <progress max="100" value={job.percent} />
    <div className="job-stats"><span>{job.percent.toFixed(1)} %</span><span>{number.format(job.processedUnits)} / {number.format(job.totalUnits)} {job.unitLabel}</span></div>
    <div className="job-stats"><span><Clock3 size={11} /> {seconds} s</span><span><MemoryStick size={11} /> {memory}</span></div>
  </section>;
}

function ZeroAlphaState({ visualReviewed, onReviewed, onView }: { visualReviewed: boolean; onReviewed: (checked: boolean) => void; onView: (mode: PreviewMode) => void }) {
  return <>
    <section className="zero-alpha-state"><CircleCheck size={24} /><div><b>No hay semitransparencias pendientes</b><span>Verificación técnica: alfa únicamente 0 u opaco.</span></div></section>
    <section><div className="section-title"><span>REVISIÓN VISUAL</span><Eye size={14} /></div>
      <div className="segmented preview-modes"><button onClick={() => onView("original")}>Original</button><button onClick={() => onView("result")}>Resultado</button><button onClick={() => onView("alpha")}>Canal alfa</button><button onClick={() => onView("partial_overlay")}>Comprobar magenta</button></div>
      <Check label="Revisé los bordes sobre fondos claros y oscuros" checked={visualReviewed} onChange={onReviewed} />
      <div className={visualReviewed ? "ready-export" : "review-pending"}>{visualReviewed ? "Listo para exportar" : "Revisión visual pendiente"}</div>
    </section>
  </>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const labels = { low: "Riesgo bajo", medium: "Riesgo medio", high: "Riesgo alto" };
  return <span className={`risk-badge risk-${risk}`}>{labels[risk]}</span>;
}

function Histogram({ bins }: { bins: Array<{ count: number }> }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  const path = bins.map((bin, index) => {
    const x = bins.length === 1 ? 0 : index / (bins.length - 1) * 256;
    const y = 62 - Math.log1p(bin.count) / Math.log1p(max) * 58;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return <svg className="alpha-histogram" viewBox="0 0 256 64" preserveAspectRatio="none" aria-label="Histograma del canal alfa"><path d={path} /></svg>;
}

function ModulePlaceholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="module-placeholder">{icon}<h2>{title}</h2><p>{text}</p><span>Etapa posterior</span></div>;
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
