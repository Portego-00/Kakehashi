# Kana expansion: authoring and exclusion report

_Validated 2026-09-01 (Europe/Madrid)._

## Result

[`custom-vocab-kana-expansion.json`](./custom-vocab-kana-expansion.json) adds **120 unique kana-only words in 12 new packs**:

| Pack | Script | Words |
| --- | --- | ---: |
| Nuance in Conversation | hiragana | 10 |
| Feelings You Can Hear | hiragana | 10 |
| How Things Move | hiragana | 10 |
| Food Texture in Every Bite | hiragana | 10 |
| Weather You Can Feel | hiragana | 10 |
| Body Signals | hiragana | 10 |
| Work & Study Desk | katakana | 10 |
| Laundry & Home Care | katakana | 10 |
| Around the City | katakana | 10 |
| People on Screen & Stage | katakana | 10 |
| Fitness & Everyday Wellness | katakana | 10 |
| Kitchen Tools & Flavors | katakana | 10 |
| **Total** |  | **120** |

Every word has one combined learner-facing meaning mnemonic, exactly one `<reading>` sound hook, one or more `<vocabulary>` meaning payoffs, two or three Japanese/English context pairs, and a hidden exact `readingMap`. Kana entries intentionally omit `readingMnemonic`. Following the context expansion and independent review, 105 entries have two pairs and 15 have three, for 255 pairs total.

## Dictionary evidence

The lexical pass used the official EDRDG [JMdict English XML daily distribution](https://www.edrdg.org/pub/Nihongo/JMdict_e.gz), whose header identifies the edition as **2026-09-01**. The downloaded archive's SHA-256 was:

```text
a2cce17805c392712a9569c515076ae84a0091281b54542753de1060add8c55e
```

All **120 / 120** visible-form readings resolve exactly in that distribution. Meanings, parts of speech, and usage notes were checked against the applicable English senses rather than inferred from spelling. JMdict is the maintained source database described by the official [JMdict/EDICT project page](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html).

**101 / 120** selected reading elements carry a JMdict priority tag. These tags are useful broad commonness signals, not exact contemporary frequency rankings; that limitation and the composition of the priority fields are documented in the official [JMdict DTD reference](https://www.edrdg.org/jmdict/jmdict_dtd_h.html).

## Exclusion method

The final 120 were normalized with Unicode NFKC and checked against every written form and ID in:

- [`kana-vocabulary-packs.json`](./kana-vocabulary-packs.json)
- [`custom-vocab-kana-candidates.json`](./custom-vocab-kana-candidates.json)
- [`custom-vocab-kanji-candidates.json`](./custom-vocab-kanji-candidates.json)
- every other expansion source visible in the data directory at validation time

Result: **zero custom written-form collisions and zero ID collisions**.

The same forms were checked against all **6,825** ordinary and kana-vocabulary subjects, including hidden subjects, in [`wanikani-vocabulary-exclusions.snapshot.json`](./wanikani-vocabulary-exclusions.snapshot.json). The snapshot follows WaniKani's official [Subjects API](https://docs.api.wanikani.com/20170710/#subjects). The audit compared both exact NFKC written forms and readings folded from katakana to hiragana.

Result: **zero WaniKani written-form collisions and zero folded-reading collisions**. The conservative reading check caught and removed two early candidates:

- `どきどき`, because WaniKani already has kana vocabulary `ドキドキ`
- `メガネ`, because it is the same lexeme as WaniKani vocabulary `眼鏡（めがね）`

They were replaced with `にこにこ` and `ビタミン`.

## Mnemonic and example gate

Automated checks confirmed:

- 120 globally unique word IDs and 120 globally unique written forms
- kana-only visible forms with `characters === reading`
- exactly one balanced `<reading>...</reading>` hook per mnemonic
- one or more balanced `<vocabulary>...</vocabulary>` payoffs per mnemonic
- at least two prose sentences per mnemonic, including a concrete scene and a usage distinction
- no learner-facing reading map, beat-counting, or pronunciation-drill language
- two or three non-empty Japanese/English context pairs per word, with the exact target form in every Japanese sentence
- exact mora coverage in every hidden `readingMap`, including small kana, `っ`, `ん`, and `ー`

The stories are original to this project. Transparent loanwords use the source word as the sound hook but add a visual consequence and a Japanese-specific usage distinction; examples include `ホーム` “platform,” `バイク` “motorcycle,” `タレント` “TV personality,” `レンジ` “microwave,” and `ミキサー` “blender.”

## Unmarked and borderline review set

The **19** entries without a JMdict priority marker are:

`くすくす`, `おどおど`, `はらはら`, `ぐんぐん`, `もちもち`, `さくさく`, `ぱりぱり`, `かりかり`, `しゃきしゃき`, `とろとろ`, `むしむし`, `ひんやり`, `どんより`, `ざあざあ`, `そよそよ`, `からっと`, `しびれ`, `モップ`, and `レシピ`.

Most are ordinary spoken mimetics that a written-news-oriented priority scheme underrepresents. `モップ` and `レシピ` are transparent, productive modern loanwords. They were retained because their senses are unambiguous in the packs and their daily-life utility is high, but this set is the best target for a later native-speaker frequency/editorial pass.

Two polysemous items deserve special care in UI copy:

- `ファン` teaches “enthusiast”; the same spelling can mean an electric fan.
- `ソース` teaches food sauce; it can also mean an information or code source in technical contexts.

The current mnemonics and examples explicitly select the intended sense.

## Licensing note

JMdict-derived lexical evidence is distributed under EDRDG's [dictionary licence](https://www.edrdg.org/edrdg/licence.html). The app should retain the existing JMdict/EDRDG acknowledgment and source links when this expansion ships.
