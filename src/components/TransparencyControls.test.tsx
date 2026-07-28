// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdvancedOptions, ProtectionQuickControls, ZeroAlphaState, protectionPreset } from "./Inspector";

describe("compact transparency controls", () => {
  it("maps the two quick actions to the existing protection options", () => {
    expect(protectionPreset("protect", ["region-1"])).toEqual({
      protectConnectedTexture: true,
      protectFineLines: true,
      protectGrunge: true,
      onlyIsolatedParticles: false,
      preservedRegionIds: ["region-1"],
    });
    expect(protectionPreset("none", ["region-1"])).toEqual({
      protectConnectedTexture: false,
      protectFineLines: false,
      protectGrunge: false,
      onlyIsolatedParticles: false,
      preservedRegionIds: [],
    });
  });

  it("offers protect and no-protection without hiding the advanced controls permanently", () => {
    const onSelect = vi.fn();
    const view = render(<>
      <ProtectionQuickControls protections={protectionPreset("protect")} onSelect={onSelect} />
      <AdvancedOptions label="Avanzado de protección"><span>Protección individual</span></AdvancedOptions>
    </>);

    fireEvent.click(screen.getByRole("button", { name: /No proteger nada/i }));
    expect(onSelect).toHaveBeenCalledWith("none");

    const details = view.container.querySelector("details");
    expect(details?.open).toBe(false);
    fireEvent.click(screen.getByText("Avanzado de protección"));
    expect(details?.open).toBe(true);
    expect(screen.getByText("Protección individual")).toBeTruthy();
  });

  it("turns the ready state into a clickable export action", () => {
    const onExport = vi.fn();
    render(<ZeroAlphaState visualReviewed onReviewed={vi.fn()} onView={vi.fn()} onExport={onExport} />);

    fireEvent.click(screen.getByRole("button", { name: "Listo para exportar" }));

    expect(onExport).toHaveBeenCalledOnce();
  });
});
