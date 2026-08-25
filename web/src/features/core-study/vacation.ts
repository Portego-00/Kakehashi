import type { WKUser } from "@/types/wanikani";

export type StudyMode = "lessons" | "reviews";

export function vacationStartedAt(user: WKUser | null | undefined) {
  const startedAt = user?.data.current_vacation_started_at;
  return typeof startedAt === "string" && startedAt.trim() ? startedAt : null;
}

export function isVacationActive(user: WKUser | null | undefined) {
  return vacationStartedAt(user) !== null;
}

export function vacationDateLabel(startedAt: string, locale?: string | string[]) {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
}

export function vacationStudyMessage(mode?: StudyMode) {
  if (mode === "lessons") return "Lessons are on hold until Vacation Mode is turned off in WaniKani.";
  if (mode === "reviews") return "Reviews are on hold until Vacation Mode is turned off in WaniKani.";
  return "Your SRS progress is paused. Reviews and lessons are on hold until you return. Enjoy your break!";
}

export function canRevealStudyDetails(mode: StudyMode, feedbackStatus: string | null | undefined) {
  if (mode !== "lessons" && mode !== "reviews") return false;
  return Boolean(feedbackStatus && feedbackStatus !== "blocked");
}
