# Per-account custom vocabulary schedules

Settings → Custom vocabulary schedule (also linked from the vocabulary hub) offers WaniKani-style fixed intervals and adaptive FSRS. Settings are stored in the authenticated account's cloud policy, shared by all packs, web, and the native Edge Function. Existing feature access rules are unchanged.

New accounts use the standard WaniKani ladder: 4h, 8h, 23h, 47h, 167h, 335h, 719h, 2879h, rounded down to the hour. These are the standard intervals, not the accelerated level 1–2 system. The interval belongs to the destination stage after grading. The existing mistake penalty and burn-at-stage-9 behavior are retained. Reference: https://knowledge.wanikani.com/wanikani/srs-stages/ and the existing standard SRS dataset in `web/src/features/demo/wanikani.ts`.

Existing version-1 policies retain their original FSRS configuration until the user explicitly saves a change. Settings changes preserve assignment timestamps, cards, due dates, and review history. They affect scheduling on the next lesson/review. Fixed mode continues updating the FSRS memory state so switching modes does not erase it.

FSRS settings expose learning/relearning steps, target retention (70–99%), a maximum long-term interval (1–36,500 days), and hourly grouping. Short steps that would round into the past retain their exact due time. The maximum is enforced on the actual Review card because the engine can otherwise exceed a very low cap when separating grades. Step indices are bounded when a shorter learning list is selected.

## Saving and compatibility

Settings use a version-2 policy, a settings revision, and a last-event ID. The authenticated web API validates the complete settings object. Saves wait for cloud confirmation; failed requests retain the form draft and retry ID. The server rejects stale settings revisions, even when an unrelated card revision can be retried. A saved settings delta refreshes the account cache and broadcasts its revision to other browser tabs. Existing durable review queues are left intact; the settings form waits for local queued reviews to sync before saving.

The new `patch_custom_srs_state_v2` database RPC allows a policy revision to advance while retaining the account row lock, assignment/history protections, and service-role-only access. The old writer continues refusing policy changes and downgrades. Old clients reject version-2 policies instead of scheduling cards with the wrong configuration.

## Release order

1. Apply `supabase/migrations/20260919000000_custom_srs_settings.sql`.
2. Deploy the web server and `custom-srs` Edge Function, both of which use the new RPC.
3. Release the native client update to read version-2 policies. Older native builds require an update once an account uses the new policy, including new accounts. Existing version-1 accounts remain readable by older builds.

No production migration or deployment is performed merely by adding these files. Do not roll back a configured account to an old policy or reset its progress. The migration is additive and leaves the old storage API available for version-1 clients.

## Verification

- Web scheduler, storage, delta, settings form, hook, API, and existing custom-SRS regression tests.
- Actual SQL migrations under PGlite: per-account settings, revision conflicts, legacy writer rejection, preserved due dates, role isolation.
- Edge Function tests: native lessons/reviews use the policy saved by web.
- Native client tests: configurable policies load through the shared strict validator.
- Playwright desktop/mobile settings flow: save, reload, failed save and retry, restore defaults, settings search, responsive width.
