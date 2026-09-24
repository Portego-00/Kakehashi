# Bunpro lesson quiz — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_ApUKTwBvDdv3LmDtPV6HSgRDvJgJ`
- Immutable URL: https://kakehashi-er0tmtl07-portego-00s-projects.vercel.app
- Previous production: `dpl_9fkdxBrYpJqy1jzXxizLyBLLBeZ8`

Start Quiz sent reviewable tuples to Bunpro's `/learn/quiz` endpoint, which expects objects with `reviewable_id` and a snake-case `reviewable_type`. Convert the validated selected batch at the server boundary. Hydration and bulk actions retain their tuple contracts.

Confirmed the contract against Bunpro's current lesson quiz page props and client request. Reproduced the live 500 for grammar IDs 1104 and 897. The route regression failed before the fix; all 136 route, lesson, and review tests passed afterward, including a real lesson-to-review component transition that does not fetch the regular queue. Type checking and scoped lint passed. The same 136 tests and type checking passed against the production-based release.

Reconstructed current production by source hashes and applied only this fix and its tests to three files. All 1,099 uploaded hashes match the release snapshot. Build reached READY, and production remained on the expected baseline before promotion.

After deployment, Start Quiz returned HTTP 200 with exactly grammar IDs 1104 and 897, and the live browser opened question 1 of 2 for の (Questions). No answers were submitted. The canonical domain resolves to the new READY deployment.

Evidence: `output/bunpro-lesson-quiz-2026-09-23/`.
