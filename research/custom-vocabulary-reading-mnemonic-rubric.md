# Custom-vocabulary reading mnemonics: editorial and validation rubric

> **Superseded on 2026-09-01.** This document records the pronunciation-map
> audit that caught incomplete readings, but its acceptance of direct chunking
> as learner-facing content was a product mistake. The current release standard
> is [Custom vocabulary: story-mnemonic standard](custom-vocabulary-story-mnemonic-standard.md).
> Exact maps now live in hidden `readingMap` metadata; drills and labeled maps
> must not appear in the lesson UI.

_Updated 2026-09-01 (Europe/Madrid). Sources are first-party language
references from EDRDG, the Agency for Cultural Affairs, and NINJAL; official
WaniKani documentation and subject-format documentation; and Kakehashi's own
source and renderer code._

## Decision

A reading mnemonic passes only when it does **both** of these jobs:

1. It gives a learner an honest, useful route to the canonical Japanese
   reading.
2. It contains an explicit kana map whose ordered coverage can be checked
   mechanically against that reading.

Merely including the correct reading at the end is not evidence that the
mnemonic leads to it. English spelling is not a substitute for Japanese sound
coverage, and a vivid story does not repair a missing, added, or reordered
mora. When there is no honest English sound association, use direct kana
chunking, known component readings, or a concise pronunciation note. A plain
accurate explanation is better than a clever false cue.

This is stricter than the present catalog gate. The sync script now requires
an exact canonical reading inside a `<reading>` tag, but it does not establish
that the preceding cue covers that reading
([current sync source](../web/scripts/sync-custom-vocabulary.mjs)).

## The reported `やっぱり` defect

The current source says:

> A `<reading>yappy</reading>` puppy returns right on schedule. Let the small
> っ stop the sound before ぱ: `<reading>やっぱり</reading>`.

The canonical sequence is `や・っ・ぱ・り`. The designated cue `yappy` does
not account for the final `り`, and English doubled spelling does not by itself
encode a Japanese 促音 as its own timing unit. The words “puppy returns right”
are story material, but the text never maps any of them to the missing Japanese
unit. Appending `<reading>やっぱり</reading>` therefore reveals the answer
without validating the mnemonic
([catalog source](data/kana-vocabulary-packs.json)).

An acceptable direct replacement would be:

> Say it in four beats: `<reading>や・っ・ぱ・り</reading>`. Start with や,
> hold the **p** for the small っ, release ぱ, and finish with り:
> `<reading>やっぱり</reading>`.

This is less fanciful, but every unit is present, in order, and the special
timing of っ is explicit. If an editor later finds a genuinely useful sound
story, it may precede this map; it may not replace it.

## Sources of truth

Use these in descending order of authority for this catalog:

