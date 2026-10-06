# Automatic wrong-answer details — 2 October 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_D3h9eK6uYm2nCUuCZyKz8asVeM6V`
- Immutable URL: https://kakehashi-jtgcz9u2r-portego-00s-projects.vercel.app
- Previous production: `dpl_G6DiY571oPg3ZiNKmURVsEDSFSHb`

Added an opt-in **Show details on wrong answer** setting in Reviews settings and the in-session settings dialog. Wrong answers open the item details, scroll their contents into view on desktop and mobile, and wait for Next even when Pause on wrong answer is disabled. Supports typed and Anki grading across WaniKani, Bunpro, custom vocabulary, and extra-study reviews. The setting defaults to off; manual dismissal and reduced motion remain supported.

Reconstructed and verified all 1,121 current production source files, then merged only the 18 review-setting implementation and test files. No files were removed. All uploaded hashes match the tested snapshot. Unrelated workspace changes were excluded. Production was verified unchanged immediately before promotion and verified on the intended READY deployment afterward.

Validation: type checking passed; full lint passed with three existing warnings and no errors. The full unit run passed 2,942 tests with one skip and exposed only an outdated synonym-toggle assertion. That assertion now expects the inverse of the existing default; the entire 35-test settings suite passed afterward, verifying all 2,943 non-skipped tests. Both affected settings regressions also passed in the normal workspace. All ten release-copy browser checks passed, covering existing disclosure behavior, automatic opening and scrolling at desktop/mobile widths, dismissal, continuation, and reduced motion. Vercel’s production build reached READY, and staged/live login checks returned HTTP 200.

The live demo confirmed the setting defaults off and an incorrect answer automatically opens the details, scrolls to readable content, and waits for Next. The demo preference was restored afterward. No real WaniKani or Bunpro review was submitted. No database, environment, native-app release, Git commit, or Git push changes were made.

Evidence and source snapshots: `output/wrong-review-details-2026-10-02/`. Live proof: `live-review-details.jpg`.

Follow-up: removed the explanatory sentence under **Show details on wrong answer** from the review settings modal. Deployed as `dpl_DnvS9kyXw7p4qBCWPMrhk7AAd34L` at https://kakehashi-fqpystes9-portego-00s-projects.vercel.app and promoted to production. Reused the verified live source manifest with exactly one changed file and one removed line. Type checking and lint passed (three existing warnings); 2,941 tests passed initially, and the two failed checks passed in an isolated 40-test rerun. All four wrong-answer browser checks passed. The live demo modal confirmed the description is absent and the toggle remains off. Evidence: `output/review-modal-description-2026-10-02/`, including `live-modal.jpg`.
