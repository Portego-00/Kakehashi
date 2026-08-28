import { toHiragana } from "wanakana";

/** Convert completed romaji syllables while leaving an unfinished syllable editable. */
export function composeKanaInput(value: string): string {
  return toHiragana(value.normalize("NFKC"), { IMEMode: true });
}
