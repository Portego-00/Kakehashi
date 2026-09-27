# Sticky study subject header — September 25, 2026

Deployed to https://kakehashiapp.com as `dpl_6h3eQj3QDdMM6kKYrSw6AJKqWgcT`.

- Immutable deployment: https://kakehashi-crbtmoymk-portego-00s-projects.vercel.app
- Previous production: `dpl_7Q3hj3prnsPwvr6EfnamteRY83um`

Embedded subject details now keep the current character visible while scrolling through reviews and custom lessons, including visually similar kanji. The normal details header uses the subject's background color with contrasting text. The pinned header fades/slides in and out, respects reduced motion, handles nested scrolling, updates with the current subject, and disappears when the disclosure closes. Clicking it returns to the details start. Main lesson teaching retains its existing sticky header.

Reconstructed all 1,112 files from the current live deployment and merged only six changed files plus the new embedded header component. All 1,113 uploaded file hashes match the tested release. Other local news, Bunpro, and community edits were not included; existing production fixes were preserved.

Validation: 128 focused tests, TypeScript, scoped lint, and both desktop/mobile browser regression checks passed against the production-based release. The Vercel production build reached READY. The staged login returned HTTP 200. The live alias was checked before promotion and confirmed on the new deployment afterward. The live login returned HTTP 200. A fresh isolated browser using the demo account verified the colored details header and visible pinned character (嫌 / Dislike), with no page errors. No real review answers were submitted.

Deploy-ready source: `output/kanji-header-2026-09-25/source/`.
Evidence: `output/kanji-header-2026-09-25/`, including manifests and a live screenshot.
Deployment instructions: [Deploying Web to production](../deploying-web-to-production.md).
