"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Calculator, Info, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { SpacedRepetitionSystem } from "@/types/wanikani";
import { calculateWorkloadForecast, solveReviewBudget, type ReviewBudgetResult } from "../analytics-forecast";
import { analyticsDayKey } from "../analytics-insights";
import { AnalyticsInfo, BarChart, EmptyAnalytics, Metric, Segments, formatDate, formatNumber, formatPercent } from "./AnalyticsPrimitives";
import { SubjectRows, type AnalyticsWidgetProps } from "./AnalyticsWidgets";
import styles from "../analytics.module.css";
import forecastStyles from "../analytics-forecast.module.css";

const HORIZONS = [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "180", label: "180 days" }] as const;
const LESSON_PRESETS = [0, 5, 10, 15, 20, 30];
const clamp = (value: number, minimum: number, maximum: number) => Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum;

type ForecastProps = AnalyticsWidgetProps & { systems: SpacedRepetitionSystem[]; secondsPerReview?: number; systemsLoading?: boolean };

export function ForecastWidget({ insights, assignments, subjects, statistics, level, systems, expanded, secondsPerReview, systemsLoading = false, asOf }: ForecastProps) {
  const [mountedAt] = useState(() => new Date());
  const now = asOf ?? mountedAt;
  const recentLessonPace = useMemo(() => {
    const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
    return Math.round(assignments.filter(({ data }) => !data.hidden && data.started_at && Date.parse(data.started_at) >= sevenDaysAgo && Date.parse(data.started_at) <= now.getTime()).length / 7);
  }, [assignments, now]);
  const [horizon, setHorizon] = useState<"7" | "30" | "90" | "180">("30");
  const [grouping, setGrouping] = useState<"daily" | "weekly">("daily");
  const [lessonMode, setLessonMode] = useState("recent");
  const [customLessons, setCustomLessons] = useState(recentLessonPace);
  const [customAccuracy, setCustomAccuracy] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [budget, setBudget] = useState(100);
  const [budgetResult, setBudgetResult] = useState<{ parameters: Parameters<typeof calculateWorkloadForecast>[0]; budget: number; result: ReviewBudgetResult } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const lessonPace = lessonMode === "recent" ? recentLessonPace : lessonMode === "custom" ? customLessons : Number(lessonMode);
  const accuracy = customAccuracy ?? insights.lifetimeAccuracy.percentage ?? 90;
  const parameters = useMemo(() => ({ assignments, subjects, statistics, systems, now, currentLevel: level, horizonDays: Number(horizon), lessonsPerDay: lessonPace, accuracyPercent: accuracy, paceDays: insights.levelPace.median }), [assignments, subjects, statistics, systems, now, level, horizon, lessonPace, accuracy, insights.levelPace.median]);
  const deferredParameters = useDeferredValue(parameters);
  const forecast = useMemo(() => calculateWorkloadForecast(deferredParameters), [deferredParameters]);
  const isUpdating = parameters !== deferredParameters;
  const solution = budgetResult?.parameters === parameters && budgetResult.budget === budget ? budgetResult.result : null;
  const buckets = grouping === "daily" ? forecast.daily : forecast.weekly;
  const selected = buckets.find((day) => day.key === selectedKey);
  const selectedIndex = selected ? buckets.indexOf(selected) : -1;
  const knownSubjectIds = useMemo(() => {
    const lastDay = forecast.daily.at(-1);
    if (!selected || !lastDay) return new Set<number>();
    const selectedUntil = new Date(selected.date);
    selectedUntil.setDate(selectedUntil.getDate() + (grouping === "weekly" ? 7 : 1));
    const horizonUntil = new Date(lastDay.date);
    horizonUntil.setDate(horizonUntil.getDate() + 1);
    const periodEnd = Math.min(selectedUntil.getTime(), horizonUntil.getTime());
    const result = new Set<number>();
    for (const assignment of assignments) {
      if (assignment.data.hidden || !assignment.data.available_at || assignment.data.srs_stage < 1 || assignment.data.srs_stage >= 9) continue;
      const due = Math.max(now.getTime(), Date.parse(assignment.data.available_at));
      if (due >= selected.date.getTime() && due < periodEnd) result.add(assignment.data.subject_id);
    }
    return result;
  }, [assignments, selected, grouping, now, forecast.daily]);
  const matchingSubjects = subjects.filter((subject) => knownSubjectIds.has(subject.id));
  const bars = buckets.map((day) => ({ key: day.key, label: day.date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), value: day.knownReviews, secondary: Math.round(day.modeledReviews), detail: `${Math.round(day.reviews)} total; ${day.lessons} lessons`, tone: "accent" }));
  const setLessonPace = (value: number) => { setCustomLessons(clamp(Math.round(value), 0, 60)); setLessonMode("custom"); };
  return <div className={forecastStyles.forecast} data-expanded={expanded || undefined}>
    <dl className={`${styles.metrics} ${forecastStyles.metrics}`} data-with-time={Boolean(secondsPerReview && secondsPerReview > 0) || undefined} aria-live="polite" aria-busy={isUpdating}>
      <Metric label="Estimated reviews / day" value={formatNumber(forecast.averageDailyReviews)} primary />
      <Metric label="Due now" value={formatNumber(insights.forecast.dueNow)} />
      <Metric label="Estimated peak" value={formatNumber(forecast.peakDailyReviews)} />
      {secondsPerReview && secondsPerReview > 0 ? <Metric label="Daily review time" value={`${Math.round(forecast.averageDailyReviews * secondsPerReview / 60)} min`} detail="Estimated" /> : null}
    </dl>
    <div className={forecastStyles.planningControls}>
      <Segments label="Forecast horizon" value={horizon} options={HORIZONS} onChange={(value) => { setHorizon(value); if (Number(value) > 30) setGrouping("weekly"); setSelectedKey(null); }} />
      <div className={`${styles.controls} ${forecastStyles.lessonControls}`}><label>Lessons / day<select aria-label="Daily lesson plan" value={lessonMode} onChange={(event) => setLessonMode(event.target.value)}><option value="recent">Recent pace ({recentLessonPace})</option>{LESSON_PRESETS.map((count) => <option key={count} value={count}>{count === 0 ? "Pause new lessons" : `${count} per day`}</option>)}<option value="custom">Custom</option></select></label>
        {lessonMode === "custom" ? <label>Daily lessons<input type="number" min={0} max={60} step={1} value={customLessons} onChange={(event) => setLessonPace(Number(event.target.value))} /></label> : null}</div>
    </div>
    {systemsLoading ? <p className={styles.notice} role="status">Loading review intervals. Scheduled reviews are available now.</p> : null}
    {forecast.incompleteSystems && !systemsLoading ? <p className={styles.notice}><Info size={16} aria-hidden />Some review intervals are unavailable. The forecast includes known dates, but future estimates may be incomplete.</p> : null}
    <div className={forecastStyles.chartControls}><Segments label="Forecast grouping" value={grouping} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} onChange={(value) => { setGrouping(value); setSelectedKey(null); }} /></div>
    <BarChart kind="area" bars={bars} label={`${grouping === "daily" ? "Daily" : "Weekly"} review forecast`} valueLabel="Scheduled" secondaryLabel="Modeled" selectedKey={showDetails ? selectedKey : null} onSelect={(key) => { setSelectedKey(key); setShowDetails(true); }} />
    {selected && showDetails ? <div className={forecastStyles.dayDetail}>
      <div className={styles.rowHead}><strong>{grouping === "weekly" ? "Week of " : ""}{formatDate(selected.date.toISOString())}</strong><button type="button" className={styles.iconButton} aria-label="Close forecast detail" title="Close detail" onClick={() => setShowDetails(false)}><X size={16} /></button></div>
      <dl className={styles.metrics}><Metric label="Scheduled" value={formatNumber(selected.knownReviews)} /><Metric label="Modeled" value={formatNumber(selected.modeledReviews)} /><Metric label="Planned lessons" value={formatNumber(selected.lessons)} /><Metric label="Expected burns" value={formatNumber(selected.expectedBurns)} /></dl>
      <div className={styles.controls}><label>Period<select aria-label="Selected forecast period" value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>{buckets.map((day, index) => <option key={day.key} value={day.key}>{grouping === "weekly" ? `Week ${index + 1}: ` : ""}{formatDate(day.date.toISOString())}</option>)}</select></label><span className={styles.note}>{selectedIndex + 1} / {buckets.length}</span></div>
      {matchingSubjects.length ? <SubjectRows key={`${grouping}:${selected.key}`} subjects={matchingSubjects} assignments={assignments} limit={expanded ? 15 : 5} /> : <EmptyAnalytics>No currently scheduled items in this period.</EmptyAnalytics>}
    </div> : null}
    <details className={forecastStyles.scenario}>
      <summary><SlidersHorizontal size={15} aria-hidden />Accuracy and budget<span>{formatPercent(accuracy)}</span></summary>
      <div className={`${styles.controls} ${forecastStyles.scenarioControls}`}>
        <label className={forecastStyles.accuracy}>Accuracy<input aria-label="Forecast answer accuracy" type="range" min={1} max={100} step={1} value={accuracy} onChange={(event) => setCustomAccuracy(Number(event.target.value))} /><output>{formatPercent(accuracy)}</output></label>
        {customAccuracy !== null ? <button type="button" className={styles.iconButton} aria-label="Reset forecast accuracy" title="Use lifetime accuracy" onClick={() => setCustomAccuracy(null)}><RotateCcw size={16} /></button> : null}
      </div>
      <div className={`${styles.controls} ${forecastStyles.budget}`}><label>Review budget / day<input aria-label="Daily review budget" type="number" min={0} max={2000} step={10} value={budget} onChange={(event) => setBudget(clamp(Number(event.target.value), 0, 2000))} /></label><button type="button" className={styles.textButton} disabled={systemsLoading || !systems.length} onClick={() => setBudgetResult({ parameters, budget, result: solveReviewBudget(parameters, budget) })}><Calculator size={16} aria-hidden />Calculate lesson pace</button></div>
      {solution ? <div role="status" className={forecastStyles.budgetResult}>{solution.achievable ? <><strong>{solution.lessonsPerDay} lessons / day</strong><span>{formatNumber(solution.averageDailyReviews)} estimated reviews / day, with a peak of {formatNumber(solution.peakDailyReviews)}.</span><span>{formatNumber(solution.forecast.totalLessons)} lessons fit the available curriculum over this period.</span><button type="button" className={styles.textButton} onClick={() => setLessonPace(solution.lessonsPerDay)}>Apply lesson pace</button></> : <><strong>Existing reviews exceed this budget</strong><span>With new lessons paused, the estimate is {formatNumber(solution.averageDailyReviews)} reviews / day. A budget above this average leaves room for new lessons.</span><button type="button" className={styles.textButton} onClick={() => setLessonMode("0")}>Pause new lessons in forecast</button></>}</div> : null}
    </details>
    <AnalyticsInfo label="Forecast assumptions"><div className={forecastStyles.assumptions}><p>{formatNumber(forecast.knownReviews)} scheduled + {formatNumber(forecast.modeledReviews)} modeled reviews · {formatNumber(forecast.totalLessons)} planned lessons across {horizon} days. Modeled reviews include estimated repeats and new lessons.</p><ul>{forecast.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>{insights.lifetimeAccuracy.percentage === null && customAccuracy === null ? <p>No lifetime accuracy is available; this scenario starts at 90%.</p> : null}<p>Upcoming dates are sourced from current assignments as of {analyticsDayKey(now)}. Estimates change with lesson choices, mistakes, and review delays.</p></div></AnalyticsInfo>
  </div>;
}
