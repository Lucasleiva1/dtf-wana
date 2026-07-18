import { create } from "zustand";
import { clampZoom, fitRect, zoomAt } from "../canvas/camera";
import { loadRenderDevice, persistRenderDevice } from "../lib/renderDevice";
import { artboardFor } from "../lib/measurements";
import type { Camera, DocumentGuide, ModuleId, PlacedImage, PreviewBackground, RenderDevice, StudioDocument, ToolId } from "../types/document";
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
  renderDevice: RenderDevice;
  activeRenderDevice: RenderDevice | null;
  rendererInfo: string;
  showRulers: boolean;
  showGuides: boolean;
  guidesLocked: boolean;
  snapToGuides: boolean;
  smartGuidesEnabled: boolean;
  selectedItemId: string | null;
  selectedGuideId: string | null;
  transformPast: PlacedImage[];
  transformFuture: PlacedImage[];
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
  updatePlacedImage: (patch: Partial<PlacedImage>) => void;
  addGuide: (guide: Omit<DocumentGuide, "id">) => void;
  updateGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;
  clearGuides: () => void;
  setSelectedItem: (id: string | null) => void;
  setSelectedGuide: (id: string | null) => void;
  commitPlacedImageTransform: (before: PlacedImage) => void;
  undoPlacedImageTransform: () => void;
  redoPlacedImageTransform: () => void;
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
  setRenderDevice: (device: RenderDevice) => void;
  setActiveRenderDevice: (device: RenderDevice | null) => void;
  setRendererInfo: (info: string) => void;
  setShowRulers: (visible: boolean) => void;
  setShowGuides: (visible: boolean) => void;
  setGuidesLocked: (locked: boolean) => void;
  setSnapToGuides: (enabled: boolean) => void;
  setSmartGuidesEnabled: (enabled: boolean) => void;
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
const viewPreference = (key: string, fallback: boolean) => {
  if (typeof localStorage === "undefined") return fallback;
  const value = localStorage.getItem(`dtf.view.${key}`);
  return value === null ? fallback : value === "true";
};
const persistViewPreference = (key: string, value: boolean) => {
  if (typeof localStorage !== "undefined") localStorage.setItem(`dtf.view.${key}`, String(value));
};

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
  renderDevice: loadRenderDevice(typeof localStorage === "undefined" ? undefined : localStorage),
  activeRenderDevice: null,
  rendererInfo: "Inicializando renderizador",
  showRulers: viewPreference("rulers", true),
  showGuides: viewPreference("guides", true),
  guidesLocked: viewPreference("guidesLocked", false),
  snapToGuides: viewPreference("snapToGuides", true),
  smartGuidesEnabled: viewPreference("smartGuides", true),
  selectedItemId: null,
  selectedGuideId: null,
  transformPast: [],
  transformFuture: [],
  notification: null,
  camera: initialCamera,
  viewport: { width: 900, height: 600 },
  history: [],
  future: [],
  setModule: (activeModule) => set({ activeModule, activeTool: "select" }),
  setTool: (activeTool) => set({ activeTool }),
  setPreviewBackground: (previewBackground) => set({ previewBackground }),
  setCustomBackgroundColor: (customBackgroundColor) => set({ customBackgroundColor, previewBackground: "custom" }),
  setDocument: (document) => {
    const previous = get().document;
    if (previous?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(previous.previewUrl);
    if (typeof ImageBitmap !== "undefined" && previous?.renderBlob instanceof ImageBitmap) previous.renderBlob.close();
    set({ document, activeTool: "select", selectedItemId: document?.placedImage?.id ?? null, selectedGuideId: null, transformPast: [], transformFuture: [], alphaAnalysis: null, alphaStatus: "idle", alphaError: null, alphaRegionIndex: 0, previewMode: "original", activeJob: null, transparencyFlow: "unprocessed", visualReviewComplete: false, residueMask: { selectedPixels: 0, selectedRegions: 0, hasSelection: false, canUndo: false, canRedo: false }, residueOverlay: null, residueOverlayVisible: true, history: document ? [`Abrir ${document.name}`] : [], future: [], camera: document ? get().camera : initialCamera });
    queueMicrotask(() => get().fitDocument());
  },
  updateDocument: (patch) => set((state) => ({ document: state.document ? { ...state.document, ...patch } : null })),
  updatePlacedImage: (patch) => set((state) => state.document?.placedImage ? ({ document: { ...state.document, placedImage: { ...state.document.placedImage, ...patch }, dirty: true } }) : state),
  addGuide: (guide) => set((state) => {
    if (!state.document) return state;
    const created = { ...guide, id: crypto.randomUUID() };
    return { document: { ...state.document, guides: [...(state.document.guides ?? []), created], dirty: true }, selectedGuideId: created.id, selectedItemId: null };
  }),
  updateGuide: (id, position) => set((state) => state.document ? ({ document: { ...state.document, guides: (state.document.guides ?? []).map((guide) => guide.id === id ? { ...guide, position } : guide), dirty: true } }) : state),
  removeGuide: (id) => set((state) => state.document ? ({ document: { ...state.document, guides: (state.document.guides ?? []).filter((guide) => guide.id !== id), dirty: true }, selectedGuideId: state.selectedGuideId === id ? null : state.selectedGuideId }) : state),
  clearGuides: () => set((state) => state.document ? ({ document: { ...state.document, guides: [], dirty: true }, selectedGuideId: null }) : state),
  setSelectedItem: (selectedItemId) => set({ selectedItemId, selectedGuideId: selectedItemId ? null : get().selectedGuideId }),
  setSelectedGuide: (selectedGuideId) => set({ selectedGuideId, selectedItemId: selectedGuideId ? null : get().selectedItemId }),
  commitPlacedImageTransform: (before) => set((state) => {
    const current = state.document?.placedImage;
    if (!current || sameTransform(before, current)) return state;
    return { transformPast: [...state.transformPast, structuredClone(before)], transformFuture: [] };
  }),
  undoPlacedImageTransform: () => set((state) => {
    const current = state.document?.placedImage;
    const previous = state.transformPast.at(-1);
    if (!current || !previous || !state.document) return state;
    return { document: { ...state.document, placedImage: structuredClone(previous), dirty: true }, transformPast: state.transformPast.slice(0, -1), transformFuture: [structuredClone(current), ...state.transformFuture], selectedItemId: previous.id };
  }),
  redoPlacedImageTransform: () => set((state) => {
    const current = state.document?.placedImage;
    const next = state.transformFuture[0];
    if (!current || !next || !state.document) return state;
    return { document: { ...state.document, placedImage: structuredClone(next), dirty: true }, transformPast: [...state.transformPast, structuredClone(current)], transformFuture: state.transformFuture.slice(1), selectedItemId: next.id };
  }),
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
  setRenderDevice: (renderDevice) => {
    persistRenderDevice(renderDevice, typeof localStorage === "undefined" ? undefined : localStorage);
    set({ renderDevice, activeRenderDevice: null, rendererInfo: renderDevice === "gpu" ? "Inicializando GPU" : "Inicializando CPU" });
  },
  setActiveRenderDevice: (activeRenderDevice) => set({ activeRenderDevice }),
  setRendererInfo: (rendererInfo) => set({ rendererInfo }),
  setShowRulers: (showRulers) => { persistViewPreference("rulers", showRulers); set({ showRulers }); },
  setShowGuides: (showGuides) => { persistViewPreference("guides", showGuides); set({ showGuides }); },
  setGuidesLocked: (guidesLocked) => { persistViewPreference("guidesLocked", guidesLocked); set({ guidesLocked }); },
  setSnapToGuides: (snapToGuides) => { persistViewPreference("snapToGuides", snapToGuides); set({ snapToGuides }); },
  setSmartGuidesEnabled: (smartGuidesEnabled) => { persistViewPreference("smartGuides", smartGuidesEnabled); set({ smartGuidesEnabled }); },
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
    const artboard = artboardFor(document);
    set({ camera: fitRect(viewport, { width: artboard.widthPx, height: artboard.heightPx }) });
  },
  actualSize: () => {
    const { document, viewport } = get();
    if (!document) return;
    const artboard = artboardFor(document);
    set({ camera: { zoom: 1, x: (viewport.width - artboard.widthPx) / 2, y: (viewport.height - artboard.heightPx) / 2 } });
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

function sameTransform(a: PlacedImage, b: PlacedImage): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotation === b.rotation && a.lockAspect === b.lockAspect;
}
