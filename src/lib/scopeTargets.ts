import type { PageData } from "@/data/pages";
import type { SelectionScope } from "@/state/editorStore";
import type { PageDistribution } from "@/state/reflowStore";
import { splitArabicWords } from "@/lib/wordSplit";

export type ScopedKeyParts =
  | { kind: "layer"; pageId: string; rowIndex: number; layer: "arabic" | "bangla" | "symbol" }
  | { kind: "row"; pageId: string; rowIndex: number }
  | { kind: "word"; pageId: string; rowIndex: number; wordIndex: number };

export function parseScopedKey(key: string): ScopedKeyParts | null {
  const parts = key.split(":");
  if (parts[0] === "layer" && parts.length >= 4) {
    const layer = parts[3];
    if (layer !== "arabic" && layer !== "bangla" && layer !== "symbol") return null;
    return { kind: "layer", pageId: parts[1]!, rowIndex: Number(parts[2]), layer };
  }
  if (parts[0] === "row" && parts.length >= 3) {
    return { kind: "row", pageId: parts[1]!, rowIndex: Number(parts[2]) };
  }
  if (parts[0] === "word" && parts.length >= 4) {
    return { kind: "word", pageId: parts[1]!, rowIndex: Number(parts[2]), wordIndex: Number(parts[3]) };
  }
  return null;
}

export function resolveTargetPageIds(
  scope: SelectionScope,
  pageId: string,
  pages: PageData[],
  distribution: PageDistribution[],
): string[] {
  if (scope === "general" || scope === "page") return [pageId];

  const srcInfo = distribution.find((d) => d.pageId === pageId);
  if (scope === "surah") {
    const srcSurah = srcInfo?.surah ?? 0;
    return srcSurah > 0
      ? distribution.filter((d) => d.surah === srcSurah).map((d) => d.pageId)
      : [pageId];
  }

  if (scope === "para") {
    const srcPara = srcInfo?.para ?? 0;
    return srcPara > 0
      ? distribution.filter((d) => d.para === srcPara).map((d) => d.pageId)
      : [pageId];
  }

  return pages.map((p) => p.id);
}

export function buildScopedKeys(
  representativeKey: string,
  scope: SelectionScope,
  pages: PageData[],
  distribution: PageDistribution[],
): string[] {
  if (scope === "general") return [representativeKey];
  const parsed = parseScopedKey(representativeKey);
  if (!parsed) return [representativeKey];

  const targetPages = resolveTargetPageIds(scope, parsed.pageId, pages, distribution);
  const out: string[] = [];

  if (parsed.kind === "word") {
    const srcPage = pages.find((p) => p.id === parsed.pageId);
    const srcRow = srcPage?.lines?.[parsed.rowIndex] as { arabic?: string } | undefined;
    const srcWords = splitArabicWords(srcRow?.arabic ?? "");
    const srcWord = srcWords[parsed.wordIndex ?? -1];
    if (!srcWord) return [representativeKey];

    for (const pid of targetPages) {
      const page = pages.find((p) => p.id === pid);
      if (!page) continue;
      const rows = (page.lines ?? []) as Array<{ arabic?: string }>;
      for (let r = 0; r < rows.length; r++) {
        const words = splitArabicWords(rows[r]?.arabic ?? "");
        for (let w = 0; w < words.length; w++) {
          if (words[w] === srcWord) out.push(`word:${pid}:${r}:${w}`);
        }
      }
    }
    return out.length > 0 ? out : [representativeKey];
  }

  for (const pid of targetPages) {
    const page = pages.find((p) => p.id === pid);
    if (!page) continue;
    const rowCount = page.lines?.length ?? 0;
    for (let i = 0; i < rowCount; i++) {
      if (parsed.kind === "layer") out.push(`layer:${pid}:${i}:${parsed.layer}`);
      else out.push(`row:${pid}:${i}`);
    }
  }

  return out.length > 0 ? out : [representativeKey];
}

export function buildVisibleLayerKeys(
  representativeKey: string,
  scope: SelectionScope,
  currentPageId: string,
  pages: PageData[],
  distribution: PageDistribution[],
): string[] {
  const parsed = parseScopedKey(representativeKey);
  if (!parsed || parsed.kind !== "layer") return [representativeKey];

  if (scope === "general") return [representativeKey];

  const targetPageIds = resolveTargetPageIds(scope, parsed.pageId, pages, distribution);
  if (!targetPageIds.includes(currentPageId)) return [];

  const page = pages.find((p) => p.id === currentPageId);
  if (!page) return currentPageId === parsed.pageId ? [representativeKey] : [];

  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? 3 : 0;
  const visibleRows: number[] = [];
  const skipSlots = new Set<number>();

  page.lines.slice(0, 9 - startAt).forEach((line, i) => {
    const rowIndex = startAt + i;
    if (line.slotKind === "surah-open" && line.surahOpen) {
      skipSlots.add(rowIndex);
      skipSlots.add(rowIndex + 1);
      return;
    }
    if (line.slotKind === "blank") {
      skipSlots.add(rowIndex);
      return;
    }
    visibleRows.push(rowIndex);
  });

  return visibleRows
    .filter((rowIndex) => !skipSlots.has(rowIndex))
    .map((rowIndex) => `layer:${currentPageId}:${rowIndex}:${parsed.layer}`);
}

/**
 * Para scope special: returns BOTH Arabic AND Bangla visible keys for the
 * current page so both layers are highlighted simultaneously.
 * For all other scopes, behaves identically to buildVisibleLayerKeys.
 */
export function buildVisibleDualLayerKeys(
  representativeKey: string,
  scope: SelectionScope,
  currentPageId: string,
  pages: PageData[],
  distribution: PageDistribution[],
): string[] {
  if (scope !== "para") {
    return buildVisibleLayerKeys(representativeKey, scope, currentPageId, pages, distribution);
  }

  const parsed = parseScopedKey(representativeKey);
  if (!parsed || parsed.kind !== "layer") return [representativeKey];

  const targetPageIds = resolveTargetPageIds(scope, parsed.pageId, pages, distribution);
  if (!targetPageIds.includes(currentPageId)) return [];

  const page = pages.find((p) => p.id === currentPageId);
  if (!page) return currentPageId === parsed.pageId ? [representativeKey] : [];

  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? 3 : 0;
  const visibleRows: number[] = [];
  const skipSlots = new Set<number>();

  page.lines.slice(0, 9 - startAt).forEach((line, i) => {
    const rowIndex = startAt + i;
    if (line.slotKind === "surah-open" && line.surahOpen) {
      skipSlots.add(rowIndex);
      skipSlots.add(rowIndex + 1);
      return;
    }
    if (line.slotKind === "blank") {
      skipSlots.add(rowIndex);
      return;
    }
    visibleRows.push(rowIndex);
  });

  const validRows = visibleRows.filter((ri) => !skipSlots.has(ri));
  // Return both Arabic and Bangla layer keys for para scope
  const arabicKeys = validRows.map((ri) => `layer:${currentPageId}:${ri}:arabic`);
  const banglaKeys = validRows.map((ri) => `layer:${currentPageId}:${ri}:bangla`);
  return [...arabicKeys, ...banglaKeys];
}
