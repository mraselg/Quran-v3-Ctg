import type { MasterTemplate, PageGeometry } from "@/types/template";

/** The display scale factor (displayW / viewBoxW). */
export function getScale(geo: PageGeometry): number {
  return geo.displayW / geo.viewBoxW;
}

/** Pixel width of the entire text grid area. */
export function getGridWidthPx(template: MasterTemplate): number {
  const { lineX, lineXEnd, sidePadPx, safetyMarginPx } = template.pageGeometry;
  const scale = getScale(template.pageGeometry);
  return (lineXEnd - lineX) * scale - 2 * sidePadPx - safetyMarginPx;
}

/** Total pixel height of the artboard canvas. */
export function getDisplayH(geo: PageGeometry): number {
  return geo.viewBoxH * getScale(geo);
}

/** First row's top y in pixels. */
export function getGridTopPx(template: MasterTemplate): number {
  const [y0] = template.pageGeometry.rowBandsSvg[0]!;
  return y0 * getScale(template.pageGeometry);
}

/**
 * Compute the GRID_LAYOUT_PX array (RowBox[]) from the template.
 * This replaces the hardcoded GRID_LAYOUT_PX constant in Artboard.tsx.
 */
export type RowBox = {
  sy: number;  // row top (px, relative to grid top)
  ay: number;  // Arabic baseline zone start
  by: number;  // Bangla zone start
  pronY?: number;
  meanY?: number;
  symH: number;
  arH: number;
  bnH: number;
  pronH?: number;
  meanH?: number;
};

export function computeGridLayout(template: MasterTemplate): RowBox[] {
  const scale = getScale(template.pageGeometry);
  const { rowBandsSvg: bands } = template.pageGeometry;
  const firstRowY = bands[0]![0];
  const { symbolRatio, banglaRatio } = template.bandRatios;
  const pronunciationRatio = template.bandRatios.pronunciationRatio ?? 0;
  const meaningRatio = template.bandRatios.meaningRatio ?? 0;

  return bands.map(([y0, y1]) => {
    const sy = (y0 - firstRowY) * scale;
    const bandH = (y1 - y0) * scale;
    const symH = bandH * symbolRatio;
    const bnH = bandH * banglaRatio;
    const pronH = bandH * pronunciationRatio;
    const meanH = bandH * meaningRatio;
    const arH = Math.max(2, bandH - symH - bnH - pronH - meanH);

    return { 
      sy, 
      ay: sy + symH, 
      by: sy + symH + arH, 
      pronY: pronH > 0 ? sy + symH + arH + bnH : undefined,
      meanY: meanH > 0 ? sy + symH + arH + bnH + pronH : undefined,
      symH, arH, bnH, pronH, meanH 
    };
  });
}

export function templateToGlobalDefaults(template: MasterTemplate) {
  return {
    arabicFontPx: template.typography.arabicFontPx,
    banglaFontPx: template.typography.banglaFontPx,
    arabicYOffset: template.typography.defaultArabicY ?? 0,
    banglaYOffset: template.typography.defaultBanglaY ?? 0,
    symbolYOffset: template.typography.defaultSymbolY ?? 0,
  };
}

export function hydrateTemplateAssets(template: MasterTemplate): MasterTemplate {
  const assets = { ...template.assets };
  if (assets.pageTemplateSvgData && assets.pageTemplateSvg.startsWith("blob:")) {
    // Reconstruct the blob URL from saved base64
    try {
      const svgBlob = new Blob(
        [atob(assets.pageTemplateSvgData)],
        { type: "image/svg+xml" }
      );
      assets.pageTemplateSvg = URL.createObjectURL(svgBlob);
    } catch { /* ignore */ }
  }
  if (assets.surahOpenSvgData && assets.surahOpenSvg.startsWith("blob:")) {
    try {
      const svgBlob = new Blob(
        [atob(assets.surahOpenSvgData)],
        { type: "image/svg+xml" }
      );
      assets.surahOpenSvg = URL.createObjectURL(svgBlob);
    } catch { /* ignore */ }
  }
  return { ...template, assets };
}
