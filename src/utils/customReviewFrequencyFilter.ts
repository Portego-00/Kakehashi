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
