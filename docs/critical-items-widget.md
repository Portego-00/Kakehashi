# Critical Items home screen widget

On iOS, select **Critical Items** in **Settings → Home Widget → Widget Content**,
then add the small or medium Kakehashi widget from the home screen widget gallery.
The content setting applies to all Kakehashi home screen widgets. Lock screen
widgets continue to show reviews.

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

The list updates when the app refreshes dashboard review statistics. Background
review-count refreshes preserve the last saved critical list; they do not fetch
new critical-item statistics. Empty lists show an explanatory empty state.

## Verification

Run the widget data, serialized rendering, background sync, and preference tests:

```sh
npx jest --runInBand --watchman=false src/widgets/__tests__ src/utils/__tests__/widgetBackgroundRefreshSettings.test.ts
```

The rendering tests execute the serialized widget layout with Expo's actual
widget JavaScript runtime. They cover both home screen sizes, light/dark/tinted
rendering, empty and legacy snapshots, radicals, long vocabulary, and lock screen
review behavior. Native layout appearance should also be checked on iOS.
