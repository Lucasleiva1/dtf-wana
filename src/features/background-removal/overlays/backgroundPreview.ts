import type { BackgroundView } from "../types";

const backgroundResultViews = new Set<BackgroundView>(["result", "result_white", "result_black", "result_gray", "mask", "alpha"]);

export function hidesOriginalForBackgroundPreview(module: string, view: BackgroundView): boolean {
  return module === "background" && backgroundResultViews.has(view);
}

/** Null means real transparency: the existing workspace must remain visible through the result. */
export function previewMatte(view: BackgroundView): string | null {
  if (view === "result") return null;
  if (view === "result_white") return "#ffffff";
  if (view === "result_black") return "#050505";
  if (view === "result_gray") return "#777777";
  if (view === "mask" || view === "alpha") return "#000000";
  return null;
}
