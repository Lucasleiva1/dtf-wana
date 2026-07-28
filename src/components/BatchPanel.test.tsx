// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { BatchQueueStrip, useBatchController, type BatchController } from "./BatchPanel";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

describe("batch folder selection", () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
    vi.mocked(invoke).mockReset();
  });

  it("uses the selected input folder as the initial output folder", async () => {
    vi.mocked(open).mockResolvedValue("C:\\lote");
    vi.mocked(invoke).mockResolvedValue([]);
    const { result } = renderHook(() => useBatchController());

    await act(() => result.current.selectInputFolder());

    expect(result.current.inputFolder).toBe("C:\\lote");
    expect(result.current.outputFolder).toBe("C:\\lote");
  });

  it("lets the empty queue open the input-folder picker", () => {
    const selectInputFolder = vi.fn().mockResolvedValue(undefined);
    const batch = {
      queue: [],
      completed: 0,
      running: false,
      scanning: false,
      selectInputFolder,
    } as unknown as BatchController;

    render(<BatchQueueStrip batch={batch} />);
    fireEvent.click(screen.getByRole("button", { name: /Agregar carpeta de entrada/i }));

    expect(selectInputFolder).toHaveBeenCalledOnce();
    expect(document.querySelector(".batch-queue-list")?.classList.contains("dragging")).toBe(false);
  });
});
