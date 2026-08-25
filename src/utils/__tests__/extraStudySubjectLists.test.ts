import {
  getExtraStudyCandidateSubjectIds,
  parseSelectedListIds,
  subjectMatchesExtraStudyLevel,
  subjectMatchesExtraStudySrsStage,
} from "../extraStudySubjectLists";

describe("extraStudySubjectLists", () => {
  it("parses a comma-separated route parameter", () => {
    expect(parseSelectedListIds("list-a, list-b,list-a")).toEqual([
      "list-a",
      "list-b",
    ]);
  });

  it("continues to accept stored arrays", () => {
    expect(parseSelectedListIds(["list-a", "", "list-b"])).toEqual([
      "list-a",
      "list-b",
    ]);
  });

  it("uses selected list subjects instead of unlocked assignments", () => {
    expect(
      getExtraStudyCandidateSubjectIds(
        [{ data: { subject_id: 1 } }, { data: { subject_id: 2 } }],
        ["grammar"],
        new Set([2, 60]),
      ),
    ).toEqual([2, 60]);
  });

  it("keeps assignment subjects as the default candidate source", () => {
    expect(
      getExtraStudyCandidateSubjectIds(
        [
          { data: { subject_id: 2 } },
          { data: { subject_id: 2 } },
          { data: { subject_id: 3 } },
        ],
        [],
        new Set(),
      ),
    ).toEqual([2, 3]);
  });

  it("bypasses only the default level cap for selected lists", () => {
    expect(
      subjectMatchesExtraStudyLevel(50, {
        useCustomLevelRange: false,
        minLevel: 1,
        maxLevel: 4,
        selectedListIds: ["grammar"],
        defaultMaxLevel: 4,
      }),
    ).toBe(true);

    expect(
      subjectMatchesExtraStudyLevel(50, {
        useCustomLevelRange: true,
        minLevel: 1,
        maxLevel: 4,
        selectedListIds: ["grammar"],
        defaultMaxLevel: 4,
      }),
    ).toBe(false);
  });

  it("includes selected list subjects without an SRS assignment", () => {
    const stages = new Map([[2, 5], [59, 0]]);
    const selectedSubjectIds = new Set([2, 59, 60]);
    const apprenticeOnly = (stage: number) => stage >= 1 && stage <= 4;

    expect(
      subjectMatchesExtraStudySrsStage(
        60,
        stages,
        ["grammar"],
        selectedSubjectIds,
        apprenticeOnly,
      ),
    ).toBe(true);
    expect(
      subjectMatchesExtraStudySrsStage(
        59,
        stages,
        ["grammar"],
        selectedSubjectIds,
        apprenticeOnly,
      ),
    ).toBe(true);
    expect(
      subjectMatchesExtraStudySrsStage(
        2,
        stages,
        ["grammar"],
        selectedSubjectIds,
        apprenticeOnly,
      ),
    ).toBe(false);
  });
});
