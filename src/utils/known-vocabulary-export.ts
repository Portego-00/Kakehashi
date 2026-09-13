import type { Assignment, Subject } from "./api";

type VocabularySubject = Pick<Subject, "id" | "object"> & {
  data: Pick<Subject["data"], "characters" | "hidden_at">;
};

type VocabularyAssignment = {
  data: Pick<
    Assignment["data"],
    "subject_id" | "started_at" | "srs_stage" | "hidden"
  > & { subject_type: string };
};

const isVocabulary = (subjectType: string) =>
  subjectType === "vocabulary" || subjectType === "kana_vocabulary";

export function buildKnownVocabularyList(
  subjects: readonly VocabularySubject[],
  assignments: readonly VocabularyAssignment[],
): string[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const words = new Set<string>();

  for (const { data } of assignments) {
    // Completing a lesson starts the assignment at Apprentice 1. Include every
    // subsequent stage, including Burned, but exclude lessons and reset items.
    if (
      !isVocabulary(data.subject_type) ||
      data.hidden ||
      !data.started_at ||
      data.srs_stage <= 0
    ) {
      continue;
    }

    const subject = subjectsById.get(data.subject_id);
    if (!subject) {
      // A partial cache must not silently produce an incomplete export.
      throw new Error("Known vocabulary is missing subject data.");
    }

    if (!isVocabulary(subject.object) || subject.data.hidden_at) {
      continue;
    }

    const characters = subject.data.characters?.trim();
    if (characters) {
      words.add(characters);
    }
  }

  return [...words].sort();
}
