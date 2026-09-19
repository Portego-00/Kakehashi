"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { srsStageLabel } from "@/components/SrsStageIcon";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { SpacedRepetitionSystem } from "@/types/wanikani";
import { calculateFastestLevelRoute, calculateSrsPromotions, fastestRouteCalendar } from "../analytics-promotion-schedule";
import { downloadAnalyticsFile } from "../analytics-export";
import { EmptyAnalytics, Metric, Segments, formatDate, formatNumber } from "./AnalyticsPrimitives";
import type { AnalyticsWidgetProps } from "./AnalyticsWidgets";
import styles from "../analytics.module.css";

type ScheduleProps = AnalyticsWidgetProps & { systems: SpacedRepetitionSystem[] };

export function FastestLevelRouteWidget({ assignments, subjects, systems, level, asOf }: ScheduleProps) {
  const [mountedAt] = useState(() => new Date());
  const now = asOf ?? mountedAt;
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const route = useMemo(() => calculateFastestLevelRoute({ assignments, subjects, systems, currentLevel: level, now }), [assignments, subjects, systems, level, now]);
  const active = route.sessions.find((session) => session.at === selected);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  return <section className={styles.rows} aria-label="Fastest level review plan">
    <div className={styles.controls}><strong>Fastest level review plan</strong><button type="button" className={styles.textButton} disabled={!route.sessions.length} onClick={() => downloadAnalyticsFile(fastestRouteCalendar(route), `kakehashi-level-${level}-review-plan.ics`, "text/calendar;charset=utf-8")}><CalendarPlus size={16} aria-hidden />Export sessions</button></div>
    {!route.available ? <EmptyAnalytics>{level >= 60 ? "You have reached the final level." : "A complete route needs the current level's assignments and review intervals."}</EmptyAnalytics> : !route.sessions.length ? <EmptyAnalytics>The required kanji have already passed Guru.</EmptyAnalytics> : <>
      <dl className={styles.metrics}><Metric label="Earliest level-up" value={formatDate(route.earliestLevelUpAt)} /><Metric label="Focus reviews" value={route.reviewCount} /><Metric label="Focus lessons" value={route.lessonCount} /></dl>
      <p className={styles.note}>This plan selects the earliest {route.requiredKanji} of the current level&apos;s kanji needed for 90% passed, including their radical prerequisites. Other reviews remain due.</p>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Session</th><th>Reviews</th><th>Lessons</th><th>Kanji passed</th></tr></thead><tbody>{route.sessions.slice(0, limit).map((session) => <tr key={session.at}><td><button type="button" className={styles.textButton} onClick={() => setSelected(selected === session.at ? null : session.at)} aria-expanded={selected === session.at}>{selected === session.at ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<time dateTime={session.at}>{new Date(session.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></button></td><td>{session.reviewSubjectIds.length}</td><td>{session.lessonSubjectIds.length}</td><td>{session.passedKanji} / {route.requiredKanji}{session.completesLevel ? " · Level-up" : ""}</td></tr>)}</tbody></table></div>
      {route.sessions.length > limit ? <button type="button" className={styles.textButton} onClick={() => setLimit((value) => value + 12)}><ChevronDown size={16} />Show more sessions ({route.sessions.length - limit})</button> : null}
      {active ? <><p className={styles.note}>{active.lessonSubjectIds.length ? "Complete the scheduled reviews before starting newly unlocked lessons in this session." : "Focus items for this session."}</p><div className={styles.tableWrap}><table className={styles.table} aria-label="Planned session items"><thead><tr><th>Item</th><th>Action</th><th>Planned stage</th></tr></thead><tbody>{active.actions.map((action) => {
        const subject = subjectMap.get(action.subjectId);
        if (!subject) return null;
        return <tr key={`${action.kind}:${action.subjectId}:${action.startingStage}`}><td><Link className={styles.itemLink} href={`/subjects/${subject.id}`} data-tone={subject.object}><strong><SubjectCharacter subject={subject} imageTone="subject" /></strong><span>{subject.data.meanings.find((meaning) => meaning.primary)?.meaning}</span></Link></td><td>{action.kind === "lesson" ? "Lesson" : "Review"}</td><td>{srsStageLabel(action.startingStage)} → {srsStageLabel(action.endingStage)}{action.isKanjiPass ? " · Level progress" : ""}</td></tr>;
      })}</tbody></table></div></> : null}
    </>}
    <p className={styles.note}><Info size={13} aria-hidden /> Conditional on correct answers and immediate lessons and reviews. Delays, mistakes, and vacation change this schedule.</p>
  </section>;
}

export function PromotionScheduleWidget({ assignments, subjects, systems, asOf }: ScheduleProps) {
  const [mountedAt] = useState(() => new Date());
  const now = asOf ?? mountedAt;
  const [horizon, setHorizon] = useState("7");
  const [tier, setTier] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const promotions = useMemo(() => calculateSrsPromotions({ assignments, subjects, systems, now, horizonDays: Number(horizon) }), [assignments, subjects, systems, now, horizon]);
  const stages = ["Guru", "Master", "Enlightened", "Burned"] as const;
  const filtered = promotions.filter((promotion) => !tier || promotion.to === tier);
  const overdueCount = filtered.filter((promotion) => promotion.overdue).length;
  const lastPage = Math.max(0, Math.ceil(filtered.length / 10) - 1);
  const activePage = Math.min(page, lastPage);
  return <section className={styles.rows} aria-label="Upcoming SRS promotions">
    <div className={styles.controls}><strong>Upcoming SRS promotions</strong><Segments label="Promotion horizon" value={horizon} onChange={(value) => { setHorizon(value); setPage(0); }} options={[{ value: "1", label: "24 hours" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} /></div>
    <Segments label="Promotion tier" value={tier ?? "all"} onChange={(value) => { setTier(value === "all" ? null : value); setPage(0); }} options={[{ value: "all", label: `All (${promotions.length})` }, ...stages.map((stage) => ({ value: stage, label: `${stage} (${formatNumber(promotions.filter((promotion) => promotion.to === stage).length)})` }))]} />
    {!systems.length ? <EmptyAnalytics>Review intervals are not available yet.</EmptyAnalytics> : !filtered.length ? <EmptyAnalytics>No {tier?.toLowerCase() ?? "SRS"} promotions fall within this window.</EmptyAnalytics> : <>
      {overdueCount > 0 ? <p className={styles.note}>{formatNumber(overdueCount)} {overdueCount === 1 ? "promotion is" : "promotions are"} possible from overdue reviews.</p> : null}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Item</th><th>Promotion</th><th>Earliest date</th></tr></thead><tbody>{filtered.slice(activePage * 10, (activePage + 1) * 10).map((promotion) => <tr key={`${promotion.subject.id}:${promotion.to}`}><td><Link className={styles.itemLink} href={`/subjects/${promotion.subject.id}`} data-tone={promotion.subject.object}><strong><SubjectCharacter subject={promotion.subject} imageTone="subject" /></strong><span>{promotion.subject.data.meanings.find((meaning) => meaning.primary)?.meaning}</span></Link></td><td>{promotion.from} → {promotion.to}</td><td>{promotion.overdue ? "Overdue · " : null}<time dateTime={promotion.at}>{new Date(promotion.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></td></tr>)}</tbody></table></div>
      {lastPage > 0 ? <div className={styles.pagination}><span>{activePage * 10 + 1}–{Math.min((activePage + 1) * 10, filtered.length)} of {filtered.length}</span><button type="button" className={styles.iconButton} aria-label="Previous promotions" title="Previous promotions" disabled={!activePage} onClick={() => setPage(activePage - 1)}><ChevronLeft size={16} /></button><button type="button" className={styles.iconButton} aria-label="Next promotions" title="Next promotions" disabled={activePage >= lastPage} onClick={() => setPage(activePage + 1)}><ChevronRight size={16} /></button></div> : null}
    </>}
    <p className={styles.note}>Earliest possible tier changes for currently started items, assuming correct answers at every due time. A subject may enter more than one tier within the selected window.</p>
  </section>;
}
