# Custom vocabulary web release — 2026-09-10

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_4hQF9zAtHt5W7EBSpmPN9Umnth53`
- Immutable URL: https://kakehashi-nb36xspf5-portego-00s-projects.vercel.app
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)
- Previous production: `dpl_G8mM1y8TTio6PrzeFvfTNLSqjLfT`
- Isolated release source: `/tmp/kakehashi-custom-srs-release.P7D7Fn/source`
- Evidence: `output/custom-vocabulary-web/2026-09-10/`

## Scope

Published the Shizuka audio-origin fallback, subject Info after correct/incorrect custom lesson and review answers, and durable optimistic custom-SRS saving with background retries, account isolation, and stale-review guards.

Production was reconstructed from its exact 809-file source manifest rather than from the dirty main checkout. Only eight runtime files and nine related test/helper files were overlaid. All 813 uploaded source files were verified against their hashes through Vercel before promotion. Existing mobile-web keyboard behavior and notebook/handwriting functionality were retained unchanged.

No database migration, environment change, audio upload, native app release, Git commit, or Git push was performed.

## Verification

- Release-copy TypeScript check passed.
- Release-copy custom-SRS/audio/API tests: 18 suites, 154 tests passed. Local-only dependency and research-fixture links were excluded from the upload.
- Vercel production compilation, TypeScript validation, static generation, and deployment completed successfully.
- Before promotion: login returned 200; unauthenticated custom-SRS requests returned 401.
- After promotion: the canonical domain resolved to the exact new deployment in `READY` state; login returned 200; custom-SRS and native-notebook APIs returned their expected unauthenticated 401 responses.
- No real user lesson/review progress was submitted during deployment checks. Authenticated learning-flow browser checks were performed with isolated session/API fixtures during implementation, not against personal production progress.

The unchanged dependency lockfile generated npm audit warnings during the build: two moderate, two high, and one critical. Dependency remediation was not included in this scoped deployment.
