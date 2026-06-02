import { useNavigate } from "@tanstack/react-router";
import { useOverridesStore } from "@/state/overridesStore";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function TemplateGoToBuilder() {
  const navigate = useNavigate();
  const hasLocalOverrides = useOverridesStore((s) => Object.keys(s.local).length > 0);

  const handleGoToBuilder = () => {
    if (hasLocalOverrides) {
      // Basic native confirm for now. Later we can do a fancy dialog.
      const confirm = window.confirm(
        "আপনার চলমান কিছু কাজ রয়েছে (লোকাল ওভাররাইড)। আপনি কি এগুলো রেখেই টেমপ্লেট বিল্ডারে যেতে চান? (এতে আপনার ওভাররাইডগুলো হারাতে পারে অথবা লেআউট পরিবর্তন হতে পারে)"
      );
      if (!confirm) return;
    }
    navigate({ to: "/template-builder" });
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-900/30 text-emerald-400 flex items-center justify-center mb-4">
        <LayoutTemplate size={32} />
      </div>
      <h3 className="text-lg font-semibold text-emerald-300 mb-2 font-bangla">টেমপ্লেট বিল্ডার</h3>
      <p className="text-neutral-400 text-sm mb-6 font-bangla leading-relaxed">
        টেমপ্লেটের সকল ডিজাইন, লেআউট, এবং ফন্ট সেটিংস পরিবর্তন করার জন্য টেমপ্লেট বিল্ডারে যান।
      </p>

      {hasLocalOverrides && (
        <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-900/50 p-3 rounded text-left mb-6 w-full">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-amber-200/90 text-[11px] leading-tight font-bangla">
            <strong>সতর্কতা:</strong> আপনার কিছু লোকাল ওভাররাইড (অ্যাডজাস্টমেন্ট) আছে। টেমপ্লেট বিল্ডারে গিয়ে গ্লোবাল পরিবর্তন আনলে এই লেআউট পরিবর্তিত হতে পারে।
          </p>
        </div>
      )}

      <Button
        onClick={handleGoToBuilder}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bangla"
      >
        টেমপ্লেট বিল্ডার খুলুন
      </Button>
    </div>
  );
}
