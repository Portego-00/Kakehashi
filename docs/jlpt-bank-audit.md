# JLPT generated-bank audit

Audit date: 2026-08-29  
Audit target: the generated N5–N1 bank under
`web/src/features/jlpt/questions/generated/`  
Decision: **not ready to describe as a human-validated, 200-substantive-items-per-type bank**

> **Historical baseline.** This report records the first generated-bank audit
> before the 2026-08-29 remediation pass. Its P1 findings about isolated text
> grammar, absent verbal-expression illustrations, shared N1/N2/N3 reading and
> listening templates, and the listed malformed distractors have since been
> addressed in code. The still-current P0 findings are that 200 generated
> records are not 200 independently authored semantic items and that proficient
> human Japanese review has not happened. See
> [`jlpt-content-audit-round2.md`](./jlpt-content-audit-round2.md),
> [`jlpt-content-audit-round3.md`](./jlpt-content-audit-round3.md), and
> [`jlpt-quiz-implementation.md`](./jlpt-quiz-implementation.md) for current
> status.

## What was checked

The format criteria came from the official-only research in
[`docs/jlpt-research.md`](./jlpt-research.md), principally the
[official test-content guide](https://www.jlpt.jp/e/guideline/testsections.html),
[official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
[official composition table](https://www.jlpt.jp/e/samples/pdf/sample_kousei.pdf),
[official one-per-type samples](https://www.jlpt.jp/e/samples/forlearners.html),
and [official sample/Practice Workbook index](https://www.jlpt.jp/e/samples/sampleindex.html).

The content sample used the same three deliberately separated indices in every
supported level/type cell:

- suffix `001` (first family/variant), `075` (middle family and a later
  substitution variant), and `200` (last family/variant);
- 14 types at N5, 15 at N4, 17 at N3, 19 at N2, and 18 at N1;
- **83 level/type cells and 249 generated records in total**.

For example, the N3 usage sample was
`n3-generated-usage-001`, `n3-generated-usage-075`, and
`n3-generated-usage-200`. The same ID rule was applied to every type listed in
`OFFICIAL_TYPES_BY_LEVEL`.

Each sample was checked for the official item purpose, presentation mechanics,
Japanese naturalness, level plausibility, one defensible answer, distractor
plausibility, listening presentation, and recognizable official-source copying.
The generator source was also inspected because a rendered-text uniqueness test
cannot tell whether two records exercise different knowledge.

## Reviewer limitation

This is an **automated and AI/subagent editorial review**, not proficient-human
Japanese editorial validation. No record in this bank should be labelled
“native reviewed,” “human validated,” or equivalent on the basis of this audit.
The pass counts below mean only that this review found no material problem in
the three sampled variants. They do not replace review by at least one
proficient Japanese editor familiar with JLPT item writing.

## Automated results

The focused suite passed after four ambiguous items found during this audit were
rewritten:

```text
Test files: 4 passed
Tests:      37 passed
```

The suite covers 200 records per supported type, stable unique IDs, option
shape, a unique stored key, balanced key position, complete four-fragment
sentence-composition permutations, the derived `★` answer, listening metadata,
no unexpanded interpolation, broad reading-length floors, N1/N2 integrated
listening length, and textual signatures. The four files were:

- `generated-bank.test.ts`
- `diversity.test.ts`
- `reading-lengths.test.ts`
- `questions.test.ts`

This establishes **16,600 structurally valid records**: 2,800 N5, 3,000 N4,
3,400 N3, 3,800 N2, and 3,600 N1. It does not establish 16,600 independently
authored or independently validated questions.

## Stratified content disposition

The classification is conservative: a systemic type-level defect applies to
all three sampled IDs in that cell.

| Level | Pass | Caveat | Fail | Total sampled |
| --- | ---: | ---: | ---: | ---: |
| N5 | 18 (6 types) | 15 (5 types) | 9 (3 types) | 42 |
| N4 | 12 (4 types) | 21 (7 types) | 12 (4 types) | 45 |
| N3 | 15 (5 types) | 27 (9 types) | 9 (3 types) | 51 |
| N2 | 12 (4 types) | 42 (14 types) | 3 (1 type) | 57 |
| N1 | 12 (4 types) | 39 (13 types) | 3 (1 type) | 54 |
| **Total** | **69** | **144** | **36** | **249** |

Disposition by family:

- **N5 pass:** kanji reading, orthography, context expression, paraphrase,
  sentence composition, short reading. **Fail:** text grammar, mid-size reading,
  verbal-expression listening. The other five are caveats.
- **N4 pass:** kanji reading, context expression, sentence composition, short
  reading. **Fail:** orthography, text grammar, mid-size reading,
  verbal-expression listening. The other seven are caveats.
- **N3 pass:** kanji reading, paraphrase, sentence composition, short reading,
  long reading. **Fail:** orthography, text grammar, verbal-expression
  listening. The other nine are caveats.
- **N2 pass:** kanji reading, context expression, paraphrase, sentence
  composition. **Fail:** text grammar. The other fourteen are caveats.
- **N1 pass:** kanji reading, context expression, paraphrase, sentence
  composition. **Fail:** text grammar. The other thirteen are caveats.

The high caveat count is mostly driven by template repetition, non-independent
level content, weak distractors, and below-target passage scale rather than by
wrong keyed answers.

## Release blockers

### P0 — 200 records per type are not 200 substantive questions per type

The bank meets the requested number only at the record/ID layer. Most
language-knowledge families have ten semantic seeds and render each seed twenty
times with a changed name, day, time, venue, wrapper, and option order. The
sentence-composition families likewise have ten canonical sentences repeated
through substitutions.

Reading and listening diversity is narrower:

- most reading type/level combinations have one passage and answer model
  repeated 200 times;
- integrated reading varies five topic labels and thematic reading ten topic
  words, but retains the same argument, correct answer, and distractors;
- task and key-point listening have one core script per complexity branch,
  outline has one core talk, integrated listening one core multi-source script,
  verbal expressions one core situation, and quick response three prompts;
- the passing `diversity.test.ts` counts name/day/time/venue substitutions as
  textually distinct signatures.

Concrete examples are the three N5 listening-task records
`n5-generated-listening-task-001`, `-075`, and `-200`: all test putting a
notebook in a bag before two pencils. Similarly,
`n1-generated-reading-integrated-001`, `-075`, and `-200` all use the same A/B
information-disclosure argument and identical answer logic.

This is suitable as a generator scaffold, but it does not satisfy the ordinary
meaning of “minimum 200 questions per type per level” or support many attempts
without semantic repetition. A question-history algorithm can prevent repeated
IDs, but cannot prevent the learner from seeing the same underlying item.

### P0 — required proficient-human editorial validation has not happened

The user acceptance criteria require validation of level, naturalness, and a
unique answer. Automated shape tests and an AI/subagent audit cannot make that
claim safely for 16,600 records. A release claiming completion needs a tracked
human review state per semantic seed/item, with rejected/revised/approved
status and reviewer notes.

## Major authenticity findings

### P1 — text grammar does not reproduce the official purpose

Official text grammar tests whether a sentence fits the flow of a surrounding
text. Every generated item sampled here is a blank joining only two isolated
sentences. This is closer to connector selection than passage-level text
grammar. The defect affects every `*-generated-text-grammar-*` family.

It also makes weak alternatives obvious. Examples include:

- `n5-generated-text-grammar-200`: `そのまえを` and `それなのにを`;
- `n3-generated-text-grammar-075`: `たとえばを` and `その結果だけ`;
- `n1-generated-text-grammar-001`: `したがってのみ`;
- `n1-generated-text-grammar-200`: `ゆえにのみ`.

These do not provide the plausible, discourse-level competition expected of
the official family.

### P1 — verbal-expression listening lacks the required illustration

The official N3–N5 verbal-expression family presents an illustration, plays a
situation and “What do you say?”, then plays three audio-only choices. The
generated questions provide a spoken text situation but no illustration
metadata or image. This affects all N3/N4/N5
`generated-listening-verbal` records; exact sampled examples include
`n5-generated-listening-verbal-001`,
`n4-generated-listening-verbal-075`, and
`n3-generated-listening-verbal-200`.

The three-choice and audio-only answer mechanics themselves are correct.

### P1 — level content is not independent enough

The official level summaries and item-purpose sheets require the five levels to
be authored independently. The implementation shares the same substantive
listening across N3, N2, and N1 for task, key-point, outline, and quick response;
N2 and N1 also share the same integrated-listening script. For example,
`n3-generated-listening-outline-001`,
`n2-generated-listening-outline-001`, and
`n1-generated-listening-outline-001` make the same claim about looking beyond
participant totals. Only the wrapper names, place, rate, and option order vary.

N2 and N1 likewise share substantive templates for short, mid-size, integrated,
thematic, and information-retrieval reading. Compare
`n2-generated-reading-integrated-001` with
`n1-generated-reading-integrated-001`: the passage and inference task are the
same. The N1-only long family does not fix this overlap. These records therefore
cannot support a claim that every type was independently level-validated.

### P1 — several reading families remain materially below official scale

Official passage lengths are approximate, not hard cutoffs, so modest variation
is acceptable. The following sampled bands remain materially below the official
purpose guidance:

| Family | Sampled rendered range | Official approximate target |
| --- | ---: | ---: |
| N5 mid-size | 133–139 characters | ~250 |
| N4 mid-size | 201–202 | ~450 |
| N3 mid-size | 248–251 | ~350 |
| N3 information retrieval | 476–480 | ~600 |
| N2/N1 mid-size | 387–390 | ~500 |
| N2/N1 information retrieval | 612–618 | ~700 |
| N1 long | 829–832 | ~1,000 |
| N1 thematic | 812–814 | ~1,000 |

The strongest failures are N5/N4 mid-size reading. Exact examples are
`n5-generated-reading-mid-001` (133 characters) and
`n4-generated-reading-mid-001` (202 characters). The current regression floors
for these are 120 and 180 respectively; those floors prove internal stability,
not close correspondence to the official ~250/~450 guidance.

### P1 — many distractors are syntactically malformed or too remote

The sampled keyed answers were uniquely defensible after the four fixes noted
below, but many wrong answers advertise themselves through impossible suffixes
or extremely remote meanings. Examples:

- `n4-generated-orthography-001`: `予定い`; `-075`: `都合う`; `-200`:
  `最近ん`;
- `n3-generated-orthography-075`: `確認ん`; `-200`: `期待い`;
- `n3-generated-context-expression-001`: `わずかなに`, `急なを`,
  `同じくの`;
- `n2-generated-orthography-001`: `促進ん`;
- `n2-generated-word-formation-001`: `再意見`, `再費用`, `再安全`;
- sampled usage distractors often replace the target with a meaning so
  unrelated that no same-level learner confusion is being tested.

The problem is not that distractors must be correct Japanese uses; official
wrong answers can be inappropriate. The problem is that an appropriate
same-level misconception should remain plausible until the target rule or
meaning is applied.

## Smaller item-level caveats

- `n4-generated-paraphrase-200` defines `最近` as
  `今からあまり遠くない前`, which is understandable but unnatural Japanese.
- `n5-generated-information-retrieval-200` prints `午後十二時`. This is
  technically interpretable but unusually confusing in a beginner schedule;
  `正午`, `夜十二時`, or 24-hour notation should be chosen intentionally.
- N2/N1 integrated/thematic reading choices are uniquely keyed but often pit a
  nuanced answer against three absolute caricatures. For example,
  `n1-generated-reading-thematic-001` uses “no need to record,” “more time
  always means higher quality,” and “avoid every efficiency effort.”
- Synthetic speaker wrappers such as `X氏の発言` create textual uniqueness but
  often add no information needed to solve the item.

## Findings fixed during the audit

The initial final-bank sample exposed four multiple-answer risks. They were
rewritten and regression-tested before this report was finalized:

- `n3-generated-usage-200`: two distractors also used `応じる` defensibly;
- `n3-generated-grammar-form-001`: the original sentence admitted
  `だからこそ` and `だけでも`; it now supplies an explicit safety rule that
  makes `でないと` uniquely coherent while retaining plausible near misses;
- `n1-generated-usage-075`: `本のページを翻した` was a legitimate literary
  use of `翻す`;
- `n1-generated-grammar-form-001`: `見直さずにはおかない` was also a
  grammatical, defensible completion.

The focused 37-test suite passed after these changes. The final 249-item sample
did not reveal another clearly defensible second answer. This is a useful
subagent result, not a guarantee for unsampled seeds or a substitute for human
editorial sign-off.

## What is now faithful

- Supported type presence and ordering match the official level matrix.
- Ordinary types have four choices; verbal-expression and quick-response
  listening have three.
- Sentence composition stores four fragments and a complete canonical order.
  Kakehashi requires arranging all four in practice and mock, then derives the
  scored fragment at `★`. Requiring the full arrangement is a usability
  adaptation; the paper answer sheet records only the `★` number.
- Mock listening permits one forward play of the stimulus. The authored player
  repeats the question prompt, not the stimulus, for task/key-point listening.
- Outline/integrated questions and spoken choices are hidden visually before
  playback. Mock transcripts remain hidden even when audio fails; practice may
  show a transcript fallback. A failed synthesis releases the reserved play so
  the learner can retry.
- N1/N2 integrated listening is now a long, multi-source discussion rather
  than the earlier short dialogue.
- The item IDs, stored answer keys, option counts, explanations, and generated
  interpolations are structurally sound.

## Originality and copyright risk

An automated normalized-text scan compared all 16,600 generated records with
text extracted from the official public 2009 type samples and Official Practice
Workbook scripts. It found **zero exact normalized overlaps of 30 or more
Japanese characters**. The four last-edited items listed above were also
checked directly and contain generic original sentences, not recognizable
official wording.

This lowers obvious-copy risk but is not proof of originality: PDF extraction
is incomplete, exact matching cannot detect translated/paraphrased copying,
and the official public corpus is not the undisclosed live test bank. The
[official copyright policy](https://www.jlpt.jp/e/policy.html) and
[copyright FAQ](https://www.jlpt.jp/e/faq/) prohibit using released or live
test questions as a product-content source. Official material should remain a
format/purpose reference only.

## Required path to release-quality validation

1. Treat a semantic seed as the unit of diversity. Do not count a changed
   person/day/place or rotated option order as a new question.
2. Replace the ten-seed/template expansion with independently authored items,
   or accurately label the present bank as generated variants rather than 200
   questions per type.
3. Rebuild text grammar around multi-sentence passages and add original
   illustrations for N3–N5 verbal-expression listening.
4. Author N1, N2, N3, N4, and N5 listening/reading independently against each
   level's official purpose, discourse, speed, and passage-scale guidance.
5. Run a distractor pass that records the intended learner misconception for
   every wrong option.
6. Obtain proficient-human Japanese review of every semantic item for
   naturalness, level, cultural neutrality, and one defensible answer. Store
   reviewer/status/version metadata so later edits invalidate old approval.
7. Keep the automated invariants and originality scan as regression checks;
   they complement, rather than replace, editorial validation.
