import { AlertTriangle, ChevronRight, CircleCheck, Layers3 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";
import type { ModuleId } from "../types/document";

const tabs: Array<[ModuleId, string]> = [["background", "Quitar fondo"], ["transparency", "Transparencias"], ["separation", "Separar"]];

export function Inspector() {
  const activeModule = useStudioStore((state) => state.activeModule);
  const setModule = useStudioStore((state) => state.setModule);
  const document = useStudioStore((state) => state.document);
  return (
    <aside className="inspector">
      <div className="module-tabs" role="tablist" aria-label="Módulos">
        {tabs.map(([id, label]) => <button role="tab" aria-selected={activeModule === id} className={activeModule === id ? "active" : ""} onClick={() => setModule(id)} key={id}>{label}</button>)}
      </div>
      {activeModule === "transparency" && (
        <div className="inspector-content">
          <section>
            <div className="section-title"><span>ANÁLISIS DE ALFA</span><ChevronRight size={14} /></div>
            {document ? (
              <dl className="metrics">
                <div><dt>Formato</dt><dd>{document.mimeType.replace("image/", "").toUpperCase()}</dd></div>
                <div><dt>Dimensiones</dt><dd>{document.width} × {document.height}</dd></div>
                <div><dt>Profundidad</dt><dd>Pendiente de analizar</dd></div>
                <div><dt>Alfa parcial</dt><dd className="warning-text">Sin analizar</dd></div>
              </dl>
            ) : <p className="muted">Abrí una imagen para iniciar el análisis exacto.</p>}
            <button className="primary-action" disabled={!document}>ANALIZAR ALFA</button>
          </section>
          <section>
            <div className="section-title"><span>HISTOGRAMA</span><ChevronRight size={14} /></div>
            <div className="histogram-placeholder"><span>0</span><div /><span>255</span></div>
            <p className="microcopy">El histograma exacto 8/16 bits se habilita en la etapa bloqueante de Transparencias.</p>
          </section>
          <section className="quality-gates">
            <div><AlertTriangle size={15} /><span>Verificación técnica</span><b>Pendiente</b></div>
            <div><CircleCheck size={15} /><span>Revisión visual</span><b>Pendiente</b></div>
          </section>
        </div>
      )}
      {activeModule === "background" && <ModulePlaceholder icon={<CircleCheck size={24} />} title="Quitar fondo" text="Primero manual y varita. La IA se habilita sólo después de cerrar Transparencias." />}
      {activeModule === "separation" && <ModulePlaceholder icon={<Layers3 size={24} />} title="Separar elementos" text="SAM, capas y exportación individual se implementan al final para proteger estabilidad y memoria." />}
    </aside>
  );
}

function ModulePlaceholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="module-placeholder">{icon}<h2>{title}</h2><p>{text}</p><span>Etapa posterior</span></div>;
}
