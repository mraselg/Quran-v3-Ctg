import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFont } from "@/context/FontContext";
import type { PageData } from "@/data/pages";
import { useEditorStore, type Selection } from "@/state/editorStore";
import { useLinkingStore } from "@/state/linkingStore";
import { layerKey, useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { buildVisibleDualLayerKeys } from "@/lib/scopeTargets";
import { ArchedHeader } from "./ArchedHeader";
import { BismillahBox } from "./BismillahBox";
import { FabricLines, type FabricLine } from "./FabricLines";
import { SlimFooter } from "./SlimFooter";
import { SlimHeader } from "./SlimHeader";
import { SurahOpenBlock } from "./SurahOpenBlock";
import { useTemplateStore } from "@/state/templateStore";

import { getScale, getDisplayH, getGridTopPx, computeGridLayout } from "@/lib/templateUtils";

export const Artboard = memo(function Artboard({ page, zoom = 1 }: { page: PageData; zoom?: number }) {
  const { activeFamily } = useFont();
  const isOpen = page.type === "surah-open";
  const tmpl = useTemplateStore((s) => s.getActiveTemplate());
  const linesPerPage = tmpl.linesPerPage;
  const surahOpenStartAt = tmpl.surahOpen.startAt;

  const layoutMetrics = useMemo(() => {
    const scale = getScale(tmpl.pageGeometry);
    const displayH = getDisplayH(tmpl.pageGeometry);
    const gridTopPx = getGridTopPx(tmpl);
    const gridLayoutPx = computeGridLayout(tmpl);
    const headerTopPx = tmpl.pageGeometry.headerBand[0] * scale;
    const headerHPx = (tmpl.pageGeometry.headerBand[1] - tmpl.pageGeometry.headerBand[0]) * scale;
    const footerHPx = 16 * scale;
    const footerTopPx = (tmpl.pageGeometry.footerBandY1 - 16) * scale;
    const gridLeftPx = tmpl.pageGeometry.lineX * scale;
    const gridWPx = (tmpl.pageGeometry.lineXEnd - tmpl.pageGeometry.lineX) * scale;
    const firstRowY = tmpl.pageGeometry.rowBandsSvg[0]![0];
    const lastRowY2 = tmpl.pageGeometry.rowBandsSvg[tmpl.pageGeometry.rowBandsSvg.length - 1]![1];
    const gridHPx = (lastRowY2 - firstRowY) * scale;
    
    return {
      scale, displayH, gridTopPx, gridLayoutPx, headerTopPx, headerHPx, footerHPx, footerTopPx, gridLeftPx, gridWPx, gridHPx
    };
  }, [tmpl]);
  const { scale, displayH, gridTopPx, gridLayoutPx, headerTopPx, headerHPx, footerHPx, footerTopPx, gridLeftPx, gridWPx, gridHPx } = layoutMetrics;

  // Map a PageData into line slots
  const slots: FabricLine[] = Array.from({ length: linesPerPage }, () => ({} as FabricLine));
  const skipSlots: number[] = [];
  const inlineSurahOpens: Array<{ index: number; data: NonNullable<PageData["lines"][number]["surahOpen"]> }> = [];
  const startAt = isOpen ? surahOpenStartAt : 0;
  page.lines.slice(0, linesPerPage - startAt).forEach((l, i) => {
    const idx = startAt + i;
    if (l.slotKind === "surah-open" && l.surahOpen) {
      inlineSurahOpens.push({ index: idx, data: l.surahOpen });
      for (let k = 0; k < tmpl.surahOpen.headerSpan; k++) {
        skipSlots.push(idx + k);
      }
      return;
    }
    slots[idx] = {
      arabic: l.arabicLine ?? l.blocks.map((b) => b.arabic).join(" "),
      bangla: l.banglaLine ?? l.blocks.map((b) => b.bangla).filter(Boolean).join(" "),
      symbol: (l.markers ?? []).join("  "),
      pronunciation: l.pronunciationLine,
      meaning: l.meaningLine,
    };
  });


  // Header / footer text per page type
  const headerLeft = isOpen ? "১ পারা" : page.para;
  const headerCenter = isOpen
    ? "কু-রীয়ানা পদ্ধতিতে কুর্-আ-ন শিক্ষার কু-রীয়ানা কুর্আ-নুম মাজীদ"
    : page.title;
  const headerRight = isOpen ? "জুলিস ন-ন বী" : page.chapter;

  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setHover = useEditorStore((s) => s.setHover);
  const selection = useEditorStore((s) => s.selection);
  const hover = useEditorStore((s) => s.hover);
  const showGuides = useEditorStore((s) => s.showGuides);
  const scope = useEditorStore((s) => s.scope);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selRects, setSelRects] = useState<Array<{ key: string; rect: DOMRect; primary: boolean }>>([]);
  const pages = useReflowStore((s) => s.pages);
  const distribution = useReflowStore((s) => s.distribution);
  const linkArabic = useLinkingStore((s) => s.arabic);
  const linkBangla = useLinkingStore((s) => s.bangla);
  // Targeted override snapshot: re-measure when visible scoped keys' overrides change.
  const visibleSelectionKeys = useMemo(() => {
    if (!selection?.key) return [];
    const layerKind = selection.layerKind;
    const linked = layerKind === "arabic" ? linkArabic : layerKind === "bangla" ? linkBangla : false;
    const shouldShowScopedLayerSelection =
      editMode &&
      selection.kind === "layer" &&
      (layerKind === "arabic" || layerKind === "bangla") &&
      scope !== "general" &&
      linked;

    if (!shouldShowScopedLayerSelection) {
      return selection.pageId === page.id ? [selection.key] : [];
    }

    return buildVisibleDualLayerKeys(selection.key, scope, page.id, pages, distribution);
  }, [distribution, editMode, linkArabic, linkBangla, page.id, pages, scope, selection]);
  const selectionOverrideSignature = useOverridesStore((s) =>
    visibleSelectionKeys
      .map((key) => {
        const ov = s.local[key];
        return `${key}:${ov?.dx ?? ""}:${ov?.dy ?? ""}:${ov?.fontPx ?? ""}:${ov?.leading ?? ""}:${ov?.tracking ?? ""}:${ov?.baseline ?? ""}:${ov?.vScale ?? ""}:${ov?.hScale ?? ""}:${ov?.textMode ?? ""}:${ov?.areaHeight ?? ""}`;
      })
      .join("|"),
  );
  const hoverOverride = useOverridesStore((s) => (hover?.key ? s.local[hover.key] : undefined));
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const isTypeTool = editMode && activeTool === "type";

  // Scope-based selection colors
  const SCOPE_COLORS: Record<string, string> = {
    general: "#f59e0b", page: "#06b6d4", surah: "#8b5cf6", para: "#ec4899", global: "#10b981",
  };
  const selColor = SCOPE_COLORS[scope] ?? "#f59e0b";
  const showPageHighlight = editMode && selection && scope !== "general";

  // Re-measure overlay rects after layout (also on selection / overrides change)
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = (key: string | undefined) => {
      if (!key) return null;
      const el = board.querySelector<HTMLElement>(`[data-sel-key="${CSS.escape(key)}"]`);
      if (!el) return null;
      const br = board.getBoundingClientRect();
      let r = el.getBoundingClientRect();

      // For a row, include the visually shifted bounds of its children (Symbol, Arabic, Bangla layers)
      if (el.getAttribute("data-sel-kind") === "row") {
        const children = Array.from(el.children) as HTMLElement[];
        if (children.length > 0) {
          let minTop = r.top;
          let maxBottom = r.bottom;
          children.forEach((c) => {
            const cr = c.getBoundingClientRect();
            if (cr.height > 0) {
              if (cr.top < minTop) minTop = cr.top;
              if (cr.bottom > maxBottom) maxBottom = cr.bottom;
            }
          });
          r = new DOMRect(r.left, minTop, r.width, maxBottom - minTop);
        }
      }

      // Divide by zoom to account for CSS transform scale on the board
      return new DOMRect((r.left - br.left) / zoom, (r.top - br.top) / zoom, r.width / zoom, r.height / zoom);
    };
    setSelRects(
      visibleSelectionKeys
        .map((key) => {
          const rect = measure(key);
          return rect ? { key, rect, primary: key === selection?.key } : null;
        })
        .filter((item): item is { key: string; rect: DOMRect; primary: boolean } => item !== null),
    );
    setHoverRect(measure(hover?.key));
  }, [selection?.key, hover, page, visibleSelectionKeys, selectionOverrideSignature, hoverOverride, zoom]);

  // Read which selectable element was clicked
  const readTarget = (e: React.MouseEvent | PointerEvent): Selection | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-sel-key]");
    if (!el) return null;
    const kind = el.getAttribute("data-sel-kind") as Selection["kind"] | null;
    const key = el.getAttribute("data-sel-key");
    if (!kind || !key) return null;
    const rowEl = el.closest<HTMLElement>('[data-row-index]') ?? (el.getAttribute('data-row-index') ? el : null);
    const rowIndex = rowEl ? Number(rowEl.getAttribute("data-row-index") ?? 0) : 0;
    const layerKind = (el.getAttribute("data-layer-kind") as Selection["layerKind"]) ?? undefined;
    return { kind, key, pageId: page.id, rowIndex, layerKind };
  };

  // In Type Tool mode: resolve click to the specific layer (arabic/bangla/symbol).
  // Falls back to arabic layer when user clicks the row background.
  const readLayerTarget = (e: React.MouseEvent | PointerEvent): Selection | null => {
    const target = e.target as HTMLElement;
    // First try to find a specific layer div
    const layerEl = target.closest<HTMLElement>("[data-layer-kind]");
    if (layerEl) {
      const layerKind = layerEl.getAttribute("data-layer-kind") as Selection["layerKind"];
      const rowEl = layerEl.closest<HTMLElement>("[data-row-index]");
      const rowIndex = rowEl ? Number(rowEl.getAttribute("data-row-index") ?? 0) : 0;
      const pageIdAttr = rowEl?.getAttribute("data-page-id") ?? page.id;
      // Build the layer key from pageId + rowIndex + layerKind
      const key = `layer:${pageIdAttr}:${rowIndex}:${layerKind}`;
      return { kind: "layer", key, pageId: page.id, rowIndex, layerKind };
    }
    // Fallback: find the row div and default to arabic layer
    const rowEl = target.closest<HTMLElement>("[data-row-index]");
    if (rowEl) {
      const rowIndex = Number(rowEl.getAttribute("data-row-index") ?? 0);
      const pageIdAttr = rowEl.getAttribute("data-page-id") ?? page.id;
      const key = `layer:${pageIdAttr}:${rowIndex}:arabic`;
      return { kind: "layer", key, pageId: page.id, rowIndex, layerKind: "arabic" };
    }
    return null;
  };

  // Drag-to-move (single delegated pointer handler)
  const dragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    el: HTMLElement;
    baseTransform: string;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editMode) return;
    if (e.button !== 0) return;
    // In Type Tool mode: find the specific layer (arabic/bangla) that was clicked
    if (isTypeTool) {
      const t = readLayerTarget(e);
      if (t) setSelection(t);
      return;
    }
    const t = readTarget(e);
    if (!t) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(`[data-sel-key="${CSS.escape(t.key)}"]`);
    if (!el) return;
    setSelection(t);
    const ov = useOverridesStore.getState().local[t.key];
    dragRef.current = {
      key: t.key,
      startX: e.clientX,
      startY: e.clientY,
      baseDx: ov?.dx ?? 0,
      baseDy: ov?.dy ?? 0,
      el,
      baseTransform: el.style.transform,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (editMode) {
      const t = readTarget(e);
      if (!dragRef.current) setHover(t);
    }
    const d = dragRef.current;
    if (!d) return;
    const ddx = (e.clientX - d.startX) / zoom;
    const ddy = (e.clientY - d.startY) / zoom;
    const nx = d.baseDx + ddx;
    const ny = d.baseDy + ddy;
    if (!d.moved && (Math.abs(ddx) > 1 || Math.abs(ddy) > 1)) {
      d.moved = true;
      setIsDragging(true);
    }
    // Apply directly to DOM for buttery dragging — commit on pointerup.
    // Additive: append a translate() on top of the element's existing transform.
    d.el.style.transform = `${d.baseTransform} translate(${ddx}px, ${ddy}px)`;
    void nx; void ny;
  };



  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setIsDragging(false);
    const ddx = (e.clientX - d.startX) / zoom;
    const ddy = (e.clientY - d.startY) / zoom;
    if (!d.moved) {
      d.el.style.transform = d.baseTransform;
      return;
    }

    const scope = useEditorStore.getState().scope;

    if (scope === "general" && d.key.startsWith("layer:")) {
      const parts = d.key.split(":"); // layer:pageId:rowIndex:layerKind
      const rowIndex = parseInt(parts[2] || "-1");
      const layerKind = parts[3] as "symbol" | "arabic" | "bangla";
      
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (rowIndex !== -1 && boardRect) {
        const boardY = (e.clientY - boardRect.top) / zoom;
        let targetIndex = -1;
        let minDiff = Infinity;
        
        for (let i = 0; i < 9; i++) {
           const L = gridLayoutPx[i];
           if (!L) continue;
           const rowCenter = gridTopPx + L.sy + (L.symH + L.arH + L.bnH) / 2;
           const diff = Math.abs(boardY - rowCenter);
           if (diff < minDiff) {
              minDiff = diff;
              targetIndex = i;
           }
        }
        
        const rowH = gridLayoutPx[0]?.symH! + gridLayoutPx[0]?.arH! + gridLayoutPx[0]?.bnH!;
        if (targetIndex !== -1 && targetIndex !== rowIndex && Math.abs(ddy) > rowH * 0.4) {
           const targetLk = layerKey(parts[1]!, targetIndex, layerKind);
           const store = useOverridesStore.getState();
           
           // We need to fetch the current text for both rows.
           // Artboard doesn't have direct access to slots array here, but slots is calculated in component.
           // But actually we can just read from overridesStore. If not there, we can't easily read page.lines without find.
           // Wait, page object is available in Artboard scope!
           const pageLines = page.lines;
           const currentText = store.local[d.key]?.text ?? (pageLines[rowIndex] as any)?.[layerKind === "symbol" ? "markers" : layerKind + "Line"] ?? "";
           const targetText = store.local[targetLk]?.text ?? (pageLines[targetIndex] as any)?.[layerKind === "symbol" ? "markers" : layerKind + "Line"] ?? "";
           
           store.patchLocal(targetLk, { text: typeof currentText === "string" ? currentText : currentText.join("  "), dy: 0, dx: 0 });
           store.patchLocal(d.key, { text: typeof targetText === "string" ? targetText : targetText.join("  "), dy: 0, dx: 0 });
           return;
        }
      }
    }

    if (scope === "general") {
      patchLocal(d.key, { dx: d.baseDx + ddx, dy: d.baseDy + ddy });
    } else {
      import("@/state/overridesStore").then(async ({ patchScoped, effectiveScope }) => {
        const parts = d.key.split(":");
        const layerKind = parts[3] as "symbol" | "arabic" | "bangla";
        const eff = await effectiveScope(scope, layerKind);
        await patchScoped(d.key, { dx: d.baseDx + ddx, dy: d.baseDy + ddy }, eff);
      });
    }
  };

  return (
    <div
      id="quran-artboard"
      ref={boardRef}
      data-artboard="true"
      data-page-num={page.id.replace(/^vpage-/, "")}
      className="relative mx-auto bg-white shadow-2xl"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseLeave={() => editMode && !dragRef.current && setHover(null)}
      onClick={(e) => {
        if (!editMode) return;
        if (isDragging) return;
        // Type Tool: selection is already handled by onPointerDown.
        // Don't let onClick overwrite (or clear) the selection that was just set.
        if (isTypeTool) return;
        const t = readTarget(e);
        setSelection(t);
      }}
      onDoubleClick={(e) => {
        if (!editMode) return;
        // Double-click: switch to Type Tool and select the specific layer clicked
        const t = readLayerTarget(e);
        if (t) {
          setActiveTool("type");
          setSelection(t);
        }
      }}
      onContextMenu={(e) => {
        if (!editMode) {
          e.preventDefault();
          alert("টেক্সট কপি বা এডিট করতে চাইলে উপরের 'এডিটর' ট্যাবে ক্লিক করে এডিটিং মোড চালু করুন।");
        }
      }}
      style={{
        width: tmpl.pageGeometry.displayW,
        height: displayH,
        backgroundImage: "var(--page-bg)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#ffffff",
        cursor: isTypeTool ? "text" : editMode ? "crosshair" : "default",
        userSelect: editMode ? "auto" : "none",
        WebkitUserSelect: editMode ? "auto" : "none",
      }}
    >
      {/* Kariana 3-cell header (sits inside the SVG's top yellow band) */}
      <div
        style={{
          position: "absolute",
          left: gridLeftPx,
          top: headerTopPx,
          width: gridWPx,
          height: headerHPx,
        }}
      >
        <SlimHeader para={headerLeft} title={headerCenter} chapter={headerRight} />
      </div>

      {/* Arched bismillah header overlay for surah-open pages (first 3 lines) */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            left: gridLeftPx,
            top: gridTopPx,
            width: gridWPx,
            height: gridLayoutPx[2].by + gridLayoutPx[2].bnH,
            pointerEvents: "none",
          }}
        >
          <ArchedHeader
            surahName={page.surahName}
            revelation={page.revelation}
            ayah={page.ayah}
            ruku={page.ruku}
          />
          <BismillahBox arabic={page.bismillahArabic} bangla={page.bismillahBangla} />
        </div>
      )}

      {/* Fabric.js justified line grid */}
      <div
        style={{
          position: "absolute",
          left: gridLeftPx,
          top: gridTopPx,
          width: gridWPx,
          height: gridHPx,
        }}
      >
        <FabricLines
          width={gridWPx}
          height={gridHPx}
          layout={gridLayoutPx}
          lines={slots}
          arabicFamily={activeFamily}
          skip={startAt}
          skipSlots={skipSlots}
          pageId={page.id}
        />

        {/* Inline surah-open SVG blocks (span 2 line bands each) */}
        {inlineSurahOpens.map(({ index, data }) => {
          const top = gridLayoutPx[index].sy;
          const next = gridLayoutPx[Math.min(index + 1, gridLayoutPx.length - 1)];
          const bottom = next.by + next.bnH;
          return (
            <div
              key={`so-${index}`}
              style={{
                position: "absolute",
                left: 0,
                top,
                width: gridWPx,
                height: bottom - top,
              }}
            >
              <SurahOpenBlock
                surahName={data.surahName}
                revelation={data.revelation}
                ayah={data.ayah}
                ruku={data.ruku}
                bismillahArabic={data.bismillahArabic}
                bismillahBangla={data.bismillahBangla}
                width={gridWPx}
                height={bottom - top}
                arabicFamily={activeFamily}
              />
            </div>
          );
        })}
      </div>

      {/* Kariana 5-cell footer (inside last yellow band) */}
      <div
        style={{
          position: "absolute",
          left: gridLeftPx,
          top: footerTopPx,
          width: gridWPx,
          height: footerHPx,
        }}
      >
        <SlimFooter data={page.footer} />
      </div>

      {/* Guides overlay — baselines for each row band */}
      {showGuides && (
        <svg
          width={tmpl.pageGeometry.displayW}
          height={displayH}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {gridLayoutPx.map((L, i) => {
            const y = gridTopPx + L.sy;
            const h = L.symH + L.arH + L.bnH;
            return (
              <g key={`g-${i}`} stroke="#0ea5e9" strokeDasharray="3 3" opacity={0.55}>
                <line x1={gridLeftPx} y1={y} x2={gridLeftPx + gridWPx} y2={y} />
                <line x1={gridLeftPx} y1={y + L.symH} x2={gridLeftPx + gridWPx} y2={y + L.symH} strokeDasharray="1 2" />
                <line x1={gridLeftPx} y1={y + L.symH + L.arH} x2={gridLeftPx + gridWPx} y2={y + L.symH + L.arH} strokeDasharray="1 2" />
                <line x1={gridLeftPx} y1={y + h} x2={gridLeftPx + gridWPx} y2={y + h} />
              </g>
            );
          })}
        </svg>
      )}

      {/* Hover outline */}
      {editMode && hoverRect && (
        <div
          style={{
            position: "absolute",
            left: hoverRect.x - 2,
            top: hoverRect.y - 2,
            width: hoverRect.width + 4,
            height: hoverRect.height + 4,
            border: `1.5px dashed ${selColor}`,
            borderRadius: 3,
            pointerEvents: "none",
            opacity: 0.6,
          }}
        />
      )}

      {/* Selection outlines — single in general mode, multi when scoped layer link is ON */}
      {editMode && selRects.map(({ key, rect, primary }) => (
        <div
          key={`sel-${key}`}
          style={{
            position: "absolute",
            left: rect.x - 2,
            top: rect.y - 2,
            width: rect.width + 4,
            height: rect.height + 4,
            border: `${primary ? 2 : 1.5}px solid ${selColor}`,
            borderRadius: 3,
            background: primary ? "transparent" : `${selColor}10`,
            boxShadow: primary ? `0 0 0 3px ${selColor}22, 0 0 12px ${selColor}30` : `0 0 0 2px ${selColor}12`,
            pointerEvents: "none",
            opacity: primary ? 1 : 0.82,
          }}
        />
      ))}

      {/* Page/Surah/Para/Global scope highlight — full canvas border */}
      {showPageHighlight && (
        <div
          style={{
            position: "absolute",
            inset: -3,
            border: `2.5px solid ${selColor}`,
            borderRadius: 4,
            boxShadow: `0 0 0 1px ${selColor}40, 0 0 24px ${selColor}25`,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          {/* Scope badge */}
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{
              background: selColor,
              color: "#0a0a0a",
              whiteSpace: "nowrap",
            }}
          >
            {scope === "page" ? "পেজ সিলেক্ট" :
             scope === "surah" ? "সূরা সিলেক্ট" :
             scope === "para" ? "পারা সিলেক্ট" : "সব সিলেক্ট"}
          </div>
        </div>
      )}
    </div>
  );
});
