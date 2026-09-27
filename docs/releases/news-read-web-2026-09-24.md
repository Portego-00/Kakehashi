# News read history — 24 September 2026

Deployed to https://kakehashiapp.com/news.

- Deployment: `dpl_8iEbzUwWyzt2Wp3iJb3SvzcFgLdN`
- Previous production: `dpl_D2E5wFurPFn9RyiETrU5SapzAXWe`
- Immutable URL: https://kakehashi-7pli69tav-portego-00s-projects.vercel.app
- Feature commit: `244746df` (web changes only)

Adds automatic read marking, manual read/unread controls, muted read cards, and an Unread filter. History persists in browser storage, with separate demo storage.

Applied the web feature to the current production source, preserving all other live files. All 1,104 uploaded file hashes match the tested release snapshot. Type checking, scoped lint, and 11 news tests passed. Vercel production build reached READY and the canonical domain points to this deployment. Live demo-browser checks passed for marking read, persistence after reload, unread filtering, and undo; the test story was restored to unread. Mobile changes were not deployed.

Evidence: `output/news-read-web-2026-09-24/`.
