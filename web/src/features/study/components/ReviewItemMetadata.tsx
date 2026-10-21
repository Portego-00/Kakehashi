import { BookOpen } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import styles from "../study.module.css";

export function ReviewItemMetadata({ level, srsStage, hideText = false }: {
  level: number;
  srsStage?: number;
  hideText?: boolean;
}) {
  return <div className={styles.reviewPromptMetadata} aria-label="Question status">
    <span>{hideText ? <><span className="sr-only">Level </span>{level}</> : `Level ${level}`}</span>
    {srsStage !== undefined ? <>
      {hideText ? <span aria-hidden="true">-</span> : null}
      <span>
        {srsStage === 0 ? <BookOpen size={16} aria-hidden="true" /> : <SrsStageIcon stage={srsStage} size={16} />}
        <span className={hideText ? "sr-only" : undefined}>{srsStageLabel(srsStage)}</span>
      </span>
    </> : null}
  </div>;
}
