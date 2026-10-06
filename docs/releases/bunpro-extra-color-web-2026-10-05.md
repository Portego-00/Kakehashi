# Bunpro extra lesson color — 5 October 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_3R5gS6WrwXTFRCs4uX1YWtpjoEiN`
- Immutable URL: https://kakehashi-kiohtxyzg-portego-00s-projects.vercel.app
- Previous production: `dpl_2NGEQB5KwAXXznVC1a44oMFUTDrZ`

Completed lessons beyond the configured daily goal now use the existing yellow-orange extra-study accent (`#ff9e00`) in both the main Learn progress bar and individual deck bars. Regular completed lessons retain their existing color. Counts and batch sizes are unchanged.

All 12 dashboard unit tests passed, including checks for exactly two extra segments after six completions against a daily goal of four. TypeScript and changed-file lint passed. Vercel’s production build succeeded. All 1,127 uploaded source hashes match the release manifest; only the home component, its test, and Bunpro CSS changed. Production matched the verified base before promotion and resolves to the intended READY release afterward. Staged and live login returned HTTP 200.

Signed-in live verification confirmed two segments with computed background `rgb(255, 158, 0)` and four regular segments with `rgb(231, 162, 162)` in each progress bar. Both counters remain 6/6 and the next batch remains two lessons. No quiz or review was submitted.

Evidence, source snapshot, manifests, build logs, and deployment records: `output/bunpro-extra-color-2026-10-05/`.
