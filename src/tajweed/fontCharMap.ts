/**
 * Tajweed Icon Font — public API
 * ------------------------------
 * Source of truth for tajweed rule → glyph mapping. Backed by the
 * `tajweed-symbols.woff2` font built by scripts/build-tajweed-font.mjs.
 *
 * Consumers should render `TAJWEED_CHAR[id]` inside a `<span class="tajweed-icon">`
 * (see @font-face + .tajweed-icon class in src/styles.css) instead of importing
 * individual SVG assets.
 */

export type TopSymbolId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** PUA codepoint per rule id — kept in sync with fontCharMap.generated.ts. */
export const TAJWEED_CHAR: Record<TopSymbolId, string> = {
  1: "\uE001",
  2: "\uE002",
  3: "\uE003",
  4: "\uE004",
  5: "\uE005",
  6: "\uE006",
  7: "\uE007",
  8: "\uE008",
  9: "\uE009",
  10: "\uE00A",
  11: "\uE00B",
  12: "\uE00C",
};

export const TAJWEED_RULE_NAMES: Record<TopSymbolId, string> = {
  1: "মদ্দ-এ-আসলি",
  2: "আরযি সাকিন (ওয়াকফ)",
  3: "মদ্দ-এ-মুনফাসিল",
  4: "মদ্দ-এ-মুত্তাসিল",
  5: "মদ্দ-এ-ইওয়াদ",
  6: "মদ্দ + আরযি সাকিন",
  7: "ওয়াজিব গুন্নাহ (মীম/নুন শদ্দা)",
  8: "ক্বলক্বলাহ",
  9: "শাপলা ফুল (ص ض ط ظ ق غ خ র)",
  10: "শিস (ز س ص)",
  11: "ইখফা (নুন সাকিন/তানওয়িন)",
  12: "ওয়াকফের শেষ অক্ষর",
};

export const ALL_RULE_IDS: TopSymbolId[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

export type SubRuleDef = {
  id: string;
  labelBn: string;
  isCancellation?: boolean;
};

export const SYMBOL_SUB_RULES: Partial<Record<TopSymbolId, SubRuleDef[]>> = {
  1: [
    { id: "1:1", labelBn: "জেরের বামে ইয়া সাকিন" },
    { id: "1:2", labelBn: "খাড়া জের" },
    { id: "1:3", labelBn: "পেশের বামে ওয়াও সাকিন" },
    { id: "1:4", labelBn: "উল্টা পেশ" },
    { id: "1:5", labelBn: "জবরের বামে আলিফ" },
    { id: "1:6", labelBn: "খাড়া জবর" },
    { id: "1:7", labelBn: "আলিফ-লাম বাম → বাতিল", isCancellation: true },
    { id: "1:8", labelBn: "তাশদীদ + খাড়া জবর" },
    { id: "1:9", labelBn: "তাশদীদ + খাড়া জের" },
    { id: "1:10", labelBn: "তাশদীদ + উল্টা পেশ" },
    { id: "1:11", labelBn: "তাশদীদ + জবরের বামে আলিফ" },
    { id: "1:12", labelBn: "তাশদীদ + জেরের বামে ইয়া" },
    { id: "1:13", labelBn: "তাশদীদ + পেশের বামে ওয়াও" },
  ],
  2: [
    { id: "2:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "2:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  3: [
    { id: "3:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "3:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  4: [
    { id: "4:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "4:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  5: [
    { id: "5:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "5:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  6: [
    { id: "6:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "6:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  7: [
    { id: "7:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "7:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  8: [
    { id: "8:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "8:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  9: [
    { id: "9:1", labelBn: "ص + যবর" },
    { id: "9:2", labelBn: "ض + যবর" },
    { id: "9:3", labelBn: "ط + যবর" },
    { id: "9:4", labelBn: "ظ + যবর" },
    { id: "9:5", labelBn: "ق + যবর" },
    { id: "9:6", labelBn: "غ + যবর" },
    { id: "9:7", labelBn: "خ + যবর" },
    { id: "9:8", labelBn: "ر + যবর" },
  ],
  10: [
    { id: "10:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "10:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  11: [
    { id: "11:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "11:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
  12: [
    { id: "12:1", labelBn: "সাব-রুল ১ (কাস্টমাইজ করুন)" },
    { id: "12:2", labelBn: "সাব-রুল ২ (কাস্টমাইজ করুন)" },
  ],
};
