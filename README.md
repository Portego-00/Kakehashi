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

## Connecting Spotify

The mobile app includes a personal Spotify setup guide in **Settings → Music
Playback → Spotify connection**. See the [Spotify setup guide](docs/spotify-personal-setup.md)
for Premium requirements, developer app settings, and the Client ID setup.
Song search uses the app’s catalog credentials independently of account linking.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening an issue or pull request.
