import { Subject } from '../types/wanikani';
import * as wanakana from 'wanakana';

/**
 * Enum representing the result of checking an answer
 */
export enum AnswerCheckerResult {
  Precise,        // Exact match
  Imprecise,      // Close match within tolerance
  OtherKanjiReading, // Matched a kanji reading instead of vocabulary reading
  WrongReadingType, // Matched a reading of wrong type (e.g., kunyomi when onyomi expected)
  MismatchingOkurigana, // Mismatched okurigana
  ContainsInvalidCharacters, // Contains invalid characters for the question type
  IsKanjiButWantReading, // Entered the subject characters (kanji) when reading was expected
  IsReadingButWantMeaning, // Entered a reading when meaning was expected
  IsMeaningButWantReading, // Entered a meaning when reading was expected
  IncorrectNConversion, // Common mistake with 'n' before vowel/y (e.g., konya → こにゃ instead of こんや)
  Incorrect       // Incorrect answer
}

export interface AnswerCheckerContext {
  singleKanjiReadings?: Record<string, string[]>;
  acceptAnyKanjiOnyomiReading?: boolean;
}

// Character set definitions
const HIRAGANA_CHAR_RANGE = '\u3040-\u309F';
const KATAKANA_CHAR_RANGE = '\u30A0-\u30FF';
const ALL_KANA_REGEX = new RegExp(`^[${HIRAGANA_CHAR_RANGE}${KATAKANA_CHAR_RANGE}]+$`);
const JAPANESE_REGEX = new RegExp(`[${HIRAGANA_CHAR_RANGE}${KATAKANA_CHAR_RANGE}\u3400-\u4DBF\u4E00-\u9FFF\u3000-\u303F]+`);
const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
const SINGLE_KANJI_ONLY_REGEX = /^[\u3400-\u4DBF\u4E00-\u9FFF]$/;

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Determines the tolerance for Levenshtein distance based on string length
 */
function distanceTolerance(answer: string): number {
  if (answer.length <= 3) return 0;
  if (answer.length <= 5) return 1;
  if (answer.length <= 7) return 2;
  return Math.floor(2 + Math.floor(answer.length / 7));
}

/**
 * Finds ranges of non-kana characters in a string
 */
function findNonKanaRanges(text: string): { start: number, length: number }[] {
  const ranges: { start: number, length: number }[] = [];
  let start: number | null = null;
  let length = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!ALL_KANA_REGEX.test(c)) {
      if (start === null) {
        start = i;
      }
      length++;
    } else if (start !== null) {
      ranges.push({ start, length });
      start = null;
      length = 0;
    }
  }

  if (start !== null) {
    ranges.push({ start, length });
  }

  return ranges;
}

/**
 * Finds ranges of Japanese characters in a string
 */
function findJapaneseRanges(text: string): { start: number, length: number }[] {
  const ranges: { start: number, length: number }[] = [];
  let start: number | null = null;
  let length = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (JAPANESE_REGEX.test(c)) {
      if (start === null) {
        start = i;
      }
      length++;
    } else if (start !== null) {
      ranges.push({ start, length });
      start = null;
      length = 0;
    }
  }

  if (start !== null) {
    ranges.push({ start, length });
  }

  return ranges;
}

/**
 * Checks if the answer has a common 'n' conversion mistake
 * e.g., typing "konya" → "こにゃ" instead of "konnya" → "こんや"
 */
