These are the Android regressions for #110 and #132. They run the production
subject route, VocabularyDetails, typed review screen, LessonDetailScreen,
SynonymsModal, cache, MMKV decoder, pager, animations and Expo audio. Only
account/API responses, navigation entry and storage identities are isolated.
No account credentials are needed or changed.

Use an existing Android 16 device/emulator with the current local debug APK
installed, Android SDK 36 and JDK 17. Stop anything using ports 8096/8097, then run:

```sh
node scripts/run-android-subject-detail-checks.mjs --device emulator-5554
```

For #132, run the lesson scenario:

```sh
node scripts/run-android-subject-detail-checks.mjs --device emulator-5554 --scenario lessons --output output/android-lesson-details
```

The lesson scenario runs three vocabulary lesson cycles, checks first-render
responsiveness, adds and saves a synonym before visiting Reading/Context, switches
both tabs and returns to Meaning, and checks the production close button before
and after those tabs have been visited. The isolated API keeps saved study
materials in memory so the check asserts that the actual save result renders.
Each interaction checks the native main thread and rendered JavaScript heartbeat.
Inside the Android synonym modal, where the background heartbeat is hidden from
accessibility, the check requires actual editor state updates and a rendered save
result. Retained JavaScript timing catches stalls across the modal and fails a
lesson opening if an event-loop gap reaches one second. Lesson render, save, tab
and exit timings are written to the native test log.

The runner compiles and caches a small platform Instrumentation APK and starts
Metro with the isolated entry. The default subject scenario checks eight
reopenings and all three tabs against a 9,003-record catalog with Similar
Vocabulary enabled, waits for progression,
checks native audio playback, then enters `きゅうじつ` for `先日` and exercises the
expanded wrong-answer details. It asserts that both the Android main thread and
the rendered JavaScript heartbeat remain responsive. The local WAV is a spoken
pronunciation fixture, keeping network variability out of playback timing.

The old locale conversion fails the heartbeat assertion on Android Hermes in
both subject details and lessons.
Ordinary lowercase conversion preserves English/kana matching and passes the
same native flow. The runner saves screenshots/timings under `output`, stops its
servers, removes its helper APK/port forwarding, and restores the dev-menu button.
It never creates, wipes or deletes a device.
