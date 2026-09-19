# Analytics Reference Audit

Inspected [Wanilog's public dashboard demo](https://www.wanilog.com/dashboard) on 2026-09-10 with Chromium at 1440 x 1000. The supplied WaniKani credential was not submitted to Wanilog. Every dashboard section and the linked analytics pages below was opened. This is an interaction inventory, not permission to reuse source or visual design.

## Dashboard and Customization

- Dashboard: projection, current level, accuracy, SRS items, rotating coverage, reading coverage, reviews due, burns, achievements, sharing.
- Coverage selector: JLPT, Joyo, frequency, vocabulary.
- Customize: bento or sidebar layout; edit tile order by dragging; reset order; Done.
- Sidebar sections: Overview, Progress, Accuracy, Forecast, Leeches, Kanji, Coverage, Achievements. Section summaries link to full pages.
- Global search, sync status/details, theme, feedback, settings; welcome tour.

## Projection and Level History

- Median pace, average, fastest, slowest, completed levels and current elapsed duration.
- Projected completion date with p25-p75 historical-pace band; level milestones and calendar export.
- What-if days-per-level slider (6-60) with completion date and workload estimate.
- Per-level pace bars can exclude individual outliers; exclude accelerated levels 1-2.
- History measures time from unlock or first lesson.
- Chart controls: day labels, outlier clipping, median line, copy image.
- Current-level kanji: Guru count versus 90% requirement, in-progress/lessons/locked groups, earliest level-up, next blocking review.
- Fastest route expands into a dated review-session schedule with item lists, transitions and Guru totals. Assumes timely correct answers.

## Accuracy and Leeches

- Overall meaning, reading and combined correct/incorrect counts; estimated lesson/review study hours.
- Accuracy by radical/kanji/vocabulary, SRS stage and WK level; effective accuracy is meaning and reading probability combined.
- Leeches: recent struggle / weighted / accuracy scoring, meaning/reading/all, worst-first/level, hide burned, exclude recently unlocked, minimum wrong answers, CSV export.
- List rows include meaning, reading, level, question accuracy, wrong count, community difficulty and item/trainer links.
- Similar-looking leech pairs, pair drill, apprentice items never passed, longest stuck first.
- Trainer: top 10/25/all; flashcard reveal, needs-work retry, known, shuffle, audio, accepted meanings/readings/mnemonics.
- Typed trainer: meaning, reading, both; entered answers graded; keyboard controls.

## Reviews and Forecast

- Due/overdue count, approximate clearing time, next 24h, next 7 days stacked by SRS stage.
- Device-collected historical SRS distribution; empty state until enough snapshots exist.
- Study activity heatmap and bars with day detail, current/longest streak, active days, today/7-day-average/best day.
- Activity distinguishes reconstructed stage changes from device-observed completed reviews.
- Level-up blockers in the queue, time until due, direct item links.
- Tier promotions into Guru/Master/Enlightened/Burned; 24h/7d/30d horizon and overdue counts.
- Forecast separates WaniKani's known schedule from modeled repeats/new lessons, with hourly and daily charts.
- Lesson pace presets and custom number, seeded from observed last-30-day lessons; 7-180 day horizon.
- Review budget can solve for lesson pace. Reports settled daily median, total projected reviews/lessons, available/projected lesson pool and assumptions.

## Coverage, Items and Reading

- JLPT N5-N1, Joyo grades 1-6/secondary, frequency buckets of 500 up to 2500, vocabulary by WK level.
- Current Guru+ counts with stacked SRS stages; future coverage at WK levels; SRS-colored items and items outside WK.
- Item browser: search character/kana/romaji/meaning, type, stage/substage, due today, level range, reading, part of speech, level/stage grouping, saved decks, weak/all review.
- Reading checker: up to 5000 characters, local analysis, unique kanji and occurrences, started/Guru+ coverage, future-level preview, SRS-colored text, character hover details.
- Reading coverage: weighted kanji frequency estimate; NHK News/Easy, best coverage/best learning/recent sorting, known-kanji/word percentages, translations and article links.
- Music is a separate media subtab: song/artist/video lookup, synced lyrics, manually supplied lyrics, text coverage. It depends on media services outside the WaniKani API.

## Achievements, Sharing and Preferences

- 71 medals grouped by category, rarity or recently unlocked. Categories: milestones, time, velocity, consistency, accuracy, customization, exploration.
- Medal detail: tier, category, requirement, earned date or current/target progress.
- Share preview: stats, kanji grid, activity heatmap; username/days toggles; starting date; PNG save/copy.
- Public profile: optional publishing with anonymous ID, tagline, leaderboard/deck visibility. No publishing was performed. Reference explicitly transmits/stores the key for profile verification.
- Settings: theme palettes/mode/black background, refresh schedule, language, goal level/date, JSON export, pace origin/reset inclusion, font/audio preferences, outside-WK known kanji, activity backup, achievement sync.

## Kakehashi Opportunities

- Preserve the compact study workspace and shared tokens; make analytics sections individually expandable, with meaningful controls available directly.
- Add hide/show, reorder arrows usable by keyboard/touch, width choice, presets and reset. Retain learner choices locally.
- Replace unexplained rotating content with deliberate labeled views. Keep plots at stable dimensions, truthful zero baselines and accessible value descriptions.
- Connect percentages to filtered subject lists and Kakehashi's existing study routes. Avoid duplicate training engines.
- Explicitly distinguish actual API timestamps, device observations and model estimates; show missing historical data honestly.
- Use occurrence-weighted and unique reading coverage separately. Vocabulary matching must be described as catalog matches rather than a full language-comprehension score.
- Use motion for changing bars, filtering and dialogs with reduced-motion support; no decorative movement.

Screenshots are in `/tmp/wanilog-*.png`, including dashboard, sidebar sections, customization, projection, level-up, accuracy, forecast, reviews, leeches, trainer, item browser, all coverage pages, reading, music, share and settings. Reference account data is randomized between fresh demo sessions. A complete browser demo storage snapshot is at `/tmp/wanilog-demo-complete-state.json` for repeatable inspection; it contains demo data only.

## Sources and Data Boundaries

- [Wanilog dashboard](https://www.wanilog.com/dashboard): primary interaction audit. The implementation is an original Kakehashi interface, not copied page source or artwork.
- [Wanilog feature comparison](https://wanilog.com/compare/wkstats): public corroboration of the projection, forecasting, coverage, leech and phone-layout feature families. The comparison page is a vendor claim; the interaction inventory above was checked in the demo.
- Public coverage descriptions: [reading checker](https://wanilog.com/tools/can-i-read-this), [JLPT](https://wanilog.com/tools/jlpt-coverage), [Joyo](https://wanilog.com/tools/joyo-coverage), [frequency](https://wanilog.com/tools/frequency-coverage).
- [Official WaniKani API reference: Get All Reviews](https://docs.api.wanikani.com/20170710/#get-all-reviews) states that this endpoint is deprecated and returns an empty collection. Individual review lookup returns 404. [The WaniKani team's follow-up](https://community.wanikani.com/t/api-changes-get-all-reviews/61617?page=14) confirms that individual review history is no longer stored. Historical review heatmaps therefore cannot be reconstructed faithfully from this token alone.
- [Official assignments](https://docs.api.wanikani.com/20170710/#assignments), [review statistics](https://docs.api.wanikani.com/20170710/#review-statistics) and [spaced repetition systems](https://docs.api.wanikani.com/20170710/#spaced-repetition-systems) supply milestone dates, cumulative answer statistics and stage intervals. These are different data sources and must not be conflated.
- [Official level-progress guidance](https://knowledge.wanikani.com/widgets/level-progress/) confirms that an item which previously reached Guru remains passed for level-up progress even after a demotion. Catalog coverage intentionally measures current knowledge at the selected stage threshold instead.

## Implemented Feature Map

| Reference area | Kakehashi location and behavior |
| --- | --- |
| Custom dashboard | 18 widgets; Overview, Study habits and Deep dive presets; independent visibility, order and compact/wide size; drag, keyboard and arrow reordering; preview, cancel, apply and restore; persisted account-scoped layout. |
| Level pace | Median/average/fastest timing, goal level/date, pace slider, historical pace range, unlock/first-lesson origin, level exclusions, outlier clipping, all-level dates, milestone calendar export. |
| Level-up blockers | Permanent passed-Guru counting, 90% requirement, in-progress/lessons/locked groups, next blocking reviews and an expanded fastest-session plan with individual actions, stage transitions and calendar export. |
| Accuracy | Overall/meaning/reading totals and percentages; type, current stage and level grouping; effective-answer estimate; full expanded tables. |
| SRS distribution | Current stage/type totals and searchable item drilldowns; independently recorded daily snapshots, range controls and validated account-specific JSON backup/import. |
| Workload and forecast | Due-now/24-hour/7-day scheduled counts, seconds-per-item estimate, subject drilldowns; conditional 7-180-day forecast, daily/weekly views, lesson pace and accuracy controls, review-budget solver and explicit assumptions. |
| Promotions | Expanded workload includes Guru/Master/Enlightened/Burned transitions, 24-hour/7-day/30-day windows, tier filters, overdue opportunities and subject/time rows. |
| Activity and history | Lesson/burn/review calendars and daily bars, local-hour distributions, day drilldowns, current/longest streaks, today/7-day-average/best-day summaries, activity CSV, local review recording and source/coverage boundaries. |
| Burns | Monthly and cumulative history, conditional upcoming burns, next possible burn and subject drilldowns. |
| Difficult items | Weighted-mistake and current-streak struggle scoring; accuracy/mistake/level sorting, type/stage/search/minimum-errors/weakest-answer/new-lesson/burned filters; exact never-passed Apprentice selection and oldest-lesson ordering; CSV with scoring and lesson dates. |
| Practice | Flashcard and typed-answer practice, meaning/reading/both prompt selection, retry and known flows, missed-item retry, 10/25/all selection, shuffle, pronunciation, subject details and similar-looking pair drills. Changing prompt kinds clears the prior session; meaning-only subjects are excluded from reading-only queues. Uses Kakehashi's existing answer checker and does not submit WaniKani reviews. |
| Coverage | Existing JLPT/Joyo/frequency catalogs plus WaniKani vocabulary; Guru+/Burned thresholds, future-level preview, per-bucket item lists, known/remaining/outside-WK filters and current-stage colors. Full catalog denominators retain characters not taught by WaniKani. |
| Item explorer | Kanji wall with kana/romaji/meaning search, pagination, stage and level filters; All subjects mode adds type, exact SRS substage, due-now/today, level range, reading, vocabulary part of speech, level/stage grouping, CSV, custom practice and saved-deck links. |
| Reading readiness | 10,000-character on-device checker, occurrence and unique-kanji coverage, Started/Guru+/Burned thresholds, future-level preview, outside-WK known characters, highlighted text, frequent unknowns and CSV, exact WaniKani word matches including kana-only text. Three original sample passages. |
| Achievements | Category/status/search controls, requirement and progress displays, tiers, earned dates only when supported by records, and focused detail dialogs. Original achievement definitions rather than copied medal artwork. |
| Sharing | Summary, kanji-wall and activity-calendar PNGs, light/dark styles, username and study-duration privacy switches, date control, clipboard actions and a token-free fixed snapshot link. |
| Existing media | Reading links to Kakehashi's NHK Easy/regular news with known-kanji/date sorting. Existing Songs and other reading surfaces remain available in app navigation instead of being duplicated inside analytics. |

## Intentional Differences

- Missing historical reviews are shown as unavailable, not zero. New local review observations have explicit recording boundaries; old assignment update timestamps are not invented review events. Actual study time is device-recorded, not a retroactive estimate presented as fact.
- Device review history retains up to 20,000 observations and identifies the retained recording boundary when older observations are trimmed. Review-event history stays in this browser: it has no automatic cross-device synchronization or raw-event import. Aggregated activity can be exported as CSV. Separately, account-validated SRS snapshot JSON backups can be transferred explicitly. Those snapshots reflect actual observations while using the app, not reconstructed counts on missing days.
- Assignment lesson and burn dates describe the current assignment records. They are not a complete historical event log across account resets or item resurrections.
- A fixed, privacy-controlled snapshot link is provided instead of a hosted, continuously updating public profile or leaderboard. The WaniKani token is never embedded in a share URL or image.
- Reading uses original local samples and the learner's own text. Exact vocabulary matches are labeled as catalog matches, not a grammar or comprehension score. Frequency catalog percentages count distinct characters, not an unsupported corpus-weighted estimate.
- Recent-struggle scoring uses current correct streaks and lifetime error percentages, with that limitation visible. It is not presented as a dated recent-error history. Community difficulty aggregates are not provided by the WaniKani API and are not fabricated from one learner's data.
- Kakehashi's established News, Songs, subject details and saved-list workflows are reused. Generic site tours, support controls, third-party profile publishing and branding-specific settings were not copied into analytics.

## Verification

Browser regression tests are in `web/e2e/analytics.spec.ts`, with a dedicated `web/playwright.analytics.config.ts` targeting port 3210. Each test signs into the built-in demo; no private account data or API token is required.

The combined browser run on 2026-09-10 passed **14 of 14 tests** in 1.7 minutes. The focused coverage and difficult-item unit run passed **18 of 18 tests**. Targeted lint checks passed for the new browser tests and the audited coverage/difficult-item modules.

After the final typed-practice selector was added, its additional targeted browser regression passed **1 of 1** at 320 pixels. It checks meaning/reading/both changes, answer/error/progress reset, restarting after completion, a radical-only reading empty state and zero WaniKani writes. The spec now contains 15 tests; the last selector-only change was verified with this targeted run rather than repeating the already-passing combined 14-test run.

Final integration validation: **2,041 tests passed with one existing skip across 267 files**, using `COMMUNITY_LOCAL_STORE=1` and `--maxWorkers=2`, after the trainer-selector addition. The final production build and typecheck passed. Full lint had no errors and two pre-existing unused-variable warnings in `japanese-voice-assets.test.ts`. A separate live-account smoke test was read-only and confirmed vacation mode was off; no account identifiers or private counts are recorded here. The supplied token is not present in source, fixtures, or this audit.

```sh
cd web
npx playwright test --config=playwright.analytics.config.ts e2e/analytics.spec.ts
npx vitest run src/features/progress/analytics-coverage.test.ts src/features/progress/__tests__/AnalyticsLeeches.test.tsx
```

The independent audit exercised all 18 expanded widgets, Escape and focus restoration, page-position restoration, nested dialogs, layout persistence, canceled changes, keyboard reorder, coverage preview consistency, reading text retention, CSV/PNG exports, snapshot import/export and practice. PNGs were decoded and checked for dimensions and nonblank pixel variation; bar heights and common baselines were checked against their numeric fractions.

The responsive sweep covers 320, 375, 414, 768 and 1440 pixels in both themes, with zero document overflow, no clipped controls and no overlapping chart ticks. All 18 expanded widgets were additionally checked at 320 pixels, including 90-day history and 180-day daily forecasts, and numeric metrics were checked for unwanted line breaks. Screenshot inspection caught and led to fixes for nested Escape bubbling, sparse axis-label clipping, dense chart overflow, default definition-list indentation and narrow forecast metrics.

The demo catalog omits vocabulary parts of speech. The browser audit verifies the truthful empty selector state and nested focus behavior; positive part-of-speech filtering is covered by `analytics-items.test.ts` using a proper-noun fixture combined with reading and exact-substage filters.

Overview screenshots: `/tmp/kakehashi-overview-final-{1440,375}-{light,dark}.png`. The reproducible test run places responsive, expanded mobile and catalog screenshots in `web/test-results-analytics/`; the passing combined 14-test run is archived at `/tmp/kakehashi-analytics-final-browser-20260910/`. Earlier manual full-dashboard captures are `/tmp/kakehashi-analytics-{320,375,414,768,1440}-{light,dark}.png`.

## Initial Screenshot Feedback Follow-Up (Superseded)

This section records the first revision and its historical checks. The user subsequently clarified that cards should share aligned row heights and their actual charts should grow, not use masonry placement. The aligned-row and Recharts revision below supersedes this layout and its screenshots.

The subsequent independent audit reviewed all 18 compact and expanded widgets after feedback about verbosity, resize gaps, missing accuracy levels, and workload hierarchy. It identified the five-level accuracy slice, equal-weight workload metrics, unnecessary always-visible controls and repeated methodology copy, oversized difficult-item and empty study-time panels, and row-grid whitespace.

Mobbin references inspected for hierarchy were [Visitors](https://mobbin.com/screens/a6ee400c-d1b9-4036-bb0c-0465bc23993b), [Whop](https://mobbin.com/screens/0b39694c-dee7-4300-9f2e-ebe25b14c75e), and [Base44](https://mobbin.com/screens/7f34404c-ba21-432f-a80e-68ba834ebbd8). The transferable pattern was a clear primary metric, smaller supporting values, and separate chart controls. The implementation retains Kakehashi's own components, colors and motion. No private WaniKani data was sent to Mobbin.

The revised interface keeps full datasets reachable while moving secondary configuration and methodology behind deliberate disclosures. Accuracy exposes every available level in a bounded, keyboard-focusable region with a visible level count. Activity and burn charts page through the complete selected history instead of silently truncating it; changing the activity metric also updates the primary total. Workload gives due-now counts priority and puts stage/time assumptions behind chart options. Reading separates editing and highlighted results into views, and difficult-item practice retains its full controls behind filters and practice options.

The first revision used measured natural card heights and non-dense placement. That interpretation did not meet the subsequently clarified requirement and was replaced, not retained as an intentional difference.

`web/e2e/analytics-redesign.spec.ts` adds six independent checks: complete compact/expanded accuracy levels; mixed-width and all-compact packing across 1440, 1024, 768, 414, 375 and 320 pixels and back; workload hierarchy and disclosures; expanded-widget geometry, scroll, focus and filter restoration; light/dark overview text fit and compact-height limits; and full 365-day chart pagination with metric-sensitive totals. Geometric assertions detect overlap, avoidable gaps, and reordered card positions rather than relying only on screenshots.

The combined feature and redesign browser run passed **21 of 21 tests in 2.3 minutes**. Existing feature tests were updated for the intentional disclosure and reading-tab changes. Visible-content checks account for native closed disclosures: Chromium can retain descendant layout boxes even when those descendants are not rendered. Both browser specs passed targeted lint.

After the final toolbar, preview-threshold, chart-detail and accuracy-row adjustments, a clean consolidated run passed **10 of 10 affected browser tests in 56.5 seconds**: all six redesign checks plus coverage, reading, chart geometry and the full responsive/theme sweep. The desktop accuracy screenshot confirms all 21 demo levels fit a 642-pixel-wide plot with no internal scrolling; mobile retains access to the complete list. Coverage and reading previews replace ineffective threshold controls with a passed-through-level label and restore the selected threshold on returning to current knowledge. The mobile workload options button remains aligned with its chart switch.

The final full application suite passed **2,064 tests with one existing skip across 271 files**. Production build and typecheck passed; lint had no errors and the same two existing speech-test warnings. New component regressions cover all 60 accuracy levels, hidden records, historical and future partial pages, year-aware date captions, touch-visible chart details, preview-threshold semantics, final-level remaining counts, option persistence and reading-text preservation. A second independent code review identified the date-label, touch-detail and final-level edge cases; all three were corrected and covered by tests.

Fresh screenshot sets are `/tmp/analytics-redesign-overview-{1440,375,320}-{light,dark}.png` and `/tmp/analytics-redesign-first-{1440,375,320}-{light,dark}.png`. Detailed checks include `/tmp/analytics-redesign-workload-{1440,320}-{light,dark}.png`, `/tmp/analytics-redesign-accuracy-levels-{1440,320}-dark.png`, `/tmp/analytics-redesign-coverage-vocabulary-1440.png`, and `/tmp/analytics-redesign-deep-1440-dark.png`. The original baseline is `/tmp/analytics-redesign-before-1440.png`. Browser screenshots and packing geometry attachments are also regenerated under `web/test-results-analytics/`.

```sh
cd web
npx playwright test --config=playwright.analytics.config.ts
```

## Aligned Rows and Recharts Revision

The clarified requirement is equal-height cards within each row, with real content growing into the shared height. The natural-height masonry implementation was removed. The grid now uses ordinary row layout, stretches each paired card, and preserves DOM and keyboard order. Wide cards occupy their own row. Mobile remains a natural-height single column.

Charts now use Recharts 3.10.1 rather than the former CSS bar renderer: a donut for SRS composition, horizontal bars for accuracy categories, a line for accuracy by level and retention, stage-stacked bars for scheduled workload, and area charts for cumulative burns, history and modeled forecasts. Recorded SRS history uses five stage series and preserves unobserved calendar dates as gaps. The native chart accessibility layer and a visible, bounded Chart data disclosure provide complementary graphical and tabular access. All accuracy levels remain in both the actual line data and the accessible table.

The independent checks in `web/e2e/analytics-redesign.spec.ts` now enforce aligned top and bottom edges after mixed-width customization, all-compact layouts, viewport changes and actual content changes. They compare the real SVG dimensions with its plot, and verify that opening one card's data grows its neighbor's rendered donut or bars, not just its border. Closing the disclosure restores the original dimensions. For example, the demo SRS plot grew from 247.8 to 422.8 pixels when its paired Accuracy data table opened; the real SVG grew from 248 to 423 pixels and both cards shared the same 752-pixel height.

Visual checks inspect actual Recharts path geometry, rendered axis text, semantic series colors and decoded screenshot pixels in light and dark themes at 320, 375, 768 and 1440 pixels. The broader feature suite also covers 414 pixels and all 18 expanded widgets at 320 pixels. Stacked bar segment heights are checked against values read from the visible data table, including shared baselines and contiguous stacks. Touch testing targets a verified unobstructed point on the actual SVG path; no synthetic hidden controls or forced clicks are used.

The interaction audit found and corrected a chart wrapper that shrank below its plot after opening a review drilldown, causing controls to be covered. A native touch test also caught the library's default hover-only tooltip index not selecting data on tap. The regression exercises real bar, donut and area taps, native SVG arrow-key/Enter selection, closing drilldowns, and reduced-motion stability. The retained feature suite verifies filtering, exports, snapshot import/export, practice, customization persistence, nested dialogs and expanded-widget focus, scroll and state restoration.

Primary implementation references: [Recharts ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/) for observing actual parent width and height, and [Recharts accessibility documentation](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx) for native chart keyboard navigation. Browser checks use Chromium with touch and reduced-motion emulation; they are not a claim of physical-device or screen-reader certification.

Current geometry evidence: `/tmp/analytics-recharts-paired-before-1440-dark.png` and `/tmp/analytics-recharts-paired-grown-1440-dark.png`. These are settled rendered screenshots, not design mockups. The former masonry screenshots above are historical and no longer describe the current implementation.

Dependency isolation: Recharts is pinned to 3.10.1 and installed in this worktree's `web/node_modules`; the original workspace's dependencies were not changed. Existing dependency versions were preserved. The dependency audit reports five unrelated pre-existing advisories: Next.js (critical), sharp and js-yaml (high), and Vitest and its mocker (moderate). None is on the Recharts dependency path. No unrelated package upgrades were applied.

The final full application unit suite for this revision passed **2,088 tests with one existing skip across 273 files**, using `COMMUNITY_LOCAL_STORE=1` and `--maxWorkers=2`. The earlier focused analytics sweep passed **217 tests**. The final production build and a separate post-build typecheck passed. Lint had no errors and the same two pre-existing speech-test warnings.

The clean combined browser run passed **24 of 24 tests in 3.9 minutes**: nine independent redesign checks and 15 retained feature-workflow checks. The passing artifacts are archived at `/tmp/kakehashi-analytics-recharts-24-20260911/`. Fresh full overview screenshots are `/tmp/analytics-recharts-overview-{1440,375,320}-{light,dark}.png`, with first-viewport captures at `/tmp/analytics-recharts-first-{1440,375,320}-{light,dark}.png`. Individually inspected chart details include `/tmp/analytics-recharts-srs-375-dark.png`, `/tmp/analytics-recharts-workload-375-light.png` and `/tmp/analytics-recharts-accuracy-levels-1440-dark.png`; a full deep-dive capture is `/tmp/analytics-recharts-deep-1440-dark.png`.

After the final axis-inset and snapshot-range safeguards, **all 10 affected browser checks passed in 1.8 minutes**: the complete nine-test redesign suite plus the extended snapshot workflow. Actual X- and Y-axis glyph bounds pass the four-width, two-theme matrix. The snapshot test verifies missing calendar days as unavailable, selecting a missing day, selecting an older observation, and narrowing the range without retaining an invalid date. Artifacts are at `/tmp/kakehashi-analytics-recharts-final-focused/`. The refreshed mobile workload screenshot confirms readable full numeric labels with a 12-pixel inset. No unresolved issue remains from this browser audit; physical-device and assistive-technology coverage remains the verification limitation noted above.

## Cohesive Dashboard and Share Revision

The September 15 reference was the user-provided Flow Insights screenshot at `/Users/pedroortego/Downloads/Screenshot 2026-09-15 at 8.58.41 PM.png` (the actual filename uses a narrow no-break space before PM). The transferable direction is a neutral canvas, quiet card surfaces without separate bordered header strips, consistent insets, a clearly dominant metric and closely related chart, and restrained controls. Its sidebar, app chrome, teal identity and exact layouts were not copied. Kakehashi retains its existing navigation, blue actions, semantic WaniKani colors and shared typography.

The independent baseline audit identified excessive vertical separation between titles, controls, metrics and charts, plus duplicate toolbar space. The revised desktop uses shared 20-pixel gaps and card insets, integrates Share and Customize with the existing progress navigation, and keeps primary and supporting numbers visually distinct. At 375 pixels, the first widget moved from approximately 741 to 635 pixels below the viewport top without removing controls or data. Paired cards still share exact top and bottom edges; their actual plots remain flexible rather than adding blank card space. Current-level progress includes the actual kanji and statuses, SRS integrates its donut with numeric stage rows, and retention uses horizontal bars for categorical comparisons.

The share modal now gives the actual export preview priority, places privacy and fixed-snapshot actions together, provides explicit light/dark image controls, and keeps Download PNG and Copy image next to the preview. Full-resolution zoom stays inside a bounded preview region. Summary images integrate the brandmark, learner heading, prioritized metrics and a labeled SRS donut with counts and percentages. Activity images have weekday/month labels, a calibrated legend and source-conscious totals. The kanji format retains the complete available catalog rather than clipping it to a fixed visible subset.

Actual output inspection caught a blank-canvas bug that DOM and model tests alone did not reveal: global color transitions affected an invisible palette probe, making all paint operations use the same color. The probe's transitions were disabled and all three formats were regenerated in both themes. The audit also measured dark-theme passed-kanji text at 3.45:1 contrast; glyphs now use the foreground token while their green status baseline and background remain. A browser assertion checks actual rendered colors at a minimum 4.5:1 ratio.

The first complete browser pass identified a related reduced-motion problem: the zoomed image's width still animated through intermediate sizes. Its width transition was removed, so full-resolution zoom is immediate. Native select values also clipped at 320 pixels despite normal element overflow measurements. The dashboard action buttons now wrap at that width, and the share Format control gets its own row on small screens. The regression measures actual option text using the computed font and arrow space. Kanji exports adapt their column count, glyph size and image height to the available catalog; the short demo no longer leaves half its canvas empty.

The retained 24 browser checks are supplemented by three tests in `web/e2e/analytics-share.spec.ts`. They compare the visible image blob and downloaded PNG by SHA-256, decode actual pixels in all six format/theme combinations, exercise native image and link clipboard actions and the preview popup, verify the share payload's privacy allowlist, load the snapshot in an unauthenticated browser with no WaniKani API requests, and check all export controls, full-resolution zoom isolation and focus restoration at 320, 375, 414, 768 and 1440 pixels in both themes. These checks use the demo only. Historical test counts in earlier sections refer to their respective revisions, not to this new visual pass.

The root validation for this revision passed **2,096 application unit tests with one existing skip**, plus **39 latest focused regressions** that include the final share cases. The final production build passed, as did typecheck and lint; lint retains the same two pre-existing speech-test warnings. Final browser verification uses the production server, not development hot reload: the initial development-mode snapshot test had exposed a cold-route compiler reload that closed the originating modal, which was distinguished from a deployed-app lifecycle failure before rerunning the unchanged persistence assertion.

The final clean production browser run passed **27 of 27 tests in 2.7 minutes**. Artifacts are archived at `/tmp/kakehashi-analytics-flow-final-27-20260915/`. All six downloaded PNGs were independently viewed, together with full desktop share dialogs in both themes, the 320-pixel light and 375-pixel dark dialogs, the unauthenticated mobile snapshot and the final dashboard overviews. The 320-pixel toolbar now displays full selected values and the pace unit stays intact. The final pass found no unresolved clipping, overlap, missing dataset, image-rendering or interaction issue within the tested Chromium matrix. Physical-device and screen-reader certification remains outside this verification.

Curated evidence within that artifact directory:

- `analytics-redesign-default-8ea49-ut-oversized-compact-panels-desktop/overview-first-screen-{1440,375,320}-{light,dark}.png` and the corresponding full `overview-*.png` captures.
- `analytics-redesign-paired--9a369-d-shrink-when-details-close-desktop/` contains before/after screenshots of actual chart growth with neighboring disclosures.
- `analytics-share-all-share--20de6-ct-visible-nonblank-preview-desktop/share-{stats,kanji,activity}-{light,dark}.png` contains the actual exported files, not screenshots of the preview.
- `analytics-share-share-cont-837e0-e-across-mobile-and-desktop-desktop/share-modal-{320,375,414,768,1440}-{light,dark}.png` records the full modal at each tested viewport.
- `analytics-share-native-cli-4075f-ices-without-account-access-desktop/private-snapshot-375.png` shows the privacy-filtered snapshot without account access.
