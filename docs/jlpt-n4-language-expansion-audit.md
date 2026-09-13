# JLPT N4 language-knowledge expansion audit

_Authored and machine-audited 2026-08-30. This is not official JLPT,
human-editor, or native-Japanese approval._

## Official authoring boundary

N4 is defined as the ability to understand basic Japanese. Its reading target
is familiar daily topics written with basic vocabulary and kanji; language
knowledge supports that receptive ability
([official N4 level description](https://www.jlpt.jp/e/about/levelsummary.html)).
The organizers do not publish a prescriptive current N4 vocabulary, kanji, or
grammar list. They direct authors and learners instead to the competence
summary, item composition, and official samples
([official FAQ](https://www.jlpt.jp/e/faq/index.html)). Therefore the level
decisions below are qualitative editorial judgments against familiar daily
communication, not claims that a word or grammar form appears on an official
N4 syllabus.

The official N4 purpose sheet defines five vocabulary operations: reading
kanji words, selecting kanji for hiragana words, choosing a word whose meaning
is fixed by context, recognizing a near paraphrase, and judging word usage in
a sentence. Its grammar operations are selecting a form that suits a sentence,
composing one syntactically accurate and meaningful sentence, and judging
sentence suitability in text flow
([official N4 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n4_e_revised.pdf)).
This tranche expands the first seven operations; it does not add text-grammar,
reading, or listening material.

The public samples establish presentation mechanics and representative demand,
not an exhaustive content list. Sentence composition uses four fragments and
records the fragment at the starred position after arranging the whole
sentence
([official composition sample](https://www.jlpt.jp/e/samples/pdf/sample_kousei.pdf));
the N4 grammar workbook shows four-choice sentence-form and composition items
in context
([official 2018 N4 grammar sample](https://www.jlpt.jp/samples/sample2018/pdf/N4G.pdf)).
All wording in this tranche is original; official wording was used only to
check the construct and response mechanics.

## Added source inventory

The tranche adds **32 independently identified source seeds**. A lexeme seed
supports three distinct official operations, so the production bank gains
**48 machine-tracked semantic identities** while retaining exactly 200
controlled renderings in every official type cell.

| Source pool                      | Added sources |                      Production semantic effect |
| -------------------------------- | ------------: | ----------------------------------------------: |
| Lexemes                          |             8 | +8 kanji-reading, +8 orthography, +8 paraphrase |
| Contextually defined expressions |             5 |                           +5 context-expression |
| Usage                            |             6 |                                        +6 usage |
| Sentential grammar 1             |             7 |                                 +7 grammar-form |
| Sentence composition             |             6 |                         +6 sentence-composition |
| **Total**                        |        **32** |                                         **+48** |

Resulting N4 machine semantic counts in the changed cells are:

| Official type                    | Before |  After | Rendered records |
| -------------------------------- | -----: | -----: | ---------------: |
| Kanji reading                    |     10 | **18** |              200 |
| Orthography                      |     10 | **18** |              200 |
| Contextually defined expressions |     10 | **15** |              200 |
| Paraphrases                      |     10 | **18** |              200 |
| Usage                            |     10 | **16** |              200 |
| Sentential grammar 1             |     11 | **18** |              200 |
| Sentence composition             |     10 | **16** |              200 |

N4 therefore moves from **191 to 239 generated semantic identities** and,
after the unchanged 20 legacy records are included, from **211 to 259
selectable semantic identities**. It still does **not** contain 200 independent
semantic items in any of these cells; the remainder are controlled surface and
answer-order variants.

## Content review

Every source ID, correct response, and distractor set was reviewed in the
authored file. The following checks were applied:

- **Familiar N4 domain:** hospital reception, library guidance, broken public
  equipment, attendance, transport arrival, schedule changes, neighborhood
  participation, shopping, school, travel, and ordinary household actions.
- **Single keyed response:** contextual stems supply the object, particle,
  cause, or deadline needed to reject the alternatives. Usage distractors use
  the target verb with a wrong argument, particle, transitivity, or collocation.
- **Plausible distractors:** kanji readings use voicing, mora, or on-reading
  confusions; orthography choices use visually or semantically confusable
  characters; grammar alternatives are familiar forms that fail the syntax or
  discourse relation in the supplied sentence.
- **Composition integrity:** each item has four distinct fragments, a single
  reviewed canonical order, and a stable correct fragment at the starred
  position. The full sentence must be natural, not merely the local fragment.
- **No hidden specialist knowledge:** answers depend only on the Japanese in
  the item and common daily situations, consistent with the organizers' N4
  competence description and the official statement that JLPT items do not
  require prior cultural knowledge
  ([official FAQ](https://www.jlpt.jp/e/faq/index.html)).

The authored source identities are:

- Lexeme: `N4-lexeme-reception-desk`, `N4-lexeme-guidance`,
  `N4-lexeme-equipment-breakdown`, `N4-lexeme-attendance`,
  `N4-lexeme-arrival`, `N4-lexeme-schedule-change`,
  `N4-lexeme-participation`, `N4-lexeme-explanation`.
- Context: `N4-context-cancellation-notice`,
  `N4-context-station-locker`, `N4-context-participation-reply`,
  `N4-context-shirt-exchange`, `N4-context-safer-road-choice`.
- Usage: `N4-usage-leave-in-care`, `N4-usage-decline-invitation`,
  `N4-usage-check-locked-door`, `N4-usage-wrong-number`,
  `N4-usage-delivery-arrives`, `N4-usage-illness-recovers`.
- Grammar form: `N4-grammar-reason-node`,
  `N4-grammar-simultaneous-photo-talk`,
  `N4-grammar-visible-small-writing`, `N4-grammar-study-decision`,
  `N4-grammar-benefactive-directions`,
  `N4-grammar-until-homework-finished`,
  `N4-grammar-acquired-newspaper-ability`.
- Composition: `N4-composition-trip-list-preparation`,
  `N4-composition-shared-cooked-meal`,
  `N4-composition-store-home-delivery`, `N4-composition-fever-advice`,
  `N4-composition-meeting-schedule-decision`,
  `N4-composition-convenient-station-bus`.

## Machine evidence and limitations

`n4-language-expansion.test.ts` pins the 32-source inventory, source-ID
uniqueness, four distinct response labels, the rendered key for every
controlled variant, the new per-family semantic counts, sentence-composition
metadata, and assembly of a complete 85-question N4 mock. These tests establish
schema, provenance, key preservation, and engine compatibility. They cannot
prove that every level judgment sounds native or that a distractor has no
unexpected regional/pragmatic reading.

The runtime status remains `machine-validated`; nothing in this tranche is
labelled `human-approved`. A later independent native-Japanese editorial pass
should review naturalness, collocation, second-answer risk, and N4/N3 boundary
placement before any stronger approval claim.
