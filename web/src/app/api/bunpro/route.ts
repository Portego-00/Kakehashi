import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BUNPRO_COOKIE, BunproError, bunproIdentity, bunproRequest, bunproToken } from "@/lib/server/bunpro";
import { sealToken } from "@/lib/server/session-crypto";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const modeSchema = z.enum(["all", "grammar", "vocab"]);
const reviewSchema = z.object({ action: z.literal("review"), reviewId: z.string().regex(/^\d+$/), sessionId: z.number().int().positive(), correct: z.boolean(), mode: modeSchema, reviewableType: z.enum(["GrammarPoint", "Vocab", "Vocabulary"]), loadedIds: z.array(z.number().int().positive()).max(500) });
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
    if (action === "connection") return NextResponse.json({ connected: Boolean(token) }, { headers });
    if (!token) throw new BunproError("Add your Bunpro API key in Settings first.", 401);
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
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) throw new BunproError("Invalid Bunpro review.", 400);
    const review = parsed.data;
    return NextResponse.json(await bunproRequest(token, `/reviews/${review.reviewId}/update`, { review_session_id: review.sessionId, correct: review.correct, fsrs_input: null, loaded_review_ids: review.loadedIds, loaded_ghost_review_ids: [], loaded_self_study_review_ids: [], deck_id: null, only_review: review.mode === "all" ? review.reviewableType : review.mode === "grammar" ? "GrammarPoint" : "Vocab" }), { headers });
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
