# Starter kana vocabulary packs: source and overlap audit

Audit date: 2026-08-31 (Europe/Madrid)

## Outcome

The direct-import artifact contains three packs of 16 items each:

- `conversation-glue` — 16 hiragana conversation words and expressions
- `food-and-eating-out` — 16 mixed hiragana/katakana food words
- `daily-tech-and-errands` — 16 katakana daily-life words

Files:

- [`kana-vocabulary-packs.json`](./kana-vocabulary-packs.json) — the three import-ready packs
- [`wanikani-kana-vocabulary.snapshot.json`](./wanikani-kana-vocabulary.snapshot.json) — a safe, machine-readable snapshot of all current WaniKani `kana_vocabulary` subjects

The pack file is a top-level JSON array. Each pack has:

```text
{ id, title, description, script, words[] }

word:
{
  id,
  characters,
  reading,
  meanings[],
  partsOfSpeech[],
  meaningMnemonic,
  readingMnemonic,
  contextSentences[{ ja, en }, { ja, en }[, { ja, en }]]
}
```

All 48 word IDs are unique. Every word has an original meaning mnemonic, an original reading mnemonic, and two or three original context sentences with English translations. The current context expansion and review results are recorded in [`../custom-vocabulary-context-sentence-research.md`](../custom-vocabulary-context-sentence-research.md).

## WaniKani exclusion result

