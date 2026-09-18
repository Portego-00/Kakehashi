# Offline Japanese kana recognition options

Researched 2026-09-18. Scope: isolated kana/mora and short kanji readings in Kakehashi, preferably on iPhone without sending audio to a server. This note compares Apple customization and third-party engines.

## Finding

There are credible ways to recognize the *sounds* or output kana directly, avoiding the intermediate guess at kanji or numerals. None of the sources below establishes an accuracy winner for isolated `つ`, `よ`, or `しき` spoken by Kakehashi users on an iPhone. General Japanese transcription benchmarks cannot establish that.

The most useful experiments are a direct hiragana CTC model and a small, explicitly phonetic recognizer. A model whose output vocabulary contains only kana cannot emit the numeral `4`, but it can still omit or misrecognize sounds. That is an architectural advantage for this task, not proof that it will hear `しき` correctly.

## Apple options: the smallest first experiment

Starting in iOS 17, Apple's custom language model API accepts weighted example phrases and explicit pronunciations. Customization executes strictly on-device and must be attached to an on-device request. For Kakehashi, a model built around kana and short readings is a plausible improvement over the existing vocabulary hints, but not a demonstrated fix for `つ` or `しき`. Preparation can be expensive, so prepare/cache a reading-domain model instead of rebuilding it per question. This adapts the language model; it does not retrain the acoustic model or expose phoneme output. [Apple customization walkthrough](https://developer.apple.com/videos/play/wwdc2023/10101/)

