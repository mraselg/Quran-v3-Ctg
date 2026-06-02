import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { SelectionScope } from "@/state/editorStore";
import { useEditorStore } from "@/state/editorStore";
import { beginSilent, endSilent, type HistoryPatch, useHistoryStore } from "@/state/historyStore";
import { useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { reflowLayerText } from "@/lib/textReflow";
import { buildStory, storyToRowPatches, getEffectiveStoryRowText, STORY_ROW_SEPARATOR } from "@/lib/textStory";
import { getValidTextSlotsForPages } from "@/lib/rowSlotMapper";
import type { StoryLayer } from "@/lib/rowSlotMapper";
import { ScopeImpactWarningDialog } from "./ScopeImpactWarningDialog";
import { SlotAllocationDialog } from "./SlotAllocationDialog";
import { useLargeChangeGuard } from "@/hooks/useLargeChangeGuard";
import type { StoryPatchPlan } from "@/lib/textStory";

export type UnifiedStoryEditorProps = {
  anchorPageId: string;
  scope: SelectionScope;
  layer: StoryLayer;
  fontFamily: string;
  fontSize: number;
  width: number;
  height: number;
  lineHeight: number;
  align: React.CSSProperties["textAlign"];
  baseline: number;
  marginTop?: number;
  onClose: () => void;
};

export function UnifiedStoryEditor({
  anchorPageId,
  scope,
  layer,
  fontFamily,
  fontSize,
  width,
  height,
  lineHeight,
  align,
  baseline,
  marginTop = 0,
  onClose,
}: UnifiedStoryEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [initialText, setInitialText] = useState("");
  const [pendingAllocation, setPendingAllocation] = useState<{ plan: StoryPatchPlan; newText: string } | null>(null);
  const { request, dialogProps } = useLargeChangeGuard();
  const pages = useReflowStore((s) => s.pages);
  const distribution = useReflowStore((s) => s.distribution);

  useEffect(() => {
    const story = buildStory(scope, layer, anchorPageId, pages, distribution, useOverridesStore.getState().local);
    setInitialText(story.plainText);
  }, [anchorPageId, distribution, layer, pages, scope]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = initialText;
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [initialText]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const newText = el.innerText.replace(/\r\n/g, "\n").trim();
    if (newText === initialText.trim()) {
      onClose();
      return;
    }

    const local = useOverridesStore.getState().local;
    const story = buildStory(scope, layer, anchorPageId, pages, distribution, local);
    const plan = storyToRowPatches(story, newText);

    if (plan.slotDelta.action === "inject") {
      setPendingAllocation({ plan, newText });
      return;
    }

    executeCommit(plan);
  }, [anchorPageId, distribution, layer, onClose, pages, scope]);

  const executeCommit = useCallback((plan: StoryPatchPlan) => {
    request({
      scope,
      estimatedRows: Math.max(1, plan.rowPatches.length),
      label: "স্টোরি কমিট হচ্ছে…",
      action: () => {
        const store = useOverridesStore.getState();
        const patches: HistoryPatch[] = plan.rowPatches.map((patch) => ({
          field: "text",
          layerKey: patch.key,
          before: patch.beforeText,
          after: patch.text,
        }));

        beginSilent();
        try {
          const batch = plan.rowPatches.map(patch => ({
            key: patch.key,
            patch: { text: patch.text || undefined }
          }));
          store.patchLocalBatch(batch);
        } finally {
          endSilent();
        }

        if (patches.length > 0) {
          useHistoryStore.getState().pushStoryCommit({
            label: `story:${layer}`,
            labelBn: `${layer === "arabic" ? "আরবি" : "বাংলা"} স্টোরি পরিবর্তন`,
            scope,
            pageId: anchorPageId,
            layerKey: plan.rowPatches[0]?.key,
            rowIndex: plan.rowPatches[0]?.rowIndex,
            patches,
          });
        }

        reflowLayerText({
          pageId: anchorPageId,
          rowIndex: plan.story.rowMapping[0]?.rowIndex ?? 0,
          layer,
          reason: "story-commit",
          fontFamily,
          fontSize,
          availableWidth: width,
          scope,
        });
        toast.success("স্টোরি কমিট সম্পন্ন হয়েছে");
        onClose();
      },
      onCancel: onClose,
    });
  }, [anchorPageId, fontFamily, fontSize, layer, onClose, request, scope, width]);

  const handleAddPages = useCallback(() => {
    if (!pendingAllocation) return;
    const { plan, newText } = pendingAllocation;
    const { extraRowsNeeded } = plan.slotDelta;
    
    // Find the last page of the current story scope
    const lastPageId = plan.story.pageIds[plan.story.pageIds.length - 1];
    if (!lastPageId) return;

    const pages = useReflowStore.getState().pages;
    const lastPageIdx = pages.findIndex((p) => p.id === lastPageId);
    if (lastPageIdx < 0 || lastPageIdx + 1 >= pages.length) {
      toast.error("কুরআনের শেষে আর কোনো পেজ নেই!");
      setPendingAllocation(null);
      return;
    }

    const nextPageId = pages[lastPageIdx + 1].id;

    // Shift the Quran starting from the NEXT page
    useReflowStore.getState().shiftQuranForward(nextPageId, extraRowsNeeded);

    // Re-build story manually including the newly shifted pages to capture the overflow text
    const updatedPages = useReflowStore.getState().pages;
    const updatedDist = useReflowStore.getState().distribution;
    const local = useOverridesStore.getState().local;

    // We need to build a story that includes `plan.story.pageIds` PLUS the next pages where we shifted!
    const expandedPageIds = [...plan.story.pageIds];
    const pagesToInclude = Math.ceil(extraRowsNeeded / 9);
    for (let i = 0; i < pagesToInclude; i++) {
       const p = updatedPages[lastPageIdx + 1 + i];
       if (p) expandedPageIds.push(p.id);
    }

    // Now manually construct a story with expandedPageIds
    // Removed require, using statically imported functions
    
    const slots = getValidTextSlotsForPages(updatedPages, expandedPageIds, layer);
    const rows = slots.map((slot: any) => getEffectiveStoryRowText(slot.pageId, slot.rowIndex, layer, slot.text, local).trim());
    const rowMapping: any[] = [];
    let offset = 0;
    slots.forEach((slot: any, index: number) => {
      const text = rows[index] ?? "";
      const start = offset;
      const end = start + text.length;
      rowMapping.push({ pageId: slot.pageId, rowIndex: slot.rowIndex, layer, start, end, text });
      offset = end + STORY_ROW_SEPARATOR.length;
    });

    const expandedStory = { ...plan.story, pageIds: expandedPageIds, rowMapping, totalSlots: slots.length };
    const newPlan = storyToRowPatches(expandedStory, newText);

    setPendingAllocation(null);
    executeCommit(newPlan);
  }, [pendingAllocation, scope, layer, anchorPageId, executeCommit]);

  const handleClip = useCallback(() => {
    if (!pendingAllocation) return;
    const { plan, newText } = pendingAllocation;
    // Just commit what we can fit, clipping the rest. The rowPatches already drops overflow text.
    setPendingAllocation(null);
    executeCommit(plan);
  }, [pendingAllocation, executeCommit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      commit();
    }
  };

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir={layer === "arabic" ? "rtl" : "ltr"}
        lang={layer === "arabic" ? "ar" : "bn"}
        spellCheck={false}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{
          position: "absolute",
          top: baseline,
          left: 8,
          width: width - 16,
          height,
          fontFamily,
          fontSize,
          lineHeight: `${lineHeight}px`,
          textAlign: align,
          textAlignLast: align === "justify" ? "justify" : undefined,
          color: layer === "arabic" ? "#f59e0b" : "#34d399",
          background: "rgba(0, 0, 0, 0.5)",
          outline: `2px dashed ${layer === "arabic" ? "#f59e0b" : "#34d399"}`,
          outlineOffset: "4px",
          borderRadius: "4px",
          zIndex: 50,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "hidden",
          paddingTop: 0,
          marginTop: `${marginTop}px`,
        }}
      />
      <div
        className="absolute left-2 top-2 z-[51] rounded px-2 py-1 text-[10px] font-bold"
        style={{ background: layer === "arabic" ? "#f59e0b" : "#34d399", color: "#111827" }}
      >
        {scope} · {layer === "arabic" ? "আরবি" : "বাংলা"} · Ctrl+Enter commit
      </div>
      <ScopeImpactWarningDialog {...dialogProps} />
      <SlotAllocationDialog
        open={pendingAllocation !== null}
        extraRowsNeeded={pendingAllocation?.plan.slotDelta.extraRowsNeeded}
        onAddPages={handleAddPages}
        onClip={handleClip}
        onCancel={() => setPendingAllocation(null)}
      />
    </>
  );
}
