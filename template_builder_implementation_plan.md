# Quran Studio Pro — Template Builder System
## Implementation Plan & Walkthrough

**Document Purpose:** Step-by-step architectural guide for transitioning from the hardcoded Master Template configuration to a fully dynamic, user-customizable Template Builder System.

**Scope:** This plan addresses three core requirements:
1. Dynamic Surah Line Tracking (auto-updating on reflow)
2. Dynamic Surah Headers (parameterized SURAH_OPEN_SPAN and startAt)
3. Fully Customizable Asset System (lines per page, page dimensions, frames, typography themes)

---

## Audit: What Is Currently Hardcoded

Before writing a single line of code, the agent must understand every hardcoded value that needs to become dynamic. The following constants are scattered across the codebase and must all be centralized into the new template schema:

| File | Constant / Value | Current Value | Must Become |
|---|---|---|---|
| `src/data/pages.ts` | `LINES_PER_PAGE` | `9` | `template.linesPerPage` |
| `src/data/pages.ts` | `SURAH_OPEN_SPAN` | `2` | `template.surahOpen.headerSpan` |
| `src/data/pages.ts` | `ARABIC_FONT_PX` | `50` | `template.typography.arabicFontPx` |
| `src/data/pages.ts` | `BANGLA_FONT_PX` | `18` | `template.typography.banglaFontPx` |
| `src/data/pages.ts` | `VB_W`, `DISPLAY_W`, `SCALE`, `LINE_W` | hardcoded | `template.pageGeometry.*` |
| `src/data/pages.ts` | `GRID_W_PX` | derived | `template.pageGeometry.gridWidthPx` |
| `src/data/pages.ts` | `SIDE_PAD_PX` | `8` | `template.pageGeometry.sidePadPx` |
| `src/data/pages.ts` | `BISMILLAH_AR`, `BISMILLAH_BN` | hardcoded strings | `template.surahOpen.bismillah.*` |
| `src/components/studio/Artboard.tsx` | `VB_W`, `VB_H`, `DISPLAY_W` | `420.17, 630.28, 780` | `template.pageGeometry.*` |
| `src/components/studio/Artboard.tsx` | `ROW_BANDS_SVG` | 9 hardcoded `[y0,y1]` pairs | `template.pageGeometry.rowBandsSvg` |
| `src/components/studio/Artboard.tsx` | `HEADER_BAND`, `FOOTER_BAND_Y1` | hardcoded | `template.pageGeometry.headerBand`, `.footerBandY1` |
| `src/components/studio/Artboard.tsx` | `startAt = isOpen ? 3 : 0` | `3` | `template.surahOpen.startAt` |
| `src/components/studio/FabricLines.tsx` | `ARABIC_FONT_PX`, `BANGLA_FONT_PX`, `SYMBOL_FONT_PX` | `40, 18, 28` | `template.typography.*` |
| `src/components/studio/FabricLines.tsx` | `BASE_ARABIC_Y`, `BASE_BANGLA_Y`, `BASE_SYMBOL_Y` | `-15, 2, -7` | `template.typography.baseOffsets.*` |
| `src/components/studio/SurahOpenBlock.tsx` | `url(/templates/surah-open.svg)` | static path | `template.assets.surahOpenSvg` |
| `src/components/studio/SurahOpenBlock.tsx` | percentage positions | hardcoded inline | `template.surahOpen.layout.*` |
| `src/lib/typographyReflow.ts` | `ARTBOARD_TEXT_WIDTH = 780 - 16` | `764` | `template.pageGeometry.gridWidthPx` |
| `src/lib/textReflow.ts` | `getDomSlots()` — `Array.from({ length: 9 }, ...)` | `9` | `template.linesPerPage` |
| `src/lib/textReflow.ts` | `getDomSlots()` — `startAt = isOpen ? 3 : 0` | `3` | `template.surahOpen.startAt` |
| `src/state/overridesStore.ts` | `MASTER_DEFAULTS` | `{arabicFontPx:50, banglaFontPx:18}` | derived from active template |

---

## System Architecture Overview

The new architecture introduces four additions to the existing codebase, with minimal disruption:

```
src/
├── state/
│   ├── templateStore.ts         ← NEW: Zustand store for template CRUD
│   └── ...existing stores...
├── types/
│   └── template.ts              ← NEW: MasterTemplate TypeScript type definitions
├── lib/
│   ├── templateUtils.ts         ← NEW: Utility functions for template derivation
│   └── surahLineTracker.ts      ← NEW: Surah line map computation
├── components/
│   └── studio/
│       └── TemplateBuilderPanel.tsx ← NEW: Template editor UI
└── data/
    └── defaultTemplate.ts       ← NEW: The default "Kariana" template object
```

The three existing principles of the store architecture are preserved:
- **Zustand stores** remain the single source of truth
- **No store-to-store imports at module load time** (use `getState()` inside functions)
- **Debounced rebuilds** triggered by store subscription

---

## Phase 1: The MasterTemplate Type Schema

**File to create:** `src/types/template.ts`

This is the most important file in the entire plan. Every subsequent change depends on this type being correct and complete. The agent must create this file first.

