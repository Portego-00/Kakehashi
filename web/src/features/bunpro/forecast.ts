import type { BunproForecastDailyResponse, BunproDueResponse } from "../../../../src/types/bunpro";
import type { ReviewForecastEntry } from "@/features/dashboard/review-forecast";
export type BunproForecastResponse = { hourly: BunproForecastDailyResponse; daily: BunproForecastDailyResponse; due: BunproDueResponse };
const HOUR = 3_600_000;
function count(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0; }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
/** Bunpro's hourly keys wrap at midnight; daily totals overlap those hours. */
export function bunproForecastEntries(data: BunproForecastResponse | undefined, now: Date, hourlyOnly = false): ReviewForecastEntry[] {
  if (!data) return [];
  const entries: ReviewForecastEntry[] = [];
  for (const kind of ["grammar", "vocab"] as const) {
    const subjectType = `bunpro_${kind}` as const;
    const add = (id: string, timestamp: number, value: number) => { if (value) entries.push({ id: `${subjectType}:${id}`, availableAt: new Date(timestamp).toISOString(), count: value, subjectType, srsStage: 0 }); };
    add("due", now.getTime(), count(data.due[kind === "grammar" ? "total_due_grammar" : "total_due_vocab"]));
    const hourlyByDay = new Map<string, number>();
    const hourStart = now.getTime() - now.getMinutes() * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
    for (const [key, value] of Object.entries(data.hourly[kind] ?? {})) {
      let time = Date.parse(key);
      if (!Number.isFinite(time)) continue;
      while (time < hourStart) time += 24 * HOUR;
      const bucketCount = count(value);
      // A key labels an hourly bucket; place it at its end, after the current due count.
      const end = time + HOUR;
      add(key, end, bucketCount);
      const day = dayKey(new Date(time));
      hourlyByDay.set(day, (hourlyByDay.get(day) ?? 0) + bucketCount);
    }
    if (hourlyOnly) continue;
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const daily = { ...(data.daily[kind] ?? {}) };
    if (!(dayKey(tomorrow) in daily)) daily[dayKey(tomorrow)] = daily.tomorrow ?? 0;
    for (const [key, value] of Object.entries(daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const time = new Date(`${key}T23:59:59`).getTime();
      if (!Number.isFinite(time) || time <= now.getTime()) continue;
      add(`daily:${key}`, time, Math.max(0, count(value) - (hourlyByDay.get(key) ?? 0)));
    }
  }
  return entries;
}
