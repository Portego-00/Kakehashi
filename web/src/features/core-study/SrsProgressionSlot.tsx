"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import styles from "./srs-progression.module.css";

export type SrsProgression = { startingStage: number; endingStage: number; nextReviewInterval: string; isCorrect: boolean; subjectId?: number };

export function SrsProgressionSlot({ progression, mode, idleContent = null }: { progression: SrsProgression | null; mode: "normal" | "compact" | "hidden"; idleContent?: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const direction = !progression || progression.endingStage === progression.startingStage ? "same" : progression.endingStage > progression.startingStage ? "up" : "down";
  const DirectionIcon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;
  const movement = direction === "down" ? -1 : 1;
  if (mode === "hidden") return idleContent;
  return <div className={styles.slot} data-srs-progression-slot data-mode={mode} data-progression-visible={Boolean(progression)}>
    {!progression && idleContent ? <div className={styles.idle}>{idleContent}</div> : null}
    <AnimatePresence>
      {progression ? <motion.aside
        key={`${progression.subjectId ?? ""}:${progression.startingStage}:${progression.endingStage}`}
        className={styles.notice}
        data-mode={mode}
        data-direction={direction}
        role="status"
        aria-label="SRS progression"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 6 * movement }}
        animate={{ opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] } }}
        exit={{ opacity: 0, y: reducedMotion ? 0 : -4 * movement, transition: { duration: reducedMotion ? 0 : 0.2, ease: [0.3, 0, 1, 1] } }}
      >
        <SrsStageIcon stage={progression.endingStage} size={mode === "compact" ? 24 : 30} />
        <div className={styles.text}>
          <div className={styles.stageChange}><span className={styles.previousStage}>{srsStageLabel(progression.startingStage)}</span><ArrowRight size={13} aria-hidden /><strong>{srsStageLabel(progression.endingStage)}</strong></div>
          <span className={styles.direction} data-direction={direction}><DirectionIcon size={14} aria-hidden />{direction === "up" ? "SRS up" : direction === "down" ? "SRS down" : "SRS unchanged"}{progression.endingStage < 9 ? <span className={styles.interval}> · Next review {progression.nextReviewInterval}</span> : null}</span>
        </div>
      </motion.aside> : null}
    </AnimatePresence>
  </div>;
}
