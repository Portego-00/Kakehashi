import { expect, it } from "vitest";
import { bunproForecastEntries } from "./forecast";
import { createReviewForecast } from "@/features/dashboard/review-forecast";
it("adds overdue reviews once, wraps hourly keys, and subtracts overlapping daily totals", () => {
  const now = new Date("2026-09-19T15:30:00Z");
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const data = { due: { total_due_grammar: 10, total_due_vocab: 20 }, hourly: { grammar: { "2026-09-19T16:00Z": 3, "2026-09-19T01:00Z": 4 }, vocab: {} }, daily: { grammar: { tomorrow: 9, [tomorrowKey]: 9, later: 10 }, vocab: {} } };
  const entries = bunproForecastEntries(data, now);
  const forecast = createReviewForecast(entries, now);
  expect(forecast.dueNow.count).toBe(30);
  expect(forecast.dueNow.subjectBreakdown.bunpro_grammar).toBe(10);
  expect(entries.find((entry) => entry.id.endsWith("2026-09-19T01:00Z"))?.availableAt).toBe("2026-09-20T02:00:00.000Z");
  expect(entries.reduce((sum, entry) => sum + (entry.count ?? 0), 0)).toBe(42);
});
it("combines WaniKani and Bunpro without inventing Bunpro SRS stages", () => {
  const now = new Date("2026-09-19T15:30:00Z");
  const forecast = createReviewForecast([{ id: "wk", availableAt: now.toISOString(), subjectType: "kanji", srsStage: 1 }, { id: "bp", availableAt: now.toISOString(), subjectType: "bunpro_vocab", srsStage: 0, count: 35 }], now);
  expect(forecast.dueNow.count).toBe(36);
  expect(forecast.dueNow.srsBreakdown.apprentice).toBe(1);
  expect(forecast.dueNow.subjectBreakdown.bunpro_vocab).toBe(35);
});
