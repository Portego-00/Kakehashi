# Bunpro details — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_By7SpXPBEpe1QSWsLMmxurWHLybn`
- Immutable URL: https://kakehashi-5p2secnmc-portego-00s-projects.vercel.app
- Previous production: `dpl_619icn3rJN3gJtFCyCftphNrh6aJ`

The details page passed a URL-encoded Japanese route slug into the details client, which encoded it again. The live request for のは returned 500. Decode the route slug before passing it to the client, and reject malformed encoding with a not-found response.

Validation: regression tests failed before the fix; all 69 page and Bunpro API tests passed afterward. Type checking and scoped lint passed. The production build reached READY. After promotion, the original signed-in browser page loaded its grammar explanation, structure, examples, and vocabulary coverage successfully.

The release uses verified production source with only the details page and its tests changed. All 1,092 uploaded file hashes match the release snapshot. Production was unchanged before promotion, and the canonical domain was verified on the new READY deployment.

Evidence: `output/bunpro-details-2026-09-23/`.
