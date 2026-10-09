# Bunpro mobile parity — 8 October 2026

Implemented in the local checkout. These changes have **not** been published to the production mobile update channel.

## Reviews and mixed reviews

- Regular misses save the initial grade, then submit the first correct retry to clear Bunpro's pending wrap-up queue. Additional misses stay local. Results retain first-attempt accuracy and update the final saved stage.
- Lessons and regular Beginner 0 reviews keep misses local until the first correct submission. Ghost and self-study reviews retain their own endpoints and identities.
- Retries use a two-to-ten-question schedule. Mixed sessions use the shared provider question clock; due retries can be promoted without losing typed drafts. Wrap-up preserves started and missed items, including partially answered WaniKani subjects.
- Standalone Bunpro wrap-up is available. In-session ordering changes preserve the current question, answers, saved progress, and open items. WaniKani's queue no longer reloads when settings change during a mixed session.
- The gear menu exposes appearance, text sizes, furigana, Jitai, Anki display options, ordering, batch and wrap-up limits, pause/details behavior, feedback sounds, configurable Bunpro shortcuts, voice input, and audio preferences. It is also available on WaniKani mixed turns.
- Voice captures stop when their question or provider changes. Background saves cannot display progression for an older answer. Audio, input, and settings changes preserve drafts.
- Every cloze blank renders consistently. The verdict reveals the expected answer. Missing sentences are blocked from grading, and English translation questions retain Bunpro's close-answer feedback.
- Both standalone and mixed results expose all/correct/missed filters, duration, item navigation, and richer Bunpro prompts, translations, audio, and saved stages.

## Lessons and information

Lessons and review information share Details, Examples, and vocabulary Context tabs. A compact identity sticks above the tabs after the main heading scrolls away. Native navigation and scrolling remain in React Native; rich content uses a mobile-owned DOM renderer with the same HTML allowlist as web and a bundled Japanese font. Keeping the renderer in the mobile package avoids loading web's separate React runtime.

Available controls include standard/polite structure, embedded writeup examples, sentence and translation toggles, per-example translation menus, audio, dictionary senses/forms, pitch/frequency panels, progress and review-type information, vocabulary coverage knowledge checks, and supported Kaijugation links. Coverage saves remove each successful group before retrying later failures, preventing duplicate writes. Skipped words remain unchanged.

Lesson batches refresh Bunpro's counts and content after each quiz. Configured batches, explicit deck choices, extra lessons, and skipping confirmed-empty decks continue using the existing queue policy. Large batches have scrollable footer navigation. Lesson quiz queues remain stable across preference changes.

## Validation

- **207 native tests passed across 30 suites**, including Bunpro home/queues/analytics, reviews, lessons, mixed sessions, settings persistence/migration, voice cancellation, coverage save recovery, WaniKani accounting, and lesson resume/picker regressions.
- **5 DOM rendering tests passed**, covering both example resource types, safe formatting/links, visibility controls, audio bridging, structures, embedded writeups, dictionary data, and frequency switching.
- Subsequent focused checks passed for the final review, mixed, and information-screen changes.
- Changed-source lint and whitespace checks pass. The source-only native typecheck has no diagnostics in the changed files. It still reports existing errors in unrelated review-search, SRS, test-session, formatted-note, search, and API files.
- The iOS development app built and launched on iPhone 17 Pro / iOS 26.3. Native fixture screenshots verified lesson examples and Japanese/furigana rendering, the settings sheet, and a review with the software keyboard open. No real Bunpro answers were submitted. Desktop interaction was unavailable while the Mac was locked; touch/action behavior is covered by tests. Android device behavior has not been manually checked.
- Final iOS and Android release exports succeeded. Each references **3 DOM pages and 90 required DOM files**, with **zero omissions** from update metadata. The Japanese font is included in the asset metadata.

The temporary fixture route and development server were removed/stopped after verification. Concurrent work elsewhere in the checkout was preserved.

Evidence: `output/bunpro-parity-2026-10-08/`. Final exports: `final-native/`; screenshots: `screenshots/`.
