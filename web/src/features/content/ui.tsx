import type { HTMLAttributes, ReactNode } from "react";
import { BookOpenText, RotateCcw } from "lucide-react";
import styles from "./content.module.css";

export function ContentHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className={styles.toolbar}>{actions}</div> : null}
    </header>
  );
}

type ContentPageVariant = "default" | "reader" | "library" | "media" | "tool";

const contentPageVariantClass: Record<ContentPageVariant, string> = {
  default: "",
  reader: styles.readerWorkspace,
  library: styles.libraryWorkspace,
  media: styles.mediaWorkspace,
  tool: styles.toolWorkspace,
};

export function ContentPage({ children, className = "", variant = "default" }: { children: ReactNode; className?: string; variant?: ContentPageVariant }) {
  return <main className={`page ${styles.workspace} ${contentPageVariantClass[variant]} ${className}`}>{children}</main>;
}

export function Panel({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`${styles.panel} ${className}`} {...props}>{children}</section>;
}

export function SectionHead({ title, detail }: { title: string; detail?: ReactNode }) {
  return <div className={styles.sectionHead}><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className={styles.empty}><BookOpenText aria-hidden="true" size={28} /><h2>{title}</h2><p>{children}</p>{action}</div>;
}

export function UndoNotice({ message, onUndo }: { message: string; onUndo: () => void }) {
  return <div className={styles.undoToast} role="status" aria-live="polite"><span>{message}</span><button type="button" onClick={onUndo}><RotateCcw size={15} aria-hidden="true" />Undo</button></div>;
}

export function Progress({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return <div className={styles.meter}><div className={styles.meterRow}><span>{label}</span><span>{percent}%</span></div><div className={styles.progressTrack} role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className={styles.progressFill} style={{ "--progress": percent / 100 } as React.CSSProperties} /></div></div>;
}

export function formatTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
