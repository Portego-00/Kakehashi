import type {
  JlptLevel,
  JlptQuestion,
  JlptQuestionOption,
  JlptSkill,
  JlptTestItemType,
  JlptVerbalScene,
} from "../../types";
import type { UpperListeningSeed } from "./upper-listening-seeds";
import type { LowerListeningSeed } from "./lower-listening-seeds";
import { readingBody, type ReadingSeed } from "./reading-seed";

export const GENERATED_QUESTIONS_PER_TYPE = 200;

const DAYS = [
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
  "日曜日",
] as const;
const TIMES = [
  "八時",
  "九時",
  "十時",
  "十一時",
  "十二時",
  "一時",
  "二時",
  "三時",
  "四時",
  "五時",
  "六時",
  "七時",
] as const;
const COUNTERS = [
  "一つ",
  "二つ",
  "三つ",
  "四つ",
  "五つ",
  "六つ",
  "七つ",
  "八つ",
  "九つ",
  "十",
] as const;

export interface LexemeSeed {
  surface: string;
  reading: string;
  readingDistractors: readonly [string, string, string];
  kana: string;
  spellingDistractors: readonly [string, string, string];
  sentence: string;
  paraphrase: string;
  paraphraseDistractors: readonly [string, string, string];
  relatedKanji?: readonly string[];
}

export interface ClozeSeed {
  semanticId?: string;
  stem: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
}

export interface TextGrammarSeed {
  id: string;
  groupId: string;
  blankId: string;
  blankOrder: number;
  passage: string;
  canonicalPassage?: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
}

export interface UsageSeed {
  focus: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
}

export interface CompositionSeed {
  semanticId?: string;
  prefix: string;
  parts: readonly [string, string, string, string];
  suffix: string;
  explanation: string;
}

export interface WordFormationSeed extends ClozeSeed {
  focus: string;
}

export interface LevelQuestionProfile {
  level: JlptLevel;
  complexity: 1 | 2 | 3 | 4 | 5;
  listeningRate: number;
  names: readonly string[];
  places: readonly string[];
  lexemes: readonly LexemeSeed[];
  orthography?: readonly LexemeSeed[];
  contexts: readonly ClozeSeed[];
  usages: readonly UsageSeed[];
  grammar: readonly ClozeSeed[];
  compositions: readonly CompositionSeed[];
  textGrammar: readonly TextGrammarSeed[];
  wordFormation?: readonly WordFormationSeed[];
  upperListening?: readonly UpperListeningSeed[];
  lowerListening?: readonly LowerListeningSeed[];
  upperReading?: readonly ReadingSeed[];
}

type TemplateValues = {
  person: string;
  other: string;
  place: string;
  day: string;
  nextDay: string;
  time: string;
  nextTime: string;
  count: string;
};

function valuesFor(
  profile: LevelQuestionProfile,
  variant: number,
): TemplateValues {
  return {
    person: profile.names[variant % profile.names.length],
    other: profile.names[(variant + 7) % profile.names.length],
    place: profile.places[(variant * 3) % profile.places.length],
    day: DAYS[(variant * 2) % DAYS.length],
    nextDay: DAYS[(variant * 2 + 3) % DAYS.length],
    time: TIMES[(variant * 3) % (TIMES.length - 1)],
    nextTime: TIMES[((variant * 3) % (TIMES.length - 1)) + 1],
    count: COUNTERS[(variant * 7) % COUNTERS.length],
  };
}

function fill(template: string, values: TemplateValues) {
  return template.replace(
    /\{(person|other|place|day|nextDay|time|nextTime|count)\}/g,
    (_, key: keyof TemplateValues) => values[key],
  );
}

function fillQuestionText(
  template: string,
  values: TemplateValues,
  level: JlptLevel,
) {
  const rendered = fill(template, values);
  if (level === "N5" || level === "N4")
    return `${values.other}さん：「${rendered}」`;
  if (level === "N3")
    return `${values.other}さんは${values.day}に${values.place}でこう話した。\n「${rendered}」`;
  return `${values.day}の${values.time}、${values.place}での${values.other}氏の発言：\n「${rendered}」`;
}

