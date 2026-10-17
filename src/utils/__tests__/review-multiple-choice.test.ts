import type { Subject } from "../../types/wanikani";
import { createReviewAnswerChoices } from "../review-multiple-choice";

function vocabulary(
  id: number,
  characters: string,
  meaning: string,
  reading: string,
  components: number[] = [],
  partsOfSpeech: string[] = [],
): Subject {
  return {
    id,
    object: "vocabulary",
    data: {
      characters,
      level: 5,
      component_subject_ids: components,
      parts_of_speech: partsOfSpeech,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      readings: [{ reading, primary: true, accepted_answer: true }],
    },
  };
}
const school = vocabulary(1, "学校", "School", "がっこう", [10, 11]);
const cat = vocabulary(2, "猫", "Cat", "ねこ");
const animals = [
  vocabulary(3, "犬", "Dog", "いぬ"),
  vocabulary(4, "鳥", "Bird", "とり"),
  vocabulary(5, "馬", "Horse", "うま"),
];

it("creates four similar kana choices offline with exactly one correct answer", () => {
  const choices = createReviewAnswerChoices({
    subject: school,
    questionType: "reading",
    subjects: [],
    seed: "one",
  });
  expect(choices).toHaveLength(4);
  expect(choices.filter((choice) => choice.isCorrect)).toEqual([
    { text: "がっこう", isCorrect: true },
  ]);
  expect(new Set(choices.map((choice) => choice.text)).size).toBe(4);
  for (const choice of choices) {
    expect(choice.text).toMatch(/^[ぁ-ゖー]+$/);
    expect(Math.abs(choice.text.length - 4)).toBeLessThanOrEqual(1);
  }
});

it("excludes all alternative readings, including unaccepted reading types and katakana equivalents", () => {
  const subject: Subject = {
    ...school,
    data: {
      ...school.data,
      readings: [
        { reading: "がっこう", primary: true, accepted_answer: true },
        { reading: "かっこう", accepted_answer: false },
        { reading: "がこう", accepted_answer: true },
        { reading: "がっこ", accepted_answer: true },
      ],
    },
  };
  const choices = createReviewAnswerChoices({
    subject,
    questionType: "reading",
    subjects: [vocabulary(8, "別", "Other", "ガッコウ")],
    seed: "two",
  });
  expect(choices).toHaveLength(4);
  expect(
    choices.filter((choice) => !choice.isCorrect).map((choice) => choice.text),
  ).not.toEqual(expect.arrayContaining(["かっこう"]));
  for (const choice of choices.filter((entry) => !entry.isCorrect))
    expect(["がっこう", "かっこう", "がこう", "がっこ"]).not.toContain(
      choice.text,
    );
});

it("preserves the verb ending when generating reading traps", () => {
  const subject = vocabulary(10, "食べる", "To eat", "たべる");
  const choices = createReviewAnswerChoices({
    subject,
    questionType: "reading",
    subjects: [],
    seed: "verb",
  });
  expect(choices).toHaveLength(4);
  expect(choices.every((choice) => choice.text.endsWith("べる"))).toBe(true);
});

it("prefers related meanings over unrelated entries", () => {
  const choices = createReviewAnswerChoices({
    subject: cat,
    questionType: "meaning",
    subjects: [...animals, school],
    seed: "animals",
  });
  expect(choices.map((choice) => choice.text).sort()).toEqual([
    "Bird",
    "Cat",
    "Dog",
    "Horse",
  ]);
});

it("excludes synonyms and whitelist meanings, including alternate meanings of distractor subjects", () => {
  const subject: Subject = {
    ...cat,
    data: {
      ...cat.data,
      auxiliary_meanings: [{ meaning: "Kitty", type: "whitelist" }],
    },
  };
  const ambiguous: Subject = {
    ...vocabulary(11, "子猫", "Kitten", "こねこ"),
    data: {
      ...vocabulary(11, "子猫", "Kitten", "こねこ").data,
      meanings: [{ meaning: "Kitten", primary: true }, { meaning: "Cat" }],
    },
  };
  const choices = createReviewAnswerChoices({
    subject,
    questionType: "meaning",
    subjects: [
      ...animals,
      ambiguous,
      vocabulary(12, "猫", "Kitty", "ねこ"),
      vocabulary(13, "猫", "Feline", "ねこ"),
    ],
    meaningSynonyms: ["Feline"],
    seed: "synonyms",
  });
  expect(choices.map((choice) => choice.text).sort()).toEqual([
    "Bird",
    "Cat",
    "Dog",
    "Horse",
  ]);
});