Pronunciation symbols are locale-specific. Query the supported X-SAMPA inventory for `ja-JP`, verify the actual Japanese recognizer's on-device capability, and test custom model preparation on a real iPhone; do not assume an English pronunciation example or the Expo bridge's default-locale capability check establishes Japanese support. [Apple phoneme inventory API](https://developer.apple.com/documentation/speech/sfcustomlanguagemodeldata/supportedphonemes(locale:)), [previous bridge investigation](./ios-japanese-short-speech-recognition.md)

iOS 26 also offers `SpeechAnalyzer` with a newer, entirely local `SpeechTranscriber` model. Language assets may need an initial download; hardware availability and supported/installed locales must be checked. Its documented focus includes live conversation and longer recordings, so it is a worthwhile baseline, not a proven isolated-kana improvement. It offers interim results but no documented kana-only transcription option. [Apple SpeechAnalyzer presentation](https://developer.apple.com/videos/play/wwdc2025/277/), [SpeechTranscriber support checks](https://developer.apple.com/documentation/speech/speechtranscriber), [transcription options](https://developer.apple.com/documentation/speech/speechtranscriber/transcriptionoption)

Do not confuse that new model with `DictationTranscriber`: the latter uses the existing on-device dictation models and explicitly supports custom language models and contextual strings. Adopting its new API alone is not a new acoustic model. [Apple DictationTranscriber documentation](https://developer.apple.com/documentation/speech/dictationtranscriber)

Local integration inspection: the installed Expo speech bridge exposes `contextualStrings` and `requiresOnDeviceRecognition`, but no custom language model or SpeechAnalyzer option. Either Apple experiment needs native integration and a new native build. The checked `ios/Podfile.properties.json` declares iOS 15.5, so newer APIs require availability guards rather than an unconditional replacement. No app code was changed for this investigation.

## Why direct sound recognition is worth comparing

A 2025 Sakana AI paper specifically studies Japanese speaking assessment. It explains that general transcription can normalize away spoken errors, and evaluates a streamable model that predicts Japanese mora/phonemic labels with accent markers. Its reported average mora-label error fell from 12.3% to 7.1% on CSJ core evaluation sets. This supports investigating phonetic decoding, but those results concern spontaneous speech datasets, not single-kana exercises or iPhone execution. The paper also finds different behavior on clean read speech, where Whisper performs much better than on CSJ; it does not establish that one architecture always wins. It notes that even CTC can learn implicit language patterns, so CTC is not an error-free guarantee. [Primary paper](https://arxiv.org/html/2509.20655v1)

## Five third-party candidates

### 1. Hiragana ASR: most directly matched output, substantial mobile work

The author's `japanese-wav2vec2-large-hiragana-ctc` model produces hiragana plus an auxiliary phoneme output. It has 315.6 million parameters, 84 kana output tokens and 43 phoneme output tokens; the author describes approximately 630 MB FP16 inference and real-time execution on a MacBook Air M2. The model card declares Apache-2.0. Its reported kana error rates are 7.47% on JSUT and 15.68% on JVS; these are author-reported sentence-dataset results, not isolated-mora scores. Long vowels and small kana are explicitly documented weaknesses. [Author's model card](https://huggingface.co/sakasegawa/japanese-wav2vec2-large-hiragana-ctc)

The public implementation uses Python/PyTorch and supplies inference and microphone scripts. I found no supported iOS package or iPhone measurements in that project. Core ML/ONNX conversion, memory profiling and native audio integration are therefore development work to evaluate, not an existing drop-in feature. The card's claim that its architecture prevents hallucination is too absolute to use as a guarantee: substitutions, insertions and deletions remain possible. [Author's implementation](https://github.com/nyosegawa/hiragana-asr)

**Assessment:** strongest semantic fit for unrestricted short readings; benchmark on recorded answers before attempting mobile conversion. Do not assume the small output vocabulary makes the large acoustic encoder small.

### 2. Julius: best small experiment for explicitly constrained kana recognition

Julius supports isolated-word recognition, rule-based grammar, confidence scores, multiple hypotheses and phoneme alignment. It is a C-based engine under BSD-3-Clause. Its grammar kit separates the displayed output label from the sequence of acoustic-model phonemes: a dictionary entry can return kana directly without choosing kanji spelling. This permits an experimental vocabulary of kana/mora or readings plus competing wrong answers. [Julius engine](https://github.com/julius-speech/julius), [official grammar specification](https://github.com/julius-speech/grammar-kit)

The official kit includes Japanese acoustic models. GitHub's file metadata reports 464,396 bytes for the monophone HMM and 2,955,910 bytes for the PTM HMM, plus 239,157 bytes of logical-triphone mapping. Those are acoustic assets, not a complete app or runtime-memory measurement. The kit is MIT licensed. [Model files](https://github.com/julius-speech/grammar-kit/tree/master/model/phone_m), [kit license](https://github.com/julius-speech/grammar-kit/blob/master/LICENSE.md)

**Assessment:** attractive because output labels and phonetic vocabulary are controllable and assets are tiny. However, these are older acoustic models; the checked official material does not provide a maintained iOS integration or an isolated-kana accuracy benchmark. Native cross-compilation, microphone plumbing and rejection calibration need work. A restricted grammar must retain plausible wrong answers and an unknown/rejection path; a grammar containing only the correct answer could make incorrect speech look correct. Forced alignment alone also cannot prove correctness because it starts from supplied text.

### 3. Vosk Japanese: compact, but vocabulary control has a catch

Vosk's small Japanese model is listed at 48 MB under Apache-2.0. Its published Japanese scores are character error rates on CSJ and TED10k, not isolated-kana benchmarks. Vosk says small models generally take around 300 MB at runtime and most support vocabulary reconfiguration. The runtime-memory estimate is generic, not a measurement of this Japanese model. [Official model catalogue](https://alphacephei.com/vosk/models)

Runtime grammar is not a way to add arbitrary phonetic entries: Vosk's decoder looks up supplied strings in its existing word-symbol table and ignores missing words. Whether every required standalone kana/reading is representable must be checked against the actual Japanese lexicon, or the graph/lexicon must be rebuilt. The official installation page currently makes the iOS build available on request, so it is less immediately accessible than its Android integration. [Decoder source](https://github.com/alphacep/vosk-api/blob/master/src/recognizer.cc#L294-L333), [model adaptation](https://alphacephei.com/vosk/adaptation), [iOS installation](https://alphacephei.com/vosk/install#ios-build)

**Assessment:** useful low-footprint baseline, not an assured kana recognizer. Verify vocabulary coverage before selecting it for a constrained reading exercise.

### 4. ReazonSpeech with sherpa-onnx: practical offline Japanese transcription baseline

ReazonSpeech k2 v2 is a 159.34-million-parameter Japanese character-based transducer, released under Apache-2.0. Sherpa's export offers approximately 148 MB encoder, 2.8 MB decoder and 2.6 MB joiner in int8, roughly 153 MB combined before runtime and other assets. The documented example output contains kanji and kana, so it still needs reading normalization. The documentation distinguishes offline decoding with VAD and simulated streaming from a native streaming model. [Reazon model card](https://huggingface.co/reazon-research/reazonspeech-k2-v2), [sherpa model documentation](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html#sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01-japanese)

Sherpa provides an official Swift/iOS build path targeting iOS 13+, and the engine is Apache-2.0. The example app uses another model by default, so Japanese assets and the matching recognizer configuration must be integrated. No isolated-kana or Japanese iPhone latency result was established here. [Official iOS integration](https://k2-fsa.github.io/sherpa/onnx/ios/build-sherpa-onnx-swift.html), [engine license](https://github.com/k2-fsa/sherpa-onnx/blob/master/LICENSE)

**Assessment:** a reasonable general Japanese offline comparison with clearer native integration, but it does not directly solve the orthography-versus-reading problem.

### 5. WhisperKit / whisper.cpp: mature local execution, weaker task fit

Whisper.cpp has official iOS support, Metal/Core ML acceleration and quantization. Its unquantized table lists tiny at 75 MiB on disk/~273 MB memory, base at 142 MiB/~388 MB, and small at 466 MiB/~852 MB. These are general figures, not Kakehashi measurements. WhisperKit supplies native Swift integration; the current package declares iOS 16 minimum and its README recommends a compressed 626 MB large-v3 variant for multilingual accuracy. Both runtime projects are MIT licensed. [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [WhisperKit repository](https://github.com/argmaxinc/argmax-oss-swift), [Swift package](https://github.com/argmaxinc/argmax-oss-swift/blob/main/Package.swift), [WhisperKit license](https://github.com/argmaxinc/argmax-oss-swift/blob/main/LICENSE)

Whisper is a general transcription model, not a kana or pronunciation grader. Its own model card warns about text not spoken in the input and repetition. No source examined establishes superior isolated Japanese mora accuracy. A smaller download or faster local runtime does not establish that improvement either. [Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md)

**Assessment:** retain as an offline transcription baseline, not the first replacement for this particular bug.

## Recommended experiment order

1. First compare **Apple's custom on-device language model** with the existing recognizer, after verifying Japanese capability. This is the smallest integration experiment given the existing Apple audio path. On compatible devices, add SpeechTranscriber as a separate baseline.
2. Compare **direct hiragana CTC** and **Julius with a kana/reading grammar** on the same recorded short answers before spending time on an iPhone port. This tests whether direct phonetic output actually improves this task.
3. Include correct answers, plausible wrong answers, silence, background noise and isolated versus repeated utterances. Measure false acceptance as well as missed answers, time to first text and final result. Include `つ`, `よ`, `しき`, `し`, actual `つつ`, voiced/unvoiced and long/short contrasts, small kana, and multiple speakers including learners. Run local modes after model installation with network access disabled.
4. Keep the recognition vocabulary independent of the one correct answer, or include broad competing candidates and calibrated rejection. Do not turn answer bias into automatic correctness.
5. If direct kana decoding wins sufficiently, profile conversion and memory on the oldest supported iPhone. If integration cost dominates, compare sherpa/Reazon as the more documented native alternative.

This ordering is an engineering recommendation, not a published comparative result. No models were downloaded or run, and no app implementation was changed in this research.

An additional research-only candidate is [Allosaurus](https://github.com/xinjli/allosaurus), a universal phone recognizer with configurable language inventories. Its Python interface and GPL-3.0 licensing, plus the lack of a verified Japanese iPhone benchmark here, make it less immediately suitable for this app than the five candidates above.
