"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronDown, Copy, Download, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { calculateLevelTimings, summarizeLevelTimings, type LevelProgressionLike } from "../calculations";
import { calculateLevelProjection } from "../analytics-insights";
import { levelPaceQuartiles, requiredLevelPace } from "../analytics-planning";
import { createProjectionCurves, type ProjectionScenario } from "../analytics-projection-chart";
import { LevelProjectionChart } from "./LevelProjectionChart";
import { createDefaultPaceSettings, paceSettingsStorageKey, parsePaceSettings, type AnalyticsPaceSettings } from "../analytics-pace-settings";
import { createPaceChartImage } from "../analytics-pace-export";
import { downloadAnalyticsFile, projectionsCalendar } from "../analytics-export";
import { BarChart, Segments, formatDate, formatDays, formatNumber } from "./AnalyticsPrimitives";
import type { AnalyticsWidgetProps } from "./AnalyticsWidgets";
import styles from "../analytics.module.css";
import planningStyles from "../analytics-planning.module.css";

export { ForecastWidget } from "./AnalyticsForecast";

type PaceWidgetProps = AnalyticsWidgetProps & { accountKey: string; progressions: LevelProgressionLike[]; resetCount: number };

export function PaceWidget(props: PaceWidgetProps) {
  return <AccountPaceWidget key={props.accountKey} {...props} />;
}

