# WaniKani-shaped custom kana SRS: scheduling and API research

_Updated 2026-08-31. Sources are WaniKani's own knowledge guide, API
reference, staff announcements, and terms, plus library-owner source
repositories, licenses, and npm metadata._

## Decision

Treat **WaniKani-shaped interaction** and **the scheduling algorithm** as two
separate product choices.

For a first release that is meant to follow WaniKani's actual pattern, use a
small deterministic nine-stage policy behind a scheduler interface. WaniKani
publishes the stage intervals and failure formula, and no maintained
JavaScript/TypeScript SRS library found implements that policy. This does not
require copying WaniKani application code or content.

If an adaptive algorithm is preferred over schedule parity, the concrete
library recommendation is **`ts-fsrs`**. It is the official Open Spaced
Repetition TypeScript implementation, browser-capable, MIT-licensed, and
actively maintained. As of this note, npm reports `5.4.1`, and the package
source identifies its algorithm as FSRS 6.0
([npm metadata](https://registry.npmjs.org/ts-fsrs/latest),
[package documentation](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md),
[version constant](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/constant.ts),
[MIT license](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/LICENSE)).

Do not call an FSRS schedule “the WaniKani schedule.” FSRS is adaptive and
uses four ratings; WaniKani is a fixed stage ladder with a binary answer flow
and an error-count penalty. `ts-fsrs` can configure short learning and
relearning steps, retention, maximum interval, and fuzzing, but configuration
alone cannot reproduce the full WaniKani ladder. The source moves learning
steps of a day or more into FSRS review state, where later intervals are
calculated adaptively
([configuration](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md#custom-parameters),
[learning-step implementation](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/impl/basic_scheduler.ts)).

## The documented WaniKani schedule

WaniKani has nine review stages: Apprentice 1–4, Guru 1–2, Master,
Enlightened, and Burned. A completed lesson starts at stage 1. A fully correct
review advances one stage; Burned items leave the review queue. WaniKani's
knowledge guide presents friendly rounded intervals, while the API exposes the
exact values used by the default SRS
([stage guide](https://knowledge.wanikani.com/wanikani/srs-stages/),
[SRS resource](https://docs.api.wanikani.com/20170710/#spaced-repetition-system-data-structure)).

| Position | Display stage | Guide interval until next review | Exact API interval |
| ---: | --- | --- | ---: |
| 0 | Unlocked / lesson-ready | none | `null` |
| 1 | Apprentice 1 | 4 hours | 14,400 s (4 h) |
| 2 | Apprentice 2 | 8 hours | 28,800 s (8 h) |
| 3 | Apprentice 3 | 1 day | 82,800 s (23 h) |
| 4 | Apprentice 4 | 2 days | 169,200 s (47 h) |
| 5 | Guru 1 | 1 week | 601,200 s (6 d 23 h) |
| 6 | Guru 2 | 2 weeks | 1,206,000 s (13 d 23 h) |
| 7 | Master | 1 month | 2,588,400 s (29 d 23 h) |
| 8 | Enlightened | 4 months | 10,364,400 s (119 d 23 h) |
| 9 | Burned | no more reviews | `null` |

The API defines an interval as time added to review registration and adjusted
to the beginning of the hour. Its worked example turns an 8-hour interval
from 15:31 into a 23:00 due time. A parity implementation should therefore
store UTC instants and apply the documented exact interval followed by
top-of-hour adjustment, rather than adding calendar months
([SRS calculation](https://docs.api.wanikani.com/20170710/#spaced-repetition-system),
[stage attribute definition](https://docs.api.wanikani.com/20170710/#spaced-repetition-system-data-structure)).

WaniKani has a second, accelerated system for Apprentice stages in its first
two levels: 2 h, 4 h, 8 h, and 23 h before Guru 1; later stages match the
default system. Custom packs do not have WaniKani levels, so use the standard
system unless the product deliberately introduces an accelerated beginner
mode
([knowledge guide](https://knowledge.wanikani.com/wanikani/srs-stages/),
[accelerated API resource](https://docs.api.wanikani.com/20170710/#get-all-spaced-repetition-systems)).

### Incorrect answers

The public failure rule is:

```text
incorrect_adjustment_count = ceil(number_of_incorrect_answers / 2)
penalty_factor = starting_stage >= 5 ? 2 : 1
ending_stage = max(1, starting_stage - incorrect_adjustment_count * penalty_factor)
```

When a completed review has no incorrect answers, the ending stage is the
next stage. When it has any incorrect answers, apply the penalty instead; do
not also add a success stage. WaniKani's own example moves a stage-4 item to
stage 3 after one miss, and a stage-6 item to stage 2 after three misses
([failure formula and examples](https://knowledge.wanikani.com/wanikani/srs-stages/)).

For a custom kana-only card, `number_of_incorrect_answers` is simply its
meaning error count. If custom kanji vocabulary is added later, meaning and
reading mistakes should be accumulated for the subject and the schedule
committed only after all required parts have been answered correctly once.
That mirrors the API's definition of a completed review
([review semantics](https://docs.api.wanikani.com/20170710/#reviews)).

### Minimal deterministic policy

The implementation seam should be a pure operation such as:

```ts
type ReviewOutcome = {
  completedAt: number
  incorrectMeaningAnswers: number
  incorrectReadingAnswers: number
}

type ScheduleResult = {
  stage: number
  availableAt: number | null
}

interface SrsPolicy {
  startLesson(completedAt: number): ScheduleResult
  completeReview(stage: number, outcome: ReviewOutcome): ScheduleResult
}
```

This keeps a `WkStagePolicy` replaceable by a future `FsrsPolicy` without
mixing either algorithm into lesson/review UI state. It also makes boundary
tests straightforward: every stage transition, 1/2/3-error penalties,
stage-1 floor, burn, and top-of-hour rounding.

## Kana lesson and review behavior worth reproducing

### Kana-only cards are meaning-only

WaniKani's staff announcement is explicit: kana-only vocabulary displays the
kana and tests only the English meaning, like a radical. It does not ask the
learner to copy the visible kana as a reading answer. Kana vocabulary has
pronunciation audio but no reading field. Entering the displayed reading or
its romaji into the meaning field produces a non-penalizing shake/retry
([product announcement and FAQ](https://community.wanikani.com/t/kana-only-vocabulary-additions/61796),
[developer announcement](https://community.wanikani.com/t/kana-only-vocabulary-is-coming/61719)).

That means the initial custom packs should use one card per word and one
meaning prompt per lesson quiz/review. A two-sided “English → kana” production
mode could be useful later, but it would be a Kakehashi feature, not WaniKani
parity.

### Lesson flow

For kana packs, the useful WaniKani-shaped flow is:

1. Show the written word and play independently licensed pronunciation audio.
2. Teach primary/alternate meanings and part of speech.
3. Present an **original** sound-to-meaning keyword mnemonic. WaniKani says its
   kana method uses the sound of the word to cue an image/story; straightforward
   katakana loans may need usage nuance more than a forced mnemonic.
4. Show independently authored Japanese/English context sentences.
5. After a small batch, quiz the meaning until every item is correct; only then
   start its SRS schedule at Apprentice 1.

WaniKani's normal vocabulary lesson organization uses meaning, reading/audio,
and context sections, and its lesson quiz must be completed before subjects
enter reviews. Its current default batch size is five and the setting allows
3–10; those are reasonable UX defaults, not scheduling requirements
([vocabulary lesson flow](https://knowledge.wanikani.com/getting-started/unlocking-vocabulary/),
[lesson/review settings](https://knowledge.wanikani.com/wanikani/app-settings/),
[kana mnemonic method](https://community.wanikani.com/t/kana-only-vocabulary-additions/61796)).

Lesson quiz misses should not alter the SRS. The API likewise distinguishes a
lesson quiz from a review: lesson completion starts an assignment; review
submission updates its SRS
([review semantics](https://docs.api.wanikani.com/20170710/#reviews),
[start assignment endpoint](https://docs.api.wanikani.com/20170710/#start-an-assignment)).

### Review flow and answer evaluation

Implement these documented behaviors without copying WaniKani code:

- Randomize/interleave due prompts rather than grouping identical answer
  types. WaniKani documents randomized meanings/readings and offers several
  queue-order preferences
  ([interleaving](https://knowledge.wanikani.com/wanikani/interleaving/),
  [settings](https://knowledge.wanikani.com/wanikani/app-settings/)).
- Keep a prompt in the session until its required side has been answered
  correctly once. Track every penalizing miss and commit one schedule update
  when the subject is complete
  ([API review definition](https://docs.api.wanikani.com/20170710/#reviews)).
- Match against explicit accepted meanings. Normalize case, surrounding
  whitespace, Unicode, and deliberately chosen punctuation; support authored
  synonyms rather than silently accepting arbitrary semantic similarity.
- Give a non-penalizing retry for known wrong-mode input, such as entering the
  displayed kana/romaji instead of the English meaning. WaniKani's API models
  accepted primary meanings and auxiliary whitelist/blacklist meanings, which
  is a useful custom-content schema
  ([meaning schema](https://docs.api.wanikani.com/20170710/#subject-data-structure),
  [kana FAQ](https://community.wanikani.com/t/kana-only-vocabulary-additions/61796)).
- Show correctness immediately and allow item information after an attempt.
  Do not offer skip or retroactive undo if matching WaniKani's review contract
  ([review controls](https://knowledge.wanikani.com/wanikani/review-buttons/),
  [no-skip rationale](https://knowledge.wanikani.com/wanikani/skip-button/),
  [no-undo behavior](https://knowledge.wanikani.com/wanikani/undo-button/)).

WaniKani does not document the complete fuzzy-matching algorithm or typo
threshold. Reproduce the published interaction, not an inferred proprietary
matcher. Keep non-penalizing categories small, explainable, and covered by
fixtures. A generic edit-distance rule is especially risky for short kana
words and short English glosses.

## WaniKani API v2 for deduplication

### Request contract

Use the repository's existing server-side secret name `WANIKANI_API_TOKEN` in
a trusted authoring/build script; never put it in a `NEXT_PUBLIC_` variable or
a client bundle. This note inspected variable names only and did not read or
print any value.

The subject query is:

```http
GET https://api.wanikani.com/v2/subjects?types=kana_vocabulary
Authorization: Bearer <token>
Wanikani-Revision: 20170710
```

The API expects the timestamp revision header. Omitting it defaults to the
first revision, `20170710`, but sending it explicitly prevents ambiguity.
Adding kana vocabulary was declared a non-breaking change and therefore did
not receive another revision
([revision documentation](https://docs.api.wanikani.com/20170710/#revisions-aka-versioning),
[kana developer announcement](https://community.wanikani.com/t/kana-only-vocabulary-is-coming/61719)).

The API permits comma-delimited array filters. `GET /v2/subjects` supports
`ids`, `types`, `slugs`, `levels`, `hidden`, and `updated_after`; for example,
`types=kana_vocabulary&hidden=false`. For a permanent exclusion check, fetch
both visible and hidden kana subjects (omit `hidden`) so a retired WaniKani
item is not accidentally reintroduced as “missing”
([filter encoding](https://docs.api.wanikani.com/20170710/#filters),
[subject filters](https://docs.api.wanikani.com/20170710/#get-all-subjects)).

Subjects return at most 1,000 records per page. Follow the response's
`pages.next_url` until it is `null`; do not manufacture cursors when the API
already returns the complete next URL. Collections also expose
`pages.per_page`, `pages.previous_url`, `total_count`, and a scope-wide
`data_updated_at`
([pagination](https://docs.api.wanikani.com/20170710/#pagination),
[subject collection](https://docs.api.wanikani.com/20170710/#get-all-subjects)).

For refreshes, the API supports `updated_after`, `ETag` / `If-None-Match`, and
`Last-Modified` / `If-Modified-Since`; its documented limit is 60 requests per
minute. This should be an infrequent editorial check, not a fetch performed by
every learner's browser
([conditional requests](https://docs.api.wanikani.com/20170710/#conditional-requests),
[rate limit](https://docs.api.wanikani.com/20170710/#rate-limit)).

### `kana_vocabulary` schema

Every subject resource has the envelope:

```ts
type Resource<T> = {
  id: number
  object: 'kana_vocabulary'
  url: string
  data_updated_at: string
  data: T
}
```

The relevant data shape is:

```ts
type KanaVocabularyData = {
  auxiliary_meanings: Array<{
    meaning: string
    type: 'whitelist' | 'blacklist'
  }>
  characters: string
  context_sentences: Array<{ en: string; ja: string }>
  created_at: string
  document_url: string
  hidden_at: string | null
  lesson_position: number
  level: number
  meaning_mnemonic: string
  meanings: Array<{
    meaning: string
    primary: boolean
    accepted_answer: boolean
  }>
  parts_of_speech: string[]
  pronunciation_audios: Array<{
    url: string
    content_type: string
    metadata: {
      gender: string
      source_id: number
      pronunciation: string
      voice_actor_id: number
      voice_actor_name: string
      voice_description: string
    }
  }>
  slug: string
  spaced_repetition_system_id: number
}
```

The important trap is what is **not** present: `kana_vocabulary` has no
`readings` array and no `reading_mnemonic`. The visible `characters`/`slug` is
the reading; `pronunciation_audios` supplies recordings. `meanings` and
`auxiliary_meanings` determine answer acceptance, while
`meaning_mnemonic` and `context_sentences` are authored lesson content
([common subject attributes](https://docs.api.wanikani.com/20170710/#subject-data-structure),
[kana vocabulary attributes](https://docs.api.wanikani.com/20170710/#kana-vocabulary-attributes),
[review answer types](https://docs.api.wanikani.com/20170710/#reviews)).

Mnemonic strings may contain WaniKani-specific tags such as `<vocabulary>`,
`<meaning>`, and `<reading>`. Treat API strings as untrusted rich text: parse
only an allowlist into React elements and escape everything else; never inject
them with unrestricted HTML
([markup list](https://docs.api.wanikani.com/20170710/#markup-highlighting)).

### Safe deduplication boundary

For pack curation, retain a generated denylist of normalized `characters`
values and minimal source metadata, not WaniKani's mnemonics, sentences,
audio, or visual assets. `characters` is the authoritative written form.
`slug` is useful for traceability but cannot replace it: hidden subjects may
have an ID suffix added to make the slug unique. Start with NFKC normalization,
outer-whitespace trimming, and exact written-form matching. Then perform an
editorial lexeme check for alternate-script or spelling variants; blindly
converting all hiragana to katakana would merge legitimate usage distinctions.

WaniKani states that subject content—including mnemonics, hints, and
relationships—is its copyrighted material and imposes subscription and
for-profit restrictions on third-party products. Its terms also reserve its
HTML/CSS, JavaScript, look and feel, and visual design elements. Therefore:

- use the API to identify coverage, not to seed Kakehashi's shipped teaching
  content;
- create every custom mnemonic and context sentence independently;
- use familiar functional interaction patterns but an original visual system;
- do not proxy or expose the project API token; and
- obtain written permission before distributing any WaniKani-authored subject
  content.

Sources: [API subscription/content guidance](https://docs.api.wanikani.com/20170710/#respecting-subscription-restrictions),
[WaniKani Terms, sections F and G](https://www.wanikani.com/terms).

## Live vocabulary exclusions and kanji-level map

The catalog was refreshed through the official API on
`2026-08-31T20:05:11.156Z`. The fetch sent revision `20170710`, omitted the
`hidden` filter, and followed every returned `pages.next_url`. This matches the
documented subject filters and cursor pagination rather than assuming that the
first 1,000 records are complete
([subject collection and filters](https://docs.api.wanikani.com/20170710/#get-all-subjects),
[pagination](https://docs.api.wanikani.com/20170710/#pagination),
[API revisions](https://docs.api.wanikani.com/20170710/#revisions-aka-versioning)).

| Scope | Total | Visible | Hidden | Pages | Collection `data_updated_at` |
| --- | ---: | ---: | ---: | ---: | --- |
| `vocabulary` | 6,765 | 6,737 | 28 | combined below | `2026-08-31T17:44:11.367251Z` |
| `kana_vocabulary` | 60 | 60 | 0 | combined below | `2026-08-31T17:44:11.367251Z` |
| vocabulary family | **6,825** | **6,797** | **28** | 7 | `2026-08-31T17:44:11.367251Z` |
| `kanji` | **2,102** | **2,101** | **1** | 3 | `2026-08-31T17:44:56.296945Z` |

Two non-secret, derived snapshots hold only the fields needed by the catalog
validator:

- [`wanikani-vocabulary-exclusions.snapshot.json`](./data/wanikani-vocabulary-exclusions.snapshot.json)
  stores collection metadata and every vocabulary-family subject as
  `{ id, object, characters, slug, readings, level, hiddenAt }`.
- [`wanikani-kanji-levels.snapshot.json`](./data/wanikani-kanji-levels.snapshot.json)
  stores collection metadata and every kanji as
  `{ id, characters, slug, level, hiddenAt }`.

They contain no token, authorization header, account data, meanings,
mnemonics, context sentences, audio, hints, or subject relationships. This is
also why the exclusion pipeline must author its own lesson content rather than
copying API subject content
([subscription/content guidance](https://docs.api.wanikani.com/20170710/#respecting-subscription-restrictions)).

### Normalization and exclusion rules

Use two distinct keys rather than treating “same spelling” and “same sound” as
the same concept:

```ts
const writtenKey = (value: string) => value.normalize("NFKC").trim()

const readingKey = (value: string) =>
  Array.from(writtenKey(value), (character) => {
    const codePoint = character.codePointAt(0)!
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character
  }).join("")
```

Apply the following rules in order:

1. **Hard-reject an exact written collision.** Compare a candidate's
   `writtenKey(characters)` to `writtenKey(subject.characters)` for all 6,825
   ordinary and kana vocabulary subjects, including hidden subjects. This is
   the definitive automated no-overlap boundary.
2. **Do not use `slug` as the spelling.** All 28 hidden vocabulary subjects in
   this snapshot have a synthetic suffix such as `悪女-3359`, while their
   actual `characters` remains `悪女`. The snapshot keeps both fields so this
   behavior stays testable.
3. **Review phonetic collisions editorially.** For a kana candidate, compare
   `readingKey(candidate.reading)` with every ordinary-vocabulary reading and
   every kana subject's `characters`. Reject it when it is the same lexeme in
   another spelling. A reading hit by itself is not proof of overlap: unrelated
   homophones are legitimate words. A conservative pack may reject every hit,
   but the permanent validator should report these separately from hard
   written-form failures. Ordinary vocabulary exposes a `readings` array with
   primary/accepted metadata; kana vocabulary does not
   ([vocabulary reading attributes](https://docs.api.wanikani.com/20170710/#vocabulary-attributes),
   [kana-vocabulary attributes](https://docs.api.wanikani.com/20170710/#kana-vocabulary-attributes)).
4. **Keep written-form normalization narrow.** Do not remove punctuation or
   okurigana, expand iteration marks, collapse small kana, or globally fold
   hiragana and katakana in `writtenKey`. Those transformations can merge
   distinct spellings or lexemes. NFKC is used only as a comparison key; the
   authored display form is preserved.
5. **Audit spelling variants.** Exact matching cannot discover that two
   different orthographies represent the same lexeme. Candidate curation still
   needs a variant check; record any homophone deliberately retained so a
   future refresh remains explainable.

The live data has no duplicate NFKC-normalized `characters` across the 6,825
vocabulary-family subjects, no missing reading arrays, and no subject outside
levels 1–60. Those are observations about this snapshot, not API guarantees,
so the sync validator should continue asserting them after each refresh.

### Assigning custom kanji vocabulary to level ranges

A new custom word has no WaniKani curriculum level of its own. Assign a
**kanji-ready level** from its visible component kanji instead:

1. Split the candidate's written form by Unicode code point and collect each
   Han character. Match it against the visible entries in the kanji-level
   snapshot by normalized `characters`.
2. If every Han character is present, set `readyLevel` to the maximum of the
   component levels. That is the first WaniKani level at which all of the
   word's kanji have been introduced.
3. Place the word in a range only when `readyLevel` falls inside that range.
   Kana and punctuation do not affect readiness; repeated kanji do not count
   twice. Treat `々` as an iteration mark, not as a missing kanji subject.
4. Hold a candidate out of WaniKani-level packs if any Han character is absent
   or hidden. The one hidden kanji in this snapshot is `昌` (subject 2285,
   level 55), so it must not make a word look learnable from the current visible
   curriculum.

This `max(component level)` rule follows the API's model that vocabulary lists
its component kanji, but it deliberately does **not** claim where WaniKani
would schedule a hypothetical vocabulary subject. WaniKani may place its own
vocabulary later for curriculum reasons
([vocabulary `component_subject_ids`](https://docs.api.wanikani.com/20170710/#vocabulary-attributes),
[common subject `level`](https://docs.api.wanikani.com/20170710/#subject-data-structure)).

For broad packs, the live visible-kanji inventory supports these stable range
labels:

| Range | All kanji | Visible kanji |
| --- | ---: | ---: |
| 1–10 | 360 | 360 |
| 11–20 | 348 | 348 |
| 21–30 | 345 | 345 |
| 31–40 | 360 | 360 |
| 41–50 | 346 | 346 |
| 51–60 | 343 | 342 |

The snapshots are editorial build inputs, not browser-fetched user data.
Refresh them infrequently, respect the documented 60-request-per-minute limit,
and use `data_updated_at`, `ETag`, `Last-Modified`, or `updated_after` for later
incremental checks
([rate limit](https://docs.api.wanikani.com/20170710/#rate-limit),
[conditional requests](https://docs.api.wanikani.com/20170710/#conditional-requests),
[`updated_after`](https://docs.api.wanikani.com/20170710/#leveraging-the-updated_after-filter)).

## Browser-suitable library comparison

| Library | Maintenance and license | Browser fit | Can configure the WaniKani ladder? | Verdict |
| --- | --- | --- | --- | --- |
| **`ts-fsrs`** | Open Spaced Repetition; npm `5.4.1` as of 2026-08-31; MIT; zero runtime dependencies in the published metadata | TypeScript with ESM, CJS, UMD, types, and an owner-supplied browser example | **No.** It exposes retention, fuzz, maximum interval, short learning/relearning steps, and four FSRS ratings. A custom scheduler class is possible, but replacing the scheduler means implementing the WaniKani policy oneself. | **Recommended adaptive engine**, not an exact-WK engine. |
| `fsrs-browser` | Open Spaced Repetition; npm `6.6.0`; BSD-3-Clause | Rust/WASM scheduler plus in-browser parameter training | No; it calculates FSRS memory states/intervals. WASM, threading, and optimizer setup are unnecessary for a scheduler-only MVP. | Consider only if browser-side parameter optimization becomes a requirement. |
| `supermemo` | Independent TypeScript SM-2 implementation; npm `2.0.23`; MIT | Very small, browser/ESM/CommonJS documented | No. It takes grades 0–5 and returns adaptive intervals in days; it has neither WaniKani stages nor hour-level learning steps. | Simpler but a poorer behavioral fit than `ts-fsrs`. |
| `fsrs.js` | Older Open Spaced Repetition implementation; MIT | JavaScript package | No | Reject: its owner explicitly recommends migration to `ts-fsrs` because `fsrs.js` is no longer actively maintained. |

Primary sources: [`ts-fsrs` repository](https://github.com/open-spaced-repetition/ts-fsrs),
[`ts-fsrs` strategy interface](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/strategies/types.ts),
[`fsrs-browser` repository](https://github.com/open-spaced-repetition/fsrs-browser),
[`fsrs-browser` npm metadata](https://registry.npmjs.org/fsrs-browser/latest),
[`fsrs-browser` license](https://github.com/open-spaced-repetition/fsrs-browser/blob/main/LICENSE),
[`supermemo` repository](https://github.com/VienDinhCom/supermemo),
[`supermemo` npm metadata](https://registry.npmjs.org/supermemo/latest), and
[`fsrs.js` maintenance notice](https://github.com/open-spaced-repetition/fsrs.js).

## If Kakehashi chooses FSRS anyway

Use `ts-fsrs` behind the same `SrsPolicy` seam and make the behavioral change
explicit in product copy. A conservative typed-answer mapping is:

- any penalizing miss during the completed card → `Rating.Again`;
- no miss → `Rating.Good`.

That discards `Hard` and `Easy` signal but stays deterministic and avoids
interrupting the WaniKani-style typed flow with a self-rating survey. Response
latency could later map correct answers to Hard/Good/Easy, but that becomes a
new, separately tested Kakehashi policy.

Start with owner-supplied default parameters, disable fuzz for deterministic
cross-device reproduction, and persist the exact parameters and algorithm
version with every card/review log. Do not run the optimizer until there is a
meaningful amount of per-user review history. `ts-fsrs` itself provides no
persistence; its documented `afterHandler` pattern can serialize `Date`
objects to epoch values
([serialization example](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md#repeat-vs-next),
[optimizer separation](https://github.com/open-spaced-repetition/ts-fsrs#packages)).

Do not assume `learning_steps: ['4h', '8h']` creates WaniKani parity. In FSRS,
lesson completion, the first rating, learning-step advancement, and later
adaptive graduation must be modeled and tested explicitly. A manual 4-hour
first due date combined with later FSRS results is a hybrid algorithm and
should be named and versioned as such.

## Integration cautions for either scheduler

- **Keep the Next.js boundary explicit.** The queue and durable progress are
  browser-owned, so do not read IndexedDB/local storage during server render.
  Hydrate behind a client boundary before calculating due counts. `ts-fsrs`
  publishes ESM/CJS/UMD builds, but its current package declares Node 20 or
  newer for the build environment
  ([package documentation](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md#installation)).
- **One atomic commit per completed subject review.** Wrong attempts update
  in-session counters; the durable stage/card and due time update only after
  the required side is correct.
- **UTC persistence, local display.** Store due/review times as epoch
  milliseconds. WaniKani top-of-hour behavior should be tested across DST and
  timezone changes.
- **Version the policy.** Persist `policy`, policy version, parameters, and
  review history. Never reinterpret old cards silently after a package or
  algorithm upgrade.
- **Namespace IDs.** Custom pack IDs must not collide with numeric WaniKani
  subject IDs. Stable IDs should survive spelling/content corrections.
- **Version packs separately from progress.** Installing an updated pack must
  not reset cards. Removed cards need an explicit archived state; changed
  accepted meanings need a content migration path.
- **Handle browser concurrency.** Two tabs completing the same review can
  double-advance a card. Use a transactional store or compare-and-swap on the
  card's revision.
- **Validate clock anomalies.** Never generate a negative elapsed interval
  after clock rollback. Define behavior for overdue cards instead of replaying
  every missed interval.
- **Local-only is not durable sync.** Make deletion/site-data loss clear and
  plan export/import before users accumulate months of progress.
- **Keep answer evaluation separate from scheduling.** An accepted typo or
  wrong-mode retry must not accidentally increment the SRS error counter.
- **Sanitize authored markup.** Use an explicit semantic-tag parser for custom
  mnemonics; do not use unrestricted `dangerouslySetInnerHTML`.

## Implementation acceptance checks

Before calling the first web release WaniKani-patterned, verify:

1. Completing a kana lesson creates stage 1 and the expected first due time.
2. Zero-error reviews advance exactly one stage; stage 8 burns.
3. One/two/three errors produce the documented penalties below and above Guru.
4. All due times use the chosen, documented top-of-hour rule.
5. Kana cards ask meaning only; kana/romaji in the meaning field retries without
   an SRS penalty.
6. Lesson quiz misses never change SRS state.
7. Answer synonyms, blacklist entries, normalization, and non-penalizing retry
   categories have fixtures.
8. A refresh of the WaniKani denylist follows every page and catches visible
   and hidden exact written-form collisions.
9. Shipped packs contain no WaniKani-authored mnemonic, sentence, audio, CSS,
   or visual asset.
10. Reload, offline use, two-tab completion, pack upgrade, export/import, and
    browser-data deletion all have defined outcomes.
