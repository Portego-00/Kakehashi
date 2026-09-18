# Review speech

Local Expo module for Apple's iOS 26 `SpeechTranscriber` and `SpeechAnalyzer`. It is used only by voice review answers. Other speech features keep their existing engines.

The JavaScript adapter checks hardware and the requested locale before choosing this engine. iOS versions below 26, unsupported devices/languages, and older binaries without the module use the existing Expo recognizer. SpeechTranscriber captures require microphone permission only. The fallback retains its microphone and speech-recognition permissions and server-capable behavior.

On first use, Apple may download language assets. The review screen shows setup/download progress and allows cancellation before opening the microphone. Installed assets are reused across captures. Japanese and English reservations remain app-scoped; the module does not evict another feature's reservations. If model setup fails, the capture reports an error instead of silently switching to a server recognizer.

Recognition with SpeechTranscriber runs on-device. Audio and transcripts are not written to disk by this module. The Portego panel identifies the selected engine, the on-device processing policy, or the reason for using the older engine. Legacy results still have no reported execution location.

## Lifecycle

- Every native event carries its capture ID. The adapter discards events belonging to an earlier capture.
- The input-node tap converts microphone audio to the format requested by SpeechAnalyzer and yields newly allocated buffers.
- Volatile and finalized *ranges* update a transcript timeline. A range being final does not mean the user has finished the answer. The existing review silence detector calls `stop()` to close audio, drain analysis, and deliver one final answer before `end`.
- `abort()` cancels model setup/analysis, closes audio, and ends without a final answer. Backgrounding, navigation and question changes already use this path.
- Finalization has a ten-second watchdog so a stalled analyzer does not permanently hold the microphone state.
- Task hints and contextual strings from the older recognizer are not claimed as applied to SpeechTranscriber. Its documented native configuration enables volatile results and alternatives; it does not opt into the less-accurate `fastResults` mode.

## Building and verification

This requires Xcode 26 or newer and a new native iOS build; an OTA update alone cannot add the module. Expo autolinking discovers `expo-module.config.json`, and the iOS deployment minimum remains unchanged. The engine is availability-gated at runtime.

The bridge/session was compiled against the iOS 26.2 SDK with an iOS 15.5 deployment target, and the complete iOS Simulator app build passed. Routing and screen integration have Jest coverage. Native timeline checks can run without microphone or model downloads:

```sh
xcrun swiftc modules/review-speech/ios/ReviewSpeechTranscript.swift modules/review-speech/tests/main.swift -o /tmp/kakehashi-review-speech-tests
/tmp/kakehashi-review-speech-tests
```

Physical-device checks remain necessary: initial model download and cancellation, offline reuse, interruption by a call, alternating Japanese/English questions, and single `つ`, `よ`, `しき`, incorrect answers and actual repeated-kana words. A successful build or mocked event test does not establish acoustic accuracy.

Sources: [Apple integration overview](https://developer.apple.com/videos/play/wwdc2025/277/), [locale support](https://developer.apple.com/documentation/speech/speechtranscriber), [asset reservation semantics](https://developer.apple.com/documentation/speech/assetinventory/reserve(locale:)), [fast-results tradeoff](https://developer.apple.com/documentation/speech/speechtranscriber/reportingoption/fastresults).
