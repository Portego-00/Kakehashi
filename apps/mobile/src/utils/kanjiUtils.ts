/**
 * Extracts unique kanji characters from a given text.
 * Filters out hiragana, katakana, punctuation, and other non-kanji characters.
 * 
 * @param text The text to scan for kanji
 * @returns An array of unique kanji characters found in the text
 */
export function extractKanji(text: string): string[] {
  // Regex to match kanji (ranges from basic to extensions)
  // Common Kanji range: \u4e00-\u9faf
  const kanjiRegex = /[\u4e00-\u9faf]/g;
  const matches = text.match(kanjiRegex);
  
  if (!matches) return [];
  
  // Return unique kanji
  return [...new Set(matches)];
}

/**
 * Calculates the percentage of known kanji in a text based on a set of passed kanji.
 * 
 * @param text The text to evaluate
 * @param passedKanji A Set containing the characters of kanji the user has passed (Guru+)
 * @returns A number between 0 and 100 representing the percentage
 */
export function calculateKnownKanjiPercentage(text: string, passedKanji: Set<string>): number {
  if (!text) return 0;
  
  const uniqueKanji = extractKanji(text);
  
  if (uniqueKanji.length === 0) return 100; // No kanji to know, so technically 100% readable regarding kanji
  
  const knownCount = uniqueKanji.filter(char => passedKanji.has(char)).length;
  
  return Math.round((knownCount / uniqueKanji.length) * 100);
}