```typescript
// src/types/template.ts

/**
 * MasterTemplate — single source of truth for all layout parameters.
 * Replaces all hardcoded constants scattered across pages.ts, Artboard.tsx,
 * FabricLines.tsx, textReflow.ts, typographyReflow.ts, and overridesStore.ts.
 */

export type BandRatios = {
  /** Fraction of band height for Tajweed symbol strip (e.g. 0.28) */
  symbolRatio: number;
  /** Fraction of band height for Bangla translation (e.g. 0.24) */
  banglaRatio: number;
  /** Arabic fills the remainder: 1 - symbolRatio - banglaRatio */
};

export type PageGeometry = {
  /** SVG viewBox width in SVG user units (e.g. 420.17) */
  viewBoxW: number;
  /** SVG viewBox height in SVG user units (e.g. 630.28) */
  viewBoxH: number;
  /** Rendered pixel width of the artboard canvas (e.g. 780) */
  displayW: number;
  /** Left x-coordinate of the text area in SVG units (e.g. 7.46) */
  lineX: number;
  /** Right x-coordinate of text area in SVG units (e.g. 412.58) */
  lineXEnd: number;
  /** Header band [y0, y1] in SVG units */
  headerBand: [number, number];
  /** y1 of the footer band in SVG units (e.g. 622.95) */
  footerBandY1: number;
  /**
   * Array of [y0, y1] pairs in SVG units, one per row.
   * Length must equal linesPerPage.
   */
  rowBandsSvg: Array<[number, number]>;
  /** Pixel padding applied to each side inside a text row (e.g. 8) */
  sidePadPx: number;
  /**
   * Safety margin in pixels to absorb sub-pixel rounding (e.g. 3).
   * Subtracts from computed grid width to prevent visual overflow.
   */
  safetyMarginPx: number;
};

export type TypographyDefaults = {
  /** Base Arabic font size in px (e.g. 50) */
  arabicFontPx: number;
  /** Base Bangla font size in px (e.g. 18) */
  banglaFontPx: number;
  /** Base Tajweed symbol font size in px (e.g. 28) */
  symbolFontPx: number;
  /** CSS font-family string for Arabic (e.g. "'Excellent Arabic', serif") */
  arabicFamily: string;
  /** CSS font-family string for Bangla */
  banglaFamily: string;
  /** Baked-in Y offset for Arabic baseline within its band (e.g. -15) */
  baseArabicY: number;
  /** Baked-in Y offset for Bangla baseline (e.g. 2) */
  baseBanglaY: number;
  /** Baked-in Y offset for symbol strip (e.g. -7) */
  baseSymbolY: number;
};

export type SurahOpenLayout = {
  /**
   * Number of lines the surah-open block occupies on the page.
   * The page builder inserts this many slots (1 surahOpen + headerSpan-1 blanks).
   * Default: 2
   */
  headerSpan: number;
  /**
   * The row index where regular Ayah text begins on surah-open type pages.
   * Must equal the number of reserved rows at the top (e.g. 3 for a page
   * that reserves rows 0-1 for surah branding and row 2 as a blank spacer).
   */
  startAt: number;
  /** Bismillah Arabic text */
  bismillahArabic: string;
  /** Bismillah Bangla translation */
  bismillahBangla: string;
  /** Position of the Surah name plate, as CSS percentage strings */
  namePlate: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
  /** Position of the Bismillah strip, as CSS percentage strings */
  bismillahStrip: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
};

export type TemplateAssets = {
  /**
   * Public URL / path to the page border SVG template.
   * Used as CSS background-image on the Artboard container.
   * e.g. "/templates/page-default.svg"
   */
  pageTemplateSvg: string;
  /**
   * Public URL / path to the surah-open block SVG.
   * Used as background-image inside SurahOpenBlock.tsx.
   * e.g. "/templates/surah-open.svg"
   */
  surahOpenSvg: string;
  /**
   * Optional URL for a header decoration / ornamental band SVG.
   * Rendered inside SlimHeader if provided.
   */
  headerDecorSvg?: string;
  /**
   * Optional URL for footer decoration.
   */
  footerDecorSvg?: string;
};

export type MasterTemplate = {
  /** Unique stable identifier (slug style, e.g. "kariana-default") */
  id: string;
  /** Human-readable display name (Bengali is fine) */
  name: string;
  /** Short description */
  description?: string;
  /** ISO timestamp of creation */
  createdAt?: string;

  /** Physical page layout parameters */
  pageGeometry: PageGeometry;

  /** Number of text rows per page — must match rowBandsSvg.length */
  linesPerPage: number;

  /** Within-band proportions for the three sub-layers */
  bandRatios: BandRatios;

  /** Default typography values */
  typography: TypographyDefaults;

  /** Surah header/open-page rules */
  surahOpen: SurahOpenLayout;

  /** File assets (SVGs, borders, frames) */
  assets: TemplateAssets;
};
```

**Key constraints the agent must verify after creating this type:**
- `pageGeometry.rowBandsSvg.length === linesPerPage` at all times
- `surahOpen.startAt >= surahOpen.headerSpan` (there must be enough reserved rows)
- `bandRatios.symbolRatio + bandRatios.banglaRatio < 1.0` (Arabic must have positive space)

---

## Phase 2: The Default "Kariana" Template Object

**File to create:** `src/data/defaultTemplate.ts`

This file transcribes all current hardcoded values from their scattered locations into the new `MasterTemplate` type. This is a pure data file — no logic.

```typescript
// src/data/defaultTemplate.ts
import type { MasterTemplate } from "@/types/template";

/**
 * The "Kariana" default template.
 * All values here are transcribed from the current hardcoded constants:
 *   - Artboard.tsx: VB_W, VB_H, DISPLAY_W, ROW_BANDS_SVG, HEADER_BAND, FOOTER_BAND_Y1
 *   - FabricLines.tsx: ARABIC_FONT_PX, BANGLA_FONT_PX, SYMBOL_FONT_PX, BASE_*_Y
 *   - pages.ts: LINES_PER_PAGE, SURAH_OPEN_SPAN, ARABIC_FONT_PX, SIDE_PAD_PX
 *   - SurahOpenBlock.tsx: percentage positions
 *   - typographyReflow.ts: ARTBOARD_TEXT_WIDTH derivation
 */
export const KARIANA_TEMPLATE: MasterTemplate = {
  id: "kariana-default",
  name: "কারিয়ানা ডিফল্ট",
  description: "স্ট্যান্ডার্ড কারিয়ানা Quran পৃষ্ঠা বিন্যাস",
  createdAt: new Date().toISOString(),

  linesPerPage: 9,

  pageGeometry: {
    viewBoxW: 420.17,
    viewBoxH: 630.28,
    displayW: 780,
    lineX: 7.46,
    lineXEnd: 412.58,
    headerBand: [7.5, 25.41],
    footerBandY1: 622.95,
    rowBandsSvg: [
      [36.86, 89.81],
      [101.43, 154.38],
      [165.82, 218.77],
      [230.22, 283.16],
      [294.63, 347.58],
      [359.01, 411.96],
      [423.54, 476.49],
      [487.83, 540.77],
      [552.30, 622.95],
    ],
    sidePadPx: 8,
    safetyMarginPx: 3,
  },

  bandRatios: {
    symbolRatio: 0.28,
    banglaRatio: 0.24,
  },

  typography: {
    arabicFontPx: 50,
    banglaFontPx: 18,
    symbolFontPx: 28,
    arabicFamily: "'Excellent Arabic', 'Amiri Quran', 'Scheherazade New', serif",
    banglaFamily: "'Kalpurush', 'Noto Serif Bengali', serif",
    baseArabicY: -15,
    baseBanglaY: 2,
    baseSymbolY: -7,
  },

  surahOpen: {
    headerSpan: 2,
    startAt: 3,
    bismillahArabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    bismillahBangla: "অসীম করুণাময় ও পরম দয়ালু আল্লাহর নামে শুরু করছি",
    namePlate: {
      left: "27.5%",
      top: "21%",
      width: "45%",
      height: "22%",
    },
    bismillahStrip: {
      left: "7.5%",
      top: "50%",
      width: "85%",
      height: "28%",
    },
  },

  assets: {
    pageTemplateSvg: "/templates/page-default.svg",
    surahOpenSvg: "/templates/surah-open.svg",
  },
};
```

