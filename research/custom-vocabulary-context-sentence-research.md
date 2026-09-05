# Custom-vocabulary context sentences: research and editorial rubric

Research date: 2026-09-01 (Europe/Madrid)

## Outcome

This pass establishes the source hierarchy and editorial standard for original
Japanese–English example pairs, then applies it to all 565 entries in all 49
custom-vocabulary packs.

- 565/565 words now have at least two context sentences.
- 529 words have two sentences.
- 36 words have three sentences because the third demonstrates a distinct
  sense, register, construction, or domain.
- The catalog now contains 1,166 bilingual context pairs in total.
- All sentences are original. No corpus, dictionary, WaniKani, or other source
  sentence was copied or lightly paraphrased.

The final source breakdown is:

| Source | Packs | Words | Pairs | Two | Three |
| --- | ---: | ---: | ---: | ---: | ---: |
| `data/kana-vocabulary-packs.json` | 3 | 48 | 102 | 42 | 6 |
| `data/custom-vocab-kana-candidates.json` | 10 | 120 | 242 | 118 | 2 |
| `data/custom-vocab-kana-expansion.json` | 12 | 120 | 255 | 105 | 15 |
| `data/custom-vocab-kanji-candidates.json` | 12 | 121 | 245 | 118 | 3 |
| `data/custom-vocab-kanji-expansion.json` | 12 | 156 | 322 | 146 | 10 |
| **Total** | **49** | **565** | **1,166** | **529** | **36** |

Separate author and reviewer passes covered the starter, candidate, kana
expansion, and kanji expansion sets. Reviewers corrected collocations,
translations that inferred an unstated actor, repetitive templates, and
contextually over-broad loanword equivalents. They also removed optional third
examples whenever those examples merely restaged an existing use.

## Primary sources and what they establish

### JMdict / EDRDG: lexical identity and sense boundaries

