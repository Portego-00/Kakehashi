import { getSubjectById } from "./cache";
import type { SubjectType } from "./subjectColors";

const subjectTypes = new Map<number, SubjectType>();
const pendingSubjectTypes = new Map<
  number,
  Promise<SubjectType | null>
>();

function normalizeSubjectType(value: unknown): SubjectType | null {
  switch (value) {
    case "radical":
    case "kanji":
    case "vocabulary":
    case "kana_vocabulary":
      return value;
    default:
      return null;
  }
}

export function rememberNoteSubjectType(
  subjectId: number,
  value: unknown,
): SubjectType | null {
  const subjectType = normalizeSubjectType(value);
  if (!Number.isInteger(subjectId) || subjectId <= 0 || !subjectType) {
    return null;
  }

  subjectTypes.set(subjectId, subjectType);
  return subjectType;
}

export function peekNoteSubjectType(
  subjectId: number,
): SubjectType | null {
  return subjectTypes.get(subjectId) ?? null;
}

export function resolveNoteSubjectType(
  subjectId: number,
): Promise<SubjectType | null> {
  const rememberedType = peekNoteSubjectType(subjectId);
  if (rememberedType) return Promise.resolve(rememberedType);

  const pendingType = pendingSubjectTypes.get(subjectId);
  if (pendingType) return pendingType;

  const resolution = getSubjectById(subjectId)
    .then((subject: unknown) => {
      if (!subject || typeof subject !== "object") return null;
      return rememberNoteSubjectType(
        subjectId,
        (subject as { object?: unknown }).object,
      );
    })
    .catch(() => null)
    .finally(() => {
      pendingSubjectTypes.delete(subjectId);
    });

  pendingSubjectTypes.set(subjectId, resolution);
  return resolution;
}
