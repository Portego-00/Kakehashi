# JLPT bank completion-claim audit

Audit date: 2026-08-30
Scope: the current production-selectable N5–N1 banks and their generated-bank
inputs under `web/src/features/jlpt/questions/`
Decision: **the bank has at least 200 records per supported level/type cell, but
does not have 200 independently authored, editorially validated semantic items
per cell**

## Counting rules

This audit keeps four quantities separate:

- A **record** is a selectable question ID. The generator deliberately creates
  exactly 200 records for every supported level/type cell.
- A **semantic item** is the underlying knowledge point, passage argument, or
  listening scenario identified by `provenance.semanticKey`. A changed name,
  date, place, wrapper, or answer order is not a new semantic item.
- A **payload** is a distinct learner-visible prompt, passage or listening
  stimulus plus its answer labels, ignoring answer order and whitespace. This
  count still treats name/date/place substitutions as different payloads, so it
  is a surface-diversity measure rather than an editorial-content count.
- A **controlled variant** is one generated rendering of a semantic item.

The production banks also contain 103 older hand-authored records without
provenance. They are counted as 103 stable fallback semantic identities, but
their editorial state is `untracked`, not approved.

## Aggregate result

| Level | Supported type cells | Generated records | Selectable records | Machine-tracked semantic items | Untracked legacy semantics | Total semantic identities |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 14 | 2,800 | 2,819 | 228 | 19 | 247 |
| N4 | 15 | 3,000 | 3,020 | 239 | 20 | 259 |
| N3 | 17 | 3,400 | 3,421 | 248 | 21 | 269 |
| N2 | 19 | 3,800 | 3,822 | 267 | 22 | 289 |
| N1 | 18 | 3,600 | 3,621 | 250 | 21 | 271 |
| **Total** | **83** | **16,600** | **16,703** | **1,232** | **103** | **1,335** |

All 83 cells therefore pass the literal record-count threshold. No cell passes
the requested threshold when “200 questions” means 200 different semantic
items. The controlled semantic count ranges from **8 to 22 per cell**; even
after adding legacy identities, the range is only **9 to 24** where legacy
items exist.

### 2026-08-30 bounded language-knowledge additions

The N5 tranche added **25 original source items**: 12 lexemes, five contextual
expressions, four grammar-form items, and four sentence-composition items. A
lexeme is deliberately reused across kanji reading, orthography, and
paraphrase, so those 25 authored sources produce **49 cell-scoped semantic
keys**, not 49 independently authored sources. N5 therefore rises from 179 to
228 machine-tracked semantic items.

A separate concurrent N4 tranche added 32 source items and 48 cell-scoped
semantic keys. Three subsequent tranches added 31 N2 sources / 45 semantic
keys, 30 N3 sources / 46 semantic keys, and 30 N1 sources / 40 semantic keys.
Across the five level-specific additions, 148 authored sources added 228
cell-scoped semantic keys. The aggregate tables and regression expectations
include all five tranches. None is counted as proficient-human or
native-speaker approval; all runtime provenance remains `machine-validated`.

## Exact per-level and per-type inventory

Every row contains exactly 200 controlled generated records. `Records` is the
full selectable count after legacy items are added. `Machine semantics` counts
controlled semantic keys. `Total semantics` adds untracked legacy identities.
`Payloads` counts generated learner-visible payloads while ignoring answer
order. `Variants/item` shows how many generated records share each controlled
semantic key.

### N5

