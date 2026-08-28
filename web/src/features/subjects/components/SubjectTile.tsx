import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Skeleton } from "@/components/ui/States";
import type { Assignment, ReviewStatistic, Subject } from "@/types/wanikani";
import { SubjectCharacter } from "./SubjectCharacter";
import styles from "../subjects.module.css";

export function SubjectTile({ subject, assignment, statistic, action, returnTo }: { subject: Subject; assignment?: Assignment; statistic?: ReviewStatistic; action?: React.ReactNode; returnTo?: string }) {
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
  const readings = subject.data.readings ?? [];
  const visibleReadings = readings.slice(0, 2);
  const hiddenReadingCount = Math.max(0, readings.length - visibleReadings.length);
  const tone = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
  const fallbackCharacters = meaning.slice(0, 2);
  const characterCount = Array.from(subject.data.characters || fallbackCharacters).length;
  const detailHref = returnTo ? `/subjects/${subject.id}?returnTo=${encodeURIComponent(returnTo)}` : `/subjects/${subject.id}`;
  return <article className={styles.subjectTile} data-type={tone}>
    <Link href={detailHref} className={styles.subjectTileLink} aria-label={`${subject.data.characters ?? meaning}, ${meaning}`}>
      <SubjectCharacter subject={subject} fallbackText={fallbackCharacters} imageSize="2.5rem" className={styles.subjectCharacters} data-type={tone} data-character-count={Math.min(characterCount, 12)} />
      <span className={styles.subjectCopy}>
        <span className={styles.subjectMeta}><span>Level {subject.data.level}</span>{assignment ? <span className={styles.subjectSrs}><SrsStageIcon stage={assignment.data.srs_stage} size={15} />{srsStageLabel(assignment.data.srs_stage)}</span> : <span>Locked</span>}{statistic ? <span className={styles.subjectAccuracy}>{statistic.data.percentage_correct}% accuracy</span> : null}</span>
        <strong>{meaning}</strong>
        {visibleReadings.length ? <span className={styles.subjectReadings} aria-label={`Readings: ${readings.map((reading) => reading.reading).join(", ")}`}>{visibleReadings.map((reading) => <span key={`${reading.type ?? "reading"}-${reading.reading}`} className={styles.subjectReadingChip} data-primary={reading.primary || undefined} lang="ja">{reading.reading}</span>)}{hiddenReadingCount ? <span className={styles.subjectReadingOverflow} aria-label={`${hiddenReadingCount} more ${hiddenReadingCount === 1 ? "reading" : "readings"}`}>+{hiddenReadingCount}</span> : null}</span> : null}
      </span>
      <ArrowRight size={17} aria-hidden className={styles.subjectArrow} />
    </Link>
    {action ? <div className={styles.subjectAction}>{action}</div> : null}
  </article>;
}

export function SubjectTileSkeleton() {
  return <div className={styles.subjectTileSkeleton} aria-hidden="true"><Skeleton className={styles.subjectCharacterSkeleton} height="4rem" width="4rem" /><div><Skeleton height="1rem" width="12rem" /><Skeleton height="1.35rem" width="16rem" /><Skeleton height="1rem" width="8rem" /></div></div>;
}
