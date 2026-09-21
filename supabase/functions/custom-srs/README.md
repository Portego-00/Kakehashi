# Native custom vocabulary sync

This endpoint serves the private, Portego-only mobile custom vocabulary feature. It shares the web account’s normalized custom-SRS storage through the `custom_srs_states` view and `patch_custom_srs_state_v2` RPC. Apply the durability and scheduling-settings migrations before deploying this version; no separate mobile progress store is needed. See [scheduling settings and release order](../../../docs/custom-srs-settings.md).

## Security and synchronization

- The mobile client supplies its WaniKani token in `x-wanikani-token`. The endpoint verifies the token through WaniKani's read-only user endpoint, derives the account ID, and checks the verified username is `Portego` (case-insensitive). Client-supplied account IDs, state snapshots, and FSRS cards are rejected.
- `SUPABASE_SERVICE_ROLE_KEY` stays in the Edge Function environment. Native builds only require the existing public Supabase URL and anon key.
- The endpoint imports the canonical web catalog, model, scheduler, and state validator directly. Its import map pins the same `ts-fsrs` version. Redeploy this function when the canonical catalog or scheduler changes.
- Keep the mapped `model`, `scheduler`, `types`, `srs-settings`, and `state-patch` imports extensionless, including the direct imports in `index.ts`. The Supabase CLI dependency collector otherwise applies the mapping twice and looks for `.ts.ts` files; Deno's local checker alone does not catch that deployment issue.
- Writes use the existing revision-checked RPC. Conflicts re-read the latest cloud state, so mobile and web do not overwrite one another. Review retries must retain their original `eventId`; lessons and enrollment are intrinsically idempotent.
- Unsupported policies or damaged learned cards fail closed. They are never replaced by an empty state.
- The mobile cache is account-scoped and contains only confirmed server snapshots. Offline reading is available, but enrollment, lesson completion, and reviews require a confirmed cloud save.
- This function never submits custom subjects or progress to WaniKani. The browser's existing cookie-authenticated API is unchanged.

## Verification and deployment

```sh
npx --yes deno@2.5.6 test --config supabase/functions/custom-srs/deno.json supabase/functions/custom-srs/index_test.ts
npx jest src/features/custom-srs/__tests__/client.test.ts --runInBand
supabase functions deploy custom-srs --project-ref zcvoxqcvobgvcwcrqytz
```

Deploy only this function. `supabase/config.toml` disables Supabase JWT verification for this function because authentication is performed with the WaniKani token inside the handler, not a Supabase user JWT. Supabase supplies the server-side service-role environment variable to deployed Edge Functions.

Successful responses include `available: true` and `revision`, with a full state, a delta for a current client, or an unchanged revision confirmation. Failure responses are non-2xx and must never be interpreted as permission to save locally without syncing.
