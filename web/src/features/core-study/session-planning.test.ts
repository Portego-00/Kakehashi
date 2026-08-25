import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { Assignment, Subject } from "@/types/wanikani";
import { coreSessionKey, lessonsStartedToday, orderCoreAssignments, recordLessonStarted, selectCoreAssignments } from "./session-planning";

function assignment(id: number, type: Assignment["data"]["subject_type"], stage = 1): Assignment {
  return { id, object: "assignment", url: "", data_updated_at: "", data: { subject_id: id, subject_type: type, srs_stage: stage, available_at: `2026-01-0${id}T00:00:00Z`, started_at: "2026-01-01T00:00:00Z", unlocked_at: `2026-01-0${id}T00:00:00Z`, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
}
function subject(id: number, level: number): Subject {
  return { id, object: "kanji", url: "", data_updated_at: "", data: { level, created_at: "", slug: String(id), document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], readings: [] } };
}
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("core session planning", () => {
  it("orders lessons by subject level and reviews by SRS stage", () => {
    const rows = [assignment(1, "vocabulary", 4), assignment(2, "radical", 1)];
    expect(orderCoreAssignments(rows, [subject(1, 3), subject(2, 1)], "lessons", { ...DEFAULT_WEB_SETTINGS.study, lessonOrder: "level" }).map((row) => row.id)).toEqual([2, 1]);
    expect(orderCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "srs" }).map((row) => row.id)).toEqual([2, 1]);
  });

  it("orders the complete eligible review set before applying the batch cap", () => {
    const rows = Array.from({ length: 300 }, (_, index) => assignment(index + 1, "kanji", index === 299 ? 1 : 7));
    const selected = selectCoreAssignments(rows, [], "reviews", { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "srs" }, 10);
    expect(selected).toHaveLength(10);
    expect(selected[0].id).toBe(300);
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
