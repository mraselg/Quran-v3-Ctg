export interface CanonicalCharRef {
  surahId: number;
  ayahId: number;
  wordIndex: number; // 0-based index of the word in this ayah
  charIndex: number; // 0-based index of the character in this word
}

export function makeSymbolOverrideKey(ref: CanonicalCharRef, symbolId: string): string {
  return `symbol:${ref.surahId}:${ref.ayahId}:${ref.wordIndex}:${ref.charIndex}:${symbolId}`;
}

export function parseSymbolOverrideKey(key: string): { ref: CanonicalCharRef; symbolId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 6 || parts[0] !== 'symbol') return null;
  return {
    ref: {
      surahId: parseInt(parts[1], 10),
      ayahId: parseInt(parts[2], 10),
      wordIndex: parseInt(parts[3], 10),
      charIndex: parseInt(parts[4], 10),
    },
    symbolId: parts[5],
  };
}