1. **Exact JMdict writing-reading pair.** JMdict reading elements contain the
   valid modern-kana readings of a word, and `re_restr` limits a reading to the
   written forms to which it actually applies. Validate the exact
   `characters` + `reading` pair, honoring both reading and sense restrictions;
   do not accept a reading merely because it occurs somewhere in the same
   entry. JMdict is continuously maintained and its files are generated daily
   ([official project description](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html),
   [official DTD, `r_ele` and `re_restr`](https://www.edrdg.org/jmdict/jmdict_dtd_h.html)).
2. **The catalog's canonical `reading` field.** Once the JMdict pair has been
   validated, this exact NFKC-normalized value is what the lesson asks for and
   what the mnemonic must cover. Do not silently change katakana to hiragana,
   replace `おう` with `おお`, or collapse `えい` into `ええ` in authored
   lesson text.
3. **Whole-word vocabulary evidence outranks isolated kanji readings.**
   WaniKani notes that compounds often follow familiar on'yomi/kun'yomi
   patterns but have many exceptions, and its vocabulary lessons add a special
   mnemonic when a word differs from the reading learned for its kanji
   ([official reading guide](https://knowledge.wanikani.com/wanikani/japanese/onyomi-kunyomi/),
   [official vocabulary lesson guide](https://knowledge.wanikani.com/getting-started/unlocking-vocabulary/)).
   A component-kanji reading may explain a word only if the explanation
   reconstructs the attested whole-word reading exactly.
4. **Audio informs pronunciation, not spelling.** WaniKani similarly treats a
   vocabulary item as having a definite contextual reading and supplies Tokyo
   accent recordings for it
   ([official audio guide](https://knowledge.wanikani.com/wanikani/audio/)).
   Audio or native review should catch awkward pronunciation claims, but it
   must not override the canonical kana answer.

Pitch accent is not part of this rubric. Do not invent a pitch pattern inside
a reading mnemonic. Add pitch only from a separately licensed, authoritative
source and validate it in its own field.

## Canonical coverage units

For editorial validation, tokenize the canonical reading into **coverage
units**. These track the mora-sized distinctions a learner must preserve while
remaining mechanically derivable from the kana spelling:

- An ordinary kana is one unit: `か`, `ビ`, `ぞ`.
- A base kana plus a following small glide or vowel is one unit: `きゃ`, `シュ`,
  `ティ`, `ファ`. The current official romanization table likewise maps forms
  such as `キャ` to one `kya` sequence, and official loanword guidance requires
  the small kana in these combinations
  ([2025 Cabinet notification, main table](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/94303201_01.pdf),
  [official loanword notation guidance](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gairai/honbun06.html)).
- Small `っ` / `ッ` is one independent special unit.
- `ん` / `ン` is one independent special unit.
- The long-vowel mark `ー` is one independent special unit.
- In hiragana, the kana that writes a long vowel remains visible in the map:
  `どうぞ` is `ど・う・ぞ`, `じゃあ` is `じゃ・あ`, and `せい` is
  `せ・い`. Do not replace canonical orthography with a phonetic shortcut.
- `・`, `〜`, and `～` are delimiters or expressive notation, not morae. If a
  dictionary headword genuinely includes one, preserve it but exclude it from
  the unit count and review it manually.

The Agency for Cultural Affairs lists 拗音, 撥音 `ん`, 促音 `っ`, and the
hiragana long-vowel spellings separately in the official modern-kana rules
([official modern kana orthography](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/honbun_dai1.html)).
Its current romanization rules write `ン` as `n`, represent `ッ` by doubling
the following consonant, and distinguish long vowels either with a long-vowel
mark or by writing the relevant vowels in sequence
([2025 Cabinet notification, accompanying rules](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/94303201_01.pdf)).

Examples:

| Reading | Required coverage units | Important distinction |
| --- | --- | --- |
| `やっぱり` | `や・っ・ぱ・り` | `っ` and final `り` cannot disappear |
| `どうぞ` | `ど・う・ぞ` | `う` supplies the second long-vowel beat |
| `ゲーム` | `ゲ・ー・ム` | `ー` is not optional |
| `コンビニ` | `コ・ン・ビ・ニ` | `ン` remains an explicit unit |
| `メニュー` | `メ・ニュ・ー` | small `ュ` joins `ニ`; `ー` remains separate |
| `ティッシュ` | `ティ・ッ・シュ` | both extended kana clusters and `ッ` matter |

## Mandatory mnemonic shape

Every `readingMnemonic` must contain the following, in this order:

1. **Optional cue or story.** One short image, association, morphological
   explanation, or loanword note. Omit it when it would be forced.
2. **Explicit coverage map.** A kana-only map showing every coverage unit or
   every contiguous kana chunk in order. Use `・` for timing units and `+` only
   for a meaningful morphological boundary.
3. **Exact answer.** The exact canonical reading, without separators, inside
   `<reading>...</reading>`.

Recommended forms:

```text
Reading map: <reading>や・っ・ぱ・り</reading> → <reading>やっぱり</reading>.
```

```text
Foot contributes <reading>あし</reading> and sound contributes
<reading>おと</reading>. Reading map: <reading>あし</reading> +
<reading>おと</reading> → <reading>あしおと</reading>.
```

The map is not required to split every ordinary mora when a meaningful chunk
already covers them, but concatenating its kana chunks after removing `・` and
`+` must reproduce the canonical reading exactly.

## Acceptance rules by mnemonic type

### 1. Direct kana or pronunciation explanation — preferred default

Use direct chunking when the learner can already see kana, when a sound pun
would be weak, or when a word contains a special timing unit. Kana-only
vocabulary is not tested on a separate reading side in WaniKani, and WaniKani
explicitly says some transparent katakana loans do not need a forced mnemonic
([staff kana-vocabulary specification](https://community.wanikani.com/t/kana-only-vocabulary-additions/61796)).

Pass when the explanation:

- covers every unit in order;
- explicitly names each `っ`, `ん`, or `ー`;
- distinguishes a small-kana cluster from two ordinary morae; and
- ends with the exact reading.

### 2. Known component-reading explanation — preferred for regular compounds

Use component chunks when each chunk is an attested portion of the whole-word
reading and the decomposition is genuinely helpful. The chunks must concatenate
to the canonical reading after any explicitly described sound change.

Do not say “use the readings you know” unless those readings actually produce
this word. Do not assign a chunk to a kanji merely from a different isolated
reading of that kanji. For jukujikun, gikun, ateji, irregular okurigana, or an
uncertain historical decomposition, teach the whole word directly instead.
JMdict provides explicit tags for gikun/jukujikun and irregular forms, so those
flags should trigger whole-word review
([official JMdict DTD](https://www.edrdg.org/jmdict/jmdict_dtd_h.html)).

### 3. English sound-keyword story — allowed only with declared coverage

An English cue is acceptable when an editor can map it to a contiguous Japanese
chunk without pretending the match is closer than it is. The mnemonic must:

- name the exact kana chunk beside the cue;
- state that the English cue is an approximation when it is not a close match;
- cover all remaining chunks explicitly;
- avoid relying on silent English letters or doubled English spelling to stand
  for `っ`;
- avoid relying on initials, puns, or story words that the text never maps; and
- still include the kana coverage map and exact answer.

If the cue covers only part of a reading, that is fine only when the rest is
taught directly. If a validator cannot tell which kana each cue is meant to
recover, reject it.

### 4. Transparent loanword — explain the Japanese adaptation

When the source word is genuinely useful, show what Japanese changes: inserted
vowels, `ン`, `ッ`, a small-kana cluster, or `ー`. Do not claim that a Japanese
loan “is pronounced just like English” when its unit sequence differs. The
official loanword rules specifically preserve `ン`, small `ッ`, and `ー` and
show that conventional spellings can differ from a source language
([official loanword notation guidance](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gairai/honbun06.html)).

## Special-unit and sound-change rules

### Small `っ` / `ッ` (促音)

- Count it and display it as its own unit.
- Explain it as holding or doubling the following consonant for one beat.
- Do not universally call it a complete “stop”; its realization depends on the
  following consonant. The official romanization rule represents it by doubling
  the following consonant.
- An English word merely spelled with a doubled consonant does not pass. The
  authored map must still include `っ`.
- At a compound boundary, show the changed chunk, not the hypothetical
  uncontracted concatenation. For example, if a source supports `がく + こう →
  がっこう`, teach the `く → っ` change explicitly.

NINJAL's explanation of Japanese counter readings illustrates both the
independent 促音 and the resulting consonant alternation in `一匹`: historical
`it + piki` yields `ippiki`, not a naive concatenation
([NINJAL explanation](https://kotoba.ninjal.ac.jp/qa/yokuaru/qa-225/)).

### Long vowels

- Count the second timing unit, whether written `ー` or with another kana.
- Show the actual spelling: `コー` is `コ・ー`, `こう` is `こ・う`, and `こお`
  is `こ・お`.
- Do not replace `えい` with `ええ` merely because a speaker may realize it as
  a long vowel. The official kana rules retain conventional `えい` spellings,
  including `時計` and `丁寧`
  ([modern-kana exceptions and conventions](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/honbun_dai2.html)).
- “Stretch it” is insufficient unless the mnemonic says which vowel and shows
  the exact kana map.

### `ん` / `ン` (撥音)

- Count it and display it as its own unit.
- Keep `ん` in the canonical map even when its surface articulation assimilates
  to a following consonant.
- Do not silently spell it as English **m** before `b`, `m`, or `p`. The current
  official romanization deliberately uses `n` throughout, with examples such as
  `kanpai` and `shinbun`
  ([Agency explanatory script](https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/pdf/94363201_03.pdf)).
- When `ん` is followed by a vowel or `y`, make the boundary explicit in any
  romanized aid so it cannot be mistaken for a different kana sequence. The
  official notation uses an apostrophe for this distinction.

### Rendaku and other voicing

- Validate the whole reading first; never predict rendaku from kanji alone.
- If the mnemonic invokes rendaku, identify the base chunk and the attested
  voiced result: for example, `つり → づり` in `一本釣り`.
- Do not call every voiced onset “rendaku.” Use the label only with a defensible
  compound decomposition; otherwise state the actual chunk directly.
- Never “correct” `じ` to `ぢ` or `ず` to `づ` from etymology alone. Official
  orthography considers both contemporary word structure and convention.

NINJAL defines rendaku here as the voicing of the second element's initial
sound when words combine, and gives `一本 + 釣り → いっぽんづり` and
`鼻 + 血 → はなぢ`; it also explains why historically related `稲妻` normally
uses `ず` rather than mechanically preserving `づ`
([NINJAL orthography explanation](https://kotoba.ninjal.ac.jp/qa/yokuaru/qa-121/)).

### Compound and exceptional readings

- The coverage map must reproduce the attested whole word, not a proposed sum
  of standalone kanji readings.
- Explicitly show sokuon, rendaku, vowel contraction, or a changed counter
  reading at the boundary.
- If the boundary explanation needs an unverified etymology, remove the
  explanation and use direct whole-word chunks.
- For a genuinely exceptional reading, say so plainly. Memorizing an accurate
  whole-word sequence is preferable to teaching a false rule that will damage
  later words.

## Markup and repository style

WaniKani's API permits five mnemonic highlight tags: `radical`, `kanji`,
`vocabulary`, `meaning`, and `reading`
([official API markup specification](https://docs.api.wanikani.com/20170710/#subject-data-structure)).

Kakehashi's current mnemonic renderer highlights only `<radical>`, `<kanji>`,
`<vocabulary>`, and `<reading>`; unknown tags are stripped. Until the renderer
changes, custom catalog text should use only those four tags
([renderer source](../web/src/features/subjects/components/SubjectDetail.tsx)).

Additional rules:

- Keep tags balanced, unnested, and free of attributes.
- Use `<reading>` for the exact answer, kana chunks, and a deliberately declared
  sound cue. Do not highlight unrelated story words.
- Use `<vocabulary>` for accepted English meaning cues in the meaning mnemonic.
- Use `<kanji>` and `<radical>` only for their established Kakehashi/WaniKani
  component names.
- Do not use raw HTML, Markdown emphasis inside tags, `<ja>`, or `<meaning>` in
  custom source while the current renderer does not support them.
- Prefer one short cue and one explicit map. Avoid filler, stacked puns, fake
  dialogue, and claims that an approximation “says the answer for you.”
- Write the authoritative edit in one of the three research source JSON files;
  `catalog.generated.json` is generated output.

## Validation protocol

### Deterministic gate — must be automated

For every word:

1. NFKC-normalize `characters`, `reading`, and mnemonic tag contents.
2. Revalidate the exact JMdict writing-reading pair and applicable sense.
3. Tokenize `reading` using the coverage-unit rules above.
4. Require exactly one final `<reading>` span equal to the canonical `reading`.
5. Parse the explicit `Reading map:` segment. Remove `・`, `+`, whitespace, and
   the arrow; concatenated kana chunks must equal `reading` exactly.
6. Compare map units with canonical units. Reject a missing, added, duplicated,
   or reordered unit.
7. If `reading` contains `っ`, `ッ`, `ん`, `ン`, or `ー`, require that exact
   character in the map and a nearby explanatory sentence.
8. Reject unsupported or unbalanced markup.
9. Reject edits made only to the generated catalog when the source JSON still
   disagrees.

The check should report the word ID, canonical reading, expected unit list,
parsed unit list, and first mismatch index. “Contains the answer” is not a
sufficient success condition.

### Independent editorial gate — must not be self-approved by the author

A second editor or agent reviews each mnemonic without relying on the author's
intent. Record:

```text
word id:
canonical reading:
coverage units:
declared cue -> kana chunk mappings:
special units or sound changes:
JMdict pair verified: yes/no
all units covered in order: yes/no
cue pronunciation plausible: yes/no/not used
component or etymology claims verified: yes/no/not used
result: pass/revise/reject
reason:
```

The verifier must reject when any of the following is true:

- the cue omits, adds, or reorders a unit;
- a doubled English letter is the only support for `っ`;
- `ー`, the second kana of a long vowel, or `ん` is unaccounted for;
- an English spelling is presented as an exact sound despite a material vowel
  or consonant mismatch;
- a component reading or sound-change claim does not produce the canonical
  whole-word reading;
- the story contains possible cue words but never declares their mapping;
- the only correct part is the answer printed at the end; or
- the mnemonic is so strained that direct chunking would teach the word more
  clearly.

### Final catalog acceptance

The catalog passes only when:

- every word passes the deterministic gate;
- every sound-keyword or component-reading mnemonic has an independent
  editorial pass;
- every revision is made in its source JSON and regenerated;
- no reading or exact JMdict restriction changed during rewriting; and
- a repository-wide test confirms the generated catalog still contains the
  same pack IDs, word IDs, written forms, readings, meanings, contexts, and
  level metadata except for intentionally edited mnemonic text.

## Short authoring checklist

Before approving one mnemonic, answer all seven questions:

1. Is this the exact JMdict reading for this exact written form and sense?
2. What are its ordered coverage units?
3. Does the explicit map concatenate to the reading exactly?
4. Are `っ`, `ん`, `ー`, long-vowel kana, and small kana handled explicitly?
5. Does every English cue name the contiguous kana it actually approximates?
6. Are component and sound-change claims verified rather than guessed?
7. Would direct chunking be clearer and more honest?

Any “no” to 1–6 is a rejection. A “yes” to 7 means rewrite it directly.
