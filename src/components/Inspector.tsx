import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Eye, Layers3, LoaderCircle, ScanSearch } from "lucide-react";
import { analyzeDocument, applyTreatment, estimateTreatment, getDocumentPreview } from "../lib/alphaService";
import { useStudioStore } from "../stores/studioStore";
import type { AlphaTreatment, PreviewMode, TreatmentImpact } from "../types/alpha";
import type { ModuleId } from "../types/document";

const tabs: Array<[ModuleId, string]> = [["background", "Quitar fondo"], ["transparency", "Transparencias"], ["separation", "Separar"]];
const number = new Intl.NumberFormat("es-AR");

export function Inspector() {
  const activeModule = useStudioStore((state) => state.activeModule);
  const setModule = useStudioStore((state) => state.setModule);
  return (
    <aside className="inspector">
      <div className="module-tabs" role="tablist" aria-label="Módulos">
        {tabs.map(([id, label]) => <button role="tab" aria-selected={activeModule === id} className={activeModule === id ? "active" : ""} onClick={() => setModule(id)} key={id}>{label}</button>)}
      </div>
      {activeModule === "transparency" && <TransparencyInspector />}
      {activeModule === "background" && <ModulePlaceholder icon={<CircleCheck size={24} />} title="Quitar fondo" text="Primero manual y varita. La IA se habilita sólo después de cerrar Transparencias." />}
      {activeModule === "separation" && <ModulePlaceholder icon={<Layers3 size={24} />} title="Separar elementos" text="SAM, capas y exportación individual se implementan al final para proteger estabilidad y memoria." />}
    </aside>
  );
}

