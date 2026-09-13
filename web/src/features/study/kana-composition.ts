import type { StudyQuestion } from "./types";

export { composeKanaInput } from "@/lib/kana";

export function questionUsesKanaComposition(question: StudyQuestion): boolean {
  return question.kind === "reading"
    || question.kind === "meaning-to-reading"
    || question.kind === "context"
    || question.kind === "listening-characters";
}
