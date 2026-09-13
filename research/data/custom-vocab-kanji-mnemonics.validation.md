# Kanji reading-mnemonic independent validation

Validation date: 2026-09-01 (Europe/Madrid)

## Outcome

This is an independent editorial audit of all 121 `readingMnemonic` values in
[`custom-vocab-kanji-candidates.json`](./custom-vocab-kanji-candidates.json).
The author of those mnemonics did not perform this review.

Audited source SHA-256:
`fac47a5c638eee4aff2fdb34a1728ba5d17f353b37b3ea906716bea330985cac`.

| Result | Words |
| --- | ---: |
| Pass | 121 |
| Revise | 0 |
| Reject | 0 |
| **Total** | **121** |

The six entries that initially needed clearer final-`ん` timing have been
revised and independently rechecked. All now identify `ん` as moraic and say
that it takes its own beat. No false semantic story, component reading,
sound-change claim, English cue, or canonical answer was found.

## Sources and method

The audit applied every gate in the project
[`reading-mnemonic rubric`](../custom-vocabulary-reading-mnemonic-rubric.md):

1. A deterministic parser NFKC-normalized every canonical reading, parsed the
   final `Reading map:`, removed `・`, `+`, and whitespace, and compared the
   result with the canonical reading.
2. The parser independently tokenized ordinary kana, small-kana clusters,
   `っ`, `ん`, and long-vowel notation, then compared the ordered unit list
   with the authored map.
3. The exact written-form/reading pair and applicable sense were checked
   against the existing raw-JMdict audit recorded in
   [`custom-vocab-kanji-candidates.validation.md`](./custom-vocab-kanji-candidates.validation.md).
   That audit re-resolved all 121 pairs with reading and sense restrictions and
   found zero missing or restricted pairs. JMdict's official DTD defines those
   restrictions ([EDRDG JMdict DTD](https://www.edrdg.org/jmdict/jmdict_dtd_h.html)).
4. Every claimed isolated on-reading, kun-reading, or okurigana split was
   cross-checked against the current official KANJIDIC2 XML. KANJIDIC2 defines
   `ja_on` and `ja_kun` as Japanese reading fields
   ([official KANJIDIC2 overview](https://www.edrdg.org/kanjidic/kanjidic2_ov_legacy.html))
   and publishes the current XML from its project page
   ([official KANJIDIC2 files](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html)).
   Whole-word JMdict evidence, not an isolated kanji reading, remained the
   authority for each final answer.
5. Each rendaku, contraction, voicing, or irregular-reading explanation was
   challenged against its attested base chunks and whole-word result. This
   follows NINJAL's description of rendaku as voicing at a compound boundary
   rather than a freely predictable reading rule
   ([NINJAL](https://kotoba.ninjal.ac.jp/qa/yokuaru/qa-121/)).
6. The cue or scene was reviewed for semantic truth, declared sound coverage,
   usefulness, and possible misleading associations. The file uses direct
   kana or component coaching rather than English sound-keyword claims. The
   `誇り` mnemonic's `ほこり` dust association is an exact Japanese homophone,
   not an approximate English cue.

## Aggregate checks

| Check | Result |
| --- | ---: |
| Exact final `<reading>` answer | 121 / 121 |
| Map concatenates to canonical reading | 121 / 121 |
| Ordered coverage units exactly match | 121 / 121 |
| Exact JMdict written-form/reading pair and sense | 121 / 121 |
| Small-kana clusters grouped correctly | 33 / 33 |
| Small `っ` timing explained | 4 / 4 |
| Moraic `ん` timing explained | 34 / 34 |
| Written hiragana long-vowel unit retained and explained | all applicable entries |
| Unsupported or unbalanced mnemonic markup | 0 |
| False component or semantic claims | 0 |
| Undeclared or implausible English sound cues | 0 |

The four sokuon entries correctly state that `っ` holds the following
consonant for one beat. Long vowels written with `う` or `い` remain visible in
the maps rather than being respelled phonetically. The map for `申し込み`, for
example, preserves `も・う`; component coaching supplies the attested `もう`
chunk. All combined kana such as `しゅ`, `きょ`, and `みゃ` remain single
coverage units in their maps.

## Resolved revision history

The first pass marked six entries `revise` because their maps included final
`ん` but their prose only said it “closed,” “landed,” or “marked” the word.
Each source mnemonic now explicitly calls it moraic `ん` and tells the learner
to give it its own beat:

| Word ID | Reading | Re-audit |
| --- | --- | --- |
| `kanji-01-10-tehon` | `てほん` | pass |
| `kanji-01-10-seken` | `せけん` | pass |
| `kanji-11-20-kyoukan` | `きょうかん` | pass |
| `kanji-11-20-jushin` | `じゅしん` | pass |
| `kanji-21-30-shudan` | `しゅだん` | pass |
| `kanji-51-60-mogishiken` | `もぎしけん` | pass |

The re-audit reconfirmed all six exact map concatenations, ordered coverage
units, and final canonical answers.

## Component and semantic challenge notes

The potentially risky explanations received additional scrutiny and pass:

- `日々`: KANJIDIC2 supplies `ひ` and bound `-び` for `日`; the whole-word
  `ひび` supports the stated rendaku.
- `上着`: `上 → うわ-` and `着 → きる` support the stated `き → ぎ` voicing,
  while JMdict supplies the attested whole `うわぎ`.
- `合宿`, `一切`, and `出勤`: the authored maps show the actual contracted
  forms and explicitly account for `っ`; they do not ask the learner to infer
  contraction from spelling alone.
- `定規`, `燃費`, and `肝心`: KANJIDIC2 supports the base readings `き`, `ひ`,
  and `しん`; JMdict supports the voiced whole-word results `じょうぎ`,
  `ねんぴ`, and `かんじん`. The prose describes only the attested change and
  does not invent a universal rule.
- `片付ける` and `無駄遣い`: KANJIDIC2 records both the unvoiced and bound
  voiced forms (`つける` / `-づける` and `つかい` / `-づかい`), while the
  whole-word readings confirm the stated voiced chunks.
- `白髪`: KANJIDIC2 supports bound `しら-` for `白` and `かみ` for `髪`; the
  mnemonic correctly labels `しらが` an irregular whole-word reading rather
  than pretending ordinary concatenation yields it.
- `風呂敷`: the mnemonic treats `風呂 → ふろ` as an established whole chunk
  and only then adds the supported bound `敷 → しき`; it does not invent
  standalone readings for `風` or `呂`.
- `枯れ葉` and `日陰`: both correctly preserve unvoiced `は` and `かげ`; no
  nonexistent rendaku is claimed.
- `誇り`: the dust association uses the exact homophone `ほこり` and is
  clearly a memory association, not a claim that pride means dust.

## Acceptance decision

The kanji mnemonic set is **accepted: 121 pass, 0 revise, 0 reject**. The six
targeted repairs changed only their final-`ん` timing explanations; their maps,
canonical answers, component claims, and meanings remain valid. The production
catalog can now be regenerated and checked by the repository-wide gate.
