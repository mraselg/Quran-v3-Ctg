import type { PageData } from "@/data/pages";
import type { SelectionScope } from "@/state/editorStore";
import type { LocalOverride } from "@/state/overridesStore";
import type { PageDistribution } from "@/state/reflowStore";
import { resolveTargetPageIds } from "@/lib/scopeTargets";
import {
  computeSlotDelta,
  getValidTextSlotsForPages,
  type SlotDeltaPlan,
  type StoryLayer,
} from "@/lib/rowSlotMapper";

export type TextStoryRowMapping = {
  pageId: string;
  rowIndex: number;
  layer: StoryLayer;
  start: number;
  end: number;
  text: string;
};

export type TextStory = {
  id: string;
  scope: SelectionScope;
  layer: StoryLayer;
  anchorPageId: string;
  pageIds: string[];
  plainText: string;
  rows: string[];
  rowMapping: TextStoryRowMapping[];
  totalSlots: number;
  usedSlots: number;
};

export type StoryRowPatch = {
  key: string;
  pageId: string;
  rowIndex: number;
  layer: StoryLayer;
  beforeText: string;
  text: string;
};

export type StoryPatchPlan = {
  story: TextStory;
  rowPatches: StoryRowPatch[];
  slotDelta: SlotDeltaPlan;
};

export const STORY_ROW_SEPARATOR = "\n";

function layerKey(pageId: string, rowIndex: number, layer: StoryLayer): string {
  return `layer:${pageId}:${rowIndex}:${layer}`;
}

function normalizeStoryRows(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((row) => row.trim());
}

export function getEffectiveStoryRowText(
  pageId: string,
  rowIndex: number,
  layer: StoryLayer,
  fallbackText: string,
  localOverrides: Record<string, LocalOverride>,
): string {
  return localOverrides[layerKey(pageId, rowIndex, layer)]?.text ?? fallbackText;
}

export function buildStory(
  scope: SelectionScope,
  layer: StoryLayer,
  anchorPageId: string,
  pages: PageData[],
  distribution: PageDistribution[],
  localOverrides: Record<string, LocalOverride>,
): TextStory {
  const pageIds = resolveTargetPageIds(scope, anchorPageId, pages, distribution);
  const slots = getValidTextSlotsForPages(pages, pageIds, layer);
  const rows = slots.map((slot) =>
    getEffectiveStoryRowText(slot.pageId, slot.rowIndex, layer, slot.text, localOverrides).trim(),
  );
  const nonEmptyRowsCount = rows.filter((row) => row.length > 0).length;
  const rowMapping: TextStoryRowMapping[] = [];
  let offset = 0;

  slots.forEach((slot, index) => {
    const text = rows[index] ?? "";
    const start = offset;
    const end = start + text.length;
    rowMapping.push({ pageId: slot.pageId, rowIndex: slot.rowIndex, layer, start, end, text });
    offset = end + STORY_ROW_SEPARATOR.length;
  });

  return {
    id: `${scope}:${layer}:${anchorPageId}`,
    scope,
    layer,
    anchorPageId,
    pageIds,
    plainText: rows.join(STORY_ROW_SEPARATOR),
    rows,
    rowMapping,
    totalSlots: slots.length,
    usedSlots: nonEmptyRowsCount,
  };
}

export function storyToRowPatches(story: TextStory, newPlainText: string): StoryPatchPlan {
  const nextRows = normalizeStoryRows(newPlainText);
  const slotDelta = computeSlotDelta(story.totalSlots, nextRows.length);
  const rowPatches: StoryRowPatch[] = [];

  story.rowMapping.forEach((mapping, index) => {
    const text = nextRows[index] ?? "";
    if (text === mapping.text) return;
    rowPatches.push({
      key: layerKey(mapping.pageId, mapping.rowIndex, story.layer),
      pageId: mapping.pageId,
      rowIndex: mapping.rowIndex,
      layer: story.layer,
      beforeText: mapping.text,
      text,
    });
  });

  return { story, rowPatches, slotDelta };
}
