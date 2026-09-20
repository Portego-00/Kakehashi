import { NextRequest, NextResponse } from 'next/server';
import { unsealToken } from '@/lib/server/session-crypto';
import { getWaniKaniSessionUser, SessionUpstreamError, WANIKANI_SESSION_COOKIE } from '@/lib/server/wanikani-session';
import { opaqueRateLimitKey, takeRateLimit } from '@/lib/server/rate-limit';
import { clientAddress } from '@/lib/server/request-security';
import type { HistoryPage } from '../../../../../../shared/subject-history/model';

export const runtime = 'nodejs';
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } }); }
export async function GET(request: NextRequest) {
  const subjectId = Number(request.nextUrl.searchParams.get('subjectId'));
  const cursor = request.nextUrl.searchParams.get('cursor');
  if (!Number.isSafeInteger(subjectId) || subjectId < 1 || (cursor?.length ?? 0) > 4096) return reply({ error: 'Invalid subject.' }, 400);
  const limit = takeRateLimit(opaqueRateLimitKey('subject-history', clientAddress(request)), 120, 60_000);
  if (!limit.allowed) return reply({ error: 'Please try again shortly.' }, 429);
  let token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) {
    try { const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value; if (sealed) token = unsealToken(sealed); } catch { return reply({ error: 'Please sign in again.' }, 401); }
  }
  if (!token || token.length > 512) return reply({ error: 'Please sign in to view history.' }, 401);
  try {
    const user = await getWaniKaniSessionUser(token) as { data: { subscription: { max_level_granted: number } } };
    const origin = process.env.SUBJECT_HISTORY_URL;
    const secret = process.env.HISTORY_SERVICE_SECRET;
    if (!origin || !secret) return reply({ error: 'Change history is not available yet.' }, 503);
    const url = new URL('/history', origin);
    url.searchParams.set('subjectId', String(subjectId));
    url.searchParams.set('archiveVersion', '1');
    if (cursor) url.searchParams.set('cursor', cursor);
    // Shared content cache; authentication and subscription checks stay outside it.
    const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return reply({ error: 'History could not be loaded. Please try again.' }, 503);
    const page = await response.json() as HistoryPage;
    if (page.level !== null && page.level > user.data.subscription.max_level_granted) return reply({ error: 'This subject is outside your WaniKani subscription.' }, 403);
    return reply(page);
  } catch (error) {
    if (error instanceof SessionUpstreamError) return reply({ error: error.message }, error.status);
    return reply({ error: 'History could not be loaded. Please try again.' }, 503);
  }
}
