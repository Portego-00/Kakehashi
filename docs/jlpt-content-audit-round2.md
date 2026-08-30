# JLPT content audit — round 2

_Audit date: 2026-08-29. Scope: generated `text-grammar` at N5–N1 and generated
`listening-verbal` at N5–N3. The independently authored upper-listening pack is
excluded. Rubric: [JLPT authentic-item authoring rubric](./jlpt-authentic-item-rubric.md)._

> **Historical pre-remediation verdict.** The canonical two-blank passages,
> distractor rewrites, level-specific scenarios, library/collision scene cues,
> and non-leaking spoken setups described as missing below were implemented
> after this audit. Round 3 re-audits that resulting state. The absent
> proficient-human Japanese approval remains current.

## Verdict

**Do not release these banks as authentic mock-test content yet.** The sampled
text-grammar language is strongest at N2/N1, but eleven of fifty reviewed seeds
fail the natural/plausible-distractor gate. More importantly, the current
multi-blank representation does not reproduce the official passage presentation.
All thirty verbal-expression scenarios fail the rubric's meaning-bearing-image
gate because the spoken situation supplies enough information to answer with
the illustration hidden.

`Pass`, `caveat`, and `fail` below describe the inspected content itself. Shared
bank-level release blockers are listed separately, so a content `pass` is not a
claim that the record is human-approved or ready to ship.

## Evidence and method

- Reconstructed each sampled text with all four alternatives and checked
  passage coherence, discourse dependence, one-best-answer risk, distractor
  naturalness, and independent level fit. Ten semantically distinct records
  were reviewed at every level: 50 of 110 text-grammar seeds.
- Reviewed all ten underlying verbal-expression scenarios at N5, N4, and N3:
  30 of 30. Inspection included the situation, all three utterances, scene
  descriptor, arrow target, generated script order, and mock answer rendering.
- Ran:
  `vitest run text-grammar.test.ts verbal-expression.test.ts generated-bank.test.ts JlptVerbalScene.test.tsx`.
  All **46 automated tests passed**. Those tests establish counts, identifiers,
  option counts, basic passage shape, one-arrow rendering, script order, and
  audio-only choice display. They do not establish Japanese naturalness,
  distractor plausibility, semantic image dependence, or human level approval.
- This is an independent editorial/AI audit, not a native-speaker panel or a
  psychometric trial. It must not be used as the rubric's required proficient
  Japanese human approval.

## Counts

### Text grammar

| Level | Reviewed | Pass | Caveat | Fail |
| --- | ---: | ---: | ---: | ---: |
| N5 | 10 | 4 | 2 | 4 |
| N4 | 10 | 7 | 1 | 2 |
| N3 | 10 | 6 | 1 | 3 |
| N2 | 10 | 8 | 0 | 2 |
| N1 | 10 | 10 | 0 | 0 |
| **Total** | **50** | **35** | **4** | **11** |

### Verbal expressions

| Level | Reviewed | Pass | Caveat | Fail |
| --- | ---: | ---: | ---: | ---: |
| N5 | 10 | 0 | 0 | 10 |
| N4 | 10 | 0 | 0 | 10 |
| N3 | 10 | 0 | 0 | 10 |
| **Total** | **30** | **0** | **0** | **30** |

The verbal failures are not failures of the arrow or audio sequence: those
mechanics pass. They are failures of the official construct as operationalized
by the rubric—the illustration must contribute information needed to choose the
utterance.

## Text-grammar findings

### N5

- **Pass:** `n5-tg-rain-plan`, `n5-tg-cooking-order`,
  `n5-tg-small-room`, `n5-tg-dog-weather`.
- **Caveat:** `n5-tg-birthday-gift` has a second narratively possible route:
  after `でも、青いかさは売り切れていました`, the recipient could still
  receive a blue umbrella later from another source. The key remains more
  direct, but the distractor should rule out that reading. `n5-tg-missed-bus`
  is uniquely keyed, but the N5 distractor `その一方で` is not calibrated to
  the same basic-expression boundary as the item.
