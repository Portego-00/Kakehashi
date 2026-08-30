# JLPT content audit, round 3

_Audit date: 2026-08-29. This is a bounded AI content review, not approval by
the JLPT organizers, a psychometric validation, or a native/proficient-Japanese
editorial sign-off._

> **Remediation after this audit.** The three P1 verbal items were revised with
> explicit heat/window cues, a visible document-holder interaction, and a
> calendar change diagram; the weak N4/N3 distractors listed below were also
> replaced. The N4/N3 grouped passages were rewritten to remove the alternative
> causal reading, the N2 bulky-waste evidence/explanation now includes the
> manager-first condition, and the loading label now says “generated beta
> question bank.” Focused tests and TypeScript pass after these changes. The P0
> missing proficient-human approval remains unresolved and still controls the
> release decision.
> A final bounded re-audit of every listed remediation found the revised keys
> uniquely best and no remaining P1/P2 item issue in that scope; this remains
> AI review and does not change editorial approval status.

## Scope and decision rule

This pass applied the local
[`jlpt-authentic-item-rubric.md`](./jlpt-authentic-item-rubric.md) to:

- all 30 N5-N3 verbal-expression semantic items and their rendered SVG/audio
  contract;
- every two-blank text-grammar group (one group at each of N5-N1); and
- a stratified 22-item N2/N1 reading sample: two semantic items from every
  available level/family.

