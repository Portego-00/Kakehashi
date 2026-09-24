"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
import { createBunproReviewSavePolicy } from "@/features/bunpro/review-save-policy";
import { BunproSaveWarning } from "@/features/bunpro/BunproSaveWarning";
import { BunproReviews } from "@/features/bunpro/BunproReviews";
import { BunproProgression } from "@/features/bunpro/BunproProgression";
import type { BunproProgression as Progression } from "@/features/bunpro/progression";
import { bunpro } from "@/features/bunpro/client";
import type { ReviewMode } from "@/features/bunpro/model";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { Button, ButtonLink } from "@/components/ui/Button";
import { mixedRetryCandidates, mixedRetryKey, type MixedRetry } from "./retry-ordering";
import { chooseMixedLane, mixedWrapUpLimits, type MixedHead, type MixedPreviousAnswer, type MixedProgress } from "./ordering";
import { BunproLoading } from "@/features/bunpro/BunproLoading";
import { SessionResults } from "./SessionResults";
import type { AccuracyCounts } from "@/features/study/components/ReviewAccuracy";
import type { SessionResultsData } from "./session-results";
import styles from "./mixed-reviews.module.css";
type Lane = "wanikani" | "grammar" | "vocab";
export function MixedReviews({ mode }: { mode: ReviewMode }) {
  const { user } = useSession();
  const [bunproSavePolicy] = useState(createBunproReviewSavePolicy);
  const preferences = useWebSettings(user?.data.username ?? "anonymous").study;
  const [laneAccuracy, setLaneAccuracy] = useState<Partial<Record<Lane, AccuracyCounts>>>({});
  function reportAccuracy(lane: Lane, value: AccuracyCounts) { setLaneAccuracy(previous => previous[lane]?.correct === value.correct && previous[lane]?.answered === value.answered ? previous : { ...previous, [lane]: value }); }
  const [laneResults, setLaneResults] = useState<Partial<Record<Lane, SessionResultsData>>>({});
  function reportResults(lane: Lane, results: SessionResultsData) { setLaneResults(previous => ({ ...previous, [lane]: results })); }
  const [previous, setPrevious] = useState<MixedPreviousAnswer | null>(null);
  const latestAnswer = useRef<MixedPreviousAnswer | null>(null);
  const [bunproProgression, setBunproProgression] = useState<Progression | null>(null);
  const reportBunproProgression = useCallback((change: Progression) => {
    if (latestAnswer.current?.id === `bunpro:${change.id}` && latestAnswer.current.correct) setBunproProgression(change);
  }, []);
  useEffect(() => {
    if (!bunproProgression) return;
    const timer = window.setTimeout(() => setBunproProgression(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [bunproProgression]);
  const previousAnimationPending = useRef(false);
  const claimPreviousAnimation = useCallback(() => {
    const pending = previousAnimationPending.current;
    previousAnimationPending.current = false;
    return pending;
  }, []);
  const questionTurn = useRef(0);
  const decisionTurn = useRef(-1);
  const retryTurns = useRef(new Map<string, MixedRetry>());
  const promotedHead = useRef<{ lane: Lane; id: string } | null>(null);
  const recordAnswer = useCallback((answer: MixedPreviousAnswer, lane: Lane) => {
    questionTurn.current++;
    const id = answer.source === "bunpro" ? answer.id.replace(/^bunpro:/, "") : answer.id;
    const key = mixedRetryKey(lane, id);
    if (answer.correct) retryTurns.current.delete(key);
    else {
      const turn = questionTurn.current;
      retryTurns.current.set(key, { earliest: turn + 2, after: turn + 2 + Math.floor(Math.random() * 9), latest: turn + 10 });
    }
    latestAnswer.current = answer;
    if (answer.source === "wanikani") setBunproProgression(null);
    previousAnimationPending.current = true;
    setPrevious({ ...answer });
  }, []);
  const [active, setActive] = useState<Lane>("wanikani");
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState<Partial<Record<Lane, boolean>>>({});
  const [complete, setComplete] = useState(false);
  const [wrapUp, setWrapUp] = useState<{ id: number; limits: Record<Lane, number> } | null>(null);
  const [laneProgress, setLaneProgress] = useState<Partial<Record<Lane, MixedProgress>>>({});
  const heads = useRef<Partial<Record<Lane, MixedHead | null>>>({});
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  const lanes: Lane[] = mode === "all" ? ["wanikani", "grammar", "vocab"] : ["wanikani", mode];
  const accuracy = lanes.reduce((sum, lane) => ({ correct: sum.correct + (laneAccuracy[lane]?.correct ?? 0), answered: sum.answered + (laneAccuracy[lane]?.answered ?? 0) }), { correct: 0, answered: 0 });
  const progress = lanes.reduce((sum, lane) => ({ completed: sum.completed + (laneProgress[lane]?.completed ?? 0), total: sum.total + (laneProgress[lane]?.total ?? 0) }), { completed: 0, total: 0 });
  function wrapUpAll() {
    const remaining = Object.fromEntries(lanes.map(lane => [lane, Math.max(0, (laneProgress[lane]?.total ?? 0) - (laneProgress[lane]?.completed ?? 0))]));
    const open = Object.fromEntries(lanes.map(lane => {
      const head = heads.current[lane];
      const subjects = new Set(head?.pending?.filter(question => question.open || (lane === active && question.id === head.id)).map(question => question.subjectId));
      return [lane, subjects.size];
    }));
    setWrapUp(previous => ({ id: (previous?.id ?? 0) + 1, limits: mixedWrapUpLimits(lanes, remaining, active, preferences.reviewWrapUpSize, open) }));
  }
  function reportProgress(lane: Lane, value: MixedProgress) {
    setLaneProgress((previous) => previous[lane]?.completed === value.completed && previous[lane]?.total === value.total ? previous : { ...previous, [lane]: value });
  }
  function report(source: Lane, head: MixedHead | null) {
    const previousHead = heads.current[source];
    heads.current[source] = head;
    if (promotedHead.current?.lane === source && promotedHead.current.id === head?.id) { promotedHead.current = null; return; }
    if (started && (source !== active || (previousHead?.id === head?.id && decisionTurn.current === questionTurn.current))) return;
    if (lanes.some((lane) => heads.current[lane] === undefined)) return;
    setStarted(true);
    const available = lanes.filter((lane) => heads.current[lane]);
    if (!available.length) { setComplete(true); return; }
    decisionTurn.current = questionTurn.current;
    const choices = mixedRetryCandidates(available.map(lane => ({ lane, head: heads.current[lane]! })), retryTurns.current, questionTurn.current);
    const paired = started && source === active && heads.current[active]?.keepTurn;
    const overdue = choices.some(choice => choice.retry && questionTurn.current >= choice.retry.latest);
    const keepPair = paired && !overdue;
    const lane = keepPair ? active : chooseMixedLane(choices, preferences, active, false);
    const choice = choices.find(choice => choice.lane === lane);
    if (!keepPair && choice && choice.question.id !== choice.head.id && choice.head.activate) {
      promotedHead.current = { lane, id: choice.question.id };
      choice.head.activate(choice.question.id);
    }
    setActive(lane);
  }
  function reportError(source: Lane, value: boolean) {
    if (value) { setActive(source); setComplete(false); }
    setFailed((previous) => previous[source] === value ? previous : { ...previous, [source]: value });
  }
  const unsavedCount = lanes.reduce((sum, lane) => sum + (laneResults[lane]?.items.filter(item => item.saveFailed).length ?? 0), 0);
  const visible = (source: Lane) => !complete && (started ? active === source : failed[source]);
  if (connection.isPending) return <BunproLoading kind="reviews" label="Loading mixed reviews" />;
  if (connection.error) return <div role="alert">{connection.error.message}<Button onClick={() => void connection.refetch()}>Retry</Button></div>;
  if (!connection.data?.connected) return <div><p>Connect a valid Bunpro API key to start mixed reviews.</p><ButtonLink href="/settings#bunpro-api-key">Bunpro settings</ButtonLink></div>;
  return <div className={styles.session}>{!complete ? <BunproSaveWarning count={unsavedCount} /> : null}{!started && !lanes.some((lane) => failed[lane]) ? <BunproLoading kind="reviews" label="Loading mixed reviews" /> : null}{complete ? <SessionResults progression={<BunproProgression progression={bunproProgression} mode={preferences.srsProgressionCardDisplayMode} />} title="Mixed reviews complete" mixed items={lanes.flatMap(lane => laneResults[lane]?.items ?? [])} durationMs={Math.max(0, ...lanes.map(lane => laneResults[lane]?.durationMs ?? 0))} pendingCount={lanes.reduce((sum, lane) => sum + (laneResults[lane]?.pendingCount ?? 0), 0)} error={lanes.map(lane => laneResults[lane]?.error).filter(Boolean).join(" ") || undefined} onRestart={() => window.location.reload()} /> : null}<div hidden={!visible("wanikani")} inert={!visible("wanikani")}><CoreStudySession mode="reviews" mixed={{ bunproProgression, reportBunproProgression, accuracy, reportAccuracy: value => reportAccuracy("wanikani", value), reportResults: (results) => reportResults("wanikani", results), progress, onWrapUp: wrapUpAll, wrapUpRequest: wrapUp ? { id: wrapUp.id, limit: wrapUp.limits.wanikani } : undefined, reportProgress: (value) => reportProgress("wanikani", value), previous, onAnswer: answer => recordAnswer(answer, "wanikani"), claimPreviousAnimation, active: started && !complete && active === "wanikani", reportError: (value) => reportError("wanikani", value), report: (head) => report("wanikani", head) }} /></div>{lanes.filter((lane): lane is "grammar" | "vocab" => lane !== "wanikani").map((lane) => <div key={lane} hidden={!visible(lane)} inert={!visible(lane)}><BunproReviews initialMode={lane} mixed={{ bunproSavePolicy, bunproProgression, reportBunproProgression, accuracy, reportAccuracy: value => reportAccuracy(lane, value), reportResults: (results) => reportResults(lane, results), progress, onWrapUp: wrapUpAll, wrapUpRequest: wrapUp ? { id: wrapUp.id, limit: wrapUp.limits[lane] } : undefined, reportProgress: (value) => reportProgress(lane, value), previous, onAnswer: answer => recordAnswer(answer, lane), claimPreviousAnimation, active: started && !complete && active === lane, reportError: (value) => reportError(lane, value), report: (head) => report(lane, head) }} /></div>)}</div>;
}
