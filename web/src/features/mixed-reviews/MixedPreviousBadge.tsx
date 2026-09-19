import Link from "next/link";
import { Check, X } from "lucide-react";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { MixedPreviousAnswer } from "./ordering";
import styles from "@/features/study/study.module.css";

export function MixedPreviousBadge({ answer, animate }: { answer?: MixedPreviousAnswer | null; animate: boolean }) {
  if (!answer) return null;
  const props = { className: styles.previousSubjectLink, "data-type": answer.subject?.object ?? "bunpro", "data-animate": animate || undefined, "data-correct": answer.correct, "aria-label": `Previous ${answer.source === "bunpro" ? "Bunpro" : "WaniKani"} answer: ${answer.title}, ${answer.correct ? "correct" : "incorrect"}` };
  const content = <>{answer.subject ? <SubjectCharacter subject={answer.subject} className={styles.previousSubjectCharacter} imageSize="1em" /> : <span className={styles.previousSubjectCharacter} lang="ja">{answer.title}</span>}<span className={styles.previousSubjectStatus} data-correct={answer.correct} aria-hidden>{answer.correct ? <Check size={13} /> : <X size={13} />}</span></>;
  return answer.subject ? <Link {...props} target="_blank" rel="noopener noreferrer" href={`/subjects/${answer.subject.id}`}>{content}</Link> : <span {...props}>{content}</span>;
}
