"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Award, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useStudyTimeRange, formatStudyTime, STUDY_TIME_CATEGORIES, type StudyTimeRangeId } from "@/features/dashboard/study-time";
import type { Assignment, ReviewStatistic, Subject } from "@/types/wanikani";
import { calculateAccuracy, srsBucketForStage, type SrsBucket } from "../calculations";
import type { AnalyticsInsights } from "../analytics-insights";
import { AnalyticsDialog, AnalyticsInfo, BarChart, EmptyAnalytics, Metric, Meter, PagedBarChart, Segments, chartToneColor, formatDate, formatDays, formatNumber, formatPercent } from "./AnalyticsPrimitives";
import { AnalyticsCartesianChart, AnalyticsDonutChart } from "./AnalyticsCharts";
import styles from "../analytics.module.css";
import layout from "../analytics-widget-layout.module.css";

export type AnalyticsWidgetProps = { insights: AnalyticsInsights; assignments: Assignment[]; subjects: Subject[]; statistics: ReviewStatistic[]; level: number; expanded?: boolean; asOf?: Date };
const TYPES = [{ value: "all", label: "All" }, { value: "radical", label: "Radicals" }, { value: "kanji", label: "Kanji" }, { value: "vocabulary", label: "Vocabulary" }] as const;
const STAGES = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;
const percent = (correct: number, incorrect: number) => correct + incorrect ? Math.round(1000 * correct / (correct + incorrect)) / 10 : null;

export function AccuracyWidget({ insights, statistics, subjects, expanded }: AnalyticsWidgetProps) {
  const [group, setGroup] = useState<"type" | "stage" | "level">("type");
  const [metric, setMetric] = useState<"overall" | "meaning" | "reading" | "effective">("overall");
  const byLevel = useMemo(() => {
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    const groups = new Map<number, ReviewStatistic[]>();
    for (const stat of statistics) {
      const subject = subjectMap.get(stat.data.subject_id);
      if (stat.data.hidden || subject?.data.hidden_at) continue;
      const level = subject?.data.level;
      if (level) groups.set(level, [...(groups.get(level) ?? []), stat]);
    }
    return [...groups].sort(([a], [b]) => a - b).map(([level, stats]) => {
      const accuracy = calculateAccuracy(stats);
      return { ...accuracy, key: String(level), label: `Level ${level}`, meaningPercentage: percent(accuracy.meaningCorrect, accuracy.meaningIncorrect), readingPercentage: percent(accuracy.readingCorrect, accuracy.readingIncorrect) };
    });
  }, [statistics, subjects]);
  const rows = group === "level" ? byLevel : group === "stage" ? insights.accuracyByStage : insights.accuracyByType;
  const a = insights.lifetimeAccuracy;
  return <>
    <dl className={styles.headlineMetrics}><Metric primary label="Overall accuracy" value={formatPercent(a.percentage)} /><Metric label="Meaning" value={formatPercent(percent(a.meaningCorrect, a.meaningIncorrect))} /><Metric label="Reading" value={formatPercent(percent(a.readingCorrect, a.readingIncorrect))} /></dl>
    <div className={styles.controls}><Segments label="Accuracy grouping" value={group} onChange={setGroup} options={[{ value: "type", label: "Type" }, { value: "stage", label: "SRS stage" }, { value: "level", label: "Level" }]} /><select aria-label="Metric" value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="overall">Overall</option><option value="meaning">Meaning</option><option value="reading">Reading</option><option value="effective">Effective</option></select></div>
    <AnalyticsCartesianChart
      label={`Accuracy by ${group}`}
      kind={group === "level" ? "line" : "horizontal-bar"}
      minHeight={group === "level" ? 220 : Math.max(160, rows.length * 28 + 36)}
      domain={[0, 100]}
      valueFormat={(value) => `${formatNumber(value)}%`}
      data={rows.map((row) => ({
        key: row.key, label: row.label,
        accuracy: metric === "meaning" ? row.meaningPercentage : metric === "reading" ? row.readingPercentage : metric === "effective" ? row.meaningPercentage == null ? null : row.readingPercentage == null ? row.meaningPercentage : row.meaningPercentage * row.readingPercentage / 100 : row.percentage,
        detail: `${formatNumber(row.correct + row.incorrect)} lifetime answers`,
        color: chartToneColor(group === "type" ? row.key : group === "stage" ? row.key.toLowerCase() : "accent"),
      }))}
      series={[{ key: "accuracy", label: metric[0].toUpperCase() + metric.slice(1), color: chartToneColor("accent") }]}
    />
    <div className={styles.rowHead}><span className={styles.note}>{formatNumber(a.correct + a.incorrect)} answers</span>{group === "level" ? <span className={styles.note}>{rows.length} levels</span> : null}</div>
    <AnalyticsInfo label="Accuracy details"><p>{formatNumber(a.correct)} correct · {formatNumber(a.incorrect)} incorrect. Lifetime answer attempts, not individual reviews.</p>{group === "stage" ? <p>Answers are grouped by each item&apos;s current SRS stage.</p> : null}{metric === "effective" ? <p>Effective accuracy estimates the chance of both answers being correct, assuming meaning and reading are independent.</p> : null}</AnalyticsInfo>
    {expanded ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Group</th><th>Meaning</th><th>Reading</th><th>Correct</th><th>Incorrect</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.label}</td><td>{formatPercent(row.meaningPercentage)}</td><td>{formatPercent(row.readingPercentage)}</td><td>{formatNumber(row.correct)}</td><td>{formatNumber(row.incorrect)}</td></tr>)}</tbody></table></div> : null}
  </>;
}

