import { describe, expect, it } from "vitest";
import { loadRenderDevice, persistRenderDevice, renderDeviceStorageKey } from "./renderDevice";

describe("render device preference", () => {
  it("uses GPU by default and rejects unknown stored values", () => {
    expect(loadRenderDevice()).toBe("gpu");
    expect(loadRenderDevice({ getItem: () => null })).toBe("gpu");
    expect(loadRenderDevice({ getItem: () => "other" })).toBe("gpu");
  });

  it("loads CPU when explicitly selected", () => {
    expect(loadRenderDevice({ getItem: () => "cpu" })).toBe("cpu");
  });

  it("persists the selected device under the versioned key", () => {
    let saved: [string, string] | null = null;
    persistRenderDevice("cpu", { setItem: (key, value) => { saved = [key, value]; } });
    expect(saved).toEqual([renderDeviceStorageKey, "cpu"]);
  });
});
