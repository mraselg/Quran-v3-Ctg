import { useState, useCallback } from "react";
import { toast } from "sonner";

import { useReflowStore } from "@/state/reflowStore";
import type { SelectionScope } from "@/state/editorStore";
import type { ScopeImpactWarningDialogProps } from "@/components/studio/ScopeImpactWarningDialog";

export type GuardOptions = {
  scope: SelectionScope;
  estimatedRows: number;
  /** Threshold above which the dialog is shown. Default 20. */
  threshold?: number;
  /** Run the actual work. May be async. */
  action: () => void | Promise<void>;
  /** Optional progress label (Bengali). */
  label?: string;
  /** Optional callback if the user cancels the dialog. */
  onCancel?: () => void;
};

type Pending = {
  scope: SelectionScope;
  estimatedRows: number;
  label: string;
  action: () => void | Promise<void>;
  onCancel?: () => void;
};

const DEFAULT_THRESHOLD = 20;

/**
 * Gates an action behind a Bengali warning dialog when scope is surah/para/global
 * OR when estimated affected rows exceed the threshold. While the action
 * runs, populates `useReflowStore.buildProgress` so the existing progress UI
 * surfaces a bar.
 */
export function useLargeChangeGuard(): {
  request: (opts: GuardOptions) => void;
  dialogProps: ScopeImpactWarningDialogProps;
} {
  const [pending, setPending] = useState<Pending | null>(null);

  const run = useCallback(async (p: Pending) => {
    const toastId = toast.loading(p.label || "পরিবর্তন প্রয়োগ হচ্ছে…");
    // Yield once so the UI can paint the toast before sync work.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      await p.action();
      toast.success("পরিবর্তন সম্পন্ন হয়েছে", { id: toastId });
    } catch (err) {
      console.error("[useLargeChangeGuard] action failed", err);
      toast.error("পরিবর্তন প্রয়োগে ত্রুটি হয়েছে", { id: toastId });
    }
  }, []);

  const request = useCallback(
    (opts: GuardOptions) => {
      const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
      const label = opts.label ?? "পরিবর্তন প্রয়োগ হচ্ছে…";
      const requiresDialog =
        opts.scope === "surah" ||
        opts.scope === "para" ||
        opts.scope === "global" ||
        opts.estimatedRows >= threshold;

      const p: Pending = {
        scope: opts.scope,
        estimatedRows: opts.estimatedRows,
        label,
        action: opts.action,
        onCancel: opts.onCancel,
      };

      if (!requiresDialog) {
        // Run inline without progress UI for small changes.
        void Promise.resolve(opts.action()).catch((err) => {
          console.error("[useLargeChangeGuard] inline action failed", err);
          toast.error("পরিবর্তন প্রয়োগে ত্রুটি হয়েছে");
        });
        return;
      }
      setPending(p);
    },
    [],
  );

  const dialogProps: ScopeImpactWarningDialogProps = {
    open: pending !== null,
    scope: pending?.scope ?? "general",
    affectedRows: pending?.estimatedRows ?? 0,
    onConfirm: () => {
      const p = pending;
      setPending(null);
      if (p) void run(p);
    },
    onCancel: () => {
      const p = pending;
      setPending(null);
      if (p?.onCancel) p.onCancel();
    },
  };

  return { request, dialogProps };
}
