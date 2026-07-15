import { beforeEach, describe, expect, it } from "vitest";
import { useStudioStore } from "./studioStore";
import type { StudioDocument } from "../types/document";

const documentFixture = (): StudioDocument => ({
  id: "performance-fixture",
  name: "large.png",
  mimeType: "image/png",
  sizeBytes: 1,
  width: 4488,
  height: 4488,
  previewUrl: "fixture",
  sourceFile: {} as File,
  renderBlob: new Blob(),
  renderRevision: 7,
  format: "PNG",
  bitDepth: 8,
  revision: 3,
  dirty: false,
});

describe("residue overlay state", () => {
  beforeEach(() => {
    useStudioStore.setState({
      document: documentFixture(),
      camera: { x: 123, y: 77, zoom: 0.5 },
      residueOverlay: null,
      residueOverlayVisible: true,
    });
  });

  it("updates a dirty tile without replacing the document or camera", () => {
    const before = useStudioStore.getState();
    before.setResidueOverlay({
      documentId: before.document!.id,
      width: before.document!.width,
      height: before.document!.height,
      tiles: [{ x: 512, y: 1024, width: 32, height: 24, bytes: new Uint8Array(32 * 24) }],
    });
    const after = useStudioStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.document?.renderRevision).toBe(7);
    expect(after.camera).toEqual({ x: 123, y: 77, zoom: 0.5 });
    expect(after.residueOverlay?.tiles?.[0].bytes).toHaveLength(32 * 24);
  });

  it("hides the overlay for before/after without changing its pixels", () => {
    const state = useStudioStore.getState();
    state.setResidueOverlay({
      documentId: state.document!.id,
      width: state.document!.width,
      height: state.document!.height,
      fullMask: new Uint8Array(64),
    });
    const overlay = useStudioStore.getState().residueOverlay;
    state.setResidueOverlayVisible(false);
    expect(useStudioStore.getState().residueOverlay).toBe(overlay);
    expect(useStudioStore.getState().residueOverlayVisible).toBe(false);
  });
});
