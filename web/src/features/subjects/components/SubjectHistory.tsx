'use client';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { type HistoryPage } from '../../../../../shared/subject-history/model';
import type { Subject } from '@/types/wanikani';
import { SubjectCharacter } from './SubjectCharacter';
import { HistoryDiff } from './HistoryDiff';
import styles from './subject-history.module.css';

export function SubjectHistory({ subjectId, label, subject }: { subjectId: number; label: string; subject?: Subject }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  const history = useInfiniteQuery({
    queryKey: ['subject-history-v2', subjectId], enabled: open, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const query = new URLSearchParams({ subjectId: String(subjectId) });
      if (pageParam) query.set('cursor', pageParam);
      const response = await fetch(`/api/subjects/history?${query}`, { signal });
      if (!response.ok) throw new Error('History could not be loaded. Please try again.');
      return response.json() as Promise<HistoryPage>;
    },
    getNextPageParam: page => page.cursor ?? undefined,
    staleTime: 24 * 60 * 60_000, gcTime: 24 * 60 * 60_000, retry: 1,
  });
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { if (typeof element.showModal === 'function') element.showModal(); else element.setAttribute('open', ''); document.getElementById(title)?.focus(); }
    else if (!open && element.open) { if (typeof element.close === 'function') element.close(); else element.removeAttribute('open'); }
  }, [open, title]);
  const entries = history.data?.pages.flatMap(page => page.entries) ?? [];
  const baseline = history.data?.pages[0]?.baselineAt;
  return <>
    <button ref={trigger} type="button" title="Change history" aria-label="Change history" onClick={() => setOpen(true)}><History size={18} aria-hidden /></button>
    {typeof document !== 'undefined' ? createPortal(<dialog ref={dialog} className={styles.dialog} data-type={subject?.object ?? "kanji"} aria-labelledby={title} onCancel={() => setOpen(false)} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <header className={styles.header}>
        <div className={styles.headerTop}><h2 id={title} tabIndex={-1}>Change history</h2><button type="button" className={styles.close} aria-label="Close change history" onClick={() => setOpen(false)}><X size={20} /></button></div>
        <div className={styles.identity}>{subject ? <SubjectCharacter subject={subject} imageSize="3.5rem" imageTone="subject" className={styles.character} /> : null}<div><p>{subject ? subject.data.meanings.find(meaning => meaning.primary)?.meaning ?? subject.data.slug : label}</p>{subject ? <span>Level {subject.data.level} · {subject.object.replace('_', ' ')}</span> : null}</div></div>
      </header>
      <div className={styles.body}>
        {history.isLoading ? <p role="status">Loading history…</p> : null}
        {history.isError ? <div role="alert"><p>History could not be loaded.</p><button type="button" onClick={() => history.refetch()}>Try again</button></div> : null}
        {entries.length ? <div className={styles.legend}><span><del>− Removed</del></span><span><ins>+ Added</ins></span></div> : null}
        {entries.map((entry, index) => <details key={entry.id} className={styles.entry} open={index === 0}>
          <summary className={styles.entryHeading}>{entry.source?.kind === 'archive' ? <strong>Pre-2019 archive</strong> : <time dateTime={entry.updatedAt}>{new Date(entry.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</time>}<span>{entry.changes.length} {entry.source?.kind === 'archive' ? 'archived fields' : entry.changes.length === 1 ? 'change' : 'changes'}</span></summary>
          {entry.source?.kind === 'archive' ? <p className={styles.coverage}>{entry.source.summary} Compared on {new Date(entry.source.comparedAt ?? entry.observedAt).toLocaleDateString()}. <a href={entry.source.url} target="_blank" rel="noreferrer">Tofugu archive</a> · <a href={entry.source.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p> : null}
          <div className={styles.sections}>{entry.changes.map(change => <HistoryDiff archived={entry.source?.kind === 'archive'} key={change.field} change={change} labels={entry.labels} subjectType={subject?.object ?? 'kanji'} />)}</div>
        </details>)}
        {history.isSuccess && !entries.length ? <p>No changes recorded yet.</p> : null}
        {history.hasNextPage ? <button className={styles.more} type="button" disabled={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>{history.isFetchingNextPage ? 'Loading…' : 'Load older changes'}</button> : null}
        {history.isSuccess ? <p className={styles.coverage}>{baseline ? `Tracking since ${new Date(baseline).toLocaleDateString()}. Earlier coverage is partial; archived content is shown where available.` : 'This subject has not been archived yet. Check back after the next daily update.'}</p> : null}
      </div>
    </dialog>, document.body) : null}
  </>;
}
