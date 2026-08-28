"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Umbrella } from "lucide-react";
import Link from "next/link";
import { ReviewActivityHeatmap } from "@/components/ReviewActivityHeatmap";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { VacationModeControls } from "@/features/core-study/VacationModeControls";
import { vacationDateLabel, vacationStartedAt, vacationStudyMessage } from "@/features/core-study/vacation";
import { dashboardSectionWidth, type DashboardSectionId } from "@/features/settings/settings";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { useSubjectLists } from "@/features/subjects/use-subject-lists";
import { useWorkspacePreferences } from "@/features/settings/use-workspace-preferences";
import { STUDY_MODES } from "@/features/study/catalog";
import { calculateLevelTimings } from "@/features/progress/calculations";
import { LevelTimingChart } from "@/features/progress/components/AnalyticsOverview";
import { useSession } from "@/lib/session";
import { assignmentsQuery, availableReviewCountQuery, levelProgressionsQuery, reviewStatisticsQuery, subjectsQuery, summaryQuery, userQuery } from "@/lib/wanikani/queries";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import type { Subject } from "@/types/wanikani";
import { assignmentActivityDays, burnedSubjectRows, criticalSubjectRows, forecastRows, incompleteLevelRows, isLessonAvailable, isReviewAvailable, levelProgress, levelWidgetSubjects, recentMistakeRows, recentUnlockRows, srsStageSpread, todayStudyActivity, type DashboardSubjectRow } from "./dashboard-data";
import { IncompleteLevelsWidget, ReviewStatsWidget, StudyTimeWidget } from "./DashboardDataWidgets";
import { AppStreakWidget, DashboardLevelWidget, SrsSpreadWidget, StudyModeCard, TodayStudyWidget } from "./DashboardNativeWidgets";
import { SubjectListsWidget } from "./SubjectListsWidget";
import { RecentMistakesWidget } from "./RecentMistakesWidget";
import { fetchUsageStreak } from "./usage-streak";
import { useFirstDashboardReveal } from "./useFirstDashboardReveal";
import { StudyQueueCard } from "./StudyQueueCard";
import styles from "./dashboard.module.css";

