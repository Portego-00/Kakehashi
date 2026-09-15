# Notebook handwriting

## Interaction

On iPad, Add a block → Handwriting, the pencil toolbar button, or the slash menu inserts a writing area directly in the notebook and activates it. The full native PencilKit canvas occupies that area. Its system tool picker provides Pencil tools, erasing, selection, ruler and colors, with native pressure/tilt data. The surrounding notebook provides Tools, Undo, Redo, Draw with finger, Scroll page and Done. Both Done and Scroll page sync and close the active canvas. Write opens the native tool picker automatically. Full screen expands the same canvas within the notebook viewport; Exit full screen restores its position without replacing the drawing session. Other areas show their saved preview until Write is selected.

Scoped Scribble delegates reject text conversion inside the native canvas. The notebook freezes DOM scrolling/text interaction while an area is active; the host clips a full translated paper frame rather than shrinking ink to the visible rectangle. A single bottom handle changes paper height while retaining its width. Native ink bounds prevent trimming existing strokes, and resizing does not transform stored ink coordinates. A captured stroke can continue beyond the paper edge, but fresh Pencil contacts outside the paper reach controls instead of starting ink. The drawing remains in the same BlockNote block.

Paper follows the actual app background by default, including light, dark, black and sepia. Each area offers Auto, White, Cream, Dark and a custom color. This choice is document metadata. PencilKit exports separate transparent light/dark PNGs using explicit appearance traits; viewers choose the real ink variant for the paper's luminance. No CSS inversion or ink-data recoloring is used. Legacy opaque previews remain readable until the area is edited and saved with the native canvas.

The September 15 iPad build uses marketing version **1.4.8** and iOS runtime **1.4.8-handwriting.4**. The native preview and resize corrections require a new binary; the separate runtime also prevents cached older editor bundles from replacing its fixes. Optional module/view lookup protects older binaries. No EAS Update is published as part of this release. Other app features remain available, while clients without the necessary notebook capabilities receive a scoped update-required response for these notebook documents.

Notebooks and handwriting are available to all signed-in WaniKani accounts, with private account ownership enforced by authenticated server routes. Hardware pressure, palm rejection and writing latency still require a person using Apple Pencil; simulator serialization and drawing checks do not establish the physical writing experience.

## Document and private assets

A saved area contains metadata only:

```json
{
  "id": "notebook-block-id",
  "type": "handwriting",
  "props": {
    "drawingId": "00a00000-0000-4000-8000-000000000001",
    "inkFormat": "pencilkit-v1",
    "previewFormat": "themed-v1",
    "paperColor": "auto",
    "width": 768,
    "height": 384
  }
}
```

A new empty area retains the compatible `drawingId: ""`, `inkFormat: "strokes-v1"` sentinel. It is a valid block, never a valid asset identity. The first native save replaces its metadata with a new immutable PencilKit reference. Missing ink format means legacy PencilKit. Unknown formats are rejected. Paper color is `auto` or lowercase six-digit hex; missing paper color means Auto.

Portable drawings created by the earlier inline implementation are imported once into PencilKit. Original immutable cloud assets and unfinished portable recovery are retained until the converted drawing reference persists. PencilKit data is never converted into text. Web displays the saved PNG inline and in its expanded reading view; focus refresh and 30-second visible polling detect drawings saved on iPad while retaining local web edits/conflicts. Text/HTML exports identify handwriting but do not package private drawing assets.

Assets consist of original `drawing.ink`, transparent light `preview.png`, and transparent dark `preview-dark.png`. Each is limited to 1 MiB. Dimensions are integer 1–4096 with at most 16,000,000 pixels. Upload JSON is capped at 4,200,000 bytes. Validation checks canonical base64, PNG signature, chunk bounds/checksums, dimensions and image-data/end markers. Themed previews require both PNGs and PencilKit format. Legacy two-object uploads remain supported. Portable JSON has additional bounded stroke/point validation in `inline-ink.ts`.

## Recovery and save ordering

Native PencilKit stages drawing data atomically under an account/page/block key, bound to the source asset. The host also journals each export before upload, serializing work by key across remounts. An uploaded asset is recorded and reused on retry; changing preview generation invalidates reuse even if ink bytes are unchanged.

Done uploads one immutable revision, updates the same block, and persists the notebook reference. Recovery is cleared only after native acknowledgment confirms that its current revision matches the exported revision. A false acknowledgment, failure, newer snapshot, account switch or page replacement retains recovery. Previous portable recovery is removed only after the native reference is durable. Source conflicts retain local data and report the problem. No credentials appear in recovery.

