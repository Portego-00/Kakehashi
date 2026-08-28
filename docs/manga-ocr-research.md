# Manga import and Japanese OCR research

_Updated 2026-08-26. Sources are project-owned repositories/model cards,
official framework documentation, and first-party platform documentation._

## Implemented browser path

The current change ships guarded `fflate` CBZ/ZIP import, PDF.js page rendering,
loose-image import, drag-to-recognize speech-bubble selection, the pinned Baberu
121 MB ONNX path in a disposable/cache-backed worker, per-page OCR storage, and
the existing `JapaneseReader` JPDB/WaniKani integration. Manual crops are deliberate:
Baberu's documented contract is one complete bubble, while generic full-page OCR
has much weaker manga accuracy and unreliable reading order. PaddleOCR.js remains
the leading candidate for a later page-level detector/suggestion layer; it is not
required for the precision crop workflow shipped here.

## Decision

Use a local, browser-first hybrid rather than one OCR engine for everything:

1. **CBZ/ZIP import:** `fflate`, using its streaming `Unzip` API and a hard
   archive-size cap below 4 GB. Use zip.js instead only if Zip64 volumes become
   an actual requirement.
2. **PDF rendering/text extraction:** `pdfjs-dist` (PDF.js), pinned to a release
   compatible with Kakehashi's Node baseline.
3. **Whole-page detection and fast first pass:**
   `@paddleocr/paddleocr-js`, `lang: "japan"`, `ocrVersion: "PP-OCRv6"`,
   in a Web Worker.
4. **Precise speech-bubble recognition:** the Apache-2.0, 115M-parameter
   **Baberu OCR** smallest ONNX tier, lazy-loaded through `onnxruntime-web` as
   soon as the user completes a crop. Start with a manual crop;
   automatic crops may be formed later by grouping and padding Paddle text
   polygons.
5. Feed accepted/edited OCR text into the existing `JapaneseReader`. It already
   performs JPDB-first parsing and maps tokens to the user's WaniKani subjects
   and assignments, exactly as the Songs tab does.

This distinguishes two different “best” answers:

- **Best turnkey browser page-OCR library:** PaddleOCR.js. It detects text,
  returns polygons/scores, and is directly usable in the current web runtime.
- **Best evidenced local manga-bubble recognizer:** Baberu OCR. Its model card
  reports the lowest lenient CER in its independent, human-labeled Japanese
  comparison, ahead of manga-ocr and the base PaddleOCR-VL. It is a crop
  recognizer, not a page-OCR library, so Kakehashi needs the hybrid.

Do **not** make Tesseract.js the precision path and do **not** deploy
PaddleOCR-VL-For-Manga inside the existing Vercel app. Tesseract is a useful
generic compatibility control but has no primary-source manga accuracy evidence.
The manga Paddle VLM is a 0.9B, 1.92 GB BF16 model intended for Python/GPU-style
serving; it would also upload user crops, changing the app's local-file privacy
model.

## Why it matches this repository

- The web app is Next.js 16/React 19. The manga library stores imported blobs in
  IndexedDB and currently accepts one PDF or naturally sorted image files, but
  it does not open CBZ archives, rasterize PDF pages for OCR, or retain OCR
  regions ([web package](../web/package.json),
  [current manga reader](../web/src/features/content/manga.tsx),
  [content storage](../web/src/features/content/storage.ts)).
- `JapaneseReader` already sends Japanese text to the same-origin JPDB proxy,
  maps parsed tokens against WaniKani subjects/assignments, and renders known,
  learning, and JPDB-only terms. The proxy is already bounded and rate-limited
  ([reader](../web/src/features/content/JapaneseReader.tsx),
  [annotation mapping](../web/src/features/content/annotation.ts),
  [JPDB proxy](../web/src/app/(app)/news/analyze/route.ts)).
- Songs passes the active lyric line to that same component. Manga should pass
  selected or ordered OCR text to it rather than create another vocabulary
  integration ([Songs integration](../web/src/features/content/music.tsx)).