const SUBJECT_CATALOG_SECTIONS = new Set(["recent-mistakes", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items"]);

function SectionHeader({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return <div className={styles.widgetHeader}><div><h2>{title}</h2><p>{detail}</p></div>{children}</div>;
}

export function chartBarHeight(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return "0%";
  return `${Math.min(100, (value / maximum) * 100)}%`;
}

function VacationNotice({ startedAt, compact = false, refresh }: { startedAt: string; compact?: boolean; refresh?: () => Promise<unknown> }) {
  return <div className={styles.vacationNotice} data-compact={compact || undefined} role="region" aria-label="Vacation Mode"><Umbrella className={styles.vacationIcon} size={22} aria-hidden /><div><h3>Vacation Mode</h3><p>{vacationStudyMessage()}</p><span>On vacation since {vacationDateLabel(startedAt)}</span>{refresh ? <VacationModeControls active refresh={refresh} className={styles.vacationActions} /> : null}</div></div>;
}

export function SubjectRows({ items, empty, value, limit }: { items: DashboardSubjectRow[]; empty: string; value?: (item: DashboardSubjectRow) => string; limit?: number }) {
  if (!items.length) return <p className={styles.emptyCopy}>{empty}</p>;
  return <ul className={styles.subjectRows}>{items.slice(0, limit ?? items.length).map((item) => {
    const glyphLength = [...item.characters].length;
    return <li key={item.id}><Link href={`/subjects/${item.id}`}><SubjectCharacter subject={item.subject} fallbackText={item.characters} imageSize="68%" className={styles.subjectGlyph} data-subject-type={item.type} data-long={glyphLength > 2 || undefined} data-very-long={glyphLength > 4 || undefined} title={item.characters} /><span><strong>{item.meaning}</strong><small>{item.type} · Level {item.level}</small></span>{value ? <span className={styles.subjectValue}>{value(item)}</span> : null}<ArrowRight size={14} aria-hidden /></Link></li>;
  })}</ul>;
}

function SubjectListsSection({ username, subjects }: { username: string; subjects: Subject[] }) {
  const { lists, syncing, syncError } = useSubjectLists(username);
  return <SubjectListsWidget lists={lists} subjects={subjects} syncing={syncing} syncError={syncError} />;
}

export function Dashboard() {
  const { user } = useSession();
  const forecastReveal = useFirstDashboardReveal();
  const username = user?.data.username ?? "anonymous";
  const workspace = useWorkspacePreferences(username);
  const visibleSections = workspace.dashboardOrder.filter((id) => !workspace.hiddenDashboard.includes(id));
  const needsDailyStudy = visibleSections.includes("daily-study");
  const needsSubjectCatalog = visibleSections.some((id) => SUBJECT_CATALOG_SECTIONS.has(id));
  const needsLevelTiming = visibleSections.includes("level-timing");
  const currentUser = useQuery(userQuery());
  const assignments = useQuery(assignmentsQuery());
  const availableReviewCount = useQuery({ ...availableReviewCountQuery(), enabled: needsDailyStudy });
  const summary = useQuery(summaryQuery());
  const statistics = useQuery(reviewStatisticsQuery());
  const liveUser = currentUser.data ?? user;
  const userId = waniKaniUserId(liveUser ?? user);
  const currentVacationStartedAt = vacationStartedAt(liveUser);
  const isOnVacation = Boolean(currentVacationStartedAt);
  const currentLevel = liveUser?.data.level || user?.data.level || 1;
  const currentSubjects = useQuery(subjectsQuery(`levels=${currentLevel}`));
  const allSubjects = useQuery({ ...subjectsQuery(), enabled: needsSubjectCatalog });
  const levelProgressions = useQuery({ ...levelProgressionsQuery(), enabled: needsLevelTiming });
  const appStreak = useQuery({ queryKey: ["analytics", "app-streak", userId, username], queryFn: () => fetchUsageStreak({ userId, username }), staleTime: 5 * 60_000, enabled: visibleSections.includes("study-streak"), retry: 1 });
  const now = new Date();
  const assignmentRows = assignments.data || [];
  const statisticRows = statistics.data || [];
  const allSubjectRows = allSubjects.data || [];
  const availabilityLoading = assignments.isLoading || availableReviewCount.isLoading || (currentUser.isLoading && !currentVacationStartedAt);
  const lessonCount = assignmentRows.filter((row) => isLessonAvailable(row, currentVacationStartedAt)).length;
  const fallbackReviewCount = assignmentRows.filter((row) => isReviewAvailable(row, now, currentVacationStartedAt)).length;
  const reviewCount = currentVacationStartedAt ? 0 : (availableReviewCount.data ?? fallbackReviewCount);
  const srsSpread = srsStageSpread(assignmentRows);
  const forecast = forecastRows(summary.data, now);
  const forecastMax = Math.max(1, ...forecast.map((row) => row.count));
  const progress = levelProgress(currentSubjects.data || [], assignmentRows);
  const levelSubjects = levelWidgetSubjects(currentSubjects.data || [], assignmentRows);
  const reviewActivityDays = assignmentActivityDays(assignmentRows, "all", now);
  const dailyActivity = todayStudyActivity(assignmentRows, statisticRows, now);
  const mistakeRows = recentMistakeRows(statisticRows, allSubjectRows, now);
  const unlockRows = recentUnlockRows(assignmentRows, allSubjectRows);
  const criticalRows = criticalSubjectRows(statisticRows, allSubjectRows);
  const burnedRows = burnedSubjectRows(assignmentRows, allSubjectRows, now);
  const incompleteLevels = incompleteLevelRows(allSubjectRows, assignmentRows, currentLevel);
  const timingRows = calculateLevelTimings(levelProgressions.data || [], now);
  const formatShortDate = (value?: string) => value ? new Date(value).toLocaleDateString([], { month: "short", day: "numeric" }) : "";

  const sections: Record<string, React.ReactNode> = {
    "daily-study": <section className={`${styles.section} ${styles.queueSection}`} aria-label="Daily study">{currentVacationStartedAt ? <VacationNotice startedAt={currentVacationStartedAt} refresh={currentUser.refetch} /> : <><SectionHeader title="Today" detail="Your live WaniKani queues"><VacationModeControls active={false} refresh={currentUser.refetch} showRefresh={false} className={styles.vacationHeaderAction} /></SectionHeader><div className={styles.queue}><StudyQueueCard type="lesson" count={lessonCount} loading={availabilityLoading} /><StudyQueueCard type="review" count={reviewCount} loading={availabilityLoading} /></div></>}</section>,
    srs: assignments.isLoading ? <section className={styles.section}><SectionHeader title="Active Item Spread" detail="Radicals, kanji, and vocabulary across SRS stages" /><Skeleton height="15rem" /></section> : <SrsSpreadWidget rows={srsSpread} />,
    level: currentSubjects.isLoading ? <section className={styles.section}><SectionHeader title={`Level ${currentLevel} Progress`} detail="Your current level, from lesson to Guru" /><Skeleton height="18rem" /></section> : <DashboardLevelWidget currentLevel={currentLevel} progress={progress} subjects={levelSubjects} />,
    forecast: <section className={styles.section}><SectionHeader title="Next 12 hours" detail={isOnVacation ? "Review scheduling is paused" : "Reviews available at the top of each hour"}><ButtonLink href="/analytics" tone="ghost" size="small">Open forecast <ArrowRight size={15} /></ButtonLink></SectionHeader>{currentVacationStartedAt ? <VacationNotice startedAt={currentVacationStartedAt} compact /> : summary.isLoading ? <Skeleton height="10rem" /> : <div className={styles.forecast} {...forecastReveal}>{forecast.map((row) => <div className={styles.forecastCol} key={row.start.toISOString()}><div className={styles.forecastBarTrack} aria-hidden><div className={styles.forecastBar} data-empty={row.count === 0 || undefined} title={`${row.count} reviews`} style={{ "--bar-height": chartBarHeight(row.count, forecastMax) } as React.CSSProperties} /></div><strong>{row.count || "·"}</strong><span>{row.start.toLocaleTimeString([], { hour: "numeric" })}</span></div>)}</div>}</section>,
    "extra-study": <section className={`${styles.section} ${styles.sectionFlat}`}><SectionHeader title="Extra study" detail={`${STUDY_MODES.length} ways to practice without changing SRS progress`}><div className={styles.headerActions}><span className={styles.railCue} aria-hidden>Scroll <ArrowRight size={14} /></span><ButtonLink href="/study" tone="ghost" size="small">All modes <ArrowRight size={15} /></ButtonLink></div></SectionHeader><nav className={styles.studyModeRail} aria-label="Extra study modes" tabIndex={0}>{STUDY_MODES.map((mode) => <StudyModeCard mode={mode} key={mode.id} />)}</nav></section>,
    "study-pulse": statistics.isLoading ? <section className={styles.section}><SectionHeader title="Review stats" detail="Accuracy across your complete review history" /><Skeleton height="9rem" /></section> : <ReviewStatsWidget statistics={statisticRows} />,
    "recent-mistakes": isOnVacation ? <RecentMistakesWidget items={[]} username={username} now={now} /> : statistics.isLoading || allSubjects.isLoading ? <section className={styles.section}><SectionHeader title="Recent Mistakes" detail="Updated subjects with a broken answer streak" /><Skeleton height="12rem" /></section> : <RecentMistakesWidget items={mistakeRows} username={username} now={now} />,
    "study-streak": <AppStreakWidget current={appStreak.data?.current ?? null} longest={appStreak.data?.longest ?? null} days={appStreak.data?.days ?? []} freezeAvailable={appStreak.data?.freezeAvailable} freezeDaysUntilReload={appStreak.data?.freezeDaysUntilReload} loading={appStreak.isLoading} error={appStreak.isError} />,
    "subject-lists": <SubjectListsSection username={username} subjects={allSubjectRows} />,
    "incomplete-levels": allSubjects.isLoading ? <section className={styles.section}><SectionHeader title="Incomplete levels" detail="Passing-stage progress by subject type" /><Skeleton height="12rem" /></section> : <IncompleteLevelsWidget levels={incompleteLevels} />,
    "recent-unlocks": <section className={`${styles.section} ${styles.compactSubjectWidget}`}><SectionHeader title="Recent unlocks" detail="The latest subjects added to your study path"><ButtonLink href="/items?view=unlocks" tone="ghost" size="small">Show more <ArrowRight size={15} /></ButtonLink></SectionHeader>{allSubjects.isLoading ? <Skeleton height="10rem" /> : <SubjectRows items={unlockRows} limit={4} empty="No unlocked subjects are available yet." value={(item) => formatShortDate(item.date)} />}</section>,
    "critical-items": <section className={`${styles.section} ${styles.compactSubjectWidget}`}><SectionHeader title="Critical items" detail="Subjects with the lowest answer accuracy"><ButtonLink href="/items?view=critical" tone="ghost" size="small">Show more <ArrowRight size={15} /></ButtonLink></SectionHeader>{statistics.isLoading || allSubjects.isLoading ? <Skeleton height="10rem" /> : <SubjectRows items={criticalRows} limit={4} empty="No review statistics are available yet." value={(item) => `${item.value ?? 0}%`} />}</section>,
    "burned-items": <section className={styles.section}><SectionHeader title="Burned items" detail="Burned during the last 30 days" />{allSubjects.isLoading ? <Skeleton height="12rem" /> : <SubjectRows items={burnedRows} empty="No subjects were burned in the last 30 days." value={(item) => formatShortDate(item.date)} />}</section>,
    "review-heatmap": <section className={styles.section}><SectionHeader title="Review heatmap" detail="Assignment activity signals by day" />{assignments.isLoading ? <Skeleton height="10rem" /> : <ReviewActivityHeatmap days={reviewActivityDays} />}</section>,
    "level-timing": <section className={`${styles.section} ${styles.dashboardTimingWidget}`}><SectionHeader title="Level timing" detail="Average, median, and elapsed days across all levels" />{levelProgressions.isLoading ? <Skeleton height="12rem" /> : <LevelTimingChart timings={timingRows} resetCount={null} density="dashboard" />}</section>,
    "today-study": assignments.isLoading || statistics.isLoading ? <section className={styles.section}><SectionHeader title="Today’s Study" detail={now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} /><Skeleton height="7rem" /></section> : <TodayStudyWidget date={now} lessons={dailyActivity.lessons} reviews={dailyActivity.reviews} />,
    "study-time": <StudyTimeWidget userId={userId} />,
  };

  return <main className="page">
    {(assignments.error || summary.error || currentUser.error || (needsDailyStudy && availableReviewCount.error) || (needsSubjectCatalog && allSubjects.error) || (needsLevelTiming && levelProgressions.error)) && <div className={styles.error} role="alert">Some live data could not be loaded. Cached sections remain available; refresh when your connection returns.</div>}
    <div className={styles.grid}>
      {visibleSections.map((id) => {
        const sectionId = id as DashboardSectionId;
        const section = sections[sectionId];
        if (section == null) return null;
        const width = dashboardSectionWidth(sectionId, workspace.dashboardWidths?.[sectionId]);
        return <div data-section={sectionId} data-layout-width={width} data-layout-row-start={workspace.dashboardRowStarts?.includes(sectionId) || undefined} style={{ "--dashboard-section-span": width } as React.CSSProperties} key={sectionId}>{section}</div>;
      })}
      {!visibleSections.length ? <section className={`${styles.section} ${styles.sectionWide}`}><h2>Your dashboard is clear</h2><p className={styles.emptyCopy}>Turn sections back on in Settings whenever you need them.</p><ButtonLink href="/settings" tone="primary">Customize dashboard</ButtonLink></section> : null}
    </div>
  </main>;
}
