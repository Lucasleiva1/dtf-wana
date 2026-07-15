import { create } from "zustand";
import { clampZoom, fitRect, zoomAt } from "../canvas/camera";
import type { Camera, ModuleId, PreviewBackground, StudioDocument, ToolId } from "../types/document";
import type { AlphaAnalysis, PreviewMode } from "../types/alpha";

type StudioState = {
  activeModule: ModuleId;
  activeTool: ToolId;
  previewBackground: PreviewBackground;
  document: StudioDocument | null;
  alphaAnalysis: AlphaAnalysis | null;
  alphaStatus: "idle" | "analyzing" | "applying" | "complete" | "error";
  alphaError: string | null;
  alphaRegionIndex: number;
  previewMode: PreviewMode;
  notification: { kind: "success" | "error" | "info"; text: string } | null;
  camera: Camera;
  viewport: { width: number; height: number };
  history: string[];
  future: string[];
  setModule: (module: ModuleId) => void;
  setTool: (tool: ToolId) => void;
  setPreviewBackground: (background: PreviewBackground) => void;
  setDocument: (document: StudioDocument | null) => void;
  updateDocument: (patch: Partial<StudioDocument>) => void;
  setAlphaAnalysis: (analysis: AlphaAnalysis | null) => void;
  setAlphaStatus: (status: StudioState["alphaStatus"], error?: string | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRegionIndex: (index: number) => void;
  focusRect: (rect: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  setNotification: (notification: StudioState["notification"]) => void;
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
  alphaAnalysis: null,
  alphaStatus: "idle",
  alphaError: null,
  alphaRegionIndex: 0,
  previewMode: "original",
  notification: null,
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
    set({ document, alphaAnalysis: null, alphaStatus: "idle", alphaError: null, alphaRegionIndex: 0, previewMode: "original", history: document ? [`Abrir ${document.name}`] : [], future: [] });
    queueMicrotask(() => get().fitDocument());
  },
  updateDocument: (patch) => set((state) => ({ document: state.document ? { ...state.document, ...patch } : null })),
  setAlphaAnalysis: (alphaAnalysis) => set({ alphaAnalysis, alphaRegionIndex: 0 }),
  setAlphaStatus: (alphaStatus, alphaError = null) => set({ alphaStatus, alphaError }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setRegionIndex: (alphaRegionIndex) => set({ alphaRegionIndex }),
  focusRect: (rect) => {
    const { viewport } = get();
    const width = Math.max(1, rect.maxX - rect.minX + 1);
    const height = Math.max(1, rect.maxY - rect.minY + 1);
    const zoom = clampZoom(Math.min(32, (viewport.width * 0.58) / width, (viewport.height * 0.58) / height));
    const centerX = (rect.minX + rect.maxX + 1) / 2;
    const centerY = (rect.minY + rect.maxY + 1) / 2;
    set({ camera: { zoom, x: viewport.width / 2 - centerX * zoom, y: viewport.height / 2 - centerY * zoom } });
  },
  setNotification: (notification) => set({ notification }),
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
