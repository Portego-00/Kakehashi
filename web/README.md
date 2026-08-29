# Kakehashi Web

Kakehashi Web is the browser companion to the existing mobile app. It keeps the mobile app's WaniKani-centered character while adapting navigation, study sessions, progress views, readers, and settings for desktop and mobile browsers.

## Run locally

Requirements: Node.js 20.9 or newer and a WaniKani personal access token.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`, enter the token on the sign-in screen, and Kakehashi stores it in an encrypted, HttpOnly, same-origin session cookie. It is never placed in browser storage or exposed through a `NEXT_PUBLIC_*` variable.

Set `SESSION_SECRET` in `.env.local` to at least 32 random characters. `WANIKANI_API_TOKEN` is optional and is only for local server-side smoke testing.

MyAnimeList sync reuses `EXPO_PUBLIC_MAL_CLIENT_ID` from the Expo app. Keep that accepted-client value in the EAS environment and start the web app with `npm run dev:expo-env` to inject the production EAS environment without copying it into `web/.env.local`. A non-EAS deployment must expose the same variable to its Next.js server process.

For Songs, add server-only `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `YOUTUBE_API_KEY` values. Spotify supplies catalog results and track metadata, YouTube supplies embeddable playback, and LRCLIB supplies exact or best-matched synced lyrics. None of these credentials are sent to the browser.

The Video workspace can import timed captions for a pasted YouTube URL through youtube-transcript.ai's no-key fair-use endpoint. This works only for public videos with available captions and remains subject to that provider's usage limits; commercial or sustained high-volume deployments should arrange appropriate service terms or replace the adapter.

## Included

- Dashboard, lessons, reviews, assignments, forecasts, and formal WaniKani review submission
- Progress analytics, kanji grids, level wrap-ups, item search, subject details, constellations, lists, and customization
- Fifteen extra study modes: recent lessons, random test, vocabulary reading, hiragana-to-meaning, similar kanji, kana-to-kanji, listening, context cloze, Japanese analysis, kanji writing, crossword, Kana Wordle, custom review, custom lessons, and subject lists
- NHK Easier news with article imagery, text/URL reader, local EPUB/TXT/HTML library, local single-image-page EPUB/CBZ/ZIP/PDF/image manga reader with on-device bubble OCR and JPDB/WaniKani vocabulary analysis, local video with SRT subtitles, Spotify song discovery with embedded YouTube and LRCLIB lyrics, translation, and the shared native/web Kakehashi issue community
- Light, dark, sepia, and midnight themes; configurable subject colors, density, navigation, dashboard cards, and accessibility-conscious motion

Camera capture, Bunpro, and direct Spotify/Apple Music account playback are intentionally excluded from the web app. Manga OCR runs locally in a browser worker; the pinned Baberu model is about 121 MB and is downloaded on first use. Translation can use a configured LibreTranslate-compatible endpoint or the disclosed MyMemory server fallback.

## Quality checks

```sh
npm run test:all
```

This runs linting, strict TypeScript checking, 206 unit and integration tests, a 56-page production generation pass, and 14 Playwright scenarios across desktop and mobile. The 28 browser cases cover authentication, all 15 study routes, the principal content/progress routes, account-scoped storage, live preference changes, focus containment, custom-font migration, community creation, vacation blocking, review-answer concealment, NHK images, accessibility, and mobile overflow. The current matrix passes 26 cases with two intentional project-specific skips.

## Community deployment

Development can use the ignored `web/.data/community.json` store or the native app's Supabase URL and anonymous key. Production supports read-only community access with an anonymous key; posting requires `SUPABASE_SERVICE_ROLE_KEY` and `supabase/migrations/20260807000000_community_atomic_mutations.sql`. See `docs/community-security.md` for the RLS and write-boundary requirements.

## Architecture

- `src/components/ui` contains the shared interface atoms.
- `src/features` groups the study, progress, subject, content, dashboard, and settings workspaces.
- `src/lib/wanikani` is the typed browser client; `src/app/api` is the strict server-side WaniKani gateway and encrypted session boundary.
- `tokens.css` is the central visual system for color, typography, spacing, motion, and stacking.

The WaniKani gateway uses an allowlist, bounded/coalesced server caching, explicit fresh reconciliation reads, pagination support, rate limits, exact revision headers, and no automatic review-mutation retries. An account-scoped review outbox reconciles ambiguous responses before allowing another submission. The development token in `.env.local` is ignored by Git.
