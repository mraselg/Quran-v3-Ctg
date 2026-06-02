import { useCallback, useMemo, useState } from "react";

import { useFont } from "@/context/FontContext";
import type { SelectionScope } from "@/state/editorStore";
import type { ActiveLayerKind } from "@/state/editorStore";
import type { LocalOverride } from "@/state/overridesStore";
import { useOverridesStore, layerKey } from "@/state/overridesStore";
import {
  getArtboardTextWidth,
  DEFAULT_BANGLA_FONT_FAMILY,
  countTypographyTargets,
  patchTypographyScoped,
  type TypographyReflowContext,
} from "@/lib/typographyReflow";
import { resolveTargetPageIds } from "@/lib/scopeTargets";
import { detectTypographyOverflow } from "@/lib/overflowDetector";
import type { OverflowReflowDialogProps } from "@/components/studio/OverflowReflowDialog";
import { useLargeChangeGuard } from "./useLargeChangeGuard";
import { useReflowStore } from "@/state/reflowStore";

/**
 * Typography patch + reflow with large-change guard AND overflow detection.
 * Mounts both:
 *   - `ScopeImpactWarningDialog` (via dialogProps) for large row counts
 *   - `OverflowReflowDialog` (via overflowDialogProps) for cross-page overflow
 *
 * Always mount both dialogs once:
 *   <ScopeImpactWarningDialog {...dialogProps} />
 *   <OverflowReflowDialog {...overflowDialogProps} />
 */
export function useTypographyPatch() {
  const { activeFamily } = useFont();
  const { request, dialogProps } = useLargeChangeGuard();

  // Overflow dialog state
  const [overflowDialog, setOverflowDialog] = useState<{
    open: boolean;
    layerKind: "arabic" | "bangla" | "both";
    scope: SelectionScope;
    affectedPageCount: number;
    overflowRowCount: number;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    open: false,
    layerKind: "arabic",
    scope: "general",
    affectedPageCount: 0,
    overflowRowCount: 0,
    onConfirm: () => {},
    onCancel: () => {},
  });

  const ctx: TypographyReflowContext = useMemo(
    () => ({
      arabicFontFamily: activeFamily,
      banglaFontFamily: DEFAULT_BANGLA_FONT_FAMILY,
      availableWidth: getArtboardTextWidth(),
    }),
    [activeFamily],
  );

  const applyTypography = useCallback(
    (
      representativeKey: string,
      patch: Partial<Record<keyof LocalOverride, LocalOverride[keyof LocalOverride] | undefined>>,
      scope: SelectionScope,
      layer: ActiveLayerKind,
    ) => {
      void (async () => {
        const estimatedRows = await countTypographyTargets(representativeKey, scope, layer);

        // Check for overflow before applying (only for typography fields & linked layers)
        const isTypoField = Object.keys(patch).some((k) =>
          ["fontPx", "leading", "tracking", "hScale"].includes(k)
        );

        // Only do overflow detection for non-general scopes with a real layer
        const shouldDetectOverflow =
          isTypoField &&
          layer !== null &&
          layer !== "symbol" &&
          scope !== "general";

        if (shouldDetectOverflow) {
          const { pages, distribution } = useReflowStore.getState();
          const localMap = useOverridesStore.getState().local;
          const parsed = representativeKey.split(":");
          const pageId = parsed[1] ?? "";
          const effectiveLayer = (layer === "arabic" || layer === "bangla") ? layer : "arabic";

          const scopedPageIds = resolveTargetPageIds(scope, pageId, pages, distribution);
          const globalFontPx = effectiveLayer === "arabic"
            ? (useOverridesStore.getState().global.arabicFontPx ?? 50)
            : (useOverridesStore.getState().global.banglaFontPx ?? 18);

          const overflowResult = detectTypographyOverflow(
            scopedPageIds,
            effectiveLayer,
            patch as Partial<LocalOverride>,
            pages,
            localMap,
            (pid, ri, lyr) => layerKey(pid, ri, lyr as "arabic" | "bangla" | "symbol"),
            effectiveLayer === "arabic" ? activeFamily : DEFAULT_BANGLA_FONT_FAMILY,
            typeof patch.fontPx === "number" ? patch.fontPx : globalFontPx,
            getArtboardTextWidth(),
          );

          if (overflowResult.hasOverflow) {
            // Show the overflow confirmation dialog
            setOverflowDialog({
              open: true,
              layerKind: effectiveLayer,
              scope,
              affectedPageCount: overflowResult.affectedPageIds.length,
              overflowRowCount: overflowResult.overflowRowCount,
              onConfirm: () => {
                setOverflowDialog((d) => ({ ...d, open: false }));
                // Apply with the large-change guard
                request({
                  scope,
                  estimatedRows: Math.max(1, estimatedRows),
                  label: "টাইপোগ্রাফি রিফ্লো প্রয়োগ হচ্ছে…",
                  action: () => patchTypographyScoped(representativeKey, patch, scope, ctx, layer),
                });
              },
              onCancel: () => {
                setOverflowDialog((d) => ({ ...d, open: false }));
              },
            });
            return; // Don't proceed until user confirms
          }
        }

        // No overflow — proceed with large-change guard directly
        request({
          scope,
          estimatedRows: Math.max(1, estimatedRows),
          label: "টাইপোগ্রাফি রিফ্লো প্রয়োগ হচ্ছে…",
          action: () => patchTypographyScoped(representativeKey, patch, scope, ctx, layer),
        });
      })();
    },
    [activeFamily, ctx, request],
  );

  const overflowDialogProps: OverflowReflowDialogProps = {
    open: overflowDialog.open,
    layerKind: overflowDialog.layerKind,
    scope: overflowDialog.scope,
    affectedPageCount: overflowDialog.affectedPageCount,
    overflowRowCount: overflowDialog.overflowRowCount,
    onConfirm: overflowDialog.onConfirm,
    onCancel: overflowDialog.onCancel,
  };

  return { applyTypography, dialogProps, overflowDialogProps, ctx };
}
