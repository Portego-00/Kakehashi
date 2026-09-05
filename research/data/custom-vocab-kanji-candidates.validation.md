# Kanji vocabulary expansion: validation summary

Validation date: 2026-08-31 (Europe/Madrid)

## Outcome

[`custom-vocab-kanji-candidates.json`](./custom-vocab-kanji-candidates.json) contains **121 unique candidate words containing kanji in six WaniKani level-range packs**. Pack sizes deliberately vary:

| Pack | Level range | Words | Actual required levels |
| --- | ---: | ---: | ---: |
| Everyday Kanji: Levels 1–10 | 1–10 | 27 | 1–10 |
| Everyday Kanji: Levels 11–20 | 11–20 | 23 | 11–20 |
| Everyday Kanji: Levels 21–30 | 21–30 | 21 | 21–30 |
| Everyday Kanji: Levels 31–40 | 31–40 | 19 | 31–40 |
| Everyday Kanji: Levels 41–50 | 41–50 | 17 | 41–50 |
| Everyday Kanji: Levels 51–60 | 51–60 | 14 | 51–60 |
| **Total** |  | **121** |  |

The candidate file uses the top-level shape `{ schemaVersion, generatedAt, sourceSnapshots, packs }`. Every pack has production-ready `script: "kanji"` and `levelRange: { min, max }` fields. Every word contains the production lesson fields plus three audit fields:

```text
{
  id,
  characters,
  reading,
  meanings[],
  partsOfSpeech[],
  meaningMnemonic,
  readingMnemonic,
  contextSentences[{ ja, en }, { ja, en }[, { ja, en }]],
  requiredLevel,
  kanjiLevels,
  jmdictPriorityTags[]
}
```

The pack and word shapes align with the web app's custom-vocabulary catalog. `jmdictPriorityTags` is research provenance and can be retained as harmless extra JSON metadata or omitted by the production sync step.

## Lexical source and selection

