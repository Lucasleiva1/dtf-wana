import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { CheckCircle2, Cpu, Download, Eye, LoaderCircle, MonitorCog, RefreshCw, Ruler, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStudioStore } from "../stores/studioStore";

type UpdateStatus = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "error";

export function UpdatePanel({ onClose }: { onClose: () => void }) {
  const [currentVersion, setCurrentVersion] = useState("…");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderDevice = useStudioStore((state) => state.renderDevice);
  const activeRenderDevice = useStudioStore((state) => state.activeRenderDevice);
  const rendererInfo = useStudioStore((state) => state.rendererInfo);
  const setRenderDevice = useStudioStore((state) => state.setRenderDevice);
  const showRulers = useStudioStore((state) => state.showRulers);
  const showGuides = useStudioStore((state) => state.showGuides);
  const guidesLocked = useStudioStore((state) => state.guidesLocked);
  const snapToGuides = useStudioStore((state) => state.snapToGuides);
  const smartGuidesEnabled = useStudioStore((state) => state.smartGuidesEnabled);
  const setShowRulers = useStudioStore((state) => state.setShowRulers);
  const setShowGuides = useStudioStore((state) => state.setShowGuides);
  const setGuidesLocked = useStudioStore((state) => state.setGuidesLocked);
  const setSnapToGuides = useStudioStore((state) => state.setSnapToGuides);
  const setSmartGuidesEnabled = useStudioStore((state) => state.setSmartGuidesEnabled);

  useEffect(() => { void getVersion().then(setCurrentVersion); }, []);

  const findUpdate = async () => {
    setStatus("checking");
    setError(null);
    try {
      const update = await check({ timeout: 20_000 });
      setAvailableUpdate(update);
      setStatus(update ? "available" : "current");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  };

  const installUpdate = async () => {
    if (!availableUpdate) return;
    setStatus("downloading");
    setDownloaded(0);
    setDownloadSize(null);
    setError(null);
    try {
      await availableUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") setDownloadSize(event.data.contentLength ?? null);
        if (event.event === "Progress") setDownloaded((value) => value + event.data.chunkLength);
        if (event.event === "Finished") setStatus("installing");
      }, { timeout: 120_000 });
      await relaunch();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  };

  const progress = downloadSize ? Math.min(100, Math.round((downloaded / downloadSize) * 100)) : null;
  const busy = status === "checking" || status === "downloading" || status === "installing";

  return <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header><div><span>DTF PRO STUDIO</span><h2 id="settings-title">Ajustes y actualizaciones</h2></div><button onClick={onClose} disabled={busy} title="Cerrar"><X size={17} /></button></header>
      <div className="performance-card">
        <div className="settings-section-heading"><div><b>Renderizador de imagen</b><span>Elegí cómo se dibujan el lienzo y las máscaras.</span></div><em>GPU predeterminada</em></div>
        <div className="render-device-options" role="group" aria-label="Renderizador de imagen">
          <button className={renderDevice === "gpu" ? "active" : ""} aria-pressed={renderDevice === "gpu"} onClick={() => setRenderDevice("gpu")}>
            <MonitorCog size={20} /><span><b>GPU</b><small>WebGL de alto rendimiento. Recomendado para mayor fluidez.</small></span>
          </button>
          <button className={renderDevice === "cpu" ? "active" : ""} aria-pressed={renderDevice === "cpu"} onClick={() => setRenderDevice("cpu")}>
            <Cpu size={20} /><span><b>CPU</b><small>Canvas 2D. Modo compatible para equipos con problemas gráficos.</small></span>
          </button>
        </div>
        <p className="active-renderer">En uso: <b>{activeRenderDevice ? activeRenderDevice.toUpperCase() : "inicializando"}</b><span title={rendererInfo}>{rendererInfo}</span></p>
      </div>
      <div className="performance-card view-settings-card">
        <div className="settings-section-heading"><div><b>Precisión y ayudas visuales</b><span>Estas ayudas nunca forman parte del archivo exportado.</span></div><Ruler size={18} /></div>
        <label><span><b>Mostrar reglas</b><small>Reglas superior y lateral en la unidad del documento.</small></span><input type="checkbox" checked={showRulers} onChange={(event) => setShowRulers(event.target.checked)} /></label>
        <label><span><b>Mostrar guías</b><small>Líneas arrastrables con posición numérica exacta.</small></span><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /></label>
        <label><span><b>Bloquear guías</b><small>Impide moverlas o eliminarlas accidentalmente.</small></span><input type="checkbox" checked={guidesLocked} onChange={(event) => setGuidesLocked(event.target.checked)} /></label>
        <label><span><b>Ajustar a guías</b><small>Alinea la imagen con guías y puntos importantes.</small></span><input type="checkbox" checked={snapToGuides} onChange={(event) => setSnapToGuides(event.target.checked)} /></label>
        <label><span><b>Guías inteligentes</b><small>Aparecen sólo mientras se mueve la imagen.</small></span><input type="checkbox" checked={smartGuidesEnabled} onChange={(event) => setSmartGuidesEnabled(event.target.checked)} /></label>
        <p className="active-renderer"><Eye size={13} /> Preferencias guardadas en este equipo.</p>
      </div>
      <div className="version-card">
        <div><b>Versión instalada</b><span>{currentVersion}</span></div>
        {status === "current" && <p className="update-success"><CheckCircle2 size={15} /> Tenés la versión más reciente.</p>}
        {status === "available" && availableUpdate && <div className="update-available"><b>Nueva versión {availableUpdate.version}</b><p>{availableUpdate.body || "Hay una actualización firmada disponible."}</p></div>}
        {status === "idle" && <p>La aplicación comprueba únicamente los Releases firmados del repositorio oficial.</p>}
        {status === "checking" && <p><LoaderCircle className="spin" size={14} /> Buscando una versión nueva…</p>}
        {(status === "downloading" || status === "installing") && <div className="update-progress"><p><LoaderCircle className="spin" size={14} /> {status === "installing" ? "Instalando y preparando el reinicio…" : `Descargando actualización${progress === null ? "" : ` · ${progress}%`}`}</p><progress value={progress ?? undefined} max="100" /></div>}
        {error && <p className="update-error">No se pudo comprobar o instalar la actualización: {error}</p>}
      </div>
      <footer>
        <button className="secondary-action" onClick={findUpdate} disabled={busy}><RefreshCw size={14} /> Buscar actualizaciones</button>
        {availableUpdate && <button className="primary-action" onClick={installUpdate} disabled={busy}><Download size={14} /> Descargar e instalar</button>}
      </footer>
      <small>Las actualizaciones se validan con firma criptográfica antes de instalarse.</small>
    </section>
  </div>;
}
