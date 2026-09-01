import { ArrowRight, BookOpen, CircleAlert, Cloud, FolderOpen, HardDrive, RotateCw } from "lucide-react";
import Link from "next/link";
import styles from "./dashboard.module.css";

type CustomVocabularyWidgetViewProps = {
  lessons: number | null;
  reviews: number | null;
  enrolledPacks: number | null;
  totalPacks: number | null;
  storageMode?: "cloud" | "browser";
  loading?: boolean;
  unavailable?: boolean;
  refreshing?: boolean;
  preview?: boolean;
  onRetry?: () => void;
};

type QueueCellProps = {
  label: string;
  detail: string;
  value: number | null;
  href: string;
  action: string;
  emptyAction: string;
  disabled: boolean;
  preview: boolean;
  icon: typeof BookOpen;
};

function displayCount(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function QueueCell({ label, detail, value, href, action, emptyAction, disabled, preview, icon: Icon }: QueueCellProps) {
  const linkLabel = value === 0 ? emptyAction : action;
  const actionContent = <>{linkLabel}{!disabled || preview ? <ArrowRight size={15} aria-hidden="true" /> : null}</>;

  return <div className={styles.customVocabularyCell}>
    <div className={styles.customVocabularyMetric}>
      <span><Icon size={17} aria-hidden="true" />{label}</span>
      <strong>{displayCount(value)}</strong>
    </div>
    <small>{detail}</small>
    {preview || disabled
      ? <span className={styles.customVocabularyAction} aria-disabled="true">{actionContent}</span>
      : <Link className={styles.customVocabularyAction} href={href}>{actionContent}</Link>}
  </div>;
}

export function CustomVocabularyWidgetView({
  lessons,
  reviews,
  enrolledPacks,
  totalPacks,
  storageMode = "cloud",
  loading = false,
  unavailable = false,
  refreshing = false,
  preview = false,
  onRetry,
}: CustomVocabularyWidgetViewProps) {
  const StorageIcon = storageMode === "cloud" ? Cloud : HardDrive;
  const status = loading
    ? "Loading progress"
    : unavailable
      ? "Progress unavailable"
      : storageMode === "cloud"
        ? "Cloud progress"
        : "Browser progress";
  const valuesUnavailable = loading || unavailable;

  return <section className={styles.section + " " + styles.customVocabularyWidget} aria-labelledby={preview ? undefined : "custom-vocabulary-widget-heading"} aria-busy={loading || undefined}>
    <div className={styles.customVocabularyWidgetHead}>
      <div className={styles.customVocabularyIdentity}>
        <span className={styles.customVocabularyGlyph} data-subject-type="vocabulary" lang="ja" aria-hidden="true">かな</span>
        <div>
          <h2 id={preview ? undefined : "custom-vocabulary-widget-heading"}>Custom vocabulary</h2>
          <p>Common words beyond WaniKani</p>
        </div>
      </div>
      <span className={styles.customVocabularyStorage} data-state={unavailable ? "error" : undefined}>
        {unavailable ? <CircleAlert size={15} aria-hidden="true" /> : <StorageIcon size={15} aria-hidden="true" />}
        {status}
      </span>
    </div>

    <div className={styles.customVocabularyCells} aria-live={preview ? undefined : "polite"}>
      <QueueCell
        label="Lessons"
        detail="Ready from added packs"
        value={valuesUnavailable ? null : lessons}
        href="/custom-vocabulary/lessons"
        action="Start lessons"
        emptyAction="No lessons ready"
        disabled={valuesUnavailable || lessons === 0}
        preview={preview}
        icon={BookOpen}
      />
      <QueueCell
        label="Reviews due"
        detail="Available on your schedule"
        value={valuesUnavailable ? null : reviews}
        href="/custom-vocabulary/reviews"
        action="Review now"
        emptyAction="Nothing due"
        disabled={valuesUnavailable || reviews === 0}
        preview={preview}
        icon={RotateCw}
      />
      <QueueCell
        label="Packs"
        detail={totalPacks === null ? "Curated lists available" : totalPacks.toLocaleString() + " curated " + (totalPacks === 1 ? "list" : "lists") + " available"}
        value={valuesUnavailable ? null : enrolledPacks}
        href="/custom-vocabulary"
        action="Explore packs"
        emptyAction="Explore packs"
        disabled={false}
        preview={preview}
        icon={FolderOpen}
      />
    </div>

    {unavailable && !preview && onRetry ? <div className={styles.customVocabularyError}>
      <span>Custom progress could not be reached.</span>
      <button type="button" disabled={refreshing} onClick={onRetry}>{refreshing ? "Trying again…" : "Try again"}</button>
    </div> : null}
  </section>;
}
