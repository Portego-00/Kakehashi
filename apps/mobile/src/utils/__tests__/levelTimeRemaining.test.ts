import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Assignment, Subject } from "../api";
import { calculateLevelTimeRemaining, formatTimeInterval } from "../levelProgress";

type TestAssignment = Assignment & { subject?: Subject; isLocked?: boolean };

const NOW = new Date("2026-02-23T10:34:00.000Z");

function makeSubject(
  id: number,
  level: number,
  object: "radical" | "kanji" | "vocabulary" = "kanji"
): Subject {
  return {
    id,
    object,
    data: {
      level,
      hidden_at: null,
    },
  } as Subject;
}

function makeAssignment({
  id,
  subjectId,
  subjectType,
  srsStage,
  availableAt,
  unlockedAt = "2026-02-20T00:00:00.000Z",
  startedAt = "2026-02-20T00:00:00.000Z",
  passedAt = null,
  burnedAt = null,
  isLocked = false,
  subject,
}: {
  id: number;
  subjectId: number;
  subjectType: "radical" | "kanji" | "vocabulary";
  srsStage: number;
  availableAt: string | null;
  unlockedAt?: string | null;
  startedAt?: string | null;
  passedAt?: string | null;
  burnedAt?: string | null;
  isLocked?: boolean;
  subject?: Subject;
}): TestAssignment {
  return {
    id,
    object: "assignment",
    url: `https://api.wanikani.com/v2/assignments/${id}`,
    data_updated_at: NOW.toISOString(),
    data: {
      created_at: NOW.toISOString(),
      subject_id: subjectId,
      subject_type: subjectType,
      srs_stage: srsStage,
      unlocked_at: unlockedAt,
      started_at: startedAt,
      passed_at: passedAt,
      burned_at: burnedAt,
      available_at: availableAt,
      resurrected_at: null,
      hidden: false,
    },
    subject,
    isLocked,
  };
}

describe("calculateLevelTimeRemaining", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns exact finish date when required kanji are all unlocked", () => {
    const radical = makeSubject(1, 10, "radical");
    const kanjiA = makeSubject(2, 10, "kanji");
    const kanjiB = makeSubject(3, 10, "kanji");

    const assignments: TestAssignment[] = [
      makeAssignment({
        id: 1,
        subjectId: radical.id,
        subjectType: "radical",
        srsStage: 4,
        availableAt: "2026-02-23T12:00:00.000Z",
        subject: radical,
      }),
      makeAssignment({
        id: 2,
        subjectId: kanjiA.id,
        subjectType: "kanji",
        srsStage: 3,
        availableAt: "2026-02-23T13:00:00.000Z",
        subject: kanjiA,
      }),
      makeAssignment({
        id: 3,
        subjectId: kanjiB.id,
        subjectType: "kanji",
        srsStage: 2,
        availableAt: "2026-02-23T11:00:00.000Z",
        subject: kanjiB,
      }),
    ];

    const { finish, isEstimate } = calculateLevelTimeRemaining(assignments, []);

    expect(isEstimate).toBe(false);
    expect(finish.toISOString()).toBe("2026-02-26T09:00:00.000Z");
  });

  it("uses historical average when required kanji are still locked", () => {
    const radical = makeSubject(10, 10, "radical");
    const kanjiUnlocked = makeSubject(11, 10, "kanji");
    const kanjiLocked = makeSubject(12, 10, "kanji");

    const assignments: TestAssignment[] = [
      makeAssignment({
        id: 10,
        subjectId: radical.id,
        subjectType: "radical",
        srsStage: 2,
        availableAt: "2026-02-23T12:00:00.000Z",
        subject: radical,
      }),
      makeAssignment({
        id: 11,
        subjectId: kanjiUnlocked.id,
        subjectType: "kanji",
        srsStage: 4,
        availableAt: "2026-02-23T11:00:00.000Z",
        subject: kanjiUnlocked,
      }),
      makeAssignment({
        id: 12,
        subjectId: kanjiLocked.id,
        subjectType: "kanji",
        srsStage: 0,
        availableAt: null,
        unlockedAt: null,
        startedAt: null,
        isLocked: true,
        subject: kanjiLocked,
      }),
    ];

    const levelProgressions = [
      { timeSpentCurrent: 10 * 24 * 60 * 60 },
      { timeSpentCurrent: 12 * 24 * 60 * 60 },
      { timeSpentCurrent: 14 * 24 * 60 * 60 },
      { timeSpentCurrent: 4 * 24 * 60 * 60 },
    ];

    const { finish, isEstimate } = calculateLevelTimeRemaining(
      assignments,
      levelProgressions
    );

    expect(isEstimate).toBe(true);
    expect(finish.toISOString()).toBe("2026-03-04T10:34:00.000Z");
  });

  it("floors estimates to minimum apprentice-to-guru time for accelerated levels", () => {
    const acceleratedKanji = makeSubject(20, 1, "kanji");
    const assignments: TestAssignment[] = [
      makeAssignment({
        id: 20,
        subjectId: acceleratedKanji.id,
        subjectType: "kanji",
        srsStage: 0,
        availableAt: null,
        unlockedAt: null,
        startedAt: null,
        isLocked: true,
        subject: acceleratedKanji,
      }),
    ];

    const { finish, isEstimate } = calculateLevelTimeRemaining(assignments, [
      { timeSpentCurrent: 100 * 60 * 60 },
    ]);

    expect(isEstimate).toBe(true);
    expect(finish.toISOString()).toBe("2026-02-24T23:34:00.000Z");
  });

  it("ignores excluded historical levels for locked-kanji estimates", () => {
    const lockedKanji = makeSubject(30, 5, "kanji");
    const assignments: TestAssignment[] = [
      makeAssignment({
        id: 30,
        subjectId: lockedKanji.id,
        subjectType: "kanji",
        srsStage: 0,
        availableAt: null,
        unlockedAt: null,
        startedAt: null,
        isLocked: true,
        subject: lockedKanji,
      }),
    ];

    const levelProgressions = [
      { data: { level: 1, timeSpentCurrent: 10 * 24 * 60 * 60 } },
      { data: { level: 2, timeSpentCurrent: 12 * 24 * 60 * 60 } },
      { data: { level: 3, timeSpentCurrent: 120 * 24 * 60 * 60 } },
      { data: { level: 4, timeSpentCurrent: 14 * 24 * 60 * 60 } },
      { data: { level: 5, timeSpentCurrent: 4 * 24 * 60 * 60 } },
    ];

    const { finish, isEstimate } = calculateLevelTimeRemaining(
      assignments,
      levelProgressions,
      [],
      { currentLevel: 5, excludedLevels: [3] }
    );

    expect(isEstimate).toBe(true);
    expect(finish.toISOString()).toBe("2026-03-04T10:34:00.000Z");
  });
});

describe("formatTimeInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("hides minutes while there are hours remaining", () => {
    expect(
      formatTimeInterval(new Date(NOW.getTime() + (2 * 60 * 60 + 30 * 60) * 1000))
    ).toBe("2h");
  });

  it("shows minutes when less than one hour remains", () => {
    expect(formatTimeInterval(new Date(NOW.getTime() + 30 * 60 * 1000))).toBe(
      "30m"
    );
  });

  it("shows days and hours for long intervals", () => {
    expect(
      formatTimeInterval(
        new Date(NOW.getTime() + (24 * 60 * 60 + 2 * 60 * 60 + 10 * 60) * 1000)
      )
    ).toBe("1d 2h");
  });
});
