import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { readCloudSubjectLists, replaceCloudSubjectLists, subjectListsBackendConfigured } from "@/lib/server/subject-lists-server";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const runtime = "nodejs";

const listSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(60),
  subjectIds: z.array(z.number().int().positive()).max(20_000),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const payloadSchema = z.object({ lists: z.array(listSchema).max(500) });

function sealedSession(request: NextRequest) {
  return request.cookies.get(WANIKANI_SESSION_COOKIE)?.value ?? "";
}

export async function GET(request: NextRequest) {
  const sealed = sealedSession(request);
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });
  const limit = takeRateLimit(opaqueRateLimitKey("subject-lists-read", sealed), 120, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many list requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  if (!subjectListsBackendConfigured()) return NextResponse.json({ error: "Subject-list sync is not configured." }, { status: 503 });
  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    return NextResponse.json({ lists: await readCloudSubjectLists(identity.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Subject lists could not be loaded." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This list update did not originate from Kakehashi." }, { status: 403 });
  const sealed = sealedSession(request);
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });
  const limit = takeRateLimit(opaqueRateLimitKey("subject-lists-write", sealed), 180, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many list updates." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subject lists." }, { status: 400 });
  if (!subjectListsBackendConfigured()) return NextResponse.json({ error: "Subject-list sync is not configured." }, { status: 503 });
  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    await replaceCloudSubjectLists(identity.id, parsed.data.lists);
    return NextResponse.json({ synced: true });
  } catch {
    return NextResponse.json({ error: "Subject lists could not be synced." }, { status: 503 });
  }
}
