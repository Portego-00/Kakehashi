export type KanaInputSelection = { start: number; end: number };

const unchangedTextLength = (previousText: string, rawText: string): number => {
  const maximumLength = Math.min(previousText.length, rawText.length);
  let prefixLength = 0;
  while (
    prefixLength < maximumLength &&
    previousText[prefixLength] === rawText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < maximumLength - prefixLength &&
    previousText[previousText.length - suffixLength - 1] ===
      rawText[rawText.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }
  return prefixLength + suffixLength;
};

const editEndAtSelection = (
  previousText: string,
  rawText: string,
  selection: KanaInputSelection,
): number | undefined => {
  const { start, end } = selection;
  if (start < 0 || end < start || end > previousText.length) return;

  const insertedLength = rawText.length - previousText.length + end - start;
  if (
    insertedLength >= 0 &&
    rawText.startsWith(previousText.slice(0, start)) &&
    rawText.endsWith(previousText.slice(end))
  ) {
    return start + insertedLength;
  }

  if (start !== end || rawText.length >= previousText.length) return;

  const removedLength = previousText.length - rawText.length;
  // A collapsed selection can delete either before (Backspace) or after
  // (Delete) the caret. Match the actual text before choosing a direction.
  const backwardStart = start - removedLength;
  if (
    backwardStart >= 0 &&
    previousText.slice(0, backwardStart) + previousText.slice(start) === rawText
  ) {
    return backwardStart;
  }

  const forwardEnd = start + removedLength;
  if (
    forwardEnd <= previousText.length &&
    previousText.slice(0, start) + previousText.slice(forwardEnd) === rawText
  ) {
    return start;
  }
};

/**
 * Locate the caret after a native edit, before romaji is shortened to kana.
 * Selection events can lag text events, so only trust a selection whose
 * unchanged prefix and suffix match the edit. Preserve the suffix when the
 * selection is stale, placing the caret after the changed text.
 */
export const inferKanaInputEditEnd = (
  previousText: string,
  rawText: string,
  selection?: KanaInputSelection,
  previousRawText?: string,
): number => {
  if (selection) {
    const selectedEditEnd = editEndAtSelection(previousText, rawText, selection);
    if (selectedEditEnd !== undefined) return selectedEditEnd;
  }

  // Native can still contain the previous raw text after rejecting an outdated
  // conversion. When the selection does not explain an edit to our kana, only
  // use the raw snapshot if it preserves more of the native text. Ties must not
  // turn a stale selection into a seemingly valid edit against old romaji.
  const previousSnapshot =
    previousRawText !== undefined &&
    unchangedTextLength(previousRawText, rawText) > unchangedTextLength(previousText, rawText)
      ? previousRawText
      : previousText;

  if (selection && previousSnapshot !== previousText) {
    const selectedEditEnd = editEndAtSelection(previousSnapshot, rawText, selection);
    if (selectedEditEnd !== undefined) return selectedEditEnd;
  }

  let unchangedSuffixLength = 0;
  const maximumSuffixLength = Math.min(previousSnapshot.length, rawText.length);
  while (
    unchangedSuffixLength < maximumSuffixLength &&
    previousSnapshot[previousSnapshot.length - unchangedSuffixLength - 1] ===
      rawText[rawText.length - unchangedSuffixLength - 1]
  ) {
    unchangedSuffixLength += 1;
  }
  return rawText.length - unchangedSuffixLength;
};
