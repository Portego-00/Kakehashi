import { WaniKaniItemType } from "../types/wanikani";
import { getActiveJpdbApiKey } from "./jpdbApi";
import { getSubjectTypeColor } from "./subjectColors";

export interface VocabularyMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
  jpdbKanjiComposition?: {
    id: number;
    characters: string;
    meaning: string;
    level: number;
  }[];
  verbConjugationKind?: Exclude<VerbConjugationKind, "none">;
  matchCandidates?: string[];
  disableConjugationExpansion?: boolean;
  isWaniKaniSubject?: boolean;
}

export interface KanjiMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
}

export type AnyMatch = VocabularyMatch | KanjiMatch;

interface HighlightSegment {
  start: number;
  end: number;
  match: AnyMatch;
}

type VerbConjugationKind =
  | "none"
  | "ichidan"
  | "godan"
  | "suru"
  | "kuru"
  | "ru-ambiguous";

const LEADING_OR_TRAILING_TILDE_PATTERN = /^[〜～~]+|[〜～~]+$/g;
const ALL_TILDE_PATTERN = /[〜～~]/g;
const HIRAGANA_I_OR_E_ROW = new Set<string>([
  "い",
  "き",
  "ぎ",
  "し",
  "じ",
  "ち",
  "ぢ",
  "に",
  "ひ",
  "び",
  "ぴ",
  "み",
  "り",
  "え",
  "け",
  "げ",
  "せ",
  "ぜ",
  "て",
  "で",
  "ね",
  "へ",
  "べ",
  "ぺ",
  "め",
  "れ",
]);
const GODAN_ENDINGS = new Set<string>(["う", "く", "ぐ", "す", "つ", "ぬ", "ぶ", "む", "る"]);
const GODAN_A_ROW_MAP: Record<string, string> = {
  う: "わ",
  く: "か",
  ぐ: "が",
  す: "さ",
  つ: "た",
  ぬ: "な",
  ぶ: "ば",
  む: "ま",
  る: "ら",
};
const GODAN_I_ROW_MAP: Record<string, string> = {
  う: "い",
  く: "き",
  ぐ: "ぎ",
  す: "し",
  つ: "ち",
  ぬ: "に",
  ぶ: "び",
  む: "み",
  る: "り",
};
const GODAN_E_ROW_MAP: Record<string, string> = {
  う: "え",
  く: "け",
  ぐ: "げ",
  す: "せ",
  つ: "て",
  ぬ: "ね",
  ぶ: "べ",
  む: "め",
  る: "れ",
};
const GODAN_O_ROW_MAP: Record<string, string> = {
  う: "お",
  く: "こ",
  ぐ: "ご",
  す: "そ",
  つ: "と",
  ぬ: "の",
  ぶ: "ぼ",
  む: "も",
  る: "ろ",
};
const JAPANESE_LETTER_PATTERN = /[\u3040-\u30FF\u3400-\u9FFF々]/;
const JAPANESE_KANJI_PATTERN = /[\u3400-\u9FFF々]/;
const ALL_HIRAGANA_PATTERN = /^[\u3040-\u309F]+$/;
const GODAN_POLITE_SUFFIXES = ["ます", "ました", "ません", "ませんでした", "ましょう"];
const GODAN_DESIDERATIVE_SUFFIXES = ["たい", "たくない", "たかった", "たくなかった"];
const VERB_NEGATIVE_SUFFIXES = ["ない", "なかった", "なくて", "なければ"];
const VERB_CONJUGATION_FORMS_CACHE = new Map<string, string[]>();
const VERB_CONJUGATION_PATTERN_CACHE = new Map<string, string[]>();
const HIGHLIGHT_SEGMENTS_CACHE = new Map<string, { text: string; match?: AnyMatch }[]>();
const MAX_HIGHLIGHT_SEGMENTS_CACHE_ENTRIES = 1500;
const JPDB_PARSE_ENDPOINT = "https://jpdb.io/api/v1/parse";
const JPDB_PARSE_TOKEN_FIELDS = ["vocabulary_index", "position", "length"] as const;
const JPDB_PARSE_VOCABULARY_FIELDS = [
  "spelling",
  "reading",
  "part_of_speech",
  "meanings_chunks",
] as const;
const JPDB_PARSE_CACHE = new Map<string, JpdbParsedToken[] | null>();
const MAX_JPDB_PARSE_CACHE_ENTRIES = 200;
const JPDB_GRAMMAR_PARTS_OF_SPEECH = new Set<string>([
  "aux",
  "aux-v",
  "aux-adj",
  "cop",
  "conj",
  "exp",
  "prt",
  "int",
]);

type JpdbTokenTuple = [number, number, number];
type JpdbMeaningsChunks = string[][];
type JpdbVocabularyTuple = [string, string, string[], JpdbMeaningsChunks?];

interface JpdbParseResponse {
  tokens?: JpdbTokenTuple[] | JpdbTokenTuple[][];
  vocabulary?: JpdbVocabularyTuple[];
}

interface JpdbParsedToken {
  start: number;
  end: number;
  surface: string;
  spelling: string;
  reading: string;
  meaning: string;
  partsOfSpeech: string[];
  isVerb: boolean;
  isGrammar: boolean;
}

export interface JpdbParsedTokenAnnotation {
  start: number;
  end: number;
  surface: string;
  spelling: string;
  reading: string;
  meaning: string;
  partsOfSpeech: string[];
  isVerb: boolean;
  isGrammar: boolean;
  tokenType: "verb" | "grammar" | "vocabulary";
  mappedVocabularyId?: number;
}

interface IndexedVocabularySubject {
  subject: any;
  characters: string;
  normalizedCharacters: string;
  normalizedReadings: Set<string>;
  partsOfSpeech: string[];
  primaryMeaningNormalized: string;
  verbConjugationKind: VerbConjugationKind;
  isLikelyVerb: boolean;
}

const ALL_KANA_PATTERN = /^[\u3040-\u30FFー]+$/;
const ALL_KATAKANA_PATTERN = /^[\u30A0-\u30FFー]+$/;

// Helper to escape special characters for Regex
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

function getVocabMatchCandidates(vocab: string): string[] {
  const trimmed = vocab.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>([trimmed]);
  const withoutEdgeTildes = trimmed.replace(LEADING_OR_TRAILING_TILDE_PATTERN, "");
  if (withoutEdgeTildes) {
    candidates.add(withoutEdgeTildes);
  }

  const withoutAnyTildes = trimmed.replace(ALL_TILDE_PATTERN, "");
  if (withoutAnyTildes) {
    candidates.add(withoutAnyTildes);
  }

  return Array.from(candidates).sort((a, b) => b.length - a.length);
}

function getPartsOfSpeech(subject: any): string[] {
  const rawPartsOfSpeech = subject?.data?.parts_of_speech;
  const partsOfSpeech = Array.isArray(rawPartsOfSpeech)
    ? rawPartsOfSpeech.filter((value): value is string => typeof value === "string")
    : [];
  return partsOfSpeech.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function getPrimaryMeaning(subject: any): string {
  const primaryMeaning = subject?.data?.meanings?.find?.(
    (meaning: any) => meaning?.primary
  )?.meaning;
  if (typeof primaryMeaning === "string" && primaryMeaning.trim().length > 0) {
    return primaryMeaning.trim();
  }
  const fallbackMeaning = subject?.data?.meanings?.[0]?.meaning;
  if (typeof fallbackMeaning === "string" && fallbackMeaning.trim().length > 0) {
    return fallbackMeaning.trim();
  }
  return "";
}

function normalizeEnglishMeaning(value: string): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/^to\s+/, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningsOverlap(tokenMeaning: string, subjectMeaningNormalized: string): boolean {
  const normalizedTokenMeaning = normalizeEnglishMeaning(tokenMeaning);
  if (!normalizedTokenMeaning || !subjectMeaningNormalized) {
    return false;
  }

  if (normalizedTokenMeaning === subjectMeaningNormalized) {
    return true;
  }

  if (
    subjectMeaningNormalized.includes(normalizedTokenMeaning) ||
    normalizedTokenMeaning.includes(subjectMeaningNormalized)
  ) {
    return true;
  }

  const tokenParts = normalizedTokenMeaning.split(" ").filter(Boolean);
  const subjectParts = subjectMeaningNormalized.split(" ").filter(Boolean);
  return tokenParts.some((part) => subjectParts.includes(part));
}

function isLikelyVerbSubject(subject: any): boolean {
  const partsOfSpeech = getPartsOfSpeech(subject);
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.includes("verb"))) {
    return true;
  }

  // Fallback for partially-shaped cached subjects.
  const primaryMeaning = getPrimaryMeaning(subject);
  return typeof primaryMeaning === "string" && /^to\s+/i.test(primaryMeaning.trim());
}