export function SubjectRows({ subjects, assignments, limit = 15 }: { subjects: Subject[]; assignments: Assignment[]; limit?: number }) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(subjects.length / limit) - 1);
  const activePage = Math.min(page, lastPage);
  const bySubject = useMemo(() => new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment])), [assignments]);
  if (!subjects.length) return <EmptyAnalytics>No items match these filters.</EmptyAnalytics>;
  return <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Item</th><th>Meaning</th><th>Level</th><th>SRS</th></tr></thead><tbody>{subjects.slice(activePage * limit, (activePage + 1) * limit).map((subject) => <tr key={subject.id}><td><Link className={styles.itemLink} href={`/subjects/${subject.id}`} data-tone={subject.object}><strong><SubjectCharacter subject={subject} imageTone="subject" /></strong></Link></td><td>{subject.data.meanings.find((meaning) => meaning.primary)?.meaning}</td><td>{subject.data.level}</td><td>{srsBucketForStage(bySubject.get(subject.id)?.data.srs_stage ?? 0)}</td></tr>)}</tbody></table></div>{lastPage > 0 ? <div className={styles.pagination}><span>{activePage * limit + 1}–{Math.min((activePage + 1) * limit, subjects.length)} of {subjects.length}</span><button type="button" className={styles.iconButton} disabled={!activePage} aria-label="Previous items" onClick={() => setPage(activePage - 1)}><ChevronLeft size={16} /></button><button type="button" className={styles.iconButton} disabled={activePage === lastPage} aria-label="Next items" onClick={() => setPage(activePage + 1)}><ChevronRight size={16} /></button></div> : null}</>;
}

