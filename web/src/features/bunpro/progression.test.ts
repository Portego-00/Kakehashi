import { expect, it } from "vitest";
import { bunproProgression, bunproStage } from "./progression";
import { bunproAudioUrls } from "./use-bunpro-audio";
it.each([
  [0, "Beginner 0"], [1, "Beginner 1"], [2, "Beginner 2"], [3, "Beginner 3"],
  [4, "Adept 1"], [5, "Adept 2"], [6, "Adept 3"],
  [7, "Seasoned 1"], [8, "Seasoned 2"], [9, "Seasoned 3"],
  [10, "Expert 1"], [11, "Expert 2"], [12, "Master"],
])("labels Bunpro streak %s as %s", (streak, label) => { expect(bunproStage({ streak }).label).toBe(label); });
it("reads the saved stage and next review from the response", () => { expect(bunproProgression("10", "です", { streak: 3 }, { data: { attributes: { streak: 4, next_review: "2026-09-18T20:00:00Z" } } }, Date.parse("2026-09-18T16:00:00Z"))).toMatchObject({ from: "Beginner 3", to: "Adept 1", direction: "up", nextReview: "in 4h" }); });
it("does not invent an SRS update when Bunpro omits it", () => { expect(bunproProgression("10", "です", { streak: 3 }, {})).toMatchObject({ from: "Beginner 3", to: "", direction: "unknown", nextReview: "" }); });
it("uses the hydrated review instead of stages belonging to other queued reviews", () => {
  expect(bunproProgression("10", "です", { streak: 7 }, {
    updated_review: { id: "10", type: "review", attributes: { streak: 6, next_review: "2026-09-18T20:00:00Z" } },
    srs_stage_name: "Master",
    review: { attributes: { streak: 12 } },
    pending_attempt: [{ data: { attributes: { streak: 8 } } }],
  }, Date.parse("2026-09-18T16:00:00Z"))).toMatchObject({ from: "Seasoned 1", to: "Adept 3", direction: "down", nextReview: "in 4h" });
});
it("supports both voices, fallback, and avoids duplicate audio", () => { const question = { female_audio_url: "https://audio.test/f", male_audio_url: "https://audio.test/m" }; expect(bunproAudioUrls(question, "both")).toEqual([question.female_audio_url, question.male_audio_url]); expect(bunproAudioUrls(question, "male")).toEqual([question.male_audio_url]); expect(bunproAudioUrls({ female_audio_url: question.female_audio_url }, "male")).toEqual([question.female_audio_url]); expect(bunproAudioUrls({ ...question, male_audio_url: question.female_audio_url }, "both")).toEqual([question.female_audio_url]); });
