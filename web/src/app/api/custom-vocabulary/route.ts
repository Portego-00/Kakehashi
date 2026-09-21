import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessCustomSrs } from "@/features/custom-srs/access";
import { createCustomSrsState } from "@/features/custom-srs/model";
import { personalMutationSchema, preparePersonalOperations } from "@/features/custom-srs/personal-vocabulary";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { personalVocabularyRpc } from "@/lib/server/custom-srs-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const runtime = "nodejs";
const querySchema = z.object({ accountId: z.string().min(1).max(128), after: z.coerce.number().int().min(0).default(0), afterId: z.string().max(64).default(""), until: z.coerce.number().int().min(0).optional() }).strict();
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
async function authorize(request: NextRequest, accountId: string) {
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return { error: reply({ error: "No active session." }, 401) };
  const identity = await analyticsIdentityFromSealedSession(sealed);
  if (identity.id !== accountId) return { error: reply({ error: "Your account changed. Open your vocabulary library again." }, 403) };
  if (!canAccessCustomSrs(identity.username)) return { error: reply({ error: "Custom vocabulary is not available for this account." }, 403) };
  const limit = takeRateLimit(opaqueRateLimitKey(`personal-vocabulary-${request.method}`, identity.id), request.method === "GET" ? 300 : 60, 10 * 60_000);
  if (!limit.allowed) return { error: reply({ error: "Too many library requests. Wait a few minutes and retry." }, 429) };
  return { identity };
}
function failure(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const expected = /library changed|not found|already exist|limit is|Invalid library cursor|cache is ahead|request ID was already/i.test(message);
  return reply({ error: expected ? message.replace(/^Custom SRS store rejected the request: /, "") : "Your vocabulary library could not be reached. Please retry." }, expected ? 409 : 503);
}
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return reply({ error: "Invalid library request." }, 400);
  try {
    const auth = await authorize(request, parsed.data.accountId);
    if (auth.error) return auth.error;
    return reply(await personalVocabularyRpc("read_custom_vocabulary", {
      p_user_id: auth.identity.id, p_after_revision: parsed.data.after, p_after_id: parsed.data.afterId, p_until_revision: parsed.data.until ?? null,
    }));
  } catch (cause) { return failure(cause); }
}
export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return reply({ error: "This request did not originate from Kakehashi." }, 403);
  const parsed = personalMutationSchema.safeParse(await readBoundedRequestJson(request, 2_500_000).catch(() => null));
  if (!parsed.success) return reply({ error: "Check the word fields and import limits before saving." }, 400);
  try {
    const auth = await authorize(request, parsed.data.accountId);
    if (auth.error) return auth.error;
    const initial = createCustomSrsState();
    return reply(await personalVocabularyRpc("mutate_custom_vocabulary", {
      p_user_id: auth.identity.id, p_expected_revision: parsed.data.expectedRevision, p_event_id: parsed.data.eventId,
      p_operations: preparePersonalOperations(parsed.data.operations),
      p_initial_metadata: { version: initial.version, policy: initial.policy, enrolledPackIds: [], updatedAt: initial.updatedAt },
    }));
  } catch (cause) { return failure(cause); }
}
