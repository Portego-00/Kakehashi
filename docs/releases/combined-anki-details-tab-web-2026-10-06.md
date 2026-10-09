# Combined Anki details tab — 6 October 2026

Combined Anki cards now have a saved default details tab: Meaning (default), Reading, or Stroke. The control appears under Anki mode when Group meaning and reading is enabled, in both the main settings and the review settings modal. It applies to WaniKani cards in regular/mixed reviews and extra-study quizzes. Separate questions continue to use their current question type. If the chosen tab is unavailable for the item, details fall back to Meaning.

Deployed and promoted to https://kakehashiapp.com as `dpl_47UhwqzuUZk5b4WhxmKFi9zunJbR`. Immutable URL: https://kakehashi-5gp02gqsn-portego-00s-projects.vercel.app. Previous production: `dpl_86v9Ht1Yp5pxxDebkmNnHEKA534f`.

Reconciled 12 implementation/test files against the verified 1,129-file production source snapshot at `output/bunpro-review-furigana-2026-10-05/`, preserving production-only changes. No source files were removed. Unrelated workspace changes were excluded. Upload hashes were checked, production was unchanged immediately before promotion, and the canonical domain was verified on the intended READY deployment afterward.

Validation: type checking and lint passed (three existing warnings). All 2,982 non-skipped unit tests passed, with one skip. Eight new browser checks passed for all three combined choices and separate-question behavior on mobile and desktop; four existing automatic wrong-answer checks also passed. The production build succeeded and staging login returned HTTP 200.

Live demo verification confirmed the new selector defaults to Meaning and that choosing Reading opens the Reading panel on a combined card. Screenshots: `live-settings.png` and `live-reading-details.png`. Demo preferences were restored to Anki Off, grouping disabled, and default details tab Meaning. No answers were graded or real reviews submitted.

Source snapshots, manifests, audit, deployment records, screenshots, and logs: `output/combined-anki-details-tab-2026-10-06/`.
