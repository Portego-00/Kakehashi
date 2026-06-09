import { toHiragana } from "wanakana";

const spaceToLongVowelMarkMapping: Record<string, string> = {
  " ": "ー",
  "　": "ー",
};

const hiraganaCharacterPattern = /[\u3040-\u309fー]/;

export function convertToHiragana(value: string, imeMode = true): string {
  return toHiragana(value, {
    IMEMode: imeMode,
    customKanaMapping: spaceToLongVowelMarkMapping,
  });
}

export function getCompleteHiraganaCharacters(value: string): string[] {
  return Array.from(convertToHiragana(value, true)).filter((character) =>
    hiraganaCharacterPattern.test(character)
  );
}

export function getFinalHiraganaInput(value: string): string {
  return convertToHiragana(value, false).trim();
}
