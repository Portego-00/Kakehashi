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
