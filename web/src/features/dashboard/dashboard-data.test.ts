import { describe, expect, it } from "vitest";
import { assignmentActivityDays, burnedSubjectRows, criticalSubjectRows, incompleteLevelRows, isLessonAvailable, isReviewAvailable, levelTimingRows, levelWidgetSubjects, recentMistakeRows, recentUnlockRows, scheduleSummary, srsBuckets, srsStageSpread, todayStudyActivity, usageStreak } from "./dashboard-data";
import type { Assignment, LevelProgression, ReviewStatistic, Subject } from "@/types/wanikani";

function assignment(data: Partial<Assignment["data"]>): Assignment { return { id: 1, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 1, subject_type: "kanji", srs_stage: 0, available_at: null, started_at: null, unlocked_at: null, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "", ...data } }; }
function subject(id: number, level = 1): Subject { return { id, object: "kanji", url: "", data_updated_at: "", data: { level, created_at: "", slug: `kanji-${id}`, document_url: "", hidden_at: null, characters: `字${id}`, meanings: [{ meaning: `Meaning ${id}`, primary: true, accepted_answer: true }], auxiliary_meanings: [] } }; }
function statistic(data: Partial<ReviewStatistic["data"]>, updatedAt = "2026-08-24T12:00:00Z"): ReviewStatistic { return { id: 1, object: "review_statistic", url: "", data_updated_at: updatedAt, data: { subject_id: 1, subject_type: "kanji", meaning_correct: 8, meaning_incorrect: 2, meaning_max_streak: 5, meaning_current_streak: 0, reading_correct: 9, reading_incorrect: 1, reading_max_streak: 5, reading_current_streak: 1, percentage_correct: 85, hidden: false, created_at: "", ...data } }; }
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
  it("keeps all nine SRS stages and stacks them by subject type", () => {
    const rows = [
      assignment({ started_at: "x", srs_stage: 1, subject_type: "radical" }),
      { ...assignment({ started_at: "x", srs_stage: 1, subject_type: "kanji" }), id: 2 },
      { ...assignment({ started_at: "x", srs_stage: 9, subject_type: "kana_vocabulary" }), id: 3 },
    ];
    expect(srsStageSpread(rows)).toHaveLength(9);
    expect(srsStageSpread(rows)[0]).toMatchObject({ stage: 1, roman: "I", radical: 1, kanji: 1, vocabulary: 0, total: 2 });
    expect(srsStageSpread(rows)[8]).toMatchObject({ stage: 9, roman: "IX", vocabulary: 1, total: 1 });
  });
  it("describes ready reviews instead of a past next-review time", () => {
    expect(scheduleSummary(27, "2026-01-01T04:00:00Z", new Date("2026-01-01T05:00:00Z"))).toBe("27 reviews ready now");
    expect(scheduleSummary(0, "2026-01-01T06:00:00Z", new Date("2026-01-01T05:00:00Z"))).toBe("next review in 60 minutes");
  });
});

describe("mobile-parity dashboard derivations", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("builds recent mistakes, critical items, unlocks, and burns from live resources", () => {
    const subjects = [subject(1)];
    const rows = [assignment({ subject_id: 1, unlocked_at: "2026-08-20T10:00:00Z", burned_at: "2026-08-24T10:00:00Z" })];
    expect(recentMistakeRows([statistic({})], subjects, now)[0]).toMatchObject({ id: 1, value: 85 });
    expect(criticalSubjectRows([statistic({ percentage_correct: 42 })], subjects)[0]).toMatchObject({ id: 1, value: 42 });
    expect(recentUnlockRows(rows, subjects)[0].id).toBe(1);
    expect(burnedSubjectRows(rows, subjects, now)[0].id).toBe(1);
  });

  it("keeps the complete seven-day mistake batch for the horizontal widget rail", () => {
    const subjects = Array.from({ length: 9 }, (_, index) => subject(index + 1));
    const statistics = subjects.map((item) => statistic({ subject_id: item.id }));

    expect(recentMistakeRows(statistics, subjects, now)).toHaveLength(9);
  });

  it("finds incomplete previous levels", () => {
    const rows = [assignment({ subject_id: 1, srs_stage: 4 }), { ...assignment({ subject_id: 2, srs_stage: 5 }), id: 2 }];
    expect(incompleteLevelRows([subject(1, 2), subject(2, 2)], rows, 3)).toEqual([{
      level: 2,
      passed: 1,
      total: 2,
      radical: { passed: 0, total: 0 },
      kanji: { passed: 1, total: 2 },
      vocabulary: { passed: 0, total: 0 },
    }]);
  });

  it("builds the current-level radical and kanji tiles from real assignment stages", () => {
    const radical = { ...subject(1), object: "radical" as const, data: { ...subject(1).data, characters: null } };
    const rows = [assignment({ subject_id: 1, subject_type: "radical", srs_stage: 4 }), { ...assignment({ subject_id: 2, srs_stage: 2 }), id: 2 }];
    const levelSubjects = levelWidgetSubjects([radical, subject(2)], rows);
    expect(levelSubjects).toMatchObject([
      { id: 1, characters: "Me", meaning: "Meaning 1", type: "radical", stage: 4 },
      { id: 2, characters: "字2", meaning: "Meaning 2", type: "kanji", stage: 2 },
    ]);
    expect(levelSubjects[0].subject).toBe(radical);
  });

  it("derives activity, streak, and today's study without inventing review events", () => {
    const rows = [assignment({ started_at: "2026-08-23T10:00:00Z", srs_stage: 2 })];
    rows[0].data_updated_at = "2026-08-25T10:00:00Z";
    const activity = assignmentActivityDays(rows, 3, now);
    expect(activity.map((day) => day.count)).toEqual([1, 0, 1]);
    expect(usageStreak(activity)).toEqual({ current: 1, longest: 1 });
    expect(todayStudyActivity(rows, [statistic({}, "2026-08-25T11:00:00Z")], now)).toEqual({ lessons: 0, reviews: 1 });
  });

  it("builds full-year history for the heatmap year selector", () => {
    const rows = [assignment({ started_at: "2024-06-10T10:00:00Z", srs_stage: 2 })];
    rows[0].data_updated_at = "2026-08-25T10:00:00Z";

    const activity = assignmentActivityDays(rows, "all", now);

    expect(activity[0].key).toBe("2024-01-01");
    expect(activity.at(-1)?.key).toBe("2026-08-25");
  });

  it("calculates truthful level durations", () => {
    const progression: LevelProgression = { id: 1, object: "level_progression", url: "", data_updated_at: "", data: { level: 4, abandoned_at: null, completed_at: null, created_at: "2026-08-01T00:00:00Z", passed_at: "2026-08-08T00:00:00Z", started_at: "2026-08-01T00:00:00Z", unlocked_at: "2026-08-01T00:00:00Z" } };
    expect(levelTimingRows([progression], 5, now)).toEqual([{ level: 4, days: 7, current: false }]);
  });
});
