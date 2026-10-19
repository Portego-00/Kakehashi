type UnlockComponent = {
  id: number;
  object: string;
  data: { level: number };
};

export type LessonUnlockSubject = {
  id: number;
  object: string;
  data: {
    level: number;
    characters: string | null;
    meanings: { meaning: string; primary?: boolean }[];
    readings?: { reading: string; primary?: boolean }[] | null;
    hidden_at?: string | null;
    component_subject_ids?: readonly number[] | null;
  };
};

export type LessonUnlocks = ReadonlyMap<number, readonly LessonUnlockSubject[]>;

/** Same-level kanji for radicals and vocabulary for kanji, including shared dependencies. */
export function getLessonUnlocks(
  lessons: readonly UnlockComponent[],
  subjects: readonly LessonUnlockSubject[],
): LessonUnlocks {
  const components = new Map(
    lessons.filter((subject) => subject.object === "radical" || subject.object === "kanji")
      .map((subject) => [subject.id, subject]),
  );
  const unlocks = new Map<number, LessonUnlockSubject[]>(
    [...components.keys()].map((id) => [id, []]),
  );
  const seen = new Set<number>();

  for (const subject of subjects) {
    if (subject.data.hidden_at || seen.has(subject.id)) continue;
    seen.add(subject.id);
    for (const id of new Set(subject.data.component_subject_ids ?? [])) {
      const component = components.get(id);
      if (
        component?.data.level === subject.data.level &&
        ((component.object === "radical" && subject.object === "kanji") ||
          (component.object === "kanji" && subject.object === "vocabulary"))
      ) {
        unlocks.get(id)!.push(subject);
      }
    }
  }

  return unlocks;
}
