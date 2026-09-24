import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BUNPRO_COOKIE, BunproError, bunproIdentity, bunproRequest, bunproToken } from "@/lib/server/bunpro";
import { loadBunproAnalytics } from "@/lib/server/bunpro-analytics";
import { sealToken } from "@/lib/server/session-crypto";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const modeSchema = z.enum(["all", "grammar", "vocab"]);
const loadedIdsSchema = z.array(z.number().int().positive()).max(500);
const reviewSchema = z.object({ action: z.literal("review"), reviewType: z.enum(["review", "ghost_review", "self_study_review"]).default("review"), reviewId: z.string().regex(/^\d+$/), reviewableId: z.number().int().positive().optional(), sessionId: z.number().int().positive(), correct: z.boolean(), mode: modeSchema, reviewableType: z.enum(["GrammarPoint", "Vocab", "Vocabulary"]), requestMore: z.boolean().optional(), context: z.enum(["review", "learn"]).optional(), loadedIds: loadedIdsSchema, loadedGhostIds: loadedIdsSchema.default([]), loadedSelfStudyIds: loadedIdsSchema.default([]) });
const hydratedReviewSchema = z.object({ id: z.union([z.string(), z.number()]), type: z.literal("review"), attributes: z.record(z.string(), z.unknown()) }).passthrough();
function failure(error: unknown) { return NextResponse.json({ error: error instanceof BunproError ? error.message : "Unable to complete the Bunpro request." }, { status: error instanceof BunproError ? error.status : 502, headers }); }
async function access(request: NextRequest) {
  const identity = await bunproIdentity(request.cookies.get(WANIKANI_SESSION_COOKIE)?.value);
  const token = bunproToken(request.cookies.get(BUNPRO_COOKIE)?.value, identity.id);
  return { identity, token };
}
export async function GET(request: NextRequest) {
  try {
    const { token } = await access(request);
    const action = request.nextUrl.searchParams.get("action");
    if (action === "connection") {
      if (!token) return NextResponse.json({ connected: false }, { headers });
      try { await bunproRequest(token, "/user"); }
      catch (error) {
        if (error instanceof BunproError && [401, 403].includes(error.status)) return NextResponse.json({ connected: false }, { headers });
        throw error;
      }
      return NextResponse.json({ connected: true }, { headers });
    }
    if (!token) throw new BunproError("Add your Bunpro API key in Settings first.", 401);
    if (action === "analytics") return NextResponse.json(await loadBunproAnalytics(token), { headers });
    if (action === "lesson-queue") return NextResponse.json(await bunproRequest(token, "/user/queue"), { headers });
    if (action === "learn") {
      const deck = z.coerce.number().int().positive().safeParse(request.nextUrl.searchParams.get("deck"));
      if (!deck.success) throw new BunproError("Invalid lesson deck.", 400);
      return NextResponse.json(await bunproRequest(token, `/learn?deck_id=${deck.data}`), { headers });
    }
    if (action === "forecast") {
      const [hourly, daily, due] = await Promise.all([bunproRequest(token, "/user_stats/forecast_hourly"), bunproRequest(token, "/user_stats/forecast_daily"), bunproRequest(token, "/user/due")]);
      return NextResponse.json({ hourly, daily, due }, { headers });
    }
    if (action === "due") return NextResponse.json(await bunproRequest(token, "/user/due"), { headers });
    if (action === "queue") {
      const mode = modeSchema.safeParse(request.nextUrl.searchParams.get("mode") ?? "all");
      if (!mode.success) throw new BunproError("Invalid review selection.", 400);
      const filter = mode.data === "grammar" ? "?only_review=GrammarPoint" : mode.data === "vocab" ? "?only_review=Vocab" : "";
      return NextResponse.json(await bunproRequest(token, `/reviews/quiz_index${filter}`), { headers });
    }
    if (action === "details") {
      const kind = request.nextUrl.searchParams.get("kind");
      const slug = request.nextUrl.searchParams.get("slug")?.trim();
      if (!slug || slug.length > 500 || !["grammar", "vocab"].includes(kind ?? "")) throw new BunproError("Invalid Bunpro item.", 400);
      let details;
      try { details = await bunproRequest(token, `/reviewables/${kind === "grammar" ? "grammar_point" : "vocab"}/${encodeURIComponent(slug)}`); }
      catch (error) {
        if (kind !== "grammar" || !(error instanceof BunproError) || error.status !== 404) throw error;
        details = await bunproRequest(token, `/reviewables/grammar/${encodeURIComponent(slug)}`);
      }
      return NextResponse.json(details, { headers });
    }
    throw new BunproError("Unknown Bunpro request.", 400);
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (!isTrustedMutationOrigin(request)) throw new BunproError("Invalid request origin.", 403);
    const { identity, token } = await access(request);
    const body = await request.json().catch(() => null);
    if (body?.action === "connect") {
      const parsed = z.object({ token: z.string().trim().min(1).max(512) }).safeParse(body);
      if (!parsed.success) throw new BunproError("Enter a valid Bunpro API key.", 400);
      await bunproRequest(parsed.data.token, "/user");
      const response = NextResponse.json({ connected: true }, { headers });
      response.cookies.set(BUNPRO_COOKIE, sealToken(JSON.stringify({ owner: identity.id, token: parsed.data.token })), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return response;
    }
    if (!token) throw new BunproError("Add your Bunpro API key in Settings first.", 401);
    if (body?.action === "coverage") {
      const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }).safeParse(body);
      if (!parsed.success) throw new BunproError("Invalid vocabulary selection.", 400);
      return NextResponse.json(await bunproRequest(token, "/reviews/hydrate_reviewables", { reviewables: [...new Set(parsed.data.ids)].map(id => ["Vocab", id]) }), { headers });
    }
    if (body?.action === "coverage-save") {
      const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500), streak: z.union([z.literal(0), z.literal(4), z.literal(10), z.literal(12)]), deckId: z.number().int().positive().optional() }).safeParse(body);
      if (!parsed.success) throw new BunproError("Invalid knowledge check.", 400);
      const { ids, streak, deckId } = parsed.data;
      return NextResponse.json(await bunproRequest(token, "/reviews/update_via_action_type", { action_type: streak === 12 ? "mark_known" : "set_streak", ...(streak === 12 ? { deck_id: deckId ?? null } : { new_streak: streak }), reviewables: [...new Set(ids)].map(id => ["Vocab", id]) }, "PATCH"), { headers });
    }
    if (body?.action === "lesson-quiz") {
      const parsed = z.object({ deckId: z.number().int().positive(), reviewables: z.array(z.tuple([z.enum(["GrammarPoint", "Vocab"]), z.number().int().positive()])).min(1).max(100) }).safeParse(body);
      if (!parsed.success) throw new BunproError("Invalid lesson batch.", 400);
      // The lesson quiz uses objects with snake-case types, unlike the hydrate/action tuple APIs.
      const reviewables = parsed.data.reviewables.map(([type, id]) => ({ reviewable_id: id, reviewable_type: type === "GrammarPoint" ? "grammar_point" : "vocab" }));
      return NextResponse.json(await bunproRequest(token, "/learn/quiz", { deck_id: parsed.data.deckId, reviewables }), { headers });
    }
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) throw new BunproError("Invalid Bunpro review.", 400);
    const review = parsed.data;
    // Bunpro's client at https://bunpro.jp/reviews uses a distinct update endpoint for each review category.
    const reviewCollection = { review: "reviews", ghost_review: "ghost_reviews", self_study_review: "self_study_reviews" }[review.reviewType];
    const requestMore = review.context !== "learn" && review.requestMore !== false;
    const result = await bunproRequest<unknown>(token, `/${reviewCollection}/${review.reviewId}/update`, { review_session_id: review.sessionId, correct: review.correct, fsrs_input: null, loaded_review_ids: requestMore ? review.loadedIds : null, loaded_ghost_review_ids: requestMore ? review.loadedGhostIds : null, loaded_self_study_review_ids: requestMore ? review.loadedSelfStudyIds : null, deck_id: null, only_review: review.context === "learn" ? null : review.mode === "all" ? review.reviewableType : review.mode === "grammar" ? "GrammarPoint" : "Vocab" });
    if (review.reviewType === "review" && review.reviewableId) {
      try {
        // Quiz updates return queue data. Read the saved review instead of predicting its SRS stage.
        const hydrated = await bunproRequest<unknown>(token, "/reviews/hydrate_reviewables", { reviewables: [[review.reviewableType === "GrammarPoint" ? "GrammarPoint" : "Vocab", review.reviewableId]] }, undefined, 3_000);
        const collection = z.object({ data: z.array(z.unknown()) }).safeParse(hydrated);
        const updated = collection.success ? collection.data.data.map(value => hydratedReviewSchema.safeParse(value)).find(candidate => candidate.success && String(candidate.data.id) === review.reviewId) : undefined;
        if (updated?.success) {
          return NextResponse.json({ ...(result && typeof result === "object" && !Array.isArray(result) ? result : {}), updated_review: updated.data }, { headers });
        }
      } catch {
        // The answer is already saved; a failed stage lookup must never trigger resubmission.
      }
    }
    return NextResponse.json(result, { headers });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    if (!isTrustedMutationOrigin(request)) throw new BunproError("Invalid request origin.", 403);
    await access(request);
    const response = NextResponse.json({ connected: false }, { headers });
    response.cookies.delete(BUNPRO_COOKIE);
    return response;
  } catch (error) { return failure(error); }
}