export function SrsWidget({ insights, assignments, subjects, expanded }: AnalyticsWidgetProps) {
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<SrsBucket | null>(null);
  const [query, setQuery] = useState("");
  const rows = insights.srsByType.filter((row) => type === "all" || row.type === type || type === "vocabulary" && row.type === "kana_vocabulary");
  const totals = Object.fromEntries(STAGES.map((stage) => [stage, rows.reduce((sum, row) => sum + row.stages[stage], 0)])) as Record<typeof STAGES[number], number>;
  const total = STAGES.reduce((sum, stage) => sum + totals[stage], 0);
  const bySubject = new Map(assignments.filter((a) => !a.data.hidden).map((a) => [a.data.subject_id, a]));
  const filtered = subjects.filter((subject) => !subject.data.hidden_at && (type === "all" || subject.object === type || type === "vocabulary" && subject.object === "kana_vocabulary") && (!selected || srsBucketForStage(bySubject.get(subject.id)?.data.srs_stage ?? 0) === selected) && `${subject.data.characters} ${subject.data.meanings.map((m) => m.meaning).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <Segments label="SRS subject type" value={type} onChange={setType} options={TYPES} />
    <div className={layout.srsVisual}>
      <AnalyticsDonutChart
        label="SRS distribution"
        data={STAGES.map((stage) => ({ key: stage, label: stage, value: totals[stage], color: chartToneColor(stage.toLowerCase()) }))}
        centerValue={formatNumber(total)}
        centerLabel="learned"
        minHeight={180}
        selectedKey={selected}
        onSelect={(key) => setSelected(selected === key ? null : key as SrsBucket)}
      />
      <div className={layout.srsLegend}>{STAGES.map((stage) => <button type="button" key={stage} data-tone={stage.toLowerCase()} aria-label={`${stage}: ${totals[stage]} items`} aria-pressed={selected === stage} onClick={() => setSelected(selected === stage ? null : stage)}><SrsStageIcon level={stage} size={20} /><span>{stage}</span><strong>{formatNumber(totals[stage])}</strong></button>)}</div>
    </div>
    <p className={styles.note}>{formatNumber(rows.reduce((sum, row) => sum + row.stages.Locked, 0))} not started</p>
    {expanded || selected ? <><label className={styles.controls}>Search items<input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Character or meaning" /></label><SubjectRows subjects={filtered} assignments={assignments} /></> : null}
  </>;
}

export function CurrentLevelWidget({ insights, assignments, subjects, level, expanded }: AnalyticsWidgetProps) {
  const [filter, setFilter] = useState("all");
  const bySubject = new Map(assignments.filter((a) => !a.data.hidden).map((a) => [a.data.subject_id, a]));
  const kanji = subjects.filter((subject) => subject.object === "kanji" && subject.data.level === level && !subject.data.hidden_at);
  const passed = kanji.filter((subject) => Boolean(bySubject.get(subject.id)?.data.passed_at) || (bySubject.get(subject.id)?.data.srs_stage ?? 0) >= 5).length;
  const required = level >= 60 ? kanji.length : Math.ceil(kanji.length * 0.9);
  const blockers = kanji.filter((subject) => !bySubject.get(subject.id)?.data.passed_at && (bySubject.get(subject.id)?.data.srs_stage ?? 0) < 5);
  const groups = { started: blockers.filter((subject) => bySubject.get(subject.id)?.data.started_at), lessons: blockers.filter((subject) => !bySubject.get(subject.id)?.data.started_at && bySubject.get(subject.id)?.data.unlocked_at), locked: blockers.filter((subject) => !bySubject.get(subject.id)?.data.unlocked_at) };
  const filtered = filter === "all" ? blockers : groups[filter as keyof typeof groups];
  const timeline = blockers.map((subject) => ({ subject, date: bySubject.get(subject.id)?.data.available_at })).filter((item): item is { subject: Subject; date: string } => Boolean(item.date)).sort((a, b) => a.date.localeCompare(b.date));
  const remaining = Math.max(0, required - passed);
  return <>
    <dl className={styles.headlineMetrics}>
      <Metric primary label={level >= 60 ? "Kanji remaining" : "Kanji to level up"} value={remaining} />
      <Metric label="Current level" value={level} />
      <Metric label="Elapsed" value={formatDays(insights.levelPace.currentDays)} />
    </dl>
    <div className={layout.levelProgress}>
      <div className={styles.rowHead}><strong>Kanji passed</strong><span>{passed} / {required} needed</span></div>
      <Meter label={level >= 60 ? "Final level kanji passed" : "Kanji needed to level up"} value={Math.min(passed, required)} max={required} tone="kanji" />
      <div className={layout.levelKanji} role="group" aria-label={`Level ${level} kanji progress`}>{kanji.map((subject) => {
        const assignment = bySubject.get(subject.id);
        const hasPassed = Boolean(assignment?.data.passed_at) || (assignment?.data.srs_stage ?? 0) >= 5;
        const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;
        const status = hasPassed ? "Passed" : assignment?.data.started_at ? "In progress" : assignment?.data.unlocked_at ? "Lesson available" : "Locked";
        return <Link key={subject.id} href={`/subjects/${subject.id}`} data-passed={hasPassed} aria-label={`${subject.data.characters ?? subject.data.slug}: ${meaning}, ${status.toLowerCase()}`} title={`${meaning} · ${status}`}><SubjectCharacter subject={subject} imageTone="subject" /></Link>;
      })}</div>
    </div>
    <div className={layout.dateRow}><span>{level >= 60 ? "Curriculum" : "Earliest level-up"}</span><strong>{level >= 60 ? "Final level" : insights.levelPace.earliestLevelUpAt ? formatDate(insights.levelPace.earliestLevelUpAt) : "Pending unlocks"}</strong></div>
    {expanded ? <>
      <Segments label="Level blockers" value={filter} onChange={setFilter} options={[{ value: "all", label: `All (${blockers.length})` }, { value: "started", label: `In progress (${groups.started.length})` }, { value: "lessons", label: `Lessons (${groups.lessons.length})` }, { value: "locked", label: `Locked (${groups.locked.length})` }]} />
      <SubjectRows subjects={filtered} assignments={assignments} />
      <details className={styles.infoDisclosure}><summary>Next blocking reviews</summary><div className={styles.rows}>{timeline.map(({ subject, date }) => <div className={styles.rowHead} key={subject.id}><Link className={styles.itemLink} href={`/subjects/${subject.id}`}>{subject.data.characters}</Link><span>{new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>)}</div></details>
    </> : null}
    <div className={layout.footer}>
      <AnalyticsInfo label={level >= 60 ? "Final level progress" : "Level-up estimate"}><p>{level >= 60 ? "Remaining counts every kanji in the final level that has not yet reached Guru. There is no further level to unlock." : "Level-up requires 90% of this level's kanji to have reached Guru. The earliest date assumes on-time, correct reviews and depends on prerequisite unlocks."}</p></AnalyticsInfo>
      {!expanded ? <Link className={styles.textButton} href="/progress">Level progress<ArrowRight size={15} aria-hidden /></Link> : null}
    </div>
  </>;
}

export function WorkloadWidget({ insights, assignments, subjects, expanded }: AnalyticsWidgetProps) {
  const [seconds, setSeconds] = useState(12);
  const [stage, setStage] = useState("all");
  const [view, setView] = useState<"daily" | "hourly">("daily");
  const [selected, setSelected] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const bySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const buckets = (view === "daily" ? insights.forecast.daily.slice(0, 7) : insights.forecast.hourly).map((bucket) => {
    const subjectIds = bucket.subjectIds.filter((id) => stage === "all" || srsBucketForStage(bySubject.get(id)?.data.srs_stage ?? 0) === stage);
    return { ...bucket, subjectIds, count: subjectIds.length };
  });
  const selectedBucket = buckets.find((bucket) => bucket.key === selected);
  const selectedIds = new Set(selectedBucket?.subjectIds);
  const stageCounts = (ids: number[]) => STAGES.filter((value) => value !== "Burned").map((value) => ({ stage: value, count: ids.filter((id) => srsBucketForStage(bySubject.get(id)?.data.srs_stage ?? 0) === value).length }));
  return <>
    <dl className={styles.headlineMetrics}>
      <Metric primary label="Due now" value={formatNumber(insights.forecast.dueNow)} />
      <Metric label="Next 24 hours" value={formatNumber(insights.forecast.next24Hours)} />
      <Metric label="Queue estimate" value={formatStudyTime(insights.forecast.dueNow * seconds)} />
    </dl>
    <div className={styles.chartToolbar}>
      <Segments label="Review schedule" value={view} onChange={(value) => { setView(value); setSelected(null); }} options={[{ value: "daily", label: "7 days" }, { value: "hourly", label: "24 hours" }]} />
      <div className={styles.toolbarActions}>{stage !== "all" ? <span className={styles.note}>{stage}</span> : null}<button type="button" className={styles.iconButton} title="Review chart options" aria-label="Review chart options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(!optionsOpen)}><SlidersHorizontal size={17} aria-hidden /></button></div>
    </div>
    {optionsOpen ? <div className={`${styles.controls} ${styles.optionFields}`}>
      <label>Stage<select aria-label="Scheduled SRS stage" value={stage} onChange={(event) => { setStage(event.target.value); setSelected(null); }}><option value="all">All stages</option>{STAGES.filter((value) => value !== "Burned").map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Seconds per item<input type="number" min="3" max="120" value={seconds} onChange={(event) => setSeconds(Math.max(3, Math.min(120, Number(event.target.value) || 12)))} /></label>
    </div> : null}
    <AnalyticsCartesianChart
      kind="bar" stacked label="Currently scheduled reviews"
      data={buckets.map((bucket) => ({ key: bucket.key, label: bucket.label, ...Object.fromEntries(stageCounts(bucket.subjectIds).map((item) => [item.stage, item.count])) }))}
      series={STAGES.filter((value) => value !== "Burned" && (stage === "all" || stage === value)).map((value) => ({ key: value, label: value, color: chartToneColor(value.toLowerCase()) }))}
      onSelect={setSelected}
      selectedKey={selected}
    />
    {selectedBucket ? <>
      <div className={styles.rowHead}><strong>{selectedBucket.label}: {selectedBucket.count} reviews</strong><button type="button" className={styles.textButton} onClick={() => setSelected(null)}>Clear selection</button></div>
      <dl className={styles.miniStats}>{stageCounts(selectedBucket.subjectIds).map((item) => <div key={item.stage}><dt>{item.stage}</dt><dd>{item.count}</dd></div>)}</dl>
      {expanded || selectedBucket.count > 0 ? <SubjectRows subjects={subjects.filter((subject) => selectedIds.has(subject.id))} assignments={assignments} /> : null}
    </> : null}
    <div className={layout.footer}>
      <div className={layout.dateRow}><span>Next review</span><strong>{insights.forecast.nextAt ? <time dateTime={insights.forecast.nextAt}>{new Date(insights.forecast.nextAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time> : "None scheduled"}</strong></div>
      <Link href="/reviews" className={styles.textButton}>Review queue<ArrowRight size={15} aria-hidden /></Link>
      <AnalyticsInfo label="Scheduled reviews only"><p>Counts include current assignments, not future repeat reviews. The next 24 hours includes reviews already due. Queue time estimates {seconds} seconds per due item; chart filters do not change these totals.</p></AnalyticsInfo>
    </div>
  </>;
}

export function ActivityWidget({ insights, assignments, subjects, expanded, historyOnly = false }: AnalyticsWidgetProps & { historyOnly?: boolean }) {
  const [mode, setMode] = useState("lessons");
  const [view, setView] = useState(historyOnly ? "bars" : "calendar");
  const [selected, setSelected] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const selectedDay = insights.activity.find((day) => day.key === selected);
  const allYears = [...new Set(insights.activity.map((day) => String(day.date.getFullYear())))].reverse();
  const activeYear = allYears.includes(year) ? year : "all";
  const days = activeYear === "all" ? insights.activity.slice(-365) : insights.activity.filter((day) => String(day.date.getFullYear()) === activeYear);
  const value = (day: AnalyticsInsights["activity"][number]) => mode === "reviews" ? day.reviews ?? 0 : mode === "burns" ? day.burns : day.lessons;
  const max = Math.max(1, ...days.map(value));
  const tabStop = days.some((day) => day.key === focusedDay) ? focusedDay : days.at(-1)?.key;
  const dayLabel = (day: AnalyticsInsights["activity"][number]) => mode === "reviews" && day.reviews == null ? `${day.key}: reviews not recorded` : `${day.key}: ${value(day)} ${mode}${mode === "reviews" && day.reviewCoverage === "partial" ? " (partial day)" : ""}`;
  const selectedIds = new Set(mode === "reviews" ? selectedDay?.reviewSubjectIds : mode === "burns" ? selectedDay?.burnSubjectIds : selectedDay?.lessonSubjectIds);
  const lastSeven = insights.activity.slice(-7).filter((day) => mode !== "reviews" || day.reviews != null);
  const recorded = insights.activity.filter((day) => mode !== "reviews" || day.reviews != null);
  const today = insights.activity.at(-1);
  const best = [...recorded].sort((a, b) => value(b) - value(a))[0];
  return <>
    <dl className={styles.headlineMetrics}><Metric primary label={`${mode[0].toUpperCase() + mode.slice(1)} in period`} value={formatNumber(recorded.reduce((sum, day) => sum + value(day), 0))} /><Metric label="Active days" value={recorded.filter((day) => value(day) > 0).length} /><Metric label={insights.reviewSummary.available ? "Study streak" : "Milestone streak"} value={`${insights.reviewSummary.currentStreak} days`} /></dl>
    <div className={`${styles.controls} ${layout.activityToolbar}`}>
      <Segments label="Activity metric" value={mode} onChange={(value) => { setMode(value); if (value === "burns" && view === "hourly") setView("calendar"); }} options={[{ value: "lessons", label: "Lessons" }, { value: "burns", label: "Burns" }, ...(insights.reviewSummary.available ? [{ value: "reviews", label: "Reviews" }] : [])]} />
      <select aria-label="Activity display" value={view} onChange={(event) => setView(event.target.value)}><option value="calendar">Calendar</option><option value="bars">Bars</option>{mode !== "burns" ? <option value="hourly">By hour</option> : null}</select>
    </div>
    {expanded ? <dl className={styles.metrics}><Metric label={`Today\u0027s ${mode}`} value={today && (mode !== "reviews" || today.reviews != null) ? formatNumber(value(today)) : "Not recorded"} /><Metric label="7-day average" value={lastSeven.length ? formatNumber(lastSeven.reduce((sum, day) => sum + value(day), 0) / lastSeven.length) : "Not recorded"} detail={mode === "reviews" && lastSeven.length < 7 ? `${lastSeven.length} recorded days` : mode} /><Metric label="Best day in period" value={best ? formatNumber(value(best)) : "Not recorded"} detail={best && value(best) > 0 ? formatDate(best.date) : mode} /></dl> : null}
    {view === "hourly" ? <><BarChart kind="area" label={`${mode} by local hour`} bars={insights.hourlyActivity.map((hour) => ({ key: String(hour.hour), label: `${hour.hour}:00`, value: mode === "reviews" ? hour.reviews : hour.lessons, detail: mode === "reviews" ? `${formatPercent(hour.accuracy)} accuracy` : undefined }))} /><p className={styles.note}>Local time. Totals across the selected activity period{insights.reviewSummary.trackingStartedAt ? ", limited to recorded review history" : ""}.</p></> : view === "calendar" ? <><div className={styles.controls}><label>Year<select value={activeYear} onChange={(event) => setYear(event.target.value)}><option value="all">{insights.activity.length > 365 ? "Latest year in period" : "Selected period"}</option>{allYears.map((item) => <option key={item}>{item}</option>)}</select></label><span className={styles.note}>{days[0]?.key} to {days.at(-1)?.key}</span></div><div className={`${styles.heatmapScroll} ${layout.calendarScroll}`}><div className={styles.heatmap} aria-label={`${mode} calendar`}>{days.map((day, index) => <button className={styles.heatCell} type="button" key={day.key} style={index === 0 ? { gridRowStart: day.date.getDay() + 1 } : undefined} tabIndex={tabStop === day.key ? 0 : -1} onFocus={() => setFocusedDay(day.key)} data-intensity={value(day) ? Math.ceil(value(day) / max * 4) : 0} data-unavailable={mode === "reviews" && day.reviews == null || undefined} aria-label={dayLabel(day)} title={dayLabel(day)} onClick={() => setSelected(day.key)} onKeyDown={(event) => { const offset = ({ ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as Record<string, number>)[event.key]; if (offset !== undefined) { event.preventDefault(); (event.currentTarget.parentElement?.children[Math.max(0, Math.min(days.length - 1, index + offset))] as HTMLElement)?.focus(); } }} />)}</div></div><div className={styles.heatLegend}><span>Sun–Sat · each column is one week</span><span>0 to {formatNumber(max)} {mode}</span></div></> : <PagedBarChart kind={historyOnly ? "area" : "bar"} label={`${mode} per day`} pageSize={expanded ? 90 : 30} interval="days" bars={insights.activity.map((day) => ({ key: day.key, label: day.date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), rangeLabel: formatDate(day.date), value: mode === "reviews" ? day.reviews : value(day), detail: `${formatDate(day.date)}${mode === "reviews" && day.reviews == null ? " · Not recorded" : mode === "reviews" && day.reviewCoverage === "partial" ? " · Partial day" : ""}`, tone: mode === "burns" ? "success" : "accent" }))} selectedKey={selected} onSelect={setSelected} />}
    <AnalyticsInfo label={insights.reviewSummary.trackingStartedAt ? "Partial review history" : "Activity details"}><p>Longest study streak in period: {insights.reviewSummary.longestStreak} days. Study streaks combine recorded lessons, burns and available reviews.</p>{insights.reviewSummary.trackingStartedAt ? <p>Review records begin {new Date(insights.reviewSummary.trackingStartedAt).toLocaleString()}. Dashed dates are not recorded; the first day is partial. Review streaks only include the recorded period.</p> : null}{!insights.reviewSummary.available ? <p>WaniKani no longer provides historical reviews. Milestone streaks use dated lessons and burns, not review attendance.</p> : null}</AnalyticsInfo>
    {selectedDay ? <><div className={styles.rowHead}><strong>{formatDate(selectedDay.date)}</strong><button className={styles.textButton} onClick={() => setSelected(null)}>Close day</button></div><p className={styles.note}>{selectedDay.lessons} lessons · {selectedDay.burns} burns{selectedDay.reviews != null ? ` · ${selectedDay.reviews} reviews${selectedDay.reviewCoverage === "partial" ? " (partial day)" : ""} · ${formatPercent(selectedDay.accuracy)} accuracy` : mode === "reviews" ? " · Reviews not recorded" : ""}</p><SubjectRows subjects={subjects.filter((subject) => selectedIds.has(subject.id))} assignments={assignments} limit={8} /></> : null}
  </>;
}

export function BurnsWidget({ insights, assignments, subjects, expanded }: AnalyticsWidgetProps) {
  const [view, setView] = useState("monthly");
  const [selected, setSelected] = useState<string | null>(null);
  const projected = view === "projected";
  const months = projected ? insights.burns.projectedMonths : insights.burns.months;
  const ids = new Set(months.find((month) => month.key === selected)?.subjectIds);
  return <>
    <dl className={`${styles.headlineMetrics} ${layout.burnMetrics}`}><Metric primary label="Burned items" value={formatNumber(insights.burns.total)} /><Metric label="This month" value={formatNumber(insights.burns.thisMonth)} /></dl>
    <Segments label="Burn history view" value={view} onChange={(value) => { setView(value); setSelected(null); }} options={[{ value: "monthly", label: "Monthly" }, { value: "cumulative", label: "Cumulative" }, { value: "projected", label: "Upcoming" }]} />
    <PagedBarChart kind={view === "cumulative" ? "area" : "bar"} key={projected ? "projected" : "history"} anchor={projected ? "start" : "end"} label={projected ? "Earliest possible burns" : "Recorded burns"} interval="months" pageSize={expanded ? 36 : 12} bars={months.map((month) => ({ key: month.key, label: month.label, value: view === "cumulative" ? month.cumulative : month.count, tone: "success" }))} selectedKey={selected} onSelect={setSelected} />
    {selected ? <SubjectRows subjects={subjects.filter((subject) => ids.has(subject.id))} assignments={assignments} limit={10} /> : null}
    <div className={layout.footer}>
      <div className={layout.dateRow}><span>Next possible burn</span><strong>{insights.burns.nextAt ? <time dateTime={insights.burns.nextAt}>{formatDate(insights.burns.nextAt)}</time> : "Not yet available"}</strong></div>
      <AnalyticsInfo label="Burn estimates"><p>Upcoming burns assume correct, on-time reviews of currently started items. Future lessons and mistakes can change these dates.</p></AnalyticsInfo>
    </div>
  </>;
}

export function AchievementsWidget({ insights, expanded }: AnalyticsWidgetProps) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const categories = [...new Set(insights.achievements.map((item) => item.category))];
  const achievements = insights.achievements.filter((item) => (filter === "all" || (filter === "earned" ? item.achieved : !item.achieved)) && (category === "all" || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    if (a.achieved !== b.achieved) return Number(a.achieved) - Number(b.achieved);
    return a.achieved ? (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "") || b.target - a.target : b.percentage - a.percentage;
  });
  const active = insights.achievements.find((item) => item.id === selected);
  return <>
    <div className={styles.controls}><span className={styles.note}>{insights.achievements.filter((item) => item.achieved).length} of {insights.achievements.length} earned</span><Segments label="Achievement status" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "earned", label: "Earned" }, { value: "next", label: "Next" }]} /></div>
    {expanded ? <div className={styles.controls}><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label>Search medals<input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Milestone or requirement" /></label></div> : null}
    <div className={styles.achievementList} data-scroll={showAll && !expanded || undefined}>{achievements.slice(0, expanded || showAll ? undefined : 4).map((item) => <button type="button" className={styles.achievement} key={item.id} data-earned={item.achieved} onClick={() => setSelected(item.id)} aria-label={`${item.title}, ${item.achieved ? "earned" : item.percentage + "% complete"}`}><Award size={22} aria-hidden /><span><strong>{item.title}</strong><small>{item.category} · {item.tier}</small><Meter label={item.title} value={Math.min(item.current, item.target)} max={item.target} tone={item.achieved ? "success" : "accent"} /><small>{formatNumber(Math.min(item.current, item.target))} / {formatNumber(item.target)}</small></span></button>)}</div>
    {!expanded && achievements.length > 4 ? <button type="button" className={styles.textButton} onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${achievements.length} achievements`}</button> : null}
    {!achievements.length ? <EmptyAnalytics>No achievements in this group yet.</EmptyAnalytics> : null}
    {active ? <AnalyticsDialog title={active.title} onClose={() => setSelected(null)}><dl className={styles.metrics}><Metric label="Tier" value={active.tier} /><Metric label="Category" value={active.category} /><Metric label={active.achieved ? "Earned" : "Progress"} value={active.achieved ? active.earnedAt ? formatDate(active.earnedAt) : "Achieved; date unavailable" : `${active.percentage}%`} /></dl><p>{active.description}</p><Meter label={active.title} value={Math.min(active.current, active.target)} max={active.target} tone={active.achieved ? "success" : "accent"} /><p className={styles.note}>{formatNumber(active.current)} toward {formatNumber(active.target)}. Achievement dates are shown only when your records support them.</p></AnalyticsDialog> : null}
  </>;
}