- The default local inference route preserves the existing privacy property:
  manga pixels remain in the browser. Only model assets are downloaded.

## Recommended stack

Registry versions checked on the date above were `fflate@0.8.3`,
`@paddleocr/paddleocr-js@0.4.2`, and `onnxruntime-web@1.29.0`. Kakehashi already
targets `pdfjs-dist@^4.10.38`, whose Node requirement is compatible with the
documented Node 20.9 baseline; current PDF.js 6.x requires a newer Node runtime,
so do not upgrade it incidentally as part of this feature
([fflate package](https://www.npmjs.com/package/fflate),
[PaddleOCR.js package](https://www.npmjs.com/package/@paddleocr/paddleocr-js),
[ONNX Runtime Web package](https://www.npmjs.com/package/onnxruntime-web),
[PDF.js package](https://www.npmjs.com/package/pdfjs-dist)).

### 1. Manga import

Use **fflate** for `.cbz`/`.zip`. It is MIT, browser-native, dependency-free,
about 8 kB minified for its complete build, and exposes streaming ZIP extraction
plus asynchronous worker-backed processing. Its published limit is 4 GB per
file, which is acceptable because Kakehashi should reject manga archives far
below that size. Use the streaming `Unzip` API rather than `unzipSync` or the
all-at-once `unzip` helper so a volume is not duplicated in memory. The stream
metadata exposes compressed and original sizes when the archive supplies them,
which helps enforce decompression-ratio limits
([fflate](https://github.com/101arrowz/fflate)).

**zip.js** is the alternative when genuine Zip64 support or a more feature-rich
archive API is required. It is BSD-3-Clause and also supports streams/workers,
but that extra scope is unnecessary for deliberately capped CBZ imports
([zip.js](https://github.com/gildas-lormeau/zip.js)). Avoid JSZip for this path;
its own documentation notes full-result memory behavior and limited Zip64
support ([JSZip limitations](https://stuk.github.io/jszip/documentation/limitations.html)).

Use **PDF.js** for local PDFs. It is Mozilla's Apache-2.0 web parser/renderer.
Try its text-content extraction before raster OCR; a real PDF text layer is
faster and more accurate than recognizing rendered pixels. Otherwise render
only the current page and a small look-ahead window to canvas/blob
([PDF.js](https://github.com/mozilla/pdf.js)).

Keep the current image-set import. Normalize every source to a logical page
list while retaining original assets in IndexedDB. Initial support should be
PDF, CBZ/ZIP, and image sets; CBR/RAR and 7z can follow only if needed.

Reject encrypted archives, unsafe paths, non-image entries, excessive page
counts, huge image pixel areas, suspicious compression ratios, and excessive
per-entry/total decompressed bytes. Natural-sort sanitized names and ignore
metadata directories such as `__MACOSX`.

### 2. Page detector and baseline: PaddleOCR.js

PaddleOCR.js is PaddleOCR's official browser SDK. It uses ONNX Runtime Web and
OpenCV.js, accepts browser-native image inputs, can run in a dedicated Worker,
and returns `poly`, `text`, and `score` for each detected line
([browser SDK](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/inference_deployment/cross_platform/browser.md),
[package documentation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md)).
PP-OCRv6 small supports Japanese; the tiny tier does not
([language table](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md)).

The official PP-OCRv6 evaluation is not manga-specific. It reports 82.3
detection Hmean and 88.2 recognition accuracy for its Japanese category, while
its artistic-font numbers are lower. That supports using it for location and a
fast first pass, not claiming it as the most precise manga recognizer
([PP-OCRv6 metrics](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.md)).

Run it lazily after **Scan page**. Start with worker-hosted WASM/SIMD and feature
detection for acceleration. Threaded WASM requires cross-origin isolation; do
not add global COOP/COEP headers without checking the app's YouTube and other
cross-origin media embeds. Paddle returns text regions, not manga reading order
or speech-balloon boundaries, so the app must save/edit order and grouping.

### 3. Precision recognizer: Baberu OCR ONNX

Baberu is Apache-2.0, 115M parameters, character-level, and designed for modern
Japanese/Chinese/English manga speech bubbles. It handles vertical text,
multi-line bubbles, mixed scripts, and sound effects. Its input contract is
explicitly **one speech-bubble crop**, with an upstream detector
([Baberu model card](https://huggingface.co/genshiai-daichi/baberu-ocr)).

The official smallest ONNX tier is three graphs:

- `vision_int4.onnx`: 52.3 MB;
- `decoder_prefill_int8.onnx`: 35.1 MB;
- `decoder_step_int8.onnx`: 33.9 MB;
- total: about **121 MB**, with Japanese nCER 0.0893 versus 0.0867 for the
  242 MB tier.

The release includes a self-contained reference that resizes the crop to
224×224, applies ImageNet normalization, runs vision → prefill → cached decoder
steps, and uses greedy decoding with its published repetition/content-run rules
([official ONNX inference](https://huggingface.co/genshiai-daichi/baberu-ocr/blob/main/onnx_infer.py),
[ONNX files](https://huggingface.co/genshiai-daichi/baberu-ocr/tree/main/onnx)).

This is feasible in the browser but **not a drop-in npm pipeline**. Port the
small reference loop to TypeScript and run the sessions in a module worker with
`onnxruntime-web`. ONNX Runtime officially supports in-browser WASM and WebGPU;
WASM has complete operator coverage while GPU providers support subsets. Its
current compatibility table limits WebGPU mainly to Chromium, so retain a WASM
or baseline-Paddle path for Safari/Firefox/mobile
([ORT Web](https://onnxruntime.ai/docs/tutorials/web/),
[browser support](https://onnxruntime.ai/docs/get-started/with-javascript/web.html),
[WebGPU guidance](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)).

An independent Apache-2.0 conversion demonstrates a full WebGPU port, including
a deduplicated 86.94 MB 121-tier bundle, but its own card says it is a personal,
experimental mirror, not production ready, and that full benchmark parity is
unknown. It is useful proof of feasibility and reference source, not a dependency
to ship without auditing and reproducing its conversion
([experimental WebGPU port](https://huggingface.co/ameraino11/baberu-ocr-webgpu)).

Recommended first UX:

1. User drags a box around one bubble. A later detector may also offer suggested
   groups of Paddle polygons.
2. Expand the crop enough to include the whole bubble; do not send an isolated
   glyph or tightly clipped line when multi-line context is available.
3. Run Baberu in a worker, show download/inference progress, and discard work
   when the reader navigates away.
4. Show the result immediately in the right-hand `JapaneseReader` rail (or an
   anchored fullscreen tooltip) and feed it into JPDB/WaniKani analysis.
5. Cache versioned, checksum-pinned model assets in browser Cache Storage; keep
   page blobs and OCR metadata in IndexedDB. Lazy-load only on first use.

The model reports no confidence score and, like other generative crop OCRs, can
still be wrong. Never silently replace user-edited text.

### 4. Baberu versus Tesseract.js versus server-side Paddle manga OCR

| Choice | Recognition evidence | Browser/server fit | Recommendation |
| --- | --- | --- | --- |
| **Baberu 115M ONNX** | On its independent, human-labeled Manga109-v2026 bubble set (n=2,000): lCER 3.45%, nCER 8.71%; manga-ocr was 4.22%/9.54%, base PaddleOCR-VL 3.68%/8.08% | Apache-2.0; 121 MB smallest tier; local; crop-only; custom TS decode/worker and browser validation required | **Precision crop path** |
| **Tesseract.js** | No primary manga/vertical-balloon benchmark found. Tesseract publishes `jpn` and `jpn_vert` trained data, but it is general OCR | Apache-2.0; mature browser WASM; easier and much lighter; generic layouts, furigana, art backgrounds, and stylized SFX are outside its specialization | Compatibility/control only, not “precise manga OCR” ([Tesseract.js](https://github.com/naptha/tesseract.js), [`jpn_vert` data](https://github.com/tesseract-ocr/tessdata_fast/blob/main/jpn_vert.traineddata)) |
| **PaddleOCR-VL-For-Manga 0.9B** | Reports 70% exact-sentence accuracy versus 27% for base PaddleOCR-VL on its own random 90/10 Manga109-s crop split. JMangaBench Mixed reports 2.91% CER, but the model trained on Manga109-s, so Manga109-derived evaluation cannot establish clean out-of-corpus superiority | Apache-2.0; 958.6M parameters and 1.92 GB BF16 weights; Python/custom-code crop recognizer; practical serving expects a dedicated GPU service and uploads user pixels | **Do not put in current Vercel app**; consider only an explicit opt-in external GPU service ([model/repo](https://github.com/jzhang533/PaddleOCR-VL-For-Manga), [weights](https://huggingface.co/jzhang533/PaddleOCR-VL-For-Manga/tree/main)) |

Vercel now has a public-beta large-functions path up to 5 GB, but ordinary
functions still use the standard smaller path and current Functions offer 2 GB
default / 4 GB maximum memory, CPU-oriented instances, 500 MB `/tmp`, and a
4.5 MB request/response body limit. A 1.92 GB model plus PyTorch/Transformers,
runtime tensors, cold downloads, and CPU inference is therefore a poor fit even
if the bundle can technically be admitted
([Vercel large functions](https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size),
[Functions limits](https://vercel.com/docs/functions/limitations),
[runtimes](https://vercel.com/docs/functions/runtimes)).

### 5. Hayai OCR v2/v2.1

Hayai OCR v2.1 is an Apache-2.0, crop-only CJK/English model with about 155.6M
parameters. Its model file is 622.5 MB FP32 and requires custom Transformers
code (`trust_remote_code=True`); no official ONNX/browser release is provided.
The project claims roughly 300 MB FP16 VRAM and strong GPU throughput, making it
more realistic than the 0.9B Paddle model for a separate GPU service, but not a
better fit than Baberu for this browser-first app
([Hayai model card/files](https://huggingface.co/JustANormalTinkerer/hayai-ocr-v2),
[Hayai package](https://github.com/NopeNopeGuy/hayai-ocr)).

Its v2.1 model card reports 3.225% CER on JMangaBench Mixed, versus Baberu's
4.589% and PaddleOCR-VL-For-Manga's 2.910%. Treat that as promising, not decisive:

- the frozen JMangaBench repository's published reference table currently lists
  the older HayaiOCR result, not v2/v2.1;
- Hayai lists Manga109-s among its training data, while JMangaBench contains
  1,286 real Manga109-s crops and uses Manga109-s page regions behind its
  synthetic samples;
- the other published Hayai comparisons are on training splits or selected
  examples, not an independent Kakehashi-like corpus.

The benchmark itself is reproducible and useful for engineering, but its
repository is GPL-3.0-only. Run it as isolated development/evaluation tooling if
desired; do not copy it into the MIT application bundle
([JMangaBench Mixed](https://github.com/muscgab/JMangaBench_Mixed)).

### 6. Other candidates and licensing

| Candidate | Strength | Blocking weakness | Verdict |
| --- | --- | --- | --- |
| **Manga OCR / ONNX** | Apache-2.0; Japanese manga-specific; vertical/horizontal, furigana, noisy/stylized text; browser conversion exists | Recognition only; can hallucinate on blank/noisy crops; Baberu's independent comparison is better | Good contingency if the custom Baberu browser port misses its performance/compatibility gate ([manga-ocr](https://github.com/kha-white/manga-ocr), [browser ONNX](https://huggingface.co/onnx-community/manga-ocr-base-ONNX)) |
| **mokuro / comic-text-detector** | Complete offline page-to-overlay reference workflow | Python sidecar; direct projects are GPL-3.0 | Architecture reference only; do not embed in the MIT web app ([mokuro](https://github.com/kha-white/mokuro), [detector](https://github.com/dmMaze/comic-text-detector)) |
| **YomiToku** | Japanese document OCR, vertical text, layout/order | Python-heavy, document-oriented, CC BY-NC-SA weights/package; commercial use needs another license | Do not adopt ([YomiToku](https://github.com/kotaro-kinoshita/yomitoku)) |
| **Google Cloud Vision** | Managed Japanese OCR, polygons, PDFs | Upload/privacy regression, credentials/billing, not manga-specific | Explicit cloud fallback only ([OCR](https://cloud.google.com/vision/docs/ocr), [pricing](https://cloud.google.com/vision/pricing)) |

The recommended runtime stack is permissively licensed for an MIT app: fflate
and [ONNX Runtime](https://github.com/microsoft/onnxruntime) are MIT; PDF.js,
PaddleOCR/PaddleOCR.js, and Baberu are Apache-2.0. Preserve their license/notice
requirements and pin revisions.

## OCR result and vocabulary wiring

Persist OCR alongside its local source page, for example:

```ts
type MangaOcrPage = {
  page: number;
  sourceFingerprint: string;
  pageEngine: "paddleocr-v6-small";
  modelRevisions: { paddle: string; baberu?: string };
  width: number;
  height: number;
  regions: Array<{
    id: string;
    poly: Array<[number, number]>;
    groupPoly?: Array<[number, number]>;
    paddleText: string;
    paddleScore: number;
    baberuText?: string;
    editedText?: string;
    order: number;
    orientation: "vertical" | "horizontal";
  }>;
};
```

Fingerprint/version results so a changed page or model invalidates stale OCR.
Render accessible buttons over polygons. Selecting one sends
`editedText ?? baberuText ?? paddleText` to `JapaneseReader` with
`interaction="tooltip"`. For page-wide JPDB analysis, concatenate regions in
the saved reading order. This reuses the Songs behavior: JPDB tokenization,
WaniKani known/learning state, subject links, meanings, readings, and speech.

Paddle line order is not manga order. Default vertical groups right-to-left and
top-to-bottom, horizontal groups top-to-bottom and left-to-right, and always
offer reorder/correction controls. Persist user edits independently so rescans
cannot erase them.

## Accuracy and deployment gate

Before labeling the feature “precise,” evaluate manually transcribed crops from
representative, legally usable pages: clean vertical dialogue, horizontal text,
furigana, low-resolution scans, text over art, stylized fonts/SFX, mixed scripts,
and blank/non-text crops.

Compare:

1. PaddleOCRv6 small alone.
2. Paddle detection/grouping + Baberu 121 MB on whole-bubble crops.
3. Baberu on user-selected crops (the accuracy ceiling for the UI).
4. Manga OCR ONNX as the contingency.
5. Tesseract `jpn`/`jpn_vert` as the generic control.

Measure region recall, normalized CER and exact match, reading-order accuracy,
false-positive/hallucination rate, first-load bytes, warm latency, peak browser
memory, and failure/cancel behavior on current desktop Chrome/Safari/Firefox and
one representative mobile device. Separate ordinary dialogue from decorative
SFX. Published model scores cannot replace this test because crop construction
and title/domain overlap materially change results.

Ship Baberu only if the pinned browser port reproduces the official Python ONNX
outputs on a conversion/parity set and remains responsive within a worker. If
not, keep Paddle OCR plus editable text and use the existing browser-ready Manga
OCR ONNX contingency rather than silently moving pages to a server.

## Suggested implementation order

1. Add CBZ/ZIP import limits and normalized page access; preserve current PDF
   and image imports.
2. Add PDF.js text extraction/rendering.
3. Add PaddleOCR.js in a lazy client worker, scan the current page, persist
   polygons, and build reading-order/text correction controls.
4. Wire selected and page-ordered text into the existing `JapaneseReader`.
5. Prototype Baberu 121 MB in a worker for **manual bubble crops**, with pinned
   checksums, progress/cancel, cache cleanup, and output parity tests.
6. Run the Kakehashi corpus gate; only then add automatic Paddle-polygon grouping
   and make Baberu the **Improve this bubble** path.
7. Consider a separate opt-in GPU service (Hayai or PaddleOCR-VL-For-Manga) only
   if local results demonstrably miss the product target and users accept the
   privacy/cost tradeoff.
