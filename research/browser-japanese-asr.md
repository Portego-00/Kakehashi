# Browser-local Japanese ASR for spoken review readings

_Researched 2026-10-20. Sources are model owners' cards, released source, artifact metadata, and direct inspection/execution of released artifacts._

## Decision

For the initial Portego-only experiment, use the existing quantized
`juujika/wav2vec2-japanese-hiragana-onnx` graph with the already installed
`onnxruntime-web` WASM runtime. It produces kana directly: its complete
86-token vocabulary contains hiragana, `ー`, a separator, and two special
tokens; it cannot emit kanji. The released graph runs successfully with the
installed runtime. This establishes a practical browser implementation, not
dependable recognition of every isolated reading. Keep recognition editable
and require the user to submit it.

The converted repository has **no model card, license file, or attribution**.
Its entire token mapping exactly matches the Apache-2.0 upstream
`vumichien/wav2vec2-large-xlsr-japanese-hiragana`. Three upstream weight tensors
also occur byte-for-byte in the converted graph. This is strong evidence of
derivation, although the converter does not document it. Preserve upstream
attribution and explicitly identify the conversion rather than presenting
the converter repository as an independently licensed release.
([conversion repository](https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx),
[upstream model and license declaration](https://huggingface.co/vumichien/wav2vec2-large-xlsr-japanese-hiragana))

## Exact optional download

Pin conversion revision `abf0bd2a4c52bfcb958f2200508100007712cc09`.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `onnx/model.onnx` | 317,452,740 | `979e87fbbcc9c333cc51addaec9c7ded03fed2513143b2962776f43882c5c98f` |
| `vocab.json` | 1,201 | `90e85bcf553a51481efbb0a649866727ad889f2e9d4073958032fd8275e304b7` |
| **Total** | **317,453,941** | **317.45 MB decimal / 302.75 MiB** |

The much larger root-level `model.onnx` is 1,262,613,929 bytes; do not download
that file. The graph in `onnx/` is the quantized one.
([pinned artifact metadata](https://huggingface.co/api/models/juujika/wav2vec2-japanese-hiragana-onnx/tree/abf0bd2a4c52bfcb958f2200508100007712cc09?recursive=true&expand=false))

Direct assets:

- [Quantized graph](https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx/resolve/abf0bd2a4c52bfcb958f2200508100007712cc09/onnx/model.onnx)
- [Exact vocabulary](https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx/resolve/abf0bd2a4c52bfcb958f2200508100007712cc09/vocab.json)
- [Preprocessing config](https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx/raw/abf0bd2a4c52bfcb958f2200508100007712cc09/preprocessor_config.json)
- [Model config](https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx/raw/abf0bd2a4c52bfcb958f2200508100007712cc09/config.json)

The graph and vocabulary have already been downloaded for local validation
to `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-verification/japanese-hiragana-ctc.onnx` and `/tmp/kakehashi-asr-vocab.json`. These are verification artifacts, not committed model weights. The model file’s full SHA-256 was verified before moving it to the SSD.

## Runtime contract and decoding

Direct graph inspection and a real inference session confirmed:

- Input: sole tensor `input_values`, float32 `[batch_size, sequence_length]`.
- Output: sole tensor `logits`, float32 `[batch_size, output_frames, 86]`.
- Supply 16,000 Hz mono PCM; resample microphone audio when necessary.
- Normalize each recording to zero mean / unit population variance using
  `(sample - mean) / sqrt(variance + 1e-7)`. The released preprocessing
  config enables normalization. Do not normalize padded batches together.
- There is no `attention_mask` input in this graph.
- CTC blank is token **85**, `[PAD]`; `[UNK]` is **84**; separator `|` is **9**.
- Per frame, select the highest logit. Collapse consecutive identical token
  IDs, then omit blank and special IDs. A blank resets repetition: the
  sequence `[85, 76, 76, 85, 76]` must decode to `かか`, not `か`.
- Join the remaining kana and remove separators. Do not run a kanji
  conversion, dictionary disambiguator, or language model afterward.

These details come from the pinned graph/config/vocabulary above. The
normalization formula follows the upstream feature extractor implementation
([Transformers Wav2Vec2 feature extractor](https://github.com/huggingface/transformers/blob/main/src/transformers/models/wav2vec2/feature_extraction_wav2vec2.py)).

An implementation can use `onnxruntime-web/wasm` directly, without adding
Transformers.js. Store model bytes in a dedicated browser Cache Storage
cache only after an explicit download action. Retain an abortable download,
remove action, progress, storage failure handling, and local-only audio
processing. WASM single-thread execution also works without cross-origin
isolation. ORT's browser API supports creating sessions from model byte
buffers ([ONNX Runtime Web API](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSessionFactory.html)).

## Verification performed

The installed `onnxruntime-web` 1.29.0 successfully loaded and ran the actual
317 MB graph with the WASM execution provider, one thread, and graph
optimization enabled. This was run in Node with the WebAssembly runtime;
an application/browser integration check is still necessary.

| Check | Result |
| --- | --- |
| Session load | 1.79 seconds |
| One second of zero PCM | 2.13 seconds; output `[1,49,86]`; all values finite |
| Silence greedy IDs | All 49 frames were blank 85; decoded empty string |
| Repeat separated by blank | `[85,76,76,85,76]` → `かか` |
| Model-specific vocabulary sequence | `[85,33,33,27,27,50,13,85]` → `がっこう` |
| Separator/unknown/blank | `[84,85,9]` → empty string |

Five short synthetic Japanese recordings were generated locally with the
installed Apple Kyoko voice. These are integration samples, not a benchmark
of human pronunciation or a measure of population accuracy:

| Spoken fixture | Intended reading | Recognized | Inference |
| --- | --- | --- | ---: |
| 今日 | きょう | きょう | 0.54 s |
| 歯 | は | は | 0.56 s |
| こんにちは | こんにちは | こんにちは | 1.05 s |
| 学校 | がっこう | がとう | 1.04 s |
| おばあさん | おばあさん | おなあさん | 0.86 s |

This is why the feature should be labeled experimental and leave the
recognized answer editable. Correct kana-only output and correct
pronunciation recognition are different guarantees. Hiragana-only output
also does not guarantee strict phoneme spelling: orthographic conventions
such as particles and long vowels can remain ambiguous without context.
Never provide the expected review answer to the recognizer to make it
agree with the answer key.

The public Japanese audio sample in the Transformers.js documentation
dataset (48 kHz mono, 6.984 seconds, downsampled to 16 kHz) also ran
successfully in 6.27 seconds and returned only kana. A verified reference
transcript was not supplied, so this is an additional end-to-end execution
check rather than an accuracy claim. It is available locally at
`/tmp/kakehashi-asr-human-japanese.wav`; the filename does not establish
whether its source voice was human or synthesized.
([public source fixture](https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/japanese-audio.wav))

### Provenance evidence

Pinned upstream revision:
`017225bb128a6b1c6de9d58391f891908d69bc7b`.
The complete parsed upstream `vocab.json` equals the converted vocabulary.
Three independent, nonzero upstream safetensors tensors were downloaded
using their header-declared byte ranges; their complete bytes occur in
the converted graph:

| Upstream tensor | Bytes | Byte offset in converted graph |
| --- | ---: | ---: |
| `lm_head.bias` | 344 | 1,903,068 |
| `wav2vec2.feature_extractor.conv_layers.0.conv.bias` | 2,048 | 546,374 |
| `wav2vec2.encoder.layer_norm.bias` | 4,096 | 605,494 |

This supports attribution to the original model; it is not a complete
comparison of all quantized weights.
([upstream safetensors](https://huggingface.co/vumichien/wav2vec2-large-xlsr-japanese-hiragana/resolve/017225bb128a6b1c6de9d58391f891908d69bc7b/model.safetensors),
[upstream vocabulary](https://huggingface.co/vumichien/wav2vec2-large-xlsr-japanese-hiragana/raw/017225bb128a6b1c6de9d58391f891908d69bc7b/vocab.json))

## Other viable or promising models

| Model | Local artifact / license | Fit and limitation |
| --- | --- | --- |
| `TylorShine/distilhubert-hiragana-ctc` | 96,742,968-byte safetensors; Apache-2.0 | Strong smaller follow-up: 24.2M parameters, direct 84-class kana and 44-class phoneme outputs. Card reports 9.09% JSUT kana error and 12.5% JVS kana error. No released ONNX artifact; export and hosting are needed. |
| `sakasegawa/japanese-wav2vec2-large-hiragana-ctc` | 631,542,555-byte PyTorch inference checkpoint; Apache-2.0 | Direct kana and phoneme CTC, 315.6M parameters. Card reports 7.47% JSUT and 15.68% JVS kana error. No released ONNX artifact. |
| `kyeseung/japanese-hubert-base-phoneme-ctc-v3-onnx` | 189,110,821-byte `model_fp16.onnx`; Apache-2.0 with explicit upstream attribution | Already exported for browser ONNX Runtime. Outputs 48 phoneme tokens, not kana; requires sound-to-kana reconstruction or phoneme scoring. FP16 browser operator support needs verification. |
| `onnx-community/whisper-tiny` | Approximately 41 MB for q8 encoder + merged decoder; MIT upstream | Small and browser-ready, but its general Japanese output can contain kanji, so it does not meet the direct-reading requirement by itself. |

Primary sources for this comparison:
[DistilHuBERT model card](https://huggingface.co/TylorShine/distilhubert-hiragana-ctc),
[DistilHuBERT pinned artifact metadata](https://huggingface.co/api/models/TylorShine/distilhubert-hiragana-ctc/tree/01ffc3e5b0e49ba34180d50c48ea4111aa041cfd?recursive=true&expand=false),
[Sakasegawa model card](https://huggingface.co/sakasegawa/japanese-wav2vec2-large-hiragana-ctc),
[phoneme ONNX card and export code](https://huggingface.co/kyeseung/japanese-hubert-base-phoneme-ctc-v3-onnx),
[Whisper ONNX artifacts](https://huggingface.co/api/models/onnx-community/whisper-tiny/tree/ff4177021cc41f7db950912b73ea4fdf7d01d8e7/onnx?recursive=true&expand=false),
[Whisper architecture, languages, model sizes and MIT license](https://github.com/openai/whisper).

### DistilHuBERT export feasibility

The two released custom Python modules were inspected without executing
them. They define a `HubertConfig` subclass and a two-layer `HubertModel`
with a kana MLP and a phoneme linear head. The forward method exposes
`kana_logits` and `phoneme_logits`, and the tokenizer makes blank ID 0.
There are no external service calls in those modules. An explicit
`torch.onnx.export` wrapper returning `kana_logits` should be feasible;
this remains an engineering inference, not a completed conversion.
([pinned configuration module](https://huggingface.co/TylorShine/distilhubert-hiragana-ctc/raw/01ffc3e5b0e49ba34180d50c48ea4111aa041cfd/configuration_dual_ctc.py),
[pinned model module](https://huggingface.co/TylorShine/distilhubert-hiragana-ctc/raw/01ffc3e5b0e49ba34180d50c48ea4111aa041cfd/modeling_dual_ctc.py))

Transformers.js does not execute arbitrary Python `trust_remote_code` or
automatically export a safetensors model inside the browser. Its documented
workflow consumes ONNX models and recommends an offline Optimum conversion.
A custom architecture would need a supported conversion wrapper and an
ONNX asset host ([Transformers.js custom model documentation](https://huggingface.co/docs/transformers.js/main/en/custom_usage)).

## Limits relevant to reviews

No isolated-word benchmark was found for these kana models. Reported
sentence-level kana error rates cannot establish reliable grading of
single morae, long vowels, geminates, or beginner accents. The direct
vocabulary prevents kanji substitution but cannot prevent wrong kana.

Use this recognizer for Japanese reading answers. It is not an English
meaning recognizer. Keep regular keyboard entry and let microphone
permission failures, empty speech, cancellation, or inference failures
return the user to an editable answer without submitting a grade.


## Application implementation and browser validation

The web app now offers the optional ASR download under **Settings → Reviews** only for the real Portego account. It is disabled by default, excludes demo accounts, and fills editable Japanese reading answers in regular reviews, custom vocabulary reviews, and kana practice prompts. Meaning dictation retains the existing browser speech recognition setting. Anki and multiple choice answers do not show the local ASR control.

The recognizer receives only recorded PCM. It receives no subject, accepted readings, dictionary context, or expected answer. Microphone recordings stop after a pause or six seconds; cancelling, typing, switching questions, hiding the page, opening review settings, or leaving the review cancels pending work. Audio is not saved or uploaded.

A real Chromium browser check found that streaming the entire 317,452,740-byte model into a single Cache Storage entry failed with an internal storage error around 256 MiB. The same browser successfully stored all model bytes as separate 64 MiB ranges. The downloader therefore fetches exact HTTP byte ranges, verifies each range and byte count, caches the pieces independently, and resumes by skipping saved pieces. The worker reconstructs the model locally. The vocabulary is cached separately. Removing the model deletes only its dedicated cache.

Validation passed:

- 298 review/session regression tests across the regular review, custom SRS, extra study, and settings workspace components.
- 202 speech/settings tests in aggregate, with the preexisting profile test timing out under the parallel batch and passing on its own with two workers. The final ASR cache/decoder checks also passed after the last changes.
- 17 desktop/mobile browser checks passed (the expensive model inference check runs on desktop only).
- An additional complete browser run downloaded the pinned model directly from Hugging Face, recognized recorded synthetic `きょう`, retained it for a card expecting `かわ`, and marked it incorrect only after the user clicked Check. It also verified persistence after reload and model removal. A prior run used an identical local streaming mirror to avoid copying a 318 MB body through the browser automation protocol.
- The production web build and TypeScript check passed. Repository lint passed with four existing warnings outside this change.

The model is an experiment: the synthetic five-word probe above remains the only isolated-word accuracy evidence collected here. Browser integration success does not establish broader accuracy.

## Production rollback before ASR work

At the user's request, the mistaken review TTS addition was removed from production on 2026-10-20 by promoting the existing ready deployment `dpl_Hnz1AvifQmRr6HrpzaTV6dqzybk1` (`https://kakehashi-ir2rug6vg-portego-00s-projects.vercel.app`) back to `https://kakehashiapp.com`. The canonical deployment ID was checked afterward. All ten production desktop/mobile review smoke checks passed, and Portego settings no longer contained the added Review voice section. Existing context-sentence TTS remained present. The ASR implementation was subsequently deployed at the user’s request; see the production release record below.

The optimized production build also passed the complete browser inference flow (7.6 seconds for the whole test). Verification logs, model bytes, audio fixtures, and screenshots are saved outside the repo under `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-verification`. For a repeat check, start the web build and set `JAPANESE_ASR_MODEL_PATH` to the saved graph plus `JAPANESE_ASR_AUDIO_PATH` to `kakehashi-asr-kyou.wav` in that folder, then run the desktop `review-asr.spec.ts` test. Set `JAPANESE_ASR_REAL_MODEL=1` instead of the model path to verify live Hugging Face downloads.

Local HEAD had a broken import of the absent `lessonVocabularyUnlocks` module. The review session now uses the existing `getLessonUnlocks` helper and maps its results to counts so the local web build can complete. The ASR production release started from the verified deployed source snapshot and overlaid the ASR changes, preserving production fixes and excluding unrelated undeployed workspace changes (including this local lesson-unlock repair).

## Production ASR release

On 2026-10-20, deployment `dpl_JB81vuxonGUhFjHFtHUzLfA1bAVp` (`https://kakehashi-eehimztoq-portego-00s-projects.vercel.app`) was promoted to `https://kakehashiapp.com`. All 1,218 uploaded source hashes matched the prepared snapshot. Build, typecheck, and 444 focused unit tests passed. Seventeen hosted browser checks passed, including live Hugging Face model download and actual browser recognition; sixteen live desktop/mobile checks passed after promotion. The setting is visible only to authenticated Portego and is hidden for other users and demo accounts. The source snapshot and deployment records are at `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-portego-prod`. The rollback deployment is `dpl_Hnz1AvifQmRr6HrpzaTV6dqzybk1`.

### Review UI follow-up (October 20)

Speech recognition is a standard collapsed section under Reviews, restricted to
real authenticated Portego accounts. Its record control is visible for both
reading and meaning questions, including Multiple Choice and Anki preferences;
starting a recording opens an editable answer for that question. The shared
control now covers WaniKani and custom SRS lesson/review quizzes, both sides of
mixed review sessions, Bunpro reviews/lessons/practice, and extra-study quizzes.
English meanings have a separate optional 96 MB model, described in
`browser-english-asr.md`. Existing Japanese model cache names, pinned URLs and
64 MiB part keys are preserved, so already downloaded Japanese assets remain usable.