---

## Phase 3: Utility Functions for Template Derivation

**File to create:** `src/lib/templateUtils.ts`

Several derived values are computed from the template geometry. Instead of computing them inline in components, derive them once using helper functions. These are the computations currently scattered as inline variable declarations in `Artboard.tsx` and `pages.ts`.

```typescript
// src/lib/templateUtils.ts
import type { MasterTemplate, PageGeometry } from "@/types/template";

/** The display scale factor (displayW / viewBoxW). */
export function getScale(geo: PageGeometry): number {
  return geo.displayW / geo.viewBoxW;
}

/** Pixel width of the entire text grid area. */
export function getGridWidthPx(template: MasterTemplate): number {
  const { lineX, lineXEnd, sidePadPx, safetyMarginPx } = template.pageGeometry;
  const scale = getScale(template.pageGeometry);
  return (lineXEnd - lineX) * scale - 2 * sidePadPx - safetyMarginPx;
}

/** Total pixel height of the artboard canvas. */
export function getDisplayH(geo: PageGeometry): number {
  return geo.viewBoxH * getScale(geo);
}

/** First row's top y in pixels. */
export function getGridTopPx(template: MasterTemplate): number {
  const [y0] = template.pageGeometry.rowBandsSvg[0]!;
  return y0 * getScale(template.pageGeometry);
}

/**
 * Compute the GRID_LAYOUT_PX array (RowBox[]) from the template.
 * This replaces the hardcoded GRID_LAYOUT_PX constant in Artboard.tsx.
 */
export type RowBox = {
  sy: number;  // row top (px, relative to grid top)
  ay: number;  // Arabic baseline zone start
  by: number;  // Bangla zone start
  symH: number;
  arH: number;
  bnH: number;
};

export function computeGridLayout(template: MasterTemplate): RowBox[] {
  const scale = getScale(template.pageGeometry);
  const { rowBandsSvg, rowBandsSvg: bands } = template.pageGeometry;
  const firstRowY = bands[0]![0];
  const { symbolRatio, banglaRatio } = template.bandRatios;

  return bands.map(([y0, y1]) => {
    const sy = (y0 - firstRowY) * scale;
    const bandH = (y1 - y0) * scale;
    const symH = bandH * symbolRatio;
    const bnH = bandH * banglaRatio;
    const arH = bandH - symH - bnH;
    return { sy, ay: sy + symH, by: sy + symH + arH, symH, arH, bnH };
  });
}

/** Compute the MASTER_DEFAULTS-compatible GlobalOverrides from a template. */
export function templateToGlobalDefaults(template: MasterTemplate) {
  return {
    arabicFontPx: template.typography.arabicFontPx,
    banglaFontPx: template.typography.banglaFontPx,
    arabicYOffset: 0,
    banglaYOffset: 0,
    symbolYOffset: 0,
  };
}
```

---

## Phase 4: The Template Store

**File to create:** `src/state/templateStore.ts`

This Zustand store manages the list of templates and the active template. It persists to localStorage. Changing the active template triggers a full rebuild.

```typescript
// src/state/templateStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MasterTemplate } from "@/types/template";
import { KARIANA_TEMPLATE } from "@/data/defaultTemplate";

type TemplateState = {
  /** All available templates (built-in + user-created) */
  templates: MasterTemplate[];
  /** ID of the currently active template */
  activeTemplateId: string;

  /** Get the active MasterTemplate object */
  getActiveTemplate: () => MasterTemplate;

  /** Switch to a different template (triggers full rebuild) */
  setActiveTemplate: (id: string) => void;

  /** Save or update a template */
  upsertTemplate: (t: MasterTemplate) => void;

  /** Delete a user-created template (built-in templates cannot be deleted) */
  deleteTemplate: (id: string) => void;

  /** Create a new template as a copy of the currently active one */
  duplicateActiveTemplate: (newName: string) => MasterTemplate;
};

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [KARIANA_TEMPLATE],
      activeTemplateId: KARIANA_TEMPLATE.id,

      getActiveTemplate: () => {
        const { templates, activeTemplateId } = get();
        return templates.find((t) => t.id === activeTemplateId) ?? KARIANA_TEMPLATE;
      },

      setActiveTemplate: (id) => {
        const template = get().templates.find((t) => t.id === id);
        if (!template) return;
        set({ activeTemplateId: id });
        // Trigger a full rebuild of pages with the new template
        // Import reflowStore lazily to avoid circular dependency
        import("./reflowStore").then(({ useReflowStore }) => {
          useReflowStore.getState().rebuild();
        });
      },

      upsertTemplate: (t) => {
        set((s) => {
          const idx = s.templates.findIndex((x) => x.id === t.id);
          if (idx >= 0) {
            const next = [...s.templates];
            next[idx] = t;
            return { templates: next };
          }
          return { templates: [...s.templates, t] };
        });
      },

      deleteTemplate: (id) => {
        if (id === KARIANA_TEMPLATE.id) return; // protect built-in
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          activeTemplateId:
            s.activeTemplateId === id ? KARIANA_TEMPLATE.id : s.activeTemplateId,
        }));
      },

      duplicateActiveTemplate: (newName) => {
        const src = get().getActiveTemplate();
        const copy: MasterTemplate = {
          ...structuredClone(src),
          id: `custom-${Date.now()}`,
          name: newName,
          createdAt: new Date().toISOString(),
        };
        get().upsertTemplate(copy);
        return copy;
      },
    }),
    {
      name: "studio-templates-v1",
      // Only persist user-created templates; always inject the built-in on load
      merge: (persisted: any, current) => ({
        ...current,
        templates: [
          KARIANA_TEMPLATE,
          ...(persisted.templates ?? []).filter(
            (t: MasterTemplate) => t.id !== KARIANA_TEMPLATE.id,
          ),
        ],
        activeTemplateId: persisted.activeTemplateId ?? KARIANA_TEMPLATE.id,
      }),
    },
  ),
);
```

---

## Phase 5: Surah Line Tracker

**File to create:** `src/lib/surahLineTracker.ts`

This module computes the `SurahLineMap` — a data structure that tells you exactly how many lines each Surah spans and across which pages. This answers Requirement 1: "dynamic tracking of lines per Surah, auto-updating when font size changes cause reflow."

