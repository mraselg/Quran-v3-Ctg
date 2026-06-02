import versesJson from '../data/verses.json';
import type { PageData } from '../data/pages';

interface WordRef {
  surahId: number;
  ayahId: number;
  wordIndex: number;
  text: string;
}

// Map from surah:ayah:wordIndex to WordRef
const wordRefIndex = new Map<string, WordRef>();

// Maps "pageId:rowIndex:wordIndexInRow" -> WordRef
const pageWordMap = new Map<string, WordRef>();

export function buildWordRefIndex() {
  wordRefIndex.clear();
  if (Array.isArray(versesJson)) {
    versesJson.forEach((verse: any) => {
      if (!verse || !verse.ar) return;
      const words = verse.ar.split(/\s+/).filter(Boolean);
      words.forEach((word: string, wordIndex: number) => {
        const key = `${verse.s}:${verse.v}:${wordIndex}`;
        wordRefIndex.set(key, {
          surahId: verse.s,
          ayahId: verse.v,
          wordIndex,
          text: word,
        });
      });
    });
  }
}

function splitWords(text: string) {
  const out: { start: number; end: number; word: string }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    const s = i;
    while (i < text.length && !/\s/.test(text[i])) i++;
    if (s < i) out.push({ start: s, end: i, word: text.slice(s, i) });
  }
  return out;
}

export function indexPageWords(pages: PageData[]) {
  pageWordMap.clear();
  
  if (!Array.isArray(versesJson)) return;
  
  let verseIdx = 0;
  let wordIdxInVerse = 0;
  
  for (const page of pages) {
    if (!page.lines) continue;
    const startAt = page.type === "surah-open" ? 3 : 0;
    
    for (let r = 0; r < page.lines.length; r++) {
      const line = page.lines[r];
      if (!line) continue;
      if (line.slotKind === "surah-open" || line.slotKind === "blank") continue;
      
      const arabicText = line.arabicLine ?? line.blocks.map(b => b.arabic).join(" ");
      if (!arabicText) continue;
      
      const words = splitWords(arabicText);
      words.forEach((w, wordIndexInRow) => {
        // Find matching word in verses
        let matched = false;
        while (verseIdx < versesJson.length) {
          const verse = versesJson[verseIdx];
          const verseWords = verse.ar.split(/\s+/).filter(Boolean);
          
          if (wordIdxInVerse < verseWords.length) {
            const quranWord = verseWords[wordIdxInVerse];
            
            pageWordMap.set(`${page.id}:${r}:${wordIndexInRow}`, {
              surahId: verse.s,
              ayahId: verse.v,
              wordIndex: wordIdxInVerse,
              text: quranWord
            });
            
            wordIdxInVerse++;
            if (wordIdxInVerse >= verseWords.length) {
              verseIdx++;
              wordIdxInVerse = 0;
            }
            matched = true;
            break;
          } else {
            verseIdx++;
            wordIdxInVerse = 0;
          }
        }
      });
    }
  }
}

export function getWordIndexForCharIndex(text: string, charIndex: number): number {
  const words = splitWords(text);
  for (let idx = 0; idx < words.length; idx++) {
    const w = words[idx];
    if (charIndex >= w.start && charIndex < w.end) {
      return idx;
    }
  }
  let minDistance = Infinity;
  let closestIdx = 0;
  for (let idx = 0; idx < words.length; idx++) {
    const w = words[idx];
    const distance = Math.min(Math.abs(charIndex - w.start), Math.abs(charIndex - w.end));
    if (distance < minDistance) {
      minDistance = distance;
      closestIdx = idx;
    }
  }
  return closestIdx;
}

export function getWordRef(surahId: number, ayahId: number, wordIndex: number): WordRef | undefined {
  return wordRefIndex.get(`${surahId}:${ayahId}:${wordIndex}`);
}

export function getCanonicalWordRef(pageId: string, rowIndex: number, wordIndexInRow: number): WordRef | undefined {
  return pageWordMap.get(`${pageId}:${rowIndex}:${wordIndexInRow}`);
}
