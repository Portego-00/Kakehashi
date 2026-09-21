# WaniKani subject history

Shared archive for the web and native subject-detail screens. The Convex project is `pedro-ortego-zabalza/kakehashi-subject-history`; production is `clever-oriole-572` (US East). Keep the team on Free unless the owner explicitly requests an upgrade.

## Data and schedule

The daily job runs at 03:15 UTC. The production baseline was captured on September 19, 2026: 9,449 subjects, approximately 24.6 MB of raw subject JSON (excluding database overhead). The first import establishes a baseline; it never invents historical changes. Later runs use WaniKani's `updated_after` filter with a one-minute overlap. A completed run advances the checkpoint only after every page is saved. Replaying a page produces no duplicate changes. All subject data fields and subject type are compared; timestamp-only updates do not create history. Each change preserves before/after values, WaniKani's last-update timestamp, observation time, and available names for related subjects.

`subjects` holds the latest snapshot and baseline date. `changes` holds changed fields only, shared by all users. No assignments, user notes, or review data are archived. Community announcements are not imported by this collector. The separate `archives` table preserves the official Tofugu pre-2019 archive, with provenance and an explicit comparison date.

## Deployment

From this directory, run `npm ci`, `npx convex dev --once` for development, or `npx convex deploy` for production. The CLI generates its deployment selection in ignored `.env.local`. Never commit credentials.

Production Convex environment:

- `WANIKANI_ARCHIVE_TOKEN`: server-only WaniKani token for the daily collector.
- `HISTORY_SERVICE_SECRET`: shared secret used only by the Kakehashi web server.

Web server environment:

- `SUBJECT_HISTORY_URL`: `https://clever-oriole-572.convex.site`
- `HISTORY_SERVICE_SECRET`: same secret as above.

To seed or retry: `npx convex run --prod collector:collect`. To inspect the checkpoint: `npx convex run --prod history:checkpoint`.

The HTTP archive endpoint is protected by the service secret; all database functions are internal. The web gateway accepts the existing encrypted browser session or a native WaniKani bearer token, validates subscription access, and caches shared archive responses for one hour. User tokens are not forwarded to Convex. Browser responses are private/no-store; the UI caches successful history pages for 24 hours. Both apps request history only after the user opens it, with ten changes per page. Native uses `https://kakehashiapp.com/api/subjects/history`; `EXPO_PUBLIC_SUBJECT_HISTORY_URL` overrides it for local testing.

From the repository root, deploy the web app with `npx vercel deploy --prod --yes --local-config web/vercel.json`; the root `vercel.json` belongs to the separate marketing site.

The web deployment must include `shared/subject-history/model.ts` (allowed by the root `.vercelignore`). Publishing the native UI requires the normal mobile release/update workflow.

## Historical backfill

`npx convex run --prod backfill:run '{"dryRun":true}'` validates the pinned official [Tofugu archive](https://github.com/tofugu/wanikani-deprecated-content/tree/6f30f1cce96be848f70d8631fdff57a5111c989b). Set `dryRun` to `false` to import. Repeated runs skip existing subject archives without rewriting the original comparison. No current subject snapshot or collector checkpoint is changed.

The archive covers 941 subjects (862 kanji, 79 radicals), recovering 3,615 fields in the September 2026 comparison. It supplies meanings, meaning/reading mnemonics, and legacy hints. Empty CSV cells are unknown and skipped. Legacy hints without an API equivalent are displayed as archived text only, never as confirmed deletions. Historical meanings are compared without inventing priority or accepted-answer flags. Bracket mnemonic markup is converted to equivalent display tags; the pinned source remains available from each entry. Imported content is attributed to Tofugu under [CC BY-SA 4.0](https://github.com/tofugu/wanikani-deprecated-content/blob/6f30f1cce96be848f70d8631fdff57a5111c989b/LICENSE).

These records are historical snapshot comparisons, not dated change events. The UI labels them “Pre-2019 archive,” discloses the comparison date and missing intermediate versions, and appends them after the observed change timeline. They do not reconstruct compositions, readings, or vocabulary absent from the source. Existing client caches may take up to 24 hours to refresh.
