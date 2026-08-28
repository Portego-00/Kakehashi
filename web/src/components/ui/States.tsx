import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

type SkeletonProps = {
  height?: string;
  width?: string;
  className?: string;
};

type LoadingStateProps = {
  label: string;
  detail?: string;
  compact?: boolean;
  className?: string;
};

export function Skeleton({ height = "1rem", width, className }: SkeletonProps) {
  return <div className={cn(styles.skeleton, className)} style={{ minHeight: height, width }} aria-hidden="true" />;
}

export function LoadingState({ label, detail, compact = false, className }: LoadingStateProps) {
  return (
    <div
      className={cn(styles.loadingState, className)}
      data-compact={compact ? "true" : undefined}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <span className={styles.loadingTrack} aria-hidden="true"><span /></span>
      <span className={styles.loadingCopy}>
        <span className={styles.loadingLabel}>{label}</span>
        {detail ? <span className={styles.loadingDetail}>{detail}</span> : null}
      </span>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className={styles.empty}><div className={styles.emptyInner}><span className={styles.emptyIcon}>{icon || <Inbox size={32} />}</span><h2>{title}</h2><p>{description}</p>{action}</div></div>;
}
