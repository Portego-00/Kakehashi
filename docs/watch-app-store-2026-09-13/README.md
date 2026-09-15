# Apple Watch screenshots — September 13, 2026

The six native Apple Watch Ultra 3 (49 mm) PNGs in [ultra-3-49mm](ultra-3-49mm/) are **422 × 514 pixels**, an accepted size in [Apple’s screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications). They are prepared for the Apple Watch screenshot slot in App Store Connect; nothing has been uploaded.

[Download all six screenshots](Kakehashi-Apple-Watch-Ultra-3-screenshots.zip). The PNGs are RGB without an alpha channel. Only the fully opaque alpha channel was removed; decoded RGB pixels and dimensions are unchanged. The [manifest](screenshot-manifest.json) records dimensions, format, and SHA-256 checksums.

These captures use demonstration data in the actual Watch app. No real WaniKani reviews were submitted to create them.

| Screenshot | File |
| --- | --- |
| Home: review card and forecast | [01-home.png](ultra-3-49mm/01-home.png) |
| Forecast by subject | [02-forecast-subject.png](ultra-3-49mm/02-forecast-subject.png) |
| Forecast by SRS stage | [03-forecast-srs.png](ultra-3-49mm/03-forecast-srs.png) |
| Kanji review | [04-kanji-review.png](ultra-3-49mm/04-kanji-review.png) |
| Vocabulary answer | [05-vocabulary-answer.png](ultra-3-49mm/05-vocabulary-answer.png) |
| Radical review | [06-radical-review.png](ultra-3-49mm/06-radical-review.png) |

## Changes

- Richer home review card with subject counts and a compact forecast; detailed forecast switches between subject and SRS breakdowns.
- Pull down from the top to refresh, with a Refresh button and accessibility action available too.
- Answers save atomically on Watch before advancing immediately. Background delivery uses persistent receipts and original answer times to reconcile retries and avoid duplicate grading or double count changes.
- All due assignments continue through transport pages; the ten-review cap is removed. The first page becomes usable while later pages prepare.
- Assignment requests are shared and recently fetched assignments and subject data are cached. In the mocked 85-review fixture, initial preparation of the first 40 cards uses four requests; repeating preparation while warm uses zero. These are request-count checks, not physical-device timing measurements.
- Image-only radicals carry small PNGs rendered from WaniKani SVGs on iPhone, so the Watch does not need another image request. An unavailable image produces a retryable preparation error instead of revealing the answer or skipping the subject.

Minimum deployment target: **watchOS 10**.

## Validation

The final iPhone and Watch Release builds, including the latest UI, pass compilation and signature verification at **version 1.4.8, build 1**. Native 40 mm layouts were also inspected with default and accessibility text sizes; the [QA captures](qa/) are separate from the upload set. This work does not install the builds on physical devices.

The following checks pass from the repository root:

```sh
# 37 JavaScript checks, including the current widget/background synchronization paths
node node_modules/jest/bin/jest.js --runInBand src/utils/__tests__/visibleReviewData.test.ts src/utils/__tests__/reviewNotificationIntegrationFallback.test.ts src/utils/__tests__/iosReviewNotificationCoalescing.test.ts src/utils/__tests__/badgeNotificationsBackgroundTask.test.ts src/widgets/__tests__/homeWidgetBackgroundSync.test.ts

node scripts/run-watch-review-checks.mjs       # 75 Watch store checks
node scripts/run-watch-native-api-checks.mjs   # 58 native API checks
node scripts/run-watch-presentation-checks.mjs # 57 presentation checks
node scripts/run-watch-forecast-checks.mjs     # 21 native forecast checks
node scripts/run-watch-refresh-checks.mjs      # 19 refresh gesture state checks
```

The Swift checks exercise production code with mocked transport. **Live physical-device network latency and real WaniKani review POSTs have not been tested.** Manual touch verification of pull-to-refresh remains pending because the Mac was locked; its 19 checks cover the gesture state logic.

Account identity currently follows the API token. Replacing a token while Watch answers remain unsynced preserves those answers, but the replacement token is treated as a different account and cannot deliver that older queue. Normal reconnection and relaunch retain the saved answers.
