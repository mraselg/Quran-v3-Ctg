# Quran Studio Pro — Final Completion Plan & Roadmap

এই প্ল্যানটি তৈরি করা হয়েছে **Quran Studio Pro (Mushaf DTP Editor)** প্রজেক্টটিকে বর্তমান অবস্থা থেকে সম্পূর্ণ করে লাইভ প্রোডাকশন এবং Desktop App (.exe) হিসেবে রিলিজ করার জন্য। যেকোনো AI Agent বা Developer এই প্ল্যান অনুসরণ করে ধাপে ধাপে কাজ সম্পূর্ণ করতে পারবেন।

---

## ১. বর্তমান অবস্থা (Current State Analysis)

**Frameworks:** TanStack Start, React 19, Vite, TypeScript, Zustand, Tailwind CSS, Radix UI.
**Core Engine:** 780x1170px dual-layer (Arabic & Bangla) canvas, symbol layer, CSS transform-based scaling. 
**Data:** Static JSON files (`verses.json`, `fatiha.json`, `pages.json`).
**Completed Features:**
- UI Workspace, Toolbar, Properties Panel, Inspector Panel, Canvas.
- Basic Reflow System (Point text).
- 12 Tajweed Symbol detection (Partially done: Rules 1-8, 11-12 active. Rules 9-10 unimplemented).
- Zustand stores (`editorStore`, `historyStore`, `overridesStore`, `reflowStore`, `linkingStore`).
- Bug fixes related to Properties panel visibility, history scoping, and resetting have been successfully completed.

---

## ২. রিলিজ রোডম্যাপ (Roadmap to Go Live & .exe)

প্রজেক্টটি শেষ করতে মূল ৪টি ফেজ রয়েছে:

- **Phase 1:** Core Text & Layout Engine Completion (Paragraph Linking, Reflow & Padding/Margin).
- **Phase 2:** Tajweed & TopSymbol Perfection (Rules completion & UI overrides).
- **Phase 3:** UI/UX Polish & App Performance (Loading States, Icons, Better Overlays).
- **Phase 4:** Desktop App Conversion (Electron/Tauri) & Export Options.

---

## ৩. বিস্তারিত ইমপ্লিমেন্টেশন প্ল্যান (Step-by-Step Implementation)

### Phase 1: Core Text & Layout Engine Completion

**Target:** `PARAGRAPH_LINKING_PLAN.md` অনুযায়ী Area Text Linking ও 2D Overflow সম্পূর্ণ করা।

#### 1.1 Area Text Measurement (`src/lib/canvasMeasure.ts`)
**Action:** `splitToFitArea` ফাংশন যোগ করা।
**Implementation Reference:**
```typescript
// [NEW] src/lib/canvasMeasure.ts
export function splitToFitArea(
  text: string, 
  availableWidth: number, 
  maxHeight: number, 
  fontFamily: string, 
  fontSize: number, 
  leading: number
): { fits: string; overflow: string } {
  // 1. Text tokenization by words
  // 2. Wrap words into lines based on availableWidth
  // 3. Keep tracking totalHeight (lines.length * (fontSize * leading))
  // 4. Return { fits: words that fit, overflow: remaining words }
}
```

#### 1.2 Reflow Engine Updates (`src/lib/textReflow.ts`)
**Action:** Area text-এর জন্য early return সরিয়ে cascade logic যোগ করা।
**Code Diff:**
```diff
// [MODIFY] src/lib/textReflow.ts
- if (textMode === "area") return; // Remove this line from reflowLayerText, reflowFrom, backFillFrom
```
- Update `planCascade()` and `backFillFrom()` to handle `splitToFitArea` when `areaHeight` is present.
- **Auto-height fallback:** If `areaHeight === null`, treat it as 1D point text constraint.

---

### Phase 2: Tajweed & TopSymbol Perfection

**Target:** ১২টি রুলস 100% accurate করা এবং TopSymbolLayer-এর Custom Overrides যুক্ত করা।

#### 2.1 Complete Missing Tajweed Rules (`src/lib/tajweed/rules.ts`)
**Action:** Rule 9 এবং 10 (যেগুলো empty আছে) সেগুলোর logic add করা।
- AI Agent-কে কুরআনিক রুলস (Idgham, Iqlab, etc.) এর logic `detectTajweed` function-এ add করতে হবে।

