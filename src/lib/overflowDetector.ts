/**
 * Overflow Detector
 * -----------------
 * Detects whether a typography patch (fontPx, leading, etc.) would cause
 * text to overflow its containing row for a given set of scoped pages.
 *
 * Used by the typography apply flow to show a confirmation dialog before
 * triggering a cross-page reflow cascade.
 */
import { getDomSlots } from "@/lib/textReflow";
import { splitToFit } from "@/lib/textReflow";
import type { PageData } from "@/data/pages";
import type { LocalOverride, LocalKey } from "@/state/overridesStore";

export type OverflowResult = {
  hasOverflow: boolean;
  /** Page IDs that have at least one overflowing row */
  affectedPageIds: string[];
  /** Total number of rows that would overflow */
  overflowRowCount: number;
};

/**
 * Simulates applying a typography patch and checks whether any text would
 * overflow its row. Returns a summary of affected pages and row count.
 */
export function detectTypographyOverflow(
  scopedPageIds: string[],
  layerKind: "arabic" | "bangla",
  patch: Partial<LocalOverride>,
  pages: PageData[],
  localMap: Record<LocalKey, LocalOverride>,
  layerKeyFn: (pid: string, ri: number, layer: string) => string,
  fontFamily: string,
  baseFontSize: number,
  availableWidth: number,
): OverflowResult {
  const affectedPageIds: string[] = [];
  let overflowRowCount = 0;

  for (const pid of scopedPageIds) {
    const page = pages.find((p) => p.id === pid);
    if (!page) continue;

    const slots = getDomSlots(page);
    let pageHasOverflow = false;

    for (let ri = 0; ri < slots.length; ri++) {
      const slot = slots[ri];
      // Skip slots that don't have this layer
      if (layerKind === "arabic" && slot.arabic === undefined) continue;
      if (layerKind === "bangla" && slot.bangla === undefined) continue;

      const lk = layerKeyFn(pid, ri, layerKind);
      const existingOv = localMap[lk] ?? {};
      // Merge the proposed patch on top of existing override
      const mergedOv = { ...existingOv, ...patch };

      const text = existingOv.text
        ?? (layerKind === "arabic" ? slot.arabic : slot.bangla)
        ?? "";

      if (!text.trim()) continue;

      // Use merged fontPx for measurement
      const effectiveFontPx = mergedOv.fontPx ?? baseFontSize;
      // For area text with areaHeight, we'd need area split — skip for now
      // (area text manages its own height, no cascade)
      if (mergedOv.textMode === "area") continue;

      const { overflow } = splitToFit(text, availableWidth, fontFamily, effectiveFontPx);
      if (overflow.trim()) {
        overflowRowCount++;
        pageHasOverflow = true;
      }
    }

    if (pageHasOverflow) affectedPageIds.push(pid);
  }

  return {
    hasOverflow: overflowRowCount > 0,
    affectedPageIds,
    overflowRowCount,
  };
}
