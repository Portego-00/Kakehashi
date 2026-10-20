# Browser-local English ASR for spoken review meanings

_Researched 2026-10-20. Uses first-party model cards, pinned artifact metadata/configuration, and actual inference with the installed WebAssembly runtime._

## Decision

Use the quantized `Xenova/wav2vec2-base-960h` CTC graph alongside the
Japanese reading model. It uses the same 16 kHz mono waveform input and
the existing `onnxruntime-web/wasm` dependency. No Whisper, tokenizer
library, acoustic feature extraction library, or external speech service
is necessary.

The conversion card explicitly identifies its source as
`facebook/wav2vec2-base-960h`. The original is an Apache-2.0 English model
trained/fine-tuned on 960 hours of LibriSpeech. The source card reports
3.4% / 8.6% word error rates on LibriSpeech clean / other; those sentence
benchmarks do not establish accuracy for isolated review meanings.
([conversion card](https://huggingface.co/Xenova/wav2vec2-base-960h),
[original model, license, training and evaluation](https://huggingface.co/facebook/wav2vec2-base-960h))

## Pinned optional download

Repository revision: `a19f851b3d42865797e410752b4c570c871e4825`.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `onnx/model_quantized.onnx` | 95,286,046 | `cd5040c147381580ed73258143dd8e0c28e800a09e74ee42ee2b3e8cb4d760a3` |
| `vocab.json` | 358 | `4178db26b3c7570f6a47f14ac6a1c7b32950b8c2800fb097287e53776934f1c5` |
| **Total** | **95,286,404** | **95.29 MB decimal / 90.87 MiB** |

Together with the Japanese graph and vocabulary, the combined download is
**412,740,345 bytes**, approximately **413 MB decimal**.

Direct sources:

- [Quantized graph](https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/a19f851b3d42865797e410752b4c570c871e4825/onnx/model_quantized.onnx)
- [Vocabulary](https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/a19f851b3d42865797e410752b4c570c871e4825/vocab.json)
- [Artifact sizes and hashes](https://huggingface.co/api/models/Xenova/wav2vec2-base-960h/tree/a19f851b3d42865797e410752b4c570c871e4825?recursive=true&expand=false)
- [Preprocessing config](https://huggingface.co/Xenova/wav2vec2-base-960h/raw/a19f851b3d42865797e410752b4c570c871e4825/preprocessor_config.json)
- [Tokenizer config](https://huggingface.co/Xenova/wav2vec2-base-960h/raw/a19f851b3d42865797e410752b4c570c871e4825/tokenizer_config.json)
- [Architecture config, including upstream model identity](https://huggingface.co/Xenova/wav2vec2-base-960h/raw/a19f851b3d42865797e410752b4c570c871e4825/config.json)

Use `model_quantized.onnx` for the verified initial implementation. Other
variants exist, including a roughly 66 MB q4/fp16 file, but their runtime
compatibility and recognition were not checked. The full fp32 graph is
377,887,594 bytes and is unnecessary for this experiment.

## Runtime contract

Actual session metadata from `onnxruntime-web` 1.29.0 confirms:

- Sole input: `input_values`, float32 `[batch_size, sequence_length]`.
- Sole output: `logits`, float32 `[batch_size, output_frames, 32]`.
- The graph has **no attention mask input**. Its preprocessing config
  explicitly sets `return_attention_mask: false`.
- Input is 16,000 Hz mono PCM. Resample microphone audio when needed.
- Normalize each recording using population mean/variance:
  `(sample - mean) / sqrt(variance + 1e-7)`.
- Inference works with the WASM execution provider and one thread.

These contracts match the pinned configs above and the normalization
implementation in the upstream feature extractor
([Transformers feature extractor source](https://github.com/huggingface/transformers/blob/main/src/transformers/models/wav2vec2/feature_extraction_wav2vec2.py)).

## English CTC decoding

This model's vocabulary differs from the Japanese model:

- Blank: `<pad>` = **0**.
- Special tokens `<s>` = **1**, `</s>` = **2**, `<unk>` = **3** are omitted.
- Word boundary `|` = **4** must become a **space**.
- Uppercase letters A–Z are output; lowercase the final answer for the
  application's ordinary case-insensitive meaning workflow.
- The only punctuation character is apostrophe `'` = **27**. Preserve it.
- Numbers are expressed as letter sequences, not numeric tokens.

Select the maximum logit for every frame; collapse adjacent duplicate IDs
with blank resetting repetition; map the remaining IDs; replace `|` with
spaces; trim and collapse repeated whitespace. Do not remove word boundaries
as the Japanese decoder does. For example:

```text
[6,6,8,0,4,5,5,7,6,0] → TO EAT → to eat
[13,13,0,13] → RR → rr
```

The full vocabulary is only 358 bytes and is linked above. Do not share the
Japanese hardcoded blank ID 85 or 86-class dimension with this model.

## Actual WASM verification

The pinned graph was downloaded to the SSD and executed with the installed
`onnxruntime-web` 1.29.0, `executionProviders: ["wasm"]`, one thread, and
full graph optimization. The runtime was executed in Node; application
integration/browser checks remain separate.

Session load took **0.413 seconds**. All tested output tensors contained
finite values.

| Input | Duration | Decoded result | Inference |
| --- | ---: | --- | ---: |
| Zero PCM / silence | 1.000 s | Empty; all 49 frames blank 0 | 0.412 s |
| Synthetic Samantha: river | 0.564 s | `river` | 0.199 s |
| Synthetic Samantha: forest | 0.791 s | `forest` | 0.276 s |
| Synthetic Samantha: to eat | 0.673 s | Empty | 0.238 s |

The two single-word meaning fixtures passed. The very short two-word
fixture produced no text, demonstrating why empty-speech handling and an
editable answer remain necessary. These synthetic integration samples
are not an accuracy benchmark for real microphone input, accents, or
all English meanings.

A follow-up experiment confirms that adding silence is not a reliable
fix. With 200 ms of padding on each side, Samantha's `to eat` became
`to e`. Daniel's `to eat` became `tat` without padding / `fat` with it;
Daniel's `to read` became `the ree` / `three`. Do not claim robust
isolated-phrase accuracy or introduce padding as an established remedy.

Verification files are stored under:

```text
/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-verification/
  english-model.onnx
  english-vocab.json
  english-preprocessor_config.json
  english-config.json
  english-tokenizer_config.json
  english-river.wav
  english-forest.wav
  english-to-eat.wav
```

The model is a disposable local verification download and should not be
committed to Git. The implementation should expose an explicit browser
download with progress/cancellation and removal, then load cached bytes.
Keep speech recognition editable and submit only through the existing
review action. Empty audio, permission errors, and inference failures
must not submit or grade an answer.

## Browser capture follow-up

The initial browser recording of the `forest` fixture produced empty CTC output.
Replaying the exact captured PCM through the same WASM runtime in Node reproduced
it: 0.960 s of captured audio yielded 47 blank frames. The original 0.791 s WAV
still yielded `FOREST`, ruling out the browser's inference backend as the cause.
Removing quiet recording boundaries while retaining 100 ms before and after the
active waveform produced `FOREST` from the captured PCM (0.699 s). The English
worker now applies this trimming before population normalization. Japanese input
is unchanged. This addresses the observed capture regression; it does not establish
accuracy for arbitrary short meanings or phrases. The original recording comparison
is saved in `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-verification/english-capture-debug/comparison.log`. Both Japanese and English browser recording checks passed on the hosted production build.
