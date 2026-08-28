import { ArrowRight } from "lucide-react";
import { memo, type CSSProperties, type ReactNode } from "react";
import { LevelTimingChart } from "@/features/progress/components/AnalyticsOverview";
import type { LevelTiming } from "@/features/progress/calculations";
import { STUDY_MODES } from "@/features/study/catalog";
import type { DashboardSectionId } from "@/features/settings/settings";
import type { Subject } from "@/types/wanikani";
import type { DashboardSubjectRow, SrsStageSpreadRow } from "./dashboard-data";
import { IncompleteLevelsWidget, ReviewStatsWidget, StudyTimeWidget } from "./DashboardDataWidgets";
import { AppStreakWidget, DashboardLevelWidget, SrsSpreadWidget, StudyModeCard, TodayStudyWidget } from "./DashboardNativeWidgets";
import { RecentMistakesWidget } from "./RecentMistakesWidget";
import type { UsageStreakDay } from "./usage-streak";
import { StudyQueueCard } from "./StudyQueueCard";
import styles from "./dashboard.module.css";

const SUBJECT_PREVIEW_IDS: DashboardSectionId[] = ["recent-unlocks", "critical-items", "burned-items"];
const FORECAST_HEIGHTS = [34, 62, 48, 78, 56, 88, 44, 72, 38, 65, 52, 30];
const HEATMAP_LEVELS = Array.from({ length: 70 }, (_, index) => index % 9 === 0 ? 4 : index % 5 === 0 ? 3 : index % 3 === 0 ? 1 : 0);
const SRS_PREVIEW_ROWS: SrsStageSpreadRow[] = [
  [1, "Apprentice I", "I", 0.06], [2, "Apprentice II", "II", 0], [3, "Apprentice III", "III", .12],
  [4, "Apprentice IV", "IV", .18], [5, "Guru I", "V", .28], [6, "Guru II", "VI", .4],
  [7, "Master", "VII", .56], [8, "Enlightened", "VIII", .78], [9, "Burned", "IX", 1],
].map(([stage, label, roman, scale]) => {
  const total = Math.round(Number(scale) * 100);
  const radical = Math.round(total * .16);
  const kanji = Math.round(total * .24);
  return { stage: Number(stage), label: String(label), roman: String(roman), radical, kanji, vocabulary: total - radical - kanji, total };
});
const LEVEL_PREVIEW_PROGRESS = { radical: { passed: 4, total: 6 }, kanji: { passed: 6, total: 10 }, vocabulary: { passed: 7, total: 12 } };
const STREAK_PREVIEW_DAYS: UsageStreakDay[] = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(2026, 7, 19 + index);
  return { date, dayKey: `preview-${index}`, label: date.toLocaleDateString(undefined, { weekday: "narrow" }), active: index !== 2, isToday: index === 6 };
});
const TIMING_PREVIEW_ROWS: LevelTiming[] = [5.2, 7.4, 6.1, 9.3, 5.8, 7, 6.5, 8.4].map((days, index) => ({ level: index + 13, startedAt: "2026-01-01", passedAt: "2026-01-02", completedAt: null, daysToPass: days, daysToComplete: null, activeDays: days }));
const RECENT_MISTAKES_PREVIEW_NOW = new Date("2026-08-25T12:00:00Z");
const RECENT_MISTAKES_PREVIEW: DashboardSubjectRow[] = [
  ["見当たる", "Vocabulary", "vocabulary", "2026-08-25T11:40:00Z"],
  ["語", "Language", "kanji", "2026-08-25T08:00:00Z"],
  ["文", "Writing", "radical", "2026-08-24T16:00:00Z"],
].map(([characters, meaning, type, date], index) => {
  const id = -(index + 1);
  const object = type as DashboardSubjectRow["type"];
  const subject = { id, object, data: { characters, level: 1, slug: String(meaning).toLocaleLowerCase(), meanings: [{ meaning, primary: true, accepted_answer: true }] } } as Subject;
  return { id, characters, meaning, type: object, level: 1, date, subject };
});

function PreviewHeader({ title, detail, icon }: { title: string; detail: string; icon?: ReactNode }) {
  return <div className={styles.widgetHeader}><div><h2>{title}</h2><p>{detail}</p></div>{icon}</div>;
}

function SummaryPreview({ title, detail, first, second }: { title: string; detail: string; first: string; second: string }) {
  return <section className={styles.section}><PreviewHeader title={title} detail={detail} /><dl className={styles.summaryList}><div><dt>{first}</dt><dd>—</dd></div><div><dt>{second}</dt><dd>—</dd></div></dl></section>;
}

