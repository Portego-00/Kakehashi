/**
 * Niai Similar Kanji Lookup
 *
 * This module provides visually similar kanji data from the Niai community project.
 * The data is sourced from multiple databases including:
 * - WaniKani Niai/Noto user scripts
 * - Keisei phonetic compound database
 * - Stroke edit distance calculations
 * - Manual curation
 *
 * Original source: https://github.com/mwil/wanikani-userscripts/tree/master/wanikani-similar-kanji/db
 */

// Import the pre-compiled similar kanji data
// Format: { "kanji": "similar1similar2similar3..." }
import niaiData from "../data/niai-similar-kanji.json";
import { getAllSubjects } from "./cache";

// Type the imported data
const similarKanjiMap = niaiData as Record<string, string>;

// Cache for kanji character to subject mapping (lazy loaded)
let kanjiCharacterMap: Map<string, any> | null = null;

/**
 * Get visually similar kanji characters for a given kanji
 * @param kanji - The kanji character to look up
 * @returns Array of similar kanji characters, or empty array if none found
 */
export function getNiaiSimilarKanji(kanji: string): string[] {
  const similar = similarKanjiMap[kanji];
  if (!similar) {
    return [];
  }
  // Split the string into individual characters
  return [...similar];
}

/**
 * Check if Niai data exists for a given kanji
 * @param kanji - The kanji character to check
 * @returns True if Niai has similar kanji data for this character
 */
export function hasNiaiData(kanji: string): boolean {
  return kanji in similarKanjiMap && similarKanjiMap[kanji].length > 0;
}

/**
 * Get the total number of kanji with Niai similar data
 * @returns Count of kanji entries in the Niai database
 */
export function getNiaiKanjiCount(): number {
  return Object.keys(similarKanjiMap).length;
}

/**
 * Build a map of kanji characters to their subject data from cache
 * This is used to look up WaniKani subjects for Niai similar kanji characters
 */
async function buildKanjiCharacterMap(): Promise<Map<string, any>> {
  if (kanjiCharacterMap) {
    return kanjiCharacterMap;
  }

  const allSubjects = await getAllSubjects();
  kanjiCharacterMap = new Map();

  for (const subject of allSubjects) {
    // Only include kanji subjects
    if (subject.object === "kanji" && subject.data?.characters) {
      kanjiCharacterMap.set(subject.data.characters, subject);
    }
  }

  return kanjiCharacterMap;
}

/**
 * Get visually similar kanji subjects using Niai data
 * @param kanjiCharacter - The kanji character to find similar kanji for
 * @returns Array of similar kanji subject objects (WaniKani format), or empty array if none found
 */
export async function getNiaiSimilarKanjiSubjects(kanjiCharacter: string): Promise<any[]> {
  const similarChars = getNiaiSimilarKanji(kanjiCharacter);
  if (similarChars.length === 0) {
    return [];
  }

  const charMap = await buildKanjiCharacterMap();
  const similarSubjects: any[] = [];

  for (const char of similarChars) {
    const subject = charMap.get(char);
    if (subject) {
      similarSubjects.push(subject);
    }
  }

  return similarSubjects;
}

/**
 * Clear the kanji character map cache (call when subjects are updated)
 */
export function clearNiaiCache(): void {
  kanjiCharacterMap = null;
}
