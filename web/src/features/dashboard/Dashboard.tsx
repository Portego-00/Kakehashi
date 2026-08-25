"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Brain, Library, Newspaper, Search, Umbrella } from "lucide-react";
import Link from "next/link";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { ButtonLink } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/States";
import { vacationDateLabel, vacationStartedAt, vacationStudyMessage } from "@/features/core-study/vacation";
import { useWorkspacePreferences } from "@/features/settings/use-workspace-preferences";
import { STUDY_MODES, type StudyModeDefinition } from "@/features/study/catalog";
import { useSession } from "@/lib/session";
import { assignmentsQuery, reviewStatisticsQuery, subjectsQuery, summaryQuery, userQuery } from "@/lib/wanikani/queries";
import { accuracy, forecastRows, isLessonAvailable, isReviewAvailable, levelProgress, scheduleSummary, srsBuckets } from "./dashboard-data";
import { useFirstDashboardReveal } from "./useFirstDashboardReveal";
import styles from "./dashboard.module.css";

function StudyQueueRow({ type, count, loading }: { type: "lesson" | "review"; count: number; loading: boolean }) {
  const lessons = type === "lesson";
  const Icon = lessons ? BookOpen : Brain;
  return (
    <div className={styles.queueRow} data-kind={type}>
      <div className={styles.queueIdentity}>
        <span className={styles.queueMarker} aria-hidden />
        <Icon size={19} aria-hidden />
        <div><h3>{lessons ? "Lessons" : "Reviews"}</h3><p>{count ? "Ready now" : "Queue clear"}</p></div>
      </div>
      {loading ? <Skeleton height="2.5rem" /> : <strong className={styles.studyCount} data-first-reveal="">{count}</strong>}
      <ButtonLink href={lessons ? "/lessons" : "/reviews"} tone="primary" size="small" disabled={!loading && count === 0}>
        {count ? `Start ${lessons ? "lessons" : "reviews"}` : "Nothing waiting"}<ArrowRight size={15} />
      </ButtonLink>
    </div>
  );
}

