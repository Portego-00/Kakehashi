# Kakehashi Web

Kakehashi Web is the browser companion to the existing mobile app. It keeps the mobile app's WaniKani-centered character while adapting navigation, study sessions, progress views, readers, and settings for desktop and mobile browsers.

## Run locally

Requirements: Node.js 20.9 or newer. A WaniKani personal access token is needed only to connect your own account; the demo works without one. Run these commands from `web/`:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and choose **Explore the demo** to explore the app immediately. To connect your own account, enter a WaniKani token on the sign-in screen. Kakehashi stores that token in an encrypted, HttpOnly, same-origin session cookie. It is never placed in browser storage or exposed through a `NEXT_PUBLIC_*` variable.

Set `SESSION_SECRET` in `.env.local` to at least 32 random characters before connecting real accounts. The demo does not require that secret. `WANIKANI_API_TOKEN` is optional and is only for local server-side smoke testing. Set the server-only `JPDB_DEMO_API_KEY` to enable demo word analysis and Japanese-to-English translations; see [Demo deployment](#demo-deployment).

MyAnimeList sync reuses `EXPO_PUBLIC_MAL_CLIENT_ID` from the Expo app. Keep that accepted-client value in the EAS environment and start the web app with `npm run dev:expo-env` to inject the production EAS environment without copying it into `web/.env.local`. A non-EAS deployment must expose the same variable to its Next.js server process.

For Songs, add server-only `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `YOUTUBE_API_KEY` values. Spotify supplies catalog results and track metadata, YouTube supplies embeddable playback, and LRCLIB supplies exact or best-matched synced lyrics. None of these credentials are sent to the browser.

The Video workspace can import timed captions for a pasted YouTube URL through youtube-transcript.ai's no-key fair-use endpoint. This works only for public videos with available captions and remains subject to that provider's usage limits; commercial or sustained high-volume deployments should arrange appropriate service terms or replace the adapter.

## Demo

The demo opens a mock level-21 account, `demo-level-21`, with all navigation tabs visible. Bundled WaniKani subject facts and generated assignments, review statistics, and forecasts populate the dashboard and all 17 extra study modes. Lessons, reviews, notes, and synonyms operate on the demo's local state; no WaniKani API token or real review submission is involved. Audio, immersion examples, and other remote learning resources still require their normal network services.

The seeded reading library includes a Frieren manga test excerpt, an original Japanese story, and two Japanese-learning YouTube videos with verified timed caption excerpts. Opening a sample video imports its available full Japanese captions through the normal importer. See [Demo reading samples](docs/demo-media.md) for the source material, attribution, and caption verification details.

Demo content uses separate browser storage keys and a separate IndexedDB database. Study progress, lists, custom vocabulary progress, and settings use the demo identity. Returning to the demo preserves its local progress and edits without overwriting existing real-account imports or restoring samples the visitor deliberately removed. Entering the demo removes any real WaniKani session cookie; connecting a real account removes the demo cookie and clears cached account queries. Account changes are also announced to other open tabs. Demo progress does not transfer to a connected WaniKani account.

## Demo deployment

Configure `JPDB_DEMO_API_KEY` in the Next.js server's environment, including the production hosting environment. The ignored local `.env.local` file is not deployment configuration. Never prefix this variable with `NEXT_PUBLIC_`, put its value in fixtures, or save it in browser settings. The client sends only a public demo marker; the server resolves the credential after checking the demo cookie and rejecting requests that also carry a real WaniKani session cookie. Regular accounts continue to use their own JPDB settings.

The shared demo credential is used only by the fixed JPDB `parse` and `ja2en` endpoints for analysis and translation. It cannot modify the owner's JPDB account or decks. Same-origin checks, bounded request and response bodies, upstream timeouts, and private response headers apply. Without this configuration, the mock account and local study modes remain available, while JPDB requests return a temporary-unavailability message.

Demo upstream usage is limited to 120 calls per client per minute, 300 calls across clients per minute, and 5,000 calls across clients per 24-hour window. Each translated line consumes one call; cached lines supplied by the browser do not. Existing endpoint request limits also apply. Analysis accepts at most 12,000 characters per request, manga translation 4,000, and song/video translation 12,000 in total. These limits are maintained per running server instance and reset on restart; deployments with multiple instances need deployment-wide quotas at the hosting layer or a shared limiter. Shared provider budgets are kept separately from the evictable client-bucket cache.

## Included

- Dashboard, lessons, reviews, assignments, forecasts, and formal WaniKani review submission
- Curated kana and level-banded kanji vocabulary packs outside WaniKani, with FSRS scheduling, familiar SRS stages, and dedicated lesson/review sessions
- Progress analytics, kanji grids, level wrap-ups, item search, subject details, constellations, lists, and customization
- Seventeen extra study modes: recent lessons, random test, vocabulary reading, hiragana-to-meaning, similar kanji, kana-to-kanji, audio vocabulary, listening, context sentences, Japanese analysis, kanji writing, crossword, word search, Kana Wordle, custom review, custom lessons, and subject lists
- NHK Easier news with article imagery, text/URL reader, local EPUB/TXT/HTML library, local single-image-page EPUB/CBZ/ZIP/PDF/image manga reader with on-device bubble OCR and JPDB/WaniKani vocabulary analysis, local video with SRT subtitles, Spotify song discovery with embedded YouTube and LRCLIB lyrics, translation, and the shared native/web Kakehashi issue community
- Light, dark, sepia, and midnight themes; configurable subject colors, density, navigation, dashboard cards, and accessibility-conscious motion

Camera capture, Bunpro, and direct Spotify/Apple Music account playback are intentionally excluded from the web app. Manga OCR runs locally in a browser worker; the pinned Baberu model is about 121 MB and is downloaded on first use. Translation can use a configured LibreTranslate-compatible endpoint or the disclosed MyMemory server fallback.

## Quality checks

```sh
npm run test:all
```

This runs linting, strict TypeScript checking, unit and integration tests, a production build, and Playwright scenarios across desktop and mobile. Coverage includes authentication and demo isolation, study modes, content/progress routes, account-scoped storage, live preference changes, focus containment, custom-font migration, community creation, vacation blocking, review-answer concealment, NHK images, accessibility, and mobile overflow. Demo JPDB tests also verify that credentials stay server-side, real accounts cannot borrow the demo credential, and individual translated lines obey the shared budgets.

## Community deployment

Development can use the ignored `web/.data/community.json` store or the native app's Supabase URL and anonymous key. Production supports read-only community access with an anonymous key; posting requires `SUPABASE_SERVICE_ROLE_KEY` and `supabase/migrations/20260807000000_community_atomic_mutations.sql`. See `docs/community-security.md` for the RLS and write-boundary requirements.

## Custom vocabulary deployment

The reviewed source catalogs plus complete WaniKani vocabulary and kanji-level snapshots live in `../research/data`. Refresh those snapshots with `WANIKANI_API_TOKEN=... npm run refresh:custom-vocabulary-wanikani`; accepted WaniKani meanings are pinned with the forms, readings, and levels so ordinary offline syncs also catch same-lexeme spelling variants and validate component glosses. Run `npm run sync:custom-vocabulary` after an editorial update to verify at least 500 unique words across 30 packs, reject WaniKani overlap, enforce exact five-level kanji bands, and regenerate the web-owned catalog. The same command checks every reading against the pinned official JMdict evidence snapshot, proves that no custom item resolves to the same JMdict entry as any WaniKani form-reading pair, verifies that lexical fields and pack membership have not changed since that audit, validates complete hidden `readingMap` coverage, and rejects pronunciation drills or invalid mnemonic markup in learner-facing stories. Kanji meaning mnemonics must cover every written component with semantic `<kanji>` cues, land on a `<vocabulary>` payoff, and include a separate usage or nuance paragraph. The current authoring and independent-review requirements are documented in `../research/custom-vocabulary-story-mnemonic-standard.md`; the live WaniKani markup and composition research is in `../research/wanikani-mnemonic-markup-and-style.md`.

For release-time checks against the current API, run `WANIKANI_API_TOKEN=... npm run audit:custom-vocabulary-composition` and `WANIKANI_API_TOKEN=... npm run audit:custom-vocabulary-live`. The composition audit verifies every tagged component gloss, its written order, its five-level range, and its accepted meaning payoff against live WaniKani kanji. The catalog audit checks exact, honorific/`する`-variant, and same-reading/same-meaning lexical overlap plus live kanji levels. Both keep the token and WaniKani content in memory and persist neither.

Account-synced custom SRS progress requires a server-only Supabase service key and `supabase/migrations/20260831010000_custom_srs_states.sql`. The migration keeps state private and exposes only a service-role compare-and-set function so concurrent browser tabs cannot silently overwrite one another. When that private backend is not configured, the web app explicitly stores progress in account-scoped browser storage instead.

## Architecture

- `src/components/ui` contains the shared interface atoms.
- `src/features` groups the study, progress, subject, content, dashboard, and settings workspaces.
- `src/lib/wanikani` is the typed browser client; `src/app/api` is the strict server-side WaniKani gateway and encrypted session boundary.
- `tokens.css` is the central visual system for color, typography, spacing, motion, and stacking.

The WaniKani gateway uses an allowlist, bounded/coalesced server caching, explicit fresh reconciliation reads, pagination support, rate limits, exact revision headers, and no automatic review-mutation retries. An account-scoped review outbox reconciles ambiguous responses before allowing another submission. The development token in `.env.local` is ignored by Git.
