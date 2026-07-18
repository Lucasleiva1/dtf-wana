import type { StudioDocument } from "../types/document";
import { uploadDocument } from "../lib/alphaService";
import { invoke } from "@tauri-apps/api/core";

const accepted = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"]);

export function isAcceptedImageFile(file: Pick<File, "name" | "type">): boolean {
  return accepted.has(file.type) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name);
}

export async function importImageFile(file: File): Promise<StudioDocument> {
  if (!isAcceptedImageFile(file)) {
    throw new Error("Formato no admitido en esta etapa. Usá PNG, JPG, WebP, TIFF o BMP.");
  }
  const previewUrl = URL.createObjectURL(file);
  try {
    const dimensions = await decodeDimensions(previewUrl);
    const detectedPpi = await detectImagePpi(file);
    const ppi = detectedPpi ?? 300;
    const id = crypto.randomUUID();
    const engine = await uploadDocument(file, id);
    return {
      id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      width: engine?.width ?? dimensions.width,
      height: engine?.height ?? dimensions.height,
      previewUrl,
      sourceFile: file,
      renderBlob: file,
      renderRevision: 0,
      format: engine?.format ?? file.type.replace("image/", "").toUpperCase(),
      bitDepth: engine?.bitDepth ?? 8,
      revision: engine?.revision ?? 0,
      dirty: false,
      engineReady: true,
      artboard: {
        id: `${id}-artboard`,
        name: "Mesa 1",
        widthPx: engine?.width ?? dimensions.width,
        heightPx: engine?.height ?? dimensions.height,
        ppi,
        preferredUnit: "cm",
        background: "transparent",
      },
      placedImage: {
        id: `${id}-image`,
        name: file.name,
        sourceWidth: engine?.width ?? dimensions.width,
        sourceHeight: engine?.height ?? dimensions.height,
        sourcePpi: ppi,
        x: 0,
        y: 0,
        width: engine?.width ?? dimensions.width,
        height: engine?.height ?? dimensions.height,
        rotation: 0,
        lockAspect: true,
        visible: true,
        transformLocked: false,
        contentLocked: false,
        maskLocked: false,
        transparencyProtected: true,
      },
      guides: [],
      colorProfile: "sRGB",
      ppiAssumed: detectedPpi === null,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export async function importDroppedImagePath(path: string): Promise<StudioDocument> {
  const bytes = await invoke<ArrayBuffer>("read_dropped_image", { path });
  const name = fileNameFromPath(path);
  const document = await importImageFile(new File([bytes], name, { type: mimeFromName(name) }));
  return { ...document, sourcePath: path };
}

export async function closeEngineDocument(documentId: string): Promise<void> {
  await invoke("close_document", { documentId });
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "imagen.png";
}

function mimeFromName(name: string): string {
  const extension = name.split(".").at(-1)?.toLowerCase();
  return {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
  }[extension ?? ""] ?? "application/octet-stream";
}

function decodeDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
    image.src = url;
  });
}

/** Reads physical-resolution metadata without decoding or altering image pixels. */
export async function detectImagePpi(file: Blob): Promise<number | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length >= 33 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (type === "pHYs" && length >= 9 && offset + 17 <= bytes.length && bytes[offset + 16] === 1) {
        const xPpm = view.getUint32(offset + 8);
        const yPpm = view.getUint32(offset + 12);
        const average = (xPpm + yPpm) / 2 * 0.0254;
        return average > 0 && Number.isFinite(average) ? Number(average.toFixed(3)) : null;
      }
      offset += 12 + length;
    }
  }
  if (bytes.length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker === 0xe0 && length >= 14 && String.fromCharCode(...bytes.subarray(offset + 4, offset + 9)) === "JFIF\0") {
        const units = bytes[offset + 11];
        const xDensity = (bytes[offset + 12] << 8) | bytes[offset + 13];
        const yDensity = (bytes[offset + 14] << 8) | bytes[offset + 15];
        const density = (xDensity + yDensity) / 2;
        if (density > 0 && units === 1) return density;
        if (density > 0 && units === 2) return Number((density * 2.54).toFixed(3));
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}