it("keeps the same choices and order on rerender but varies positions between occurrences", () => {
  const options = {
    subject: school,
    questionType: "reading" as const,
    subjects: [],
    seed: "stable",
  };
  expect(createReviewAnswerChoices(options)).toEqual(
    createReviewAnswerChoices(options),
  );
  const positions = new Set(
    Array.from({ length: 20 }, (_, index) =>
      createReviewAnswerChoices({ ...options, seed: String(index) }).findIndex(
        (choice) => choice.isCorrect,
      ),
    ),
  );
  expect(positions.size).toBe(4);
});

it("keeps four meaning choices available with a sparse or empty catalog", () => {
  for (const subjects of [[], [school]]) {
    const choices = createReviewAnswerChoices({
      subject: cat, questionType: "meaning", subjects, seed: "empty",
    });
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map(({ text }) => text)).size).toBe(4);
    expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "Cat", isCorrect: true }]);
  }
});

it("uses verb meanings for 想像する instead of related nouns", () => {
  const subject = vocabulary(100, "想像する", "To Imagine", "そうぞうする", [10, 11]);
  const nouns = [
    vocabulary(101, "予想", "Expectation", "よそう", [10]),
    vocabulary(102, "思想", "Ideology", "しそう", [10]),
    vocabulary(103, "想定", "Assumption", "そうてい", [10]),
  ];
  const verbs = [
    vocabulary(104, "食べる", "To Eat", "たべる"),
    vocabulary(105, "読む", "To Read", "よむ"),
    vocabulary(106, "歩く", "To Walk", "あるく"),
  ];
  for (const subjects of [nouns, [...nouns, ...verbs]]) {
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects,
      learnedSubjectIds: new Set(subjects.map(({ id }) => id)), seed: "imagine",
    });
    expect(choices).toHaveLength(4);
    expect(choices.every(({ text }) => /^to\s/i.test(text))).toBe(true);
    expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "To Imagine", isCorrect: true }]);
  }
});

it("selects an accepted verb meaning from an entry whose primary meaning is a noun", () => {
  const subject = vocabulary(100, "想像する", "To Imagine", "そうぞうする");
  const subjects = ["Expectation", "Assumption", "Prediction"].map((meaning, index) => ({
    ...vocabulary(101 + index, "想", meaning, "そう"),
    data: {
      characters: "想",
      parts_of_speech: ["noun", "suru verb"],
      meanings: [
        { meaning, primary: true, accepted_answer: true },
        { meaning: ["To Expect", "To Assume", "To Predict"][index], accepted_answer: true },
        { meaning: "To Imagine", accepted_answer: false },
      ],
    },
  }));
  // Remove the overlapping meaning to allow these subjects as distractors.
  const compatible = subjects.map((entry) => ({ ...entry, data: {
    ...entry.data, meanings: entry.data.meanings.slice(0, 2),
  } }));
  const choices = createReviewAnswerChoices({
    subject, questionType: "meaning", subjects: compatible, seed: "mixed-pos",
  });
  expect(choices.map(({ text }) => text).sort()).toEqual([
    "To Assume", "To Expect", "To Imagine", "To Predict",
  ]);
  const ambiguous = createReviewAnswerChoices({
    subject, questionType: "meaning", subjects, seed: "mixed-pos",
  });
  expect(ambiguous).toHaveLength(4);
  for (const text of ["To Expect", "To Assume", "To Predict"]) {
    expect(ambiguous.map((choice) => choice.text)).not.toContain(text);
  }
});

it("retains difficult verb choices before filling gaps with compatible learned answers", () => {
  const subject = vocabulary(100, "想像する", "To Imagine", "そうぞうする");
  const related = vocabulary(101, "想定する", "To Assume", "そうていする");
  const subjects = [related, ...["To Eat", "To Drink", "To Walk"].map((meaning, index) =>
    vocabulary(102 + index, "別", meaning, "べつ")), ...animals];
  const choices = createReviewAnswerChoices({
    subject, questionType: "meaning", subjects,
    learnedSubjectIds: new Set(subjects.map(({ id }) => id)), seed: "partial-verbs",
  });
  expect(choices).toHaveLength(4);
  expect(choices.map(({ text }) => text)).toContain("To Assume");
  expect(choices.every(({ text }) => /^to\s/i.test(text))).toBe(true);
});