function isLikelyVerbBySpelling(characters: string): boolean {
  if (!characters || characters.length < 2) {
    return false;
  }

  if (
    characters.endsWith("する") ||
    characters.endsWith("くる") ||
    characters.endsWith("来る")
  ) {
    return true;
  }

  const ending = characters.slice(-1);
  if (!GODAN_ENDINGS.has(ending)) {
    return false;
  }

  // Kanji + okurigana forms like 住む / 思う / 調べる are very likely verbs.
  if (JAPANESE_KANJI_PATTERN.test(characters)) {
    return true;
  }

  // Also allow all-hiragana dictionary forms (e.g. なる) when POS metadata is sparse.
  return ALL_HIRAGANA_PATTERN.test(characters);
}

function inferVerbConjugationKind(subject: any, characters: string): VerbConjugationKind {
  if (!characters) {
    return "none";
  }

  const partsOfSpeech = getPartsOfSpeech(subject);
  const hasVerbPartOfSpeech = partsOfSpeech.some((part) =>
    part.includes("verb")
  );

  if (partsOfSpeech.length > 0 && !hasVerbPartOfSpeech) {
    return "none";
  }

  if (!isLikelyVerbSubject(subject) && !isLikelyVerbBySpelling(characters)) {
    return "none";
  }

  if (partsOfSpeech.some((part) => part.includes("suru"))) {
    return "suru";
  }
  if (partsOfSpeech.some((part) => part.includes("kuru"))) {
    return "kuru";
  }
  if (partsOfSpeech.some((part) => part.includes("ichidan"))) {
    return "ichidan";
  }
  if (partsOfSpeech.some((part) => part.includes("godan"))) {
    return "godan";
  }

  if (characters.endsWith("する")) {
    return "suru";
  }
  if (characters.endsWith("くる") || characters.endsWith("来る")) {
    return "kuru";
  }

  const ending = characters.slice(-1);
  if (!GODAN_ENDINGS.has(ending)) {
    return "none";
  }

  if (ending !== "る") {
    return "godan";
  }

  // Without explicit POS information, る-verbs are ambiguous.
  // We generate both ichidan and godan patterns for better coverage.
  const previousCharacter = characters.slice(-2, -1);
  if (!previousCharacter) {
    return "ru-ambiguous";
  }

  if (HIRAGANA_I_OR_E_ROW.has(previousCharacter)) {
    return "ichidan";
  }

  if (JAPANESE_KANJI_PATTERN.test(previousCharacter)) {
    return "ru-ambiguous";
  }

  return "godan";
}

function getReadingCandidates(subject: any): string[] {
  const rawReadings = Array.isArray(subject?.data?.readings) ? subject.data.readings : [];
  const candidates = new Set<string>();

  rawReadings.forEach((reading: any) => {
    if (typeof reading?.reading !== "string") {
      return;
    }
    const normalizedReading = reading.reading.trim();
    if (!normalizedReading) {
      return;
    }

    getVocabMatchCandidates(normalizedReading).forEach((candidate) =>
      candidates.add(candidate)
    );
  });

  return Array.from(candidates);
}

function buildSubjectMatchCandidates(
  subject: any,
  characters: string,
  verbConjugationKind: VerbConjugationKind
): string[] {
  const candidates = new Set<string>(getVocabMatchCandidates(characters));

  // Support kana-only inflections (e.g. わかりました for 分かる) for verbs with kanji spellings.
  if (
    verbConjugationKind !== "none" &&
    JAPANESE_KANJI_PATTERN.test(characters)
  ) {
    getReadingCandidates(subject).forEach((candidate) => candidates.add(candidate));
  }

  return Array.from(candidates).sort((a, b) => b.length - a.length);
}

function addForms(target: Set<string>, values: string[]): void {
  values.forEach((value) => {
    if (!value) {
      return;
    }
    if (!JAPANESE_LETTER_PATTERN.test(value)) {
      return;
    }
    target.add(value);
  });
}

function createIchidanVerbForms(dictionaryForm: string): string[] {
  if (!dictionaryForm.endsWith("る") || dictionaryForm.length < 2) {
    return [];
  }

  const stem = dictionaryForm.slice(0, -1);
  const forms = new Set<string>();

  addForms(forms, [
    `${stem}る`,
    `${stem}ます`,
    `${stem}ました`,
    `${stem}ません`,
    `${stem}ませんでした`,
    `${stem}ましょう`,
    `${stem}ない`,
    `${stem}なかった`,
    `${stem}なくて`,
    `${stem}なければ`,
    `${stem}たい`,
    `${stem}たくない`,
    `${stem}たかった`,
    `${stem}たくなかった`,
    `${stem}て`,
    `${stem}た`,
    `${stem}ている`,
    `${stem}ていた`,
    `${stem}ています`,
    `${stem}ていました`,
    `${stem}ていません`,
    `${stem}ていませんでした`,
    `${stem}てる`,
    `${stem}てた`,
    `${stem}ていく`,
    `${stem}ていった`,
    `${stem}ていきます`,
    `${stem}ていきました`,
    `${stem}れば`,
    `${stem}よう`,
    `${stem}ろ`,
    `${stem}よ`,
    `${stem}られる`,
    `${stem}られない`,
    `${stem}られた`,
    `${stem}られて`,
    `${stem}られます`,
    `${stem}られました`,
    `${stem}られれば`,
    `${stem}させる`,
    `${stem}させない`,
    `${stem}させた`,
    `${stem}させて`,
    `${stem}させます`,
    `${stem}させました`,
    `${stem}れる`,
    `${stem}れない`,
    `${stem}れた`,
    `${stem}れて`,
    `${stem}たら`,
    `${stem}るな`,
  ]);

  return Array.from(forms);
}

function getGodanTeTa(dictionaryForm: string): { te: string; ta: string } | null {
  if (!dictionaryForm || dictionaryForm.length < 2) {
    return null;
  }

  const ending = dictionaryForm.slice(-1);
  const stem = dictionaryForm.slice(0, -1);

  if (ending === "う" || ending === "つ" || ending === "る") {
    return { te: `${stem}って`, ta: `${stem}った` };
  }
  if (ending === "む" || ending === "ぶ" || ending === "ぬ") {
    return { te: `${stem}んで`, ta: `${stem}んだ` };
  }
  if (ending === "く") {
    if (dictionaryForm.endsWith("行く") || dictionaryForm.endsWith("いく")) {
      return { te: `${stem}って`, ta: `${stem}った` };
    }
    return { te: `${stem}いて`, ta: `${stem}いた` };
  }
  if (ending === "ぐ") {
    return { te: `${stem}いで`, ta: `${stem}いだ` };
  }
  if (ending === "す") {
    return { te: `${stem}して`, ta: `${stem}した` };
  }

  return null;
}

function createGodanVerbForms(dictionaryForm: string): string[] {
  if (!dictionaryForm || dictionaryForm.length < 2) {
    return [];
  }

  const ending = dictionaryForm.slice(-1);
  if (!GODAN_ENDINGS.has(ending)) {
    return [];
  }

  const stem = dictionaryForm.slice(0, -1);
  const aStem = `${stem}${GODAN_A_ROW_MAP[ending]}`;
  const iStem = `${stem}${GODAN_I_ROW_MAP[ending]}`;
  const eStem = `${stem}${GODAN_E_ROW_MAP[ending]}`;
  const oStem = `${stem}${GODAN_O_ROW_MAP[ending]}`;
  const teTa = getGodanTeTa(dictionaryForm);
  const forms = new Set<string>();

  addForms(forms, [dictionaryForm, `${dictionaryForm}な`]);
  addForms(
    forms,
    VERB_NEGATIVE_SUFFIXES.map((suffix) => `${aStem}${suffix}`)
  );
  addForms(
    forms,
    GODAN_POLITE_SUFFIXES.map((suffix) => `${iStem}${suffix}`)
  );
  addForms(
    forms,
    GODAN_DESIDERATIVE_SUFFIXES.map((suffix) => `${iStem}${suffix}`)
  );
  addForms(forms, [
    `${eStem}る`,
    `${eStem}ない`,
    `${eStem}た`,
    `${eStem}て`,
    `${eStem}ます`,
    `${eStem}ました`,
    `${eStem}れば`,
    `${aStem}れる`,
    `${aStem}れない`,
    `${aStem}れた`,
    `${aStem}れて`,
    `${aStem}せる`,
    `${aStem}せない`,
    `${aStem}せた`,
    `${aStem}せて`,
    `${eStem}`,
    `${eStem}ば`,
    `${oStem}う`,
  ]);

  if (teTa) {
    addForms(forms, [
      teTa.te,
      teTa.ta,
      `${teTa.te}いる`,
      `${teTa.te}いた`,
      `${teTa.te}います`,
      `${teTa.te}いました`,
      `${teTa.te}いません`,
      `${teTa.te}いませんでした`,
      `${teTa.te}る`,
      `${teTa.te}た`,
      `${teTa.te}いく`,
      `${teTa.te}いった`,
      `${teTa.te}いきます`,
      `${teTa.te}いきました`,
      `${teTa.ta}ら`,
    ]);
  }

  return Array.from(forms);
}

