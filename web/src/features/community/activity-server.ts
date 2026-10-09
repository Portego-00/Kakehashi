import "server-only";

import { communityMode, supabaseRequest, type CommunityIdentity } from "./server";
import { COMMUNITY_ISSUE_READ_SELECT, publicCommunityIssue } from "./public-issue";
import { boundedIdChunks } from "./pagination";

type Row = Record<string, unknown>;

// Read every participation page so older threads retain their reply badges.
async function rowsFor(path: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 50) {
    const rows = await supabaseRequest(`${path}&limit=50&offset=${offset}`);
    if (!Array.isArray(rows)) throw new Error("Community activity could not be loaded.");
    result.push(...rows);
    if (rows.length < 50) return result;
  }
}

export async function communityActivity(identity: CommunityIdentity) {
  const author = encodeURIComponent(JSON.stringify(identity.id));
  const name = encodeURIComponent(JSON.stringify(identity.username));
  const own = `or=(user_id.eq.${author},and(user_id.is.null,user_username.eq.${name}))`;
  const [posts, comments, likes] = await Promise.all([
    rowsFor(`issues?select=id,created_at&${own}&order=created_at.desc`),
    rowsFor(`issue_comments?select=id,issue_id,content,created_at&${own}&order=created_at.desc`),
    rowsFor(`issue_likes?select=issue_id,created_at&user_id=eq.${author}&order=created_at.desc`),
  ]);
  const participation = new Map<string, { posted: boolean; since: string; comments: Row[] }>();
  function add(id: string, time: string, posted: boolean, comment?: Row) {
    const previous = participation.get(id);
    participation.set(id, { posted: posted || Boolean(previous?.posted), since: previous && previous.since < time ? previous.since : time, comments: [...(previous?.comments ?? []), ...(comment ? [comment] : [])] });
  }
  posts.forEach((row) => add(String(row.id), String(row.created_at), true));
  comments.forEach((row) => add(String(row.issue_id), String(row.created_at), false, row));
  likes.forEach((row) => add(String(row.issue_id), String(row.created_at), false));
  const chunks = boundedIdChunks([...participation.keys()], 20, participation.size);
  const pages = await Promise.all(chunks.map(async (ids) => {
    const path = `issues?select=${COMMUNITY_ISSUE_READ_SELECT},latest_reply:issue_comments(id,created_at,user_username)&id=in.(${ids.join(",")})&latest_reply.or=(user_id.neq.${author},and(user_id.is.null,user_username.neq.${name}))&latest_reply.order=created_at.desc,id.desc&latest_reply.limit=1&limit=${ids.length}`;
    const issues = await supabaseRequest(path);
    if (!Array.isArray(issues)) throw new Error("Community activity could not be loaded.");
    // The development file store has no PostgREST relationship expansion.
    if (communityMode() === "local-server") await Promise.all(issues.map(async (issue) => {
      const replies = await rowsFor(`issue_comments?select=id,created_at,user_username,user_id&issue_id=eq.${issue.id}&order=created_at.desc`);
      issue.latest_reply = replies.filter((reply) => String(reply.user_id) !== identity.id).slice(0, 1);
    }));
    return issues as Row[];
  }));
  return pages.flat().map((row) => {
    const own = participation.get(String(row.id))!;
    const latest = Array.isArray(row.latest_reply) ? row.latest_reply[0] as Row | undefined : undefined;
    const reply = latest && String(latest.created_at) > own.since ? { id: String(latest.id), createdAt: String(latest.created_at), username: String(latest.user_username || "Learner") } : null;
    return { issue: publicCommunityIssue(row), posted: own.posted, comments: own.comments.map((comment) => ({ id: String(comment.id), content: String(comment.content), createdAt: String(comment.created_at) })), participatedAt: own.since, latestReply: reply };
  }).sort((a, b) => String(b.latestReply?.createdAt || b.comments[0]?.createdAt || b.issue?.created_at).localeCompare(String(a.latestReply?.createdAt || a.comments[0]?.createdAt || a.issue?.created_at)));
}
