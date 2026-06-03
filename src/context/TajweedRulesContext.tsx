import { createContext, useCallback, useContext, useState, useMemo, type ReactNode } from "react";
import { ALL_RULE_IDS, type TopSymbolId } from "@/lib/tajweed/svgMap";
import { useTemplateStore, BUILT_IN_IDS } from "@/state/templateStore";
import { DEFAULT_RULE_COLORS } from "@/data/defaultTemplate"; // We will add this

type EnabledMap = Record<TopSymbolId, boolean>;

type Ctx = {
  enabled: EnabledMap;
  colors: Record<number, string>;
  isEnabled: (id: TopSymbolId) => boolean;
  getColor: (id: TopSymbolId) => string;
  setEnabled: (id: TopSymbolId, on: boolean) => void;
  setAll: (on: boolean) => void;
  setColor: (id: TopSymbolId, hex: string) => void;
};

const TajweedCtx = createContext<Ctx | null>(null);

const defaultEnabledMap: EnabledMap = ALL_RULE_IDS.reduce((acc, id) => {
  acc[id] = (id === 1 || id === 9);
  return acc;
}, {} as EnabledMap);

export function TajweedRulesProvider({ children }: { children: ReactNode }) {
  const activeTemplate = useTemplateStore((s) => s.getActiveTemplate());
  const templateConfig = activeTemplate.tajweedConfig;

  // Derive enabled and colors from template config if present
  const [localEnabled, setLocalEnabled] = useState<EnabledMap>(defaultEnabledMap);
  const [localColors, setLocalColors] = useState<Record<number, string>>(DEFAULT_RULE_COLORS);

  // Template config takes precedence over local state
  const enabled = templateConfig
    ? Object.fromEntries(ALL_RULE_IDS.map((id) => [id, templateConfig[id]?.enabled ?? (id === 1 || id === 9)])) as EnabledMap
    : localEnabled;

  const colors = templateConfig
    ? Object.fromEntries(ALL_RULE_IDS.map((id) => [id, templateConfig[id]?.color ?? DEFAULT_RULE_COLORS[id]!])) as Record<number, string>
    : localColors;

  const upsertTemplate = useTemplateStore((s) => s.upsertTemplate);
  const isBuiltIn = BUILT_IN_IDS.has(activeTemplate.id);

  const setEnabled = useCallback((id: TopSymbolId, on: boolean) => {
    if (isBuiltIn) return; // Read-only for built-ins
    const next = structuredClone(activeTemplate);
    next.tajweedConfig = { 
      ...(next.tajweedConfig ?? {}), 
      [id]: { 
        ...(next.tajweedConfig?.[id] ?? { color: DEFAULT_RULE_COLORS[id]! }), 
        enabled: on 
      } 
    };
    upsertTemplate(next);
  }, [activeTemplate, isBuiltIn, upsertTemplate]);

  const setColor = useCallback((id: TopSymbolId, hex: string) => {
    if (isBuiltIn) return;
    const next = structuredClone(activeTemplate);
    next.tajweedConfig = { 
      ...(next.tajweedConfig ?? {}), 
      [id]: { 
        ...(next.tajweedConfig?.[id] ?? { enabled: false }), 
        color: hex 
      } 
    };
    upsertTemplate(next);
  }, [activeTemplate, isBuiltIn, upsertTemplate]);

  const setAll = useCallback((on: boolean) => {
    if (isBuiltIn) return;
    const next = structuredClone(activeTemplate);
    const newConfig = { ...(next.tajweedConfig ?? {}) };
    ALL_RULE_IDS.forEach((id) => {
      newConfig[id] = { ...(newConfig[id] ?? { color: DEFAULT_RULE_COLORS[id]! }), enabled: on };
    });
    next.tajweedConfig = newConfig;
    upsertTemplate(next);
  }, [activeTemplate, isBuiltIn, upsertTemplate]);

  const value = useMemo<Ctx>(() => ({
    enabled,
    colors,
    isEnabled: (id) => enabled[id] === true,
    getColor: (id) => colors[id] ?? DEFAULT_RULE_COLORS[id]!,
    setEnabled,
    setAll,
    setColor,
  }), [enabled, colors, setEnabled, setAll, setColor]);

  return <TajweedCtx.Provider value={value}>{children}</TajweedCtx.Provider>;
}

export function useTajweedRules(): Ctx {
  const ctx = useContext(TajweedCtx);
  if (!ctx) {
    return {
      enabled: defaultEnabledMap,
      colors: DEFAULT_RULE_COLORS,
      isEnabled: (id) => defaultEnabledMap[id] === true,
      getColor: (id) => DEFAULT_RULE_COLORS[id]!,
      setEnabled: () => {},
      setAll: () => {},
      setColor: () => {},
    };
  }
  return ctx;
}
