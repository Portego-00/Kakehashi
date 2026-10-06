# Bunpro completed lesson totals — 5 October 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_2NGEQB5KwAXXznVC1a44oMFUTDrZ`
- Immutable URL: https://kakehashi-bn3mbmgz8-portego-00s-projects.vercel.app
- Previous production: `dpl_98ydSPaK5QyPczxCyb785cBtXZ4a`

After completing two extra lessons against a daily goal of four, the Learn card and deck dropdown now display 6/6 with six filled progress segments. The display uses the actual learned-today count and adds completed extra lessons to its total. Queue selection and batch sizing continue to use the configured daily goal. Combined progress retains other decks’ unmet goals: six completed lessons in one deck plus an untouched four-lesson goal in another displays 6/10.

The regression test initially reproduced the exact symptom: a queue reporting six learned lessons rendered 4/4. The cause was the dashboard using the summary’s capped `done` value rather than `learnedTodayCount`. The correction passed the original regression for both the main card and dropdown.

Validation: TypeScript and changed-file lint passed. All 114 unique focused tests passed across the dashboard, lessons, and review suites. One reading-Anki shortcut test failed in the initial concurrent run; the complete 90-test review suite passed on rerun. Vercel’s production build succeeded. Staged and live login returned HTTP 200.

Prepared the release from all 1,127 verified current production source files, changing only the Bunpro home component and its test. All uploaded source hashes match the manifest. Production still matched the base before promotion and resolves to the intended READY release afterward.

Signed-in live verification confirmed 6/6 in both the main Learn card and Bunpro N5 Grammar dropdown, with the next configured batch still two lessons. No quiz or review was submitted.

Evidence, source snapshot, manifests, build log, deployment records, and screenshot: `output/bunpro-lesson-count-2026-10-05/`.
