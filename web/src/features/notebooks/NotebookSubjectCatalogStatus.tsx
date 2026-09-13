import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/States";
import styles from "./subject-catalog.module.css";

export interface NotebookSubjectCatalogProps {
  subjectsLoading?: boolean;
  subjectsError?: string | null;
  onRetrySubjects?: () => void;
}

export default function NotebookSubjectCatalogStatus({ subjectsLoading = false, subjectsError, onRetrySubjects, loadingLabel = "Loading subjects…", errorLabel = "Subjects could not be loaded.", rows = 3, compact = false }: NotebookSubjectCatalogProps & {
  loadingLabel?: string;
  errorLabel?: string;
  rows?: number;
  compact?: boolean;
}) {
  if (!subjectsLoading && !subjectsError) return null;
  return <div className={styles.state} data-compact={compact || undefined}>
    {subjectsLoading ? <>
      <p role="status">{loadingLabel}</p>
      {rows > 0 ? <div className={styles.skeletons} aria-hidden="true">{Array.from({ length: rows }, (_, index) => <div key={index} className={styles.row}>
        <Skeleton width={compact ? "2rem" : "3rem"} height={compact ? "2rem" : "3rem"} />
        <div className={styles.lines}><Skeleton width={`${64 + index % 2 * 15}%`} height=".65rem" /><Skeleton width={`${38 + index % 3 * 10}%`} height=".5rem" /></div>
      </div>)}</div> : null}
    </> : <div className={styles.error}>
      <p role="status">{errorLabel}</p>
      {onRetrySubjects ? <button type="button" onClick={onRetrySubjects}><RefreshCw size={14} aria-hidden />Retry subjects</button> : null}
    </div>}
  </div>;
}
