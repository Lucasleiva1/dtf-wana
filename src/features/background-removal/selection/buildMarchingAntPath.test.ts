import { describe, expect, it } from "vitest";
import { buildMarchingAntPath } from "./buildMarchingAntPath";

describe("buildMarchingAntPath", () => {
  it("une segmentos desordenados en un contorno cerrado", () => {
    expect(buildMarchingAntPath([
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 1, x2: 0, y2: 1 },
      { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 0, y1: 1, x2: 0, y2: 0 },
    ])).toBe("M0 0L1 0L1 1L0 1L0 0Z");
  });

  it("mantiene islas separadas", () => {
    const result = buildMarchingAntPath([
      { x1: 0, y1: 0, x2: 1, y2: 0 }, { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 1, y1: 1, x2: 0, y2: 1 }, { x1: 0, y1: 1, x2: 0, y2: 0 },
      { x1: 3, y1: 3, x2: 4, y2: 3 }, { x1: 4, y1: 3, x2: 4, y2: 4 },
      { x1: 4, y1: 4, x2: 3, y2: 4 }, { x1: 3, y1: 4, x2: 3, y2: 3 },
    ]);
    expect(result.match(/M/g)).toHaveLength(2);
    expect(result.match(/Z/g)).toHaveLength(2);
  });
});