The governing official purposes are the current
[JLPT item-type matrix](https://www.jlpt.jp/e/guideline/testsections.html), the
[official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
and the official N1-N5 purpose sheets linked from the local rubric. `Pass`
means no defensible second key or material presentation defect was found in
this review. `Caveat` means usable but editorially weaker. `Fail` means revise
before release. P0 is a release-gate failure, P1 is answer/construct critical,
P2 is substantive but localized, and P3 is polish or an explicitly documented
accommodation.

## Release blockers

1. **P0 — no human-approved coverage.** The audited generated questions carry
   `editorialStatus: "machine-validated"`. The repository's own
   [`jlpt-editorial-workflow.md`](./jlpt-editorial-workflow.md) requires current
   `human-approved` coverage for every production semantic item. This AI audit
   must not promote any item to that status.
2. **P1 — three verbal illustrations do not supply enough information for a
   unique speech act.** Revise
   `n5:listening-verbal:scenario-7`
   (`n5-generated-listening-verbal-007`),
   `n4:listening-verbal:scenario-4`
   (`n4-generated-listening-verbal-004`), and
   `n4:listening-verbal:scenario-7`
   (`n4-generated-listening-verbal-007`). Details are below.
3. **P1 — two grouped text-grammar keys remain ambiguous.** Revise
   `n4-tg-clinic-notice-blank-1` and
   `n3-tg-training-review-blank-1`; in each passage `そのため` is a defensible
   causal alternative to the keyed `ところが`.
4. **P1 — one user-facing phrase overstates editorial status.**
   `JLPTWorkspace.tsx` calls the corpus “the reviewed question bank,” while
   provenance and the editorial workflow correctly say it is machine-validated
   beta content. “Generated beta question bank” would preserve the otherwise
   honest disclosure.

## Results at a glance

| Audited family | Pass | Caveat | Fail | Notes |
| --- | ---: | ---: | ---: | --- |
| N5 verbal expression (10/10 semantic items) | 8 | 1 | 1 | Format passes; one ambiguous scene and one weak glass drawing |
| N4 verbal expression (10/10) | 6 | 2 | 2 | Two ambiguous scenes; two giveaway distractors |
| N3 verbal expression (10/10) | 9 | 1 | 0 | Strongest level separation; one weak distractor set |
| N5-N1 multi-blank text grammar (5/5 groups) | 3 | 0 | 2 | N4 and N3 blank 1 fail unique-key review |
| N2 reading (10/40 semantic items sampled) | 9 | 1 | 0 | One explanation/evidence omission |
| N1 reading (12/48 semantic items sampled) | 12 | 0 | 0 | No sampled content blocker found |

These content counts are independent of the P0 human-approval blocker.

## Verbal-expression findings

### Presentation and audio contract

All semantic IDs in the ranges
`n5:listening-verbal:scenario-1` through `scenario-10`,
`n4:listening-verbal:scenario-1` through `scenario-10`, and
`n3:listening-verbal:scenario-1` through `scenario-10` were inspected.
Structurally, all 30 now follow the official family: one arrow-marked
illustration, a spoken setting/speaker line, one `何と言いますか`, then three
spoken choices. During the attempt the UI displays only `Choice 1`-`Choice 3`.
The local TTS receives that complete sequence in one play. This is a material
improvement over a generic instruction with no spoken context.

The public samples establish an illustration-plus-circumstances task; they do
**not** establish the repository test's blanket rule that no answer-bearing
object noun may occur in the spoken setup. That is a local authoring heuristic,
not an official JLPT constraint. It should not prevent a future author from
adding a short clarifying circumstance when a schematic drawing cannot convey
it reliably.

### Exact content issues

- **P1 fail — `n5:listening-verbal:scenario-7` / generated `-007`.** A home,
  neutral friend, closed-looking window, and pointing speaker do not show that
  the room is hot or that the speaker intends to act personally. Both keyed
  `窓を開けてもいいですか` and distractor `窓を開けてください` are defensible.
- **P1 fail — `n4:listening-verbal:scenario-4` / generated `-004`.** The generic
  office/document/pointing scene does not render “out of reach.” Keyed
  `その資料を取ってもらえますか` and `その資料を取ってもいいですか` can both fit
  the visible situation.
- **P1 fail — `n4:listening-verbal:scenario-7` / generated `-007`.** A reception
  counter and generic sign do not encode an existing appointment or a desired
  time change. Both `予約の時間を変えてもらえますか` and
  `予約の時間が変わりましたか` remain plausible intentions.
- **P2 caveat — `n4:listening-verbal:scenario-1` / generated `-001`.**
  `この席に座ったことがあります` is grammatical but an obvious non-response,
  not a plausible same-level distractor.
- **P2 caveat — `n4:listening-verbal:scenario-6` / generated `-006`.**
  `もっと大きな声で話してもらえますか` in a visibly quiet library is too easy
  to eliminate.
- **P2 caveat — `n3:listening-verbal:scenario-8` / generated `-008`.**
  `今、少し時間をいただきました` and `今、時間がなくてもかまいません` are weak
  or pragmatically strained responses, so the polite availability check is a
  giveaway rather than a strong N3 contrast.
- **P3 caveat — `n5:listening-verbal:scenario-4` / generated `-004`.** The
  description says the glass is empty, but the SVG glass contains a horizontal
  line that reads as liquid. The key remains best, but the visible cue and the
  accessible description are not fully equivalent.

The English SVG `<title>` often carries details that the marks do not visibly
encode (for example “out of reach,” “not the order,” or “found nearby”). It is
appropriate for alternative text to convey image meaning, but it should be an
equivalent description, not hidden semantic repair for a weaker sighted image.
This inequivalence is what makes the three P1 scenes fail.

**P3 documented accommodation:** if audio playback fails, the attempt renderer
prints the full script, including normally audio-only choices. This prevents a
stranded session and is disclosed in the implementation notes, but the
resulting attempt is no longer format-equivalent to the official listening
construct.

## Multi-blank text grammar

The rendered contract now passes: sibling questions share one complete passage
with both `［1］＿＿` and `［2］＿＿`, neither key is inserted into the displayed
passage, prompts identify the target blank, and mock sampling keeps the sibling
questions together in blank order.

- **Pass — `n5-tg-class-trip`**
  (`n5-tg-class-trip-blank-1/-2`; first renderings
  `n5-generated-text-grammar-021/-022`). `でも` marks action despite rain;
  `それで` links the rain stopping to eating outside. The alternatives are
  materially weaker in the complete passage.
- **P1 fail — `n4-tg-clinic-notice`**
  (`n4-tg-clinic-notice-blank-1`, first rendering `...-021`). The sequence
  “予約なしでも参加できた。そのため、最近は待つ人が増え…” is a natural causal
  reading. The keyed `ところが` is also natural, so blank 1 has two defensible
  answers. Blank 2 (`そこで`) passes.
- **P1 fail — `n3-tg-training-review`**
  (`n3-tg-training-review-blank-1`, first rendering `...-021`). Shortening the
  training can naturally cause weak understanding of exceptions, making
  `そのため` as defensible as keyed `ところが`. Blank 2 (`そこで`) passes.
- **Pass — `n2-tg-pilot-access`**
  (`n2-tg-pilot-access-blank-1/-2`; first renderings `...-021/-022`).
  `とはいえ` and `そこで` uniquely express qualification and response.
- **Pass — `n1-tg-evidence-update`**
  (`n1-tg-evidence-update-blank-1/-2`; first renderings `...-021/-022`).
  `とはいえ` and `したがって` preserve the passage's mature concession and
  conclusion without a comparably defensible alternative.

## N2/N1 reading sample

The sample preserves source integrity: integrated items retain two separately
labelled sources, all keyed evidence fragments occur in the stored sources,
the builder renders those sources without substituting a lower-level template,
and the sample shows real differentiation. N2 items use concrete notices,
comparisons, and clearly developed everyday arguments; N1 moves toward
compressed abstraction, stance, synthesis across authors, and extended
argument. No sampled item copied or identified an official passage, but this
bounded inspection cannot prove corpus-wide originality.

### N2 (10 sampled)

Pass:
`N2-short-flex-hours-overlap`,
`N2-short-museum-photo-exception`,
`N2-mid-limited-menu-food-waste`,
`N2-mid-meeting-record-purpose`,
`N2-integrated-coworking-call-evening`,
`N2-integrated-book-review-practical-change`,
`N2-thematic-questioning-skill`,
`N2-thematic-public-benches-staying`, and
`N2-info-training-center-certificates`.

**P2 caveat — `N2-info-bulky-waste-moving-day`.** The keyed option correctly
starts by checking the apartment's搬出場所 with the manager, then requests the
free photo screening. The source supports both steps and the key is unique, but
the stored `evidence` and explanation cite only reusable-wood eligibility and
the three-day review; they omit the manager-first condition that makes the
word `まず` in the question fully justified.

### N1 (12 sampled, all pass)

`N1-short-metric-behavior-shift`,
`N1-short-archive-selection-meaning`,
`N1-mid-museum-replica-authenticity`,
`N1-mid-institutional-apology-repair`,
`N1-long-policy-productive-uncertainty`,
`N1-long-fiction-memory-photograph`,
`N1-integrated-ai-minutes-correctability`,
`N1-integrated-museum-restitution-relationship`,
`N1-thematic-metric-becomes-target`,
`N1-thematic-data-stewardship`,
`N1-info-archive-restricted-records`, and
`N1-info-public-consultation-accessibility`.

Each sampled key is directly supported, the distractors contradict or
overstate the source rather than relying on malformed Japanese, and the family
purpose is visible in the required operation (local detail, main point,
extended inference, synthesis, thematic argument, or constrained lookup).

## Provenance and randomization claims

The current implementation and main documentation are materially honest:

- N2/N1 reading has eight semantic items per level/family (88 total), and
  N5-N3 verbal expression has ten per level. The 200 bank entries per family
  are labelled controlled renderings, not 200 independent authored ideas.
- Generated items expose stable semantic keys, variant indices,
  `controlled-variant` authorship, and `machine-validated` status.
- Selection interleaves semantic groups and gives unseen semantic keys priority
  before alternate renderings; local account/level history then cycles after
  the finite pool is exhausted. The hub says “200 generated renderings” and
  labels recurring variants beta.
- The implementation document explicitly says unlimited attempts cannot mean
  unlimited non-repetition in a finite bank.

The one inconsistent claim is the P1 loading message “reviewed question bank”
noted above. No release material should imply native, human, JLPT-organizer, or
psychometric approval.

## Validator evidence and residual limits

The focused suite passed on 2026-08-29: **7 files, 83 tests** covering verbal
scene/audio structure, scene rendering, grouped text grammar, N2/N1 reading
source boundaries and length bands, diversity/provenance, semantic
randomization, and session presentation.

Those validators establish data and rendering invariants; they cannot establish
Japanese naturalness, a unique pragmatic answer, CEFR/JLPT calibration,
originality against the universe of published material, or accessibility
equivalence of a schematic illustration. The 22 reading items above are a
stratified sample, not a review of all 88. A proficient Japanese editor familiar
with each exact JLPT level must adjudicate all production semantic items, and a
second editor should review N1 long/integrated inferences as required by the
editorial workflow.