function createSuruVerbForms(dictionaryForm: string): string[] {
  const root = dictionaryForm.endsWith("する")
    ? dictionaryForm.slice(0, -2)
    : dictionaryForm;
  const forms = new Set<string>();

  addForms(forms, [
    `${root}する`,
    `${root}します`,
    `${root}しました`,
    `${root}しません`,
    `${root}しませんでした`,
    `${root}しましょう`,
    `${root}しない`,
    `${root}しなかった`,
    `${root}しなくて`,
    `${root}しなければ`,
    `${root}したい`,
    `${root}したくない`,
    `${root}したかった`,
    `${root}したくなかった`,
    `${root}して`,
    `${root}した`,
    `${root}している`,
    `${root}していた`,
    `${root}しています`,
    `${root}していました`,
    `${root}していません`,
    `${root}していませんでした`,
    `${root}してる`,
    `${root}してた`,
    `${root}していく`,
    `${root}していった`,
    `${root}していきます`,
    `${root}していきました`,
    `${root}すれば`,
    `${root}しよう`,
    `${root}しろ`,
    `${root}せよ`,
    `${root}される`,
    `${root}されない`,
    `${root}された`,
    `${root}されて`,
    `${root}されます`,
    `${root}されました`,
    `${root}させる`,
    `${root}させない`,
    `${root}させた`,
    `${root}させて`,
    `${root}できる`,
    `${root}できない`,
    `${root}できた`,
    `${root}できて`,
    `${root}できます`,
    `${root}できました`,
    `${root}できれば`,
    `${root}したら`,
    `${root}するな`,
  ]);

  return Array.from(forms);
}

function createKuruVerbForms(dictionaryForm: string): string[] {
  let root = "";
  let includeKanjiForms = false;

  if (dictionaryForm.endsWith("来る")) {
    root = dictionaryForm.slice(0, -2);
    includeKanjiForms = true;
  } else if (dictionaryForm.endsWith("くる")) {
    root = dictionaryForm.slice(0, -2);
  } else {
    return [];
  }

  const forms = new Set<string>();

  addForms(forms, [
    `${root}くる`,
    `${root}きます`,
    `${root}きました`,
    `${root}きません`,
    `${root}きませんでした`,
    `${root}こない`,
    `${root}こなかった`,
    `${root}こなくて`,
    `${root}こなければ`,
    `${root}きて`,
    `${root}きた`,
    `${root}きている`,
    `${root}きていた`,
    `${root}きています`,
    `${root}きていました`,
    `${root}きていません`,
    `${root}きていませんでした`,
    `${root}きてる`,
    `${root}きてた`,
    `${root}きていく`,
    `${root}きていった`,
    `${root}きていきます`,
    `${root}きていきました`,
    `${root}こられる`,
    `${root}こられない`,
    `${root}こられた`,
    `${root}こられて`,
    `${root}これる`,
    `${root}これない`,
    `${root}これた`,
    `${root}これて`,
    `${root}こさせる`,
    `${root}こさせない`,
    `${root}こさせた`,
    `${root}こさせて`,
    `${root}くれば`,
    `${root}こよう`,
    `${root}こい`,
    `${root}きたら`,
    `${root}くるな`,
  ]);

  if (includeKanjiForms) {
    addForms(forms, [
      `${root}来る`,
      `${root}来ます`,
      `${root}来ました`,
      `${root}来ません`,
      `${root}来ませんでした`,
      `${root}来ない`,
      `${root}来なかった`,
      `${root}来なくて`,
      `${root}来なければ`,
      `${root}来て`,
      `${root}来た`,
      `${root}来ている`,
      `${root}来ていた`,
      `${root}来ています`,
      `${root}来ていました`,
      `${root}来ていません`,
      `${root}来ていませんでした`,
      `${root}来てる`,
      `${root}来てた`,
      `${root}来ていく`,
      `${root}来ていった`,
      `${root}来ていきます`,
      `${root}来ていきました`,
      `${root}来られる`,
      `${root}来られない`,
      `${root}来られた`,
      `${root}来られて`,
      `${root}来れる`,
      `${root}来れない`,
      `${root}来れた`,
      `${root}来れて`,
      `${root}来させる`,
      `${root}来させない`,
      `${root}来させた`,
      `${root}来させて`,
      `${root}来れば`,
      `${root}来よう`,
      `${root}来い`,
      `${root}来たら`,
      `${root}来るな`,
    ]);
  }

  return Array.from(forms);
}

function getVerbConjugationForms(
  dictionaryForm: string,
  verbConjugationKind: VerbConjugationKind
): string[] {
  const cacheKey = `${verbConjugationKind}|${dictionaryForm}`;
  const cached = VERB_CONJUGATION_FORMS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  let forms: string[];

  switch (verbConjugationKind) {
    case "ichidan":
      forms = createIchidanVerbForms(dictionaryForm);
      break;
    case "godan":
      forms = createGodanVerbForms(dictionaryForm);
      break;
    case "suru":
      forms = createSuruVerbForms(dictionaryForm);
      break;
    case "kuru":
      forms = createKuruVerbForms(dictionaryForm);
      break;
    case "ru-ambiguous": {
      const merged = new Set<string>([
        ...createIchidanVerbForms(dictionaryForm),
        ...createGodanVerbForms(dictionaryForm),
      ]);
      forms = Array.from(merged);
      break;
    }
    case "none":
    default:
      forms = [];
      break;
  }

  VERB_CONJUGATION_FORMS_CACHE.set(cacheKey, forms);
  return forms;
}

function toRegexPatternWithFlexibleWhitespace(value: string): string {
  return value.split("").map(escapeRegExp).join("\\s*");
}

function isKanaOnlyReadingMatchForKanjiVocabulary(
  vocabularyCharacters: string,
  matchedSurface: string
): boolean {
  return (
    JAPANESE_KANJI_PATTERN.test(vocabularyCharacters) &&
    !JAPANESE_KANJI_PATTERN.test(matchedSurface)
  );
}

function shouldAcceptSurfaceMatch(
  text: string,
  startIndex: number,
  matchedSurface: string,
  vocabularyCharacters: string
): boolean {
  if (
    !isKanaOnlyReadingMatchForKanjiVocabulary(
      vocabularyCharacters,
      matchedSurface
    )
  ) {
    return true;
  }

  if (startIndex <= 0) {
    return true;
  }

  const previousCharacter = text.slice(startIndex - 1, startIndex);

  // Kana-only readings for kanji words are usually valid at word boundaries
  // (start of sentence / after particles/punctuation). If immediately preceded
  // by kanji, it's often part of another conjugation chain (e.g. 少なくなりました),
  // so skip to reduce false positives like 亡くなる.
  if (JAPANESE_KANJI_PATTERN.test(previousCharacter)) {
    return false;
  }

  return true;
}

function buildVerbConjugationPatternSources(
  candidates: string[],
  verbConjugationKind: VerbConjugationKind
): string[] {
  if (verbConjugationKind === "none") {
    return [];
  }

  const sources = new Set<string>();

  for (const candidate of candidates) {
    const cacheKey = `${verbConjugationKind}|${candidate}`;
    const cachedPatternSources = VERB_CONJUGATION_PATTERN_CACHE.get(cacheKey);
    if (cachedPatternSources) {
      cachedPatternSources.forEach((source) => sources.add(source));
      continue;
    }

    const forms = getVerbConjugationForms(candidate, verbConjugationKind);
    const patternSourcesForCandidate: string[] = [];
    for (const form of forms) {
      if (!form || form === candidate) {
        continue;
      }
      // Avoid noisy substring matches like した inside unrelated words (e.g. わかりました)
      // when the base vocab is the bare auxiliary する.
      if (candidate === "する" && form.length <= 2) {
        continue;
      }
      const source = toRegexPatternWithFlexibleWhitespace(form);
      patternSourcesForCandidate.push(source);
      sources.add(source);
    }
    VERB_CONJUGATION_PATTERN_CACHE.set(cacheKey, patternSourcesForCandidate);
  }

  return Array.from(sources);
}

