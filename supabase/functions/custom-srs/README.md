# Native custom vocabulary sync

This endpoint serves the private, Portego-only mobile custom vocabulary feature. It shares the web account’s normalized custom-SRS storage through the `custom_srs_states` view and `patch_custom_srs_state_v2` RPC. Apply the durability and scheduling-settings migrations before deploying this version; no separate mobile progress store is needed. See [scheduling settings and release order](../../../docs/custom-srs-settings.md).

## Security and synchronization

- The mobile client supplies its WaniKani token in `x-wanikani-token`. The endpoint verifies the token through WaniKani's read-only user endpoint, derives the account ID, and checks the verified username is `Portego` (case-insensitive). Client-supplied account IDs, state snapshots, and FSRS cards are rejected.
- `SUPABASE_SERVICE_ROLE_KEY` stays in the Edge Function environment. Native builds only require the existing public Supabase URL and anon key.
- The endpoint imports the canonical web catalog, model, scheduler, and state validator directly. Its import map pins the same `ts-fsrs` version. Redeploy this function when the canonical catalog or scheduler changes.
- Keep the mapped `model`, `scheduler`, `types`, `srs-settings`, and `state-patch` imports extensionless, including the direct imports in `index.ts`. The Supabase CLI dependency collector otherwise applies the mapping twice and looks for `.ts.ts` files; Deno's local checker alone does not catch that deployment issue.
- Writes use the existing revision-checked RPC. Conflicts re-read the latest cloud state, so mobile and web do not overwrite one another. Review retries must retain their original `eventId`; lessons and enrollment are intrinsically idempotent.
- Unsupported policies or damaged learned cards fail closed. They are never replaced by an empty state.
- The mobile cache is account-scoped and contains confirmed progress and personal-library definitions. Study answers are saved to the durable device outbox before background delivery. Starting a session, changing scheduling settings, and editing/importing library content require cloud confirmation.
- This function never submits custom subjects or progress to WaniKani. The browser's existing cookie-authenticated API is unchanged.

## Verification and deployment

```sh
npx --yes deno@2.5.6 test --config supabase/functions/custom-srs/deno.json supabase/functions/custom-srs/index_test.ts
npx jest src/features/custom-srs/__tests__/client.test.ts --runInBand
supabase functions deploy custom-srs --project-ref zcvoxqcvobgvcwcrqytz
```

Deploy only this function. `supabase/config.toml` disables Supabase JWT verification for this function because authentication is performed with the WaniKani token inside the handler, not a Supabase user JWT. Supabase supplies the server-side service-role environment variable to deployed Edge Functions.

Successful responses include `available: true` and `revision`, with a full state, a delta for a current client, or an unchanged revision confirmation. Failure responses are non-2xx and must never be interpreted as permission to save locally without syncing.

## Mobile personal decks and scheduling

The native vocabulary hub includes **Manage personal decks** and **Scheduling settings**, under the same Portego-only route guard. Personal decks and words imported on web are available in native lessons, reviews, and subject details. Native library management supports deck creation/rename, word editing, archive/restore, and UTF-8 CSV/TSV file or pasted-text import with the shared preview, column mapping, and duplicate rules.

`read_library` serves the existing revision-paginated `read_custom_vocabulary` RPC. `mutate_library` validates the same word schema as web and calls `mutate_custom_vocabulary` with the verified WaniKani account, never a client-supplied identity. Library and SRS revisions remain separate. Complete library pages are cached per account before sessions use their definitions; archived words retain progress and stay out of study queues.

`update_settings` uses the existing version-2 settings policy and revision-locked storage RPC. Fixed intervals and FSRS controls match web. Saves retain retry event IDs, reject stale settings revisions, and wait for pending study answers. No new database migration is required: deploy the updated Edge Function before releasing the mobile JavaScript update. Existing web and native study actions remain compatible.
