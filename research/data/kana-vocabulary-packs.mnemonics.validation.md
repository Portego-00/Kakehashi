# Starter kana reading-mnemonic validation

Validation date: 2026-09-01 (Europe/Madrid)

## Outcome

This is an independent editorial audit of all 48 `readingMnemonic` values in
[`kana-vocabulary-packs.json`](./kana-vocabulary-packs.json). The audit applies
the deterministic and editorial gates in
[`custom-vocabulary-reading-mnemonic-rubric.md`](../custom-vocabulary-reading-mnemonic-rubric.md).
The reviewer did not author these revisions and did not edit the source JSON.

| Result | Count |
| --- | ---: |
| Pass | 48 |
| Revise | 0 |
| Reject | 0 |
| **Total** | **48** |

The complete 16-word Conversation Glue pack passes. In particular,
`conversation-yappari` now covers the exact sequence `や・っ・ぱ・り`, treats
small `っ` as its own timing unit by holding the following **p** consonant, and
explicitly finishes on `り`. It no longer has the reported “yappy” defect.

The five entries flagged in the first editorial pass were revised in the source
JSON and independently re-audited. Each prior prose concern is resolved, and
all five maps still reproduce their canonical readings exactly.

A final independent sokuon pass re-audited `conversation-yappari`,
`conversation-yukkuri`, `conversation-douyatte`, `food-sandoicchi`,
`daily-netto`, and `daily-chiketto` after their timing prose was tightened. All
six name the correct following consonant, hold it for the small `っ` or `ッ`
beat, and release into the correct following kana. `conversation-douyatte`
also preserves the separate written long-vowel `う`, and `food-sandoicchi`
also preserves moraic `ン` as its own beat. All six pass.

Audited source SHA-256:
`2038a0e592a0a9317671d697cd895243e72d8280e333db87bb2cfad36c855396`.

## Deterministic and lexical checks

- The JSON parses as three packs containing 48 globally unique words.
- All 48 mnemonics have exactly one `Reading map:` followed by an exact final
  `<reading>` answer.
- All 48 maps concatenate to the NFKC-normalized canonical reading.
- All 48 parsed map-unit lists equal the canonical coverage-unit lists. There
  are zero missing, added, duplicated, or reordered units.
- Every `っ`, `ん`, `ン`, and `ー` is visible in its map and has a nearby timing
  explanation. Every small `ゃ` or `ュ` is joined to its base kana correctly.
- All markup is balanced and uses supported tags.
- A fresh official `JMdict_e` distribution timestamped 2026-09-01 03:30:43 UTC
  resolved all 48 exact kana readings to an applicable sense, including `stagr`
  restrictions: **48 / 48 verified**.

## Entry-by-entry editorial record

Every row below has `JMdict pair verified: yes` and `all units covered in
order: yes`. “Direct” means no English sound cue or component derivation is
used, so cue plausibility and component verification are not applicable.

### Conversation Glue

| Word ID | Canonical coverage units | Cue, special unit, or component review | Result |
| --- | --- | --- | --- |
| `conversation-douzo` | `ど・う・ぞ` | Direct; the written long-vowel `う` is counted and explained. | Pass |
| `conversation-yappari` | `や・っ・ぱ・り` | Direct; `っ` holds the following **p** for one beat and final `り` is explicit. | Pass |
| `conversation-yukkuri` | `ゆ・っ・く・り` | Direct; `っ` holds the following **k** for one beat. | Pass |
| `conversation-jaa` | `じゃ・あ` | Direct; small `ゃ` joins `じ`, and the separate long-vowel `あ` is explained. | Pass |
| `conversation-doumo` | `ど・う・も` | Direct; the written long-vowel `う` is counted and explained. | Pass |
| `conversation-masaka` | `ま・さ・か` | Direct three-unit timing; no cue claim. | Pass |
| `conversation-sorosoro` | `そ・ろ・そ・ろ` | Direct repetition pattern; all four units are declared. | Pass |
| `conversation-chanto` | `ちゃ・ん・と` | Direct; small `ゃ` joins `ち`, and moraic `ん` has its own beat. | Pass |
| `conversation-narubeku` | `な・る・べ・く` | Direct four-unit timing; no cue claim. | Pass |
| `conversation-nande` | `な・ん・で` | Direct; moraic `ん` has its own beat. | Pass |
| `conversation-doushite` | `ど・う・し・て` | Direct; the written long-vowel `う` is counted and explained. | Pass |
| `conversation-douyatte` | `ど・う・や・っ・て` | Direct; both long-vowel `う` and small `っ` before **t** are explained. | Pass |
| `conversation-nantonaku` | `な・ん・と・な・く` | Direct; moraic `ん` has its own beat. | Pass |
| `conversation-chinamini` | `ち・な・み・に` | Direct chunk plus final `に`; coverage is complete. | Pass |
| `conversation-tsumari` | `つ・ま・り` | Direct three-unit timing; no cue claim. | Pass |
| `conversation-moshi` | `も・し` | Direct two-unit timing; no cue claim. | Pass |

### Food & Eating Out

