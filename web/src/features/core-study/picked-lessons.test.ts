import { describe, expect, it } from "vitest";
import { loadPickedLessons, pickedLessonsKey, pickedLessonBatch, savePickedLessons } from "./picked-lessons";

describe("picked lesson batches", () => {
  it("uses the configured batch size without changing selection order", () => {
    expect(pickedLessonBatch([6, 3, 1, 2, 4, 5], [1, 2, 3, 4, 5, 6], 3, Infinity)).toEqual([6, 3, 1]);
  });
  it("respects the daily allowance and skips unavailable lessons", () => {
    expect(pickedLessonBatch([6, 3, 1, 2, 4, 5], [1, 2, 3, 4, 5], 3, 2)).toEqual([3, 1]);
    expect(pickedLessonBatch([1], [1], 3, 0)).toEqual([]);
  });
  it("restores the remaining selection after completing a batch", () => {
    savePickedLessons(localStorage, "picker-test", [4, 5, 6]);
    expect(loadPickedLessons(localStorage, "picker-test")).toEqual([4, 5, 6]);
    expect(pickedLessonBatch(loadPickedLessons(localStorage, "picker-test")!, [2, 4, 5, 6], 2, Infinity)).toEqual([4, 5]);
    savePickedLessons(localStorage, "picker-test", []);
    expect(loadPickedLessons(localStorage, "picker-test")).toBeNull();
  });
});

it("does not retain inactive or invalid picked queues indefinitely", () => {
  for (const savedAt of [Date.now() - 2 * 60 * 60_000, Date.now() + 60_000, "invalid"]) {
    localStorage.setItem(pickedLessonsKey("expiry-test"), JSON.stringify({ subjectIds: [1, 2], savedAt }));
    expect(loadPickedLessons(localStorage, "expiry-test")).toBeNull();
  }
});
