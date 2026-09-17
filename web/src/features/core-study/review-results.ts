import type { Subject } from "@/types/wanikani";
import { kindsForSubject } from "./queue";

export type ReviewResultItem = {
  assignmentId: number;
  subject: Subject;
  meaningMistakes: number;
  readingMistakes: number;
  endingStage?: number;
};

export function resultMistakes(item: ReviewResultItem) {
  return item.meaningMistakes + (kindsForSubject(item.subject).includes("reading") ? item.readingMistakes : 0);
}

export function reviewResultsSummary(items: readonly ReviewResultItem[]) {
  const meanings = { correct: 0, total: 0 };
  const readings = { correct: 0, total: 0 };
  const categories = ["radical", "kanji", "vocabulary"].map((type) => ({ type, correct: 0, total: 0 }));
  for (const item of items) {
    meanings.total++;
    if (item.meaningMistakes === 0) meanings.correct++;
    if (kindsForSubject(item.subject).includes("reading")) {
      readings.total++;
      if (item.readingMistakes === 0) readings.correct++;
    }
    const category = categories.find((entry) => entry.type === (item.subject.object === "kana_vocabulary" ? "vocabulary" : item.subject.object));
    if (category) {
      category.total++;
      if (resultMistakes(item) === 0) category.correct++;
    }
  }
  return { meanings, readings, overall: { correct: meanings.correct + readings.correct, total: meanings.total + readings.total }, categories: categories.filter((category) => category.total > 0) };
}

export function resultPercentage(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : null;
}
