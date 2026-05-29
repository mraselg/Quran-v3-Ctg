import { useState, useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "@/state/editorStore";
import { useOverridesStore } from "@/state/overridesStore";
import { reflowFrom } from "@/lib/textReflow";
import type { FabricLine } from "./FabricLines";
import { getDomSlots } from "@/lib/textReflow";
import { toast } from "sonner";
import { useLargeChangeGuard } from "@/hooks/useLargeChangeGuard";
import { ScopeImpactWarningDialog } from "./ScopeImpactWarningDialog";
import { useReflowStore } from "@/state/reflowStore";

type UnifiedPageEditorProps = {
  pageId: string;
  layer: "arabic" | "bangla";
  lines: FabricLine[];
  fontFamily: string;
  fontSize: number;
  width: number;
  height: number;
  lineHeight: number;
  align: React.CSSProperties["textAlign"];
  baseline: number;
  onClose: () => void;
};

/**
 * Renders a single contenteditable div covering the entire page grid for the given layer.
 * This provides the "InDesign Text Frame" experience — native browser wrapping, selection,
 * and multi-line editing across the whole page as one unified paragraph.
 */
export function UnifiedPageEditor({
  pageId,
  layer,
  lines,
  fontFamily,
  fontSize,
  width,
  height,
  lineHeight,
  align,
  baseline,
  onClose,
}: UnifiedPageEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [initialText, setInitialText] = useState("");
  const { request, dialogProps } = useLargeChangeGuard();
  const pages = useReflowStore((s) => s.pages);

  // On mount, gather all text for this layer on this page
  useEffect(() => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const slots = getDomSlots(page);
    const combined = slots
      .map((s) => (layer === "arabic" ? s.arabic : s.bangla) ?? "")
      .filter((t) => t.trim().length > 0)
      .join(" ");
    setInitialText(combined);
  }, [pageId, layer, pages]);

  // Focus and select all on mount
  useEffect(() => {
    if (ref.current && initialText) {
      ref.current.innerText = initialText;
      ref.current.focus();
      // Don't select all automatically as it might be annoying, just place cursor at end
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false); // false = end
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [initialText]);

  const commit = useCallback(() => {
    if (!ref.current) return;
    const newText = ref.current.innerText.replace(/\n/g, " ").trim();
    if (newText === initialText.trim()) {
      onClose();
      return;
    }

    const targetPages = pages.slice(pages.findIndex((p) => p.id === pageId));
    if (targetPages.length === 0) {
      onClose();
      return;
    }

    const localMap = useOverridesStore.getState().local;
    const patchLocal = useOverridesStore.getState().patchLocal;
    const scope = useEditorStore.getState().scope;

    // We trigger reflowFrom at row 0 of this page with the entire unified text
    // as "startOverflow" (and empty the current rows to let it fill).
    request({
      scope,
      estimatedRows: 9, // At least the current page
      label: "প্যারাগ্রাফ রিফ্লো হচ্ছে…",
      action: () => {
        // Clear out the current page's slots so reflow fills them fresh
        const slots = getDomSlots(targetPages[0]!);
        for (let i = 0; i < slots.length; i++) {
          patchLocal(`layer:${pageId}:${i}:${layer}`, { text: "" });
        }
        
        // Start cascading the new combined text from row 0
        reflowFrom({
          startPageId: pageId,
          startRowIndex: 0,
          startOverflow: newText,
          layer,
          allPages: targetPages,
          localMap,
          patchLocal,
          layerKeyFn: (pid, ri, lyr) => `layer:${pid}:${ri}:${lyr}`,
          fontFamily,
          fontSize,
          availableWidth: width,
        });
        
        toast.success("প্যারাগ্রাফ রিফ্লো সম্পন্ন হয়েছে");
        onClose();
      },
      onCancel: onClose,
    });
  }, [initialText, pageId, layer, width, fontFamily, fontSize, pages, request, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
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
          top: baseline, // Adjust based on grid
          left: 8,
          width: width - 16, // account for side padding
          height,
          fontFamily,
          fontSize,
          lineHeight: `${lineHeight}px`,
          textAlign: align,
          textAlignLast: align === "justify" ? "justify" : undefined,
          color: layer === "arabic" ? "#f59e0b" : "#34d399", // amber for arabic, emerald for bangla
          background: "rgba(0, 0, 0, 0.5)",
          outline: `2px dashed ${layer === "arabic" ? "#f59e0b" : "#34d399"}`,
          outlineOffset: "4px",
          borderRadius: "4px",
          zIndex: 50,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "hidden", // Native text will flow line by line due to line-height
          paddingTop: Math.max(0, lineHeight * 0.05),
        }}
      />
      <ScopeImpactWarningDialog {...dialogProps} />
    </>
  );
}