- **Fail:** `n5-tg-library-reference` contains the unnatural/unclear distractor
  `その本は全部ほかの人が借りていました`. `n5-tg-book-reference` offers
  unrelated shop, train, and swimming statements. `n5-tg-lost-key` offers a
  book purchase and umbrella statement that are not credible continuations.
  `n5-tg-train-reference` includes `二つの電車は同じ色です` immediately
  after naming a blue and a red train. These fail the rule that every option be
  a natural, initially plausible continuation rather than a giveaway.

### N4

- **Pass:** `n4-tg-event-change`, `n4-tg-two-routes`,
  `n4-tg-volunteer-solution`, `n4-tg-reservation-condition`,
  `n4-tg-summary-rule`, `n4-tg-wrong-size`, `n4-tg-lunch-choice`.
- **Caveat:** `n4-tg-delayed-train` is uniquely keyed and natural, but
  `それにもかかわらず` is a noticeably heavier distractor than the otherwise
  basic N4 passage and distractor set.
- **Fail:** `n4-tg-lost-wallet-action` and `n4-tg-repair-not-replace` have good
  keys, but their alternatives are unrelated events about a train, lunch,
  travel, or opening hours. The answer is exposed without evaluating nuanced
  passage flow.

### N3

- **Pass:** `n3-tg-attendance-and-satisfaction`,
  `n3-tg-shared-bicycles-result`, `n3-tg-online-convenience-condition`,
  `n3-tg-note-purpose-summary`, `n3-tg-weather-cancellation-cause`,
  `n3-tg-provisional-use`.
- **Caveat:** `n3-tg-flexible-hours-addition` uses `一方で` for two positive
  uses of flexible schedules. A contrast between later and earlier starts can
  be inferred, but it is not explicitly established; the relation reads partly
  as addition and should be sharpened before approval.
- **Fail:** `n3-tg-meeting-shortage-response`,
  `n3-tg-quiet-space-persistence`, and `n3-tg-feedback-reference` each have a
  coherent key but mostly topic-breaking distractors. Examples include a
  meeting that supposedly ended last month, borrowing every library book, a
  train delay, and a staff member's lunch. These test rejection of nonsense,
  not suitability within a coherent text.

### N2

- **Pass:** `n2-tg-numbers-and-access`,
  `n2-tg-efficiency-and-explanation`, `n2-tg-public-data-condition`,
  `n2-tg-recording-purpose`, `n2-tg-remote-work-qualification`,
  `n2-tg-museum-congestion-response`, `n2-tg-failed-program-learning`,
  `n2-tg-choice-architecture`.
- **Fail:** `n2-tg-pilot-conclusion` makes every distractor an implausible
  overstatement or unrelated claim (`休日の調査は今後も必要ない`,
  `必ず失敗`, or a supposed ban on measuring travel time).
  `n2-tg-public-comments-reference` similarly uses no comments, unrelated
  travel, and already-completed construction as transparent contradictions.

### N1

- **Pass:** `n1-tg-transparency-limit`, `n1-tg-measurement-effect`,
  `n1-tg-complete-agreement`, `n1-tg-automation-accountability`,
  `n1-tg-exception-policy`, `n1-tg-invisible-maintenance`,
  `n1-tg-silence-in-meetings`, `n1-tg-temporary-measure`,
  `n1-tg-choice-and-default`, `n1-tg-retrospective-evaluation`.
- The ten sampled N1 records use mature, coherent argumentation and have one
  defensible key. Their full-sentence distractors generally represent competing
  but passage-incompatible theses rather than unrelated noise. This does not
  approve the twelve unreviewed N1 seeds.

### Shared presentation blocker

Each level currently has 22 seed records but only 21 passage groups: twenty
single-blank groups and one nominal two-blank group. In that two-blank group,
each stored passage contains only the current `＿＿`; the other blank is already
filled with its keyed answer. The generator then emits the two records as
separate one-blank screens. This differs from the official numbered-multi-blank
passage presentation and can reveal one blank's answer while the learner is
answering the other. The current validator explicitly requires exactly one
`＿＿` per rendered question, so it protects the implementation from breakage
but also preserves this authenticity defect.

The data/UI model should retain one canonical passage with all numbered blank
positions and independent answer rows. No other blank's key should be inserted
before the relevant group is completed.

