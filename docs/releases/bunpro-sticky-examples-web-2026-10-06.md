# Bunpro example spacing and sticky navigation — 6 October 2026

The shared web Bunpro item layout now uses an 8-pixel example-list gap and 16-pixel desktop/12-pixel mobile row padding. Removing stacked card margins also tightens embedded examples in writeups and vocabulary details.

Details/Examples (and vocabulary Context) tabs stay pinned beneath the app header, with a compact subject title and meaning above them once the hero scrolls away. The compact identity can return to the full item header. Its row is outside document flow, so pinning does not change page height. The app-header offset updates on scroll/resize. Existing keyboard tab navigation remains intact.

The Bunpro review disclosure opts into overflow: clip, allowing CSS sticky positioning while retaining its reveal clipping/animation. Other disclosures retain their existing overflow behavior. This shared layout applies to standalone details, reviews, and lessons, on desktop and mobile web.

Validation: all 12 Bunpro browser checks passed, including six new layout checks covering the three screens at desktop/iPhone widths. They verify example spacing, sticky position, title visibility, tab selection, and absence of horizontal overflow. Type checking passed. Lint passed with three existing warnings. The unit suite passed 2,982 tests with one skip: the initial upload-folder run omitted non-deployable research fixtures; after restoring the previous release fixtures in a separate validation source, both affected catalog suites passed (12 tests). No application failures remained.

Release source preserves the verified 1,129-file production snapshot from dpl_47UhwqzuUZk5b4WhxmKFi9zunJbR, with six scoped file overlays and no removals. Other pending workspace changes are excluded. Source hashes, validation logs, screenshots, and deployment evidence are in output/bunpro-sticky-examples-2026-10-06/.

Published to https://kakehashiapp.com from READY deployment dpl_2JjbbjVkk4SExKzttSc4V5fEako3 (https://kakehashi-pcimuzjuu-portego-00s-projects.vercel.app). All 1,130 uploaded source hashes matched the intended manifest. Staging /login returned HTTP 200. Production was still on the expected prior release immediately before promotion, and the canonical domain was verified afterward. Live item verification confirmed the compact subject title and pinned tabs, with approximately 8px gaps and 16px row padding. No real reviews were graded.
