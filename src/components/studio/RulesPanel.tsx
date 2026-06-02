import { useState } from "react";
import { BookOpen, X, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TAJWEED_RULE_NAMES, TAJWEED_CHAR, SYMBOL_SUB_RULES, ALL_RULE_IDS, type TopSymbolId } from "@/tajweed/fontCharMap";
import { useTajweedRules } from "@/context/TajweedRulesContext";
import { useOverridesStore } from "@/state/overridesStore";
import { SlidersIcon, RotateIcon, BookIcon } from "@/components/ui/icons";
import { Group, DSlider } from "./PropertiesPanel";
import { useTypographyPatch } from "@/hooks/useTypographyPatch";

export function RulesPanel() {
  const { isEnabled, setEnabled, setAll } = useTajweedRules();
  const [preview, setPreview] = useState<TopSymbolId | null>(null);
  const { applyTypography } = useTypographyPatch();

  return (
    <div className="flex flex-col gap-4">
      <Group title="প্রতীক (ওয়াই অফসেট)" icon={BookIcon} color="#f59e0b">
        <DSlider k="symbolYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color="#f59e0b" applyTypography={applyTypography} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <div>
        <div className="mb-3 flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
          <BookOpen className="h-3 w-3" />
          তাজবিদ রুলস (১২)
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setAll(true)}
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] hover:bg-neutral-700"
          >
            সব চালু
          </button>
          <button
            onClick={() => setAll(false)}
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] hover:bg-neutral-700"
          >
            সব বন্ধ
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {ALL_RULE_IDS.map((id) => (
          <RuleItem key={id} id={id} setPreview={setPreview} />
        ))}
      </ul>

      {preview !== null && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] max-w-[80vw] rounded-lg bg-white p-6 shadow-xl"
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute right-2 top-2 rounded p-1 text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
            <span
              className="tajweed-icon mx-auto block text-neutral-900"
              style={{ fontSize: "min(60vh, 60vw)", lineHeight: 1, textAlign: "center" }}
              aria-label={`Rule ${preview}`}
            >{TAJWEED_CHAR[preview]}</span>
            <div className="mt-3 text-center text-sm font-semibold text-neutral-800">
              রুল {preview} — {TAJWEED_RULE_NAMES[preview]}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function SubRuleEditor({ symbolId, subRules }: { symbolId: TopSymbolId; subRules: any[] }) {
  const globalSubRuleDx = useOverridesStore(s => s.globalSubRuleDx);
  const setSubRuleDx = useOverridesStore(s => s.setSubRuleDx);

  if (!subRules || subRules.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 pt-2 pb-1 px-1">
      {subRules.map(rule => {
        if (rule.isCancellation) return null;

        const key = `subDx:${symbolId}:${rule.id}`;
        const dx = globalSubRuleDx[key] ?? 0;

        return (
          <div key={rule.id} className="flex flex-col gap-1.5 bg-neutral-900/50 p-2 rounded border border-neutral-800/50">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold rounded px-1.5 py-0.5 bg-neutral-800 text-neutral-300">{rule.id}</span>
                <span className="text-[10px] text-neutral-400">{rule.labelBn}</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={dx}
                  onChange={e => setSubRuleDx(symbolId, rule.id, Number(e.target.value) || 0)}
                  className="w-10 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-[10px] text-right font-mono outline-none focus:border-amber-500"
                  style={{ color: dx !== 0 ? "#f59e0b" : "#737373" }}
                  step={1} min={-20} max={20}
                />
                {dx !== 0 && (
                  <button onClick={() => setSubRuleDx(symbolId, rule.id, 0)} className="text-neutral-500 hover:text-amber-400 ml-0.5">
                    <RotateIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <input
              type="range" min={-20} max={20} step={1} value={dx}
              onChange={e => setSubRuleDx(symbolId, rule.id, Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "#f59e0b", background: dx !== 0 ? `linear-gradient(to right, #f59e0b ${((dx - -20) / (20 - -20)) * 100}%, #262626 0%)` : "#262626" }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all ${
        on 
          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/50" 
          : "bg-neutral-800/50 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-400 ring-1 ring-neutral-700/50"
      }`}
      title={on ? "দেখান" : "লুকান"}
      aria-pressed={on}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </button>
  );
}

function RuleItem({ id, setPreview }: { id: TopSymbolId; setPreview: (id: TopSymbolId | null) => void }) {
  const { isEnabled, setEnabled } = useTajweedRules();
  const on = isEnabled(id);
  const [expanded, setExpanded] = useState(false);
  const subRules = SYMBOL_SUB_RULES[id] ?? [];
  const hasSubRules = subRules.length > 0;

  return (
    <li className="flex flex-col gap-0 rounded border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      {/* Row 1: symbol preview + name + on/off toggle + expand */}
      <div className="flex items-center gap-2 p-1.5">
        <button
          onClick={() => setPreview(id)}
          title="বড় করে দেখুন"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white p-1 hover:ring-1 hover:ring-amber-400"
        >
          <span className="tajweed-icon text-neutral-900" style={{ fontSize: 28, lineHeight: 1 }} aria-label={`Rule ${id}`}>{TAJWEED_CHAR[id]}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-neutral-200">
            রুল {id}
          </div>
          <div className="truncate text-[10px] text-neutral-400">
            {TAJWEED_RULE_NAMES[id]}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Toggle on={on} onChange={(v) => setEnabled(id, v)} />
          {hasSubRules && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-800/50 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
              title={expanded ? "গুটিয়ে নিন" : "বিস্তারিত দেখুন"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {/* Expanded Details */}
      {expanded && hasSubRules && (
        <div className="border-t border-neutral-800/50 bg-neutral-900/30 p-1.5">
          <SubRuleEditor symbolId={id} subRules={subRules} />
        </div>
      )}
    </li>
  );
}


