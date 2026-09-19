"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ArrowUpRight, CalendarDays, CircleAlert } from "lucide-react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { ButtonLink } from "@/components/ui/Button";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { parsePublicAnalyticsSnapshot, PUBLIC_SNAPSHOT_STAGES } from "../analytics-public-share";
import styles from "../public-progress-snapshot.module.css";

function subscribeToFragment(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readFragment = () => window.location.hash;
const readServerFragment = () => null;
const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function PublicProgressSnapshot() {
  const fragment = useSyncExternalStore<string | null>(subscribeToFragment, readFragment, readServerFragment);
  const snapshot = useMemo(() => fragment ? parsePublicAnalyticsSnapshot(fragment) : null, [fragment]);
  const total = snapshot ? PUBLIC_SNAPSHOT_STAGES.reduce((sum, stage) => sum + snapshot.srs[stage], 0) : 0;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/login" prefetch={false} aria-label="Kakehashi home" className={styles.brandLink}><KakehashiBrand className={styles.brand} /></Link>
      <ButtonLink href="/login" prefetch={false} size="small">Open Kakehashi<ArrowUpRight size={16} aria-hidden /></ButtonLink>
    </header>

    {fragment === null ? <div className={styles.pending} role="status">Loading progress snapshot...</div> : snapshot ? <article className={styles.snapshot}>
      <div className={styles.identity}>
        <h1>{snapshot.username ? `${snapshot.username}'s WaniKani progress` : "WaniKani progress"}</h1>
        <p><CalendarDays size={16} aria-hidden /><span>Captured <time dateTime={snapshot.capturedAt}>{new Date(snapshot.capturedAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</time></span></p>
      </div>

      <dl className={styles.metrics}>
        <div><dt>Level</dt><dd>{snapshot.level}<span> / 60</span></dd></div>
        <div><dt>Lifetime accuracy</dt><dd>{snapshot.accuracy === null ? "No data" : `${formatNumber(snapshot.accuracy)}%`}</dd></div>
        <div><dt>Guru+ kanji</dt><dd>{formatNumber(snapshot.learnedGuruKanji)}</dd></div>
        <div><dt>Burned items</dt><dd>{formatNumber(snapshot.burned)}</dd></div>
      </dl>

      <section className={styles.knowledge} aria-labelledby="snapshot-knowledge">
        <div className={styles.sectionHeader}><h2 id="snapshot-knowledge">SRS distribution</h2><span>{formatNumber(total)} learned items</span></div>
        {total > 0 ? <div className={styles.distribution} role="img" aria-label={PUBLIC_SNAPSHOT_STAGES.map((stage) => `${stage}: ${snapshot.srs[stage]}`).join(", ")}>
          {PUBLIC_SNAPSHOT_STAGES.map((stage) => <span key={stage} data-stage={stage.toLowerCase()} style={{ width: `${snapshot.srs[stage] / total * 100}%` }} />)}
        </div> : null}
        <dl className={styles.stages}>{PUBLIC_SNAPSHOT_STAGES.map((stage) => <div key={stage}>
          <dt><SrsStageIcon level={stage} size={26} /><span>{stage}</span></dt>
          <dd><strong>{formatNumber(snapshot.srs[stage])}</strong><span>{total ? formatNumber(snapshot.srs[stage] / total * 100) : "0"}%</span></dd>
        </div>)}</dl>
      </section>

      <footer className={styles.footer}>
        <span>Saved progress snapshot</span>
        {snapshot.daysStudying !== undefined ? <span>{formatNumber(snapshot.daysStudying)} days since starting</span> : null}
      </footer>
    </article> : <div className={styles.invalid}>
      <CircleAlert size={26} aria-hidden />
      <h1>Progress snapshot unavailable</h1>
      <p>The snapshot in this link is incomplete or invalid.</p>
    </div>}
  </main>;
}