```typescript
// src/lib/surahLineTracker.ts
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
```

---

## Phase 6: Update the Reflow Store

**File to modify:** `src/state/reflowStore.ts`

Add `surahLineMap` to the state and compute it after every rebuild. Also thread the active template into the `BuildOpts` passed to `buildAllPagesChunked`.

### 6.1 — Add imports at the top

```typescript
// Add these imports to reflowStore.ts
import { computeSurahLineMap, type SurahLineMap } from "@/lib/surahLineTracker";
import { templateToGlobalDefaults } from "@/lib/templateUtils";
// Note: Do NOT import useTemplateStore at module level. Use getState() inside functions.
```

### 6.2 — Add surahLineMap to the ReflowState type

In `ReflowState`, add:
```typescript
surahLineMap: SurahLineMap;
getSurahLineEntry: (surahNum: number) => import("@/lib/surahLineTracker").SurahLineEntry | undefined;
```

### 6.3 — Initialize surahLineMap in the store

In the `create()` call, initialize:
```typescript
surahLineMap: new Map(),
getSurahLineEntry: (surahNum) => get().surahLineMap.get(surahNum),
```

### 6.4 — Update the rebuild() method

The `rebuild()` method currently reads `BuildOpts` from `useOverridesStore.getState().global`. It must also read the active template. Modify the `opts` construction at the top of `rebuild()`:

```typescript
rebuild: () => {
  // Read active template from templateStore
  const { useTemplateStore } = await import(/* dynamic import pattern already used */);
  // NOTE: Because rebuild() is a synchronous function, use a top-level
  // lazy import. The pattern already exists in this file for reflowStore.
  // Replace the manual getState() call:
  const template = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("./templateStore").useTemplateStore.getState().getActiveTemplate();
    } catch {
      return null;
    }
  })();

  const g = useOverridesStore.getState().global;
  const opts: BuildOpts = {
    arabicFontPx: g.arabicFontPx ?? template?.typography.arabicFontPx ?? ARABIC_FONT_PX,
    banglaFontPx: g.banglaFontPx ?? template?.typography.banglaFontPx ?? BANGLA_FONT_PX,
    rowFontOverrides: collectRowFontOverrides(),
    // NEW: pass template so buildAllPagesChunked uses its linesPerPage
    template: template ?? undefined,
  };
  // ... rest of rebuild() unchanged
```

### 6.5 — Update the `.then()` callback in rebuild() to compute surahLineMap

After the `buildAllPagesChunked().then(pages => ...)` block, add:
```typescript
const surahLineMap = computeSurahLineMap(pages, computeDistribution(pages));
set({
  pages,
  distribution: computeDistribution(pages),
  surahLineMap,         // ← NEW
  signature: sig,
  rebuilding: false,
  buildProgress: null,
});
```

### 6.6 — Update rebuildPage() similarly

After `set({ pages: newPages, ... })` in `rebuildPage()`, also recompute:
```typescript
const surahLineMap = computeSurahLineMap(newPages, computeDistribution(newPages));
set({ pages: newPages, distribution: computeDistribution(newPages), surahLineMap });
```

---

## Phase 7: Update the Build Pipeline (pages.ts)

**File to modify:** `src/data/pages.ts`

This is the most invasive change. The `buildPagesFromVerses()` and `buildAllPagesChunked()` functions must accept a `MasterTemplate` and use it instead of the module-level constants.

### 7.1 — Add `template` to `BuildOpts`

```typescript
// Modify the BuildOpts type
export type BuildOpts = {
  arabicFontPx?: number;
  banglaFontPx?: number;
  rowFontOverrides?: Record<string, number>;
  /** Active master template. If not provided, falls back to the Kariana defaults. */
  template?: import("@/types/template").MasterTemplate;
};
```

### 7.2 — Resolve template-derived constants inside `buildPagesFromVerses()`

At the top of `buildPagesFromVerses()`, replace the hardcoded constant references with template-derived values:

```typescript
export function buildPagesFromVerses(
  verses, startVerseId, startPageNo, prevSurah, defaultMarkers,
  opts: BuildOpts = {}
): ContinuousPage[] {
  // --- RESOLVE TEMPLATE ---
  const tmpl = opts.template ?? KARIANA_TEMPLATE;
  const linesPerPage = tmpl.linesPerPage;
  const surahOpenSpan = tmpl.surahOpen.headerSpan;
  const bismillahArabic = tmpl.surahOpen.bismillahArabic;
  const bismillahBangla = tmpl.surahOpen.bismillahBangla;
  const gridWPx = getGridWidthPx(tmpl);

  const arabicFontPx = opts.arabicFontPx ?? tmpl.typography.arabicFontPx;
  const banglaFontPx = opts.banglaFontPx ?? tmpl.typography.banglaFontPx;
  // ... rest of function uses these local variables instead of module constants
```

### 7.3 — Replace all constant references in the function body

Carefully do a find-and-replace within `buildPagesFromVerses()` and `buildPagesFromVersesChunked()`:

| Find | Replace with |
|---|---|
| `LINES_PER_PAGE` | `linesPerPage` |
| `SURAH_OPEN_SPAN` | `surahOpenSpan` |
| `BISMILLAH_AR` | `bismillahArabic` |
| `BISMILLAH_BN` | `bismillahBangla` |
| `GRID_W_PX` | `gridWPx` |
| `ARABIC_FONT_PX` (in packVerses call) | `arabicFontPx` |
| `BANGLA_FONT_PX` (in packVerses call) | `banglaFontPx` |
| `ARABIC_FAMILY` | `tmpl.typography.arabicFamily` |
| `BANGLA_FAMILY` | `tmpl.typography.banglaFamily` |

The module-level `LINES_PER_PAGE`, `SURAH_OPEN_SPAN`, `BISMILLAH_AR`, `BISMILLAH_BN`, `GRID_W_PX` constants must be **kept** as module exports for backwards compatibility (some UI code may import them for display purposes), but they must no longer drive the build logic.

### 7.4 — Update `surahOpenSlot()` to accept template

```typescript
function surahOpenSlot(
  s: number,
  verses: FlowVerse[],
  bismillahArabic: string,
  bismillahBangla: string
): GridLineData {
  const m = surahMeta(verses, s);
  return {
    slotKind: "surah-open",
    blocks: [],
    surahOpen: {
      kind: "surah-open",
      surahName: m.name,
      revelation: m.revelation,
      ayah: m.ayah,
      ruku: m.ruku,
      bismillahArabic,
      bismillahBangla,
    },
  };
}
```

