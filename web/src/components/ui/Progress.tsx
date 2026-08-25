import styles from "./ui.module.css";

export function Progress({ value, max = 100, label, ariaLabel }: { value: number; max?: number; label?: string; ariaLabel?: string }) {
  const safe = Math.max(0, Math.min(max, value));
  const percent = max > 0 ? (safe / max) * 100 : 0;
  const accessibleLabel = ariaLabel || label || `Progress: ${Math.round(percent)}%`;
  return <div className="stack"><div className={styles.progressLabel}><span>{label}</span><span>{Math.round(percent)}%</span></div><div className={styles.progress} role="progressbar" aria-label={accessibleLabel} aria-valuemin={0} aria-valuemax={max} aria-valuenow={safe}><div className={styles.progressValue} style={{ "--progress": percent / 100 } as React.CSSProperties} /></div></div>;
}
