# Correct lesson retries — 24 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_HyLD64i9R2tFQKXt8Ah9ut5JgPid`
- Immutable URL: https://kakehashi-8dgtv7vcr-portego-00s-projects.vercel.app
- Previous production: `dpl_ApUKTwBvDdv3LmDtPV6HSgRDvJgJ`

Bunpro lessons previously submitted the first wrong answer and treated a subsequent correct answer as an already-saved practice retry. Lesson misses now remain local and unsaved until the item is answered correctly. The correct answer is submitted with `correct: true` and `context: learn` and becomes the completed lesson result. Regular reviews retain their first-attempt grading.

Verified Bunpro's own client explicitly skips submissions for incorrect answers in the learn context. A regression reproduced the unwanted wrong submission before the fix, then passed for two misses followed by one correct submission and lesson completion. All 137 route, lesson, and review tests passed, including existing normal-review retry behavior. Workspace type checking and scoped lint passed. The production-based release also passed all 137 tests and type checking.

Reconstructed the current production source and changed only the review component and its test file. All 1,099 uploaded source hashes match the tested snapshot. The production build reached READY and promotion checked the expected production baseline. No real answers were submitted during verification.

Evidence: `output/bunpro-lesson-correct-2026-09-24/`.