describe("part of speech and relatedness", () => {
  it("prefers conceptually related verbs for 想像する over unrelated verbs", () => {
    const subject = vocabulary(100, "想像する", "To Imagine", "そうぞうする", [], ["suru verb"]);
    const related = ["To Expect", "To Assume", "To Predict"].map((meaning, index) =>
      vocabulary(101 + index, "別", meaning, "べつ", [], ["transitive verb"]));
    const unrelated = ["To Eat", "To Read", "To Walk"].map((meaning, index) =>
      vocabulary(110 + index, "他", meaning, "た", [], ["godan verb"]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [...unrelated, ...related], seed: "mental-verbs",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["To Assume", "To Expect", "To Imagine", "To Predict"]);
  });

  it("keeps related adjectives while excluding nouns with stronger kanji overlap", () => {
    const subject = vocabulary(100, "大きい", "Big", "おおきい", [1, 2, 3], ["i-adjective"]);
    const adjectives = [
      vocabulary(101, "小さい", "Small", "ちいさい", [], ["I Adjective"]),
      vocabulary(102, "狭い", "Narrow", "せまい", [], ["i_adjective"]),
      vocabulary(103, "深い", "Deep", "ふかい", [], ["na-adjective"]),
    ];
    const nouns = ["Size", "Length", "Height"].map((meaning, index) =>
      vocabulary(110 + index, "大", meaning, "だい", [1, 2, 3], ["noun"]));
    const unrelated = ["Quiet", "Clean", "Polite"].map((meaning, index) =>
      vocabulary(120 + index, "別", meaning, "べつ", [], ["na-adjective"]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [...nouns, ...adjectives, ...unrelated], seed: "adjectives",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["Big", "Deep", "Narrow", "Small"]);
  });

  it("keeps related nouns while excluding adjectives with stronger kanji overlap", () => {
    const components = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const subject = vocabulary(100, "雨", "Rain", "あめ", components, ["noun"]);
    const nouns = ["Snow", "Wind", "Cloud"].map((meaning, index) =>
      vocabulary(101 + index, "別", meaning, "べつ", [], ["Noun"]));
    const adjectives = ["Rainy", "Snowy", "Cloudy"].map((meaning, index) =>
      vocabulary(110 + index, "雨", meaning, "あめ", components, ["i-adjective"]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [...adjectives, ...nouns], seed: "nouns",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["Cloud", "Rain", "Snow", "Wind"]);
  });

  it("ranks known compatible types above related entries with missing metadata", () => {
    const subject = vocabulary(100, "冷たい", "Cold", "つめたい", [1, 2, 3], ["i-adjective"]);
    const adjectives = ["Quiet", "Clean", "Polite"].map((meaning, index) =>
      vocabulary(101 + index, "別", meaning, "べつ", [], ["na-adjective"]));
    const unknown = vocabulary(110, "冷", "Weather", "れい", [1, 2, 3]);
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [unknown, ...adjectives], seed: "unknown-pos",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["Clean", "Cold", "Polite", "Quiet"]);
  });

  it("prefers matching kana-vocabulary types to related vocabulary with unknown types", () => {
    const subject = vocabulary(100, "冷たい", "Cold", "つめたい", [1, 2, 3], ["i-adjective"]);
    const adjectives = ["Quiet", "Clean", "Polite"].map((meaning, index) => ({
      ...vocabulary(101 + index, "べつ", meaning, "べつ", [], ["na-adjective"]),
      object: "kana_vocabulary" as const,
    }));
    const unknown = ["Weather", "Rain", "Snow"].map((meaning, index) =>
      vocabulary(110 + index, "冷", meaning, "れい", [1, 2, 3]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [...unknown, ...adjectives], seed: "cross-catalog-pos",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["Clean", "Cold", "Polite", "Quiet"]);
  });

  it("uses a compatible local adjective when the learned pool contains only nouns", () => {
    const subject = vocabulary(100, "冷たい", "Cold", "つめたい", [], ["i-adjective"]);
    const unrelated = vocabulary(101, "水", "Water", "みず", [], ["noun"]);
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [unrelated],
      learnedSubjectIds: new Set([unrelated.id]), seed: "adjective-fallback",
    });
    expect(choices).toHaveLength(4);
    expect(choices.map(({ text }) => text)).not.toContain("Water");
  });

  it("uses adverbs rather than highly related nouns and adjectives", () => {
    const subject = vocabulary(100, "静かに", "Quietly", "しずかに", [1, 2, 3], ["adverb"]);
    const adverbs = ["Slowly", "Quickly", "Carefully"].map((meaning, index) =>
      vocabulary(101 + index, "別", meaning, "べつ", [], ["Adverb (fukushi)"]));
    const wrongParts = [
      vocabulary(110, "静か", "Quiet", "しずか", [1, 2, 3], ["na-adjective"]),
      vocabulary(111, "静けさ", "Silence", "しずけさ", [1, 2, 3], ["noun"]),
    ];
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: [...wrongParts, ...adverbs], seed: "adverbs",
    });
    expect(choices.map(({ text }) => text).sort()).toEqual(["Carefully", "Quickly", "Quietly", "Slowly"]);
  });

  it("distinguishes an adjective translated with 'To Be' from other verbs", () => {
    const subject = vocabulary(100, "冷たい", "To Be Cold", "つめたい", [], ["i-adjective"]);
    const verbs = ["To Eat", "To Read", "To Walk"].map((meaning, index) =>
      vocabulary(101 + index, "冷", meaning, "れい", [], ["godan verb"]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: verbs, seed: "to-be-adjective",
    });
    expect(choices).toHaveLength(4);
    expect(choices.every(({ text }) => text.startsWith("To Be "))).toBe(true);
    expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "To Be Cold", isCorrect: true }]);
  });

  it("keeps bare English verb translations grammatical in the offline fallback", () => {
    const subject = vocabulary(100, "想像する", "Imagine", "そうぞうする", [], ["suru verb"]);
    const nouns = ["Expectation", "Ideology", "Assumption"].map((meaning, index) =>
      vocabulary(101 + index, "想", meaning, "そう", [], ["noun"]));
    const choices = createReviewAnswerChoices({
      subject, questionType: "meaning", subjects: nouns, seed: "bare-verb",
    });
    expect(choices).toHaveLength(4);
    for (const { text } of choices) {
      expect(["Expectation", "Ideology", "Assumption"]).not.toContain(text);
      expect(text).not.toMatch(/^to\s/i);
    }
  });
});