| Official type | Records | Machine semantics | Total semantics | Payloads | Variants/item |
| --- | ---: | ---: | ---: | ---: | ---: |
| kanji-reading | 202 | 22 | 24 | 200 | 9–10 |
| orthography | 202 | 22 | 24 | 200 | 9–10 |
| context-expression | 202 | 15 | 17 | 200 | 13–14 |
| paraphrase | 202 | 22 | 24 | 200 | 9–10 |
| grammar-form | 202 | 14 | 16 | 200 | 14–15 |
| sentence-composition | 201 | 14 | 15 | 200 | 14–15 |
| text-grammar | 201 | 22 | 23 | 192 | 9–10 |
| reading-short | 201 | 8 | 9 | 8 | 25 |
| reading-mid | 201 | 9 | 10 | 9 | 22–23 |
| information-retrieval | 201 | 8 | 9 | 8 | 25 |
| listening-task | 202 | 20 | 22 | 20 | 10 |
| listening-key-points | 201 | 20 | 21 | 20 | 10 |
| listening-verbal | 200 | 10 | 10 | 10 | 20 |
| listening-quick-response | 201 | 22 | 23 | 22 | 9–10 |

### N4

| Official type | Records | Machine semantics | Total semantics | Payloads | Variants/item |
| --- | ---: | ---: | ---: | ---: | ---: |
| kanji-reading | 202 | 18 | 20 | 200 | 11–12 |
| orthography | 202 | 18 | 20 | 200 | 11–12 |
| context-expression | 202 | 15 | 17 | 200 | 13–14 |
| paraphrase | 202 | 18 | 20 | 200 | 11–12 |
| usage | 201 | 16 | 17 | 200 | 12–13 |
| grammar-form | 202 | 18 | 20 | 200 | 11–12 |
| sentence-composition | 201 | 16 | 17 | 200 | 12–13 |
| text-grammar | 201 | 22 | 23 | 144 | 9–10 |
| reading-short | 201 | 8 | 9 | 8 | 25 |
| reading-mid | 201 | 9 | 10 | 9 | 22–23 |
| information-retrieval | 201 | 9 | 10 | 9 | 22–23 |
| listening-task | 202 | 20 | 22 | 20 | 10 |
| listening-key-points | 201 | 20 | 21 | 20 | 10 |
| listening-verbal | 200 | 10 | 10 | 10 | 20 |
| listening-quick-response | 201 | 22 | 23 | 22 | 9–10 |

### N3

| Official type | Records | Machine semantics | Total semantics | Payloads | Variants/item |
| --- | ---: | ---: | ---: | ---: | ---: |
| kanji-reading | 202 | 18 | 20 | 200 | 11–12 |
| orthography | 202 | 18 | 20 | 200 | 11–12 |
| context-expression | 202 | 15 | 17 | 200 | 13–14 |
| paraphrase | 201 | 18 | 19 | 200 | 11–12 |
| usage | 202 | 15 | 17 | 200 | 13–14 |
| grammar-form | 202 | 17 | 19 | 200 | 11–12 |
| sentence-composition | 201 | 16 | 17 | 200 | 12–13 |
| text-grammar | 201 | 22 | 23 | 69 | 9–10 |
| reading-short | 201 | 8 | 9 | 8 | 25 |
| reading-mid | 201 | 9 | 10 | 9 | 22–23 |
| reading-long | 201 | 9 | 10 | 9 | 22–23 |
| information-retrieval | 201 | 9 | 10 | 9 | 22–23 |
| listening-task | 201 | 16 | 17 | 16 | 12–13 |
| listening-key-points | 201 | 16 | 17 | 16 | 12–13 |
| listening-outline | 201 | 16 | 17 | 16 | 12–13 |
| listening-verbal | 200 | 10 | 10 | 10 | 20 |
| listening-quick-response | 201 | 16 | 17 | 16 | 12–13 |

### N2