function hasVocabularyMatchInText(
  text: string,
  candidates: string[],
  verbConjugationKind: VerbConjugationKind,
  vocabularyCharacters: string
): boolean {
  if (candidates.length === 0) {
    return false;
  }

  // Fast direct search path (cleanText has no spaces/newlines).
  for (const candidate of candidates) {
    let searchIndex = 0;
    while (searchIndex <= text.length - candidate.length) {
      const matchIndex = text.indexOf(candidate, searchIndex);
      if (matchIndex === -1) {
        break;
      }

      if (
        shouldAcceptSurfaceMatch(
          text,
          matchIndex,
          candidate,
          vocabularyCharacters
        )
      ) {
        return true;
      }

      searchIndex = matchIndex + 1;
    }
  }

  if (verbConjugationKind === "none") {
    return false;
  }

  const conjugationPatternSources = buildVerbConjugationPatternSources(
    candidates,
    verbConjugationKind
  );

  for (const patternSource of conjugationPatternSources) {
    const regex = new RegExp(patternSource, "g");
    let regexMatch;
    while ((regexMatch = regex.exec(text)) !== null) {
      const startIndex = regexMatch.index;
      const matchedSurface = regexMatch[0];

      if (
        shouldAcceptSurfaceMatch(
          text,
          startIndex,
          matchedSurface,
          vocabularyCharacters
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function buildHighlightRegexes(
  candidates: string[],
  verbConjugationKind: VerbConjugationKind
): RegExp[] {
  const patterns = new Set<string>();

  for (const candidate of candidates) {
    patterns.add(toRegexPatternWithFlexibleWhitespace(candidate));
  }

  const conjugationPatternSources = buildVerbConjugationPatternSources(
    candidates,
    verbConjugationKind
  );
  conjugationPatternSources.forEach((source) => patterns.add(source));

  return Array.from(patterns).map((pattern) => new RegExp(pattern, "g"));
}

function normalizeLookupValue(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function getNormalizedLookupValues(value: string): string[] {
  return getVocabMatchCandidates(value)
    .map((candidate) => normalizeLookupValue(candidate))
    .filter(Boolean);
}

function isJpdbVerbPartOfSpeech(partOfSpeech: string): boolean {
  if (!partOfSpeech) {
    return false;
  }

  const normalized = partOfSpeech.trim().toLowerCase();
  return normalized === "vi" || normalized === "vt" || normalized.startsWith("v");
}

function inferJpdbVerbConjugationKind(
  partsOfSpeech: string[],
  spelling: string
): VerbConjugationKind {
  if (!partsOfSpeech.some(isJpdbVerbPartOfSpeech)) {
    return "none";
  }

  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("vs"))) {
    return "suru";
  }

  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech === "vk")) {
    return "kuru";
  }

  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v1"))) {
    return "ichidan";
  }

  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v5"))) {
    return "godan";
  }

  const inferred = inferVerbConjugationKind(
    { data: { parts_of_speech: ["verb"] } },
    spelling
  );
  return inferred;
}

function getJpdbTokenKey(token: JpdbParsedToken): string {
  return `${token.start}:${token.end}:${token.surface}:${token.spelling}:${token.reading}`;
}

function getPrimaryJpdbMeaning(rawMeaningsChunks: unknown): string {
  if (!Array.isArray(rawMeaningsChunks)) {
    return "";
  }

  for (const chunk of rawMeaningsChunks) {
    if (!Array.isArray(chunk)) {
      continue;
    }
    const firstMeaning = chunk.find(
      (meaningValue): meaningValue is string =>
        typeof meaningValue === "string" && meaningValue.trim().length > 0
    );
    if (firstMeaning) {
      return firstMeaning.trim();
    }
  }

  return "";
}

function shouldExposeAsExternalJpdbVocabulary(token: JpdbParsedToken): boolean {
  const normalizedSurface = normalizeLookupValue(token.surface);
  if (!normalizedSurface) {
    return false;
  }

  if (!JAPANESE_LETTER_PATTERN.test(normalizedSurface)) {
    return false;
  }

  if (token.isGrammar && !token.isVerb) {
    return false;
  }

  // Avoid noisy one-kana particles/interjections.
  if (
    normalizedSurface.length === 1 &&
    ALL_KANA_PATTERN.test(normalizedSurface)
  ) {
    return false;
  }

  return true;
}

async function getJpdbApiKey(): Promise<string | null> {
  return getActiveJpdbApiKey();
}

function setJpdbParseCache(cacheKey: string, parsedTokens: JpdbParsedToken[] | null): void {
  JPDB_PARSE_CACHE.set(cacheKey, parsedTokens);
  if (JPDB_PARSE_CACHE.size > MAX_JPDB_PARSE_CACHE_ENTRIES) {
    const oldestKey = JPDB_PARSE_CACHE.keys().next().value;
    if (oldestKey) {
      JPDB_PARSE_CACHE.delete(oldestKey);
    }
  }
}

function extractPrimaryTokenTuples(rawTokens: unknown): unknown[] {
  if (!Array.isArray(rawTokens) || rawTokens.length === 0) {
    return [];
  }

  const firstEntry = rawTokens[0];
  if (
    Array.isArray(firstEntry) &&
    (firstEntry.length === 0 || Array.isArray(firstEntry[0]))
  ) {
    return firstEntry;
  }

  return rawTokens;
}

