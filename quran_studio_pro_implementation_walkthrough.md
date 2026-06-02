# Quran Studio Pro — Expert Implementation Walkthrough
### Full Step-by-Step Guide for All 3 Features

> **Stack:** React 19 · TanStack Start · Zustand · TypeScript · Vite · Electron

---

## Table of Contents

1. [Feature 1 — 2D Area Text Flow & Paragraph Linking](#feature-1)
   - Phase A: Data Model Changes
   - Phase B: Two-Phase Height Measurement Engine
   - Phase C: Forward Cascade (Overflow Push)
   - Phase D: Backward Pull-Up (Delete / Underfill)
   - Phase E: Auto-Height Frame Guard
2. [Feature 2 — Tajweed TopSymbol Override System](#feature-2)
   - Phase A: Canonical Key Architecture
   - Phase B: Rules 9 & 10 Detection
   - Phase C: Override Store Schema
   - Phase D: TopSymbolLayer Render Pipeline
   - Phase E: Properties Panel Integration
3. [Feature 3 — Electron Desktop App & Vector PDF Export](#feature-3)
   - Phase A: Electron Project Setup
   - Phase B: TanStack Start Integration with Electron
   - Phase C: Fast Vector PDF via printToPDF
   - Phase D: Production PDF Renderer (pdf-lib + HarfBuzz)
   - Phase E: CMYK Post-Processing with Ghostscript
   - Phase F: Windows .exe Packaging
4. [Final Integration Checklist](#checklist)

---

# FEATURE 1 — 2D Area Text Flow & Paragraph Linking {#feature-1}

## Overview

The goal is to remove the `if (textMode === "area") return;` early abort and replace it with a
full 2D measurement + cascade system. Changes span the data model, the reflow engine, and the
Zustand stores.

---

## Phase A: Data Model Changes

### Step 1 — Add `frameType` discriminator to your row/frame type

Open your frame type definition (likely in `src/types/editor.ts` or similar).

**Before:**
```typescript
interface TextFrame {
  id: string;
  width: number;
  height?: number;
  textMode: 'point' | 'area';
}
```

**After:**
```typescript
type FrameType = 'point' | 'area-fixed' | 'area-auto';

interface TextFrame {
  id: string;
  width: number;

  frameType: FrameType;

  // Only relevant when frameType === 'area-fixed'
  fixedHeight?: number;

  // Only relevant when frameType === 'area-auto'
  maxAutoHeight?: number;   // cap in px; undefined = no cap

  // Computed at runtime — stored in reflowStore, NOT in this shape
  // currentHeight: number  <-- do NOT store here
}
```

**Why:** `area-auto` frames grow to their content and never cascade.
`area-fixed` frames cascade overflow to the next linked frame.
`point` frames cascade 1D overflow exactly as before.

---

### Step 2 — Add `linkedNextFrameId` to TextFrame

```typescript
interface TextFrame {
  // ... existing fields
  frameType: FrameType;
  fixedHeight?: number;
  maxAutoHeight?: number;
  linkedNextFrameId?: string;   // ID of the next frame in the thread
  linkedPrevFrameId?: string;   // ID of the previous frame in the thread
}
```

This is your InDesign-style text thread. Build the thread by chaining frame IDs.
A thread is valid only between `area-fixed` frames. Point frames are never in a thread.

---

### Step 3 — Add measurement cache shape to `reflowStore`

In `src/stores/reflowStore.ts`, add:

```typescript
interface MeasurementCacheEntry {
  hash: string;
  fittingText: string;
  overflow: string;
  actualHeightPx: number;
  lineCount: number;
  measuredAt: number;  // Date.now()
}

interface ReflowStore {
  // ... existing state
  measurementCache: Map<string, MeasurementCacheEntry>;
  setMeasurementCache: (key: string, entry: MeasurementCacheEntry) => void;
  clearMeasurementCache: () => void;
}
```

---

## Phase B: Two-Phase Height Measurement Engine

### Step 4 — Create the fast string-only line estimator

Create `src/lib/textMeasure/estimateLineCount.ts`:

```typescript
/**
 * Phase 1 measurement: pure string logic, zero canvas overhead.
 * Splits text into words and wraps them against a character-width estimate.
 * Arabic text: use average char width = fontSize * 0.55 (conservative).
 */
export function estimateLineCount(
  text: string,
  frameWidthPx: number,
  fontSize: number,
  isRTL: boolean
): number {
  const avgCharWidthPx = fontSize * 0.55;
  const charsPerLine = Math.floor(frameWidthPx / avgCharWidthPx);

  const words = text.split(/\s+/).filter(Boolean);
  let currentLineChars = 0;
  let lines = 1;

  for (const word of words) {
    const wordLen = word.length + 1; // +1 for space
    if (currentLineChars + wordLen > charsPerLine && currentLineChars > 0) {
      lines++;
      currentLineChars = wordLen;
    } else {
      currentLineChars += wordLen;
    }
  }
  return lines;
}
```

---

### Step 5 — Create the OffscreenCanvas Web Worker

Create `src/workers/textMeasureWorker.ts`:

```typescript
// This file runs inside a Web Worker via Vite's ?worker import syntax

interface MeasureRequest {
  id: string;
  text: string;
  frameWidthPx: number;
  frameHeightPx: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;   // multiplier e.g. 1.4
  isRTL: boolean;
}

interface MeasureResponse {
  id: string;
  fittingText: string;
  overflow: string;
  actualHeightPx: number;
  lineCount: number;
}

// One OffscreenCanvas per worker — reused across all measurements
const canvas = new OffscreenCanvas(2000, 1);
const ctx = canvas.getContext('2d')!;

self.onmessage = (e: MessageEvent<MeasureRequest>) => {
  const req = e.data;
  const result = splitToFitArea(req);
  const response: MeasureResponse = { id: req.id, ...result };
  self.postMessage(response);
};

function splitToFitArea(req: MeasureRequest): Omit<MeasureResponse, 'id'> {
  const { text, frameWidthPx, frameHeightPx, fontSize, fontFamily, lineHeight } = req;

  ctx.font = `${fontSize}px "${fontFamily}"`;

  const nominalLineHeightPx = fontSize * lineHeight;
  const words = text.split(/\s+/).filter(Boolean);

  let currentLineWords: string[] = [];
  let currentLineWidthPx = 0;
  let totalHeightPx = 0;
  let fittingWords: string[] = [];
  let overflowWords: string[] = [];
  let overflowed = false;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidthPx = ctx.measureText(word).width;
    const spaceWidthPx = ctx.measureText(' ').width;
    const addWidth = currentLineWords.length === 0
      ? wordWidthPx
      : wordWidthPx + spaceWidthPx;

    const wouldWrap = currentLineWords.length > 0 &&
      currentLineWidthPx + addWidth > frameWidthPx;

    if (wouldWrap) {
      // Commit current line
      const lineHeight_px = measureActualLineHeight(currentLineWords, ctx, nominalLineHeightPx);
      const nextTotalHeight = totalHeightPx + lineHeight_px;

      if (nextTotalHeight > frameHeightPx) {
        overflowed = true;
        overflowWords = words.slice(i);
        break;
      }

      totalHeightPx = nextTotalHeight;
      lineCount++;
      fittingWords.push(...currentLineWords);
      currentLineWords = [word];
      currentLineWidthPx = wordWidthPx;
    } else {
      currentLineWords.push(word);
      currentLineWidthPx += addWidth;
    }
  }

  // Commit last line if not overflowed
  if (!overflowed && currentLineWords.length > 0) {
    const lineHeight_px = measureActualLineHeight(currentLineWords, ctx, nominalLineHeightPx);
    const nextTotalHeight = totalHeightPx + lineHeight_px;

    if (nextTotalHeight > frameHeightPx) {
      overflowWords = currentLineWords;
    } else {
      totalHeightPx = nextTotalHeight;
      lineCount++;
      fittingWords.push(...currentLineWords);
    }
  }

  return {
    fittingText: fittingWords.join(' '),
    overflow: overflowWords.join(' '),
    actualHeightPx: totalHeightPx,
    lineCount,
  };
}

function measureActualLineHeight(
  words: string[],
  ctx: OffscreenCanvasRenderingContext2D,
  nominalPx: number
): number {
  // For Arabic with Tajweed diacritics, actual height can exceed nominal
  // We measure the combined glyph bounding box
  const combined = words.join(' ');
  const metrics = ctx.measureText(combined);
  const glyphHeight =
    (metrics.actualBoundingBoxAscent ?? 0) +
    (metrics.actualBoundingBoxDescent ?? 0);
  // Use the larger of glyph height or nominal — diacritics can spike upward
  return Math.max(glyphHeight * 1.15, nominalPx);  // 1.15 = safe diacritic buffer
}
```

---

### Step 6 — Create the Worker bridge in the main thread

Create `src/lib/textMeasure/measureWorkerBridge.ts`:

```typescript
import TextMeasureWorker from '../../workers/textMeasureWorker?worker';

const worker = new TextMeasureWorker();
const pendingRequests = new Map<string, (result: any) => void>();

worker.onmessage = (e) => {
  const { id, ...result } = e.data;
  const resolve = pendingRequests.get(id);
  if (resolve) {
    resolve(result);
    pendingRequests.delete(id);
  }
};

let requestCounter = 0;

export function measureAreaTextAsync(params: Omit<any, 'id'>): Promise<any> {
  return new Promise((resolve) => {
    const id = `m_${++requestCounter}`;
    pendingRequests.set(id, resolve);
    worker.postMessage({ id, ...params });
  });
}
```

---

## Phase C: Forward Cascade (Overflow Push)

### Step 7 — Rewrite `reflowFromAsync` in `src/lib/textReflow.ts`

Remove the early abort. Replace with the two-phase gate:

```typescript
import { estimateLineCount } from './textMeasure/estimateLineCount';
import { measureAreaTextAsync } from './textMeasure/measureWorkerBridge';
import { hashString } from '../utils/hash';  // simple djb2 hash utility

const OVERFLOW_THRESHOLD = 0.85;  // only measure precisely above 85% estimated fill
const CASCADE_DEBOUNCE_MS = 150;

export async function reflowAreaTextFrame(
  frame: TextFrame,
  text: string,
  allFrames: Map<string, TextFrame>,
  updateFrame: (id: string, text: string) => void,
): Promise<void> {

  if (frame.frameType === 'area-auto') {
    // Auto-height: just grow the frame, never cascade
    await growAutoHeightFrame(frame, text, updateFrame);
    return;
  }

  if (frame.frameType !== 'area-fixed' || !frame.fixedHeight) return;

  // --- PHASE 1: Fast estimate ---
  const estimatedLines = estimateLineCount(
    text,
    frame.width,
    frame.fontSize,
    frame.isRTL ?? true
  );
  const nominalLineHeightPx = frame.fontSize * (frame.lineHeight ?? 1.4);
  const estimatedHeightPx = estimatedLines * nominalLineHeightPx;
  const fillRatio = estimatedHeightPx / frame.fixedHeight;

  if (fillRatio < OVERFLOW_THRESHOLD) {
    // Clearly not overflowing — skip expensive measurement
    updateFrame(frame.id, text);
    return;
  }

  // --- PHASE 2: Precise measurement (Web Worker) ---
  const cacheKey = hashString(`${text}|${frame.width}|${frame.fixedHeight}|${frame.fontSize}|${frame.fontFamily}`);
  const cached = reflowStore.getState().measurementCache.get(cacheKey);

  let result;
  if (cached && Date.now() - cached.measuredAt < 5000) {
    result = cached;
  } else {
    result = await measureAreaTextAsync({
      text,
      frameWidthPx: frame.width,
      frameHeightPx: frame.fixedHeight,
      fontSize: frame.fontSize,
      fontFamily: frame.fontFamily,
      lineHeight: frame.lineHeight ?? 1.4,
      isRTL: frame.isRTL ?? true,
    });
    reflowStore.getState().setMeasurementCache(cacheKey, {
      hash: cacheKey,
      ...result,
      measuredAt: Date.now(),
    });
  }

  // Update this frame with only the fitting content
  updateFrame(frame.id, result.fittingText);

  // Forward cascade to next linked frame
  if (result.overflow && frame.linkedNextFrameId) {
    const nextFrame = allFrames.get(frame.linkedNextFrameId);
    if (nextFrame) {
      // Prepend overflow to whatever is in the next frame
      const nextText = result.overflow + ' ' + (getFrameText(nextFrame.id) ?? '');
      await reflowAreaTextFrame(nextFrame, nextText.trim(), allFrames, updateFrame);
    }
  }
}
```

---

## Phase D: Backward Pull-Up (Delete / Underfill)

### Step 8 — Implement `pullUpFromNextFrame` in `textReflow.ts`

When a user deletes content from a fixed-area frame, its content may now underfill.
Pull words greedily from the next frame.

```typescript
export async function pullUpFromNextFrame(
  frame: TextFrame,
  currentText: string,
  allFrames: Map<string, TextFrame>,
  getFrameText: (id: string) => string,
  updateFrame: (id: string, text: string) => void,
  historyBatch: () => void,  // call once before loop starts
): Promise<void> {

  if (frame.frameType !== 'area-fixed' || !frame.linkedNextFrameId) return;

  historyBatch(); // open a single undo-able transaction

  let frameText = currentText;
  let nextFrameId: string | undefined = frame.linkedNextFrameId;

  while (nextFrameId) {
    const nextFrame = allFrames.get(nextFrameId);
    if (!nextFrame) break;

    const nextWords = getFrameText(nextFrame.id).split(/\s+/).filter(Boolean);
    if (nextWords.length === 0) break;

    // Try to pull words one-by-one until frame is full
    let pulledCount = 0;
    for (const word of nextWords) {
      const candidate = frameText + ' ' + word;
      const result = await measureAreaTextAsync({
        text: candidate.trim(),
        frameWidthPx: frame.width,
        frameHeightPx: frame.fixedHeight!,
        fontSize: frame.fontSize,
        fontFamily: frame.fontFamily,
        lineHeight: frame.lineHeight ?? 1.4,
        isRTL: frame.isRTL ?? true,
      });

      if (result.overflow) {
        // This word didn't fit — stop pulling
        break;
      }

      frameText = candidate.trim();
      pulledCount++;
    }

    // Update this frame
    updateFrame(frame.id, frameText);

    // Remove pulled words from next frame
    const remainingNextText = nextWords.slice(pulledCount).join(' ');
    updateFrame(nextFrame.id, remainingNextText);

    // Recurse: the next frame is now underfilled too, try pulling from ITS next
    if (pulledCount > 0 && nextFrame.linkedNextFrameId) {
      frame = nextFrame;
      frameText = remainingNextText;
      nextFrameId = nextFrame.linkedNextFrameId;
    } else {
      break;
    }
  }
}
```

---

### Step 9 — Wire pull-up into your delete handler

In your editor event handler (wherever you handle backspace/delete):

```typescript
// After applying the text deletion:
const updatedText = applyDeletion(frame, deletedRange);
updateFrame(frame.id, updatedText);

// Check if we need to pull from next frame
const estimatedFill = estimateLineCount(updatedText, frame.width, frame.fontSize, true)
  * (frame.fontSize * 1.4);

if (frame.frameType === 'area-fixed' && estimatedFill < frame.fixedHeight! * 0.85) {
  // Debounce the pull-up to avoid firing on every character of a fast delete
  debouncedPullUp(frame, updatedText);
}
```

Create the debounced version:

```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash-es';

const debouncedPullUp = debounce(
  (frame, text) => pullUpFromNextFrame(frame, text, ...),
  150
);
```

---

## Phase E: Auto-Height Frame Guard

### Step 10 — Implement `growAutoHeightFrame`

```typescript
async function growAutoHeightFrame(
  frame: TextFrame,
  text: string,
  updateFrame: (id: string, text: string) => void,
): Promise<void> {
  // Auto-height frames have no fixedHeight — we measure without a height cap
  const result = await measureAreaTextAsync({
    text,
    frameWidthPx: frame.width,
    frameHeightPx: frame.maxAutoHeight ?? 99999,  // no cap = huge sentinel
    fontSize: frame.fontSize,
    fontFamily: frame.fontFamily,
    lineHeight: frame.lineHeight ?? 1.4,
    isRTL: frame.isRTL ?? true,
  });

  // Update the frame's runtime height in reflowStore (NOT in the frame data model)
  reflowStore.getState().setFrameComputedHeight(frame.id, result.actualHeightPx);

  // If we hit maxAutoHeight, clip silently — do NOT cascade
  updateFrame(frame.id, result.fittingText);

  // Any overflow is intentionally discarded for auto-height frames
  if (result.overflow) {
    console.warn(`[AutoHeight] Frame ${frame.id} clipped ${result.overflow.split(' ').length} words`);
  }
}
```

---

# FEATURE 2 — Tajweed TopSymbol Override System {#feature-2}

## Overview

The two core problems: (1) Rules 9 & 10 are unimplemented. (2) Symbol override keys
must survive text reflow. We fix both using canonical Quran addressing.

---

## Phase A: Canonical Key Architecture

### Step 1 — Define the canonical character reference type

Create `src/types/quran.ts`:

```typescript
/**
 * A reflow-resilient anchor into the Quran text.
 * Surah + Ayah + WordIndex + CharIndex are canonical — they never change
 * regardless of how the page layout reflows.
 */
export interface CanonicalCharRef {
  surahId: number;       // 1–114
  ayahId: number;        // 1–N
  wordIndex: number;     // 0-based index of the word within the ayah
  charIndex: number;     // 0-based index of the char within the word
}

export function makeSymbolOverrideKey(
  ref: CanonicalCharRef,
  symbolId: string
): string {
  return `symbol:${ref.surahId}:${ref.ayahId}:${ref.wordIndex}:${ref.charIndex}:${symbolId}`;
}

export function parseSymbolOverrideKey(key: string): {
  ref: CanonicalCharRef;
  symbolId: string;
} | null {
  const parts = key.split(':');
  if (parts.length !== 6 || parts[0] !== 'symbol') return null;
  return {
    ref: {
      surahId: Number(parts[1]),
      ayahId: Number(parts[2]),
      wordIndex: Number(parts[3]),
      charIndex: Number(parts[4]),
    },
    symbolId: parts[5],
  };
}
```

---

### Step 2 — Enrich your verse data with canonical word/char metadata

Your `verses.json` should ideally provide the canonical wordIndex for each word.
If it doesn't, build a lookup at app startup:

```typescript
// src/lib/quranIndex.ts
import versesJson from '../data/verses.json';

interface WordRef {
  surahId: number;
  ayahId: number;
  wordIndex: number;
  text: string;
}

// Map from word text to its canonical ref (note: some words repeat across Quran)
// Better: build a flat array indexed by (surahId, ayahId, wordIndex)
const wordRefIndex = new Map<string, WordRef>();

export function buildWordRefIndex() {
  for (const surah of versesJson.surahs) {
    for (const ayah of surah.ayahs) {
      const words = ayah.text.split(' ');
      words.forEach((word, wordIndex) => {
        const key = `${surah.id}:${ayah.id}:${wordIndex}`;
        wordRefIndex.set(key, {
          surahId: surah.id,
          ayahId: ayah.id,
          wordIndex,
          text: word,
        });
      });
    }
  }
}

export function getWordRef(surahId: number, ayahId: number, wordIndex: number): WordRef | undefined {
  return wordRefIndex.get(`${surahId}:${ayahId}:${wordIndex}`);
}
```

---

## Phase B: Rules 9 & 10 Detection

### Step 3 — Implement Rule 9 (Ikhfa — Concealment)

Ikhfa occurs when a Noon Saakin (نْ) or Tanween (ً ٍ ٌ) is followed by one of 15 specific letters.

Add to `src/lib/tajweed/rules.ts`:

```typescript
// Noon Saakin Unicode
const NOON = '\u0646';
const SUKUN = '\u0652';

// Tanween (Fathatayn, Kasratayn, Dammatayn)
const TANWEEN = ['\u064B', '\u064D', '\u064C'];

// The 15 Ikhfa letters
const IKHFA_LETTERS = new Set([
  '\u062A', // ت
  '\u062B', // ث
  '\u062C', // ج
  '\u062F', // د
  '\u0630', // ذ
  '\u0632', // ز
  '\u0633', // س
  '\u0634', // ش
  '\u0635', // ص
  '\u0636', // ض
  '\u0637', // ط
  '\u0638', // ظ
  '\u0641', // ف
  '\u0642', // ق
  '\u0643', // ك
]);

export function detectIkhfa(text: string): TajweedMatch[] {
  const matches: TajweedMatch[] = [];
  const chars = [...text]; // spread to handle multi-codepoint chars safely

  for (let i = 0; i < chars.length - 1; i++) {
    const char = chars[i];
    const nextNonDiacritic = getNextNonDiacriticChar(chars, i + 1);

    const isNoonSaakin =
      char === NOON && chars[i + 1] === SUKUN;

    const isTanween =
      TANWEEN.includes(char);

    if ((isNoonSaakin || isTanween) && nextNonDiacritic && IKHFA_LETTERS.has(nextNonDiacritic.char)) {
      matches.push({
        ruleId: 9,
        ruleName: 'Ikhfa',
        startIndex: i,
        endIndex: nextNonDiacritic.index,
        symbolId: 'ikhfa',
      });
    }
  }

  return matches;
}

// Helper: skip diacritics/harakat to find the next "real" Arabic letter
function getNextNonDiacriticChar(
  chars: string[],
  from: number
): { char: string; index: number } | null {
  const DIACRITICS = new Set([
    '\u064B','\u064C','\u064D','\u064E','\u064F',
    '\u0650','\u0651','\u0652','\u0653','\u0654',
    '\u0670', // Alef Khanjariyya
  ]);

  for (let i = from; i < chars.length; i++) {
    if (!DIACRITICS.has(chars[i])) {
      return { char: chars[i], index: i };
    }
  }
  return null;
}
```

---

### Step 4 — Implement Rule 10 (Iqlab — Conversion)

Iqlab occurs when Noon Saakin or Tanween is followed by ب (Ba).

```typescript
const BA = '\u0628';

export function detectIqlab(text: string): TajweedMatch[] {
  const matches: TajweedMatch[] = [];
  const chars = [...text];

  for (let i = 0; i < chars.length - 1; i++) {
    const char = chars[i];
    const nextNonDiacritic = getNextNonDiacriticChar(chars, i + 1);

    const isNoonSaakin = char === NOON && chars[i + 1] === SUKUN;
    const isTanween = TANWEEN.includes(char);

    if ((isNoonSaakin || isTanween) && nextNonDiacritic?.char === BA) {
      matches.push({
        ruleId: 10,
        ruleName: 'Iqlab',
        startIndex: i,
        endIndex: nextNonDiacritic.index,
        symbolId: 'iqlab',
      });
    }
  }

  return matches;
}
```

---

### Step 5 — Merge Rules 9 & 10 into `detectTajweed`

In your main `detectTajweed` function in `rules.ts`:

```typescript
export function detectTajweed(text: string): TajweedMatch[] {
  return [
    ...detectExistingRules1to8(text),  // your existing logic
    ...detectIkhfa(text),               // Rule 9 — new
    ...detectIqlab(text),               // Rule 10 — new
    ...detectExistingRules11to12(text), // your existing logic
  ];
}
```

---

## Phase C: Override Store Schema

### Step 6 — Update `overridesStore.ts`

```typescript
// src/stores/overridesStore.ts
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { CanonicalCharRef } from '../types/quran';
import { makeSymbolOverrideKey } from '../types/quran';

export interface SymbolOverride {
  key: string;               // canonical key (the unique ID)
  ref: CanonicalCharRef;     // for reverse lookup
  symbolId: string;
  color?: string;            // CSS color string, e.g. '#c0392b'
  scale?: number;            // multiplier, e.g. 1.2
  dx?: number;               // pixel offset from computed X
  dy?: number;               // pixel offset from computed Y (negative = up)
}

interface OverridesStore {
  symbolOverrides: Map<string, SymbolOverride>;

  setSymbolOverride: (
    ref: CanonicalCharRef,
    symbolId: string,
    delta: Partial<Omit<SymbolOverride, 'key' | 'ref' | 'symbolId'>>
  ) => void;

  getSymbolOverride: (
    ref: CanonicalCharRef,
    symbolId: string
  ) => SymbolOverride | undefined;

  removeSymbolOverride: (ref: CanonicalCharRef, symbolId: string) => void;
  clearAllOverrides: () => void;
}

export const useOverridesStore = create<OverridesStore>()(
  temporal((set, get) => ({
    symbolOverrides: new Map(),

    setSymbolOverride: (ref, symbolId, delta) => {
      const key = makeSymbolOverrideKey(ref, symbolId);
      set((state) => {
        const next = new Map(state.symbolOverrides);
        const existing = next.get(key) ?? { key, ref, symbolId };
        next.set(key, { ...existing, ...delta });
        return { symbolOverrides: next };
      });
    },

    getSymbolOverride: (ref, symbolId) => {
      const key = makeSymbolOverrideKey(ref, symbolId);
      return get().symbolOverrides.get(key);
    },

    removeSymbolOverride: (ref, symbolId) => {
      const key = makeSymbolOverrideKey(ref, symbolId);
      set((state) => {
        const next = new Map(state.symbolOverrides);
        next.delete(key);
        return { symbolOverrides: next };
      });
    },

    clearAllOverrides: () => set({ symbolOverrides: new Map() }),
  }))
);
```

---

## Phase D: TopSymbolLayer Render Pipeline

### Step 7 — Rewrite `TopSymbolLayer.tsx`

The key principle: **do not store absolute positions** in the override. Compute them fresh from
the live layout, then apply the stored `dx`/`dy` deltas on top.

```typescript
// src/components/canvas/TopSymbolLayer.tsx
import React from 'react';
import { detectTajweed } from '../../lib/tajweed/rules';
import { makeSymbolOverrideKey } from '../../types/quran';
import { useOverridesStore } from '../../stores/overridesStore';
import { measureCharCenter } from '../../lib/textMeasure/measureCharCenter';
import type { RenderedRow } from '../../types/editor';

interface Props {
  row: RenderedRow;          // includes surahId, ayahId, wordPositions[]
  fontSize: number;
  fontFamily: string;
}

export const TopSymbolLayer: React.FC<Props> = ({ row, fontSize, fontFamily }) => {
  const getSymbolOverride = useOverridesStore((s) => s.getSymbolOverride);

  const symbols = React.useMemo(() => {
    const matches = detectTajweed(row.arabicText);

    return matches.map((match) => {
      // Resolve the canonical ref for this character
      const { surahId, ayahId } = row;
      const { wordIndex, charIndex } = resolveCanonicalIndices(
        row.arabicText,
        match.startIndex,
        row.wordBoundaries   // array of word start positions in the row text
      );

      const ref = { surahId, ayahId, wordIndex, charIndex };
      const override = getSymbolOverride(ref, match.symbolId);

      // Compute layout position fresh from current render state
      const baseX = measureCharCenter(
        row.arabicText,
        match.startIndex,
        fontFamily,
        fontSize
      );
      const baseY = -16; // default: 16px above baseline

      return {
        key: makeSymbolOverrideKey(ref, match.symbolId),
        ref,
        symbolId: match.symbolId,
        x: baseX + (override?.dx ?? 0),
        y: baseY + (override?.dy ?? 0),
        scale: override?.scale ?? 1,
        color: override?.color ?? 'inherit',
        match,
      };
    });
  }, [row, fontSize, fontFamily, getSymbolOverride]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {symbols.map((sym) => (
        <TajweedSymbolIcon
          key={sym.key}
          symbolId={sym.symbolId}
          x={sym.x}
          y={sym.y}
          scale={sym.scale}
          color={sym.color}
          data-override-key={sym.key}  // used by selection system
        />
      ))}
    </svg>
  );
};

function resolveCanonicalIndices(
  rowText: string,
  charIndexInRow: number,
  wordBoundaries: number[]
): { wordIndex: number; charIndex: number } {
  // wordBoundaries: array of char positions where each word starts in rowText
  let wordIndex = 0;
  for (let i = wordBoundaries.length - 1; i >= 0; i--) {
    if (charIndexInRow >= wordBoundaries[i]) {
      wordIndex = i;
      break;
    }
  }
  const charIndex = charIndexInRow - wordBoundaries[wordIndex];
  return { wordIndex, charIndex };
}
```

---

## Phase E: Properties Panel Integration

### Step 8 — Build the symbol selection handler

In your canvas click handler, detect clicks on Tajweed symbols:

```typescript
// In your canvas component
function handleSymbolClick(event: React.MouseEvent<SVGElement>) {
  const target = event.target as SVGElement;
  const overrideKey = target.closest('[data-override-key]')
    ?.getAttribute('data-override-key');

  if (overrideKey) {
    event.stopPropagation();
    editorStore.getState().setSelectedSymbolKey(overrideKey);
  }
}
```

---

### Step 9 — Build the Symbol Override Properties Panel

```typescript
// src/components/panels/SymbolOverridePanel.tsx
import React from 'react';
import { parseSymbolOverrideKey } from '../../types/quran';
import { useOverridesStore } from '../../stores/overridesStore';
import { useEditorStore } from '../../stores/editorStore';

export const SymbolOverridePanel: React.FC = () => {
  const selectedKey = useEditorStore((s) => s.selectedSymbolKey);
  const { getSymbolOverride, setSymbolOverride } = useOverridesStore();

  if (!selectedKey) return null;

  const parsed = parseSymbolOverrideKey(selectedKey);
  if (!parsed) return null;

  const override = getSymbolOverride(parsed.ref, parsed.symbolId) ?? {
    color: '#000000',
    scale: 1,
    dx: 0,
    dy: 0,
  };

  const update = (delta: Partial<typeof override>) => {
    setSymbolOverride(parsed.ref, parsed.symbolId, delta);
  };

  return (
    <div className="properties-panel">
      <h3>Tajweed Symbol: {parsed.symbolId}</h3>

      <label>Color
        <input
          type="color"
          value={override.color ?? '#000000'}
          onChange={(e) => update({ color: e.target.value })}
        />
      </label>

      <label>Scale
        <input
          type="range"
          min={0.5} max={2} step={0.05}
          value={override.scale ?? 1}
          onChange={(e) => update({ scale: Number(e.target.value) })}
        />
        <span>{(override.scale ?? 1).toFixed(2)}×</span>
      </label>

      <label>Horizontal Offset (dx)
        <input
          type="number"
          value={override.dx ?? 0}
          onChange={(e) => update({ dx: Number(e.target.value) })}
        />
        px
      </label>

      <label>Vertical Offset (dy)
        <input
          type="number"
          value={override.dy ?? 0}
          onChange={(e) => update({ dy: Number(e.target.value) })}
        />
        px
      </label>

      <button onClick={() => setSymbolOverride(parsed.ref, parsed.symbolId, {
        color: undefined, scale: 1, dx: 0, dy: 0
      })}>
        Reset to Default
      </button>
    </div>
  );
};
```

---

# FEATURE 3 — Electron Desktop App & Vector PDF Export {#feature-3}

## Overview

Convert the Vite + TanStack Start app into a Windows `.exe` using Electron.
Layer PDF export on top: fast path via `printToPDF`, production path via a
parallel PDF renderer using `pdf-lib` + HarfBuzz WASM. Optional CMYK
post-processing via bundled Ghostscript.

---

## Phase A: Electron Project Setup

### Step 1 — Install Electron and builder dependencies

```bash
npm install --save-dev electron electron-builder concurrently wait-on cross-env
npm install --save-dev @electron-forge/cli @electron-forge/plugin-vite
```

---

### Step 2 — Create the folder structure

```
quran-studio-pro/
├── electron/
│   ├── main.ts          ← Electron main process
│   ├── preload.ts       ← Context bridge (secure IPC)
│   └── pdfExport.ts     ← PDF generation logic
├── src/                 ← Your existing React app
├── vite.config.ts       ← Web app config (unchanged)
├── vite.electron.config.ts  ← NEW: builds electron/main.ts
└── package.json
```

---

### Step 3 — Write `electron/main.ts`

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { handleExportPDF } from './pdfExport';

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,  // security: always false
    },
    titleBarStyle: 'hiddenInset',
    title: 'Quran Studio Pro',
  });

  if (isDev) {
    // In dev: load Vite dev server (TanStack Start)
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // In production: load the built output
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // IPC handlers
  ipcMain.handle('dialog:saveFile', async (_, defaultName: string) => {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return filePath;
  });

  ipcMain.handle('export:printToPDF', async (_, savePath: string) => {
    return handleExportPDF(win, savePath);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

### Step 4 — Write `electron/preload.ts`

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe, typed API to the renderer (your React app)
// React NEVER gets direct access to Node.js APIs
contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (defaultName: string): Promise<string | undefined> =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),

  exportPrintToPDF: (savePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('export:printToPDF', savePath),

  exportCustomPDF: (payload: any): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('export:customPDF', payload),
});

// TypeScript: declare the API on window
declare global {
  interface Window {
    electronAPI: typeof electronAPIShape;
  }
}
```

---

## Phase B: TanStack Start Integration with Electron

### Step 5 — Create `vite.electron.config.ts`

```typescript
// vite.electron.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.join(__dirname, 'electron/main.ts'),
      formats: ['cjs'],
    },
    outDir: 'dist-electron',
    rollupOptions: {
      external: ['electron'],   // Electron is provided by the runtime
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
});
```

---

### Step 6 — Update `package.json` scripts

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:electron\"",
    "dev:web": "vite",
    "dev:electron": "wait-on http://localhost:3000 && cross-env NODE_ENV=development electron dist-electron/main.js",
    "build": "vite build && vite build --config vite.electron.config.ts",
    "package": "npm run build && electron-builder",
    "postinstall": "electron-builder install-app-deps"
  },
  "build": {
    "appId": "com.quranstudio.pro",
    "productName": "Quran Studio Pro",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerLanguages": ["en_US", "ar", "bn"]
    },
    "extraResources": [
      { "from": "assets/gs/", "to": "gs/" }
    ]
  }
}
```

