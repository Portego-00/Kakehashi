# YouGlish Context

YouGlish is an optional Context source restricted to the WaniKani username `Portego`, using the shared case-insensitive account check. The setting defaults to off, and both the setting row and player are gated; a previously saved enabled value cannot expose it to another account. Web demo sessions are excluded.

## Enable and use

- Mobile: **Settings → Vocabulary Context → YouGlish Context**.
- Web: **Settings → Subject details → YouGlish Context**.
- Open vocabulary **Context**, then choose **ImmersionKit** or **YouGlish**. The switcher appears only when YouGlish Context is enabled for Portego.

The switcher replaces only the media-example section. Existing WaniKani sentences, saved examples and usage patterns retain their existing controls. It is available in vocabulary details, review details, vocabulary lessons (tabbed and single-page), kana vocabulary and Bunpro vocabulary Context. If ImmersionKit examples are disabled independently, its source displays an explanation and YouGlish remains selectable.

Selecting YouGlish sends the current spelling to its official Japanese widget API. Changing the word recreates the player with the new query. It does not load provider scripts before selection, autoplay, scrape captions, save videos, or copy YouGlish results into Kakehashi storage.

Source changes stop existing media audio. The YouGlish player unmounts when its Context view becomes inactive, when the setting/access is removed, when navigating away, or when the app/browser is backgrounded. Returning creates a fresh player requiring a play gesture. Empty results and loading failures offer retry and an external word lookup. Remote loading is bounded to 25 seconds.

## Implementation

- `src/features/youglish/player.ts`: shared access rule, encoded lookup URLs, safe document generation and message validation.
- `src/components/MediaContextSource.tsx` and `YouGlishContextPlayer.tsx`: native selector and WebView lifecycle.
- `web/src/features/subjects/components/MediaContextSource.tsx` and `YouGlishContextPlayer.tsx`: web selector and iframe lifecycle.

The web wrapper uses an opaque-origin data URL. The sandbox lets the nested YouGlish/YouTube frames retain their own origins, which their player requires, while keeping vendor wrapper scripts away from the app's document and state. Player messages are accepted only from the mounted wrapper frame, and native messages are schema-checked. Words are JSON-escaped before insertion into the document.

Official reference: [YouGlish JavaScript API](https://youglish.com/api/doc/js-api). Its published policy requires explicit permission for mobile embedding and commercial use; provider permission remains a distribution prerequisite. This change stays behind the Portego opt-in and has not been deployed.

## Validation

All 72 focused native tests and 155 focused web tests pass. They cover account/setting gates, setting persistence, lazy activation, automatic word changes, kana vocabulary, source switching, inactive/background teardown, no results, errors/retries and safe query/message handling. Existing vocabulary, lesson, Bunpro, settings and subject-audio suites are included.

A browser smoke check of the shared production player document confirmed the 家族 query, 14,681 results at inspection, matching Japanese captions, video controls, no autoplay and responsive height. Nested video input could not be exercised reliably through the available browser automation, so playback is not claimed from this smoke check. Native device/WebView playback has not been manually verified; no Apple build or temporary simulator was created.

The web type check and focused web lint pass. Native lint reports no errors and retains existing warnings in the large vocabulary/lesson components. The unrestricted native type check exhausts its default heap while including generated output; a scoped native check reports existing notes/API type errors and no diagnostics in the changed files. The temporary browser check and local server were closed after testing.