async function parseTextWithJpdb(text: string): Promise<JpdbParsedToken[] | null> {
  const sourceText = text;
  if (!sourceText.trim()) {
    return [];
  }

  const jpdbApiKey = await getJpdbApiKey();
  if (!jpdbApiKey) {
    return null;
  }
  const cacheKey = `${jpdbApiKey}::${sourceText}`;
  const cached = JPDB_PARSE_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const response = await fetch(JPDB_PARSE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${jpdbApiKey}`,
      },
      body: JSON.stringify({
        text: [sourceText],
        position_length_encoding: "utf16",
        token_fields: JPDB_PARSE_TOKEN_FIELDS,
        vocabulary_fields: JPDB_PARSE_VOCABULARY_FIELDS,
      }),
    });

    if (!response.ok) {
      setJpdbParseCache(cacheKey, null);
      return null;
    }

    const payload = (await response.json()) as JpdbParseResponse;
    const tokenTuples = extractPrimaryTokenTuples(payload?.tokens);
    const vocabularyEntries = Array.isArray(payload?.vocabulary)
      ? payload.vocabulary
      : [];
    const parsedTokens: JpdbParsedToken[] = [];

    for (const tokenTuple of tokenTuples) {
      if (!Array.isArray(tokenTuple) || tokenTuple.length < 3) {
        continue;
      }

      const vocabularyIndex = Number(tokenTuple[0]);
      const start = Number(tokenTuple[1]);
      const length = Number(tokenTuple[2]);

      if (
        !Number.isInteger(vocabularyIndex) ||
        !Number.isFinite(start) ||
        !Number.isFinite(length) ||
        start < 0 ||
        length <= 0
      ) {
        continue;
      }

      const vocabularyTuple = vocabularyEntries[vocabularyIndex];
      if (!Array.isArray(vocabularyTuple)) {
        continue;
      }

      const spelling =
        typeof vocabularyTuple[0] === "string" ? vocabularyTuple[0].trim() : "";
      const reading =
        typeof vocabularyTuple[1] === "string" ? vocabularyTuple[1].trim() : "";
      const partsOfSpeech = Array.isArray(vocabularyTuple[2])
        ? vocabularyTuple[2]
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        : [];
      const meaning = getPrimaryJpdbMeaning(vocabularyTuple[3]);
      const end = start + length;
      const surface = sourceText.slice(start, end);

      if (
        !JAPANESE_LETTER_PATTERN.test(surface) &&
        !JAPANESE_LETTER_PATTERN.test(spelling)
      ) {
        continue;
      }

      const isVerb = partsOfSpeech.some(isJpdbVerbPartOfSpeech);
      const isGrammar = partsOfSpeech.some((partOfSpeech) =>
        JPDB_GRAMMAR_PARTS_OF_SPEECH.has(partOfSpeech)
      );

      parsedTokens.push({
        start,
        end,
        surface,
        spelling,
        reading,
        meaning,
        partsOfSpeech,
        isVerb,
        isGrammar,
      });
    }

    setJpdbParseCache(cacheKey, parsedTokens);
    return parsedTokens;
  } catch {
    setJpdbParseCache(cacheKey, null);
    return null;
  }
}

function buildIndexedVocabularyLookup(
  vocabularySubjects: any[]
): Map<string, IndexedVocabularySubject[]> {
  const lookup = new Map<string, IndexedVocabularySubject[]>();

  for (const subject of vocabularySubjects) {
    const characters =
      typeof subject?.data?.characters === "string"
        ? subject.data.characters.trim()
        : "";
    if (!characters) {
      continue;
    }

    const partsOfSpeech = getPartsOfSpeech(subject);
    const primaryMeaningNormalized = normalizeEnglishMeaning(
      getPrimaryMeaning(subject)
    );
    const verbConjugationKind = inferVerbConjugationKind(subject, characters);
    const normalizedCharacters = normalizeLookupValue(characters);
    const normalizedReadings = new Set<string>(
      getReadingCandidates(subject)
        .map((readingCandidate) => normalizeLookupValue(readingCandidate))
        .filter(Boolean)
    );
    const entry: IndexedVocabularySubject = {
      subject,
      characters,
      normalizedCharacters,
      normalizedReadings,
      partsOfSpeech,
      primaryMeaningNormalized,
      verbConjugationKind,
      isLikelyVerb: verbConjugationKind !== "none" || isLikelyVerbSubject(subject),
    };
    const keyCandidates = new Set<string>();

    getNormalizedLookupValues(characters).forEach((value) =>
      keyCandidates.add(value)
    );
    getReadingCandidates(subject)
      .map((value) => normalizeLookupValue(value))
      .filter(Boolean)
      .forEach((value) => keyCandidates.add(value));

    for (const keyCandidate of keyCandidates) {
      const existingEntries = lookup.get(keyCandidate) ?? [];
      if (!existingEntries.some((candidate) => candidate.subject.id === subject.id)) {
        existingEntries.push(entry);
        lookup.set(keyCandidate, existingEntries);
      }
    }
  }

  return lookup;
}

function scoreIndexedSubjectForJpdbToken(
  entry: IndexedVocabularySubject,
  token: JpdbParsedToken
): number {
  const normalizedSurface = normalizeLookupValue(token.surface);
  const normalizedSpelling = normalizeLookupValue(token.spelling);
  const normalizedReading = normalizeLookupValue(token.reading);
  let score = 0;
  const isSurfaceKanaOnly =
    normalizedSurface.length > 0 && ALL_KANA_PATTERN.test(normalizedSurface);
  const isSpellingKanaOnly =
    normalizedSpelling.length > 0 && ALL_KANA_PATTERN.test(normalizedSpelling);
  const isSurfaceKatakanaOnly =
    normalizedSurface.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedSurface);
  const isSpellingKatakanaOnly =
    normalizedSpelling.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedSpelling);
  const isReadingKatakanaOnly =
    normalizedReading.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedReading);
  const tokenIsKatakanaOnly =
    isSurfaceKatakanaOnly || isSpellingKatakanaOnly || isReadingKatakanaOnly;
  const entryContainsKanji = JAPANESE_KANJI_PATTERN.test(entry.characters);
  const hasExactSpellingMatch =
    !!entry.normalizedCharacters &&
    !!normalizedSpelling &&
    entry.normalizedCharacters === normalizedSpelling;
  const hasExactSurfaceMatch =
    !!entry.normalizedCharacters &&
    !!normalizedSurface &&
    entry.normalizedCharacters === normalizedSurface;
  const hasReadingMatch =
    !!normalizedReading && entry.normalizedReadings.has(normalizedReading);
  const hasSurfaceReadingMatch =
    !!normalizedSurface && entry.normalizedReadings.has(normalizedSurface);
  const tokenPartsOfSpeech = token.partsOfSpeech;
  const kanaTokenLength = Math.max(
    normalizedSurface.length,
    normalizedSpelling.length,
    normalizedReading.length
  );
  const hasMeaningOverlap = meaningsOverlap(
    token.meaning,
    entry.primaryMeaningNormalized
  );

  if (hasExactSpellingMatch) {
    score += 120;
  }

  if (hasExactSurfaceMatch) {
    score += 110;
  }

  if (hasReadingMatch) {
    score += 95;
  }

  if (hasSurfaceReadingMatch) {
    score += 65;
  }

  if (hasMeaningOverlap) {
    score += 140;
  }

  if (!hasExactSpellingMatch && !hasExactSurfaceMatch) {
    // Prevent reading-only homophone mappings for kana tokens to unrelated kanji
    // entries, e.g. JPDB "どう" -> WK "~道".
    if ((isSurfaceKanaOnly || isSpellingKanaOnly) && entryContainsKanji) {
      const isShortKanaToken = kanaTokenLength > 0 && kanaTokenLength <= 2;
      const isLikelyGrammarToken =
        token.isGrammar ||
        tokenPartsOfSpeech.includes("prt") ||
        tokenPartsOfSpeech.includes("aux") ||
        tokenPartsOfSpeech.includes("cop");

      if (hasMeaningOverlap) {
        score -= isShortKanaToken ? 90 : 30;
      } else if (isLikelyGrammarToken || isShortKanaToken) {
        score -= 260;
      } else if (kanaTokenLength >= 4) {
        // Longer kana lexical words (e.g. さみしい) can still legitimately map to
        // WaniKani kanji spellings, even when written in kana in source text.
        score -= 110;
      } else {
        score -= 180;
      }
    }
  }

  // Katakana tokens are usually loanwords/proper nouns. Avoid mapping them to
  // unrelated entries unless there is strong lexical evidence.
  if (tokenIsKatakanaOnly && !hasExactSpellingMatch && !hasExactSurfaceMatch) {
    if (!hasReadingMatch && !hasSurfaceReadingMatch) {
      score -= 260;
    }
    if (entryContainsKanji) {
      score -= 240;
    }
    if (!hasMeaningOverlap) {
      score -= 140;
    }
  }

  if (tokenPartsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("adj"))) {
    const supportsAdjective = entry.partsOfSpeech.some(
      (partOfSpeech) =>
        partOfSpeech.includes("adjective") || partOfSpeech.startsWith("adj")
    );
    if (supportsAdjective) {
      score += 25;
    } else {
      score -= 60;
    }
  }

  if (tokenPartsOfSpeech.includes("adv")) {
    const supportsAdverb =
      entry.partsOfSpeech.some((partOfSpeech) => partOfSpeech.includes("adverb")) ||
      entry.partsOfSpeech.some((partOfSpeech) => partOfSpeech.includes("adverbial"));
    if (!supportsAdverb) {
      score -= 90;
    }
  }

  if (tokenPartsOfSpeech.includes("prt")) {
    const supportsParticle = entry.partsOfSpeech.some((partOfSpeech) =>
      partOfSpeech.includes("particle")
    );
    if (!supportsParticle) {
      score -= 120;
    }
  }

  if (token.isGrammar && !token.isVerb) {
    // Grammar tokens should not map through reading-only matches to unrelated
    // lexical entries (e.g. "か" particle -> "蚊" WK vocabulary).
    if (!hasExactSurfaceMatch) {
      score -= 180;
    } else {
      score += 20;
    }

    if (isSurfaceKanaOnly && entryContainsKanji) {
      score -= 220;
    }
  }

  if (token.isVerb && entry.isLikelyVerb) {
    score += 30;
  }

  if (!token.isVerb && entry.isLikelyVerb) {
    score -= 5;
  }

  if (token.isGrammar && !token.isVerb && entry.isLikelyVerb) {
    score -= 15;
  }

  return score;
}

function pickBestIndexedSubject(
  candidates: IndexedVocabularySubject[],
  token: JpdbParsedToken
): IndexedVocabularySubject | null {
  let bestCandidate: IndexedVocabularySubject | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreIndexedSubjectForJpdbToken(candidate, token);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
      continue;
    }

    if (
      score === bestScore &&
      bestCandidate &&
      (candidate.subject?.data?.level ?? Number.MAX_SAFE_INTEGER) <
        (bestCandidate.subject?.data?.level ?? Number.MAX_SAFE_INTEGER)
    ) {
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate || bestScore < 25) {
    return null;
  }

  return bestCandidate;
}

function findVocabularyMatchesFromJpdbTokens(
  text: string,
  vocabularySubjects: any[],
  parsedTokens: JpdbParsedToken[]
): {
  vocabularyMatches: VocabularyMatch[];
  consumedTokenKeys: Set<string>;
  tokenToVocabularyId: Map<string, number>;
} {
  if (!parsedTokens.length) {
    return {
      vocabularyMatches: [],
      consumedTokenKeys: new Set<string>(),
      tokenToVocabularyId: new Map<string, number>(),
    };
  }

  const lookup = buildIndexedVocabularyLookup(vocabularySubjects);
  const allIndexedEntriesById = new Map<number, IndexedVocabularySubject>();
  for (const entries of lookup.values()) {
    for (const entry of entries) {
      allIndexedEntriesById.set(entry.subject.id, entry);
    }
  }
  const allIndexedEntries = Array.from(allIndexedEntriesById.values());
  const matchesById = new Map<number, VocabularyMatch>();
  const matchCandidatesById = new Map<number, Set<string>>();
  const consumedTokenKeys = new Set<string>();
  const tokenToVocabularyId = new Map<string, number>();

  for (const token of parsedTokens) {
    const tokenLookupKeys = new Set<string>([
      ...getNormalizedLookupValues(token.surface),
      ...getNormalizedLookupValues(token.spelling),
      ...getNormalizedLookupValues(token.reading),
    ]);

    if (tokenLookupKeys.size === 0) {
      continue;
    }

    const candidateEntriesById = new Map<number, IndexedVocabularySubject>();
    for (const tokenLookupKey of tokenLookupKeys) {
      const entries = lookup.get(tokenLookupKey);
      if (!entries) {
        continue;
      }
      entries.forEach((entry) => candidateEntriesById.set(entry.subject.id, entry));
    }

    if (candidateEntriesById.size === 0) {
      const normalizedSurface = normalizeLookupValue(token.surface);
      const normalizedSpelling = normalizeLookupValue(token.spelling);
      const normalizedMeaning = normalizeEnglishMeaning(token.meaning);
      const tokenIsKanaOnly =
        (normalizedSurface.length > 0 && ALL_KANA_PATTERN.test(normalizedSurface)) ||
        (normalizedSpelling.length > 0 && ALL_KANA_PATTERN.test(normalizedSpelling));
      const tokenIsHiraganaOnly =
        (normalizedSurface.length > 0 && ALL_HIRAGANA_PATTERN.test(normalizedSurface)) ||
        (normalizedSpelling.length > 0 && ALL_HIRAGANA_PATTERN.test(normalizedSpelling));
      const kanaLength = Math.max(normalizedSurface.length, normalizedSpelling.length);
      const tokenLooksAdjective = token.partsOfSpeech.some((partOfSpeech) =>
        partOfSpeech.startsWith("adj")
      );
      const canUseMeaningFallback =
        tokenIsKanaOnly &&
        tokenIsHiraganaOnly &&
        kanaLength >= 3 &&
        !token.isGrammar &&
        normalizedMeaning.length > 0;

      if (canUseMeaningFallback) {
        for (const entry of allIndexedEntries) {
          if (!entry.primaryMeaningNormalized) {
            continue;
          }
          if (!meaningsOverlap(token.meaning, entry.primaryMeaningNormalized)) {
            continue;
          }
          if (token.isVerb && !entry.isLikelyVerb) {
            continue;
          }
          if (tokenLooksAdjective) {
            const supportsAdjective = entry.partsOfSpeech.some(
              (partOfSpeech) =>
                partOfSpeech.includes("adjective") || partOfSpeech.startsWith("adj")
            );
            if (!supportsAdjective) {
              continue;
            }
          }
          candidateEntriesById.set(entry.subject.id, entry);
        }
      }
    }

    if (candidateEntriesById.size === 0) {
      continue;
    }

    const bestEntry = pickBestIndexedSubject(
      Array.from(candidateEntriesById.values()),
      token
    );
    if (!bestEntry) {
      continue;
    }

    const normalizedSurface = normalizeLookupValue(token.surface);
    const normalizedSpelling = normalizeLookupValue(token.spelling);
    const normalizedReading = normalizeLookupValue(token.reading);
    const tokenIsKatakanaOnly =
      (normalizedSurface.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedSurface)) ||
      (normalizedSpelling.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedSpelling)) ||
      (normalizedReading.length > 0 && ALL_KATAKANA_PATTERN.test(normalizedReading));
    if (tokenIsKatakanaOnly) {
      const hasDirectKatakanaLexicalMatch =
        (!!bestEntry.normalizedCharacters &&
          ((!!normalizedSpelling &&
            bestEntry.normalizedCharacters === normalizedSpelling) ||
            (!!normalizedSurface &&
              bestEntry.normalizedCharacters === normalizedSurface))) ||
        (!!normalizedReading && bestEntry.normalizedReadings.has(normalizedReading)) ||
        (!!normalizedSurface && bestEntry.normalizedReadings.has(normalizedSurface));
      if (!hasDirectKatakanaLexicalMatch) {
        continue;
      }
    }

    if (
      !shouldAcceptSurfaceMatch(
        text,
        token.start,
        token.surface,
        bestEntry.characters
      )
    ) {
      continue;
    }
    const tokenKey = getJpdbTokenKey(token);
    consumedTokenKeys.add(tokenKey);

    const subject = bestEntry.subject;
    const subjectId = subject.id as number;
    const level =
      typeof subject?.data?.level === "number" ? subject.data.level : 1;
    const meaning =
      subject?.data?.meanings?.find?.((meaningValue: any) => meaningValue?.primary)
        ?.meaning ||
      subject?.data?.meanings?.[0]?.meaning ||
      "";
    const verbConjugationKind = bestEntry.verbConjugationKind;

    if (!matchesById.has(subjectId)) {
      matchesById.set(subjectId, {
        id: subjectId,
        characters: bestEntry.characters,
        meaning,
        type: subject.object as WaniKaniItemType,
        level,
        readings: subject.data.readings,
        verbConjugationKind:
          verbConjugationKind === "none" ? undefined : verbConjugationKind,
        disableConjugationExpansion: true,
      });
    }

    const matchCandidates = matchCandidatesById.get(subjectId) ?? new Set<string>();
    [token.surface].forEach((value) => {
      getVocabMatchCandidates(value).forEach((candidate) =>
        matchCandidates.add(candidate)
      );
    });

    matchCandidatesById.set(subjectId, matchCandidates);
    tokenToVocabularyId.set(tokenKey, subjectId);
  }

  const matches = Array.from(matchesById.values());
  matches.forEach((match) => {
    const candidates = matchCandidatesById.get(match.id);
    if (!candidates || candidates.size === 0) {
      return;
    }
    match.matchCandidates = Array.from(candidates).sort((a, b) => b.length - a.length);
  });

  matches.sort((a, b) => b.characters.length - a.characters.length);
  return {
    vocabularyMatches: matches,
    consumedTokenKeys,
    tokenToVocabularyId,
  };
}

function findExternalJpdbVocabularyMatches(
  parsedTokens: JpdbParsedToken[],
  consumedTokenKeys: Set<string>,
  kanjiSubjects: any[]
): { vocabularyMatches: VocabularyMatch[]; tokenToVocabularyId: Map<string, number> } {
  const matches: VocabularyMatch[] = [];
  const tokenToVocabularyId = new Map<string, number>();
  const seenKeys = new Set<string>();
  const kanjiSubjectsByCharacter = new Map<string, any>();
  for (const subject of kanjiSubjects) {
    const character =
      typeof subject?.data?.characters === "string"
        ? subject.data.characters.trim()
        : "";
    if (!character || kanjiSubjectsByCharacter.has(character)) {
      continue;
    }
    kanjiSubjectsByCharacter.set(character, subject);
  }
  let syntheticId = -1;

  for (const token of parsedTokens) {
    const tokenKey = getJpdbTokenKey(token);
    if (consumedTokenKeys.has(tokenKey)) {
      continue;
    }

    if (!shouldExposeAsExternalJpdbVocabulary(token)) {
      continue;
    }

    const dedupeKey = `${token.surface}|${token.spelling}|${token.reading}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }
    seenKeys.add(dedupeKey);

    const verbConjugationKind = inferJpdbVerbConjugationKind(
      token.partsOfSpeech,
      token.spelling || token.surface
    );
    const matchCandidates = Array.from(
      new Set<string>(
        [token.surface, token.spelling, token.reading]
          .flatMap((value) => getVocabMatchCandidates(value))
          .filter(Boolean)
      )
    ).sort((a, b) => b.length - a.length);
    const kanjiComposition: {
      id: number;
      characters: string;
      meaning: string;
      level: number;
    }[] = [];
    const seenKanjiIds = new Set<number>();
    const compositionSource = token.spelling || token.surface;
    for (const character of Array.from(compositionSource)) {
      if (!JAPANESE_KANJI_PATTERN.test(character)) {
        continue;
      }
      const kanjiSubject = kanjiSubjectsByCharacter.get(character);
      if (!kanjiSubject) {
        continue;
      }
      const kanjiSubjectId =
        typeof kanjiSubject?.id === "number" ? kanjiSubject.id : NaN;
      if (!Number.isFinite(kanjiSubjectId) || seenKanjiIds.has(kanjiSubjectId)) {
        continue;
      }
      seenKanjiIds.add(kanjiSubjectId);
      kanjiComposition.push({
        id: kanjiSubjectId,
        characters: character,
        meaning:
          kanjiSubject?.data?.meanings?.find?.((meaningValue: any) => meaningValue?.primary)
            ?.meaning ||
          kanjiSubject?.data?.meanings?.[0]?.meaning ||
          "",
        level:
          typeof kanjiSubject?.data?.level === "number"
            ? kanjiSubject.data.level
            : 1,
      });
    }

    matches.push({
      id: syntheticId,
      characters: token.spelling || token.surface,
      meaning:
        token.meaning ||
        "Detected by JPDB parser (not found in your WaniKani subjects).",
      type: "vocabulary",
      level: 0,
      readings: token.reading
        ? [{ reading: token.reading, primary: true }]
        : undefined,
      verbConjugationKind:
        verbConjugationKind === "none" ? undefined : verbConjugationKind,
      matchCandidates,
      disableConjugationExpansion: true,
      isWaniKaniSubject: false,
      jpdbKanjiComposition: kanjiComposition.length > 0 ? kanjiComposition : undefined,
    });
    tokenToVocabularyId.set(tokenKey, syntheticId);
    syntheticId -= 1;
  }

  return {
    vocabularyMatches: matches,
    tokenToVocabularyId,
  };
}

