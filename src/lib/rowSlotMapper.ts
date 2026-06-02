import type { PageData } from "@/data/pages";
import type { LayerKind } from "@/lib/textReflow";

export type StoryLayer = Extract<LayerKind, "arabic" | "bangla">;

export type RowSlotType = "ayah" | "reserved" | "blank" | "surah-open";

export type RowSlotInfo = {
  pageId: string;
  rowIndex: number;
  layer: StoryLayer;
  slotType: RowSlotType;
  isValidSlot: boolean;
  text: string;
  slotHeightPx?: number;
};

export type SlotDeltaPlan = {
  action: "none" | "inject" | "remove" | "redistribute";
  currentSlots: number;
  requiredRows: number;
  extraRowsNeeded: number;
  removableRows: number;
  reason: string;
};

export type RowSlotLayout = Array<{ arH?: number; bnH?: number }>;

function getLayerText(line: PageData["lines"][number] | undefined, layer: StoryLayer): string {
  if (!line || line.slotKind === "blank" || line.slotKind === "surah-open") return "";
  if (layer === "arabic") return line.arabicLine ?? line.blocks.map((b) => b.arabic).join(" ");
  return line.banglaLine ?? line.blocks.map((b) => b.bangla).filter(Boolean).join(" ");
}

function resolveSlotType(page: PageData, rowIndex: number): RowSlotType {
  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? 3 : 0;

  if (rowIndex < startAt) return "reserved";

  const lineIndex = rowIndex - startAt;
  const line = page.lines[lineIndex];

  if (!line) return "blank";
  if (line.slotKind === "surah-open") return "surah-open";
  if (line.slotKind === "blank") return "blank";
  return "ayah";
}

export function isReservedSlot(page: PageData, rowIndex: number): boolean {
  const slotType = resolveSlotType(page, rowIndex);
  return slotType === "reserved" || slotType === "surah-open" || slotType === "blank";
}

export function getRowSlots(page: PageData, layer: StoryLayer, layout?: RowSlotLayout): RowSlotInfo[] {
  const isOpen = page.type === "surah-open";
  const startAt = isOpen ? 3 : 0;

  return Array.from({ length: 9 }, (_, rowIndex) => {
    const slotType = resolveSlotType(page, rowIndex);
    const lineIndex = rowIndex - startAt;
    const line = lineIndex >= 0 ? page.lines[lineIndex] : undefined;

    return {
      pageId: page.id,
      rowIndex,
      layer,
      slotType,
      isValidSlot: slotType === "ayah" || slotType === "blank",
      text: getLayerText(line, layer),
      slotHeightPx: layer === "arabic" ? layout?.[rowIndex]?.arH : layout?.[rowIndex]?.bnH,
    };
  });
}

export function getValidTextSlots(page: PageData, layer: StoryLayer, layout?: RowSlotLayout): RowSlotInfo[] {
  return getRowSlots(page, layer, layout).filter((slot) => slot.isValidSlot);
}

export function getValidTextSlotsForPages(
  pages: PageData[],
  pageIds: string[],
  layer: StoryLayer,
  layout?: RowSlotLayout,
): RowSlotInfo[] {
  const pageSet = new Set(pageIds);
  return pages.flatMap((page) => (pageSet.has(page.id) ? getValidTextSlots(page, layer, layout) : []));
}

export function computeSlotDelta(currentSlots: number, requiredRows: number): SlotDeltaPlan {
  const extraRowsNeeded = Math.max(0, requiredRows - currentSlots);
  const removableRows = Math.max(0, currentSlots - requiredRows);
  if (extraRowsNeeded > 0) {
    return {
      action: "inject",
      currentSlots,
      requiredRows,
      extraRowsNeeded,
      removableRows: 0,
      reason: "নির্বাচিত scope-এর slot-এর চেয়ে বেশি text row দরকার।",
    };
  }
  if (removableRows >= 9) {
    return {
      action: "remove",
      currentSlots,
      requiredRows,
      extraRowsNeeded: 0,
      removableRows,
      reason: "Text কমেছে; এক বা একাধিক empty page remove করা যেতে পারে।",
    };
  }
  if (removableRows > 0) {
    return {
      action: "redistribute",
      currentSlots,
      requiredRows,
      extraRowsNeeded: 0,
      removableRows,
      reason: "Text কমেছে; existing scope-এর মধ্যে redistribute হবে।",
    };
  }
  return {
    action: "none",
    currentSlots,
    requiredRows,
    extraRowsNeeded: 0,
    removableRows: 0,
    reason: "Slot count যথেষ্ট।",
  };
}
