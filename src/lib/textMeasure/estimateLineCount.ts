export function estimateLineCount(
  text: string,
  widthPx: number,
  fontPx: number
): number {
  // Approximate an average Arabic glyph width as 45% of font size
  const charWidth = fontPx * 0.45; 
  const charsPerLine = Math.max(1, widthPx / charWidth);
  return Math.ceil(text.length / charsPerLine);
}