function SectionHeader({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return <div className={styles.widgetHeader}><div><h2>{title}</h2><p>{detail}</p></div>{children}</div>;
}

export function chartBarHeight(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return "0%";
  return `${Math.min(100, (value / maximum) * 100)}%`;
}

function QuickLink({ href, title, detail, icon: Icon }: { href: string; title: string; detail: string; icon: typeof Search }) {
  return <Link href={href} className={styles.quickLink}><Icon size={17} aria-hidden /><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={14} aria-hidden /></Link>;
}

function StudyModeLink({ mode }: { mode: StudyModeDefinition }) {
  const Icon = mode.icon;
  return <Link href={`/study/${mode.id}`} className={styles.studyModeCard}><span className={styles.studyModeTop}><Icon size={21} aria-hidden /><ArrowRight size={15} aria-hidden /></span><span className={styles.studyModeCopy}><strong>{mode.title}</strong><small>{mode.description}</small></span></Link>;
}

function VacationNotice({ startedAt, compact = false }: { startedAt: string; compact?: boolean }) {
  return <div className={styles.vacationNotice} data-compact={compact || undefined} role="status"><Umbrella className={styles.vacationIcon} size={22} aria-hidden /><div><h3>Vacation Mode</h3><p>{vacationStudyMessage()}</p><span>On vacation since {vacationDateLabel(startedAt)}</span></div></div>;
}

export function Dashboard() {
  const { user } = useSession();
  const srsReveal = useFirstDashboardReveal();
  const levelReveal = useFirstDashboardReveal();
  const forecastReveal = useFirstDashboardReveal();
  const studyPulseReveal = useFirstDashboardReveal();
  const workspace = useWorkspacePreferences(user?.data.username ?? "anonymous");
  const currentUser = useQuery(userQuery());
  const assignments = useQuery(assignmentsQuery());
  const summary = useQuery(summaryQuery());
  const statistics = useQuery(reviewStatisticsQuery());
  const liveUser = currentUser.data ?? user;
  const currentVacationStartedAt = vacationStartedAt(liveUser);
  const isOnVacation = Boolean(currentVacationStartedAt);
  const currentLevel = liveUser?.data.level || user?.data.level || 1;
  const currentSubjects = useQuery(subjectsQuery(`levels=${currentLevel}`));
  const now = new Date();
  const assignmentRows = assignments.data || [];
  const availabilityLoading = assignments.isLoading || (currentUser.isLoading && !currentVacationStartedAt);
  const lessonCount = assignmentRows.filter((row) => isLessonAvailable(row, currentVacationStartedAt)).length;
  const reviewCount = assignmentRows.filter((row) => isReviewAvailable(row, now, currentVacationStartedAt)).length;
  const buckets = srsBuckets(assignmentRows);
  const srsEntries = Object.entries(buckets);
  const srsMax = Math.max(1, ...srsEntries.map(([, value]) => value));
  const forecast = forecastRows(summary.data, now);
  const forecastMax = Math.max(1, ...forecast.map((row) => row.count));
  const progress = levelProgress(currentSubjects.data || [], assignmentRows);
  const learnedKanji = assignmentRows.filter((row) => row.data.subject_type === "kanji" && row.data.srs_stage > 0).length;

  const sections: Record<string, React.ReactNode> = {
    "daily-study": <section className={`${styles.section} ${styles.queueSection}`} aria-label="Daily study">{currentVacationStartedAt ? <VacationNotice startedAt={currentVacationStartedAt} /> : <><SectionHeader title="Today" detail="Your live WaniKani queues" /><div className={styles.queue}><StudyQueueRow type="lesson" count={lessonCount} loading={availabilityLoading} /><StudyQueueRow type="review" count={reviewCount} loading={availabilityLoading} /></div></>}</section>,
    srs: <section className={styles.section}><SectionHeader title="SRS breakdown" detail="Items you have started" />{assignments.isLoading ? <Skeleton height="11rem" /> : <div className={styles.srs} {...srsReveal}>{srsEntries.map(([label, value]) => <div className={styles.srsItem} key={label}><div className={styles.srsBarTrack} aria-hidden><div className={styles.srsBar} data-empty={value === 0 || undefined} style={{ "--bar-height": chartBarHeight(value, srsMax) } as React.CSSProperties} /></div><strong>{value}</strong><span className={styles.srsLabel}><SrsStageIcon level={label} size={24} /><span>{label}</span></span></div>)}</div>}</section>,
    level: <section className={styles.section}><SectionHeader title={`Level ${currentLevel}`} detail="Guru progress by subject type" /><div className={styles.progressList} {...(currentSubjects.isLoading ? {} : levelReveal)}>{Object.entries(progress).map(([label, value]) => { const name = label === "vocabulary" ? "Vocabulary" : `${label[0].toUpperCase()}${label.slice(1)}s`; return <div className={styles.progressRow} key={label}><div className={styles.progressLabel}><span>{name}</span><span>{value.passed} / {value.total}</span></div><Progress value={value.passed} max={value.total || 1} ariaLabel={`${name}: ${value.passed} of ${value.total} passed`} /></div>; })}</div></section>,
    forecast: <section className={styles.section}><SectionHeader title="Next 12 hours" detail={isOnVacation ? "Review scheduling is paused" : "Reviews available at the top of each hour"}><ButtonLink href="/analytics" tone="ghost" size="small">Open forecast <ArrowRight size={15} /></ButtonLink></SectionHeader>{currentVacationStartedAt ? <VacationNotice startedAt={currentVacationStartedAt} compact /> : summary.isLoading ? <Skeleton height="10rem" /> : <div className={styles.forecast} {...forecastReveal}>{forecast.map((row) => <div className={styles.forecastCol} key={row.start.toISOString()}><div className={styles.forecastBarTrack} aria-hidden><div className={styles.forecastBar} data-empty={row.count === 0 || undefined} title={`${row.count} reviews`} style={{ "--bar-height": chartBarHeight(row.count, forecastMax) } as React.CSSProperties} /></div><strong>{row.count || "·"}</strong><span>{row.start.toLocaleTimeString([], { hour: "numeric" })}</span></div>)}</div>}</section>,
    "extra-study": <section className={`${styles.section} ${styles.sectionFlat}`}><SectionHeader title="Extra study" detail={`${STUDY_MODES.length} ways to practice without changing SRS progress`}><div className={styles.headerActions}><span className={styles.railCue} aria-hidden>Scroll <ArrowRight size={14} /></span><ButtonLink href="/study" tone="ghost" size="small">All modes <ArrowRight size={15} /></ButtonLink></div></SectionHeader><nav className={styles.studyModeRail} aria-label="Extra study modes" tabIndex={0}>{STUDY_MODES.map((mode) => <StudyModeLink mode={mode} key={mode.id} />)}</nav></section>,
    "study-pulse": <section className={styles.section}><SectionHeader title="Study pulse" detail="Complete review history" />{statistics.isLoading ? <Skeleton height="5rem" /> : <dl className={styles.summaryList} {...studyPulseReveal}><div><dt>Answer accuracy</dt><dd>{accuracy(statistics.data || [])}%</dd></div><div><dt>Subjects reviewed</dt><dd>{statistics.data?.length.toLocaleString() || 0}</dd></div></dl>}</section>,
    "keep-moving": <section className={styles.section}><SectionHeader title="Keep moving" detail="Reading and collection tools" /><div className={styles.quickGrid}><QuickLink href="/news" title="NHK Easy News" detail="Read with live subject lookup" icon={Newspaper} /><QuickLink href="/lists" title="Subject lists" detail="Build focused study collections" icon={Library} /></div></section>,
  };
  const visibleSections = workspace.dashboardOrder.filter((id) => !workspace.hiddenDashboard.includes(id));

  return <main className="page">
    <div className={`page-header ${styles.dashboardHeader}`}><div><h1>Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {liveUser?.data.username || user?.data.username}.</h1><p>Level {currentLevel} · {learnedKanji.toLocaleString()} kanji started · {isOnVacation ? "Vacation Mode is active" : scheduleSummary(reviewCount, summary.data?.data.next_reviews_at, now)}</p></div><ButtonLink href="/search" tone="ghost" size="small"><Search size={16} />Find a subject</ButtonLink></div>
    {(assignments.error || summary.error || currentUser.error) && <div className={styles.error} role="alert">Some live data could not be loaded. Cached sections remain available; refresh when your connection returns.</div>}
    <div className={styles.grid}>
      {visibleSections.map((id) => <div className={id === "daily-study" || id === "extra-study" || id === "forecast" ? styles.sectionWide : undefined} key={id}>{sections[id]}</div>)}
      {!visibleSections.length ? <section className={`${styles.section} ${styles.sectionWide}`}><h2>Your dashboard is clear</h2><p className={styles.emptyCopy}>Turn sections back on in Settings whenever you need them.</p><ButtonLink href="/settings" tone="primary">Customize dashboard</ButtonLink></section> : null}
    </div>
  </main>;
}