function AccountPaceWidget({ level, progressions, resetCount, expanded, asOf, accountKey }: PaceWidgetProps) {
  const [settings, setSettings] = useState(createDefaultPaceSettings);
  const [ready, setReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [exporting, setExporting] = useState<"copy" | "download" | null>(null);
  const [exportNotice, setExportNotice] = useState("");
  const { paceOverride: pace, goalLevel: goal, origin, targetDate: goalDate, clipOutliers } = settings;
  const excluded = useMemo(() => new Set(settings.excludedLevels), [settings.excludedLevels]);
  const [showTable, setShowTable] = useState(false);
  const [compare, setCompare] = useState(true);
  const [mountedAt] = useState(() => new Date());
  const now = asOf ?? mountedAt;
  const storageKey = paceSettingsStorageKey(accountKey);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setSettings(parsePaceSettings(localStorage.getItem(storageKey))); }
      catch { setStorageNotice("Browser storage is unavailable. Pace changes will last for this visit."); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const saveSettings = (next: AnalyticsPaceSettings) => {
    setSettings(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageNotice(""); }
    catch { setStorageNotice("Pace updated for this visit. Browser storage is unavailable."); }
  };
  const setPace = (value: number | null) => saveSettings({ ...settings, paceOverride: value, scenario: value == null ? "median" : "custom" });
  const setGoal = (value: number) => saveSettings({ ...settings, goalLevel: value });
  const setOrigin = (value: AnalyticsPaceSettings["origin"]) => saveSettings({ ...settings, origin: value });
  const setGoalDate = (value: string) => saveSettings({ ...settings, targetDate: value });
  const setClipOutliers = (value: boolean) => saveSettings({ ...settings, clipOutliers: value });
  const setExcluded = (update: (current: Set<number>) => Set<number>) => saveSettings({ ...settings, excludedLevels: [...update(excluded)].sort((a, b) => a - b) });
  const timings = useMemo(() => calculateLevelTimings(origin === "unlocked" ? progressions : progressions.map((row) => ({ ...row, data: { ...row.data, unlocked_at: row.data.started_at ?? row.data.unlocked_at } })), now), [progressions, origin, now]);
  const summary = summarizeLevelTimings(timings, excluded);
  const range = levelPaceQuartiles(timings.filter((timing) => !excluded.has(timing.level) && timing.daysToPass != null).map((timing) => timing.daysToPass!));
  const scenario = settings.scenario ?? (pace == null ? "median" : "custom");
  const scenarios: ProjectionScenario[] = [
    { key: "median", label: "Typical", pace: summary.median, color: "var(--color-accent)" },
    { key: "faster", label: "Faster", pace: range?.[0] ?? null, color: "var(--color-success)" },
    { key: "relaxed", label: "Relaxed", pace: range?.[1] ?? null, color: "var(--color-warning)" },
    { key: "custom", label: "Custom", pace: pace ?? 10, color: "var(--color-vocabulary)" },
  ];
  const activeScenario = scenarios.find((item) => item.key === scenario)!;
  const actualPace = activeScenario.pace;
  const chooseScenario = (value: ProjectionScenario["key"]) => saveSettings({ ...settings, scenario: value, ...(value === "custom" && pace == null ? { paceOverride: 10 } : {}) });
  const curves = createProjectionCurves(scenarios.filter((item) => item.key === scenario || (compare && item.key !== "custom")), timings, level, goal, now);
  const projections = actualPace == null ? [] : calculateLevelProjection({ timings, currentLevel: level, paceDays: actualPace, now });
  const goalProjection = projections.find((projection) => projection.level === goal);
  const remaining = Math.max(0, goal - level);
  const goalDays = goalDate ? Math.max(0, (new Date(`${goalDate}T23:59:59`).getTime() - now.getTime()) / 86_400_000) : 0;
  const elapsed = timings.find((timing) => timing.level === level)?.activeDays ?? 0;
  const neededPace = requiredLevelPace(goalDays, remaining, elapsed);
  const rangeDates = range?.map((paceDays) => calculateLevelProjection({ timings, currentLevel: level, paceDays, now }).find((projection) => projection.level === goal)?.date);
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const toggleLevel = (value: number) => setExcluded((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  const median = summary.median;
  const plottedTimings = timings.filter((timing) => timing.daysToPass !== null);
  const exportChart = async (mode: "copy" | "download") => {
    setExporting(mode);
    setExportNotice("");
    try {
      if (mode === "copy" && (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")) throw new Error("Clipboard unavailable");
      const image = createPaceChartImage({
        levels: plottedTimings.map((timing) => ({ level: timing.level, days: timing.daysToPass!, excluded: excluded.has(timing.level) })),
        currentLevel: level, goalLevel: goal, projectedDate: goalProjection?.date ?? null, paceDays: actualPace,
        medianDays: median, clipAt: clipOutliers && median ? median * 2 : null, origin, capturedAt: now,
      });
      if (mode === "copy") await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      else downloadAnalyticsFile(await image, "kakehashi-level-pace.png");
      setExportNotice(mode === "copy" ? "Pace chart copied." : "Pace chart downloaded.");
    } catch {
      setExportNotice(mode === "copy" ? "The chart could not be copied. Download the PNG instead." : "The chart could not be downloaded. Please try again.");
    } finally { setExporting(null); }
  };
  if (!ready) return <p className={styles.note} role="status">Loading pace settings...</p>;
  const monthYear = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const hasRange = remaining > 0 && rangeDates?.[0] && rangeDates[1];
  return <div className={planningStyles.planner}>
    {storageNotice ? <p className={styles.note} role="status">{storageNotice}</p> : null}
    <div className={planningStyles.overview}>
      <div className={planningStyles.goal}><span>Level {goal} estimate</span><strong>{goal <= level ? "Goal reached" : goalProjection ? <time dateTime={goalProjection.date}>{formatDate(goalProjection.date)}</time> : "Set your pace"}</strong></div>
      <label className={planningStyles.goalControl}><span>Goal level</span><select value={goal} onChange={(event) => setGoal(Number(event.target.value))}>{Array.from({ length: 60 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
    </div>
    <dl className={planningStyles.summary}>
      <div><dt>{scenario === "median" ? "Median pace" : "Selected pace"}</dt><dd>{actualPace == null ? "No history" : <>{formatNumber(actualPace)}<span> days / level</span></>}</dd></div>
      {hasRange ? <div><dt>Typical range</dt><dd className={planningStyles.range}><time dateTime={rangeDates![0]} title={formatDate(rangeDates![0])}>{monthYear(rangeDates![0]!)}</time><span>–</span><time dateTime={rangeDates![1]} title={formatDate(rangeDates![1])}>{monthYear(rangeDates![1]!)}</time></dd></div> : null}
    </dl>
    <div className={planningStyles.scenarioControls}>
      <label><span>Pace scenario</span><select value={scenario} onChange={(event) => chooseScenario(event.target.value as ProjectionScenario["key"])}>{scenarios.map((item) => <option key={item.key} value={item.key} disabled={item.pace == null}>{item.label}</option>)}</select></label>
      <label className={planningStyles.compare}><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Compare paces</label>
    </div>
    {scenario === "custom" ? <div className={planningStyles.paceControl}><label>Days per level<strong>{formatNumber(actualPace!)}</strong><input aria-label="Days per level" type="range" min="6" max="60" step="0.5" value={actualPace!} onChange={(event) => setPace(Number(event.target.value))} /></label><button type="button" className={styles.textButton} onClick={() => setPace(null)}><RotateCcw size={14} aria-hidden />Use my median</button></div> : null}
    <LevelProjectionChart curves={curves} selected={scenario} level={level} goal={goal} now={now} targetDate={goalDate} />
    <div className={planningStyles.disclosures}>
      <details className={planningStyles.disclosure} open={expanded || undefined}>
        <summary><SlidersHorizontal size={15} aria-hidden /><span>Adjust plan</span><ChevronDown size={14} aria-hidden /></summary>
        <div className={planningStyles.options}>
    <nav className={planningStyles.milestones} aria-label="Level milestones">{[10, 20, 30, 40, 50, 60].map((milestone) => {
      const prediction = projections.find((item) => item.level === milestone);
      const passed = milestone <= level;
      const content = <><strong>L{milestone}</strong><span>{passed ? <Check size={13} aria-hidden /> : prediction ? new Date(prediction.date).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : "-"}</span></>;
      return passed ? <Link key={milestone} href={`/progress/wrapped/${milestone}`} data-state="passed" aria-label={`Level ${milestone}, reached. View level summary`}>{content}</Link> : <button key={milestone} type="button" data-state={milestone === goal ? "current" : "future"} aria-label={`Set goal to level ${milestone}${prediction ? `, estimated ${formatDate(prediction.date)}` : ""}`} aria-pressed={milestone === goal} onClick={() => setGoal(milestone)}>{content}</button>;
    })}</nav>
          {scenario !== "custom" ? <div className={planningStyles.paceControl}><label>Days per level<strong>{actualPace == null ? "No history" : formatNumber(actualPace)}</strong><input aria-label="Days per level" type="range" min="6" max="60" step="0.5" value={Math.max(6, Math.min(60, actualPace ?? 10))} onChange={(event) => setPace(Number(event.target.value))} /></label></div> : null}
          <div className={planningStyles.target}><label>Target date<input aria-label="Target completion date" type="date" min={localToday} value={goalDate} onChange={(event) => setGoalDate(event.target.value)} /></label>{neededPace != null ? <span>{formatDays(neededPace)} / level needed{neededPace < 7 ? " · SRS limits may apply" : ""}</span> : null}<Button tone="default" size="small" disabled={!projections.length} onClick={() => downloadAnalyticsFile(projectionsCalendar(projections, now, goal), "kakehashi-milestones.ics", "text/calendar;charset=utf-8")}><CalendarPlus size={15} aria-hidden />Export calendar</Button></div>
          <div className={planningStyles.settings}><Segments label="Level pace origin" value={origin} onChange={setOrigin} options={[{ value: "unlocked", label: "From unlock" }, { value: "started", label: "From first lesson" }]} /><label><input type="checkbox" checked={excluded.has(1) && excluded.has(2)} onChange={(event) => setExcluded((current) => { const next = new Set(current); for (const value of [1, 2]) { if (event.target.checked) next.add(value); else next.delete(value); } return next; })} />Exclude levels 1–2</label><label><input type="checkbox" checked={clipOutliers} onChange={(event) => setClipOutliers(event.target.checked)} />Clip outliers at twice the median</label></div>
          <details className={planningStyles.history} open={expanded || undefined}>
            <summary><span>Level history</span><span>{plottedTimings.length} completed</span><ChevronDown size={14} aria-hidden /></summary>
            <div className={planningStyles.historyContent}>
              <dl className={planningStyles.statistics}><div><dt>Median</dt><dd>{formatDays(summary.median)}</dd></div><div><dt>Average</dt><dd>{formatDays(summary.average)}</dd></div><div><dt>Fastest</dt><dd>{formatDays(summary.fastest)}</dd></div><div><dt>Included</dt><dd>{summary.count} / {plottedTimings.length}</dd></div></dl>
              <BarChart label="Level duration" unit="d" bars={plottedTimings.map((timing) => ({ key: String(timing.level), label: `L${timing.level}`, value: clipOutliers && median ? Math.min(timing.daysToPass!, median * 2) : timing.daysToPass!, tone: excluded.has(timing.level) ? "warning" : "accent", detail: `${formatDays(timing.daysToPass)}${excluded.has(timing.level) ? ", excluded" : ", included"}${clipOutliers && median && timing.daysToPass! > median * 2 ? ", bar clipped" : ""}` }))} onSelect={(key) => toggleLevel(Number(key))} />
              <div className={planningStyles.exportActions}><Button size="small" disabled={!plottedTimings.length || exporting !== null} state={exporting === "download" ? "loading" : "idle"} onClick={() => void exportChart("download")}><Download size={15} aria-hidden />Download chart PNG</Button><Button size="small" disabled={!plottedTimings.length || exporting !== null} state={exporting === "copy" ? "loading" : "idle"} onClick={() => void exportChart("copy")}><Copy size={15} aria-hidden />Copy chart image</Button></div>
              {exportNotice ? <p className={styles.note} role="status">{exportNotice}</p> : null}
            </div>
          </details>
          <button type="button" className={styles.textButton} onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>{showTable ? "Hide" : "Show"} all level dates</button>
          {showTable ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Level</th><th>Status</th><th>Date</th><th>Days from now</th></tr></thead><tbody>{projections.map((projection) => <tr key={projection.level}><td>{projection.level}</td><td>{projection.status}</td><td>{formatDate(projection.date)}</td><td>{Math.round(projection.daysFromNow)}</td></tr>)}</tbody></table></div> : null}
        </div>
      </details>
      <details className={planningStyles.disclosure}>
        <summary><Info size={15} aria-hidden /><span>About</span><ChevronDown size={14} aria-hidden /></summary>
        <div className={planningStyles.explanation}>
          <p>Dates assume the selected pace continues and account for time already spent on your current level. SRS unlocks and future mistakes can change the result.</p>
          <p>Typical uses your median completed level time. Faster and relaxed use the 25th and 75th percentiles. Lines show estimated progress between level arrivals, not guaranteed unlock dates.</p>
          {hasRange ? <p>The typical range uses the middle 50% of completed level times: {formatDate(rangeDates![0])} to {formatDate(rangeDates![1])} for level {goal}.</p> : null}
          <p>{excluded.size} levels excluded from the median.{resetCount > 0 ? ` ${resetCount} reset ${resetCount === 1 ? "attempt" : "attempts"} omitted.` : ""}</p>
        </div>
      </details>
    </div>
  </div>;
}
