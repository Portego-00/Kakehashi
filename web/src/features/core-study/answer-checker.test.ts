import { describe, expect, it } from "vitest";
import { checkAnswer, levenshtein, normalizeReading } from "./answer-checker";
import type { Subject } from "@/types/wanikani";

const subject: Subject = { id: 1, object: "kanji", url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "川", document_url: "", hidden_at: null, characters: "川", meanings: [{ meaning: "River", primary: true, accepted_answer: true }], auxiliary_meanings: [{ meaning: "Stream", type: "whitelist" }, { meaning: "Water", type: "blacklist" }], readings: [{ reading: "かわ", primary: true, accepted_answer: true, type: "kunyomi" }] } };

describe("core answer checker", () => {
  it("normalizes romaji readings to hiragana", () => expect(normalizeReading("kawa")).toBe("かわ"));
  it("accepts whitelist meanings and blocks blacklists", () => { expect(checkAnswer(subject, "meaning", "stream").status).toBe("correct"); expect(checkAnswer(subject, "meaning", "water").status).toBe("blocked"); });
  it("accepts small typos without losing the canonical answer", () => expect(checkAnswer(subject, "meaning", "rivr")).toMatchObject({ status: "close", canonical: "River" }));
  it("computes edit distance", () => expect(levenshtein("kitten", "sitting")).toBe(3));
});
