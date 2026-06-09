import {
  isSubjectListItemSortMode,
  sortSubjectListItems,
} from "../subjectListItemSorting";
import { Subject } from "../api";

function makeSubject(
  id: number,
  level: number,
  object: string,
  meaning: string,
  characters: string | null = null
): Subject {
  return {
    id,
    object,
    data: {
      level,
      characters,
      meanings: [{ meaning, primary: true }],
    },
  } as unknown as Subject;
}

describe("subject list item sorting", () => {
  const radical = makeSubject(1, 3, "radical", "Ground", "一");
  const kanji = makeSubject(2, 2, "kanji", "Person", "人");
  const vocabulary = makeSubject(3, 2, "vocabulary", "Apple", "りんご");
  const orderIndex = new Map([
    [radical.id, 0],
    [kanji.id, 1],
    [vocabulary.id, 2],
  ]);

  it("sorts newest-added items by reverse selected order", () => {
    const sorted = sortSubjectListItems(
      [radical, kanji, vocabulary],
      "addedDesc",
      orderIndex,
      new Map()
    );

    expect(sorted.map((subject) => subject.id)).toEqual([3, 2, 1]);
  });

  it("keeps the existing level-low-high order as the default sort", () => {
    const sorted = sortSubjectListItems(
      [radical, vocabulary, kanji],
      "levelAsc",
      orderIndex,
      new Map()
    );

    expect(sorted.map((subject) => subject.id)).toEqual([2, 3, 1]);
  });

  it("sorts by SRS stage with WaniKani order as the tie-breaker", () => {
    const sorted = sortSubjectListItems(
      [radical, kanji, vocabulary],
      "srsDesc",
      orderIndex,
      new Map([
        [radical.id, 4],
        [kanji.id, 7],
        [vocabulary.id, 7],
      ])
    );

    expect(sorted.map((subject) => subject.id)).toEqual([2, 3, 1]);
  });

  it("recognizes only supported cached sort modes", () => {
    expect(isSubjectListItemSortMode("addedDesc")).toBe(true);
    expect(isSubjectListItemSortMode("createdDesc")).toBe(false);
  });
});
