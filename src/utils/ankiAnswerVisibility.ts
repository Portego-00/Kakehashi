export function shouldShowAnkiPitchAccent(
  questionType: "meaning" | "reading",
  groupQuestions: boolean
): boolean {
  return groupQuestions || questionType === "reading";
}
