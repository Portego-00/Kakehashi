# Anki sentence export

Anki export is optional and **off by default**. Enable it in settings before any
export buttons appear beside context sentences. Turning it off hides those
buttons immediately and preserves the saved deck and field mapping.

This implements the Android sentence-mining workflow requested in
[issue #58](https://github.com/Portego-00/Kakehashi/issues/58), with desktop web
support through AnkiConnect. Export sends the Japanese sentence and its English
translation; it does not export images or audio.

## Android

1. Install AnkiDroid and create the deck and note type you want to use.
2. In Kakehashi, open **Settings → Review → Anki Settings & Export** and turn on
   **Enable Anki export**. This is independent of the Anki-style review mode.
3. Configure export, grant the AnkiDroid permission, and select the deck, note
   type, Japanese field, English field, and optional tags.
4. Use the Anki button beside a context sentence to add it to that deck. If no
   mapping is saved, the button opens setup first.

Android uses AnkiDroid's local API and requires an app build containing the
native module; an over-the-air JavaScript update alone cannot add it. The
integration is unavailable on iOS and in Expo Go. If the note type's fields
change, Kakehashi asks you to check the mapping before exporting again.

## Web

1. Open desktop Anki on the same computer and install
   [AnkiConnect](https://ankiweb.net/shared/info/2055492159).
2. Open **Settings → Reviews → Anki export** and turn on **Enable Anki export**.
   The preference and saved mapping apply to this browser.
3. Choose **Configure Anki export**, then **Connect to Anki**. Allow Kakehashi in
   the Anki permission window and allow local network access if the browser asks.
4. Choose a deck, note type, two different fields, and optional tags. Save the
   settings, then use the Anki button beside a sentence.

The browser connects directly to AnkiConnect at `http://127.0.0.1:8765`; sentence
exports do not pass through the Kakehashi server. If AnkiConnect is configured
with an API key, enter it when connecting. The key stays in memory for the page
session and is not saved in browser storage.

Anki must remain open while exporting. If a connection ends before Anki confirms
a write, check the deck before retrying. Kakehashi does not automatically retry
note creation. The selected note type must support ordinary sentence and
translation fields; other fields are left empty.

## Android build compatibility

Use JDK 17 and the Android SDK to build the app. The pinned Worklets 0.7.2
dependency publishes its native library through Prefab. The patch-package files
for Reanimated 4.2.1 and Expo Modules Core 55.0.15 use that published target instead
of an obsolete `intermediates/cmake` path. They are applied by the existing
postinstall step during `npm ci`, for both debug and release configurations.

When upgrading these dependencies, check whether upstream already uses the
Prefab target and remove the patches when they are no longer needed.
