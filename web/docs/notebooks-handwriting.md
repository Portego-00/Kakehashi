# Notebook handwriting

## Interaction

On iPad, Add a block → Handwriting, the pencil toolbar button, or the slash menu inserts a writing area directly in the notebook and activates it. The full native PencilKit canvas occupies that area. Its system tool picker provides Pencil tools, erasing, selection, ruler and colors, with native pressure/tilt data. The surrounding notebook provides Tools, Undo, Redo, Draw with finger, Scroll page and Done. Both Done and Scroll page sync and close the active canvas. Write opens the native tool picker automatically. Full screen expands the same canvas within the notebook viewport; Exit full screen restores its position without replacing the drawing session. Other areas show their saved preview until Write is selected.

Scoped Scribble delegates reject text conversion inside the native canvas. The notebook freezes DOM scrolling/text interaction while an area is active; the host clips a full translated paper frame rather than shrinking ink to the visible rectangle. A single bottom handle changes paper height while retaining its width. Native ink bounds prevent trimming existing strokes, and resizing does not transform stored ink coordinates. A captured stroke can continue beyond the paper edge, but fresh Pencil contacts outside the paper reach controls instead of starting ink. The drawing remains in the same BlockNote block.

Paper follows the actual app background by default, including light, dark, black and sepia. Each area offers Auto, White, Cream, Dark and a custom color. This choice is document metadata. PencilKit exports separate transparent light/dark PNGs using explicit appearance traits; viewers choose the real ink variant for the paper's luminance. No CSS inversion or ink-data recoloring is used. Legacy opaque previews remain readable until the area is edited and saved with the native canvas.

The iPad build retains marketing version **1.5.0** and uses runtime **1.5.0-handwriting.3** because the inline native view requires a new binary. Optional module/view lookup protects older binaries. No EAS Update is published as part of this release. Other app features remain available, while clients without the necessary notebook capabilities receive a scoped update-required response for these notebook documents.

Notebooks and handwriting remain **Portego-only**, enforced by app access and authenticated server routes. Hardware pressure, palm rejection and writing latency still require a person using Apple Pencil; simulator serialization and drawing checks do not establish the physical writing experience.

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

Native requests use the verified WaniKani bearer token, matching `X-Notebook-Account`, and verified Portego username. Browser previews use the sealed web session. Tokens and drawing payloads never appear in URLs or logs.

- `POST /api/notebooks/native/drawings` accepts original ink, primary PNG, dimensions and optional ink/preview formats plus dark PNG; returns account and portable reference metadata.
- `GET /api/notebooks/native/drawings/[drawingId]` returns owned original ink and preview(s).
- `GET /api/notebooks/drawings/[drawingId]/preview?appearance=dark` returns only the owned PNG variant. Legacy previews fall back to their original image.

Responses are `private, no-store` and `nosniff`; body reads and request rates are bounded. Storage has no public/signed preview URL. Reference checks include ownership, dimensions, ink format and preview format.

Updated clients send `X-Notebook-Features: handwriting-v1, handwriting-strokes-v1, handwriting-appearance-v1`. Appearance metadata, including on empty/nested/Trash blocks, requires the appearance capability. Unsupported readers/writers receive HTTP 426 `update_required`; checks also run inside optimistic mutation retries. Direct asset reads/uploads enforce their formats before ink download. Text-only notebooks remain compatible without these capabilities.

## Storage and release validation

The private bucket and server-only metadata use migrations `20260909000000_notebook_handwriting.sql`, `20260910120000_inline_notebook_handwriting.sql`, and `20260910180000_notebook_handwriting_appearance.sql`. The latter adds dark-preview accounting and a v3 reservation RPC while preserving the original six-argument RPC and v2 wrapper. All generations include dark bytes in the account quota of **100 MiB and 2,000 immutable revisions**, protected by an account lock. All required objects must upload before ready status.

Evidence for this correction is recorded under `output/notebooks-mobile/native-inline-pencilkit-2026-09-10/`. Historical JS inline evidence remains under `inline-handwriting-2026-09-10/`, and original modal PencilKit evidence under `handwriting-2026-09-09/` and `ipad-handwriting-2026-09-10/`. The new evidence separates native simulator assertions, browser fixtures, private live-storage round trips, deployment smoke checks, and the physical iPad installation.


The correction was deployed on 2026-09-10 as `dpl_G8mM1y8TTio6PrzeFvfTNLSqjLfT` ([deployment](https://kakehashi-pbvvn40df-portego-00s-projects.vercel.app)), promoted to [kakehashiapp.com](https://kakehashiapp.com), and installed in place on the connected iPad. Validation includes 137 native Jest tests, 27 DOM tests, 136 web/backend tests, 23 native simulator assertions, TypeScript/lint, SQL regressions, and byte-exact live-storage checks with all synthetic test assets removed.

The main checkout remains at marketing version 1.4.7, with an iOS-only runtime override `1.4.7-handwriting.3`; Android's configured runtime is unchanged. The tested iPad checkout has the newer Watch integration and retains marketing version 1.5.0/runtime `1.5.0-handwriting.3`. These native compatibility groups must remain distinct. Urgent JavaScript updates for older runtime `1.4.7` need a maintained compatible release checkout/config; changing a runtime for new builds does not change installed apps.

## Pencil controls correction (2026-09-10)

The controls correction is a native/mobile-only release; it uses the existing deployed API and asset format. Evidence is under `output/notebooks-mobile/native-pencil-controls-2026-09-10/`. The new iOS runtimes separate these native fixes from the preceding binary. No backend deployment or EAS Update is required for the direct iPad installation.
