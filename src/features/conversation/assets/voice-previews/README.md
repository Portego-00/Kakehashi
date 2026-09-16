# Official voice recordings

These audio files are recordings published by OpenAI. They are bundled
for local playback; playing them does not create a model session or call an AI API.

`provenance.json` records the source page, exact public media URL, known model
family, language, file hash, audio format, and duration. Container repairs and
video excerpts include their source hashes and exact transformations.

## GPT-Live samples

Source: [GPT-Live-1 API announcement, September 10, 2026](https://openai.com/index/introducing-gpt-live-1-in-the-api/#new-voice-options).

The announcement's named voice tabs expose the corresponding static WAV files:
quartz, ripple, vesper, willow, stone, gleam, meridian, bossa, tempo, beacon, delta,
and cinder. Bossa and Tempo are Brazilian Portuguese; the other ten are English.
All twelve are 24 kHz mono, 16-bit PCM WAV.

## Realtime voice references

Source: [GPT-Realtime announcement, August 28, 2025](https://openai.com/index/introducing-gpt-realtime/).

Marin and Cedar are the named public voice samples from this earlier Realtime
model, rather than GPT-Live recordings. Their English AAC/M4A files are preserved
as published. The UI must label their model family accurately.

Ballad and Verse come from the [official OpenAIDevs voice announcement video,
October 30, 2024](https://x.com/OpenAIDevs/status/1851668229938159853), linked from
the [OpenAI staff announcement](https://community.openai.com/t/new-realtime-api-voices-and-cache-pricing/998238).
The video explicitly labels each voice. Verse is the 12.3–21.3 second excerpt;
Ballad is the 21.3–41.3 second excerpt. Cuts fall in silence, and the source's AAC
audio was decoded to 48 kHz stereo PCM16 WAV without altering its rate, pitch,
speed, or channels. These English recordings are references from the earlier
GPT-4o Realtime preview model. No new speech was generated.

## Speech documentation references

Source: [OpenAI text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech)
and the public voice-named files in `https://cdn.openai.com/API/docs/audio/`.

Alloy, Ash, Coral, Echo, Sage and Shimmer are English reference recordings from
OpenAI's documentation CDN. The current guide embeds Alloy; the other named WAV
files remain publicly available in the same documentation audio directory. The
producing model and version are not specified, so these samples must be labeled
as speech references rather than current GPT-Live recordings.

Alloy, Echo and Shimmer are preserved unchanged. Ash, Coral and Sage use streaming
WAV headers whose RIFF and data lengths were placeholders. Only those two length
fields were finalized for reliable local playback; all PCM audio bytes remain
unchanged. Exact modified offsets and source/bundled hashes are recorded in
`legacy-sources.json` and the combined `provenance.json`.

## Verification

Retrieved September 16, 2026 from the media sources exposed by the public pages.
No API credentials, generation calls, or microphone access were used. Each file
was fully decoded with FFmpeg, checked for non-silent audio, and hashed with
SHA-256. No Japanese sample has been substituted or generated.

These files are OpenAI-published material; this provenance record does not
relicense them under the application's source-code license.