Pass `bismillahArabic` and `bismillahBangla` from the resolved template through every call site of `surahOpenSlot()` inside the builder functions.

---

## Phase 8: Update `getDomSlots()` in textReflow.ts

**File to modify:** `src/lib/textReflow.ts`

`getDomSlots()` is called from both the reflow engine and the cascade planner. It currently hardcodes `9` for slot count and `3` for `startAt`. It must read these from the active template.

### 8.1 — Add a template-reading helper at the top of textReflow.ts

```typescript
// Add near the top of textReflow.ts (lazy import pattern)
function getActiveTemplate(): import("@/types/template").MasterTemplate {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useTemplateStore } = require("@/state/templateStore");
    return useTemplateStore.getState().getActiveTemplate();
  } catch {
    // Fallback for SSR / test environments
    const { KARIANA_TEMPLATE } = require("@/data/defaultTemplate");
    return KARIANA_TEMPLATE;
  }
}
```

### 8.2 — Update `getDomSlots()`

```typescript
export function getDomSlots(page: any): FabricLine[] {
  const tmpl = getActiveTemplate();
  const linesPerPage = tmpl.linesPerPage;
  const surahOpenStartAt = tmpl.surahOpen.startAt;

  const slots: FabricLine[] = Array.from({ length: linesPerPage }, () => ({}));
  if (!page || !page.lines) return slots;

  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? surahOpenStartAt : 0;
  const skipSlots = new Set<number>();

  page.lines.slice(0, linesPerPage - startAt).forEach((l: any, i: number) => {
    const idx = startAt + i;
    if (l.slotKind === "surah-open" && l.surahOpen) {
      skipSlots.add(idx);
      skipSlots.add(idx + 1);
      return;
    }
    slots[idx] = {
      arabic: l.arabicLine ?? (l.blocks || []).map((b: any) => b.arabic).join(" "),
      bangla: l.banglaLine ?? (l.blocks || []).map((b: any) => b.bangla).filter(Boolean).join(" "),
      symbol: (l.markers ?? []).join("  "),
    };
  });

  for (let i = startAt; i < linesPerPage; i++) {
    if (!skipSlots.has(i) && slots[i].arabic === undefined) {
      slots[i] = { arabic: "", bangla: "", symbol: "" };
    }
  }

  return slots;
}
```

### 8.3 — Update `findNextValidRow()` and `findPrevValidRow()`

Both functions contain `searchRi = 8` (hardcoded last row index) as a fallback value. These must become `linesPerPage - 1`. Replace all instances.

---

## Phase 9: Update `typographyReflow.ts`

**File to modify:** `src/lib/typographyReflow.ts`

### 9.1 — Replace the hardcoded `ARTBOARD_TEXT_WIDTH`

```typescript
// REMOVE this line:
// export const ARTBOARD_TEXT_WIDTH = 780 - 16;

// ADD this exported function:
export function getArtboardTextWidth(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useTemplateStore } = require("@/state/templateStore");
    const { getGridWidthPx } = require("@/lib/templateUtils");
    const template = useTemplateStore.getState().getActiveTemplate();
    return getGridWidthPx(template);
  } catch {
    return 780 - 16; // safe fallback
  }
}
```

### 9.2 — Update all callers of `ARTBOARD_TEXT_WIDTH`

Search for every import of `ARTBOARD_TEXT_WIDTH` across the codebase (primarily `PropertiesPanel.tsx`, `Inspector.tsx`, `FontToolbar.tsx`). Replace each usage:

```typescript
// Before:
import { ARTBOARD_TEXT_WIDTH } from "@/lib/typographyReflow";
// ...
availableWidth: ARTBOARD_TEXT_WIDTH,

// After:
import { getArtboardTextWidth } from "@/lib/typographyReflow";
// ...
availableWidth: getArtboardTextWidth(),
```

---

## Phase 10: Update Artboard.tsx

**File to modify:** `src/components/studio/Artboard.tsx`

### 10.1 — Add template subscription

At the top of the `Artboard` component, add a subscription to the active template:

```typescript
import { useTemplateStore } from "@/state/templateStore";
import { computeGridLayout, getDisplayH, getScale, getGridWidthPx, getGridTopPx } from "@/lib/templateUtils";

// Inside the Artboard component:
const template = useTemplateStore((s) => s.getActiveTemplate());
```

### 10.2 — Replace all hardcoded geometry constants with template-derived values

The following module-level constants in `Artboard.tsx` must be **deleted** and replaced with derived values inside the component body:

```typescript
// DELETE these module-level constants:
// const VB_W = 420.17;
// const VB_H = 630.28;
// const DISPLAY_W = 780;
// const SCALE = DISPLAY_W / VB_W;
// const LINE_X = 7.46;
// const LINE_W = 412.58 - 7.46;
// const HEADER_BAND = { y0: 7.5, y1: 25.41 };
// const FOOTER_BAND_Y1 = 622.95;
// const ROW_BANDS_SVG = [ ... ];
// const GRID_LAYOUT_PX = ROW_BANDS_SVG.map(...);
// const GRID_W_PX = ...
// const GRID_H_PX = ...
// const GRID_TOP_PX = ...
// const HEADER_TOP_PX = ...
// const HEADER_H_PX = ...
// const FOOTER_H_PX = ...
// const FOOTER_TOP_PX = ...

// REPLACE with (inside Artboard component function, using useMemo):
const gridLayout = useMemo(() => computeGridLayout(template), [template]);
const scale = getScale(template.pageGeometry);
const displayH = getDisplayH(template.pageGeometry);
const gridTopPx = getGridTopPx(template);
const gridWidthPx = getGridWidthPx(template);
const geo = template.pageGeometry;
const headerTopPx = geo.headerBand[0] * scale;
const headerHPx = (geo.headerBand[1] - geo.headerBand[0]) * scale;
const footerHPx = 16 * scale;
const footerTopPx = (geo.footerBandY1 - 16) * scale;
const lastRowY2 = geo.rowBandsSvg[geo.rowBandsSvg.length - 1]![1];
const gridHPx = (lastRowY2 - geo.rowBandsSvg[0]![0]) * scale;
const gridLeftPx = geo.lineX * scale;
```

### 10.3 — Update surahOpen startAt reference

```typescript
// Before:
const startAt = isOpen ? 3 : 0;

// After:
const startAt = isOpen ? template.surahOpen.startAt : 0;
```

### 10.4 — Update the `SurahOpenBlock` height calculation

