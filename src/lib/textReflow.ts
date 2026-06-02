/**
 * Text Reflow Engine
 * ------------------
 * Handles dynamic text reflow across rows and pages in editor mode.
 * When text is added/modified in a row, overflow cascades to subsequent rows
 * and across page boundaries.
 *
 * PERFORMANCE NOTE: All text measurement uses Canvas API (canvasMeasure.ts)
 * instead of DOM-span offsetWidth to avoid Layout Thrashing.
 */

import type { FabricLine } from "@/components/studio/FabricLines";
import type { LocalOverride } from "@/state/overridesStore";
import { measureTextWidthCanvas, splitToFitCanvas, splitToFitForLayer, splitToFitArea } from "./canvasMeasure";
import { calculateAreaTextHeight } from "./areaTextHeight";
import { measureAreaTextAsync } from "./textMeasure/measureWorkerBridge";
import { useTemplateStore } from "@/state/templateStore";
import { KARIANA_TEMPLATE } from "@/data/defaultTemplate";

export type LayerKind = "arabic" | "bangla";

function getActiveTemplate(): import("@/types/template").MasterTemplate {
  try {
    return useTemplateStore.getState().getActiveTemplate();
  } catch {
    // Fallback for SSR / test environments
    return KARIANA_TEMPLATE;
  }
}

/**
 * Maps a raw PageData into the 9 DOM slots exactly as Artboard.tsx does.
 */
export function getDomSlots(page: any): FabricLine[] {
  const tmpl = getActiveTemplate();
  const linesPerPage = tmpl.linesPerPage;
  const surahOpenStartAt = tmpl.surahOpen.startAt;
  const surahOpenSpan = tmpl.surahOpen.headerSpan;

  const slots: FabricLine[] = Array.from({ length: linesPerPage }, () => ({}));
  if (!page || !page.lines) return slots;
  
  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? surahOpenStartAt : 0;
  const skipSlots = new Set<number>();
  
  page.lines.slice(0, linesPerPage - startAt).forEach((l: any, i: number) => {
    const idx = startAt + i;
    if (l.slotKind === "surah-open" && l.surahOpen) {
      for (let k = 0; k < surahOpenSpan; k++) {
        skipSlots.add(idx + k);
      }
      return;
    }
    slots[idx] = {
      arabic: l.arabicLine ?? (l.blocks || []).map((b: any) => b.arabic).join(" "),
      bangla: l.banglaLine ?? (l.blocks || []).map((b: any) => b.bangla).filter(Boolean).join(" "),
      symbol: (l.markers ?? []).join("  "),
      pronunciation: l.pronunciationLine ?? (l.blocks || []).map((b: any) => b.pronunciation ?? b.bn).filter(Boolean).join(" "),
      meaning: l.meaningLine ?? (l.blocks || []).map((b: any) => b.meaning ?? b.t_bn).filter(Boolean).join(" "),
    };
  });

  for (let i = startAt; i < linesPerPage; i++) {
    if (!skipSlots.has(i) && slots[i].arabic === undefined) {
      slots[i] = { arabic: "", bangla: "", symbol: "" };
    }
  }

  return slots;
}

export function findNextValidRow(pi: number, ri: number, pages: any[], layer: LayerKind) {
  let searchPi = pi;
  let searchRi = ri + 1;
  while (searchPi < pages.length) {
    const page = pages[searchPi];
    if (!page) { searchPi++; searchRi = 0; continue; }
    const slots = getDomSlots(page);
    while (searchRi < slots.length) {
      const slot = slots[searchRi];
      if (layer === "arabic" && slot.arabic !== undefined) return { pi: searchPi, ri: searchRi };
      if (layer === "bangla" && slot.bangla !== undefined) return { pi: searchPi, ri: searchRi };
      searchRi++;
    }
    searchPi++;
    searchRi = 0;
  }
  return null;
}