function hasNConversionMistake(userAnswer: string, correctAnswer: string): boolean {  
  // Check for common patterns where 'n' before vowel/y gets converted incorrectly
  // にゃ→んや, にゅ→んゆ, にょ→んよ, にあ→んあ, etc.
  const replacements = [
    { from: 'にゃ', to: 'んや' },
    { from: 'にゅ', to: 'んゆ' },
    { from: 'にょ', to: 'んよ' },
    { from: 'にあ', to: 'んあ' },
    { from: 'にい', to: 'んい' },
    { from: 'にう', to: 'んう' },
    { from: 'にえ', to: 'んえ' },
    { from: 'にお', to: 'んお' },
  ];
  
  // Try each replacement pattern
  for (const replacement of replacements) {
    if (userAnswer.includes(replacement.from)) {
      // Try replacing all occurrences
      const correctedAnswer = userAnswer.replace(new RegExp(replacement.from, 'g'), replacement.to);
      
      if (correctedAnswer === correctAnswer) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Converts katakana to hiragana
 */
export function convertKatakanaToHiragana(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Check if it's a katakana character
    if (charCode >= 0x30A0 && charCode <= 0x30FF) {
      // Convert to hiragana by shifting the character code
      result += String.fromCharCode(charCode - 0x60);
    } else {
      result += text[i];
    }
  }
  return result;
}

/**
 * Converts romaji to hiragana using wanakana
 */
export function convertRomajiToHiragana(text: string): string {
  // Use wanakana with IMEMode: false to fully convert all romaji
  // This properly handles double consonants and complex romaji patterns
  return wanakana.toHiragana(text, { IMEMode: false });
}

function normalizeReadingForLookup(text: string | null | undefined): string {
  const normalizedText = (text || "").normalize("NFKC").trim().replace(/\s+/g, "");
  if (!normalizedText) {
    return "";
  }

  const hiraganaText = convertKatakanaToHiragana(normalizedText);
  if (/[A-Za-z]/.test(hiraganaText)) {
    return convertRomajiToHiragana(hiraganaText);
  }

  return hiraganaText;
}

function getSingleKanjiVocabularyCharacter(subject: Subject): string | null {
  if (subject.object !== "vocabulary") {
    return null;
  }

  const subjectCharacters = (subject.data.characters || "").normalize("NFKC").trim();
  return SINGLE_KANJI_ONLY_REGEX.test(subjectCharacters) ? subjectCharacters : null;
}

/**
 * Normalizes a string for comparison
 */
export function normalizeString(text: string, taskType: 'meaning' | 'reading'): string {
  let s = text
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/\//g, "");
  
  if (taskType === 'reading') {
    s = s.replace(/n/g, "ん");
    s = s.replace(/ｎ/g, "ん"); // Gboard Godan layout uses "ｎ"
    s = s.replace(/ /g, "");
  }
  
  return s;
}

/**
 * Main function to check if an answer is correct
 */
export function checkAnswerWithDetails(
  answer: string,
  subject: Subject,
  taskType: 'meaning' | 'reading',
  studyMaterials?: { meaning_synonyms?: string[] },
  checkerContext?: AnswerCheckerContext
): AnswerCheckerResult {
  // Normalize user answer
  const userAnswer = normalizeString(answer, taskType);
  
  switch (taskType) {
    case 'reading': {
      const hiraganaText = convertKatakanaToHiragana(userAnswer);

      // Check for invalid characters
      const nonKanaRanges = findNonKanaRanges(userAnswer);
      if (nonKanaRanges.length > 0) {
        // If the user entered the actual subject characters (kanji), provide clearer feedback.
        const rawAnswer = answer.trim().replace(/\s/g, '');
        const subjectCharacters = subject.data.characters?.trim().replace(/\s/g, '');
        if (
          subjectCharacters &&
          KANJI_REGEX.test(rawAnswer) &&
          (rawAnswer === subjectCharacters ||
            rawAnswer.replace(/^〜/, '') === subjectCharacters.replace(/^〜/, ''))
        ) {
          return AnswerCheckerResult.IsKanjiButWantReading;
        }

        return AnswerCheckerResult.ContainsInvalidCharacters;
      }
      
      // Check if user entered a meaning when reading was expected
      // First normalize the user answer as if it were a meaning
      const normalizedAsMeaning = normalizeString(answer, 'meaning');
      
      // Check against all meanings
      for (const meaning of subject.data.meanings || []) {
        if (normalizeString(meaning.meaning, 'meaning') === normalizedAsMeaning) {
          return AnswerCheckerResult.IsMeaningButWantReading;
        }
      }
      
      // Check against study materials meanings/synonyms
      if (studyMaterials?.meaning_synonyms) {
        for (const synonym of studyMaterials.meaning_synonyms) {
          if (normalizeString(synonym, 'meaning') === normalizedAsMeaning) {
            return AnswerCheckerResult.IsMeaningButWantReading;
          }
        }
      }
      
      // Check all readings and determine the appropriate result
      const allReadings = subject.data.readings || [];
      let matchedReading = null;

      // First, find any matching reading
      for (const reading of allReadings) {
        if (reading.reading === hiraganaText) {
          matchedReading = reading;
          break;
        }

        // Convert katakana readings to hiragana for comparison
        const hiraganaReading = convertKatakanaToHiragana(reading.reading);
        if (hiraganaReading === hiraganaText) {
          matchedReading = reading;
          break;
        }
      }
      
      // If we found a matching reading, determine the result
      if (matchedReading) {
        // For kanji, check if this is the primary reading
        if (subject.object === 'kanji') {
          if (matchedReading.primary) {
            return AnswerCheckerResult.Precise;
          }

          const shouldAcceptAnyOnyomiReading =
            checkerContext?.acceptAnyKanjiOnyomiReading === true &&
            matchedReading.type === "onyomi";

          if (shouldAcceptAnyOnyomiReading) {
            return AnswerCheckerResult.Precise;
          }

          // This is a valid reading but not the primary one - treat as warning
          return AnswerCheckerResult.WrongReadingType;
        } else {
          // For vocabulary, any valid reading is acceptable
          return AnswerCheckerResult.Precise;
        }
      }

      // For single-kanji vocabulary, treat kanji-only readings as a retryable warning.
      // Example: vocab 生(なま) answered as せい should shake with "kanji reading" feedback.
      const singleKanjiVocabularyCharacter = getSingleKanjiVocabularyCharacter(subject);
      const kanjiReadings =
        singleKanjiVocabularyCharacter && checkerContext?.singleKanjiReadings
          ? checkerContext.singleKanjiReadings[singleKanjiVocabularyCharacter] || []
          : [];
      if (kanjiReadings.length > 0) {
        const normalizedKanjiReadings = new Set<string>();
        for (const reading of kanjiReadings) {
          const normalizedReading = normalizeReadingForLookup(reading);
          if (normalizedReading) {
            normalizedKanjiReadings.add(normalizedReading);
          }
        }

        if (normalizedKanjiReadings.has(hiraganaText)) {
          return AnswerCheckerResult.OtherKanjiReading;
        }
      }
      
      // Check for common 'n' conversion mistake before marking as incorrect
      for (const reading of allReadings) {
        const hiraganaReading = convertKatakanaToHiragana(reading.reading);
        if (hasNConversionMistake(hiraganaText, hiraganaReading)) {
          return AnswerCheckerResult.IncorrectNConversion;
        }
      }

      return AnswerCheckerResult.Incorrect;
    }
    
    case 'meaning': {
      // Check blacklisted meanings first
      const blacklistedMeanings = subject.data.auxiliary_meanings?.filter(m => m.type === 'blacklist') || [];
      for (const meaning of blacklistedMeanings) {
        if (normalizeString(meaning.meaning, taskType) === userAnswer) {
          return AnswerCheckerResult.Incorrect;
        }
      }
      
      // Gather all possible meanings
      const meaningTexts: string[] = [];
      
      // Add meanings from study materials (synonyms)
      if (studyMaterials?.meaning_synonyms) {
        meaningTexts.push(...studyMaterials.meaning_synonyms);
      }
      
      // Add meanings from the subject
      for (const meaning of subject.data.meanings) {
        meaningTexts.push(meaning.meaning);
      }
      
      // Add whitelisted auxiliary meanings
      const whitelistedMeanings = subject.data.auxiliary_meanings?.filter(m => m.type === 'whitelist') || [];
      for (const meaning of whitelistedMeanings) {
        meaningTexts.push(meaning.meaning);
      }
      
      // Check for exact matches FIRST (before checking if it's a reading)
      for (const meaning of meaningTexts) {
        if (normalizeString(meaning, taskType) === userAnswer) {
          return AnswerCheckerResult.Precise;
        }
      }
      
      // Check for close matches (accounting for typos) BEFORE checking if it's a reading
      for (const meaning of meaningTexts) {
        const normalizedMeaning = normalizeString(meaning, taskType);
        const distance = levenshteinDistance(userAnswer, normalizedMeaning);
        const tolerance = distanceTolerance(normalizedMeaning);
        
        if (distance <= tolerance) {
          return AnswerCheckerResult.Imprecise;
        }
      }
      
      // Only check if user entered a reading AFTER checking if it's a valid meaning
      // This ensures that if a reading matches a meaning, the correct answer takes precedence
      if (subject.data.readings) {
        // Convert the user answer to kana for comparison
        // Try both direct kana conversion and romaji-to-hiragana conversion
        const originalAnswer = answer.trim();
        const hiraganaAnswer = convertKatakanaToHiragana(originalAnswer);
        const romajiToHiraganaAnswer = convertRomajiToHiragana(originalAnswer);
        
        for (const reading of subject.data.readings) {
          const hiraganaReading = convertKatakanaToHiragana(reading.reading);
          
          // Check direct kana match
          if (hiraganaAnswer === hiraganaReading) {
            return AnswerCheckerResult.IsReadingButWantMeaning;
          }
          
          // Check romaji converted to hiragana match
          if (romajiToHiraganaAnswer === hiraganaReading) {
            return AnswerCheckerResult.IsReadingButWantMeaning;
          }
        }
      }
      
      // Check for Japanese characters in the answer (after all other checks)
      const japaneseRanges = findJapaneseRanges(userAnswer);
      if (japaneseRanges.length > 0) {
        return AnswerCheckerResult.ContainsInvalidCharacters;
      }
      
      return AnswerCheckerResult.Incorrect;
    }
    
    default:
      return AnswerCheckerResult.Incorrect;
  }
}

/**
 * Simplified function that just returns if the answer is correct or not
 */
export function isAnswerCorrect(
  answer: string,
  subject: Subject,
  taskType: 'meaning' | 'reading',
  studyMaterials?: { meaning_synonyms?: string[] },
  checkerContext?: AnswerCheckerContext
): boolean {
  const result = checkAnswerWithDetails(answer, subject, taskType, studyMaterials, checkerContext);
  return result === AnswerCheckerResult.Precise || result === AnswerCheckerResult.Imprecise;
}

/**
 * Checks if the answer should be treated as a warning (neither correct nor incorrect)
 */
export function isAnswerWarning(
  answer: string,
  subject: Subject,
  taskType: 'meaning' | 'reading',
  studyMaterials?: { meaning_synonyms?: string[] },
  checkerContext?: AnswerCheckerContext
): boolean {
  const result = checkAnswerWithDetails(answer, subject, taskType, studyMaterials, checkerContext);
  return result === AnswerCheckerResult.WrongReadingType || 
         result === AnswerCheckerResult.OtherKanjiReading ||
         result === AnswerCheckerResult.IsKanjiButWantReading ||
         result === AnswerCheckerResult.IsReadingButWantMeaning ||
         result === AnswerCheckerResult.IsMeaningButWantReading ||
         result === AnswerCheckerResult.IncorrectNConversion;
}

/**
 * Returns helpful feedback message based on the answer checker result
 */
export function getAnswerFeedback(
  result: AnswerCheckerResult,
  taskType: 'meaning' | 'reading'
): string {
  switch (result) {
    case AnswerCheckerResult.Precise:
      return 'Correct!';
    case AnswerCheckerResult.Imprecise:
      return 'Correct, with a small typo.';
    case AnswerCheckerResult.OtherKanjiReading:
      return 'This is a reading for the individual kanji, not the vocabulary.';
    case AnswerCheckerResult.WrongReadingType:
      return 'This is a valid reading, but WaniKani is looking for the primary reading (highlighted in the kanji details).';
    case AnswerCheckerResult.MismatchingOkurigana:
      return 'Check your okurigana.';
    case AnswerCheckerResult.ContainsInvalidCharacters:
      return taskType === 'meaning' 
        ? 'Your answer contains Japanese characters.' 
        : 'Your answer contains non-kana characters.';
    case AnswerCheckerResult.IsKanjiButWantReading:
      return 'You entered the kanji/characters, but we want the reading.';
    case AnswerCheckerResult.IsReadingButWantMeaning:
      return 'You entered the reading, but we want the meaning.';
    case AnswerCheckerResult.IsMeaningButWantReading:
      return 'You entered the meaning, but we want the reading.';
    case AnswerCheckerResult.IncorrectNConversion:
      return 'Try typing "nn" for ん before vowels or y.';
    case AnswerCheckerResult.Incorrect:
      return 'Incorrect answer.';
    default:
      return 'Incorrect.';
  }
} 
