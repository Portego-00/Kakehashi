import { toHiragana } from "wanakana";
import type { Subject } from "../types/wanikani";
import { normalizeString } from "./answerChecker";

export interface ReviewAnswerChoice {
  text: string;
  isCorrect: boolean;
}

type QuestionType = "meaning" | "reading";

const MEANING_FAMILIES = [
  "one two three four five six seven eight nine ten hundred thousand million number count",
  "day week month year morning afternoon evening night time hour minute second yesterday today tomorrow",
  "north south east west left right up down above below inside outside front back middle center direction",
  "person man woman boy girl child adult baby father mother parent brother sister family husband wife",
  "water fire earth ground soil mountain river sea ocean lake rain snow cloud wind sky sun moon weather",
  "dog cat bird fish horse cow pig sheep insect animal chicken duck bear monkey rabbit",
  "hand arm leg foot head face eye ear mouth nose tooth neck body finger heart",
  "red blue green yellow black white brown purple pink orange color",
  "rice bread meat food meal breakfast lunch dinner eat drink tea coffee milk juice cooking restaurant",
  "school student teacher study learn teach lesson class education university test exam book read write language",
  "car train bus bicycle airplane ship boat road street station airport travel journey trip transport",
  "money yen dollar price cost buy sell pay bank cheap expensive shop store business company work job",
  "big large small little long short tall high low wide narrow deep shallow size",
  "good bad correct wrong true false new old young hot cold warm cool fast slow strong weak heavy light",
  "go come return enter exit leave arrive depart walk run move stop start begin finish end",
  "see look watch hear listen speak say talk tell ask answer think know understand remember forget",
  "love like hate happy sad angry afraid fear fun joy feeling emotion",
  "house home room door window building roof floor wall garden town city village country place",
  "tree wood forest flower grass leaf plant bamboo fruit seed root branch",
  "clothes shirt coat dress skirt trousers pants shoe sock hat wear clothing",
].map((family) => new Set(family.split(" ")));
const IGNORED_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "be",
  "in",
  "on",
  "and",
  "something",
  "someone",
]);
const KANA_GROUPS = [
  "かが",
  "きぎ",
  "くぐ",
  "けげ",
  "こご",
  "さざ",
  "しじ",
  "すず",
  "せぜ",
  "そぞ",
  "ただ",
  "ちぢ",
  "つづ",
  "てで",
  "とど",
  "はばぱ",
  "ひびぴ",
  "ふぶぷ",
  "へべぺ",
  "ほぼぽ",
  "やゃ",
  "ゆゅ",
  "よょ",
  "つっ",
];
const KANA_ROWS = [
  "あいうえお",
  "かきくけこ",
  "がぎぐげご",
  "さしすせそ",
  "ざじずぜぞ",
  "たちつてと",
  "だぢづでど",
  "なにぬねの",
  "はひふへほ",
  "ばびぶべぼ",
  "ぱぴぷぺぽ",
  "まみむめも",
  "やゆよ",
  "らりるれろ",
  "わを",
];

function normalize(text: string, type: QuestionType): string {
  const value = text.normalize("NFKC").trim();
  return type === "reading"
    ? toHiragana(value).replace(/\s/g, "")
    : normalizeString(value, "meaning")
        .replace(/^(a|an|the|to)\s+/, "")
        .replace(/\s+/g, " ");
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word && !IGNORED_WORDS.has(word)),
  );
}

function overlap<T>(a: Set<T>, b: Set<T>): number {
  let count = 0;
  for (const value of a) if (b.has(value)) count++;
  return count;
}