Drawing activity follows live contacts and native gesture state; interruption, backgrounding and detachment clear stale activity. A failed resize does not block Done or Scroll page. If an error prevents saving, Leave writing flushes the local recovery and closes writing mode without discarding it; Write reopens that recovery. Failed notebook persistence or acknowledgment releases the editing lock while retaining the staged asset for retry.

The native canvas flushes recovery on detach/background and before export. An abrupt process termination before a pending local write completes cannot be guaranteed recoverable. No cloud upload occurs per stroke. Pending and old revisions count against quota until reconciled; do not delete an asset merely because a cloud notebook does not currently reference it, since a local draft may still need it.

## Authentication and compatibility

Native requests use the verified WaniKani bearer token and matching `X-Notebook-Account`. Browser previews use the sealed web session. Tokens and drawing payloads never appear in URLs or logs.

- `POST /api/notebooks/native/drawings` accepts original ink, primary PNG, dimensions and optional ink/preview formats plus dark PNG; returns account and portable reference metadata.
- `GET /api/notebooks/native/drawings/[drawingId]` returns owned original ink and preview(s).
- `GET /api/notebooks/drawings/[drawingId]/preview?appearance=dark` returns only the owned PNG variant. Legacy previews fall back to their original image.

Responses are `private, no-store` and `nosniff`; body reads and request rates are bounded. Storage has no public/signed preview URL. Reference checks include ownership, dimensions, ink format and preview format.

Updated clients send `X-Notebook-Features: handwriting-v1, handwriting-strokes-v1, handwriting-appearance-v1`. Appearance metadata, including on empty/nested/Trash blocks, requires the appearance capability. Unsupported readers/writers receive HTTP 426 `update_required`; checks also run inside optimistic mutation retries. Direct asset reads/uploads enforce their formats before ink download. Text-only notebooks remain compatible without these capabilities.

## Storage and release validation

The private bucket and server-only metadata use migrations `20260909000000_notebook_handwriting.sql`, `20260910120000_inline_notebook_handwriting.sql`, and `20260910180000_notebook_handwriting_appearance.sql`. The latter adds dark-preview accounting and a v3 reservation RPC while preserving the original six-argument RPC and v2 wrapper. All generations include dark bytes in the account quota of **100 MiB and 2,000 immutable revisions**, protected by an account lock. All required objects must upload before ready status.

Evidence for this correction is recorded under `output/notebooks-mobile/native-inline-pencilkit-2026-09-10/`. Historical JS inline evidence remains under `inline-handwriting-2026-09-10/`, and original modal PencilKit evidence under `handwriting-2026-09-09/` and `ipad-handwriting-2026-09-10/`. The new evidence separates native simulator assertions, browser fixtures, private live-storage round trips, deployment smoke checks, and the physical iPad installation.


