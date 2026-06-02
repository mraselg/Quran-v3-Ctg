import { SURAH_NAMES } from "@/data/surahNames";

export type ExportRange = {
  startSurah: number;
  endSurah: number;
};

export function getExportRangeDescription(range: ExportRange): string {
  if (range.startSurah === range.endSurah) {
    const surah = SURAH_NAMES.find((s) => s.id === range.startSurah);
    return surah ? surah.name : `Surah ${range.startSurah}`;
  }
  const start = SURAH_NAMES.find((s) => s.id === range.startSurah);
  const end = SURAH_NAMES.find((s) => s.id === range.endSurah);
  return `${start ? start.name : range.startSurah} - ${end ? end.name : range.endSurah}`;
}
