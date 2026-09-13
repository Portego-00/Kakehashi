"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Heart, MessageSquare, Monitor, Plus, Search, Send, Trash2, Users, X } from "lucide-react";
import { PatreonIcon } from "@/components/icons/BrandIcons";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Badge } from "@/components/ui/Badge";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import { communityAccountScope, useDraftNavigationGuard, usePersistentCommunityDraft } from "@/features/community/drafts";
import { CommunityMarkdown, safeCommunityMediaUrl } from "@/features/community/CommunityMarkdown";
import { hasWebIssueOrigin } from "@/features/community/issue-origin";
import { EmptyState } from "./ui";
import styles from "./community.module.css";

export interface SharedIssue {
  id: string;
  user_id?: string | null;
  user_username: string;
  user_level?: number | null;
  user_gravatar_hash?: string | null;
  is_developer?: boolean;
  is_patreon_supporter?: boolean;
  title: string;
  content: string;
  status: "open" | "closed";
  labels?: string[] | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  reply_count: number;
  is_liked?: boolean;
}

export interface SharedComment {
  id: string;
  issue_id: string;
  user_id?: string | null;
  user_username: string | null;
  user_level?: number | null;
  user_gravatar_hash?: string | null;
  is_developer?: boolean;
  is_patreon_supporter?: boolean;
  content: string;
  created_at: string;
  updated_at?: string;
  likes_count: number;
  reply_to_comment_id?: string | null;
  is_liked?: boolean;
}

interface CommunityCounts { open: number; closed: number }

interface Supporter {
  id: string;
  username: string;
  displayName: string;
  level: number | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  tier: string | null;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The community request failed.");
  return payload;
}

