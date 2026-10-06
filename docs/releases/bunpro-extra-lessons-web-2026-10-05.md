# Bunpro extra lesson batches — 5 October 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_98ydSPaK5QyPczxCyb785cBtXZ4a`
- Immutable URL: https://kakehashi-q21wgfwgt-portego-00s-projects.vercel.app
- Previous production: `dpl_Hgq2NTquBsfbjWQrdorXAFDu7EJo`

Reaching or exceeding a Bunpro daily lesson goal now allows another batch using the deck’s configured batch size. The dashboard retains daily progress and shows the extra batch count. Explicit deck choices remain selected after reaching their goal; the default queue prioritizes unmet goals, then allows additional study from unfinished decks. Completed decks remain excluded, and batches are limited to the remaining lessons.

Reconstructed the release from all 1,126 verified current production source files, applied the five changed Bunpro files and one new queue helper, and verified all 1,127 uploaded source hashes. Production still matched the base immediately before promotion and resolves to the intended READY deployment afterward.

Validation: TypeScript and changed-file lint passed. All 112 focused unit tests passed. All four desktop and phone browser checks passed against the frozen production-based release, including existing grammar formatting checks. The Vercel production build succeeded. Staged and live login returned HTTP 200.

Signed-in live verification confirmed daily progress at 4/4 with a next batch of two. Opening Learn loaded Verb + にいく and a two-lesson batch. No quiz or review was submitted, and the browser was returned to the dashboard.

Evidence, source snapshot, manifests, build log, deployment records, and live screenshots: `output/bunpro-extra-lessons-2026-10-05/`.
