import { useEffect } from "react";
import {
  AlertTriangle, Bot, Brush, CheckCircle2, CircleOff, Eye, Focus, Layers3,
  LoaderCircle, LockKeyhole, Redo2, ScanSearch, Shield, Sparkles, SprayCan, Trash2, Undo2,
  WandSparkles,
} from "lucide-react";
import { useStudioStore } from "../../../stores/studioStore";
import {
  cleanupBackgroundMask, deleteBackgroundSelection, generateUnknownBand, initializeBackgroundRemoval,
  modifyBackgroundSelection, redoBackgroundMask, refineBackgroundEdge,
  removeBackgroundWithAi, selectBackgroundFromBorders, undoBackgroundMask, exportBackgroundResult,
} from "../commands/backgroundRemovalService";
import { useBackgroundRemovalStore } from "../state/backgroundRemovalStore";
import type { BackgroundView, SelectionAction, SelectionMode } from "../types";

const number = new Intl.NumberFormat("es-AR");

export function BackgroundRemovalInspector() {
  const document = useStudioStore((state) => state.document);
  const selectedItemId = useStudioStore((state) => state.selectedItemId);
  const setNotification = useStudioStore((state) => state.setNotification);
  const updatePlacedImage = useStudioStore((state) => state.updatePlacedImage);
  const setActiveJob = useStudioStore((state) => state.setActiveJob);
  const activeTool = useStudioStore((state) => state.activeTool);
  const renderDevice = useStudioStore((state) => state.renderDevice);
  const store = useBackgroundRemovalStore();
  const selected = Boolean(document?.placedImage && selectedItemId === document.placedImage.id);
  const hasBackgroundResult = store.summary.selectedPixels > 0
    || store.summary.aiMaskActive
    || store.summary.userSubtractedPixels > 0
    || store.summary.backgroundLockedPixels > 0
    || store.summary.unknownPixels > 0;

  useEffect(() => {
    if (!document || document.engineReady === false || !document.placedImage) {
      store.resetForDocument(null);
      return;
    }
    void initializeBackgroundRemoval(document).catch((reason) => store.setError(messageOf(reason)));
  }, [document?.id, document?.engineReady]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input, textarea, select")) return;
      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        store.setQuickMask(!useBackgroundRemovalStore.getState().quickMask);
      }
      if (event.key === "[") store.setBrushSize(store.brushSize - Math.max(1, Math.round(store.brushSize * 0.12)));
      if (event.key === "]") store.setBrushSize(store.brushSize + Math.max(1, Math.round(store.brushSize * 0.12)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store.brushSize]);

  const run = async (operation: () => Promise<unknown>, success?: string) => {
    if (!document || !selected) {
      setNotification({ kind: "info", text: "Seleccioná la imagen antes de usar Quitar fondo." });
      return;
    }
    if (document.placedImage?.maskLocked || document.placedImage?.contentLocked) {
      setNotification({ kind: "info", text: "La máscara o el contenido de la capa están bloqueados." });
      return;
    }
    try {
      await operation();
      if (success) setNotification({ kind: "success", text: success });
    } catch (reason) {
      setNotification({ kind: "error", text: messageOf(reason) });
    }
  };
  const selectionAction = (action: SelectionAction, radius = 1) => run(() => modifyBackgroundSelection(document!, action, radius));
  const setView = (view: BackgroundView) => store.setView(view);

  if (!document?.placedImage) return <div className="background-empty"><Layers3 size={27} /><h2>Quitar fondo</h2><p>Abrí una imagen para crear una máscara no destructiva.</p></div>;
  if (!selected) return <div className="background-empty"><Focus size={27} /><h2>Seleccioná la imagen</h2><p>Hacé clic sobre la imagen. La mesa, las reglas y la transformación no cambian al entrar en este módulo.</p></div>;

  return <div className="background-removal-panel">
    <header className="background-module-heading">
      <div><span>MÓDULO PROFESIONAL</span><h2>Quitar fondo</h2></div>
      <div className="background-history-actions">
        <button disabled={!store.summary.canUndo || Boolean(store.busy)} onClick={() => void run(() => undoBackgroundMask(document))} title="Deshacer máscara"><Undo2 size={14} /></button>
        <button disabled={!store.summary.canRedo || Boolean(store.busy)} onClick={() => void run(() => redoBackgroundMask(document))} title="Rehacer máscara"><Redo2 size={14} /></button>
      </div>
    </header>
    {store.busy && <div className="background-busy"><LoaderCircle className="spin" size={13} />{store.busy}</div>}
    {store.error && <div className="background-inline-error"><AlertTriangle size={13} />{store.error}</div>}

    <BackgroundSection title="CAPA ACTIVA" icon={<Layers3 size={13} />}>
      <div className="background-layer-row"><div className="background-layer-thumbnail">{document.placedImage.name.slice(0, 1).toUpperCase()}</div><div><b>{document.placedImage.name}</b><span>{number.format(document.width)} × {number.format(document.height)} px</span></div></div>
      <div className="background-grid-two">
        <Check label="Visible" checked={document.placedImage.visible !== false} onChange={(visible) => updatePlacedImage({ visible })} />
        <Check label="Bloquear transformación" checked={Boolean(document.placedImage.transformLocked)} onChange={(transformLocked) => updatePlacedImage({ transformLocked })} />
        <Check label="Bloquear contenido" checked={Boolean(document.placedImage.contentLocked)} onChange={(contentLocked) => updatePlacedImage({ contentLocked })} />
        <Check label="Bloquear máscara" checked={Boolean(document.placedImage.maskLocked)} onChange={(maskLocked) => updatePlacedImage({ maskLocked })} />
        <Check label="Proteger transparencia" checked={document.placedImage.transparencyProtected !== false} onChange={(transparencyProtected) => updatePlacedImage({ transparencyProtected })} />
        <Check label="Muestrear capas visibles" checked={store.wand.sampleAllVisibleLayers} onChange={(sampleAllVisibleLayers) => store.setWand({ sampleAllVisibleLayers })} />
      </div>
    </BackgroundSection>

    <BackgroundSection title="MÉTODO" icon={<Sparkles size={13} />}>
      <button className="background-primary" disabled={Boolean(store.busy)} onClick={() => void run(() => selectBackgroundFromBorders(document), "Fondo detectado desde los cuatro bordes. Revisá la selección antes de exportar.")}><ScanSearch size={14} /> Detectar desde bordes</button>
      <div className={`background-model-status ${store.model?.ready ? "ready" : "pending"}`}>
        <Bot size={15} /><div><b>BiRefNet Lite · {store.model?.provider ?? "comprobando"}</b><span>{store.model?.reason ?? "Comprobando modelo local…"}</span></div>
      </div>
      <button className="background-secondary" disabled={!store.model?.ready || Boolean(store.busy)} onClick={() => void run(async () => {
        const result = await removeBackgroundWithAi(document, renderDevice);
        setNotification({ kind: "success", text: `Fondo quitado con BiRefNet Lite usando ${result.provider}.` });
      })}><Bot size={14} /> Quitar con IA local</button>
    </BackgroundSection>

    <BackgroundSection title="SELECCIÓN" icon={<WandSparkles size={13} />}>
      <div className="background-segmented four">
        {(["new", "add", "subtract", "intersect"] as SelectionMode[]).map((mode) => <button key={mode} className={store.selectionMode === mode ? "active" : ""} onClick={() => store.setSelectionMode(mode)}>{({ new: "Nueva", add: "Sumar", subtract: "Restar", intersect: "Intersec." })[mode]}</button>)}
      </div>
      <label className="background-range">Tolerancia <b>{store.wand.tolerance.toFixed(0)}</b><input type="range" min="1" max="100" value={store.wand.tolerance} onChange={(event) => store.setWand({ tolerance: Number(event.target.value) })} /></label>
      <Check label="Contiguo" checked={store.wand.contiguous} onChange={(contiguous) => store.setWand({ contiguous })} />
      <button className="background-delete-selection" disabled={Boolean(store.busy) || store.summary.selectedPixels === 0} onClick={() => void run(() => deleteBackgroundSelection(document), "Fondo eliminado. Podés seleccionar otra zona y volver a borrar.")}><Trash2 size={14} /> Borrar fondo seleccionado <kbd>Supr</kbd></button>
      <small className="background-help">La selección se convierte en transparencia y se deselecciona automáticamente. Ctrl+D sólo deselecciona.</small>
      <details className="background-advanced">
        <summary>Opciones avanzadas</summary>
        <div className="background-grid-two">
          <Check label="Anti-alias" checked={store.wand.antiAlias} onChange={(antiAlias) => store.setWand({ antiAlias })} />
          <Check label="Precisión máxima (lenta)" checked={store.wand.preciseColor} onChange={(preciseColor) => store.setWand({ preciseColor })} />
          <Check label="Barrera de borde" checked={store.wand.stopAtStrongEdge} onChange={(stopAtStrongEdge) => store.setWand({ stopAtStrongEdge })} />
        </div>
        <label className="background-range">Fuerza de borde <b>{store.wand.edgeBarrierStrength.toFixed(0)}%</b><input type="range" min="0" max="100" value={store.wand.edgeBarrierStrength} onChange={(event) => store.setWand({ edgeBarrierStrength: Number(event.target.value) })} /></label>
        <div className="background-action-grid"><button onClick={() => void selectionAction("select_all")}>Todo</button><button onClick={() => void selectionAction("clear")}>Nada</button><button onClick={() => void selectionAction("invert")}>Invertir</button><button onClick={() => void selectionAction("smooth", 1)}>Suavizar</button></div>
      </details>
      <div className="background-selection-count"><i />{number.format(store.summary.selectedPixels)} px de fondo seleccionados</div>
    </BackgroundSection>

    <BackgroundSection title="VISTA" icon={<Eye size={13} />}>
      <div className="background-view-grid">
        <ViewButton label="Selección" view="selection" current={store.view} onClick={setView} />
        <ViewButton label="Resultado" view="result" current={store.view} onClick={setView} />
        <ViewButton label="Blanco" view="result_white" current={store.view} onClick={setView} />
        <ViewButton label="Negro" view="result_black" current={store.view} onClick={setView} />
        <ViewButton label="Máscara" view="mask" current={store.view} onClick={setView} />
        <ViewButton label="Protecciones" view="protections" current={store.view} onClick={setView} />
      </div>
      <div className="background-grid-two"><Check label="Hormigas marchantes" checked={store.showMarchingAnts} onChange={store.setShowMarchingAnts} /><Check label="Overlay" checked={store.overlayVisible} onChange={store.setOverlayVisible} /></div>
      <button className={store.quickMask ? "background-quick active" : "background-quick"} onClick={() => store.setQuickMask(!store.quickMask)}>Quick Mask <kbd>Q</kbd></button>
    </BackgroundSection>

    <BackgroundSection title="PROTECCIONES" icon={<Shield size={13} />}>
      <div className="background-mask-counts">
        <span className="foreground"><i />Sujeto protegido <b>{number.format(store.summary.foregroundLockedPixels)}</b></span>
        <span className="background"><i />Fondo seguro <b>{number.format(store.summary.backgroundLockedPixels)}</b></span>
        <span className="never"><LockKeyhole size={11} />Nunca borrar <b>{number.format(store.summary.neverRemovePixels)}</b></span>
      </div>
      <label className="background-range">Tamaño de pincel <b>{store.brushSize} px</b><input type="range" min="1" max="500" value={store.brushSize} onChange={(event) => store.setBrushSize(Number(event.target.value))} /></label>
      <label className="background-range">Opacidad <b>{Math.round(store.brushOpacity * 100)}%</b><input type="range" min="5" max="100" value={store.brushOpacity * 100} onChange={(event) => store.setBrushOpacity(Number(event.target.value) / 100)} /></label>
      <small className="background-help"><Brush size={12} />Usá Proteger, Marcar fondo o Nunca borrar desde la barra izquierda. Alt + arrastre horizontal cambia el tamaño; Alt + clic borra una marca.</small>
    </BackgroundSection>

    <BackgroundSection title="BORDE" icon={<Focus size={13} />}>
      <label className="background-range">Radio de banda <b>{store.refine.radius} px</b><input type="range" min="1" max="40" value={store.refine.radius} onChange={(event) => store.setRefine({ radius: Number(event.target.value) })} /></label>
      <label className="background-range">Sensibilidad <b>{store.refine.sensitivity.toFixed(0)}%</b><input type="range" min="1" max="100" value={store.refine.sensitivity} onChange={(event) => store.setRefine({ sensitivity: Number(event.target.value) })} /></label>
      <div className="background-grid-two"><Check label="Conservar pelo" checked={store.refine.preserveHair} onChange={(preserveHair) => store.setRefine({ preserveHair })} /><Check label="Líneas finas" checked={store.refine.preserveFineLines} onChange={(preserveFineLines) => store.setRefine({ preserveFineLines })} /></div>
      <div className="background-action-grid two"><button onClick={() => void run(() => generateUnknownBand(document, store.refine.radius), "Banda incierta generada alrededor del borde.")}>Crear banda</button><button className="accent" onClick={() => void run(() => refineBackgroundEdge(document, store.refine), "Borde refinado dentro de la banda incierta.")}>Refinar borde</button></div>
      <span className="background-unknown-count">{number.format(store.summary.unknownPixels)} px en zona incierta · {number.format(store.summary.partialAlphaPixels)} alfa parcial</span>
    </BackgroundSection>

    <BackgroundSection title="LIMPIEZA" icon={<Trash2 size={13} />}>
      <label className="background-range">Partícula mínima <b>{store.cleanup.minimumParticleSize} px</b><input type="range" min="1" max="1000" value={store.cleanup.minimumParticleSize} onChange={(event) => store.setCleanup({ minimumParticleSize: Number(event.target.value) })} /></label>
      <div className="background-grid-two"><Check label="Rellenar agujeros" checked={store.cleanup.fillHoles} onChange={(fillHoles) => store.setCleanup({ fillHoles })} /><Check label="Quitar islas" checked={store.cleanup.removeIslands} onChange={(removeIslands) => store.setCleanup({ removeIslands })} /></div>
      <button className="background-secondary" onClick={() => void run(() => cleanupBackgroundMask(document, store.cleanup), "Máscara limpiada sin modificar el original.")}><Trash2 size={13} /> Limpiar máscara</button>
    </BackgroundSection>

    <BackgroundSection title="BORRADOR DE FONDO" icon={<SprayCan size={13} />}>
      <label className="background-range">Tolerancia de color <b>{store.eraser.tolerance.toFixed(0)}</b><input type="range" min="1" max="100" value={store.eraser.tolerance} onChange={(event) => store.setEraser({ tolerance: Number(event.target.value) })} /></label>
      <div className="background-grid-two">
        <Check label="Muestrear una vez" checked={store.eraser.samplingOnce} onChange={(samplingOnce) => store.setEraser({ samplingOnce })} />
        <Check label="Encontrar bordes" checked={store.eraser.findEdges} onChange={(findEdges) => store.setEraser({ findEdges })} />
        <Check label="Proteger sujeto" checked={store.eraser.protectForeground} onChange={(protectForeground) => store.setEraser({ protectForeground })} />
      </div>
      <small className="background-help">Muestrea el color al iniciar el trazo y pinta sólo `user_subtract_mask`; nunca modifica RGB ni el archivo original.</small>
    </BackgroundSection>

    <BackgroundSection title="ALFA" icon={store.outputAlpha === "solid_dtf" ? <CheckCircle2 size={13} /> : <CircleOff size={13} />}>
      <div className="background-segmented"><button className={store.outputAlpha === "natural" ? "active" : ""} onClick={() => store.setOutputAlpha("natural")}>Natural</button><button className={store.outputAlpha === "solid_dtf" ? "active" : ""} onClick={() => store.setOutputAlpha("solid_dtf")}>Sólido DTF</button></div>
      <small className="background-help">Natural conserva pelo y suavidad. Sólido DTF muestra sólo alfa 0/255 en la vista final.</small>
    </BackgroundSection>

    <BackgroundSection title="EXPORTACIÓN" icon={<CheckCircle2 size={13} />}>
      <button className="background-export" disabled={Boolean(store.busy) || !hasBackgroundResult} onClick={() => void run(async () => {
        try {
          const result = await exportBackgroundResult(document, store.outputAlpha, setActiveJob);
          if (result) setNotification({ kind: "success", text: `PNG reabierto y verificado: ${number.format(result.width)} × ${number.format(result.height)} px · ${result.dpi} PPP.` });
        } finally { setActiveJob(null); }
      })}><CheckCircle2 size={14} /> Exportar PNG verificado</button>
      <small className="background-help">La máscara se combina sólo para codificar el archivo. El original y el buffer de trabajo permanecen intactos.</small>
    </BackgroundSection>
  </div>;
}

function BackgroundSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="background-section"><header><span>{title}</span>{icon}</header><div>{children}</div></section>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="background-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function ViewButton({ label, view, current, onClick }: { label: string; view: BackgroundView; current: BackgroundView; onClick: (view: BackgroundView) => void }) {
  return <button className={current === view ? "active" : ""} onClick={() => onClick(view)}>{label}</button>;
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
