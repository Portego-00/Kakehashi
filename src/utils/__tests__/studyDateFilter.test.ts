import { createStudyDateFilter, localStudyDate, matchesStudyDate, parseStudyDate, sanitizeStudyDateFilter, studyDateBounds, studyDateRange } from "../studyDateFilter";

const now = new Date(2026, 9, 22, 12);
const assignment = (started_at: string | null, unlocked_at: string | null = null) => ({ data: { started_at, unlocked_at } });

describe("Custom Review study dates", () => {
  it("defaults both date pickers to seven days and resolves older relative settings", () => {
    for (const field of ["started_at", "unlocked_at"] as const) {
      expect(studyDateRange(createStudyDateFilter(field, now), now)).toEqual({ field, period: "custom", from: "2026-10-16", to: "2026-10-22" });
      expect(studyDateRange({ field, period: "7d", from: "2020-01-01", to: "2020-01-07" }, now)).toEqual({ field, period: "custom", from: "2026-10-16", to: "2026-10-22" });
    }
  });
  it("distinguishes lesson completion from unlocking, including unstarted items", () => {
    const filter = { ...createStudyDateFilter("started_at", now), period: "today" as const };
    const item = assignment(new Date(2026, 9, 21, 9).toISOString(), new Date(2026, 9, 22, 8).toISOString());
    expect(matchesStudyDate(item, filter, now)).toBe(false);
    expect(matchesStudyDate(item, { ...filter, field: "unlocked_at" }, now)).toBe(true);
    expect(matchesStudyDate(assignment(null, item.data.unlocked_at), filter, now)).toBe(false);
    expect(matchesStudyDate(assignment(null, item.data.unlocked_at), { ...filter, field: "unlocked_at" }, now)).toBe(true);
    expect(matchesStudyDate(undefined, null, now)).toBe(true);
    expect(matchesStudyDate(undefined, filter, now)).toBe(false);
  });

  it("uses inclusive local dates and excludes missing, hidden, invalid and future events", () => {
    const filter = { ...createStudyDateFilter("started_at", now), period: "custom" as const, from: "2026-10-20", to: "2026-10-21" };
    expect(matchesStudyDate(assignment(new Date(2026, 9, 20, 0).toISOString()), filter, now)).toBe(true);
    expect(matchesStudyDate(assignment(new Date(2026, 9, 21, 23, 59, 59, 999).toISOString()), filter, now)).toBe(true);
    expect(matchesStudyDate(assignment(new Date(2026, 9, 22, 0).toISOString()), filter, now)).toBe(false);
    expect(matchesStudyDate(assignment("invalid"), filter, now)).toBe(false);
    expect(matchesStudyDate({ data: { started_at: new Date(2026, 9, 20, 0).toISOString(), hidden: true } }, filter, now)).toBe(false);
    expect(matchesStudyDate(assignment(new Date(2026, 9, 22, 13).toISOString()), { ...filter, period: "today" }, now)).toBe(false);
  });

  it("includes today in recent periods and follows calendar days across daylight saving", () => {
    const filter = createStudyDateFilter("started_at", now);
    expect(localStudyDate(studyDateBounds(filter, now).from)).toBe("2026-10-16");
    expect(localStudyDate(studyDateBounds({ ...filter, period: "yesterday" }, now).from)).toBe("2026-10-21");
    const dstNow = new Date(2026, 2, 30, 12);
    const bounds = studyDateBounds({ ...filter, period: "yesterday" }, dstNow);
    expect(bounds.from).toEqual(new Date(2026, 2, 29));
    expect(bounds.to).toEqual(new Date(2026, 2, 30));
  });

  it("rejects invalid dates and corrupt saved filters", () => {
    const filter = createStudyDateFilter("started_at", now);
    expect(sanitizeStudyDateFilter(filter)).toEqual(filter);
    expect(parseStudyDate("2026-02-30")).toBeNull();
    expect(sanitizeStudyDateFilter({ ...filter, field: "data_updated_at" })).toBeNull();
    expect(sanitizeStudyDateFilter({ ...filter, from: "2026-10-23" })).toBeNull();
    expect(sanitizeStudyDateFilter({ ...filter, period: "invalid" })).toBeNull();
  });
});
