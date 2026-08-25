import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
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
  const actionLabel = `Start ${title}`;
  const subtitle = loading
    ? "Checking your queue…"
    : ready
      ? lessons
        ? "We cooked up these lessons just for you."
        : "Review these items to level them up!"
      : lessons
        ? "You’ve done all your available lessons!"
        : "There are no more reviews to do right now.";
  const art = QUEUE_ART[type][ready ? "ready" : "empty"];

  return (
    <article
      className={styles.queueRow}
      data-kind={type}
      data-state={loading ? "loading" : ready ? "ready" : "empty"}
      aria-busy={loading || undefined}
      aria-label={`${title} study queue`}
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
          {ready ? (
            preview ? (
              <span className={styles.queueAction}>{actionLabel}<ChevronRight size={16} aria-hidden /></span>
            ) : (
              <ButtonLink
                className={styles.queueAction}
                href={lessons ? "/lessons" : "/reviews"}
                size="small"
                state={loading ? "loading" : "idle"}
                disabled={loading}
              >
                {actionLabel}<ChevronRight size={16} aria-hidden />
              </ButtonLink>
            )
          ) : lessons ? (
            <p className={styles.queueEmptyMessage}>No lessons available right now.</p>
          ) : (
            <span className={styles.queueAction} aria-disabled="true">{actionLabel}<ChevronRight size={16} aria-hidden /></span>
          )}
        </div>
      </div>
    </article>
  );
}