function rotate<T>(items: readonly T[], offset: number) {
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function makeOptions(
  correct: string,
  distractors: readonly string[],
  seed: number,
  count = 4,
) {
  const fallback = (TIMES as readonly string[]).includes(correct)
    ? TIMES
    : (DAYS as readonly string[]).includes(correct)
      ? DAYS
      : [];
  const labels = [...new Set([correct, ...distractors, ...fallback])].slice(
    0,
    count,
  );
  if (labels.length !== count)
    throw new Error(
      `Not enough unique generated options: ${[correct, ...distractors].join(" / ")}`,
    );
  const rotated = rotate(labels, seed % count);
  const options: JlptQuestionOption[] = rotated.map((label, index) => ({
    id: String(index + 1),
    label,
  }));
  const correctOptionId = options.find(
    (option) => option.label === correct,
  )?.id;
  if (!correctOptionId)
    throw new Error(`Missing generated correct option: ${correct}`);
  return { options, correctOptionId };
}

function idFor(level: JlptLevel, type: JlptTestItemType, index: number) {
  return `${level.toLowerCase()}-generated-${type}-${String(index + 1).padStart(3, "0")}`;
}

function familyAndVariant(index: number, familyCount: number) {
  return {
    family: index % familyCount,
    variant: Math.floor(index / familyCount),
  };
}

function baseQuestion(
  profile: LevelQuestionProfile,
  type: JlptTestItemType,
  skill: JlptSkill,
  index: number,
  semanticId: string,
  variantIndex: number,
): Pick<JlptQuestion, "id" | "level" | "officialType" | "skill"> & {
  provenance: NonNullable<JlptQuestion["provenance"]>;
} {
  return {
    id: idFor(profile.level, type, index),
    level: profile.level,
    officialType: type,
    skill,
    provenance: {
      semanticKey: `${profile.level.toLowerCase()}:${type}:${semanticId}`,
      variantIndex,
      authorship: "controlled-variant",
      editorialStatus: "machine-validated",
      contentVersion: 1,
    },
  };
}

function lexicalQuestion(
  profile: LevelQuestionProfile,
  type: "kanji-reading" | "orthography" | "paraphrase",
  index: number,
): JlptQuestion {
  const seeds =
    type === "orthography"
      ? (profile.orthography ?? profile.lexemes)
      : profile.lexemes;
  const { family, variant } = familyAndVariant(index, seeds.length);
  const seed = seeds[family];
  const values = valuesFor(profile, variant);
  const sentence = fillQuestionText(seed.sentence, values, profile.level);

  if (type === "kanji-reading") {
    const answer = makeOptions(seed.reading, seed.readingDistractors, index);
    return {
      ...baseQuestion(profile, type, "kanji", index, seed.surface, variant),
      instruction: "Choose the correct reading for the focused word.",
      stem: sentence,
      focus: seed.surface,
      ...answer,
      explanation: `${seed.surface} is read ${seed.reading} in this sentence. The surrounding sentence fixes the intended word and meaning.`,
      relatedKanji: seed.relatedKanji
        ? [...seed.relatedKanji]
        : [...seed.surface].filter((character) =>
            /\p{Script=Han}/u.test(character),
          ),
    };
  }

  if (type === "orthography") {
    const answer = makeOptions(seed.surface, seed.spellingDistractors, index);
    return {
      ...baseQuestion(profile, type, "kanji", index, seed.surface, variant),
      instruction: "Choose the best writing for the focused hiragana word.",
      stem: sentence.replace(seed.surface, seed.kana),
      focus: seed.kana,
      ...answer,
      explanation: `${seed.kana} is written ${seed.surface} here. The other spellings either use the wrong kanji or form a different word.`,
      relatedKanji: seed.relatedKanji
        ? [...seed.relatedKanji]
        : [...seed.surface].filter((character) =>
            /\p{Script=Han}/u.test(character),
          ),
    };
  }

  const answer = makeOptions(
    fill(seed.paraphrase, values),
    seed.paraphraseDistractors.map((item) => fill(item, values)),
    index,
  );
  return {
    ...baseQuestion(profile, type, "vocabulary", index, seed.surface, variant),
    instruction:
      "Choose the expression with nearly the same meaning in this context.",
    stem: sentence,
    focus: seed.surface,
    ...answer,
    explanation: `In this context, ${seed.surface} has the meaning expressed by “${fill(seed.paraphrase, values)}.”`,
    relatedKanji: seed.relatedKanji
      ? [...seed.relatedKanji]
      : [...seed.surface].filter((character) =>
          /\p{Script=Han}/u.test(character),
        ),
  };
}

function clozeQuestion(
  profile: LevelQuestionProfile,
  type: "context-expression" | "grammar-form" | "word-formation",
  index: number,
): JlptQuestion {
  const seeds =
    type === "context-expression"
      ? profile.contexts
      : type === "grammar-form"
        ? profile.grammar
        : (profile.wordFormation ?? []);
  if (seeds.length === 0)
    throw new Error(`${profile.level} has no seeds for ${type}`);
  const { family, variant } = familyAndVariant(index, seeds.length);
  const seed = seeds[family];
  const values = valuesFor(profile, variant);
  const answer = makeOptions(
    fill(seed.correct, values),
    seed.distractors.map((item) => fill(item, values)),
    index,
  );
  const skill: JlptSkill = type === "grammar-form" ? "grammar" : "vocabulary";
  const instructions: Record<typeof type, string> = {
    "context-expression":
      "Choose the word or expression that best completes the sentence.",
    "grammar-form": "Choose the grammar form that best completes the sentence.",
    "word-formation":
      "Choose the word formation that best completes the sentence.",
  };
  return {
    ...baseQuestion(
      profile,
      type,
      skill,
      index,
      seed.semanticId ?? `family-${family + 1}`,
      variant,
    ),
    instruction: instructions[type],
    stem: fillQuestionText(seed.stem, values, profile.level),
    ...(type === "word-formation"
      ? { focus: fill((seed as WordFormationSeed).focus, values) }
      : {}),
    ...answer,
    explanation: fill(seed.explanation, values),
  };
}

function textGrammarQuestion(
  profile: LevelQuestionProfile,
  index: number,
): JlptQuestion {
  const { family, variant } = familyAndVariant(
    index,
    profile.textGrammar.length,
  );
  const seed = profile.textGrammar[family];
  const values = valuesFor(profile, variant);
  const body = fill(seed.canonicalPassage ?? seed.passage, values);
  const answer = makeOptions(
    fill(seed.correct, values),
    seed.distractors.map((item) => fill(item, values)),
    index,
  );

  return {
    ...baseQuestion(
      profile,
      "text-grammar",
      "grammar",
      index,
      seed.id,
      variant,
    ),
    instruction:
      "Read the passage and choose the expression that best fits the blank.",
    stem: seed.canonicalPassage
      ? `文章を読み、空所${seed.blankOrder}に入るものとして、最もよいものを一つ選んでください。`
      : "（　）に入るものとして、最もよいものを一つ選んでください。",
    passage: {
      body,
      groupId: `${profile.level.toLowerCase()}:${seed.groupId}:variant-${variant}`,
      blankId: `${seed.blankId}:variant-${variant}`,
      blankOrder: seed.blankOrder,
    },
    ...answer,
    explanation: fill(seed.explanation, values),
  };
}

function usageQuestion(
  profile: LevelQuestionProfile,
  index: number,
): JlptQuestion {
  const { family, variant } = familyAndVariant(index, profile.usages.length);
  const seed = profile.usages[family];
  const values = valuesFor(profile, variant);
  const answer = makeOptions(
    fillQuestionText(seed.correct, values, profile.level),
    seed.distractors.map((item) =>
      fillQuestionText(item, values, profile.level),
    ),
    index,
  );
  return {
    ...baseQuestion(profile, "usage", "vocabulary", index, seed.focus, variant),
    instruction:
      "Choose the sentence in which the focused word is used correctly.",
    stem: seed.focus,
    focus: seed.focus,
    ...answer,
    explanation: fill(seed.explanation, values),
  };
}

function compositionQuestion(
  profile: LevelQuestionProfile,
  index: number,
): JlptQuestion {
  const { family, variant } = familyAndVariant(
    index,
    profile.compositions.length,
  );
  const seed = profile.compositions[family];
  const values = valuesFor(profile, variant);
  const canonicalLabels = seed.parts.map((part) => fill(part, values));
  if (new Set(canonicalLabels).size !== 4)
    throw new Error(
      `Duplicate composition fragment in ${profile.level} family ${family}`,
    );
  const permutation = rotate([0, 2, 3, 1] as const, index % 4);
  const options = permutation.map((canonicalIndex, optionIndex) => ({
    id: String(optionIndex + 1),
    label: canonicalLabels[canonicalIndex],
  }));
  const canonicalOrderOptionIds = canonicalLabels.map(
    (label) => options.find((option) => option.label === label)?.id ?? "",
  );
  const starredPosition = 2;
  const correctOptionId = canonicalOrderOptionIds[starredPosition];
  return {
    ...baseQuestion(
      profile,
      "sentence-composition",
      "grammar",
      index,
      seed.semanticId ?? `family-${family + 1}`,
      variant,
    ),
    instruction:
      "Arrange all four fragments to make one natural sentence. Which fragment belongs at ★?",
    stem:
      profile.complexity <= 2
        ? `${values.other}さん：「${fill(seed.prefix, values)}　＿＿　＿＿　★　＿＿　${fill(seed.suffix, values)}」`.trim()
        : `${values.day}の${values.time}、${values.other}氏の発言：\n「${fill(seed.prefix, values)}　＿＿　＿＿　★　＿＿　${fill(seed.suffix, values)}」`.trim(),
    options,
    correctOptionId,
    sentenceComposition: { canonicalOrderOptionIds, starredPosition },
    explanation: `${fill(seed.explanation, values)} The complete order is ${canonicalLabels.join(" ")}.`,
  };
}

type ReadingType =
  | "reading-short"
  | "reading-mid"
  | "reading-long"
  | "reading-integrated"
  | "reading-thematic"
  | "information-retrieval";

function readingQuestion(
  profile: LevelQuestionProfile,
  type: ReadingType,
  index: number,
): JlptQuestion {
  const authoredSeeds = profile.upperReading?.filter(
    (seed) => seed.family === type,
  );
  if (authoredSeeds?.length) {
    const { family, variant } = familyAndVariant(index, authoredSeeds.length);
    const seed = authoredSeeds[family];
    const correct = seed.options[seed.correctIndex];
    const distractors = seed.options.filter(
      (_, optionIndex) => optionIndex !== seed.correctIndex,
    );
    const answer = makeOptions(correct, distractors, index);
    const instruction =
      type === "information-retrieval"
        ? "Read the information, match all stated conditions, and choose the correct answer."
        : type === "reading-integrated"
          ? "Read both texts and choose the answer that best compares their positions."
          : type === "reading-long" || type === "reading-thematic"
            ? "Read the passage and choose the answer that best captures the writer's point."
            : "Read the passage and choose the best answer.";

    const authoredBase = baseQuestion(
      profile,
      type,
      "reading",
      index,
      seed.semanticId,
      variant,
    );
    return {
      ...authoredBase,
      provenance: {
        ...authoredBase.provenance,
        editorialStatus: seed.editorialStatus ?? "machine-validated",
      },
      instruction,
      stem: seed.question,
      passage: {
        title: type === "reading-integrated" ? "二つの文章" : undefined,
        body: readingBody(seed),
        groupId: seed.passageId
          ? `${profile.level}:${seed.passageId}:variant-${variant}`
          : undefined,
        groupQuestionIndex: seed.passageQuestionIndex,
      },
      ...answer,
      explanation: seed.explanation,
    };
  }

  const semanticFamilyCount = type === "reading-thematic" ? 10 : 1;
  const { family, variant } = familyAndVariant(index, semanticFamilyCount);
  const values = valuesFor(profile, index);
  const item = readingContent(profile, type, index, values);
  const answer = makeOptions(item.correct, item.distractors, index);
  return {
    ...baseQuestion(
      profile,
      type,
      "reading",
      index,
      `scenario-${family + 1}`,
      variant,
    ),
    instruction: item.instruction,
    stem: item.question,
    passage: {
      title: item.title,
      body: item.body,
      sourceLabel: `${values.place}／${values.day} ${values.time}配布`,
    },
    ...answer,
    explanation: item.explanation,
  };
}

interface ReadingContent {
  instruction: string;
  title?: string;
  body: string;
  question: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
}

function readingContent(
  profile: LevelQuestionProfile,
  type: ReadingType,
  index: number,
  v: TemplateValues,
): ReadingContent {
  if (type === "information-retrieval")
    return informationRetrievalContent(profile, index, v);
  if (type === "reading-integrated")
    return integratedReadingContent(profile, index, v);
  if (type === "reading-thematic")
    return thematicReadingContent(profile, index, v);
  if (type === "reading-long") return longReadingContent(profile, index, v);
  if (type === "reading-mid") return midReadingContent(profile, index, v);
  return shortReadingContent(profile, index, v);
}

function shortReadingContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  const meeting = v.time;
  const start = v.nextTime;
  if (profile.complexity === 1) {
    return {
      instruction: "Read the short message and choose the correct answer.",
      title: `${v.person}さんへのメモ`,
      body: `${v.person}さんへ\n${v.day}、いっしょに${v.place}へ行きましょう。${v.place}は${start}からです。その前に話したいので、${meeting}に駅の前で会いましょう。駅の前の小さい店で待っています。雨のときも時間は同じです。\n${v.other}`,
      question: `${v.person}さんは何時に駅へ行きますか。`,
      correct: meeting,
      distractors: [
        start,
        TIMES[(index + 4) % TIMES.length],
        TIMES[(index + 7) % TIMES.length],
      ],
      explanation: `The message sets the meeting at ${meeting}; ${start} is when the destination activity begins.`,
    };
  }
  if (profile.complexity === 2) {
    return {
      instruction: "Read the short message and choose the correct answer.",
      title: "教室変更のお知らせ",
      body: `${v.person}さんへ\n${v.day}の日本語クラスは、いつもの教室が使えないため、${v.place}の二階で行います。時間は${v.time}から${v.nextTime}までです。教科書のほかに、先週配ったプリントも持ってきてください。プリントをなくした人は、クラスが始まる前に受付でもう一枚もらえます。ノートは教室にあります。`,
      question: `${v.person}さんは、クラスへ何を持って行かなければなりませんか。`,
      correct: "教科書と先週のプリント",
      distractors: ["教科書だけ", "先週のプリントだけ", "新しいノートだけ"],
      explanation:
        "The notice explicitly requires the textbook plus the handout distributed the previous week.",
    };
  }
  if (profile.complexity === 3) {
    return {
      instruction: "Read the message and choose the correct answer.",
      title: "予定変更の連絡",
      body: `${v.person}さん\n${v.day}の${v.place}での打ち合わせですが、会議室が${meeting}まで使えないそうです。準備の時間も必要なので、開始を${start}に変えました。終了時刻も同じだけ遅くなります。資料は前日までに共有してください。オンラインで参加する人には、当日の朝に接続先を送ります。時間の変更で都合が悪ければ、${v.other}さんに連絡してください。`,
      question: `${v.person}さんは、打ち合わせについて何を確認しなければなりませんか。`,
      correct: `${start}から参加できるか`,
      distractors: [
        `${meeting}までに資料を印刷できるか`,
        `${v.other}さんが会議室を予約したか`,
        `${v.place}へ前日に行けるか`,
      ],
      explanation: `The meeting now begins at ${start}; the other details do not require the recipient's confirmation.`,
    };
  }
  return {
    instruction: "Read the notice and choose the most accurate answer.",
    title: "申請手続きの変更",
    body: `${v.person}様\n${v.day}に予定していた${v.place}利用申請の確認は、担当者の都合により${v.nextDay}の${meeting}に変更されました。確認はオンラインでも参加できますが、希望する場合は前日までに接続先を申請してください。提出書類そのものの締切は${v.day}の${start}のままです。確認日の変更によって提出が遅れても受理されません。\nなお、書類に不足があった場合は確認日に説明しますが、締切後に新しい資料を追加することはできません。担当者から修正を求められた項目に限り、確認後二日以内の再提出が認められます。この扱いは、最初の提出を期限内に行った人だけが対象です。`,
    question: `${v.person}さんが注意すべきことは何ですか。`,
    correct: `確認日は変わったが、書類は${v.day}の${start}までに出す`,
    distractors: [
      `書類も${v.nextDay}の${meeting}までに出せばよい`,
      `確認は予定どおり${v.day}に行われる`,
      `担当者に連絡すれば締切後でも受理される`,
    ],
    explanation: `Only the confirmation appointment changed. The submission deadline remains ${v.day} at ${start}.`,
  };
}

function midReadingContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  if (profile.complexity === 1) {
    return {
      instruction: "Read the passage and choose the correct answer.",
      body: `${v.person}さんは${v.day}に${v.place}へ行くつもりでした。朝、雨がたくさん降っていたので、バスで行こうと思いました。しかし、バスは${v.nextTime}まで来ません。歩くと服がぬれてしまいます。そこで、${v.other}さんに電話して、駅で会う時間を${v.time}から${v.nextTime}に変えました。${v.other}さんもその時間でいいと言いました。`,
      question: `${v.person}さんは、どうして会う時間を変えましたか。`,
      correct: "バスがすぐに来なかったから",
      distractors: [
        "雨がやんだから",
        `${v.other}さんが${v.place}へ行かなかったから`,
        "駅が休みだったから",
      ],
      explanation: `The bus would not arrive until ${v.nextTime}, so the meeting time was moved.`,
    };
  }
  if (profile.complexity === 2) {
    return {
      instruction: "Read the passage and choose the best answer.",
      body: `${v.person}さんは${v.day}に${v.place}の行事を手伝う。初めは受付で名前を確認する予定だった。しかし、資料を準備する人が病気で休むことになったため、${v.time}までは資料を机に並べ、そのあと受付へ行くよう頼まれた。資料は参加する人の年齢によって二種類あるので、机を分けて置かなければならない。受付を始める前に、並べ方を担当者に見てもらう。飲み物は${v.other}さんが用意するので、買う必要はない。行事が終わったあとの片付けは全員で行う。`,
      question: `${v.person}さんは、まず何をしますか。`,
      correct: "資料を机に並べる",
      distractors: [
        "受付で名前を確認する",
        "飲み物を買いに行く",
        `${v.other}さんに受付を頼む`,
      ],
      explanation:
        "The staffing change moves preparation of the handouts before the originally assigned reception work.",
    };
  }
  if (profile.complexity === 3) {
    return {
      instruction: "Read the passage and choose the best answer.",
      body: `${v.person}さんは${v.day}の${v.time}から${v.place}で開かれる地域の交流会で発表することになった。最初は写真をたくさん見せ、町の変化を順番に説明する予定だった。しかし、会場の機械が古く、大きな画像を続けて表示すると動かなくなる可能性があると分かった。そこで写真の数を減らし、その代わりに、使わない写真と説明をまとめた小さな資料を参加者へ配ることにした。${v.other}さんから発表を短くするよう言われたわけではなく、話す時間は変わらない。機械が止まって説明まで中断することを避けながら、予定していた内容を伝えるための変更である。`,
      question: `${v.person}さんは発表をどのように変えましたか。`,
      correct: "写真を減らし、内容を資料でも伝えることにした",
      distractors: [
        "発表そのものを中止した",
        "写真を増やして資料を配らないことにした",
        `${v.other}さんに発表してもらうことにした`,
      ],
      explanation:
        "The passage explicitly contrasts fewer projected photos with a new printed handout.",
    };
  }
  return {
    instruction: "Read the passage and choose the most accurate answer.",
    body: `${v.place}では、利用者を増やすため開館時間を延ばす案が出ていた。ところが試験的に${v.day}だけ閉館を${v.nextTime}にしたところ、夕方の利用者は増えた一方、職員の負担も予想以上に大きかった。延長時間の後半には利用が少なく、毎日同じ時間まで開ける根拠も十分ではなかった。\n\n${v.person}さんは、延長をやめるのではなく、毎日実施する計画を見直し、過去の利用記録から需要の多い曜日に限るべきだと提案した。対象日には担当職員を交代で配置し、三か月後に利用数と費用を改めて比較する。${v.other}さんも、まず対象日を絞って効果を測ることに賛成した。ただし、利用の少ない曜日に来られない人がいるかもしれないため、希望者への調査も同時に行うべきだと付け加えた。\n\n二人は、職員の負担だけを理由に延長を中止するのでも、利用者が増えたという一つの数字だけで毎日実施するのでもなく、対象を絞った試行から判断に必要な情報を集めようとしている。`,
    question: `二人が支持している方針はどれか。`,
    correct: "利用の多い曜日だけ時間を延長し、効果を確かめる",
    distractors: [
      "職員の負担にかかわらず毎日延長する",
      "試験結果を見ずに延長を全面的に中止する",
      "開館時間を今より短くして利用者を減らす",
    ],
    explanation:
      "They preserve the idea of extended hours but narrow it to high-demand days and continue evaluating it.",
  };
}

function longReadingContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  const advanced = profile.complexity >= 5;
  const body = advanced
    ? `新しい制度を評価するとき、利用者の数だけを成果とみなすと、その制度が誰に届いていないのかが見えにくくなる。${v.place}が${v.day}の閉館時刻を${v.time}から${v.nextTime}へ延ばしたところ、来館者は確かに増えた。しかし、増えたのは仕事帰りに立ち寄れる人が中心で、移動に支援が必要な人の利用はほとんど変わらなかった。数字だけを見れば成功だが、当初掲げた「地域の誰もが利用できる場」という目的から見れば、評価はそれほど単純ではない。\n\n${v.person}氏は、この結果を時間延長の失敗とは考えなかった。ある障壁を下げた結果、恩恵を受ける層が明らかになったからだ。一方で、全体の数字が伸びたことを理由に改善を終えれば、別の障壁は残る。そこで次は、${v.nextDay}に送迎支援を試し、時間延長とは異なる効果を測るよう提案した。二つの施策を同時に始めなかったのは、変化が起きても、どちらの施策によるものか判断できなくなるからである。\n\nこの提案に対し、「必要な人が少ない支援に費用をかければ、一人当たりの効果が低く見える」という反対意見も出た。だが、平均だけを基準にすると、利用しにくい人ほど統計から消えていく。少数であることは、必要性が低いことを必ずしも意味しない。むしろ、その人たちが利用できない理由を調べることで、制度が暗黙に想定していた利用者像が見えてくる。\n\nまた、支援を受けた人数だけを比べるのも十分ではない。送迎があっても予約方法が複雑なら、申し込みの段階で断念する人がいるかもしれない。利用までの各段階を分け、どこで離れる人が多いかを確かめる必要がある。そうすれば、送迎そのものの効果と、申し込み方法の問題を混同せずに済む。\n\n評価とは、一つの数字で成功か失敗かを決める作業ではない。施策がどの条件に働き、どの条件には働かなかったかを区別し、次の問いを具体的にする過程なのである。成果を示す数字は必要だが、その数字が何を数え、何を数えていないのかを問い続けなければ、改善は最も見えやすい人のためだけのものになってしまう。`
    : `${v.person}さんの町では、ごみを減らすため、使わなくなった物を交換する会を${v.day}の${v.time}から${v.place}で開いた。初めは、物を持ってきた人だけが別の物を持ち帰れる決まりだった。しかし、必要な物があっても交換できる物を持っていない人もいる。子どもや、町へ来たばかりの人からは、参加したくても出せる物がないという声が出た。\n\nそこで二回目からは、会場の準備を手伝えば参加できるようにした。すると参加者が増えただけでなく、物の整理や説明も早く終わった。参加した人どうしが品物の使い方を教え合う場面も増え、会は単に物を交換するだけではなくなった。一方、壊れた物まで集まり、使えるかどうかの確認に時間がかかるという問題も出た。\n\n運営する人の中には、また最初の決まりに戻したほうが簡単だという意見もあった。しかし、それでは交換できる物を持たない人が再び参加できなくなる。${v.person}さんは、参加方法を戻すのではなく、持ち込める物の写真と条件を前もって知らせることを提案した。迷う場合は、会の前日までに写真を送って確認してもらう。\n\n次の会では、この新しい確認方法を試し、準備を手伝えば参加できる決まりは残す予定だ。問題が起きたから会をやめるのではなく、参加しやすさを保ちながら、続けるために必要な決まりを直そうとしているのである。`;
  return {
    instruction:
      "Read the longer passage and choose the writer's central point.",
    body,
    question: "この文章で最も言いたいことは何か。",
    correct: advanced
      ? "全体の成果だけでなく、施策が届く条件と届かない条件を分けて次の改善につなげるべきだ"
      : "活動を続けながら、参加しやすさを保ち、見つかった問題に合わせて決まりを改善するとよい",
    distractors: advanced
      ? [
          "利用者数が増えた施策は、それ以上検討する必要がない",
          "異なる支援策の効果は同じ数字だけで比較すべきだ",
          "すべての人に同時に効果がない施策は直ちに中止すべきだ",
        ]
      : [
          "問題が一つでも起きた活動はすぐにやめるべきだ",
          "物を持っていない人は交換会に参加させないほうがよい",
          "参加者を減らせば、決まりを知らせる必要はなくなる",
        ],
    explanation: advanced
      ? "The writer treats evaluation as identifying where a measure works and using the remaining gaps to define the next intervention."
      : "The organizers keep the inclusive participation rule while adding a condition that addresses the newly observed problem.",
  };
}

function integratedReadingContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  const topic = [
    "地域講座",
    "公共施設",
    "研究発表",
    "オンライン相談",
    "文化事業",
  ][index % 5];
  return {
    instruction:
      "Read the two opinions and choose the most accurate comparison.",
    title: `${topic}について`,
    body: `【背景】${v.day}の${v.time}、${v.place}で${topic}の情報公開について意見が交わされた。現在は題名と開催日だけが先に発表され、詳しい内容は申し込み後に送られる。参加者からは、準備が早くできるという声がある一方、自分に合う企画か分からないまま申し込むのは難しいという声も出ている。\n\n【A：${v.person}さん】${topic}の内容をすべて最初から公開すれば、参加者には便利だろう。しかし、講師や担当者が未確定の段階で詳しい資料を作れば、変更のたびに直す必要があり、準備の負担が大きい。まず目的、要点、日程を知らせ、詳しい資料は内容が固まってから希望者に送ればよい。重要なのは、情報を一度に出すことではなく、確定した情報を誤りなく届けることだ。費用や対象者も、変更の可能性があるなら、そのことを明記した上で後から更新すればよい。\n\n【B：${v.other}さん】要点だけでは、自分に合うか判断できない人もいる。特に、参加に費用や移動が必要な場合、申し込んだあとで条件が合わないと分かれば、取り消す手間が生じる。資料を一度に完成させる必要はないが、対象者、必要な準備、費用、参加方法など、参加を決めるための情報は初めから示すべきだ。未確定の部分は「未定」と書き、いつ更新するかを知らせればよい。情報が変わる可能性と、判断に必要な情報を示さないことは同じではない。\n\nAもBも、未確定な情報を完成したものとして公開すべきだとは考えていない。また、担当者の負担を無視しているわけでもない。違いは、最初の段階で何を参加者に示すべきかという点にある。`,
    question: "AとBの意見はどのように異なるか。",
    correct:
      "Aは段階的な情報提供を重視し、Bは参加判断に必要な情報を最初から示すべきだと考えている",
    distractors: [
      "Aは情報公開に全面的に反対し、Bはすべての資料を直ちに出すよう求めている",
      "AもBも日程だけを知らせれば十分だと考えている",
      "Aは費用を上げるべきだとし、Bは事業を中止すべきだとしている",
    ],
    explanation:
      "Both accept selective preparation, but B draws the minimum disclosure line at information needed for an informed participation decision.",
  };
}

function thematicReadingContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  const topics = [
    "記録",
    "道具",
    "対話",
    "学び",
    "地域活動",
    "評価",
    "説明",
    "選択",
    "余白",
    "習慣",
  ] as const;
  const topic = topics[index % topics.length];
  return {
    instruction: "Read the passage and choose the writer's main claim.",
    title: `${topic}について考える`,
    body: `${topic}を効率だけで考えると、短い時間で目に見える結果を出すことが重視される。もちろん、不要な手間を減らすことには意味がある。単純な転記や、同じ情報を何度も入力する作業を自動化すれば、人は別の判断に時間を使える。しかし、途中の過程をすべて省けば、なぜその結果になったのかを確かめる機会まで失われる。\n\n${v.day}の${v.time}、${v.person}さんが${v.place}で行った試みでは、二つの班が同じ資料を整理した。一方の班は機械が示した順番をそのまま使い、もう一方は、順番を変えた理由を短く記録した。作業時間だけを比べると前者が早かったが、翌週に評価の条件が変わると、理由を残した班のほうが方法を直しやすかった。どの判断が新しい条件と関係するかをたどれたからである。\n\nここから、時間をかければ必ず質が上がると結論することはできない。理由を書く作業が形式だけになり、誰も読み返さないなら、それも無駄な手間になり得る。反対に、機械に任せた作業であっても、入力した条件と変更の履歴が分かれば、後から検証できる。大切なのは、人が作業したか機械が作業したかではなく、判断の過程を必要なときに確かめられるかどうかだ。\n\nまた、記録には責任を明らかにする以外の役割もある。後から間違いを探すためだけに記録すると思えば、人は失敗を隠したくなる。しかし、判断した時点で何が分かっていたかを共有するものだと考えれば、結果が予想と違っても、次の改善に使える。記録は過去の人を責める道具ではなく、未来の人が同じ条件から考え直すための手がかりになる。\n\n速さそのものが問題なのではない。何を省き、何を残したかが重要なのである。改善とは、過程を一律に短くすることでも、すべてを記録して作業を重くすることでもない。後の判断に必要な過程を見極め、それ以外を軽くすることだ。その区別をせずに効率だけを求めれば、目の前の時間は短くなっても、状況が変わるたびに最初から考え直すことになる。この見極めこそが重要だ。`,
    question: "筆者の考えに最も近いものはどれか。",
    correct: "後の判断に役立つ過程は残し、不要な手間を減らすべきだ",
    distractors: [
      "結果が同じなら判断の理由を記録する必要はない",
      "作業時間を長くすれば必ず質が高くなる",
      "効率を上げる試みはすべて避けるべきだ",
    ],
    explanation:
      "The conclusion distinguishes productive process from needless effort instead of treating all speed or all friction as good.",
  };
}

