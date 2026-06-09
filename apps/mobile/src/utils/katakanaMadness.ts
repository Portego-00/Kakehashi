/**
 * Katakana Madness Utility
 *
 * Converts hiragana characters to katakana.
 * Based on the WaniKani userscript "Katakana Madness"
 * https://greasyfork.org/en/scripts/26481-wanikani-katakana-madness
 *
 * On'yomi (Chinese readings) are traditionally written in katakana,
 * while Kun'yomi (Japanese readings) are written in hiragana.
 */

// Hiragana to Katakana mapping
const hiraganaToKatakana: Record<string, string> = {
  // Basic vowels
  あ: "ア",
  い: "イ",
  う: "ウ",
  え: "エ",
  お: "オ",
  // K-row
  か: "カ",
  き: "キ",
  く: "ク",
  け: "ケ",
  こ: "コ",
  // S-row
  さ: "サ",
  し: "シ",
  す: "ス",
  せ: "セ",
  そ: "ソ",
  // T-row
  た: "タ",
  ち: "チ",
  つ: "ツ",
  て: "テ",
  と: "ト",
  // N-row
  な: "ナ",
  に: "ニ",
  ぬ: "ヌ",
  ね: "ネ",
  の: "ノ",
  // H-row
  は: "ハ",
  ひ: "ヒ",
  ふ: "フ",
  へ: "ヘ",
  ほ: "ホ",
  // M-row
  ま: "マ",
  み: "ミ",
  む: "ム",
  め: "メ",
  も: "モ",
  // Y-row
  や: "ヤ",
  ゆ: "ユ",
  よ: "ヨ",
  // R-row
  ら: "ラ",
  り: "リ",
  る: "ル",
  れ: "レ",
  ろ: "ロ",
  // W-row
  わ: "ワ",
  を: "ヲ",
  // N
  ん: "ン",
  // Dakuten (voiced)
  が: "ガ",
  ぎ: "ギ",
  ぐ: "グ",
  げ: "ゲ",
  ご: "ゴ",
  ざ: "ザ",
  じ: "ジ",
  ず: "ズ",
  ぜ: "ゼ",
  ぞ: "ゾ",
  だ: "ダ",
  ぢ: "ヂ",
  づ: "ヅ",
  で: "デ",
  ど: "ド",
  ば: "バ",
  び: "ビ",
  ぶ: "ブ",
  べ: "ベ",
  ぼ: "ボ",
  // Handakuten (semi-voiced)
  ぱ: "パ",
  ぴ: "ピ",
  ぷ: "プ",
  ぺ: "ペ",
  ぽ: "ポ",
  // Small characters
  ぁ: "ァ",
  ぃ: "ィ",
  ぅ: "ゥ",
  ぇ: "ェ",
  ぉ: "ォ",
  ゃ: "ャ",
  ゅ: "ュ",
  ょ: "ョ",
  っ: "ッ",
  // Long vowel mark (already katakana, but include for completeness)
  ー: "ー",
};

/**
 * Converts a string from hiragana to katakana.
 * Non-hiragana characters are left unchanged.
 *
 * @param text - The text to convert
 * @returns The converted text with hiragana replaced by katakana
 */
export function hiraganaToKata(text: string): string {
  if (!text) return text;

  return text
    .split("")
    .map((char) => hiraganaToKatakana[char] || char)
    .join("");
}

/**
 * Converts on'yomi reading to katakana if the setting is enabled.
 * This is a convenience function that checks the setting before converting.
 *
 * @param reading - The reading text to potentially convert
 * @param isOnyomi - Whether this is an on'yomi reading
 * @param showInKatakana - Whether the setting is enabled
 * @returns The reading, converted to katakana if applicable
 */
export function formatOnyomiReading(
  reading: string,
  isOnyomi: boolean,
  showInKatakana: boolean
): string {
  if (!reading) return reading;

  if (isOnyomi && showInKatakana) {
    return hiraganaToKata(reading);
  }

  return reading;
}
