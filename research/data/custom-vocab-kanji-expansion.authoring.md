# Kanji expansion authoring report

_Authoring and verification record, 2026-09-01._

## Outcome

`custom-vocab-kanji-expansion.json` contributes 156 kanji vocabulary lessons in exactly twelve five-level WaniKani bands. Every pack contains 13 words. All written forms and IDs are unique, and every word's `requiredLevel` is the maximum live WaniKani level of its visible constituent kanji.

| Pack | Declared band | Words | Lowest required level | Highest required level |
| --- | ---: | ---: | ---: | ---: |
| `kanji-expansion-01-05` | 1–5 | 13 | 3 | 5 |
| `kanji-expansion-06-10` | 6–10 | 13 | 6 | 10 |
| `kanji-expansion-11-15` | 11–15 | 13 | 11 | 15 |
| `kanji-expansion-16-20` | 16–20 | 13 | 16 | 20 |
| `kanji-expansion-21-25` | 21–25 | 13 | 22 | 25 |
| `kanji-expansion-26-30` | 26–30 | 13 | 26 | 29 |
| `kanji-expansion-31-35` | 31–35 | 13 | 31 | 35 |
| `kanji-expansion-36-40` | 36–40 | 13 | 36 | 40 |
| `kanji-expansion-41-45` | 41–45 | 13 | 41 | 45 |
| `kanji-expansion-46-50` | 46–50 | 13 | 46 | 50 |
| `kanji-expansion-51-55` | 51–55 | 13 | 51 | 55 |
| `kanji-expansion-56-60` | 56–60 | 13 | 56 | 59 |

The first and last observed levels do not need to touch both declared boundaries. The invariant is that every word falls inside its exact five-level band; all 156 do.

## Primary evidence

Written form, canonical reading, applicable sense, and part-of-speech evidence came from the official [JMdict English XML distribution](https://www.edrdg.org/pub/Nihongo/JMdict_e.gz) and its [DTD documentation](https://www.edrdg.org/jmdict/jmdict_dtd_h.html). The local compressed source was fetched on 2026-09-01, reports a 2026-09-01 JMdict creation date, and has SHA-256 `a2cce17805c392712a9569c515076ae84a0091281b54542753de1060add8c55e`.

- 156 of 156 written-reading pairs resolve to an applicable JMdict sense.
- The selected rows resolve to 156 distinct JMdict entries.
- 156 of 156 have at least one JMdict priority marker.
- 130 carry `ichi1`; 131 carry `news1`; six carry `spec1`. These counts overlap.
- Every context sentence was authored for the selected sense and contains the written form or a natural inflection. Contexts are not represented as JMdict quotations.

WaniKani exclusion and level evidence came from the local 6,825-subject vocabulary snapshot and 2,102-subject kanji snapshot, then from a full live [WaniKani Subjects API](https://docs.api.wanikani.com/20170710/#subjects) audit on 2026-09-01. The live response contained 6,825 vocabulary/kana-vocabulary subjects and 2,101 visible kanji.

## Exclusion record

The final 156 written forms were compared with 409 previously authored custom forms: 48 original kana words, 120 kana candidates, 120 kana expansion words, and 121 kanji candidates. Unicode NFKC-normalized exact and polite-prefix/`する` lexical keys produced zero overlaps with those sources and zero overlaps with the WaniKani snapshot.

The live audit additionally compared canonical readings and accepted English meanings so a spelling variant could not masquerade as a new lexeme. A whole-JMdict-entry family check also rejects an entry when any of its alternative written forms belongs to WaniKani or another custom lesson. Five late candidates failed those stronger gates and were replaced:

| Rejected custom spelling | Existing WaniKani lexeme | Replacement | Band |
| --- | --- | --- | ---: |
| `売上` | `売り上げ` | `市民` | 6–10 |
| `締め切り` | `締切` | `河川` | 26–30 |
| `瓶詰め` | `瓶詰` | `頂点` | 51–55 |
| `子守唄` | `子守歌` | `拍車` | 56–60 |
| `御無沙汰` | `ご無沙汰` | `擬似` | 56–60 |

An earlier curation pass also removed `放送`, `連絡`, `保護`, `投票`, `検討`, `招待`, `妊娠`, `解雇`, `洗濯`, and `風呂` after exact-family or normalized lexical checks found that WaniKani already covered the lesson. None appears in the final source.

The final live result is zero exact written-form collisions, zero same-reading-and-meaning lexical collisions, zero same-JMdict-entry spelling-family collisions, and zero level mismatches across all 156 additions.

## Mnemonic evidence and gates

Meaning mnemonics follow the repository's composition-first standard:

- the first paragraph covers each distinct written kanji in character order;
- every component has its own `<kanji>` cue using the live WaniKani primary gloss;
- that paragraph reaches an accepted meaning inside `<vocabulary>`; and
- a blank line introduces a substantive usage, register, nuance, or contrast paragraph.

The live composition auditor passed all 156 words against 2,101 visible WaniKani kanji. This audit specifically checks exact live glosses, written component order, accepted meaning payoffs, level bands, and paragraph structure.

Reading mnemonics use verified component readings, explicitly described rendaku or clipping where applicable, one highlighted `<reading>` hook, a concrete scene, a highlighted `<vocabulary>` consequence, and a practical usage ending. The former repeated “component sounds lock into” scaffold is absent. All 156 learner-facing reading mnemonics are distinct; all 156 hidden `readingMap` values and highlighted cues pass the production reading fixture validator.

An independent editor then inspected every entry's reading path, rendered composition prose, contexts, and JMdict-backed parts of speech. The correction pass removed 17 false `transitive verb` labels caused by matching “transitive verb” inside the text “intransitive verb,” rewrote every flagged composition and sound-change explanation, replaced two awkward contexts, and replaced the WaniKani spelling-family collision `御無沙汰` with `擬似`.

## Machine-checked invariants

- 12 packs, each declaring one exact five-level band from 1–5 through 56–60
- 156 total words and 156 unique word IDs
- 156 unique written forms
- 156 natural Japanese/English context pairs
- 156 JMdict-verified written-reading pairs
- 156 composition mnemonics passing the live WaniKani gloss/order gate
- 156 reading mnemonics passing reading-map and markup validation
- zero WaniKani live collisions and zero constituent-level mismatches

`readingMap`, JMdict entry/sense resolution, priority tags, and audit counts are authoring evidence. They are not intended as learner-facing mnemonic prose.
