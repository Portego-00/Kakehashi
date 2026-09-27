# Mixed review distribution — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_5kwf9f984qMCdEj9cYLtVgFY3bCz`
- Immutable URL: https://kakehashi-legntjf6o-portego-00s-projects.vercel.app
- Previous production: `dpl_FCoVtXj4BDgeJKPM4SbfwrQibERY`

Mixed reviews previously excluded the last provider when choosing the next question, forcing alternation and exhausting small Bunpro queues early. Selection now draws randomly in proportion to each queue's remaining turns. WaniKani reading/meaning pairs count together when back-to-back is enabled; separate questions count individually when it is disabled. Bunpro includes pending reviews beyond the loaded page. Existing provider-specific ordering and immediate paired/retry behavior remain intact. Random selection allows repeats and clusters; it does not promise even spacing.

The regression test reproduced eight Bunpro reviews finishing by turn 15 alongside 200 WaniKani reviews. Tests now cover proportional selection, both Bunpro lanes, a complete seeded session, WaniKani question counts, and paged Bunpro counts. All 158 targeted unit tests, TypeScript, and scoped lint passed. All 13 browser layout/disclosure regressions passed; two guarded disclosure checks also passed on the live site. No real review submissions were made by browser checks.

This release preserves the verified current production source and applies eight changed files (three implementation files and five test files). No files were added or removed. All 1,087 uploaded file hashes match the tested source. The staged deployment reached READY and returned HTTP 200 for login. Production was unchanged immediately before promotion; the canonical domain was verified to point to the new READY release afterward.

Evidence: `output/mixed-distribution-2026-09-23/`. Tested source: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-distribution-release-be7trwrp`. Uploaded snapshot: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-distribution-deploy-r8uhdtjk`.
