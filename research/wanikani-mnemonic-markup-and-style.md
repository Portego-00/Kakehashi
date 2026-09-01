# WaniKani mnemonic markup and vocabulary-authoring notes

Research date: 2026-09-01  
API revision requested: `20170710`

## Scope and method

This note uses only WaniKani's official [API reference](https://docs.api.wanikani.com/20170710/#subjects) and the live official `/v2/subjects` API. The authorized token was used only in request headers and was not written to this repository.

The live audit fetched all 9,431 current subject records (9,389 non-hidden) and inspected `meaning_mnemonic` and `reading_mnemonic`. It also inspected all 6,825 regular- and kana-vocabulary records and all 2,102 kanji records. The collection endpoint is paginated at 1,000 records and supports `types`, `levels`, and `hidden` filters, as documented under [Get All Subjects](https://docs.api.wanikani.com/20170710/#get-all-subjects).

Primary live endpoints:

- [All vocabulary and kana vocabulary](https://api.wanikani.com/v2/subjects?types=vocabulary,kana_vocabulary)
- [All kanji](https://api.wanikani.com/v2/subjects?types=kanji)
- [All four subject types](https://api.wanikani.com/v2/subjects?types=radical,kanji,vocabulary,kana_vocabulary)

No full WaniKani mnemonic is reproduced here. Examples are short fragments or paraphrases of their structure.

## Findings that should drive the implementation

1. WaniKani's five documented semantic highlight elements are `<radical>`, `<kanji>`, `<vocabulary>`, `<meaning>`, and `<reading>`. See [Markup highlighting](https://docs.api.wanikani.com/20170710/#subject-data-structure).
2. The live corpus also uses `<em>`, `<i>`, `<ja>`, and `<a>`. A renderer implementing only the documented five tags will still mishandle current official content.
3. The live mnemonic fields use blank lines, not `<p>` or `<br>`, for paragraph boundaries. The kana example in the official schema also uses a blank line between the memory scene and its usage explanation. See [Kana Vocabulary Attributes](https://docs.api.wanikani.com/20170710/#kana-vocabulary-attributes).
4. Kana vocabulary has a meaning-only study shape. All 60 live `kana_vocabulary` records have `meaning_mnemonic`, context sentences, and audio, but none has `readings`, `reading_mnemonic`, or `component_subject_ids`.
5. Kana sound hooks live inside `meaning_mnemonic`, wrapped in `<reading>`, while the remembered meaning is wrapped in `<vocabulary>`. This is why kana should have only **Meaning** and **Context** tabs even though its one mnemonic can style both reading and meaning concepts.
6. Kanji-containing vocabulary has separate `meaning_mnemonic`, `readings`, and `reading_mnemonic` fields, plus `component_subject_ids` identifying its WaniKani kanji components. See [Vocabulary Attributes](https://docs.api.wanikani.com/20170710/#vocabulary-attributes).

## Complete live tag and entity inventory

These are opening-tag occurrences across `meaning_mnemonic` and `reading_mnemonic` for all 9,431 subjects, including hidden records. Counts describe the 2026-09-01 snapshot, not an API guarantee.

| Element | Opening occurrences | Status and role |
| --- | ---: | --- |
| `<kanji>` | 15,051 | Documented semantic highlight; in vocabulary mnemonics it normally marks a component's familiar English gloss. |
| `<vocabulary>` | 12,496 | Documented semantic highlight; marks the target word or one of its meanings. |
| `<radical>` | 5,386 | Documented semantic highlight; mostly used in kanji composition mnemonics. |
| `<reading>` | 4,243 | Documented semantic highlight; marks a reading or English sound hook. |
| `<em>` | 70 | Ordinary emphasis. |
| `<a>` | 12 | External or WaniKani/Tofugu link. |
| `<ja>` | 6 | Japanese-language text. It appears in the official kana-vocabulary example despite not being in the five-item documented highlight list. |
| `<i>` | 5 | Rare legacy italic/emphasis markup. |
| `<meaning>` | 0 | Officially documented and therefore still needs renderer support, but unused in this live snapshot's two mnemonic fields. |

The only encoded entities found were `&gt;` (three occurrences) and `&amp;` (one occurrence). The corpus also contains literal Unicode such as curly quotes and non-breaking spaces, so rendering must preserve Unicode rather than reducing the strings to ASCII.

Current `<a>` elements use only `href`, `target`, and, once, `rel`. Every observed URL used `http:` or `https:`. There were no observed `class`, `style`, `id`, event-handler, image, script, list, paragraph, line-break, or heading elements.

Vocabulary-specific detail:

- Regular vocabulary uses `<vocabulary>`, `<kanji>`, `<reading>`, `<em>`, `<ja>`, `<i>`, and `<a>` across the two mnemonic fields.
- Kana vocabulary uses only `<reading>` and `<vocabulary>` in `meaning_mnemonic` in the current corpus: 36 and 99 opening occurrences respectively.
- The official docs' five semantic tags remain the compatibility contract even if one of them is absent from today's vocabulary snapshot.

## Safe web-renderer contract

The web app should parse mnemonic markup into React nodes; it should neither print the raw tags nor inject the source wholesale with unsanitized `dangerouslySetInnerHTML`.

Use this allowlist:

| Source element | Render as |
| --- | --- |
| `radical` | Existing radical semantic mark/component styling. |
| `kanji` | Existing kanji semantic mark/component styling. |
| `vocabulary` | Existing purple vocabulary semantic mark styling. |
| `meaning` | Existing meaning semantic mark styling. |
| `reading` | Existing reading semantic mark styling. |
| `em`, `i` | Semantic emphasis (`em` is preferred for newly authored content). |
| `ja` | Inline Japanese text, preserving the app's Japanese font and language treatment. |
| `a` | Sanitized link. Permit only `http:`/`https:`, force a safe new-tab policy and `rel="noopener noreferrer"`, and discard every other attribute. |

Additional rules:

- Decode standard named and numeric character references. At minimum, the live corpus requires `&amp;` and `&gt;`.
- Split `\r\n\r\n` and `\n\n` into paragraphs. Preserve a single newline as a line break only when it is meaningful.
- For an unknown or disallowed element, keep its text children and drop the element/attributes. Never silently lose the mnemonic text.
- Require properly nested, balanced tags in custom catalog validation.
- Apply the same component everywhere mnemonics appear: normal subject details, custom subject details, and lesson/review explanations.
- Add renderer fixtures for every allowlisted element, both observed entities, two paragraphs, an unsafe URL, unknown markup, nested `<ja><reading>…</reading></ja>`, and literal Unicode whitespace.

## Composition-first authoring guidance for new kanji vocabulary

WaniKani's strongest vocabulary meaning mnemonics generally follow this shape:

1. **Composition bridge.** Name the kanji components in written order using the component meanings the learner already knows. Wrap each gloss in `<kanji>`.
2. **Meaning payoff.** Connect that composition to the target meaning and wrap the payoff in `<vocabulary>`.
3. **Usage paragraph.** After a blank line, explain register, nuance, common setting, a useful contrast, or a representative collocation.

A minimal synthetic form is:

```html
A <kanji>woman</kanji> <kanji>child</kanji> is a <vocabulary>girl</vocabulary>!

Use this word in relatively formal classification or categorization contexts.
```

Authoring requirements for the expanded custom catalog:

- Resolve every written kanji to the live WaniKani kanji record. Use its primary meaning for the default component gloss; use a familiar accepted alternate only when the primary gloss would make the bridge misleading.
- Cover every distinct written kanji component in the first paragraph. Repeated kanji may share one clearly pluralized mention when that reads better.
- Prefer a short literal bridge when the composition is transparent. Do not inflate “revise + correct → correction” into an unrelated story.
- If the composition is only suggestive, create one concrete cause-and-effect scene that contains all components and lands on the real meaning.
- If the spelling is ateji, a proper name, or otherwise compositionally misleading, explicitly say that the literal components are not the meaning. Never present a mnemonic as historical etymology without a primary etymological source.
- Explain okurigana or a meaningful kana contribution in plain text; do not wrap kana in `<kanji>`.
- Put target meanings—not component meanings—inside `<vocabulary>`. Put sound hooks or readings inside `<reading>`.
- Use `<em>` sparingly for genuine contrast. Do not add links or legacy `<i>` to new catalog content.
- Escape literal ampersands and angle brackets as entities. Do not place punctuation inside a semantic tag unless it belongs to the highlighted phrase.
- Keep the first paragraph memorable and compact. Use the second paragraph for practical Japanese, not another English redefinition.
- Preserve the existing story-mnemonic quality gate: a sound resemblance by itself is not a mnemonic; it needs a concrete scene, consequence, meaning payoff, and accurate usage.

### Representative live vocabulary patterns across 5-level ranges

The table characterizes official live subjects without reproducing their prose.

| Range | Official subject | Components | Pattern worth following |
| --- | --- | --- | --- |
| 1–5 | [女子 #2514](https://api.wanikani.com/v2/subjects/2514) | woman + child | Direct literal composition, then a separate register/classification note. |
| 6–10 | [開業 #3187](https://api.wanikani.com/v2/subjects/3187) | open + business | Direct action-object composition, followed by professions where the term is common. |
| 11–15 | [今晩は #3765](https://api.wanikani.com/v2/subjects/3765) | now + night + kana | Composition plus an explicit kana-pronunciation point and modern spelling note. |
| 16–20 | [指圧 #4268](https://api.wanikani.com/v2/subjects/4268) | finger + pressure | Literal composition, then a concise real-world definition and secondary sense. |
| 21–25 | [切腹 #5077](https://api.wanikani.com/v2/subjects/5077) | cut + abdomen | Literal composition, then necessary cultural definition. |
| 26–30 | [主因 #3968](https://api.wanikani.com/v2/subjects/3968) | main + cause | Direct gloss, formal-register note, and a useful collocation. |
| 31–35 | [厄介 #5883](https://api.wanikani.com/v2/subjects/5883) | misfortune + jammed in | A causal image where literal composition is less transparent, then a near-synonym distinction. |
| 36–40 | [拉致 #8989](https://api.wanikani.com/v2/subjects/8989) | abduct + do | Compact composition and a note about the discourse where the word appears. |
| 41–45 | [肌色 #6861](https://api.wanikani.com/v2/subjects/6861) | skin + color | Literal composition plus an important current-usage/semantic-change note. |
| 46–50 | [訂正 #7382](https://api.wanikani.com/v2/subjects/7382) | revise + correct | Process-oriented composition and the kinds of content it applies to. |
| 51–55 | [粗野 #8226](https://api.wanikani.com/v2/subjects/8226) | coarse + field | Concrete scene for an indirect composition, with a clear meaning payoff. |
| 56–60 | [漣斗 #9334](https://api.wanikani.com/v2/subjects/9334) | ripples + ladle | Explicitly rejects a misleading literal reading and identifies a proper-name use. |

Across all 4,718 visible regular-vocabulary records with two or more component IDs, 4,064 (86.1%) tag at least as many kanji glosses as they have components, and 4,703 (99.7%) use at least one `<vocabulary>` payoff. This supports composition coverage and a tagged target meaning as useful automated quality gates, while leaving an explicit exception path for opaque compounds and names.

## Five-level pack rules

The API defines a subject `level` from 1 through 60, and the live non-hidden kanji inventory divides into the requested ranges as follows:

| Range | Visible kanji |
| --- | ---: |
| 1–5 | 169 |
| 6–10 | 191 |
| 11–15 | 185 |
| 16–20 | 163 |
| 21–25 | 180 |
| 26–30 | 165 |
| 31–35 | 178 |
| 36–40 | 182 |
| 41–45 | 167 |
| 46–50 | 179 |
| 51–55 | 173 |
| 56–60 | 169 |

For a custom word, WaniKani does not supply a vocabulary subject level because the word is not a WaniKani subject. Use this deterministic assignment rule:

1. Map every written kanji character to its non-hidden live WaniKani kanji record.
2. Take the maximum `data.level` among those characters.
3. Put the word into the five-level range containing that maximum.

This ensures the user has encountered every component before the word's pack. Do not try to infer a custom level from official vocabulary placement: 1,764 visible official vocabulary records currently have a `data.level` different from the maximum level of their component kanji, because WaniKani's own curriculum placement is an independent editorial choice.

Kana-only words should remain in thematic kana packs rather than receiving a fabricated kanji level.

For overlap prevention, compare normalized candidate spellings against `data.characters` for **all** 6,825 official `vocabulary` and `kana_vocabulary` records, including the 28 currently hidden records. Excluding hidden subjects too prevents a retired WaniKani item from being reintroduced as “custom.”

## Suggested automated gates

For every newly authored kanji-containing word:

- all kanji resolve to a live WaniKani kanji subject;
- the pack range equals the range of the maximum component level;
- the first meaning-mnemonic paragraph contains a balanced `<kanji>` mention for each component, or a reviewed `opaqueCompositionReason`;
- at least one accepted target meaning appears inside `<vocabulary>`;
- the reading mnemonic's sound hooks exactly cover the accepted reading and are wrapped in `<reading>` where a sound mnemonic is used;
- the usage paragraph is factually consistent with dictionary evidence and does not overstate formality, frequency, or interchangeability;
- markup passes the renderer allowlist and balance checks;
- the normalized spelling does not occur in the complete WaniKani vocabulary/kana-vocabulary set;
- the resolved JMdict entry is not shared by any WaniKani form-reading pair, which catches alternate spellings even when English gloss wording differs;
- a second reviewer validates composition, reading coverage, meaning, and usage independently.

Re-run both the overlap snapshot and this markup-inventory test whenever the official subject catalog changes. Unknown future tags should remain readable through the text-preserving fallback and should fail the catalog authoring check until deliberately supported.
