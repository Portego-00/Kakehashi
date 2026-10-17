import { toHiragana } from "wanakana";
import type { Subject } from "../types/wanikani";
import { normalizeString } from "./answerChecker";

export interface ReviewAnswerChoice {
  text: string;
  isCorrect: boolean;
}

type QuestionType = "meaning" | "reading";
type MeaningPart = "verb" | "noun" | "adjective" | "adverb" | "pronoun" |
  "numeral" | "counter" | "expression" | "interjection" | "conjunction" |
  "prefix" | "suffix" | "particle";

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
  "imagine imagination expect expectation assume assumption predict prediction think thought idea ideology believe belief memory remember forget",
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
// Used only after suitable catalog answers are exhausted, including offline.
const FALLBACK_MEANINGS = {
  verb: [
    "To Go", "To Come", "To Return", "To Enter", "To Leave", "To Arrive",
    "To Walk", "To Run", "To Move", "To Stop", "To Begin", "To Finish",
    "To See", "To Watch", "To Hear", "To Listen", "To Speak", "To Ask",
    "To Answer", "To Think", "To Know", "To Remember", "To Forget",
    "To Eat", "To Drink", "To Cook", "To Read", "To Write", "To Study",
    "To Learn", "To Teach", "To Buy", "To Sell", "To Pay", "To Work",
    "To Sleep", "To Wake Up", "To Open", "To Close", "To Wait",
  ],
  noun: [
    "Water", "Fire", "Earth", "Mountain", "River", "Sea", "Rain", "Snow",
    "Cloud", "Wind", "Sky", "Sun", "Moon", "Tree", "Flower", "Forest",
    "Dog", "Cat", "Bird", "Fish", "Horse", "Rice", "Bread", "Tea",
    "School", "Student", "Teacher", "Book", "Language", "Car", "Train",
    "Station", "Road", "House", "Room", "Door", "Window", "Town",
    "City", "Country", "Money", "Time", "Morning", "Night",
  ],
  adjective: [
    "Big", "Small", "Long", "Short", "Tall", "Wide", "Narrow", "Deep",
    "Shallow", "Good", "Bad", "New", "Old", "Young", "Hot", "Cold",
    "Warm", "Cool", "Fast", "Slow", "Strong", "Weak", "Heavy", "Light",
    "Quiet", "Loud", "Clean", "Dirty", "Easy", "Difficult", "Happy", "Sad",
  ],
  adverb: [
    "Quickly", "Slowly", "Quietly", "Loudly", "Carefully", "Easily",
    "Usually", "Often", "Sometimes", "Always", "Never", "Already", "Soon",
    "Immediately", "Together", "Separately", "Suddenly", "Gradually",
  ],
  pronoun: ["I", "You", "He", "She", "We", "They", "This", "That", "Someone", "Anyone", "Everybody", "Nobody"],
  numeral: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"],
  counter: ["Counter For People", "Counter For Books", "Counter For Small Animals", "Counter For Floors", "Counter For Machines", "Counter For Flat Objects"],
  expression: ["Good Morning", "Good Evening", "Thank You", "Excuse Me", "See You", "You're Welcome", "Please", "Nice To Meet You"],
  interjection: ["Hello", "Goodbye", "Thanks", "Wow", "Oh", "Hey", "Yes", "No"],
  conjunction: ["And", "Or", "But", "Because", "Although", "If", "Unless", "While"],
  prefix: ["Super", "New", "Every", "Former", "Anti", "Non"],
  suffix: ["Style", "Like", "Person", "Shop", "Store", "Way", "Years Old"],
  particle: ["Of", "And", "Or", "But", "From", "Until", "Only", "Also"],
} satisfies Record<MeaningPart, string[]>;
const FALLBACK_READINGS = [
  "あめ", "ゆき", "かぜ", "そら", "やま", "かわ", "うみ", "はな",
  "いぬ", "ねこ", "とり", "うま", "みず", "ひと", "いえ", "ほん",
];
const DIGIT_READINGS = ["ぜろ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
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

function isVerbMeaning(text: string): boolean {
  return /^to\s+/i.test(text.normalize("NFKC").trim());
}

function isVocabulary(subject: Subject): boolean {
  return subject.object === "vocabulary" || subject.object === "kana_vocabulary";
}

/** Broad families allow i/na adjectives and different verb classes to compete. */
function meaningParts(subject: Subject, text: string): Set<MeaningPart> {
  const parts = new Set<MeaningPart>();
  for (const value of subject.data.parts_of_speech ?? []) {
    const tag = value.trim().toLowerCase().replace(/[_-]/g, " ");
    if (/\bverb\b/.test(tag)) parts.add("verb");
    else if (/\bnoun\b/.test(tag)) parts.add("noun");
    else if (/\badjective\b/.test(tag)) parts.add("adjective");
    else for (const word of tag.split(/[^a-z]+/)) {
      if (Object.hasOwn(FALLBACK_MEANINGS, word)) parts.add(word as MeaningPart);
    }
  }
  // A noun/suru-verb subject can supply different grammatical senses. Use the
  // selected English meaning, rather than letting its noun tag qualify a verb.
  if (parts.has("verb") && parts.size > 1) {
    if (isVerbMeaning(text)) return new Set(["verb"]);
    parts.delete("verb");
  }
  if (parts.size === 0 && isVerbMeaning(text)) parts.add("verb");
  return parts;
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

/** Prefers difficult choices, then learned answers, with an offline fallback. */
export function createReviewAnswerChoices({
  subject,
  questionType,
  subjects,
  learnedSubjectIds,
  meaningSynonyms = [],
  seed,
}: {
  subject: Subject;
  questionType: QuestionType;
  subjects: readonly Subject[];
  learnedSubjectIds?: ReadonlySet<number>;
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
  // Match the displayed English form, even for noun/suru-verb entries or
  // subjects without parts-of-speech metadata. Kanji overlap cannot override it.
  const targetIsVerb = isVerbMeaning(correct);
  const compatibleMeaning = (text: string) => isVerbMeaning(text) === targetIsVerb;
  const targetParts = meaningParts(subject, correct);
  const targetPart = targetParts.values().next().value ?? (targetIsVerb ? "verb" : "noun");
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
  const meaningEntries = (candidate: Subject) => {
    // A shared meaning can identify a synonym even if it is not primary.
    if (candidate.data.meanings.some((entry) =>
      excluded.has(normalize(entry.meaning, "meaning")),
    )) return [];
    return candidate.data.meanings
      .filter((entry) => entry.accepted_answer !== false && compatibleMeaning(entry.meaning))
      .map((entry) => {
        const parts = meaningParts(candidate, entry.meaning);
        const grammarRank = targetParts.size === 0 || parts.size === 0
          ? 1 : overlap(targetParts, parts) > 0 ? 2 : 0;
        return { text: entry.meaning, primary: entry.primary, grammarRank };
      })
      .filter((entry) => entry.grammarRank > 0)
      .sort((a, b) => b.grammarRank - a.grammarRank ||
        Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  };
  const random = randomFromSeed(seed);
  const candidates = new Map<string, { text: string; score: number; grammarRank: number }>();
  const add = (text: string, score: number, grammarRank = 1) => {
    const key = normalize(text, questionType);
    if (!key || excluded.has(key)) return;
    const existing = candidates.get(key);
    if (!existing || grammarRank > existing.grammarRank ||
      (grammarRank === existing.grammarRank && score > existing.score))
      candidates.set(key, {
        text: questionType === "reading" ? key : text,
        score,
        grammarRank,
      });
  };
  const characters = new Set(subject.data.characters ?? "");
  const components = new Set(subject.data.component_subject_ids ?? []);
  const similarIds = new Set(subject.data.visually_similar_subject_ids ?? []);
  const isRadicalName =
    subject.object === "radical" && questionType === "meaning";
  const amalgamations = new Set(subject.data.amalgamation_subject_ids ?? []);
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
    const sharedVocabularyPool = questionType === "meaning" && targetParts.size > 0 &&
      isVocabulary(subject) && isVocabulary(candidate);
    if (candidate.id === subject.id ||
      (candidate.object !== subject.object && !sharedVocabularyPool))
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
      (similarIds.has(candidate.id) ? 20 : 0) +
      (isRadicalName
        ? Math.min(
            overlap(
              amalgamations,
              new Set(candidate.data.amalgamation_subject_ids ?? []),
            ),
            3,
          ) * 16
        : 0);
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
      const entry = meaningEntries(candidate)[0];
      if (!entry) continue;
      const candidateWords = words(
        candidate.data.meanings.map((entry) => entry.meaning).join(" "),
      );
      const semantic = targetFamilies.some(
        (family) => overlap(family, candidateWords) > 0,
      );
      const commonWords = overlap(targetWords, candidateWords);
      const sharedPart = entry.grammarRank === 2;
      const hasMeaningRelation =
        semantic || related > 0 || commonWords > 0 || sharedPart;
      // Radical mnemonics often have no semantic family or parts of speech.
      // Prefer related radicals, then other radical names from nearby levels.
      if (!hasMeaningRelation && !isRadicalName) continue;
      add(
        entry.text,
        related +
          (semantic ? 40 : 0) +
          commonWords * 12 +
          (sharedPart ? 10 : 0) -
          (hasMeaningRelation ? 0 : 40) -
          Math.min(levelGap, 20),
        entry.grammarRank,
      );
    }
  }
  const distractors = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score: candidate.score + random() * 6,
    }))
    .sort((a, b) => b.grammarRank - a.grammarRank || b.score - a.score)
    .slice(0, 3);
  if (distractors.length < 3) {
    // Keep every difficult choice. Prefer learned answers and the same subject
    // type, then widen to compatible catalog answers before the offline bank.
    const used = new Set([
      ...excluded,
      ...distractors.map(({ text }) => normalize(text, questionType)),
    ]);
    const fallback = subjects
      .filter((candidate) => candidate.id !== subject.id)
      .map((candidate) => ({
        candidate,
        entries: questionType === "reading"
          ? (candidate.data.readings ?? [])
              .filter((entry) => entry.accepted_answer !== false)
              .map((entry) => ({ text: entry.reading, primary: entry.primary, grammarRank: 1 }))
              .sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)))
          : meaningEntries(candidate),
        rank: random(),
      }))
      .filter(({ entries }) => entries.length > 0)
      .sort(
        (a, b) =>
          b.entries[0].grammarRank - a.entries[0].grammarRank ||
          Number(Boolean(learnedSubjectIds?.has(b.candidate.id))) -
            Number(Boolean(learnedSubjectIds?.has(a.candidate.id))) ||
          Number(b.candidate.object === subject.object) -
            Number(a.candidate.object === subject.object) || a.rank - b.rank,
      );
    for (const { entries } of fallback) {
      // Try alternate accepted answers too if a primary answer is already used.
      for (const { text, grammarRank } of entries) {
        const key = normalize(text, questionType);
        if (!key || used.has(key)) continue;
        used.add(key);
        distractors.push({
          text: questionType === "reading" ? key : text,
          score: 0,
          grammarRank,
        });
        if (distractors.length === 3) break;
      }
      if (distractors.length === 3) break;
    }
    if (distractors.length < 3) {
      const localAnswers = questionType === "reading"
        ? FALLBACK_READINGS
        : FALLBACK_MEANINGS[targetPart].map((text) => targetIsVerb
            ? isVerbMeaning(text) ? text : `To Be ${text}`
            : text.replace(/^To\s+/i, ""));
      const localFallback = localAnswers.map((text) => ({ text, rank: random() }))
        .sort((a, b) => a.rank - b.rank);
      for (const { text } of localFallback) {
        const key = normalize(text, questionType);
        if (used.has(key)) continue;
        used.add(key);
        distractors.push({ text, score: 0, grammarRank: 2 });
        if (distractors.length === 3) break;
      }
    }
    // Even a custom prompt with aliases covering the entire local bank must
    // keep four choices. Numeric phrases/readings provide an extensible reserve.
    let number = 1 + Math.floor(random() * 100);
    while (distractors.length < 3) {
      const value = String(number++);
      const text = questionType === "reading"
        ? [...value].map((digit) => DIGIT_READINGS[Number(digit)]).join("")
        : targetPart === "adjective" ? `${targetIsVerb ? "To Be " : ""}${value} Years Old`
        : targetPart === "adverb" ? `Every ${value} Days`
        : targetPart === "verb" ? `${targetIsVerb ? "To " : ""}Count To ${value}`
        : `Number ${value}`;
      const key = normalize(text, questionType);
      if (used.has(key)) continue;
      used.add(key);
      distractors.push({ text, score: 0, grammarRank: 1 });
    }
  }
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
