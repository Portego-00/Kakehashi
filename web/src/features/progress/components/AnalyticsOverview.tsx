"use client";

import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Flame, Gauge, TimerReset } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/States";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useProgressData } from "../data";
import {
  calculateAccuracy,
  calculateApproximateActivity,
  calculateForecast,
  calculateLevelTimings,
  calculateSrsBreakdown,
  weightedAverageLevelDays,
} from "../calculations";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import styles from "../progress.module.css";

const SRS_ORDER = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;

function percent(correct: number, incorrect: number) {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
}

export function AnalyticsOverview() {
  const { assignments, statistics, progressions, resets, isLoading, isError, retry } = useProgressData();
  const firstReveal = useFirstProgressReveal();

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError) return <AnalyticsError retry={retry} />;

  const accuracy = calculateAccuracy(statistics);
  const meaningAccuracy = percent(accuracy.meaningCorrect, accuracy.meaningIncorrect);
  const readingAccuracy = percent(accuracy.readingCorrect, accuracy.readingIncorrect);
  const srs = calculateSrsBreakdown(assignments);
  const srsTotal = SRS_ORDER.reduce((sum, key) => sum + srs[key], 0);
  const forecast = calculateForecast(assignments);
  const forecastMax = Math.max(1, ...forecast.map((bucket) => bucket.count));
  const activity = calculateApproximateActivity(statistics);
  const activityMax = Math.max(1, ...activity.map((day) => day.count));
  const timings = calculateLevelTimings(progressions);
  const averageLevelDays = weightedAverageLevelDays(timings);
  const recentTimings = timings.filter((timing) => timing.daysToPass !== null).slice(-10);
  const timingMax = Math.max(1, ...recentTimings.map((timing) => timing.daysToPass ?? 0));

  return (
    <main className={`page ${styles.page}`} {...firstReveal}>
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>Your WaniKani record, translated into useful signals for the week ahead.</p>
        </div>
        <Link href="/progress" className={styles.textLink}>Level progress <ArrowRight size={16} aria-hidden /></Link>
      </header>

      <section className={styles.accuracySection} aria-labelledby="accuracy-title">
        <div className={styles.accuracyLead}>
          <div className={styles.sectionTitleRow}>
            <Gauge size={20} aria-hidden />
            <h2 id="accuracy-title">Review accuracy</h2>
          </div>
          <strong className={styles.heroMetric}>{accuracy.percentage === null ? "—" : `${accuracy.percentage}%`}</strong>
          <p>{accuracy.correct.toLocaleString()} correct answers across {accuracy.correct + accuracy.incorrect} recorded attempts.</p>
        </div>
        <div className={styles.accuracyDetails}>
          <AccuracyRow label="Meaning" value={meaningAccuracy} correct={accuracy.meaningCorrect} total={accuracy.meaningCorrect + accuracy.meaningIncorrect} />
          <AccuracyRow label="Reading" value={readingAccuracy} correct={accuracy.readingCorrect} total={accuracy.readingCorrect + accuracy.readingIncorrect} />
        </div>
      </section>

      <div className={styles.analyticsGrid}>
        <Card className={styles.analysisSection}>
          <div className={styles.sectionTitleRow}><Flame size={19} aria-hidden /><h2>SRS distribution</h2></div>
          <div className={styles.segmentBar} aria-label="SRS stage distribution">
            {SRS_ORDER.map((key) => <span key={key} data-srs={key.toLowerCase()} style={{ width: `${srsTotal ? (srs[key] / srsTotal) * 100 : 0}%` }} />)}
          </div>
          <dl className={styles.breakdownList}>
            {SRS_ORDER.map((key) => <div key={key}><dt><SrsStageIcon level={key} size={22} />{key}</dt><dd>{srs[key].toLocaleString()}</dd></div>)}
          </dl>
        </Card>

        <Card className={styles.analysisSection}>
          <div className={styles.sectionTitleRow}><CalendarDays size={19} aria-hidden /><h2>Seven-day forecast</h2></div>
          <div className={styles.forecast} role="img" aria-label={forecast.map((day) => `${day.label}: ${day.count} reviews`).join(", ")}>
            {forecast.map((day) => <div key={day.key} className={styles.forecastColumn}><div className={styles.forecastTrack}><span style={{ transform: `scaleY(${day.count / forecastMax})` }} /></div><strong>{day.count}</strong><span>{day.label}</span></div>)}
          </div>
        </Card>
      </div>

      <section className={styles.activitySection} aria-labelledby="activity-title">
        <div className={styles.activityHead}>
          <div className={styles.sectionTitleRow}><Activity size={19} aria-hidden /><h2 id="activity-title">Recent activity</h2></div>
          <p>Approximation based on the last update to each subject’s review statistic.</p>
        </div>
        <div className={styles.heatmap} role="img" aria-label="Sixteen weeks of approximate subject activity">
          {activity.map((day) => <span key={day.key} title={`${day.date.toLocaleDateString()}: ${day.count} subjects`} aria-hidden style={{ "--activity": day.count / activityMax } as React.CSSProperties} />)}
        </div>
        <div className={styles.heatLegend}><span>Less</span><i style={{ "--activity": 0.1 } as React.CSSProperties} /><i style={{ "--activity": 0.4 } as React.CSSProperties} /><i style={{ "--activity": 0.7 } as React.CSSProperties} /><i style={{ "--activity": 1 } as React.CSSProperties} /><span>More</span></div>
      </section>

      <section className={styles.timingSection} aria-labelledby="timing-title">
        <div className={styles.timingCopy}>
          <div className={styles.sectionTitleRow}><TimerReset size={19} aria-hidden /><h2 id="timing-title">Level timing</h2></div>
          <strong>{averageLevelDays === null ? "—" : `${averageLevelDays} days`}</strong>
          <p>Average time to pass across completed level attempts. {resets.length ? `${resets.length} reset ${resets.length === 1 ? "attempt was" : "attempts were"} excluded.` : "No account resets recorded."}</p>
        </div>
        <div className={styles.timingChart} role="img" aria-label={recentTimings.map((timing) => `Level ${timing.level}: ${timing.daysToPass} days`).join(", ")}>
          {recentTimings.map((timing) => <div key={timing.level}><span className={styles.timingValue}>{timing.daysToPass}</span><span className={styles.timingBar} style={{ transform: `scaleY(${(timing.daysToPass ?? 0) / timingMax})` }} /><span className={styles.timingLabel}>L{timing.level}</span></div>)}
        </div>
      </section>
    </main>
  );
}

function AccuracyRow({ label, value, correct, total }: { label: string; value: number | null; correct: number; total: number }) {
  return <div className={styles.accuracyRow}><div><strong>{label}</strong><span>{correct.toLocaleString()} of {total.toLocaleString()}</span></div><strong>{value === null ? "—" : `${value}%`}</strong><div className={styles.accuracyTrack} role="progressbar" aria-label={`${label} accuracy`} aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${(value ?? 0) / 100})` }} /></div></div>;
}

function AnalyticsSkeleton() {
  return <main className={`page ${styles.page}`} aria-busy="true"><header className="page-header"><div className="stack"><Skeleton height="2.5rem" /><Skeleton height="1.2rem" /></div></header><div className="stack-lg"><Skeleton height="17rem" /><Skeleton height="22rem" /><Skeleton height="10rem" /></div></main>;
}

function AnalyticsError({ retry }: { retry: () => Promise<void> }) {
  const [isRetrying, setIsRetrying] = useState(false);
  return <main className={`page ${styles.page}`}><div className={styles.errorState}><CheckCircle2 size={28} aria-hidden /><h1>Analytics are unavailable</h1><p>WaniKani did not return all of the data needed for this view. Try the request again here.</p><Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button></div></main>;
}
