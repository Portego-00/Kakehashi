# Supertonic 3 Japanese quality audit

_Updated 2026-08-26. This note uses first-party model cards, repositories,
artifact metadata, and demos. It distinguishes vendor measurements from
independent evidence._

## Bottom line

Supertonic 3 is a **credible, usable Japanese TTS model**, not a model that only
lists Japanese nominally. It has a published Japanese reading result, multiple
Japanese audio samples, an explicit Japanese language path, and an official
browser runtime. However, it is **not Japanese-specialist or best in class**:
its own Japanese benchmark result trails the larger comparison models, and the
release contains no Japanese human naturalness score, pitch-accent evaluation,
kanji-reading benchmark, or Japanese training-data breakdown.

For Kakehashi's current requirements—free, entirely browser-local, well below a
gigabyte, and able to run without a companion application—Supertonic 3 remains
the strongest practical choice found. That is a deployment-fit conclusion, not
proof that it is sufficiently accurate for language instruction. A native
Japanese listening test on actual WaniKani sentences is still required before
describing the voice as trustworthy for learning pronunciation.

## Japanese-specific evidence

### Reading accuracy

Supertone reports a **4.61% Japanese character error rate (CER)** on the
MiniMax Multilingual TTS Test Set. The public corpus contains 100 phrases per
language. In Supertone's own comparison table, Japanese results are:

| Model | Japanese CER (lower is better) |
| --- | ---: |
| VoxCPM2 | 3.35% |
| Qwen3-TTS | 3.67% |
| OmniVoice | 3.81% |
| **Supertonic 3** | **4.61%** |