Currently the `SurahOpenBlock` height is derived from `ROW_BANDS_SVG`. Replace with:
```typescript
const surahOpenBandCount = template.surahOpen.headerSpan;
const surahOpenHeight = surahOpenBandCount > 0
  ? (gridLayout[startAt + surahOpenBandCount - 1]!.sy +
     (gridLayout[startAt + surahOpenBandCount - 1]!.arH +
      gridLayout[startAt + surahOpenBandCount - 1]!.bnH +
      gridLayout[startAt + surahOpenBendCount - 1]!.symH) -
     gridLayout[startAt]!.sy)
  : 0;
```

### 10.5 — Update the background image

Pass the template's page SVG as the border/frame:
```typescript
// In the main artboard container div's style:
backgroundImage: `url(${template.assets.pageTemplateSvg})`,
```

---

## Phase 11: Update FabricLines.tsx

**File to modify:** `src/components/studio/FabricLines.tsx`

### 11.1 — Convert module-level constants to template-driven values

The constants `ARABIC_FONT_PX`, `BANGLA_FONT_PX`, `SYMBOL_FONT_PX`, `BASE_ARABIC_Y`, `BASE_BANGLA_Y`, `BASE_SYMBOL_Y` are exported and used in other components. Keep them as **fallback exports** but make the component read from the active template:

```typescript
// Keep these as FALLBACK EXPORTS for backward compat (used by Inspector.tsx etc.)
export const ARABIC_FONT_PX = 40;
export const BANGLA_FONT_PX = 18;
export const SYMBOL_FONT_PX = 28;
export const BASE_ARABIC_Y = -15;
export const BASE_BANGLA_Y = 2;
export const BASE_SYMBOL_Y = -7;
```

### 11.2 — Update `useGlobalLayoutValues()`

```typescript
// Add template store import
import { useTemplateStore } from "@/state/templateStore";

// Update useGlobalLayoutValues to read base offsets from template
const useGlobalLayoutValues = (): GlobalLayoutValues => {
  const template = useTemplateStore((s) => s.getActiveTemplate());
  return useOverridesStore(
    useShallow((s) => ({
      gArabic: s.global.arabicFontPx ?? template.typography.arabicFontPx,
      gBangla: s.global.banglaFontPx ?? template.typography.banglaFontPx,
      gArabicY: template.typography.baseArabicY + (s.global.arabicYOffset ?? 0),
      gBanglaY: template.typography.baseBanglaY + (s.global.banglaYOffset ?? 0),
      gSymbolY: template.typography.baseSymbolY + (s.global.symbolYOffset ?? 0),
    })),
  );
};
```

---

## Phase 12: Update SurahOpenBlock.tsx

**File to modify:** `src/components/studio/SurahOpenBlock.tsx`

This component has hardcoded percentage positions and a hardcoded font size. Replace them with template-driven values.

### 12.1 — Update Props

Add `surahOpenConfig` prop:
```typescript
import type { SurahOpenLayout } from "@/types/template";
import { useTemplateStore } from "@/state/templateStore";

type Props = {
  surahName: string;
  revelation: string;
  ayah: string | number;
  ruku: string | number;
  width: number;
  height: number;
  arabicFamily: string;
  /** Optional: if not passed, reads from active template */
  surahOpenConfig?: SurahOpenLayout;
};
```

### 12.2 — Use template values in the component

```typescript
export const SurahOpenBlock = memo(function SurahOpenBlock(props: Props) {
  const activeConfig = useTemplateStore((s) => s.getActiveTemplate().surahOpen);
  const config = props.surahOpenConfig ?? activeConfig;
  const template = useTemplateStore((s) => s.getActiveTemplate());

  return (
    <div
      style={{
        position: "relative",
        width: props.width,
        height: props.height,
        backgroundImage: `url(${template.assets.surahOpenSvg})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Name plate — positions from template */}
      <div
        style={{
          position: "absolute",
          left: config.namePlate.left,
          top: config.namePlate.top,
          width: config.namePlate.width,
          height: config.namePlate.height,
          // ... rest of styles unchanged
        }}
      >
        {/* content unchanged */}
      </div>

      {/* Bismillah strip — positions and text from template */}
      <div
        style={{
          position: "absolute",
          left: config.bismillahStrip.left,
          top: config.bismillahStrip.top,
          width: config.bismillahStrip.width,
          height: config.bismillahStrip.height,
          // ... rest of styles unchanged
        }}
      >
        <div dir="rtl" lang="ar" style={{ fontFamily: props.arabicFamily, ... }}>
          {config.bismillahArabic}
        </div>
        <div lang="bn">
          {config.bismillahBangla}
        </div>
      </div>
    </div>
  );
});
```

---

## Phase 13: Update MASTER_DEFAULTS in overridesStore.ts

**File to modify:** `src/state/overridesStore.ts`

`MASTER_DEFAULTS` must reflect the active template's typography defaults. However, because `overridesStore.ts` is a core store that gets imported by many files, avoid importing `templateStore` at module level.

### 13.1 — Make MASTER_DEFAULTS a lazy getter

```typescript
// KEEP the static MASTER_DEFAULTS for backward compatibility:
export const MASTER_DEFAULTS: GlobalOverrides = {
  arabicFontPx: 50,
  banglaFontPx: 18,
  arabicYOffset: 0,
  banglaYOffset: 0,
  symbolYOffset: 0,
};

