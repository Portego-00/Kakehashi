import { httpRouter, httpActionGeneric as httpAction, anyApi } from 'convex/server';
const http = httpRouter();
http.route({ path: '/history', method: 'GET', handler: httpAction(async (ctx, request) => {
  const secret = process.env.HISTORY_SERVICE_SECRET;
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const url = new URL(request.url);
  const subjectId = Number(url.searchParams.get('subjectId'));
  const cursor = url.searchParams.get('cursor');
  if (!Number.isSafeInteger(subjectId) || subjectId < 1 || (cursor?.length ?? 0) > 4096) return new Response('Invalid request', { status: 400 });
  const result = await ctx.runQuery(anyApi.history.page, { subjectId, paginationOpts: { numItems: 10, cursor } });
  return Response.json(result);
}) });
export default http;
