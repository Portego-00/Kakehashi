import { supabase } from "../lib/supabase";
import type { Issue } from "./issueService";

export interface IssueActivity {
  issue: Issue;
  posted: boolean;
  participatedAt: string;
  comments: { id: string; content: string; createdAt: string }[];
  latestReply: { id: string; createdAt: string; username: string } | null;
}
type Row = Record<string, unknown>;
async function allRows(read: (offset: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 50) {
    const { data, error } = await read(offset);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("Your activity could not be loaded.");
    result.push(...data);
    if (data.length < 50) return result;
  }
}
export async function getIssueActivity(userId: string, username: string, signal?: AbortSignal): Promise<IssueActivity[]> {
  const quotedId = JSON.stringify(userId), quotedName = JSON.stringify(username);
  const own = `user_id.eq.${quotedId},and(user_id.is.null,user_username.eq.${quotedName})`;
  const [posts, comments, likes] = await Promise.all([
    allRows((offset) => supabase.from("issues").select("id,created_at").or(own).order("created_at", { ascending: false }).range(offset, offset + 49).abortSignal(signal ?? new AbortController().signal)),
    allRows((offset) => supabase.from("issue_comments").select("id,issue_id,content,created_at").or(own).order("created_at", { ascending: false }).range(offset, offset + 49).abortSignal(signal ?? new AbortController().signal)),
    allRows((offset) => supabase.from("issue_likes").select("issue_id,created_at").eq("user_id", userId).range(offset, offset + 49).abortSignal(signal ?? new AbortController().signal)),
  ]);
  const participation = new Map<string, { posted: boolean; since: string; comments: Row[] }>();
  const add = (id: string, time: string, posted: boolean, comment?: Row) => {
    const previous = participation.get(id);
    participation.set(id, { posted: posted || Boolean(previous?.posted), since: previous && previous.since < time ? previous.since : time, comments: [...(previous?.comments ?? []), ...(comment ? [comment] : [])] });
  };
  posts.forEach((row) => add(String(row.id), String(row.created_at), true));
  comments.forEach((row) => add(String(row.issue_id), String(row.created_at), false, row));
  likes.forEach((row) => add(String(row.issue_id), String(row.created_at), false));
  const ids = [...participation.keys()];
  const issues: Row[] = [];
  for (let offset = 0; offset < ids.length; offset += 20) {
    const { data, error } = await supabase.from("issues").select("*,latest_reply:issue_comments(id,created_at,user_username)")
      .in("id", ids.slice(offset, offset + 20))
      .or(`user_id.neq.${quotedId},and(user_id.is.null,user_username.neq.${quotedName})`, { referencedTable: "latest_reply" })
      .order("created_at", { ascending: false, referencedTable: "latest_reply" }).limit(1, { referencedTable: "latest_reply" })
      .abortSignal(signal ?? new AbortController().signal);
    if (error) throw new Error(error.message);
    issues.push(...(data ?? []));
  }
  return issues.map((row) => {
    const own = participation.get(String(row.id))!;
    const latest = Array.isArray(row.latest_reply) ? row.latest_reply[0] as Row | undefined : undefined;
    const { latest_reply: ignored, ...issue } = row;
    void ignored;
    return { issue: issue as unknown as Issue, posted: own.posted, participatedAt: own.since,
      comments: own.comments.map((comment) => ({ id: String(comment.id), content: String(comment.content), createdAt: String(comment.created_at) })),
      latestReply: latest && String(latest.created_at) > own.since ? { id: String(latest.id), createdAt: String(latest.created_at), username: String(latest.user_username || "Learner") } : null };
  }).sort((a, b) => (b.latestReply?.createdAt || b.comments[0]?.createdAt || b.issue.created_at).localeCompare(a.latestReply?.createdAt || a.comments[0]?.createdAt || a.issue.created_at));
}
