# Kana reading-mnemonic validation

Validation date: 2026-09-01 (Europe/Madrid)

Source: [`custom-vocab-kana-candidates.json`](./custom-vocab-kana-candidates.json)  
Editorial standard: [`custom-vocabulary-reading-mnemonic-rubric.md`](../custom-vocabulary-reading-mnemonic-rubric.md)  
Audited source SHA-256: `1c8eacc9965878b958368e94e474bc1c412f268c8d21cb964723b137d0e4790e`

## Outcome

**Pass: 120. Revise: 0. Reject: 0.**

All 120 final reading mnemonics pass the deterministic reading checks and the independent editorial review. There are no non-pass entries.

| Pack | Audited | Pass | Revise |
| --- | ---: | ---: | ---: |
| At the Café Table | 12 | 12 | 0 |
| Casual Meals & Treats | 14 | 14 | 0 |
| Conversation Signals | 11 | 11 | 0 |
| Clear, Careful & Complete | 13 | 13 | 0 |
| Home Comfort | 13 | 13 | 0 |
| Everyday Clothes | 12 | 12 | 0 |
| Travel & Places | 11 | 11 | 0 |
| Digital Essentials | 12 | 12 | 0 |
| Music, Media & Play | 10 | 10 | 0 |
| Shopping Smart | 12 | 12 | 0 |
| **Total** | **120** | **120** | **0** |

## Deterministic checks

- All 120 mnemonics end with the required `Reading map: <reading>…</reading> → <reading>canonical reading</reading>.` structure.
- All 120 map token sequences concatenate exactly to their canonical reading, in order.
- All 120 final answers exactly equal the canonical reading.
- Small-kana clusters are kept with their base kana and validated as one reading unit. All 19 entries containing such clusters pass.
- All 31 entries containing small `っ` or `ッ` explicitly account for the held consonant or, for word-final interjections such as `あっ` and `えっ`, the abrupt cut-off.
- All 44 entries containing `ー` explicitly account for the prolonged sound in nearby prose; multiple marks are accounted for individually.
- All 29 entries containing moraic `ん` or `ン` now identify it explicitly in the local cue sentence and give it its own beat.
- Every mnemonic contains exactly the two required `<reading>` spans. No unsupported tags, duplicate mnemonic text, missing units, extra units, reordered units, or automated mismatches were found.

## Revision history

The initial audit covered source SHA-256 `42041abb2e3611f47ff8ad3e928432f3728971dc32c0539f11b3ec72432072d9`. A subsequent sentence-local clarity pass repaired 38 unique mnemonic setups: 29 made moraic `ん` or `ン` explicit, 15 tightened `ー` explanations, and 6 entries belonged to both groups. That revision was then re-audited in full, not sampled. All 120 maps and exact answers remained correct, and the repaired prose introduced no false sound-alike, source-language, or pronunciation claims.

A later targeted clarity pass tightened nine of those explanations further: `meals-baabekyuu`, `signals-a`, `signals-e`, `travel-pasupooto`, `digital-kiiboodo`, `digital-purintaa`, `media-konsaato`, `shopping-kuupon`, and `shopping-reshiito`. Those nine received a separate independent review, followed by another complete 120-word audit against source SHA-256 `1c8eacc9965878b958368e94e474bc1c412f268c8d21cb964723b137d0e4790e`. Both gates returned nine passes and zero revisions for the targeted set, and 120 passes and zero revisions overall.

## Targeted nine-entry re-audit

| Word ID | Required units | Special-unit result | Result |
| --- | --- | --- | --- |
| `meals-baabekyuu` | `バ・ー・ベ・キュ・ー` | Both long marks are tied locally to the correct preceding vowels; `キュ` remains one cluster. | Pass |
| `signals-a` | `あ・っ` | Word-final `っ` is correctly explained as an abrupt cut-off, without inventing a following consonant. | Pass |
| `signals-e` | `え・っ` | Word-final `っ` is correctly explained as an abrupt cut-off, without inventing a following consonant. | Pass |
| `travel-pasupooto` | `パ・ス・ポ・ー・ト` | `ー` locally extends the `o` of `ポ` for one more beat. | Pass |
| `digital-kiiboodo` | `キ・ー・ボ・ー・ド` | The two long marks are localized separately to the `i` of `キ` and the `o` of `ボ`. | Pass |
| `digital-purintaa` | `プ・リ・ン・タ・ー` | `ン` is explicitly moraic; `ー` locally extends the `a` of `タ`. | Pass |
| `media-konsaato` | `コ・ン・サ・ー・ト` | `ン` is explicitly moraic; `ー` locally extends the `a` of `サ`. | Pass |
| `shopping-kuupon` | `ク・ー・ポ・ン` | `ー` locally extends the `u` of `ク`; `ン` is explicitly moraic. | Pass |
| `shopping-reshiito` | `レ・シ・ー・ト` | `ー` locally extends the `i` of `シ`. | Pass |

Each targeted mnemonic has exactly two balanced, supported `<reading>` spans: an ordered map that concatenates to the canonical reading and an exact final answer. Their direct cues remain meaning-connected and make no English sound-equivalence or unsupported etymology claim.

## Editorial checks

Each entry was reviewed individually with its written form, canonical reading, meaning, and meaning mnemonic visible.

- **Cue honesty:** no entry depends on a false English sound-alike or an unsupported source-language claim. Where a reliable sound cue would be strained, the prose uses direct rhythmic chunking.
- **Meaning connection:** every setup sentence gives a concrete scene, object, action, or conversational use tied to the taught meaning.
- **Special-unit handling:** sokuon, moraic nasal, prolonged sound marks, long-vowel kana, and small-kana clusters are described without inventing or dropping sounds.
- **Prose quality:** the cues are concise, grammatical, semantically specific, and varied enough to function as mnemonics rather than identical boilerplate. The repeated map suffix is intentional validation scaffolding.

## Non-reading-field preservation

The candidate was checked against its own metadata and the prior [`custom-vocab-kana-candidates.validation.md`](./custom-vocab-kana-candidates.validation.md) invariants:

- metadata still reports 10 packs and 120 candidates, matching the actual contents;
- the priority summary still totals 120;
- all 120 word IDs and normalized written forms remain unique;
- all visible forms remain kana-only and every canonical reading still matches its visible kana form after normalization;
- every non-reading field required by the documented production shape is present and non-empty;
- all 120 entries still contain two valid Japanese/English context pairs, for 240 pairs total, and each Japanese example contains its target form.

No non-reading-field invariant recorded by the source validation metadata has changed. The 10 final candidate packs also match their counterparts in the generated production catalog field-for-field. This audit did not modify the candidate JSON.

## Entries requiring revision

None.
