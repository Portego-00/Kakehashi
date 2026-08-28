# Third-party notices

These notices cover bundled data, build-time inputs, and runtime components
identified below. They do not change the MIT license of the rest of the
Kakehashi application.

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
