import type { PageDistribution } from "@/state/reflowStore";

/** Parse "1, 4, 10-15" into sorted unique 1-indexed page numbers. */
export function parseCustomRange(text: string, maxPage: number): number[] {
  const nums = new Set<number>();
  text.split(",").forEach((segment) => {
    const trimmed = segment.trim();
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const from = Math.max(1, parseInt(range[1]));
      const to = Math.min(maxPage, parseInt(range[2]));
      for (let i = from; i <= to; i++) nums.add(i);
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed);
      if (n >= 1 && n <= maxPage) nums.add(n);
    }
  });
  return [...nums].sort((a, b) => a - b);
}

/** Return 0-indexed page indices for all pages belonging to the given surah. */
export function resolveBysurah(surahNum: number, distribution: PageDistribution[]): number[] {
  return distribution
    .map((d, i) => (d.surah === surahNum ? i : -1))
    .filter((i) => i >= 0);
}

/** Return 0-indexed page indices for all pages in the given para (juz). */
export function resolveByPara(paraNum: number, distribution: PageDistribution[]): number[] {
  return distribution
    .map((d, i) => (d.para === paraNum ? i : -1))
    .filter((i) => i >= 0);
}
