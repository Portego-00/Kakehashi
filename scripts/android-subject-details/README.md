This is the Android regression for #110. It runs the production subject route,
VocabularyDetails, typed review screen, cache, MMKV decoder, pager, animations and
Expo audio. Only account/API responses, navigation entry and storage identities
are isolated. No account credentials are needed or changed.

Use an existing Android 16 device/emulator with the current local debug APK
installed, Android SDK 36 and JDK 17. Stop anything using ports 8096/8097, then run:

```sh
node scripts/run-android-subject-detail-checks.mjs --device emulator-5554
```

The runner compiles and caches a small platform Instrumentation APK. It starts
Metro with the isolated entry, checks eight reopenings and all three tabs against
a 9,003-record catalog with Similar Vocabulary enabled, waits for progression,
checks native audio playback, then enters `きゅうじつ` for `先日` and exercises the
expanded wrong-answer details. It asserts that both the Android main thread and
the rendered JavaScript heartbeat remain responsive. The local WAV is a spoken
pronunciation fixture, keeping network variability out of playback timing.

The old locale conversion fails the heartbeat assertion on Android Hermes.
Ordinary lowercase conversion preserves English/kana matching and passes the
same native flow. The runner saves screenshots/timings under `output`, stops its
servers, removes its helper APK/port forwarding, and restores the dev-menu button.
It never creates, wipes or deletes a device.