function SubjectPreview({ title, detail }: { title: string; detail: string }) {
  return <section className={styles.section}><PreviewHeader title={title} detail={detail} /><ul className={styles.subjectRows}>{["見当たる", "語", "文"].map((glyph, index) => { const glyphLength = [...glyph].length; return <li key={glyph}><span className={styles.previewSubjectRow}><span className={`${styles.subjectGlyph} ${styles.previewSubjectGlyph}`} data-subject-type={index === 0 ? "vocabulary" : index === 1 ? "kanji" : "radical"} data-long={glyphLength > 2 || undefined} data-very-long={glyphLength > 4 || undefined} lang="ja">{glyph}</span><span><strong>Subject</strong><small>{index === 0 ? "Vocabulary" : index === 1 ? "Kanji" : "Radical"} · Level —</small></span><span className={styles.subjectValue}>—</span><ArrowRight size={14} /></span></li>; })}</ul></section>;
}

function DashboardWidgetPreviewComponent({ id, density = "canvas" }: { id: DashboardSectionId; density?: "canvas" | "catalog" }) {
  let preview: ReactNode;

  if (id === "daily-study") {
    preview = <section className={`${styles.section} ${styles.queueSection}`}><PreviewHeader title="Today" detail="Your live WaniKani queues" /><div className={styles.queue}><StudyQueueCard type="lesson" preview /><StudyQueueCard type="review" preview /></div></section>;
  } else if (id === "srs") {
    preview = <SrsSpreadWidget rows={SRS_PREVIEW_ROWS} preview />;
  } else if (id === "level") {
    preview = <DashboardLevelWidget currentLevel={1} progress={LEVEL_PREVIEW_PROGRESS} subjects={[]} preview />;
  } else if (id === "incomplete-levels") {
    preview = <IncompleteLevelsWidget levels={[]} preview />;
  } else if (id === "extra-study") {
    preview = <section className={`${styles.section} ${styles.sectionFlat}`}><PreviewHeader title="Extra study" detail="Practice without changing SRS progress" /><div className={styles.studyModeRail}>{STUDY_MODES.slice(0, 5).map((mode) => <StudyModeCard mode={mode} preview key={mode.id} />)}</div></section>;
  } else if (id === "forecast") {
    preview = <section className={styles.section}><PreviewHeader title="Next 12 hours" detail="Reviews available at the top of each hour" /><div className={styles.forecast}>{FORECAST_HEIGHTS.map((height, index) => <div className={styles.forecastCol} key={index}><div className={styles.forecastBarTrack}><div className={styles.forecastBar} style={{ "--bar-height": `${height}%` } as CSSProperties} /></div><strong>·</strong><span>{index % 3 === 0 ? "Now" : "+1h"}</span></div>)}</div></section>;
  } else if (id === "study-pulse") {
    preview = <ReviewStatsWidget statistics={[]} preview />;
  } else if (id === "recent-mistakes") {
    preview = <RecentMistakesWidget items={RECENT_MISTAKES_PREVIEW} now={RECENT_MISTAKES_PREVIEW_NOW} preview />;
  } else if (SUBJECT_PREVIEW_IDS.includes(id)) {
    const titles: Partial<Record<DashboardSectionId, [string, string]>> = {
      "recent-unlocks": ["Recent unlocks", "The latest subjects added to your study path"],
      "critical-items": ["Critical items", "Subjects with the lowest answer accuracy"],
      "burned-items": ["Burned items", "Burned during the last 30 days"],
    };
    preview = <SubjectPreview title={titles[id]![0]} detail={titles[id]![1]} />;
  } else if (id === "study-streak") {
    preview = <AppStreakWidget current={null} longest={null} days={STREAK_PREVIEW_DAYS} preview />;
  } else if (id === "subject-lists") {
    preview = <SummaryPreview title="Subject lists" detail="Reusable collections saved in this browser" first="Lists" second="Saved subjects" />;
  } else if (id === "review-heatmap") {
    preview = <section className={styles.section}><PreviewHeader title="Review heatmap" detail="Assignment activity signals over the last 14 weeks" /><div className={styles.heatmap}>{HEATMAP_LEVELS.map((level, index) => <span key={index} data-level={level} />)}</div></section>;
  } else if (id === "level-timing") {
    preview = <section className={`${styles.section} ${styles.dashboardTimingWidget}`}><PreviewHeader title="Level timing" detail="Average, median, and elapsed days across all levels" /><LevelTimingChart timings={TIMING_PREVIEW_ROWS} resetCount={null} density="dashboard" /></section>;
  } else if (id === "today-study") {
    preview = <TodayStudyWidget date={new Date(2026, 7, 25)} lessons={null} reviews={null} preview />;
  } else {
    preview = <StudyTimeWidget userId="preview" preview />;
  }

  return <div className={styles.widgetPreview} data-widget-preview={id} data-preview-density={density} aria-hidden="true" inert>{preview}</div>;
}

export const DashboardWidgetPreview = memo(DashboardWidgetPreviewComponent);