// ADD a function that returns template-aware defaults:
export function getEffectiveMasterDefaults(): GlobalOverrides {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useTemplateStore } = require("@/state/templateStore");
    const { templateToGlobalDefaults } = require("@/lib/templateUtils");
    const template = useTemplateStore.getState().getActiveTemplate();
    return templateToGlobalDefaults(template);
  } catch {
    return MASTER_DEFAULTS;
  }
}
```

### 13.2 — Update `resetAll()` in the store

```typescript
resetAll: () => set({
  global: { ...getEffectiveMasterDefaults() },
  local: {},
  globalSubRuleDx: {}
}),
```

### 13.3 — Update the `merge()` function in the persist middleware

```typescript
merge: (persisted, current) => ({
  ...current,
  global: { ...getEffectiveMasterDefaults(), ...(persisted as Persisted).global },
  local: (persisted as Persisted).local ?? {},
  globalSubRuleDx: (persisted as Persisted).globalSubRuleDx ?? {},
}),
```

---

## Phase 14: Template Builder UI

**File to create:** `src/components/studio/TemplateBuilderPanel.tsx`

This is the UI panel that lives in the Inspector's "টেমপ্লেট" tab (currently showing `<TemplatePanel />`). Replace that component with the new `TemplateBuilderPanel`.

### 14.1 — Panel architecture

The panel has four sections, displayed as collapsible accordions:

**Section 1: Template Management**
- Dropdown to switch active template
- "নতুন কপি তৈরি করুন" (Duplicate) button → opens a modal asking for a name
- "মুছে ফেলুন" (Delete) button (disabled for built-in templates)
- "টেমপ্লেট রপ্তানি করুন" (Export as JSON) button
- "টেমপ্লেট আমদানি করুন" (Import from JSON) button

**Section 2: পৃষ্ঠা বিন্যাস (Page Layout)**
- Slider: "প্রতি পৃষ্ঠায় লাইন" (Lines per page, range: 7–15, integer only)
  - ⚠️ When changed, it must also resize `rowBandsSvg` array (auto-distribute bands evenly)
- Number input: "পৃষ্ঠা প্রস্থ (px)" — modifies `pageGeometry.displayW`
- Number input: "পার্শ্ব প্যাডিং (px)" — modifies `pageGeometry.sidePadPx`

**Section 3: সূরা হেডার নিয়ম (Surah Header Rules)**
- Slider: "হেডার স্প্যান" (Header span, range: 1–4) — modifies `surahOpen.headerSpan`
  - Must also update `surahOpen.startAt = headerSpan + 1` automatically
- Textarea: "বিসমিল্লাহ আরবি" — modifies `surahOpen.bismillahArabic`
- Textarea: "বিসমিল্লাহ বাংলা" — modifies `surahOpen.bismillahBangla`
- Number inputs for `namePlate.left/top/width/height` (percentage)
- Number inputs for `bismillahStrip.left/top/width/height` (percentage)

**Section 4: ফ্রেম ও অ্যাসেট (Frame & Assets)**
- File upload input for "পেজ টেমপ্লেট SVG" — uploads to local object URL, stores in `assets.pageTemplateSvg`
- File upload input for "সূরা ওপেন SVG" — similar
- Text input to type a custom URL instead of uploading

**Section 5: সূরা লাইন তথ্য (Surah Line Info) — Read-only**
- This section displays the `surahLineMap` data for the current page.
- Shows: "এই সূরার মোট লাইন: X", "মোট পৃষ্ঠা: Y"
- Updates live after any rebuild.

### 14.2 — Key interaction rule: "Apply and Rebuild"

Every change in the Template Builder must:
1. Call `useTemplateStore.getState().upsertTemplate(modifiedTemplate)`
2. Then call `useReflowStore.getState().rebuild()`

This ensures the full page builder pipeline re-runs with the new template parameters.

### 14.3 — Lines-per-page change handler

Changing `linesPerPage` is special because `rowBandsSvg` length must match. The handler must auto-generate new band coordinates:

```typescript
function handleLinesPerPageChange(
  template: MasterTemplate,
  newCount: number,
): MasterTemplate {
  const { viewBoxH, headerBand, footerBandY1 } = template.pageGeometry;
  const usableStart = headerBand[1] + 5; // 5px gap after header
  const usableEnd = footerBandY1 - 5;
  const usableHeight = usableEnd - usableStart;
  const gapBetweenBands = usableHeight * 0.015; // 1.5% gap
  const totalGaps = (newCount - 1) * gapBetweenBands;
  const bandHeight = (usableHeight - totalGaps) / newCount;

  const newRowBands: Array<[number, number]> = Array.from(
    { length: newCount },
    (_, i) => {
      const y0 = usableStart + i * (bandHeight + gapBetweenBands);
      const y1 = y0 + bandHeight;
      return [y0, y1];
    },
  );

  return {
    ...template,
    linesPerPage: newCount,
    pageGeometry: {
      ...template.pageGeometry,
      rowBandsSvg: newRowBands,
    },
  };
}
```

---

## Phase 15: Wire Up the SurahLineMap in the UI

**File to modify:** `src/components/studio/PageList.tsx` (and anywhere surah line info is displayed)

After Phase 6 is complete, the `surahLineMap` is available via:
```typescript
const surahLineMap = useReflowStore((s) => s.surahLineMap);
const activePageDist = useReflowStore((s) =>
  s.distribution.find((d) => d.pageId === activePageId)
);
const surahEntry = surahLineMap.get(activePageDist?.surah ?? 0);
```

Display this in the `PageList.tsx` sidebar and in the `TemplateBuilderPanel.tsx` read-only section.

---

## Phase 16: Migration Strategy (Backward Compatibility)

These steps ensure the existing behavior is preserved during the migration.

### 16.1 — The "kariana-default" template must exactly reproduce the current behavior

Before beginning any Phase, create a snapshot test: render the first 5 pages with current hardcoded constants. After implementing all phases, render the same 5 pages with the `KARIANA_TEMPLATE` object. The output must be byte-identical.

### 16.2 — Persisted local overrides remain valid

The `overridesStore` keys (`layer:{pageId}:{rowIndex}:{layer}`) are page-ID-based, not template-based. Since the default template produces the same page IDs as before, all existing overrides remain valid.

### 16.3 — Template switching clears local overrides

When a user switches to a template that produces a different `linesPerPage` or different row count, the existing local overrides (which are row-index-bound) will map to the wrong rows. The `setActiveTemplate()` action should optionally prompt the user: "টেমপ্লেট পরিবর্তন করলে বর্তমান টেক্সট পরিবর্তনগুলো মুছে যাবে। এগিয়ে যেতে চান?"

If confirmed, call `useOverridesStore.getState().resetAll()` before the rebuild.

### 16.4 — Keep backward-compat exports in pages.ts

Do not delete `LINES_PER_PAGE`, `ARABIC_FONT_PX`, `BANGLA_FONT_PX` from the module exports. Keep them as static constants. They are no longer used in the build logic but may be imported elsewhere as display hints.

---

## Phase 17: Dynamic Surah Header Rules — Special Handling

This section addresses Requirement 2 in depth. The `headerSpan` value governs a chain of three behaviors:

### Behavior A: Page builder slot allocation

In `buildPagesFromVerses()`, when a new surah is detected, the code currently does:
```typescript
// CURRENT:
pageSlots.push(surahOpenSlot(...));
pageSlots.push(blankSlot());  // 1 blank = SURAH_OPEN_SPAN - 1 = 1

// AFTER CHANGE (using headerSpan):
pageSlots.push(surahOpenSlot(...));
for (let k = 1; k < surahOpenSpan; k++) {
  pageSlots.push(blankSlot());
}
```

Also update the `remaining` check:
```typescript
// CURRENT:
const remaining = LINES_PER_PAGE - pageSlots.length;
if (remaining < SURAH_OPEN_SPAN + 1) flushPage();

