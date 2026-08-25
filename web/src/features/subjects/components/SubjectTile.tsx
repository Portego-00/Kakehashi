import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Badge } from "@/components/ui/Badge";
import type { Assignment, ReviewStatistic, Subject } from "@/types/wanikani";
import styles from "../subjects.module.css";

const TYPE_LABELS = { radical: "Radical", kanji: "Kanji", vocabulary: "Vocabulary", kana_vocabulary: "Kana vocabulary" } as const;

export function SubjectTile({ subject, assignment, statistic, action }: { subject: Subject; assignment?: Assignment; statistic?: ReviewStatistic; action?: React.ReactNode }) {
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
  const reading = subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading;
  const tone = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
  return <article className={styles.subjectTile}>
    <Link href={`/subjects/${subject.id}`} className={styles.subjectTileLink} aria-label={`${subject.data.characters ?? meaning}, ${meaning}`}>
      <span className={styles.subjectCharacters} data-type={tone}>{subject.data.characters || meaning.slice(0, 2)}</span>
      <span className={styles.subjectCopy}><span className={styles.subjectMeta}><Badge tone={tone}>{TYPE_LABELS[subject.object]}</Badge><span>Level {subject.data.level}</span>{assignment ? <span className={styles.subjectSrs}><SrsStageIcon stage={assignment.data.srs_stage} size={15} />{srsStageLabel(assignment.data.srs_stage)}</span> : <span>Locked</span>}</span><strong>{meaning}</strong>{reading ? <span lang="ja">{reading}</span> : null}{statistic ? <small>{statistic.data.percentage_correct}% accuracy</small> : null}</span>
      <ArrowRight size={17} aria-hidden className={styles.subjectArrow} />
    </Link>
    {action ? <div className={styles.subjectAction}>{action}</div> : null}
  </article>;
}
