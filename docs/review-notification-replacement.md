# Review notification replacement investigation

Status: local notification fix implemented on 2026-09-14. Native build and physical verification are recorded below.

## Implemented behavior

The app schedules a real visible review notification for the next review time, using the stable `review-available` identifier shared with the Expo fallback. Later slots in the same forecast are silent badge updates. A background refresh rebuilds this schedule, so the next visible notification replaces the previous one instead of adding another card. Changing alert, sound, or badge settings preserves this single-alert rule and migrates older per-slot alert requests.

This works without a notification server. If iOS delays background refresh, the original notification remains and its text keeps the count from its delivery time; scheduled badge updates continue. It does not promise hourly changes to notification text while the app is suspended or terminated. A real review notification still appears when the user disables badges.

The count-only Expo fallback checks for a pending native reminder before posting. An immediate request with the shared identifier would otherwise cancel that future reminder and its badge increment. With no native reminder pending, the fallback can replace the delivered review notification normally.

## Report

[Combine iOS Notifications](https://kakehashiapp.com/community/75239481-139c-46fb-b9e8-7df354be04e9) asks for each new review notification to replace the previous one, including several hours of deliveries while the app is closed.

`ios/ReviewNotificationManager.swift` schedules each exact timestamp or hourly slot using a separate request identifier. Its common `threadIdentifier` groups those notifications but does not replace them. The existing `iosReviewNotificationCoalescing.test.ts` checks source strings for grouping, so it passes despite the reported behavior.

## Fast regression reproduction

On macOS with Swift installed:

```sh
node scripts/run-review-notification-checks.mjs
```

The harness compiles the real hourly and exact scheduling methods and settings planner, substituting a fixed clock and notification-center doubles. The doubles implement Apple's documented request-identifier behavior. Before the fix, three future review slots left two visible notifications after the second slot and three after the third: 27/31 checks passed, exit 1. The fixed implementation keeps one visible alert. Additional checks cover background replanning and settings changes. This macOS/Swift check runs separately from the JavaScript test suite.

The checks also preserve the first due time, every intermediate badge total, and notification settings. Simply assigning the same identifier to every future request would lose the early deliveries and fail these checks.

## Validation of the fix

- Native regression harness: 113/113 checks passed, including replacement after background replanning, alerts with badges disabled, settings toggles, calendar triggers, and migration of old per-slot requests.
- JavaScript notification tests: six suites, 37 tests passed. The new count-only fallback regression failed before its guard was added and passes with the native pending reminder preserved.
- ESLint passed for the changed JavaScript/TypeScript files.
- Full `wanikani` Debug iOS Simulator app build succeeded.
- EAS production iOS [build 82](https://expo.dev/accounts/portego00/projects/kakehashi/builds/7046cbf1-3e42-4acb-8a5b-44b0c3455994) completed successfully for version 1.4.8.
- The settings-planning code also typechecked against the real iPhoneOS SDK, independently of the framework doubles.
- Real iOS API delivery tests passed on the iPhone 17 Pro simulator (iOS 26.3), using the production scheduling methods with mock review data. After scheduling three slots and terminating before the first, one alert remained with 9 reviews while the badge reached 17. Injecting a refresh after the first delivery re-armed the same identifier: the next background delivery replaced the text with 12 reviews, still one alert, then the final silent update advanced the badge to 17. No foreground presentation callbacks occurred.
- The user granted full notification permission for the physical retest. After reinstalling the disposable test app, iOS reported authorization, alerts, and badges enabled, but rejected every local notification with `UNErrorDomain` code `2003`: “Repository could not save notification. Source is not authorized.” The error also reported `UNAuthorizationStatus=Denied`. A plain diagnostic notification without the production category, badge, thread, or metadata failed identically; registering the real notification actions and reinstalling the same signed probe did not resolve the inconsistent device state. The latest-code physical delivery scenarios therefore remain unverified. The earlier physical API probes below completed with provisional permission. The test app and temporary UI-test runner were removed; the installed production app was not modified.

Structured before/after results are in [review-notification-replacement-evidence.json](review-notification-replacement-evidence.json). The simulator tests inject a refresh; they do not demonstrate that iOS will wake the app at a particular time.

## Physical iPhone verification

Tested on the connected iPhone 17 Pro running iOS 27.0, using a separate UIKit app with provisional notification permission. No Kakehashi account or app data was used. Notifications were queried through `getDeliveredNotifications` and `getPendingNotificationRequests`; this validates stored notification entries, not audible alerts or banners under provisional permission.

| Experiment | Observed result |
| --- | --- |
| Two future requests with distinct identifiers and the same thread, followed by process termination before either trigger | Both notifications delivered and remained present; no foreground callbacks |
| Submit a request with the same identifier after the first notification has delivered | One delivered notification remains with the updated content |
| Submit two future requests with the same identifier before either delivers | Only the last request remains pending; the earlier trigger delivers nothing |

The latter two cases ran while the test app was executing in the background. They demonstrate replacement when code can submit a new request, not a guarantee that iOS will wake a suspended app to do so.

## API constraints and implementation choices

[Apple's request initializer documentation](https://developer.apple.com/documentation/usernotifications/unnotificationrequest/init(identifier:content:trigger:)) explicitly distinguishes replacing an already delivered notification from replacing a pending request. There is no separate local-notification identifier for keeping multiple future requests while collapsing their delivered entries. A notification service extension handles qualifying remote pushes, not local notifications, and background refresh is discretionary.

Tsurukame's [current implementation](https://github.com/davidsansome/tsurukame/blob/8e18ddf7f12c44e91cb0ad63bab31af7440648ea/ios/AppDelegate.swift#L189-L269) also pre-schedules separate `badge-<hour>` requests. Reusing relative hourly identifiers on subsequent refreshes can replace earlier delivered entries when those identifiers coincide; it does not guarantee one entry throughout an unattended overnight schedule.

- Server-sent APNs alerts with a stable `apns-collapse-id` could replace notification content independently of app background execution. They would require device registration, forecast synchronization, cancellation, and server scheduling. This fix does not introduce that infrastructure. See [Apple's APNs request documentation](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).
- The implemented local approach schedules one visible reminder under a stable identifier and keeps the remaining forecast as silent badge updates. This prevents overnight stacks but does not guarantee hourly updates to reminder text. Background execution can re-arm the next replacement opportunistically.

Daily reminders and community notifications retain their own identities. Native notification changes require a new iOS app build; an over-the-air JavaScript update cannot deliver this fix.
