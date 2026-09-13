import type { Subject } from "../../types/wanikani";
import { createReviewAnswerChoices } from "../review-multiple-choice";

function vocabulary(
  id: number,
  characters: string,
  meaning: string,
  reading: string,
  components: number[] = [],
): Subject {
  return {
    id,
    object: "vocabulary",
    data: {
      characters,
      level: 5,
      component_subject_ids: components,
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

it("falls back safely when there are not enough plausible meanings", () => {
  expect(
    createReviewAnswerChoices({
      subject: cat,
      questionType: "meaning",
      subjects: [school],
      seed: "empty",
    }),
  ).toEqual([]);
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
