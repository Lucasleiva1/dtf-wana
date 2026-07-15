export async function rgbaBytesToBitmap(bytes: ArrayBuffer, width: number, height: number): Promise<ImageBitmap> {
  const expected = width * height * 4;
  if (bytes.byteLength !== expected) {
    throw new Error(`La textura recibida tiene ${bytes.byteLength} bytes; se esperaban ${expected}.`);
  }
  return createImageBitmap(new ImageData(new Uint8ClampedArray(bytes), width, height));
}

