# Bunpro integration opportunities for Kakehashi web

_Researched 2026-09-06 against Bunpro's current public site and Bunpro staff announcements. Product recommendations below are inferences. Early-access API capabilities must be checked against Kakehashi's mobile implementation and the user's access agreement; these public sources are not an API contract._

## Decision

Prioritize features that combine Kakehashi/WaniKani knowledge with Bunpro progress and turn that information into a useful next action. A standalone Bunpro dashboard or another configurable cram screen offers convenience, but Bunpro already covers much of that ground. After also inspecting the mobile API and existing web features, a strong first release is a combined workload view, searchable grammar details with saved practice sets, and sentence/audio practice. Build toward a focused weakness-to-practice loop and Bunpro integration throughout Kakehashi's readers.

## What Bunpro already provides

| Area | Verified first-party capability | Implication for Kakehashi |
| --- | --- | --- |
| Analytics | JLPT-category performance, progress charts, session/overall accuracy, XP/badges, and detailed review forecasts. | Basic charts are table stakes; show combined workload and actionable decisions. |
| Content | Grammar references, related grammar, native sentence audio, graded reading, and vocabulary context sentences. | Use available content to support targeted practice rather than rebuilding a reference library first. |

Both rows are from the current [Bunpro feature listing](https://bunpro.jp/pricing).

**Cram is already broad.** The official Cram 2.0 announcement describes independent practice that does not change regular SRS, content selection by grammar/JLPT, sentence-count controls, reviewed-sentence-only selection, complete Japanese sentence reading, and listening practice with replay, slow audio, and optional text reveals. [Cram 2.0 announcement, April 2024](https://community.bunpro.jp/t/cram-2-0-beta/55177).

The July 2026 beta adds Quick Cram presets such as recent lessons, bookmarks, high-level items and a daily mix; unfinished-session management; selection across grammar, vocabulary and textbooks; mixed review types; and a live item count. Do not pitch “one-click cram,” mixed types, or preset lists as an untouched gap. [Cram redesign, July 2026](https://community.bunpro.jp/t/new-beta-feature-cram-redesign-july-30th-2026/208271).

**Related-grammar practice exists.** Bunpro staff explains that Quick Cram within synonym/antonym/related sections tests those grouped items. Personalized selection based on actual confusion, followed by an explanation of the distinction, would be more differentiated than simply shuffling synonyms. [Staff explanation, April 2026](https://community.bunpro.jp/t/quick-cram-feature/183509).

**Knowledge Check already addresses vocabulary gaps.** The March widget lists new/learned vocabulary from grammar sentences and offers quick familiarity ratings. August's deck beta renamed it Knowledge Check and extended it to deck selections. A lesson vocabulary preview alone duplicates this. [March announcement](https://community.bunpro.jp/t/vocab-coverage-new-grammar-widget/181954), [August deck announcement](https://community.bunpro.jp/t/new-beta-feature-decks-redesign-august-18th-2026/212465).

**Topics broadens contextual learning.** July's N5 release groups grammar, explains comparisons and broader concepts, then provides passages using grammar taught up to that point, with human audio. Future plans include higher levels and more interactive activities; those plans should not be described as already shipped. [Topics announcement, July 2026](https://community.bunpro.jp/t/new-feature-topics-beyond-bite-sized-grammar-july-11th-2026/203913).

**Conjugation games exist.** Kaijugation has target-form and form-to-form modes, configurable grammar/vocabulary, studied-vocabulary filtering, timers, and feedback on the entered conjugation. Generic conjugation drills are a weak differentiator. [Kaijugation official announcement](https://community.bunpro.jp/t/kaijugation-released-2026-04-06/168216).

## What Bunpro's WaniKani integration already does

The current product page explicitly lists system-wide furigana matched to WaniKani level, automatically marking equivalent Burned WaniKani items known, and adding Guru vocabulary for extra practice. These should not be proposed as novel integration features. [Current feature listing](https://bunpro.jp/pricing).

April 2026 staff replies confirm Daily Sync, manual Import Once Now, and Practice/Mastered sync choices. They also indicate that imports can take time to finish. [Staff replies](https://community.bunpro.jp/t/does-the-wanikani-sync-n3-vocab-and-above/184767/1).

A potentially useful gap: staff stated in March 2025 that existing Bunpro items keep their state when a WaniKani counterpart later changes, even after reimport; newly eligible Guru-or-above items are imported, while already-studied Bunpro items retain their progress. This supports exploring a discrepancy/forgotten-word audit, but the behavior needs rechecking before claiming it remains unchanged in September 2026. [Staff explanation](https://community.bunpro.jp/t/api-updates-and-wani/120213). The [integration support page](https://bunpro.jp/support/account/wanikani-integration-explained) reports an August 24, 2026 update, but its detailed article body was unavailable in the public text extraction.

## Ranked opportunities after the code audit

1. **Combined daily workload and pacing.** Bring Bunpro, WaniKani and Kakehashi reviews into one forecast, estimate time from observed pace, and suggest a daily lesson budget. Preserve each service's real schedule; forecasts about future answers are estimates.
2. **Weak-point analytics that launch practice.** Rank persistent weak grammar, distinguish recent slips from repeated failure, launch a short targeted session, and measure subsequent improvement. Start with observed Kakehashi sessions; account-wide coverage depends on fuller history access.
3. **Bunpro inside Kakehashi's readers.** Select a phrase in news, EPUBs, manga text or subtitles, inspect a Bunpro explanation, and save the encountered sentence for practice. Automatic grammar detection and personal known/learning/new highlighting are later work, requiring both reliable matching and per-item progress.
4. **Personalized JLPT gaps and drills.** Combine Bunpro curriculum coverage with the existing Kakehashi quick/mock/weak-area quizzes. Map question concepts to Bunpro IDs for targeted follow-up. Coverage is not a predicted exam pass probability.
5. **Sentence listening and production practice.** Use available example audio for grammar cloze, dictation and shadowing; prefer sentences whose vocabulary is familiar from WaniKani. Store optional practice results in Kakehashi and reserve Bunpro review updates for scheduled review behavior.
6. **Cross-system vocabulary diagnostics.** Surface words recognized in WaniKani but missed in Bunpro context, and vocabulary outside WaniKani that hinders grammar study. Requires reliable lexical matching and sufficient per-item/error data; ordinary furigana filtering and dedup are already covered by Bunpro.
7. **Personalized grammar contrast practice.** Use observed confusion to choose pairs, require a context-sensitive choice, and explain why alternatives fail. Structures and nuance are available, but reviewed contrast mappings and suitable distractors are additional content work.
8. **Mixed grammar/vocabulary collections.** Save Bunpro grammar, WaniKani vocabulary and encountered sentences into collections for a book, show or exam. Keep collection notes in Kakehashi unless Bunpro note/bookmark write endpoints are separately confirmed.
9. **Full Bunpro web lessons and reviews.** Convenient mobile parity, supported by the current wrapper. Budget for Bunpro-specific answer handling and reliable submission semantics; its review update payload and response are not fully typed.

## Mobile API and web evidence

- [Mobile API wrapper](../src/utils/bunproApi.ts): lines 167–233 implement profile, base stats, JLPT progress, daily/hourly forecasts, SRS overview, activity counts, due counts and deck queue. Lines 236–313 cover lessons and scheduled review submission. Lines 316–414 cover search and item details. These are the early-access frontend endpoints, not the older public API.
- [Bunpro data types](../src/types/bunpro.ts): lines 75–122 describe aggregate JLPT/SRS/activity/forecast data; lines 233–243 include sentence content, answers, translations and male/female audio URLs. Lines 286–321 expose optional review accuracy, streak, times studied and next-review fields on quiz queue items. No complete historical answer-event or bulk studied-item endpoint is demonstrated by this wrapper.
- [Existing study catalog](../web/src/features/study/catalog.ts): lines 35–52 already list context sentences, audio vocabulary, listening, Japanese text analysis, custom reviews and saved lists. Bunpro should personalize or extend those modes.
- [Existing JLPT modes](../web/src/features/jlpt/types.ts): line 5 already supports quick, mock and weak-area practice; Bunpro concept mapping would add personal curriculum context.
- [Reader annotations](../web/src/features/content/annotation.ts): lines 13–30 currently model JPDB/WaniKani sources; lines 128–130 explicitly exclude grammar tokens from WaniKani matching. Bunpro lookup fits this gap, but no grammar parsing service is exposed in the mobile wrapper.

These findings are based on source inspection, not authenticated beta response validation. No credentials were read and no live review or lesson state was changed.

## API and evidence limits

No current official public early-access API reference was located. Historical public API discussions mention a small older API and a 2022 roadmap statement; they do not establish the capabilities or limitations of the user's current frontend early access. [Historical official discussion](https://community.bunpro.jp/t/does-or-will-bunpro-have-a-public-api/205?page=2).

Verify historical review granularity, sentence-answer events, timestamps, ghost/SRS semantics, related-grammar data, vocabulary identifiers, audio coverage, write scopes, rate limits, caching/content permissions, and browser authentication/CORS against the mobile code and current agreement. If only cumulative counters are exposed, recent-error trends and confusion diagnosis need Kakehashi-owned session history going forward. Public Bunpro features do not imply matching endpoints are accessible to third-party clients.
