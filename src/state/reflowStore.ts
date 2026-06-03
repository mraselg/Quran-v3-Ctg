import { create } from "zustand";
import {
  buildAllPages,
  buildAllPagesChunked,
  buildPagesFromVerses,
  loadAllVerses,
  pagesSync,
  ARABIC_FONT_PX,
  BANGLA_FONT_PX,
  type PageData,
} from "@/data/pages";
import { useOverridesStore } from "@/state/overridesStore";
import { indexPageWords, buildWordRefIndex } from "@/lib/quranIndex";
import { computeSurahLineMap, type SurahLineMap } from "@/lib/surahLineTracker";
import { templateToGlobalDefaults } from "@/lib/templateUtils";
import { useTemplateStore } from "@/state/templateStore";

export type PageDistribution = {
  pageId: string;
  pageNo: number;
  surah: number;
  para: number;
  firstVerse: number | null;
  lastVerse: number | null;
  rowCount: number;
};

export type BuildProgress = {
  /** Short status label in Bengali */
  label: string;
  /** 0–100 */
  pct: number;
};

type ReflowState = {
  pages: PageData[];
  distribution: PageDistribution[];
  surahLineMap: SurahLineMap;
  getSurahLineEntry: (surahNum: number) => import("@/lib/surahLineTracker").SurahLineEntry | undefined;
  status: "idle" | "loading" | "ready";
  /** Null when no build is in progress */
  buildProgress: BuildProgress | null;
  /** True while a large cross-page cascade is running in the background */
  isReflowing: boolean;
  signature: string;
  versesReady: boolean;
  rebuilding: boolean;
  init: () => Promise<void>;
  rebuild: () => void;
  /** Optimistic: idle-scheduled single-page rebuild for instant feedback. */
  rebuildPage: (pageId: string) => void;
  setIsReflowing: (v: boolean) => void;
  injectPage: (afterPageId: string) => void;
  removePage: (pageId: string) => boolean;
  shiftQuranForward: (fromPageId: string, rowCount: number) => void;
  measurementCache: Map<string, any>;
  setMeasurementCache: (key: string, value: any) => void;
};

