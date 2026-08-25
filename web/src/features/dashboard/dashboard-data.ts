import type { Assignment, ReviewStatistic, Subject, WKSummary } from "@/types/wanikani";

export function isReviewAvailable(assignment: Assignment, now = new Date(), currentVacationStartedAt?: string | null) {
  if (currentVacationStartedAt) return false;
  const data = assignment.data;
  return Boolean(data.started_at && !data.hidden && data.srs_stage > 0 && data.srs_stage < 9 && data.available_at && new Date(data.available_at) <= now);
}

export function isLessonAvailable(assignment: Assignment, currentVacationStartedAt?: string | null) {
  if (currentVacationStartedAt) return false;
  const data = assignment.data;
  return Boolean(data.unlocked_at && !data.started_at && !data.hidden && data.srs_stage === 0);
}

export function srsBuckets(assignments: Assignment[]) {
  const buckets = { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 };
  assignments.forEach(({ data }) => {
    if (data.hidden || !data.started_at) return;
    if (data.srs_stage <= 4) buckets.apprentice += 1;
    else if (data.srs_stage <= 6) buckets.guru += 1;
    else if (data.srs_stage === 7) buckets.master += 1;
    else if (data.srs_stage === 8) buckets.enlightened += 1;
    else buckets.burned += 1;
  });
  return buckets;
}

export function levelProgress(subjects: Subject[], assignments: Assignment[]) {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const counts = { radical: { passed: 0, total: 0 }, kanji: { passed: 0, total: 0 }, vocabulary: { passed: 0, total: 0 } };
  subjects.forEach((subject) => {
    const type = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
    if (!(type in counts)) return;
    counts[type as keyof typeof counts].total += 1;
    if ((assignmentBySubject.get(subject.id)?.data.srs_stage || 0) >= 5) counts[type as keyof typeof counts].passed += 1;
  });
  return counts;
}

export function forecastRows(summary?: WKSummary, now = new Date()) {
  const hours = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + index);
    return { start, count: 0 };
  });
  summary?.data.reviews.forEach((row) => {
    const time = new Date(row.available_at);
    const index = Math.floor((time.getTime() - hours[0].start.getTime()) / 3_600_000);
    if (index >= 0 && index < hours.length) hours[index].count += row.subject_ids.length;
  });
  return hours;
}

export function accuracy(statistics: ReviewStatistic[]) {
  let correct = 0;
  let total = 0;
  statistics.forEach(({ data }) => {
    correct += data.meaning_correct + data.reading_correct;
    total += data.meaning_correct + data.meaning_incorrect + data.reading_correct + data.reading_incorrect;
  });
  return total ? Math.round((correct / total) * 100) : 0;
}

export function scheduleSummary(reviewCount: number, nextReviewsAt: string | null | undefined, now = new Date()) {
  if (reviewCount > 0) return `${reviewCount.toLocaleString()} review${reviewCount === 1 ? "" : "s"} ready now`;
  if (!nextReviewsAt) return "review schedule is clear";
  const difference = new Date(nextReviewsAt).getTime() - now.getTime();
  if (difference <= 0) return "reviews are ready now";
  const minutes = Math.max(1, Math.round(difference / 60_000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 90) return `next review ${formatter.format(minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `next review ${formatter.format(hours, "hour")}`;
  return `next review ${formatter.format(Math.round(hours / 24), "day")}`;
}
