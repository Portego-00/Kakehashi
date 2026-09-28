# Workspace web release — September 27, 2026

- Production: https://kakehashiapp.com
- Deployment: `dpl_GgVX1iNFVqME3ChXTkY1uCbh97s3`
- Immutable URL: https://kakehashi-6wpo2zzx2-portego-00s-projects.vercel.app
- Production observed at start: `dpl_HuB4ZHisubmVPaQWcUSyBxQkTRQm`

Deployed a snapshot of the current workspace's complete web source, including uncommitted review typography, mobile lesson parity, and video subtitle timing changes. Added upload rules for the shared lesson-ordering, workload-threshold, and subtitle-timing helpers. Native-only changes were not published as a mobile release.

Validation: release-copy TypeScript passed; full lint passed with four warnings and no errors. The full web suite initially passed 2,907 tests. All failing suites passed on focused recheck after restoring reference data to the test snapshot and repairing two test setups (React Query provider and an environment-dependent community configuration check). One existing test remains skipped. Six lesson-flow browser checks passed earlier against the same lesson implementation. Vercel's final production build reached READY and staged login returned HTTP 200.

Promotion succeeded. The immediate pre-promotion baseline check failed because npm's cache lookup failed; it did not establish whether production had changed. After promotion, the canonical domain was explicitly verified on the intended READY deployment. Live login returned HTTP 200. An isolated demo browser verified every mobile lesson-order option, batch sizes 2–10, the lesson toggles and thresholds, and persisted batch-size changes, with no page errors or real study submissions.

Evidence and source snapshot: `output/workspace-web-2026-09-27/`. The final upload contains 1,089 files and excludes environment files. No production environment changes, database migrations, Git commits, or Git pushes were performed.