function findHeuristicVocabularyMatches(
  text: string,
  vocabularySubjects: any[]
): VocabularyMatch[] {
  const cleanText = text.replace(/\s+/g, "").trim();
  const allVocabMatches: VocabularyMatch[] = [];
  const foundVocabCharacters = new Set<string>();

  for (const subject of vocabularySubjects) {
    const characters = subject.data.characters;
    if (!characters || foundVocabCharacters.has(characters)) continue;

    const verbConjugationKind = inferVerbConjugationKind(subject, characters);
    const matchCandidates = buildSubjectMatchCandidates(
      subject,
      characters,
      verbConjugationKind
    );

    if (
      hasVocabularyMatchInText(
        cleanText,
        matchCandidates,
        verbConjugationKind,
        characters
      )
    ) {
      allVocabMatches.push({
        id: subject.id,
        characters,
        meaning:
          subject.data.meanings.find((m: any) => m.primary)?.meaning ||
          subject.data.meanings[0]?.meaning ||
          "",
        type: subject.object as WaniKaniItemType,
        level: subject.data.level || 1,
        readings: subject.data.readings,
        verbConjugationKind:
          verbConjugationKind === "none" ? undefined : verbConjugationKind,
        matchCandidates,
      });
      foundVocabCharacters.add(characters);
    }
  }

  allVocabMatches.sort((a, b) => b.characters.length - a.characters.length);
  return allVocabMatches;
}

