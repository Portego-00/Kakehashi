# JLPT official-format research for Kakehashi

_Accessed and independently rechecked 2026-08-30. This note uses only first-party material published by
the Japan Foundation and Japan Educational Exchanges and Services on the
official JLPT website. It does not reproduce any test question._

## How to read this note

- **Officially verified** identifies a fact stated by an official JLPT source.
- **Implementation recommendation** identifies a Kakehashi design decision
  inferred from those facts. It is not a claim about the official test.
- Item counts are **approximate**, not an exact test contract. The official
  guidebook says the actual count may vary slightly between administrations and
  the approximate counts themselves may change. N1 listening counts below
  incorporate the December 2022 revision; N4 and N5 counts incorporate the
  December 2020 revision.
- The detailed interaction-flow source is the organizers' guidebook for the
  JLPT revision introduced in 2010. The current 2026 composition page and
  current purpose sheets still list the same relevant item families, and the
  official direction-change sheet is applied below. No newer public official
  operations manual was located that states a universal replay count.

The most important constraint is that a Kakehashi result cannot be an official
JLPT score prediction. The JLPT uses answer-pattern-based scaled scores under
Item Response Theory (IRT), not a raw count or percentage. Kakehashi has neither
the live test's calibrated items nor the response population needed to reproduce
that calculation ([official scaled-score explanation](https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf)).

## 2026-08-30 primary-source recheck and implementation disposition

This section records the fresh audit against the current official pages. An
**official fact** below is stated by the linked organizer source. An
**implementation disposition** is this audit's comparison with Kakehashi and is
not an official JLPT claim.

