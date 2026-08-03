import { KANJI_ETYMOLOGIES } from "./kanjiEtymology.generated";

export type KanjiEtymologyKind =
  | "ideographic"
  | "pictographic"
  | "pictophonetic"
  | "documented"
  | "structural"
  | "uncertain";

export interface KanjiEtymologySource {
  title: string;
  url: string;
}

export interface KanjiEtymologyEntry {
  explanation: string;
  note?: string;
  source: KanjiEtymologySource;
}

export interface KanjiEtymologyDataEntry extends KanjiEtymologyEntry {
  kind: KanjiEtymologyKind;
}

/**
 * Returns bundled character-formation data for a single WaniKani kanji.
 *
 * Vocabulary strings and other multi-character input deliberately return null:
 * this dataset describes kanji formation, not Japanese word etymology.
 */
export function getKanjiEtymology(
  characters: string | null | undefined
): KanjiEtymologyEntry | null {
  if (!characters || Array.from(characters).length !== 1) {
    return null;
  }

  return KANJI_ETYMOLOGIES[characters] ?? null;
}

export function hasKanjiEtymology(
  characters: string | null | undefined
): boolean {
  return getKanjiEtymology(characters) !== null;
}
