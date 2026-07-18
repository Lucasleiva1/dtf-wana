import { beforeEach, describe, expect, it } from "vitest";
import { emptyBackgroundSummary } from "../types";
import { defaultWandSettings, useBackgroundRemovalStore } from "./backgroundRemovalStore";

describe("backgroundRemovalStore", () => {
  beforeEach(() => {
    useBackgroundRemovalStore.setState({
      documentId: null,
      summary: emptyBackgroundSummary,
      contours: [],
      visualRevision: 0,
      brushSize: 32,
      selectionMode: "new",
    });
  });

  it("uses professional edge-aware wand defaults", () => {
    expect(defaultWandSettings.preciseColor).toBe(false);
    expect(defaultWandSettings.contiguous).toBe(true);
    expect(defaultWandSettings.stopAtStrongEdge).toBe(true);
    expect(defaultWandSettings.connectivity).toBe(8);
  });

  it("shows Photoshop-style marching ants without a color overlay by default", () => {
    const store = useBackgroundRemovalStore.getState();
    expect(store.showMarchingAnts).toBe(true);
    expect(store.overlayVisible).toBe(false);
  });

  it("resets document-specific summaries without keeping mask buffers", () => {
    const store = useBackgroundRemovalStore.getState();
    store.resetForDocument("document-a");
    store.setSummary({ ...emptyBackgroundSummary, selectedPixels: 420, maskRevision: 3, canUndo: true });
    store.setContours([{ x1: 0, y1: 0, x2: 1, y2: 0 }]);
    useBackgroundRemovalStore.getState().resetForDocument("document-b");
    const next = useBackgroundRemovalStore.getState();
    expect(next.documentId).toBe("document-b");
    expect(next.summary).toEqual(emptyBackgroundSummary);
    expect(next.contours).toEqual([]);
    expect("maskBytes" in next).toBe(false);
  });

  it("clamps brush size to a safe image-space range", () => {
    useBackgroundRemovalStore.getState().setBrushSize(9000);
    expect(useBackgroundRemovalStore.getState().brushSize).toBe(500);
    useBackgroundRemovalStore.getState().setBrushSize(0);
    expect(useBackgroundRemovalStore.getState().brushSize).toBe(1);
  });
});
