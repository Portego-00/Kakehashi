import { z } from "zod";
import type { BunproReviewActivityResponse } from "../types/bunpro";

const count = z.number().finite().nonnegative();
const series = z.object({ grammar: z.record(z.string(), count), vocab: z.record(z.string(), count) });
const stages = z.object({ beginner: count, adept: count, seasoned: count, expert: count, master: count });
const jlptLevel = stages.extend({ total_count: count });
const jlptBucket = z.object({ "1": jlptLevel, "2": jlptLevel, "3": jlptLevel, "4": jlptLevel, "5": jlptLevel });
const overview = stages.extend({ ghost: count, self_study: count });
const reviewLevel = z.object({ total: count, correct: count, incorrect: count, accuracy: count.max(100) });

/** Validate resources independently: unavailable statistics must never become zeros. */
export const bunproAnalyticsResources = {
  facts: { path: "/user_stats/base_stats", schema: z.object({ facts: z.object({ days_studied: count, weekly_streak: z.array(z.object({ day: z.string(), val: z.boolean() })), streak: count, grammar_studied: count, vocab_studied: count }) }).transform(value => value.facts) },
  activity: { path: "/user_stats/activity_daily", schema: series },
  forecast: { path: "/user_stats/forecast_daily", schema: series },
  srs: { path: "/user_stats/srs_level_overview", schema: z.object({ grammar: overview, vocab: overview }) },
  jlpt: { path: "/user_stats/jlpt_progress_mixed", schema: z.object({ grammar: jlptBucket, vocab: jlptBucket }) },
  reviewTotals: { path: "/user_stats/total_review_stats", schema: z.object({ grammar: z.record(z.string(), reviewLevel), vocab: z.record(z.string(), reviewLevel) }) },
  heatmap: { path: "/user_stats/review_heatmap", schema: series },
  cram: { path: "/user_stats/total_cram_stats", schema: z.object({ sessions: z.object({ session_count: count, total_time: z.string() }), items: z.object({ total: count, correct: count, incorrect: count, accuracy: count.max(100) }) }) },
  due: { path: "/user/due", schema: z.object({ total_due_grammar: count, total_due_vocab: count }) },
} as const;

export type BunproAnalyticsResource = keyof typeof bunproAnalyticsResources;
export type BunproAnalyticsData = { [Key in BunproAnalyticsResource]: z.infer<(typeof bunproAnalyticsResources)[Key]["schema"]> | null } & { unavailable: BunproAnalyticsResource[] };
export type BunproAnalyticsMode = "all" | "grammar" | "vocab";
export type BunproAnalyticsKind = Exclude<BunproAnalyticsMode, "all">;
export const BUNPRO_ANALYTICS_STAGES = [
  { key: "beginner", label: "Beginner", color: "#d85a69" },
  { key: "adept", label: "Adept", color: "#d8a044" },
  { key: "seasoned", label: "Seasoned", color: "#63a06d" },
  { key: "expert", label: "Expert", color: "#6198bc" },
  { key: "master", label: "Master", color: "#aa80c5" },
] as const;

export function bunproAnalyticsTotal(grammar: number | null | undefined, vocab: number | null | undefined, mode: BunproAnalyticsMode): number | null {
  const value = mode === "grammar" ? grammar : mode === "vocab" ? vocab : grammar == null || vocab == null ? null : grammar + vocab;
  return value == null || !Number.isFinite(value) ? null : Math.max(0, value);
}

/** Date-only API buckets are calendar dates, not UTC instants. */
export function bunproCalendarDate(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? date : null;
}

export function formatBunproCalendarDate(key: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return bunproCalendarDate(key)?.toLocaleDateString(undefined, { ...options, timeZone: "UTC" }) ?? key;
}

export function bunproAnalyticsSeries(data: BunproReviewActivityResponse | null) {
  if (!data) return [];
  return [...new Set([...Object.keys(data.grammar), ...Object.keys(data.vocab)])]
    .filter(key => bunproCalendarDate(key) !== null).sort()
    .map(key => ({ key, label: formatBunproCalendarDate(key), grammar: data.grammar[key] ?? null, vocab: data.vocab[key] ?? null }));
}

export function bunproAnalyticsForecast(data: BunproReviewActivityResponse | null) {
  if (!data) return [];
  const relative = ([['later', 'Later today'], ['tomorrow', 'Tomorrow']] as const)
    .filter(([key]) => key in data.grammar || key in data.vocab)
    .map(([key, label]) => ({ key, label, grammar: data.grammar[key] ?? null, vocab: data.vocab[key] ?? null }));
  return [...relative, ...bunproAnalyticsSeries(data)];
}

export function bunproReviewAccuracy(data: BunproAnalyticsData["reviewTotals"], kind: BunproAnalyticsKind) {
  if (!data) return null;
  const totals = Object.values(data[kind]).reduce((sum, row) => ({ total: sum.total + row.total, correct: sum.correct + row.correct }), { total: 0, correct: 0 });
  return totals.total > 0 ? { ...totals, accuracy: totals.correct / totals.total * 100 } : null;
}

export function allocateBunproTiles(values: number[], cells = 200): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  const exact = values.map(value => value / total * cells);
  const counts = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - counts[index] })).sort((a, b) => b.remainder - a.remainder);
  const remaining = cells - counts.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < remaining; index++) counts[order[index].index]++;
  return counts;
}

export function bunproReviewCalendar(data: BunproReviewActivityResponse, mode: BunproAnalyticsMode, endKey?: string) {
  const keys = [...Object.keys(data.grammar), ...Object.keys(data.vocab)].filter(key => bunproCalendarDate(key)).sort();
  const end = bunproCalendarDate(endKey ?? "") ?? bunproCalendarDate(keys.at(-1) ?? "");
  if (!end) return [];
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 175);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const length = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const value = (mode !== "vocab" ? data.grammar[key] ?? 0 : 0) + (mode !== "grammar" ? data.vocab[key] ?? 0 : 0);
    return { key, value, label: `${formatBunproCalendarDate(key)}: ${value ? `${value.toLocaleString()} reviews` : "No recorded reviews"}` };
  });
}
