import Image from "next/image";
import styles from "./dashboard.module.css";

type StudyQueueCardProps = {
  type: "lesson" | "review";
  count?: number;
  loading?: boolean;
  preview?: boolean;
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

export function StudyQueueCard({ type, count = 0, loading = false, preview = false }: StudyQueueCardProps) {
  const lessons = type === "lesson";
  const displayCount = Math.max(0, count);
  const ready = preview || loading || displayCount > 0;
  const title = lessons ? "Lessons" : "Reviews";
  const subtitle = lessons
    ? "Main lessons are coming to the web app."
    : "Main reviews are coming to the web app.";
  const art = QUEUE_ART[type][ready ? "ready" : "empty"];

  return (
    <article
      className={styles.queueRow}
      data-kind={type}
      data-state="coming-soon"
      aria-busy={loading || undefined}
      aria-label={`${title} study queue, coming soon`}
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
      <div className={styles.queueContent}>
        <div className={styles.queueTitleRow}>
          <h3>{title}</h3>
          <span className={styles.queueCountBadge} aria-live={preview ? undefined : "polite"}>
            {loading ? <span className={styles.queueCountLoading} aria-hidden /> : preview ? "—" : displayCount.toLocaleString()}
          </span>
        </div>

        <p className={styles.queueSubtitle}>{subtitle}</p>

        <div className={styles.queueBottom}>
          {preview
            ? <span className={styles.queueAction} aria-disabled="true">Coming soon</span>
            : <button className={styles.queueAction} type="button" disabled>Coming soon</button>}
        </div>
      </div>
    </article>
  );
}
