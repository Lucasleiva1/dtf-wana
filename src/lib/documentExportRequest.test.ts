// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { requestDocumentExport, useDocumentExportRequest } from "./documentExportRequest";

describe("document export request", () => {
  it("routes secondary export actions to the shared export handler", () => {
    const handler = vi.fn();
    renderHook(() => useDocumentExportRequest(handler));

    requestDocumentExport();

    expect(handler).toHaveBeenCalledOnce();
  });
});