describe("offline choice availability", () => {
  it.each(["Cat", "To Imagine"])("keeps choices for %s as additional user synonyms exhaust the local pool", (meaning) => {
    const subject = vocabulary(100, "想像する", meaning, "そうぞうする");
    const meaningSynonyms: string[] = [];
    for (let index = 0; index < 30; index++) {
      const choices = createReviewAnswerChoices({
        subject, questionType: "meaning", subjects: [], meaningSynonyms, seed: String(index),
      });
      expect(choices).toHaveLength(4);
      const distractors = choices.filter(({ isCorrect }) => !isCorrect).map(({ text }) => text);
      for (const text of distractors) expect(meaningSynonyms).not.toContain(text);
      meaningSynonyms.push(...distractors);
    }
  });

  it.each([
    ["Cold", "i-adjective"], ["Quietly", "adverb"],
  ])("keeps %s choices as aliases exhaust the matching grammatical pool", (meaning, part) => {
    const subject = vocabulary(100, "別", meaning, "べつ", [], [part]);
    const meaningSynonyms: string[] = [];
    for (let index = 0; index < 20; index++) {
      const choices = createReviewAnswerChoices({
        subject, questionType: "meaning", subjects: [], meaningSynonyms, seed: String(index),
      });
      expect(choices).toHaveLength(4);
      const distractors = choices.filter(({ isCorrect }) => !isCorrect).map(({ text }) => text);
      for (const text of distractors) expect(meaningSynonyms).not.toContain(text);
      meaningSynonyms.push(...distractors);
    }
  });

  it.each(["radical", "kanji", "vocabulary", "kana_vocabulary"] as const)(
    "keeps four %s meaning choices without a catalog, excluding synonyms and aliases",
    (object) => {
      const options = {
        subject: { ...cat, object, data: { ...cat.data,
          auxiliary_meanings: [{ meaning: "River", type: "whitelist" as const }],
          meanings: [...cat.data.meanings, { meaning: "Water", accepted_answer: false }],
        } },
        questionType: "meaning" as const, subjects: [], seed: "offline",
        meaningSynonyms: ["Fire", "The Mountain", "To See"],
      };
      const choices = createReviewAnswerChoices(options);
      expect(choices).toHaveLength(4);
      expect(new Set(choices.map(({ text }) => text)).size).toBe(4);
      expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "Cat", isCorrect: true }]);
      expect(createReviewAnswerChoices(options)).toEqual(choices);
      for (const { text } of choices.filter(({ isCorrect }) => !isCorrect)) {
        expect(["Water", "River", "Fire", "Mountain", "To See"]).not.toContain(text);
        expect(text).not.toMatch(/^to\s/i);
      }
    },
  );

  it("keeps four readings when the prompt has no sound-confusion candidates", () => {
    const choices = createReviewAnswerChoices({
      subject: vocabulary(100, "ん", "N", "ん"),
      questionType: "reading", subjects: [], seed: "offline-reading",
    });
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map(({ text }) => text)).size).toBe(4);
    expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "ん", isCorrect: true }]);
    expect(choices.every(({ text }) => /^[ぁ-ゖ]+$/.test(text))).toBe(true);
  });

  it("keeps four readings even as alternate readings exhaust the local pool", () => {
    const subject = vocabulary(100, "ん", "N", "ん");
    for (let index = 0; index < 10; index++) {
      const choices = createReviewAnswerChoices({
        subject, questionType: "reading", subjects: [], seed: String(index),
      });
      expect(choices).toHaveLength(4);
      expect(choices.every(({ text }) => /^[ぁ-ゖ]+$/.test(text))).toBe(true);
      expect(new Set(choices.map(({ text }) => text)).size).toBe(4);
      for (const { text } of choices.filter(({ isCorrect }) => !isCorrect)) {
        expect(subject.data.readings!.map(({ reading }) => reading)).not.toContain(text);
      }
      subject.data.readings!.push(...choices.filter(({ isCorrect }) => !isCorrect).map(({ text }) => ({
        reading: text, accepted_answer: false,
      })));
    }
  });
});

