import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CUSTOM_VOCABULARY_PACKS, customVocabularyPack } from "@/features/custom-srs/catalog";
import { completeCustomLesson, enrollCustomVocabularyPack, recordCustomReview } from "@/features/custom-srs/model";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { customSrsBackendConfigured, mutateRemoteCustomSrsState, readRemoteCustomSrsState } from "@/lib/server/custom-srs-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

const eventId = z.string().uuid();
const CUSTOM_SRS_MUTATION_RETRY_MARGIN = 64;
const CUSTOM_SRS_MUTATION_LIMIT_PER_TEN_MINUTES = Math.max(
  120,
  CUSTOM_VOCABULARY_PACKS.reduce((total, pack) => total + pack.words.length, 0) + CUSTOM_SRS_MUTATION_RETRY_MARGIN,
);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll_pack"), packId: z.string().trim().min(1).max(120), eventId }).strict(),
  z.object({ action: z.literal("complete_lesson"), wordId: z.string().trim().min(1).max(180), eventId }).strict(),
  z.object({ action: z.literal("submit_review"), wordId: z.string().trim().min(1).max(180), incorrectAnswers: z.number().int().min(0).max(100), eventId }).strict(),
]);

export const runtime = "nodejs";

function privateResponse(body: unknown, status = 200, additionalHeaders?: HeadersInit) {
  const headers = new Headers(additionalHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Cookie");
  return NextResponse.json(body, { status, headers });
}

export async function GET(request: NextRequest) {
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return privateResponse({ error: "No active session." }, 401);
  const limit = takeRateLimit(opaqueRateLimitKey("custom-srs-read", sealed), 120, 60 * 60_000);
  if (!limit.allowed) return privateResponse({ error: "Too many custom study requests." }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  if (!customSrsBackendConfigured()) return privateResponse({ available: false, state: null, revision: -1 });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const result = await readRemoteCustomSrsState(identity.id, CUSTOM_VOCABULARY_PACKS);
    return privateResponse({ available: true, ...result });
  } catch {
    return privateResponse({ error: "Custom vocabulary progress could not be loaded." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return privateResponse({ error: "This custom study request did not originate from Kakehashi." }, 403);
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return privateResponse({ error: "No active session." }, 401);
  const limit = takeRateLimit(opaqueRateLimitKey("custom-srs-mutate", sealed), CUSTOM_SRS_MUTATION_LIMIT_PER_TEN_MINUTES, 10 * 60_000);
  if (!limit.allowed) return privateResponse({ error: "Too many custom study updates." }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  const parsed = mutationSchema.safeParse(await readBoundedRequestJson(request, 16_000).catch(() => null));
  if (!parsed.success) return privateResponse({ error: "The custom study update is invalid." }, 400);
  if (!customSrsBackendConfigured()) return privateResponse({ available: false, state: null, revision: -1 });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const result = await mutateRemoteCustomSrsState(identity.id, CUSTOM_VOCABULARY_PACKS, (state, now) => {
      const mutation = parsed.data;
      if (mutation.action === "enroll_pack") {
        const pack = customVocabularyPack(mutation.packId);
        if (!pack) throw new Error("Custom vocabulary pack not found.");
        return enrollCustomVocabularyPack(state, pack, now);
      }
      if (mutation.action === "complete_lesson") return completeCustomLesson(state, mutation.wordId, now);
      return recordCustomReview(state, mutation.wordId, mutation.incorrectAnswers, now, mutation.eventId);
    });
    return privateResponse({ available: true, ...result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    const clientError = /not found|not active|not due yet/i.test(message);
    return privateResponse({ error: clientError ? message : "Custom vocabulary progress could not be saved." }, clientError ? 409 : 503);
  }
}