function TransparencyInspector() {
  const document = useStudioStore((state) => state.document);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const status = useStudioStore((state) => state.alphaStatus);
  const error = useStudioStore((state) => state.alphaError);
  const regionIndex = useStudioStore((state) => state.alphaRegionIndex);
  const previewMode = useStudioStore((state) => state.previewMode);
  const setAnalysis = useStudioStore((state) => state.setAlphaAnalysis);
  const setStatus = useStudioStore((state) => state.setAlphaStatus);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const setPreviewMode = useStudioStore((state) => state.setPreviewMode);
  const setRegionIndex = useStudioStore((state) => state.setRegionIndex);
  const focusRect = useStudioStore((state) => state.focusRect);
  const pushHistory = useStudioStore((state) => state.pushHistory);
  const setNotification = useStudioStore((state) => state.setNotification);
  const [action, setAction] = useState<"threshold" | "make_transparent" | "make_opaque">("threshold");
  const [thresholdPercent, setThresholdPercent] = useState(50);
  const [radius, setRadius] = useState(8);
  const [pending, setPending] = useState<{ impact: TreatmentImpact; treatment: AlphaTreatment } | null>(null);

  const treatment = useMemo<AlphaTreatment>(() => {
    if (action === "make_transparent") return { action };
    if (action === "make_opaque") return { action, reconstructRadius: radius };
    const maxAlpha = analysis?.maxAlpha ?? (document?.bitDepth === 16 ? 65535 : 255);
    return { action, threshold: Math.round(maxAlpha * thresholdPercent / 100), reconstructRadius: radius };
  }, [action, analysis?.maxAlpha, document?.bitDepth, radius, thresholdPercent]);

  const analyze = async () => {
    if (!document) return;
    setStatus("analyzing");
    try {
      const result = await analyzeDocument(document);
      setAnalysis(result);
      setStatus("complete");
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const changePreview = async (mode: PreviewMode, force = true) => {
    if (!document || (!force && mode === previewMode)) return;
    try {
      const blob = mode === "original" ? document.sourceFile : await getDocumentPreview(document.id, mode);
      updateDocument({ renderBlob: blob, renderRevision: document.renderRevision + 1 });
      setPreviewMode(mode);
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const simulate = async () => {
    if (!document || !analysis) return;
    setStatus("applying");
    try {
      const impact = await estimateTreatment(document, treatment);
      setPending({ impact, treatment });
      setStatus("complete");
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const confirmTreatment = async () => {
    if (!document || !pending) return;
    setStatus("applying");
    try {
      const result = await applyTreatment(document, pending.treatment);
      const blob = previewMode === "original" ? document.sourceFile : await getDocumentPreview(document.id, previewMode);
      updateDocument({ revision: result.revision, dirty: true, renderBlob: blob, renderRevision: document.renderRevision + 1 });
      setAnalysis(result.analysis);
      pushHistory(labelFor(pending.treatment));
      setPending(null);
      setStatus("complete");
      setNotification({
        kind: result.analysis.verifiedSolidAlpha ? "success" : "error",
        text: result.analysis.verifiedSolidAlpha
          ? "Tratamiento terminado: cero píxeles semitransparentes."
          : `El tratamiento terminó, pero quedan ${number.format(result.analysis.partialAlphaPixels)} píxeles parciales.`,
      });
    } catch (reason) {
      setStatus("error", messageOf(reason));
    }
  };

  const navigate = (direction: -1 | 1) => {
    if (!analysis?.regions.length) return;
    const next = (regionIndex + direction + analysis.regions.length) % analysis.regions.length;
    setRegionIndex(next);
    focusRect(analysis.regions[next]);
  };

  return (
    <div className="inspector-content transparency-inspector">
      <section>
        <div className="section-title"><span>ANÁLISIS DE ALFA</span><ScanSearch size={14} /></div>
        {document ? (
          <dl className="metrics">
            <div><dt>Formato</dt><dd>{document.format} RGBA</dd></div>
            <div><dt>Dimensiones</dt><dd>{number.format(document.width)} × {number.format(document.height)}</dd></div>
            <div><dt>Profundidad</dt><dd>{analysis?.bitDepth ?? document.bitDepth} bits</dd></div>
            <div><dt>Transparentes</dt><dd>{analysis ? number.format(analysis.transparentPixels) : "—"}</dd></div>
            <div><dt>Semitransparentes</dt><dd className={analysis?.partialAlphaPixels ? "alpha-text" : "success-text"}>{analysis ? number.format(analysis.partialAlphaPixels) : "Sin analizar"}</dd></div>
            <div><dt>Opacos</dt><dd>{analysis ? number.format(analysis.opaquePixels) : "—"}</dd></div>
            <div><dt>Alfa parcial</dt><dd>{analysis?.partialAlphaMin ?? "—"} – {analysis?.partialAlphaMax ?? "—"}</dd></div>
            <div><dt>Porcentaje</dt><dd>{analysis ? `${analysis.partialAlphaPercent.toFixed(4)} %` : "—"}</dd></div>
            <div><dt>Regiones</dt><dd>{analysis ? number.format(analysis.affectedRegions) : "—"}</dd></div>
          </dl>
        ) : <p className="muted">Abrí una imagen para iniciar el análisis exacto.</p>}
        <button className="primary-action" disabled={!document || status === "analyzing" || status === "applying"} onClick={analyze}>
          {status === "analyzing" ? <><LoaderCircle className="spin" size={14} /> ANALIZANDO BUFFER ORIGINAL…</> : "ANALIZAR ALFA"}
        </button>
        {error && <p className="inline-error">{error}</p>}
      </section>

      {analysis && (
        <>
          <section>
            <div className="section-title"><span>HISTOGRAMA {analysis.bitDepth} BITS</span><ChevronRight size={14} /></div>
            <Histogram bins={analysis.histogram} />
            <div className="histogram-range"><span>0 transparente</span><span>{analysis.maxAlpha} opaco</span></div>
          </section>

          <section>
            <div className="section-title"><span>VISTA DE REVISIÓN</span><Eye size={14} /></div>
            <div className="segmented preview-modes">
              {([['original', 'Original'], ['result', 'Resultado'], ['partial_overlay', 'Magenta'], ['alpha', 'Canal alfa']] as Array<[PreviewMode, string]>).map(([mode, label]) => (
                <button key={mode} className={previewMode === mode ? "active" : ""} onClick={() => changePreview(mode)}>{label}</button>
              ))}
            </div>
            <div className="region-nav">
              <button disabled={!analysis.regions.length} onClick={() => navigate(-1)} title="Zona anterior"><ChevronLeft size={15} /></button>
              <span>{analysis.regions.length ? `Zona ${regionIndex + 1} de ${analysis.regions.length}` : "Sin zonas problemáticas"}</span>
              <button disabled={!analysis.regions.length} onClick={() => navigate(1)} title="Zona siguiente"><ChevronRight size={15} /></button>
            </div>
          </section>

          <section>
            <div className="section-title"><span>TRATAMIENTO</span><ChevronRight size={14} /></div>
            <label className="field-label">Método
              <select value={action} onChange={(event) => { setAction(event.target.value as typeof action); setPending(null); }}>
                <option value="threshold">Umbral binario</option>
                <option value="make_transparent">Todo parcial → transparente</option>
                <option value="make_opaque">Todo parcial → opaco</option>
              </select>
            </label>
            {action === "threshold" && <label className="field-label">Umbral: {Math.round((analysis.maxAlpha * thresholdPercent) / 100)}
              <input type="range" min="1" max="99" value={thresholdPercent} onChange={(event) => { setThresholdPercent(Number(event.target.value)); setPending(null); }} />
            </label>}
            {action !== "make_transparent" && <label className="field-label">Reconstrucción de borde: {radius} px
              <input type="range" min="1" max="32" value={radius} onChange={(event) => { setRadius(Number(event.target.value)); setPending(null); }} />
            </label>}
            {!pending ? (
              <button className="danger-action" disabled={!analysis.partialAlphaPixels || status === "applying"} onClick={simulate}>ELIMINAR TODAS LAS SEMITRANSPARENCIAS</button>
            ) : (
              <div className="treatment-confirmation">
                <b>Resumen antes de aplicar</b>
                <span>{number.format(pending.impact.willModifyPixels)} píxeles cambiarán</span>
                <span>{number.format(pending.impact.willBecomeTransparent)} → transparentes</span>
                <span>{number.format(pending.impact.willBecomeOpaque)} → opacos</span>
                <small>La operación se registra y puede deshacerse.</small>
                <div><button disabled={status === "applying"} onClick={() => setPending(null)}>Cancelar</button><button disabled={status === "applying"} className="confirm" onClick={confirmTreatment}>{status === "applying" ? <><LoaderCircle className="spin" size={13} /> Procesando…</> : "Aplicar"}</button></div>
              </div>
            )}
          </section>

          <section className="quality-gates">
            <div className={analysis.verifiedSolidAlpha ? "verified" : "pending"}>
              {analysis.verifiedSolidAlpha ? <CircleCheck size={15} /> : <AlertTriangle size={15} />}
              <span>Verificación técnica</span><b>{analysis.verifiedSolidAlpha ? "0 parciales" : `${number.format(analysis.partialAlphaPixels)} pendientes`}</b>
            </div>
            <div className="pending"><AlertTriangle size={15} /><span>Revisión visual de bordes</span><b>Pendiente</b></div>
          </section>
        </>
      )}
    </div>
  );
}

function Histogram({ bins }: { bins: Array<{ count: number }> }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  const path = bins.map((bin, index) => {
    const x = bins.length === 1 ? 0 : index / (bins.length - 1) * 256;
    const y = 62 - Math.log1p(bin.count) / Math.log1p(max) * 58;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return <svg className="alpha-histogram" viewBox="0 0 256 64" preserveAspectRatio="none" aria-label="Histograma de alfa"><path d={path} /></svg>;
}

function ModulePlaceholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="module-placeholder">{icon}<h2>{title}</h2><p>{text}</p><span>Etapa posterior</span></div>;
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
function labelFor(treatment: AlphaTreatment) {
  if (treatment.action === "threshold") return "Aplicar umbral binario de alfa";
  return treatment.action === "make_opaque" ? "Volver alfa parcial opaco" : "Volver alfa parcial transparente";
}
