export type JapaneseTextStats = {
  characters: number;
  kana: number;
  kanji: number;
  hasJapanese: boolean;
};

const KANA_PATTERN = /[\u3040-\u30ff]/g;
const KANJI_PATTERN = /[\u3400-\u9fff]/g;
const JAPANESE_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

export function getJapaneseTextStats(text: string): JapaneseTextStats {
  const kana = text.match(KANA_PATTERN)?.length ?? 0;
  const kanji = text.match(KANJI_PATTERN)?.length ?? 0;

  return {
    characters: text.length,
    kana,
    kanji,
    hasJapanese: JAPANESE_PATTERN.test(text),
  };
}

export function normalizeJapaneseSearchQuery(query: string): string {
  return query.normalize("NFKC").trim();
}
