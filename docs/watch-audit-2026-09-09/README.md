# Apple Watch release audit — 9 September 2026

> Follow-up: the Watch UI has since been refined on `codex/watch-ui-refinement`. See the [UI implementation and verified screenshots](/Users/pedroortego/Code/Kakehashi-watch-ui/docs/watch-ui/README.md). The report below records the original scaffold; its integration and packaging blockers still apply.

**Verdict: the Watch app still builds and launches, but the integration is not ready to release.** The core UI exists; the main gaps are reliable review submission, fresh data, development pairing, release versions, and small-screen layout.

The implementation is on `f/apple-watch-app-scaffold`, commit `5fce9eed8f60752490055fabd2978ecaf9a3dd26` (30 May 2026). It has never been merged into current `main` (`d62bc5bb`), which is 46 commits beyond their common ancestor. Testing used an isolated checkout at `/tmp/kakehashi-watch-audit-20260909`. No product code in main was changed.

## What was tested

| Check | Result / limits |
| --- | --- |
| Original Watch Debug target | **Passed** with Xcode 26.3, watchOS 26.2 simulator SDK, arm64. |
| Original Watch installation and launch | **Passed**, Apple Watch Series 11 42 mm simulator on watchOS 26.2. No account data was supplied; first launch rendered the connecting/empty dashboard. |
| Original Watch Release target | **Passed**, watchOS 26.2 SDK, arm64_32, signing disabled. This is compilation and local bundle validation, **not a signed combined archive or App Store validation**. |
| Ordinary Watch scheme including iPhone | **Not validated**. The isolated checkout initially lacked CocoaPods configuration; borrowing installed dependencies exposed a Podfile.lock mismatch. The Watch-only target was then built separately, without bypassing the phone's dependency checks. |
| UI walkthrough | Original views rendered with temporary sample-data hooks in the isolated checkout. Tested dashboard → start → reveal → Got it → next card → reveal → Miss → completion on 42 mm; long content, vacation, error and forecast on a fresh SE 40 mm simulator. Sample submissions were local simulations, with no WaniKani writes. |
| Original state and forecast logic | **7 passed, 7 failed, 2 observations**, identical over three runs. Original commit source with a fake connectivity transport and isolated preferences; this reproduces callback ordering rather than real Bluetooth delivery. [Results](logic-test-results.txt), [reproduction](repro/README.md). |
| Dynamic Type | Attempted simulator control, but watchOS runtime reported it unsupported. Real-device large text and VoiceOver remain to be tested. |
| Merge feasibility | Read-only merge simulation found three textual conflicts, all version/runtime values: `app.json`, `ios/wanikani/Info.plist`, `ios/wanikani/Supporting/Expo.plist`. Swift and target project changes auto-merge; that does not establish runtime compatibility. |

Build evidence: [Debug log](debug-build.log), [Release log](release-build.log). Both Watch builds had only the App Intents metadata warning about no AppIntents dependency; App Intents are not required for this scope.

## Existing functionality

- Review count, next-hour and 24-hour totals, sync age, and eight-hour forecast.
- Vacation display.
- Ten-card, self-graded review sessions with answer reveal, Miss/Got it, progress, completion, and error text.
- Native phone bridge to WaniKani through WatchConnectivity.
- Cached dashboard snapshot, app icon, Watch embedding, automatic signing settings, and a copied privacy manifest covering the local preferences cache.

The Watch has no independent account/network path: session loading and submission go through the phone. No Watch complications/Smart Stack widget, durable offline review queue, or saved in-progress session was found. These are scope choices; complications are not a prerequisite for shipping a companion app.

## Fix before release, in priority order

### 1. Protect review sessions from late replies — high priority, reproduced

Closing a session does not invalidate its pending callbacks. A late load reply reopens a closed session. A late submission reply after closing and starting another session increments the new session, skipping a card that was never submitted. A late error also reopens a closed session. The reply includes an assignment ID, but the Watch does not check it.

