/** Merge an editor's additions/removals into the latest known synonyms. */
export function mergeMeaningSynonymEdits(
  current: readonly string[],
  original: readonly string[],
  edited: readonly string[]
): string[] {
  const originalSet = new Set(original);
  const editedSet = new Set(edited);
  const removed = new Set(original.filter((synonym) => !editedSet.has(synonym)));
  return Array.from(new Set([
    ...current.filter((synonym) => !removed.has(synonym)),
    ...edited.filter((synonym) => !originalSet.has(synonym)),
  ]));
}