| Area                        | Official fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Implementation disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timed test sections         | N1 and N2 each have one combined language-knowledge/reading section followed by listening. N3–N5 separately time vocabulary, grammar/reading, and listening. The current times are N1 110+55, N2 105+50, N3 30+70+40, N4 25+55+35, and N5 20+40+30 minutes; listening time may vary slightly with the recording ([current 2026 section table](https://www.jlpt.jp/e/guideline/testsections.html)).                                                                                                                                                              | **Verified.** `JLPT_MOCK_STRUCTURES` has the same grouping, order, and nominal duration. Its timers are per official test section, not per diagnostic skill. Pause remains a visibly labelled Kakehashi accommodation.                                                                                                                                                                                                                                                       |
| Item families and order     | The official matrix lists the supported vocabulary, grammar, reading, and listening families independently by level ([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html)). The level purpose sheets preserve the large-question order ([N1](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf), [N2](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf), [N3](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf), [N4](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf), [N5](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)). | **Verified.** `OFFICIAL_TYPES_BY_LEVEL`, mock selection, and section assignment match all level-specific families and preserve their official family order. The audit added complete order regressions rather than relying on representative spot checks.                                                                                                                                                                                                                    |
| Approximate item counts     | The organizers describe family counts as approximate and subject to variation. N1 listening was reduced to 5/6/5/11/3 from December 2022 ([N1 update](https://www.jlpt.jp/e/topics/202208051659677223.html)); N4/N5 language counts were reduced from December 2020 while their listening counts stayed unchanged ([N4/N5 update](https://www.jlpt.jp/e/topics/202009091599642827.html)).                                                                                                                                                                       | **Verified.** Every value in `JLPT_APPROXIMATE_ITEM_COUNTS` matches the base official composition material after applying both official updates. Kakehashi correctly calls forms “representative”; these counts are not guaranteed for a future administration.                                                                                                                                                                                                              |
| Multiple choice             | The JLPT uses a computer-scored multiple-choice answer sheet. Most questions have four choices; some listening questions have three ([official FAQ](https://www.jlpt.jp/e/faq/)).                                                                                                                                                                                                                                                                                                                                                                               | **Verified with one explicit UI adaptation.** All Kakehashi questions are multiple choice. Verbal-expression and quick-response listening use three choices; the other implemented variants use four. For sentence composition, Kakehashi requires arranging all four fragments and derives the scored numbered fragment at `★`; the paper answer sheet itself records only that one number, as described in the [official guidebook](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf). |
| Listening sequence          | The public official flow presents the coherent stimulus once. Task and key-point questions are heard before and again after the stimulus; outline and integrated questions follow the stimulus; outline, verbal-expression, quick-response, and the implemented integrated variant use spoken choices. Key-point includes a printed-choice preview pause at N1–N4 but not N5 ([official guidebook listening flow](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf)).                                                                                          | **Partial, honestly bounded.** Kakehashi preserves advance/after-stimulus question placement, question repetition, printed versus audio-only choices, illustration mechanics, and one forward item-level mock play. It does **not** reproduce the official continuous section recording, every fixed pause, studio speaker separation, or the two-question printed-choice integrated variant. UI copy was corrected so the per-item player is no longer called “continuous.” |
| Level listening speed       | N1 uses natural-speed material; N2 uses nearly natural speed; N3 uses near-natural speed in everyday situations; N4/N5 use slow material ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).                                                                                                                                                                                                                                                                                                                                             | **Repaired.** The hub previously described N2 as natural-speed and has been corrected to near-natural-speed; N3 is now also stated as near-natural rather than natural. Authored rate multipliers remain local approximations, not official words-per-minute specifications.                                                                                                                                                                                                 |
| Scoring and result grouping | N1–N3 report three 0–60 scoring sections. N4/N5 report combined language knowledge/reading 0–120 plus listening 0–60. Passing requires both the overall mark and every sectional minimum ([official scoring sections and pass rules](https://www.jlpt.jp/e/guideline/results.html)). Scores are IRT-based scaled scores derived from answer patterns, not proportional raw-correct totals ([official scaled-score explanation](https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf)).                                                                             | **Verified.** Result grouping matches the official scoring-section distinction, but Kakehashi reports only raw diagnostic accuracy and explicitly declines official score conversion, sectional-pass application, pass prediction, or CEFR inference.                                                                                                                                                                                                                        |

**Audit conclusion.** No current section, timing, scoring-section,
supported-family, family-order, or published-count mismatch was found. The
remaining fidelity gap is principally delivery: a browser-controlled,
synthesized, per-item listening player is a practical simulation of the
official continuous recorded section, not an exact reproduction. The public
sources also do not expose live item calibration, fixed future counts, or a
universal candidate-controlled replay rule.

**Presentation repair.** The official task-based and key-point diagrams specify
that the situation and question are heard, while the four alternatives are
printed; the question itself is not part of the printed choice display
([official guidebook, listening flow](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf)).
Strict mock mode now withholds that question text and delivers it in the audio
before and after the stimulus. Practice mode may still show it as a learning
aid. A remaining limitation is that older authored task/key seeds do not all
carry a separate spoken narrator sentence identifying the setting and roles;
their dialogue and question remain sufficient to answer, but this does not
perfectly reproduce that part of the official presentation.

## Current test sections and times

**Officially verified.** These are the current worldwide times published for 2026. The official page warns that a section time can change and that listening
time can differ slightly with the length of the recording
([current test sections and times](https://www.jlpt.jp/e/guideline/testsections.html)).

| Level | Test sections, in order                                                                                                           | Nominal tested time |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------: |
| N1    | 1. Language Knowledge (Vocabulary/Grammar)・Reading — **110 min**; 2. Listening — **55 min**                                      |             165 min |
| N2    | 1. Language Knowledge (Vocabulary/Grammar)・Reading — **105 min**; 2. Listening — **50 min**                                      |             155 min |
| N3    | 1. Language Knowledge (Vocabulary) — **30 min**; 2. Language Knowledge (Grammar)・Reading — **70 min**; 3. Listening — **40 min** |             140 min |
| N4    | 1. Language Knowledge (Vocabulary) — **25 min**; 2. Language Knowledge (Grammar)・Reading — **55 min**; 3. Listening — **35 min** |             115 min |
| N5    | 1. Language Knowledge (Vocabulary) — **20 min**; 2. Language Knowledge (Grammar)・Reading — **40 min**; 3. Listening — **30 min** |              90 min |

N4/N5 vocabulary and grammar-reading times were shortened beginning in
December 2020, without changing the difficulty or content of the item types.
N1 listening was shortened from 60 to 55 minutes beginning in December 2022
([N4/N5 revision](https://www.jlpt.jp/e/topics/202009091599642827.html),
[N1 revision](https://www.jlpt.jp/e/topics/202208051659677223.html),
[official FAQ](https://www.jlpt.jp/e/faq/)).

**Implementation recommendations.**

- Treat each row entry above as a separately timed section. N1 and N2 do **not**
  have separate official timers for vocabulary, grammar, and reading inside
  their first 110/105-minute section.
- For N3–N5, finish and lock the vocabulary section before moving to the
  grammar-reading section. Saving answers locally does not imply that a user
  may return to a closed section.
- A strict mock should not pause an active section. Persist answers plus an
  absolute section deadline so backgrounding or closing the browser cannot
  reset the clock. A resumable, timer-free or pausable variant may be offered,
  but label it as practice rather than a strict mock.
- Do not invent a universal break duration. The worldwide source specifies the
  tested section times, not one global break schedule for every test site.

## Level targets are independent

**Officially verified.** The official descriptions do not define the levels by
a published vocabulary, kanji, or grammar list. N4/N5 chiefly cover basic
Japanese learned in class; N1/N2 cover Japanese across broader real-life
settings; N3 bridges those groups. The post-2010 JLPT deliberately does not
publish a "Test Content Specifications" word/kanji/grammar list
([level summaries](https://www.jlpt.jp/e/about/levelsummary.html),
[official FAQ](https://www.jlpt.jp/e/faq/)).

| Level | Reading target                                                                                                                                                 | Listening target                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1    | Logically complex or abstract writing, editorials, critiques, and profound material; understand structure, narrative, and writer intent comprehensively.       | Coherent conversation, news, and lectures at natural speed across broad settings; follow ideas, relationships, logical structure, and essential points. |
| N2    | Clearly written articles/commentary and simple critiques across varied topics; follow general-topic narrative and writer intent.                               | Coherent conversations and news at nearly natural speed in everyday and wider settings; understand relationships and essential points.                  |
| N3    | Concrete everyday material, headline-level summary information, and the main points of somewhat difficult everyday writing when rephrasing support is present. | Coherent everyday conversation at near-natural speed; generally follow content and participant relationships.                                           |
| N4    | Familiar daily topics written with basic vocabulary and kanji.                                                                                                 | Daily-life conversations when spoken slowly.                                                                                                            |
| N5    | Typical expressions and sentences in hiragana, katakana, and basic kanji.                                                                                      | Short, slow conversations about recurring daily-life and classroom topics; pick out necessary information.                                              |

**Implementation recommendation.** Do not generate one template and swap in
harder words. Author and review each level against its own discourse type,
reading length, speech speed, relationship cues, and official item families.
The official level summary and public examples are the defensible boundary;
there is no official checklist that can certify an isolated word or grammar
form as “N3” or “N2.”

### Purpose guardrails for a large original question bank

**Officially verified.** The five current purpose sheets define what each item
family is intended to measure, but they do not provide an authoring syllabus.
The following distinctions therefore have to be preserved in generated and
human-authored items
([N1 purposes](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf),
[N2 purposes](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf),
[N3 purposes](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
[N4 purposes](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N5 purposes](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

| Family                           | Official construct to preserve                                                                   | Level-specific boundary                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kanji reading                    | Reading of a word written in kanji                                                               | N1–N5                                                                                                                                                |
| Orthography                      | Written form for a word shown in hiragana                                                        | N2–N4 specify kanji; N5 specifies kanji **and katakana**; N1 does not use this family                                                                |
| Word formation                   | Knowledge of derivative and compound words                                                       | N2 only                                                                                                                                              |
| Contextually-defined expressions | Meaning of a word as fixed by its sentence context                                               | N1–N5; an N5 item may depend on an illustration rather than text alone                                                                               |
| Paraphrases                      | A word or expression with similar meaning                                                        | N1–N5                                                                                                                                                |
| Usage                            | Appropriate use of a word in a sentence                                                          | N1–N4; N5 does not use this family                                                                                                                   |
| Sentential grammar 1             | Grammar form that suits a sentence                                                               | N1–N5                                                                                                                                                |
| Sentential grammar 2             | A sentence that is both syntactically accurate and meaningful                                    | N1–N5; the real response mechanic is documented below                                                                                                |
| Text grammar                     | Suitability of a sentence for the surrounding text flow                                          | N1–N5; this must test discourse fit, not merely isolated grammar                                                                                     |
| Task-based listening             | Extract information required to resolve a concrete issue and identify an appropriate next action | N1–N5                                                                                                                                                |
| Key-point listening              | Narrow attention using necessary information given before the text                               | N1–N5; the detailed guidebook says N1–N3 mainly target matters such as feelings/reasons, while N4/N5 mainly target concrete facts such as date/place |
| General-outline listening        | Infer the speaker's intention or ideas from the text as a whole                                  | N1–N3 only                                                                                                                                           |
| Verbal expressions               | Select what a depicted person should say after hearing the circumstances                         | N3–N5 only; requires the illustration and three spoken choices                                                                                       |
| Quick response                   | Select an appropriate response to a short utterance                                              | N1–N5; three spoken choices                                                                                                                          |
| Integrated listening             | Compare and integrate multiple information sources in a relatively long text                     | N1/N2 only                                                                                                                                           |

Reading item purposes and approximate source-text lengths are listed separately
below because the official sheets distinguish level by genre, discourse demand,
and length rather than by simply making every passage uniformly longer.

**Implementation recommendations.**

- A claimed bank size such as “200 questions per type” is a Kakehashi coverage
  target, not an official JLPT standard and not evidence of authenticity.
- Store an item-purpose rationale, level rationale, distractor rationale,
  originality attestation, author, reviewer, and review date for every item.
- Automated schema checks can establish format and internal consistency. They
  cannot certify level, naturalness, or a uniquely best answer. Those require a
  proficient human review that considers the complete context.
- Do not label any item “official-level verified.” The organizers publish no
  current word/kanji/grammar list with which that claim could be established.

## Official item families, order, and approximate counts

**Officially verified.** The current item-family matrix and the level-specific
purpose sheets establish which types appear and their large-question order
([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html),
[N1 purposes](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf),
[N2 purposes](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf),
[N3 purposes](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
[N4 purposes](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N5 purposes](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

In the tables below, `order · count` means the official large-question order
and the approximate number of answerable items. `—` means the type is not used
at that level. N3–N5 restart numbering when the grammar-reading section begins;
all levels restart numbering for listening.

### Language knowledge and reading

| Family     | Official type                                 |     N1 |     N2 |     N3 |     N4 |    N5 |
| ---------- | --------------------------------------------- | -----: | -----: | -----: | -----: | ----: |
| Vocabulary | Kanji reading                                 |  1 · 6 |  1 · 5 |  1 · 8 |  1 · 7 | 1 · 7 |
|            | Orthography                                   |      — |  2 · 5 |  2 · 6 |  2 · 5 | 2 · 5 |
|            | Word formation                                |      — |  3 · 5 |      — |      — |     — |
|            | Contextually-defined expressions              |  2 · 7 |  4 · 7 | 3 · 11 |  3 · 8 | 3 · 6 |
|            | Paraphrases                                   |  3 · 6 |  5 · 5 |  4 · 5 |  4 · 4 | 4 · 3 |
|            | Usage                                         |  4 · 6 |  6 · 5 |  5 · 5 |  5 · 4 |     — |
| Grammar    | Sentential grammar 1 (selecting grammar form) | 5 · 10 | 7 · 12 | 1 · 13 | 1 · 13 | 1 · 9 |
|            | Sentential grammar 2 (sentence composition)   |  6 · 5 |  8 · 5 |  2 · 5 |  2 · 4 | 2 · 4 |
|            | Text grammar                                  |  7 · 5 |  9 · 5 |  3 · 5 |  3 · 4 | 3 · 4 |
| Reading    | Comprehension (short passages)                |  8 · 4 | 10 · 5 |  4 · 4 |  4 · 3 | 4 · 2 |
|            | Comprehension (mid-size passages)             |  9 · 9 | 11 · 9 |  5 · 6 |  5 · 3 | 5 · 2 |
|            | Comprehension (long passages)                 | 10 · 4 |      — |  6 · 4 |      — |     — |
|            | Integrated comprehension                      | 11 · 3 | 12 · 2 |      — |      — |     — |
|            | Thematic comprehension (long passages)        | 12 · 4 | 13 · 3 |      — |      — |     — |
|            | Information retrieval                         | 13 · 2 | 14 · 2 |  7 · 2 |  6 · 2 | 6 · 1 |

### Listening

| Official type                    |     N1 |     N2 |    N3 |    N4 |    N5 |
| -------------------------------- | -----: | -----: | ----: | ----: | ----: |
| Task-based comprehension         |  1 · 5 |  1 · 5 | 1 · 6 | 1 · 8 | 1 · 7 |
| Comprehension of key points      |  2 · 6 |  2 · 6 | 2 · 6 | 2 · 7 | 2 · 6 |
| Comprehension of general outline |  3 · 5 |  3 · 5 | 3 · 3 |     — |     — |
| Verbal expressions               |      — |      — | 4 · 4 | 3 · 5 | 3 · 5 |
| Quick response                   | 4 · 11 | 4 · 12 | 5 · 9 | 4 · 8 | 4 · 6 |
| Integrated comprehension         |  5 · 3 |  5 · 4 |     — |     — |     — |

The base approximate counts come from the official sample-set composition table
and detailed guidebook. The official site warns that these older materials
predate changes to N1 listening and N4/N5 language-knowledge/reading counts, so
the table applies the organizers' later update notices instead
([official sample composition table](https://www.jlpt.jp/e/samples/pdf/sample_kousei.pdf),
[official detailed guidebook](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf),
[N1 current listening counts](https://www.jlpt.jp/e/topics/202208051659677223.html),
[N4/N5 current counts](https://www.jlpt.jp/e/topics/202009091599642827.html)).
Listening counts did not change for N4/N5.

This yields approximate complete-mock totals of 101 items for N1, 107 for N2,
102 for N3, 85 for N4, and 67 for N5. These totals are derived from the official
type counts, not guaranteed counts for a future administration.

### Reading scale and task intent by level

**Officially verified.** The purpose sheets give these approximate source-text
lengths. A passage can support more than one item.

| Reading type          | N1                                                                    | N2                                                                                                    | N3                                                                   | N4                                                               | N5                                                          |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Short                 | ~200 characters; descriptions/instructions across daily life and work | ~200 characters; descriptions/instructions across daily life and work                                 | ~150–200 characters; original text across daily life and work        | ~100–200 characters; easy original text on study/daily life/work | ~80 characters; easy original text on study/daily life/work |
| Mid-size              | ~500; causal relations or reasons in reviews, commentary, essays      | ~500; causal relations, reasons, outline, or author view in relatively easy reviews/commentary/essays | ~350; key words and causal relations in original commentary/essays   | ~450; easy original everyday text                                | ~250; easy original everyday text                           |
| Long                  | ~1,000; outline or author ideas in commentary, essays, fiction        | Not a separate category                                                                               | ~550; summary and logical development in commentary, essays, letters | —                                                                | —                                                           |
| Integrated            | Multiple texts, ~600 total; compare and integrate                     | Relatively easy multiple texts, ~600 total; compare and integrate                                     | —                                                                    | —                                                                | —                                                           |
| Thematic long         | ~1,000; overall point in abstract/logical editorials or reviews       | ~900; overall point in relatively clear logical reviews                                               | —                                                                    | —                                                                | —                                                           |
| Information retrieval | ~700; ads, brochures, magazines, business documents                   | ~700; ads, brochures, magazines, business documents                                                   | ~600; original ads/brochures                                         | ~400; original notices and similar material                      | ~250; original notices and similar material                 |

The item mix itself proves the levels do not scale uniformly. N2 uniquely has
word formation; N1 omits orthography; N3 has a dedicated long-passage family
while N2 instead uses integrated and thematic reading; N3–N5 use verbal-
expression listening, while N1/N2 use integrated listening; N5 has no usage
item family.

## Sentence-composition (`★`) response mechanic

**Officially verified.** Sentential grammar 2 is a rearrangement task at every
level. The booklet shows one sentence frame with **four blank positions**, one
of those positions marked `★`, and **four numbered fragments**. The examinee
works out the complete order, but marks only one answer on the answer sheet:
the number of the fragment that belongs at `★`. The official worked example
shows the assembled four-fragment sentence and then bubbles that single number
([detailed guidebook, printed pp. 43–44](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf)).

The same guidebook says the constructed sentence must be syntactically correct
and meaningful. It also rules out an ordering that would make the sentence's
printed final punctuation occur in the middle of the completed blank sequence.
The current purpose sheets and composition matrix continue to list this family
for all N1–N5, so the mechanic is not level-specific
([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html)).

**Implementation recommendations.**

- The authentic paper response is the single numbered fragment at `★`, not a
  submitted four-part ordering.
- Kakehashi intentionally requires the learner to arrange all four fragments
  in every mode, including mock, and derives the one scored `★` answer from
  that order. This usability adaptation follows the product requirement that
  the order interaction accept all four parts; product copy must still explain
  that the paper JLPT records only the `★` fragment.
- Store `fragments[4]`, `correctOrder[4]`, `starSlot`, and the derived correct
  option. Validation must reject duplicate fragments, incomplete permutations,
  a mismatch between the derived and stored answer, or a second defensible
  ordering that places a different fragment at `★`.
- Do not present this family as ordinary “select the next word” multiple choice.
  All four fragments must be considered to construct the complete sentence.

## Listening behavior that affects the player

**Officially verified.** The official detailed guidebook describes a fixed
forward sequence for each listening family. The official FAQ also says most
JLPT questions have four choices, but some listening questions have three
([guidebook listening flow](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf),
[official FAQ](https://www.jlpt.jp/e/faq/)).

| Type                             | Levels | Official presentation flow                                                                                                                                                                                                           |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task-based comprehension         | N1–N5  | Audio gives the situation and question; a coherent text plays while four printed text or picture choices are visible; the question plays again; a few seconds are provided to answer.                                                |
| Comprehension of key points      | N1–N5  | Situation and question play first. N1–N4 get a short pause to inspect four printed choices; N5 does not get that pre-reading pause and may use pictures. The text and question then play, followed by a few seconds to answer.       |
| Comprehension of general outline | N1–N3  | The situation plays without the question; the coherent text plays; the question is heard once afterward; four choices are audio-only.                                                                                                |
| Verbal expressions               | N3–N5  | The user sees an illustration and hears the situation plus “What do you say?”; three choices are audio-only.                                                                                                                         |
| Quick response                   | N1–N5  | A short utterance plays, followed by three audio-only responses; choose the most appropriate response.                                                                                                                               |
| Integrated comprehension         | N1–N2  | A situation and longer text play before the question. The official guide describes one variant with one question and audio-only choices, and another with two questions and printed choices; it notes that other variants can occur. |

Other officially relevant details:

- The listening section's nominal duration may shift slightly with the recorded
  material ([current timing page](https://www.jlpt.jp/e/guideline/testsections.html)).
- Other listening families have a practice example to teach the response form;
  the last N1/N2 listening family has no such practice example
  ([official FAQ](https://www.jlpt.jp/e/faq/)).
- The official sample pages explicitly distinguish the downloadable web samples
  from the real test, where audio is played
  ([2009 sample set](https://www.jlpt.jp/e/samples/sample09.html)).

### What “one hearing” means

**Officially verified.** The detailed guidebook and official scripts specify a
single, forward authored timeline; they do not describe an examinee-controlled
replay button. Within that timeline, the coherent stimulus/dialogue itself is
presented once. What repeats for two families is the **question prompt**:

- Task-based comprehension: situation + question → stimulus → question again →
  answer time.
- Key-point comprehension: situation + question → optional printed-choice
  preview pause → stimulus → question again → answer time. N5 omits the preview
  pause.
- General-outline and integrated comprehension: situation → stimulus → question
  once after the stimulus → spoken or printed choices as defined by the variant.
- Verbal expressions: situation and “What do you say?” prompt → three spoken
  choices.
- Quick response: short utterance → three spoken responses.

The official Practice Workbooks publish each large listening family as a
continuous audio file, and their scripts follow the same one-way sequence
([official Practice Workbooks and audio](https://www.jlpt.jp/e/samples/sampleindex.html),
[detailed guidebook, printed pp. 49–56](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf)).
The organizers' later direction-wording update clarifies the task wording but
does not introduce a second playing of the stimulus
([official direction changes](https://www.jlpt.jp/e/samples/pdf/shijibun_henkou.pdf)).
The “practice” mentioned in the official FAQ means an unscored worked example
at the start of a large-question family. It does **not** mean a second playing
of each scored item. Every family has such a form-demonstration example except
the last, integrated-comprehension family at N1/N2.

**Published-rule ambiguity.** The official sources inspected do not state a
standalone universal rule in the form “each item may be heard exactly once,”
nor do they publish a candidate-controlled replay allowance by level. The
official evidence is instead the fixed audio sequence above. Therefore “one
play” should be described as Kakehashi's strict-mock simulation of that
continuous recording, not quoted as an official numeric replay policy.

**Implementation recommendations.**

- In strict mock mode, model each listening item as an authored audio timeline:
  situation → optional advance question → optional preview pause → stimulus →
  question → choices/answer pause. Do not render every type as the same audio
  clip plus four permanently visible text buttons.
- Hide transcripts until review. Use printed choices only for the families and
  variants that officially print them; audio-only choices are part of the skill
  being measured.
- Disable scrub/replay in strict mode and advance from the recording's authored
  pauses. Count the whole authored timeline as one play; do not count the
  repeated question prompt inside task/key-point audio as a replay. This is a
  fidelity recommendation from the official sequence, not an explicit numeric
  replay rule published by the organizers.
- Preload and integrity-check all section audio before starting. If media fails,
  stop and offer a restart that is clearly excluded from strict mock timing;
  browser buffering should not become an accidental listening skill.
- Keep a more forgiving replayable listening practice mode separate from the
  mock exam. Multiple replays in practice are a Kakehashi learning aid, not a
  claim about real-test behavior.

## Scoring, pass conditions, and result language

**Officially verified.** The official test has scoring sections that do not
always match the timed test sections
([scoring sections and pass/fail](https://www.jlpt.jp/e/guideline/results.html)).

| Level | Official scoring sections                                                  | Overall pass mark | Sectional pass marks                             |
| ----- | -------------------------------------------------------------------------- | ----------------: | ------------------------------------------------ |
| N1    | Language Knowledge (Vocabulary/Grammar) 0–60; Reading 0–60; Listening 0–60 |           100/180 | At least 19/60 in **each** of the three sections |
| N2    | Language Knowledge (Vocabulary/Grammar) 0–60; Reading 0–60; Listening 0–60 |            90/180 | At least 19/60 in **each** of the three sections |
| N3    | Language Knowledge (Vocabulary/Grammar) 0–60; Reading 0–60; Listening 0–60 |            95/180 | At least 19/60 in **each** of the three sections |
| N4    | Language Knowledge (Vocabulary/Grammar)・Reading 0–120; Listening 0–60     |            90/180 | At least 38/120 combined and 19/60 listening     |
| N5    | Language Knowledge (Vocabulary/Grammar)・Reading 0–120; Listening 0–60     |            80/180 | At least 38/120 combined and 19/60 listening     |

Passing requires both the overall mark and every sectional mark. Missing any
required test section is a fail and the official score report does not report
scores for the sections that were taken. For N4/N5, the two separately timed
language sections combine into one 0–120 scoring section. For N3, grammar from
the second timed section contributes to Language Knowledge, while reading has
its own 0–60 scoring section.

The JLPT does not add fixed points for correct answers. Its scaled score is
derived mathematically from the examinee's correct/incorrect **answer pattern**
under IRT. Two different patterns can receive the same scaled score, and a
higher raw correct count does not mechanically imply the expected proportional
scaled score ([scaled-score explanation](https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf),
[scoring FAQ](https://www.jlpt.jp/e/faq/)).

Official score reports also provide non-pass/fail reference grades for areas
inside a scoring section: `A` for 67% or more correct, `B` for 34–66%, and `C`
for less than 34%. For N1–N3 these are shown for vocabulary and grammar; for
N4/N5 they are shown for vocabulary, grammar, and reading. Reading and listening
that already have sectional scaled scores do not receive this reference grade
([understanding official score reports](https://www.jlpt.jp/e/guideline/pdf/understandingscorereport.pdf)).

Beginning with the December 2025 JLPT, passed examinees also receive a CEFR
level as reference information based on their **official total scaled score**.
It is not part of pass/fail, and failed examinees do not receive the indication
([official CEFR reference policy](https://www.jlpt.jp/e/about/cefr_reference.html)).

**Implementation recommendations.**

- Headline the result **Estimated mock performance**. Report raw correct/total
  and percentage by item type and by Kakehashi skill area.
- Do not convert raw percentages linearly into 0–180, display “predicted JLPT
  score,” make an official pass/fail claim, or infer a CEFR level.
- It is acceptable to show the official pass and sectional marks in an
  educational comparison panel, but explicitly state that Kakehashi cannot
  determine whether that threshold would have been met on the scaled test.
- If `A/B/C` bands are reused, call them raw practice bands and explain their
  official role is reference information, not pass/fail.
- Preserve both views in the data model: official scoring sections (including
  N4/N5's combined section) and diagnostic categories (kanji/vocabulary,
  grammar, reading, listening and precise item type). Diagnostic results need
  not pretend the official score report separates the same categories.

## Multiple choice, scope, and copyright

**Officially verified.** The JLPT is computer-scored multiple choice. Most
items have four choices and some listening items have three. It currently has
no conversation or composition test. No item specifically requires Japanese
cultural knowledge, although cultural material can appear when the answer does
not depend on prior cultural knowledge ([official FAQ](https://www.jlpt.jp/e/faq/)).

The public “Let's Try” set provides one example per item type and warns that it
may differ from the actual booklet. The 2009 sample collection covers every
form but explicitly says its counts differ from the actual test. The two
Official Practice Workbooks use items selected from post-2010 tests in volumes
roughly comparable to a real test; the official page warns that reproduction of
some reading/grammar material and all listening audio can involve third-party
copyright
([one-per-type examples](https://www.jlpt.jp/e/samples/forlearners.html),
[2009 complete type samples](https://www.jlpt.jp/e/samples/sample09.html),
[Official Practice Workbooks](https://www.jlpt.jp/e/samples/sampleindex.html)).

The organizers state that they own the test-question copyright and that
unauthorized copying, duplication, and reproduction is prohibited. They also
state that live questions and answers are not made public. The site policy
protects the website's text, images, illustrations, and compilation; its
limited personal-study, qualified quotation, and specified educational-use
exceptions are not blanket permission to populate a product question bank.
Some published N1/N2 grammar/reading source material and **all** Official
Practice Workbook listening audio also contain third-party works that can
require separate permission
([copyright FAQ](https://www.jlpt.jp/e/faq/),
[site policy](https://www.jlpt.jp/e/policy.html),
[Practice Workbook copyright notice](https://www.jlpt.jp/e/samples/sampleindex.html),
[warning about undisclosed live questions](https://www.jlpt.jp/e/topics/202401191708325175.html)).

**Implementation recommendations.**

- Use the official examples to audit **form**, not as a content source. Every
  Kakehashi stem, passage, illustration, script, recording, answer, and
  distractor must be original.
- “Find official questions” must mean locating official examples for structural
  comparison. Do not ingest, lightly rewrite, translate, paraphrase, or
  procedurally mutate official items into the Kakehashi bank.
- Require exactly one defensible answer and record a review note explaining why
  every distractor fails in context. Avoid culture-dependent assumptions.
- Store source-form provenance as the official item-type URL plus a reviewer
  and audit date; never store or ship copied official question text.

## What a web mock can and cannot reproduce

### Can reproduce reasonably well

**Implementation recommendations.**

- Current section order and independent section timers.
- Official large-question order and a representative count per family.
- Four-choice and three-choice mechanics, sentence composition, passage-linked
  item groups, illustrations, information-retrieval layouts, and audio-only
  choice types.
- No correctness feedback until a section or mock ends.
- Raw diagnostic breakdowns and missed-item explanations, clearly separate
  from official scoring.

### Cannot reproduce exactly from public information

**Officially verified limitations with implementation consequences.**

- **Scaled scores:** the official IRT calibration and live answer-pattern data
  are unavailable, so only mock/raw performance can be reported.
- **A fixed future item count:** the organizers describe published counts as
  approximate and subject to revision.
- **A complete level syllabus:** the organizers do not publish a current
  vocabulary/kanji/grammar specification list.
- **The confidential live test:** exact administrations are not published; the
  official workbooks provide selected past items instead.
- **Test-center conditions:** proctoring, paper answer-sheet handling, room
  audio, site-specific breaks, and accommodation administration are outside a
  normal browser session.

## Acceptance checklist for the question bank

The following is an **implementation recommendation** derived from the sources
above. Run it per item before calling the bank authentic:

1. Level, timed section, official item family, official large-question order,
   scoring section, and diagnostic category are all explicit metadata.
2. The interaction matches the official family: printed versus audio-only
   choices, three versus four choices, illustration requirements, advance
   question, preview pause, and question replay position.
3. A sentence-composition item has four fragments, a complete unique order, a
   declared star slot, and one scored answer derived from the fragment at that
   slot.
4. Reading length and discourse purpose fit the level-specific purpose sheet;
   listening speed and setting fit the independent official level summary.
5. The Japanese has been reviewed for naturalness by a proficient human, and
   the intended answer remains uniquely correct without unstated assumptions.
6. Each distractor is plausible at the target level and has a recorded reason
   it is wrong.
7. All prose, scripts, audio, and art are original; the official sample was used
   only to compare format.
8. Automated validation rejects a missing explanation, duplicate option,
   invalid correct-option index, unsupported item type for the level, wrong
   section order, missing audio/art asset, or reading group without its shared
   passage.

## Primary-source register

All sources below were rechecked on **2026-08-30**.

- [Composition of Test Sections and Items](https://www.jlpt.jp/e/guideline/testsections.html)
- [Scoring Sections, Pass or Fail, Score Report](https://www.jlpt.jp/e/guideline/results.html)
- [Scaled scores](https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf)
- [Understanding JLPT Score Reports](https://www.jlpt.jp/e/guideline/pdf/understandingscorereport.pdf)
- [Official FAQ](https://www.jlpt.jp/e/faq/)
- [N1–N5: Summary of Linguistic Competence Required for Each Level](https://www.jlpt.jp/e/about/levelsummary.html)
- [N1 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf)
- [N2 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf)
- [N3 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)
- [N4 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf)
- [N5 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)
- [Official detailed guidebook: composition and item flow](https://www.jlpt.jp/reference/pdf/guidebook1e.pdf)
- [Official changes to question directions](https://www.jlpt.jp/e/samples/pdf/shijibun_henkou.pdf)
- [Official sample-set composition and approximate counts](https://www.jlpt.jp/e/samples/pdf/sample_kousei.pdf)
- [N1 December 2022 time/count revision](https://www.jlpt.jp/e/topics/202208051659677223.html)
- [N4/N5 December 2020 time/count revision](https://www.jlpt.jp/e/topics/202009091599642827.html)
- [Let's Try Sample Questions](https://www.jlpt.jp/e/samples/forlearners.html)
- [New JLPT Sample Questions (all forms)](https://www.jlpt.jp/e/samples/sample09.html)
- [Official Practice Workbooks](https://www.jlpt.jp/e/samples/sampleindex.html)
- [Official site copyright policy](https://www.jlpt.jp/e/policy.html)
- [Official warning about undisclosed live questions](https://www.jlpt.jp/e/topics/202401191708325175.html)
- [CEFR reference indication from December 2025](https://www.jlpt.jp/e/about/cefr_reference.html)