Add a session/request identity, correlate submission responses with the pending assignment, and ignore obsolete callbacks. Clear prior error text when retrying and after success; the harness also confirms that a successful retry currently carries the old error into the next card.

Source: [WatchReviewStore.swift, submission callback and state update](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/WatchReviewStore.swift#L478), with close at line 412 and load response at line 447.

### 2. Reconcile Watch reviews with phone progress — high priority, source review

Watch submissions perform a separate native API POST. Success adjusts only the shared review count; it bypasses the phone's assignment caches and pending offline progress queue. Session loading uses server assignments, so a review already completed offline on the phone can appear again on Watch. Interrupted replies also have no durable receipt or reconciliation path: the server can accept a review while the Watch still thinks submission failed.

Use a shared submission/reconciliation path, or explicitly exclude pending phone assignments and refresh affected caches after Watch success. Persist enough submission identity to recover an accepted review after losing its response. Clear Watch snapshot/session state on logout or account change.

Source: [native submitReview](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/ReviewNotificationManager.swift#L243), [existing phone progress queue](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/src/services/offlineStudyProgressService.ts#L427), and [assignment cache updates](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/src/services/studyProgressAssignmentCacheService.ts#L169). Physical/account integration was not exercised.

### 3. Make counts and forecasts authoritative — reproduced

The phone pushes a decremented snapshot before sending its submission response. If that snapshot reaches the Watch first, the Watch subtracts again: the harness reproduced **3 → phone says 2 → Watch shows 1** after one review. Return an authoritative, versioned snapshot and apply it once.

Forecast labels are recalculated from the current hour while counts remain in old array positions. At 12:15, cached 11:00/12:00 counts are relabeled as 13:00/14:00. Expired exact timestamps also fall through to an incorrect future estimate. Derive buckets and due counts from timestamps, accounting for snapshot age.

Refresh currently just returns phone cache, and any parsed snapshot is called “Synced,” including an empty or old snapshot. A cached count of zero blocks session loading even after reviews become due. Fetch/reconcile current data on refresh and distinguish never-synced, current, stale, and disconnected states.

Source: [phone success ordering](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/ReviewNotificationManager.swift#L652), [Watch decrement](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/WatchReviewStore.swift#L491), [forecast](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/ContentView.swift#L467), and [cached refresh response](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/ReviewNotificationManager.swift#L621).

### 4. Support image-only radicals — high priority, source review

When a radical has no text character, its English meaning becomes the front of the card, revealing the answer. Transfer/render its image, or temporarily exclude unsupported radicals from Watch sessions.

Source: [display-character fallback](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/ReviewNotificationManager.swift#L469).

### 5. Align phone/Watch configuration — release requirement

| Configuration | iPhone | Watch | Problem |
| --- | --- | --- | --- |
| Debug identifier | `com.portego00.kakehashi.dev` | `com.portego00.kakehashi.watch`; companion `com.portego00.kakehashi` | Development Watch points at production phone. |
| Historical marketing version | `1.5.0` in iPhone Info.plist | `1.4.4` in generated Watch Info.plist | Versions must be synchronized before combined archive validation. |
| Release identifiers | `com.portego00.kakehashi` | `com.portego00.kakehashi.watch` | Correct relationship. |

Use a development Watch identifier/companion matching the development phone, and a single version source for all targets. Preserve main's intended runtime/version when bringing the branch forward.

Source: [Debug phone settings](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/wanikani.xcodeproj/project.pbxproj#L907), [Debug Watch settings](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/wanikani.xcodeproj/project.pbxproj#L1233), and [iPhone version](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/ios/wanikani/Info.plist#L21). Apple documents [identifier relationships](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleidentifier) and [matching companion versions](https://developer.apple.com/library/archive/documentation/Xcode/Conceptual/RN-Xcode-Archive/Chapters/xc6_release_notes.html).

## UI findings from the running views

The styling is coherent and the normal answer is readable. The main usability issue is vertical space: the persistent header and nested cards put the primary action below the first screen.

- **First launch:** shows “0 reviews / clear / No upcoming reviews” while connecting, before receiving data. Use an explicit setup/loading state.
- **Refresh:** the toolbar refresh control is absent visually and from the runtime interaction targets. `ContentView` declares a toolbar without a navigation container. Put refresh in a supported, visible location.
- **42 mm review flow:** starting a review and reaching grading actions after reveal require scrolling. Keep the main action in view; reduce repeated branding during sessions.
- **40 mm:** “Got it” wraps onto two lines. Long meanings truncate with an ellipsis, and vacation copy renders as “Reviews pau…” and “No reviews while vacation mode…”. Let critical content wrap and adapt control layout to available width.
- **Terminology:** “Ready for Anki mode” is unexplained here. Prefer “Ready to review” or briefly explain self-grading.
- **Grading choice:** for cards with readings, Miss records both meaning and reading wrong; Got it records both correct. There is no partial-correct option or undo. Decide whether this deliberate simplification is acceptable before release; it is not an input-based WaniKani review flow.

UI sources: [toolbar](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/ContentView.swift#L32), [grading buttons](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/ContentView.swift#L334), [answer truncation](https://github.com/Portego-00/Kakehashi/blob/5fce9eed8f60752490055fabd2978ecaf9a3dd26/targets/kakehashi-watch/ContentView.swift#L413).

### Screenshots

Only the first image is an unmodified, unconnected launch. All other screenshots use original views with artificial data and simulated submission responses, and must not be treated as evidence of working phone/API synchronization.

| First launch, 42 mm | Sample dashboard, 42 mm | Sample answer/actions, 42 mm |
| --- | --- | --- |
| ![Original first launch](01-original-first-launch.png) | ![Sample dashboard](02-sample-dashboard-42mm.png) | ![Sample answer actions](05-sample-answer-actions-42mm.png) |

| Long answer, 40 mm | Vacation, 40 mm | Completion, 42 mm |
| --- | --- | --- |
| ![Truncated sample long answer](08-sample-long-answer-40mm.png) | ![Truncated vacation copy](10-sample-vacation-40mm.png) | ![Sample completion](06-sample-complete-42mm.png) |

Additional captures in this directory show question/reveal, submit error, and forecast states.

## Release exit criteria

1. Bring the branch forward; resolve version/runtime conflicts and repair Debug companion identifiers.
2. Fix callback ownership, duplicate count updates, stale forecasts, image radicals, and phone progress reconciliation. Convert the reproduced failures into maintained regression tests.
3. Fix onboarding, visible refresh, small-screen truncation, and access to grading actions. Validate large text and VoiceOver on hardware.
4. Build and validate a signed combined iPhone/Watch archive, then install through TestFlight on a real pair. Test first sync, phone background/termination, disconnect during submission, retry after server acceptance, offline phone reviews, hour rollover, vacation, logout, account switching, and relaunch. Test watchOS 10 if retaining that minimum; only 26.2 was run here.
5. Prepare Watch screenshots, description, and review access/instructions in the existing App Store Connect record. Existing store metadata and provisioning state were not inspected. [Apple Watch metadata requirements](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-watchos-app-information).

Xcode 26.3 and watchOS SDK 26.2 satisfy Apple's currently published minimum toolchain requirement, in effect since 28 April 2026. This does not itself require increasing the minimum supported watchOS version. [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/).

Watch embedding, icon and privacy resource already exist. An explicit extra Watch item in `app.json` is not inherently missing: the apple-targets plugin manages its EAS extension configuration. Be careful with a clean Expo regeneration because the native phone bridge and its AppDelegate activation are manually maintained; existing native directories normally cause EAS to skip Prebuild. [Expo native generation behavior](https://docs.expo.dev/workflow/continuous-native-generation/).

**Recommended release order:** make review submission/recovery safe, then finish layout and store packaging. Complications and independent/offline Watch study can follow as separate features.
