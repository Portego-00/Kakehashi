# Browser-local Japanese TTS model decision

_Updated 2026-08-26. Sources are the model owners' model cards, source
repositories, licenses, and first-party artifact metadata._

## Decision

Use **Supertonic 3 with the F3 preset** for Kakehashi's downloadable Japanese
voice.

This is not the smallest option. It is the best fit among the plausible free,
browser-local candidates because it has all of the following in one first-party
release:

- explicit Japanese support;
- a published 4.61% Japanese character error rate on a 100-sentence benchmark;
- an official browser implementation using ONNX Runtime Web;
- WebGPU execution with WebAssembly fallback;
- fixed voice-style assets that do not require a separate Japanese
  grapheme-to-phoneme project; and
- an explicit claim of improved repeat/skip stability on short as well as long
  utterances, which is directly relevant to vocabulary context sentences.

Supertone's model card also publishes Japanese character and audiobook samples.
These are useful evidence that Japanese is a real release target. Supertone's
official MiniMax-MLS-test table reports **4.61% Japanese CER** (lower is better),
versus 3.35% for VoxCPM2, 3.67% for Qwen3-TTS, and 3.81% for OmniVoice. This is
meaningful reading-accuracy evidence, but not an independent Japanese MOS or
pitch-accent benchmark and does not guarantee that every short sentence will
sound natural ([official benchmark table](https://github.com/supertone-inc/supertonic#reading-accuracy),
[model card and Japanese samples](https://huggingface.co/Supertone/supertonic-3)).

F3 is the clearer preset for this use case: Supertone describes it as articulate
and announcer-style, whereas F1 is calm, slightly low, and steady. There is no
Japanese preset comparison, so this is a product-fit choice rather than a
Japanese-specific quality result
([official preset voice guide](https://supertone-inc.github.io/supertonic-py/voices/)).

## Exact download

Kakehashi pins revision
`3cadd1ee6394adea1bd021217a0e650ede09a323` and downloads only the four ONNX
graphs, two runtime configuration files, the F3 style, and the model license.
The exact total is **398,667,003 bytes: 398.667 MB decimal or 380.198 MiB**.

| Asset | Bytes |
| --- | ---: |
| `LICENSE` | 15,007 |
| `onnx/duration_predictor.onnx` | 3,700,147 |
| `onnx/text_encoder.onnx` | 36,416,150 |
| `onnx/vector_estimator.onnx` | 256,534,781 |
| `onnx/vocoder.onnx` | 101,424,195 |
| `onnx/tts.json` | 8,253 |
| `onnx/unicode_indexer.json` | 277,676 |
| `voice_styles/F3.json` | 290,794 |
| **Total** | **398,667,003** |

The figures above are the sum of Hugging Face's `size` metadata at the pinned
revision: [ONNX assets](https://huggingface.co/api/models/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323/onnx?recursive=true&expand=false),
[F3 style](https://huggingface.co/api/models/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323/voice_styles?recursive=true&expand=false),
and [root license](https://huggingface.co/api/models/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323?recursive=false&expand=false).
The UI should therefore describe this honestly as **about 400 MB**, not merely
the rounded parameter count or the size of one graph.

## Browser runtime and storage implications

Supertone's official web example runs synthesis entirely in the browser with
ONNX Runtime Web, prefers WebGPU, and automatically falls back to WebAssembly.
It documents modern Chrome, Edge, Firefox, and Safari, while warning that WASM
can be slower and that memory-constrained browsers may fail on larger inputs
([official browser example](https://github.com/supertone-inc/supertonic/blob/main/web/README.md)).
The model card says synthesis makes no cloud call after the assets are present,
and lists Japanese (`ja`) among 31 supported languages
([official model card](https://huggingface.co/Supertone/supertonic-3)).

For Kakehashi, that means the large transfer should remain an explicit user
action, be streamed into site-scoped browser storage, and be reused on later
plays. Clearing the site's browser data will remove it. F3 is a fixed preset,
not a Japanese-specific speaker; changing among the ten supplied styles remains
a possible later tuning step if users prefer another timbre.

## Candidate comparison

| Candidate | Japanese/browser path | Download and runtime | License | Main quality evidence and caveat |
| --- | --- | --- | --- | --- |
| **Supertonic 3 F3 (chosen)** | Japanese is first-party supported. The owner supplies a browser ONNX example with WebGPU/WASM. | **398,667,003 bytes** for Kakehashi's pinned asset set; fully local after download. Official output is 44.1 kHz. | Model: BigScience Open RAIL-M. Example code: MIT. | Official Japanese CER is 4.61%, plus Japanese samples and stated improvements to short/long reading stability. There is no independent Japanese naturalness or pitch-accent result, and the almost-400 MB transfer plus inference memory are the cost. |
| **Kokoro-82M + Japanese browser bridge** | Kokoro has five Japanese voices, but upstream Japanese inference uses `misaki[ja]`. The established `kokoro-js` browser documentation demonstrates English; Japanese in a browser currently needs an additional Open JTalk bridge. | Quantized ONNX is **92.4 MB**, plus roughly **24 MB** for the Japanese dictionary and support assets; that dictionary expands to about **107 MB** in browser memory. | Kokoro weights and the bridge: Apache-2.0. Some individual Kokoro voice sources carry separate attribution, recorded in the upstream voice table. | The upstream table grades the best Japanese voice `jf_alpha` only **C+** and explicitly warns that utterances below 10–20 tokens can be weak. That is a poor match for short vocabulary examples. The current Japanese browser bridge also says it cannot pin the upstream ONNX revision. |
| **Piper Plus CSS10 Japanese (previous path)** | Piper Plus offers a WASM/browser runtime and direct Japanese support. | The FP16 graph is about **38–39 MB**; the complete app path was about **65 MB** after Japanese language assets. It is much lighter and fast on CPU. | Runtime: MIT. Model follows the CSS10 public-domain terms. | The model card labels it `medium`, single-speaker, 22.05 kHz, and trained on 6,841 CSS10 utterances. It is efficient, but it is the voice whose perceived quality prompted this replacement. |

### Kokoro sources

- The [upstream Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M)
  documents the 82M model and Apache-2.0 license.
- The upstream [voice table](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
  lists the five Japanese voices, grades, limited Japanese training duration,
  and the short-utterance warning.
- Hugging Face's [ONNX conversion](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
  documents browser JavaScript usage and the 92.4 MB 8-bit model.
- The upstream [language pipeline](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py)
  uses `misaki[ja]` for Japanese. The separate
  [browser-Japanese bridge](https://github.com/nerosui/kokoro-js-jp) documents
  its Open JTalk dependency, dictionary sizes, browser constraints, and unpinned
  ONNX revision.

### Piper sources

- The [CSS10 Japanese model card](https://huggingface.co/ayousanz/piper-plus-css10-ja-6lang)
  documents its speaker count, training utterances, 22.05 kHz output, rounded
  graph size, quality tier, and dataset license.
- The [Piper Plus repository](https://github.com/ayutaz/piper-plus) documents
  its MIT runtime and browser/WASM demo.

## License consequence

Supertonic is free to download and run, but its model is **OpenRAIL-M rather
than an unrestricted OSI-style software license**. Its terms include use-based
restrictions and require downstream recipients to receive the license and
retain relevant notices. Kakehashi should keep downloading/caching the model's
`LICENSE` alongside the graphs and retain its third-party notice
([pinned model license](https://huggingface.co/Supertone/supertonic-3/blob/3cadd1ee6394adea1bd021217a0e650ede09a323/LICENSE),
[MIT example-code license](https://github.com/supertone-inc/supertonic/blob/main/LICENSE)).

## Quality caveat and follow-up

The selection is a product-fit decision, not proof that Supertonic wins every
Japanese listening test. Before changing models again, collect an A/B set made
from the app's actual short context sentences, include kanji readings, numbers,
particles, and punctuation, and have Japanese listeners rate pronunciation and
naturalness blind. Changing among the supplied styles is inexpensive, but it
cannot fix an incorrect underlying reading.

Supertone also announced on 2026-07-23 that its open-source repository will be
archived with no further official model development or support. Kakehashi's
pinned assets remain usable, but future upstream Japanese pronunciation fixes
are unlikely
([official repository notice](https://github.com/supertone-inc/supertonic#%EF%B8%8F-service-and-repository-notice-july-23-2026)).
