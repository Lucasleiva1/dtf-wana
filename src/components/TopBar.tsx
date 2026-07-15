import { Download, FolderOpen, Redo2, RotateCcw, Save, Settings2, Undo2 } from "lucide-react";
import { useStudioStore } from "../stores/studioStore";

export function TopBar({ onOpen }: { onOpen: () => void }) {
  const undo = useStudioStore((state) => state.undo);
  const redo = useStudioStore((state) => state.redo);
  const history = useStudioStore((state) => state.history);
  const future = useStudioStore((state) => state.future);
  const document = useStudioStore((state) => state.document);
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">D</span><b>DTF Pro Studio</b></div>
      <nav className="app-menu" aria-label="Menú principal"><button>Archivo</button><button>Editar</button><button>Ver</button></nav>
      <div className="quick-actions">
        <button onClick={onOpen} title="Abrir (Ctrl+O)"><FolderOpen size={16} /><span>Abrir</span></button>
        <button disabled={!document} title="Guardar proyecto"><Save size={16} /><span>Guardar</span></button>
        <i />
        <button onClick={undo} disabled={history.length <= 1} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
        <button onClick={redo} disabled={!future.length} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
        <button onClick={() => useStudioStore.setState({ camera: { x: 120, y: 80, zoom: 1 } })} title="Restablecer vista"><RotateCcw size={16} /></button>
      </div>
      <div className="topbar-end"><button title="Configuración"><Settings2 size={16} /><span>Ajustes</span></button><button className="export-button" disabled={!document}><Download size={16} /><span>Exportar</span></button></div>
    </header>
  );
}