describe("learned-answer fallback", () => {
  const unrelated = [
    vocabulary(20, "畳", "Tatami", "たたみ"),
    vocabulary(21, "祭", "Festival", "まつり"),
    vocabulary(22, "傘", "Umbrella", "かさ"),
    vocabulary(23, "砂", "Sand", "すな"),
    vocabulary(24, "塩", "Salt", "しお"),
  ];
  const learnedSubjectIds = new Set(unrelated.map(({ id }) => id));

  it.each(["kanji", "vocabulary", "kana_vocabulary"] as const)(
    "fills %s meanings from learned answers when none are related",
    (object) => {
      const subjects = unrelated.map((entry) => ({ ...entry, object }));
      const options = { subject: { ...cat, object }, questionType: "meaning" as const,
        subjects, learnedSubjectIds, seed: "fallback" };
      const choices = createReviewAnswerChoices(options);
      expect(choices).toHaveLength(4);
      expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "Cat", isCorrect: true }]);
      expect(new Set(choices.map(({ text }) => text)).size).toBe(4);
      expect(createReviewAnswerChoices(options)).toEqual(choices);
      for (const choice of choices.filter(({ isCorrect }) => !isCorrect)) {
        expect(unrelated.map((entry) => entry.data.meanings[0].meaning)).toContain(choice.text);
      }
      const results = new Set(Array.from({ length: 10 }, (_, index) =>
        createReviewAnswerChoices({ ...options, seed: String(index) })
          .map(({ text }) => text).sort().join(",")));
      expect(results.size).toBeGreaterThan(1);
    },
  );

  it.each([1, 2, 3])("keeps all %i difficult distractors before filling the gaps", (count) => {
    const choices = createReviewAnswerChoices({
      subject: cat, questionType: "meaning", subjects: [...animals.slice(0, count), ...unrelated],
      learnedSubjectIds, seed: "partial",
    });
    expect(choices).toHaveLength(4);
    expect(choices.map(({ text }) => text)).toEqual(expect.arrayContaining(
      animals.slice(0, count).map((entry) => entry.data.meanings[0].meaning),
    ));
  });

  it("leaves a full set of difficult choices and their order unchanged", () => {
    const options = { subject: cat, questionType: "meaning" as const,
      subjects: [...animals, ...unrelated], seed: "unchanged" };
    expect(createReviewAnswerChoices({ ...options, learnedSubjectIds })).toEqual(createReviewAnswerChoices(options));
  });

  it("uses learned answers of other subject types when the same type has too few", () => {
    const choices = createReviewAnswerChoices({
      subject: { ...cat, object: "kanji" }, questionType: "meaning", subjects: unrelated,
      learnedSubjectIds, seed: "cross-type",
    });
    expect(choices).toHaveLength(4);
  });

  it("excludes unlearned fillers, synonyms, alternate meanings, and normalized duplicates", () => {
    const ambiguous = { ...vocabulary(30, "子猫", "Kitten", "こねこ"),
      data: { characters: "子猫", meanings: [{ meaning: "Kitten", primary: true }, { meaning: "Cat" }] } };
    const subjects = [...unrelated.slice(0, 3),
      vocabulary(31, "祭", "The Festival", "まつり"),
      vocabulary(32, "猫", "Feline", "ねこ"),
      vocabulary(33, "猫", "Kitty", "ねこ"), ambiguous,
      vocabulary(99, "塩", "Salt", "しお")];
    const choices = createReviewAnswerChoices({
      subject: { ...cat, data: { ...cat.data, auxiliary_meanings: [{ meaning: "Kitty", type: "whitelist" }] } },
      questionType: "meaning", subjects, meaningSynonyms: ["Feline"],
      learnedSubjectIds: new Set(subjects.filter(({ id }) => id !== 99).map(({ id }) => id)), seed: "exclude",
    });
    expect(choices).toHaveLength(4);
    expect(choices.map(({ text }) => text.replace(/^The /, "")).sort()).toEqual(["Cat", "Festival", "Tatami", "Umbrella"]);
  });

  it("fills readings even when no sound-confusion or similar reading is available", () => {
    const subject = vocabulary(40, "ん", "N", "ん");
    const choices = createReviewAnswerChoices({ subject, questionType: "reading", subjects: unrelated,
      learnedSubjectIds, seed: "reading-fallback" });
    expect(choices).toHaveLength(4);
    expect(choices.filter(({ isCorrect }) => isCorrect)).toEqual([{ text: "ん", isCorrect: true }]);
    for (const choice of choices.filter(({ isCorrect }) => !isCorrect)) {
      expect(unrelated.map((entry) => entry.data.readings![0].reading)).toContain(choice.text);
    }
  });

  it("excludes alternate readings and duplicates from the learned fallback", () => {
    const subject = { ...vocabulary(40, "ん", "N", "ん"), data: {
      characters: "ん", meanings: [], readings: [
        { reading: "ん", primary: true, accepted_answer: true },
        { reading: "カサ", accepted_answer: false },
      ],
    } };
    const subjects = [...unrelated, vocabulary(50, "畳", "Tatami mat", "タタミ")];
    const choices = createReviewAnswerChoices({ subject, questionType: "reading", subjects,
      learnedSubjectIds: new Set(subjects.map(({ id }) => id)), seed: "reading-exclusions" });
    expect(choices).toHaveLength(4);
    const answers = choices.map(({ text }) => text);
    expect(new Set(answers).size).toBe(4);
    expect(answers).not.toContain("かさ");
    expect(answers.every((text) => /^[ぁ-ゖ]+$/.test(text))).toBe(true);
  });
});

