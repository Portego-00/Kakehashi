# Reproduce the Watch logic audit

These files preserve a throwaway audit harness for original commit `5fce9eed8f60752490055fabd2978ecaf9a3dd26`; they are not production implementation or a maintained Watch test target.

The original WatchReviewStore is unchanged except that its two UserDefaults references use an isolated test suite. The fake WatchConnectivity module records requests and controls callback ordering. ForecastFunctions extracts the original forecast body and date/age helpers without rewriting their algorithms. Source hashes are recorded in `source-hashes.txt`.

On macOS with Xcode, from this directory:

```sh
xcrun swiftc -swift-version 5 -emit-library -emit-module -module-name WatchConnectivity WatchConnectivity.swift -o libWatchConnectivity.dylib
xcrun swiftc -swift-version 5 -I . -L . -lWatchConnectivity -Xlinker -rpath -Xlinker @executable_path WatchReviewStore.swift ForecastFunctions.swift Harness.swift -o WatchLogicHarness
./WatchLogicHarness
```

Expected result for this historical code: **7 passed, 7 failed, 2 observations**, exit status 1. The failures deliberately assert desirable behavior that the code does not yet implement. Seven failures span callback ownership, retry error state, count ordering, and forecast aging; they are not seven independent subsystem failures.

The original run was repeated three times with byte-identical results. See `../logic-test-results.txt`. This uses macOS Swift 5 language mode, not a Watch test process. It does not test real WatchConnectivity scheduling, network traffic, UI, signing, or distribution. Fake callback ordering demonstrates a possible race, not its real-world frequency.
