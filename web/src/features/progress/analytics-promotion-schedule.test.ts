import { describe, expect, it } from "vitest";
import { calculateFastestLevelRoute, calculateSrsPromotions, fastestRouteCalendar } from "./analytics-promotion-schedule";
import { analyticsTestNow as now, analyticsTestSystems as systems, testAssignment as assignment, testSubject as subject } from "./analytics-test-fixtures";

describe("conditional SRS schedules", () => {
  it("plans only the kanji needed for 90 percent and deduplicates shared radical sessions", () => {
    const kanji = Array.from({ length: 10 }, (_, index) => subject(index + 1, "kanji", { component_subject_ids: [20] }));
    const passed = Array.from({ length: 7 }, (_, index) => assignment(index + 1, { srs_stage: 5, passed_at: "2026-09-01T00:00:00Z" }));
    const route = calculateFastestLevelRoute({ assignments: [...passed, assignment(20, { subject_type: "radical", srs_stage: 4 })], subjects: [...kanji, subject(20, "radical")], systems, currentLevel: 3, now });
    expect(route).toMatchObject({ available: true, requiredKanji: 9, passedKanji: 7, focusSubjectIds: [8, 9], reviewCount: 9, lessonCount: 2, earliestLevelUpAt: "2026-09-13T22:00:00.000Z" });
    expect(route.sessions[0]).toMatchObject({ at: now.toISOString(), reviewSubjectIds: [20], lessonSubjectIds: [8, 9] });
    expect(route.sessions.at(-1)).toMatchObject({ passedKanji: 9, completesLevel: true, reviewSubjectIds: [8, 9] });
    expect(route.sessions.flatMap((session) => session.actions).filter((action) => action.subjectId === 20)).toHaveLength(1);
    const calendar = fastestRouteCalendar(route, now);
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("DTSTART:20260910T120000Z");
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(route.sessions.length);
  });

  it("does not require passed radicals to regain Guru after demotion", () => {
    const route = calculateFastestLevelRoute({ assignments: [assignment(1, { srs_stage: 0, started_at: null }), assignment(20, { subject_type: "radical", srs_stage: 1, passed_at: "2026-09-01T00:00:00Z" })], subjects: [subject(1, "kanji", { component_subject_ids: [20] }), subject(20, "radical")], systems, currentLevel: 3, now });
    expect(route.reviewCount).toBe(4);
    expect(route.sessions.flatMap((session) => session.reviewSubjectIds)).not.toContain(20);
  });

  it("leaves unavailable or final-level routes unscheduled", () => {
    const input = { assignments: [assignment(1)], subjects: [subject(1)], systems: [], currentLevel: 3, now };
    expect(calculateFastestLevelRoute(input)).toMatchObject({ available: false, sessions: [] });
    expect(calculateFastestLevelRoute({ ...input, systems, currentLevel: 60 })).toMatchObject({ available: false, sessions: [] });
  });

  it("includes multiple tier changes using exact configured review intervals", () => {
    const input = { assignments: [assignment(1, { srs_stage: 6 }), assignment(2, { srs_stage: 8 }), assignment(3, { srs_stage: 9 }), assignment(4, { hidden: true })], subjects: [subject(1), subject(2), subject(3), subject(4)], systems, now };
    const oneDay = calculateSrsPromotions({ ...input, horizonDays: 1 });
    expect(oneDay.map((event) => `${event.subject.id}:${event.to}`)).toEqual(["1:Master", "2:Burned"]);
    const month = calculateSrsPromotions({ ...input, horizonDays: 30 });
    expect(month.map((event) => `${event.subject.id}:${event.to}`)).toEqual(["1:Master", "2:Burned", "1:Enlightened"]);
    expect(month.at(-1)?.at).toBe("2026-10-10T11:00:00.000Z");
  });

  it("never infers promotions for unstarted lessons or missing systems", () => {
    expect(calculateSrsPromotions({ assignments: [assignment(1, { srs_stage: 0 })], subjects: [subject(1)], systems, now })).toEqual([]);
    expect(calculateSrsPromotions({ assignments: [assignment(1)], subjects: [subject(1)], systems: [], now })).toEqual([]);
  });

  it("rounds subsequent scheduled reviews down to the hour without rounding the known first due time", () => {
    const due = "2026-09-10T12:37:00.000Z";
    const input = { assignments: [assignment(1, { srs_stage: 3, available_at: due })], subjects: [subject(1)], systems, now };
    const route = calculateFastestLevelRoute({ ...input, currentLevel: 3 });
    expect(route.sessions.map((session) => session.at)).toEqual([due, "2026-09-12T11:00:00.000Z"]);
    expect(route.sessions[0].actions[0]).toMatchObject({ startingStage: 3, endingStage: 4, isKanjiPass: false });
    expect(route.sessions[1].actions[0]).toMatchObject({ startingStage: 4, endingStage: 5, isKanjiPass: true });
    expect(calculateSrsPromotions({ ...input, horizonDays: 7 })[0].at).toBe(route.earliestLevelUpAt);
  });

  it("uses API intervals expressed in seconds and matches the documented 15:31 to 23:00 transition", () => {
    const secondsSystems = systems.map((system) => ({ ...system, data: { ...system.data, stages: system.data.stages.map((stage) => ({ ...stage, interval: stage.interval === null ? null : stage.interval * 3600, interval_unit: stage.interval === null ? null : "seconds" as const })) } }));
    const route = calculateFastestLevelRoute({ assignments: [assignment(1, { srs_stage: 1, available_at: "2026-09-10T15:31:00Z" })], subjects: [subject(1)], systems: secondsSystems, currentLevel: 3, now });
    expect(route.sessions[0].at).toBe("2026-09-10T15:31:00.000Z");
    expect(route.sessions[1].at).toBe("2026-09-10T23:00:00.000Z");
    expect(route.sessions.at(-1)?.at).toBe(route.earliestLevelUpAt);
  });

  it("flags only promotion opportunities from the current overdue review, not later modeled reviews", () => {
    const promotions = calculateSrsPromotions({ assignments: [assignment(1, { srs_stage: 4, available_at: "2026-09-01T10:15:00Z" }), assignment(2, { srs_stage: 6, available_at: "2026-09-10T13:00:00Z" })], subjects: [subject(1), subject(2)], systems, now, horizonDays: 30 });
    expect(promotions.find((event) => event.subject.id === 1 && event.to === "Guru")).toMatchObject({ at: now.toISOString(), overdue: true });
    expect(promotions.filter((event) => event.overdue)).toHaveLength(1);
    expect(promotions.find((event) => event.subject.id === 1 && event.to === "Master")).toMatchObject({ overdue: false });
    expect(promotions.find((event) => event.subject.id === 2)).toMatchObject({ overdue: false });
  });
});
