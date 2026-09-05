# JLPT N2 language-knowledge expansion audit

_Authored and machine-audited 2026-08-30. This is not official JLPT,
human-editor, or native-Japanese approval._

## Official N2 authoring boundary

N2 measures understanding of Japanese used in everyday situations plus a
broader range of circumstances to a certain degree. Its reading description
includes clearly written articles, commentaries, and simple critiques on varied
topics, plus following narrative flow and author intent in general-topic
writing
([official N2 level description](https://www.jlpt.jp/e/about/levelsummary.html)).
The language items in this tranche therefore use public services, work,
research, safety, costs, surveys, technology, and decision-making without the
high abstraction or compressed rhetoric expected at N1.

The official N2 purpose sheet defines six vocabulary operations: kanji
reading, orthography, word formation, contextual meaning, paraphrase, and
usage. It also defines grammar-form selection, sentence composition, and text
grammar
([official N2 purpose sheet](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf)).
The current official matrix makes word formation an N2-only family among
N1–N5
([official test-item matrix](https://www.jlpt.jp/e/guideline/testsections.html)).
This tranche expands all of the thin non-text language pools, including word
formation; it does not add text-grammar, reading, or listening material.

The organizers do not publish a current prescriptive list of N2 vocabulary,
kanji, and grammar. They direct users to the level description, composition of
items, and official samples instead
([official FAQ](https://www.jlpt.jp/e/faq/index.html)). Consequently, every
level placement here is an editorial judgment against the N2 competence and
item-purpose descriptions, not a claim that an item appears on an official
syllabus.

The public N2 vocabulary and grammar workbooks were used to check response and
presentation mechanics only
([official 2018 N2 vocabulary sample](https://www.jlpt.jp/samples/sample2018/pdf/N2V.pdf),
[official 2018 N2 grammar sample](https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf)).
No official wording was copied or adapted.

## Added source inventory

The tranche adds **31 independently identified source seeds**. Seven lexeme
seeds each support three different official operations, so production gains
**45 machine-tracked semantic identities** while retaining exactly 200
controlled renderings per official type.

| Source pool                      | Added sources |                      Production semantic effect |
| -------------------------------- | ------------: | ----------------------------------------------: |
| Lexemes                          |             7 | +7 kanji-reading, +7 orthography, +7 paraphrase |
| Word formation                   |             4 |                               +4 word-formation |
| Contextually defined expressions |             5 |                           +5 context-expression |
| Usage                            |             4 |                                        +4 usage |
| Sentential grammar 1             |             6 |                                 +6 grammar-form |
| Sentence composition             |             5 |                         +5 sentence-composition |
| **Total**                        |        **31** |                                         **+45** |

Resulting N2 machine semantic counts in the changed cells are:

| Official type                    | Before |  After | Rendered records |
| -------------------------------- | -----: | -----: | ---------------: |
| Kanji reading                    |     10 | **17** |              200 |
| Orthography                      |     10 | **17** |              200 |
| Word formation                   |     10 | **14** |              200 |
| Contextually defined expressions |     10 | **15** |              200 |
| Paraphrases                      |     10 | **17** |              200 |
| Usage                            |     10 | **14** |              200 |
| Sentential grammar 1             |     10 | **16** |              200 |
| Sentence composition             |     10 | **15** |              200 |

N2 therefore moves from **222 to 267 generated semantic identities** and,
after the unchanged 22 legacy records are included, from **244 to 289
selectable semantic identities**. These cells still do not contain 200
independent semantic questions; the remaining records are controlled surface
and answer-order variants.

## Content review

Every source, keyed answer, and distractor set was reviewed against these
criteria:

- **N2 discourse domain:** each item fits clear general-interest, public,
  academic, or professional communication without relying on specialist facts.
- **Unique contextual key:** collocations such as `予想を上回る`,
  `原因を断定する`, `事情を考慮する`, `意見を反映させる`, and
  `影響を最小限に抑える` are fixed by the supplied argument and discourse
  relation.
- **Plausible misconceptions:** reading distractors use mora, voicing, or
  on-reading confusions; orthography distractors use visually or semantically
  confusable characters; usage distractors preserve the focus word while
  changing its argument structure, transitivity, or collocation.
- **N2 grammar contrast:** alternatives are familiar forms but fail the stated
  risk, concession, cause, scope, or reversal. The keyed relation is not merely
  a rarer expression placed beside nonsense.
- **N2-specific word formation:** the four seeds test established derivative or
  compound patterns—`電子化`, `再開`, `未解決`, and `再現性`—rather than
  treating the family as another contextual vocabulary blank.
- **Composition integrity:** all four fragments participate in one reviewed
  syntactic order, and the recorded fragment at the starred position is stable
  across controlled answer-order variants.

The audit replaced `相異` and `見透し`, which could be defended as rare
same-reading or related spellings, and changed usage distractors that invoked
valid secondary senses in `席を占める` and `資料を見合わせる`. It also changed
a grammar alternative that could function as a valid prediction where the key
was intended as advice. These repairs remove the clearest second-answer risks
identified during authorship review.

## Source identities

- Lexeme: `N2-lexeme-expert-view`, `N2-lexeme-widespread-adoption`,
  `N2-lexeme-serious-shortage`, `N2-lexeme-room-for-improvement`,
  `N2-lexeme-opinion-difference`, `N2-lexeme-future-outlook`,
  `N2-lexeme-pointing-out-problem`.
- Context: `N2-context-exceed-forecast`,
  `N2-context-premature-conclusion`,
  `N2-context-consider-local-conditions`,
  `N2-context-reflect-public-feedback`,
  `N2-context-minimize-budget-impact`.
- Usage: `N2-usage-express-concern`, `N2-usage-postpone-departure`,
  `N2-usage-account-for-share`, `N2-usage-additional-cost-arises`.
- Grammar form: `N2-grammar-risk-losing-trust`,
  `N2-grammar-regardless-of-experience`,
  `N2-grammar-popular-despite-price`, `N2-grammar-safest-course`,
  `N2-grammar-result-due-to-revision`, `N2-grammar-worse-after-repair`.
- Composition: `N2-composition-interpret-survey-conditions`,
  `N2-composition-benefit-and-new-problem`,
  `N2-composition-confirm-facts-first`,
  `N2-composition-open-discussion-environment`,
  `N2-composition-analyze-before-failure-judgment`.
- Word formation: `N2-word-formation-digitization`,
  `N2-word-formation-resume-operation`,
  `N2-word-formation-unresolved-issue`,
  `N2-word-formation-reproducibility`.

## Machine evidence and limitations

`n2-language-expansion.test.ts` pins the 31-source inventory, stable identity
and response-set uniqueness, every rendered key, post-expansion semantic
counts, sentence-composition order metadata, 200-record family contracts, and
assembly of the complete 107-question N2 mock. These checks prove schema,
provenance, answer preservation, and mock compatibility; they do not prove
native naturalness, editorial level placement, or the absence of an unexpected
pragmatic reading.

All runtime content remains `machine-validated`. A separate native-Japanese
editorial review should assess collocation, distractor plausibility, second-key
risk, and the N2/N1 and N2/N3 boundaries before any `human-approved` claim.
