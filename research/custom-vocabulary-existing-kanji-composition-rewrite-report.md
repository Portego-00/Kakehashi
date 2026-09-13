# Existing kanji vocabulary composition rewrite report

Date: 2026-09-01  
Source catalog: `research/data/custom-vocab-kanji-candidates.json`  
WaniKani API revision checked: `20170710`

## Outcome

All 121 existing kanji-vocabulary words now have an original composition-first `meaningMnemonic`.

Every rewritten mnemonic has:

- a first paragraph with exactly one `<kanji>` cue for every distinct written kanji, in written order;
- component glosses matching a live accepted meaning of the corresponding official WaniKani kanji subject;
- at least one accepted custom-word meaning inside `<vocabulary>` in the first paragraph;
- a blank line followed by a substantive usage, register, collocation, or nuance paragraph;
- balanced semantic markup using only `<kanji>` and `<vocabulary>` in this rewrite;
- original prose rather than copied WaniKani mnemonic text.

Transparent compounds use a short direct composition bridge. Less transparent compounds use a concrete memory scene without presenting the scene as etymology. For example, the 風呂敷 mnemonic explicitly identifies its component scene as a memory aid rather than a claim about the word's origin.

## Pack repartition

The six former ten-level packs were replaced with twelve exact five-level packs. Each word is assigned by its existing exact `requiredLevel`, and every word appears exactly once.

| Pack | Range | Words |
| --- | --- | ---: |
| `kanji-everyday-01-05` | 1–5 | 15 |
| `kanji-everyday-06-10` | 6–10 | 12 |
| `kanji-everyday-11-15` | 11–15 | 20 |
| `kanji-everyday-16-20` | 16–20 | 3 |
| `kanji-everyday-21-25` | 21–25 | 16 |
| `kanji-everyday-26-30` | 26–30 | 5 |
| `kanji-everyday-31-35` | 31–35 | 13 |
| `kanji-everyday-36-40` | 36–40 | 6 |
| `kanji-everyday-41-45` | 41–45 | 12 |
| `kanji-everyday-46-50` | 46–50 | 5 |
| `kanji-everyday-51-55` | 51–55 | 11 |
| `kanji-everyday-56-60` | 56–60 | 3 |
| **Total** | 1–60 | **121** |

The ranges are exact even where the current candidate set has no word at every individual level. No word was moved outside the five-level band containing its `requiredLevel`.

## Preservation checks

The word IDs were deliberately left unchanged even though their old ID prefixes mention ten-level ranges. This preserves the stable identity needed to retain existing lesson and review progress during the pack-split migration.

- Words before and after: 121
- Unique word IDs after: 121
- Duplicate word IDs: 0
- Missing or extra word IDs: 0
- Sorted ID-set SHA-256 before and after: `2c491aa0b05d4fd3239161e9ec44d04f6e69d933e8c5273b77a9e7350f3531a2`
- Canonical SHA-256 of every word with only `meaningMnemonic` removed, sorted by ID, before and after: `89540fc293a05b416edc89add3f9cb24788bf687f9090fc4f3ffaf2f7655dca4`

The unchanged canonical hash verifies that every non-`meaningMnemonic` word field was preserved, including readings, meanings, parts of speech, exact levels, kanji-level maps, JMdict priority evidence, reading mnemonics, context sentences, and reading maps.

## Validation performed

A read-only validation pass parsed the finished JSON and checked:

1. exactly twelve packs with ranges 1–5, 6–10, …, 56–60;
2. every word's `requiredLevel` lies inside its pack;
3. 121 total and 121 unique stable word IDs;
4. one first-paragraph `<kanji>` cue per distinct written kanji, in order;
5. every cue matches a current accepted meaning from the live official [WaniKani kanji subjects endpoint](https://api.wanikani.com/v2/subjects?types=kanji);
6. stored component levels still equal the live WaniKani levels;
7. a first-paragraph `<vocabulary>` payoff matches at least one accepted word meaning;
8. a non-empty second paragraph after a blank line;
9. allowed tags, correct nesting, and balanced closing tags;
10. duplicate IDs and pack-range violations;
11. preservation hashes for IDs and every non-meaning-mnemonic word field.

Final result: **0 validation errors**.

The authorized API token was used only in request headers for the live validation and was neither printed nor persisted.

## Reusable audit

The read-only audit is preserved at `research/audit-kanji-composition-mnemonics.mjs`. With no path arguments it checks both the existing and expansion kanji sources when they are present:

```sh
WANIKANI_API_TOKEN='<token>' node research/audit-kanji-composition-mnemonics.mjs
```

To check only this rewritten source:

```sh
WANIKANI_API_TOKEN='<token>' node research/audit-kanji-composition-mnemonics.mjs research/data/custom-vocab-kanji-candidates.json
```

The script reads the token only from `WANIKANI_API_TOKEN`, never includes it in output, performs no file writes, and exits unsuccessfully on invalid JSON, exact-band or word-level mismatches, duplicate pack or word IDs, component cue count/order errors, non-accepted live WaniKani glosses, missing accepted first-paragraph vocabulary payoffs, insufficient usage paragraphs, or invalid mnemonic markup.
