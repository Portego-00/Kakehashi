/** Builds both the visible word and its checked answer from the same cells. */
export function buildCrosswordInput(
  cellKeys: readonly string[],
  crossingValues: Readonly<Record<string, string>>,
  input: string,
  options: { values?: Readonly<Record<string, string>>; startIndex?: number; clearCount?: number } = {},
) {
  const characters = Array.from(input);
  const unfinishedIndex = characters.findIndex((character) => !/^[ぁ-ゖー]$/.test(character));
  const kana = characters.slice(0, unfinishedIndex < 0 ? undefined : unfinishedIndex);
  const pending = unfinishedIndex < 0 ? "" : characters.slice(unfinishedIndex).join("");
  const availableKeys = cellKeys.slice(options.startIndex ?? 0);
  const emptyKeys = availableKeys.filter((key) => !crossingValues[key]);
  // More kana than gaps means the user is entering the word from its first
  // cell. Otherwise, fill only the gaps supplied by the keyboard.
  const inputKeys = kana.length > emptyKeys.length ? availableKeys : emptyKeys;
  const values: Record<string, string> = { ...options.values };
  const clearCount = Math.max(options.clearCount ?? 0, kana.length);
  inputKeys.slice(0, clearCount).forEach((key) => {
    if (!crossingValues[key]) delete values[key];
  });
  cellKeys.forEach((key) => {
    if (crossingValues[key]) values[key] = crossingValues[key];
  });
  inputKeys.forEach((key, index) => {
    if (!crossingValues[key] && kana[index]) values[key] = kana[index];
  });
  const overflow = kana.length > availableKeys.length;
  const answer = !overflow && !pending && cellKeys.every((key) => Boolean(values[key]))
    ? cellKeys.map((key) => values[key]).join("")
    : null;
  const cursorKey = inputKeys.slice(kana.length).find((key) => !crossingValues[key])
    ?? emptyKeys[emptyKeys.length - 1] ?? null;
  return { values, answer, overflow, pending, cursorKey, clearCount };
}

export function eraseCrosswordCell(
  cellKeys: readonly string[],
  crossingValues: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
  cursorKey: string | null,
) {
  const index = Math.max(0, cellKeys.indexOf(cursorKey ?? ""));
  let target = index - (values[cellKeys[index]] ? 0 : 1);
  while (target >= 0 && crossingValues[cellKeys[target]]) target -= 1;
  const startIndex = target < 0 ? index : target;
  const next = { ...values };
  if (!crossingValues[cellKeys[startIndex]]) delete next[cellKeys[startIndex]];
  return { values: next, startIndex };
}
