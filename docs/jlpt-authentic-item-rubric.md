# JLPT authentic-item authoring rubric: text grammar and verbal expressions

_Accessed 2026-08-29. Scope: `text-grammar` for N5-N1 and
`listening-verbal` for N5-N3. Sources are limited to first-party material from
the Japan Foundation and Japan Educational Exchanges and Services. This rubric
describes Kakehashi editorial gates; it is not an official JLPT item-writer
manual._

## Evidence labels

- **Official contract** means that the organizers state the purpose, level
  availability, or response mechanic directly in a current purpose sheet,
  guide, FAQ, or instruction. The current composition page lists text grammar
  at all five levels and verbal expressions only at N3-N5
  ([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html)).
- **Public-sample observation** means that the feature appears in the official
  public material inspected, but the organizers do not promise that every live
  item must share that incidental feature. The 2012 and 2018 Official Practice
  Workbooks each contain nearly one live-test-equivalent selection of questions
  actually used after the 2010 revision
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
  [official workbook index](https://www.jlpt.jp/samples/sampleindex.html)).
- **Kakehashi rule** is a conservative local quality gate inferred from the
  official construct and examples. It must not be described as an official
  JLPT rule.

## 1. Text grammar (`文章の文法`), N5-N1

### Official construct and presentation

**Official contract.** At every level, the stated purpose of text grammar is
to test whether a sentence is suitable for the flow of a text
([N1 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf),
[N2 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf),
[N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
[N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)). The
organizers' explanatory material is more explicit: the examinee must consider
the sentences before and after the blank and the text as a whole, rather than
only the blank or its sentence
([official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf),
[official illustrated guide](https://www.jlpt.jp/reference/pdf/guide2014.pdf)).

**Official contract.** The public format is a printed, coherent text containing
numbered blanks. For each blank, the examinee chooses one answer from four
printed options; each blank is a separately scored multiple-choice response
([official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf),
[official FAQ](https://www.jlpt.jp/e/faq/index.html)). The 2018 released sets
show this same passage-plus-numbered-blanks presentation at
[N1](https://www.jlpt.jp/samples/sample2018/pdf/N1G.pdf),
[N2](https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf),
[N3](https://www.jlpt.jp/samples/sample2018/pdf/N3G.pdf),
[N4](https://www.jlpt.jp/samples/sample2018/pdf/N4G.pdf), and
[N5](https://www.jlpt.jp/samples/sample2018/pdf/N5G.pdf).

**Public-sample observation.** A large question normally groups several blanks
inside one text, with a separate four-option block for each numbered blank.
The released examples include learner compositions at the lower levels and
article, column, or essay-like prose at the upper levels; this demonstrates
possible realizations, not an official genre quota
([2018 N5 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N5G.pdf),
[2018 N4 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N4G.pdf),
[2018 N2 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf),
[2018 N1 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N1G.pdf)).

### Required Kakehashi data and UI shape

Every authored text-grammar group must satisfy all of these local gates:

1. **Passage first.** Store one complete, natural passage and embed one or more
   stable blank IDs in it. Never manufacture an item by placing a blank between
   only two unrelated standalone sentences. This gate follows the official
   requirement to judge the surrounding and overall flow
   ([official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf)).
2. **Four printed options per blank.** In mock presentation, show the passage,
   the numbered blank, and four text options numbered 1-4. One selection fills
   one answer row; do not turn the family into drag-and-drop, sentence ordering,
   or audio response
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
   [2018 N2 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf)).
3. **Discourse dependence.** Removing all sentences except the blank's own
   sentence must make the key materially harder to determine. At least one
   distractor should be locally grammatical but fail because of reference,
   chronology, stance, information structure, genre, or the relation between
   sentences. This is a Kakehashi operational test for the official text-flow
   construct
   ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
   [official illustrated guide](https://www.jlpt.jp/reference/pdf/guide2014.pdf)).
4. **Natural distractors.** All four choices must be well-formed Japanese in a
   plausible context. Reject malformed suffixes, particles added merely to make
   an option impossible, and nonsense such as a connector plus an incompatible
   case particle. The official task asks for the _most suitable_ expression in
   the text, so the contrast must come from suitability rather than visibly
   broken Japanese
   ([official purpose sheets](https://www.jlpt.jp/e/guideline/testsections.html),
   [2018 N1 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N1G.pdf)).
5. **Exactly one best answer.** A reviewer must reconstruct the complete
   passage with every choice, record why the key alone preserves the intended
   flow, and reject the item if another choice produces a defensible reading.
   The official instruction requires one best choice from four
   ([2018 N4 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N4G.pdf)).
6. **Group-level review.** Review all blanks together, because filling one blank
   can constrain another. Store `groupId`, full passage, ordered blanks,
   per-blank options/key, discourse rationale, level rationale, author,
   reviewer, and review date. Grouped blanks are demonstrated in every 2018
   level set
   ([official workbook index](https://www.jlpt.jp/samples/sampleindex.html)).
7. **Originality.** Do not copy or closely paraphrase released passages or
   options. The organizers prohibit unauthorized copying, duplication, and
   reproduction of JLPT questions and note that some materials also contain
   third-party copyrights
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
   [official workbook copyright notice](https://www.jlpt.jp/samples/sampleindex.html)).

### Level-by-level authoring boundary

The official purpose sentence is identical across levels, so level must come
from the independent linguistic-competence descriptions and the public examples,
not from mechanically swapping vocabulary in one shared template
([level summaries](https://www.jlpt.jp/e/about/levelsummary.html),
[N1-N5 purpose sheets](https://www.jlpt.jp/e/guideline/testsections.html)).

| Level | Kakehashi authoring target | Reject when |
| --- | --- | --- |
| N5 | Use typical expressions and sentences in hiragana, katakana, and basic kanji; keep the situation familiar and the discourse relation concrete, such as sequence, simple contrast, reference, or an everyday intention. This applies the official N5 reading boundary ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N5 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N5G.pdf)). | The answer depends on advanced register, abstract argument, or vocabulary outside what the text itself makes clear; or the blank can be solved as a bare particle drill without reading the passage. |
| N4 | Use familiar daily topics in basic vocabulary and kanji. Require the learner to follow a short coherent account, explanation, or composition across sentences, while keeping the intended relation explicit enough for basic Japanese ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N4 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N4G.pdf)). | The item is only an isolated connector choice, or it requires dense abstraction or subtle rhetorical stance not supported by the passage. |
| N3 | Use concrete everyday material and a coherent text whose chronology, causal relation, reference, or writer attitude must be followed. Some slightly difficult everyday writing is acceptable when context or paraphrase supports comprehension ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N3 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N3G.pdf)). | It is merely N4 text with harder nouns, or it demands the abstract and compressed argumentation associated with N1 without contextual support. |
| N2 | Use clearly written material across everyday and broader settings, including article-, commentary-, or simple critique-like prose. Test narrative/argument flow and writer intent with clear logical development ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N2 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf)). | All relations are explicit enough for a lower-level item, or the key relies on an obscure lexical fact instead of discourse fit. |
| N1 | Use mature prose across broad topics, including logically complex or abstract writing, editorials, critiques, essays, or profound narratives. A blank may depend on subtle stance, rhetorical structure, reference, or the writer's developing intent, but the key must remain unique ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N1 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N1G.pdf)). | The item is an N2 passage with ornate vocabulary, or multiple nuanced readings remain equally defensible. |

**Do not assign a mandatory character count from a reading-comprehension row.**
The purpose sheets publish approximate lengths for the separate reading types,
but they publish no length band for text grammar; any local minimum is an
editorial heuristic, not an official JLPT specification
([N1 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf),
[N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

### Text-grammar acceptance checklist

An item group is releasable only if every answer is **yes**:

- Is there a coherent passage rather than two isolated sentences?
- Does each blank have exactly four printed options and one keyed answer?
- Must the reader use text before or after the blank, or the passage's overall
  direction, to decide?
- Are all distractors natural and plausible until discourse fit is evaluated?
- Does a proficient reviewer agree that only one option is best in the complete
  passage?
- Does the topic, script, register, abstraction, and discourse demand match the
  selected level's independent official description?
- Is the passage original and independently reviewed?

These checks operationalize the official text-flow purpose and one-of-four
response form
([official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf),
[official FAQ](https://www.jlpt.jp/e/faq/index.html)).

## 2. Verbal-expression listening (`発話表現`), N5-N3

### Official construct and interaction timeline

**Official contract.** Verbal expressions occur at N5, N4, and N3, but not N2
or N1. Their purpose is to select an appropriate verbal expression after
listening to the circumstances while looking at an illustration
([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html),
[N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf),
[N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf),
[N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).

**Official contract.** The authored flow is:

1. The examinee looks at an illustration containing an arrow that identifies
   the person whose next utterance is being tested.
2. Audio states the circumstances and asks `何と言いますか` ("What do you
   say?/What does the person say?").
3. Audio presents three numbered candidate utterances.
4. The examinee selects the single best choice, 1-3.

The detailed guide states that the situation/question comes first, then three
spoken choices, and that the most appropriate utterance for the arrow-marked
person is selected
([official detailed guidebook, verbal-expressions flow](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf)). The instructions and illustration-only answer pages in the 2018 sets confirm the same mechanic at
[N3](https://www.jlpt.jp/samples/sample2018/pdf/N3L.pdf),
[N4](https://www.jlpt.jp/samples/sample2018/pdf/N4L.pdf), and
[N5](https://www.jlpt.jp/samples/sample2018/pdf/N5L.pdf); the corresponding
scripts show the situation/question followed by choices 1, 2, and 3
([N3 script](https://www.jlpt.jp/samples/sample2018/pdf/N3script.pdf),
[N4 script](https://www.jlpt.jp/samples/sample2018/pdf/N4script.pdf),
[N5 script](https://www.jlpt.jp/samples/sample2018/pdf/N5script.pdf)).

**Official contract.** The candidate utterances are audio-only; the booklet
prints the illustration, not the Japanese choice text. This family is one of
the listening formats with three rather than four choices
([official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
[official FAQ](https://www.jlpt.jp/e/faq/index.html),
[2018 N3 listening booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3L.pdf)).

### Illustration authoring gate

Every verbal-expression item must include an original illustration that passes
all of these Kakehashi checks:

1. **One unmistakable target.** Exactly one arrow points to the head or upper
   body of the person who must speak; no second arrow or nearby object may be
   confused as the target. The arrow-target mechanic is stated in the detailed
   guide and visible throughout the released booklets
   ([official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
   [2018 N4 listening booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4L.pdf)).
2. **Meaning-bearing scene.** The image must contribute information needed to
   identify speaker, addressee, object/action, direction, or relationship. If
   the same answer remains obvious with the image hidden, reclassify the item
   as quick response or rewrite it. The official purpose explicitly requires
   listening to circumstances _while looking at illustrations_
   ([N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf)).
3. **No answer leakage.** Do not print the three utterances, translations,
   captions that paraphrase the key, or a speech bubble in the illustration.
   Mock UI may show neutral controls `1`, `2`, `3` only. The official pages show
   the illustration while the choices are spoken
   ([2018 N5 listening booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5L.pdf),
   [2018 N5 script](https://www.jlpt.jp/samples/sample2018/pdf/N5script.pdf)).
4. **Readable without cultural trivia.** Necessary action and relationship cues
   must be visually legible at mobile size and must not require prior knowledge
   of a Japan-specific custom. The JLPT states that no question specifically
   requires Japanese cultural knowledge
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).
5. **Original art.** Do not trace or reproduce official workbook illustrations.
   JLPT questions are copyrighted, and unauthorized reproduction is prohibited
   ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).

### Audio and option authoring gate

1. **Preserve order.** Build one forward script in this order:
   `situation -> 何と言いますか -> choice 1 -> choice 2 -> choice 3`. Do not
   reveal the choices before the situation and do not display their Japanese
   text in mock mode
   ([official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
   [2018 N3 script](https://www.jlpt.jp/samples/sample2018/pdf/N3script.pdf)).
2. **Three choices only.** All three candidates must be complete, natural
   utterances that the arrow-marked speaker could physically produce at that
   moment. One must be pragmatically best; the others should fail for a
   level-relevant reason such as speech act, direction of giving/receiving,
   reference, tense/aspect, register, or politeness. The official response is
   one of three spoken alternatives
   ([official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf)).
3. **Illustration plus audio must be sufficient.** A reviewer must be able to
   state the target speaker, addressee, communicative goal, and relationship
   using only the image and situation line. Do not depend on an explanation
   visible only in review metadata. The official description requires the
   examinee to grasp the situation from those two channels
   ([official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf)).
4. **No malformed distractors.** Wrong answers may express the wrong intention
   or social relation, but must not advertise themselves through broken grammar
   or impossible word combinations. The task is selection of the _most
   appropriate verbal expression_, not error spotting
   ([N3 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf)).
5. **One voice per candidate set.** Render the three candidate utterances as
   alternatives spoken by the depicted target person, with consistent speaker
   identity and audio quality. The official scripts group the three alternatives
   under one speaker role for each item
   ([2018 N4 script](https://www.jlpt.jp/samples/sample2018/pdf/N4script.pdf)).

### Level-by-level authoring boundary

The official verbal-expression purpose is the same at N5-N3; level differences
must therefore be authored from each level's listening description and checked
against that level's released examples
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html),
[N3-N5 purpose sheets](https://www.jlpt.jp/e/guideline/testsections.html)).

| Level | Kakehashi authoring target | Reject when |
| --- | --- | --- |
| N5 | Use a short, slowly delivered situation from recurring daily-life or classroom contexts. Make the visible action and communicative goal concrete; use typical basic expressions and short candidate utterances. This follows the official N5 listening boundary and the released N5 items' immediate everyday situations ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N5 script](https://www.jlpt.jp/samples/sample2018/pdf/N5script.pdf), [2018 N5 booklet](https://www.jlpt.jp/samples/sample2018/pdf/N5L.pdf)). | Success requires subtle hierarchy, implicit irony, abstract intent, or a long spoken setup; or the image is decorative rather than necessary. |
| N4 | Use daily-life interactions delivered slowly. The scene may require one straightforward inference about another person, an object, direction, or routine politeness, while remaining grounded in basic Japanese ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N4 script](https://www.jlpt.jp/samples/sample2018/pdf/N4script.pdf), [2018 N4 booklet](https://www.jlpt.jp/samples/sample2018/pdf/N4L.pdf)). | The item is only an N5 lexical swap, or it requires near-natural processing and nuanced register without explicit relationship cues. |
| N3 | Use coherent everyday situations at near-natural speed. Let the image and setup establish participant relationship or role, and test a more discriminating choice of communicative act, register, or socially appropriate wording while preserving one clear key ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html), [2018 N3 script](https://www.jlpt.jp/samples/sample2018/pdf/N3script.pdf), [2018 N3 booklet](https://www.jlpt.jp/samples/sample2018/pdf/N3L.pdf)). | The three options differ only by advanced vocabulary, the relationship/register cue is absent, or two utterances are equally acceptable in the depicted situation. |

The organizers publish qualitative speed descriptions (slowly for N5/N4 and
near-natural for N3), not fixed words-per-minute values for this item family.
Any TTS rate chosen by Kakehashi must therefore be documented as a product
calibration, not an official numeric setting
([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).

### Verbal-expression acceptance checklist

An item is releasable only if every answer is **yes**:

- Is there an original illustration, and is it visible before and during the
  situation/choice audio?
- Does one unambiguous arrow identify the speaker whose next utterance is tested?
- Does the illustration carry information that is necessary to solve the item?
- Is the audio ordered `situation -> 何と言いますか -> 1 -> 2 -> 3`?
- Are there exactly three audio-only Japanese choices and only neutral numbered
  controls in mock mode?
- Are all three utterances natural for some plausible situation, with exactly
  one pragmatically best in this depicted situation?
- Does speaker identity remain consistent across all three alternatives?
- Do topic, relationship demand, register, utterance length, and delivery speed
  match N5, N4, or N3 independently?
- Have both the art and language been checked for originality and reviewed by a
  proficient Japanese editor?

These checks operationalize the official illustration-plus-circumstances
construct and three-spoken-choice flow
([official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf),
[official purpose sheets](https://www.jlpt.jp/e/guideline/testsections.html)).

## 3. What the public official material establishes - and what it does not

### Established strongly enough to implement

- Text grammar appears at every level and measures suitability for text flow;
  public sets consistently use a passage with numbered blanks and four printed
  choices for each blank
  ([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html),
  [official explanatory guide](https://www.jlpt.jp/e/reference/pdf/guide2011_e.pdf),
  [official workbook index](https://www.jlpt.jp/samples/sampleindex.html)).
- Verbal expressions appear only at N3-N5 and require an illustration with an
  arrow-marked speaker, a spoken situation and `何と言いますか`, followed by
  three spoken choices
  ([current composition matrix](https://www.jlpt.jp/e/guideline/testsections.html),
  [official detailed guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf)).
- The JLPT uses a computer-scored multiple-choice answer sheet; most questions
  have four choices, while some listening questions have three
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).
- The 2012 and 2018 workbooks are the strongest public content examples because
  each contains nearly one test-equivalent set selected from post-2010 live
  questions
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html),
  [official workbook index](https://www.jlpt.jp/samples/sampleindex.html)).

### Not established; do not claim or hard-code as official

- The public material is not an exhaustive item-writer specification. The 2009
  sample collection covers all formats but explicitly uses a different number
  of questions from the real test, with only one audio sample per listening
  large question
  ([official 2009 sample page](https://www.jlpt.jp/e/samples/sample09.html),
  [official accessible-material index](https://www.jlpt.jp/tenji.html)).
- The samples do not establish a mandatory text-grammar character count, a
  fixed genre mix, exact distractor distribution, or a numeric TTS rate. The
  current purpose sheets state constructs and publish length bands only for the
  separate reading families, while the level summary gives qualitative
  listening speeds
  ([N1 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf),
  [N5 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf),
  [official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).
- The organizers do not publish a post-2010 vocabulary, kanji, or grammar list.
  They direct users instead to the level summaries, item composition, and
  samples, so no automated lookup can certify an item's level
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).
- Two public near-complete sets per level do not establish topic frequency or
  prove that a new item is natural, level-appropriate, or uniquely keyed. Those
  remain editorial judgments requiring independent proficient-human review;
  the official site says exact past tests are not all published and describes
  the two workbooks as selected questions
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).

## 4. Minimal reviewer record

For either family, approval must record:

- `officialPurpose`: which official construct the item measures;
- `levelRationale`: evidence against the independent N5/N4/N3/N2/N1 summary;
- `presentationAudit`: option count, printed/audio status, and required visual
  mechanics;
- `keyRationale`: why the key alone is best in full context;
- `distractorRationales`: the plausible misconception behind every distractor;
- `originalityAttestation`;
- `languageReviewer`, `reviewDate`, and `status` (`draft`, `rejected`,
  `revised`, or `approved`).

This record is a Kakehashi quality-control requirement. It is necessary because
the official sources provide constructs and samples but no exhaustive current
content list or public authoring specification
([official FAQ](https://www.jlpt.jp/e/faq/index.html),
[official composition matrix](https://www.jlpt.jp/e/guideline/testsections.html)).