function partsOfSpeech(subject: Subject): Set<string> {
  const data = subject.data as Subject["data"] & { parts_of_speech?: string[] };
  return new Set(data.parts_of_speech ?? []);
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) {
      next[j + 1] = Math.min(
        next[j] + 1,
        row[j + 1] + 1,
        row[j] + (a[i] === b[j] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[b.length];
}

function randomFromSeed(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One local change at a time: voicing, vowel length, gemination, or a nearby kana. */
function readingConfusions(
  reading: string,
  okurigana: string,
): Map<string, number> {
  const candidates = new Map<string, number>();
  const stemLength =
    okurigana && reading.endsWith(okurigana)
      ? reading.length - okurigana.length
      : reading.length;
  for (let index = 0; index < stemLength; index++) {
    const kana = reading[index];
    const replace = (replacement: string, score: number) => {
      const text =
        reading.slice(0, index) + replacement + reading.slice(index + 1);
      if (
        text &&
        text !== reading &&
        !/^[ゃゅょっー]/.test(text) &&
        !/[^いきぎしじちぢにひびぴみり][ゃゅょ]/.test(text)
      ) {
        candidates.set(text, Math.max(score, candidates.get(text) ?? 0));
      }
    };
    for (const group of KANA_GROUPS) {
      if (group.includes(kana)) for (const other of group) replace(other, 90);
    }
    // Long vowels and doubled consonants are common reading traps.
    if (index > 0 && "ういーっ".includes(kana)) replace("", 92);
    if (
      "おこごそぞとどのほぼぽもよょろ".includes(kana) &&
      reading[index + 1] !== "う"
    )
      replace(`${kana}う`, 88);
    if (
      "えけげせぜてでねへべぺめれ".includes(kana) &&
      reading[index + 1] !== "い"
    )
      replace(`${kana}い`, 88);
    if (
      index > 0 &&
      "かきくけこさしすせそたちつてとはひふへほぱぴぷぺぽ".includes(kana)
    )
      replace(`っ${kana}`, 86);
    // Lower-priority fallback, still a single sound change, never random strings.
    for (const row of KANA_ROWS) {
      if (row.includes(kana)) for (const other of row) replace(other, 55);
    }
  }
  return candidates;
}

/** Generates four unambiguous choices, or none when the local catalog is insufficient. */
export function createReviewAnswerChoices({
  subject,
  questionType,
  subjects,
  meaningSynonyms = [],
  seed,
}: {
  subject: Subject;
  questionType: QuestionType;
  subjects: readonly Subject[];
  meaningSynonyms?: readonly string[];
  seed: string;
}): ReviewAnswerChoice[] {
  const readings = subject.data.readings ?? [];
  const meanings = subject.data.meanings ?? [];
  const accepted =
    questionType === "reading"
      ? readings
          .filter((entry) => entry.accepted_answer !== false)
          .map((entry) => ({ text: entry.reading, primary: entry.primary }))
      : meanings
          .filter((entry) => entry.accepted_answer !== false)
          .map((entry) => ({ text: entry.meaning, primary: entry.primary }));
  const correctEntry = accepted.find((entry) => entry.primary) ?? accepted[0];
  if (!correctEntry) return [];
  const correct =
    questionType === "reading"
      ? normalize(correctEntry.text, questionType)
      : correctEntry.text;
  // Exclude even non-primary readings, whitelist meanings, and user synonyms from distractors.
  const excluded = new Set(
    (questionType === "reading"
      ? readings.map((entry) => entry.reading)
      : [
          ...meanings.map((entry) => entry.meaning),
          ...(subject.data.auxiliary_meanings ?? [])
            .filter((entry) => entry.type === "whitelist")
            .map((entry) => entry.meaning),
          ...meaningSynonyms,
        ]
    ).map((text) => normalize(text, questionType)),
  );
  const random = randomFromSeed(seed);
  const candidates = new Map<string, { text: string; score: number }>();
  const add = (text: string, score: number) => {
    const key = normalize(text, questionType);
    if (!key || excluded.has(key)) return;
    const existing = candidates.get(key);
    if (!existing || score > existing.score)
      candidates.set(key, {
        text: questionType === "reading" ? key : text,
        score,
      });
  };
  const characters = new Set(subject.data.characters ?? "");
  const components = new Set(subject.data.component_subject_ids ?? []);
  const similarIds = new Set(subject.data.visually_similar_subject_ids ?? []);
  const targetParts = partsOfSpeech(subject);
  const targetWords = words(meanings.map((entry) => entry.meaning).join(" "));
  const targetFamilies = MEANING_FAMILIES.filter(
    (family) => overlap(family, targetWords) > 0,
  );
  const okurigana =
    subject.object === "vocabulary"
      ? toHiragana(
          subject.data.characters?.match(/[ぁ-ゖァ-ヺー]+$/)?.[0] ?? "",
        )
      : "";

  if (questionType === "reading") {
    for (const [text, score] of readingConfusions(correct, okurigana))
      add(text, score);
  }
  for (const candidate of subjects) {
    if (candidate.id === subject.id || candidate.object !== subject.object)
      continue;
    const commonCharacters = overlap(
      characters,
      new Set((candidate.data.characters ?? "").replace(/[ぁ-ゖァ-ヺー]/g, "")),
    );
    const commonComponents = overlap(
      components,
      new Set(candidate.data.component_subject_ids ?? []),
    );
    const related =
      commonCharacters * 12 +
      commonComponents * 4 +
      (similarIds.has(candidate.id) ? 20 : 0);
    const levelGap = Math.abs(
      (candidate.data.level ?? 1) - (subject.data.level ?? 1),
    );
    if (questionType === "reading") {
      for (const entry of candidate.data.readings ?? []) {
        const text = normalize(entry.reading, "reading");
        if (
          Math.abs(text.length - correct.length) > 1 ||
          (okurigana && !text.endsWith(okurigana))
        )
          continue;
        const edits = distance(correct, text);
        if (
          edits < 1 ||
          edits > Math.max(1, Math.min(2, Math.floor(correct.length / 2)))
        )
          continue;
        add(
          text,
          95 - edits * 8 + Math.min(related, 18) - Math.min(levelGap, 10),
        );
      }
    } else {
      // Subjects sharing an accepted meaning may be synonyms of the prompt.
      if (
        candidate.data.meanings.some((entry) =>
          excluded.has(normalize(entry.meaning, "meaning")),
        )
      )
        continue;
      const candidateWords = words(
        candidate.data.meanings.map((entry) => entry.meaning).join(" "),
      );
      const semantic = targetFamilies.some(
        (family) => overlap(family, candidateWords) > 0,
      );
      const commonWords = overlap(targetWords, candidateWords);
      const sharedPart = overlap(targetParts, partsOfSpeech(candidate)) > 0;
      if (!semantic && !related && !commonWords && !sharedPart) continue;
      const entry =
        candidate.data.meanings.find(
          (meaning) => meaning.primary && meaning.accepted_answer !== false,
        ) ??
        candidate.data.meanings.find(
          (meaning) => meaning.accepted_answer !== false,
        );
      if (entry)
        add(
          entry.meaning,
          related +
            (semantic ? 40 : 0) +
            commonWords * 12 +
            (sharedPart ? 10 : 0) -
            Math.min(levelGap, 20),
        );
    }
  }
  const distractors = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score: candidate.score + random() * 6,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (distractors.length < 3) return [];
  const choices = [
    { text: correct, isCorrect: true },
    ...distractors.map(({ text }) => ({ text, isCorrect: false })),
  ];
  for (let index = choices.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [choices[index], choices[other]] = [choices[other], choices[index]];
  }
  return choices;
}
