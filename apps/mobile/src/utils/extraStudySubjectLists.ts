import { getSubjectIdSetForListIds } from "./subjectLists";

export function parseSelectedListIds(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const ids = rawValue
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

export async function getSelectedListSubjectIdSet(
  selectedListIds: string[]
): Promise<Set<number>> {
  if (!selectedListIds.length) {
    return new Set();
  }
  return getSubjectIdSetForListIds(selectedListIds);
}

export function subjectMatchesSelectedLists(
  subjectId: number,
  selectedListIds: string[],
  selectedListSubjectIds: Set<number>
): boolean {
  if (!selectedListIds.length) {
    return true;
  }
  return selectedListSubjectIds.has(subjectId);
}
