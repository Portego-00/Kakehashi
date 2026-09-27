# In-session review settings web release — 22 September 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_DCSxqBaBGjggYeMdEudAX2NPx4BB`
- Immutable URL: https://kakehashi-cvlzdarat-portego-00s-projects.vercel.app
- Previous production: `dpl_ESf3UFrEno4VzujnD1jZaHR4K7r6`
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)

Standard review screens now offer a settings modal for theme, supported Anki behavior, ordering, prompt appearance, answer behavior, and audio preferences. Changes preserve the current question, typed answer, completed answers, and submission state. Reordering changes only outstanding questions; automatic advancement pauses while the modal is open. Crosswords, word search, and other distinct game layouts are excluded.

The release was assembled from all 1,070 current production source files because production included newer changes absent from the local checkout. The review-settings patch was merged into that source, preserving the production lesson-history and shared mixed-review presentation updates. Verified all 1,078 uploaded source files by SHA-1. Eight new files and seven existing implementation/test files changed, plus the generated TypeScript build cache; no previous production source was removed.

Validation: release-copy TypeScript and focused lint passed, and eight test suites / 238 tests passed. Vercel's production build reached READY. The staged login returned HTTP 200 before promotion. Production was rechecked immediately before promotion to ensure no intervening deployment would be overwritten. After promotion, the canonical domain resolved to this exact READY, PROMOTED deployment, with login and reviews returning HTTP 200.

All four live-browser scenarios passed on desktop Chromium and mobile WebKit against the deployed app: preservation of typed answers and completed work, one submission per completed item, live ordering/theme/Anki changes, modal keyboard isolation, focus restoration, and paused automatic advancement. Browser fixtures intercepted session and review APIs; verification did not submit real WaniKani reviews.

Evidence is under `output/review-settings-2026-09-22/`. No database migration, environment change, Git commit, or Git push was performed.
