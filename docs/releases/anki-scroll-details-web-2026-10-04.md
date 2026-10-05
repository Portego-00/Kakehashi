# Scrollable Anki details — 4 October 2026

In web Anki mode, revealing an answer makes item details available below the initial viewport. Users can scroll directly to them without pressing D. D opens the details and scrolls to their start on desktop and mobile. Revealing an answer does not automatically scroll or shrink the prompt. Extra detail data loads when the panel enters the viewport or is explicitly opened. The existing opt-in wrong-answer automatic disclosure continues to work.

Applies to WaniKani, Bunpro grammar/vocabulary, mixed reviews, and extra-study Anki quizzes. Custom vocabulary uses typed reviews and has no Anki mode.

Deployed and promoted to https://kakehashiapp.com as `dpl_HbfamYj5ZK2UyrMfztPmixxnEkpX`. Immutable URL: https://kakehashi-529m0xdn5-portego-00s-projects.vercel.app. Previous production: `dpl_DnvS9kyXw7p4qBCWPMrhk7AAd34L`.

Reused the verified 1,121-file live source manifest and checked each edited file's baseline against Git HEAD before overlaying six implementation/test files. Unrelated workspace changes were excluded. Upload hashes were verified, production was unchanged immediately before promotion, and the canonical domain was verified on the intended READY deployment afterward.

Validation: type checking and full lint passed (three existing warnings). All 2,943 non-skipped unit tests passed, with one skip; the 266 review tests passed again after the final layout refinement. All 16 browser checks passed, covering existing disclosure behavior, automatic wrong-answer details, Anki scrolling and D on desktop/mobile. Four additional checks exercised scrolling before any press of D. The production build succeeded and the staging login returned HTTP 200.

Source snapshots, manifests, deployment records, and logs: `output/anki-scroll-details-2026-10-04/`.

Live demo verification confirmed that revealing an Anki answer leaves scroll position at zero, then ordinary scrolling exposes details while the disclosure remains closed. Screenshot: `live-scroll-details.jpg`. Demo Anki mode was restored to Off; no answer was graded or real review submitted.
