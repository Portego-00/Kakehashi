# Bunpro Context loading fix — 24 September 2026

Live at https://kakehashiapp.com.

- Deployment: `dpl_D2E5wFurPFn9RyiETrU5SapzAXWe`
- Previous production: `dpl_CMHtJqdDXKSHwGdEaBLYS7ZfChTH`

Opening Context for the first time during a review suspended the entire route because its dynamic import had no local loading boundary. The route displayed “Loading Bunpro reviews,” hiding the current review and looking like a page refresh. A local dynamic loading placeholder now keeps the review visible while the Context code downloads.

A browser regression test pauses the actual Context chunk request and verifies the current answer, review controls, and selected tab remain visible. After the download finishes it verifies anime context renders, with no navigation or page errors. The test failed before the fix and passed afterward. Type checking, scoped lint, and 77 related unit tests passed. All 1,103 uploaded sources match the isolated release; only the component loading boundary and browser test differ from previous production. Production build is READY and staged/live login checks returned HTTP 200.

Evidence: `output/bunpro-context-refresh-2026-09-24/`.
