# JLPT N1 language-knowledge expansion research and audit

Research and machine-audit date: 2026-08-30

This note records the first-party constraints used for the bounded N1
language-knowledge tranche. It does not reproduce or adapt official question
wording. Every added sentence, answer, distractor, and explanation is original.

Nothing in this tranche has human-editor or native-speaker approval. Its
editorial status remains `machine-validated`.

## Primary sources reviewed

- [Official N1–N5 competence summary](https://www.jlpt.jp/e/about/levelsummary.html)
- [Official composition of test sections and items](https://www.jlpt.jp/e/guideline/testsections.html)
- [Official N1 purposes of test items](https://www.jlpt.jp/e/guideline/pdf/n1_e_revised.pdf)
- [2018 Official Practice Workbook: N1 vocabulary](https://www.jlpt.jp/samples/sample2018/pdf/N1V.pdf)
- [2018 Official Practice Workbook: N1 grammar](https://www.jlpt.jp/samples/sample2018/pdf/N1G.pdf)
- [Official practice-workbook index and copyright notice](https://www.jlpt.jp/e/samples/sampleindex.html)
- [Official JLPT FAQ](https://www.jlpt.jp/e/faq/index.html)

## Verified N1 boundary and limitations

The organizers describe N1 as the ability to understand Japanese used in a
variety of circumstances. Its reading target includes logically complex or
abstract writing across varied topics, with structure, content, narrative, and
writer intent understood comprehensively. The same official page says that
vocabulary and grammar knowledge is required to perform those language
activities, but it does not enumerate that knowledge.

The official FAQ explains that the post-2010 JLPT does **not** publish a current
prescriptive vocabulary, kanji, or grammar list. It directs readers instead to
the competence summary, item-composition tables, and sample questions. These
sources therefore support the difficulty texture and tested operations, not a
claim that any particular word or form is on an official N1 syllabus. All level
placements in this tranche remain editorial judgments.

N1 combines Language Knowledge (Vocabulary/Grammar) and Reading in one
110-minute section. For vocabulary, N1 includes kanji reading,
contextually-defined expressions, paraphrases, and usage; unlike N2–N5, it does
not include orthography, and unlike N2 it does not include word formation. Its
grammar families are selecting a grammar form, sentence composition, and text
grammar. This tranche expands the first six low-semantic language-knowledge
families and leaves text grammar, reading, and listening unchanged.

## Mechanics confirmed from official material

The N1 purpose sheet defines the relevant constructs:

- **Kanji reading:** identify the reading of a word written in kanji.
- **Contextually-defined expressions:** choose the word whose meaning/use is
  fixed by its sentence context.
- **Paraphrases:** choose a word or expression with a similar meaning.
- **Usage:** identify the sentence in which a target word is used correctly.
- **Selecting grammar form:** choose the grammar form that suits the sentence.
- **Sentence composition:** form a syntactically accurate, meaningful sentence.

The 2018 official booklets were inspected for response mechanics only. The
vocabulary booklet presents the four families above as four-choice items. The
grammar booklet presents a four-choice sentence blank, then four fragments
which must all be arranged before selecting the fragment at `★`; its following
family judges suitability in the flow of a whole text. Kakehashi's expanded
items preserve these operations and four-option structure. No official stem,
lexeme set, sentence, answer set, or scenario was used as a content template.

The official workbook page also warns that released materials are
copyright-protected and that some N1 materials include third-party works. This
reinforces the strict format-only use of the samples.

## Authored tranche and semantic effect

The tranche adds **30 distinct source concepts**:

| Source pool | New sources | Runtime semantic effect |
| --- | ---: | ---: |
| Lexemes | 10 | +10 kanji-reading and +10 paraphrase |
| Contextually-defined expressions | 5 | +5 context-expression |
| Usage | 5 | +5 usage |
| Selecting grammar form | 5 | +5 grammar-form |
| Sentence composition | 5 | +5 sentence-composition |
| **Total** | **30** | **+40 cell-scoped semantic identities** |

The generated bank still contains 200 renderings in every N1 type cell. The
changed semantic counts are:

| Official family | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Kanji reading | 10 | 20 | +10 |
| Contextually-defined expressions | 10 | 15 | +5 |
| Paraphrases | 10 | 20 | +10 |
| Usage | 10 | 15 | +5 |
| Selecting grammar form | 10 | 15 | +5 |
| Sentence composition | 10 | 15 | +5 |

All unchanged N1 families retain their prior semantic counts. Consequently,
the N1 generated bank moves from **210 to 250** semantic identities; the
production-selectable bank, including its unchanged 21 legacy identities,
moves from **231 to 271**. Rendered record totals remain 3,600 generated and
3,621 selectable. These are content-identity counts, not claims of 200
independently authored questions per family.

## Authoring and machine-validation decisions

1. Lexical items use formal but broadly applicable domains such as budgets,
   institutional trust, joint projects, policy scope, public support, and
   market change rather than specialist knowledge.
2. Context items supply a decisive causal or collocational cue. Distractors are
   real advanced words that remain grammatically plausible where practical but
   contradict the complete sentence.
3. Usage items keep the same target expression in all four sentences. Wrong
   choices use a plausible neighboring verb or adverbial function while failing
   the target's argument structure or collocation.
4. Grammar items test relations characteristic of advanced formal discourse:
   exclusive suitability, formal purpose, unintentional action, unavoidable
   effect, and two factors acting together. The complete sentence, not an
   isolated suffix, determines the key.
5. Composition items have four distinct fragments, a stable canonical order,
   and fixed dependencies around `に足る`, `いかんにかかわらず`,
   `ものともせず`, `以上…わけにはいかない`, and `ものの`.
6. Lexical surfaces and usage focuses are stable source/runtime identities;
   contextual, grammar, and composition items carry explicit stable semantic
   IDs. Surface substitutions and option rotation remain variants.
7. Focused tests pin the 30-source inventory, 40 runtime identities, unique
   option sets, reviewed keys, canonical composition order, placeholder
   rendering, per-cell counts, and construction of a complete N1 mock.

## Remaining editorial risk

Automated checks establish schema integrity, stable provenance, mock-engine
compatibility, and the reviewed answer keys. They cannot prove native
naturalness, corpus-wide originality, or that no distractor has an unexpected
regional or pragmatic reading. Official sources also cannot certify individual
level placement because no item list exists. A proficient Japanese editor with
N1 item-writing experience must review all 40 semantic identities before any
`human-approved` status is appropriate.
