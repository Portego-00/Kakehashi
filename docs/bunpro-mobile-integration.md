# Bunpro on mobile

Bunpro home widgets, mixed reviews, and analytics are restricted to the WaniKani username `Portego` through `isPortegoUsername`. Other accounts retain their existing home and analytics screens.

## Entry points

- Home places Bunpro immediately after the normal Lessons & Reviews widget, including lesson goals, deck selection, all/grammar/vocabulary reviews, and three WaniKani + Bunpro mixed choices.
- Entry cards match the web palette in both themes: dark teal Learn/mixed cards, red Review, white text and count badges, segmented lesson progress, and outlined dropdown buttons. Mixed choices stack as separate cards with their provider counts and start action.
- Learn, Review, and mixed disclosures animate their measured height, opacity, and chevrons (240 ms open / 180 ms close). They support interrupted toggles and changing content heights, honor system reduced motion, and immediately remove closing actions from touch and accessibility navigation.
- `/mixed-reviews?mode=all|grammar|vocab` keeps WaniKani and Bunpro provider queues mounted. Only the active provider accepts input or plays audio.
- Both the default **Level → Analytics** segment and the optional standalone Analytics tab expose WaniKani/Bunpro source selection.
- The existing alternate Bunpro page remains the connection/settings entry point. Credentials use the existing secure storage; none are included in the implementation or test fixtures.

## Session behavior

Bunpro follows the question relationship's resource type, including vocabulary questions. Each question occurrence resets answer feedback, hints, scroll position, and audio; hidden provider drafts survive remounting. English meaning answers do not pass through kana conversion.

Saves are serialized, duplicate taps are ignored, and failed saves retain the current answer for retry. A successful save followed by failed pagination does not resubmit the saved answer. Regular missed reviews return for practice, and the first correct retry is submitted to clear Bunpro’s pending wrap-up queue. Further misses do not repeat the initial grade; results retain first-attempt accuracy. Lesson and Beginner 0 misses remain local until the first correct answer. Lesson quizzes remain isolated from review queues.

Mixed sessions share progress, accuracy, previous-answer feedback, wrap-up, SRS progression, and detailed results filters. Retried questions use the shared question clock, and wrap-up preserves every started or missed item. In-session settings preserve the current question, drafts, and progress while applying ordering changes to remaining work. Wrap-up preserves partially answered WaniKani subjects. Exit waits for a save in progress. WaniKani continues using its existing durable submission path.

The home data hook loads only due counts and lesson queues. Analytics loads statistics separately, tolerates individual unavailable endpoints, cancels stale requests, and clears personal data when credentials or accounts change.

## Verification

The final focused Jest run passes 261 tests across 18 suites. Coverage includes the home routes/counts, default analytics navigation and account gating, analytics data/date calculations, provider interleaving, same-question retries, wrap-up, save failures, duplicate callbacks, pagination recovery, audio races, and lesson-quiz isolation. Existing WaniKani review accounting, lesson resume/picker, and shared-question regressions are included.

Read-only iPhone 17 Pro / iOS 26.3 simulator checks used a connected Portego account: home counts, mixed-session loading and combined totals, mixed Bunpro exit/wrap-up controls, analytics source/filter changes and review links, vocabulary cloze/ruby/translation rendering with the software keyboard open, and forward navigation between lessons. No live answers were submitted. Submission and failure scenarios use mocked requests in tests.

The native TypeScript check reports existing errors outside this change (including review-search options, SRS indexing, test-session types, formatted notes, FlashList props, assignment subject types, and widget JSX types); changed Bunpro/mixed/analytics files have no reported errors. Focused ESLint and whitespace checks pass. Android device behavior has not been manually verified.

After matching the entry-card styling to the web reference, all five home-entry tests and component ESLint pass again. The main Learn/Review cards were visually checked on the iPhone simulator.

The disclosure animation follow-up passes 22 focused tests across Home, the data hook, and both analytics entry points, including repeated toggles and refreshing an open lesson queue. Scoped ESLint passes; the changed component and tests have no TypeScript errors in the repository-wide check (unrelated errors remain). Native simulator recordings confirm intermediate panel heights and chevron rotation when switching Learn/Review, closing Review, and closing/reopening mixed reviews, without residual spacing after collapse.

## Review and lesson parity (8 October 2026)

The mobile review gear menu now exposes appearance, text sizes, Bunpro furigana, Jitai, Anki display options, ordering, batch and wrap-up limits, answer pause/details behavior, feedback sounds, configurable Bunpro shortcuts, voice input, and audio preferences. The mixed session exposes settings on WaniKani turns too. Voice captures and delayed saves are scoped to their originating question; stale results cannot overwrite a later turn. Bunpro prompts and results fill every cloze blank, including the expected answer after a verdict. Both standalone and mixed sessions have complete result filters and duration information.

Lessons and review information use shared native Details/Examples/Context navigation with a compact sticky identity. Rich content uses a mobile-owned DOM renderer with the same HTML allowlist as web, so its React runtime and Japanese font stay within the mobile bundle. Structure switching, embedded examples, per-example and global visibility controls, vocabulary dictionary/pitch/frequency panels, coverage knowledge checks, and supported Kaijugation links are available. Lesson queues refresh after every completed batch; explicit deck choices and extra lessons continue to use the existing queue policy. Native lesson navigation retains its footer and supports large batches with horizontal dot navigation.

The implementation is in the local checkout. See `docs/bunpro-mobile-parity-2026-10-08.md` for validation and release status.
