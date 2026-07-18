import { useMemo, useState } from "react";
import { FilePlus2, X } from "lucide-react";
import { convertMeasurement, DOCUMENT_PRESETS, estimatedRgbaMemory, formatMeasurement, measurementToPixels, roundPixels } from "../lib/measurements";
import type { NewDocumentValues } from "../app/createDocument";
import type { ColorProfile, MeasurementUnit } from "../types/document";

const defaults: NewDocumentValues = { name: "Documento sin título", width: 38, height: 38, unit: "cm", ppi: 300, bitDepth: 8, colorProfile: "sRGB", background: "transparent" };

export function NewDocumentDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (values: NewDocumentValues) => void }) {
  const [values, setValues] = useState(defaults);
  const [lockRatio, setLockRatio] = useState(false);
  const widthPx = roundPixels(measurementToPixels(values.width, values.unit, values.ppi));
  const heightPx = roundPixels(measurementToPixels(values.height, values.unit, values.ppi));
  const memory = estimatedRgbaMemory(widthPx, heightPx, values.bitDepth);
  const invalid = !Number.isFinite(values.width) || !Number.isFinite(values.height) || !Number.isFinite(values.ppi) || values.width <= 0 || values.height <= 0 || values.ppi < 36 || values.ppi > 2400 || widthPx > 30000 || heightPx > 30000;
  const warning = useMemo(() => memory > 1024 ** 3 ? "Documento muy pesado: puede superar 1 GB durante el procesamiento." : memory > 512 * 1024 ** 2 ? "Documento pesado: se recomienda GPU y memoria disponible." : null, [memory]);
  const updateDimension = (key: "width" | "height", next: number) => {
    const ratio = values.width / values.height;
    if (!lockRatio || !Number.isFinite(ratio)) setValues({ ...values, [key]: next });
    else setValues(key === "width" ? { ...values, width: next, height: next / ratio } : { ...values, height: next, width: next * ratio });
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="document-dialog" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
      <header><div><span>NUEVO DOCUMENTO</span><h2 id="new-document-title">Crear una mesa con medidas reales</h2></div><button onClick={onClose} title="Cerrar"><X size={18} /></button></header>
      <div className="document-dialog-body">
        <aside><b>Preajustes DTF</b>{DOCUMENT_PRESETS.map((preset) => <button key={preset.id} onClick={() => setValues({ ...values, width: preset.width, height: preset.height, unit: preset.unit, ppi: preset.ppi })}>{preset.label}</button>)}</aside>
        <div className="document-form">
          <label className="wide">Nombre<input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
          <label>Ancho<input type="number" min="0.001" step="0.01" value={values.width} onChange={(event) => updateDimension("width", Number(event.target.value))} /></label>
          <label>Alto<input type="number" min="0.001" step="0.01" value={values.height} onChange={(event) => updateDimension("height", Number(event.target.value))} /></label>
          <label>Unidad<select value={values.unit} onChange={(event) => { const unit = event.target.value as MeasurementUnit; setValues({ ...values, width: convertMeasurement(values.width, values.unit, unit, values.ppi), height: convertMeasurement(values.height, values.unit, unit, values.ppi), unit }); }}><option value="px">Píxeles</option><option value="cm">Centímetros</option><option value="mm">Milímetros</option><option value="in">Pulgadas</option><option value="pt">Puntos</option><option value="pc">Picas</option></select></label>
          <label>Resolución (PPP)<input type="number" min="36" max="2400" value={values.ppi} onChange={(event) => setValues({ ...values, ppi: Number(event.target.value) })} /></label>
          <label>Profundidad<select value={values.bitDepth} onChange={(event) => setValues({ ...values, bitDepth: Number(event.target.value) as 8 | 16 })}><option value="8">8 bits/canal</option><option value="16">16 bits/canal</option></select></label>
          <label>Perfil<select value={values.colorProfile} onChange={(event) => setValues({ ...values, colorProfile: event.target.value as ColorProfile })}><option>sRGB</option><option>Display P3</option><option>Adobe RGB</option></select></label>
          <label>Fondo<select value={values.background} onChange={(event) => setValues({ ...values, background: event.target.value as NewDocumentValues["background"] })}><option value="transparent">Transparente</option><option value="white">Blanco</option><option value="black">Negro</option></select></label>
          <label className="inline-check"><input type="checkbox" checked={lockRatio} onChange={(event) => setLockRatio(event.target.checked)} /> Mantener proporción al editar</label>
          <div className="document-summary wide"><b>{widthPx.toLocaleString("es-AR")} × {heightPx.toLocaleString("es-AR")} px</b><span>{formatMeasurement(memory / 1024 / 1024, "px", 1)} MB RGBA estimados · {values.ppi} PPP</span>{warning && <em>{warning}</em>}</div>
        </div>
      </div>
      <footer><button className="secondary-action" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={invalid || !values.name.trim()} onClick={() => onCreate({ ...values, name: values.name.trim() })}><FilePlus2 size={15} /> Crear documento</button></footer>
    </section>
  </div>;
}