// AFTER:
if (remaining < surahOpenSpan + 1) flushPage();
```

### Behavior B: getDomSlots() skip logic

`getDomSlots()` currently skips `idx` and `idx + 1` when a surahOpen slot is found. This skip count equals `headerSpan`. Update:

```typescript
// CURRENT:
skipSlots.add(idx);
skipSlots.add(idx + 1);

// AFTER:
for (let k = 0; k < surahOpenSpan; k++) {
  skipSlots.add(idx + k);
}
```

### Behavior C: Artboard visual rendering

The `startAt` on surah-open pages must equal `template.surahOpen.startAt`, which must always equal `surahOpen.headerSpan + 1` (to leave a spacer row above the text). The `TemplateBuilderPanel` must enforce this: when `headerSpan` changes, auto-set `startAt = headerSpan + 1`.

---

## Phase 18: Asset Upload System

This phase enables uploading custom SVG frames via the Template Builder UI.

### 18.1 — Object URL strategy

For user-uploaded SVG files, use `URL.createObjectURL()` to generate a temporary browser-local URL. Store this URL string in `template.assets.pageTemplateSvg`. Object URLs survive page reloads only in the same browser tab, so also store the SVG text content in the template object for persistence.

### 18.2 — Extend `TemplateAssets` type

```typescript
// Add to TemplateAssets in template.ts:
export type TemplateAssets = {
  pageTemplateSvg: string;
  surahOpenSvg: string;
  /** Base64-encoded SVG for persistence when using uploaded files */
  pageTemplateSvgData?: string;
  surahOpenSvgData?: string;
  headerDecorSvg?: string;
  footerDecorSvg?: string;
};
```

### 18.3 — On template load, reconstruct Object URLs from base64 data

Add a `hydrateTemplateAssets()` function to `templateUtils.ts`:

```typescript
export function hydrateTemplateAssets(template: MasterTemplate): MasterTemplate {
  const assets = { ...template.assets };
  if (assets.pageTemplateSvgData && assets.pageTemplateSvg.startsWith("blob:")) {
    // Reconstruct the blob URL from saved base64
    const svgBlob = new Blob(
      [atob(assets.pageTemplateSvgData)],
      { type: "image/svg+xml" }
    );
    assets.pageTemplateSvg = URL.createObjectURL(svgBlob);
  }
  if (assets.surahOpenSvgData && assets.surahOpenSvg.startsWith("blob:")) {
    const svgBlob = new Blob(
      [atob(assets.surahOpenSvgData)],
      { type: "image/svg+xml" }
    );
    assets.surahOpenSvg = URL.createObjectURL(svgBlob);
  }
  return { ...template, assets };
}
```

Call this in `templateStore.ts` inside the `persist.merge()` function.

### 18.4 — File upload handler in TemplateBuilderPanel

```typescript
async function handleSvgUpload(
  file: File,
  field: "pageTemplateSvg" | "surahOpenSvg"
) {
  const text = await file.text();
  const base64 = btoa(text);
  const objectUrl = URL.createObjectURL(file);
  const updated = {
    ...currentTemplate,
    assets: {
      ...currentTemplate.assets,
      [field]: objectUrl,
      [`${field}Data`]: base64,
    },
  };
  useTemplateStore.getState().upsertTemplate(updated);
  useReflowStore.getState().rebuild();
}
```

---

## Execution Order Summary

The agent must execute phases in this exact order to avoid breaking the build:

```
Phase 1  → Create src/types/template.ts
Phase 2  → Create src/data/defaultTemplate.ts
Phase 3  → Create src/lib/templateUtils.ts
Phase 4  → Create src/state/templateStore.ts
Phase 5  → Create src/lib/surahLineTracker.ts
Phase 6  → Modify src/state/reflowStore.ts
Phase 7  → Modify src/data/pages.ts
Phase 8  → Modify src/lib/textReflow.ts
Phase 9  → Modify src/lib/typographyReflow.ts
Phase 10 → Modify src/components/studio/Artboard.tsx
Phase 11 → Modify src/components/studio/FabricLines.tsx
Phase 12 → Modify src/components/studio/SurahOpenBlock.tsx
Phase 13 → Modify src/state/overridesStore.ts
Phase 14 → Create src/components/studio/TemplateBuilderPanel.tsx
Phase 15 → Modify src/components/studio/PageList.tsx (add surah line display)
Phase 16 → Verify backward compatibility (snapshot test)
Phase 17 → Verify dynamic surah header behaviors A, B, C
Phase 18 → Add asset upload handlers to TemplateBuilderPanel
```

After completing Phase 13, the application must still run identically to before. Only after Phase 14 is complete does the user see the new Template Builder UI.

---

## Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `require()` calls inside Zustand stores may fail in SSR or vitest | Wrap every `require()` call in a try-catch that returns the static KARIANA_TEMPLATE fallback |
| Changing `linesPerPage` mid-session invalidates all local overrides row indices | Prompt user before template switch; call `resetAll()` on confirm |
| Object URL for SVG frames is tab-local | Persist SVG as base64 in template data; reconstruct URL on load |
| `computeSignature()` in reflowStore doesn't include `activeTemplateId` | Add `templateId` to the signature string so switching templates triggers rebuild |
| InDesign-style cascade walk hardcodes `ri = 8` in backfill/fallback | All such fallbacks must use `linesPerPage - 1` from the active template |
| `distribution.rowCount` is computed from `ayahLines.length` — still correct | No change needed; `rowCount` counts actual ayah lines regardless of linesPerPage |

---

## Final Verification Checklist

After all phases are complete, verify these behaviors before handoff:

- [ ] `KARIANA_TEMPLATE` produces byte-identical pages to the pre-migration baseline
- [ ] Changing Arabic font size still triggers reflow and `surahLineMap` updates
- [ ] Creating a template with `linesPerPage: 12` produces 12-band pages
- [ ] Surah-open pages on a 12-line template respect `startAt = 4` (if `headerSpan = 3`)
- [ ] Uploading a custom page SVG updates the Artboard background immediately
- [ ] Importing a template JSON file creates a new template in the list
- [ ] Switching templates triggers a full rebuild and clears appropriate local overrides
- [ ] The `surahLineMap` in `TemplateBuilderPanel` shows accurate line counts
- [ ] `typographyReflow.ts`'s `getArtboardTextWidth()` returns the correct value for each template
- [ ] `PropertiesPanel.tsx` reset behavior uses `getEffectiveMasterDefaults()` not `MASTER_DEFAULTS`
