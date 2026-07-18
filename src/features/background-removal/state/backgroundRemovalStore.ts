import { create } from "zustand";
import type {
  BackgroundEraserSettings, BackgroundRemovalSummary, BackgroundView, BoundarySegment, CleanupSettings,
  ModelStatus, OutputAlphaMode, RefineSettings, SelectionMode, WandSettings,
} from "../types";
import { emptyBackgroundSummary } from "../types";

type BackgroundRemovalState = {
  documentId: string | null;
  summary: BackgroundRemovalSummary;
  selectionMode: SelectionMode;
  view: BackgroundView;
  outputAlpha: OutputAlphaMode;
  quickMask: boolean;
  overlayVisible: boolean;
  showMarchingAnts: boolean;
  brushSize: number;
  brushOpacity: number;
  wand: WandSettings;
  refine: RefineSettings;
  cleanup: CleanupSettings;
  eraser: BackgroundEraserSettings;
  contours: BoundarySegment[];
  visualRevision: number;
  busy: string | null;
  error: string | null;
  model: ModelStatus | null;
  resetForDocument: (documentId: string | null) => void;
  setSummary: (summary: BackgroundRemovalSummary) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  setView: (view: BackgroundView) => void;
  setOutputAlpha: (mode: OutputAlphaMode) => void;
  setQuickMask: (enabled: boolean) => void;
  setOverlayVisible: (visible: boolean) => void;
  setShowMarchingAnts: (visible: boolean) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  setWand: (patch: Partial<WandSettings>) => void;
  setRefine: (patch: Partial<RefineSettings>) => void;
  setCleanup: (patch: Partial<CleanupSettings>) => void;
  setEraser: (patch: Partial<BackgroundEraserSettings>) => void;
  setContours: (contours: BoundarySegment[]) => void;
  refreshVisual: () => void;
  setBusy: (busy: string | null) => void;
  setError: (error: string | null) => void;
  setModel: (model: ModelStatus) => void;
};

export const defaultWandSettings: WandSettings = {
  tolerance: 18,
  contiguous: true,
  antiAlias: true,
  connectivity: 8,
  minimumRegionSize: 1,
  protectEdges: true,
  stopAtStrongEdge: true,
  edgeBarrierStrength: 65,
  luminanceRange: 100,
  saturationRange: 100,
  preciseColor: false,
  sampleAllVisibleLayers: false,
};

export const defaultRefineSettings: RefineSettings = {
  radius: 6,
  sensitivity: 55,
  smoothness: 2,
  contrast: 12,
  shift: 0,
  preserveHair: true,
  preserveFineLines: true,
  protectCorners: true,
};

export const defaultCleanupSettings: CleanupSettings = {
  minimumParticleSize: 24,
  fillHoles: true,
  removeIslands: true,
};

export const defaultEraserSettings: BackgroundEraserSettings = {
  tolerance: 22,
  findEdges: true,
  protectForeground: true,
  samplingOnce: true,
};

export const useBackgroundRemovalStore = create<BackgroundRemovalState>((set) => ({
  documentId: null,
  summary: emptyBackgroundSummary,
  selectionMode: "new",
  view: "selection",
  outputAlpha: "natural",
  quickMask: false,
  overlayVisible: false,
  showMarchingAnts: true,
  brushSize: 32,
  brushOpacity: 1,
  wand: defaultWandSettings,
  refine: defaultRefineSettings,
  cleanup: defaultCleanupSettings,
  eraser: defaultEraserSettings,
  contours: [],
  visualRevision: 0,
  busy: null,
  error: null,
  model: null,
  resetForDocument: (documentId) => set((state) => documentId === state.documentId ? state : ({ documentId, summary: emptyBackgroundSummary, contours: [], visualRevision: state.visualRevision + 1, busy: null, error: null })),
  setSummary: (summary) => set((state) => ({ summary, visualRevision: state.visualRevision + 1 })),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setView: (view) => set((state) => ({ view, quickMask: view === "quick_mask", visualRevision: state.visualRevision + 1 })),
  setOutputAlpha: (outputAlpha) => set((state) => ({ outputAlpha, visualRevision: state.visualRevision + 1 })),
  setQuickMask: (quickMask) => set((state) => ({ quickMask, view: quickMask ? "quick_mask" : "selection", visualRevision: state.visualRevision + 1 })),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setShowMarchingAnts: (showMarchingAnts) => set({ showMarchingAnts }),
  setBrushSize: (brushSize) => set({ brushSize: Math.max(1, Math.min(500, Math.round(brushSize))) }),
  setBrushOpacity: (brushOpacity) => set({ brushOpacity: Math.max(0.05, Math.min(1, brushOpacity)) }),
  setWand: (patch) => set((state) => ({ wand: { ...state.wand, ...patch } })),
  setRefine: (patch) => set((state) => ({ refine: { ...state.refine, ...patch } })),
  setCleanup: (patch) => set((state) => ({ cleanup: { ...state.cleanup, ...patch } })),
  setEraser: (patch) => set((state) => ({ eraser: { ...state.eraser, ...patch } })),
  setContours: (contours) => set({ contours }),
  refreshVisual: () => set((state) => ({ visualRevision: state.visualRevision + 1 })),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  setModel: (model) => set({ model }),
}));
