import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MasterTemplate } from "@/types/template";
import { KARIANA_TEMPLATE, INDO_PAK_TEMPLATE } from "@/data/defaultTemplate";
import { hydrateTemplateAssets } from "@/lib/templateUtils";

export const BUILT_IN_IDS = new Set([KARIANA_TEMPLATE.id, INDO_PAK_TEMPLATE.id]);

type TemplateState = {
  /** All available templates (built-in + user-created) */
  templates: MasterTemplate[];
  /** ID of the currently active template */
  activeTemplateId: string;

  /** Get the active MasterTemplate object */
  getActiveTemplate: () => MasterTemplate;

  /** Switch to a different template (triggers full rebuild) */
  setActiveTemplate: (id: string) => void;

  /** Save or update a template */
  upsertTemplate: (t: MasterTemplate) => void;

  /** Delete a user-created template (built-in templates cannot be deleted) */
  deleteTemplate: (id: string) => void;

  /** Create a new template as a copy of the currently active one */
  duplicateActiveTemplate: (newName: string) => MasterTemplate;
};

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [KARIANA_TEMPLATE, INDO_PAK_TEMPLATE],
      activeTemplateId: KARIANA_TEMPLATE.id,

      getActiveTemplate: () => {
        const { templates, activeTemplateId } = get();
        return templates.find((t) => t.id === activeTemplateId) ?? KARIANA_TEMPLATE;
      },

      setActiveTemplate: (id) => {
        const template = get().templates.find((t) => t.id === id);
        if (!template) return;
        set({ activeTemplateId: id });
        
        // Apply template-level typography defaults into overridesStore global state
        import("./overridesStore").then(({ useOverridesStore }) => {
          const typo = template.typography;
          useOverridesStore.getState().setGlobal("arabicFontPx", typo.arabicFontPx);
          useOverridesStore.getState().setGlobal("banglaFontPx", typo.banglaFontPx);
          useOverridesStore.getState().setGlobal("arabicYOffset", typo.defaultArabicY ?? 0);
          useOverridesStore.getState().setGlobal("banglaYOffset", typo.defaultBanglaY ?? 0);
          useOverridesStore.getState().setGlobal("symbolYOffset", typo.defaultSymbolY ?? 0);
        });

        // Trigger a full rebuild of pages with the new template
        // Import reflowStore lazily to avoid circular dependency
        import("./reflowStore").then(({ useReflowStore }) => {
          useReflowStore.getState().rebuild();
        });
      },

      upsertTemplate: (t) => {
        set((s) => {
          const idx = s.templates.findIndex((x) => x.id === t.id);
          if (idx >= 0) {
            const next = [...s.templates];
            next[idx] = t;
            return { templates: next };
          }
          return { templates: [...s.templates, t] };
        });
      },

      deleteTemplate: (id) => {
        if (BUILT_IN_IDS.has(id)) return; // protect built-in
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          activeTemplateId:
            s.activeTemplateId === id ? KARIANA_TEMPLATE.id : s.activeTemplateId,
        }));
      },

      duplicateActiveTemplate: (newName) => {
        const src = get().getActiveTemplate();
        const copy: MasterTemplate = {
          ...structuredClone(src),
          id: `custom-${Date.now()}`,
          name: newName,
          createdAt: new Date().toISOString(),
        };
        get().upsertTemplate(copy);
        return copy;
      },
    }),
    {
      name: "studio-templates-v1",
      // Only persist user-created templates; always inject the built-in on load
      merge: (persisted: any, current) => {
        const templates = [
          KARIANA_TEMPLATE,
          INDO_PAK_TEMPLATE,
          ...(persisted.templates ?? []).filter(
            (t: MasterTemplate) => t.id !== KARIANA_TEMPLATE.id && t.id !== INDO_PAK_TEMPLATE.id,
          ),
        ].map(hydrateTemplateAssets);

        return {
          ...current,
          templates,
          activeTemplateId: persisted.activeTemplateId ?? KARIANA_TEMPLATE.id,
        };
      },
    },
  ),
);
