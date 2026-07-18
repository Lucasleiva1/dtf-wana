import type { BoundarySegment } from "../types";

type Direction = 0 | 1 | 2 | 3;

const pointKey = (x: number, y: number) => `${x},${y}`;

function directionOf(segment: BoundarySegment): Direction {
  if (segment.x2 > segment.x1) return 0;
  if (segment.y2 > segment.y1) return 1;
  if (segment.x2 < segment.x1) return 2;
  return 3;
}

function chooseContinuation(
  candidates: number[],
  segments: BoundarySegment[],
  used: Uint8Array,
  previousDirection: Direction,
): number | undefined {
  const turnPreference = [1, 0, 3, 2];
  let best: number | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const index of candidates) {
    if (used[index] !== 0) continue;
    const turn = (directionOf(segments[index]) - previousDirection + 4) % 4;
    const rank = turnPreference.indexOf(turn);
    if (rank < bestRank) {
      best = index;
      bestRank = rank;
    }
  }
  return best;
}

/** Une los bordes por píxel para que la fase de las rayas recorra el contorno completo. */
export function buildMarchingAntPath(segments: BoundarySegment[]): string {
  if (segments.length === 0) return "";
  const starts = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    const key = pointKey(segment.x1, segment.y1);
    const list = starts.get(key);
    if (list) list.push(index);
    else starts.set(key, [index]);
  });

  const used = new Uint8Array(segments.length);
  const paths: string[] = [];
  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    if (used[startIndex]) continue;
    const first = segments[startIndex];
    const startKey = pointKey(first.x1, first.y1);
    let current = first;
    let path = `M${first.x1} ${first.y1}L${first.x2} ${first.y2}`;
    used[startIndex] = 1;

    while (pointKey(current.x2, current.y2) !== startKey) {
      const candidates = starts.get(pointKey(current.x2, current.y2));
      if (!candidates) break;
      const nextIndex = chooseContinuation(candidates, segments, used, directionOf(current));
      if (nextIndex === undefined) break;
      current = segments[nextIndex];
      used[nextIndex] = 1;
      path += `L${current.x2} ${current.y2}`;
    }
    if (pointKey(current.x2, current.y2) === startKey) path += "Z";
    paths.push(path);
  }
  return paths.join("");
}
