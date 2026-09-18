# Third-party notices

These notices cover bundled data, build-time inputs, and runtime components
identified below. They do not change the MIT license of the rest of the
Kakehashi application.

## Conversation learning (Mural)

The conversation feature adapts Mural's interface, language modules, teaching
policies, evidence validation, recall projection, and backup format:

- Source: https://github.com/Chuloo/mural
- Copyright: Hackmamba, 2026
- License: MIT; copy: `licenses/Mural-MIT.txt`

The Mural name and logo remain associated with the original project. Kakehashi
uses its own feature name and adds a Japanese language module.

The conversation interface includes Nunito by Vernon Adams, licensed under the
SIL Open Font License 1.1; copy: `licenses/Nunito-OFL.txt`.

Voice uses react-native-webrtc (MIT; `licenses/ReactNativeWebRTC-MIT.txt`) and
react-native-incall-manager (ISC; `licenses/InCallManager-ISC.txt`). Mandarin
reading support uses pinyin-pro (MIT; `licenses/PinyinPro-MIT.txt`).

The installed @pinyin-pro/data 1.3.1 package declares ISC in package.json, has an
empty author field, and does not ship a LICENSE file. Its upstream repository
publishes an MIT license, copyright 2024 Chinese-Data, retained verbatim in
`licenses/PinyinProData-Upstream-MIT.txt`. Both declarations are recorded rather
than inventing an ISC copyright notice. Verified upstream revision:
`815fe17f80fc7a76aa2b21a842e68229e4b72a4a` at
https://github.com/chinese-data/pinyin-pro-data/blob/815fe17f80fc7a76aa2b21a842e68229e4b72a4a/LICENSE.

Japanese word selection uses tiny-segmenter 0.2.0. The installed package's MIT
license (copyright 2016 绝云) is retained in `licenses/TinySegmenter-MIT.txt`.
Its source header separately retains the original copyright 2008 Taku Kudo and
new BSD declaration; that attribution and BSD 3-Clause terms are retained in
`licenses/TinySegmenter-BSD.txt`. Packaging source:
https://github.com/leungwensen/tiny-segmenter.

These full conversation notices are available offline in Conversation settings
under “Open-source licenses”; their bundled text is in
`src/features/conversation/license-notices.ts`.

## AnkiDroid API

The Android context-sentence export integration uses the AnkiDroid API:

- Project: https://github.com/ankidroid/Anki-Android
- API version: `api-v1.1.0`
- License: GNU Lesser General Public License, version 3 or later
- License copy: `licenses/MAKE_ME_A_HANZI_LGPL.txt`

The API is linked as a replaceable Gradle library and communicates with the
separately installed AnkiDroid application through its public content provider.

## Notebook editor

The web notebook uses the unmodified BlockNote core, React, and Mantine packages
(0.54.0), licensed under Mozilla Public License 2.0:

- Source: https://github.com/TypeCellOS/BlockNote
- License copy: `licenses/BLOCKNOTE_MPL_2_0.txt`

Its Mantine UI dependencies (9.6.0) are MIT licensed, copyright Vitaly Rtishchev:

- Source: https://github.com/mantinedev/mantine
- License copy: `licenses/MANTINE_MIT.txt`

Kakehashi adds its own vocabulary, sentence, and page integrations through the
editor's extension interfaces. No BlockNote XL packages are included.

## Notebook emoji catalog

The notebook emoji picker bundles English emoji names, keywords, shortcodes,
and Unicode characters from emojibase-data 17.0.0:

- Source: https://github.com/milesj/emojibase
- Copyright: Miles Johnson, 2017–2019
- License: MIT; copy: `licenses/EMOJIBASE_MIT.txt`

The underlying Unicode and CLDR data are covered by the Unicode data license:

- Source and license: https://www.unicode.org/license.txt
- License copy: `licenses/UNICODE_DATA_LICENSE.txt`

Kakehashi indexes this data locally and renders native emoji using the device's
fonts.

## Make Me a Hanzi

Most formation records are adapted from `dictionary.txt` in Make Me a Hanzi:

- Project: https://github.com/skishore/makemeahanzi
- Pinned revision: `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`
- Source file: https://github.com/skishore/makemeahanzi/blob/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt
- License: GNU Lesser General Public License, version 3 or later
- License copy: `licenses/MAKE_ME_A_HANZI_LGPL.txt`

Kakehashi selects the WaniKani kanji subset, maps documented Japanese modern
forms to old forms where necessary, converts the source schema into concise
English formation notes, and omits unrelated Mandarin definitions,
pronunciations, and stroke data. The generated records derived from this source
remain under the source's LGPL terms. The pinned upstream `dictionary.txt` and
`scripts/generateKanjiEtymologyData.mjs` provide the corresponding,
replaceable source data and transformation.

## kyujipy

Japanese Shinjitai-to-Kyūjitai mappings used during generation are adapted from
kyujipy:

- Project: https://github.com/cjkvsoft/kyujipy
- Pinned revision: `11b9c6f2a9ec1e303cc6ca52cb0a417735e300c4`
- Source file: `kyujipy/data/kyujitai_simplified.cson`
- Copyright: Emmanuel Ternon, 2017–2025
- License: MIT
- License copy: `licenses/KYUJIPY_MIT.txt`