---

## Phase C: Fast Vector PDF via `printToPDF`

### Step 7 — Write `electron/pdfExport.ts` (fast path)

```typescript
// electron/pdfExport.ts
import { BrowserWindow } from 'electron';
import fs from 'fs';

export async function handleExportPDF(
  win: BrowserWindow,
  savePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate renderer to a clean print view
    // Your React app should expose a /print route that renders all pages
    // without UI chrome (no toolbars, panels, etc.)
    await win.webContents.executeJavaScript(
      `window.history.pushState({}, '', '/print-preview')`
    );

    // Small delay to let React re-render the print layout
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: {
        // Mushaf page: 780×1170px at 96dpi ≈ 206.375×309.6875mm
        // Electron uses microns (1mm = 1000 microns)
        width: 206375,
        height: 309688,
      },
      scaleFactor: 200,   // 200% = effectively 192 DPI — good for Mushaf
    });

    fs.writeFileSync(savePath, pdfBuffer);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

---

### Step 8 — Create the `/print-preview` route in TanStack Start

This route renders all Mushaf pages without the editor UI shell:

```typescript
// src/routes/print-preview.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useEditorStore } from '../stores/editorStore';

export const Route = createFileRoute('/print-preview')({
  component: PrintPreview,
});

function PrintPreview() {
  const pages = useEditorStore((s) => s.pages);

  return (
    <div style={{ background: 'white', margin: 0, padding: 0 }}>
      {pages.map((page) => (
        <div
          key={page.id}
          style={{
            width: 780,
            height: 1170,
            position: 'relative',
            pageBreakAfter: 'always',
            overflow: 'hidden',
          }}
        >
          <MushafPage page={page} printMode />
        </div>
      ))}
    </div>
  );
}
```

---

## Phase D: Production PDF Renderer (pdf-lib + HarfBuzz)

This is the "parallel renderer" approach for print-grade output.
It reads from your Zustand stores and generates PDF directly — no DOM involved.

### Step 9 — Install PDF libraries

```bash
npm install pdf-lib fontkit
npm install harfbuzzjs   # HarfBuzz WASM for Arabic shaping
```

---

### Step 10 — Create `electron/pdfRenderer.ts`

```typescript
// electron/pdfRenderer.ts
import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import HarfBuzz from 'harfbuzzjs';

