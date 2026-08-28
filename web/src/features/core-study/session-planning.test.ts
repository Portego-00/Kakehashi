import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { coreSessionKey, lessonsStartedToday, orderCoreAssignments, recordLessonStarted, selectCoreAssignments } from "./session-planning";

function assignment(id: number, type: Assignment["data"]["subject_type"], stage = 1, availableAt = "2026-03-05T08:00:00.000Z"): Assignment {
  return { id, object: "assignment", url: "", data_updated_at: "", data: { subject_id: id, subject_type: type, srs_stage: stage, available_at: availableAt, started_at: "2026-01-01T00:00:00Z", unlocked_at: `2026-01-${String(Math.min(id, 28)).padStart(2, "0")}T00:00:00Z`, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
}
function subject(id: number, level: number, object: SubjectType = "kanji"): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level, created_at: "", slug: String(id), document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], readings: object === "radical" ? undefined : [] } };
}
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("core session planning", () => {
  it("orders lessons by subject level and reviews by SRS stage", () => {
    const rows = [assignment(1, "vocabulary", 4), assignment(2, "radical", 1)];
    expect(orderCoreAssignments(rows, [subject(1, 3), subject(2, 1)], "lessons", { ...DEFAULT_WEB_SETTINGS.study, lessonOrder: "level" }).map((row) => row.id)).toEqual([2, 1]);
    expect(orderCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "ascendingSrsStage" }).map((row) => row.id)).toEqual([2, 1]);
  });

  it("orders the complete eligible review set before applying the batch cap", () => {
    const rows = Array.from({ length: 300 }, (_, index) => assignment(index + 1, "kanji", index === 299 ? 1 : 7));
    const selected = selectCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "ascendingSrsStage", reviewBatchSizeEnabled: true }, 10);
    expect(selected).toHaveLength(10);
    expect(selected[0].id).toBe(300);
  });

  it.each([
    ["random", [2, 3, 1]],
    ["ascendingSrsStage", [1, 3, 2]],
    ["descendingSrsStage", [2, 3, 1]],
    ["currentLevelFirst", [1, 3, 2]],
    ["lowestLevelFirst", [2, 3, 1]],
    ["newestAvailableFirst", [2, 1, 3]],
    ["oldestAvailableFirst", [3, 1, 2]],
    ["longestRelativeWait", [1, 3, 2]],
  ] as const)("supports the %s mobile review order", (reviewOrder, expectedIds) => {
    const rows = [
      assignment(1, "radical", 2, "2026-03-05T08:00:00.000Z"),
      assignment(2, "kanji", 6, "2026-03-05T10:00:00.000Z"),
      assignment(3, "vocabulary", 4, "2026-03-05T06:00:00.000Z"),
    ];
    const subjects = [subject(1, 5, "radical"), subject(2, 2), subject(3, 4, "vocabulary")];

    const ordered = orderCoreAssignments(rows, subjects, "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder }, {
      now: new Date("2026-03-05T12:00:00.000Z"),
      randomFn: () => 0,
      userLevel: 5,
    });

    expect(ordered.map((row) => row.id)).toEqual([...expectedIds]);
  });

  it("groups reviews by the custom subject-type order before sorting within each group", () => {
    const rows = [
      assignment(1, "kanji", 1),
      assignment(2, "radical", 2),
      assignment(3, "vocabulary", 4),
      assignment(4, "kana_vocabulary", 1),
      assignment(5, "vocabulary", 2),
    ];
    const subjects = [subject(1, 1), subject(2, 1, "radical"), subject(3, 1, "vocabulary"), subject(4, 1, "kana_vocabulary"), subject(5, 1, "vocabulary")];

    const ordered = orderCoreAssignments(rows, subjects, "reviews", {
      ...DEFAULT_WEB_SETTINGS.study,
      reviewOrder: "ascendingSrsStage",
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["vocabulary", "radical", "kanji"],
    });

    expect(ordered.map((row) => row.id)).toEqual([4, 5, 3, 2, 1]);
  });

  it("prioritizes current-level apprentice radicals and kanji before the selected order", () => {
    const rows = [
      assignment(1, "radical", 1),
      assignment(2, "radical", 2),
      assignment(3, "kanji", 4),
      assignment(4, "kanji", 5),
      assignment(5, "vocabulary", 1),
    ];
    const subjects = [subject(1, 9, "radical"), subject(2, 10, "radical"), subject(3, 10), subject(4, 10), subject(5, 10, "vocabulary")];

    const ordered = orderCoreAssignments(rows, subjects, "reviews", {
      ...DEFAULT_WEB_SETTINGS.study,
      reviewOrder: "lowestLevelFirst",
      prioritizeCriticalItems: true,
    }, { userLevel: 10 });

    expect(ordered.map((row) => row.id)).toEqual([2, 3, 1, 4, 5]);
  });

  it("uses a shuffled rank as the final tie-break after the review order", () => {
    const rows = [assignment(1, "kanji"), assignment(2, "kanji"), assignment(3, "kanji")];
    const subjects = [subject(1, 1), subject(2, 1), subject(3, 1)];

    const ordered = orderCoreAssignments(rows, subjects, "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "ascendingSrsStage" }, { randomFn: () => 0 });

    expect(ordered.map((row) => row.id)).toEqual([2, 3, 1]);
  });

  it("loads every eligible review when review batch sizing is disabled", () => {
    const rows = Array.from({ length: 60 }, (_, index) => assignment(index + 1, "kanji"));

    expect(selectCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewBatchSizeEnabled: false }, 10)).toHaveLength(60);
    expect(selectCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewBatchSizeEnabled: true }, 10)).toHaveLength(10);
  });

  it("scopes resumable core sessions to the account", () => {
    expect(coreSessionKey("User One", "reviews")).not.toBe(coreSessionKey("User Two", "reviews"));
    expect(coreSessionKey(" User One ", "reviews")).toBe(coreSessionKey("user one", "reviews"));
  });

  it("tracks the local daily lesson limit without double-counting", () => {
    const storage = memoryStorage();
    const now = new Date("2026-01-03T12:00:00");
    recordLessonStarted(storage, "Pozab", 1, now);
    recordLessonStarted(storage, "Pozab", 1, now);
    recordLessonStarted(storage, "Pozab", 2, now);
    expect(lessonsStartedToday(storage, "pozab", now)).toBe(2);
  });
});
