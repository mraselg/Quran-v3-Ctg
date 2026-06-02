// HTML/CSS renderer for the 9 Quran rows.
// Each row is an absolutely positioned box mapped to a physical SVG band so
// Arabic shaping is handled by the browser's text engine (correct ligatures,
// RTL bidi) and the text is strictly confined inside its template band.

import { memo, useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { TopSymbolLayer } from "./TopSymbolLayer";
import {
  useOverridesStore,
  rowKey,
  layerKey,
  wordLayerKey,
  MASTER_DEFAULTS,
  type LocalOverride,
} from "@/state/overridesStore";
import { useEditorStore, type SelectionScope } from "@/state/editorStore";
import { useReflowStore } from "@/state/reflowStore";
import {
  splitToFit,
  reflowFrom,
  reflowFromAsync,
  backFillFrom,
  collapseLineBreakBackward,
  measureTextWidth,
  getTextAroundCursor,
  planCascade,
  findNextValidRow,
  findPrevValidRow,
  getDomSlots,
  type LayerKind,
} from "@/lib/textReflow";
import { splitToFitArea } from "@/lib/canvasMeasure";
import { calculateAreaTextHeight } from "@/lib/areaTextHeight";
import { effectiveReflowScope } from "@/lib/reflowScope";
import { splitArabicWords } from "@/lib/wordSplit";
import { useLargeChangeGuard } from "@/hooks/useLargeChangeGuard";
import { ScopeImpactWarningDialog } from "./ScopeImpactWarningDialog";
import { toast } from "sonner";



import type { RowBox } from "@/lib/templateUtils";

export type FabricLine = {
  arabic?: string;
  bangla?: string;
  symbol?: string;
  pronunciation?: string;
  meaning?: string;
};

type Props = {
  width: number;
  height: number;
  layout: RowBox[];
  lines: FabricLine[];
  arabicFamily: string;
  banglaFamily?: string;
  skip?: number;
  skipSlots?: number[];
};

import { useTemplateStore } from "@/state/templateStore";

type GlobalLayoutValues = {
  gArabic: number;
  gBangla: number;
  gArabicY: number;
  gBanglaY: number;
  gSymbolY: number;
};

const useGlobalLayoutValues = (): GlobalLayoutValues => {
  const tmpl = useTemplateStore((s) => s.getActiveTemplate());
  return useOverridesStore(
    useShallow((s) => ({
      gArabic: s.global.arabicFontPx ?? tmpl.typography.arabicFontPx,
      gBangla: s.global.banglaFontPx ?? tmpl.typography.banglaFontPx,
      gArabicY: tmpl.typography.baseArabicY + (s.global.arabicYOffset ?? 0),
      gBanglaY: tmpl.typography.baseBanglaY + (s.global.banglaYOffset ?? 0),
      gSymbolY: tmpl.typography.baseSymbolY + (s.global.symbolYOffset ?? 0),
    }))
  );
};

import { UnifiedStoryEditor } from "./UnifiedStoryEditor";

export const FabricLines = memo(function FabricLines({
  width,
  height,
  layout,
  lines,
  arabicFamily,
  banglaFamily = "'Kalpurush', 'Noto Serif Bengali', serif",
  skipSlots,
  pageId = "page",
}: Props & { pageId?: string }) {
  const skipSet = new Set(skipSlots ?? []);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const scope = useEditorStore((s) => s.scope);
  const selectionPageId = useEditorStore((s) => s.selection?.pageId);
  const selectionLayer = useEditorStore((s) => s.selection?.layerKind);
  const isTypeTool = editMode && activeTool === "type";

  const isUnifiedArabicEditing = isTypeTool && scope !== "general" && selectionPageId === pageId && selectionLayer === "arabic";
  const isUnifiedBanglaEditing = isTypeTool && scope !== "general" && selectionPageId === pageId && selectionLayer === "bangla";

  const { gArabic, gBangla } = useGlobalLayoutValues();


  return (
    <div style={{ position: "relative", width, height, pointerEvents: editMode ? "auto" : "none" }}>
      {layout.map((L, i) => {
        if (skipSet.has(i)) return null;
        const slot = lines[i];
        if (!slot) return null;
        return (
          <FabricRow
            key={`row-${i}`}
            pageId={pageId}
            rowIndex={i}
            box={L}
            slot={slot}
            width={width}
            arabicFamily={arabicFamily}
            banglaFamily={banglaFamily}
            lines={lines}
            hideArabic={isUnifiedArabicEditing}
            hideBangla={isUnifiedBanglaEditing}
          />
        );
      })}

      {(() => {
        const rowSpacing = layout.length > 1 ? layout[1].sy - layout[0].sy : 120;
        
        // Calculate exact marginTop offset so Editor text overlaps Normal text perfectly
        const arH = layout[0]?.arH ?? 60;
        const arNormalLineHeight = Math.round(gArabic * 1.8);
        const arNormalPaddingTop = Math.max(0, arH * 0.05);
        const arMarginTop = arNormalPaddingTop + (arNormalLineHeight - rowSpacing) / 2;

        const bnNormalLineHeight = Math.round(gBangla * 2.0);
        const bnNormalPaddingTop = 1;
        const bnMarginTop = bnNormalPaddingTop + (bnNormalLineHeight - rowSpacing) / 2;

        return (
          <>
            {isUnifiedArabicEditing && (
              <UnifiedStoryEditor
                anchorPageId={pageId}
                scope={scope}
                layer="arabic"
                fontFamily={arabicFamily}
                fontSize={gArabic}
                width={width}
                height={height}
                lineHeight={rowSpacing}
                marginTop={arMarginTop}
                align="justify"
                baseline={layout.find(l => !skipSet.has(layout.indexOf(l)))?.ay ?? 0}
                onClose={() => useEditorStore.getState().setActiveTool("select")}
              />
            )}

            {isUnifiedBanglaEditing && (
              <UnifiedStoryEditor
                anchorPageId={pageId}
                scope={scope}
                layer="bangla"
                fontFamily={banglaFamily}
                fontSize={gBangla}
                width={width}
                height={height}
                lineHeight={rowSpacing}
                marginTop={bnMarginTop}
                align="justify"
                baseline={layout.find(l => !skipSet.has(layout.indexOf(l)))?.by ?? 0}
                onClose={() => useEditorStore.getState().setActiveTool("select")}
              />
            )}
          </>
        );
      })()}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// FabricRow — one row, isolated via fine-grained selectors
// ──────────────────────────────────────────────────────────────────────────────
type FabricRowProps = {
  pageId: string;
  rowIndex: number;
  box: RowBox;
  slot: FabricLine;
  width: number;
  arabicFamily: string;
  banglaFamily: string;
  lines: FabricLine[];
  hideArabic?: boolean;
  hideBangla?: boolean;
};

const FabricRow = memo(function FabricRow({
  pageId,
  rowIndex: i,
  box: L,
  slot,
  width,
  arabicFamily,
  banglaFamily,
  lines,
  hideArabic,
  hideBangla,
}: FabricRowProps) {
  const rk = rowKey(pageId, i);
  const aLk = layerKey(pageId, i, "arabic");
  const bLk = layerKey(pageId, i, "bangla");
  const sLk = layerKey(pageId, i, "symbol");

  const { gArabic, gBangla, gArabicY, gBanglaY, gSymbolY } = useGlobalLayoutValues();
  const tmpl = useTemplateStore((s) => s.getActiveTemplate());

  // Fine-grained: only re-render when this row's four keys change
  const { rOv, aOv, bOv, sOv } = useOverridesStore(
    useShallow((s) => ({
      rOv: s.local[rk],
      aOv: s.local[aLk],
      bOv: s.local[bLk],
      sOv: s.local[sLk],
    })),
  );

  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const patchScopedAsync = useCallback((key: string, patch: Partial<LocalOverride>, scope: SelectionScope) => {
    void (async () => {
      const { effectiveScope, patchScoped } = await import("@/state/overridesStore");
      const eff = await effectiveScope(scope, key.endsWith(":arabic") ? "arabic" : key.endsWith(":bangla") ? "bangla" : "symbol");
      await patchScoped(key, patch, eff);
    })();
  }, []);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectionKey = useEditorStore((s) => s.selection?.key);
  const selectionPageId = useEditorStore((s) => s.selection?.pageId);
  const focusedRowKey = useEditorStore((s) => s.focusedRowKey);
  const isTypeTool = editMode && activeTool === "type";
  const isSelectTool = editMode && activeTool === "select";

  // Per-layer drag state (not React state — avoids re-render during drag)

  const arabicSpanRef = useRef<HTMLSpanElement | null>(null);

  const rowFontPx = rOv?.fontPx ?? gArabic;
  const rowScale = rOv?.scale ?? 1;
  const rowTx = rOv?.dx ?? 0;
  const rowTy = rOv?.dy ?? 0;
  const rowSymbolPx = Math.round((rowFontPx / tmpl.typography.arabicFontPx) * tmpl.typography.symbolFontPx);

  const lkSy = sLk;
  const isFlashing =
    focusedRowKey === rk ||
    focusedRowKey === aLk ||
    focusedRowKey === bLk ||
    focusedRowKey === lkSy;

  // Arabic layer
  const aDx = aOv?.dx ?? 0;
  const aDy = aOv?.dy ?? 0;
  const aFontPx = aOv?.fontPx ?? rowFontPx;
  const aLeading = aOv?.leading ?? 1;
  const aTracking = aOv?.tracking ?? 0;
  const aVScale = (aOv?.vScale ?? 100) / 100;
  const aHScale = (aOv?.hScale ?? 100) / 100;
  const aScaleFactor = aFontPx / (gArabic || tmpl.typography.arabicFontPx);
  const aBaseline = (aOv?.baseline ?? 0) * aScaleFactor;
  const aLineHeight = Math.max(1, aLeading * aScaleFactor);
  const aAlign = (aOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const aText = aOv?.text ?? slot.arabic ?? "";
  const isArabicEditing = !hideArabic && isTypeTool && selectionKey === aLk && selectionPageId === pageId;
  const aTextMode = aOv?.textMode ?? "point";
  const aAreaHeight = aOv?.areaHeight ?? null;

  // Bangla layer
  const bDx = bOv?.dx ?? 0;
  const bDy = bOv?.dy ?? 0;
  const bFontPx = bOv?.fontPx ?? gBangla;
  const bLeading = bOv?.leading ?? 1.1;
  const bTracking = bOv?.tracking ?? 0;
  const bVScale = (bOv?.vScale ?? 100) / 100;
  const bHScale = (bOv?.hScale ?? 100) / 100;
  const bScaleFactor = bFontPx / (gBangla || tmpl.typography.banglaFontPx);
  const bBaseline = (bOv?.baseline ?? 0) * bScaleFactor;
  const bLineHeight = Math.max(1, bLeading * bScaleFactor);
  const bAlign = (bOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const bText = bOv?.text ?? slot.bangla ?? "";
  const isBanglaEditing = !hideBangla && isTypeTool && selectionKey === bLk && selectionPageId === pageId;
  const bTextMode = bOv?.textMode ?? "point";
  const bAreaHeight = bOv?.areaHeight ?? null;

  const sDx = sOv?.dx ?? 0;
  const sDy = sOv?.dy ?? 0;
  const sText = sOv?.text ?? slot.symbol ?? "";
  const isSymbolEditing = isTypeTool && selectionKey === sLk && selectionPageId === pageId;

  return (
    <div
      data-sel-kind="row"
      data-sel-key={rk}
      data-page-id={pageId}
      data-row-index={i}
      style={{
        position: "absolute",
        left: 0,
        top: L.sy,
        width,
        height: L.symH + L.arH + L.bnH + (L.pronH ?? 0) + (L.meanH ?? 0),
        overflow: "visible",
        transform: `translate(${rowTx}px, ${rowTy}px) scale(${rowScale})`,
        transformOrigin: "top left",
        outline: isFlashing ? "2px solid rgba(251,191,36,0.85)" : undefined,
        outlineOffset: isFlashing ? "2px" : undefined,
        borderRadius: isFlashing ? "3px" : undefined,
        animation: isFlashing ? "rowFlash 1.1s ease-out" : undefined,
      }}
    >
      {/* Symbol strip */}
      <div
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? sLk : undefined}
        data-layer-kind="symbol"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: sLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "symbol",
                });
              }
            : undefined
        }
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height: L.symH,
          transform: `translate(${sDx}px, ${gSymbolY + sDy}px)`,
          overflow: "visible",
          zIndex: 20,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isSymbolEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isSymbolEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            dir="ltr"
            lang="ar"
            spellCheck={false}
            onBlur={(e) => patchLocal(sLk, { text: e.currentTarget.textContent ?? "" })}
            onInput={(e) => patchLocal(sLk, { text: e.currentTarget.textContent ?? "" })}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              display: "block",
              width: "100%",
              minHeight: "1em",
              outline: "2px solid rgba(56,189,248,0.7)",
              outlineOffset: "2px",
              borderRadius: "2px",
              background: "rgba(56,189,248,0.06)",
              textAlign: "center",
              fontSize: rowSymbolPx,
              lineHeight: `${Math.max(12, L.symH)}px`,
              color: "#ef4444",
            }}
          >
            {sText}
          </div>
        ) : sOv?.text !== undefined ? (
          <span
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontSize: rowSymbolPx,
              lineHeight: `${Math.max(12, L.symH)}px`,
              color: "#ef4444",
            }}
          >
            {sText}
          </span>
        ) : (
          (aText || slot.arabic) && (
            <TopSymbolLayer
              arabic={slot.arabic ?? aText}
              arabicSpanRef={arabicSpanRef}
              width={width}
              height={L.symH}
              fontFamily={arabicFamily}
              fontSize={rowSymbolPx}
              pageId={pageId}
              rowIndex={i}
              displayArabic={aText}
              isEditing={isArabicEditing}
            />
          )
        )}
      </div>

      {/* Arabic band */}
      <div
        dir="rtl"
        lang="ar"
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? aLk : undefined}
        data-layer-kind="arabic"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: aLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "arabic",
                });
              }
            : undefined
        }

        style={{
          position: "absolute",
          left: 0,
          top: L.symH,
          width,
          height: aTextMode === "area" ? (aAreaHeight ?? L.arH) : L.arH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: arabicFamily,
          fontSize: aFontPx,
          color: "#111827",
          lineHeight: aLineHeight,
          letterSpacing: aTracking,
          display: "block",
          paddingTop: Math.max(0, L.arH * 0.05),
          textAlign: aAlign,
          textAlignLast: aAlign === "justify" ? "justify" : undefined,
          whiteSpace: aTextMode === "area" ? "normal" : "nowrap",
          overflow: aTextMode === "area" ? "hidden" : "visible",
          wordBreak: aTextMode === "area" ? "break-word" : undefined,
          overflowWrap: aTextMode === "area" ? "break-word" : undefined,
          unicodeBidi: aTextMode === "area" ? "plaintext" : undefined,
          transform: `translate(${aDx}px, ${gArabicY + aBaseline + aDy}px) scaleX(${aHScale}) scaleY(${aVScale})`,
          transformOrigin: "top left",
          zIndex: 30,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isArabicEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isArabicEditing ? (
          <InlineTextEditor
            key={aLk}
            layerKey={aLk}
            initialText={aText}
            dir="rtl"
            lang="ar"
            rowIndex={i}
            pageId={pageId}
            layer="arabic"
            lines={lines}
            fontFamily={arabicFamily}
            fontSize={aFontPx}
            availableWidth={width - 16}
            textMode={aTextMode}
            areaHeight={aAreaHeight}
            onSave={(t) => patchLocal(aLk, { text: t })}
          />
        ) : (
          !hideArabic && slot.arabic && (
            <span
              ref={arabicSpanRef}
              style={{ display: "inline-block", width: "100%", textAlign: aAlign, textAlignLast: "justify" }}
            >
              <WordSpans
                text={aText}
                pageId={pageId}
                rowIndex={i}
                interactive={isTypeTool}
                fallbackFontPx={aFontPx}
                fallbackTracking={aTracking}
              />
            </span>
          )
        )}
      </div>

      {/* Bangla band */}
      <div
        lang="bn"
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? bLk : undefined}
        data-layer-kind="bangla"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: bLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "bangla",
                });
              }
            : undefined
        }

        style={{
          position: "absolute",
          left: 0,
          top: L.symH + L.arH,
          width,
          height: bTextMode === "area" ? (bAreaHeight ?? L.bnH) : L.bnH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: banglaFamily,
          fontSize: bFontPx,
          color: "#064e3b",
          lineHeight: bLineHeight,
          letterSpacing: bTracking,
          overflow: bTextMode === "area" ? "hidden" : "visible",
          display: "block",
          paddingTop: 1,
          textAlign: bAlign,
          textAlignLast: bAlign === "justify" ? "justify" : undefined,
          whiteSpace: bTextMode === "area" ? "normal" : "nowrap",
          wordBreak: bTextMode === "area" ? "break-word" : "normal",
          transform: `translate(${bDx}px, ${gBanglaY + bBaseline + bDy}px) scaleX(${bHScale}) scaleY(${bVScale})`,
          transformOrigin: "top left",
          zIndex: 10,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isBanglaEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isBanglaEditing ? (
          <InlineTextEditor
            key={bLk}
            layerKey={bLk}
            initialText={bText}
            dir="ltr"
            lang="bn"
            rowIndex={i}
            pageId={pageId}
            layer="bangla"
            lines={lines}
            fontFamily={banglaFamily}
            fontSize={bFontPx}
            availableWidth={width - 16}
            textMode={bTextMode}
            areaHeight={bAreaHeight}
            onSave={(t) => patchLocal(bLk, { text: t })}
          />
        ) : (
          !hideBangla && slot.bangla && (
            <span style={{ display: "inline-block", width: "100%", textAlign: bAlign, textAlignLast: "justify" }}>
              {bText}
            </span>
          )
        )}
      </div>

      {/* Pronunciation band */}
      {tmpl.meaningConfig?.showPronunciation && slot.pronunciation && L.pronH && L.pronY && (
        <div
          lang="bn"
          style={{
            position: "absolute",
            left: 0,
            top: L.pronY,
            width,
            height: L.pronH,
            paddingLeft: 8,
            paddingRight: 8,
            boxSizing: "border-box",
            fontFamily: banglaFamily,
            fontSize: tmpl.meaningConfig.pronunciationFontPx,
            color: "#6b7280",
            lineHeight: "normal",
            display: "block",
            textAlign: "center",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {slot.pronunciation}
        </div>
      )}

      {/* Meaning band */}
      {tmpl.meaningConfig?.showMeaning && slot.meaning && L.meanH && L.meanY && (
        <div
          lang="bn"
          style={{
            position: "absolute",
            left: 0,
            top: L.meanY,
            width,
            height: L.meanH,
            paddingLeft: 8,
            paddingRight: 8,
            boxSizing: "border-box",
            fontFamily: banglaFamily,
            fontSize: tmpl.meaningConfig.meaningFontPx,
            color: "#475569",
            lineHeight: "normal",
            display: "block",
            textAlign: "center",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {slot.meaning}
        </div>
      )}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// InlineTextEditor — contenteditable with rAF-throttled overflow detection
// ──────────────────────────────────────────────────────────────────────────────
function InlineTextEditor({
  layerKey: lk,
  initialText,
  dir,
  lang,
  rowIndex,
  pageId,
  layer,
  lines,
  fontFamily,
  fontSize,
  availableWidth,
  textMode,
  areaHeight,
  onSave,
}: {
  layerKey: string;
  initialText: string;
  dir?: string;
  lang?: string;
  rowIndex: number;
  pageId: string;
  layer: LayerKind;
  lines: FabricLine[];
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  textMode: "point" | "area";
  areaHeight: number | null;
  onSave: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(initialText);
  const { request: requestGuarded, dialogProps: guardDialogProps } = useLargeChangeGuard();



  // Sync DOM ↔ store: on each keystroke, write text to store immediately
  // (no debounce — Zustand patches are cheap, and this guarantees the edit
  // never gets lost on selection-change/unmount races).
  const syncToStore = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    if (text === lastSavedRef.current) return;
    lastSavedRef.current = text;
    useOverridesStore.getState().patchLocal(lk, { text });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.textContent = initialText;
    lastSavedRef.current = initialText;
    el.focus();

    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        if (el.lastChild) range.setStartAfter(el.lastChild);
        else range.setStart(el, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch { /* ignore */ }

    return () => {
      // Flush any pending overflow-check synchronously before tearing down
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Always commit the current DOM text — covers unmount-without-blur
      const text = el.textContent ?? "";
      if (text !== lastSavedRef.current) {
        useOverridesStore.getState().patchLocal(lk, { text });
        lastSavedRef.current = text;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getReflowBase = () => {
    const editorScope = useEditorStore.getState().scope;
    const isReflowLayer = layer === "arabic" || layer === "bangla";
    const eff = isReflowLayer
      ? effectiveReflowScope(editorScope, layer as "arabic" | "bangla", pageId)
      : { cascade: true, pageIds: [pageId], layer: "arabic" as const };
    return {
      layer,
      cascade: eff.cascade,
      scopedPageIds: eff.pageIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allPages: useReflowStore.getState().pages as unknown as Array<{ id: string; lines: any[] }>,
      localMap: useOverridesStore.getState().local,
      patchLocal: useOverridesStore.getState().patchLocal,
      layerKeyFn: layerKey,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds: eff.pageIds,
    };
  };



  const commit = (text?: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const finalText = text ?? ref.current?.textContent ?? "";
    if (finalText !== lastSavedRef.current) {
      lastSavedRef.current = finalText;
      onSave(finalText);
    }
  };

  // rAF-throttled overflow check — coalesces fast keystrokes into one frame
  const checkOverflow = () => {
    rafRef.current = null;
    const el = ref.current;
    if (!el) return;

    // Always sync current text first (covers normal typing)
    syncToStore();

    const currentText = el.textContent ?? "";
    const base = getReflowBase();
    const localMap = useOverridesStore.getState().local;

    // ─── Determine how to split: Area Text (2D) or Point Text (1D) ───
    const lkLocal = layerKey(pageId, rowIndex, layer);
    const curTextMode = localMap[lkLocal]?.textMode ?? "point";
    const curAreaHeight = localMap[lkLocal]?.areaHeight ?? null;
    const curLeadingPx = localMap[lkLocal]?.leading ?? 0;
    // leading in store is absolute px. Convert to multiplier for area utils.
    const leadingMult = curLeadingPx > 0 ? curLeadingPx / fontSize : 1;

    let fitsText: string;
    let overflowText: string;

    if (curTextMode === "area" && curAreaHeight !== null) {
      // Area Text: split based on height constraint
      const result = splitToFitArea(currentText, availableWidth, curAreaHeight, fontFamily, fontSize, leadingMult, layer);
      fitsText = result.fits;
      overflowText = result.overflow;
    } else if (curTextMode === "area" && curAreaHeight === null) {
      // Area Text with no fixed height — CSS handles wrapping, nothing overflows to next row
      return;
    } else {
      // Point Text: split based on width constraint
      const result = splitToFit(currentText, availableWidth, fontFamily, fontSize);
      fitsText = result.fits;
      overflowText = result.overflow;
    }

    if (overflowText) {
      // Link OFF for this layer → clip to current row, warn user, do not cascade.
      if (!base.cascade) {
        lastSavedRef.current = fitsText;
        useOverridesStore.getState().patchLocal(lk, { text: fitsText });
        el.textContent = fitsText;
        try {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            if (el.lastChild) range.setStartAfter(el.lastChild);
            else range.setStart(el, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch { /* ignore */ }
        toast.warning("লিংক বন্ধ — ওভারফ্লো অন্য সারিতে যাবে না", { id: `link-off-${lk}` });
        return;
      }

      // Cascade enabled — push overflow forward into subsequent rows.
      const preEditText = lastSavedRef.current;

      lastSavedRef.current = fitsText;
      useOverridesStore.getState().patchLocal(lk, { text: fitsText });
      el.textContent = fitsText;
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          if (el.lastChild) range.setStartAfter(el.lastChild);
          else range.setStart(el, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch { /* ignore */ }

      const scopedPages = base.allPages.filter((p) => base.scopedPageIds.includes(p.id));
      const pIdx = scopedPages.findIndex((p) => p.id === pageId);
      const nextRef = pIdx >= 0 ? findNextValidRow(pIdx, rowIndex, scopedPages, layer) : null;
      if (!nextRef) return; // nowhere to overflow within the active scope

      const targetPageId = scopedPages[nextRef.pi]!.id;
      const targetRowIdx = nextRef.ri;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cascade: _c, scopedPageIds: _s, allPages: _a, ...reflowArgs } = base;

      const runReflow = () => {
        void reflowFromAsync({
          ...reflowArgs,
          allPages: scopedPages,
          surahPageIds: base.scopedPageIds,
          startPageId: targetPageId,
          startRowIndex: targetRowIdx,
          startOverflow: overflowText,
          localMap: useOverridesStore.getState().local,
        });
      };

      const plan = planCascade({
        startPageId: targetPageId,
        startRowIndex: targetRowIdx,
        newCurrentText: "",
        pushedText: overflowText,
        layer,
        allPages: scopedPages,
        localMap: base.localMap,
        layerKeyFn: base.layerKeyFn,
        fontFamily: base.fontFamily,
        fontSize: base.fontSize,
        availableWidth: base.availableWidth,
        surahPageIds: base.surahPageIds, // Keep to detect if it crossed surah for the warning
      });

      if (plan.crossesPage || plan.crossesSurah) {
        if (useEditorStore.getState().pendingReflow) return;
        useEditorStore.getState().setPendingReflow({
          crossesPage: plan.crossesPage,
          crossesSurah: plan.crossesSurah,
          affectedPages: plan.affectedPages,
          confirm: runReflow,
          cancel: () => {
            useOverridesStore.getState().patchLocal(lk, { text: preEditText });
            lastSavedRef.current = preEditText;
            if (ref.current) ref.current.textContent = preEditText;
          },
        });
        return;
      }

      runReflow();
      return;
    }

    // Text fits — if there is spare room, try to back-fill from subsequent rows.
    // Check free space using area-aware logic.
    const hasFreeSpace = (() => {
      if (curTextMode === "area" && curAreaHeight !== null) {
        const h = calculateAreaTextHeight({
          text: currentText,
          availableWidth,
          fontFamily,
          fontSize,
          leading: leadingMult,
          layer,
          paddingY: 4
        });
        const lh = fontSize * Math.max(1, leadingMult);
        return (h + lh) <= curAreaHeight;
      }
      return measureTextWidth(currentText, fontFamily, fontSize) < availableWidth - 20;
    })();

    if (hasFreeSpace) {
      if (!base.cascade) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cascade: _c, scopedPageIds: _s, allPages: _a, ...reflowArgs } = base;
      backFillFrom({
        ...reflowArgs,
        allPages: base.allPages.filter((p) => base.scopedPageIds.includes(p.id)),
        surahPageIds: base.scopedPageIds,
        startPageId: pageId,
        startRowIndex: rowIndex,
      });
    }

  };

  const handleInput = () => {
    if (rafRef.current != null) return; // already scheduled
    rafRef.current = requestAnimationFrame(checkOverflow);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      e.preventDefault();
      commit();
      useEditorStore.getState().setActiveTool("select");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Area Text: insert a native line break inside the frame; no cascade.
      if (textMode === "area") {
        document.execCommand("insertLineBreak");
        syncToStore();
        return;
      }
      const el = ref.current;
      if (!el) return;

      const { before, after } = getTextAroundCursor(el);
      const beforeText = before.trim();
      const afterText = after.trim();

      // Snapshot pre-edit text so cancel can restore it
      const preEditText = lastSavedRef.current;

      useOverridesStore.getState().patchLocal(lk, { text: beforeText });
      lastSavedRef.current = beforeText;
      el.textContent = beforeText;

      if (!afterText) return;

      const scope = useEditorStore.getState().scope;
      const base = getReflowBase();
      
      // Link OFF for this layer → Enter cannot push text across rows.
      if (!base.cascade) {
        // Restore split text into a single line and warn.
        useOverridesStore.getState().patchLocal(lk, { text: `${beforeText} ${afterText}`.trim() });
        lastSavedRef.current = `${beforeText} ${afterText}`.trim();
        if (ref.current) ref.current.textContent = lastSavedRef.current;
        toast.warning("লিংক বন্ধ — Enter দিয়ে অন্য সারিতে যাবে না", { id: `link-off-enter-${lk}` });
        return;
      }


      // 1. Keep text flow inside the effective scoped page set.
      const allPagesForReflow = base.allPages.filter((p) => base.scopedPageIds.includes(p.id));

      // 2. Resolve insertion point inside the active scope.
      const pIdx = allPagesForReflow.findIndex((p) => p.id === pageId);
      const nextRef = pIdx >= 0 ? findNextValidRow(pIdx, rowIndex, allPagesForReflow, layer) : null;
      if (!nextRef) return;
      const { pi: tPi, ri: targetRowIdx } = nextRef;
      const targetPageId = allPagesForReflow[tPi]!.id;

      // 3. Combined overflow (afterText + existing text at target row)
      const tPage = allPagesForReflow[tPi]!;
      const tLk = layerKey(targetPageId, targetRowIdx, layer);
      const tSlots = getDomSlots(tPage);
      const tSlot = tSlots[targetRowIdx];
      const tRowFallback =
        layer === "arabic"
          ? (tSlot?.arabic ?? "")
          : (tSlot?.bangla ?? "");
      const nextExisting = base.localMap[tLk]?.text ?? tRowFallback;
      const combined = nextExisting ? afterText + " " + nextExisting : afterText;

      // 4. Use layer+area-aware split for the next row
      const localMapNow = useOverridesStore.getState().local;
      const tTextMode = localMapNow[tLk]?.textMode ?? "point";
      const tAreaHeight = localMapNow[tLk]?.areaHeight ?? null;
      const tLeadingPx = localMapNow[tLk]?.leading ?? 0;
      const tLeadingMult = tLeadingPx > 0 ? tLeadingPx / fontSize : 1;

      let nextFits: string;
      let nextOverflow: string;
      if (tTextMode === "area" && tAreaHeight !== null) {
        const r = splitToFitArea(combined, availableWidth, tAreaHeight, fontFamily, fontSize, tLeadingMult, layer);
        nextFits = r.fits;
        nextOverflow = r.overflow;
      } else {
        const r = splitToFit(combined, availableWidth, fontFamily, fontSize);
        nextFits = r.fits;
        nextOverflow = r.overflow;
      }

      // 5. Dry-run cascade plan to detect cross-page / cross-surah impact
      const plan = planCascade({
        startPageId: targetPageId,
        startRowIndex: targetRowIdx,
        newCurrentText: nextFits,
        pushedText: nextOverflow.trim(),
        layer,
        allPages: allPagesForReflow,
        localMap: localMapNow,
        layerKeyFn: base.layerKeyFn,
        fontFamily: base.fontFamily,
        fontSize: base.fontSize,
        availableWidth: base.availableWidth,
        surahPageIds: base.surahPageIds,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cascade: _c, scopedPageIds: _s, allPages: _a, ...reflowOpts } = base;
      const runReflow = () =>
        void reflowFromAsync({
          ...reflowOpts,
          allPages: allPagesForReflow,
          surahPageIds: base.scopedPageIds,
          startPageId: targetPageId,
          startRowIndex: targetRowIdx,
          startOverflow: combined,
          localMap: useOverridesStore.getState().local,
        });

      const cancelEdit = () => {
        // Restore the start row to its pre-edit text
        useOverridesStore.getState().patchLocal(lk, { text: preEditText });
        lastSavedRef.current = preEditText;
        if (ref.current) ref.current.textContent = preEditText;
      };

      // For general/page scope: apply immediately even if cross-page (user already
      // chose this scope — a dialog would be confusing and block normal typing).
      // For surah/global scope: show confirmation dialog for large cross-page impacts.
      if ((plan.crossesPage || plan.crossesSurah) && scope !== "general" && scope !== "page") {
        useEditorStore.getState().setPendingReflow({
          crossesPage: plan.crossesPage,
          crossesSurah: plan.crossesSurah,
          affectedPages: plan.affectedPages,
          confirm: runReflow,
          cancel: cancelEdit,
        });
        return;
      }

      // Same-page/cross-page changes — apply through existing large-change guard.
      requestGuarded({
        scope,
        estimatedRows: plan.rowUpdates.length,
        label: "এন্টার কী প্রয়োগ হচ্ছে…",
        action: runReflow,
      });
      return;
    }

    if (e.key === "Backspace") {
      const el = ref.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return;
      const { before } = getTextAroundCursor(el);

      // Area Text: allow normal Backspace inside frame.
      // If cursor is at start and there's nothing before, block default (no row collapse for area).
      if (textMode === "area") {
        if (before.length === 0) e.preventDefault(); // can't merge area frames
        return;
      }

      if (before.length > 0) return;

      const base = getReflowBase();
      if (!base.cascade) {
        toast.warning("লিংক বন্ধ — Backspace দিয়ে আগের সারি থেকে টেক্সট টানা যাবে না", { id: `link-off-backspace-${lk}` });
        return;
      }

      e.preventDefault();
      const scope = useEditorStore.getState().scope;

      // Keep collapse inside the effective scoped page set.
      const allPagesForCollapse = base.allPages.filter((p) => base.scopedPageIds.includes(p.id));
      const curPi = allPagesForCollapse.findIndex((p) => p.id === pageId);
      const prevPageId = curPi > 0 ? allPagesForCollapse[curPi - 1]!.id : null;

      const collapse = () => {
        const result = collapseLineBreakBackward({
          startPageId: pageId,
          startRowIndex: rowIndex,
          layer,
          allPages: allPagesForCollapse,
          localMap: useOverridesStore.getState().local,
          patchLocal: useOverridesStore.getState().patchLocal,
          layerKeyFn: base.layerKeyFn,
          fontFamily: base.fontFamily,
          fontSize: base.fontSize,
          availableWidth: base.availableWidth,
          surahPageIds: base.scopedPageIds,
        });
        if (result.merged) {
          const updated = useOverridesStore.getState().local[lk]?.text ?? "";
          lastSavedRef.current = updated;
          if (ref.current) ref.current.textContent = updated;
        }
      };

      // Only show cross-page dialog for surah/para/global scope — for general/page
      // scope, collapse directly without blocking the user.
      if (rowIndex === 0 && prevPageId && (scope === "surah" || scope === "para" || scope === "global")) {
        const crossesSurah = base.surahPageIds ? !base.surahPageIds.includes(prevPageId) : false;
        useEditorStore.getState().setPendingReflow({
          crossesPage: true,
          crossesSurah,
          affectedPages: 2,
          confirm: collapse,
        });
        return;
      }

      collapse();
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        lang={lang}
        spellCheck={false}
        onBlur={() => {
          if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          if (!committedRef.current) commit();
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          display: "block",
          width: "100%",
          minHeight: textMode === "area" ? (areaHeight ?? undefined) : "1em",
          outline: "2px solid rgba(56,189,248,0.7)",
          outlineOffset: "2px",
          borderRadius: "2px",
          background: "rgba(56,189,248,0.06)",
          caretColor: lang === "ar" ? "#f59e0b" : "#34d399",
          whiteSpace: textMode === "area" ? "pre-wrap" : "nowrap",
          overflow: textMode === "area" ? "auto" : "hidden",
          height: textMode === "area" ? (areaHeight ?? "auto") : undefined,
          maxHeight: textMode === "area" ? (areaHeight ? `${areaHeight}px` : "none") : undefined,
          wordBreak: textMode === "area" ? "break-word" : "normal",
          overflowWrap: textMode === "area" ? "break-word" : "normal",
          cursor: "text",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      />
      <ScopeImpactWarningDialog {...guardDialogProps} />
    </>
  );

}

// Re-export to satisfy legacy types if any
export type { LocalOverride };

// ──────────────────────────────────────────────────────────────────────────────
// WordSpans — per-word rendering inside the Arabic band
// ──────────────────────────────────────────────────────────────────────────────

const WordSpans = memo(function WordSpans({
  text,
  pageId,
  rowIndex,
  interactive,
  fallbackFontPx,
  fallbackTracking,
}: {
  text: string;
  pageId: string;
  rowIndex: number;
  interactive: boolean;
  fallbackFontPx: number;
  fallbackTracking: number;
}) {
  const words = splitArabicWords(text);
  return (
    <>
      {words.map((w, idx) => (
        <span key={idx}>
          {idx > 0 && " "}
          <WordSpan
            word={w}
            pageId={pageId}
            rowIndex={rowIndex}
            wordIndex={idx}
            interactive={interactive}
            fallbackFontPx={fallbackFontPx}
            fallbackTracking={fallbackTracking}
          />
        </span>
      ))}
    </>
  );
});

const WordSpan = memo(function WordSpan({
  word,
  pageId,
  rowIndex,
  wordIndex,
  interactive,
  fallbackFontPx,
  fallbackTracking,
}: {
  word: string;
  pageId: string;
  rowIndex: number;
  wordIndex: number;
  interactive: boolean;
  fallbackFontPx: number;
  fallbackTracking: number;
}) {
  const wk = wordLayerKey(pageId, rowIndex, wordIndex);
  const ov = useOverridesStore((s) => s.local[wk]);
  const selectionKey = useEditorStore((s) => s.selection?.key);
  const isSelected = selectionKey === wk;

  const style: React.CSSProperties = {
    fontSize: ov?.fontPx ?? fallbackFontPx,
    letterSpacing: ov?.tracking ?? fallbackTracking,
    color: ov?.color,
    cursor: interactive ? "pointer" : "inherit",
    outline: isSelected ? "1px dashed rgba(245,158,11,0.9)" : undefined,
    outlineOffset: isSelected ? "2px" : undefined,
    borderRadius: isSelected ? "2px" : undefined,
    pointerEvents: interactive ? "auto" : "none",
  };

  return (
    <span
      data-sel-kind={interactive ? "word" : undefined}
      data-sel-key={interactive ? wk : undefined}
      data-word-index={wordIndex}
      style={style}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              useEditorStore.getState().setSelection({
                kind: "word",
                key: wk,
                pageId,
                rowIndex,
                wordIndex,
              });
            }
          : undefined
      }
    >
      {word}
    </span>
  );
});

