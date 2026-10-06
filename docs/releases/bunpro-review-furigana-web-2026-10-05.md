# Bunpro review furigana controls — 5 October 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_86v9Ht1Yp5pxxDebkmNnHEKA534f`
- Immutable URL: https://kakehashi-5seqctarf-portego-00s-projects.vercel.app
- Previous production: `dpl_3R5gS6WrwXTFRCs4uX1YWtpjoEiN`

Bunpro review settings now include an opt-in Hide Bunpro furigana toggle under Appearance, also available in the main Reviews settings. It saves per user and applies immediately to the current question. Readings stay hidden until their word is hovered or keyboard-focused. Clicking or tapping pins an individual reading; clicking again unpins it. Enter and Space also toggle pins without triggering review shortcuts. Pins survive ordinary question rerenders and clear when the question changes or hiding is disabled. The renderer covers parenthesized readings and allowlisted HTML ruby, including review details. Existing furigana behavior outside reviews is unchanged.

Validation: all 189 focused tests passed against the final production-based source snapshot, including preference hydration, persistence, main settings, safe HTML, keyboard interaction, word-specific pins, and real review navigation. Six desktop and phone browser checks passed; the two furigana checks were rerun successfully after isolating the settings files. Browser checks verified actual opacity on hover, keyboard and touch pinning, preserved answer drafts, cleared pins on the next question, persistence after reload, and restored normal readings when disabled. TypeScript and changed-file lint passed. The Vercel production build succeeded. Staged and live login returned HTTP 200.

The release contains 1,129 verified source files: 11 changed files and two additions over current production. Concurrent unrelated settings edits were preserved in the workspace and excluded from this release. All uploaded source hashes match the manifest. Production matched the verified base before promotion and resolves to the intended READY release afterward.

Signed-in live verification confirmed the new toggle, initially hidden readings for 昨日 and 出, and a clicked 昨日 reading remaining visible after focus moved to the answer field while 出 stayed hidden. Review progress remained zero and no answer was submitted. The original off preference was restored and the temporary verification tab was closed.

Source snapshot, manifests, build logs, deployment records, browser evidence, and live screenshots: `output/bunpro-review-furigana-2026-10-05/`.