async function postCommunity<T>(body: Record<string, unknown>) {
  return readJson<T>(await fetch("/community/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return formatter.format(months, "month");
  return formatter.format(Math.round(months / 12), "year");
}

function countLabel(value: number | undefined) { return Number(value || 0).toLocaleString(); }

function UserMark({ name, hash, level }: { name: string | null; hash?: string | null; level?: number | null }) {
  const initial = name?.trim().charAt(0).toUpperCase() || "L";
  return <span className={styles.userMark} aria-hidden="true"><UserAvatar className={styles.avatar} hash={hash} fallback={initial} />{typeof level === "number" ? <small>{level}</small> : null}</span>;
}

function AuthorName({ name, isDeveloper, isPatreonSupporter }: { name: string | null; isDeveloper?: boolean; isPatreonSupporter?: boolean }) {
  return <span className={styles.authorName}><strong>{name || "Learner"}</strong>{isDeveloper ? <Badge className={styles.developerBadge}>DEV</Badge> : null}{isPatreonSupporter ? <Badge className={styles.supporterBadge}><PatreonIcon size={11} />Supporter</Badge> : null}</span>;
}

function IssueOriginBadge({ labels }: { labels?: string[] | null }) {
  if (!hasWebIssueOrigin(labels)) return null;
  return <Badge className={styles.webBadge} aria-label="Created on Kakehashi Web" title="Created on Kakehashi Web"><Monitor size={13} aria-hidden="true" />Web</Badge>;
}

export function CommunityWorkspace() {
  const [issues, setIssues] = useState<SharedIssue[]>([]);
  const [counts, setCounts] = useState<CommunityCounts>({ open: 0, closed: 0 });
  const [configured, setConfigured] = useState(true);
  const [writable, setWritable] = useState(true);
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(searchInput.trim()); setPage(0); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ action: "issues", status, sort: "latest", page: String(page) });
    if (query) params.set("query", query);
    try {
      const payload = await readJson<{ configured: boolean; writable?: boolean; items: SharedIssue[]; counts?: CommunityCounts; hasMore?: boolean }>(await fetch(`/community/api?${params}`, { cache: "no-store", signal }));
      setConfigured(payload.configured);
      setWritable(payload.writable !== false);
      setIssues(payload.items || []);
      setCounts(payload.counts || { open: 0, closed: 0 });
      setHasMore(Boolean(payload.hasMore));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The board could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  function selectStatus(next: "open" | "closed") {
    if (next === status) return;
    setStatus(next);
    setPage(0);
  }

  async function toggleIssueLike(issueId: string) {
    if (pendingLikes.has(issueId)) return;
    const previous = issues.find((issue) => issue.id === issueId);
    if (!previous) return;
    setPendingLikes((current) => new Set(current).add(issueId));
    setIssues((current) => current.map((issue) => issue.id === issueId ? { ...issue, is_liked: !issue.is_liked, likes_count: issue.is_liked ? Math.max(0, issue.likes_count - 1) : issue.likes_count + 1 } : issue));
    try {
      const result = await postCommunity<{ liked: boolean; likes_count: number }>({ action: "toggleIssueLike", issueId, requestId: crypto.randomUUID() });
      setIssues((current) => current.map((issue) => issue.id === issueId ? { ...issue, is_liked: result.liked, likes_count: result.likes_count } : issue));
    } catch (cause) {
      setIssues((current) => current.map((issue) => issue.id === issueId ? previous : issue));
      setError(cause instanceof Error ? cause.message : "The like could not be saved.");
    } finally {
      setPendingLikes((current) => { const next = new Set(current); next.delete(issueId); return next; });
    }
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><h1>Community</h1><p>Ask for help, report a problem, or share an idea with other Kakehashi learners.</p></div>
      <div className={styles.actions}><Link className={styles.secondary} href="/supporters"><Users size={17} aria-hidden="true" />Supporters</Link>{writable ? <Link className={styles.primary} href="/community/new"><Plus size={17} aria-hidden="true" />New issue</Link> : null}</div>
    </header>

    {!configured ? <div className={styles.notice}><strong>Shared board unavailable</strong><span>Connect the shared community service to load issues.</span></div> : null}
    {configured && !writable ? <div className={styles.notice}><strong>Community is read-only</strong><span>Browsing is available, but posting requires the deployment&apos;s server-side Supabase secret key.</span></div> : null}

    <section className={styles.board} aria-label="Issue board">
      <div className={styles.boardToolbar}>
        <div className={styles.statusTabs} role="tablist" aria-label="Issue status">
          <button type="button" role="tab" aria-selected={status === "open"} onClick={() => selectStatus("open")}>Open <span>{countLabel(counts.open)}</span></button>
          <button type="button" role="tab" aria-selected={status === "closed"} onClick={() => selectStatus("closed")}>Closed <span>{countLabel(counts.closed)}</span></button>
        </div>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Search community issues" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search issues" />{searchInput ? <button type="button" aria-label="Clear search" onClick={() => setSearchInput("")}><X size={16} aria-hidden="true" /></button> : null}</label>
      </div>

      {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
      {loading ? <div className={styles.loading} role="status">Loading issues…</div> : issues.length ? <>
        <div className={styles.issueList}>{issues.map((issue) => <article className={styles.issue} key={issue.id}>
          <UserMark name={issue.user_username} hash={issue.user_gravatar_hash} level={issue.user_level} />
          <Link href={`/community/${issue.id}`} className={styles.issueMain}>
            <div className={styles.issueTitle}><h2>{issue.title}</h2><div className={styles.issueFlags}><IssueOriginBadge labels={issue.labels} /><span className={issue.status === "open" ? styles.open : styles.closed}>{issue.status}</span></div></div>
            <p>{issue.content}</p>
            <span className={`${styles.meta} ${styles.authorMeta}`}><AuthorName name={issue.user_username} isDeveloper={issue.is_developer} isPatreonSupporter={issue.is_patreon_supporter} /><span aria-hidden="true">·</span><span>{relativeTime(issue.created_at)}</span></span>
          </Link>
          <div className={styles.counts}>
            <span><MessageSquare size={15} aria-hidden="true" />{countLabel(issue.reply_count)}</span>
            {writable ? <button type="button" disabled={pendingLikes.has(issue.id)} aria-pressed={Boolean(issue.is_liked)} aria-label={`${issue.is_liked ? "Unlike" : "Like"} ${issue.title}, ${issue.likes_count || 0} likes`} onClick={() => void toggleIssueLike(issue.id)}><Heart size={15} fill={issue.is_liked ? "currentColor" : "none"} aria-hidden="true" />{countLabel(issue.likes_count)}</button> : <span><Heart size={15} aria-hidden="true" />{countLabel(issue.likes_count)}</span>}
          </div>
        </article>)}</div>
        <nav className={styles.pagination} aria-label="Issue pages"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span aria-live="polite">Page {page + 1}</span><button type="button" disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)}>Next</button></nav>
      </> : <EmptyState title={configured ? "No issues found" : "The board needs configuration"}>{configured ? (query ? "Try a different search." : `There are no ${status} issues.`) : "Connect the shared community service to load the issue board."}</EmptyState>}
    </section>
  </main>;
}

export function NewIssueWorkspace() {
  const router = useRouter();
  const { user } = useSession();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const [draft, setDraft, discardDraft] = usePersistentCommunityDraft(communityAccountScope(user), "new-issue", { title: "", content: "" });
  const { title, content } = draft;
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const writeTab = useRef<HTMLButtonElement>(null);
  const previewTab = useRef<HTMLButtonElement>(null);
  const dirty = Boolean(title.trim() || content.trim());
  useDraftNavigationGuard(dirty);

  function changeEditorMode(nextPreview: boolean) { setPreview(nextPreview); (nextPreview ? previewTab : writeTab).current?.focus(); }
  function editorKeys(event: KeyboardEvent<HTMLButtonElement>) { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); changeEditorMode(event.key === "ArrowRight"); } }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const gravatarEmail = webSettings.profile.gravatarEmail.trim();
      const payload = await postCommunity<{ item: SharedIssue }>({ action: "createIssue", title, content, ...(gravatarEmail ? { gravatarEmail } : {}) });
      discardDraft();
      router.push(`/community/${payload.item.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The issue could not be created."); setBusy(false); }
  }

  return <main className={styles.page}><Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link><header className={styles.compactHero}><h1>New issue</h1><p>Posting as {user?.data.username || "learner"}. Markdown links and existing image or video URLs are supported.</p></header><form className={styles.composer} onSubmit={(event) => void submit(event)}><div className={styles.modeTabs} role="tablist" aria-label="Editor mode"><button ref={writeTab} id="write-tab" type="button" role="tab" aria-selected={!preview} aria-controls="write-panel" tabIndex={preview ? -1 : 0} onKeyDown={editorKeys} onClick={() => changeEditorMode(false)}>Write</button><button ref={previewTab} id="preview-tab" type="button" role="tab" aria-selected={preview} aria-controls="preview-panel" tabIndex={preview ? 0 : -1} onKeyDown={editorKeys} onClick={() => changeEditorMode(true)}>Preview</button></div>{preview ? <article id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" className={styles.preview}><h2>{title || "Untitled issue"}</h2>{content ? <CommunityMarkdown>{content}</CommunityMarkdown> : <p>Nothing to preview yet.</p>}</article> : <div id="write-panel" role="tabpanel" aria-labelledby="write-tab" className={styles.modePanel}><label>Title<input value={title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={160} required placeholder="A concise problem statement" /></label><label>Details<textarea value={content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} maxLength={12_000} required placeholder="Steps, context, expected result, and what happened instead" /></label></div>}{error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.actions}><Link className={styles.secondary} href="/community">Cancel</Link><button className={styles.secondary} type="button" disabled={!dirty || busy} onClick={discardDraft}>Discard draft</button><button className={styles.primary} type="submit" disabled={busy || title.trim().length < 4 || content.trim().length < 8}><Send size={17} aria-hidden="true" />{busy ? "Submitting…" : "Submit issue"}</button></div></form></main>;
}

export function IssueDetailWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const [issue, setIssue] = useState<SharedIssue | null>(null);
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [writable, setWritable] = useState(true);
  const [commentPage, setCommentPage] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(() => new Set());
  const [replyDraft, setReplyDraft, discardReplyDraft] = usePersistentCommunityDraft(communityAccountScope(user), `reply:${id}`, { content: "", requestId: "", replyToCommentId: "" });
  const [likeOperations, setLikeOperations] = usePersistentCommunityDraft(communityAccountScope(user), `like-operations:${id}`, { ids: {} as Record<string, string> });
  const reply = replyDraft.content;
  const replyTarget = comments.find((comment) => comment.id === replyDraft.replyToCommentId) || null;
  const replyDirty = Boolean(reply.trim());
  useDraftNavigationGuard(replyDirty);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const payload = await readJson<{ issue: SharedIssue; comments: SharedComment[]; writable?: boolean; canManage?: boolean; commentsHasMore?: boolean }>(await fetch(`/community/api?action=issue&id=${encodeURIComponent(id)}&commentPage=${commentPage}`, { cache: "no-store", signal }));
      setIssue(payload.issue); setComments(payload.comments || []); setWritable(payload.writable !== false); setCanManage(Boolean(payload.canManage)); setCommentsHasMore(Boolean(payload.commentsHasMore));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The issue could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [commentPage, id]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);

  async function addReply(event: FormEvent) {
    event.preventDefault(); if (!reply.trim()) return;
    setBusy(true); setError("");
    const operationId = replyDraft.requestId || crypto.randomUUID();
    if (!replyDraft.requestId) setReplyDraft((current) => ({ ...current, requestId: operationId }));
    try {
      const gravatarEmail = webSettings.profile.gravatarEmail.trim();
      const payload = await postCommunity<{ item: SharedComment }>({ action: "addComment", issueId: id, content: reply, replyToCommentId: replyDraft.replyToCommentId || null, requestId: operationId, ...(gravatarEmail ? { gravatarEmail } : {}) });
      setComments((current) => [...current, payload.item]);
      setIssue((current) => current ? { ...current, reply_count: current.reply_count + 1 } : current);
      discardReplyDraft();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The reply could not be posted."); }
    finally { setBusy(false); }
  }

  async function toggleLike(kind: "issue" | "comment", targetId: string) {
    const key = `${kind}:${targetId}`;
    if (pendingLikes.has(key)) return;
    const operationId = likeOperations.ids[key] || crypto.randomUUID();
    if (!likeOperations.ids[key]) setLikeOperations((current) => ({ ids: { ...current.ids, [key]: operationId } }));
    const previousIssue = issue;
    const previousComments = comments;
    setPendingLikes((current) => new Set(current).add(key));
    if (kind === "issue") setIssue((current) => current ? { ...current, is_liked: !current.is_liked, likes_count: current.is_liked ? Math.max(0, current.likes_count - 1) : current.likes_count + 1 } : current);
    else setComments((current) => current.map((comment) => comment.id === targetId ? { ...comment, is_liked: !comment.is_liked, likes_count: comment.is_liked ? Math.max(0, comment.likes_count - 1) : comment.likes_count + 1 } : comment));
    try {
      const result = await postCommunity<{ liked: boolean; likes_count: number }>(kind === "issue" ? { action: "toggleIssueLike", issueId: targetId, requestId: operationId } : { action: "toggleCommentLike", commentId: targetId, requestId: operationId });
      if (kind === "issue") setIssue((current) => current ? { ...current, is_liked: result.liked, likes_count: result.likes_count } : current);
      else setComments((current) => current.map((comment) => comment.id === targetId ? { ...comment, is_liked: result.liked, likes_count: result.likes_count } : comment));
      setLikeOperations((current) => { const ids = { ...current.ids }; delete ids[key]; return { ids }; });
    } catch (cause) {
      setIssue(previousIssue); setComments(previousComments);
      setError(cause instanceof Error ? cause.message : "The like could not be saved.");
    } finally { setPendingLikes((current) => { const next = new Set(current); next.delete(key); return next; }); }
  }

  async function updateStatus() {
    if (!issue) return;
    setBusy(true); setError("");
    try {
      const payload = await postCommunity<{ item: SharedIssue }>({ action: "updateStatus", issueId: issue.id, status: issue.status === "open" ? "closed" : "open" });
      setIssue(payload.item);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The status could not be changed."); }
    finally { setBusy(false); }
  }

  async function deleteIssue() {
    if (!issue || !window.confirm("Delete this issue and all of its replies? This cannot be undone.")) return;
    setBusy(true); setError("");
    try { await postCommunity<{ ok: true }>({ action: "deleteIssue", issueId: issue.id }); router.replace("/community"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The issue could not be deleted."); setBusy(false); }
  }

  if (loading && !issue) return <main className={styles.page}><Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link><div className={styles.loading} role="status">Loading issue…</div></main>;
  if (!issue) return <main className={styles.page}><Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link><div className={styles.error} role="alert"><span>{error || "Issue not found."}</span><button type="button" onClick={() => void load()}>Try again</button></div></main>;

  return <main className={styles.page}>
    <Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link>
    <article className={styles.thread}>
      <header><UserMark name={issue.user_username} hash={issue.user_gravatar_hash} level={issue.user_level} /><div className={styles.threadTitle}><div><div className={styles.issueFlags}><IssueOriginBadge labels={issue.labels} /><span className={issue.status === "open" ? styles.open : styles.closed}>{issue.status}</span></div><h1>{issue.title}</h1><p className={`${styles.meta} ${styles.authorMeta}`}><AuthorName name={issue.user_username} isDeveloper={issue.is_developer} isPatreonSupporter={issue.is_patreon_supporter} /><span aria-hidden="true">·</span><span>{relativeTime(issue.created_at)}</span></p></div><div className={styles.actions}>{writable ? <button className={styles.secondary} type="button" disabled={pendingLikes.has(`issue:${issue.id}`)} aria-pressed={Boolean(issue.is_liked)} aria-label={`${issue.is_liked ? "Unlike" : "Like"} issue, ${issue.likes_count || 0} likes`} onClick={() => void toggleLike("issue", issue.id)}><Heart size={17} fill={issue.is_liked ? "currentColor" : "none"} aria-hidden="true" />{countLabel(issue.likes_count)}</button> : <span className={styles.readonlyCount}><Heart size={17} aria-hidden="true" />{countLabel(issue.likes_count)}</span>}{canManage ? <><button className={styles.secondary} type="button" disabled={busy} onClick={() => void updateStatus()}><CheckCircle2 size={17} aria-hidden="true" />{issue.status === "open" ? "Close" : "Reopen"}</button><button className={styles.dangerButton} type="button" disabled={busy} onClick={() => void deleteIssue()}><Trash2 size={17} aria-hidden="true" />Delete</button></> : null}</div></div></header>
      <CommunityMarkdown>{issue.content}</CommunityMarkdown>
    </article>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <section className={styles.replies}>
      <h2>{countLabel(issue.reply_count)} {issue.reply_count === 1 ? "reply" : "replies"}</h2>
      {comments.map((comment) => { const parent = comments.find((candidate) => candidate.id === comment.reply_to_comment_id); return <article key={comment.id}><header><div className={styles.commentAuthor}><UserMark name={comment.user_username} hash={comment.user_gravatar_hash} level={comment.user_level} /><div><AuthorName name={comment.user_username} isDeveloper={comment.is_developer} isPatreonSupporter={comment.is_patreon_supporter} /><span className={styles.meta}>{relativeTime(comment.created_at)}</span></div></div>{writable ? <button className={styles.textButton} type="button" disabled={pendingLikes.has(`comment:${comment.id}`)} aria-pressed={Boolean(comment.is_liked)} aria-label={`${comment.is_liked ? "Unlike" : "Like"} reply by ${comment.user_username || "learner"}, ${comment.likes_count || 0} likes`} onClick={() => void toggleLike("comment", comment.id)}><Heart size={15} fill={comment.is_liked ? "currentColor" : "none"} aria-hidden="true" />{countLabel(comment.likes_count)}</button> : <span className={styles.readonlyCount}><Heart size={15} aria-hidden="true" />{countLabel(comment.likes_count)}</span>}</header>{comment.reply_to_comment_id ? <div className={styles.replyContext}><span>Replying to {parent?.user_username || "an earlier comment"}</span>{parent ? <p>{parent.content}</p> : null}</div> : null}<CommunityMarkdown>{comment.content}</CommunityMarkdown>{writable ? <button className={styles.replyAction} type="button" onClick={() => { setReplyDraft((current) => ({ ...current, replyToCommentId: comment.id, requestId: "" })); document.getElementById("community-reply")?.focus(); }}>Reply</button> : null}</article>; })}
      <nav className={styles.pagination} aria-label="Reply pages"><button type="button" disabled={commentPage === 0 || busy} onClick={() => setCommentPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {commentPage + 1}</span><button type="button" disabled={!commentsHasMore || busy} onClick={() => setCommentPage((value) => value + 1)}>Next</button></nav>
      {writable ? <form className={styles.replyBox} onSubmit={(event) => void addReply(event)}>{replyTarget ? <div className={styles.replyingTo}><span>Replying to {replyTarget.user_username || "Learner"}</span><button type="button" aria-label="Cancel reply to comment" onClick={() => setReplyDraft((current) => ({ ...current, replyToCommentId: "", requestId: "" }))}><X size={16} aria-hidden="true" /></button></div> : null}<label htmlFor="community-reply">Reply as {user?.data.username || "learner"}</label><textarea id="community-reply" value={reply} onChange={(event) => setReplyDraft((current) => ({ ...current, content: event.target.value, requestId: "" }))} placeholder="Add a useful reply" maxLength={6_000} /><div className={styles.actions}><button className={styles.secondary} type="button" disabled={!replyDirty || busy} onClick={discardReplyDraft}>Discard draft</button><button className={styles.primary} type="submit" disabled={busy || !reply.trim()}><MessageSquare size={17} aria-hidden="true" />{busy ? "Posting…" : "Reply"}</button></div></form> : <div className={styles.notice}><strong>Read-only community</strong><span>This deployment needs a server-side Supabase secret key before it can post replies or likes.</span></div>}
    </section>
  </main>;
}

const feedbackCategories = ["Bug Report", "Performance Issue", "UI/UX Suggestion", "General Feedback"];
const featureCategories = ["Study Experience", "Review System", "Statistics", "User Interface", "Performance", "New Feature"];

export function FeedbackWorkspace({ kind }: { kind: "Feedback" | "Feature Request" }) {
  const { user } = useSession();
  const categories = kind === "Feedback" ? feedbackCategories : featureCategories;
  const [draft, setDraft, discardDraft] = usePersistentCommunityDraft(communityAccountScope(user), kind === "Feedback" ? "feedback" : "feature-request", { selected: [] as string[], message: "" });
  const { selected, message } = draft;
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const dirty = Boolean(message.trim() || selected.length);
  useDraftNavigationGuard(dirty);
  async function submit(event: FormEvent) { event.preventDefault(); setStatus("sending"); setError(""); try { await postCommunity({ action: "feedback", kind, categories: selected, message }); setStatus("sent"); discardDraft(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Your message could not be sent."); setStatus("idle"); } }
  return <main className={styles.page}><Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link><header className={styles.compactHero}><h1>{kind === "Feedback" ? "Send feedback" : "Request a feature"}</h1><p>{kind === "Feedback" ? "Tell us where Kakehashi is helping—and where it gets in your way." : "Describe the learning problem first, then the feature you imagine."}</p></header><form className={styles.composer} onSubmit={(event) => void submit(event)}><fieldset><legend>{kind === "Feedback" ? "What kind of feedback is this?" : "What area would this improve?"}</legend><div className={styles.chips}>{categories.map((category) => <label key={category}><input type="checkbox" checked={selected.includes(category)} onChange={() => setDraft((current) => ({ ...current, selected: current.selected.includes(category) ? current.selected.filter((item) => item !== category) : [...current.selected, category] }))} />{category}</label>)}</div></fieldset><label>{kind === "Feedback" ? "Tell us more" : "Describe your feature idea"}<textarea value={message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} required maxLength={8_000} /></label>{status === "sent" ? <p className={styles.success} role="status">Thanks—your message was sent.</p> : null}{error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.actions}><button className={styles.secondary} type="button" disabled={!dirty || status === "sending"} onClick={discardDraft}>Discard draft</button><button className={styles.primary} type="submit" disabled={status === "sending" || !message.trim()}><Send size={17} aria-hidden="true" />{status === "sending" ? "Sending…" : `Send ${kind.toLowerCase()}`}</button></div></form></main>;
}

export function SupportersWorkspace() {
  const [items, setItems] = useState<Supporter[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => { setLoading(true); setError(""); void fetch(`/community/api?action=supporters&page=${page}`, { signal: controller.signal }).then((response) => readJson<{ configured: boolean; items: Supporter[]; hasMore?: boolean }>(response)).then((payload) => { setConfigured(payload.configured); setItems(payload.items || []); setHasMore(Boolean(payload.hasMore)); }).catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Supporters could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [page]);
  return <main className={styles.page}><Link className={styles.back} href="/community"><ArrowLeft size={17} aria-hidden="true" />Back to community</Link><header className={styles.supporterHero}><Users size={30} aria-hidden="true" /><div><h1>Patreon supporters</h1><p>These learners help keep Kakehashi independent and improving.</p></div></header>{error ? <p className={styles.error} role="alert">{error}</p> : null}{loading ? <div className={styles.loading} role="status">Loading supporters…</div> : !configured ? <EmptyState title="Supporter list unavailable">Connect the shared community service to load the live roll.</EmptyState> : items.length ? <><div className={styles.supporterGrid}>{items.map((item) => { const profile = item.profileUrl ? safeCommunityMediaUrl(item.profileUrl) : null; const avatar = item.avatarUrl ? safeCommunityMediaUrl(item.avatarUrl) : null; const content = <><span className={styles.supporterAvatar}>{avatar ? <Image src={avatar} alt="" width={48} height={48} unoptimized /> : item.displayName.slice(0, 1).toUpperCase()}</span><div><h2>{item.displayName}</h2><p>{item.username ? `@${item.username}${item.level ? ` · Level ${item.level}` : ""}` : item.level ? `Level ${item.level}` : item.tier || "Supporter"}</p>{item.tier ? <span className={styles.supporterTier}>{item.tier}</span> : null}</div></>; return profile ? <a href={profile} target="_blank" rel="noreferrer" key={item.id}>{content}</a> : <article key={item.id}>{content}</article>; })}</div><nav className={styles.pagination} aria-label="Supporter pages"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={!hasMore} onClick={() => setPage((value) => value + 1)}>Next</button></nav></> : <EmptyState title="No supporters published yet">The live supporter roll will appear here when entries are available.</EmptyState>}</main>;
}
