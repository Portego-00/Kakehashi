import { describe, expect, it } from "vitest";
import { analyticsCsv, analyticsKanjiShareLayout, buildAnalyticsShareModel, csvCell, projectionsCalendar, type AnalyticsShareOptions } from "./analytics-export";
import { calculateAnalyticsInsights } from "./analytics-insights";
import { analyticsTestNow, testAssignment, testSubject } from "./analytics-test-fixtures";

const shareOptions: AnalyticsShareOptions = { username: "Learner", level: 12, hideUsername: false, hideDays: false, startedAt: "2026-01-01", theme: "light", format: "stats" };

describe("analytics exports", () => {
  it("keeps unavailable review values empty rather than reporting zero", () => {
    const insights = calculateAnalyticsInsights({ subjects: [testSubject(1)], assignments: [testAssignment(1)], statistics: [], progressions: [], now: analyticsTestNow, days: 10, reviewHistoryAvailable: false });
    const output = analyticsCsv(insights);
    expect(output).toContain('"2026-09-01","1","0","","",""');
    expect(output).not.toContain("undefined");
  });
  it("escapes quotes, newlines and spreadsheet formula prefixes", () => {
    expect(csvCell('a "quote", here')).toBe('"a ""quote"", here"');
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
    expect(csvCell("line\nnext")).toBe('"line\nnext"');
  });
  it("exports projected milestones as transparent all-day events on their displayed local dates", () => {
    const localDate = new Date(2027, 4, 2, 0, 30);
    const calendar = projectionsCalendar([{ level: 30, date: localDate.toISOString(), status: "projected", daysFromNow: 200 }, { level: 20, date: "2026-01-01", status: "reached", daysFromNow: 0 }], analyticsTestNow);
    expect(calendar).toContain("DTSTART;VALUE=DATE:20270502");
    expect(calendar).toContain("SUMMARY:WaniKani level 30 (estimated)");
    expect(calendar).toContain("TRANSP:TRANSPARENT");
    expect(calendar).not.toContain("level 20");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("uses the same source counts and privacy rules for every image format", () => {
    const subjects = [testSubject(1), testSubject(2), testSubject(3, "kanji", { hidden_at: "2026-09-01" }), testSubject(4)];
    const assignments = [testAssignment(1, { srs_stage: 5 }), testAssignment(2, { srs_stage: 9 }), testAssignment(3, { srs_stage: 9 }), testAssignment(4, { srs_stage: 9, hidden: true })];
    const insights = calculateAnalyticsInsights({ subjects, assignments, statistics: [], progressions: [], now: analyticsTestNow });
    for (const format of ["stats", "kanji", "activity"] as const) {
      const model = buildAnalyticsShareModel(insights, { ...shareOptions, format, hideUsername: true, hideDays: true }, subjects, assignments, analyticsTestNow);
      expect(model.snapshot.learnedGuruKanji).toBe(2);
      expect(model.snapshot).not.toHaveProperty("username");
      expect(model.snapshot).not.toHaveProperty("daysStudying");
      expect(model.snapshot.capturedAt).toBe(analyticsTestNow.toISOString());
      expect(model.kanji.map((item) => item.stage)).toEqual([5, 9, 0]);
    }
  });

  it("fits all kanji in an adaptive grid without a fixed empty lower half", () => {
    for (const count of [0, 50, 742, 2200, 3000]) {
      const layout = analyticsKanjiShareLayout(count);
      expect(layout.columns).toBeLessThanOrEqual(60);
      expect(layout.fontSize).toBeGreaterThanOrEqual(18);
      const lastBaseline = 482 + Math.max(0, Math.ceil(count / layout.columns) - 1) * layout.rowHeight;
      expect(lastBaseline).toBeLessThan(layout.height - 136);
      expect(layout.columns * layout.cellWidth).toBe(1296);
    }
    expect(analyticsKanjiShareLayout(50).height).toBeLessThan(1000);
    expect(analyticsKanjiShareLayout(742).fontSize).toBeGreaterThan(30);
  });

  it("aligns calendar dates to weekdays and avoids overlapping partial-month headings", () => {
    const insights = calculateAnalyticsInsights({ subjects: [], assignments: [], statistics: [], progressions: [], now: new Date(2026, 9, 29, 12), days: 30 });
    const model = buildAnalyticsShareModel(insights, shareOptions, [], [], analyticsTestNow);
    expect(model.calendar[0].date.getDate()).toBe(30);
    expect(model.calendar[0].row).toBe(3);
    expect(model.calendar[1].row).toBe(4);
    expect(model.calendar[0].column).toBe(model.calendar[1].column);
    expect(model.calendarMonths.map((month) => month.date.getMonth())).toEqual([9]);
    expect(model.calendarMonths.map((month) => month.column)).toEqual([0]);
  });
});
