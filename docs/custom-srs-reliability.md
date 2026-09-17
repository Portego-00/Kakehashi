# Custom vocabulary durability and incremental sync

A missing web backend now returns an error instead of silently switching a real account to browser-only progress.

The web and native app share strict state validation, the scheduler, and the delta protocol. Unrecognized scheduler policies and damaged learned cards raise errors; they never become empty progress. Unknown catalog words and pack IDs survive older-client reads and subsequent writes.

## Durability

Native mutations are written to an account-scoped AsyncStorage command queue before their first network attempt. Refresh, foregrounding, and the existing active-screen timer replay saved commands with their original event IDs. Reviews also retain the assignment timestamp they were answered against. A crash after the server commits but before the local queue is cleared is safe to retry. Storage failures prevent sending a new answer. Corrupt queues remain untouched and surface an error. Authentication tokens are not stored in the queue.

Native still waits for server confirmation before marking a word complete. This avoids presenting a locally queued word as already synced. Browser answers keep their existing durable outbox and cross-tab locks. Deleting browser/app data or uninstalling before pending answers sync can still lose those local answers.

## Database and traffic

Migration `20260917000000_custom_srs_durable_storage.sql` moves account metadata, assignments, and review events into separate tables. Writes lock the account revision and update only changed card rows. Review history is append-only through the application APIs and deduplicated by account/event ID. The 2,000-entry client history window remains for bounded memory and payloads; the server archive is no longer pruned. Events already removed before this migration cannot be recovered by it.

Mutation reads select the affected word(s) and the retry's event ID, including events outside the recent-history window. Current clients receive only changed cards and new events. A stale client or older app receives a full snapshot. Unchanged refreshes return a small revision confirmation. Ordinary review work therefore does not grow with the number of enrolled cards or historical reviews. Initial loads and cross-device catch-up still load full assignments and the recent 2,000 events; browser local snapshots are also still stored as one envelope.

The old 2 MB lifetime account limit is removed. Individual patch payloads remain bounded, and full snapshot responses have a 16 MB defensive read limit. Extremely large future catalogs will need paginated initial loading.

In a synthetic payload check with all 565 catalog words learned and 2,000 recent events, a review response decreased from 720,729 to 2,509 bytes (99.65% smaller). An unchanged refresh was 48 bytes. These are uncompressed JSON sizes, not a production latency benchmark.

## Rollout

1. Apply the database migration transactionally using the normal Supabase migration process. Its lock protects the backfill from concurrent writes. Test it first with `npm --prefix web run test:custom-srs-db`.
2. Deploy the web server and the `custom-srs` Edge Function. The migration keeps the previous `custom_srs_states` read shape and `compare_and_set_custom_srs_state` RPC for older server versions; new servers require the new RPCs.
3. Ship the native app update. Old native builds can continue to receive full responses, but durable on-device retries require the new build.
4. Confirm enrollment, a lesson, a review, a retry after a lost response, and cross-device refresh with the deployed versions.

The migration retains the original snapshot table as `custom_srs_states_legacy_backup`, with application-role access revoked. This is a migration-time recovery copy, not an ongoing backup. Do not restore that snapshot over newer progress after users resume studying. Server rollback can keep the normalized schema and compatibility API; disaster recovery should use a current database backup or a deliberate forward repair. Verify production backup/PITR settings separately before rollout; this change does not configure or claim those services.

The complete retained history can be exported by an administrator from `custom_srs_review_history` (filter by `user_id`, order by `sequence`). Browser roles have no access. The application views return only the recent history window.

## Verification

- Web state, API, outbox, malformed-response and incremental transport regression tests.
- Native client/session tests, including process restart, storage failure, account switching, and preserved review occurrences.
- Edge Function tests for old/new clients, delta responses, deduplication, conflicts and strict validation.
- PGlite executes the actual PostgreSQL migrations and RPCs in isolation: backfill, row permissions, stale writes, history retention/deduplication and accounts above 2 MB.

No production database is modified by these tests.

The web project typecheck and the Edge Function’s Deno checks are separate gates. The root-wide TypeScript command also includes web and Deno files under the native configuration and currently reports unrelated/configuration diagnostics; it is not a clean repository-wide gate. No diagnostics were reported for the native custom-SRS files in that run.

## Production migration record

Applied to the linked production project on 2026-09-17 13:53 UTC. Supabase migration history confirms `20260917000000`.

The CLI initially rejected the table lock before executing any data changes. The migration now contains explicit `BEGIN`/`COMMIT`; the integration test executes that exact file, and the retry succeeded.

Post-migration verification found 1 account, 32 assignment records, and 11 review events. Account state and revision matched the protected pre-migration snapshot exactly; the archive retained all 11 events. Both new read RPCs passed live checks, and anonymous access to progress and history was denied. A protected local snapshot and the database legacy snapshot were retained.

This operation applied the database migration only. Web server, Edge Function, and native releases remain separate rollout steps. Production backup/PITR configuration was not changed.
