import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { MixedPreviousAnswer } from "./ordering";
import styles from "@/features/study/study.module.css";

export function MixedPreviousBadge({ answer, animate, claimAnimation }: { answer?: MixedPreviousAnswer | null; animate: boolean; claimAnimation?: () => boolean }) {
  const element = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (answer) element.current?.setAttribute("data-animate", String((claimAnimation?.() ?? true) && animate));
    });
    return () => cancelAnimationFrame(frame);
  }, [answer, animate, claimAnimation]);
  if (!answer) return null;
  const props = { className: styles.previousSubjectLink, "data-type": answer.subject?.object ?? "bunpro", ref: (node: HTMLElement | null) => { element.current = node; }, "data-correct": answer.correct, "aria-label": `Previous ${answer.source === "bunpro" ? "Bunpro" : "WaniKani"} answer: ${answer.title}, ${answer.correct ? "correct" : "incorrect"}` };
  const content = <>{answer.subject ? <SubjectCharacter subject={answer.subject} className={styles.previousSubjectCharacter} imageSize="1em" /> : <span className={styles.previousSubjectCharacter} lang="ja">{answer.title}</span>}<span className={styles.previousSubjectStatus} data-correct={answer.correct} aria-hidden>{answer.correct ? <Check size={13} /> : <X size={13} />}</span></>;
  const href = answer.subject ? `/subjects/${answer.subject.id}` : answer.bunproSubject ? `/bunpro/${answer.bunproSubject.kind}/${encodeURIComponent(answer.bunproSubject.slug)}` : null;
  return href ? <Link {...props} target="_blank" rel="noopener noreferrer" href={href}>{content}</Link> : <span {...props}>{content}</span>;
}
