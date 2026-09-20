"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
import { BunproReviews } from "@/features/bunpro/BunproReviews";
import { bunpro } from "@/features/bunpro/client";
import type { ReviewMode } from "@/features/bunpro/model";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { Button, ButtonLink } from "@/components/ui/Button";
import { chooseMixedLane, type MixedHead, type MixedPreviousAnswer, type MixedProgress } from "./ordering";
import { BunproLoading } from "@/features/bunpro/BunproLoading";
import styles from "./mixed-reviews.module.css";
type Lane = "wanikani" | "grammar" | "vocab";
export function MixedReviews({ mode }: { mode: ReviewMode }) {
  const { user } = useSession();
  const preferences = useWebSettings(user?.data.username ?? "anonymous").study;
  const [previous, setPrevious] = useState<MixedPreviousAnswer | null>(null);
  const [active, setActive] = useState<Lane>("wanikani");
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState<Partial<Record<Lane, boolean>>>({});
  const [complete, setComplete] = useState(false);
  const [laneProgress, setLaneProgress] = useState<Partial<Record<Lane, MixedProgress>>>({});
  const heads = useRef<Partial<Record<Lane, MixedHead | null>>>({});
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  const lanes: Lane[] = mode === "all" ? ["wanikani", "grammar", "vocab"] : ["wanikani", mode];
  const progress = lanes.reduce((sum, lane) => ({ completed: sum.completed + (laneProgress[lane]?.completed ?? 0), total: sum.total + (laneProgress[lane]?.total ?? 0) }), { completed: 0, total: 0 });
  function reportProgress(lane: Lane, value: MixedProgress) {
    setLaneProgress((previous) => previous[lane]?.completed === value.completed && previous[lane]?.total === value.total ? previous : { ...previous, [lane]: value });
  }
  function report(source: Lane, head: MixedHead | null) {
    const previousHead = heads.current[source];
    heads.current[source] = head;
    if (started && (source !== active || previousHead?.id === head?.id)) return;
    if (lanes.some((lane) => heads.current[lane] === undefined)) return;
    setStarted(true);
    const available = lanes.filter((lane) => heads.current[lane]);
    if (!available.length) { setComplete(true); return; }
    setActive((previous) => chooseMixedLane(available.map((lane) => ({ lane, head: heads.current[lane]! })), preferences, previous, started && source === previous));
  }
  function reportError(source: Lane, value: boolean) {
    setFailed((previous) => previous[source] === value ? previous : { ...previous, [source]: value });
  }
  const visible = (source: Lane) => complete || (started ? active === source : failed[source]);
  if (connection.isPending) return <BunproLoading kind="reviews" label="Loading mixed reviews" />;
  if (connection.error) return <div role="alert">{connection.error.message}<Button onClick={() => void connection.refetch()}>Retry</Button></div>;
  if (!connection.data?.connected) return <div><p>Connect a valid Bunpro API key to start mixed reviews.</p><ButtonLink href="/settings#bunpro-api-key">Bunpro settings</ButtonLink></div>;
  return <div className={styles.session}>{!started && !lanes.some((lane) => failed[lane]) ? <BunproLoading kind="reviews" label="Loading mixed reviews" /> : null}{complete ? <h1 className={styles.complete}>Mixed reviews complete</h1> : null}<div hidden={!visible("wanikani")} inert={!visible("wanikani")}><CoreStudySession mode="reviews" mixed={{ progress, reportProgress: (value) => reportProgress("wanikani", value), previous, onAnswer: setPrevious, active: started && !complete && active === "wanikani", reportError: (value) => reportError("wanikani", value), report: (head) => report("wanikani", head) }} /></div>{lanes.filter((lane): lane is "grammar" | "vocab" => lane !== "wanikani").map((lane) => <div key={lane} hidden={!visible(lane)} inert={!visible(lane)}><BunproReviews initialMode={lane} mixed={{ progress, reportProgress: (value) => reportProgress(lane, value), previous, onAnswer: setPrevious, active: started && !complete && active === lane, reportError: (value) => reportError(lane, value), report: (head) => report(lane, head) }} /></div>)}</div>;
}
