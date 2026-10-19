import { getLessonUnlocks, type LessonUnlockSubject } from "../lessonUnlocks";

const lessons = [
  { id: 1, object: "kanji", data: { level: 4 } },
  { id: 2, object: "kanji", data: { level: 4 } },
  { id: 3, object: "kanji", data: { level: 5 } },
  { id: 4, object: "radical", data: { level: 4 } },
  { id: 5, object: "vocabulary", data: { level: 4 } },
  { id: 6, object: "radical", data: { level: 4 } },
];

function subject(id: number, object: string, level: number, components?: number[] | null): LessonUnlockSubject {
  return { id, object, data: { level, characters: String(id), meanings: [], component_subject_ids: components } };
}

it("finds same-level vocabulary for kanji and kanji for radicals, including shared dependencies and zero counts", () => {
  const hidden = subject(13, "vocabulary", 4, [1]);
  hidden.data.hidden_at = "2026-01-01";
  const unlocks = getLessonUnlocks(lessons, [
    subject(10, "vocabulary", 4, [1]),
    subject(11, "vocabulary", 4, [1, 2]),
    subject(12, "vocabulary", 5, [1, 2]),
    hidden,
    subject(14, "kana_vocabulary", 4, [1]),
    subject(15, "vocabulary", 4, null),
    subject(16, "kanji", 4, [4, 6]),
    subject(17, "kanji", 4, [4]),
    subject(18, "kanji", 5, [4]),
    subject(19, "vocabulary", 4, [4]), // A radical cannot directly unlock vocabulary.
    subject(20, "kanji", 4, [1]), // A kanji cannot directly unlock another kanji.
  ]);
  expect([...unlocks].map(([id, matches]) => [id, matches.map((match) => match.id)]))
    .toEqual([[1, [10, 11]], [2, [11]], [3, []], [4, [16, 17]], [6, [16]]]);
});

it("retains full subject details and deduplicates subjects and repeated component IDs", () => {
  const vocabulary = subject(10, "vocabulary", 4, [1, 1]);
  const kanji = subject(11, "kanji", 4, [4, 4]);
  const unlocks = getLessonUnlocks(lessons, [vocabulary, vocabulary, kanji, kanji]);
  expect(unlocks.get(1)).toEqual([vocabulary]);
  expect(unlocks.get(4)).toEqual([kanji]);
  expect(unlocks.has(5)).toBe(false);
});
