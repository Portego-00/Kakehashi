import { AnswerCheckerResult, convertKatakanaToHiragana, normalizeString } from './answerChecker';

// Export elements from answerChecker for backward compatibility
export { AnswerCheckerResult, convertKatakanaToHiragana, normalizeString };

/**
 * Checks if the character at the given position should be converted to a small tsu (っ)
 * based on double consonant rules
 */
function isDoubleConsonant(text: string, position: number): boolean {
  const doubleConsonantLetters = ['k', 's', 't', 'p', 'c', 'h', 'f', 'j', 'g', 'z', 'd', 'b'];
  if (position < text.length - 1) {
    const currChar = text[position].toLowerCase();
    const nextChar = text[position + 1].toLowerCase();
    
    // Check for standard double consonants
    if (doubleConsonantLetters.includes(currChar) && currChar === nextChar) {
      return true;
    }
    
    // Check for special cases like 'tch' where 't' creates a small tsu
    if (position < text.length - 2) {
      const twoChars = text.substring(position, position + 2).toLowerCase();
      const threeChars = text.substring(position, position + 3).toLowerCase();
      
      if ((currChar === 't' && twoChars === 'tc') || 
          (currChar === 't' && threeChars === 'tch')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Japanese IME input handler class that provides stateful Japanese input
 * conversion from romaji to hiragana.
 */
export class JapaneseInputHandler {
  private buffer: string = '';
  private result: string = '';
  public isKatakana: boolean = false;
  // Flag to track if the last character was an 'n'
  private pendingN: boolean = false;

  /**
   * Creates a new Japanese input handler
   * @param isKatakana Whether to output katakana instead of hiragana
   */
  constructor(isKatakana: boolean = false) {
    this.isKatakana = isKatakana;
  }

  /**
   * Reset the input state
   */
  reset(): void {
    this.buffer = '';
    this.result = '';
    this.pendingN = false;
  }

  /**
   * Set whether to output katakana instead of hiragana
   */
  setKatakana(isKatakana: boolean): void {
    this.isKatakana = isKatakana;
  }

  /**
   * Get the current converted text
   */
  getCurrentText(): string {
    return this.result;
  }
  
  /**
   * Get the current buffer for debugging
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Process any pending characters in the buffer and add them to the result
   */
  flushBuffer(): void {
    if (this.buffer.length > 0) {
      // Process any remaining characters in the buffer
      let match = '';
      
      // Special handling for 'n' at the end
      if (this.buffer === 'n') {
        match = 'ん';
        this.pendingN = false;
      } else {
        // Look for a mapping for the whole buffer
        match = romajiMap[this.buffer] || '';
        
        // If no match found, process each character individually
        if (!match) {
          for (let i = 0; i < this.buffer.length; i++) {
            const char = this.buffer[i];
            match += romajiMap[char] || char;
          }
        }
      }
      
      // Add the match to the result
      this.result += this.isKatakana ? hiraganaToKatakana(match) : match;
      this.buffer = '';
    }
    
    this.pendingN = false;
  }

  /**
   * Process a single input character and return the current converted text
   * @param input The input character
   * @param isBackspace Whether this is a backspace operation
   * @returns The current converted text
   */
  processInput(input: string, isBackspace: boolean = false): string {
    // Handle backspace
    if (isBackspace) {
      if (this.buffer.length > 0) {
        // If the buffer has 'n' and pendingN is true, reset pendingN
        if (this.buffer === 'n' && this.pendingN) {
          this.pendingN = false;
        }
        
        // Remove the last character from the buffer
        this.buffer = this.buffer.substring(0, this.buffer.length - 1);
      } else if (this.result.length > 0) {
        // Remove the last character from the result
        this.result = this.result.substring(0, this.result.length - 1);
      }
      return this.result;
    }
    
    // If input is empty or null (but not backspace), return current result
    if (!input) {
      return this.result;
    }

    // Convert to lowercase for consistent processing
    input = input.toLowerCase();
    
    // Special handling for 'n' sequences
    if (this.buffer === 'n') {
      // If 'n' is followed by another 'n', convert the first 'n' to 'ん'
      if (input === 'n') {
        this.result += this.isKatakana ? 'ン' : 'ん';
        this.buffer = 'n';  // Keep the second 'n' in the buffer
        this.pendingN = true;
        return this.result;
      }
      
      // If 'n' is followed by a valid vowel or 'y', let the normal processing handle it
      // as it will form 'na', 'ni', 'nu', 'ne', 'no', 'nya', 'nyu', 'nyo'
      if ('aiueoy'.includes(input)) {
        this.buffer += input;
      } else {
        // If 'n' is followed by any other consonant, convert 'n' to 'ん'
        // and start a new buffer with the consonant
        this.result += this.isKatakana ? 'ン' : 'ん';
        this.buffer = input;
        this.pendingN = false;
        return this.result;
      }
    } else {
      // Normal case, just add to buffer
      this.buffer += input;
    }
    
    // Try to match longer sequences first
    for (let i = this.buffer.length; i > 0; i--) {
      const sequence = this.buffer.substring(0, i);
      
      // Search in the romaji map
      const match = romajiMap[sequence];
      if (match) {
        // Found a match, add it to result and remove from buffer
        this.result += this.isKatakana ? hiraganaToKatakana(match) : match;
        this.buffer = this.buffer.substring(i);
        
        // If we've consumed the whole buffer, we're done
        if (this.buffer.length === 0) {
          return this.result;
        }
        
        // If there's still content in the buffer, start from the beginning
        i = this.buffer.length + 1;
        continue;
      }
      
      // Check for double consonants (small tsu)
      if (i >= 2 && isDoubleConsonant(sequence, 0)) {
        const smallTsu = this.isKatakana ? 'ッ' : 'っ';
        this.result += smallTsu;
        this.buffer = this.buffer.substring(1);
        
        // Restart from the beginning with the new buffer
        i = this.buffer.length + 1;
        continue;
      }
    }
    
    return this.result;
  }
}

/**
 * Convert hiragana to katakana
 * @param text Hiragana text to convert
 * @returns Katakana conversion
 */
function hiraganaToKatakana(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    // Check if it's a hiragana character
    if (char >= 0x3041 && char <= 0x3096) {
      // Convert to katakana by adding the offset
      result += String.fromCharCode(char + 0x60);
    } else {
      result += text[i];
    }
  }
  return result;
}

// Romaji to Hiragana mapping
const romajiMap: Record<string, string> = {
  // Basic characters
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'sa': 'さ', 'shi': 'し', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'ta': 'た', 'chi': 'ち', 'ti': 'ち', 'tsu': 'つ', 'tu': 'つ', 'te': 'て', 'to': 'と',
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  'wa': 'わ', 'wo': 'を', 'nn': 'ん', 'n\'': 'ん',
  
  // Dakuten
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'za': 'ざ', 'ji': 'じ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  
  // Small ya, yu, yo
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  
  // Various other combinations
  'dzu': 'づ',
  'fa': 'ふぁ', 'fi': 'ふぃ', 'fe': 'ふぇ', 'fo': 'ふぉ',
  'va': 'ゔぁ', 'vi': 'ゔぃ', 'vu': 'ゔ', 've': 'ゔぇ', 'vo': 'ゔぉ',
  'la': 'ら', 'li': 'り', 'lu': 'る', 'le': 'れ', 'lo': 'ろ',
  'qa': 'くぁ', 'qi': 'くぃ', 'qe': 'くぇ', 'qo': 'くぉ',
  'tya': 'ちゃ', 'tyi': 'ちぃ', 'tyu': 'ちゅ', 'tye': 'ちぇ', 'tyo': 'ちょ',
  'wyi': 'ゐ', 'wye': 'ゑ',
};

/**
 * Converts romaji input to hiragana
 * @deprecated Use the JapaneseInputHandler class for incremental input
 * @param romaji Input text in romaji
 * @returns Converted text in hiragana
 */
export function romajiToHiraganaConverter(romaji: string): string {
  const handler = new JapaneseInputHandler();
  for (const char of romaji) {
    handler.processInput(char);
  }
  handler.flushBuffer();
  return handler.getCurrentText();
}

/**
 * Checks if the answer is correct, with flexibility for minor typos
 * @deprecated Use checkAnswerWithDetails or isAnswerCorrect from answerChecker.ts instead
 */
export function checkAnswer(userAnswer: string, correctAnswers: string[]): boolean {
  // Empty answers are always wrong
  if (!userAnswer.trim()) return false;
  
  // Normalize user answer: lowercase, trim, remove punctuation
  const normalizedUserAnswer = userAnswer.toLowerCase().trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  
  // Check against all possible correct answers
  return correctAnswers.some(answer => {
    const normalizedAnswer = answer.toLowerCase().trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Exact match check
    if (normalizedUserAnswer === normalizedAnswer) return true;
    
    // Allow minor typos based on string length
    const maxAllowedDistance = Math.min(
      2,  // Maximum of 2 typos allowed
      Math.floor(normalizedAnswer.length / 5) + 1  // Or 1 typo per 5 characters
    );
    
    // Short answers require exact matches
    if (normalizedAnswer.length < 4) return normalizedUserAnswer === normalizedAnswer;
    
    // Check for typos using Levenshtein distance
    const distance = levenshteinDistance(normalizedUserAnswer, normalizedAnswer);
    return distance <= maxAllowedDistance;
  });
}

/**
 * Compares hiragana reading answers
 * @deprecated Use checkAnswerWithDetails or isAnswerCorrect from answerChecker.ts instead
 */
export function checkReadingAnswer(userReading: string, correctReadings: string[]): boolean {
  // For reading answers, we'll only do basic normalization
  const normalizedUserReading = userReading.trim();
  
  return correctReadings.some(reading => 
    normalizedUserReading === reading.trim()
  );
}

/**
 * Helper function to calculate Levenshtein distance
 * @deprecated Use the implementation in answerChecker.ts instead
 */
function levenshteinDistance(a: string, b: string): number {
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