| Word ID | Canonical coverage units | Cue, special unit, or component review | Result |
| --- | --- | --- | --- |
| `food-okazu` | `お・か・ず` | Direct three-unit timing; no cue claim. | Pass |
| `food-okawari` | `お・か・わ・り` | Direct four-unit timing; no cue claim. | Pass |
| `food-gochisousama` | `ご・ち・そ・う・さ・ま` | Direct; the written long-vowel `う` is counted and explained. | Pass |
| `food-karee` | `カ・レ・ー` | “Curry” is explicitly presented as an adaptation; `ー` is mapped and explained. | Pass |
| `food-sarada` | `サ・ラ・ダ` | “Salad” is explicitly described as reshaped into the declared Japanese units. | Pass |
| `food-suupu` | `ス・ー・プ` | Direct; `ー` is counted and explained. | Pass |
| `food-juusu` | `ジュ・ー・ス` | Direct; small `ュ` joins `ジ`, and `ー` is counted and explained. | Pass |
| `food-keeki` | `ケ・ー・キ` | “Cake” is explicitly presented as an adaptation; `ー` is mapped and explained. | Pass |
| `food-aisu` | `ア・イ・ス` | “Ice” is explicitly presented as three Japanese units rather than one English syllable. | Pass |
| `food-resutoran` | `レ・ス・ト・ラ・ン` | Direct; final moraic `ン` is independent. | Pass |
| `food-menyuu` | `メ・ニュ・ー` | Direct; small `ュ` joins `ニ`, and the following `ー` is now unambiguously tied to `ニュ`. | Pass |
| `food-dezaato` | `デ・ザ・ー・ト` | Direct; `ー` is correctly tied to the preceding `ザ`. | Pass |
| `food-pasuta` | `パ・ス・タ` | Direct loanword timing; no source-language derivation is asserted. | Pass |
| `food-piza` | `ピ・ザ` | The Italian source is identified accurately and adapted to the declared Japanese units. | Pass |
| `food-sandoicchi` | `サ・ン・ド・イ・ッ・チ` | Direct; `ン` is independent and `ッ` holds the following **ch** onset for one beat. | Pass |
| `food-biiru` | `ビ・ー・ル` | Direct; `ー` is counted and explained. | Pass |

### Daily Tech & Errands

| Word ID | Canonical coverage units | Cue, special unit, or component review | Result |
| --- | --- | --- | --- |
| `daily-sumaho` | `ス・マ・ホ` | The irregular abbreviation `スマートフォン → スマホ` is stated honestly, including `フォ → ホ`. | Pass |
| `daily-pasokon` | `パ・ソ・コ・ン` | Both Japanese source-form clippings and the deletion of `ー` are explicit; final `ン` is independent. | Pass |
| `daily-apuri` | `ア・プ・リ` | The first three units of `アプリケーション` are identified exactly. | Pass |
| `daily-netto` | `ネ・ッ・ト` | Direct; `ッ` holds the following **t** for one beat. | Pass |
| `daily-meeru` | `メ・ー・ル` | “Mail” is explicitly presented as an adaptation; `ー` is mapped and explained. | Pass |
| `daily-kamera` | `カ・メ・ラ` | The sound cue declares all three Japanese units without claiming exact English pronunciation. | Pass |
| `daily-iyahon` | `イ・ヤ・ホ・ン` | Direct; full-size `ヤ` remains separate and final `ン` is independent. | Pass |
| `daily-eakon` | `エ・ア・コ・ン` | The retained prefix of `エアコンディショナー` is exact; final `ン` is independent. | Pass |
| `daily-rimokon` | `リ・モ・コ・ン` | The attested Japanese forms `リモート + コントロール` are explicitly clipped to `リモ + コン`; final `ン` is independent. | Pass |
| `daily-geemu` | `ゲ・ー・ム` | “Game” is explicitly presented as an adaptation; `ー` is mapped and explained. | Pass |
| `daily-chiketto` | `チ・ケ・ッ・ト` | Direct; `ッ` holds the following **t** for one beat. | Pass |
| `daily-suupaa` | `ス・ー・パ・ー` | Direct; both long-vowel marks are visible and both lengthened units are explained. | Pass |
| `daily-reji` | `レ・ジ` | The first two units of `レジスター` are identified exactly. | Pass |
| `daily-toire` | `ト・イ・レ` | Direct; full-size `イ` is correctly kept as its own unit. | Pass |
| `daily-basu` | `バ・ス` | “Bus” is explicitly presented as opening into two Japanese units. | Pass |
| `daily-arubaito` | `ア・ル・バ・イ・ト` | The German-derived source note is accurate; all five units are direct and separate. | Pass |

## Revision history

The first independent pass marked five entries for revision even though their
maps were already exact. A second independent pass confirmed the following
source corrections:

| Word ID | Prior concern | Verified resolution |
| --- | --- | --- |
| `food-menyuu` | The prose ambiguously attached `ー` after `メ`. | It now explicitly says the following `ー` lengthens `ニュ`. |
| `food-piza` | The mnemonic incorrectly called `ピザ` an English-derived loan. | It now identifies the Italian source without overclaiming pronunciation. |
| `daily-sumaho` | It falsely described `ホ` as a retained kana from `フォン`. | It now shows the irregular `スマートフォン → スマホ` shortening and names `フォ → ホ`. |
| `daily-pasokon` | It silently omitted the `ー` in `パーソナル → パソ`. | It now declares that `ー` and `ナル` are dropped and retains independent `ン`. |
| `daily-rimokon` | English words were treated as exact Japanese chunk sources. | It now shows the Japanese clipping `リモート + コントロール → リモ + コン`. |

All five revised maps were parsed again after the prose changes. Their expected
and declared unit lists match exactly, and each final `<reading>` answer remains
the exact canonical reading.

## Acceptance decision

The 48-word starter source passes the deterministic and independent editorial
gates: **48 pass, 0 revise, 0 reject**. It is accepted for catalog generation.
