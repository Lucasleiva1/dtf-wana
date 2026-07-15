import { create } from "zustand";
import { clampZoom, fitRect, zoomAt } from "../canvas/camera";
import type { Camera, ModuleId, PreviewBackground, StudioDocument, ToolId } from "../types/document";
import type { AlphaAnalysis, JobSnapshot, PreviewMode, TransparencyFlowState } from "../types/alpha";
import type { MaskMode, MaskSummary, ResidueOverlayUpdate } from "../types/residue";

type StudioState = {
  activeModule: ModuleId;
  activeTool: ToolId;
  previewBackground: PreviewBackground;
  customBackgroundColor: string;
  document: StudioDocument | null;
  alphaAnalysis: AlphaAnalysis | null;
  alphaStatus: "idle" | "analyzing" | "applying" | "complete" | "error";
  alphaError: string | null;
  alphaRegionIndex: number;
  previewMode: PreviewMode;
  activeJob: JobSnapshot | null;
  transparencyFlow: TransparencyFlowState;
  visualReviewComplete: boolean;
  residueMask: MaskSummary;
  residueMaskMode: MaskMode;
  residueBrushSize: number;
  residueOverlay: ResidueOverlayUpdate | null;
  residueOverlayVisible: boolean;
  rendererInfo: string;
  notification: { kind: "success" | "error" | "info"; text: string } | null;
  camera: Camera;
  viewport: { width: number; height: number };
  history: string[];
  future: string[];
  setModule: (module: ModuleId) => void;
  setTool: (tool: ToolId) => void;
  setPreviewBackground: (background: PreviewBackground) => void;
  setCustomBackgroundColor: (color: string) => void;
  setDocument: (document: StudioDocument | null) => void;
  updateDocument: (patch: Partial<StudioDocument>) => void;
  setAlphaAnalysis: (analysis: AlphaAnalysis | null) => void;
  setAlphaStatus: (status: StudioState["alphaStatus"], error?: string | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setActiveJob: (job: JobSnapshot | null) => void;
  setTransparencyFlow: (flow: TransparencyFlowState) => void;
  setVisualReviewComplete: (complete: boolean) => void;
  setResidueMask: (summary: MaskSummary) => void;
  setResidueMaskMode: (mode: MaskMode) => void;
  setResidueBrushSize: (size: number) => void;
  setResidueOverlay: (overlay: Omit<ResidueOverlayUpdate, "revision">) => void;
  clearResidueOverlay: () => void;
  setResidueOverlayVisible: (visible: boolean) => void;
  setRendererInfo: (info: string) => void;
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
  customBackgroundColor: "#31506b",
  document: null,
  alphaAnalysis: null,
  alphaStatus: "idle",
  alphaError: null,
  alphaRegionIndex: 0,
  previewMode: "original",
  activeJob: null,
  transparencyFlow: "unprocessed",
  visualReviewComplete: false,
  residueMask: { selectedPixels: 0, selectedRegions: 0, hasSelection: false, canUndo: false, canRedo: false },
  residueMaskMode: "add",
  residueBrushSize: 24,
  residueOverlay: null,
  residueOverlayVisible: true,
  rendererInfo: "Inicializando GPU",
  notification: null,
  camera: initialCamera,
  viewport: { width: 900, height: 600 },
  history: [],
  future: [],
  setModule: (activeModule) => set({ activeModule }),
  setTool: (activeTool) => set({ activeTool }),
  setPreviewBackground: (previewBackground) => set({ previewBackground }),
  setCustomBackgroundColor: (customBackgroundColor) => set({ customBackgroundColor, previewBackground: "custom" }),
  setDocument: (document) => {
    const previous = get().document;
    if (previous?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(previous.previewUrl);
    set({ document, alphaAnalysis: null, alphaStatus: "idle", alphaError: null, alphaRegionIndex: 0, previewMode: "original", activeJob: null, transparencyFlow: "unprocessed", visualReviewComplete: false, residueMask: { selectedPixels: 0, selectedRegions: 0, hasSelection: false, canUndo: false, canRedo: false }, residueOverlay: null, residueOverlayVisible: true, history: document ? [`Abrir ${document.name}`] : [], future: [] });
    queueMicrotask(() => get().fitDocument());
  },
  updateDocument: (patch) => set((state) => ({ document: state.document ? { ...state.document, ...patch } : null })),
  setAlphaAnalysis: (alphaAnalysis) => set({ alphaAnalysis, alphaRegionIndex: 0 }),
  setAlphaStatus: (alphaStatus, alphaError = null) => set({ alphaStatus, alphaError }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setActiveJob: (activeJob) => set({ activeJob }),
  setTransparencyFlow: (transparencyFlow) => set({ transparencyFlow }),
  setVisualReviewComplete: (visualReviewComplete) => set({ visualReviewComplete }),
  setResidueMask: (residueMask) => set({ residueMask }),
  setResidueMaskMode: (residueMaskMode) => set({ residueMaskMode }),
  setResidueBrushSize: (residueBrushSize) => set({ residueBrushSize: Math.max(1, Math.min(500, Math.round(residueBrushSize))) }),
  setResidueOverlay: (overlay) => set((state) => ({ residueOverlay: { ...overlay, revision: (state.residueOverlay?.revision ?? 0) + 1 }, residueOverlayVisible: true })),
  clearResidueOverlay: () => set((state) => ({ residueOverlay: state.document ? { revision: (state.residueOverlay?.revision ?? 0) + 1, documentId: state.document.id, width: state.document.width, height: state.document.height, clear: true } : null, residueOverlayVisible: true })),
  setResidueOverlayVisible: (residueOverlayVisible) => set({ residueOverlayVisible }),
  setRendererInfo: (rendererInfo) => set({ rendererInfo }),
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