function computeDistribution(pages: PageData[]): PageDistribution[] {
  const bnToNum = (s: string | number): number => {
    if (typeof s === "number") return s;
    const map: Record<string, string> = {
      "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
      "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    };
    return Number(String(s).replace(/[০-৯]/g, (c) => map[c] ?? c)) || 0;
  };
  return pages.map((p) => {
    const ayahLines = p.lines.filter((l) => l.slotKind === "ayah");
    const id = p.id;
    const pageNo = bnToNum(p.footer.pageNo);
    const surahMatch = /সূরা\s*([০-৯]+)/.exec(
      "chapter" in p ? p.chapter : "",
    );
    const surah = surahMatch ? bnToNum(surahMatch[1]!) : 0;
    const paraMatch = /(?:পারা\s*)?([০-৯0-9]+)/.exec(
      "para" in p ? p.para : "",
    );
    const parsedPara = paraMatch ? bnToNum(paraMatch[1]!) : 0;
    const para = parsedPara > 0 ? parsedPara : Math.min(30, Math.max(1, Math.ceil(pageNo / 20)));
    let firstVerse: number | null = null;
    let lastVerse: number | null = null;
    const ayahMatch = /আয়াত\s*([০-৯]+)–([০-৯]+)/.exec(p.footer.ayah);
    if (ayahMatch) {
      firstVerse = bnToNum(ayahMatch[1]!);
      lastVerse = bnToNum(ayahMatch[2]!);
    }
    return { pageId: id, pageNo, surah, para, firstVerse, lastVerse, rowCount: ayahLines.length };
  });
}

function computeSignature(): string {
  const s = useOverridesStore.getState();
  const g = s.global;
  const parts: string[] = [
    // Global layout-affecting fields
    `g:${g.arabicFontPx ?? ""}|${g.banglaFontPx ?? ""}|${g.rowSpacing ?? ""}|${g.arabicYOffset ?? ""}|${g.banglaYOffset ?? ""}`,
  ];
  const keys = Object.keys(s.local).sort();
  for (const k of keys) {
    // Include both row-level AND layer-level overrides
    if (!k.startsWith("row:") && !k.startsWith("layer:")) continue;
    const ov = s.local[k];
    if (!ov) continue;
    // Track all fields that affect rendered layout/height
    const sig = [
      ov.fontPx ?? "",
      ov.scale ?? "",
      ov.leading ?? "",
      ov.tracking ?? "",
      ov.vScale ?? "",
      ov.hScale ?? "",
      ov.areaHeight ?? "",
      ov.textMode ?? "",
    ].join(":");
    // Only include if at least one field is set (avoid bloating signature)
    if (sig !== ":::::::" ) parts.push(`${k}=${sig}`);
  }
  
  // Include meaningConfig to force rebuild on toggle
  const mc = useTemplateStore.getState().getActiveTemplate().meaningConfig;
  parts.push(`mc:${mc?.showMeaning ? 1 : 0}|${mc?.showPronunciation ? 1 : 0}`);
  
  return parts.join("¦");
}

function collectRowFontOverrides(): Record<string, number> {
  const local = useOverridesStore.getState().local;
  const out: Record<string, number> = {};
  for (const k of Object.keys(local)) {
    if (!k.startsWith("row:")) continue;
    const fp = local[k]?.fontPx;
    if (typeof fp === "number") out[k] = fp;
  }
  return out;
}

export const useReflowStore = create<ReflowState>((set, get) => ({
  pages: pagesSync,
  distribution: computeDistribution(pagesSync),
  surahLineMap: new Map(),
  getSurahLineEntry: (surahNum) => get().surahLineMap.get(surahNum),
  status: "idle",
  buildProgress: null,
  isReflowing: false,
  signature: "",
  versesReady: false,
  rebuilding: false,
  measurementCache: new Map(),
  setMeasurementCache: (key, value) => {
    set((state) => {
      const next = new Map(state.measurementCache);
      if (next.size > 500) { // simple LRU cleanup
        const firstKey = next.keys().next().value;
        if (firstKey) next.delete(firstKey);
      }
      next.set(key, value);
      return { measurementCache: next };
    });
  },
  setIsReflowing: (v) => set({ isReflowing: v }),

  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading", buildProgress: { label: "শুরু হচ্ছে…", pct: 5 } });

    // Stage 1 — load Arabic font
    if (typeof document !== "undefined" && (document as any).fonts?.load) {
      set({ buildProgress: { label: "আরবি ফন্ট লোড হচ্ছে…", pct: 20 } });
      try {
        await (document as any).fonts.load(`${ARABIC_FONT_PX}px 'Excellent Arabic'`);
        await (document as any).fonts.load(`${BANGLA_FONT_PX}px 'Kalpurush'`);
      } catch { /* ignore */ }
    }

    // Stage 2 — fetch verses.json (~5.6 MB)
    set({ buildProgress: { label: "আয়াত ডেটা লোড হচ্ছে…", pct: 40 } });
    await loadAllVerses();
    set({ versesReady: true, buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 70 } });

    // Stage 3 — build all pages (scheduled in idle callback by rebuild())
    get().rebuild();
    set({ status: "ready", buildProgress: { label: "প্রস্তুত!", pct: 100 } });

    // Clear progress after a short delay so the bar finishes visually
    setTimeout(() => set({ buildProgress: null }), 800);
  },

  /**
   * Optimistic single-page rebuild — updates only the target page instantly
   * so the user sees immediate feedback without waiting for the full rebuild.
   *
   * Called from PropertiesPanel / Inspector when the user adjusts a value
   * that affects only the active page (e.g. per-row font size override).
   */
  injectPage: (afterPageId) => {
    const pages = get().pages;
    const idx = pages.findIndex((p) => p.id === afterPageId);
    if (idx < 0) return;
    const source = pages[idx]!;
    const injected = structuredClone(source) as PageData;
    injected.id = `${afterPageId}-dyn-${Date.now()}`;
    injected.type = "continuous";
    injected.lines = Array.from({ length: 9 }, () => ({ slotKind: "blank", blocks: [] }));
    const nextPages = [...pages.slice(0, idx + 1), injected, ...pages.slice(idx + 1)];
    set({ pages: nextPages, distribution: computeDistribution(nextPages) });
  },

  removePage: (pageId) => {
    const pages = get().pages;
    const page = pages.find((p) => p.id === pageId);
    if (!page || page.type === "surah-open" || !page.id.includes("-dyn-")) return false;
    const hasContent = page.lines.some((line) => {
      if (line.slotKind === "blank" || line.slotKind === "surah-open") return false;
      return Boolean(line.arabicLine || line.banglaLine || line.blocks.length || line.markers?.length);
    });
    if (hasContent) return false;
    const nextPages = pages.filter((p) => p.id !== pageId);
    set({ pages: nextPages, distribution: computeDistribution(nextPages) });
    return true;
  },

  shiftQuranForward: (fromPageId, rowCount) => {
    const pages = get().pages;
    const startIndex = pages.findIndex(p => p.id === fromPageId);
    if (startIndex < 0) return;

    // Extract all lines from startIndex to end into a single flat array
    const flatLines: any[] = [];
    for (let i = startIndex; i < pages.length; i++) {
      flatLines.push(...pages[i].lines);
    }

    // Insert empty rows to shift everything down
    const insertedLines = Array.from({ length: rowCount }, () => ({
      slotKind: "blank",
      blocks: []
    }));
    flatLines.unshift(...insertedLines);

    // Reconstruct the pages
    const newPages = [...pages];
    let lineIdx = 0;
    for (let i = startIndex; i < newPages.length; i++) {
      const page = { ...newPages[i] };
      page.lines = flatLines.slice(lineIdx, lineIdx + 9);
      lineIdx += 9;
      newPages[i] = page as any;
    }

    // Create new pages if there are leftover lines
    let lastPageNo = parseInt(newPages[newPages.length - 1].id.replace(/\D/g, "")) || newPages.length;
    while (lineIdx < flatLines.length) {
      lastPageNo++;
      const leftover = flatLines.slice(lineIdx, lineIdx + 9);
      while (leftover.length < 9) leftover.push({ slotKind: "blank", blocks: [] });
      const lastP = newPages[newPages.length - 1] as any;
      newPages.push({
        id: `vpage-${lastPageNo}`,
        type: "continuous",
        header: lastP.header ? { ...lastP.header } : undefined,
        lines: leftover,
        footer: { ...(lastP.footer || {}), pageNo: String(lastPageNo) }
      } as any);
      lineIdx += 9;
    }

    // Shift the localMap overrides
    const s = useOverridesStore.getState();
    const newLocal = { ...s.local };
    
    const getPageIdx = (id: string) => pages.findIndex(p => p.id === id);

    const oldKeyToNewKey = (key: string): string | null => {
       const match = key.match(/^(layer|row):([^:]+):(\d+)(.*)$/);
       if (!match) return key;
       const prefix = match[1];
       const pageId = match[2];
       const rowNum = parseInt(match[3]);
       const suffix = match[4];

       const pIdx = getPageIdx(pageId);
       if (pIdx < 0 || pIdx < startIndex) return key;

       const oldFlatIndex = (pIdx - startIndex) * 9 + rowNum;
       const newFlatIndex = oldFlatIndex + rowCount;

       const newPIdx = startIndex + Math.floor(newFlatIndex / 9);
       const newRIdx = newFlatIndex % 9;

       if (newPIdx >= newPages.length) return null;
       const newPageId = newPages[newPIdx].id;

       return `${prefix}:${newPageId}:${newRIdx}${suffix}`;
    };

    const finalLocal: Record<string, any> = {};
    for (const key of Object.keys(newLocal)) {
       if (!key.startsWith("layer:") && !key.startsWith("row:")) {
           finalLocal[key] = newLocal[key];
           continue;
       }
       const newKey = oldKeyToNewKey(key);
       if (newKey) {
           finalLocal[newKey] = newLocal[key];
       }
    }
    useOverridesStore.setState({ local: finalLocal });

    set({ pages: newPages as any, distribution: computeDistribution(newPages as any) });
  },

  rebuildPage: (pageId: string) => {
    const template = (() => {
      try {
        return useTemplateStore.getState().getActiveTemplate();
      } catch {
        return null;
      }
    })();
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? template?.typography.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? template?.typography.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
      template: template ?? undefined,
    };

    const currentPages = get().pages;
    if (!currentPages.find((p) => p.id === pageId)) return;

    // Idle-schedule the rebuild so it doesn't block the main thread while
    // the user is actively dragging a slider (optimistic UI stays responsive).
    const scheduleIdle =
      typeof requestIdleCallback !== "undefined"
        ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 200 })
        : (cb: IdleRequestCallback) =>
            setTimeout(
              () => cb({ timeRemaining: () => 50, didTimeout: false } as IdleDeadline),
              0,
            );

    scheduleIdle(() => {
      // Re-read current pages at time of execution (may have changed)
      const pages = get().pages;
      const allPages = buildAllPages(opts);
      const updatedPage = allPages.find((p) => p.id === pageId);
      if (!updatedPage) return;
      const newPages = pages.map((p) => (p.id === pageId ? updatedPage : p));
      const surahLineMap = computeSurahLineMap(newPages, computeDistribution(newPages));
      set({ pages: newPages, distribution: computeDistribution(newPages), surahLineMap });
    });
  },

  /**
   * Full rebuild — splits work across multiple `requestIdleCallback` frames
   * so the main thread stays responsive and sliders don't freeze.
   *
   * Strategy:
   * 1. Compute new signature. If unchanged → skip.
   * 2. Kick off chunked idle processing.
   * 3. Each idle callback processes ~60 pages before yielding.
   * 4. When all chunks are done → commit to state.
   */
  rebuild: () => {
    const template = (() => {
      try {
        return useTemplateStore.getState().getActiveTemplate();
      } catch {
        return null;
      }
    })();
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? template?.typography.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? template?.typography.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
      template: template ?? undefined,
    };
    const sig = computeSignature();

    // Cancel any in-flight rebuild so only the latest one commits.
    currentRebuildAbort?.abort();
    const abort = new AbortController();
    currentRebuildAbort = abort;

    set({ rebuilding: true });

    buildAllPagesChunked(
      opts,
      (p) => {
        if (abort.signal.aborted) return;
        set({
          buildProgress: {
            label: p.label,
            pct: Math.max(1, Math.min(99, Math.round((p.done / p.total) * 100))),
          },
        });
      },
      abort.signal,
    )
      .then((pages) => {
        if (abort.signal.aborted) return;
        if (sig !== computeSignature()) return; // stale — newer rebuild will commit
        const surahLineMap = computeSurahLineMap(pages, computeDistribution(pages));
        set({
          pages,
          distribution: computeDistribution(pages),
          surahLineMap,
          signature: sig,
          rebuilding: false,
          buildProgress: null,
        });
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        // eslint-disable-next-line no-console
        console.error("[reflow] rebuild failed", e);
        set({ rebuilding: false, buildProgress: null });
      });
  },
}));

let currentRebuildAbort: AbortController | null = null;

/**
 * Subscribe overrides → debounced rebuild (400ms idle window).
 * This prevents rebuilding on every slider tick — only fires after
 * the user stops dragging for 400ms.
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== "undefined") {
  // Initialize Quran word ref index and index initial pagesSync pages
  try {
    buildWordRefIndex();
    indexPageWords(pagesSync);
  } catch (e) {
    console.error("Failed to build initial quranIndex", e);
  }

  useOverridesStore.subscribe(() => {
    const next = computeSignature();
    if (next === useReflowStore.getState().signature) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Final check: only rebuild if signature still differs
      if (computeSignature() !== useReflowStore.getState().signature) {
        useReflowStore.getState().rebuild();
      }
    }, 400); // 400ms debounce — won't rebuild while slider is dragging
  });

  // Keep page word map in sync whenever pages change (e.g. after reflow/rebuild)
  useReflowStore.subscribe((state) => {
    try {
      indexPageWords(state.pages);
    } catch (e) {
      console.error("Failed to re-index page words", e);
    }
  });
}
