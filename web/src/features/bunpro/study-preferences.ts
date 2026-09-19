import type { BunproReviewQueueItem } from "./model";
import { pickCanonicalAnswer, reviewContent, sanitizeText } from "./model";
import type { PitchAccentEntry } from "@/features/subjects/enrichments";

export function bunproQuestionKind(item?: BunproReviewQueueItem): "meaning" | "reading" {
  if (!item) return "reading";
  const content = reviewContent(item);
  if (content.kind === "grammar") return "reading";
  // Follow the actual question, since Bunpro may mix cloze and translation modes.
  const answer = pickCanonicalAnswer(content.question);
  return answer && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(answer) ? "meaning" : "reading";
}
export function bunproDisplayAnswers(question: Record<string, unknown>): string[] {
  return [...new Set([question.answer, question.kanji_answer, ...(Array.isArray(question.alternate_grammar) ? question.alternate_grammar : []), ...(Array.isArray(question.kanji_alt_grammar) ? question.kanji_alt_grammar : [])].map(sanitizeText).filter(Boolean))];
}
export function normalizeMeaning(value: string) { return value.trim().toLocaleLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " "); }
export function bunproPitchAccents(attributes: Record<string, unknown>): PitchAccentEntry[] {
  const reading = sanitizeText(attributes.kana);
  const stress = sanitizeText(attributes.pitch_accent_stress).toUpperCase();
  const drop = stress.indexOf("HL");
  // A high final mora doesn't distinguish heiban from odaka. Only report a known drop.
  return reading && drop >= 0 ? [{ r: reading, p: [drop + 1] }] : [];
}
