# Critical Items home screen widget

On iOS or Android, select **Critical Items** in **Settings → Home Widget → Widget Content**,
then add the small or medium Kakehashi widget from the home screen widget gallery.
The content setting applies to all Kakehashi home screen widgets. Lock screen
widgets continue to show reviews on iOS. On Android, use **Add to Home Screen** in
these settings, or select Kakehashi from the launcher's Widgets picker. Small and
medium entries are available; resizing switches between the two layouts.

- Small shows the lowest-accuracy item, its reading, meaning, and accuracy.
- Medium shows up to three items, ordered by lowest accuracy first.
- The header counts all available critical items, including those beyond the
  three displayed. Start with items below 75% accuracy. If none qualify, try
  below 80%, then 85%, then 90%, stopping at the first threshold with items.
  Items at or above 90% are never included. Hidden subjects are excluded.
- Image-only radicals show “Radical” with their meaning. Items without readings
  omit the reading line.
- Both sizes use the selected widget background preset, including Automatic.
  Text switches between black and white for contrast; gradients that need it
  receive a dark overlay. Tinted widgets use the system's adaptive text color.

Android uses the same snapshot builder, projected timeline, palettes, PNG review
illustrations, and streak milestone icons as iOS. Its native Expo module renders
the layouts into accessible, tappable RemoteViews. Saved data survives process
death; timeline alarms and launcher refreshes apply the newest due entry. Boot,
app updates, clock changes, and widget resizing trigger a refresh. Android may
defer scheduled updates in power-saving modes. Expo's existing background task
also refreshes review data when Background Refresh is enabled.

The list updates when the app refreshes dashboard review statistics. Background
review-count refreshes preserve the last saved critical list; they do not fetch
new critical-item statistics. Empty lists show an explanatory empty state.

## Verification

Run the widget data, serialized rendering, background sync, and preference tests:

```sh
npx jest --runInBand --watchman=false --runTestsByPath src/widgets/__tests__/homeWidget.test.ts src/widgets/__tests__/homeWidget.android.test.ts src/widgets/__tests__/homeWidgetBackgroundSync.test.ts src/widgets/__tests__/criticalWidgetData.test.ts src/utils/__tests__/widgetBackgroundRefreshSettings.test.ts src/utils/__tests__/badgeNotificationsBackgroundTask.test.ts
```

The rendering tests execute the serialized widget layout with Expo's actual
widget JavaScript runtime. They cover both home screen sizes, light/dark/tinted
rendering, empty and legacy snapshots, radicals, long vocabulary, and lock screen
review behavior. Native layout appearance should also be checked on iOS.

With an Android emulator running, execute `node scripts/run-android-widget-checks.mjs`.
It builds and installs both the app and its device tests, verifies actual provider
binding and resizing, checks all three modes with every manual and automatic
palette, review illustration boundaries, accessibility descriptions, empty
states, radicals, long text, persistence, and reset behavior. It writes rendering
evidence under `output/android-widgets`. Tests use synthetic data in the emulator;
they do not need a WaniKani account. Set `ANDROID_SERIAL` to select a specific
emulator when several are running.
