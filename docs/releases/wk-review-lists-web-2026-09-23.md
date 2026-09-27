# WaniKani review quick-add lists — 23 September 2026

Deployed to https://kakehashiapp.com.

The review toolbar now includes a bookmark action that opens the same list picker as subject details. Users can select multiple lists or create one inline. Saved membership fills the bookmark. The current question stays in place while the picker is open, including when automatic advancement is enabled; review shortcuts remain suspended inside the dialog.

Validation: 81 targeted unit tests, TypeScript, scoped lint, and browser checks at 390px and 1280px passed. Browser fixtures intercepted network writes. Screenshots were checked for layout.

Deployment: `dpl_DbuuhaeNNV2ySqA4pADNNEEb25eH`. Previous production: `dpl_qR8VWae6Y9zkj4j5oLZHK9jGAmSV`. Reconstructed from current production with only the session component and two test files changed; all 1,095 uploaded source hashes matched the tested release. Build reached READY, production was checked before promotion, and the production target was verified afterward.

Evidence: `output/wk-review-lists-2026-09-23/`.
