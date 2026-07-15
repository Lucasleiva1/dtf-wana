import type { StudioDocument } from "../types/document";
import { uploadDocument } from "../lib/alphaService";

const accepted = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"]);

export async function importImageFile(file: File): Promise<StudioDocument> {
  if (!accepted.has(file.type) && !/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)) {
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

function decodeDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
    image.src = url;
  });
}
