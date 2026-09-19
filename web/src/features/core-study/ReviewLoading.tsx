import { Skeleton } from "@/components/ui/States";
import study from "@/features/study/study.module.css";
import styles from "./review-loading.module.css";

/** Keep the queue, subject and answer areas in place while the first review loads. */
export function ReviewLoading() {
  return <div className={`${study.quizShell} ${styles.shell}`} data-study-session="active" role="status" aria-busy="true" aria-label="Loading reviews">
    <span className="sr-only">Loading reviews</span>
    <div className={study.quizTopbar} aria-hidden="true">
      <Skeleton width="6rem" height="1rem" />
      <Skeleton height=".375rem" />
      <div className={study.quizTopbarActions}><Skeleton width="2.75rem" height="2.75rem" /><Skeleton width="2.75rem" height="2.75rem" /></div>
    </div>
    <div className={study.questionCard} aria-hidden="true">
      <Skeleton className={styles.subject} height="6rem" />
      <Skeleton width="3.5rem" height=".75rem" />
      <div className={styles.metadata}><Skeleton width="4rem" height="1rem" /><Skeleton width="5rem" height="1rem" /></div>
    </div>
    <div className={`${study.answerArea} ${styles.answer}`} aria-hidden="true">
      <div className={styles.form}>
        <div className={styles.prompt}><Skeleton width="9rem" height=".875rem" /></div>
        <div className={styles.input}><Skeleton width="8rem" height="1rem" /><div className={styles.check}><Skeleton width="4rem" height="1rem" /></div></div>
      </div>
      <Skeleton className={styles.hint} width="10rem" height=".75rem" />
    </div>
  </div>;
}
