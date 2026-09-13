import { Loader2 } from "lucide-react";
import styles from "./notebooks.module.css";

export function NotebookSpinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className={styles.spinner} aria-hidden="true" />;
}

export function NotebookSidebarLoading() {
  return <div className={styles.sidebarLoading} role="status" aria-label="Loading notebook pages…">
    <span className="sr-only">Loading notebook pages…</span>
    <div className={styles.skeletonSection} aria-hidden="true" />
    {Array.from({ length: 5 }, (_, index) => <div key={index} className={styles.skeletonRow} data-nested={index === 1 || index === 2} aria-hidden="true">
      <span className={styles.skeletonIcon} /><span className={styles.skeletonPageName} />
    </div>)}
  </div>;
}

export function NotebookEditorLoading({ label = "Opening editor…" }: { label?: string }) {
  return <div className={styles.editorLoading} role="status" aria-label={label}>
    <p className={styles.loadingCaption}><NotebookSpinner />{label}</p>
    <div className={styles.skeletonWriting} aria-hidden="true">
      <span /><span /><span /><span />
    </div>
  </div>;
}

export function NotebookPageLoading({ label = "Loading notebook…", icon }: { label?: string; icon?: string }) {
  return <div className={styles.pageLoading} role="status" aria-label={label}>
    <div className={styles.documentToolbar} aria-hidden="true"><span className={styles.skeletonCrumb} /><span className={styles.skeletonSave} /></div>
    <div className={styles.document}>
      <p className={styles.loadingCaption}><NotebookSpinner />{label}</p>
      <div className={styles.skeletonTitle} aria-hidden="true">{icon ? <span className={styles.loadingPageIcon}>{icon}</span> : null}<span /></div>
      <div className={styles.skeletonWriting} aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
    </div>
  </div>;
}