function informationRetrievalContent(
  profile: LevelQuestionProfile,
  index: number,
  v: TemplateValues,
): ReadingContent {
  const openDay = DAYS[index % 5];
  const closedDay = DAYS[(index + 2) % 5];
  const limit = 10 + (index % 8) * 5;
  const simple = profile.complexity === 1;
  const simpleClosingTime =
    v.nextTime === "十二時" ? "正午" : `午後${v.nextTime}`;
  const body =
    profile.complexity === 1
      ? `【${v.place}のおしらせ】\n開いている日：${openDay}・土曜日・日曜日\n時間：午前九時〜${simpleClosingTime}\n休み：${closedDay}\n一人${limit}分まで使えます。使いたい人は前の日までに予約してください。\n\n本を読むへやは予約しなくても使えます。パソコンのへやでは食べたり飲んだりしないでください。子どもは大人といっしょに来てください。休みの日に本を返す人は、入口の右にある青い箱に入れてください。電話は午前十時から午後五時までです。予約をやめるときは、使う時間の一時間前までに電話してください。`
      : profile.complexity === 2
        ? `【${v.place}利用案内】\n通常利用：${openDay}・土曜日　午前八時〜${simpleClosingTime}／予約不要\n相談利用：${closedDay}　${v.time}〜${v.nextTime}／前日までに予約／一組${limit}分\n休館：日曜日\n\n相談利用では、職員が資料の探し方や申込書の書き方を説明します。相談したい内容を予約のときに伝えてください。必要な資料が分かる人は持ってきてください。予約を取り消す場合は、当日の開始一時間前までに連絡してください。連絡がないまま遅れた場合、予約時間を短くすることがあります。通常利用だけの人は相談利用の時間にも入れますが、職員への質問はできません。飲食は一階の休憩場所を使ってください。コピー機は一人十枚まで無料です。それより多くコピーしたい人は、受付でカードを買ってください。小学生だけで相談利用をすることはできません。`
        : profile.complexity === 3
          ? `【${v.place}相談室・利用案内】\n一般利用：${openDay}・土曜日　8:00〜${v.nextTime}／予約不要\n個別相談：${closedDay}　${v.time}〜${v.nextTime}／前日までに予約／一組${limit}分\n資料閲覧：月〜土曜日　9:00〜17:00／一人三点まで\n休館：日曜日・祝日\n\n個別相談では、申請書の書き方、必要な資料の確認、利用できる制度の案内を行います。予約するときに相談内容を選び、すでに作成した書類があれば送ってください。ただし、職員が申請の結果を保証したり、本人の代わりに書類を書いたりすることはできません。\n\n予約の変更は前日の午後五時まで、取り消しは当日の開始一時間前まで受け付けます。連絡なく十分以上遅れた場合は、ほかの利用者を先に案内します。通常利用は予約不要ですが、個別相談の利用者が多い時間には席が少なくなることがあります。資料を外へ持ち出すことはできません。コピーは一人一日二十枚までです。\n\n団体で利用する場合は、人数にかかわらず一週間前までに申請してください。責任者の名前と利用目的も必要です。初めて利用する団体は、申請前に職員の説明を受けてください。相談室のパソコンへ自分のソフトを入れることはできません。`
          : `【${v.place}専門相談・資料利用ガイド】\nA 一般閲覧：${openDay}・土曜日　8:00〜${v.nextTime}／予約不要／資料は一人五点まで\nB 個別相談：${closedDay}　${v.time}〜${v.nextTime}／前日までに予約／一組${limit}分\nC 団体調査：火・木曜日　10:00〜16:00／利用日の七日前までに計画書を提出\nD オンライン相談：月〜金曜日　13:00〜18:00／二日前までに資料を送付\n休館：日曜日・祝日・毎月最終水曜日\n\n個別相談では、申請条件の確認と資料の探し方を案内します。職員は申請書の内容を確認できますが、採択の可能性を判断したり、文章を代わりに作成したりすることはできません。相談したい制度が決まっている場合は名称を、決まっていない場合は目的と現在の状況を予約時に記入してください。\n\n予約の変更は前日の午後五時まで、取り消しは当日の開始一時間前まで受け付けます。連絡なく十分以上遅れた場合、相談時間は延長されません。オンライン相談へ切り替える場合も、変更の連絡が必要です。送付された資料は相談終了後三十日で削除します。\n\n一般閲覧の資料は館外へ持ち出せません。複写は著作権上認められる範囲に限り、一人一日三十枚までです。団体調査では、責任者一人を決め、参加者名簿と調査目的を提出してください。同じ団体が同じ月に利用できるのは二回までです。\n\n初めて利用する人を対象に、${v.nextDay}の${v.time}から利用説明会を行います。説明会への参加は任意で、個別相談の予約条件には含まれません。詳しい日程は受付でも確認できます。`;
  return {
    instruction:
      "Use the notice to find the information needed for the situation.",
    title: simple ? `${v.place}のおしらせ` : `${v.place}利用案内`,
    body,
    question: simple
      ? `${v.person}さんは${openDay}の午前十時に${limit}分使いたいです。どうしますか。`
      : `${v.person}さんは${closedDay}に${limit}分の相談利用をしたい。必要なことは何か。`,
    correct: simple ? "前の日までに予約する" : "前日までに予約する",
    distractors: simple
      ? [
          `予約しないで${closedDay}に行く`,
          "日曜日の午後に行く",
          `${limit + 30}分使う`,
        ]
      : [
          "予約せず通常利用の時間に行く",
          "日曜日に直接申し込む",
          "利用後に予約の連絡をする",
        ],
    explanation: `The requested use is permitted, but the notice explicitly requires a reservation by the previous day.`,
  };
}

type ListeningType =
  | "listening-task"
  | "listening-key-points"
  | "listening-outline"
  | "listening-verbal"
  | "listening-quick-response"
  | "listening-integrated";

function listeningQuestion(
  profile: LevelQuestionProfile,
  type: ListeningType,
  index: number,
): JlptQuestion {
  const authoredSeeds = [
    ...(profile.upperListening ?? []),
    ...(profile.lowerListening ?? []),
  ].filter((seed) => seed.family === type);
  const semanticFamilyCount =
    authoredSeeds.length ||
    (type === "listening-verbal"
      ? 10
      : type === "listening-quick-response"
        ? 3
        : 1);
  const { family, variant } = familyAndVariant(index, semanticFamilyCount);
  const v = valuesFor(profile, index);
  const authoredSeed = authoredSeeds[family];
  const content = authoredSeed
    ? authoredListeningContent(authoredSeed)
    : listeningContent(profile, type, index, v);
  const count =
    type === "listening-verbal" || type === "listening-quick-response" ? 3 : 4;
  const answer = makeOptions(
    content.correct,
    content.distractors,
    index,
    count,
  );
  const audioOnlyOptions =
    type === "listening-verbal" ||
    type === "listening-quick-response" ||
    type === "listening-outline" ||
    type === "listening-integrated";
  const speaksQuestionAfterStimulus =
    audioOnlyOptions && type !== "listening-quick-response";
  const numberedOptions = audioOnlyOptions
    ? answer.options
        .map(
          (option, optionIndex) =>
            `${["一", "二", "三", "四"][optionIndex]}、${option.label}`,
        )
        .join("\n")
    : "";
  const sceneLead =
    profile.complexity <= 2
      ? `${v.day}の${v.time}、${v.place}での話です。`
      : `${v.day}の${v.time}、${v.place}で収録された場面です。`;
  const scriptLead =
    type === "listening-verbal" || authoredSeed ? "" : `${sceneLead}\n`;
  return {
    ...baseQuestion(
      profile,
      type,
      "listening",
      index,
      authoredSeed?.semanticId ?? `scenario-${family + 1}`,
      variant,
    ),
    instruction: content.instruction,
    stem: content.question,
    listening: {
      script: `${scriptLead}${content.script}${speaksQuestionAfterStimulus ? `\n${content.question}` : ""}${numberedOptions ? `\n${numberedOptions}` : ""}`,
      audioOnlyOptions,
      verbalScene: content.verbalScene,
      maxPlays: 2,
      rate: profile.listeningRate,
    },
    ...answer,
    explanation: content.explanation,
  };
}

interface ListeningContent {
  instruction: string;
  script: string;
  question: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
  verbalScene?: JlptVerbalScene;
}

function authoredListeningContent(
  seed: UpperListeningSeed | LowerListeningSeed,
): ListeningContent {
  const correct = seed.options[seed.correctIndex];
  const distractors = seed.options.filter(
    (_, index) => index !== seed.correctIndex,
  );
  return {
    instruction:
      seed.family === "listening-task"
        ? "Read the question, listen, and choose what the speaker will do."
        : seed.family === "listening-key-points"
          ? "Read the question, listen, and choose the correct answer."
          : seed.family === "listening-quick-response"
            ? "Listen and choose the most appropriate response."
            : seed.family === "listening-integrated"
              ? "Listen to the integrated material and choose the best answer."
              : "Listen to the passage and choose the best answer.",
    script: seed.script,
    question: seed.question,
    correct,
    distractors: [distractors[0], distractors[1], distractors[2] ?? ""],
    explanation: seed.explanation,
  };
}

interface VerbalExpressionSeed {
  situation: string;
  correct: string;
  distractors: readonly [string, string];
  explanation: string;
  scene: JlptVerbalScene;
}

