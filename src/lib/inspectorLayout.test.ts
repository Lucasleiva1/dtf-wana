import { describe, expect, it } from "vitest";
import { normalizeInspectorZoneLayout, placeInspectorZone } from "./inspectorLayout";

describe("inspector zone layout", () => {
  it("restores missing zones and safe collapse defaults", () => {
    expect(normalizeInspectorZoneLayout({ order: ["residue"], collapsed: { residue: false } })).toEqual({
      order: ["residue", "alpha"],
      collapsed: { alpha: false, residue: false },
    });
  });

  it("inserts a dragged zone before or after the marked line", () => {
    expect(placeInspectorZone(["alpha", "residue"], "residue", "alpha", "before")).toEqual(["residue", "alpha"]);
    expect(placeInspectorZone(["alpha", "residue"], "alpha", "residue", "after")).toEqual(["residue", "alpha"]);
  });
});