#### 2.2 TopSymbol UI Controls (`src/components/studio/PropertiesPanel.tsx` & `TopSymbolLayer.tsx`)
**Action:** Symbols এর color, scale, dx, dy override করার জন্য UI এবং Store update করা।
**Implementation:**
- `overridesStore.ts`-এ symbol key: `symbol:pageId:rowIndex:charIndex:symbolId`.
- `TopSymbolLayer.tsx`-এ rendering-এর সময় check করা:
```typescript
const override = getScopedSymbolOverride(pageId, rowIndex, charIndex, sym.id);
const color = override.color || '#ef4444'; // Default red
const dx = override.dx || 0;
// apply to inline styles
```

---

### Phase 3: UI/UX Polish & App Performance

**Target:** Loading UI, Icons, এবং Visual feedback উন্নত করা।

#### 3.1 Initial App Loading UI (`src/routes/__root.tsx` or `index.tsx`)
**Action:** App load হওয়ার সময় একটি সুন্দর Bismillah/Islamic motif loading screen যোগ করা।
**Implementation Reference:**
- `src/components/ui/Loader.tsx` তৈরি করুন।
- Data load (`verses.json` 5MB) হওয়ার সময় পর্যন্ত loader show করুন (`Suspense` বা State check এর মাধ্যমে)।

#### 3.2 Icon System Upgrade
**Action:** Lucide-react আইকনগুলোর সাইজ এবং stroke-width consistent করা।
- `CanvasToolbar.tsx` এবং `Inspector.tsx`-এ আইকনগুলোর visual hierarchy ঠিক করা (Tooltips with shortcuts)।

#### 3.3 Micro-Interactions
**Action:** UI buttons এ smooth transitions (Framer motion বা Tailwind transition) যোগ করা।

---

### Phase 4: Desktop App Conversion (.exe)

**Target:** প্রজেক্টটিকে Windows PC App হিসেবে প্যাকেজ করা। 
যেহেতু প্রজেক্টটি Vite + Web tech-এ তৈরি, তাই **Electron.js** বা **Tauri** ব্যবহার করা সবচেয়ে ভালো হবে। (Electron বেশি stable DTP tools-এর জন্য)।

#### 4.1 Electron Setup
**Action:** `package.json`-এ Electron dependencies যোগ করা এবং `main.ts` (Electron entry point) লেখা।
**Commands AI Should Run:**
```bash
npm install -D electron electron-builder concurrently wait-on cross-env
```
**Implementation Reference:**
- `electron/main.ts` তৈরি করা যেখানে `BrowserWindow` load করবে `http://localhost:8080` (dev mode) অথবা `dist/index.html` (prod mode)।
- Local file system access এর জন্য `ipcMain` এবং `ipcRenderer` (বা preload script) ব্যবহার করে `export PDF/PNG` file save dialogue যুক্ত করা।

#### 4.2 PDF & Print Export Fixes (`src/lib/pdfExport.ts`)
**Action:** High-resolution Canvas/SVG export যুক্ত করা। 
- `html2canvas` বা `fabric.js`-এর export quality ঠিক করে 300 DPI image বা Vector PDF জেনারেট করা।

---

## ৪. AI Agent এর জন্য পরবর্তী ধাপে কাজের নির্দেশিকা (How to execute this plan)

যেকোনো AI Agent-কে এই প্রজেক্টের কাজ চালিয়ে যাওয়ার জন্য নিচের ধাপগুলো অনুসরণ করতে হবে:

1. **Step 1:** `PARAGRAPH_LINKING_PLAN.md` এবং এই ফাইলের **Phase 1** অনুযায়ী `canvasMeasure.ts` এবং `textReflow.ts` update করা। কাজ শেষে 브라우জার এবং console-এ check করা যে area text overflow কাজ করছে কি না।
2. **Step 2:** **Phase 2** অনুযায়ী `tajweed/rules.ts`-এ unimplemented rules যোগ করা এবং UI-তে color/position control যুক্ত করা।
3. **Step 3:** UI/UX improvement (Loading screen, icon polish)।
4. **Step 4:** Electron setup করে `.exe` build command configure করা। `npm run build:electron` command তৈরি করা যা `electron-builder` ব্যবহার করে `.exe` output দেবে।

*এই প্ল্যানটি সম্পূর্ণভাবে অনুসরণ করলে "Quran Studio Pro" একটি পূর্ণাঙ্গ Professional DTP Software হিসেবে আত্মপ্রকাশ করবে।*
