import { useState } from "react";
import { Info, Trash2, X } from "lucide-react";
import { artboardFor, formatMeasurement, measurementToPixels, physicalSize, pixelsToMeasurement } from "../lib/measurements";
import { useStudioStore } from "../stores/studioStore";
import type { MeasurementUnit } from "../types/document";
import { naturalPlacedSize } from "../app/documentPlacement";

const tabs = ["General", "Tamaño", "Color", "Contenido", "Exportación"] as const;

export function DocumentPropertiesDialog({ onClose }: { onClose: () => void }) {
  const document = useStudioStore((state) => state.document);
  const updateDocument = useStudioStore((state) => state.updateDocument);
  const updateGuide = useStudioStore((state) => state.updateGuide);
  const removeGuide = useStudioStore((state) => state.removeGuide);
  const [tab, setTab] = useState<(typeof tabs)[number]>("General");
  if (!document) return null;
  const artboard = artboardFor(document);
  const physical = physicalSize(document);
  const naturalImage = document.placedImage ? naturalPlacedSize(document.placedImage, artboard.ppi) : null;
  const naturalImageCm = naturalImage ? { width: pixelsToMeasurement(naturalImage.width, "cm", artboard.ppi), height: pixelsToMeasurement(naturalImage.height, "cm", artboard.ppi) } : null;
  const updateArtboard = (patch: Partial<typeof artboard>) => updateDocument({ artboard: { ...artboard, ...patch }, dirty: true });
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="properties-dialog" role="dialog" aria-modal="true" aria-labelledby="properties-title">
      <header><div><span>DOCUMENTO</span><h2 id="properties-title">Propiedades de {document.name}</h2></div><button onClick={onClose} title="Cerrar"><X size={18} /></button></header>
      <nav>{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="properties-content">
        {tab === "General" && <dl><dt>Nombre</dt><dd>{document.name}</dd><dt>Tipo</dt><dd>{document.engineReady === false ? "Documento DTF vacío" : document.mimeType}</dd><dt>Formato</dt><dd>{document.format}</dd><dt>Creado</dt><dd>{document.createdAt ? new Date(document.createdAt).toLocaleString("es-AR") : "No disponible"}</dd><dt>Origen</dt><dd title={document.sourcePath}>{document.sourcePath ?? "Importado en memoria"}</dd><dt>Estado</dt><dd>{document.dirty ? "Con cambios" : "Sin cambios"}</dd></dl>}
        {tab === "Tamaño" && <div className="properties-size"><div className="metric-hero"><b>{artboard.widthPx.toLocaleString("es-AR")} × {artboard.heightPx.toLocaleString("es-AR")} px</b><span>{formatMeasurement(physical.width, physical.unit)} × {formatMeasurement(physical.height, physical.unit)} {physical.unit}</span></div><label>Unidad de trabajo<select value={artboard.preferredUnit} onChange={(event) => updateArtboard({ preferredUnit: event.target.value as MeasurementUnit })}><option value="px">Píxeles</option><option value="cm">Centímetros</option><option value="mm">Milímetros</option><option value="in">Pulgadas</option><option value="pt">Puntos</option><option value="pc">Picas</option></select></label><label>Resolución (PPP)<input type="number" min="36" max="2400" value={artboard.ppi} onChange={(event) => updateArtboard({ ppi: Math.max(36, Math.min(2400, Number(event.target.value))) })} /></label><p><Info size={14} /> Cambiar PPP recalcula el tamaño físico sin alterar los píxeles. El remuestreo nunca se ejecuta de manera silenciosa.</p>{document.ppiAssumed && <em>La imagen no informó una resolución confiable; se asumieron 300 PPP.</em>}</div>}
        {tab === "Color" && <dl><dt>Perfil</dt><dd>{document.colorProfile ?? "sRGB"}</dd><dt>Profundidad</dt><dd>{document.bitDepth} bits/canal</dd><dt>Alfa</dt><dd>{document.mimeType === "image/jpeg" ? "Sin canal alfa de origen" : "Compatible"}</dd><dt>Fondo de mesa</dt><dd>{artboard.background}</dd></dl>}
        {tab === "Contenido" && <><dl><dt>Mesas de trabajo</dt><dd>1</dd><dt>Elemento colocado</dt><dd>{document.placedImage?.name ?? "Ninguno"}</dd><dt>Píxeles originales</dt><dd>{document.placedImage ? `${document.placedImage.sourceWidth} × ${document.placedImage.sourceHeight} px` : "—"}</dd><dt>Resolución de origen</dt><dd>{document.placedImage ? document.ppiAssumed ? "No informada · requiere confirmación" : `${formatMeasurement(document.placedImage.sourcePpi, "px", 3)} PPP` : "—"}</dd><dt>Tamaño físico real</dt><dd>{naturalImageCm ? document.ppiAssumed ? "Pendiente de confirmar los PPP de origen" : `${formatMeasurement(naturalImageCm.width, "cm", 3)} × ${formatMeasurement(naturalImageCm.height, "cm", 3)} cm` : "—"}</dd><dt>Posición</dt><dd>{document.placedImage ? `${formatMeasurement(pixelsToMeasurement(document.placedImage.x, artboard.preferredUnit, artboard.ppi), artboard.preferredUnit)}; ${formatMeasurement(pixelsToMeasurement(document.placedImage.y, artboard.preferredUnit, artboard.ppi), artboard.preferredUnit)} ${artboard.preferredUnit}` : "—"}</dd><dt>Guías</dt><dd>{document.guides?.length ?? 0}</dd></dl>{Boolean(document.guides?.length) && <div className="guide-properties"><b>Posiciones exactas de guías · origen central 0</b>{document.guides?.map((guide) => { const center = guide.orientation === "vertical" ? artboard.widthPx / 2 : artboard.heightPx / 2; return <label key={guide.id}><span>{guide.orientation === "vertical" ? "Vertical · X" : "Horizontal · Y"}</span><input type="number" step="0.001" value={Number(pixelsToMeasurement(guide.position - center, artboard.preferredUnit, artboard.ppi).toFixed(3))} onChange={(event) => updateGuide(guide.id, center + measurementToPixels(Number(event.target.value), artboard.preferredUnit, artboard.ppi))} /><em>{artboard.preferredUnit}</em><button title="Eliminar guía" onClick={() => removeGuide(guide.id)}><Trash2 size={13} /></button></label>; })}</div>}</>}
        {tab === "Exportación" && <dl><dt>Área</dt><dd>Mesa de trabajo actual</dd><dt>Resolución</dt><dd>{artboard.ppi} PPP</dd><dt>Perfil</dt><dd>{document.colorProfile ?? "sRGB"}</dd><dt>Proceso DTF</dt><dd>{document.engineReady === false ? "Sin imagen para procesar" : "Requiere análisis y verificación alfa"}</dd><dt>Ayudas visuales</dt><dd>Reglas y guías manuales o inteligentes no se exportan</dd></dl>}
      </div>
      <footer><button className="primary-action" onClick={onClose}>Listo</button></footer>
    </section>
  </div>;
}
