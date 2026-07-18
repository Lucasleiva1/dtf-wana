import { describe, expect, it } from "vitest";
import { detectImagePpi } from "./importImage";

describe("image PPI metadata", () => {
  it("reads PNG pHYs pixels per metre", async () => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 9);
    bytes.set([0x70, 0x48, 0x59, 0x73], 12);
    view.setUint32(16, 11811);
    view.setUint32(20, 11811);
    bytes[24] = 1;
    expect(await detectImagePpi(new Blob([bytes], { type: "image/png" }))).toBeCloseTo(300, 1);
  });

  it("reads JPEG JFIF DPI", async () => {
    const bytes = new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x01,0x01,0x2c,0x01,0x2c,0x00,0x00]);
    expect(await detectImagePpi(new Blob([bytes], { type: "image/jpeg" }))).toBe(300);
  });
});
