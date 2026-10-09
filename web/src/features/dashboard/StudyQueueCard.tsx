"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { getEnabledReviewPreset } from "../../../../src/utils/review-presets";
import { getReviewOrderLabel } from "../../../../src/utils/reviewOrdering";
import type { WebStudyPreferences } from "@/features/settings/settings";
import type { LessonSrsThresholdStatus } from "../../../../src/utils/lessonSrsThreshold";
import Image from "next/image";
import Link from "next/link";
import styles from "./dashboard.module.css";

type StudyQueueCardProps = {
  type: "lesson" | "review";
  count?: number;
  loading?: boolean;
  preview?: boolean;
  demo?: boolean;
  available?: boolean;
  lessonSrsThresholdStatus?: LessonSrsThresholdStatus;
  reviewPreferences?: WebStudyPreferences;
};

const QUEUE_ART = {
  lesson: {
    ready: "/dashboard/Lessons.png",
    empty: "/dashboard/NoLessons.png",
  },
  review: {
    ready: "/dashboard/Reviews.png",
    empty: "/dashboard/ReviewsFinished.png",
  },
} as const;

export function StudyQueueCard({ type, count = 0, loading = false, preview = false, demo = false, available = false, lessonSrsThresholdStatus, reviewPreferences }: StudyQueueCardProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const enabled = demo || available;
  const lessons = type === "lesson";
  const displayCount = Math.max(0, count);
  const blocked = lessons && !preview && !loading && Boolean(lessonSrsThresholdStatus?.isBlocked);
  const ready = preview || loading || (!blocked && displayCount > 0);
  const empty = enabled && !ready && !blocked;
  const title = lessons ? "Lessons" : "Reviews";
  const exceededGroups = lessonSrsThresholdStatus ? [
    lessonSrsThresholdStatus.apprenticeExceeded ? `Apprentice (${lessonSrsThresholdStatus.apprenticeCount}/${lessonSrsThresholdStatus.apprenticeThreshold})` : null,
    lessonSrsThresholdStatus.guruExceeded ? `Guru (${lessonSrsThresholdStatus.guruCount}/${lessonSrsThresholdStatus.guruThreshold})` : null,
  ].filter(Boolean).join(" and ") : "";
  const subtitle = blocked ? `${exceededGroups} items are over your lesson threshold.` : empty ? (lessons ? "You've done all your available lessons!" : "There are no more reviews to do right now.") : demo ? "Practice with sample progress saved in this browser." : lessons
    ? "Choose what you want to learn next."
    : enabled ? "Review your available WaniKani items." : "Main reviews are coming to the web app.";
  const art = QUEUE_ART[type][ready ? "ready" : "empty"];
  const showsPresets = !lessons && !preview && !loading && enabled && displayCount > 0 && Boolean(reviewPreferences?.reviewBatchSizeEnabled && reviewPreferences.reviewPresetsEnabled && reviewPreferences.reviewPresets.length);
  const selectedPreset = showsPresets && reviewPreferences ? getEnabledReviewPreset(reviewPreferences, selectedPresetId) : null;
  const sessionSize = Math.min(displayCount, selectedPreset?.batchSize ?? reviewPreferences?.reviewBatchSize ?? displayCount);
  const reviewHref = selectedPreset ? `/reviews?reviewPresetId=${encodeURIComponent(selectedPreset.id)}` : "/reviews";

  return (
    <article
      className={styles.queueRow}
      data-kind={type}
      data-state={blocked ? "blocked" : empty ? "empty" : demo ? "demo" : enabled ? "ready" : "coming-soon"}
      aria-busy={loading || undefined}
      aria-label={`${title} study queue${demo ? ", demo" : enabled ? "" : ", coming soon"}`}
    >
      <Image
        className={styles.queueArtwork}
        data-queue-art={ready ? "ready" : "empty"}
        src={art}
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 767px) 100px, 150px"
        loading={preview ? "lazy" : "eager"}
        draggable={false}
      />
      <div className={styles.queueContent} data-has-presets={showsPresets || undefined}>
        <div className={styles.queueTitleRow}>
          <h3>{title}</h3>
          <span className={styles.queueCountBadge} aria-live={preview ? undefined : "polite"}>
            {loading ? <span className={styles.queueCountLoading} aria-hidden /> : preview ? "—" : displayCount.toLocaleString()}
          </span>
        </div>

        <p className={styles.queueSubtitle}>{subtitle}</p>

        {showsPresets ? <div className={styles.reviewPresetChips} role="group" aria-label="Review session presets">{reviewPreferences!.reviewPresets.map((preset) => <button key={preset.id} type="button" className={styles.reviewPresetChip} aria-pressed={selectedPreset?.id === preset.id} aria-label={`${preset.name}, ${preset.batchSize} reviews, ${getReviewOrderLabel(preset.reviewOrder)}`} onClick={() => setSelectedPresetId(preset.id)}>{selectedPreset?.id === preset.id ? <Check size={12} aria-hidden /> : null}<span>{preset.name}</span><span>· {preset.batchSize}</span></button>)}</div> : null}

        <div className={styles.queueBottom}>
          {blocked ? <p className={styles.queueEmptyMessage}>Complete reviews to unlock lessons.</p> : empty ? <p className={styles.queueEmptyMessage}>{lessons ? "No lessons available right now." : "All caught up!"}</p> : loading && enabled && !preview ? <button className={styles.queueAction} type="button" disabled>Loading…</button> : enabled && lessons && !preview ? <><Link className={styles.queueAction} href="/lessons">{demo ? "Try lessons" : "Start lessons"}</Link><Link className={styles.queueAction} href="/lesson-picker">Pick lessons</Link></> : enabled && !preview ? <Link className={styles.queueAction} href={reviewHref}>{showsPresets ? `Start ${sessionSize} reviews` : demo ? "Try reviews" : "Start reviews"}</Link> : preview
            ? <span className={styles.queueAction} aria-disabled="true">Coming soon</span>
            : <button className={styles.queueAction} type="button" disabled>Coming soon</button>}
          {showsPresets ? <div className={styles.reviewPresetDetail}><span>{getReviewOrderLabel(selectedPreset?.reviewOrder ?? reviewPreferences!.reviewOrder)}</span>{selectedPreset ? <button type="button" onClick={() => setSelectedPresetId(null)}>Use default</button> : null}</div> : null}
        </div>
      </div>
    </article>
  );
}
