"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Assignment } from "@/types/wanikani";
import { downloadAnalyticsFile } from "../analytics-export";
import { MAX_SRS_BACKUP_BYTES, useSrsSnapshots } from "../analytics-snapshots";
import { analyticsDayKey } from "../analytics-insights";
import { chartToneColor, Metric, Segments, formatDate, formatNumber } from "./AnalyticsPrimitives";
import { AnalyticsCartesianChart, type AnalyticsChartDatum } from "./AnalyticsCharts";
import styles from "../analytics.module.css";

export function SrsHistoryWidget({ accountKey, assignments, enabled = true }: { accountKey: string; assignments: Assignment[]; enabled?: boolean }) {
  const history = useSrsSnapshots(accountKey, assignments, enabled);
  const [range, setRangeValue] = useState("30");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const setRange = (value: string) => { setRangeValue(value); setSelectedDate(null); };
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(range) + 1); cutoff.setHours(0, 0, 0, 0);
  const snapshots = history.snapshots.filter((snapshot) => new Date(`${snapshot.date}T00:00:00`) >= cutoff);
  const selected = selectedDate == null ? snapshots.at(-1) : snapshots.find((snapshot) => snapshot.date === selectedDate);
  const stages = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;
  const chartData: AnalyticsChartDatum[] = [];
  const byDate = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot]));
  if (snapshots.length) {
    const day = new Date(`${snapshots[0].date}T00:00:00`);
    const last = snapshots.at(-1)!.date;
    // Calendar slots preserve elapsed time and break the area across unobserved days.
    while (analyticsDayKey(day) <= last) {
      const key = analyticsDayKey(day);
      const snapshot = byDate.get(key);
      chartData.push({ key, label: day.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), detail: snapshot ? key : `${key}: no snapshot recorded`, ...Object.fromEntries(stages.map((stage) => [stage, snapshot?.stages[stage] ?? null])) });
      day.setDate(day.getDate() + 1);
    }
  }
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > MAX_SRS_BACKUP_BYTES) throw new Error("The snapshot backup is too large (maximum 500 KB).");
      const result = history.importBackup(await file.text());
      setIsError(false); setMessage(`Backup imported. ${result.snapshots.length} daily snapshots available.`);
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "The snapshot backup could not be imported."); }
    if (fileInput.current) fileInput.current.value = "";
  };
  return <section className={styles.chartSection} aria-label="Recorded SRS history">
    <div className={styles.controls}><strong>Recorded SRS history</strong><Segments label="SRS history range" value={range} onChange={setRange} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }]} /><div className={styles.toolbarActions}><button type="button" className={styles.iconButton} aria-label="Export SRS snapshots" title="Export snapshot backup" disabled={!history.snapshots.length} onClick={() => downloadAnalyticsFile(history.exportBackup(), "kakehashi-srs-snapshots.json", "application/json")}><Download size={17} /></button><button type="button" className={styles.iconButton} aria-label="Import SRS snapshots" title="Import snapshot backup" onClick={() => fileInput.current?.click()}><Upload size={17} /></button><input ref={fileInput} type="file" accept="application/json,.json" aria-label="SRS snapshot backup file" hidden onChange={(event) => void importFile(event.target.files?.[0])} /></div></div>
    <p className={styles.note}>Daily counts saved on this device. History begins with your first recorded snapshot; missing days are not reconstructed.</p>
    {history.persistence === "memory" ? <p className={styles.notice} role="status">Browser storage is unavailable. Keep a backup to retain these snapshots after this visit.</p> : null}
    {message ? <p className={styles.notice} role={isError ? "alert" : "status"}>{message}</p> : null}
    {snapshots.length > 1 ? <AnalyticsCartesianChart kind="area" stacked label="Recorded SRS stages" data={chartData} series={stages.map((stage) => ({ key: stage, label: stage, color: chartToneColor(stage.toLowerCase()) }))} selectedKey={selectedDate ?? selected?.date ?? null} onSelect={setSelectedDate} /> : <p className={styles.empty}>{snapshots.length ? "Your first daily snapshot is recorded. Return on another day to see the change." : "No snapshots have been recorded yet."}</p>}
    {selectedDate && !selected ? <p className={styles.note}>No snapshot recorded for {formatDate(`${selectedDate}T00:00:00`)}.</p> : null}
    {selected ? <><p className={styles.note}>{formatDate(`${selected.date}T00:00:00`)}</p><dl className={styles.metrics}>{Object.entries(selected.stages).filter(([stage]) => stage !== "Locked").map(([stage, count]) => <Metric key={stage} label={stage} value={formatNumber(count)} />)}</dl></> : null}
  </section>;
}