const N5_VERBAL_EXPRESSION_SEEDS: readonly VerbalExpressionSeed[] = [
  {
    situation:
      "{person}さんは服の店で、シャツを近くで見たいです。店の人に何と言いますか。",
    correct: "あのシャツを見せてください",
    distractors: ["あのシャツを見てください", "あのシャツを見ました"],
    explanation:
      "見せてください is the direct request for a shop employee to show the customer the shirt.",
    scene: {
      setting: "shop",
      speaker: { side: "left", pose: "pointing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "shirt", position: "center" },
      description:
        "{person} points to a shirt on display while a shop employee stands nearby.",
    },
  },
  {
    situation:
      "{person}さんは教室で、えんぴつがありません。友達に何と言いますか。",
    correct: "えんぴつを貸してください",
    distractors: ["えんぴつを借りてください", "えんぴつを貸しました"],
    explanation:
      "貸してください asks the friend to lend a pencil to the speaker; 借りてください reverses who borrows it.",
    scene: {
      setting: "classroom",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "holding" },
      prop: { kind: "pencil", position: "center" },
      description:
        "In a classroom, {person} has no pencil and asks a friend who is holding one.",
    },
  },
  {
    situation:
      "{person}さんは駅のきっぷの機械が分かりません。駅の人に何と言いますか。",
    correct: "使い方を教えてください",
    distractors: ["使い方を教えます", "使い方が分かりました"],
    explanation:
      "教えてください naturally asks the station employee to explain how to use the machine.",
    scene: {
      setting: "service-counter",
      speaker: { side: "left", pose: "requesting" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "machine", position: "center" },
      description:
        "At a station, {person} looks uncertain beside a ticket machine and asks an employee for help.",
    },
  },
  {
    situation:
      "{person}さんはレストランで、水がほしいです。店の人に何と言いますか。",
    correct: "お水をください",
    distractors: ["お水を飲んでください", "お水を持っていきます"],
    explanation:
      "お水をください is the simple, natural request for water in a restaurant.",
    scene: {
      setting: "cafe",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "glass", position: "center" },
      description:
        "At a restaurant, {person} gestures toward an empty glass while speaking to a server.",
    },
  },
  {
    situation:
      "{person}さんは観光地で、自分の写真を撮ってほしいです。近くの人に何と言いますか。",
    correct: "写真を撮ってください",
    distractors: ["写真を見てください", "写真を撮りましょうか"],
    explanation:
      "撮ってください asks the nearby person to take the speaker's photo; 撮りましょうか offers to take someone else's.",
    scene: {
      setting: "landmark",
      speaker: { side: "left", pose: "requesting" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "camera", position: "center" },
      description:
        "At a sightseeing spot, {person} holds out a camera to a nearby person.",
    },
  },
  {
    situation:
      "{person}さんは道で駅の場所が分かりません。近くの人に何と言いますか。",
    correct: "駅はどこですか",
    distractors: ["駅へ行ってください", "駅へ行きましょうか"],
    explanation: "駅はどこですか directly asks where the station is.",
    scene: {
      setting: "street",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "pointing" },
      prop: { kind: "sign", position: "center" },
      description:
        "On a street, {person} looks at a direction sign and asks a passerby where the station is.",
    },
  },
  {
    situation:
      "{person}さんは友達の家にいます。暑いので、自分で窓を開けたいです。何と言いますか。",
    correct: "窓を開けてもいいですか",
    distractors: ["窓を閉めてもいいですか", "窓を閉めてください"],
    explanation:
      "The closed window and heat cues call for opening it; 開けてもいいですか asks permission for the speaker to do that.",
    scene: {
      setting: "home",
      speaker: { side: "left", pose: "pointing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "window", position: "center" },
      description:
        "In a friend's home, {person} points to a closed window because the room is hot.",
    },
  },
  {
    situation:
      "{person}さんはレストランで、メニューを見たいです。店の人に何と言いますか。",
    correct: "メニューを見せてください",
    distractors: ["メニューを見てください", "メニューを見ました"],
    explanation:
      "見せてください asks the server to show or bring the menu to the speaker.",
    scene: {
      setting: "cafe",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "holding" },
      prop: { kind: "menu", position: "center" },
      description:
        "At a restaurant, {person} asks a server who is holding a menu.",
    },
  },
  {
    situation:
      "雨が降っています。{person}さんは友達のかさを使いたいです。何と言いますか。",
    correct: "このかさを使ってもいいですか",
    distractors: ["このかさを使ってください", "このかさを使いました"],
    explanation:
      "使ってもいいですか asks permission for the speaker to use the friend's umbrella.",
    scene: {
      setting: "home",
      speaker: { side: "left", pose: "requesting" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "umbrella", position: "center" },
      description:
        "It is raining, and {person} points to a friend's umbrella near the door.",
    },
  },
  {
    situation: "{person}さんは重い箱を一人で持てません。友達に何と言いますか。",
    correct: "この箱を持ってください",
    distractors: ["この箱を持ちましょうか", "この箱を持ちました"],
    explanation:
      "持ってください asks the friend to carry the box; 持ちましょうか would offer to carry it for the listener.",
    scene: {
      setting: "home",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "box", position: "center" },
      description:
        "{person} cannot lift a heavy box alone and asks a friend for help.",
    },
  },
];

const N4_VERBAL_EXPRESSION_SEEDS: readonly VerbalExpressionSeed[] = [
  {
    situation:
      "電車の中です。{person}さんは立っているお年寄りに自分の席を使ってもらいます。何と言いますか。",
    correct: "どうぞ、この席に座ってください",
    distractors: [
      "この席に座ってもいいですか",
      "すみません、この席は空いていますか",
    ],
    explanation:
      "どうぞ、この席に座ってください naturally offers the speaker's seat to the standing passenger.",
    scene: {
      setting: "train",
      speaker: { side: "left", pose: "offering" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "seat", position: "center" },
      description:
        "On a train, {person} gestures toward an empty seat for an older standing passenger.",
    },
  },
  {
    situation:
      "{person}さんは受付の機械から領収書を出したいですが、方法が分かりません。係の人に何と言いますか。",
    correct: "領収書の出し方を教えてもらえませんか",
    distractors: ["領収書を出してあげましょうか", "領収書を出してもいいですか"],
    explanation:
      "出し方を教えてもらえませんか asks the employee to explain how the speaker can print the receipt.",
    scene: {
      setting: "service-counter",
      speaker: { side: "right", pose: "confused" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "machine", position: "center" },
      description:
        "At a reception area, {person} looks puzzled at the receipt screen on a check-in machine while an employee stands nearby.",
    },
  },
  {
    situation:
      "観光地で、一人で写真を撮ろうとしている人がいます。{person}さんは写真を撮ってあげたいです。何と言いますか。",
    correct: "よかったら、写真を撮りましょうか",
    distractors: [
      "写真を撮ってもらえませんか",
      "この写真を見せてもらえませんか",
    ],
    explanation:
      "写真を撮りましょうか offers to take the other person's photo; the other choices ask that person to do something for the speaker.",
    scene: {
      setting: "landmark",
      speaker: { side: "left", pose: "offering" },
      partner: { side: "right", pose: "holding" },
      prop: { kind: "camera", position: "right" },
      description:
        "At a sightseeing spot, another visitor is trying to take a photo alone and {person} offers to take it for them.",
    },
  },
  {
    situation:
      "事務所で、同僚が資料を持っています。{person}さんはその資料を見たいです。何と言いますか。",
    correct: "その資料を見せてもらえますか",
    distractors: ["その資料を見せましょうか", "その資料をしまってもいいですか"],
    explanation:
      "見せてもらえますか asks the coworker who is holding the document to show it to the speaker.",
    scene: {
      setting: "office",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "holding" },
      description:
        "In an office, a coworker is holding a document and {person} asks to see it.",
    },
  },
  {
    situation:
      "{person}さんは約束の時間に遅れて来ました。待っていた友達に何と言いますか。",
    correct: "遅れてしまって、すみません",
    distractors: ["待ってくれてもいいですか", "遅くまで待ちましょうか"],
    explanation:
      "遅れてしまって、すみません apologizes directly for arriving late.",
    scene: {
      setting: "street",
      speaker: { side: "left", pose: "bowing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "sign", position: "center" },
      description:
        "At a meeting place, {person} bows after arriving late while a friend has been waiting by the sign.",
    },
  },
  {
    situation:
      "図書館で、近くの人の話す声が大きいです。{person}さんは何と言いますか。",
    correct: "もう少し静かにしてもらえますか",
    distractors: [
      "もう少しゆっくり話してもらえますか",
      "もう少し近くで話してもらえますか",
    ],
    explanation:
      "静かにしてもらえますか appropriately asks the other person to lower their voice in a library.",
    scene: {
      setting: "library",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "speaking" },
      prop: { kind: "document", position: "center" },
      description:
        "In a library reading room, {person} gestures to a nearby person whose voice is visibly disturbing the quiet.",
    },
  },
  {
    situation:
      "{person}さんは予約した時間に行けなくなりました。受付の人に何と言いますか。",
    correct: "予約の時間を変えてもらえますか",
    distractors: ["予約の時間を変えましょうか", "予約の時間に来てもらえますか"],
    explanation:
      "変えてもらえますか asks the receptionist to change the appointment time.",
    scene: {
      setting: "service-counter",
      speaker: { side: "left", pose: "pointing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "calendar", position: "center" },
      description:
        "At a reception counter, {person} points to a calendar marked with an arrow from one appointment time to another.",
    },
  },
  {
    situation:
      "{person}さんは友達が重そうな箱を持っているのを見ました。何と言いますか。",
    correct: "その箱、持ちましょうか",
    distractors: ["その箱を持ってください", "その箱を持ってもいいですか"],
    explanation:
      "持ちましょうか offers to carry the box for the friend; the other choices make a request or ask permission.",
    scene: {
      setting: "office",
      speaker: { side: "right", pose: "offering" },
      partner: { side: "left", pose: "holding" },
      prop: { kind: "box", position: "center" },
      description:
        "{person} offers to help a friend who is carrying a heavy box.",
    },
  },
  {
    situation:
      "{person}さんは前に友達から借りたかさを返します。何と言いますか。",
    correct: "この間は、かさを貸してくれてありがとう",
    distractors: [
      "この間は、かさを借りてくれてありがとう",
      "このかさ、借りてもいいですか",
    ],
    explanation:
      "貸してくれてありがとう thanks the friend for lending the umbrella that the speaker is now returning.",
    scene: {
      setting: "home",
      speaker: { side: "left", pose: "offering" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "umbrella", position: "center" },
      description:
        "At a friend's doorway, {person} returns the umbrella previously borrowed and thanks its owner.",
    },
  },
  {
    situation:
      "レストランで、{person}さんのテーブルに注文していない料理が来ました。店の人に何と言いますか。",
    correct: "すみません。頼んだ料理とちがいます",
    distractors: [
      "すみません。頼んだ料理がまだ来ていません",
      "すみません。もう一つ同じ料理をお願いします",
    ],
    explanation:
      "頼んだ料理とちがいます clearly and politely tells the server that the delivered dish is not the order.",
    scene: {
      setting: "cafe",
      speaker: { side: "right", pose: "confused" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "plate", position: "center" },
      description:
        "At a restaurant, {person} looks puzzled at a full dish just delivered by the server because it is not the order.",
    },
  },
];

