import { useEffect, useMemo, useRef, useState } from "react";
import { artboardFor, formatMeasurement, measurementToPixels } from "../lib/measurements";
import { useStudioStore } from "../stores/studioStore";
import type { GuideOrientation } from "../types/document";

type DragGuide = { id?: string; orientation: GuideOrientation; position: number; returnToRuler: boolean; snappedCenter?: boolean };
const candidateSteps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const RULER_SIZE = 22;

export function PrecisionOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const document = useStudioStore((state) => state.document);
  const camera = useStudioStore((state) => state.camera);
  const viewport = useStudioStore((state) => state.viewport);
  const showRulers = useStudioStore((state) => state.showRulers);
  const showGuides = useStudioStore((state) => state.showGuides);
  const guidesLocked = useStudioStore((state) => state.guidesLocked);
  const selectedGuideId = useStudioStore((state) => state.selectedGuideId);
  const addGuide = useStudioStore((state) => state.addGuide);
  const updateGuide = useStudioStore((state) => state.updateGuide);
  const removeGuide = useStudioStore((state) => state.removeGuide);
  const setSelectedGuide = useStudioStore((state) => state.setSelectedGuide);
  const setShowGuides = useStudioStore((state) => state.setShowGuides);
  const [drag, setDrag] = useState<DragGuide | null>(null);
  const dragRef = useRef<DragGuide | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; guideId: string } | null>(null);
  const artboard = document ? artboardFor(document) : null;
  const unit = artboard?.preferredUnit ?? "px";
  const unitPixels = artboard ? measurementToPixels(1, unit, artboard.ppi) : 1;
  const step = candidateSteps.find((value) => value * unitPixels * camera.zoom >= 58) ?? 2000;
  const horizontalTicks = useMemo(() => artboard ? makeAxisTicks(viewport.width, camera.x, camera.zoom, artboard.widthPx / 2, unitPixels, step) : [], [artboard?.widthPx, viewport.width, camera.x, camera.zoom, unitPixels, step]);
  const verticalTicks = useMemo(() => artboard ? makeAxisTicks(viewport.height, camera.y, camera.zoom, artboard.heightPx / 2, unitPixels, step) : [], [artboard?.heightPx, viewport.height, camera.y, camera.zoom, unitPixels, step]);

  useEffect(() => {
    if (!drag || !artboard) return;
    const move = (event: PointerEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const current = dragRef.current;
      if (!current) return;
      const screen = current.orientation === "vertical" ? screenX : screenY;
      const origin = current.orientation === "vertical" ? camera.x : camera.y;
      const returnToRuler = current.orientation === "horizontal" ? screenY <= RULER_SIZE : screenX <= RULER_SIZE;
      const rawPosition = (screen - origin) / camera.zoom;
      const center = current.orientation === "vertical" ? artboard.widthPx / 2 : artboard.heightPx / 2;
      const centerSnap = snapGuideToCenter(rawPosition, center, camera.zoom, returnToRuler);
      const snappedCenter = centerSnap.snapped;
      const position = centerSnap.position;
      const next = { ...current, position, returnToRuler, snappedCenter };
      dragRef.current = next;
      setDrag(next);
      if (current.id && !returnToRuler) updateGuide(current.id, position);
    };
    const up = () => {
      const current = dragRef.current;
      if (!current) return;
      if (current.returnToRuler) {
        if (current.id) removeGuide(current.id);
      } else if (!current.id) {
        addGuide({ orientation: current.orientation, position: current.position });
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag, artboard, camera.x, camera.y, camera.zoom, addGuide, removeGuide, updateGuide]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!selectedGuideId || guidesLocked || (event.target as HTMLElement).matches("input, textarea, select")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeGuide(selectedGuideId);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [guidesLocked, removeGuide, selectedGuideId]);

  if (!document || !artboard) return null;
  const guides = showGuides ? (document.guides ?? []) : [];
  const displayGuides = drag && !drag.id && !drag.returnToRuler ? [...guides, { ...drag, id: "preview" }] : guides;
  return <div ref={rootRef} className={`precision-overlay${showRulers ? " rulers-visible" : ""}`} onPointerDown={() => setContextMenu(null)}>
    {showRulers && <>
      <div className="ruler-corner" title={`Origen central · ${unit}`}>{unit}</div>
      <div className="ruler ruler-horizontal" onPointerDown={(event) => {
        event.preventDefault();
        setShowGuides(true);
        setSelectedGuide(null);
        const next = { orientation: guideOrientationFromRuler("top"), position: (event.clientY - (rootRef.current?.getBoundingClientRect().top ?? 0) - camera.y) / camera.zoom, returnToRuler: true, snappedCenter: false };
        dragRef.current = next;
        setDrag(next);
      }}>
        {horizontalTicks.map((tick) => <i key={`${tick.value}-${tick.major}`} className={tick.major ? "major" : "minor"} style={{ left: tick.screen - RULER_SIZE }}>{tick.major && <span>{formatMeasurement(tick.value, unit, 3)}</span>}</i>)}
      </div>
      <div className="ruler ruler-vertical" onPointerDown={(event) => {
        event.preventDefault();
        setShowGuides(true);
        setSelectedGuide(null);
        const next = { orientation: guideOrientationFromRuler("left"), position: (event.clientX - (rootRef.current?.getBoundingClientRect().left ?? 0) - camera.x) / camera.zoom, returnToRuler: true, snappedCenter: false };
        dragRef.current = next;
        setDrag(next);
      }}>
        {verticalTicks.map((tick) => <i key={`${tick.value}-${tick.major}`} className={tick.major ? "major" : "minor"} style={{ top: tick.screen - RULER_SIZE }}>{tick.major && <span>{formatMeasurement(tick.value, unit, 3)}</span>}</i>)}
      </div>
    </>}
    {displayGuides.map((guide) => {
      const screenPosition = (guide.orientation === "vertical" ? camera.x : camera.y) + guide.position * camera.zoom;
      return <div
        key={guide.id}
        className={`document-guide ${guide.orientation}${selectedGuideId === guide.id ? " selected" : ""}${guidesLocked ? " locked" : ""}${drag?.snappedCenter && (drag.id === guide.id || guide.id === "preview") ? " snapped-center" : ""}`}
        style={guide.orientation === "vertical" ? { left: screenPosition } : { top: screenPosition }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (guide.id === "preview" || guidesLocked) return;
          setContextMenu(null);
          setSelectedGuide(guide.id);
          const next = { id: guide.id, orientation: guide.orientation, position: guide.position, returnToRuler: false, snappedCenter: false };
          dragRef.current = next;
          setDrag(next);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (guide.id !== "preview" && !guidesLocked) {
            setSelectedGuide(guide.id);
            setContextMenu({ x: event.clientX - (rootRef.current?.getBoundingClientRect().left ?? 0), y: event.clientY - (rootRef.current?.getBoundingClientRect().top ?? 0), guideId: guide.id });
          }
        }}
        title={guidesLocked ? "Guías bloqueadas" : "Arrastrar para mover · Supr para eliminar"}
      >{drag?.snappedCenter && (drag.id === guide.id || guide.id === "preview") && <span className="guide-zero-indicator">0 · centro</span>}</div>;
    })}
    {contextMenu && <div className="guide-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}><button onClick={() => { removeGuide(contextMenu.guideId); setContextMenu(null); }}>Eliminar guía</button></div>}
  </div>;
}

export function guideOrientationFromRuler(ruler: "top" | "left"): GuideOrientation {
  return ruler === "top" ? "horizontal" : "vertical";
}

export function snapGuideToCenter(rawPosition: number, center: number, zoom: number, returningToRuler = false) {
  const snapped = !returningToRuler && Math.abs(rawPosition - center) <= 7 / Math.max(zoom, 0.001);
  return { position: snapped ? center : rawPosition, snapped };
}

export function makeAxisTicks(viewportSize: number, cameraOrigin: number, zoom: number, centerPixel: number, unitPixels: number, majorStep: number) {
  const minValue = ((RULER_SIZE - cameraOrigin) / zoom - centerPixel) / unitPixels;
  const maxValue = ((viewportSize - cameraOrigin) / zoom - centerPixel) / unitPixels;
  const minorStep = majorStep / 5;
  const first = Math.floor(minValue / minorStep) * minorStep;
  const ticks: Array<{ value: number; screen: number; major: boolean }> = [];
  for (let value = first; value <= maxValue + minorStep / 2 && ticks.length < 2000; value += minorStep) {
    const rounded = Number(value.toFixed(8));
    const normalized = Object.is(rounded, -0) ? 0 : rounded;
    const multiple = normalized / majorStep;
    const major = Math.abs(multiple - Math.round(multiple)) < 0.00001;
    ticks.push({ value: normalized, screen: cameraOrigin + (centerPixel + normalized * unitPixels) * zoom, major });
  }
  return ticks;
}