Sources: [Supertone's official benchmark table](https://github.com/supertone-inc/supertonic#reading-accuracy),
[MiniMax's public multilingual test set](https://huggingface.co/datasets/MiniMaxAI/TTS-Multilingual-Test-Set).

This is meaningful evidence of intelligible Japanese across more than a demo
sentence, but it is vendor-reported. Supertone does not publish the Japanese
voice/style used, ASR scorer, inference settings, confidence interval, or a
reproduction script next to the table. CER also measures recognition errors;
it does not establish naturalness or correct Japanese pitch accent.

Kakehashi's pinned revision and the current model repository report identical
Hugging Face object IDs and byte sizes for all four ONNX graphs and both runtime
configuration files, so this is not a benchmark for a different set of model
weights. Compare the [pinned tree](https://huggingface.co/api/models/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323/onnx?recursive=true&expand=false)
with the [current tree](https://huggingface.co/api/models/Supertone/supertonic-3/tree/main/onnx?recursive=true&expand=false).

### Japanese audio samples

Supertone's official showcase publishes ten Japanese-target samples across
game dialogue, customer support, conversation, audiobook, and news domains.
Examples include:

- [Japanese character sample](https://supertonic3.github.io/samples/game/female/game_female_ja_Moka_Curious_ja/supertonic3.wav)
- [Japanese conversational sample](https://supertonic3.github.io/samples/conversation/male/conversation_male_ja_Kazuki_Neutral_ja/supertonic3.wav)
- [Japanese audiobook sample](https://supertonic3.github.io/samples/audiobook/male/audiobook_male_ko_Watson_Neutral_ja/supertonic3.wav)
- [Full official sample comparison](https://supertonic3.github.io/#samples)
- [First-party sample manifest](https://supertonic3.github.io/assets/js/samples.js)

These clips demonstrate that Japanese was exercised across several styles, but
they use reference/custom voice styles in the zero-shot showcase. They are not
evidence that Kakehashi's fixed **F3** preset is the best Japanese voice, and
they are curated rather than a blinded human evaluation.

### Short utterances and text handling

The Supertonic 3 release says it reduced word omissions, repetitions, and
unstable rhythm, including on short utterances. That is relevant to vocabulary
context sentences
([official release article](https://www.supertone.ai/ja/work/faster-and-more-accurate-across-31-languages----introducing-supertonic-3)).

The official browser implementation processes Unicode characters directly and
wraps Japanese text in `<ja>...</ja>`; it does not expose a Japanese dictionary,
furigana, phoneme override, or pitch-accent control. The source even retains a
TODO for a more advanced normalizer
([official `UnicodeProcessor`](https://github.com/supertone-inc/supertonic/blob/main/web/helper.js)).
Consequently, context-dependent kanji readings and pitch accent remain the most
important unmeasured risks for a learning application.

### Evidence gaps

The official release does not provide:

- Japanese MOS or a native-listener naturalness study;
- pitch-accent accuracy;
- a kanji-polyphony or counter-reading benchmark;
- error analysis for short Japanese sentences;
- Japanese training hours, datasets, or speaker provenance; or
- a Japanese-specific ranking of the ten fixed voice styles.

The project also announced on 2026-07-23 that its open-source repository would
be archived with no further official model development or support
([official repository notice](https://github.com/supertone-inc/supertonic#%EF%B8%8F-service-and-repository-notice-july-23-2026)).
Pinned assets remain usable, but Japanese pronunciation problems should not be
expected to receive upstream fixes.

## F1 versus F3

There is no Japanese F1-vs-F3 benchmark. Supertone's first-party voice guide
describes:

- **F1** as calm, slightly low, steady, and suited to customer service, guided
  instructions, and professional narration.
- **F3** as clear, professional, announcer-style, articulate, and suited to
  documentaries, news, and formal presentation.

Source: [official preset voice guide](https://supertone-inc.github.io/supertonic-py/voices/).

**Recommendation:** if Kakehashi must ship one default for vocabulary context
sentences, use **F3**, because articulation and clarity match the task better.
This is a product-fit inference from the owner's style descriptions, **not a
Japanese quality result**. F3 may sound more formal or less conversational, and
changing the style does not replace the shared pronunciation model.

The best product choice is to download F3 and F1 (or all ten styles) and let the
user audition/select them. F3 is 290,794 bytes, so adding it to the existing
398.7 MB package is negligible. All ten style JSON files total 2,915,542 bytes;
adding the other nine to an F1 installation costs about 2.62 MB. Sizes come
from [Supertone's pinned first-party artifact metadata](https://huggingface.co/api/models/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323/voice_styles?recursive=true&expand=false).

## Strongest Japanese-focused alternative: Irodori-TTS v4.1 Small

Irodori-TTS v4.1 Small has materially better **Japanese-specific evidence**:
it is Japanese-only, uses a Japanese ModernBERT text encoder, and reports both
Joyo Kanji Yomi and JSUT BASIC5000 results. The model card reports:

- Joyo benchmark: 7.29% Kana-CER, 5.03% clipped Kana-CER, 2.36% sentence
  Kana-CER, and 4.69% standard CER;
- JSUT BASIC5000: 3.43% sentence Kana-CER and 7.22% standard CER; and
- an explicit limitation that uncommon names, specialist terms, and
  context-dependent readings can still be wrong.

Source: [Irodori-TTS v4.1 Small official model card](https://huggingface.co/Aratako/Irodori-TTS-v4.1-Small).
These scores cannot be compared numerically with Supertonic's 4.61% because the
datasets and evaluation pipelines differ. Irodori also explicitly says it has
no large-scale human MOS evaluation.

Irodori does not fit Kakehashi's current browser/download constraint:

- the standard v4.1 model file is **3,064,295,596 bytes**;
- the smallest INT4 checkpoint is **852,031,658 bytes**, but the release says
  its quantized variants were validated only with NVIDIA CUDA;
- its required Japanese DACVAE codec adds **429,620,065 bytes** and the
  tokenizer adds about **6.72 MB**; therefore even the smallest quantized
  weights plus codec/tokenizer are **1,288,370,886 bytes (about 1.20 GiB)**
  before application/runtime files; and
- the upstream v4.1 project offers Python/PyTorch inference, not an official
  browser runtime.

Sources: [v4.1 files](https://huggingface.co/api/models/Aratako/Irodori-TTS-v4.1-Small/tree/main?recursive=true&expand=false),
[quantized files and runtime restriction](https://huggingface.co/Aratako/Irodori-TTS-v4.1-Small-Quantized),
[codec files](https://huggingface.co/api/models/Aratako/Semantic-DACVAE-Japanese-32dim/tree/main?recursive=true&expand=false),
[official inference repository](https://github.com/Aratako/Irodori-TTS).

A community-authored ONNX/WebGPU port exists for the older Irodori v3. Its own
documentation reports roughly **1.2 GB** for the fp16 model set, Chrome/WebGPU
only, and no WASM fallback. It is useful validation that the architecture can
run in a browser, but it does not turn current v4.1 into a sub-GB, broadly
compatible option
([port documentation](https://github.com/ngc-shj/irodori-tts-webgpu)).

## Other compact candidates

### Kokoro-82M

Kokoro is much smaller, but its owner's voice table grades the best Japanese
voice only **C+**, discloses only `H hours` (1–10 hours) of total Japanese
training, warns that non-English support may be thin, and warns that utterances
below 10–20 tokens are a weak case. That is a poor match for vocabulary examples
([official voice table](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)).
Japanese browser use also needs an additional Open JTalk bridge beyond the
standard ONNX model. It is not a defensible quality upgrade over Supertonic.

### VOICEVOX

VOICEVOX is Japanese-focused, uses Open JTalk and exposes accent-phrase control,
and individual official VVM files are typically about 56–65 MB. However, the
project describes itself as medium-quality, voice-model terms vary, and the
official request for a WebGPU/browser version remains open. Official releases
target native desktop/mobile libraries, not a web-page runtime
([VOICEVOX Core](https://github.com/VOICEVOX/voicevox_core),
[official VVM releases](https://github.com/VOICEVOX/voicevox_vvm/releases),
[open browser/WebGPU request](https://github.com/VOICEVOX/voicevox_core/issues/491)).
It is viable through a native companion app or as a server-side pre-generation
engine, not as a drop-in browser-local replacement today.

### Piper Plus with the Tsukuyomi voice

This is the only other turnkey, compact Japanese browser path found. Piper
Plus's project-owner browser package provides OpenJTalk-derived preprocessing,
Japanese prosody/accent features, WebGPU with WASM fallback, and local caching
([browser documentation](https://github.com/ayutaz/piper-plus/blob/dev/src/wasm/openjtalk-web/README.npm.md)).
The Tsukuyomi FP16 voice graph is **39,652,717 bytes**, while the published
Piper Plus package is about 60 MB unpacked, mostly WASM. It is comfortably under
the size cap
([voice card and sample](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan),
[voice metadata](https://huggingface.co/api/models/ayousanz/piper-plus-tsukuyomi-chan),
[package metadata](https://registry.npmjs.org/piper-plus/0.6.0)).

It is not an evidence-backed quality upgrade. The voice card labels it
`medium`, 22.05 kHz, and says its character fine-tune used only 100 utterances
(about 11 minutes). It publishes one short Japanese sample and speed figures,
but no Japanese MOS, CER, reading benchmark, or Supertonic comparison. It is a
reasonable native-listener A/B challenger, not a blind replacement—especially
after the user already rejected a different Piper Japanese voice.

### Style-Bert-VITS2 and Sarashina2.2-TTS

Both are more Japanese-centered than Supertonic. Style-Bert-VITS2 supports
Japanese-only JP-Extra models. Its maintainer documents about 800 hours of
Japanese pretraining, improvements to pronunciation/accent/intonation, and
manual accent control
([maintainer technical document](https://github.com/litagin02/Style-Bert-VITS2/blob/master/docs/Style-Bert-VITS2_en.md)).
It supports voice-model ONNX export, but its supported stack still depends on
Japanese BERT/OpenJTalk preprocessing in a Python service; it does not provide
a complete first-party browser path
([official repository](https://github.com/litagin02/Style-Bert-VITS2),
[ONNX converter](https://github.com/litagin02/Style-Bert-VITS2/blob/master/convert_onnx.py)).

A realistic asset proxy is **904,760,182 bytes (862.85 MiB)** before the
browser runtime: 251,150,980 bytes for the available JP-Extra JVNV voice
weights and 653,075,699 bytes for the Japanese DeBERTa FP16 ONNX model, plus
tokenizer/config files. A converted JP-Extra voice ONNX would replace the
safetensors voice in a browser package, but no such first-party artifact is
published, so its exact final size and operator compatibility are unknown
([voice files](https://huggingface.co/api/models/litagin/style_bert_vits2_jvnv),
[BERT files](https://huggingface.co/api/models/tsukumijima/deberta-v2-large-japanese-char-wwm-onnx)).
It is the most interesting sub-GB feasibility study, but it is not a usable
browser replacement today and may exceed the cap when the complete port is
measured.

Sarashina2.2-TTS explicitly targets Japanese kanji polyphony, but the released
model is approximately 0.8B parameters, uses a GPU-oriented Python stack, asks
for roughly 6 GB VRAM, has no official browser runtime, and is under a
non-commercial model license
([official repository](https://github.com/sbintuitions/sarashina2.2-tts),
[model license](https://huggingface.co/sbintuitions/sarashina2.2-tts/blob/main/LICENSE)).

## Product recommendation

1. Keep Supertonic 3 as the optional browser-local model for now, but describe
   it as a local voice rather than a Japanese-specialist pronunciation oracle.
2. Use F3 as the default preset for clearer sentence reading, while considering
   F1/F3 previews or a style selector because this is subjective.
3. Before treating the generated audio as learning guidance, run a blind native
   Japanese evaluation on actual context sentences. Include ambiguous kanji,
   names, counters, dates, numbers, particles, loanwords, and very short lines.
4. If that test fails, the practical quality-first architecture is to
   pre-generate/cache the finite sentence corpus with a Japanese specialist
   engine (or use a native companion), rather than requiring every browser to
   download and run a 1.2–3.5 GB Japanese foundation model.
