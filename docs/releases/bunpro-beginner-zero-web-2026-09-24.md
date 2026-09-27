# Beginner 0 review retries — 24 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_6EXH7GVEzcCXZr33aTKTSwRYMU9a`
- Immutable URL: https://kakehashi-fwad5atbe-portego-00s-projects.vercel.app
- Previous production: `dpl_8iEbzUwWyzt2Wp3iJb3SvzcFgLdN`

Regular Bunpro reviews explicitly at `streak: 0` (Beginner 0) now follow the existing lesson save policy. Misses remain local; the first correct answer submits `correct: true` through the normal review context, allowing Bunpro to schedule the next interval. Higher stages, unknown stages, and ghost reviews retain first-attempt grading.

The regression reproduced an unwanted wrong submission at stage zero. Five cases cover Beginner 0, Beginner 1, null and missing stages, and ghost stage zero. Each exercises two misses and a correct retry, verifies exactly one submission with the appropriate grade, and checks that Beginner 0 displays the returned Beginner 1 progression. Existing lesson and higher-stage retry tests also pass.

All 142 relevant tests passed in the workspace and production-based release. Type checking passed in both, and scoped workspace lint passed. Reconstructed current production and changed only the review component and its tests. All 1,104 uploaded source hashes match the tested snapshot. Build reached READY and promotion checked the expected production baseline. No real account answers were submitted during verification.

Evidence: `output/bunpro-beginner-zero-2026-09-24/`.