## Verbal-expression findings

All runtime semantic IDs `n5:listening-verbal:scenario-1` through
`scenario-10`, the equivalent ten N4 IDs, and the equivalent ten N3 IDs were
reviewed.

### What passes

- The component draws one arrow at the configured target speaker.
- Generated audio is ordered `situation → 何と言いますか → 1 → 2 → 3`.
- The mock UI displays only neutral choice numbers while the Japanese choices
  remain audio-only.
- Correct utterances are generally grammatical, clear, and appropriate for the
  stated goal.

### Systemic failure: the image is decorative

Every situation line explicitly names the speaker's complete communicative
goal, object, and usually addressee. The same key is therefore obvious with the
illustration hidden. Examples:

- `n5:listening-verbal:scenario-5` says the person wants a nearby stranger to
  take their photo.
- `n4:listening-verbal:scenario-8` says a friend is carrying a heavy box and
  the speaker wants to help.
- `n3:listening-verbal:scenario-10` says the speaker found an umbrella and is
  handing it to station staff.

The image merely repeats those facts. This violates the meaning-bearing-scene
gate and is why all thirty records receive `fail`, despite correct arrow and
audio mechanics. Rewrite the audio/scene pair so that a visible relationship,
object, direction, location, or action is required to identify the best
utterance.

`n4:listening-verbal:scenario-6` illustrates the problem especially clearly:
the data uses a generic `classroom` backdrop and a document prop for a library
voice-volume interaction. Nothing in the image establishes a library or a loud
speaker. `n3:listening-verbal:scenario-4` likewise uses a generic street and
sign that do not depict the stated collision.

### Distractor and level-fit failures

- N5 `scenario-4` uses `お水がありました` and N5 `scenario-6` uses
  `駅はここでした`; both are conspicuously non-responsive in the presented
  interaction rather than plausible competing utterances.
- N4 `scenario-5` uses `遅れたほうがいいです` as an apology distractor, and
  N4 `scenario-10` uses `ごちそうさまでした` before resolving a wrong order.
  They are immediate semantic giveaways.
- N3 `scenario-4` offers `ぶつかっていただいて、助かりました` and
  `ぶつかってもかまいません`; neither is a credible alternative after
  colliding with a stranger. N3 `scenario-5` and `scenario-8` similarly rely
  on conspicuous voice/direction or tense errors rather than nuanced pragmatic
  competition.
- Several level progressions are the same semantic item with a politeness swap:
  the photo request is N5 `scenario-5`, N4 `scenario-3`, and N3 `scenario-1`;
  the machine-help request is N5 `scenario-3`, N4 `scenario-2`, and N3
  `scenario-5`; the offered train seat is N4 `scenario-1` and N3 `scenario-3`.
  This does not demonstrate independent level authoring. N4/N3 need distinct
  relationships and inference demands, not only `ください → もらえませんか →
  いただけませんか`.

## Release blockers

1. **Rebuild text-grammar passage groups.** Store and render all numbered
   blanks in one canonical passage without inserting sibling answers. Retest
   group scoring and review all blanks together.
2. **Rewrite all thirty verbal-expression scenarios.** Make the original
   illustration necessary to identify the target utterance while retaining one
   arrow and the verified three-choice audio order.
3. **Replace giveaway distractors.** At minimum revise all eleven failed and
   four caveated sampled text-grammar records and the verbal records called out
   above. Then complete a proficient-human review of all 110 text seeds; the
   unreviewed sixty cannot be inferred to pass from this sample.
4. **Author levels independently.** Replace the repeated photo, machine, and
   seat politeness ladders with genuinely different N4/N3 situations and
   level-specific pragmatic demands.
5. **Add the required reviewer record.** The seeds do not store
   `officialPurpose`, `levelRationale`, per-distractor rationales, originality
   attestation, language reviewer, review date, or approval status. Do not label
   these banks `human-approved` until a proficient Japanese reviewer records
   those decisions.
6. **Extend validation beyond shape.** Keep the passing structural tests, but
   add review assertions/checklists for canonical multi-blank presentation,
   image necessity, level-independent semantic scenarios, and editorial status.
