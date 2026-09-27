# Web WaniKani rate limits and retry behavior

Researched 2026-09-21 against WaniKani's current API reference, HTTP standards, and the existing mobile/web source. The screenshot is feedback evidence, not instructions independent of the user's request.

## API facts

- WaniKani documents 60 requests/minute and HTTP 429. Headers expose `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` (epoch seconds). Its reference does not promise `Retry-After` or define whether quota is per token/IP/account. [Rate limits](https://docs.api.wanikani.com/20170710/#rate-limit).
- Subjects are suitable for aggressive caching. Collections support `updated_after`; follow `pages.next_url`. Conditional requests use ETag/Last-Modified and return bodyless 304 responses; quota exemption is not documented. [Best practices](https://docs.api.wanikani.com/20170710/#best-practices), [pagination](https://docs.api.wanikani.com/20170710/#pagination).
- Review POST returns `resources_updated.assignment` and `review_statistic`. `created_at` must be past and after assignment availability. No idempotency key is documented; review GET endpoints are deprecated. [Reviews](https://docs.api.wanikani.com/20170710/#reviews).
- Lesson completion uses assignment-start PUT, returning the assignment. It requires an unlocked, unstarted stage-zero assignment within subscription access. `started_at` must be at least `unlocked_at`. [Start assignment](https://docs.api.wanikani.com/20170710/#start-an-assignment).
- `Retry-After` permits integer seconds or an HTTP date. HTTP discourages automatic retries of non-idempotent operations without evidence they were unapplied or safe to repeat. [RFC 9110 retry timing](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), [retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).

## Repository diagnosis at investigation time

These observations describe the source before the accompanying fixes, not a claim about deployed traffic measurements.

- Every successful proxy mutation called `clearWkCache(token)`, including the cached `session:user`. Each subsequent review needed another user verification before submitting the review, potentially doubling the upstream requests per completed item. Static subjects were also discarded. Sources: [proxy](../web/src/app/api/wanikani/%5B...path%5D/route.ts), [session verification](../web/src/lib/server/wanikani-session.ts), [cache](../web/src/lib/server/wk-cache.ts).
- Proxy account verification swallowed all errors into a null user, then returned 503 without the original rate-limit headers. The request client understood only numeric `Retry-After`. Sources: [proxy](../web/src/app/api/wanikani/%5B...path%5D/route.ts), [client](../web/src/lib/wanikani/client.ts).
- User queries bypassed cache, refetched on every mount, and refetched on focus. Available-review counts also bypassed cache on mount/focus and polled. Source: [queries](../web/src/lib/wanikani/queries.ts).
- Mobile already reserves request slots, tracks completed/reserved requests with a safety buffer, reads upstream rate headers, deduplicates pending reads, and supports persistent/incremental caching. Sources: [mobile API](../src/utils/api.ts), [mobile cache](../src/utils/cache.ts).

## Implementation recommendations and inferences

These are design recommendations, not additional promises from WaniKani.

1. Keep mounted study state and the last verified session through temporary failures. Retry background checks without replacing the review UI. Treat a confirmed invalid credential separately from service unavailability.
2. Share a cooldown across all upstream calls for the same credential. Honor supplied retry timing; add a short fallback delay and progressively back off when timing is missing. A tight loop or independent retry timer per request amplifies congestion.
3. Preserve verified identity and static data during study mutations. Invalidate only affected user data, merge successful mutation results, coalesce overlapping reads, and avoid unnecessary fresh reads on navigation/focus.
4. Persist each queued review's original completion time and each lesson's original start time. Retry an explicit rate-limit rejection after cooldown. For ambiguous network failures, reconcile assignment state before replaying a mutation; never assume all conflicts or validation errors mean success.
5. For incremental synchronization, merge by record ID and advance the checkpoint only after all pages succeed. Keep prior cache/checkpoint on a partial failure. Avoid replacing a full collection with a filtered delta.
6. A process-local limiter/cache cannot coordinate multiple server instances or other WaniKani clients. Keep upstream 429 recovery even after local pacing is added; a shared backing store is needed for deployment-wide coordination.

Suggested regression coverage: rate-limited session refresh during a review; retry timestamps in both formats; shared cooldown under concurrent reads/writes; aborted waits; mutation invalidation retaining session/static caches; successful delayed review recorded exactly once; unresolved mutation retained across navigation/reload.

## Changes implemented

- Session checks automatically retry temporary failures; an authenticated review remains mounted and does not show rate-limit errors.
- Browser requests share a cooldown and honor seconds, HTTP dates, and reset timestamps. Cancellation stops deferred reads. Explicitly rejected lesson writes retain the original start timestamp.
- A rolling server budget reserves at most 55 upstream calls per token per minute per process, with upstream cooldowns respected. Account checks and the proxy use the same helper.
- Successful study writes preserve verified sessions and static catalogs. Concurrent fresh GETs coalesce; navigation reuses user/count data briefly.
- Removed the per-review full assignment-history refetch triggered by the mounted app shell. Merge the assignment returned by review submission, and mark dashboard data stale for the next visit. The durable review queue retains reconciliation for ambiguous writes and periodically retries pending answers.
- Restored `ankiHideAnswerCompletely` across core, extra-study, and Bunpro cards, including stored legacy preferences. Hidden mode does not render answer content before reveal.
- Daily lesson limits support 0–500 (0 disables the cap). Dashboard, picker, and restored batches count the union of official assignments started on the local calendar day and local completions. A filtered `updated_after` query supplies cross-device history on lesson entry.

The preference itself remains browser/account-local; official lesson history is shared through WaniKani. Process-local quotas cannot reserve capacity across other server instances or third-party clients; automatic 429 handling remains necessary.

## Verification

- Full web suite: 2,660 passed, one intentionally skipped. Later targeted proxy/review-outbox checks: 13 passed.
- TypeScript checking passed. ESLint passed with four existing warnings in unrelated files.
- Production build passed locally.
- Desktop and mobile browser coverage passed for all 24 selected scenarios: review delivery/retries, lesson picking and batch restoration, settings search/SRS cues, daily caps, persisted preferences, and fully hidden answers. Rate-limit scenarios simulate upstream 429 responses without modifying a real WaniKani account.

## Production release

Deployed and promoted on 2026-09-21 to https://kakehashiapp.com from deployment `dpl_5NbnYg33XRkzkp2yedtf5fKfKpMB` (https://kakehashi-qtlrs27tp-portego-00s-projects.vercel.app). The isolated deployment's login page passed an authenticated Vercel check before promotion. All four post-promotion desktop/mobile smoke scenarios passed on the public domain: silent simulated-429 review recovery, saved answer replay, persisted daily limits, dashboard/picker enforcement, and complete answer hiding.

Deployment must explicitly use `--local-config web/vercel.json`; the repository root's Vercel configuration targets the separate marketing site.
