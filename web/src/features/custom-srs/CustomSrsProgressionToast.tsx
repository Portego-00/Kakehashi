"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import type { CustomSrsStage } from "./types";
import styles from "./CustomSrsProgressionToast.module.css";

export type CustomSrsProgression = {
  startingStage: CustomSrsStage;
  endingStage: CustomSrsStage;
  nextReviewInterval: string;
};

export function CustomSrsProgressionToast({ progression, mode, onDismiss }: {
  progression: CustomSrsProgression | null;
  mode: "normal" | "compact" | "hidden";
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!progression || mode === "hidden") return;
    const timeout = window.setTimeout(onDismiss, 3_000);
    return () => window.clearTimeout(timeout);
    // Object identity intentionally represents a new event, including two words reaching the same stage.
  }, [progression, mode, onDismiss]);

  if (!progression || mode === "hidden" || typeof document === "undefined") return null;

  const nextReview = progression.endingStage >= 9
    ? "No more reviews"
    : progression.nextReviewInterval === "Now"
      ? "Review available now"
      : progression.nextReviewInterval === "Scheduled"
        ? "Next review scheduled"
        : `Next review in ${progression.nextReviewInterval}`;

  return createPortal(
    <aside className={styles.toast} data-mode={mode} role="status" aria-label="SRS progression" aria-live="polite" aria-atomic="true">
      <SrsStageIcon className={styles.stageIcon} stage={progression.endingStage} size={mode === "compact" ? 24 : 32} />
      <div className={styles.copy}>
        <p className={styles.stage}>
          {mode === "normal" ? <span className={styles.previousStage}>{srsStageLabel(progression.startingStage)} → </span> : null}
          <strong>{srsStageLabel(progression.endingStage)}</strong>
        </p>
        <p className={styles.nextReview}>{nextReview}</p>
      </div>
      <button className={styles.dismiss} type="button" aria-label="Dismiss SRS progression" onClick={onDismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </aside>,
    document.body,
  );
}
