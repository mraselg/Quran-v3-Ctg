import type { PageData } from "@/data/pages";
import type { PageDistribution } from "@/state/reflowStore";

export type SurahPageRange = {
  pageId: string;
  /** 0-based row indices (inclusive) that belong to this surah on this page */
  startRow: number;
  endRow: number;
  /** Number of ayah-type rows on this page */
  lineCount: number;
};

export type SurahLineEntry = {
  surahNum: number;
  /** Total ayah rows across all pages */
  totalLines: number;
  /** Total pages this surah spans */
  pageCount: number;
  pageRanges: SurahPageRange[];
};

/** Map from surahNum → SurahLineEntry */
export type SurahLineMap = Map<number, SurahLineEntry>;

/**
 * Compute the SurahLineMap from the current page data and distribution.
 * Called after every rebuild and after every cross-page reflow.
 *
 * Strategy:
 *   - Walk distribution[] to get (pageId, surahNum) pairs
 *   - For each page in a surah, count ayah-type rows that "belong" to that surah
 *     using the startsSurah marker on FlowLine metadata
 *   - Accumulate into SurahLineEntry
 */
export function computeSurahLineMap(
  pages: PageData[],
  distribution: PageDistribution[],
): SurahLineMap {
  const map: SurahLineMap = new Map();

  for (const dist of distribution) {
    const page = pages.find((p) => p.id === dist.pageId);
    if (!page) continue;

    const surahNum = dist.surah;
    if (surahNum === 0) continue;

    let entry = map.get(surahNum);
    if (!entry) {
      entry = { surahNum, totalLines: 0, pageCount: 0, pageRanges: [] };
      map.set(surahNum, entry);
    }

    // Count ayah-type rows on this page
    const ayahRows = page.lines
      .map((l, i) => ({ line: l, index: i }))
      .filter(({ line }) => line.slotKind === "ayah");

    if (ayahRows.length === 0) continue;

    const startRow = ayahRows[0]!.index;
    const endRow = ayahRows[ayahRows.length - 1]!.index;

    entry.pageRanges.push({
      pageId: dist.pageId,
      startRow,
      endRow,
      lineCount: ayahRows.length,
    });
    entry.totalLines += ayahRows.length;
    entry.pageCount += 1;
  }

  return map;
}
