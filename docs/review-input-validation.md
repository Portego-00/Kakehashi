# Review input changes and validation

## Changes

`TextToKanaInput` now keeps a synchronous answer snapshot and uses React Native's controlled update path for romaji conversion. It no longer schedules text/selection writes while typing or deletes repeated characters using an 80 ms duplicate heuristic. Native Japanese input and unconverted meaning input retain native composition.

Enter finalizes the text supplied by the native submit event before forwarding it. Button submission reads the synchronous input handle. The review screen distinguishes keyboard, voice, and multiple-choice answers, and no longer stores each keystroke in screen-level React state. Question resets happen before new input is accepted, removing a deferred clear that could erase a new answer.

Android receives a temporary cursor correction with a conversion, through React Native's event-count-checked update. The correction uses the edit's unchanged text and selection, and is released after commit. Keyboard-mode changes preserve the field's current text when switching between controlled and native editing. Spell checking is explicitly disabled to reduce iOS prediction interference.

## Automated validation

Run the mobile application's full suite from the repository root:

```sh
npm test -- --runInBand
```

Result on September 7, 2026: **120 suites passed; 856 tests passed; one live test skipped**. The focused input, cursor, and review-screen suites account for 162 passing tests. Three additional tests exercise the review parent's mistake accounting.

| Area | Coverage |
| --- | --- |
| Input settings | Conversion on/off × Japanese keyboard on/off for iPhone, iPad, Mac, Android, and web branches: 20 combinations |
| Conversion | Trailing `n`, apostrophes, small kana, doubled consonants, repeated vowels/kana, uppercase katakana, spaces and long-vowel marks, Japanese characters, pasted text |
| Event ordering | Native submit ahead of JS changes; same-batch typing and Enter/button submit; explicit empty native text; queued conversions at submit; raw bursts before conversion commits |
| Cursor behavior | Insertion, replacement, deletion, delayed selection events, rejected older conversions, repeated text, later manual cursor movement |
| Review settings | Meaning/reading, automatic Japanese keyboard, skipping, synonyms, paused correct/close/incorrect answers, voice answers, Anki scopes, multiple choice, repeated question occurrences |
| Integration | Real KanaInput connected to ReviewQuestionScreen; complete native romaji and meaning submission; next-question paused answer display |
| Performance | Typing no longer re-renders ReviewQuestionScreen for each character |

The original regression cases were run failing before their fixes. ESLint and diff whitespace checks pass for the changed code. Repository-wide TypeScript checking still reports errors in unrelated files; none are reported in the changed input, review, cursor, test, or game files.

## Native validation

An isolated fixture ran in the installed development build on an iPhone 17 Pro simulator with iOS 26.3. It exercised the real TextToKanaInput without accessing study records.

Passing checks included long romaji followed immediately by Enter, repeated `kana`, trailing `n`, middle insertion/backspace, selected-text replacement, clear/reset, programmatic text, preserving text across keyboard-mode changes, English text/spaces with conversion disabled, and native Japanese Kana input with conversion enabled and disabled. Japanese IME completion can require a first Done to commit marked text and a second Done to submit.

A second native fixture exercised the real ReviewQuestionScreen with local sample questions and a local answer callback. It passed reading → meaning → next subject transitions, paused wrong/correct answers, advancing after feedback, and typing into the freshly cleared next question. Previous-answer animation stayed enabled. No insertion-effect/layout warning or runtime failure appeared during these transitions. Relevant simulator settings were restored afterward. Leaving the fixture produced a Worklets warning about modifying a ref already passed to a worklet, without a runtime failure; that separate teardown warning was not investigated here.

Long typing bursts passed with requested inter-key delays of 30 and 50 ms. These are automation parameters, not precise physical typing rates: the tool adds overhead. The fastest requested 10 ms run was approximately 30 ms per key in captured logs.

### Remaining native limitation

The fastest automated runs still occasionally lose a key inside UIKit before an `onChange` event is emitted. This also reproduced with the original component from HEAD. One aggressive selected-range edit using `n` encountered the same overlap; slower selected-range replacement passed. Native traces showed `onKeyPress` without a corresponding text-change event. Disabling spell checking removed spurious English prediction replacements, but neither ASCII keyboard mode, smart-insertion changes, nor an explicit native `inlinePredictionType.no` probe eliminated the underlying race. The latter probes were reverted.

