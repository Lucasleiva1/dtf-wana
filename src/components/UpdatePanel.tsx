import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { CheckCircle2, Download, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateStatus = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "error";

export function UpdatePanel({ onClose }: { onClose: () => void }) {
  const [currentVersion, setCurrentVersion] = useState("…");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
