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
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export async function importDroppedImagePath(path: string): Promise<StudioDocument> {
  const bytes = await invoke<ArrayBuffer>("read_dropped_image", { path });
  const name = fileNameFromPath(path);
  return importImageFile(new File([bytes], name, { type: mimeFromName(name) }));
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
