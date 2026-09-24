# Lesson flow — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_J1HsyDdQb53miMXTqXRyUcd3h19S`
- Immutable URL: https://kakehashi-eumbq6yr3-portego-00s-projects.vercel.app
- Previous production: `dpl_DbuuhaeNNV2ySqA4pADNNEEb25eH`

Subject changes now scroll instantly to the lesson header. Tab changes retain their scroll position. Previous/next controls, keyboard navigation, and batch selection share the behavior.

Lesson quizzes advance immediately after grading. Completed subjects are durably queued on this device before advancing, then started in WaniKani in the background. Lesson starts have a separate storage namespace from review submissions, use the existing retry worker, and reconcile already-applied starts before retrying. Daily counts and picked lesson selections update with local completion. Pending progress and permission failures remain visible on the completion screen.

The batch-completion screen uses compact cards styled like the review results, a single next-batch preview, and visible Finish/Next batch actions. Large batches scroll within the learned-items region instead of expanding every upcoming batch.

Validation: 121 targeted tests passed against the production-based source, followed by eight outbox tests including a new lesson/review isolation regression. TypeScript and scoped lint passed. Six browser checks passed, covering completion at 320, 375, 414, 768, and 1440 pixels, advancing while API writes are delayed, starting the next batch, and subject-only scrolling. Browser requests used synthetic fixtures; no real study submissions were made.

The release preserves the newer production changes to daily limits, assignment updates, rate limiting, and periodic submission retry. Nine existing files changed and two browser-test files were added; no files were removed. All 1,097 uploaded hashes match the release snapshot.

During preparation, the initial scroll-only deployment briefly replaced a concurrent release. That newer release was restored before building this combined release. The final promotion checked that production still matched its expected base.

Evidence: `output/lesson-flow-2026-09-23/`. Tested source: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-lesson-final-release-k7ukdmiq`. Uploaded snapshot: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-lesson-final-deploy-owrf8llz`.
