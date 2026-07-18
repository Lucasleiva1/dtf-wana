import type { PlacedImage, StudioDocument } from "../types/document";

/** Converts the source image's physical size to the pixel grid of the target artboard. */
export function naturalPlacedSize(image: Pick<PlacedImage, "sourceWidth" | "sourceHeight" | "sourcePpi">, artboardPpi: number) {
  const sourcePpi = positivePpi(image.sourcePpi, artboardPpi);
  return {
    width: image.sourceWidth * artboardPpi / sourcePpi,
    height: image.sourceHeight * artboardPpi / sourcePpi,
  };
}

/** Keeps the existing artboard and places an imported image at its real physical size, centered. */
export function placeImageOnExistingArtboard(imported: StudioDocument, current: StudioDocument): StudioDocument {
  if (!current.artboard || !imported.placedImage) return imported;
  const sourcePpi = positivePpi(imported.placedImage.sourcePpi, imported.artboard?.ppi ?? 300);
  const natural = naturalPlacedSize({ ...imported.placedImage, sourcePpi }, current.artboard.ppi);
  return {
    ...imported,
    name: current.name,
    artboard: current.artboard,
    guides: current.guides,
    placedImage: {
      ...imported.placedImage,
      sourcePpi,
      x: (current.artboard.widthPx - natural.width) / 2,
      y: (current.artboard.heightPx - natural.height) / 2,
      width: natural.width,
      height: natural.height,
      lockAspect: true,
    },
    dirty: true,
  };
}

/** Removes only the placed image while preserving the current artboard and its precision aids. */
export function documentWithoutPlacedImage(current: StudioDocument): StudioDocument {
  const artboard = current.artboard;
  if (!artboard) return current;
  const emptyFile = new File([], `${current.name}.dtf`, { type: "application/x-dtf-project" });
  return {
    ...current,
    mimeType: emptyFile.type,
    sizeBytes: 0,
    width: artboard.widthPx,
    height: artboard.heightPx,
    previewUrl: "",
    sourceFile: emptyFile,
    renderBlob: emptyFile,
    renderRevision: 0,
    format: "Documento DTF",
    revision: 0,
    dirty: true,
    engineReady: false,
    placedImage: null,
    sourcePath: undefined,
    ppiAssumed: false,
  };
}

/** Assigns an explicit source resolution without creating or deleting raster pixels. */
export function assignPlacedImagePpi(document: StudioDocument, targetPpi: number): StudioDocument {
  const image = document.placedImage;
  const artboard = document.artboard;
  if (!image || !artboard || !Number.isFinite(targetPpi) || targetPpi <= 0) return document;
  const centerX = image.x + image.width / 2;
  const centerY = image.y + image.height / 2;
  const natural = naturalPlacedSize({ ...image, sourcePpi: targetPpi }, artboard.ppi);
  return {
    ...document,
    placedImage: {
      ...image,
      sourcePpi: targetPpi,
      width: natural.width,
      height: natural.height,
      x: centerX - natural.width / 2,
      y: centerY - natural.height / 2,
      lockAspect: true,
    },
    ppiAssumed: false,
    dirty: true,
  };
}

function positivePpi(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}
