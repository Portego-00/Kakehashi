# Bounded review retries — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_DiuACFKgVvFbEbrrBDi6UbWaar9B`
- Immutable URL: https://kakehashi-86q6y74aj-portego-00s-projects.vercel.app
- Previous production: `dpl_5kwf9f984qMCdEj9cYLtVgFY3bCz`

Both web review queues previously appended incorrect answers to their entire remaining queue. Missed questions now receive a random retry target after 2–10 intervening questions. Retry deadlines prevent newer mistakes from repeatedly postponing older ones. Near completion, a shorter gap is allowed when no other eligible questions remain. The explicit immediate-retry preference is preserved.

Mixed sessions count WaniKani and Bunpro questions together. The coordinator can bring a buried retry to the front of its provider queue when due; ordinary source selection remains weighted by remaining reviews. Already-started subjects share a ten-subject cap, and wrap-up allocates its budget to unfinished subjects before adding new ones. Provider queues retain all pending sides of those subjects. A background Bunpro save preserves a retry promoted while the request was pending, along with its draft input.

Validation: the original component regressions failed because neither service returned a missed question within ten questions. All 173 targeted unit tests now pass, including 100 successive incorrect answers, minimum spacing, shared open-subject limits, wrap-up retention, and delayed saves. TypeScript and scoped lint passed. All 15 browser checks passed, including large mixed queues with a missed question from each provider. The three retry/save-error browser checks were repeated successfully after the final scheduling changes. Two guarded disclosure checks also passed on production; no real review submissions were made.

The release preserves verified production source and changes eight existing files plus four new scheduling/test files. No files were removed. All 1,091 uploaded hashes match the tested snapshot. The staged build reached READY and login returned HTTP 200. Production was unchanged before promotion, and the canonical domain was verified to point to the new READY deployment afterward.

Evidence: `output/bounded-review-retries-2026-09-23/`. Tested source: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-retry-release-b9fgkd75`. Uploaded snapshot: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-retry-deploy-1egxognv`.
