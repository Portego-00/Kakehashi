import { describe, expect, it } from "vitest";
import type { WKUser } from "@/types/wanikani";
import { canRevealStudyDetails, isVacationActive, vacationDateLabel, vacationStartedAt, vacationStudyMessage } from "./vacation";

function user(startedAt: string | null) {
  return { data: { current_vacation_started_at: startedAt } } as WKUser;
}

describe("Vacation Mode study behavior", () => {
  it("uses WaniKani's current vacation timestamp as the source of truth", () => {
    expect(isVacationActive(user("2026-08-12T09:00:00Z"))).toBe(true);
    expect(vacationStartedAt(user("2026-08-12T09:00:00Z"))).toBe("2026-08-12T09:00:00Z");
    expect(isVacationActive(user(null))).toBe(false);
    expect(vacationStartedAt(null)).toBeNull();
  });

  it("formats a stable vacation message and safely handles malformed dates", () => {
    expect(vacationDateLabel("2026-08-12T09:00:00Z", "en-US")).toBe("August 12, 2026");
    expect(vacationDateLabel("not-a-date", "en-US")).toBe("recently");
    expect(vacationStudyMessage("reviews")).toContain("Reviews are on hold");
  });

  it("conceals review details until an answer is actually revealed", () => {
    expect(canRevealStudyDetails("reviews", null)).toBe(false);
    expect(canRevealStudyDetails("reviews", "blocked")).toBe(false);
    expect(canRevealStudyDetails("reviews", "incorrect")).toBe(true);
    expect(canRevealStudyDetails("lessons", null)).toBe(false);
    expect(canRevealStudyDetails("lessons", "correct")).toBe(true);
  });
});
