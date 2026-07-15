import { create } from "zustand";
import { clampZoom, fitRect, zoomAt } from "../canvas/camera";
import type { Camera, ModuleId, PreviewBackground, StudioDocument, ToolId } from "../types/document";

type StudioState = {
  activeModule: ModuleId;
  activeTool: ToolId;
  previewBackground: PreviewBackground;
  document: StudioDocument | null;
  camera: Camera;
  viewport: { width: number; height: number };
  history: string[];
  future: string[];
  setModule: (module: ModuleId) => void;
  setTool: (tool: ToolId) => void;
  setPreviewBackground: (background: PreviewBackground) => void;
  setDocument: (document: StudioDocument | null) => void;
  setViewport: (viewport: { width: number; height: number }) => void;
  panBy: (dx: number, dy: number) => void;
  setZoomAt: (zoom: number, point: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  fitDocument: () => void;
  actualSize: () => void;
  pushHistory: (label: string) => void;
  undo: () => void;
  redo: () => void;
};

const initialCamera: Camera = { x: 120, y: 80, zoom: 1 };

export const useStudioStore = create<StudioState>((set, get) => ({
  activeModule: "transparency",
  activeTool: "select",
  previewBackground: "checker-small",
  document: null,
  camera: initialCamera,
  viewport: { width: 900, height: 600 },
  history: [],
  future: [],
  setModule: (activeModule) => set({ activeModule }),
  setTool: (activeTool) => set({ activeTool }),
  setPreviewBackground: (previewBackground) => set({ previewBackground }),
  setDocument: (document) => {
    const previous = get().document;
    if (previous?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(previous.previewUrl);
    set({ document, history: document ? [`Abrir ${document.name}`] : [], future: [] });
    queueMicrotask(() => get().fitDocument());
  },
  setViewport: (viewport) => set({ viewport }),
  panBy: (dx, dy) => set((state) => ({ camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy } })),
  setZoomAt: (zoom, point) => set((state) => ({ camera: zoomAt(state.camera, zoom, point) })),
  setZoom: (zoom) => set((state) => ({ camera: { ...state.camera, zoom: clampZoom(zoom) } })),
  fitDocument: () => {
    const { document, viewport } = get();
    if (!document) return;
    set({ camera: fitRect(viewport, document) });
  },
  actualSize: () => {
    const { document, viewport } = get();
    if (!document) return;
    set({ camera: { zoom: 1, x: (viewport.width - document.width) / 2, y: (viewport.height - document.height) / 2 } });
  },
  pushHistory: (label) => set((state) => ({ history: [...state.history, label], future: [] })),
  undo: () => set((state) => {
    if (state.history.length <= 1) return state;
    const last = state.history[state.history.length - 1];
    return { history: state.history.slice(0, -1), future: [last, ...state.future] };
  }),
  redo: () => set((state) => {
    if (!state.future.length) return state;
    const [next, ...future] = state.future;
    return { history: [...state.history, next], future };
  }),
}));
