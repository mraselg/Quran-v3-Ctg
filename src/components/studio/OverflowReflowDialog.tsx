/**
 * OverflowReflowDialog
 * --------------------
 * Shown when a typography adjustment (font size, leading, etc.) would cause
 * text to overflow its current page, requiring a cross-page reflow cascade.
 *
 * The user must confirm before the potentially expensive reflow runs.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SelectionScope } from "@/state/editorStore";

const SCOPE_LABEL: Record<SelectionScope, string> = {
  general: "নির্বাচিত সারি",
  page: "পেজ",
  surah: "সূরা",
  para: "পারা",
  global: "সম্পূর্ণ মুসহাফ",
};

export type OverflowReflowDialogProps = {
  open: boolean;
  layerKind: "arabic" | "bangla" | "both";
  scope: SelectionScope;
  affectedPageCount: number;
  overflowRowCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function OverflowReflowDialog({
  open,
  layerKind,
  scope,
  affectedPageCount,
  overflowRowCount,
  onConfirm,
  onCancel,
}: OverflowReflowDialogProps) {
  const layerLabel =
    layerKind === "arabic"
      ? "আরবি"
      : layerKind === "bangla"
      ? "বাংলা"
      : "আরবি ও বাংলা";

  const scopeLabel = SCOPE_LABEL[scope] ?? scope;
  const isLargeScope = scope === "surah" || scope === "para" || scope === "global";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="border-amber-500/30 bg-neutral-950">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
            <span>⚠️</span>
            টেক্সট ওভারফ্লো ডিটেক্ট হয়েছে
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2 text-neutral-300 text-[13px]">
              <p>
                <span className="font-semibold text-amber-300">{layerLabel}</span> লেয়ারে
                টাইপোগ্রাফি পরিবর্তনের কারণে{" "}
                <span className="font-semibold text-cyan-300">{scopeLabel}</span>-এর{" "}
                <span className="font-semibold text-white">{affectedPageCount}</span>টি পেজে
                মোট{" "}
                <span className="font-semibold text-white">{overflowRowCount}</span>টি
                সারির টেক্সট পরবর্তী পেজে যাবে।
              </p>

              {isLargeScope && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-red-300 text-[12px]">
                  ⚠️ এই পরিবর্তন{" "}
                  {scope === "global" ? "সম্পূর্ণ মুসহাফে" : `এই ${scopeLabel}-এর সকল পেজে`}{" "}
                  প্রভাব ফেলবে। বড় রিফ্লো অপারেশন শুরু হবে।
                </div>
              )}

              <p className="text-[11px] text-neutral-500">
                "হ্যাঁ, রিফ্লো করুন" ক্লিক করলে ওভারফ্লো হওয়া টেক্সট পরবর্তী
                পেজে cascade হবে। বাতিল করলে পরিবর্তন প্রত্যাহার হবে।
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            বাতিল
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 text-white hover:bg-amber-500 border-0"
          >
            হ্যাঁ, রিফ্লো করুন
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
