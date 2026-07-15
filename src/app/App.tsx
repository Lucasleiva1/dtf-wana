import { useEffect, useRef, useState } from "react";
import { CanvasWorkspace } from "../canvas/CanvasWorkspace";
import { CanvasControls } from "../components/CanvasControls";
import { Inspector } from "../components/Inspector";
import { StatusBar } from "../components/StatusBar";
import { ToolRail } from "../components/ToolRail";
import { TopBar } from "../components/TopBar";
import { dispatchCommand, type SystemCapabilities } from "../lib/commandBus";
import { changePixelHistory } from "../lib/historyService";
import { useStudioStore } from "../stores/studioStore";
import { importImageFile } from "./importImage";

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<SystemCapabilities | null>(null);
  const setDocument = useStudioStore((state) => state.setDocument);
  const notification = useStudioStore((state) => state.notification);
  const setNotification = useStudioStore((state) => state.setNotification);
  const open = () => inputRef.current?.click();

  useEffect(() => {
    void dispatchCommand<Record<string, never>, SystemCapabilities>("system.capabilities", {}).then((result) => {
      if (result.ok && result.data) setSystem(result.data);
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (event.ctrlKey && event.key.toLowerCase() === "o") { event.preventDefault(); open(); }
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); void changePixelHistory("undo"); }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void changePixelHistory("redo"); }
      if (event.key === "0") useStudioStore.getState().fitDocument();
      if (event.key === "1") useStudioStore.getState().actualSize();
      const toolKeys = { h: "hand", z: "zoom", b: "brush", e: "eraser", v: "transform" } as const;
      const tool = toolKeys[event.key.toLowerCase() as keyof typeof toolKeys];
      if (tool) useStudioStore.getState().setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try { setDocument(await importImageFile(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la imagen."); }
  };

  return (
    <div className="studio-shell">
      <input ref={inputRef} className="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,image/*" onChange={onFile} />
      <TopBar onOpen={open} />
      <CanvasControls />
      <main className="workspace-layout"><ToolRail /><CanvasWorkspace onOpen={open} /><Inspector /></main>
      <StatusBar system={system} />
      {error && <div className="toast error" role="alert"><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}
      {notification && <div className={`toast ${notification.kind}`} role="status"><span>{notification.text}</span><button onClick={() => setNotification(null)}>×</button></div>}
    </div>
  );
}