const PAGE_WIDTH_PT  = 780 * (72 / 96);  // convert px@96dpi → PDF points@72dpi
const PAGE_HEIGHT_PT = 1170 * (72 / 96);

export async function renderToPDF(
  pages: PageData[],
  fontPaths: { arabic: string; bangla: string },
  outputPath: string,
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load fonts
  const arabicFontBytes  = fs.readFileSync(fontPaths.arabic);
  const banglaFontBytes  = fs.readFileSync(fontPaths.bangla);
  const arabicFont  = await pdfDoc.embedFont(arabicFontBytes);
  const banglaFont  = await pdfDoc.embedFont(banglaFontBytes);

  // Init HarfBuzz for Arabic shaping
  const hb = await HarfBuzz();
  const blob = hb.createBlob(arabicFontBytes);
  const hbFace = hb.createFace(blob, 0);
  const hbFont = hb.createFont(hbFace);

  for (const pageData of pages) {
    const pdfPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);

    for (const row of pageData.rows) {
      await renderRow(pdfPage, row, arabicFont, banglaFont, hb, hbFont);
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function renderRow(
  page: PDFPage,
  row: RowData,
  arabicFont: any,
  banglaFont: any,
  hb: any,
  hbFont: any,
): Promise<void> {
  // Arabic layer (RTL)
  if (row.arabic.text) {
    // Shape the Arabic text through HarfBuzz
    const buffer = hb.createBuffer();
    hb.bufferAddUTF8(buffer, row.arabic.text);
    hb.bufferSetDirection(buffer, 'rtl');
    hb.bufferSetScript(buffer, 'Arab');
    hb.shape(hbFont, buffer);

    const glyphInfo = hb.bufferGetGlyphInfos(buffer);
    const glyphPos  = hb.bufferGetGlyphPositions(buffer);

    // Convert HarfBuzz units to PDF points and draw
    const SCALE = row.arabic.fontSize / (72 * 64);  // HB units → points
    let cursorX = pxToPt(row.arabic.x);
    const baseY = PAGE_HEIGHT_PT - pxToPt(row.arabic.y);  // PDF Y is bottom-up

    for (let i = 0; i < glyphInfo.length; i++) {
      const gid = glyphInfo[i].codepoint;  // in HarfBuzz, after shaping, codepoint = glyph ID
      const xAdv = glyphPos[i].xAdvance * SCALE;
      const xOff = glyphPos[i].xOffset  * SCALE;
      const yOff = glyphPos[i].yOffset  * SCALE;

      page.drawText(String.fromCodePoint(gid), {
        x: cursorX + xOff,
        y: baseY  + yOff,
        size: row.arabic.fontSize,
        font: arabicFont,
        color: rgb(0, 0, 0),
      });

      cursorX += xAdv;
    }

    hb.freeBuffer(buffer);
  }

  // Bangla layer (LTR) — simpler, no complex shaping needed for basic usage
  if (row.bangla.text) {
    page.drawText(row.bangla.text, {
      x: pxToPt(row.bangla.x),
      y: PAGE_HEIGHT_PT - pxToPt(row.bangla.y),
      size: row.bangla.fontSize,
      font: banglaFont,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
}

const pxToPt = (px: number) => px * (72 / 96);
```

---

### Step 11 — Wire the custom PDF export IPC handler

In `electron/main.ts`, add:

```typescript
ipcMain.handle('export:customPDF', async (_, payload: { pages: any[]; outputPath: string }) => {
  try {
    const fontDir = isDev
      ? path.join(__dirname, '../assets/fonts')
      : path.join(process.resourcesPath, 'fonts');

    await renderToPDF(payload.pages, {
      arabic: path.join(fontDir, 'UthmanicHafs.ttf'),
      bangla:  path.join(fontDir, 'SolaimanLipi.ttf'),
    }, payload.outputPath);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});
```

---

## Phase E: CMYK Post-Processing with Ghostscript

### Step 12 — Bundle Ghostscript for Windows

1. Download the Ghostscript Windows binary (`gswin64c.exe`) from `ghostscript.com`.
2. Place it in `assets/gs/gswin64c.exe` (this gets bundled via `extraResources` in `package.json`).
3. Create `electron/ghostscript.ts`:

```typescript
// electron/ghostscript.ts
import { execFile } from 'child_process';
import path from 'path';
import { app } from 'electron';

function getGsPath(): string {
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '../assets/gs/gswin64c.exe');
  }
  return path.join(process.resourcesPath, 'gs', 'gswin64c.exe');
}

export function convertToCMYK(
  inputPdfPath: string,
  outputPdfPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const gs = getGsPath();

    const args = [
      '-dBATCH',
      '-dNOPAUSE',
      '-dSAFER',
      '-dQUIET',
      '-sDEVICE=pdfwrite',
      '-dColorConversionStrategy=/CMYK',
      '-dProcessColorModel=/DeviceCMYK',
      '-dPDFSETTINGS=/prepress',   // high-quality print preset
      '-dEmbedAllFonts=true',
      '-dSubsetFonts=true',
      `-sOutputFile=${outputPdfPath}`,
      inputPdfPath,
    ];

    execFile(gs, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Ghostscript error: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}
```

---

### Step 13 — Full export flow combining all steps

In `electron/pdfExport.ts`, add the orchestrated export function:

```typescript
// Full print-ready export: custom renderer → Ghostscript CMYK
export async function handleFullExport(
  pages: any[],
  outputPath: string,
  options: { cmyk: boolean }
): Promise<{ success: boolean; error?: string }> {
  const tempRgbPath = outputPath.replace('.pdf', '_RGB_temp.pdf');

  try {
    // Step 1: Generate RGB vector PDF
    await renderToPDF(pages, { arabic: '...', bangla: '...' }, tempRgbPath);

    if (options.cmyk) {
      // Step 2: Convert to CMYK via Ghostscript
      await convertToCMYK(tempRgbPath, outputPath);
      fs.unlinkSync(tempRgbPath);  // clean up temp file
    } else {
      fs.renameSync(tempRgbPath, outputPath);
    }

    return { success: true };
  } catch (error: any) {
    if (fs.existsSync(tempRgbPath)) fs.unlinkSync(tempRgbPath);
    return { success: false, error: error.message };
  }
}
```

---

## Phase F: Windows .exe Packaging

### Step 14 — Run the packager

```bash
# Build both the web app and the Electron main process
npm run build

# Package into a Windows installer
npm run package
```

The output will be in `release/`:
```
release/
├── Quran Studio Pro Setup 1.0.0.exe   ← NSIS installer
└── win-unpacked/                       ← Unpackaged app folder
    ├── Quran Studio Pro.exe
    ├── resources/
    │   ├── app.asar        ← your React + Electron code
    │   ├── gs/             ← bundled Ghostscript
    │   └── fonts/          ← Arabic + Bangla fonts
```

---

### Step 15 — Code sign the .exe (required for distribution)

Without code signing, Windows SmartScreen will warn users. For signing:

1. Obtain an EV Code Signing certificate from a CA (DigiCert, Sectigo, etc.).
2. Add to `electron-builder` config in `package.json`:

```json
"win": {
  "target": "nsis",
  "icon": "assets/icon.ico",
  "certificateFile": "cert.p12",
  "certificatePassword": "${env.CERT_PASSWORD}"
}
```

3. Pass the password via environment variable during CI/CD — never hardcode it.

---

# FINAL INTEGRATION CHECKLIST {#checklist}

## Feature 1 — Area Text Flow

- [ ] `TextFrame` type updated with `frameType`, `fixedHeight`, `maxAutoHeight`
- [ ] `linkedNextFrameId` / `linkedPrevFrameId` added to frame model
- [ ] `estimateLineCount()` created in `src/lib/textMeasure/`
- [ ] `textMeasureWorker.ts` created with `splitToFitArea()` using OffscreenCanvas
- [ ] Worker bridge (`measureWorkerBridge.ts`) wired up
- [ ] `reflowFromAsync` early abort removed; two-phase logic implemented
- [ ] `pullUpFromNextFrame()` created and wired to delete handler with debounce
- [ ] `growAutoHeightFrame()` implemented for `area-auto` frames
- [ ] Measurement LRU cache added to `reflowStore`

## Feature 2 — Tajweed Symbol Overrides

- [ ] `CanonicalCharRef` type and `makeSymbolOverrideKey()` created in `src/types/quran.ts`
- [ ] Quran word index built at startup via `buildWordRefIndex()`
- [ ] Rule 9 (Ikhfa) implemented in `rules.ts`
- [ ] Rule 10 (Iqlab) implemented in `rules.ts`
- [ ] `overridesStore.ts` updated with canonical key schema
- [ ] `TopSymbolLayer.tsx` rewritten to separate content identity from layout position
- [ ] Symbol click selection handler wired to `editorStore.selectedSymbolKey`
- [ ] `SymbolOverridePanel.tsx` built with Color / Scale / dx / dy controls

## Feature 3 — Desktop & PDF Export

- [ ] `electron/` folder created with `main.ts`, `preload.ts`, `pdfExport.ts`
- [ ] `vite.electron.config.ts` created for building main process
- [ ] `package.json` updated with `main`, `scripts`, and `build` config
- [ ] `/print-preview` route created in TanStack Start
- [ ] `handleExportPDF()` (printToPDF fast path) implemented and IPC-wired
- [ ] `pdf-lib` + `fontkit` + `harfbuzzjs` installed
- [ ] `pdfRenderer.ts` parallel renderer implemented
- [ ] Arabic HarfBuzz shaping integrated into PDF renderer
- [ ] Ghostscript bundled in `assets/gs/` and added to `extraResources`
- [ ] `convertToCMYK()` implemented and integrated into export flow
- [ ] `npm run package` tested and produces a valid `.exe`
- [ ] Code signing configured for distribution builds

---

*Document generated for Quran Studio Pro — Expert Implementation Walkthrough*
*Architecture: TanStack Start · React 19 · Zustand · Electron · TypeScript*
