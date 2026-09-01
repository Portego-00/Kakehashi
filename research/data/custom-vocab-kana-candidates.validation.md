# Kana vocabulary expansion: validation summary

Validation date: 2026-08-31 (Europe/Madrid)

## Outcome

[`custom-vocab-kana-candidates.json`](./custom-vocab-kana-candidates.json) contains **120 unique kana-only candidate words in 10 themed packs**. Pack sizes intentionally vary from 10 to 14 words:

| Pack | Script | Words |
| --- | --- | ---: |
| At the Café Table | katakana | 12 |
| Casual Meals & Treats | mixed kana | 14 |
| Conversation Signals | hiragana | 11 |
| Clear, Careful & Complete | hiragana | 13 |
| Home Comfort | katakana | 13 |
| Everyday Clothes | katakana | 12 |
| Travel & Places | katakana | 11 |
| Digital Essentials | katakana | 12 |
| Music, Media & Play | katakana | 10 |
| Shopping Smart | katakana | 12 |
| **Total** |  | **120** |

The JSON uses a research wrapper with `{ metadata, packs }`. Every object inside `packs[].words[]` already matches the production word shape:

```text
{
  id,
  characters,
  reading,
  meanings[],
  partsOfSpeech[],
  meaningMnemonic,
  readingMnemonic,
  contextSentences[{ ja, en }, { ja, en }]
}
```

Production extraction is therefore just the top-level `.packs` array. These 120 candidates plus the current 48-word custom catalog yield **168 kana words** before any kanji-range packs are added.

## Lexical source and commonness

All 120 written forms were resolved against the EDRDG `edict2u` daily distribution created on 2026-08-31. EDICT2 is generated from the JMdict source database; the project describes the database as continuously updated and its distributions as generated daily. See the [official JMdict/EDICT project page](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) and [official distribution index](https://ftp.edrdg.org/pub/Nihongo/00INDEX.html).

The official JMdict DTD explains that the `news1`, `ichi1`, `spec1`, `spec2`, and `gai1` tags form the broad priority/common subset, while also cautioning that these signals are not a precise modern frequency rank. See the [JMdict DTD priority documentation](https://www.edrdg.org/jmdict/jmdict_dtd_h.html).

- **107 / 120 (89.2%)** candidates carry the JMdict/EDICT2 priority marker.
- The remaining **13** are unmarked modern or conversational terms retained after editorial commonness review: `うわ`, `えっ`, `ばっちり`, `へえ`, `わあ`, `アカウント`, `オムライス`, `キャッシュレス`, `タブレット`, `ノートパソコン`, `フォルダ`, `フライドポテト`, and `リュック`.
- No candidate was missing from the current dictionary distribution.

The unmarked set is deliberately transparent rather than being presented as corpus-ranked. Several are newer computing/payment terms or spoken reactions that historical written-source priority lists underrepresent.

## WaniKani exclusion audit

The live WaniKani API v2 vocabulary-family snapshot used for exclusion is [`wanikani-vocabulary-exclusions.snapshot.json`](./wanikani-vocabulary-exclusions.snapshot.json). It was fetched at `2026-08-31T20:05:11.156Z` using API revision `20170710`, following the [official Subjects API contract](https://docs.api.wanikani.com/20170710/#subjects). No API credential is present in either artifact.

The snapshot includes all seven paginated result pages and intentionally includes hidden subjects:

| Subject set | Count |
| --- | ---: |
| Ordinary `vocabulary` | 6,765 |
| `kana_vocabulary` | 60 |
| Visible vocabulary-family subjects | 6,797 |
| Hidden vocabulary-family subjects | 28 |
| **Total checked** | **6,825** |

Candidate and API values were normalized with Unicode NFKC and trimmed before comparison. Katakana readings were folded to hiragana for the conservative reading check.

| Check | Overlaps |
| --- | ---: |
| WaniKani `characters` | 0 |
| WaniKani `slug` | 0 |
| WaniKani ordinary-vocabulary or kana-vocabulary readings | 0 |
| Current custom 48-word catalog written forms | 0 |

Reading equality can represent an unrelated homophone, so it is normally a same-lexeme review signal rather than automatic proof of duplication. This candidate set does not require that distinction because it has no reading collisions at all.

## Schema and content checks

Automated validation passed all of the following:

- JSON parses successfully.
- Metadata counts match 10 packs and 120 words.
- Pack IDs, word IDs, and normalized written forms are globally unique.
- Every visible form contains only Unicode hiragana, katakana, or the prolonged sound mark; there are no kanji or Latin characters.
- Every canonical reading exactly matches the visible kana form after NFKC normalization.
- Every word has at least one meaning and one part of speech.
- Every meaning mnemonic contains balanced `<vocabulary>...</vocabulary>` markup.
- Every reading mnemonic contains balanced `<reading>...</reading>` markup.
- Every word has exactly two non-empty Japanese/English context pairs, for **240 context pairs total**.
- Both Japanese sentences for every word include the exact target written form.
- The live WaniKani and existing-custom overlap checks return zero issues.

All mnemonics, concise English labels, and Japanese/English example sentences in the candidate file were written specifically for this project. No WaniKani mnemonic or context sentence was copied.

## Editorial caveats

1. The Japanese examples were manually checked for grammar, target sense, and ordinary register, but have not yet received a native-speaker editorial pass.
2. Some loanwords are polysemous. The lessons intentionally teach the pack-relevant sense: `コップ` means a drinking glass, `ハンバーグ` means a bunless Hamburg steak, `フロント` means a hotel front desk, `マウス` means a computer mouse, `ポイント` means reward points, and `スタッフ` means personnel.
3. `さっぱり` is taught with both its refreshed sense and its common negative construction meaning “not at all”; its two examples make the contrast explicit.
4. JMdict priority tags are a broad selection aid, not a claim that the 120 words have a precise rank in contemporary speech.
5. The WaniKani result is time-bound. Refresh the exclusion snapshot and rerun normalization checks immediately before production import and periodically after release.

## Licensing requirement

The EDRDG dictionary files and derived data are distributed under **CC BY-SA 4.0**. The official licence requires source acknowledgment and links in software that uses the files, and it requires a procedure for regular updates. Before importing this catalog, add an EDRDG/JMdict acknowledgment to the app's About or Sources surface and have product/legal confirm the treatment of the derived lexical fields. See the [official EDRDG dictionary licence](https://www.edrdg.org/edrdg/licence.html).
