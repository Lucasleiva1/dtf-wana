// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorZone } from "./InspectorZone";

describe("InspectorZone pointer reordering", () => {
  it("starts, tracks and commits a pointer drag beyond the movement threshold", () => {
    const onDragStart = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const view = render(<InspectorZone
      id="alpha"
      title="Tratamiento de transparencias"
      summary="Sin analizar"
      icon={<span />}
      collapsed
      dragging={false}
      dropPosition={null}
      onToggle={vi.fn()}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    ><div /></InspectorZone>);

    const header = view.container.querySelector(".inspector-zone-header")!;
    fireEvent.pointerDown(header, { button: 0, pointerId: 7, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 22, clientY: 33 });
    expect(onDragStart).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 20, clientY: 70 });
    expect(onDragStart).toHaveBeenCalledWith("alpha", 20, 70);
    expect(onDragMove).toHaveBeenLastCalledWith(20, 70);
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 20, clientY: 70 });
    expect(onDragEnd).toHaveBeenCalledWith(true);
  });
});
