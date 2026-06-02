const fs = require('fs');

const file = 'c:/xampp/htdocs/new from ctg quran/src/components/studio/Artboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  'import { useTemplateStore } from "@/state/templateStore";',
  'import { useTemplateStore } from "@/state/templateStore";\nimport { getScale, getDisplayH, getGridTopPx, computeGridLayout } from "@/lib/templateUtils";'
);

// 2. Remove all those constants (from line 17 to line 70 approximately)
const startDel = '/* Canonical SVG coordinate system — matches public/templates/page-default.svg';
const endDel = 'const FOOTER_TOP_PX = (FOOTER_BAND_Y1 - 16) * SCALE;';

const startIdx = content.indexOf(startDel);
const endIdx = content.indexOf(endDel) + endDel.length;

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + content.substring(endIdx);
}

// 3. Add useMemo inside Artboard
const artboardStart = '  const surahOpenStartAt = tmpl.surahOpen.startAt;';
const memoCode = `
  const layoutMetrics = useMemo(() => {
    const scale = getScale(tmpl.pageGeometry);
    const displayH = getDisplayH(tmpl.pageGeometry);
    const gridTopPx = getGridTopPx(tmpl);
    const gridLayoutPx = computeGridLayout(tmpl);
    const headerTopPx = tmpl.pageGeometry.headerBand[0] * scale;
    const headerHPx = (tmpl.pageGeometry.headerBand[1] - tmpl.pageGeometry.headerBand[0]) * scale;
    const footerHPx = 16 * scale;
    const footerTopPx = (tmpl.pageGeometry.footerBandY1 - 16) * scale;
    const gridLeftPx = tmpl.pageGeometry.lineX * scale;
    const gridWPx = (tmpl.pageGeometry.lineXEnd - tmpl.pageGeometry.lineX) * scale;
    const firstRowY = tmpl.pageGeometry.rowBandsSvg[0][0];
    const lastRowY2 = tmpl.pageGeometry.rowBandsSvg[tmpl.pageGeometry.rowBandsSvg.length - 1][1];
    const gridHPx = (lastRowY2 - firstRowY) * scale;
    
    return {
      scale, displayH, gridTopPx, gridLayoutPx, headerTopPx, headerHPx, footerHPx, footerTopPx, gridLeftPx, gridWPx, gridHPx
    };
  }, [tmpl]);
  const { scale, displayH, gridTopPx, gridLayoutPx, headerTopPx, headerHPx, footerHPx, footerTopPx, gridLeftPx, gridWPx, gridHPx } = layoutMetrics;
`;

content = content.replace(artboardStart, artboardStart + memoCode);

// 4. Replace variable names
content = content.replace(/DISPLAY_H/g, 'displayH');
content = content.replace(/HEADER_TOP_PX/g, 'headerTopPx');
content = content.replace(/HEADER_H_PX/g, 'headerHPx');
content = content.replace(/FOOTER_TOP_PX/g, 'footerTopPx');
content = content.replace(/FOOTER_H_PX/g, 'footerHPx');
content = content.replace(/GRID_LEFT_PX/g, 'gridLeftPx');
content = content.replace(/GRID_TOP_PX/g, 'gridTopPx');
content = content.replace(/GRID_W_PX/g, 'gridWPx');
content = content.replace(/GRID_H_PX/g, 'gridHPx');
content = content.replace(/GRID_LAYOUT_PX/g, 'gridLayoutPx');
content = content.replace(/SCALE/g, 'scale');
content = content.replace(/DISPLAY_W/g, 'tmpl.pageGeometry.displayW');

fs.writeFileSync(file, content, 'utf8');
console.log('Done');
