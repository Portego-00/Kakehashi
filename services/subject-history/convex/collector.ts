import { internalActionGeneric as internalAction, anyApi } from 'convex/server';
export const collect = internalAction({ args: {}, handler: async ctx => {
  const token = process.env.WANIKANI_ARCHIVE_TOKEN;
  if (!token) throw new Error('WANIKANI_ARCHIVE_TOKEN is not configured');
  const startedAt = new Date().toISOString();
  const checkpoint: string | null = await ctx.runQuery(anyApi.history.checkpoint, {});
  let url: string | null = 'https://api.wanikani.com/v2/subjects';
  if (checkpoint) url += `?updated_after=${encodeURIComponent(new Date(Date.parse(checkpoint) - 60_000).toISOString())}`;
  while (url) {
    if (!url.startsWith('https://api.wanikani.com/v2/subjects')) throw new Error('Unexpected pagination URL');
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Wanikani-Revision': '20170710' }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Subject collection failed (${response.status}); checkpoint retained for retry`);
    const body: { data: unknown[]; pages: { next_url: string | null } } = await response.json();
    if (!Array.isArray(body.data)) throw new Error('Invalid subjects response');
    for (let offset = 0; offset < body.data.length; offset += 25) await ctx.runMutation(anyApi.history.ingest, { subjects: body.data.slice(offset, offset + 25), observedAt: startedAt });
    url = body.pages.next_url;
  }
  await ctx.runMutation(anyApi.history.complete, { time: startedAt });
}});
