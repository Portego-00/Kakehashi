import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { Subject } from "@/types/wanikani";
import { canonicalAnswer, questionOrderForMode, shouldPauseAfterResult, usesSelfAssessment } from "./study-preferences";

const preferences = DEFAULT_WEB_SETTINGS.study;
const subject = { data: { slug: "water", meanings: [{ meaning: "Water", primary: true, accepted_answer: true }], readings: [{ reading: "みず", primary: true, accepted_answer: true }] } } as Subject;

describe("core study preferences", () => {
  it("keeps lesson and review question ordering independent", () => {
    const configured = { ...preferences, lessonQuestionOrder: "reading-first" as const, reviewQuestionOrder: "meaning-first" as const };
    expect(questionOrderForMode("lessons", configured)).toBe("reading-first");
    expect(questionOrderForMode("reviews", configured)).toBe("meaning-first");
  });

  it("scopes self assessment to configured question kinds", () => {
    expect(usesSelfAssessment("meaning", { ...preferences, ankiMode: "meaning" })).toBe(true);
    expect(usesSelfAssessment("reading", { ...preferences, ankiMode: "meaning" })).toBe(false);
  });

  it("honors independent mobile-style answer pauses", () => {
    const configured = { ...preferences, pauseOnWrong: true, pauseOnClose: false, pauseOnCorrect: false };
    expect(shouldPauseAfterResult("correct", configured)).toBe(false);
    expect(shouldPauseAfterResult("close", configured)).toBe(false);
    expect(shouldPauseAfterResult("incorrect", configured)).toBe(true);
    expect(shouldPauseAfterResult("blocked", configured)).toBe(false);
  });

  it("reveals canonical self-assessment answers", () => {
    expect(canonicalAnswer(subject, "meaning")).toBe("Water");
    expect(canonicalAnswer(subject, "reading")).toBe("みず");
  });
});
