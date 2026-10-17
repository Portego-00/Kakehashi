import { getLessonVocabularyUnlockCounts } from "../lessonVocabularyUnlocks";

const lessons = [
  { id: 1, object: "kanji", data: { level: 4 } },
  { id: 2, object: "kanji", data: { level: 4 } },
  { id: 3, object: "kanji", data: { level: 5 } },
  { id: 4, object: "radical", data: { level: 4 } },
  { id: 5, object: "vocabulary", data: { level: 4 } },
];

it("counts same-level dependencies, including compounds for each kanji, and preserves zero counts", () => {
  const counts = getLessonVocabularyUnlockCounts(lessons, [
    { id: 10, object: "vocabulary", data: { level: 4, component_subject_ids: [1] } },
    { id: 11, object: "vocabulary", data: { level: 4, component_subject_ids: [1, 2] } },
    { id: 12, object: "vocabulary", data: { level: 5, component_subject_ids: [1, 2] } },
    { id: 13, object: "vocabulary", data: { level: 4, hidden_at: "2026-01-01", component_subject_ids: [1] } },
    { id: 14, object: "kana_vocabulary", data: { level: 4, component_subject_ids: [1] } },
    { id: 15, object: "vocabulary", data: { level: 4, component_subject_ids: null } },
  ]);
  expect([...counts]).toEqual([[1, 2], [2, 1], [3, 0]]);
});

it("does not double count duplicate vocabulary or repeated component IDs", () => {
  const vocabulary = { id: 10, object: "vocabulary", data: { level: 4, component_subject_ids: [1, 1] } };
  expect([...getLessonVocabularyUnlockCounts(lessons, [vocabulary, vocabulary])]).toEqual([[1, 1], [2, 0], [3, 0]]);
});
