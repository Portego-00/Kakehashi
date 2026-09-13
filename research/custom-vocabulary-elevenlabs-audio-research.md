# ElevenLabs audio for custom vocabulary

Researched 2026-09-07. Public first-party sources only; no authenticated browser access, audio generation, or voice audition was performed for this research. Recommendations below are proposed tests, not verified pronunciation-quality rankings.

## Recommendation

Start with five isolated words using **Miiko or Rin**, compare with **Shizuka**, and use **Multilingual v2** as the baseline. Compare Eleven v3 on the same words before selecting the final model. Keep free-plan output as an evaluation set: future commercial app assets should be generated while the appropriate paid license is active, not merely moved into production after upgrading.

## Japanese female voice shortlist

These names, IDs, and female/Japanese descriptions were verified in the public Japanese TTS page's embedded voice metadata. These are library candidates, not a claim that every candidate is accessible on the free account. The rationale is an inference from the provider's descriptions. [Official Japanese TTS page](https://elevenlabs.io/text-to-speech/japanese)

| Candidate | Voice ID | Why audition it |
| --- | --- | --- |
| Miiko | `1czwMoQxv9Ni4H7M5hXx` | Instructional delivery, clear information presentation; strong starting point for learning audio. |
| Rin | `NxfO5zydfqwpYnWQJ7jJ` | Neutral, even delivery; useful contrast to expressive narration. |
| Shizuka | `WQz3clzUdMqvBf0jswZQ` | Gentle delivery with understandable articulation; softer alternative. |
| Konoha | `T7yYq3WpB94yAuOXraRi` | Measured explanatory delivery; another clarity-focused candidate. |

Do not infer gender from names: the same page explicitly describes Hinata and Asahi as male. Native-language voice training matters because a voice trained in another language can retain its original accent. [Japanese voice metadata](https://elevenlabs.io/text-to-speech/japanese), [TTS language/accent guidance](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)

Some Voice Library voices are paid-only or carry a credit multiplier. Check the selected voice's live availability and price badge before generating; public listing alone is insufficient. [Voice Library restrictions](https://elevenlabs.io/docs/eleven-creative/voices/voice-library), [Free-plan multiplier restriction](https://help.elevenlabs.io/hc/en-us/articles/33569002955153-Why-can-t-I-use-some-voices-from-the-Voice-Library)

## Models, settings, and short-word limitations

- **Multilingual v2** (`eleven_multilingual_v2`) supports Japanese and is positioned for consistent, natural speech. My recommendation to start here is an inference from that emphasis, not a provider guarantee for dictionary entries. **Eleven v3** (`eleven_v3`) also supports Japanese and emphasizes expressive delivery. Both merit a controlled pronunciation comparison; Flash/Turbo's speed is not the priority for pre-generated assets. [Model overview](https://elevenlabs.io/docs/overview/models)
- v3 became generally available on February 2, 2026. Older indexed documentation still calls it alpha; do not treat that label as current. [Official GA announcement](https://elevenlabs.io/blog/eleven-v3-is-now-generally-available)
- An old alpha guide warned that very short prompts were inconsistent and suggested experimenting above 250 characters. That is **historical advice, not a current minimum**: the current consolidated guide does not repeat the threshold. Do not pad vocabulary prompts with arbitrary text solely to meet it. [Historical v3 prompting guide](https://elevenlabs.io/docs/best-practices/prompting), [Current best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- The web tool detects language from the supplied text; its documentation says there is no explicit website language override. Avoid English instructions or mixed-language prompts. The API has `language_code` for ambiguous input, but that is not the requested web workflow. The documented conventional starting settings are stability 50, similarity 75, style 0, speed 1.0 where the model exposes those controls. [TTS product guide](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- For ambiguous kanji, my recommendation is to synthesize the catalog's exact kana reading while keeping kanji as asset metadata. Alternatively use Studio pronunciation aliases. Do not assume Japanese IPA/phoneme overrides work: documented phoneme support is limited to particular English models. [Pronunciations Editor](https://help.elevenlabs.io/hc/en-us/articles/37896325858065-How-do-I-use-the-Pronunciations-Editor-in-Studio)

Suggested QA set: やっぱり, ゆっくり, どうぞ, コーヒー, and a kanji word with a verified reading such as 女子 → じょし. Listen for doubled consonants, long vowels, pitch/accent, clipped beginnings/endings, and unwanted spoken instructions. Kana substitution can disambiguate sounds but should not be treated as proof of correct pitch accent. These are project QA recommendations; native Japanese review remains preferable before publication.

## Web-only generation and separate-file exports

For the five-word audition, generate each word separately in Text to Speech and download it from History. History supports MP3/WAV and additional formats. Use the vocabulary ID plus voice/model in local filenames. [Official download workflow](https://help.elevenlabs.io/hc/en-us/articles/26020223217297-How-do-I-download-WAV-M4A-and-FLAC-files)

For a larger batch, the documented building blocks support this proposed workflow:

1. Create a Studio/audiobook project and make one chapter per vocabulary item. Keep the chapter title as metadata and only the intended Japanese utterance in the spoken text. Chapter management supports adding, naming, and reordering chapters. [Chapter management](https://help.elevenlabs.io/hc/en-us/articles/33783851933713-How-do-I-add-chapters-to-a-Studio-project)
2. Apply the chosen voice/model, generate and validate a small subset first, then the remaining chapters. Export the project as a ZIP of separate chapter audio files. Exporting already generated text adds no generation charge; ungenerated paragraphs can trigger generation, with an estimated credit cost shown. [Studio export documentation](https://elevenlabs.io/docs/eleven-creative/products/studio)
3. Verify the ZIP's filename mapping and that metadata was not spoken before scaling. This is a proposed adaptation of chapter exports, not a documented one-click CSV vocabulary tool. No official support for turning a pasted list directly into hundreds of individual files was established.

Studio is available on Free. Its free-tier audio exports are 128 kbps MP3, or WAV converted from that source; choosing WAV does not recover lossless source quality. Higher plans have different export quality. [Studio availability and quality](https://elevenlabs.io/docs/eleven-creative/products/studio)

## Free 10,000-credit budget

The current public Free plan includes 10,000 monthly credits and three Studio projects. Multilingual v2 is priced at one credit per input character; the TTS website documentation also states one credit per character for v3. Do not apply an API Flash/Turbo discount to a website estimate without checking its actual quote. [Current pricing](https://elevenlabs.io/pricing), [Website v3 pricing](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)

Generation consumes credits, not downloading or listening to previously generated audio. TTS website regeneration may be free twice if the same prompt, voice, and model remain eligible within two hours without leaving/refreshing. v3 instead produces two alternatives for one prompt charge and subsequent generation clicks are charged again. Trust the live Generate/Regenerate label and displayed price, not an assumed retry allowance. [Generation and regeneration billing](https://help.elevenlabs.io/hc/en-us/articles/13313274666769-Do-I-use-quota-on-every-generation)

Illustrative arithmetic, not a quote: at eight input characters per word, five words cost about 40 credits per voice; three voices cost about 120. Five hundred words would cost about 4,000 credits for a single pass before retries or multipliers. Count the actual submitted Japanese text and reserve a retry budget.

## Publication and commercial use

Free-tier use is noncommercial under the EEA terms. The publishing FAQ says paid-subscription output can retain commercial permission after the subscription ends, but audio generated outside the paid period is not retrospectively commercially licensed. Free output published noncommercially requires the specified ElevenLabs attribution. These are provider constraints, not legal advice. [EEA terms, section 1(c)](https://elevenlabs.io/terms-of-use-eu), [Publishing and commercial-license FAQ](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)

Operational recommendation: mark free-trial files evaluation-only, preserve voice/model/settings/input text in an asset manifest, and regenerate approved production audio under an appropriate paid plan if the app use is commercial. Confirm current terms and any selected-voice restrictions before distribution.

## Follow-up: automatic chapter imports for 565 words

The official import instructions explicitly recommend a well-structured **EPUB with Heading 1 chapter headings** for automatic chapter splitting. DOCX is accepted, but the reviewed documentation does not specify an equally explicit DOCX style-to-chapter contract. EPUB is therefore the more evidence-backed pilot format. ElevenLabs does not document whether its importer relies on the EPUB spine, navigation, headings, or a combination; ordinary EPUB conformance alone does not prove Studio's import behavior. [Studio import formats](https://help.elevenlabs.io/hc/en-us/articles/25708839235345-Which-file-formats-can-I-import-with-Studio)

The documented per-project limits are **500 chapters**, 400 paragraphs per chapter, and 5,000 characters per paragraph. There is no separate lower Free chapter cap stated. The help article says Free allows five projects, while the current pricing page says three; plan conservatively for **three**, with the live account limit authoritative. Two full imports plus one pilot fit only if three slots are available. Do not delete existing projects to make room without authorization. [Studio size limits](https://help.elevenlabs.io/hc/en-us/articles/28622761381905-Are-there-any-limitations-to-the-size-of-a-project-in-Studio), [Current Free pricing](https://elevenlabs.io/pricing)

### Word IDs must not be spoken

The API documentation separates chapter `name` from content, calls that name identification-only, and shows heading blocks with speech nodes plus a default title voice. Consequently, **an imported Heading 1 containing an ID must not be assumed silent**. No documented skip-heading import setting was found. [Chapter name semantics](https://elevenlabs.io/docs/api-reference/studio/add-chapter), [Studio heading/content schema](https://elevenlabs.io/docs/api-reference/studio/add-project)

The proposed pilot instead uses the exact `ttsInput` as the sole body heading, with the ID confined to the XHTML title, navigation labels, NCX label, and filename:

```xml
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
  <head><title>conversation-yappari</title></head>
  <body><h1>やっぱり</h1></body>
</html>
```

Each word is a separate XHTML manifest/spine item. The navigation document is in the manifest but not the reading spine; it references each word and uses its ID as the label. The EPUB includes a package document, navigation document, legacy NCX, container descriptor, and first/uncompressed `mimetype` entry. This packaging follows EPUB 3 conventions; Studio's choice of chapter label remains to be verified. [EPUB 3.3 specification](https://www.w3.org/TR/epub-33/)

### Prepared local artifacts

`research/prepare-custom-vocabulary-epub-imports.mjs` creates these files under `output/custom-vocabulary-audio/imports/`, with a separate `.index.json` for each EPUB:

| Import | Words | Intact packs |
| --- | ---: | ---: |
| `custom-vocabulary-pilot-5.epub` | 5 | First five entries of Conversation Glue |
| `custom-vocabulary-bulk-1.epub` | 278 | 24 |
| `custom-vocabulary-bulk-2.epub` | 287 | 25 |

The pilot contains どうぞ, やっぱり, ゆっくり, じゃあ, どうも. Both bulk imports together cover all 565 manifest IDs exactly once and retain original pack order without splitting a pack. The mapping records ordinal, word ID, pack, exact input, reading, XHTML path, and destination audio filename. XML well-formedness, ZIP integrity, first-entry mimetype rules, limits, and unique bulk coverage were checked locally; a full EPUBCheck run was not performed.

Before generating, inspect the imported pilot for exactly five chapters and exactly one Japanese utterance per chapter. Check whether Studio uses IDs or kana as chapter names, whether it accidentally imported navigation as narration, and whether any chapter became empty because the importer removed its sole heading. Then export the pilot chapter ZIP and verify filename mapping and speech. Only import the bulk files after this passes. No audio was generated by the preparation script.

## Subsequent authorized website pilot

Five separate Shizuka/Multilingual v2 generations were later made through the visible TTS website, each using only the exact first-five manifest inputs. Their fresh audio-player text and voice were verified before downloading. Copies and `generation-metadata.json` are in `output/custom-vocabulary-audio/2026-09-07-elevenlabs-japanese-female/_samples/shizuka-single-word/`; the original Downloads files were preserved. All five copies match their originals and hashes, and local metadata identifies five distinct mono 44.1 kHz MP3s, approximately 0.78–1.02 seconds long. Pronunciation QA was left to the separate validation task.

Observed UI settings were Japanese language override, speed 1.00, style 0, stability 0.80, similarity 1, and speaker boost on. The download filenames nevertheless encode speed 1.01 and stability 0.96. This discrepancy is recorded, not silently resolved; no private API state was inspected. The live website **does expose a Japanese language override**, contrary to the earlier public documentation, so prefer the confirmed UI over that stale documentation for this workflow.

`research/custom-vocabulary-cua-batch-recipe.js` contains an unexecuted small-batch recipe based on verified visible controls. It requires explicit approved IDs and a character budget, checks input/voice/model/language/settings, waits for the exact new word inside the audio player, and downloads without waiting on the unreliable download event. A shared local download lock and before/after file reconciliation are required outside CUA. Only its read-only selectors and syntax were verified; the batch function has not been run and no further credits were spent preparing it.
