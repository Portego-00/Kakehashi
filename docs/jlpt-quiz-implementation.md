# JLPT Quiz implementation notes

Last verified: 2026-08-30

This document records how Kakehashi's JLPT Quiz maps to the official JLPT and
where the current web experience is deliberately representative rather than an
exact reproduction. The fuller source audit, item-type tables, passage-length
targets, approximate official item counts, and citations are in
[`jlpt-research.md`](./jlpt-research.md).

The stricter item-authoring rules for text grammar and verbal-expression
listening are in [`jlpt-authentic-item-rubric.md`](./jlpt-authentic-item-rubric.md).
The first-party research and authoring checks for N5–N3 reading are in
[`jlpt-lower-reading-research.md`](./jlpt-lower-reading-research.md).
Semantic-item review status and the human approval gate are defined in
[`jlpt-editorial-workflow.md`](./jlpt-editorial-workflow.md).

## Official baseline used

The implementation uses the official JLPT sources as the primary authority:

- [Current test sections and times](https://www.jlpt.jp/e/guideline/testsections.html)
- [Level summaries and test content](https://www.jlpt.jp/e/guideline/testcontent.html)
- [Official sample questions](https://www.jlpt.jp/e/samples/forlearners.html)
- [Official detailed guidebook](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf)
- [Official sample-set composition](https://www.jlpt.jp/e/samples/pdf/sample_kousei.pdf)
- [Scoring sections and pass/fail rules](https://www.jlpt.jp/e/guideline/results.html)
- [Scaled-score explanation](https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf)
- [Official FAQ](https://www.jlpt.jp/e/faq/)
- [N1 listening-count update](https://www.jlpt.jp/e/topics/202208051659677223.html)
- [N4/N5 item-count update](https://www.jlpt.jp/e/topics/202009091599642827.html)

The nominal timed sections implemented are:

| Level | Timed sections |
| --- | --- |
| N1 | Language Knowledge (Vocabulary/Grammar) & Reading — 110 min; Listening — 55 min |
| N2 | Language Knowledge (Vocabulary/Grammar) & Reading — 105 min; Listening — 50 min |
| N3 | Vocabulary — 30 min; Grammar & Reading — 70 min; Listening — 40 min |
| N4 | Vocabulary — 25 min; Grammar & Reading — 55 min; Listening — 35 min |
| N5 | Vocabulary — 20 min; Grammar & Reading — 40 min; Listening — 30 min |

The result grouping also follows the official distinction between timed and
scoring sections: N1–N3 have three 0–60 scoring sections, while N4–N5 combine
language knowledge and reading into one 0–120 scoring section and keep
listening at 0–60.

## What is implemented

- Independent N5, N4, N3, N2, and N1 question modules, loaded only when that
  level is opened.
- Ten-question quick quizzes with a level-specific skill mix and optional
  immediate explanations.
- Representative timed mocks with every official item family used by that
  level, in official family and timed-section order. Each generated form samples
  the official published approximate item count for every family (67 items at
  N5 through 107 at N2).
- Two hundred generated records for every item family supported by each level,
  plus the smaller hand-authored seed set. These are original strings and no
  official or third-party question wording is copied or lightly rewritten, but
  many records are controlled substitutions of the same semantic seed. They
  must not be represented as 200 independently authored questions per family.
- The higher-level comprehension corpus is no longer a shared level template:
  N2/N1 reading uses 88 independently authored passages (eight semantic items
  per supported level/family), and N3/N2/N1 listening uses 224 independently
  authored scripts (sixteen semantic items per supported level/family).
- N5/N4/N3 reading uses 86 scored semantic questions across 80 independently
  authored passages, with at least eight source passages per supported
  level/family. Six representative longer or retrieval sources carry two
  ordered questions through stable, variant-safe passage groups. After the
  independent remediation audit, whitespace-excluded medium-passage ranges are
  N5 272–291, N4 465–528, and N3 378–438 characters; N3 long passages are
  473–619 characters.
- N5/N4 task, key-point, and quick-response listening uses 124 independently
  authored scripts: twenty task, twenty key-point, and twenty-two quick-response
  items per level. These remain below the requested 200 independent semantic
  items per family and are not counted as such.
- Text grammar uses 110 independently keyed blanks across 105 coherent
  passages. Each level includes a two-blank passage stored once with numbered
  blanks; sibling answers are not printed into the shared passage.
- Verbal-expression listening uses 30 original semantic scenes across N5–N3.
  Each has an arrow-marked line illustration, a short spoken setting that does
  not reveal the intended act, and three audio-only candidate utterances.
- Random, balanced ten-question quick quizzes and randomized mock forms.
  Account-scoped history records both rendered IDs and underlying semantic keys
  when each answer is submitted, exhausts different knowledge points/scenarios
  before a second controlled rendering, and only cycles a particular
  skill/family after its relevant pool is exhausted. Creating and abandoning a
  form does not consume questions the learner never reached.
- No correctness disclosure during a mock. Section transitions lock answers;
  full explanations appear only after completion.
- One listening play in mock mode and up to two in quick/practice mode.
  The dialogue/stimulus itself occurs once in the authored sequence; task-based
  and key-point families repeat their question prompt afterward, as documented
  by the official flow. Audio-only answer families keep their text hidden
  during the attempt and speak the choices as part of the audio sequence.
- Sentence-composition questions require the learner to arrange all four
  fragments in quick, weak-area, and mock modes. Kakehashi derives the scored
  `★` fragment from that order. This is an intentional usability adaptation to
  make the rearrangement operable on screen; the paper answer sheet records
  only the numbered fragment at `★`.
- In practice modes only, Japanese in question stems and passages can be
  pressed to open the same WaniKani/JPDB inspector used by songs and videos.
  Tokens have no visual underline and answer choices are never annotated.
- Account-scoped local resume state, including answers, section deadline,
  remaining paused time, and listening play counts.
- Raw performance by skill, official question family, and official scoring
  section; prioritized strongest/weakest areas; sample-size caveats; complete
  missed-question review (including full sentence orders); and weak-area
  practice.
- WaniKani context that compares kanji appearing in the session with the
  learner's Guru-or-higher assignments. This is supporting context, never part
  of the quiz score.

The bank is versioned and separated from the session engine. New questions can
be added without changing timer, storage, scoring, or presentation logic.

## Deliberate limitations and accommodations

### Representative form and editorial status

The timed mode now samples the official published approximate item counts, but
it remains a **Representative Mock Exam** rather than a released or calibrated
JLPT form. Official counts may vary slightly by administration, the live items
are secret, and Kakehashi's originals have no official item parameters.

The expanded bank is generated from authored semantic seeds and controlled
renderings. Automated validators instantiate every record and check schema
integrity, supported family, option uniqueness, stored answer consistency,
listening timelines, sentence-order metadata, semantic provenance, reading
length floors, and minimum record counts. The first 249-record audit is retained
in [`jlpt-bank-audit.md`](./jlpt-bank-audit.md) as a baseline; its major findings
triggered the coherent text-grammar rewrite, illustrated verbal expressions,
independent upper reading/listening corpora, distractor repairs, and semantic
history. Follow-up findings are recorded in
[`jlpt-content-audit-round2.md`](./jlpt-content-audit-round2.md) and
[`jlpt-content-audit-round3.md`](./jlpt-content-audit-round3.md). Focused
reviews of the new lower-level material are in
[`jlpt-lower-reading-audit.md`](./jlpt-lower-reading-audit.md) and
[`jlpt-lower-listening-audit.md`](./jlpt-lower-listening-audit.md). The
level-isolated cross-reviews for the upper-listening expansion are in
[`jlpt-n3-upper-listening-expansion-audit.md`](./jlpt-n3-upper-listening-expansion-audit.md),
[`jlpt-n2-upper-listening-expansion-audit.md`](./jlpt-n2-upper-listening-expansion-audit.md),
and
[`jlpt-n1-upper-listening-expansion-audit.md`](./jlpt-n1-upper-listening-expansion-audit.md).

This still is not equivalent to review by the JLPT organizers or proficient
Japanese educators. Most non-comprehension families contain ten semantic seeds
rather than 200 independent ideas, and most reading passages support one scored
answer. The representative shared-passage groups prove the grouping
architecture, but broader grouped-source coverage and substantially more
independent semantic items remain future editorial work.

### Scoring

Official JLPT results use item-response-theory scaled scores. The algorithm,
item parameters, and calibration population are not public inputs that a local
quiz can reproduce. Kakehashi shows raw accuracy and labels mock results
“estimated/mock performance.” It does not convert raw accuracy to 0–180,
declare pass/fail, apply official sectional pass marks, or predict a CEFR/JLPT
outcome.

### Listening

On web, listening uses the same optional local Supertonic 3 F3 Japanese voice
as Kakehashi's vocabulary context sentences. The roughly 400 MB voice is
downloaded once and retained in the browser; requesting that download does not
consume a listening play. Native uses the same Azure Japanese speech service as
its context sentences. Each authored item supplies a level-appropriate speed
multiplier to the platform's shared voice engine.

This is higher quality and more consistent than the device's generic browser
voice, but it still does not reproduce studio recordings, multiple distinct
speakers, or all official fixed pauses. Transcripts remain hidden during normal
playback and are shown in missed-answer review. If web speech is unsupported or
fails during practice, the interface exposes an explicitly labelled transcript
fallback. Mock transcripts remain hidden on both platforms, including on audio
failure. Failed synthesis releases the reserved play so the learner can retry;
requesting the web voice download never reserves a play.

Official verbal-expression items use an illustration. Kakehashi now renders an
original line illustration with one arrow-marked speaker. The spoken setting
identifies the interaction without repeating the object or action supplied by
the image, followed by `何と言いますか` and three audio-only choices. These
schematic drawings preserve the response construct, but they do not reproduce
the visual richness of studio-authored JLPT artwork. Official integrated
listening can also use multi-question variants, while this bank currently uses
single-question audio-only variants.

### Question selection and repetition

Quick Quiz samples two items from each of the five skill areas, then shuffles
the ten-question form. Weak-area practice samples ten eligible items. Mock mode
samples each family independently to its published approximate count and keeps
families in official order. An injected random source makes the selection logic
deterministically testable.

Answered-question history is stored locally per WaniKani account and JLPT
level. A stable semantic key identifies the knowledge point or scenario beneath
controlled name/date/place renderings. Unpracticed semantic keys outrank
alternate renderings of a practiced key; within a form, semantic groups are
interleaved before any group repeats. Unanswered questions in an abandoned form
remain eligible, while submitted answers immediately enter history. Once the
finite pool is exhausted, selection cycles through it again. Unlimited attempts
are supported, but no finite bank can promise unlimited non-repetition. Browser
storage clearing, another browser/device, or an anonymous account creates a
separate local history.

The session payload carries a centralized bank version. Lower reading and
listening replacement raised it to version 2, the 72-scenario N5/N4 listening
expansion raised it to version 3, and the 112-scenario N3/N2/N1 listening
expansion raised it to version 4. An interrupted older attempt or its history
is rejected instead of resolving stable record IDs against newly authored
Japanese content. Adding the missing thirteenth distinct grammar-form concept
to both N3 and N4 raised it to version 5, preventing a representative mock from
repeating one grammar concept and invalidating earlier numeric renderings whose
seed allocation changed. The reviewed N5–N1 language-knowledge expansions raised
it to version 6 because extending those source arrays likewise changes the
authored item selected by some existing numeric record IDs.

### Pause and resume

The official exam does not pause. Kakehashi offers pause/resume as a practice
and accessibility accommodation, labels it as non-official before the mock and
again in the confirmation dialog, and freezes the stored deadline without
granting extra time. Closing or reloading without choosing Pause does not reset
the running deadline.

### Timings

The language-section timers use the official nominal allowances independently
for N1–N5. Official guidance notes that listening duration can vary slightly
with recorded material; Kakehashi uses the published nominal value.

## Quality gates

Automated checks enforce the following for every bank:

- Every question belongs to the selected level and to an item family officially
  used at that level.
- Every official item family for the level is represented.
- Every supported family contains at least 200 generated records, with semantic
  provenance that prevents those renderings from being counted as 200 distinct
  authored ideas.
- Quick selection is balanced across all five skills, randomized, and
  unseen-first; mock selection matches the published approximate family quotas.
- Question IDs and answer IDs are unique, option labels do not repeat, and
  exactly one stored option is correct.
- All listening families have scripts; audio-only three-choice and four-choice
  variants contain spoken choices.
- N2/N1 upper reading and N3/N2/N1 upper listening retain at least eight
  independently authored semantic items in every supported family.
- Every supported generated family now retains at least eight underlying
  semantic items; common language-knowledge families retain ten, text grammar
  retains at least twenty, and lower reading retains eight distinct source
  passages per level/family.
- Every verbal-expression item has an arrow-marked illustration, three spoken
  choices, and a spoken setup that leaves answer-bearing scene information to
  the image.
- Every question has a non-empty explanation.

Engine and interface tests cover answering, complete four-fragment ordering in
practice and mock, the derived `★` response, scoring, randomized selection, unseen-first cycling,
official timer setup, section expiry, section locks, pause/resume, listening
play state, account-scoped session/history storage, weak-area practice,
keyboard controls, feedback suppression, word-inspector boundaries, and
results review. Responsive behavior is checked by component contracts and a
desktop/mobile browser pass before release.

Before adding questions, review them against the official sample for that exact
level and item family, then separately check naturalness, level fit, answer
uniqueness, and distractor plausibility. Structural tests cannot replace that
editorial review.
