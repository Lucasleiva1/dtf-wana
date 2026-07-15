import { useEffect, useState } from "react";
import { CircleCheck, Eye, Pause, ShieldCheck, Undo2, WandSparkles } from "lucide-react";
import { getDocumentPreview } from "../lib/alphaService";
import { changePixelHistory } from "../lib/historyService";
import { runEdgePolishApplyJob, runEdgePolishPreviewJob } from "../lib/jobService";
import { useStudioStore } from "../stores/studioStore";
import type { EdgePolishImpact, EdgePolishMethod, EdgePolishOptions } from "../types/alpha";

const number = new Intl.NumberFormat("es-AR");

const initialOptions: EdgePolishOptions = {
  intensity: "soft",
  radius: 1,
  method: "binary_smoothing",
  protectFineDetail: true,
  protectConnectedTexture: true,
};

export function EdgePolish() {
  const document = useStudioStore((state) => state.document);
  const analysis = useStudioStore((state) => state.alphaAnalysis);
  const activeJob = useStudioStore((state) => state.activeJob);
  const lastHistoryEntry = useStudioStore((state) => state.history.at(-1));
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const setAnalysis = useStudioStore((state) => state.setAlphaAnalysis);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const setStatus = useStudioStore((state) => state.setAlphaStatus);
  const setFlow = useStudioStore((state) => state.setTransparencyFlow);
  const setPreviewMode = useStudioStore((state) => state.setPreviewMode);
  const setNotification = useStudioStore((state) => state.setNotification);
  const setVisualReviewComplete = useStudioStore((state) => state.setVisualReviewComplete);
  const pushHistory = useStudioStore((state) => state.pushHistory);
  const [options, setOptions] = useState(initialOptions);
  const [impact, setImpact] = useState<EdgePolishImpact | null>(null);
  const [preview, setPreview] = useState<ImageBitmap | null>(null);
  const [before, setBefore] = useState<ImageBitmap | null>(null);

  const enabled = Boolean(document && analysis?.verifiedSolidAlpha);
  const busy = activeJob?.status === "queued" || activeJob?.status === "running";

  useEffect(() => () => {
    preview?.close();
    before?.close();
  }, [preview, before]);

  const setOption = <K extends keyof EdgePolishOptions>(key: K, value: EdgePolishOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setImpact(null);
    if (preview && document) {
      void getDocumentPreview(document, "result").then((bitmap) => {
        updateDocument({ renderBlob: bitmap, renderRevision: document.renderRevision + 1 });
        setPreviewMode("result");
      });
    }
  };

  const previewPolish = async () => {
    if (!document || !enabled) return;
    setStatus("applying");
    try {
      const current = await getDocumentPreview(document, "result");
      const result = await runEdgePolishPreviewJob(document, options, (job) => setActiveJob(job));
      before?.close();
      preview?.close();
      setBefore(current);
      setPreview(result.bitmap);
      setImpact(result.impact);
      updateDocument({ renderBlob: result.bitmap, renderRevision: document.renderRevision + 1 });
      setPreviewMode("edge_polish_preview");
      setStatus("complete");
    } catch (reason) {
      setStatus("error", messageOf(reason));
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };

  const applyPolish = async () => {
    if (!document || !enabled || !impact) return;
    setStatus("applying");
    setFlow("applying");
    try {
      const result = await runEdgePolishApplyJob(document, options, (job) => {
        setActiveJob(job);
        if (job.stageIndex >= 5) setFlow("verifying");
      });
      const bitmap = await getDocumentPreview(document, "result");
      updateDocument({ revision: result.revision, dirty: true, renderBlob: bitmap, renderRevision: document.renderRevision + 1 });
      setAnalysis(result.analysis);
      setPreviewMode("result");
      setVisualReviewComplete(false);
      setFlow("technical_result");
      pushHistory(`Pulido de borde · ${intensityLabel(options.intensity)} · ${options.radius} px`);
      setImpact(result.impact);
      setStatus("complete");
      setNotification({
        kind: "success",
        text: `Pulido aplicado y reanalizado: ${number.format(result.impact.changedPixels)} px ajustados, cero semitransparencias.`,
      });
    } catch (reason) {
      setStatus("error", messageOf(reason));
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };

  const undoPolish = async () => {
    await changePixelHistory("undo");
    setImpact(null);
    setPreview(null);
    setBefore(null);
  };

  const compare = (showBefore: boolean) => {
    if (!document || !preview || !before) return;
    updateDocument({ renderBlob: showBefore ? before : preview, renderRevision: document.renderRevision + 1 });
  };

  if (!document) return <Unavailable text="Abrí una imagen para preparar el pulido final." />;
  if (!analysis) return <Unavailable text="Analizá el canal alfa antes de habilitar esta etapa." />;
  if (!analysis.verifiedSolidAlpha) return <Unavailable text="Primero resolvé las semitransparencias y completá la verificación técnica alfa 0/255." />;

  return <>
    <section className="edge-polish-ready">
      <CircleCheck size={20} />
      <div><b>Alfa binario verificado</b><span>Pulido de borde es opcional. Mejora el contorno visual sin cambiar el objetivo técnico.</span></div>
    </section>

    <section>
      <div className="section-title"><span>INTENSIDAD</span><WandSparkles size={14} /></div>
      <div className="segmented polish-intensity">
        {(["soft", "medium", "strong"] as const).map((value) => <button key={value} className={options.intensity === value ? "active" : ""} onClick={() => setOption("intensity", value)}>{intensityLabel(value)}</button>)}
      </div>
      <label className="field-label">Radio: {options.radius} px
        <input type="range" min="1" max="3" step="1" value={options.radius} onChange={(event) => setOption("radius", Number(event.target.value) as 1 | 2 | 3)} />
      </label>
      <small className="microcopy">Empezá con Suave y 1 px. Los radios mayores corrigen dientes más visibles, pero pueden cambiar más contorno.</small>
    </section>

    <section>
      <div className="section-title"><span>MÉTODO BINARIO</span><WandSparkles size={14} /></div>
      <label className="field-label">Método
        <select value={options.method} onChange={(event) => setOption("method", event.target.value as EdgePolishMethod)}>
          <option value="binary_smoothing">Suavizado binario</option>
          <option value="majority_filter">Filtro de mayoría</option>
          <option value="spike_rounding">Redondeo leve de picos</option>
        </select>
      </label>
      <Check label="Proteger detalle fino" checked={options.protectFineDetail} onChange={(value) => setOption("protectFineDetail", value)} />
      <Check label="Proteger textura conectada" checked={options.protectConnectedTexture} onChange={(value) => setOption("protectConnectedTexture", value)} />
      <p className="polish-rule"><ShieldCheck size={13} /> Sin blur, feather ni alfa parcial. Sólo modifica la máscara 0/255.</p>
    </section>

    <section>
      <div className="section-title"><span>PREVISUALIZACIÓN</span><Eye size={14} /></div>
      <button className="primary-action" disabled={busy} onClick={() => void previewPolish()}>PREVISUALIZAR PULIDO</button>
      <div className="segmented polish-compare">
        <button disabled={!preview} onClick={() => compare(true)}>Antes</button>
        <button disabled={!preview} onClick={() => compare(false)}>Después</button>
      </div>
      <button className="hold-compare" disabled={!preview} onPointerDown={() => compare(true)} onPointerUp={() => compare(false)} onPointerLeave={() => compare(false)}><Pause size={13} /> Mantener presionado para ver Antes</button>
      {impact && <dl className="impact-summary polish-impact">
        <div><dt>Píxeles ajustados</dt><dd>{number.format(impact.changedPixels)}</dd></div>
        <div className="red"><dt>Recortados</dt><dd>{number.format(impact.becameTransparent)}</dd></div>
        <div className="cyan"><dt>Reconstruidos</dt><dd>{number.format(impact.becameOpaque)}</dd></div>
        <div><dt>Detalle protegido</dt><dd>{number.format(impact.protectedPixels)}</dd></div>
        <div><dt>Picos antes</dt><dd>{number.format(impact.jaggedPointsBefore)}</dd></div>
        <div className="success-text"><dt>Picos después</dt><dd>{number.format(impact.jaggedPointsAfter)}</dd></div>
      </dl>}
    </section>

    <section className="polish-actions">
      <button className="primary-action" disabled={!impact || busy || impact.changedPixels === 0} onClick={() => void applyPolish()}>APLICAR Y VOLVER A VERIFICAR</button>
      <button className="secondary-action" disabled={!lastHistoryEntry?.startsWith("Pulido de borde") || busy} onClick={() => void undoPolish()}><Undo2 size={13} /> DESHACER PULIDO</button>
      <small className="microcopy">La previsualización no modifica el documento. Aplicar crea una entrada completa en el historial.</small>
    </section>
  </>;
}

function Unavailable({ text }: { text: string }) {
  return <section className="polish-unavailable"><WandSparkles size={20} /><b>Pulido de borde bloqueado</b><p className="microcopy">{text}</p></section>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function intensityLabel(value: EdgePolishOptions["intensity"]) {
  return { soft: "Suave", medium: "Media", strong: "Fuerte" }[value];
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
