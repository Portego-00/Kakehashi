import { toHiragana } from "wanakana";

/** Convert completed romaji syllables while leaving an unfinished syllable editable. */
export function composeKanaInput(value: string): string {
  return toHiragana(value.normalize("NFKC"), { IMEMode: true });
}

/** Finish pending syllables only when the learner submits the answer. */
export function finalizeKanaInput(value: string): string {
  return toHiragana(value.normalize("NFKC"), { IMEMode: false });
}
