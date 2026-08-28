import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addCommunityComment,
  canManageCommunityIssue,
  communityConfigured,
  communityIdentity,
  communityIdentityOrNull,
  communityIssueCounts,
  communityWritable,
  deleteCommunityIssue,
  encodeFilter,
  supabaseRequest,
  toggleCommunityLike,
} from "@/features/community/server";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit, type RateLimitResult } from "@/lib/server/rate-limit";
import { boundedIdChunks, boundedPage } from "@/features/community/pagination";
import { webIssueOriginLabels } from "@/features/community/issue-origin";
import { COMMUNITY_ISSUE_READ_SELECT, publicCommunityIssue } from "@/features/community/public-issue";

const requestId = z.string().uuid();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createIssue"), title: z.string().trim().min(4).max(160), content: z.string().trim().min(8).max(12_000) }),
  z.object({ action: z.literal("addComment"), issueId: z.string().uuid(), content: z.string().trim().min(1).max(6_000), replyToCommentId: z.string().uuid().nullable().optional(), requestId }),
  z.object({ action: z.literal("toggleIssueLike"), issueId: z.string().uuid(), requestId }),
  z.object({ action: z.literal("toggleCommentLike"), commentId: z.string().uuid(), requestId }),
  z.object({ action: z.literal("updateStatus"), issueId: z.string().uuid(), status: z.enum(["open", "closed"]) }),
  z.object({ action: z.literal("deleteIssue"), issueId: z.string().uuid() }),
  z.object({ action: z.literal("feedback"), kind: z.enum(["Feedback", "Feature Request"]), categories: z.array(z.string().trim().min(1).max(80)).max(8), message: z.string().trim().min(1).max(8_000) }),
]);

function jsonError(message: string, status: number, headers?: HeadersInit) { return NextResponse.json({ error: message }, { status, headers }); }
function rateLimited(result: RateLimitResult) { return jsonError(`Too many requests. Try again in ${result.retryAfterSeconds} seconds.`, 429, { "Retry-After": String(result.retryAfterSeconds) }); }
async function identityOrError() { try { return { identity: await communityIdentity() }; } catch (error) { return { response: jsonError(error instanceof Error ? error.message : "Sign in to continue.", 401) }; } }

