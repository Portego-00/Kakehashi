import { describe, expect, it } from "vitest";
import { isLessonAvailable, isReviewAvailable, scheduleSummary, srsBuckets } from "./dashboard-data";
import type { Assignment } from "@/types/wanikani";

function assignment(data: Partial<Assignment["data"]>): Assignment { return { id: 1, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 1, subject_type: "kanji", srs_stage: 0, available_at: null, started_at: null, unlocked_at: null, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "", ...data } }; }
describe("dashboard assignment state", () => {
  it("separates lessons and currently available reviews", () => {
    const lesson = assignment({ unlocked_at: "2026-01-01T00:00:00Z" });
    const review = assignment({ started_at: "2026-01-01T00:00:00Z", srs_stage: 2, available_at: "2026-01-01T04:00:00Z" });
    expect(isLessonAvailable(lesson)).toBe(true);
    expect(isReviewAvailable(review, new Date("2026-01-01T05:00:00Z"))).toBe(true);
  });
  it("makes both core study queues unavailable for the whole vacation", () => {
    const vacationStartedAt = "2026-01-01T02:00:00Z";
    const lesson = assignment({ unlocked_at: "2026-01-01T00:00:00Z" });
    const review = assignment({ started_at: "2026-01-01T00:00:00Z", srs_stage: 2, available_at: "2026-01-01T04:00:00Z" });
    expect(isLessonAvailable(lesson, vacationStartedAt)).toBe(false);
    expect(isReviewAvailable(review, new Date("2026-01-01T05:00:00Z"), vacationStartedAt)).toBe(false);
  });
  it("buckets active assignments by WaniKani SRS stage", () => {
    expect(srsBuckets([assignment({ started_at: "x", srs_stage: 4 }), assignment({ started_at: "x", srs_stage: 7 }), assignment({ started_at: "x", srs_stage: 9 })])).toEqual({ apprentice: 1, guru: 0, master: 1, enlightened: 0, burned: 1 });
  });
  it("describes ready reviews instead of a past next-review time", () => {
    expect(scheduleSummary(27, "2026-01-01T04:00:00Z", new Date("2026-01-01T05:00:00Z"))).toBe("27 reviews ready now");
    expect(scheduleSummary(0, "2026-01-01T06:00:00Z", new Date("2026-01-01T05:00:00Z"))).toBe("next review in 60 minutes");
  });
});
