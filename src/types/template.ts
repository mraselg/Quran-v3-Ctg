export type BandRatios = {
  /** Fraction of band height for Tajweed symbol strip (e.g. 0.28) */
  symbolRatio: number;
  /** Fraction of band height for Bangla translation (e.g. 0.24) */
  banglaRatio: number;
  /** NEW — fraction for Bangla pronunciation line (verses.bn). 0 = disabled. */
  pronunciationRatio?: number;
  /** NEW — fraction for Bangla meaning line (verses.t_bn). 0 = disabled. */
  meaningRatio?: number;
  /** Arabic fills the remainder: 1 - symbolRatio - banglaRatio - pronunciationRatio - meaningRatio */
};

export type PageGeometry = {
  /** SVG viewBox width in SVG user units (e.g. 420.17) */
  viewBoxW: number;
  /** SVG viewBox height in SVG user units (e.g. 630.28) */
  viewBoxH: number;
  /** Rendered pixel width of the artboard canvas (e.g. 780) */
  displayW: number;
  /** Left x-coordinate of the text area in SVG units (e.g. 7.46) */
  lineX: number;
  /** Right x-coordinate of text area in SVG units (e.g. 412.58) */
  lineXEnd: number;
  /** Header band [y0, y1] in SVG units */
  headerBand: [number, number];
  /** y1 of the footer band in SVG units (e.g. 622.95) */
  footerBandY1: number;
  /**
   * Array of [y0, y1] pairs in SVG units, one per row.
   * Length must equal linesPerPage.
   */
  rowBandsSvg: Array<[number, number]>;
  /** Pixel padding applied to each side inside a text row (e.g. 8) */
  sidePadPx: number;
  /**
   * Safety margin in pixels to absorb sub-pixel rounding (e.g. 3).
   * Subtracts from computed grid width to prevent visual overflow.
   */
  safetyMarginPx: number;
};

export type TypographyDefaults = {
  /** Base Arabic font size in px (e.g. 50) */
  arabicFontPx: number;
  /** Base Bangla font size in px (e.g. 18) */
  banglaFontPx: number;
  /** Base Tajweed symbol font size in px (e.g. 28) */
  symbolFontPx: number;
  /** CSS font-family string for Arabic (e.g. "'Excellent Arabic', serif") */
  arabicFamily: string;
  /** CSS font-family string for Bangla */
  banglaFamily: string;
  /** Baked-in Y offset for Arabic baseline within its band (e.g. -15) */
  baseArabicY: number;
  /** Baked-in Y offset for Bangla baseline (e.g. 2) */
  baseBanglaY: number;
  /** Baked-in Y offset for symbol strip (e.g. -7) */
  baseSymbolY: number;

  /** NEW — Absolute initial Y-offset for Arabic layer injected into overridesStore.global */
  defaultArabicY?: number;
  /** NEW — Absolute initial Y-offset for Bangla layer. Default: 0. */
  defaultBanglaY?: number;
  /** NEW — Absolute initial Y-offset for Symbol layer. Default: 0. */
  defaultSymbolY?: number;
};

export type ColorProfile = "RGB" | "CMYK";

export type PrintConfig = {
  /** Bleed margin in mm on all sides. Default: 0. Print-ready exports use 3mm. */
  bleedMarginMm: number;
  /** Color profile hint for the export pipeline. Default: "RGB". */
  colorProfile: ColorProfile;
};

export type TajweedRuleOverride = {
  /** Whether this rule's symbol is rendered at all. */
  enabled: boolean;
  /** CSS hex color for this rule's symbol, e.g. "#10b981". */
  color: string;
};

export type TajweedConfig = Partial<Record<number, TajweedRuleOverride>>;

export type MeaningConfig = {
  /** Render the Bangla pronunciation line (verses.json field: "bn"). */
  showPronunciation: boolean;
  /** Font size in px for the pronunciation line. Default: 14. */
  pronunciationFontPx: number;
  /** Fraction of band height reserved for pronunciation line (0..0.2). */
  pronunciationRatio: number;

  /** Render the Bangla meaning line (verses.json field: "t_bn"). */
  showMeaning: boolean;
  /** Font size in px for the meaning line. Default: 12. */
  meaningFontPx: number;
  /** Fraction of band height reserved for meaning line (0..0.2). */
  meaningRatio: number;
};

export type SurahOpenLayout = {
  /**
   * Number of lines the surah-open block occupies on the page.
   * The page builder inserts this many slots (1 surahOpen + headerSpan-1 blanks).
   * Default: 2
   */
  headerSpan: number;
  /**
   * The row index where regular Ayah text begins on surah-open type pages.
   * Must equal the number of reserved rows at the top (e.g. 3 for a page
   * that reserves rows 0-1 for surah branding and row 2 as a blank spacer).
   */
  startAt: number;
  /** Bismillah Arabic text */
  bismillahArabic: string;
  /** Bismillah Bangla translation */
  bismillahBangla: string;
  /** Position of the Surah name plate, as CSS percentage strings */
  namePlate: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
  /** Position of the Bismillah strip, as CSS percentage strings */
  bismillahStrip: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
};

export type TemplateAssets = {
  /**
   * Public URL / path to the page border SVG template.
   * Used as CSS background-image on the Artboard container.
   * e.g. "/templates/page-default.svg"
   */
  pageTemplateSvg: string;
  /**
   * Public URL / path to the surah-open block SVG.
   * Used as background-image inside SurahOpenBlock.tsx.
   * e.g. "/templates/surah-open.svg"
   */
  surahOpenSvg: string;
  /** Base64-encoded SVG for persistence when using uploaded files */
  pageTemplateSvgData?: string;
  surahOpenSvgData?: string;
  /**
   * Optional URL for a header decoration / ornamental band SVG.
   * Rendered inside SlimHeader if provided.
   */
  headerDecorSvg?: string;
  /**
   * Optional URL for footer decoration.
   */
  footerDecorSvg?: string;
};

export type MasterTemplate = {
  /** Unique stable identifier (slug style, e.g. "kariana-default") */
  id: string;
  /** Human-readable display name (Bengali is fine) */
  name: string;
  /** Short description */
  description?: string;
  /** ISO timestamp of creation */
  createdAt?: string;

  /** Physical page layout parameters */
  pageGeometry: PageGeometry;

  /** Number of text rows per page — must match rowBandsSvg.length */
  linesPerPage: number;

  /** Within-band proportions for the three sub-layers */
  bandRatios: BandRatios;

  /** Default typography values */
  typography: TypographyDefaults;

  /** Surah header/open-page rules */
  surahOpen: SurahOpenLayout;

  /** File assets (SVGs, borders, frames) */
  assets: TemplateAssets;

  /** NEW — Print and export configuration. */
  printConfig?: PrintConfig;

  /** NEW — Per-rule Tajweed symbol configuration. */
  tajweedConfig?: TajweedConfig;

  /** NEW — Meaning and pronunciation sub-layer config. */
  meaningConfig?: MeaningConfig;
};
