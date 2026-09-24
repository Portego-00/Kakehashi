import { ArrowDown, ArrowRight, ArrowUp, Check } from "lucide-react";
import type { ReactNode } from "react";
import type { BunproProgression as Progression } from "./progression";
import { BUNPRO_STAGES } from "./analytics";
import { BunproStageIcon } from "./BunproStageIcon";
import styles from "@/features/core-study/srs-progression.module.css";
export function BunproProgression({ progression: savedProgression, mode, idleContent }: { progression: Progression | null; mode: "normal" | "compact" | "hidden"; idleContent?: ReactNode }) {
  if (mode === "hidden") return idleContent;
  const progression = savedProgression?.to ? savedProgression : null;
  const stageColor = BUNPRO_STAGES.find(stage => progression?.to.toLowerCase().startsWith(stage.key))?.color ?? "var(--color-bunpro)";
  const Icon = progression?.direction === "up" ? ArrowUp : progression?.direction === "down" ? ArrowDown : Check;
  return <div className={styles.slot} data-srs-progression-slot data-mode={mode} data-progression-visible={Boolean(progression)}>
    {progression ? <aside className={styles.notice} data-mode={mode} role="status" aria-label="Bunpro SRS progression"><BunproStageIcon color={stageColor} size={mode === "compact" ? 24 : 30} /><div className={styles.text}><div className={styles.stageChange}>{progression.from ? <><span className={styles.previousStage}>{progression.from}</span><ArrowRight size={13} aria-hidden /></> : null}<strong>{progression.to}</strong></div><span className={styles.direction} data-direction={progression.direction}><Icon size={14} aria-hidden />{progression.title} · {progression.direction === "up" ? "SRS up" : progression.direction === "down" ? "SRS down" : progression.direction === "same" ? "SRS unchanged" : "Saved to Bunpro"}{progression.nextReview ? <span className={styles.interval}> · Next review {progression.nextReview}</span> : null}</span></div></aside> : <div className={styles.idle}>{idleContent}</div>}
  </div>;
}
