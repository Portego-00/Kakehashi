export function matchesMaximumFrequencyRank(
  frequencyRank: number | null | undefined,
  maximumRank: number | null,
): boolean {
  if (maximumRank === null) {
    return true;
  }

  return (
    Number.isSafeInteger(maximumRank) &&
    maximumRank > 0 &&
    typeof frequencyRank === "number" &&
    Number.isSafeInteger(frequencyRank) &&
    frequencyRank > 0 &&
    frequencyRank <= maximumRank
  );
}

export function getReadySelectedSubjectIds(
  selectedSubjectIds: Iterable<number>,
  frequencyRanks: ReadonlyMap<number, number | null>,
  maximumRank: number | null,
): number[] {
  const selectedIds = Array.from(selectedSubjectIds);
  if (maximumRank === null) {
    return selectedIds;
  }

  return selectedIds.filter(
    (subjectId) =>
      frequencyRanks.has(subjectId) &&
      matchesMaximumFrequencyRank(
        frequencyRanks.get(subjectId),
        maximumRank,
      ),
  );
}
