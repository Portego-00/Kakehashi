"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { AnalyticsCartesianChart } from "./AnalyticsCharts";
import styles from "../analytics.module.css";

export const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export const formatPercent = (value: number | null | undefined) => value == null ? "No data" : `${formatNumber(value)}%`;
export const formatDays = (value: number | null | undefined) => value == null ? "No data" : `${formatNumber(value)} days`;
export const formatDate = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Not yet available";

export function AnalyticsDialog({ title, children, onClose, className, bodyClassName }: { title: string; children: ReactNode; onClose: () => void; className?: string; bodyClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
    return () => {
      dialog?.close?.();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${className ?? ""}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogSheet}>
      <header className={styles.dialogHead}><h2 id={titleId}>{title}</h2><button type="button" className={styles.iconButton} aria-label={`Close ${title}`} title="Close" onClick={onClose} autoFocus><X size={19} aria-hidden /></button></header>
      <div className={`${styles.dialogBody} ${bodyClassName ?? ""}`}>{children}</div>
    </div>
  </dialog>;
}

export function Segments<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className={styles.segments} role="group" aria-label={label}>{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export function Metric({ label, value, detail, tone, primary = false }: { label: string; value: ReactNode; detail?: ReactNode; tone?: string; primary?: boolean }) {
  return <div className={styles.metric} data-tone={tone} data-primary={primary || undefined}><dt>{label}</dt><dd>{value}</dd>{detail ? <small>{detail}</small> : null}</div>;
}

export function AnalyticsInfo({ label = "About these numbers", children }: { label?: string; children: ReactNode }) {
  return <details className={styles.infoDisclosure}><summary><Info size={14} aria-hidden />{label}</summary><div>{children}</div></details>;
}

export function Meter({ value, max = 100, label, tone = "accent" }: { value: number; max?: number; label: string; tone?: string }) {
  const fraction = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return <div className={styles.meter} data-tone={tone} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max || 1}><span style={{ "--fraction": fraction } as CSSProperties} /></div>;
}

export const chartToneColor = (tone = "accent") => ({
  accent: "var(--color-accent)", radical: "var(--color-radical)", kanji: "var(--color-kanji)",
  vocabulary: "var(--color-vocabulary)", kana_vocabulary: "var(--color-vocabulary)",
  apprentice: "var(--color-kanji)", guru: "var(--color-vocabulary)", master: "var(--color-accent)",
  enlightened: "var(--color-warning)", burned: "var(--color-success)", success: "var(--color-success)",
  danger: "var(--color-danger)", warning: "var(--color-warning)",
}[tone] ?? "var(--color-accent)");

export type ChartBar = { key: string; label: string; rangeLabel?: string; value: number | null; secondary?: number; detail?: string; tone?: string };

export function BarChart({ bars, label, unit = "", valueLabel = "Count", secondaryLabel, kind = "bar", onSelect, selectedKey }: { bars: ChartBar[]; label: string; unit?: string; valueLabel?: string; secondaryLabel?: string; kind?: "bar" | "area" | "line"; onSelect?: (key: string) => void; selectedKey?: string | null }) {
  const hasSecondary = bars.some((bar) => bar.secondary != null);
  return <AnalyticsCartesianChart
    label={label}
    kind={kind}
    data={bars.map((bar) => ({ key: bar.key, label: bar.label, value: bar.value, secondary: bar.secondary ?? null, detail: bar.detail, color: chartToneColor(bar.tone) }))}
    series={[{ key: "value", label: valueLabel, color: chartToneColor(bars[0]?.tone) }, ...(hasSecondary ? [{ key: "secondary", label: secondaryLabel ?? "Other", color: chartToneColor("kanji") }] : [])]}
    stacked={hasSecondary}
    valueFormat={(value) => `${formatNumber(value)}${unit}`}
    onSelect={onSelect}
    selectedKey={selectedKey}
  />;
}

export function EmptyAnalytics({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export function PagedBarChart({ bars, pageSize, interval, anchor = "end", ...props }: { bars: ChartBar[]; pageSize: number; interval: "days" | "months"; anchor?: "start" | "end" } & Omit<Parameters<typeof BarChart>[0], "bars">) {
  // Keep the viewed date anchored when expansion changes the number of visible bars.
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const anchorIndex = anchorKey === null ? -1 : bars.findIndex((bar) => bar.key === anchorKey);
  const boundary = anchorIndex >= 0 ? anchorIndex : anchor === "end" ? bars.length - 1 : 0;
  const end = anchor === "end" ? boundary + 1 : Math.min(bars.length, boundary + pageSize);
  const start = anchor === "end" ? Math.max(0, end - pageSize) : boundary;
  const visible = bars.slice(start, end);
  const earlier = () => {
    const index = anchor === "end" ? start - 1 : Math.max(0, start - pageSize);
    setAnchorKey(anchor === "start" && index === 0 ? null : bars[index].key);
  };
  const later = () => {
    const index = anchor === "end" ? Math.min(bars.length - 1, end + pageSize - 1) : end;
    setAnchorKey(anchor === "end" && index === bars.length - 1 ? null : bars[index].key);
  };
  if (!bars.length) return <EmptyAnalytics>No records in this period.</EmptyAnalytics>;
  return <div className={styles.pagedChart}>
    <BarChart {...props} bars={visible} />
    {start > 0 || end < bars.length ? <div className={styles.pagination}><span>{visible[0].rangeLabel ?? visible[0].label} – {visible.at(-1)!.rangeLabel ?? visible.at(-1)!.label} · {bars.length} {interval}</span><button type="button" className={styles.iconButton} title={`Earlier ${interval}`} aria-label={`Earlier ${props.label}`} disabled={start === 0} onClick={earlier}><ChevronLeft size={16} aria-hidden /></button><button type="button" className={styles.iconButton} title={`Later ${interval}`} aria-label={`Later ${props.label}`} disabled={end === bars.length} onClick={later}><ChevronRight size={16} aria-hidden /></button></div> : null}
  </div>;
}