The correction was deployed on 2026-09-10 as `dpl_G8mM1y8TTio6PrzeFvfTNLSqjLfT` ([deployment](https://kakehashi-pbvvn40df-portego-00s-projects.vercel.app)), promoted to [kakehashiapp.com](https://kakehashiapp.com), and installed in place on the connected iPad. Validation includes 137 native Jest tests, 27 DOM tests, 136 web/backend tests, 23 native simulator assertions, TypeScript/lint, SQL regressions, and byte-exact live-storage checks with all synthetic test assets removed.

For the September 10 release, the main checkout used marketing version 1.4.7 with iOS runtime `1.4.7-handwriting.3`, while the separate tested iPad checkout used version 1.5.0/runtime `1.5.0-handwriting.3`. The current September 15 runtime is documented above; Android's configured runtime is unchanged. These native compatibility groups must remain distinct. Urgent JavaScript updates for older runtime `1.4.7` need a maintained compatible release checkout/config; changing a runtime for new builds does not change installed apps.

## Pencil controls correction (2026-09-10)

The controls correction is a native/mobile-only release; it uses the existing deployed API and asset format. Evidence is under `output/notebooks-mobile/native-pencil-controls-2026-09-10/`. The new iOS runtimes separate these native fixes from the preceding binary. No backend deployment or EAS Update is required for the direct iPad installation.

## Done hit testing and selection (2026-09-14)

Native paper geometry follows captured ancestor scroll events as well as size/viewport changes. Programmatic scrolling, including focus and scroll anchoring while text input is locked, can move the paper without resizing it. Previously the native drawing surface stayed at its old coordinates and could cover Done; the same scroll now updates its rectangle through the host layout callback. The drawing selection has no blue fill or thick inset outline, only a subtle change to the existing paper border. Other block selections and keyboard focus indicators retain their behavior.

These changes affect the mobile DOM code and CSS only; they require no new native module, runtime bump, backend deployment or asset migration. Release preparation uses the current app sources and runtime `1.4.8`. Evidence, including the failing regression and browser geometry before/after, is under `output/notebooks-mobile/done-selection-2026-09-14/`.

## Vertical paper resizing (2026-09-15)

Dragging the bottom handle adds or removes blank paper. Paper width, handwriting proportions, and the ink's position relative to the top-left corner stay fixed. Shrinking stops at the existing ink bounds. Full-screen paper uses the available width to set its zoom and scrolls vertically when taller than the viewport; changing its height no longer scales the whole drawing to fit the screen. Finger scrolling updates the native paper's position and clipping rectangle while the toolbar remains reachable.

Native layout also uses one scale derived from width and anchors PencilKit at the paper's top-left corner. Display height and logical paper height can arrive in separate layout turns; deriving vertical scale or centering from the temporary height stretched and shifted the visible ink during that gap. An isolated iPad Simulator fixture using the real PencilKit canvas reproduced eight scale/position failures across expansion, shrinking and both update orders. The corrected layout passes all 30 checks, including unchanged stored ink. This native correction requires an updated iPad binary. Fixture evidence is under `/tmp/kakehashi-native-resize-qa-20260915/` (`before.json`, `uniform-scale-only.json`, `after.json`, `current-production.json`). The permanent regression compiles current production sources: `node scripts/run-handwriting-resize-native-checks.mjs --simulator <booted-iPad-simulator-UDID> --output /tmp/handwriting-resize-checks.json`. It uses a disposable simulator app and removes that app and its temporary build after the checks.

The DOM regression exercises expansion and contraction in inline and full-screen modes, and checks native layout updates when the full-screen stage scrolls. Run `cd web && node node_modules/vitest/vitest.mjs run --config vitest.mobile-dom.config.ts` (36 passing tests). The native-host resize and save suites also pass 19 tests: `node node_modules/jest/bin/jest.js --runInBand src/features/notebooks/__tests__/native-inline-resize.test.tsx src/features/notebooks/__tests__/use-native-inline-handwriting.test.tsx`.

An isolated browser fixture also passes in Chromium and WebKit at 1024×768 and 390×844. It checks actual pointer/keyboard resizing, fixed preview proportions, scrolling to the bottom handle, and native overlay geometry callbacks. The same check fails on the previous component: increasing logical paper height from 384 to 1024 shrinks displayed width from 992 to 372 pixels; the corrected component keeps it at 992. The report and fixture are in `/tmp/kakehashi-handwriting-browser-check/`; native callbacks are mocked in this browser check.

## Preview resolution and installed selection fix (2026-09-15)

The saved preview previously rendered at one pixel per paper point. Both native exporters now try 3×, 2×, then 1× resolution, bounded by 4096 pixels per edge, 16 million pixels and 1 MiB per PNG. The two transparent appearance previews use the same scale and fall back together if either exceeds its byte limit. A compact coverage comparison also chooses 2× when 3× would fade visible strokes: independent live-canvas checks confirm that 2× matches the iPad rendering of fine ink. Native pixel checks cover normal pen/pencil/marker widths, pressure tails, both appearances and budget fallbacks. Original PencilKit data, pressure/tilt, and logical paper dimensions remain unchanged. The server accepts these integer densities without changing the existing asset format, metadata, quotas or capabilities; older 1× previews and clients remain compatible. Existing drawings gain sharper shared previews the next time the user opens Write and finishes with Done. No automatic rewriting of personal assets occurs.

The connected iPad's most recently successful downloaded `1.4.8` update still contained `mobile-editor-e85627bca1d45f06d15b4777fecf80b2.css`, which lacks the neutral handwriting-selection rules already in source. Actual packaged-style checks across light/dark/sepia confirm that the corrected stylesheet removes the blue selection fill/outline while preserving keyboard focus. The new iOS binary uses runtime `1.4.8-handwriting.4` so the older cached update cannot replace its embedded editor. The marketing version remains 1.4.8; Android retains its existing runtime. This correction needs a native iPad build and the compatible PNG validator deployed before new high-resolution uploads. It publishes no EAS Update and requires no database migration.

The compatible backend was deployed on 2026-09-15 as `dpl_D5KbRaKWAgLKKd3bA3svqdCKJ69M` ([deployment](https://kakehashi-8doc0qiev-portego-00s-projects.vercel.app)) and verified live at [kakehashiapp.com](https://kakehashiapp.com). Its source preserves 812 of the previous deployment’s 813 files byte-for-byte, changing only PNG density validation. The production build/TypeScript check, 21 actual-native-fixture parser checks, and 46 live synthetic-owner storage checks passed; all three test rows and eight objects were removed. Production authentication checks return 401 for unauthenticated native/browser access and 403 for demo previews. No database migration or EAS URL change was required. Backend evidence is under `output/notebooks-mobile/preview-resolution-2026-09-15/backend/`; physical iPad installation/testing is recorded separately.