const N3_VERBAL_EXPRESSION_SEEDS: readonly VerbalExpressionSeed[] = [
  {
    situation:
      "観光地で、{person}さんが写真を撮ろうとしていますが、前に人が立っています。何と言いますか。",
    correct: "すみません、少し横に移っていただけますか",
    distractors: [
      "すみません、こちらの写真を撮っていただけますか",
      "よろしければ、私が横に移りましょうか",
    ],
    explanation:
      "横に移っていただけますか politely asks the person blocking the camera's view to move aside.",
    scene: {
      setting: "landmark",
      speaker: { side: "left", pose: "pointing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "camera", position: "left" },
      description:
        "At a sightseeing spot, another visitor is blocking the landmark in front of {person}'s camera, so {person} asks them to move aside.",
    },
  },
  {
    situation:
      "会社で、{person}さんは先輩に作った資料を確認してほしいです。何と言いますか。",
    correct: "こちらの資料を確認していただけますか",
    distractors: [
      "こちらの資料を確認してもよろしいですか",
      "こちらの資料を確認して差し上げますか",
    ],
    explanation:
      "確認していただけますか politely asks the senior colleague to review the speaker's document.",
    scene: {
      setting: "office",
      speaker: { side: "right", pose: "offering" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "document", position: "center" },
      description:
        "In an office, {person} hands a document to a senior coworker for review.",
    },
  },
  {
    situation:
      "電車の中です。空いている席に荷物が置いてあります。{person}さんはそこに座りたいです。何と言いますか。",
    correct: "すみません、こちらに座ってもよろしいでしょうか",
    distractors: [
      "こちらに荷物を置いてもよろしいでしょうか",
      "こちらの席を使っていただけませんか",
    ],
    explanation:
      "こちらに座ってもよろしいでしょうか politely asks to use the seat occupied by the other passenger's bag.",
    scene: {
      setting: "train",
      speaker: { side: "left", pose: "requesting" },
      partner: { side: "right", pose: "sitting" },
      prop: { kind: "bag", position: "center" },
      description:
        "On a train, another passenger's bag occupies an otherwise empty seat and {person} asks to sit there.",
    },
  },
  {
    situation:
      "駅で、{person}さんは急いでいて人にぶつかってしまいました。何と言いますか。",
    correct: "ぶつかってしまって、申し訳ありません",
    distractors: [
      "先に通ってもよろしいでしょうか",
      "駅まで案内していただけませんか",
    ],
    explanation:
      "申し訳ありません gives an appropriately formal apology for accidentally bumping into someone.",
    scene: {
      setting: "street",
      speaker: { side: "right", pose: "bowing" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "sign", position: "center" },
      description:
        "Near a station, {person} bows immediately after accidentally bumping into a passerby.",
    },
  },
  {
    situation:
      "受付の機械に見慣れない表示が出ています。{person}さんは意味が分かりません。係の人に何と言いますか。",
    correct: "この表示の意味を教えていただけますか",
    distractors: [
      "この表示を消していただけますか",
      "こちらに表示してもよろしいでしょうか",
    ],
    explanation:
      "表示の意味を教えていただけますか precisely asks the employee to explain the unfamiliar message on the screen.",
    scene: {
      setting: "service-counter",
      speaker: { side: "left", pose: "confused" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "machine", position: "center" },
      description:
        "At a reception area, a machine shows an unfamiliar message and {person} looks puzzled while asking an employee about it.",
    },
  },
  {
    situation:
      "会社で、同僚が重い箱を運んでいます。{person}さんは手伝いたいです。何と言いますか。",
    correct: "よかったら、お手伝いしましょうか",
    distractors: [
      "よかったら、手伝っていただけますか",
      "手伝ってもらってもよろしいですか",
    ],
    explanation:
      "お手伝いしましょうか offers the speaker's help; the distractors ask the coworker to help instead.",
    scene: {
      setting: "office",
      speaker: { side: "right", pose: "offering" },
      partner: { side: "left", pose: "holding" },
      prop: { kind: "box", position: "center" },
      description:
        "In an office, {person} offers to help a coworker who is carrying a heavy box.",
    },
  },
  {
    situation:
      "レストランで、{person}さんは料理に食べられない物が入っていることに気づきました。店の人に何と言いますか。",
    correct: "別の料理に替えていただけますか",
    distractors: [
      "別の料理に替えて差し上げますか",
      "この料理を替えてもよろしいですか",
    ],
    explanation:
      "替えていただけますか politely asks the server to replace the dish with another one.",
    scene: {
      setting: "cafe",
      speaker: { side: "left", pose: "confused" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "plate", position: "center" },
      description:
        "At a restaurant, {person} looks concerned after noticing an inedible ingredient in the dish and speaks to a server.",
    },
  },
  {
    situation:
      "会社で、{person}さんは先輩に相談したいことがあります。忙しそうなので、まず何と言いますか。",
    correct: "今、少しお時間よろしいでしょうか",
    distractors: [
      "今、少しお待ちいただけますか",
      "今、先に帰ってもよろしいでしょうか",
    ],
    explanation:
      "少しお時間よろしいでしょうか politely checks whether the senior colleague is available before beginning the consultation.",
    scene: {
      setting: "office",
      speaker: { side: "right", pose: "requesting" },
      partner: { side: "left", pose: "holding" },
      prop: { kind: "document", position: "center" },
      description:
        "In an office, {person} approaches a busy senior colleague to ask for a moment to talk.",
    },
  },
  {
    situation:
      "{person}さんの携帯電話の電池がなくなりそうです。同僚の充電器を借りたいです。何と言いますか。",
    correct: "充電器をお借りしてもよろしいですか",
    distractors: [
      "充電器をお貸ししてもよろしいですか",
      "充電器を借りていただけませんか",
    ],
    explanation:
      "お借りしてもよろしいですか politely asks permission for the speaker to borrow the coworker's charger.",
    scene: {
      setting: "office",
      speaker: { side: "left", pose: "requesting" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "charger", position: "center" },
      description:
        "At work, {person} shows a nearly empty phone and asks a coworker to borrow a charger.",
    },
  },
  {
    situation:
      "駅で、{person}さんはだれかのかさを拾いました。駅員に渡すとき、何と言いますか。",
    correct: "このかさ、あそこで拾ったんですが",
    distractors: [
      "このかさ、どこかでなくしたんですが",
      "このかさを貸していただいたんですが",
    ],
    explanation:
      "あそこで拾ったんですが naturally introduces a found umbrella when handing it to station staff.",
    scene: {
      setting: "service-counter",
      speaker: { side: "right", pose: "offering" },
      partner: { side: "left", pose: "neutral" },
      prop: { kind: "umbrella", position: "center" },
      description:
        "At a station counter, {person} hands an umbrella found nearby to an employee.",
    },
  },
];

const VERBAL_EXPRESSION_AUDIO_CONTEXTS = {
  N5: [
    "服の店で、女の人が店員に話します。",
    "教室で、男の人が友達に話します。",
    "駅で、女の人が駅員に話します。",
    "レストランで、男の人が店員に話します。",
    "観光地で、女の人が近くの人に話します。",
    "道で、男の人が近くの人に話します。",
    "友達の家で、女の人が友達に話します。",
    "レストランで、男の人が店員に話します。",
    "友達の家で、女の人が友達に話します。",
    "家で、男の人が友達に話します。",
  ],
  N4: [
    "電車で、男の人がお年寄りに話します。",
    "受付で、女の人が係の人に話します。",
    "観光地で、男の人が旅行者に話します。",
    "事務所で、女の人が同僚に話します。",
    "待ち合わせ場所で、男の人が友達に話します。",
    "図書館で、女の人が近くの人に話します。",
    "受付で、男の人が係の人に話します。",
    "会社で、女の人が同僚に話します。",
    "友達の家で、男の人が友達に話します。",
    "レストランで、女の人が店員に話します。",
  ],
  N3: [
    "観光地で、男の人が前にいる人に話します。",
    "会社で、女の人が先輩に話します。",
    "電車で、男の人が隣の人に話します。",
    "駅で、女の人が通行人に話します。",
    "受付で、男の人が係の人に話します。",
    "会社で、女の人が同僚に話します。",
    "レストランで、男の人が店員に話します。",
    "会社で、女の人が先輩に話します。",
    "会社で、男の人が同僚に話します。",
    "駅の窓口で、女の人が駅員に話します。",
  ],
} as const;

function verbalExpressionContent(
  profile: LevelQuestionProfile,
  index: number,
): ListeningContent {
  const seeds =
    profile.complexity === 1
      ? N5_VERBAL_EXPRESSION_SEEDS
      : profile.complexity === 2
        ? N4_VERBAL_EXPRESSION_SEEDS
        : N3_VERBAL_EXPRESSION_SEEDS;
  const { family, variant } = familyAndVariant(index, seeds.length);
  const values = valuesFor(profile, variant);
  const seed = seeds[family];
  const level =
    profile.complexity === 1 ? "N5" : profile.complexity === 2 ? "N4" : "N3";
  return {
    instruction:
      "Look at the illustration, listen to the situation and three expressions, and choose the best one.",
    script: `絵を見てください。\n${VERBAL_EXPRESSION_AUDIO_CONTEXTS[level][family]}`,
    question: "何と言いますか。",
    correct: fill(seed.correct, values),
    distractors: [
      fill(seed.distractors[0], values),
      fill(seed.distractors[1], values),
      "",
    ],
    explanation: seed.explanation,
    verbalScene: {
      ...seed.scene,
      description: fill(seed.scene.description, values),
    },
  };
}

function listeningContent(
  profile: LevelQuestionProfile,
  type: ListeningType,
  index: number,
  v: TemplateValues,
): ListeningContent {
  if (type === "listening-task") {
    if (profile.complexity <= 2) {
      return {
        instruction: "Listen and choose what the speaker will do first.",
        script:
          profile.complexity === 1
            ? `女の人：あした、${v.place}へ行きますね。\n男の人：はい。まず、ノートをかばんに入れてください。そのあとで、えんぴつを二本入れてください。水はわたしが持って行きます。\n女の人：分かりました。`
            : `女の人：${v.place}へ行く前に、何をすればいいですか。\n男の人：まず、受付に出す紙に名前を書いてください。それから、その紙と会員カードをかばんに入れてください。\n女の人：はい、そうします。`,
        question: "女の人は、まず何をしますか。",
        correct:
          profile.complexity === 1
            ? "ノートをかばんに入れる"
            : "受付の紙に名前を書く",
        distractors:
          profile.complexity === 1
            ? ["えんぴつを二本入れる", "水を買う", `${v.place}へ電話する`]
            : [
                "会員カードをかばんに入れる",
                "受付へ電話する",
                `${v.place}へ行く`,
              ],
        explanation:
          "The speaker explicitly marks the correct action with まず, before the later steps.",
      };
    }
    return {
      instruction: "Listen and choose what the speaker will do first.",
      script: `女の人：${v.place}へ行く前に資料を印刷しておきますね。\n男の人：その前に、${v.person}さんから届いた数字が正しいか確認してください。間違いがなければ印刷して、${v.other}さんに一部渡してください。\n女の人：分かりました。`,
      question: "女の人は、まず何をしますか。",
      correct: `${v.person}さんの数字を確認する`,
      distractors: [
        "資料を印刷する",
        `${v.other}さんに資料を渡す`,
        `${v.place}へ行く`,
      ],
      explanation:
        "The man places checking the figures before printing or distributing the material.",
    };
  }
  if (type === "listening-key-points") {
    if (profile.complexity >= 3) {
      return {
        instruction:
          "Read the question, listen, and choose the correct answer.",
        script: `男の人：${v.person}さん、新しい担当になってどうですか。\n女の人：始める前は、仕事の量が増えることばかり心配していました。でも、実際には部署の違う人と話す機会が増えて、前より仕事全体が見えるようになったんです。まだ慣れない作業もありますが、引き受けてよかったと思っています。`,
        question: "女の人は、新しい担当について今どう思っていますか。",
        correct: "慣れない作業はあるが、引き受けてよかった",
        distractors: [
          "仕事が増えただけなので、すぐやめたい",
          "始める前から仕事全体がよく見えていた",
          "ほかの部署と話す機会が減って残念だ",
        ],
        explanation:
          "She acknowledges unfamiliar tasks but explicitly says 引き受けてよかったと思っています.",
      };
    }
    return {
      instruction: "Read the question, listen, and choose the correct answer.",
      script: `男の人：${v.day}の${v.place}の予約、${v.time}からでしたね。\n女の人：予定表はそうですが、先ほど連絡があって、${v.nextTime}からに変わりました。場所は同じです。\n男の人：では、${v.other}さんにも新しい時間を伝えます。`,
      question: `予約はいつ、どこで行われますか。`,
      correct: `${v.day}の${v.nextTime}に${v.place}`,
      distractors: [
        `${v.day}の${v.time}に${v.place}`,
        `${v.nextDay}の${v.nextTime}に${v.place}`,
        `${v.day}の${v.nextTime}に別の会場`,
      ],
      explanation: `The time changes from ${v.time} to ${v.nextTime}; neither the day nor the place changes.`,
    };
  }
  if (type === "listening-verbal") {
    return verbalExpressionContent(profile, index);
  }
  if (type === "listening-quick-response") {
    const prompts =
      profile.complexity <= 2
        ? [
            `${v.day}、いっしょに${v.place}へ行きませんか。`,
            "このかさはだれのですか。",
            "窓を開けてもいいですか。",
          ]
        : [
            `${v.day}の打ち合わせ、${v.nextTime}からに変更できませんか。`,
            "この資料、今日中に確認してもらえますか。",
            "先日の提案、もう一度検討していただけませんか。",
          ];
    const promptIndex = index % prompts.length;
    const answers =
      profile.complexity <= 2
        ? [
            ["はい、いいですね", "いいえ、行きました", "ええ、{place}でした"],
            [`${v.person}さんのです`, "三本あります", "駅で買いましたか"],
            ["はい、どうぞ", "いいえ、開きました", "窓の近くです"],
          ]
        : [
            [
              "予定を確認して、すぐお返事します",
              "変更したことがありません",
              `${v.nextTime}に終わりました`,
            ],
            [
              "分かりました。確認後に連絡します",
              "今日の資料ではありませんか",
              "確認してもらいましたか",
            ],
            [
              "承知しました。条件を整理してみます",
              "提案は一度しかありません",
              "検討していただきました",
            ],
          ];
    const labels = answers[promptIndex].map((answer) => fill(answer, v));
    return {
      instruction: "Listen and choose the most appropriate response.",
      script: prompts[promptIndex],
      question: "最も適切な答えを選んでください。",
      correct: labels[0],
      distractors: [labels[1], labels[2], ""],
      explanation:
        "The correct response directly and naturally addresses the request or question in the prompt.",
    };
  }
  if (type === "listening-integrated") {
    return {
      instruction:
        "Listen to the discussion and choose the plan the speakers decide on.",
      script: `ナレーション：${v.place}では展示案内の見直しを検討しています。試験公開の調査では、映像は分かりやすいと評価されました。一方、入口の説明が長く、読む人が立ち止まるため順路が混雑するという意見が多くありました。また、説明を短くすると、背景を詳しく知りたい人には情報が足りないという声もあります。費用の関係で新しい機械は増やせませんが、案内を置く場所と文章は変更できます。\n\n男の人：入口の説明を半分にして、映像も短くすれば、混雑はかなり減りそうですね。\n女の人：でも、映像は分かりやすいと評価されています。問題が出た部分まで一緒に短くする必要はないと思います。\n男の人：では映像は残して、説明だけ要点に絞りますか。\n女の人：入口はそれでいいと思います。ただ、詳しい内容をなくすのではなく、展示の奥で読めるようにしませんか。急いでいる人は要点だけ読み、関心のある人は先へ進んで詳しい説明を選べます。\n男の人：なるほど。入口で止まる人を減らせますね。順路については、床の印を増やす案も出ていました。\n女の人：印を増やすだけなら今の予算でできます。説明を二段階に分けることと一緒に行いましょう。\n男の人：分かりました。映像の長さと数は変えず、入口には要点、奥には詳しい説明を置く。床の印も増やす、という案でまとめます。`,
      question: "展示案内をどのように変えることにしましたか。",
      correct: "映像は保ち、説明を要点と詳細に分け、順路の印を増やす",
      distractors: [
        "映像と入口の説明を半分にし、詳しい情報をなくす",
        "説明の場所は変えず、新しい案内機械を増やす",
        "映像をなくし、床の印だけを増やす",
      ],
      explanation:
        "The final summary retains the successful video, separates summary from detail, and adds floor markings within the existing budget.",
    };
  }
  return {
    instruction: "Listen to the talk and choose its main point.",
    script: `${v.place}で新しい取り組みを始めるとき、参加者の数だけを見て成功かどうかを決めることがあります。しかし、${v.person}さんの調査では、人数が同じでも、参加しにくかった人が新しく来た場合には別の意味があると分かりました。大切なのは、数の変化だけでなく、誰が参加できるようになり、まだ誰に届いていないかを見ることです。`,
    question: "話し手が最も伝えたいことは何ですか。",
    correct: "人数だけでなく、参加できる人の変化も確かめるべきだ",
    distractors: [
      "参加者が増えない取り組みはすべて失敗だ",
      "調査では人数だけを記録すればよい",
      "新しい取り組みは参加者を限定すべきだ",
    ],
    explanation:
      "The speaker argues for examining who gained access, not merely the total headcount.",
  };
}

function generatedQuestion(
  profile: LevelQuestionProfile,
  type: JlptTestItemType,
  index: number,
) {
  switch (type) {
    case "kanji-reading":
    case "orthography":
    case "paraphrase":
      return lexicalQuestion(profile, type, index);
    case "context-expression":
    case "grammar-form":
    case "word-formation":
      return clozeQuestion(profile, type, index);
    case "text-grammar":
      return textGrammarQuestion(profile, index);
    case "usage":
      return usageQuestion(profile, index);
    case "sentence-composition":
      return compositionQuestion(profile, index);
    case "reading-short":
    case "reading-mid":
    case "reading-long":
    case "reading-integrated":
    case "reading-thematic":
    case "information-retrieval":
      return readingQuestion(profile, type, index);
    case "listening-task":
    case "listening-key-points":
    case "listening-outline":
    case "listening-verbal":
    case "listening-quick-response":
    case "listening-integrated":
      return listeningQuestion(profile, type, index);
  }
}

export function buildGeneratedQuestionBank(
  profile: LevelQuestionProfile,
  supportedTypes: readonly JlptTestItemType[],
) {
  return supportedTypes.flatMap((type) =>
    Array.from({ length: GENERATED_QUESTIONS_PER_TYPE }, (_, index) =>
      generatedQuestion(profile, type, index),
    ),
  );
}
