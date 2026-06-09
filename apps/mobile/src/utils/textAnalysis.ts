import { Subject } from './api';

export interface FoundSubject {
  id: number;
  characters: string;
  meaning: string;
  type: string;
  level: number;
  position: number;
  length: number;
}

export interface TextSegment {
  text: string;
  isSubject: boolean;
  subject?: FoundSubject;
}

/**
 * Analyzes Japanese text and finds WaniKani subjects within it
 * @param text The Japanese text to analyze
 * @param allSubjects Array of all cached subjects
 * @returns Array of found subjects with their positions
 */
export function analyzeJapaneseText(text: string, allSubjects: Subject[]): FoundSubject[] {
  const matches: FoundSubject[] = [];
  const matchedPositions: { start: number; end: number }[] = [];

  // Sort subjects by character length (longest first) to prioritize longer matches
  const sortedSubjects = allSubjects
    .filter(subject => subject.data.characters && subject.data.characters.trim().length > 0)
    .sort((a, b) => (b.data.characters?.length || 0) - (a.data.characters?.length || 0));

  for (const subject of sortedSubjects) {
    const characters = subject.data.characters;
    if (!characters) continue;

    let searchIndex = 0;
    while (searchIndex < text.length) {
      const foundIndex = text.indexOf(characters, searchIndex);
      if (foundIndex === -1) break;

      // Check if this position is already covered by a longer match
      const isOverlapping = matchedPositions.some(pos => 
        foundIndex < pos.end && foundIndex + characters.length > pos.start
      );

      if (!isOverlapping) {
        const primaryMeaning = subject.data.meanings.find(m => m.primary)?.meaning || 
                             subject.data.meanings[0]?.meaning || '';

        matches.push({
          id: subject.id,
          characters: characters,
          meaning: primaryMeaning,
          type: subject.object,
          level: subject.data.level || 1,
          position: foundIndex,
          length: characters.length
        });

        matchedPositions.push({
          start: foundIndex,
          end: foundIndex + characters.length
        });
      }

      searchIndex = foundIndex + 1;
    }
  }

  // Sort matches by position in text
  matches.sort((a, b) => a.position - b.position);

  // Remove duplicate subjects (keep the first occurrence)
  const uniqueMatches = matches.filter((match, index, array) => 
    array.findIndex(m => m.id === match.id) === index
  );

  return uniqueMatches;
}

/**
 * Creates text segments for display, highlighting found subjects
 * @param text The original text
 * @param subjects Array of found subjects
 * @returns Array of text segments for rendering
 */
export function createTextSegments(text: string, subjects: FoundSubject[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  // Sort subjects by position
  const sortedSubjects = [...subjects].sort((a, b) => a.position - b.position);

  for (const subject of sortedSubjects) {
    // Add text before this subject
    if (currentIndex < subject.position) {
      const beforeText = text.substring(currentIndex, subject.position);
      if (beforeText.length > 0) {
        segments.push({
          text: beforeText,
          isSubject: false
        });
      }
    }

    // Add the subject
    segments.push({
      text: subject.characters,
      isSubject: true,
      subject: subject
    });

    currentIndex = subject.position + subject.length;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText.length > 0) {
      segments.push({
        text: remainingText,
        isSubject: false
      });
    }
  }

  return segments;
}

/**
 * Cleans and normalizes Japanese text for better analysis
 * @param text Raw text from OCR
 * @returns Cleaned text
 */
export function cleanJapaneseText(text: string): string {
  return text
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[。、！？]/g, '') // Remove common punctuation
    .trim();
}

/**
 * Splits Japanese text into potential word boundaries for better analysis
 * This is a simple implementation - a more sophisticated version would use
 * a proper Japanese tokenizer like MeCab
 * @param text Japanese text
 * @returns Array of potential text chunks
 */
export function segmentJapaneseText(text: string): string[] {
  // Simple segmentation based on character types
  const segments: string[] = [];
  let currentSegment = '';
  let lastCharType: 'hiragana' | 'katakana' | 'kanji' | 'other' | null = null;

  for (const char of text) {
    const charType = getCharacterType(char);
    
    if (lastCharType && lastCharType !== charType && charType !== 'other') {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = '';
      }
    }
    
    currentSegment += char;
    if (charType !== 'other') {
      lastCharType = charType;
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment);
  }
  
  return segments.filter(segment => segment.trim().length > 0);
}

function getCharacterType(char: string): 'hiragana' | 'katakana' | 'kanji' | 'other' {
  const code = char.charCodeAt(0);
  
  // Hiragana: U+3040-U+309F
  if (code >= 0x3040 && code <= 0x309F) {
    return 'hiragana';
  }
  
  // Katakana: U+30A0-U+30FF
  if (code >= 0x30A0 && code <= 0x30FF) {
    return 'katakana';
  }
  
  // CJK Unified Ideographs (Kanji): U+4E00-U+9FAF
  if (code >= 0x4E00 && code <= 0x9FAF) {
    return 'kanji';
  }
  
  return 'other';
} 