The mapping data is build-time input only; it is not shown as etymology.

## Chinese Lexicon

Fallback historical notes are adapted from Chinese Lexicon:

- Project: https://github.com/peterolson/chinese-lexicon
- Author: Peter Olson
- Pinned revision: `de64ca4c5d3fef6694a1270f943726c5f622bb03`
- Source directory: https://github.com/peterolson/chinese-lexicon/tree/de64ca4c5d3fef6694a1270f943726c5f622bb03/etymology
- License: ISC
- License copy: `licenses/CHINESE_LEXICON_ISC.txt`

Kakehashi selects only entries not covered with a formation note by Make Me a
Hanzi, normalizes whitespace and obvious typographical errors, and omits image,
pronunciation, and stroke-fragment metadata.

## English Wiktionary

The residual entries and the corrected traditional formation for `気` are
adapted from English Wiktionary:

- Project: https://en.wiktionary.org/
- Authors: the contributors to each linked page revision
- Pinned revisions: `scripts/data/wiktionary-kanji-fallback-revisions.json`
  and the exact `oldid` URL stored on each generated record
- License: Creative Commons Attribution-ShareAlike 4.0 International
- License URL: https://creativecommons.org/licenses/by-sa/4.0/

Kakehashi converts the source's character-formation templates and Ideographic
Description Sequences into short English descriptions. It omits dictionary
senses, pronunciations, examples, and unrelated language sections. Wording is
paraphrased where appropriate, and structural-only entries explicitly state
that modern glyph decomposition does not prove historical origin. Records
derived from Wiktionary remain available under CC BY-SA 4.0.

## WaniKani catalog snapshot

Coverage is based on the public kanji level pages:

- https://www.wanikani.com/kanji?difficulty=pleasant
- https://www.wanikani.com/kanji?difficulty=painful
- https://www.wanikani.com/kanji?difficulty=death
- https://www.wanikani.com/kanji?difficulty=hell
- https://www.wanikani.com/kanji?difficulty=paradise
- https://www.wanikani.com/kanji?difficulty=reality

The snapshot contains only the kanji character and level needed to prove
coverage. It contains no WaniKani mnemonics, readings, meanings, or vocabulary.
Kakehashi is not affiliated with WaniKani or Tofugu LLC.

## Manga import and OCR runtime

The web manga reader uses these permissively licensed runtime components:

- fflate 0.8.3 for capped CBZ/ZIP extraction (MIT): https://github.com/101arrowz/fflate
- PDF.js 4.10.38 for local PDF parsing and page rendering (Apache-2.0): https://github.com/mozilla/pdf.js
- ONNX Runtime Web 1.29.0 for in-browser inference (MIT): https://github.com/microsoft/onnxruntime
- Baberu OCR for manga speech-bubble recognition (Apache-2.0): https://huggingface.co/genshiai-daichi/baberu-ocr

The Baberu ONNX model and vocabulary are fetched on first OCR use from pinned
revision `d9cc13153e9a1cd8fdfa3b7b1cc329da2020aeae`. Manga page pixels stay in the
browser and are not sent to the model host.

## Local Japanese text-to-speech

Normal vocabulary context sentences can use an optional, entirely local voice:

- Supertonic browser inference example (MIT; `licenses/SUPERTONIC_MIT.txt`): https://github.com/supertone-inc/supertonic/tree/main/web
- Supertonic 3 model and F3 voice style (BigScience Open RAIL-M): https://huggingface.co/Supertone/supertonic-3
- ONNX Runtime Web 1.29.0 (MIT): https://github.com/microsoft/onnxruntime

The model, selected voice style, and model license are fetched only after the
user asks for them, directly from pinned revision
`3cadd1ee6394adea1bd021217a0e650ede09a323`, and are stored in the browser's
site data. Text and generated audio stay on the device. The model's Open
RAIL-M license includes use-based restrictions; the pinned license is included
in the browser download and remains available at the model link above.

## OpenAI conversation voice recordings

Conversation's bundled voice previews use recordings published by OpenAI:

- GPT-Live voice samples: https://openai.com/index/introducing-gpt-live-1-in-the-api/#new-voice-options
- Marin and Cedar Realtime voice references: https://openai.com/index/introducing-gpt-realtime/
- Ballad and Verse excerpts from OpenAI's Realtime voice announcement: https://x.com/OpenAIDevs/status/1851668229938159853 (linked by OpenAI staff at https://community.openai.com/t/new-realtime-api-voices-and-cache-pricing/998238)
- Alloy, Ash, Coral, Echo, Sage and Shimmer speech references: https://developers.openai.com/api/docs/guides/text-to-speech and OpenAI's public documentation audio CDN

The original public recordings are included for local playback without an AI
generation request. They remain OpenAI-published material and are not relicensed
under this application's source-code license. Exact media URLs, model families,
languages, excerpt boundaries, container repairs, and SHA-256 hashes are recorded in
`src/features/conversation/assets/voice-previews/provenance.json`.