| Official type | Records | Machine semantics | Total semantics | Payloads | Variants/item |
| --- | ---: | ---: | ---: | ---: | ---: |
| kanji-reading | 202 | 17 | 19 | 200 | 11–12 |
| orthography | 201 | 17 | 18 | 200 | 11–12 |
| word-formation | 201 | 14 | 15 | 200 | 14–15 |
| context-expression | 202 | 15 | 17 | 200 | 13–14 |
| paraphrase | 201 | 17 | 18 | 200 | 11–12 |
| usage | 201 | 14 | 15 | 200 | 14–15 |
| grammar-form | 202 | 16 | 18 | 200 | 12–13 |
| sentence-composition | 201 | 15 | 16 | 200 | 13–14 |
| text-grammar | 201 | 22 | 23 | 30 | 9–10 |
| reading-short | 201 | 8 | 9 | 8 | 25 |
| reading-mid | 201 | 8 | 9 | 8 | 25 |
| reading-integrated | 201 | 8 | 9 | 8 | 25 |
| reading-thematic | 201 | 8 | 9 | 8 | 25 |
| information-retrieval | 201 | 8 | 9 | 8 | 25 |
| listening-task | 201 | 16 | 17 | 16 | 12–13 |
| listening-key-points | 201 | 16 | 17 | 16 | 12–13 |
| listening-outline | 201 | 16 | 17 | 16 | 12–13 |
| listening-quick-response | 201 | 16 | 17 | 16 | 12–13 |
| listening-integrated | 201 | 16 | 17 | 16 | 12–13 |

### N1

| Official type | Records | Machine semantics | Total semantics | Payloads | Variants/item |
| --- | ---: | ---: | ---: | ---: | ---: |
| kanji-reading | 202 | 20 | 22 | 200 | 10 |
| context-expression | 202 | 15 | 17 | 200 | 13–14 |
| paraphrase | 201 | 20 | 21 | 200 | 10 |
| usage | 201 | 15 | 16 | 200 | 13–14 |
| grammar-form | 202 | 15 | 17 | 200 | 13–14 |
| sentence-composition | 201 | 15 | 16 | 200 | 13–14 |
| text-grammar | 201 | 22 | 23 | 22 | 9–10 |
| reading-short | 201 | 8 | 9 | 8 | 25 |
| reading-mid | 201 | 8 | 9 | 8 | 25 |
| reading-long | 201 | 8 | 9 | 8 | 25 |
| reading-integrated | 201 | 8 | 9 | 8 | 25 |
| reading-thematic | 201 | 8 | 9 | 8 | 25 |
| information-retrieval | 201 | 8 | 9 | 8 | 25 |
| listening-task | 201 | 16 | 17 | 16 | 12–13 |
| listening-key-points | 201 | 16 | 17 | 16 | 12–13 |
| listening-outline | 201 | 16 | 17 | 16 | 12–13 |
| listening-quick-response | 201 | 16 | 17 | 16 | 12–13 |
| listening-integrated | 201 | 16 | 17 | 16 | 12–13 |

## Template and variant concentration

The semantic concentration is material:

| Semantic items in a cell | Generated records per semantic item | Largest share of the cell represented by one semantic item |
| ---: | ---: | ---: |
| 8 | 25 | 12.5% |
| 9 | 22–23 | 11.5% |
| 10 | 20 | 10% |
| 11 | 18–19 | 9.5% |
| 14 | 14–15 | 7.5% |
| 15 | 13–14 | 7% |
| 16 | 12–13 | 6.5% |
| 17 | 11–12 | 6% |
| 18 | 11–12 | 6% |
| 20 | 10 | 5% |
| 22 | 9–10 | 5% |

Vocabulary, kanji, grammar-form and composition render all 200 records into
different surface payloads. The expanded language-knowledge cells now exercise
14–22 semantic targets. Much of the remaining apparent diversity comes from
names, dates, places, wrappers and order changes.

The concentration is clearest in reading and listening. Most such cells have
only 8–22 distinct payloads. A static authored passage or audio seed is repeated
with answer-order and metadata variants; its Japanese content does not become a
new semantic item. Text grammar sits between these groups: substitutions create
22–192 surface payloads depending on level, but each level still contains only
22 semantic items.

The selection engine correctly stores both record IDs and semantic keys and
prefers unseen semantics first. That delays repetition, but cannot supply more
unique content than the cell contains. After the available 8–22 controlled
semantic items in a cell have been used, subsequent selections must revisit a
known target or scenario even though many unseen record IDs remain.

