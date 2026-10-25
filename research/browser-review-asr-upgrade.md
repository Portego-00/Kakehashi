# Review ASR upgrade: local SenseVoice with continuous speech capture

_Researched and verified 2026-10-21. Primary sources, published package
artifacts, and direct browser execution. No application code was changed
while doing this investigation._

## Recommendation

Replace the two earlier Wav2Vec2 models with **SenseVoiceSmall int8**, using
the single-thread WebAssembly runtime from **`sherpa-onnx@1.13.8`**. Gate
recognition with **Silero VAD**. Keep microphone capture alive across
questions, run periodic recognition over the current speech segment, and
run a final pass after speech ends. This provides the required hands-free
interaction while keeping audio entirely on the device.

This recommendation is based on actual browser execution, including
markedly better transcription of the existing short synthetic fixtures.
It is not a claim that the model perfectly recognizes human accents or
all isolated vocabulary. The model remains an orthographic recognizer:
Japanese output can contain kanji, and ambiguous readings must remain
unresolved rather than inferred from the expected answer.

The upstream released checkpoint supports Japanese, English, Mandarin,
Cantonese and Korean. SenseVoiceSmall is non-autoregressive; a complete
speech segment is its normal inference unit. Repeated recognition of a
growing segment supplies provisional results, rather than a true
incrementally cached acoustic decoder
([official SenseVoice source and released checkpoint scope](https://github.com/QwenAudio/SenseVoice)).

## Exact model assets

Pin model repository
`csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17` at revision
`2365baeacb507f821a0c8120fcee3d484dba7a07`.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `model.int8.onnx` | 239,233,841 | `c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51` |
| `tokens.txt` | 315,894 | `f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc` |
| **ASR total** | **239,549,735** | **239.55 MB decimal** |
| Silero `silero_vad.onnx` | 643,854 | `9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6` |
| **ASR + VAD total** | **240,193,589** | **240.19 MB decimal** |

Sources:
[pinned model](https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/2365baeacb507f821a0c8120fcee3d484dba7a07/model.int8.onnx),
[pinned tokens](https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/2365baeacb507f821a0c8120fcee3d484dba7a07/tokens.txt),
[pinned metadata](https://huggingface.co/api/models/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/tree/2365baeacb507f821a0c8120fcee3d484dba7a07?recursive=true&expand=false),
[Silero distribution by sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx).

The final Hugging Face model response was checked: HTTP 200,
`Content-Length: 239233841`, `Access-Control-Allow-Origin: *` and range
support. It can be fetched directly into an explicit browser model cache.
The GitHub Silero response has no CORS header; serve that small pinned
asset from the application or a fixed asset proxy. Verify hashes and
cache only complete successful downloads.

## Browser runtime verified without cross-origin isolation

`sherpa-onnx@1.13.8` is a WebAssembly package, despite its Node-oriented
entry point. Its published binary includes the required ASR, feature
extraction and VAD APIs. No additional native build was performed.

| Runtime file | Bytes | SHA-256 |
| --- | ---: | --- |
| Original `sherpa-onnx-wasm-nodejs.wasm` | 15,133,706 | `a802c2e20151126789e24792b76cfc3ab9d9bda60bcd5c6a514f06eb35131a1a` |
| `sherpa-onnx-asr.js` | 53,867 | `d51ae8e8b756ee5e53423ffada0c9702973f154f561aca7984fe0b12f4060178` |
| Browser-adapted glue described below | 118,071 | `be3158d3ee0cbe90668bc4770596e02af98a74e4086ef97ad9d6d5f9f8c805f0` |
| `sherpa-onnx-vad.js` | 7,772 | From the same pinned npm release |

The original binary uses no pthreads or SharedArrayBuffer. Its JS glue
needs two small changes because the npm build defaults to Node's real
filesystem. With those changes, the actual model and VAD ran in a normal
Chromium Web Worker with **`crossOriginIsolated === false`** and
**`typeof SharedArrayBuffer === "undefined"`**. COOP/COEP headers are not
needed.

Package sources:
[sherpa-onnx 1.13.8 npm metadata](https://registry.npmjs.org/sherpa-onnx/1.13.8),
[published tarball](https://registry.npmjs.org/sherpa-onnx/-/sherpa-onnx-1.13.8.tgz),
[official ASR wrapper](https://cdn.jsdelivr.net/npm/sherpa-onnx@1.13.8/sherpa-onnx-asr.js),
[official Node SenseVoice example](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/nodejs-examples/test-offline-sense-voice.js).

### Reproducible glue adaptation

Use `path-browserify@1.0.1`, whose POSIX path implementation supplies the
only unconditionally required Node utility. Preserve its copyright and
MIT notice. Prepend the following wrapper, inserting the package's exact
`index.js` as `pathSource`:

```js
const prefix = 'var __pathModule={exports:{}};(function(module,exports,process){\n'
  + pathSource
  + '\n})(__pathModule,__pathModule.exports,{cwd:()=>"/"});\n';

glue = glue.replace(
  'var nodePath=require("path");',
  'var nodePath=__pathModule.exports;',
);

const start = glue.indexOf(
  'if(ENVIRONMENT_IS_NODE){NODEFS.staticInit()}'
  + 'if(!ENVIRONMENT_IS_NODE){throw new Error("NODERAWFS',
);
const end = glue.indexOf('{if(Module["noExitRuntime"])', start);
glue = prefix + glue.slice(0, start) + glue.slice(end);
```

Assert that the expected replacement occurs exactly once and both bounds
exist. The removed block selects Node's filesystem and throws in a
browser. The preceding `FS.staticInit()` remains, so the already compiled
in-memory filesystem is used. The `.wasm` binary is unchanged.

The JS and WASM can be served on demand from pinned package dependencies;
there is no need to commit the binary. Load the glue as a classic worker
script, then call its global `Module` factory with the downloaded
`wasmBinary`. Supply the model and token bytes through `runtime.FS.writeFile`.

**Isolate the ASR and VAD wrappers in separate function scopes.** They both
declare a helper named `freeConfig`; importing both raw scripts into the
same global scope overwrites that helper. For example, wrap the VAD script
and export just `self.SherpaVad = Vad`. The same pattern can export
`OfflineRecognizer` from the ASR wrapper.

## Input, recognition and language switching

The public wrapper consumes **raw mono float32 PCM in `[-1,1]` at 16 kHz**.
Do not reuse the previous Wav2Vec2 zero-mean/unit-variance normalization.
Sherpa performs Kaldi feature extraction, LFR stacking and CMVN internally.

```js
const configFor = (language) => ({
  modelConfig: {
    senseVoice: {
      model: '/model.onnx',
      language, // 'ja' or 'en'
      useInverseTextNormalization: 0,
    },
    tokens: '/tokens.txt',
    numThreads: 1,
  },
});

const recognizer = new OfflineRecognizer(configFor('ja'), runtime);

// On a new question: changes configuration, without reloading the graph.
recognizer.setConfig(configFor(language));
const stream = recognizer.createStream();
try {
  stream.acceptWaveform(16000, pcm);
  recognizer.decode(stream);
  const { text } = recognizer.getResult(stream);
} finally {
  stream.free();
}
```

`setConfig` was verified by switching Japanese and English on the same
loaded browser recognizer. The base C++ implementation assigns its config;
SenseVoice reads the configured language during inference
([configuration implementation](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/sherpa-onnx/csrc/offline-recognizer-impl.cc),
[SenseVoice inference](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/sherpa-onnx/csrc/offline-recognizer-sense-voice-impl.h)).

`stream.setOption('language', ...)` does **not** select the language in
this implementation. `stream.setOption('use_itn', '0')` is supported.
ITN does not provide hiragana output: enabling it added punctuation in
the test clips while preserving kanji.

For reference, the graph itself was also loaded with the application's
existing ONNX Runtime Web 1.29.0. Its tensor contract is:

```text
x          float32 [N,T,560]
x_length   int32   [N]
language   int32   [N]
text_norm  int32   [N]
logits     float32 [N,T,25055]
```

Using the Sherpa wrapper avoids implementing its acoustic preprocessing
and token handling again.

## VAD is necessary before automatic submission

SenseVoice hallucinates on non-speech even when its returned event says
`Speech`. In the actual browser runtime, one second of digital silence
produced `そ` in Japanese and `y` in English. Uniform noise at amplitude
0.01 or 0.1 produced `あ`/`そ` or `y`. A nonempty transcript or the event
tag must never be sufficient evidence that someone spoke.

The following Silero configuration retained every tested speech fixture
and rejected all six silence/noise cases before ASR:

```js
const vad = new SherpaVad({
  sileroVad: {
    model: '/vad.onnx',
    threshold: 0.5,
    minSilenceDuration: 0.4,
    minSpeechDuration: 0.096,
    windowSize: 512,
    maxSpeechDuration: 10,
  },
  sampleRate: 16000,
  numThreads: 1,
  bufferSizeInSeconds: 30,
}, runtime);
```

Feed 512-sample chunks; `isDetected()` indicates ongoing speech. Completed
segments can be consumed through `isEmpty()`, `front()`, and `pop()`.
`reset()` clears question state; `free()` releases the detector. A small
audio pre-roll avoids clipping initial consonants. Use real speech-end
segmentation for final results; provisional recognition should remain
separate from that final event
([official VAD wrapper](https://cdn.jsdelivr.net/npm/sherpa-onnx@1.13.8/sherpa-onnx-vad.js),
[Silero project](https://github.com/snakers4/silero-vad)).

## Actual browser results

These are **synthetic integration fixtures**, generated with installed
Apple voices, not an evaluation of the user's real microphone or accent.
All nine expected written transcriptions were produced by the browser
runtime with explicit language selection and ITN disabled:

| Fixture | Browser text | Inference |
| --- | --- | ---: |
| 学校 | 学校 | 212 ms |
| 今日 | 今日 | 164 ms |
| おばあさん | おばあさん | 218 ms |
| 歯 | は | 135 ms |
| こんにちは | こんにちは | 226 ms |
| river | river | 165 ms |
| forest | forest | 198 ms |
| to eat, Samantha | to eat | 179 ms |
| to read, Daniel | to read | 189 ms |

The same earlier short phrases were misrecognized by the old English
Wav2Vec2 model and by Vosk in this test. Native CPU inference with another
runtime also differed on some clips: Daniel's `to eat` became `state`;
the Japanese `は` clip became `はい`. Do not generalize the nine browser
samples into a population accuracy claim.

`今日` matching its expected written label does **not** establish whether
the model preserved `きょう` versus `こんにち`. A Japanese reading must be
resolved independently from the transcript. Combine whole-word catalog
readings only when unambiguous; never select the current question's
expected reading from several possibilities. Likewise, `川` cannot
distinguish spoken `かわ` from `せん`. Leave ambiguous recognition editable
or request another spoken answer instead of accepting it automatically.

## Alternatives investigated

| Option | Size / runtime | Assessment |
| --- | --- | --- |
| Vosk small Japanese 0.22 + English 0.15 | Official ZIPs 49,704,573 + 41,205,931 bytes; `vosk-browser@0.0.8`, Apache-2.0 | True partial/final streaming and verified without SAB, but weaker on these short phrases. Official ZIPs lack CORS; browser package documents tar.gz. |
| ReazonSpeech k2-v2 Japanese | int8 encoder 154,670,139 + decoder 2,959,337 + joiner 2,696,970 + tokens 45,754 bytes; Apache-2.0 | Japanese-specific, 35k-hour training. This release is offline, not a Japanese streaming Zipformer. Requires separate English model and still emits kanji. |
| Multilingual streaming Zipformer 2025-02-10 | encoder 296,583,597 + decoder 33,837,085 + joiner 8,257,421 + token/BPE files | True streaming supports Japanese/English plus six other languages; larger and not tested here. |
| Whisper tiny / base multilingual | q8 encoder + merged decoder 40,844,231 / 76,894,629 bytes, plus tokenizer/config; MIT | Practical browser ONNX/Transformers.js route, but autoregressive rolling-window recognition requires more repeated work and can emit kanji. Not selected over verified SenseVoice. |
| Moonshine current streaming Japanese/English | Modern streaming models MIT; official browser package | Promising future option, but npm 0.1.5 binary and current source/docs disagree: the shipped binary rejects Japanese streaming dependencies. Default build requires SAB/COOP/COEP. |
| Browser on-device SpeechRecognition | Platform language packs | Must feature-detect `processLocally`, `available({langs:['ja-JP'],processLocally:true})` and installation. Do not silently fall back to a cloud browser service. Japanese pack availability cannot be guaranteed across browsers. |

Sources for the comparison:
[official Vosk models and licensing](https://alphacephei.com/vosk/models),
[Vosk browser published package](https://registry.npmjs.org/vosk-browser/0.0.8),
[ReazonSpeech original model](https://huggingface.co/reazon-research/reazonspeech-k2-v2),
[streaming multilingual Zipformer](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-ar_en_id_ja_ru_th_vi_zh-2025-02-10),
[Whisper tiny assets](https://huggingface.co/onnx-community/whisper-tiny),
[Whisper base assets](https://huggingface.co/onnx-community/whisper-base),
[Whisper upstream license](https://github.com/openai/whisper),
[Moonshine current model catalog](https://moonshine-voice.readthedocs.io/en/latest/models/available-models/),
[Moonshine npm 0.1.5 artifact](https://registry.npmjs.org/@moonshine-ai/moonshine-wasm/0.1.5),
[on-device browser API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally),
[language-pack checks](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static).

### Vosk caching details, if revisited

Its embedded worker was decoded and inspected. It mounts IDBFS at `/vosk`;
the IndexedDB database is `/vosk`, object store `FILE_DATA`. The model
directory uses `modelUrl.replace(/[\W]/g, '_')`, and `extracted.ok` marks a
cached model. A new Blob URL therefore creates another persistent copy.
There is no public model-removal API; terminate all workers before deleting
that database or removing model-prefix records. Browser verification did
not require SAB, but these cache/archive issues make it less convenient
than controlled Cache Storage + ephemeral Sherpa MEMFS.

## Licensing and public notices

Retain these notices with any deployed runtime/model download:

- **sherpa-onnx:** Apache-2.0, copyright Xiaomi Corporation / its listed
  authors; include the full release license and identify the JS glue
  browser adaptation.
- **path-browserify:** MIT, preserve the supplied copyright/license.
- **Silero VAD:** MIT, preserve the original license.
- **SenseVoiceSmall weights:** the release points to the **FunASR Model
  Open Source License Agreement**, rather than the code repository's MIT
  license. That agreement allows use, copying, modification and sharing
  with attribution and retained model names; it also contains additional
  conduct/termination/revision provisions. Identify
  `FunAudioLLM/SenseVoiceSmall` and the `csukuangfj`/sherpa-onnx conversion;
  include the actual model license instead of labeling the weights MIT.

Primary licenses:
[Sherpa release license](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/LICENSE),
[path-browserify license](https://github.com/browserify/path-browserify/blob/v1.0.1/LICENSE),
[Silero license](https://github.com/snakers4/silero-vad/blob/master/LICENSE),
[SenseVoice released model metadata](https://huggingface.co/FunAudioLLM/SenseVoiceSmall),
[FunASR model agreement](https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE).

Full notice copies prepared during verification are named
`sherpa-onnx.LICENSE`, `path-browserify.LICENSE`, `silero-vad.LICENSE` and
`FunASR-MODEL_LICENSE` in the SSD directory below. These can populate the
application's public third-party notices.

## Reusable verification artifacts

All large downloads and runtime experiments were kept on the SSD:

```text
/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-21/Kakehashi/review-asr-verification/
  sensevoice/model.int8.onnx
  sensevoice/tokens.txt
  sensevoice/silero_vad.onnx
  sherpa-npm/package/
  sherpa-onnx-browser-adapted.js
  path-browserify-1.0.1.tgz
  verify-sensevoice-browser.mjs
  verify-sensevoice-noise.mjs
  verify-sensevoice-vad.mjs
  verify-vosk-browser.mjs
```

The browser harnesses use installed Playwright, local static assets and
ordinary HTTP with no isolation headers. They do not upload audio. The
VAD harness covers all nine speech fixtures plus silence and two noise
amplitudes for each language. No Apple build or simulator was used.

## Application integration verification

The final integration uses whole vocabulary pronunciations ahead of the same
character's component-kanji readings. Multiple pronunciations of the same
whole word remain ambiguous. Previously cached kana-only recognition can
verify these ambiguous final segments; its result must fit the independent
catalog possibilities. The current card's accepted answer is never supplied
to the recognizer or reading resolver.

An additional synthetic `かわ` clip was transcribed as `かは` by the integrated
browser pipeline and graded incorrect. This is an observed remaining error,
not an accuracy guarantee. The deployment browser check therefore exercises
both a known successful Japanese clip (`学校` → `がっこう`) and a deliberately
wrong English answer (`river` on a School card). One activation advances
from the correct Japanese reading to English without Check/Next clicks,
then submits the recognized English answer through the normal checker.
Silence before speech does not submit an answer. Separate capture-control
tests cover stable accepted partials, changed prefixes, cancellation,
feedback, manual typing, hidden tabs, and the application's own playback.
