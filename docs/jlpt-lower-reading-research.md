# JLPT N5-N3 reading research and authoring guide

_Accessed 2026-08-29. Scope: reading-comprehension and information-retrieval
items at N5, N4, and N3. Sources are limited to the official JLPT website and
materials published there by the Japan Foundation and Japan Educational
Exchanges and Services._

This document is an implementation-facing guide for creating **original**
Kakehashi items. It does not reproduce released question wording, and it is not
an official JLPT item-writer manual.

## Evidence labels

- **Official contract**: a family, purpose, approximate length, or response
  mechanic stated by the organizers in the current composition table, a
  purpose sheet, or the FAQ
  ([current composition table](https://www.jlpt.jp/e/guideline/testsections.html),
  [official FAQ](https://www.jlpt.jp/e/faq/index.html)).
- **Public-sample observation**: a feature found in the 2018 Official Practice
  Workbook. The organizers say that the 2012 and 2018 workbooks each contain
  almost as many questions as an actual test and use questions selected from
  post-2010 administrations; an observed genre, grouping, or count is still not
  a promise about every future form
  ([Official Practice Workbook index](https://www.jlpt.jp/e/samples/sampleindex.html)).
- **Kakehashi authoring rule**: a conservative local gate derived from the
  official construct and samples. It must not be presented as an official JLPT
  rule.

The lightweight official sample page offers one example of each item type and
explicitly warns that actual-booklet questions may differ. Use it to confirm
form, not to infer quotas or a complete genre distribution
([official sample guidance](https://www.jlpt.jp/e/samples/forlearners.html)).

## Supported families, purposes, and lengths

The current composition table supports short passage, mid-size passage, and
information retrieval at all three levels; long-passage comprehension occurs
at N3 but not N4 or N5. Integrated and thematic comprehension are not supported
at N3-N5
([current composition table](https://www.jlpt.jp/e/guideline/testsections.html)).

| Level | Official family | Official purpose | Approximate source length |
| --- | --- | --- | ---: |
| N5 | Comprehension (short passages) | Understand the content of easy texts about study, everyday life, and work. | 80 characters |
| N5 | Comprehension (mid-size passages) | Understand the content of easy texts about everyday topics and situations. | 250 characters |
| N5 | Information retrieval | Retrieve necessary information from source material such as a notice. | 250 characters |
| N4 | Comprehension (short passages) | Understand the content of easy texts about study, everyday life, and work. | 100-200 characters |
| N4 | Comprehension (mid-size passages) | Understand the content of easy texts about everyday topics and situations. | 450 characters |
| N4 | Information retrieval | Retrieve necessary information from source material such as a notice. | 400 characters |
| N3 | Comprehension (short passages) | Understand content in descriptions and directions on varied topics, including everyday life and work. | 150-200 characters |
| N3 | Comprehension (mid-size passages) | Understand key words and causal relations in texts such as commentary and essays. | 350 characters |
| N3 | Comprehension (long passages) | Understand the summary and logical development of texts such as commentary, essays, and letters. | 550 characters |
| N3 | Information retrieval | Retrieve necessary information from materials such as advertisements and brochures. | 600 characters |

The N5 rows come from the
[current N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf),
the N4 rows from the
[current N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
and the N3 rows from the
[N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf). “Approximately”
is part of the official description: these figures are scale targets, not
exact character-count cutoffs.

## Level differentiation

### N5: concrete comprehension in basic written Japanese

**Official boundary.** N5 reading competence is understanding typical
expressions and sentences written in hiragana, katakana, and basic kanji. The
short and mid-size families therefore target content comprehension in easy,
familiar texts rather than abstract argument
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html),
[N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

**Public-sample observation.** The 2018 short set uses three independent,
compact situations, including routine, class-notice, and workplace-memo
material. Its mid-size passage is a simple personal narrative with two
questions requiring chronology and reason; the information item applies a
stated travel need to a route comparison. Every answer block has four numbered
choices
([2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf)).

**Kakehashi target.** Keep the event chain and reference structure concrete.
Good operations include finding who did what, selecting the next or first
action, connecting an explicitly supported reason and result, resolving a
basic referent, or checking a small number of visible conditions. Reject an N5
item whose difficulty comes primarily from rare kanji, compressed implication,
or an abstract opinion contrast; that would exceed the official N5 reading
boundary
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).

### N4: coherent familiar passages in basic vocabulary and kanji

**Official boundary.** N4 measures understanding of basic Japanese; readers
should be able to understand passages on familiar daily topics written in
basic vocabulary and kanji. Its mid-size and information sources are
substantially longer than N5's, while the official purpose still emphasizes
easy everyday content rather than abstract critique
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html),
[N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf)).

**Public-sample observation.** The 2018 short set contains four independent
texts across notice, routine, memo, and anecdotal forms. One shared everyday
narrative carries four mid-size questions spanning reasons, local details, and
whole-text understanding. One event schedule carries two scenario questions,
with some options expressed as event identifiers or combinations rather than
full propositions
([2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf)).

**Kakehashi target.** Require the reader to maintain a short chain across
sentences: chronology, reason, speaker/writer intention, a referent, or the
relationship between a memo and the action it requires. In mid-size items, mix
locally supported questions with at least one question whose answer depends on
the passage as a whole. Do not create “N4” merely by inserting harder nouns
into an N5 template; the longer discourse must do real work
([N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf)).

### N3: the bridge to key-word, causal, summary, and logical reading

**Official boundary.** N3 readers should understand concrete written content
on everyday topics, grasp summary information such as newspaper headlines, and
understand the main point of somewhat difficult everyday writing when
paraphrasing support is available
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).

The purpose sheet differentiates N3 families cognitively, not only by length:
short passages use descriptions and directions; mid-size passages test key
words and causal relations; long passages test summary and logical
development; information retrieval uses advertisements and brochures
([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).

**Public-sample observation.** The 2018 short set has four independent texts
across institutional email, personal viewpoint, explanation, and memo-like
material. Two mid-size passages each support three questions that move among
reference/local meaning, reason, and overall stance. One long passage supports
four questions across fact, cause, intervention purpose, and global
evaluation. One structured poster supports two scenario-based retrieval items
([2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf)).

**Kakehashi target.** Author N3 independently. A short item can require a
direction or implication that is supported across two sentences. A mid-size
item should make key wording or cause essential rather than incidental. A long
item must have a traceable logical movement and a defensible summary or writer
position; it must not be an N4 anecdote padded to 550 characters. When a
somewhat difficult expression is necessary, nearby paraphrase or context should
support the intended reading, consistent with the official N3 competence
description
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html),
[N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).

## Response and passage-group mechanics

**Official contract.** JLPT answers use a computer-scored multiple-choice
sheet. The organizers state that most questions have four choices, while some
listening items have three; the inspected reading families use four
([official FAQ](https://www.jlpt.jp/e/faq/index.html),
[2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf),
[2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf),
[2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf)).

**Public-sample observation.** Every 2018 lower-level reading instruction asks
for the one best answer from choices 1-4. Short passages attach one scored item
to each mini-text. Mid-size, N3 long, and information-retrieval sources may
support multiple separately scored questions. Information choices may be
ordinary statements, labels taken from a source, combinations of labels, or
actions inferred from stated conditions
([2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf),
[2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf),
[2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf)).

The following 2018 counts are evidence of grouping, not current form quotas:

| Level | Short | Mid-size | Long | Information retrieval |
| --- | --- | --- | --- | --- |
| N5 | 3 passages × 1 item | 1 passage × 2 items | Not supported | 1 source × 1 item |
| N4 | 4 passages × 1 item | 1 passage × 4 items | Not supported | 1 source × 2 items |
| N3 | 4 passages × 1 item | 2 passages × 3 items | 1 passage × 4 items | 1 source × 2 items |

These counts are observed in the
[2018 N5](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf),
[N4](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf), and
[N3](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf) reading booklets. The
organizers reduced the approximate N4/N5 question counts beginning with the
December 2020 test and warn that actual counts can vary, so the 2018 grouping
must not be hard-coded as a current quota
([official N4/N5 change notice](https://www.jlpt.jp/e/topics/202009091599642827.html)).

### Data architecture implication

Store a passage or source once, with a stable `passageId`, and attach one or
more independently keyed questions. Each question needs its own four choices,
key, decisive evidence, and explanation. This local rule preserves the shared
source behavior seen in the workbooks without treating the observed number of
questions as mandatory
([2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf),
[official sample guidance](https://www.jlpt.jp/e/samples/forlearners.html)).

For information retrieval, store visible headings, labels, conditions, times,
fees, exceptions, or routes as source structure rather than flattening them
into an explanatory paragraph. The official purpose is retrieval from source
materials such as notices, advertisements, and brochures, and the released
booklets present structured source material
([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
[N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

## Common authenticity hazards

1. **Uniform scaling.** Do not write one shared story and swap vocabulary or
   length. N5, N4, and N3 have independent competence descriptions, and N3
   alone adds explicit key-word/causal and summary/logical-development
   constructs
   ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html),
   [N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).
2. **Unsupported families.** Do not label integrated, thematic, or N4/N5 long
   passages as official families. The current matrix excludes them at these
   levels
   ([current composition table](https://www.jlpt.jp/e/guideline/testsections.html)).
3. **Exact-count mythology.** The published lengths are approximate, sample
   counts are observations, and N4/N5 counts changed in 2020. Reject an authoring
   system that pads unnatural prose to an exact count or treats the 2018 form as
   a permanent quota
   ([N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
   [official N4/N5 change notice](https://www.jlpt.jp/e/topics/202009091599642827.html)).
4. **Vocabulary test disguised as reading.** A key should turn on information,
   relation, summary, or retrieval from the text rather than an isolated rare
   word. The JLPT explicitly measures communicative use of language knowledge,
   not only memorized vocabulary, kanji, and grammar lists
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
   [N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).
5. **Single-sentence leakage.** If a longer passage question can be answered
   from the stem alone or one copied sentence while the rest of the source is
   irrelevant, it does not meaningfully exercise the stated mid-size or long
   construct. The official N3 purposes require causal relations or logical
   development, and released longer passages support several distinct
   decisions
   ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
   [2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf)).
6. **Decorative notice.** An information-retrieval item must present a real
   lookup problem. Do not restate the answer in the scenario or ask a generic
   comprehension question while displaying unused fees, times, or exceptions
   ([N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf),
   [2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf)).
7. **Second defensible key.** Four distinct labels and one stored key do not
   prove that only one answer is best. Reconstruct the answer from the full
   source and reject any item for which another option satisfies the stated
   conditions. The released reading instructions require one best answer from
   four
   ([2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf)).
8. **Broken or giveaway distractors.** Every distractor should be natural,
   level-appropriate Japanese and traceable to a plausible misreading: wrong
   referent, reversed chronology, missed exception, partial condition, or
   overstatement. The task is reading comprehension with one best choice, not
   grammar-error detection
   ([N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
   [2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf)).
9. **Required cultural trivia.** A cultural setting may appear, but all facts
   necessary to answer must be in the source. The organizers state that no item
   specifically requires Japanese cultural knowledge
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).
10. **Released-item imitation.** Do not copy, translate, closely paraphrase, or
    preserve the scenario/answer skeleton of an official workbook item. The
    organizers hold the copyrights and prohibit unauthorized reproduction, and
    some released material includes third-party works
    ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
    [Official Practice Workbook index](https://www.jlpt.jp/e/samples/sampleindex.html)).
11. **Overclaiming sample evidence.** The official lightweight samples show
    item form and may differ from an actual booklet. Even the stronger workbook
    evidence does not establish a permanent genre mix or the exact content of a
    future test
    ([official sample guidance](https://www.jlpt.jp/e/samples/forlearners.html),
    [Official Practice Workbook index](https://www.jlpt.jp/e/samples/sampleindex.html)).

## Author and reviewer validation checklist

An item or shared-passage group is acceptable only when every applicable answer
is **yes**:

### Official-family fit

- Is the family supported at this exact level - N5/N4 short, mid-size, or
  information retrieval; N3 short, mid-size, long, or information retrieval?
  ([current composition table](https://www.jlpt.jp/e/guideline/testsections.html))
- Is the source naturally near the official approximate length, without filler
  or semantic compression added merely to hit an exact number?
  ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
  [N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
  [N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf))
- Does the topic, script, vocabulary, kanji load, explicitness, and discourse
  demand match the selected level's independent reading description?
  ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html))

### Source and construct

- Is the Japanese natural as a notice, memo, email, narrative, commentary,
  letter, advertisement, brochure, or other source appropriate to the family,
  rather than a list of test sentences?
  ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
  [N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
  [N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf))
- Does the question require the intended operation: content at N5/N4;
  description/direction, key word and cause, summary/logical development, or
  retrieval at the relevant N3 family?
  ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf))
- For mid-size and N3 long sources, does the complete passage contribute to at
  least one scored decision, and can the architecture attach several questions
  without duplicating the source?
  ([2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf),
  [2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf),
  [2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf))
- For information retrieval, must the learner combine the stated need with one
  or more source conditions, including any relevant exception?
  ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
  [2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf))

### Answer integrity

- Are there exactly four distinct choices and one best answer?
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
  [2018 N5 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5R.pdf))
- Does the stored evidence occur in the displayed source, and does the
  explanation identify the decisive relation rather than merely restate the
  key? This is a Kakehashi audit rule grounded in the official content,
  causal/logical, and retrieval purposes
  ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).
- Has a reviewer reconstructed the answer under all four options and documented
  why each distractor fails? The official form requires one best answer, not
  merely a designated database key
  ([2018 N4 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4R.pdf)).
- Are distractors grammatically natural, similar in specificity and length,
  plausible for the level, and tied to recognizable misreadings rather than
  nonsense? This is a Kakehashi quality rule for preserving the official
  comprehension construct
  ([N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf)).

### Originality and review status

- Is the passage, situation, question, and every option independently authored,
  without copying or close paraphrase from an official or third-party item?
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
  [Official Practice Workbook index](https://www.jlpt.jp/e/samples/sampleindex.html))
- Can the item be answered without outside cultural knowledge?
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html))
- Has a proficient Japanese reviewer familiar with this exact JLPT level
  approved naturalness, level fit, evidence, unique key, and all distractors?
  Automated schema checks and AI review do not establish those linguistic
  judgments; the official materials themselves describe purpose and examples,
  not a substitute approval process
  ([current composition table](https://www.jlpt.jp/e/guideline/testsections.html),
  [official sample guidance](https://www.jlpt.jp/e/samples/forlearners.html)).

## Minimum metadata for expansion

Store at least: `semanticId`, `passageId`, `level`, `officialFamily`, source
genre, source body or structured source blocks, approximate character count,
question, four options, keyed option, decisive evidence, explanation, level
rationale, distractor rationales, authorship/provenance, content version,
reviewer identity, review date, and editorial status. This is a Kakehashi
workflow requirement derived from the need to preserve shared-passage grouping,
unique-answer evidence, and honest review status; it is not an official JLPT
data schema
([2018 N3 reading booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3R.pdf),
[official sample guidance](https://www.jlpt.jp/e/samples/forlearners.html)).