export function findPrevValidRow(pi: number, ri: number, pages: any[], layer: LayerKind) {
  let searchPi = pi;
  let searchRi = ri - 1;
  const tmpl = getActiveTemplate();
  const linesPerPage = tmpl.linesPerPage;
  
  while (searchPi >= 0) {
    const page = pages[searchPi];
    if (!page) { searchPi--; searchRi = linesPerPage - 1; continue; }
    const slots = getDomSlots(page);
    if (searchRi >= slots.length) searchRi = slots.length - 1;
    while (searchRi >= 0) {
      const slot = slots[searchRi];
      if (layer === "arabic" && slot.arabic !== undefined) return { pi: searchPi, ri: searchRi };
      if (layer === "bangla" && slot.bangla !== undefined) return { pi: searchPi, ri: searchRi };
      searchRi--;
    }
    searchPi--;
    searchRi = linesPerPage - 1;
  }
  return null;
}

function splitToFitAware(
  text: string,
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  layer: LayerKind,
  pageId: string,
  rowIndex: number,
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pid: string, ri: number, l: LayerKind) => string
): { fits: string; overflow: string } {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  const textMode = localMap[lk]?.textMode ?? "point";
  const areaHeight = localMap[lk]?.areaHeight ?? null;

  if (textMode === "area") {
    if (areaHeight === null) {
      return { fits: text, overflow: "" };
    }
    // leading in store is absolute px (e.g. 60 for 60px line height).
    // Convert to multiplier for splitToFitArea.
    const leadingPx = localMap[lk]?.leading ?? 0;
    const leadingMult = leadingPx > 0 ? leadingPx / fontSize : 1;
    return splitToFitArea(text, availableWidth, areaHeight, fontFamily, fontSize, leadingMult, layer);
  }
  
  return splitToFitForLayer(text, availableWidth, fontFamily, fontSize, layer);
}

function hasFreeSpaceAware(
  text: string,
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  layer: LayerKind,
  pageId: string,
  rowIndex: number,
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pid: string, ri: number, l: LayerKind) => string
): boolean {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  const textMode = localMap[lk]?.textMode ?? "point";
  const areaHeight = localMap[lk]?.areaHeight ?? null;

  if (textMode === "area" && areaHeight !== null) {
    const leadingPx = localMap[lk]?.leading ?? 0;
    const leadingMult = leadingPx > 0 ? leadingPx / fontSize : 1;
    const h = calculateAreaTextHeight({
      text,
      availableWidth,
      fontFamily,
      fontSize,
      leading: leadingMult,
      layer,
      paddingY: 4
    });
    const lh = fontSize * Math.max(1, leadingMult);
    return (h + lh) <= areaHeight;
  }
  
  const currentWidth = measureTextWidthCanvas(text, fontFamily, fontSize);
  return currentWidth < availableWidth - 20;
}

/**
 * Measures the rendered pixel width of `text`.
 * Uses Canvas API — no DOM reads, no Layout Thrashing.
 *
 * @deprecated Use measureTextWidthCanvas() from canvasMeasure.ts directly.
 * This wrapper is kept for backwards-compatibility with any callers.
 */
export function measureTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  return measureTextWidthCanvas(text, fontFamily, fontSize);
}

/**
 * Splits text to fit within maxWidth pixels using Canvas measurement.
 * Replaces the previous DOM-span based implementation.
 */
export function splitToFit(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
): { fits: string; overflow: string } {
  return splitToFitCanvas(text, maxWidth, fontFamily, fontSize);
}

/**
 * Gets effective text for a row+layer — uses local override text if set,
 * otherwise falls back to original page data.
 */
export function getEffectiveText(
  pageId: string,
  rowIndex: number,
  layer: LayerKind,
  lines: FabricLine[],
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string,
): string {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  const ov = localMap[lk];
  if (ov?.text !== undefined) return ov.text;
  return layer === "arabic"
    ? (lines[rowIndex]?.arabic ?? "")
    : (lines[rowIndex]?.bangla ?? "");
}

export type ReflowOptions = {
  startPageId: string;
  startRowIndex: number;
  startOverflow: string;
  layer: LayerKind;
  /** All pages in order */
  allPages: any[];
  localMap: Record<string, LocalOverride>;
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void;
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** If provided, reflow is constrained to these pageIds (e.g. one surah). */
  surahPageIds?: string[];
};


/**
 * Cascading reflow from a given row across the entire surah.
 * Accepts an overflow string and distributes it through subsequent rows/pages.
 * Uses Canvas measurement — no DOM reads.
 */
