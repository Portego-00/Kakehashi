import type { StudyQuestion } from "./types";

export { composeKanaInput } from "@/lib/kana";

export function questionUsesKanaComposition(question: StudyQuestion): boolean {
  if (question.kind === "reading" || question.kind === "meaning-to-reading" || question.kind === "context") return true;
  return question.kind === "listening-characters" && question.subjectType === "kana_vocabulary";
}