function findKanjiMatchesInText(text: string, kanjiSubjects: any[]): KanjiMatch[] {
  const cleanText = text.replace(/\s+/g, "").trim();
  const kanjiMatchesFound: KanjiMatch[] = [];
  const foundKanjiCharacters = new Set<string>();

  for (const subject of kanjiSubjects) {
    const characters = subject.data.characters;
    if (!characters || foundKanjiCharacters.has(characters)) continue;

    if (cleanText.includes(characters)) {
      kanjiMatchesFound.push({
        id: subject.id,
        characters,
        meaning:
          subject.data.meanings.find((m: any) => m.primary)?.meaning ||
          subject.data.meanings[0]?.meaning ||
          "",
        type: subject.object as WaniKaniItemType,
        level: subject.data.level || 1,
        readings: subject.data.readings,
      });
      foundKanjiCharacters.add(characters);
    }
  }

  kanjiMatchesFound.sort((a, b) => a.level - b.level);
  return kanjiMatchesFound;
}

/**
 * Finds all vocabulary and kanji matches in the given text.
 * Returns matches without filtering out shorter words that are part of longer ones globally,
 * allowing the rendering logic to handle local overlaps (longest match wins locally).
 */
export const findVocabularyMatches = (
  text: string,
  allSubjects: any[]
): { vocabularyMatches: VocabularyMatch[]; kanjiMatches: KanjiMatch[] } => {
  const vocabularySubjects = allSubjects.filter(
    (subject) =>
      subject.object === "vocabulary" || subject.object === "kana_vocabulary"
  );
  const kanjiSubjects = allSubjects.filter(
    (subject) => subject.object === "kanji"
  );

  return {
    vocabularyMatches: findHeuristicVocabularyMatches(text, vocabularySubjects),
    kanjiMatches: findKanjiMatchesInText(text, kanjiSubjects),
  };
};

/**
 * JPDB parse-first lookup path.
 * Falls back to the existing heuristic matcher when JPDB is not configured
 * or when JPDB returns no usable vocabulary mappings.
 */
export const findVocabularyMatchesWithJpdbFirstPass = async (
  text: string,
  allSubjects: any[]
): Promise<{
  vocabularyMatches: VocabularyMatch[];
  kanjiMatches: KanjiMatch[];
  jpdbParsedTokens?: JpdbParsedTokenAnnotation[];
}> => {
  const vocabularySubjects = allSubjects.filter(
    (subject) =>
      subject.object === "vocabulary" || subject.object === "kana_vocabulary"
  );
  const kanjiSubjects = allSubjects.filter(
    (subject) => subject.object === "kanji"
  );
  const kanjiMatches = findKanjiMatchesInText(text, kanjiSubjects);
  const parsedTokens = await parseTextWithJpdb(text);

  if (!parsedTokens || parsedTokens.length === 0) {
    return {
      vocabularyMatches: findHeuristicVocabularyMatches(text, vocabularySubjects),
      kanjiMatches,
      jpdbParsedTokens: (parsedTokens ?? []).map((token) => ({
        start: token.start,
        end: token.end,
        surface: token.surface,
        spelling: token.spelling,
        reading: token.reading,
        meaning: token.meaning,
        partsOfSpeech: token.partsOfSpeech,
        isVerb: token.isVerb,
        isGrammar: token.isGrammar,
        tokenType: token.isGrammar
          ? "grammar"
          : token.isVerb
            ? "verb"
            : "vocabulary",
      })),
    };
  }

  const {
    vocabularyMatches: jpdbMappedWanikaniVocabularyMatches,
    consumedTokenKeys,
    tokenToVocabularyId: wkTokenToVocabularyId,
  } = findVocabularyMatchesFromJpdbTokens(
    text,
    vocabularySubjects,
    parsedTokens
  );
  const {
    vocabularyMatches: externalJpdbVocabularyMatches,
    tokenToVocabularyId: jpdbOnlyTokenToVocabularyId,
  } = findExternalJpdbVocabularyMatches(
    parsedTokens,
    consumedTokenKeys,
    kanjiSubjects
  );
  const tokenToVocabularyId = new Map<string, number>([
    ...wkTokenToVocabularyId.entries(),
    ...jpdbOnlyTokenToVocabularyId.entries(),
  ]);
  const combinedJpdbVocabularyMatches = [
    ...jpdbMappedWanikaniVocabularyMatches,
    ...externalJpdbVocabularyMatches,
  ].sort((a, b) => b.characters.length - a.characters.length);
  const jpdbParsedTokens: JpdbParsedTokenAnnotation[] = parsedTokens.map((token) => {
    const tokenKey = getJpdbTokenKey(token);
    return {
      start: token.start,
      end: token.end,
      surface: token.surface,
      spelling: token.spelling,
      reading: token.reading,
      meaning: token.meaning,
      partsOfSpeech: token.partsOfSpeech,
      isVerb: token.isVerb,
      isGrammar: token.isGrammar,
      tokenType: token.isGrammar
        ? "grammar"
        : token.isVerb
          ? "verb"
          : "vocabulary",
      mappedVocabularyId: tokenToVocabularyId.get(tokenKey),
    };
  });

  if (combinedJpdbVocabularyMatches.length === 0) {
    return {
      vocabularyMatches: findHeuristicVocabularyMatches(text, vocabularySubjects),
      kanjiMatches,
      jpdbParsedTokens,
    };
  }

  return {
    vocabularyMatches: combinedJpdbVocabularyMatches,
    kanjiMatches,
    jpdbParsedTokens,
  };
};