The official [JMdict DTD](https://www.edrdg.org/jmdict/jmdict_dtd_h.html)
models an entry with one or more readings and one or more senses. It also puts
part of speech, field, usage labels, dialect, and glosses at the sense level,
and provides restrictions linking readings and senses to the written forms
where they apply. That makes the exact writing–reading pair and the selected
sense—not merely a matching string elsewhere in an entry—the lexical check for
an authored example.

EDRDG's [JMdict/EDICT editorial policy](https://www.edrdg.org/wiki/Editorial_policy.html)
instructs contributors to check spelling, existing variants, part of speech,
the wording of English meanings, and supporting references. Its
[editorial-process description](https://www.edrdg.org/wiki/Editorial_Process.html)
also requires correctly formulated entries, appropriate part-of-speech tags,
references, and editorial review rather than treating an unreviewed submission
as authoritative. Applied here, these principles support checking the target's
form, grammatical role, intended sense, and translation independently.

JMdict is a lexical authority, not a license to infer that every grammatically
possible sentence is idiomatic. Corpus evidence and editorial judgment are
still needed for collocation, register, and situation.

### NINJAL: attested written and conversational settings

NINJAL describes the [Balanced Corpus of Contemporary Written Japanese
(BCCWJ)](https://clrd.ninjal.ac.jp/bccwj/en/) as 104.3 million words sampled
across books, magazines, newspapers, business reports, blogs, forums,
textbooks, and legal documents. Its breadth makes it suitable for checking
written collocations and genre fit. The same overview notes that its main texts
are from 1986–2006 and that private journals and messages are not a focus, so it
must not be treated as complete evidence for current devices or casual speech.

NINJAL's [Corpus of Everyday Japanese Conversation (CEJC)
overview](https://www2.ninjal.ac.jp/conversation/cejc/design.html) says the
corpus records naturally occurring, purpose-driven everyday interaction,
balances varied situations, and contains 200 hours / roughly 2.4 million
short-unit words. That design makes CEJC the better model for whether casual
questions, offers, reactions, meal formulas, and service encounters sound like
something a speaker would actually say in context.

The official [NINJAL corpus-tools page](https://clrd.ninjal.ac.jp/en/tool.html)
documents keyword-in-context search in Shonagon and morphological, string, and
surrounding-context search in Chunagon. Those tools support checking recurring
constructions and nearby words rather than validating a target from an isolated
hit. Corpus lines remain evidence, not prose to copy into the product.

## Editorial rubric

The following rubric is a project synthesis based on the source capabilities
above; it is not presented as an official JMdict or NINJAL checklist.

1. **Validate the exact lexeme.** The sentence must contain the exact written
   target or a normal inflected/compound use of it. Confirm its canonical
   reading, selected sense, and part of speech against JMdict restrictions.
2. **Make the target sense recoverable.** Nearby words and the situation should
   make the intended meaning clear without relying on the English answer. Avoid
   examples whose omitted subject or object creates a different interpretation.
3. **Prefer a plausible speech event or text setting.** Use everyday motives:
   offering something, asking permission, making plans, ordering food, fixing a
   device, or reporting what happened. Do not manufacture a culturally odd
   scene just to fit a word.
4. **Keep Japanese idiomatic.** Check particles, argument structure,
   collocations, counters, politeness, and whether a loanword is used with its
   actual Japanese range. A sentence that is merely grammatical does not pass.
5. **Translate the whole utterance faithfully.** English should be idiomatic,
   preserve tense, modality, number when expressed, and the target's role, and
   avoid adding a subject or causal claim the Japanese does not support.
6. **Use two examples as the floor.** The second must add a different
   construction, interlocutor, or situation—not just exchange one noun for
   another.
7. **Use a third only for new learning value.** Add it when it isolates another
   listed sense, register, grammatical behavior, or genuinely different domain.
   Stop at two when a third would only restage the same use.
8. **Control difficulty.** Prefer common grammar and concrete vocabulary. A
   harder construction is justified only when it demonstrates how the target
   naturally behaves.
9. **Reject template repetition.** Do not let a pack collapse into repeated
   `Xをください`, `Xはどこですか`, or `Xをしました` frames. Vary statement,
   question, dialogue, request, condition, result, and description where useful.
10. **Run a bilingual final pass.** Read Japanese without the translation, then
    English without the Japanese, then compare them. Verify punctuation,
    typography, target presence, nonempty fields, and JSON validity
    mechanically.

## Applied audit decisions

- The existing explanatory sentence for `ごちそうさま` was replaced with an
  actual post-meal utterance, plus a separate sentence thanking someone who
  treated the speaker.
- Polysemous loanwords are bounded by context: `アイス` contrasts ice cream and
  iced coffee; `ネット` distinguishes online lookup, an internal network, and
  a tennis net; `メニュー` includes both restaurant and interface use; `レジ`
  distinguishes the checkout, the machine, and the cashier construction
  `レジの人`.
- Conversation connectors receive paired discourse functions rather than
  cosmetic substitutions: `やっぱり` confirms an expectation and returns to
  a decision; `つまり` paraphrases and draws a practical conclusion; `どうも`
  covers thanks and the adverbial “it seems” use.
- Homographic senses outside a pack's intended teaching scope are not forced
  into the examples. In particular, `バス` stays in the transport sense and
  `スーパー` stays in the supermarket sense.
- Kana-expansion review replaced unnatural or learner-unhelpful collocations,
  varied repetitive onomatopoeia frames, and kept 15 third examples only where
  they add a distinct use.
- Kanji-expansion review corrected voice and translation mismatches, clarified
  secondary senses such as `新譜` as new sheet music, and retained 10 third
  examples for genuine sense or construction contrasts.

## Remaining uncertainties

1. These original sentences have passed a lexical, grammatical, translation,
   and register audit, but not a named native-speaker copy-edit. A native
   editorial pass remains the strongest final release check.
2. `ジュース`, `アイス`, `ネット`, `メール`, `メニュー`, and `レジ` have
   context-dependent English equivalents. The translations intentionally
   choose the locally activated sense rather than repeating one gloss in every
   example.
3. Corpus coverage is evidence of observed usage, not proof that an unattested
   original sentence is wrong. Conversely, one isolated corpus hit is not
   enough to establish a general pattern.
4. BCCWJ's sampling period predates widespread smartphone/app language, so
   modern technology examples should be rechecked periodically against newer
   conversational or current-domain evidence.

## Mechanical acceptance checks

For every future catalog update, require:

- valid JSON;
- unique pack and word IDs;
- two or three nonempty `{ ja, en }` pairs per word;
- the target string present in every Japanese example, including normal
  compounds and inflections;
- no duplicate Japanese or English sentence within the catalog; and
- a manual review whenever a third example, rare sense, or register-sensitive
  expression is introduced.

The production catalog synchronizer and its catalog test now enforce the
mechanical parts of this checklist. The final catalog-wide audit found no
blank pairs, duplicate Japanese examples, case-insensitive duplicate English
examples, malformed context counts, or target-usage failures.
