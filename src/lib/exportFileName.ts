type RandomSource = () => number;

function browserRandom(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 0x1_0000_0000;
  }
  return Math.random();
}

export function formatDtfExportFileName(value: number): string {
  const normalized = Math.abs(Math.trunc(value)) % 100_000_000;
  return `DTF_${normalized.toString().padStart(8, "0")}.png`;
}

export function createDtfExportFileNameGenerator(random: RandomSource = browserRandom) {
  const generated = new Set<number>();
  let last = -1;

  return () => {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = Math.floor(Math.min(0.999999999, Math.max(0, random())) * 100_000_000);
      if (!generated.has(candidate)) {
        generated.add(candidate);
        last = candidate;
        return formatDtfExportFileName(candidate);
      }
    }
    last = (last + 1) % 100_000_000;
    while (generated.has(last)) last = (last + 1) % 100_000_000;
    generated.add(last);
    return formatDtfExportFileName(last);
  };
}

export const createDtfExportFileName = createDtfExportFileNameGenerator();
