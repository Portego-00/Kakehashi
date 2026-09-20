import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/server/wanikani-session', () => ({ WANIKANI_SESSION_COOKIE: 'session', getWaniKaniSessionUser: mocks.user, SessionUpstreamError: class extends Error {} }));
vi.mock('@/lib/server/session-crypto', () => ({ unsealToken: () => 'token' }));
vi.mock('@/lib/server/rate-limit', () => ({ opaqueRateLimitKey: () => 'key', takeRateLimit: () => ({ allowed: true }) }));
vi.mock('@/lib/server/request-security', () => ({ clientAddress: () => 'ip' }));
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('SUBJECT_HISTORY_URL', 'https://archive.convex.site');
  vi.stubEnv('HISTORY_SERVICE_SECRET', 'service-secret');
  mocks.user.mockResolvedValue({ data: { subscription: { max_level_granted: 3 } } });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ level: 10, entries: [], cursor: null, baselineAt: null }) });
});
it('requires authentication before accessing the archive', async () => {
  const response = await GET(new NextRequest('https://app.test/api/subjects/history?subjectId=1'));
  expect(response.status).toBe(401); expect(mocks.fetch).not.toHaveBeenCalled();
});
it('enforces subscription access even when history is cached', async () => {
  const response = await GET(new NextRequest('https://app.test/api/subjects/history?subjectId=1', { headers: { Authorization: 'Bearer user-token' } }));
  expect(response.status).toBe(403);
  expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer service-secret');
});
it('serves authenticated web and mobile users without exposing their token to Convex', async () => {
  mocks.user.mockResolvedValue({ data: { subscription: { max_level_granted: 60 } } });
  const response = await GET(new NextRequest('https://app.test/api/subjects/history?subjectId=1', { headers: { Cookie: 'session=sealed' } }));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
