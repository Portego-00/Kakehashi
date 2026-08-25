import { toHiragana } from "wanakana";
import type { StudyMaterial, Subject } from "@/types/wanikani";

export type QuestionKind = "meaning" | "reading";
export type AnswerResult = { status: "correct" | "close" | "incorrect" | "blocked"; message: string; canonical?: string };

const punctuation = /[\s.,/#!$%^&*;:{}=\-_`~()'"?]/g;
export function normalizeMeaning(value: string) { return value.trim().toLocaleLowerCase().replace(punctuation, ""); }
export function normalizeReading(value: string) { return toHiragana(value.trim()).replace(/[\s・]/g, ""); }

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

export function checkAnswer(subject: Subject, kind: QuestionKind, raw: string, material?: StudyMaterial): AnswerResult {
  if (!raw.trim()) return { status: "blocked", message: "Type an answer before checking it." };
  if (kind === "reading") {
    const answer = normalizeReading(raw);
    const accepted = (subject.data.readings || []).filter((reading) => reading.accepted_answer).map((reading) => normalizeReading(reading.reading));
    const canonical = (subject.data.readings || []).find((reading) => reading.primary)?.reading || accepted[0];
    if (accepted.includes(answer)) return { status: "correct", message: "Correct reading.", canonical };
    const other = (subject.data.readings || []).map((reading) => normalizeReading(reading.reading));
    if (other.includes(answer)) return { status: "blocked", message: "That is a real reading for this item, but WaniKani wants a different reading here.", canonical };
    return { status: "incorrect", message: `Not this time. The expected reading is ${canonical || "shown in the item details"}.`, canonical };
  }

  const answer = normalizeMeaning(raw);
  const primary = subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.meanings[0]?.meaning || "";
  const accepted = [
    ...subject.data.meanings.filter((meaning) => meaning.accepted_answer).map((meaning) => meaning.meaning),
    ...(material?.data.meaning_synonyms || []),
    ...subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist").map((meaning) => meaning.meaning),
  ].map(normalizeMeaning);
  const blocked = subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "blacklist").map((meaning) => normalizeMeaning(meaning.meaning));
  if (blocked.includes(answer)) return { status: "blocked", message: "That meaning is related, but WaniKani does not accept it for this item.", canonical: primary };
  if (accepted.includes(answer)) return { status: "correct", message: "Correct meaning.", canonical: primary };
  const closest = accepted.reduce((best, candidate) => Math.min(best, levenshtein(answer, candidate)), Number.POSITIVE_INFINITY);
  const threshold = answer.length >= 8 ? 2 : answer.length >= 4 ? 1 : 0;
  if (closest <= threshold) return { status: "close", message: "Close enough — check the spelling before moving on.", canonical: primary };
  return { status: "incorrect", message: `Not this time. The primary meaning is ${primary}.`, canonical: primary };
}
