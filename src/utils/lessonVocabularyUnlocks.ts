type UnlockSubject = {
  id: number;
  object: string;
  data: {
    level: number;
    hidden_at?: string | null;
    component_subject_ids?: readonly number[] | null;
  };
};

/**
 * Count same-level vocabulary that depend on each kanji reaching Guru.
 * Compounds count for each component; their other kanji must also reach Guru.
 */
export function getLessonVocabularyUnlockCounts(
  lessons: readonly UnlockSubject[],
  vocabulary: readonly UnlockSubject[],
): ReadonlyMap<number, number> {
  const kanjiLevels = new Map(
    lessons.filter((subject) => subject.object === "kanji")
      .map((subject) => [subject.id, subject.data.level]),
  );
  const counts = new Map([...kanjiLevels.keys()].map((id) => [id, 0]));
  const seen = new Set<number>();

  for (const subject of vocabulary) {
    if (subject.object !== "vocabulary" || subject.data.hidden_at || seen.has(subject.id)) continue;
    seen.add(subject.id);
    for (const id of new Set(subject.data.component_subject_ids ?? [])) {
      if (kanjiLevels.get(id) === subject.data.level) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  return counts;
}
