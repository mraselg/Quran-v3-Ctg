import type { MasterTemplate } from "@/types/template";

/**
 * The "Kariana" default template.
 * All values here are transcribed from the current hardcoded constants:
 *   - Artboard.tsx: VB_W, VB_H, DISPLAY_W, ROW_BANDS_SVG, HEADER_BAND, FOOTER_BAND_Y1
 *   - FabricLines.tsx: ARABIC_FONT_PX, BANGLA_FONT_PX, SYMBOL_FONT_PX, BASE_*_Y
 *   - pages.ts: LINES_PER_PAGE, SURAH_OPEN_SPAN, ARABIC_FONT_PX, SIDE_PAD_PX
 *   - SurahOpenBlock.tsx: percentage positions
 *   - typographyReflow.ts: ARTBOARD_TEXT_WIDTH derivation
 */

export const DEFAULT_RULE_COLORS: Record<number, string> = {
  1: "#10b981", 2: "#3b82f6", 3: "#8b5cf6",  4: "#ec4899",
  5: "#f59e0b", 6: "#14b8a6", 7: "#f97316",  8: "#06b6d4",
  9: "#ef4444", 10: "#a855f7", 11: "#84cc16", 12: "#6366f1",
};

export const KARIANA_TEMPLATE: MasterTemplate = {
  id: "kariana-default",
  name: "কারিয়ানা ডিফল্ট",
  description: "স্ট্যান্ডার্ড কারিয়ানা Quran পৃষ্ঠা বিন্যাস",
  createdAt: new Date().toISOString(),

  linesPerPage: 9,

  pageGeometry: {
    viewBoxW: 420.17,
    viewBoxH: 630.28,
    displayW: 780,
    lineX: 7.46,
    lineXEnd: 412.58,
    headerBand: [7.5, 25.41],
    footerBandY1: 622.95,
    rowBandsSvg: [
      [36.86, 89.81],
      [101.43, 154.38],
      [165.82, 218.77],
      [230.22, 283.16],
      [294.63, 347.58],
      [359.01, 411.96],
      [423.54, 476.49],
      [487.83, 540.77],
      [552.30, 622.95],
    ],
    sidePadPx: 8,
    safetyMarginPx: 3,
  },

  bandRatios: {
    symbolRatio: 0.28,
    banglaRatio: 0.24,
  },

  typography: {
    arabicFontPx: 50,
    banglaFontPx: 18,
    symbolFontPx: 28,
    arabicFamily: "'Excellent Arabic', 'Amiri Quran', 'Scheherazade New', serif",
    banglaFamily: "'Kalpurush', 'Noto Serif Bengali', serif",
    baseArabicY: -15,
    baseBanglaY: 2,
    baseSymbolY: -7,
    defaultArabicY: 0,
    defaultBanglaY: 0,
    defaultSymbolY: 0,
  },

  printConfig: {
    bleedMarginMm: 0,
    colorProfile: "RGB",
  },

  tajweedConfig: {
    1:  { enabled: true,  color: "#10b981" },
    2:  { enabled: false, color: "#3b82f6" },
    3:  { enabled: false, color: "#8b5cf6" },
    4:  { enabled: false, color: "#ec4899" },
    5:  { enabled: false, color: "#f59e0b" },
    6:  { enabled: false, color: "#14b8a6" },
    7:  { enabled: false, color: "#f97316" },
    8:  { enabled: false, color: "#06b6d4" },
    9:  { enabled: true,  color: "#ef4444" },
    10: { enabled: false, color: "#a855f7" },
    11: { enabled: false, color: "#84cc16" },
    12: { enabled: false, color: "#6366f1" },
  },

  meaningConfig: {
    showPronunciation: false,
    pronunciationFontPx: 14,
    pronunciationRatio: 0.0,
    showMeaning: false,
    meaningFontPx: 12,
    meaningRatio: 0.0,
  },

  surahOpen: {
    headerSpan: 2,
    startAt: 3,
    bismillahArabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    bismillahBangla: "অসীম করুণাময় ও পরম দয়ালু আল্লাহর নামে শুরু করছি",
    namePlate: {
      left: "27.5%",
      top: "21%",
      width: "45%",
      height: "22%",
    },
    bismillahStrip: {
      left: "7.5%",
      top: "50%",
      width: "85%",
      height: "28%",
    },
  },

  assets: {
    pageTemplateSvg: "/templates/page-default.svg",
    surahOpenSvg: "/templates/surah-open.svg",
  },
};

export const INDO_PAK_TEMPLATE: MasterTemplate = {
  ...KARIANA_TEMPLATE,
  id: "indo-pak-15",
  name: "ইন্দো-পাক ১৫ লাইন (কাস্টম)",
  description: "১৫ লাইনের ট্রেডিশনাল ইন্দো-পাক স্টাইল টেমপ্লেট",
  linesPerPage: 15,
  typography: {
    ...KARIANA_TEMPLATE.typography,
    arabicFontPx: 38,
    banglaFontPx: 14,
    symbolFontPx: 20,
    arabicFamily: "'KFGQPC Uthmanic Script HAFS', 'Amiri Quran', serif",
  },
  pageGeometry: {
    ...KARIANA_TEMPLATE.pageGeometry,
    rowBandsSvg: Array.from({ length: 15 }, (_, i) => {
      const height = (622.95 - 25.41) / 15;
      const y0 = 25.41 + i * height;
      return [y0, y0 + height * 0.9];
    }),
  },
};
