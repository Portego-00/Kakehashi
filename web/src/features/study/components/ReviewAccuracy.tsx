import { Check } from "lucide-react";
import styles from "./review-accuracy.module.css";
export type AccuracyCounts = { correct: number; answered: number };
export function ReviewAccuracy({ correct, answered }: AccuracyCounts) {
  const percent = answered ? Math.round(correct / answered * 100) : null;
  return <span className={styles.accuracy} title="First-attempt answer accuracy" aria-label={percent === null ? "Accuracy: no answers yet" : `Accuracy: ${percent}%, ${correct} of ${answered} answers correct on the first attempt`}><Check size={15} aria-hidden /><strong>{percent === null ? "—" : `${percent}%`}</strong><span>accuracy</span></span>;
}
export function coreAccuracy(completed: Record<number, string[]>, errors: Record<number, { meaning: number; reading: number }>, current?: { id: number; kinds: string[]; correct: boolean }): AccuracyCounts {
  const answers = new Map<string, boolean>();
  for (const [id, kinds] of Object.entries(completed)) for (const kind of kinds) answers.set(`${id}:${kind}`, true);
  for (const [id, counts] of Object.entries(errors)) for (const [kind, count] of Object.entries(counts)) if (count > 0) answers.set(`${id}:${kind}`, false);
  if (current) for (const kind of current.kinds) { const key = `${current.id}:${kind}`; if (!answers.has(key)) answers.set(key, current.correct); }
  return { correct: [...answers.values()].filter(Boolean).length, answered: answers.size };
}
