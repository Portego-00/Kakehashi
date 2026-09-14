# Lyrics lookup

Music lyrics come from [LRCLIB](https://lrclib.net/docs), which does not require
an API key. Automatic lookup first tries the song and artist metadata, then a
broader search. Manual search lists records with synchronized lyrics; selecting
a result retrieves that record by ID.

All requests go through `LyricsService.fetchJson` and identify Kakehashi using
the app version and homepage. LRCLIB requires client identification. On the
Android 17 emulator, the default HTTP client received HTTP 520 for a search
that returned HTTP 200 when the identifying User-Agent was supplied. Keep the
header on every lookup path, including fallback search and result selection.
Web requests use `Lrclib-Client` instead: LRCLIB's CORS preflight explicitly
allows that header, while User-Agent overrides are not in its allowed list.

`LYRICS_NOT_FOUND` means no matching lyrics were found. HTTP/provider failures,
offline requests and unreadable responses use `LYRICS_UNAVAILABLE`. An exact
lookup failure can still recover through a successful fallback search; an empty
fallback must not disguise that earlier failure as a missing song. The music
screen displays service failures separately, including in manual search.

## Verification

Run the service regressions with:

```sh
npx jest --runInBand src/services/__tests__/lyricsService.test.ts
```

The tests cover client identification on every request path, HTTP 520, offline
requests, real empty results and fallback recovery. For a native smoke test,
load a song without cached lyrics, search manually, and select a result. Check
request status and result counts without logging full lyrics or credentials.