export async function GET(request: NextRequest) {
  const readLimit = takeRateLimit(opaqueRateLimitKey("community-read", clientAddress(request)), 240, 60_000);
  if (!readLimit.allowed) return rateLimited(readLimit);
  const action = request.nextUrl.searchParams.get("action") || "issues";
  if (!communityConfigured()) {
    if (action === "issues" || action === "supporters") return NextResponse.json({ configured: false, writable: false, items: [], page: 0, hasMore: false });
    return jsonError("The shared community service is not configured.", 503);
  }
  try {
    if (action === "issues") {
      const status = request.nextUrl.searchParams.get("status");
      const sort = request.nextUrl.searchParams.get("sort") === "top" ? "likes_count.desc" : "created_at.desc";
      const query = (request.nextUrl.searchParams.get("query") || "").trim();
      const page = boundedPage(request.nextUrl.searchParams.get("page"));
      const filters = [`select=${COMMUNITY_ISSUE_READ_SELECT}`, "limit=21", `offset=${page * 20}`, `order=${sort}`];
      if (status === "open" || status === "closed") filters.push(`status=eq.${status}`);
      if (query) { const value = encodeFilter(query); filters.push(`or=(title.ilike.*${value}*,content.ilike.*${value}*,user_username.ilike.*${value}*)`); }
      const [rows, counts, identity] = await Promise.all([
        supabaseRequest(`issues?${filters.join("&")}`),
        communityIssueCounts(query),
        communityIdentityOrNull(),
      ]);
      const items = Array.isArray(rows) ? rows.slice(0, 20).map(publicCommunityIssue).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
      const likedIssueIds = new Set<string>();
      if (identity && items.length > 0) {
        const likePages = await Promise.all(boundedIdChunks(items.map((item) => (item as Record<string, unknown>).id), 20, 20).map((ids) => supabaseRequest(`issue_likes?select=issue_id&issue_id=in.(${ids.join(",")})&user_id=eq.${encodeURIComponent(identity.id)}&limit=${ids.length}`)));
        likePages.forEach((likePage) => { if (Array.isArray(likePage)) likePage.forEach((like) => likedIssueIds.add(String((like as Record<string, unknown>).issue_id || ""))); });
      }
      return NextResponse.json({ configured: true, writable: communityWritable(), items: items.map((item) => ({ ...item, is_liked: likedIssueIds.has(String(item.id)) })), counts, page, hasMore: Array.isArray(rows) && rows.length > 20 });
    }
    if (action === "issue") {
      const id = request.nextUrl.searchParams.get("id") || "";
      if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid issue.", 400);
      const commentPage = boundedPage(request.nextUrl.searchParams.get("commentPage"));
      const identity = await communityIdentityOrNull();
      const [issueRows, commentRows] = await Promise.all([
        supabaseRequest(`issues?select=${COMMUNITY_ISSUE_READ_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`),
        supabaseRequest(`issue_comments?select=*&issue_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=51&offset=${commentPage * 50}`),
      ]);
      const issue = Array.isArray(issueRows) ? issueRows[0] as Record<string, unknown> : null;
      const allCommentRows = Array.isArray(commentRows) ? commentRows as Array<Record<string, unknown>> : [];
      const comments = allCommentRows.slice(0, 50);
      if (!issue) return jsonError("Issue not found.", 404);
      let issueLiked = false; const likedCommentIds = new Set<string>();
      if (identity) {
        const commentLikeChunks = boundedIdChunks(comments.map((comment) => comment.id));
        const [issueLikes, commentLikePages] = await Promise.all([
          supabaseRequest(`issue_likes?select=issue_id&issue_id=eq.${id}&user_id=eq.${encodeURIComponent(identity.id)}&limit=1`),
          Promise.all(commentLikeChunks.map((ids) => supabaseRequest(`comment_likes?select=comment_id&comment_id=in.(${ids.join(",")})&user_id=eq.${encodeURIComponent(identity.id)}&limit=${ids.length}`))),
        ]);
        issueLiked = Array.isArray(issueLikes) && issueLikes.length > 0;
        commentLikePages.forEach((page) => { if (Array.isArray(page)) page.forEach((like) => likedCommentIds.add(String((like as Record<string, unknown>).comment_id || ""))); });
      }
      return NextResponse.json({ configured: true, writable: communityWritable(), issue: { ...publicCommunityIssue(issue), is_liked: issueLiked }, comments: comments.map((comment) => ({ ...comment, is_liked: likedCommentIds.has(String(comment.id)) })), commentPage, commentsHasMore: allCommentRows.length > 50, canManage: Boolean(communityWritable() && identity && canManageCommunityIssue(issue, identity)) });
    }
    if (action === "supporters") {
      const page = boundedPage(request.nextUrl.searchParams.get("page"));
      const rows = await supabaseRequest(`patreon_supporters?select=id,wanikani_username,display_name,wanikani_level,avatar_url,profile_url,support_tier,sort_order&order=sort_order.asc.nullslast,display_name.asc&limit=61&offset=${page * 60}`);
      const items = Array.isArray(rows) ? rows.slice(0, 60).map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          id: String(row.id || row.wanikani_username || row.display_name || "supporter"),
          username: String(row.wanikani_username || ""),
          displayName: String(row.display_name || row.wanikani_username || "Supporter"),
          level: typeof row.wanikani_level === "number" ? row.wanikani_level : null,
          avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
          profileUrl: typeof row.profile_url === "string" ? row.profile_url : null,
          tier: typeof row.support_tier === "string" ? row.support_tier : null,
        };
      }) : [];
      return NextResponse.json({ configured: true, writable: communityWritable(), items, page, hasMore: Array.isArray(rows) && rows.length > 60 });
    }
    return jsonError("Unsupported community action.", 404);
  } catch (error) { return jsonError(error instanceof Error ? error.message : "The community could not be loaded.", 502); }
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return jsonError("Cross-origin community changes are blocked.", 403);
  const address = clientAddress(request);
  const broadLimit = takeRateLimit(opaqueRateLimitKey("community-mutation", address), 60, 60_000);
  if (!broadLimit.allowed) return rateLimited(broadLimit);
  let raw: unknown;
  try { raw = await readBoundedRequestJson(request, 32_000); }
  catch { return jsonError("The community request body is too large or invalid.", 413); }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return jsonError("The community request is invalid.", 422);

  try {
    if (parsed.data.action === "feedback") {
      const feedbackLimit = takeRateLimit(opaqueRateLimitKey("community-feedback", address), 5, 60 * 60_000);
      if (!feedbackLimit.allowed) return rateLimited(feedbackLimit);
      const response = await fetch("https://formspree.io/f/xblkalbk", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ type: parsed.data.kind, categories: parsed.data.categories.join(", "), message: parsed.data.message, timestamp: new Date().toISOString(), app: "Kakehashi Web" }), cache: "no-store", signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("The support channel did not accept this message.");
      return NextResponse.json({ ok: true });
    }
    if (!communityConfigured()) return jsonError("The shared community service is not configured.", 503);
    if (!communityWritable()) return jsonError("This deployment can read the community, but posting requires its server-side Supabase secret key.", 503);
    const auth = await identityOrError(); if (auth.response) return auth.response; const identity = auth.identity!;
    const userLimit = takeRateLimit(opaqueRateLimitKey("community-user-mutation", identity.id), 30, 60_000);
    if (!userLimit.allowed) return rateLimited(userLimit);

    if (parsed.data.action === "createIssue") {
      const items = await supabaseRequest(`issues?select=${COMMUNITY_ISSUE_READ_SELECT}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: identity.id, user_email: identity.email, user_username: identity.username, user_level: identity.level, title: parsed.data.title, content: parsed.data.content, labels: webIssueOriginLabels(), status: "open" }) });
      return NextResponse.json({ item: publicCommunityIssue(Array.isArray(items) ? items[0] : items) }, { status: 201 });
    }
    if (parsed.data.action === "addComment") {
      const item = await addCommunityComment(parsed.data, identity);
      return NextResponse.json({ item }, { status: 201 });
    }
    if (parsed.data.action === "updateStatus" || parsed.data.action === "deleteIssue") {
      const owned = await supabaseRequest(`issues?select=id,user_id,user_username&id=eq.${parsed.data.issueId}&limit=1`) as Array<Record<string, unknown>>;
      if (!owned[0] || !canManageCommunityIssue(owned[0], identity)) return jsonError("Only the author can change this issue.", 403);
      if (parsed.data.action === "deleteIssue") {
        await deleteCommunityIssue(parsed.data.issueId);
        return NextResponse.json({ ok: true });
      }
      const items = await supabaseRequest(`issues?id=eq.${parsed.data.issueId}&select=${COMMUNITY_ISSUE_READ_SELECT}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: parsed.data.status }) });
      return NextResponse.json({ item: publicCommunityIssue(Array.isArray(items) ? items[0] : items) });
    }
    const result = parsed.data.action === "toggleIssueLike"
      ? await toggleCommunityLike("issue", parsed.data.issueId, parsed.data.requestId, identity)
      : await toggleCommunityLike("comment", parsed.data.commentId, parsed.data.requestId, identity);
    return NextResponse.json(result);
  } catch (error) { return jsonError(error instanceof Error ? error.message : "The community change failed.", 502); }
}