/**
 * Calculates the segments for highlighting text based on matches.
 * Prioritizes longer matches (Vocabulary) over shorter ones (Kanji/Sub-vocab).
 * Uses Regex to find matches even if they contain whitespace/newlines in the text.
 */
export const getHighlightSegments = (
  text: string,
  matches: AnyMatch[]
): { text: string; match?: AnyMatch }[] => {
  if (!text) return [{ text }];

  // Sort matches by length (longer first) to ensure greedy matching
  const sortedMatches = [...matches].sort(
    (a, b) => b.characters.length - a.characters.length
  );
  const cacheKey = `${text}::${sortedMatches
    .map((match) => {
      const verbConjugationKind =
        match.type === "vocabulary" || match.type === "kana_vocabulary"
          ? (match as VocabularyMatch).disableConjugationExpansion
            ? "none"
            : (match as VocabularyMatch).verbConjugationKind ?? "none"
          : "none";
      const conjugationExpansionMode =
        match.type === "vocabulary" || match.type === "kana_vocabulary"
          ? (match as VocabularyMatch).disableConjugationExpansion
            ? "jpdb-surface-only"
            : "heuristic"
          : "none";
      return `${match.id}:${match.type}:${match.characters}:${verbConjugationKind}:${conjugationExpansionMode}`;
    })
    .join("|")}`;
  const cachedSegments = HIGHLIGHT_SEGMENTS_CACHE.get(cacheKey);
  if (cachedSegments) {
    return cachedSegments;
  }

  const highlights: HighlightSegment[] = [];

  // Find all match instances in the text
  sortedMatches.forEach((match) => {
    const matchCandidates =
      match.type === "vocabulary" || match.type === "kana_vocabulary"
        ? (match as VocabularyMatch).matchCandidates ?? getVocabMatchCandidates(match.characters)
        : getVocabMatchCandidates(match.characters);
    const verbConjugationKind: VerbConjugationKind =
      match.type === "vocabulary" || match.type === "kana_vocabulary"
        ? (match as VocabularyMatch).disableConjugationExpansion
          ? "none"
          : (match as VocabularyMatch).verbConjugationKind ?? "none"
        : "none";

    const regexes = buildHighlightRegexes(
      matchCandidates,
      verbConjugationKind
    );

    const localHighlights: HighlightSegment[] = [];
    const seenLocalRanges = new Set<string>();

    regexes.forEach((regex) => {
      let regexMatch;
      while ((regexMatch = regex.exec(text)) !== null) {
        const index = regexMatch.index;
        const length = regexMatch[0].length;
        const matchedSurface = regexMatch[0];

        if (
          !shouldAcceptSurfaceMatch(
            text,
            index,
            matchedSurface,
            match.characters
          )
        ) {
          continue;
        }
        const rangeKey = `${index}:${index + length}`;

        if (seenLocalRanges.has(rangeKey)) {
          continue;
        }
        seenLocalRanges.add(rangeKey);

        localHighlights.push({
          start: index,
          end: index + length,
          match,
        });
      }
    });

    localHighlights.sort((a, b) => {
      const aLength = a.end - a.start;
      const bLength = b.end - b.start;
      if (bLength !== aLength) {
        return bLength - aLength;
      }
      return a.start - b.start;
    });

    localHighlights.forEach((localHighlight) => {
      const index = localHighlight.start;
      const length = localHighlight.end - localHighlight.start;
      // Check for overlap with existing confirmed highlights
      const overlaps = highlights.some(
        (h) =>
          (index >= h.start && index < h.end) || // Start overlaps
          (index + length > h.start && index < h.end) || // End overlaps
          (index <= h.start && index + length >= h.end) // Encloses existing
      );

      // If no overlap, add it
      if (!overlaps) {
        highlights.push(localHighlight);
      }
    });
  });

  // Sort highlights by position to build the final string
  highlights.sort((a, b) => a.start - b.start);

  const segments: { text: string; match?: AnyMatch }[] = [];
  let lastIndex = 0;

  highlights.forEach((highlight) => {
    // Add non-highlighted text before the match
    if (highlight.start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, highlight.start),
      });
    }

    // Add the match
    segments.push({
      text: text.slice(highlight.start, highlight.end),
      match: highlight.match,
    });

    lastIndex = highlight.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
    });
  }

  HIGHLIGHT_SEGMENTS_CACHE.set(cacheKey, segments);
  if (HIGHLIGHT_SEGMENTS_CACHE.size > MAX_HIGHLIGHT_SEGMENTS_CACHE_ENTRIES) {
    const oldestKey = HIGHLIGHT_SEGMENTS_CACHE.keys().next().value;
    if (oldestKey) {
      HIGHLIGHT_SEGMENTS_CACHE.delete(oldestKey);
    }
  }

  return segments;
};

function normalizeSurfaceForInflection(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function getVerbInflectionLabelsForMatch(
  match: AnyMatch,
  surfaceText: string
): string[] {
  if (!(match.type === "vocabulary" || match.type === "kana_vocabulary")) {
    return [];
  }

  const vocabularyMatch = match as VocabularyMatch;
  if (!vocabularyMatch.verbConjugationKind) {
    return [];
  }

  const normalizedSurface = normalizeSurfaceForInflection(surfaceText);
  if (!normalizedSurface) {
    return [];
  }

  const normalizedDictionaryForms = new Set<string>();
  const normalizedCharacters = normalizeSurfaceForInflection(vocabularyMatch.characters);
  if (normalizedCharacters) {
    normalizedDictionaryForms.add(normalizedCharacters);
  }
  if (Array.isArray(vocabularyMatch.readings)) {
    for (const readingEntry of vocabularyMatch.readings) {
      if (typeof readingEntry?.reading !== "string") {
        continue;
      }
      const normalizedReading = normalizeSurfaceForInflection(readingEntry.reading);
      if (normalizedReading) {
        normalizedDictionaryForms.add(normalizedReading);
      }
    }
  }

  if (normalizedDictionaryForms.has(normalizedSurface)) {
    return [];
  }

  const labels = new Set<string>();

  if (
    /(?:ています|ていました|ていません|ていませんでした|でいます|でいました|でいません|でいませんでした)$/.test(
      normalizedSurface
    )
  ) {
    labels.add("Te-iru-form");
    labels.add("Masu-form");
  } else if (/(?:ている|でいる|ていた|でいた|てる|でる|てた|でた)$/.test(normalizedSurface)) {
    labels.add("Te-iru-form");
  }

  if (/(?:ます|ました|ません|ませんでした|ましょう)$/.test(normalizedSurface)) {
    labels.add("Masu-form");
  }

  if (/(?:たい|たくない|たかった|たくなかった)$/.test(normalizedSurface)) {
    labels.add("Tai-form");
  }

  if (/(?:ない|なかった|なくて|なければ)$/.test(normalizedSurface)) {
    labels.add("Negative-form");
  }

  if (/(?:させる|せる|させない|せない|させた|せた|させて|せて)$/.test(normalizedSurface)) {
    labels.add("Causative-form");
  }

  if (
    /(?:られる|れる|られない|れない|られた|れた|られて|れて|える|えない|えた|えて)$/.test(
      normalizedSurface
    )
  ) {
    labels.add("Potential/Passive-form");
  }

  if (/(?:よう|おう)$/.test(normalizedSurface)) {
    labels.add("Volitional-form");
  }

  if (/(?:たら|れば|ば)$/.test(normalizedSurface)) {
    labels.add("Conditional-form");
  }

  if (/(?:て|で)$/.test(normalizedSurface)) {
    labels.add("Te-form");
  }

  if (/(?:た|だ)$/.test(normalizedSurface)) {
    labels.add("Past-form");
  }

  return Array.from(labels);
}

export function isWaniKaniBackedMatch(match: AnyMatch | null | undefined): boolean {
  if (!match) {
    return false;
  }

  if (match.type === "vocabulary" || match.type === "kana_vocabulary") {
    return (match as VocabularyMatch).isWaniKaniSubject !== false;
  }

  return true;
}

/**
 * Helper to get the standard color for a WaniKani item type.
 */
export const getItemColor = (type: WaniKaniItemType) => {
  return getSubjectTypeColor(type);
};