function radical(
  id: number,
  meaning: string,
  level = 1,
  amalgamations: number[] = [],
): Subject {
  return {
    id,
    object: "radical",
    data: {
      characters: null,
      level,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      amalgamation_subject_ids: amalgamations,
    },
  };
}

it("offers radical names even when their mnemonics have no semantic family", () => {
  const gun = radical(1, "Gun");
  const choices = createReviewAnswerChoices({
    subject: gun,
    questionType: "meaning",
    subjects: [gun, radical(2, "Slide"), radical(3, "Lid"), radical(4, "Barb")],
    seed: "radical-names",
  });
  expect(choices).toHaveLength(4);
  expect(choices.filter((choice) => choice.isCorrect)).toEqual([
    { text: "Gun", isCorrect: true },
  ]);
});

it("prefers radicals used in the same kanji, then names from nearby levels", () => {
  const gun = radical(1, "Gun", 1, [101, 102]);
  const choices = createReviewAnswerChoices({
    subject: gun,
    questionType: "meaning",
    subjects: [
      radical(2, "Slide", 1),
      radical(3, "Lid", 1),
      radical(4, "Barb", 20, [101]),
      radical(5, "Coffin", 40),
      radical(6, "Weapon", 1),
    ],
    meaningSynonyms: ["Weapon"],
    seed: "radical-relations",
  });
  expect(choices.map((choice) => choice.text).sort()).toEqual([
    "Barb",
    "Gun",
    "Lid",
    "Slide",
  ]);
});
