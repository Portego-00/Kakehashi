// Manual test script

// Manual test of romaji to hiragana conversion
function isDoubleConsonant(text, position) {
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

// Romaji to Hiragana mapping
const romajiToHiragana = {
  // Basic characters
  "a": "あ", "i": "い", "u": "う", "e": "え", "o": "お",
  "ka": "か", "ki": "き", "ku": "く", "ke": "け", "ko": "こ",
  "sa": "さ", "shi": "し", "si": "し", "su": "す", "se": "せ", "so": "そ",
  "ta": "た", "chi": "ち", "ti": "ち", "tsu": "つ", "tu": "つ", "te": "て", "to": "と",
  "na": "な", "ni": "に", "nu": "ぬ", "ne": "ね", "no": "の",
  "ha": "は", "hi": "ひ", "fu": "ふ", "hu": "ふ", "he": "へ", "ho": "ほ",
  "ma": "ま", "mi": "み", "mu": "む", "me": "め", "mo": "も",
  "ya": "や", "yu": "ゆ", "yo": "よ",
  "ra": "ら", "ri": "り", "ru": "る", "re": "れ", "ro": "ろ",
  "wa": "わ", "wo": "を", "nn": "ん", "n": "ん",
  
  // Dakuten characters
  "ga": "が", "gi": "ぎ", "gu": "ぐ", "ge": "げ", "go": "ご",
  "za": "ざ", "ji": "じ", "zi": "じ", "zu": "ず", "ze": "ぜ", "zo": "ぞ",
  "da": "だ", "di": "ぢ", "du": "づ", "de": "で", "do": "ど",
  "ba": "ば", "bi": "び", "bu": "ぶ", "be": "べ", "bo": "ぼ",
  "pa": "ぱ", "pi": "ぴ", "pu": "ぷ", "pe": "ぺ", "po": "ぽ",
  
  // Small characters
  "kya": "きゃ", "kyu": "きゅ", "kyo": "きょ",
  "sha": "しゃ", "sya": "しゃ", "shu": "しゅ", "syu": "しゅ", "sho": "しょ", "syo": "しょ", 
  "cha": "ちゃ", "tya": "ちゃ", "chu": "ちゅ", "tyu": "ちゅ", "cho": "ちょ", "tyo": "ちょ",
  "nya": "にゃ", "nyu": "にゅ", "nyo": "にょ",
  "hya": "ひゃ", "hyu": "ひゅ", "hyo": "ひょ",
  "mya": "みゃ", "myu": "みゅ", "myo": "みょ",
  "rya": "りゃ", "ryu": "りゅ", "ryo": "りょ",
  "gya": "ぎゃ", "gyu": "ぎゅ", "gyo": "ぎょ",
  "ja": "じゃ", "jya": "じゃ", "ju": "じゅ", "jyu": "じゅ", "jo": "じょ", "jyo": "じょ",
  "bya": "びゃ", "byu": "びゅ", "byo": "びょ",
  "pya": "ぴゃ", "pyu": "ぴゅ", "pyo": "ぴょ",
  
  // Small tsu for doubled consonants is handled separately
  "ltsu": "っ", "xtsu": "っ", "ltu": "っ", "xtu": "っ",
  
  // Small vowels
  "la": "ぁ", "xa": "ぁ", "li": "ぃ", "xi": "ぃ", "lu": "ぅ", "xu": "ぅ", 
  "le": "ぇ", "xe": "ぇ", "lo": "ぉ", "xo": "ぉ",
  
  // Additional common kana combinations
  "dya": "ぢゃ", "dyu": "ぢゅ", "dyo": "ぢょ",
  "fya": "ふゃ", "fyu": "ふゅ", "fyo": "ふょ",
  "wi": "うぃ", "we": "うぇ", 
  
  // N with apostrophe handling
  "n'a": "んあ", "n'i": "んい", "n'u": "んう", "n'e": "んえ", "n'o": "んお",
  "n'ya": "んや", "n'yu": "んゆ", "n'yo": "んよ"
};

// Vowels and consonants for special 'n' handling
const VOWELS = ['a', 'i', 'u', 'e', 'o', 'y'];
const CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'];

function romajiToHiraganaConverter(romaji) {
  let result = '';
  let pending = romaji.toLowerCase();
  
  while (pending.length > 0) {
    let matched = false;
    
    // Handle special case: double consonants (small tsu)
    if (pending.length > 1 && isDoubleConsonant(pending, 0)) {
      result += 'っ';
      pending = pending.substring(1);
      continue;
    }
    
    // Try to match the longest possible romaji sequence
    // Check 3-character sequences first
    if (pending.length >= 3) {
      const threeChars = pending.substring(0, 3);
      if (romajiToHiragana[threeChars]) {
        result += romajiToHiragana[threeChars];
        pending = pending.substring(3);
        matched = true;
        continue;
      }
    }
    
    // Check 2-character sequences
    if (!matched && pending.length >= 2) {
      const twoChars = pending.substring(0, 2);
      if (romajiToHiragana[twoChars]) {
        result += romajiToHiragana[twoChars];
        pending = pending.substring(2);
        matched = true;
        continue;
      }
    }
    
    // Special handling for 'n'
    if (!matched && pending[0] === 'n') {
      // Handle 'n' specially to ensure that sequences like 'ni' give 'に' and not 'んい'
      
      // If it's an 'n' at the end of the input, convert to 'ん'
      if (pending.length === 1) {
        result += 'ん';
        pending = pending.substring(1);
        matched = true;
        continue;
      }
      
      // Check if the next character would form a valid syllable with 'n'
      // Examples: 'na', 'ni', 'nya', etc.
      if (pending.length >= 2) {
        const nextChar = pending[1];
        const twoChars = pending.substring(0, 2);
        
        // If next character is a vowel or 'y' AND the two-character combo is in the mapping,
        // we should let the two-character handling above process it in the next iteration
        if ((VOWELS.includes(nextChar) || nextChar === 'y') && 
            ((pending.length >= 3 && romajiToHiragana[pending.substring(0, 3)]) || 
             romajiToHiragana[twoChars])) {
          // Do nothing here, let it be handled by the 2-char or 3-char logic above
          // in the next iteration after we've determined n is not standalone
        } 
        // If 'n' is followed by apostrophe, skip and let the n' prefixes handle it
        else if (nextChar === "'") {
          // Do nothing, let the n' patterns be handled
        }
        // Otherwise 'n' is standalone (followed by a consonant or something else)
        else {
          result += 'ん';
          pending = pending.substring(1);
          matched = true;
          continue;
        }
      }
    }
    
    // Default: handle single characters
    if (!matched) {
      const oneChar = pending.substring(0, 1);
      if (romajiToHiragana[oneChar]) {
        result += romajiToHiragana[oneChar];
      } else {
        // Pass through characters that don't match
        result += oneChar;
      }
      pending = pending.substring(1);
    }
  }
  
  return result;
}

// Test cases
console.log('Testing ni:', romajiToHiraganaConverter('ni'));
console.log('Testing niku:', romajiToHiraganaConverter('niku'));
console.log('Testing nino:', romajiToHiraganaConverter('nino'));
console.log('Testing nya:', romajiToHiraganaConverter('nya'));
console.log('Testing n:', romajiToHiraganaConverter('n'));
console.log('Testing n\'i:', romajiToHiraganaConverter('n\'i'));
console.log('Testing shin:', romajiToHiraganaConverter('shin'));
console.log('Testing shinda:', romajiToHiraganaConverter('shinda'));
console.log('Testing shinwa:', romajiToHiraganaConverter('shinwa'));
