import fetchMock from "jest-fetch-mock";
import { allocateBunproTiles, bunproAnalyticsForecast, bunproAnalyticsSeries, bunproAnalyticsTotal, bunproCalendarDate, bunproReviewAccuracy, bunproReviewCalendar, formatBunproCalendarDate } from "../bunproAnalytics";
import { getBunproAnalytics, getBunproReviewActivity } from "../bunproApi";

describe("Bunpro analytics calculations", () => {
  it("keeps due-now separate from later/tomorrow forecast buckets", () => {
    const data = { grammar: { later: 4, tomorrow: 6, "2026-09-24": 10 }, vocab: { later: 0, tomorrow: 1, "2026-09-24": 3 } };
    expect(bunproAnalyticsForecast(data).map(row => [row.label, row.grammar, row.vocab])).toEqual([["Later today", 4, 0], ["Tomorrow", 6, 1], ["Sep 24", 10, 3]]);
  });
  it("preserves unknown series values and valid zero counts", () => {
    expect(bunproAnalyticsTotal(0, 0, "all")).toBe(0);
    expect(bunproAnalyticsTotal(8, null, "all")).toBeNull();
    expect(bunproAnalyticsTotal(8, null, "grammar")).toBe(8);
    expect(bunproAnalyticsSeries({ grammar: { "2026-09-20": 0 }, vocab: {} })[0].vocab).toBeNull();
  });
  it("formats calendar dates without shifting them across time zones or DST", () => {
    expect(bunproCalendarDate("2026-02-30")).toBeNull();
    expect(bunproCalendarDate("later")).toBeNull();
    expect(formatBunproCalendarDate("2026-09-22", { weekday: "short", timeZone: "Pacific/Honolulu" })).toBe("Tue");
    expect(formatBunproCalendarDate("2026-03-29", { weekday: "short", timeZone: "Pacific/Kiritimati" })).toBe("Sun");
  });
  it("weights accuracy by answers instead of averaging JLPT percentages", () => {
    const data = { grammar: { N5: { total: 10, correct: 5, incorrect: 5, accuracy: 50 }, N4: { total: 90, correct: 90, incorrect: 0, accuracy: 100 } }, vocab: {} };
    expect(bunproReviewAccuracy(data, "grammar")).toEqual({ total: 100, correct: 95, accuracy: 95 });
    expect(bunproReviewAccuracy(data, "vocab")).toBeNull();
  });
  it("allocates honeycomb cells proportionally with an exact 200-cell total", () => {
    const counts = allocateBunproTiles([1, 1, 1]);
    expect(counts).toEqual([67, 67, 66]);
    expect(allocateBunproTiles([0, 0])).toEqual([0, 0]);
  });
  it("uses the API end date and describes sparse days without conflating study streaks", () => {
    const days = bunproReviewCalendar({ grammar: { "2026-09-20": 5 }, vocab: { "2026-09-20": 2 } }, "grammar", "2026-09-22");
    expect(days.at(-1)?.key).toBe("2026-09-22");
    expect(days.find(day => day.key === "2026-09-20")?.value).toBe(5);
    expect(days.at(-1)?.label).toBe("Sep 22: No recorded reviews");
  });
});

describe("Bunpro analytics API resources", () => {
  beforeEach(() => fetchMock.resetMocks());
  it("loads the current activity_daily endpoint", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ grammar: {}, vocab: {} }));
    await getBunproReviewActivity({ apiToken: "fixture-key" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/activity_daily?");
  });
  it("retains valid resources when other endpoints fail or are malformed", async () => {
    fetchMock.mockResponse(async request => {
      if (request.url.includes("/user/due?")) return JSON.stringify({ total_due_grammar: 0, total_due_vocab: 4 });
      if (request.url.includes("activity_daily")) return JSON.stringify({ grammar: {}, vocab: {} });
      return JSON.stringify({ invalid: true });
    });
    const data = await getBunproAnalytics({ apiToken: "fixture-key" });
    expect(data.due).toEqual({ total_due_grammar: 0, total_due_vocab: 4 });
    expect(data.activity).toEqual({ grammar: {}, vocab: {} });
    expect(data.facts).toBeNull();
    expect(data.unavailable).toContain("facts");
  });
  it("does not hide authentication failures behind a partially loaded dashboard", async () => {
    fetchMock.mockResponse(async request => request.url.includes("/user/due?") ? { status: 401, body: JSON.stringify({ message: "Unauthorized" }) } : JSON.stringify({ grammar: {}, vocab: {} }));
    await expect(getBunproAnalytics({ apiToken: "fixture-key" })).rejects.toMatchObject({ status: 401 });
  });
  it("reports an unavailable dashboard when all resources fail validation", async () => {
    fetchMock.mockResponse("{}");
    await expect(getBunproAnalytics({ apiToken: "fixture-key" })).rejects.toMatchObject({ status: 503 });
  });
});
