import { expect, it, vi } from "vitest";
import type { BunproLearnContentItem } from "../../../../src/types/bunpro";
import { reviewContent } from "./model";
import { advanceBunproPractice, buildBunproPracticeQueue, canAccessBunproPractice, filterPracticeGrammar, DEFAULT_PRACTICE_FILTERS, shuffledPracticeGrammar } from "./practice";

const content: BunproLearnContentItem = {
  data: { id: "20", type: "grammar_point", attributes: { id: 20, title: "です", slug: "desu" } },
  included: [
    { id: "1", type: "study_question", attributes: { content: "私(わたし)は学生____。", answer: "です", alternate_grammar: ["だ"], female_audio_url: "https://example.com/desu.mp3" } },
    { id: "2", type: "study_question", attributes: { content: "これは本____。", answer: "です" } },
    { id: "3", type: "study_question", attributes: { content: "完成した文です。", answer: "です", question_type: "readonly" } },
    { id: "4", type: "study_question", attributes: { content: "欠けている____。" } },
    { id: "5", type: "writeup", attributes: { content: "____", answer: "です" } },
  ],
};
it("builds real cloze questions independently of any scheduled review or session ID", () => {
  const queue = buildBunproPracticeQueue([content, content], "sentence-drill", 10);
  expect(queue).toHaveLength(2);
  expect(new Set(queue.map(item => item.data.id)).size).toBe(2);
  const sentence = queue.find(item => item.data.id.endsWith(":1"))!;
  expect(reviewContent(sentence)).toMatchObject({ kind: "grammar", slug: "desu", question: { answer: "です", alternate_grammar: ["だ"] } });
  expect(sentence.data.id).toBe("practice:20:1");
});
it("restricts listening to cloze sentences with safe audio and applies the per-grammar limit", () => {
  expect(buildBunproPracticeQueue([content], "listening-cloze", 10).map(item => item.data.id)).toEqual(["practice:20:1"]);
  expect(buildBunproPracticeQueue([content], "no-hints", 1)).toHaveLength(1);
});
it("requires two consecutive successes in mastery and resets the streak after a miss", () => {
  let queue = buildBunproPracticeQueue([content], "sentence-drill", 1);
  const original = queue[0];
  let streaks = new Map<string, number>();
  for (const [correct, expectedStreak, completed] of [[true, 1, false], [false, 0, false], [true, 1, false], [true, 2, true]] as const) {
    const next = advanceBunproPractice(queue, streaks, correct, "mastery-loop");
    expect(next.completed).toBe(completed);
    expect(next.streaks.get(original.data.id)).toBe(expectedStreak);
    queue = next.queue; streaks = next.streaks;
  }
  expect(queue).toEqual([]);
});
it("ends a single-pass round after a miss so results can launch focused mistake practice", () => {
  const queue = buildBunproPracticeQueue([content], "sentence-drill", 1);
  expect(advanceBunproPractice(queue, new Map(), false, "no-hints")).toMatchObject({ queue: [], completed: true });
});
it.each(["Portego", " PORTEGO ", "portego"])("allows practice for %j", username => expect(canAccessBunproPractice(username)).toBe(true));
it.each(["Learner", "Portego2", "PortegoFan", "", undefined])("hides practice for %j", username => expect(canAccessBunproPractice(username)).toBe(false));

const pool = [
  { id: "1", slug: "one", title: "です", meaning: "To be", level: "JLPT5", streak: 0 },
  { id: "2", slug: "two", title: "たい", meaning: "Want to", level: "JLPT5", streak: 5 },
  { id: "3", slug: "three", title: "そう", meaning: "Seems", level: "JLPT4", streak: 12 },
  { id: "4", slug: "four", title: "なら", meaning: "If", level: "JLPT4", streak: null },
];
it("draws from studied grammar across all due dates and includes stage zero", () => {
  expect(filterPracticeGrammar(pool, DEFAULT_PRACTICE_FILTERS).map(item => item.id)).toEqual(["1", "2", "3"]);
});
it("combines JLPT, exact SRS stages and optional meaning filters", () => {
  expect(filterPracticeGrammar(pool, { ...DEFAULT_PRACTICE_FILTERS, levels: ["N5"], stages: [4, 5, 6], query: " WANT " }).map(item => item.id)).toEqual(["2"]);
  expect(filterPracticeGrammar(pool, { ...DEFAULT_PRACTICE_FILTERS, levels: [] })).toEqual([]);
  expect(filterPracticeGrammar(pool, { ...DEFAULT_PRACTICE_FILTERS, stages: [] })).toEqual([]);
});
it("lets unstudied grammar be practiced without enrolling it into SRS", () => {
  expect(filterPracticeGrammar(pool, { ...DEFAULT_PRACTICE_FILTERS, pool: "new" }).map(item => item.id)).toEqual(["4"]);
  expect(filterPracticeGrammar(pool, { ...DEFAULT_PRACTICE_FILTERS, pool: "all" })).toHaveLength(4);
});
it("shuffles the full catalog without changing or duplicating it", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const shuffled = shuffledPracticeGrammar(pool);
  expect(shuffled.map(item => item.id)).toEqual(["2", "3", "4", "1"]);
  expect(pool.map(item => item.id)).toEqual(["1", "2", "3", "4"]);
  random.mockRestore();
});