This change does not claim to eliminate that native editing race. React Native's upstream investigation explicitly identifies remaining risks for inputs that transform content while UIKit is editing. See [the upstream fix and limitations](https://github.com/facebook/react-native/pull/46970), [React Native's text synchronization](https://github.com/facebook/react-native/blob/v0.83.2/packages/react-native/Libraries/Components/TextInput/TextInput.js#L170-L245), and [native submit-event text](https://reactnative.dev/docs/0.83/textinput#onsubmitediting).

Android, iPad, Mac, and web branches were checked with automated component/unit tests; no native Android device/emulator was available. Temporary fixture routes, logging, debugger changes, and the test server were removed after validation.

## Follow-up: red proceed button on a fresh question

The initial synchronous question-reset change exposed a leftover timer in `completeAnswer`. After the next question had reset, that timer set `answered` back to true while its result was null. The fresh question then showed a red chevron, and Enter could advance instead of grading its answer. Earlier validation missed this delayed button state.

The redundant delayed `answered` update is now removed. Grading already sets that state; feedback and haptics are published before advancing. Two regression cases failed before this fix with a red button instead of the neutral color. Coverage now includes four meaning/reading cases, with and without an earlier paused wrong answer, checking the button after pending timers run and ensuring the next native submit is graded. Existing paused-answer tests also assert red, green, and orange button colors for wrong, correct, and close answers.

The real ReviewQuestionScreen passed the reported sequence in the iOS simulator with stop on wrong enabled and stop on correct disabled: wrong answer → Mark Incorrect → correct answer → blank next question. The next button remained neutral after more than five seconds, despite the green previous-answer chip. Typing the next reading and pressing the software keyboard's Done graded it correctly exactly once. With stop on correct enabled, a correct meaning answer remained paused with a green proceed button. No insertion-effect warning or runtime failure occurred during these transitions. The known teardown Worklets warning remained; simulator settings were restored after the checks.

## Follow-up: voice results after Mark Correct

Two failing screen tests reproduced a separate voice timing bug for meaning and reading questions: a wrong recognition result → Mark Correct → another result from the same capture caused the next question to pause as incorrect. Recognition events were accepted whenever the screen was ready for an answer, even if the microphone had never been started for that question. The manual correction itself emitted a correct answer. Without a recording or event trace of the reported incident, its exact connection to this reproduced sequence remains an inference.

Voice captures now belong to one question occurrence and accept one submission. Correction, advancement, keyboard submission, retry, setting changes, and unmount invalidate the old capture. Delayed confirmation and permission/loading work verify that their capture still owns the question before proceeding. The arbitrary 200 ms submission unlock is removed. New captures and retries wait for the previous native `end` event; the earlier `aborted` error cannot restart recognition prematurely. An accepted answer retains its 750 ms confirmation delay when recognition ends normally.

The installed `expo-speech-recognition` 2.1.5 README and iOS source were inspected: `stop()` attempts a final result; `abort()` discards recognition and emits `error` followed by `end`; the methods return before their native tasks finish. Cancellation uses abort for active recognition, and repeated cancellation does not send duplicate native requests. The screen ignores unrequested events from the global speech module.

The screen suite now includes 13 new voice cases covering manual correction for meaning/reading, late results, fresh microphone capture, accepted results followed by end, pause on correct, pause on close, retry, typed correction during voice confirmation, question/setting/unmount cancellation, and late permission completion. Two existing voice tests now start a capture before delivering recognition events. Three parent-level tests separately confirm that correct overrides add no mistakes and that an earlier recorded mistake remains without adding a new one. These parent tests stub the question component and do not simulate microphone timing. ESLint passes for the changed files; repository TypeScript checking still fails on unrelated files, with no errors in the changed review source or tests.

Native voice validation was attempted with an isolated real-screen fixture and controlled events through the installed speech module's actual event listeners. The simulator blocked in UIKit waiting for its pasteboard service while navigating/focusing the input, before any recognition or grading events were injected. Recovery attempts did not allow the screen checks to run. Therefore this follow-up has automated regression coverage but no completed native voice validation or live speech-engine verification. The native checks documented above concern the earlier input/button fixes. Original simulator preferences were restored and independently checked in persisted storage; the fixture and test server were removed, and temporary speech stubs were discarded.