export function reflowFrom(opts: ReflowOptions): void {
  const {
    startPageId,
    startRowIndex,
    startOverflow,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  let overflow = startOverflow.trim();
  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;

  // Iterate through pages starting from the given position
  for (let pi = startPageIdx; pi < targetPages.length && overflow !== ""; pi++) {
    const page = targetPages[pi];
    if (!page) continue;
    const slots = getDomSlots(page);
    const firstRow = pi === startPageIdx ? startRowIndex : 0;

    for (let ri = firstRow; ri < slots.length; ri++) {
      const slot = slots[ri];
      if (layer === "arabic" && slot.arabic === undefined) continue;
      if (layer === "bangla" && slot.bangla === undefined) continue;

      const lk = layerKeyFn(page.id, ri, layer);
      // Get existing text for this row (only for rows after the start)
      const existingText =
        pi === startPageIdx && ri === startRowIndex
          ? "" // start row already has its new text set
          : getEffectiveText(page.id, ri, layer, slots, localMap, layerKeyFn);

      // Combine overflow with existing text
      const combined = existingText
        ? overflow + " " + existingText
        : overflow;

      const { fits, overflow: newOverflow } = splitToFitAware(
        combined,
        availableWidth,
        fontFamily,
        fontSize,
        layer,
        page.id,
        ri,
        localMap,
        layerKeyFn
      );


      patchLocal(lk, { text: fits });
      overflow = newOverflow.trim();

      if (overflow === "") break;
    }
  }
}

/**
 * Async version of reflowFrom for large cross-page cascades.
 * Yields to the browser between page batches (PAGES_PER_CHUNK pages per tick)
 * to avoid blocking the main thread. Sets isReflowing flag on reflowStore.
 */
const PAGES_PER_CHUNK = 3;
export async function reflowFromAsync(opts: ReflowOptions): Promise<void> {
  const {
    startPageId, startRowIndex, startOverflow, layer,
    allPages, localMap, patchLocal, layerKeyFn,
    fontFamily, fontSize, availableWidth, surahPageIds,
  } = opts;

  const { useReflowStore } = await import("@/state/reflowStore");
  useReflowStore.getState().setIsReflowing(true);

  try {
    let overflow = startOverflow.trim();
    const targetPages = surahPageIds
      ? allPages.filter((p) => surahPageIds.includes(p.id))
      : allPages;
    const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
    if (startPageIdx === -1) return;

    for (let pi = startPageIdx; pi < targetPages.length && overflow !== ""; pi++) {
      // Yield to browser between page chunks
      if ((pi - startPageIdx) % PAGES_PER_CHUNK === 0 && pi > startPageIdx) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      const page = targetPages[pi]!;
      const slots = getDomSlots(page);
      const firstRow = pi === startPageIdx ? startRowIndex : 0;

      for (let ri = firstRow; ri < slots.length; ri++) {
        const slot = slots[ri];
        if (layer === "arabic" && slot.arabic === undefined) continue;
        if (layer === "bangla" && slot.bangla === undefined) continue;

        const lk = layerKeyFn(page.id, ri, layer);
        const local = localMap[lk];
        const existingText =
          pi === startPageIdx && ri === startRowIndex
            ? ""
            : getEffectiveText(page.id, ri, layer, slots, localMap, layerKeyFn);

        const combined = existingText ? overflow + " " + existingText : overflow;
        
        let fits: string;
        let newOverflow: string;
        
        const frameType = local?.frameType ?? (local?.textMode === "area" ? "area-fixed" : "point");
        
        if (frameType === "area-fixed") {
          const heightPx = local?.fixedHeight ?? local?.areaHeight ?? 100;
          const leadingPx = local?.leading ?? 0;
          const leadingMult = leadingPx > 0 ? leadingPx / fontSize : 1.5;
          const res = await measureAreaTextAsync(combined, availableWidth, heightPx, fontFamily, fontSize, leadingMult);
          fits = res.fits;
          newOverflow = res.overflow;
        } else {
          const res = splitToFitAware(
            combined, availableWidth, fontFamily, fontSize, layer, page.id, ri, localMap, layerKeyFn
          );
          fits = res.fits;
          newOverflow = res.overflow;
        }

        patchLocal(lk, { text: fits });
        overflow = newOverflow.trim();
        
        if (overflow === "" && frameType !== "area-fixed") {
            break;
        }
      }
    }
  } finally {
    useReflowStore.getState().setIsReflowing(false);
  }
}


export type BackFillOptions = {
  startPageId: string;
  startRowIndex: number;
  layer: LayerKind;
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void;
  layerKeyFn: (pid: string, ri: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  surahPageIds?: string[];
};

/**
 * Back-fill cascade: when a row has spare width, pull leading words from the
 * next row(s) to fill it. Continues forward until no more words can be pulled
 * or the end of the target page range is reached.
 *
 * Uses Canvas measurement only (no DOM reads). Mirrors `reflowFrom` style.
 */
export function backFillFrom(opts: BackFillOptions): void {
  const {
    startPageId,
    startRowIndex,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;


  // In-memory text cache so iterative writes are visible without re-reading store.
  const textCache = new Map<string, string>();
  const readText = (pid: string, ri: number, pageObj: any): string => {
    const lk = layerKeyFn(pid, ri, layer);
    if (textCache.has(lk)) return textCache.get(lk)!;
    return getEffectiveText(pid, ri, layer, getDomSlots(pageObj), localMap, layerKeyFn);
  };
  const writeText = (pid: string, ri: number, text: string) => {
    const lk = layerKeyFn(pid, ri, layer);
    textCache.set(lk, text);
    patchLocal(lk, { text });
  };

  let pi = startPageIdx;
  let ri = startRowIndex;

  const maxIterations = targetPages.length * 50 + 100;
  let iter = 0;

  while (iter++ < maxIterations) {
    const curPage = targetPages[pi];
    if (!curPage) break;

    // Find next valid row
    const nextRef = findNextValidRow(pi, ri, targetPages, layer);
    if (!nextRef) break;
    const { pi: nPi, ri: nRi } = nextRef;
    const nextPage = targetPages[nPi]!;

    const curText = readText(curPage.id, ri, curPage).trim();
    const nextText = readText(nextPage.id, nRi, nextPage).trim();

    if (nextText === "") {
      // Empty next row — nothing to pull; advance to it and continue collapsing.
      pi = nPi;
      ri = nRi;
      continue;
    }

    const combined = curText ? curText + " " + nextText : nextText;
    const { fits, overflow } = splitToFitAware(
      combined,
      availableWidth,
      fontFamily,
      fontSize,
      layer,
      curPage.id,
      ri,
      localMap,
      layerKeyFn
    );


    // No extra word pulled — leading word of nextText doesn't fit. Stop.
    if (fits === curText) break;

    writeText(curPage.id, ri, fits);
    writeText(nextPage.id, nRi, overflow.trim());

    if (overflow.trim() === "") {
      // Next row fully drained — advance and try to pull from the row after.
      pi = nPi;
      ri = nRi;
      continue;
    }
    // Next row still has text but couldn't give more — done.
    break;
  }
}

export type CollapseBackwardOptions = BackFillOptions;

export function collapseLineBreakBackward(opts: CollapseBackwardOptions): {
  merged: boolean;
  crossesPage: boolean;
} {
  const {
    startPageId,
    startRowIndex,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return { merged: false, crossesPage: false };

  const currentPage = targetPages[startPageIdx];
  if (!currentPage) return { merged: false, crossesPage: false };

  const prevRef = findPrevValidRow(startPageIdx, startRowIndex, targetPages, layer);
  if (!prevRef) return { merged: false, crossesPage: false };
  const { pi: prevPageIdx, ri: prevRowIdx } = prevRef;

  const prevPage = targetPages[prevPageIdx];
  if (!prevPage) return { merged: false, crossesPage: false };

  const prevText = getEffectiveText(prevPage.id, prevRowIdx, layer, getDomSlots(prevPage), localMap, layerKeyFn).trim();
  const currentText = getEffectiveText(startPageId, startRowIndex, layer, getDomSlots(currentPage), localMap, layerKeyFn).trim();
  if (!currentText) return { merged: false, crossesPage: prevPage.id !== startPageId };

  const combined = prevText ? `${prevText} ${currentText}` : currentText;
  const { fits, overflow } = splitToFitAware(
    combined,
    availableWidth,
    fontFamily,
    fontSize,
    layer,
    prevPage.id,
    prevRowIdx,
    localMap,
    layerKeyFn
  );

  patchLocal(layerKeyFn(prevPage.id, prevRowIdx, layer), { text: fits });
  patchLocal(layerKeyFn(startPageId, startRowIndex, layer), { text: "" });

  const remainder = overflow.trim();
  if (remainder) {
    reflowFrom({
      startPageId,
      startRowIndex,
      startOverflow: remainder,
      layer,
      allPages: targetPages,
      localMap: useOverridesStore.getState().local,
      patchLocal,
      layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
  } else {
    backFillFrom({
      startPageId,
      startRowIndex,
      layer,
      allPages: targetPages,
      localMap: useOverridesStore.getState().local,
      patchLocal,
      layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
  }

  return { merged: true, crossesPage: prevPage.id !== startPageId };
}

// Feature 1 additions
export async function pullUpFromNextFrame(
  frameKey: string,
  currentText: string,
  localMap: Record<string, LocalOverride>,
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void,
  fontFamily: string,
  fontSize: number,
  availableWidth: number,
) {
  const local = localMap[frameKey];
  if (local?.frameType !== 'area-fixed' || !local?.linkedNextFrameId) return;

  let frameText = currentText;
  let nextFrameId: string | undefined = local.linkedNextFrameId;

  while (nextFrameId) {
    const nextLocal: import("@/state/overridesStore").LocalOverride | undefined = localMap[nextFrameId];
    if (!nextLocal) break;

    const nextWords = (nextLocal.text ?? "").split(/\s+/).filter(Boolean);
    if (nextWords.length === 0) break;

    let pulledCount = 0;
    for (const word of nextWords) {
      const candidate = frameText + ' ' + word;
      
      const heightPx = local?.fixedHeight ?? local?.areaHeight ?? 100;
      const leadingPx = local?.leading ?? 0;
      const leadingMult = leadingPx > 0 ? leadingPx / fontSize : 1.5;
      
      const res = await measureAreaTextAsync(candidate.trim(), availableWidth, heightPx, fontFamily, fontSize, leadingMult);
      
      if (res.overflow) break; // does not fit
      
      frameText = candidate.trim();
      pulledCount++;
    }

    if (pulledCount === 0) break;

    patchLocal(frameKey, { text: frameText });
    patchLocal(nextFrameId, { text: nextWords.slice(pulledCount).join(' ') });
    
    // Evaluate if we should keep pulling
    if (pulledCount < nextWords.length) break;
    
    // Move to next frame if the current next frame was completely drained
    nextFrameId = nextLocal.linkedNextFrameId;
  }
}

export async function growAutoHeightFrame(
  frameKey: string,
  text: string,
  localMap: Record<string, LocalOverride>,
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void,
) {
  const local = localMap[frameKey];
  if (local?.frameType !== 'area-auto') return;
  // Compute approximate height needed based on text length or just let CSS handle it
  // For now, simply update the text and clear any fixed areaHeight
  patchLocal(frameKey, { text, areaHeight: undefined });
}


/**
 * Gets text before and after the cursor in a contenteditable element.
 */
export function getTextAroundCursor(el: HTMLElement): {
  before: string;
  after: string;
} {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { before: el.textContent ?? "", after: "" };
  }

  const range = sel.getRangeAt(0);

  // Range from start of element to cursor
  const beforeRange = document.createRange();
  try {
    beforeRange.setStart(el, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return { before: el.textContent ?? "", after: "" };
  }

  const before = beforeRange.toString();
  const full = el.textContent ?? "";
  const after = full.substring(before.length);

  return { before, after };
}


/* ─── planCascade — pure dry-run for cross-page reflow ──────────── */

export type CascadeRowUpdate = {
  pageId: string;
  rowIndex: number;
  layer: LayerKind;
  text: string;
};

export type CascadePlan = {
  rowUpdates: CascadeRowUpdate[];
  crossesPage: boolean;
  crossesSurah: boolean;
  affectedPages: number;
  /** Text that does not fit anywhere in the scoped pages (overflow tail). */
  tailOverflow: string;
};

export type PlanCascadeOptions = {
  startPageId: string;
  startRowIndex: number;
  /** What the start row should contain AFTER the edit. */
  newCurrentText: string;
  /** Text to flow into the row after `start`. May be empty. */
  pushedText: string;
  layer: LayerKind;
  /** All scoped pages in order. */
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  layerKeyFn: (pid: string, ri: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** PageIds belonging to the current surah (for crossesSurah detection). */
  surahPageIds?: string[];
};

/**
 * Pure dry-run: returns the diff of what reflow WOULD do, without mutating
 * any store. Lets the caller decide whether to confirm via a dialog.
 */
export function planCascade(opts: PlanCascadeOptions): CascadePlan {
  const {
    startPageId,
    startRowIndex,
    newCurrentText,
    pushedText,
    layer,
    allPages,
    localMap,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const startPageIdx = allPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) {
    return {
      rowUpdates: [],
      crossesPage: false,
      crossesSurah: false,
      affectedPages: 0,
      tailOverflow: "",
    };
  }

  const updates: CascadeRowUpdate[] = [
    { pageId: startPageId, rowIndex: startRowIndex, layer, text: newCurrentText },
  ];

  let carry = pushedText.trim();
  const affectedPageIds = new Set<string>([startPageId]);

  // Walk forward through scoped pages, starting at the row AFTER startRow.
  let pi = startPageIdx;
  let ri = startRowIndex + 1;

  while (carry !== "" && pi < allPages.length) {
    const nextRef = findNextValidRow(pi, ri - 1, allPages, layer);
    if (!nextRef) break;
    pi = nextRef.pi;
    ri = nextRef.ri;
    
    const page = allPages[pi]!;
    const slots = getDomSlots(page);

    const existing = getEffectiveText(
      page.id,
      ri,
      layer,
      slots,
      localMap,
      layerKeyFn,
    );
    const combined = existing ? carry + " " + existing : carry;
    const { fits, overflow } = splitToFitAware(
      combined,
      availableWidth,
      fontFamily,
      fontSize,
      layer,
      page.id,
      ri,
      localMap,
      layerKeyFn
    );


    if (fits !== existing) {
      updates.push({ pageId: page.id, rowIndex: ri, layer, text: fits });
      affectedPageIds.add(page.id);
    }
    carry = overflow.trim();
    ri += 1;
  }

  const crossesPage = Array.from(affectedPageIds).some((pid) => pid !== startPageId);
  let crossesSurah = false;
  if (surahPageIds && surahPageIds.length > 0) {
    crossesSurah = Array.from(affectedPageIds).some((pid) => !surahPageIds.includes(pid));
  }

  return {
    rowUpdates: updates,
    crossesPage,
    crossesSurah,
    affectedPages: affectedPageIds.size,
    tailOverflow: carry,
  };
}

/* ─── reflowLayerText — single unified entry point ──────────────── */

import { effectiveReflowScope, type ReflowLayer } from "./reflowScope";
import { useOverridesStore, layerKey as _layerKeyFn } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useEditorStore, type SelectionScope } from "@/state/editorStore";

export type ReflowLayerTextResult = {
  /** Link OFF + overflow exists → caller should toast/clip. */
  clipped: boolean;
  /** Did we end up modifying any other row? */
  cascaded: boolean;
  /** crossesPage flag from planCascade (only meaningful when cascaded). */
  crossesPage: boolean;
  crossesSurah: boolean;
  /** Text that did not fit inside the effective scoped pages. */
  tailOverflow: string;
  /** Number of pages touched by the dry-run/apply path. */
  affectedPages: number;
  /** Number of rows the dry-run planned to update. */
  rowUpdates: number;
};

export type ReflowLayerTextOptions = {
  pageId: string;
  rowIndex: number;
  layer: ReflowLayer;
  reason: "typing" | "text-edit" | "typography" | "paste" | "story-commit";
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** Editor scope at trigger time. Defaults to current editor scope. */
  scope?: SelectionScope;
};

/**
 * Unified reflow trigger used by both typography changes and (eventually) the
 * inline editor. Resolves layer-aware effective scope, runs the cascade walk,
 * and either applies it directly or stages it on `editorStore.pendingReflow`
 * for the `CrossPageReflowDialog` to confirm.
 *
 * Returns synchronously with metadata so the caller can show a toast when
 * `clipped === true` (link OFF + overflow).
 */
export function reflowLayerText(opts: ReflowLayerTextOptions): ReflowLayerTextResult {
  const {
    pageId,
    rowIndex,
    layer,
    fontFamily,
    fontSize,
    availableWidth,
  } = opts;

  const editorState = useEditorStore.getState();
  if (opts.scope === undefined && typeof console !== "undefined") {
    // Callers should always pass scope explicitly to avoid races against
    // user-driven scope changes between the trigger and the reflow walk.
    // eslint-disable-next-line no-console
    console.warn("[reflowLayerText] called without scope; falling back to editor state");
  }
  const scope = opts.scope ?? editorState.scope;
  const eff = effectiveReflowScope(scope, layer, pageId);


  const reflowState = useReflowStore.getState();
  const pages = reflowState.pages as unknown as Array<{ id: string; lines: FabricLine[] }>;
  const localMap = useOverridesStore.getState().local;
  const patchLocal = useOverridesStore.getState().patchLocal;

  const emptyResult: ReflowLayerTextResult = {
    clipped: false,
    cascaded: false,
    crossesPage: false,
    crossesSurah: false,
    tailOverflow: "",
    affectedPages: 0,
    rowUpdates: 0,
  };

  const startPage = pages.find((p) => p.id === pageId);
  if (!startPage) {
    return emptyResult;
  }

  const currentText = getEffectiveText(
    pageId,
    rowIndex,
    layer,
    startPage.lines,
    localMap,
    _layerKeyFn,
  );

  const { fits, overflow } = splitToFitAware(
    currentText,
    availableWidth,
    fontFamily,
    fontSize,
    layer,
    pageId,
    rowIndex,
    localMap,
    _layerKeyFn
  );

  // Link OFF — never spill into other rows.
  if (!eff.cascade) {
    if (overflow.trim() === "") {
      return emptyResult;
    }
    // Clip to the current row; caller surfaces a toast.
    patchLocal(_layerKeyFn(pageId, rowIndex, layer), { text: fits });
    return { ...emptyResult, clipped: true, tailOverflow: overflow.trim(), affectedPages: 1, rowUpdates: 1 };
  }

  const scopedPages = pages.filter((p) => eff.pageIds.includes(p.id));
  const surahPageIds = eff.pageIds;

  if (overflow.trim() !== "") {
    // Dry-run to detect crossing.
    const plan = planCascade({
      startPageId: pageId,
      startRowIndex: rowIndex,
      newCurrentText: fits,
      pushedText: overflow.trim(),
      layer,
      allPages: scopedPages,
      localMap,
      layerKeyFn: _layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });

    const apply = () => {
      patchLocal(_layerKeyFn(pageId, rowIndex, layer), { text: fits });
      void reflowFromAsync({
        startPageId: pageId,
        startRowIndex: rowIndex + 1,
        startOverflow: overflow.trim(),
        layer,
        allPages: scopedPages,
        localMap: useOverridesStore.getState().local,
        patchLocal,
        layerKeyFn: _layerKeyFn,
        fontFamily,
        fontSize,
        availableWidth,
        surahPageIds,
      });
    };

    if (plan.crossesPage || plan.crossesSurah) {
      editorState.setPendingReflow({
        crossesPage: plan.crossesPage,
        crossesSurah: plan.crossesSurah,
        affectedPages: plan.affectedPages,
        confirm: apply,
      });
      return {
        clipped: false,
        cascaded: true,
        crossesPage: plan.crossesPage,
        crossesSurah: plan.crossesSurah,
        tailOverflow: plan.tailOverflow,
        affectedPages: plan.affectedPages,
        rowUpdates: plan.rowUpdates.length,
      };
    }

    apply();
    return {
      clipped: false,
      cascaded: true,
      crossesPage: plan.crossesPage,
      crossesSurah: plan.crossesSurah,
      tailOverflow: plan.tailOverflow,
      affectedPages: plan.affectedPages,
      rowUpdates: plan.rowUpdates.length,
    };
  }

  // No overflow → try a back-fill if there is slack.
  if (hasFreeSpaceAware(currentText, availableWidth, fontFamily, fontSize, layer, pageId, rowIndex, localMap, _layerKeyFn)) {
    backFillFrom({
      startPageId: pageId,
      startRowIndex: rowIndex,
      layer,
      allPages: scopedPages,
      localMap,
      patchLocal,
      layerKeyFn: _layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
    return { ...emptyResult, cascaded: true, affectedPages: 1 };
  }

  return emptyResult;
}