The official WaniKani API v2 was queried with revision `20170710`, following the [official API reference](https://docs.api.wanikani.com/20170710/). A token already present in `web/.env.local` was read only into a shell variable and sent in the authorization header. Its value was never printed, copied, or stored.

At fetch time:

- Fetch timestamp: `2026-08-31T14:32:57Z`
- WaniKani subject data timestamp: `2026-08-19T15:39:03.578789Z`
- Current `kana_vocabulary` subjects: **60**
- Current ordinary `vocabulary` subjects: **6,765**
- Combined subjects tested: **6,825**

The final 48 candidates were compared against:

1. every `kana_vocabulary.data.characters` and `data.slug`;
2. every ordinary `vocabulary.data.characters` and `data.slug`; and
3. every ordinary vocabulary reading in `data.readings[].reading`.

Results:

| Check | Overlaps |
| --- | ---: |
| Current kana denylist character/slug | 0 |
| All subject character/slug values | 0 |
| All ordinary-vocabulary readings | 0 |

Checking ordinary-vocabulary readings is deliberately stricter than checking only the 60 kana subjects. It prevents adding a kana spelling for a same-reading word that WaniKani already teaches with kanji. The snapshot is still time-bound: it should be refreshed before releases and periodically in CI.

### Complete current kana denylist

The snapshot stores each subject's ID, characters, slug, and update timestamp. Its 60 characters, in API order, are:

`ちょっと`, `おはよう`, `ホテル`, `これ`, `する`, `リンゴ`, `コーヒー`, `こんにちは`, `いつ`, `どれ`, `テレビ`, `うん`, `はい`, `ノート`, `さようなら`, `こんばんは`, `それ`, `コンビニ`, `デパート`, `すみません`, `いいえ`, `あなた`, `この`, `あれ`, `ドル`, `どの`, `ない`, `カバン`, `タクシー`, `その`, `あの`, `でも`, `まだ`, `ここ`, `おやつ`, `どこ`, `もしもし`, `ほとんど`, `ガラス`, `そこ`, `あそこ`, `キロ`, `タバコ`, `サービス`, `しかし`, `パン`, `とても`, `ビル`, `もう`, `ワンピース`, `マンション`, `オノマトペ`, `トランプ`, `ふわふわ`, `ペラペラ`, `ドキドキ`, `バイキング`, `レントゲン`, `まぐれ`, `ホッチキス`.

### Same-lexeme candidates rejected during research

These otherwise useful kana candidates were rejected because WaniKani already teaches the same lexeme with a kanji spelling:

| Rejected kana | Existing WaniKani subject | Subject ID |
| --- | --- | ---: |
| ありがとう | 有り難う | 8713 |
| ごめんなさい | 御免なさい | 6462 |
| ごめん | 御免 | 6293 |
| なるほど | 成程 | 7771 |
| もちろん | 勿論 | 9096 |
| たぶん | 多分 | 2755 |
| ぜひ | 是非 | 4009 |
| とりあえず | 取り敢えず | 8545 |
| さすが | 流石 | 9303 |
| よろしく | 宜しく | 6338 |
| まったく | 全く | 3454 |
| おにぎり | お握り | 6958 |
| しょうゆ | 醤油 | 5933 |
| みそ | 味噌 | 5904 |
| ラーメン | 拉麺 | 8972 |

`ほら` was also held out. WaniKani has the unrelated homophone 洞 (`ほら`, “cave”), so it was not a same-lexeme overlap, but avoiding it keeps first-pack answer semantics cleaner.

## Lexical and commonness sources

Meanings, readings, parts of speech, common spellings, and spelling variants were checked against the current EDICT2 distribution generated from the [JMdict project](https://www.edrdg.org/jmdict/j_jmdict.html). JMdict is maintained as a Japanese-pivot multilingual lexical database and regenerated from its source database daily. Its `(P)` marker is a broad priority/common-word signal, not a precise modern frequency rank; the project's [WWWJDIC documentation](https://www.edrdg.org/wwwjdic/wwwjdicinf.html) explicitly describes it as an approximate common subset and warns that it has exceptions.

Frequency checks used the National Institute for Japanese Language and Linguistics (NINJAL) [BCCWJ Version 1.1 public frequency lists](https://clrd.ninjal.ac.jp/bccwj/bcc-chu.html):

- [BCCWJ short-unit word list v1.1](https://doi.org/10.15084/00003219)
- [BCCWJ long-unit word list, frequency at least 2, v1.1](https://doi.org/10.15084/00003215)

In the tables below, “SUW” means an exact short-unit lemma match and “LUW” an exact long-unit reading match. Counts and occurrences per million (`pmw`) are included as a reproducible commonness signal. All selected entries have a JMdict priority marker except `どうやって`, which is marked with †.

### Pack 1: Conversation Glue

| Characters | Target sense / POS | Commonness signal | Rationale or caveat |
| --- | --- | --- | --- |
| どうぞ | please; here you go; go ahead / adverb, expression | LUW 4,217; 50.6 pmw; JMdict P | Core handing, inviting, and permission formula. |
| やっぱり | as expected; after all / adverb | LUW 11,365; 136.4 pmw; JMdict P | Very frequent conversational reaction. |
| ゆっくり | slowly; at leisure / adverb, する verb | LUW 7,753; 93.1 pmw; JMdict P | Useful for pace, rest, and hospitality. |
| じゃあ | well then; in that case / conjunction | LUW 3,829; 46.0 pmw; JMdict P | Casual transition derived from `では`. |
| どうも | thanks; somehow / interjection, adverb | JMdict P; BCCWJ unit-split | Highly polysemous; pack targets the common casual thanks and “somehow” senses. |
| まさか | no way; surely not / interjection, adverb | LUW 3,267; 39.2 pmw; JMdict P | High-value reaction word. |
| そろそろ | soon; about time / adverb | LUW 2,992; 35.9 pmw; JMdict P | Commonly organizes departures and next actions. |
| ちゃんと | properly; without fail / adverb, する verb | LUW 6,958; 83.5 pmw; JMdict P | Common instruction and reassurance word. |
| なるべく | as much as possible; if possible / adverb | LUW 2,436; 29.2 pmw; JMdict P | Useful request softener and constraint word. |
| なんで | why; how come / adverb | LUW 177; 2.12 pmw; JMdict P | Casual speech is underrepresented in this written corpus; exclude the separate “because” lexeme during lesson QA. |
| どうして | why; for what reason / adverb | LUW 9,976; 119.7 pmw; JMdict P | Neutral question word; may also mean “how,” but this pack teaches the reason sense. |
| どうやって † | how; by what means / expression | Exact JMdict entry; no P marker; BCCWJ unit-split | Retained because it is the clearest everyday method question and contrasts usefully with `どうして`. |
| なんとなく | somehow; for no particular reason / adverb | JMdict P; BCCWJ unit-split | Common hedging and intuition expression. |
| ちなみに | by the way; incidentally / conjunction | LUW 8,513; 102.2 pmw; JMdict P | High-frequency side-note connector. |
| つまり | in other words; in short / adverb | LUW 20,563; 246.8 pmw; JMdict P | High-frequency clarification and summary connector. |
| もし | if; supposing / adverb | JMdict P; BCCWJ homographs aggregate | Corpus count also includes 模試 (“mock exam”), so no sense-specific number is claimed. |

### Pack 2: Food & Eating Out

| Characters | Target sense / POS | Commonness signal | Rationale or caveat |
| --- | --- | --- | --- |
| おかず | side dish / noun | LUW 827; 9.93 pmw; JMdict P | Everyday meal-structure word; normally written in kana. |
| おかわり | second helping; refill / noun, する verb | LUW 240; 2.88 pmw; JMdict P | Immediately useful at tables; also has a dog-command sense not taught here. |
| ごちそうさま | thank you for the meal / interjection | LUW 259; 3.11 pmw; JMdict P | Core post-meal formula. |
| カレー | curry; curry and rice / noun | SUW 3,170; 30.3 pmw; JMdict P | Ubiquitous Japanese meal loanword. Minor proper-name noise may exist in the aggregate. |
| サラダ | salad / noun | SUW 2,629; 25.1 pmw; JMdict P | Common menu and home-meal word. |
| スープ | soup / noun | SUW 2,806; 26.8 pmw; JMdict P | Common menu word. |
| ジュース | juice; soft drink / noun | SUW 1,649; 15.8 pmw; JMdict P | Japanese usage can be broader than literal fruit juice. |
| ケーキ | cake / noun | SUW 2,929; 28.0 pmw; JMdict P | Common dessert word; small proper-name noise is possible. |
| アイス | ice cream; ice; iced / noun, prefix | SUW 1,807; 17.3 pmw; JMdict P | In food contexts it commonly abbreviates `アイスクリーム`; meanings retain the wider ambiguity. |
| レストラン | restaurant / noun | SUW 3,113; 29.8 pmw; JMdict P | Common venue word. |
| メニュー | menu / noun | SUW 5,251; 50.2 pmw; JMdict P | Very frequent in food and interface contexts. |
| デザート | dessert / noun | SUW 1,020; 9.75 pmw; JMdict P | Common meal-course word; the rare “desert” homograph is deliberately not a review target. |
| パスタ | pasta / noun | SUW 879; 8.40 pmw; JMdict P | Common restaurant category. |
| ピザ | pizza / noun | SUW 703; 6.72 pmw; JMdict P | Common restaurant and delivery word. |
| サンドイッチ | sandwich / noun | SUW 637; 6.09 pmw; JMdict P | Common café and convenience-food word. |
| ビール | beer / noun | SUW 4,530; 43.3 pmw; JMdict P | Very frequent beverage word; adult/alcohol context should follow product policy. |

### Pack 3: Daily Tech & Errands

| Characters | Target sense / POS | Commonness signal | Rationale or caveat |
| --- | --- | --- | --- |
| スマホ | smartphone / noun | JMdict P; no exact BCCWJ v1.1 lemma | The BCCWJ sampling period predates widespread smartphone usage; current dictionary priority is the better signal here. |
| パソコン | personal computer; PC / noun | SUW 8,844; 84.5 pmw; JMdict P | Very frequent abbreviation. |
| アプリ | app; application / noun | SUW 162; 1.55 pmw; JMdict P | Low written-corpus count reflects corpus age; current priority marker supports inclusion. |
| ネット | Internet; net; network / noun | SUW 6,426; 61.4 pmw; JMdict P | Very frequent; lesson context selects the Internet sense. |
| メール | email; message; mail / noun, する verb | SUW 15,591; 149.0 pmw; JMdict P | Very frequent; the aggregate has minor homograph risk. |
| カメラ | camera / noun | SUW 6,051; 57.8 pmw; JMdict P | High-frequency daily object. |
| イヤホン | earphones; earbuds / noun | SUW 175; 1.67 pmw; JMdict P | Corpus-age/device-register undercount; current priority marker supports inclusion. |
| エアコン | air conditioner; AC / noun | SUW 999; 9.55 pmw; JMdict P | Common household abbreviation. |
| リモコン | remote control / noun, の adjective | SUW 434; 4.15 pmw; JMdict P | Common household abbreviation. |
| ゲーム | game / noun | SUW 7,263; 69.4 pmw; JMdict P | Very frequent across entertainment contexts. |
| チケット | ticket / noun | SUW 1,972; 18.9 pmw; JMdict P | Common transport and event word. |
| スーパー | supermarket; super / noun, prefix | SUW 4,449; 42.5 pmw; JMdict P | In errands, normally an abbreviation of `スーパーマーケット`. |
| レジ | cash register; checkout; cashier / noun | SUW 938; 8.97 pmw; JMdict P | Essential shopping word with several closely linked senses. |
| トイレ | toilet; restroom; bathroom / noun | SUW 4,106; 39.2 pmw; JMdict P | High-utility location word. |
| バス | bus / noun | SUW 9,082; 86.8 pmw; JMdict P | Aggregate includes unrelated bath, bass, and fish homographs; pack context selects transport. |
| アルバイト | part-time job; part-time worker / noun, する verb | SUW 1,570; 15.0 pmw; JMdict P | Common work/school-life word; derived from German `Arbeit` but semantically narrowed in Japanese. |

## Mnemonic and sentence authorship

WaniKani's API documentation defines subject mnemonic fields and the custom `<vocabulary>` and `<reading>` markup. A few current subjects were inspected only to understand the expected cadence and markup behavior. **No WaniKani mnemonic or context sentence was copied or paraphrased into the pack.** Every mnemonic and sentence in the JSON was authored for this project.

The reading mnemonic is retained because the requested import schema requires it and because it is useful during lessons. However, WaniKani's review documentation treats `kana_vocabulary` as meaning-only: the `reading` value here should primarily support display, pronunciation/TTS, and lesson explanation, not necessarily a separate reading quiz.

## Licensing and product attribution

- JMdict/EDICT content is distributed under the EDRDG [dictionary licence](https://www.edrdg.org/edrdg/licence.html), currently CC BY-SA 4.0 with explicit acknowledgment requirements for apps and vocabulary lists. The pack's short English labels and POS values were independently normalized and all mnemonic/example prose is original, but the lexical validation was materially based on JMdict. **Before shipping, add a JMdict/EDRDG acknowledgment and licence/source link in the app's About/Sources surface, and have product/legal confirm treatment of the derived vocabulary data.**
- The BCCWJ v1.1 datasets are CC BY-NC-ND. Their frequency figures are included only in this internal research audit; they are intentionally absent from the import JSON. Do not copy the source tables into the product.
- The WaniKani snapshot contains only subject IDs, characters, slugs, and public update timestamps. It contains no API token, account data, mnemonic text, audio URL, or context sentence.

## Remaining uncertainties and recommended QA

1. **Native editorial pass:** all Japanese context sentences are original and were checked for grammar and intended usage, but they have not yet had a native-speaker editorial review.
2. **Corpus age/register:** BCCWJ is a balanced written corpus, not a live spoken-frequency source. It undercounts casual speech and newer device terms such as `スマホ` and `アプリ`.
3. **Polysemy:** `どうも`, `どうして`, `なんで`, `アイス`, `ネット`, `スーパー`, `メール`, and `バス` are context-sensitive. The JSON intentionally teaches a bounded set of high-value senses rather than every dictionary sense.
4. **Reading alternatives:** the direct-import schema has one canonical reading string. Common alternative spellings such as `スマフォ`, `イヤフォン`, and `ピッツァ` are not represented as accepted alternatives.
5. **Pronunciation:** no pitch-accent data or human audio was researched. TTS should not be treated as a pitch-accent authority.
6. **Normalization:** the current overlap check is exact Unicode equality. A production audit should normalize with NFKC, trim punctuation/whitespace, and refresh the WaniKani snapshot before comparing.
7. **Content drift:** WaniKani can add or revise subjects. A zero-overlap result is valid only for the API snapshot timestamp above.

## Suggested permanent checks

- Assert that every pack word's normalized `characters` and `reading` are absent from the refreshed WaniKani kana denylist.
- When a WaniKani token is available in CI, also compare against every ordinary vocabulary reading; this catches kanji/kana orthographic duplicates.
- Assert unique pack IDs and globally unique word IDs.
- Assert that each word has at least one meaning, one part of speech, both mnemonic fields, and two or three bilingual context sentences.
- Treat a WaniKani data timestamp newer than the checked snapshot as a prompt to refresh and rerun the audit.
