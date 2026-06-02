# Quran Studio Pro — সম্পূর্ণ Codebase Documentation

> **লক্ষ্য:** যে কোনো নতুন developer এই ফাইল পড়ে সম্পূর্ণ editor-এর features ও code structure বুঝতে পারবেন।
> **Framework:** TanStack Start (React SSR) + Vite + TypeScript + Zustand + Tailwind CSS
> **Path:** `c:\xampp\htdocs\new from ctg quran\`
> **Port:** http://localhost:8080

---

## ১. প্রজেক্ট সংক্ষেপ

**Studio Al-Qalam** হল একটি InDesign-অনুপ্রাণিত Mushaf (Quran) DTP editor। এটি আরবি ও বাংলা দুটি layer-এ কুরআনের আয়াত layout করে, typography নিয়ন্ত্রণ করে, tajweed চিহ্ন স্বয়ংক্রিয়ভাবে বসায়, এবং PDF/PNG export সমর্থন করে।

### মূল বৈশিষ্ট্য
- **Artboard:** 780x1170px Mushaf পেজ, প্রতি পেজে ৯টি row/slot
- **Dual layer:** আরবি (Arabic RTL) + বাংলা অনুবাদ (Bangla LTR)
- **TopSymbol layer:** 12টি tajweed চিহ্ন অটো-পজিশনিং
- **Scope system:** general / page / surah / para / global
- **Reflow engine:** text overflow হলে পরের পেজে cascade
- **History:** undo/redo + permanent history log

---

## ২. ডিরেক্টরি কাঠামো

```
src/
├── components/studio/    ← সব UI component
├── state/               ← Zustand stores (global state)
├── lib/                 ← pure utility functions
│   └── tajweed/         ← tajweed detection engine
├── context/             ← React Context providers
├── hooks/               ← custom React hooks
├── data/                ← static Quran verse data
├── routes/              ← TanStack Router routes
├── tajweed/             ← font char map
└── styles.css           ← global CSS + font-face
```

---

## ৩. State Management (Zustand Stores)

### editorStore.ts — UI mode & selection
| Field | Type | বিবরণ |
|-------|------|--------|
| `editMode` | boolean | Editor panel খোলা/বন্ধ |
| `activeTool` | select/type | V=select, T=type |
| `scope` | SelectionScope | general/page/surah/para/global |
| `selection` | Selection/null | বর্তমানে selected element |
| `showGuides` | boolean | slot guideline |
| `activePageId` | string/null | বর্তমান active পেজ |
| `pendingReflow` | PendingReflow/null | cross-page dialog |

**SelectionScope:** general=শুধু এই element, page=এই পেজ, surah=এই সূরা, para=এই পারা, global=সব পেজ

### overridesStore.ts — Typography & position overrides
Zundo দিয়ে undo/redo সমর্থিত।

**GlobalOverrides:** arabicFontPx(50), banglaFontPx(18), arabicYOffset, banglaYOffset, symbolYOffset, symbolScale, rowSpacing

**LocalOverride (per row/layer):** dx, dy, fontPx, leading, tracking, vScale, hScale, baseline, align, text, textMode("point"/"area"), areaHeight

**Key Format:**
- `row:pageId:rowIndex` — row-level
- `layer:pageId:rowIndex:arabic|bangla|symbol` — sub-layer
- `word:pageId:rowIndex:wordIndex` — word-level
- `symbol:pageId:rowIndex:charIndex:symbolId` — symbol

**Important:** `patchScoped(key, patch, scope)` — scope অনুযায়ী fan-out

### historyStore.ts — Dual history system
**CanvasToolbar History:** `sessionEntries()` — editor খোলার পর থেকে (session only)
**PropertiesPanel History:** `entries` — সকল permanent entries (master/template সব পরিবর্তন)

Methods: push(), pushStoryCommit(), restoreTo(id), markSessionStart(), beginSilent()/endSilent()

### reflowStore.ts — Page data & reflow status
pages[], distribution[], isReflowing, rebuilding, buildProgress, versesReady
Methods: init(), rebuild(), rebuildPage(), injectPage(), removePage()

### linkingStore.ts — Layer linking
{ arabic: boolean, bangla: boolean, symbol: boolean }
Linking ON হলে typography change সব linked row-এ cascade হয়।

---

## ৪. UI Components

### Workspace.tsx — মূল layout
Desktop layout: PageList (left) + Canvas (center) + Inspector (right)
Keyboard: E=edit, V=select, T=type, G=guide, F=fit, Ctrl+Z=undo, Alt+1-5=scope

### CanvasToolbar.tsx — টপ টুলবার
Edit mode: Tool buttons + Scope selector + Undo/Redo + **Session History dropdown** + Guide + PNG

**Session History:** editor খোলার পর থেকে entries, sessionEntries() ব্যবহার করে।

### Inspector.tsx — Right sidebar
Edit mode tab 1: **প্রপার্টিজ** → PropertiesPanel (default visible/expanded)
Edit mode tab 2: **লেয়ার** → LayerPanel
Preview mode: টেমপ্লেট, ব্যাকগ্রাউন্ড, রুলস, ফন্ট, Export

### PropertiesPanel.tsx — Properties controls
Tab 1 (নিয়ন্ত্রণ): আরবি/বাংলা/প্রতীক sliders, Transform, ইতিহাস group (Undo/Redo/Reset), Linking panel, SubLayer panel, Character panel, Word panel, Scope selector

Tab 2 (ইতিহাস): **Permanent history** — সব entries, "মাস্টার ও টেমপ্লেটের সকল ইতিহাস" subtitle, Restore বাটন

**Reset Button:** Scope-aware label, general+no selection=disabled, Confirmation dialog, reset করলে markSessionStart()

### Artboard.tsx — Canvas পেজ (780x1170px)
SlimHeader + SurahOpenBlock + FabricLines (rows) + SlimFooter + ArchedHeader

### FabricLines.tsx — Row renderer & editor (~48KB, সবচেয়ে বড়)
Constants: ARABIC_FONT_PX=50, BANGLA_FONT_PX=18, BASE_ARABIC_Y=-15, BASE_BANGLA_Y=2

Features: Row click=selection, double-click=inline editor, overflow cascade, Enter=split, Backspace=merge, UnifiedStoryEditor overlay

### TopSymbolLayer.tsx — Tajweed symbol overlay
1. detectTajweed(arabicText) → TajweedMatch[] (charIndex, symbol)
2. measureCharCenter(span, layer, charIndex) → x pixel position
3. Symbol icon absolute position করে row-এর উপরে (top: -16)
4. ResizeObserver + MutationObserver দিয়ে live update

**Current:** সব symbol লাল রঙে (#ef4444), scale/dx/dy override সমর্থিত

### RulesPanel.tsx — Tajweed rules toggle
12টি rule toggle, "সব চালু"/"সব বন্ধ", Symbol preview

---

## ৫. Library Files

### textReflow.ts — Reflow engine (~28KB)
reflowLayerText(opts), reflowFromAsync(), backFillFrom(), planCascade(), getDomSlots()
Reason types: "typing" | "text-edit" | "typography" | "paste" | "story-commit"

### quranLayout.ts — Verse packing
packVerses(verses, opts) → FlowLine[] — Arabic + Bangla আলাদাভাবে pack, তারপর zip

### scopeTargets.ts — Scope resolution
resolveTargetPageIds(), buildScopedKeys(), buildVisibleDualLayerKeys()

### typographyReflow.ts — Typography change handler
applyTypographyAndReflow(), isTypographyField() — fontPx/leading/tracking triggers reflow

### rowSlotMapper.ts — Slot validity
getValidTextSlots(), isReservedSlot() — surah-open page row 0-2 reserved

### textStory.ts — Story editor utilities
buildStory(scope, layer, anchorPageId, ...) → TextStory
storyToRowPatches(story, newText) → StoryPatchPlan

### canvasMeasure.ts — Text measurement
measureTextWidthCanvas(), splitToFitArea() — OffscreenCanvas (SSR safe)

---

## ৬. Tajweed System

### 12টি Symbol (TopSymbolId: 1-12)

| ID | নাম | বর্তমান Detection |
|----|-----|------------------|
| 1 | Madd Asli | ২ harakat madd (ا ي و) |
| 2 | Madd Layn | Fatha + (يْ/وْ) শব্দ শেষে |
| 3 | Madd Munfasil | Madd + পরের শব্দে hamza |
| 4 | Madd Lazim/Muttasil | Madd + shadda/sukun একই শব্দে |
| 5 | Madd Iwad | Fathatan + ayah end |
| 6 | Madd Aridh Li-Sukun | শেষ madd + waqf |
| 7 | Ghunnah | Noon/Meem + shadda |
| 8 | Qalqalah | ق ط ب ج د + sukun |
| 9 | Isti'la | Isti'la letters & Raa with Fatha |
| 10 | Iqlab | Noon sakin/tanween + Ba |
| 11 | Ikhfa | Noon sakin/tanween + ikhfa letters |
| 12 | Waqf | শেষ letter + stop |

**⚠️ Current Status:** Rules 9 (Isti'la) & 10 (Iqlab) have basic implementations in `rules.ts`. However, real Mushaf publishing requires expert review + proper implementation tuning for all 12 rules.

### Algorithm (rules.ts → detectTajweed)
1. clusterize() → Arabic grapheme clusters
2. Madd analysis → maddAt() দিয়ে madd প্রকার নির্ণয়
3. Per-cluster rules (Layn, Qalqalah, Ghunnah, Ikhfa, Waqf)
4. Priority: ছোট ID = বেশি priority

### Font
`public/fonts/tajweed-symbols.woff2` — custom icon font
CSS class: `.tajweed-icon` → `font-family: "TajweedSymbols"`

---

## ৭. Data Layer

### PageData (src/data/pages.ts)
```
id: "vpage-1", "vpage-2", ...
lines: LineSlot[] (9 slots)
footer: { pageNo, surah }
type: "normal" | "surah-open" | "blank"
```

**LineSlot:** slotKind(ayah/reserved/blank), arabic, bangla, arH, bnH, symH, y

**Artboard:** Width=780px, Height=1170px, Side pad=8px, Text width=764px

---

## ৮. UnifiedStoryEditor (Phase 3)

`src/components/studio/UnifiedStoryEditor.tsx`

Non-general scope-এ Type tool এটি ব্যবহার করে।
Flow: buildStory() → contenteditable → storyToRowPatches() → beginSilent/endSilent + pushStoryCommit()

---

## ৯. Bug Fixes (2026-05-31)

### Fix 1: Properties Panel Default Visible
**File:** Inspector.tsx — সবসময় visible, never collapsed

### Fix 2: Dual History System  
- PropertiesPanel: `s.entries` (ALL entries, permanent)
- CanvasToolbar: `sessionEntries()` (session only)

### Fix 3: Reset Button
- general+no selection = disabled
- Scope-aware label ("পেজ রিসেট করুন" / "সম্পূর্ণ রিসেট শুরু ❗")
- Reset → markSessionStart() (session timer reset)

---

## ১০. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| E | Edit mode toggle |
| V | Select tool |
| T | Type tool |
| G | Guide toggle |
| F | Fit zoom |
| [ / ] | Zoom out/in |
| ← → | Page navigation |
| Arrow keys | Nudge 1px |
| Shift+Arrow | Nudge 10px |
| Escape | Deselect/close |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+P | Print/PDF |
| Alt+1-5 | Scope switch |

---

## ১১. TopSymbol Future Plan

**বর্তমান:** 12 symbol font আছে, detection partially done, rules 9-10 empty
**আগামী কাজ:** Actual Quranic tajweed rules implement, UI features, color coding, manual override

---

*শেষ আপডেট: 2026-05-31 | Agent: Antigravity*