export function StudyTimeWidget({ accountKey }: { accountKey: string }) {
  const [range, setRange] = useState<StudyTimeRangeId>("week");
  const time = useStudyTimeRange(accountKey, range);
  const categories = STUDY_TIME_CATEGORIES.filter((category) => time.summary.byCategory[category.id] > 0);
  return <>
    <div className={styles.controls}><dl><Metric primary label="Recorded study time" value={formatStudyTime(time.summary.totalSeconds)} /></dl><Segments label="Study time range" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "all", label: "All" }]} /></div>
    {time.summary.totalSeconds > 0 ? <><BarChart kind="area" label={time.chartTitle} unit="m" bars={time.series.map((bucket) => ({ key: bucket.id, label: bucket.label, value: Math.round(bucket.totalSeconds / 60), detail: bucket.accessibilityLabel }))} /><div className={styles.rows}>{categories.map((category) => <div className={styles.rowHead} key={category.id}><span>{category.label}</span><strong>{formatStudyTime(time.summary.byCategory[category.id])}</strong></div>)}</div></> : <EmptyAnalytics>No study time recorded in this period.</EmptyAnalytics>}
    <AnalyticsInfo label="Time breakdown"><div className={styles.rows}>{STUDY_TIME_CATEGORIES.map((category) => <div className={styles.rowHead} key={category.id}><span>{category.label}</span><strong>{formatStudyTime(time.summary.byCategory[category.id])}</strong></div>)}</div><p>Recorded by Kakehashi on this browser and synced devices. WaniKani does not supply historical session durations.</p></AnalyticsInfo>
  </>;
}

export function RetentionWidget({ insights }: AnalyticsWidgetProps) {
  const rows = insights.accuracyByStage.filter((row) => row.key !== "Locked");
  return <>
    <AnalyticsCartesianChart
      label="Lifetime accuracy by current stage" kind="horizontal-bar" minHeight={180} domain={[0, 100]} valueFormat={(value) => `${formatNumber(value)}%`}
      data={rows.map((row) => ({ key: row.key, label: row.label, accuracy: row.percentage, detail: `${formatNumber(row.correct + row.incorrect)} answer attempts` }))}
      series={[{ key: "accuracy", label: "Accuracy", color: chartToneColor("accent") }]}
    />
    <AnalyticsInfo label="Answer counts and methodology"><dl className={styles.rows}>{rows.map((row) => <div className={styles.rowHead} key={row.key}><dt>{row.label}</dt><dd>{formatNumber(row.correct + row.incorrect)} answers</dd></div>)}</dl><p>Lifetime answer statistics for items at each stage today, not a historical retention curve.</p></AnalyticsInfo>
  </>;
}
