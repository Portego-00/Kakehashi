# Kakehashi

Kakehashi is an unofficial mobile companion app for
[WaniKani](https://www.wanikani.com), the kanji learning platform. It provides a
native iOS and Android experience for reviews, lessons, progress tracking, study
tools, listening practice, song and lyrics helpers, OCR/text utilities, and home
screen widgets.

Kakehashi is free and community-built. It requires a WaniKani account and is not
affiliated with WaniKani or Tofugu LLC.

## Offline study and widgets

When cached assignments are available, review sessions open without waiting for
a network check. Completed reviews are saved on the device before the next
question appears, and queued results sync with WaniKani when a connection is
available. Background refresh keeps the selected review batch stable, replacing
only unstarted reviews that are no longer due. Requests that reach an
unresponsive connection time out instead of holding the app indefinitely.

On iOS, widget refresh uses Expo's processing task. Keep `processing` in
`UIBackgroundModes`, and keep `com.expo.modules.backgroundtask.processing` in
`BGTaskSchedulerPermittedIdentifiers` in both `app.json` and the checked-in
native `Info.plist` when regenerating the iOS project.

## Saved news

Tap the bookmark on a news card or in the article reader, then find it in **Saved
articles** below **Other News**, or turn on **Saved only** in the top filter menu. Easy and Standard stories keep their available article
text separately from the rotating news cache. Bookmarks stay on the current
device or browser and do not sync between the mobile and web apps. Images and
audio still need a connection unless already cached; clearing app or browser
data removes saved articles.

<p>
  <a href="https://apps.apple.com/app/kakehashi-wanikani-companion/id6757765444">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="48" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.portego00.kakehashi">
    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" height="48" />
  </a>
</p>

## Building Kakehashi

If this is your first time working with React Native or Expo, start with Expo's
[Set up your environment](https://docs.expo.dev/get-started/set-up-your-environment/?platform=ios&device=simulated&mode=development-build)
guide. Kakehashi uses native iOS and Android projects, so make sure your
simulator or emulator, Xcode/Android Studio, and local tooling are ready before
continuing.

Install dependencies:

```bash
npm install
```

Install iOS pods:

```bash
cd ios
pod install
cd ..
```

Run the app on a simulator or emulator:

```bash
npm run ios
npm run android
```

Run on a connected device:

```bash
npx expo run:ios --device
npx expo run:android --device
```

Run common checks:

```bash
npm run lint
npm test
```

## Kanji composition in Anki reviews

Enable **Settings → Anki Advanced Settings → Show Kanji Composition** to see a
vocabulary word's component kanji and their primary meanings alongside its
revealed answer in compact cards. Tap a card to open that kanji's details;
returning keeps the review answer revealed. On Android, the settings entry is
**Anki Settings & Export**.
The option is off by default and works with grouped, meaning, and reading Anki
cards. Components appear in word order, using the saved subject catalog for
offline review; unavailable components are omitted.

## Subject list word frequency

When creating or editing a mobile Subject List, open **Browse → Filters → Word
Frequency** and enter a maximum rank. The list editor uses the same frequency
filter as Custom Review, including kana vocabulary. **Select Filtered** adds all
confirmed matches, including those beyond the displayed results. Cached ranks
work offline; remaining words can be checked with Jiten and retried if interrupted.

## Custom Review dates

In **Custom Review → Filters → Date**, choose **Lesson completed** or **Unlocked**,
then pick a **Start** and **End** date. Both options default to the last 7 days.
Dates include both selected days in your local time. Select individual subjects or **Select Filtered**, then use the study
button to review them or **Add to Lists** to save them to Subject Lists. Recent
Lessons keeps its existing shortcut behavior.

## Review character size

Use **Settings → Review Settings → Review Character Size** on mobile, or
**Settings → Reviews → Review character size** on the web, to shrink review
prompts down to 30% in 10% steps. The default is 100%; answer fields and other
app text keep their own sizes. On the web, you can also change **Question text
size** from the review session's settings button, including on a phone with the
keyboard open.

## Multiple choice controls

Turn **Multiple choice** on or off in Settings. Anki questions keep their
selected answer mode.

Choose **I don't know** to reveal the answer and count a mistake. Correct
multiple-choice answers follow **Stop on correct**: with it off, reviews advance
automatically; with it on, use **Mark Wrong** on mobile or **Mark Incorrect** on
the web to correct an accidentally correct selection before continuing.

## Review keyboard shortcuts

In the native app, including on a Mac with a keyboard, press **D** to open
subject details from an Anki review, then press **D** again to return to the
revealed review. If you customize the details shortcut, that key also returns
to the review. The shortcut pauses while editing a note or using another dialog.

On the web, press **D** after revealing an answer to open or close subject
details, including while a details button, tab, or link has keyboard focus.
Closing details returns focus to the review so you can continue grading from
the keyboard. This also works with a custom details key set in **Custom study
keys**. Typing in notes and other editable fields keeps its normal behavior.

## Learning pages

Use **Settings → Appearance → Advanced settings → Learning Pages** to add filtered
versions of Home, such as one page for radicals and kanji and another for vocabulary. Pages
filter by item type, level range, JLPT level, SRS stage and critical items. A
switcher at the top of Home moves between **All** and your pages; each page's
counts, forecast, lessons and reviews include only matching items. Without any
pages, Home is unchanged.

## Connecting Spotify

The mobile app includes a personal Spotify setup guide in **Settings → Music
Playback → Spotify connection**. See the [Spotify setup guide](docs/spotify-personal-setup.md)
for Premium requirements, developer app settings, and the Client ID setup.
Song search uses the app’s catalog credentials independently of account linking.
Music discovery works over Wi-Fi or mobile data. Empty categories show that no
songs were found; failed requests offer **Try again** for that category.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening an issue or pull request.
