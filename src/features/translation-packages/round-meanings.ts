import type { SimilarKanjiRound } from "../../utils/similarKanjiQuiz";
import type { learningDisplay } from "./display";

// Labels only: keep round identities, saved sessions and answer matching intact.
export function roundMeaningLabels(
  round: SimilarKanjiRound | undefined,
  display: Pick<ReturnType<typeof learningDisplay>, "meaning">,
): Map<number, string> {
  if (!round) return new Map();
  const labels = round.items.map(item => display.meaning(item.subject, item.meaning));
  const normalized = labels.map(label => label.normalize("NFKC").toLowerCase().replace(/\u0307/g, "").trim());
  // Distinct source meanings can share a translation. Keep the original round
  // labels in that case so visually identical options cannot hide the answer.
  const ambiguous = new Set(normalized).size !== normalized.length;
  return new Map(round.items.map((item, index) => [item.id, ambiguous ? item.meaning : labels[index]]));
}
