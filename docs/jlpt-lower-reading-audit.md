# JLPT N5-N3 lower-reading content audit

_Audited 2026-08-29. Scope: all 86 scored semantic questions over 80
independently authored passages in
`web/src/features/jlpt/questions/generated/lower-reading-seeds.ts`._

This audit applies the official-source contract and local gates in
[`jlpt-lower-reading-research.md`](./jlpt-lower-reading-research.md). It is an
independent AI review, **not native-Japanese or human JLPT editorial approval**.
No item may be marked `human-approved` from this work.

## Evidence and method

Every question was reconstructed against all four options and its finalized
source body, including supplemental source blocks. The review checked natural
Japanese, one best answer, evidence coverage, distractor plausibility, family
purpose, level fit, information-condition logic, and all six shared-passage
groups. The official family/length contract is:

- N5: short ~80 characters, mid ~250, information retrieval ~250.
- N4: short ~100-200, mid ~450, information retrieval ~400.
- N3: short ~150-200, mid ~350, long ~550, information retrieval ~600.

These are approximate, not exact cutoffs
([N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf),
[N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)). N3 mid items
must test key wording or causal relations, and N3 long items summary or logical
development; length alone cannot establish family fit
([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html)).

The public 2018 booklets were used only as a form/originality red-flag screen.
They demonstrate one-of-four response blocks and shared longer sources, but do
not define permanent counts or authorize close adaptation
([official workbook index](https://www.jlpt.jp/e/samples/sampleindex.html),
[official sample caveat](https://www.jlpt.jp/e/samples/forlearners.html)).

## Inventory: passages, questions, and rendered records

| Level | Family | Semantic questions | Independent passages | Character range | Official approximate target |
| --- | --- | ---: | ---: | ---: | ---: |
| N5 | Short | 8 | 8 | 68-93 | ~80 |
| N5 | Mid | 9 | 8 | 153-165 | ~250 |
| N5 | Information retrieval | 8 | 8 | 193-289 | ~250 |
| N4 | Short | 8 | 8 | 128-142 | ~100-200 |
| N4 | Mid | 9 | 8 | 191-233 | ~450 |
| N4 | Information retrieval | 9 | 8 | 307-369 | ~400 |
| N3 | Short | 8 | 8 | 157-181 | ~150-200 |
| N3 | Mid | 9 | 8 | 247-285 | ~350 |
| N3 | Long | 9 | 8 | 473-619 | ~550 |
| N3 | Information retrieval | 9 | 8 | 472-528 | ~600 |

This is exactly **80 passages and 86 semantic questions**. Six passages each
carry a second scored question: one N5 mid; one N4 mid; one N4 information;
one N3 mid; one N3 long; and one N3 information item. The paired questions
share the same finalized source object and use ordered indices 1 and 2.

Each family is also expanded to **200 rendered database records**. Those are
not 200 passages or 200 independently authored questions: every family still
contains eight distinct passage bodies, and either eight or nine semantic
questions. The renderer repeats them while changing record IDs and option
order. Product copy, randomization claims, and provenance must preserve this
distinction.

## Per-level and family verdicts

| Level | Family | Verdict | Audit result |
| --- | --- | --- | --- |
| N5 | Short | **Pass after repair** | Eight concrete notices/messages fall around the official short scale. Keys and evidence are unique; one renewal notice needed natural rewriting. |
| N5 | Mid | **Fail - P2** | The event chains are natural and uniquely keyed, including the shared lunch-plan questions, but all passages are only 153-165 characters versus the official ~250 target. Several questions are local-detail lookups rather than whole-passage comprehension. |
| N5 | Information retrieval | **Pass after repair, size caveat** | Multi-condition schedules and notices work. Fish-menu ambiguity and metadata/naturalness defects were repaired. The 193-character minimum is short but the family centers near the official scale. |
| N4 | Short | **Pass after repair** | Length and familiar-text fit are sound. Five malformed or giveaway distractors were replaced with natural misreadings. |
| N4 | Mid | **Fail - P1** | The prose has coherent cause/result structure, but 191-233 characters is roughly half the official ~450 scale. The bank does not currently reproduce N4 mid-size reading load. |
| N4 | Information retrieval | **Pass after repair, size caveat** | Condition logic is generally strong. A vegetarian-course second key, a missing age premise, unnatural overnight wording, and a family-pass contradiction were repaired. |
| N3 | Short | **Pass after repair** | All eight fit the official description/direction purpose and 150-200 scale. Two questions needed complete/clear task wording. |
| N3 | Mid | **Fail - P2** | The passages genuinely use causes, contrasts, and writer purpose, but average 260 characters against ~350 and most distractor sets are much less plausible than their keys. |
| N3 | Long | **Fail - P2** | Length and logical development are strong, and both shared repair-cafe questions are consistent. However, most alternatives are absolute or absurd reversals, making sophisticated passages substantially easier than authentic N3 long items. |
| N3 | Information retrieval | **Pass after repair, size caveat** | The tables require several conditions and survive shared-source review. Schedule overlap, closure-day ambiguity, and a placement premise were repaired. Sources run 472-528 versus official ~600 but retain meaningful retrieval load. |

This AI review found no unresolved second key after the repairs below. The
failing family verdicts concern official scale and distractor authenticity,
not stored answer corruption; proficient human review remains required.

## P1 defects repaired

- `N5-info-restaurant-fish-free-lunch`: course D originally listed no fish,
  making both C and D fit the fish-free 800-yen request. D now explicitly
  contains tuna salad, and the explanation identifies that condition.
- `N4-info-cooking-class-vegetarian`: beginner course A originally satisfied
  the weekend/no-meat-or-fish conditions as written, creating a second answer
  beside B. Its ingredient list now includes ham.
- `N4-info-museum-family-pass`: the base family pass covered two adults plus
  three children, while its supplemental registration block limited the pass
  to four people. The shared finalized source now consistently permits five.
- `N3-short-lecture-seat-release`: the key mentioned timely check-in but omitted
  the separately required receipt screen/printout. The complete requirement and
  both evidence fragments are now in the keyed option.
- `N3-info-festival-volunteer-shifts`: the two “consecutive” guide shifts
  overlapped for 30 minutes. They now meet at 12:00 without overlap; the stored
  evidence was updated.
- `N3-info-coworking-evening-room`: a newly added supplemental source closes on
  the first Sunday, while the question gave only “next week.” Specifying Tuesday
  removes the unresolved closure possibility.
- `N3-info-adult-course-path`: lacking last year's certificate did not prove a
  learner was taking the course for the first time, yet placement was keyed as
  required. The scenario now explicitly says the learner is new.

## P2 defects repaired

- `N5-short-library-renewal-phone`: replaced unnatural `もう日がすぎた本` and
  vague “borrow longer” wording with a natural return-date extension rule.
- `N5-mid-wallet-found-process`: replaced `同じさいふ` with the intended
  anaphoric `そのさいふ`.
- `N5-info-library-sunday-return`: renamed to
  `N5-info-library-monday-return`, matching its Monday scenario.
- `N5-info-bicycle-three-hour-return`: changed “which one do they buy?” to the
  natural rental-plan question “which course do they choose?”
- `N4-info-volunteer-evening-books`: added the source-wide age-18 premise to
  the candidate scenario.
- `N4-info-camping-two-night-rental`: replaced the ambiguous hiragana
  `二ばんとまり` with natural `二泊して`.
- `N3-short-book-exchange-condition`: `交換できる本がなかった人` could mean a
  person brought no eligible book. The question now asks about failing to find
  a desired book, matching its evidence and explanation.
- `N4-short-project-file-and-paper`, `N4-short-cleanup-light-rain`,
  `N4-short-restaurant-late-arrival`, `N4-short-office-key-return`, and
  `N4-short-train-lost-item-contact`: replaced category errors or unnatural
  actions with grammatical alternatives tied to a plausible timing, medium,
  or location misreading.

ID-specific regression assertions cover every repaired source, question,
option, explanation, evidence fragment, and stable semantic ID.

## Unresolved P1 findings

### P1: N4 mid-size sources do not meet the official family scale

All eight N4 mid passages are 191-233 characters, while the official purpose
sheet describes approximately 450 characters. They are well-formed compact
explanations, but are closer in load to N4 short/N3 short material than to the
official N4 mid-size family. The local 180-character test floor must not be
described as official. Each passage needs substantive, coherent development
and group-level re-review; padding or vocabulary inflation would not fix the
construct.

### P1: 200 rendered records do not satisfy a 200-original-item claim

Across this pack there are 80 passages, not 200 passages per family. Reordering
four choices does not produce a new reading item. The current renderer is
acceptable as a deterministic record generator only if UI and documentation
state the true semantic inventory. It does not meet a requirement for 200
nonrepeating, independently authored questions per level and type.

## Unresolved P2 findings

### P2: N5 and N3 mid-size passages remain short

N5 mid sources cluster at 153-165 characters instead of ~250. N3 mid sources
cluster at 247-285 instead of ~350. Their discourse is coherent, but the
reduced length lowers reference tracking and whole-text demand. Expansion must
add meaningful relations or evidence, then revalidate both questions in any
shared group.

### P2: N3 mid and long distractors underuse the passage

The keys generally paraphrase the conclusion accurately, but many distractors
are conspicuous extremes or actions the passage explicitly rejects. Examples:

- `N3-mid-museum-audio-choice` contrasts flexible depth with forcing everyone
  to listen for two hours or fixing the route at the entrance.
- `N3-mid-comment-delay-reflection` contrasts self-review with moderators
  rewriting everything, deleting everything, or banning strong opinions.
- `N3-long-street-tree-aftercare` offers planting no trees, needing no shade,
  or hiding every sign.
- `N3-long-public-map-missing-reports` offers treating silence as no problem,
  trusting only smartphones, or deleting all central reports.
- `N3-long-library-of-things-care` offers automatic replacement, skipping
  inspection, or abandoning non-book loans.

These are natural sentences but weak competing interpretations. Rewrite them
as partial summaries, incorrect scopes, reversed causal emphasis, or positions
supported by an earlier paragraph but rejected by the conclusion. Review the
whole four-option set together; changing isolated words is insufficient.

### P2: information sources sit toward the low side of “approximately”

N4 information sources range 307-369 against ~400, and N3 472-528 against
~600. They currently require real condition combination and are not decorative,
so this audit does not fail them on length alone. Future expansion should move
them closer to the official scale through relevant exceptions or source
structure, not filler.

## Shared-passage and originality findings

All six shared groups pass source integrity after repair:

- N5 lunch plan: shopping choice plus delivery time/place.
- N4 reusable cup: successful change plus original inconvenience.
- N4 meeting-room notice: paid local class plus company capacity/surcharge.
- N3 shared tools: successful location system plus failed purchase response.
- N3 repair cafe: program purpose plus treatment of unrepairable items.
- N3 training certificate: full route plus online non-substitution.

Each pair sees the same finalized source, has distinct evidence, and remains
uniquely keyed when the other question is considered.

No copied wording or close adaptation was established in the limited
first-party public-sample comparison. The N5 transfer table necessarily shares
the official information-retrieval mechanic of applying a travel need to
routes, but uses independently framed places, times, constraints, and answers.
This screen is not proof against every unreleased administration, and no
third-party item bank was searched or copied.

## Verification

- Focused lower-reading and passage-length suites: **18/18 tests passed**.
- Every evidence fragment occurs in the finalized displayed source.
- All 86 semantic IDs and 80 passage IDs are globally unique and structurally valid.
- Shared groups reuse identical source objects with ordered indices 1 and 2.
- ID-specific repair regression test: **passed**.
- Focused ESLint: **passed**.
- Workspace TypeScript check (`tsc --noEmit`): **passed**.
- Generated-bank integration suite: **16/16 tests passed**.

## Remediation re-audit — 2026-08-29

This re-audit supersedes the earlier mid-length and N3-distractor findings for
the affected items only. It reconstructed all **36 affected semantic
questions over 32 finalized passages** after supplemental source merging. As
above, the standards are the official approximate purpose descriptions linked
in the research document; the bands are not hard psychometric cutoffs. Counts
below exclude whitespace and source labels, matching
`readingCharacterCount`.

### Exact finalized character counts

| Family | Exact passage counts | Final band | Official approximate target |
| --- | --- | ---: | ---: |
| N5 mid | `N5-mid-lunch-shopping-plan` 283; `N5-mid-zoo-train-bus-plan-passage` 284; `N5-mid-wallet-found-process-passage` 272; `N5-mid-birthday-party-roles-passage` 291; `N5-mid-new-student-day-passage` 280; `N5-mid-apartment-laundry-rules-passage` 276; `N5-mid-museum-weekend-choice-passage` 275; `N5-mid-grandmother-gift-letter-passage` 288 | **272-291** | ~250 |
| N4 mid | `N4-mid-reusable-cup-system` 528; `N4-mid-library-study-seat-passage` 475; `N4-mid-neighborhood-cat-feeding-passage` 504; `N4-mid-walking-map-updates-passage` 498; `N4-mid-online-course-group-time-passage` 481; `N4-mid-office-quiet-hour-passage` 484; `N4-mid-imperfect-vegetable-market-passage` 483; `N4-mid-exchange-event-roles-passage` 465 | **465-528** | ~450 |
| N3 mid | `N3-mid-shared-tools-system` 438; `N3-mid-library-reminder-timing-passage` 380; `N3-mid-museum-audio-choice-passage` 384; `N3-mid-bakery-preorder-waste-passage` 383; `N3-mid-walking-commute-attention-passage` 378; `N3-mid-team-near-mistake-log-passage` 400; `N3-mid-comment-delay-reflection-passage` 385; `N3-mid-child-exhibit-explanation-passage` 394 | **378-438** | ~350 |
| N3 long | `N3-long-repair-cafe` 516; `N3-long-street-tree-aftercare-passage` 494; `N3-long-public-map-missing-reports-passage` 473; `N3-long-letter-slower-revision-passage` 514; `N3-long-school-project-shared-goal-passage` 617; `N3-long-community-quiet-room-passage` 619; `N3-long-oral-history-context-passage` 564; `N3-long-library-of-things-care-passage` 589 | **473-619** | ~550 |

The paired questions retain one source identity and therefore the same count:
`N5-mid-lunch-shopping-budget` / `N5-mid-lunch-shopping-delivery` (283),
`N4-mid-reusable-cup-return` / `N4-mid-reusable-cup-original-problem` (528),
`N3-mid-shared-tools-location` / `N3-mid-shared-tools-failed-purchase`
(438), and `N3-long-repair-cafe-learning` /
`N3-long-repair-cafe-unrepairable` (516).

### Per-family verdicts

| Family | Verdict | Re-audit finding |
| --- | --- | --- |
| N5 mid | **Pass after remediation** | All eight finalized passages now carry sustained, relevant everyday sequences near the official approximate scale. All nine questions have one direct key and exact evidence. The additions preserve event chronology and do not create a second answer for either shared lunch question. |
| N4 mid | **Pass after remediation** | All eight passages now develop problem, intervention, and result rather than merely adding unrelated details. The former P1 size failure is resolved. All nine keys remain unique; the shared cup questions test different relations in one coherent process. |
| N3 mid | **Pass after one additional repair** | The passages now require cause, contrast, scope, or writer-purpose tracking at 378-438 characters. All nine keys are uniquely supported. Alternatives now use earlier-but-incomplete claims, reversed agency/timing, missed conditions, or overgeneralization rather than category errors. |
| N3 long | **Pass after remediation** | All eight passages sustain logical development and conclusion tracking around the official long scale. All nine questions have distinct evidence and a single defensible summary or causal key. The repair-cafe pair remains mutually consistent. |

The N3 option audit covered every remediated set. In the mid family, the false
choices now compete through quantity versus location, notification timing,
fixed versus selectable depth, reservation scope, routine versus transition,
person blame versus process repair, moderator versus author action, and
knowledge delivery versus observation. In the long family, they compete
through partial goals, wrong causal priority, missing-report scope, mistaken
medium effects, equal compromise versus shared purpose, uniform rules versus
time zoning, selecting one memory versus preserving context, and replacement
versus shared care. No affected N3 set retains the prior pattern of three
absurd or categorically unrelated choices.

### Additional repairs made during this re-audit

- `N3-mid-walking-commute-attention`: replaced the artificial “record that the
  walking habit continued in rain” alternative with a natural health-routine
  overgeneralization. The passage explicitly says rainy days are exceptions,
  so the keyed mental-transition meaning remains unique.
- `N5-mid-wallet-found-process`: changed `電話でもらったばんごう` to the more
  natural, level-appropriate `電話で聞いたばんごう`.
- `N4-mid-neighborhood-cat-feeding`: changed the awkward
  `前より同じように世話` to `毎日同じように世話`.
- `N4-mid-exchange-event-roles`: changed the awkward
  `話す時間を正しく同じにする` to
  `全員の話す時間を同じ長さにする`.

Each repair has an ID-specific regression assertion. No semantic ID, passage
ID, correct answer, evidence fragment, or shared-source identity changed.

### Remaining limitations and release status

There is **no remaining P1 or P2 content blocker among these 36 affected
questions** in this AI re-audit. N5 and N4 alternatives remain intentionally
more transparent than N3 alternatives, and several ask for a concrete detail
within a longer everyday passage. That is acceptable for the lower-level
purpose, but this review cannot establish empirical item difficulty.

The earlier inventory/provenance blocker is unchanged: the complete lower
reading pack still contains **80 original passages and 86 semantic questions**,
while the generator creates **200 rendered records per family** by reuse and
option-order variation. Product copy must not describe those records as 200
independently authored, nonrepeating passages or questions. The remediation
did not change that architecture or claim.

This is still AI editorial review, not native-Japanese review, human JLPT item
approval, or psychometric validation. Public official samples demonstrate
format and purpose but cannot prove that an original item's calibrated
difficulty matches a live administration. A native-Japanese JLPT specialist
review remains the appropriate final editorial gate.

### Re-audit verification

- Focused lower-reading and passage-length suites: **22/22 tests passed**.
- Generated-bank integration suite: **16/16 tests passed**.
- Focused ESLint: **passed**.
- Workspace TypeScript check (`tsc --noEmit`): **passed**.
- Every affected evidence fragment remains present in the finalized displayed
  source, and every affected four-choice set retains exactly one stored key.