## Stable IDs, semantic identity and required fields

The new completion regression establishes the following machine facts:

- all 16,600 generated IDs are globally unique and follow the stable
  level/type/index scheme;
- all 16,703 selectable IDs are globally unique;
- a semantic key belongs to exactly one level/type cell;
- every semantic item's variant indices are unique and contiguous from zero;
- every rendering of a semantic key has one consistent content version and
  editorial status;
- the 1,232 variant-zero representatives have no exact internal payload
  collision across two semantic keys;
- every selectable record has non-empty core text, unique non-empty answer
  labels, one stored key, and the required reading, listening or composition
  payload for its family.

These checks establish internal identity integrity. They do not prove that two
different semantic keys are pedagogically independent if their targets are
closely related, and they do not establish external originality.

## Answer-position balance

Generated four-choice cells use each key position exactly 50 times. Generated
three-choice cells use positions 1/2/3 exactly 67/66/67 times. Every expected
position is now asserted explicitly.

The earlier balance regression compared only positions that happened to be
present. A pathological cell with every answer in one position could therefore
have reported a spread of zero and passed. The repaired regression first
requires all expected positions, then limits the count spread to one.

## Editorial coverage

| Runtime editorial status | Records | Semantic items |
| --- | ---: | ---: |
| `untracked` | 103 | 103 |
| `machine-validated` | 16,600 | 1,232 |
| `sampled-ai-review` | 0 | 0 |
| `human-approved` | 0 | 0 |

The audit reports and tranche-specific tests provide useful AI review evidence,
but they do not change runtime provenance to `sampled-ai-review`, and they
cannot assign `human-approved`. No semantic item currently satisfies the
repository's human release gate. `releaseReady` is therefore false for the
generated bank and the full selectable bank.

“Machine validated” means structural tests and the documented AI audits did not
find specified defects. It does not mean a proficient Japanese editor has
approved naturalness, level, distractors, answer uniqueness, or listening
delivery.

## Originality evidence and limits

Current positive evidence includes:

- seed and expansion tests reject stable-ID, semantic-focus and normalized
  script collisions against their respective baselines;
- several tranche tests screen known official-sample phrases and suspicious
  attribution/copy markers;
- focused audit documents compare mechanics and selected wording with official
  public examples;
- the new bank-wide test rejects exact internal collisions among the 1,232
  variant-zero representative payloads.

This is **not** a corpus-wide originality proof. There is no complete external
fingerprint comparison against all official released workbooks and relevant
third-party banks, and short conventional Japanese phrases cannot reliably be
classified by exact-match automation alone. The current evidence supports
“originally authored with automated red-flag checks,” not “independently proven
free of all source overlap.”

## Completion decision

The safe claim is:

> Kakehashi currently has at least 200 selectable generated variants for every
> supported JLPT level/type cell, with stable IDs, semantic-aware randomization,
> complete required fields, and balanced answer positions.

The unsafe claims are:

- “minimum 200 different questions per type per level” when *different* means
  independently authored semantic items;
- “200 human/native-validated questions per cell”;
- “all 16,600 records were independently checked for naturalness, level and
  originality.”

Reaching the user's requested content threshold requires **200 current,
independently authored semantic items in each of the 83 supported cells**, plus
tracked proficient-editor review. Controlled surface renderings can remain as
delivery variants, but must not be counted toward that editorial target.

## Regression added

`web/src/features/jlpt/questions/generated/completion-claim.test.ts` now pins:

- exact record and semantic counts for all 83 cells;
- exact surface-payload concentration;
- global ID and semantic ownership;
- contiguous per-semantic variant indices;
- internal representative-payload uniqueness;
- required fields;
- complete answer-position coverage and balance; and
- exact runtime editorial coverage, including zero human-approved semantics.

The answer-position assertion in `generated-bank.test.ts` was also strengthened
to require every expected position before checking balance.