The lexical pass used the official EDRDG JMdict daily distribution dated 2026-08-31. JMdict is the maintained source database behind EDICT; see the [official JMdict/EDICT project page](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) and [official distribution index](https://ftp.edrdg.org/pub/Nihongo/00INDEX.html).

The source contained 218,672 entries. After requiring at least one WaniKani kanji, a visible WaniKani level for every kanji, a priority/commonness tag, and no WaniKani lexical-form conflict, 20,923 written-form/reading candidates remained. The final 121 were selected for broad practical value and coherent level-range coverage.

All **121 / 121** selected written-form/reading pairs carry JMdict priority evidence on both the matching written-form and reading elements:

- 119 have `ichi1`.
- 103 have `news1` (many overlap the `ichi1` set).
- 117 have an `nf01`–`nf47` newspaper-frequency band.
- 2 have `spec1`.

These tags are selection evidence rather than a precise modern spoken-frequency rank. The [official JMdict DTD documentation](https://www.edrdg.org/jmdict/jmdict_dtd_h.html) explains the priority fields and their limitations.

For a stronger same-lexeme exclusion, the selection pass rejected an entire JMdict entry when any alternative written form in that entry matched a WaniKani vocabulary-family subject. This prevents an alternate spelling from reintroducing a word WaniKani already teaches.

A final raw-XML audit re-resolved all 121 exact written-form/reading pairs, applied JMdict reading and sense restrictions, verified the stored priority tags, and rechecked every alternative written form. It found zero missing pairs, zero priority-tag mismatches, zero restricted-sense errors, and zero WaniKani collisions. None of the final written forms is marked “usually written using kana alone.” This pass also corrected `古本` from the uncommon `こほん` reading to the priority reading `ふるほん`.

## WaniKani exclusion and kanji-level audit

The live API snapshots used for validation are [`wanikani-vocabulary-exclusions.snapshot.json`](./wanikani-vocabulary-exclusions.snapshot.json) and [`wanikani-kanji-levels.snapshot.json`](./wanikani-kanji-levels.snapshot.json). They were fetched at `2026-08-31T20:05:11.156Z` using API revision `20170710`, following the [official Subjects API contract](https://docs.api.wanikani.com/20170710/#subjects). The supplied API credential was read only for the request and is not present in any artifact or output.

The vocabulary denylist includes every returned subject, including hidden records:

| Subject set | Count |
| --- | ---: |
| Ordinary `vocabulary` | 6,765 |
| `kana_vocabulary` | 60 |
| Visible vocabulary-family subjects | 6,797 |
| Hidden vocabulary-family subjects | 28 |
| **Total checked** | **6,825** |

Candidate and API written forms were Unicode NFKC-normalized and trimmed before comparison. A second hard-exclusion key removes one leading polite `お` or `ご` and a trailing `する` from both sides. This treats pairs such as a noun and its WaniKani `する` form, or a polite-prefixed form and its base, as the same lesson rather than letting an exact-string check miss them.

The final result is **zero exact or normalized-variant overlaps** with the 6,825 WaniKani subjects. It is also zero against both custom-vocabulary sources: the original 48-word catalog and the completed 120-word kana candidate expansion.

Four candidate readings match an unrelated WaniKani homophone: `以来` / `依頼`, `給食` / `求職`, `休講` / `急行`, and `駐車` / `注射`. Reading equality alone is not lexical duplication; each pair has a different written form, dictionary entry, and meaning. They were reviewed and retained.

The kanji snapshot contains 2,102 subjects: 2,101 visible and one hidden. For every candidate:

1. Each Unicode Han character was extracted from `characters` (with repeated kanji deduplicated).
2. Every character had to resolve to a visible WaniKani kanji subject.
3. Every stored `kanjiLevels` value had to equal the live subject level.
4. `requiredLevel` had to equal the maximum component-kanji level.
5. `requiredLevel` had to fall inside the containing pack's `levelRange`.

All 121 words pass all five checks. No candidate uses the hidden kanji `昌` or a kanji absent from WaniKani.

## QA hardening and replacements

The exact-form screen initially missed eight definite morphological variants. They were replaced before the final audit:

| Removed overlap | WaniKani form | Replacement | Required level |
| --- | --- | --- | ---: |
| `合格` | `合格する` | `花束` | 14 |
| `設定` | `設定する` | `調査` | 21 |
| `招待` | `招待する` | `手段` | 27 |
| `延期` | `延期する` | `適切` | 30 |
| `見舞い` | `お見舞い` | `交換` | 36 |
| `お釣り` | `釣り` | `白髪` | 44 |
| `洗濯` | `洗濯する` | `枯れ葉` | 51 |
| `風呂` | `お風呂` | `冠婚葬祭` | 54 |

Five conventional spellings that JMdict marks as usually written in kana were also replaced with common, priority-tagged kanji forms:

| Removed form | Replacement | Required level |
| --- | --- | ---: |
| `一々` | `取っ手` | 6 |
| `お喋り` | `運賃` | 33 |
| `畳む` | `通帳` | 48 |
| `仰る` | `無駄遣い` | 50 |
| `胡麻` | `据え置き` | 53 |

The editorial QA pass additionally corrected the `古本` reading and stable ID, narrowed the meaning of `帰省`, fixed the part of speech for `参考`, repaired the `合宿` and `日陰` reading mnemonics, and revised mismatched or unnatural contexts for `今後`, `内科`, `伝言`, `区別`, `印象`, `清掃`, `蒸す`, and `粗末`.

## Schema, duplication, and content checks

Automated validation passed all of the following with **zero errors and zero warnings**:

- JSON parses successfully and declares six packs.
- Pack IDs, word IDs, and NFKC-normalized written forms are globally unique.
- The 121 polite-prefix/`する`-normalized candidate keys are also globally unique.
- Pack sizes are `27, 23, 21, 19, 17, 14`, so the packs are not mechanically uniform.
- Every pack uses `script: "kanji"` and a valid `levelRange`.
- Every word contains at least one kanji, a hiragana canonical reading, at least one meaning, and at least one part of speech.
- All 121 written-form/reading pairs resolve directly in the raw JMdict XML with applicable senses and matching written-form and reading priority tags.
- No selected entry is marked as usually written in kana.
- Every meaning mnemonic includes a supported `<vocabulary>...</vocabulary>` target matching one of the lesson meanings.
- Every reading mnemonic includes the exact canonical reading in `<reading>...</reading>`.
- Mnemonics use only the supported `radical`, `kanji`, `vocabulary`, `meaning`, and `reading` tags.
- Every word has two or three non-empty Japanese/English context pairs: 118 have two and 3 have three, for **245 context pairs total**.
- Every Japanese context for every word includes the exact target written form.
- There are zero exact or polite-prefix/`する`-normalized overlaps with the 6,825 live WaniKani forms, 48 original custom forms, or 120 completed kana-candidate forms.
- Every `kanjiLevels` map and `requiredLevel` value matches the live WaniKani kanji snapshot.

All mnemonics, concise English labels, and Japanese/English example sentences in the candidate file were written specifically for this project. No WaniKani mnemonic or context sentence was copied.

## Editorial caveats

1. The contexts were checked for grammar, target sense, and ordinary register, but should still receive a native-speaker editorial pass before publication.
2. Medical and education-system vocabulary such as `糖尿病` and `偏差値` is included for recognition and ordinary communication, not as medical or admissions guidance.
3. JMdict priority fields are broad commonness signals, not a claim of an exact rank in present-day conversation.
4. The WaniKani exclusion is time-bound. Refresh both live snapshots and rerun the same exact, variant, alternative-form, and level checks immediately before production import and periodically after release.

## Licensing requirement

The EDRDG dictionary files and derived lexical data are distributed under **CC BY-SA 4.0**. Before importing this catalog, add an EDRDG/JMdict acknowledgment to the app's About or Sources surface, provide the required links, and have product/legal confirm treatment of the derived lexical metadata. See the [official EDRDG dictionary licence](https://www.edrdg.org/edrdg/licence.html).
