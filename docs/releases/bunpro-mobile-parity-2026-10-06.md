# Bunpro mobile parity — 6 October 2026

Published to the production Expo update channel for both iOS and Android, runtime `1.4.8`.

- Update group: `71b63182-b944-4f14-aa0c-2fe13325d55f`
- Android update: `01a110cf-d414-7de1-bcf3-098f9b28e63f`
- iOS update: `01a110cf-d414-7fe9-bea2-222d6f5f8ea1`
- Previous group: `cb5dff11-e080-4eba-9f0d-7168779e621f`
- Base commit: `2f06dd5c308e458bac22429b55adc31c1d0c175d`, matching the existing production mobile update.

Mobile Home and the Bunpro tab now continue offering lesson batches after the daily goal is reached. Counts use actual lessons learned, so completing two extras against a goal of four displays 6/6. Extra progress segments use yellow-orange `#ff9e00`. Default queue selection prioritizes unmet goals before offering extra study; explicit deck choices remain selected while lessons remain. Batches respect the configured size and remaining content. A completed daily pool no longer marks the deck finished. Decks confirmed empty are skipped.

Reviews settings and the Bunpro review screen’s new gear menu include an opt-in Hide Bunpro furigana switch. It persists across launches. Annotated words reveal readings on hover and pin them on tap; tapping again unpins. Readings remain hidden for other words, answer drafts remain intact, and pins reset on the next question. Opening the settings dialog pauses automatic progression. Settings schema 23 preserves existing preferences and defaults missing or invalid furigana values to off.

Validation: all 66 tests passed in the isolated release, covering Home and Bunpro-tab counters/colors, extra batches, continuation after the daily goal, deck availability and ordering, the mobile review settings UI, saved preference migration, tap/hover interactions, draft preservation, and resetting readings between questions. The normal workspace passed 67 tests, including its separate pending font-size change. Changed-file lint passed. iOS and Android release exports both succeeded; each export includes all 88 required DOM files with zero omissions from update metadata. The native project typecheck reports 35 existing errors outside the changed Bunpro files; the affected files have no diagnostics.

The release was prepared in a managed worktree from the production commit, with 17 scoped source changes. Concurrent font-size and web edits remain in the primary workspace and were excluded. Source hashes match the tested release. The production update group was unchanged immediately before publishing. Expo asset processing timed out on the first attempt; retrying the same bundles published successfully. Production manifest requests for both platforms return HTTP 200 and the exact new update IDs for runtime 1.4.8.

Restart the mobile app online to receive the update. The furigana option is available under Reviews settings and through the gear button during a Bunpro review.

Evidence, source patch, manifests, export/publish logs, regression results, and exported bundles: `output/bunpro-mobile-parity-2026-10-06/`.
