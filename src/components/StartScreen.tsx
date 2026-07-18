import { FileImage, FilePlus2, Gauge, Ruler } from "lucide-react";

export function StartScreen({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return <main className="start-screen">
    <section className="start-hero"><div className="start-logo">D</div><div><span>DTF PRO STUDIO</span><h1>Preparación precisa para impresión DTF</h1><p>Creá una mesa con medidas físicas o abrí una imagen existente. La aplicación conserva el original intacto.</p></div></section>
    <section className="start-actions">
      <button className="new-document-card" onClick={onNew}><FilePlus2 size={30} /><span><b>Nuevo documento</b><small>Mesa personalizada en cm, mm, pulgadas o píxeles</small></span></button>
      <button onClick={onOpen}><FileImage size={27} /><span><b>Abrir imagen</b><small>PNG, JPG, WebP, TIFF o BMP</small></span></button>
    </section>
    <section className="start-defaults"><div><Ruler size={17} /><span><b>38 × 38 cm</b><small>Preajuste DTF inicial</small></span></div><div><Gauge size={17} /><span><b>300 PPP</b><small>Resolución predeterminada</small></span></div></section>
  </main>;
}
