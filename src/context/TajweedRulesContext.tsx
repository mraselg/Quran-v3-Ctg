import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_RULE_IDS, type TopSymbolId } from "@/lib/tajweed/svgMap";
import { useTemplateStore } from "@/state/templateStore";

const STORAGE_KEY = "tajweed:enabledRules";

type EnabledMap = Record<TopSymbolId, boolean>;

type Ctx = {
  enabled: EnabledMap;
  isEnabled: (id: TopSymbolId) => boolean;
  setEnabled: (id: TopSymbolId, on: boolean) => void;
  setAll: (on: boolean) => void;
};

const TajweedCtx = createContext<Ctx | null>(null);

const getDefaultMap = (): EnabledMap => {
  const tmpl = useTemplateStore.getState().getActiveTemplate();
  const config = tmpl.tajweedConfig || {};
  return ALL_RULE_IDS.reduce((acc, id) => {
    acc[id] = config[id]?.enabled ?? (id === 1 || id === 9);
    return acc;
  }, {} as EnabledMap);
};

export function TajweedRulesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<EnabledMap>(getDefaultMap);
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);

  // Re-initialize when the template changes
  useEffect(() => {
    setEnabledState((prev) => {
      const next = getDefaultMap();
      // Only merge if the new defaults are different? No, let's just reset to template defaults
      // but preserve local overrides if they exist in localStorage for this template?
      // For simplicity, just use the template defaults, then merge from local storage.
      return next;
    });
    
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY}:${activeTemplateId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EnabledMap>;
        setEnabledState((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, [activeTemplateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(`${STORAGE_KEY}:${activeTemplateId}`, JSON.stringify(enabled)); } catch { /* ignore */ }
  }, [enabled, activeTemplateId]);

  const setEnabled = useCallback((id: TopSymbolId, on: boolean) => {
    setEnabledState((prev) => ({ ...prev, [id]: on }));
  }, []);

  const setAll = useCallback((on: boolean) => {
    setEnabledState(() => ALL_RULE_IDS.reduce((acc, id) => {
      acc[id] = on; return acc;
    }, {} as EnabledMap));
  }, []);

  const value = useMemo<Ctx>(() => ({
    enabled,
    isEnabled: (id) => enabled[id] === true,
    setEnabled,
    setAll,
  }), [enabled, setEnabled, setAll]);

  return <TajweedCtx.Provider value={value}>{children}</TajweedCtx.Provider>;
}

export function useTajweedRules(): Ctx {
  const ctx = useContext(TajweedCtx);
  if (!ctx) {
    const enabled = getDefaultMap();
    return {
      enabled,
      isEnabled: (id) => enabled[id] === true,
      setEnabled: () => {},
      setAll: () => {},
    };
  }
  return ctx;
}
