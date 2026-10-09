"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { SharedIssue } from "@/features/content/community";
import { COMMUNITY_READ_EVENT, hasUnreadReply, readCommunityVisits, type ActivityReply } from "./activity";
import styles from "@/features/content/community.module.css";

export interface CommunityActivityItem {
  issue: SharedIssue;
  posted: boolean;
  participatedAt: string;
  comments: { id: string; content: string; createdAt: string }[];
  latestReply: ActivityReply | null;
}

export function useCommunityActivity(username: string | undefined) {
  const [items, setItems] = useState<CommunityActivityItem[]>([]);
  const [visits, setVisits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(username));
  const [error, setError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!username) return;
    try {
      const response = await fetch("/community/api?action=activity", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Your activity could not be loaded.");
      if (signal?.aborted) return;
      setItems((payload.items || []).filter((item: CommunityActivityItem) => item.issue));
      setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Your activity could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [username]);
  useEffect(() => {
    const controller = new AbortController();
    const read = () => setVisits(username ? readCommunityVisits(window.localStorage, username) : {});
    const initial = window.setTimeout(() => { setItems([]); setLoading(Boolean(username)); read(); void refresh(controller.signal); }, 0);
    const poll = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    const timer = window.setInterval(poll, 60_000);
    window.addEventListener(COMMUNITY_READ_EVENT, read);
    window.addEventListener("storage", read);
    window.addEventListener("focus", poll);
    return () => { controller.abort(); window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener(COMMUNITY_READ_EVENT, read); window.removeEventListener("storage", read); window.removeEventListener("focus", poll); };
  }, [username, refresh]);
  const unread = (item: CommunityActivityItem) => hasUnreadReply(item.latestReply, visits[item.issue.id], item.participatedAt);
  return { items, loading, error, refresh, unread, unreadCount: items.filter(unread).length };
}

export function CommunityActivity({ activity, query }: { activity: ReturnType<typeof useCommunityActivity>; query: string }) {
  const [page, setPage] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const matched = activity.items.filter((item) => (!onlyUnread || activity.unread(item)) && `${item.issue.title} ${item.issue.content} ${item.comments.map((comment) => comment.content).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const resolvedPage = Math.min(page, Math.max(0, Math.ceil(matched.length / 20) - 1));
  const visible = matched.slice(resolvedPage * 20, (resolvedPage + 1) * 20);
  return <>
    <div className={styles.activityToolbar}><p>Your posts, comments, and liked threads, including closed issues.</p><label><input type="checkbox" checked={onlyUnread} onChange={(event) => { setOnlyUnread(event.target.checked); setPage(0); }} />New replies only</label></div>
    {activity.error ? <div className={styles.error} role="alert">{activity.error}<button type="button" onClick={() => void activity.refresh()}>Try again</button></div> : null}
    {activity.loading ? <div className={styles.loading} role="status">Loading your activity…</div> : visible.length ? <div className={styles.activityList}>{visible.map((item) => {
      const unread = activity.unread(item);
      const target = item.latestReply && unread ? `/community/${item.issue.id}?comment=${item.latestReply.id}#comment-${item.latestReply.id}` : `/community/${item.issue.id}`;
      return <article className={styles.activityItem} data-unread={unread || undefined} key={item.issue.id}>
        <Link className={styles.activityTitle} href={target}><h2>{item.issue.title}</h2><span className={item.issue.status === "open" ? styles.open : styles.closed}>{item.issue.status}</span>{unread ? <span className={styles.unreadBadge}>New reply</span> : null}</Link>
        <p className={styles.meta}>{item.posted ? "You created this issue" : item.comments.length ? "You joined this conversation" : "You liked this issue"}{item.latestReply ? ` · Latest reply by ${item.latestReply.username}` : ""}</p>
        {item.posted ? <p className={styles.activityExcerpt}>{item.issue.content}</p> : null}
        {item.comments.length ? <details className={styles.activityComments} open={item.comments.length === 1}><summary><MessageSquare size={15} aria-hidden />Your {item.comments.length === 1 ? "comment" : `${item.comments.length} comments`}</summary>{item.comments.map((comment) => <Link key={comment.id} href={`/community/${item.issue.id}?comment=${comment.id}#comment-${comment.id}`}><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time><p>{comment.content}</p></Link>)}</details> : null}
      </article>;
    })}</div> : <div className={styles.loading}>{onlyUnread ? "You’re caught up. No new replies." : query ? "No activity matches your search." : "Your posts and comments will appear here when you join a conversation."}</div>}
    {matched.length > 20 ? <nav className={styles.pagination} aria-label="Activity pages"><button type="button" disabled={resolvedPage === 0} onClick={() => setPage(resolvedPage - 1)}>Previous</button><span>Page {resolvedPage + 1}</span><button type="button" disabled={(resolvedPage + 1) * 20 >= matched.length} onClick={() => setPage(resolvedPage + 1)}>Next</button></nav> : null}
  </>;
}
