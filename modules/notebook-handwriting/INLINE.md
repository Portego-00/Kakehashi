# Inline PencilKit view

`NotebookHandwriting` exports `isInlineAvailable()` and `InlineHandwritingView`. Check the optional native module's **inline** capability before loading the view manager. An older binary can contain the modal module without this view. Inline support is iPad-only and needs a new native build, including a CocoaPods installation so the new Swift files compile. It cannot be added by an EAS JavaScript update.

The view is a real `PKCanvasView` with `PKToolPicker`, placed inside the notebook by its React Native host. It presents no modal. PencilKit owns pressure, tilt, tools, erasing, selection and undo; no pointer samples cross the JavaScript bridge. A scoped `UIScribbleInteraction` refuses Scribble within the canvas without changing Scribble elsewhere in the app.

## Document and layout

Pass one atomic `document` record with `sessionId`, `draftKey`, `sourceId`, `inkFormat`, optional `inkBase64`, and integer `width`/`height`. Blank source is `sourceId: ""` with no ink. Formats are `pencilkit-v1` and legacy `strokes-v1`; portable strokes import into native editable ink without replacing the original backend asset. Default paper is 768×384. Each side is 1–4096 and area is at most 16 million pixels.

Use a stable session ID while editing one block, including after its backend drawing ID changes. Key the React Native view by session ID. Reapplying props in the same session never replaces current strokes. A reused view receiving another session fails closed after flushing its draft; remount it instead.

The native frame represents the **entire paper**, scaled to its displayed size. Clip a translated full frame with an external React Native wrapper when the paper extends outside the WebView viewport. Do not size the native view to just the visible intersection: doing so would stretch the paper. Its bounds may resize for layout without changing stored paper dimensions.

The notebook keeps paper width fixed and lets the user resize its height. Fullscreen changes the displayed frame, not stored paper dimensions. Await `resizePaper(width, height)` before publishing a changed height; it returns actual metadata and rejects shrinking the changed dimension below existing ink or resizing during a live tool contact. Pre-existing horizontal overflow does not block a height-only resize at the same width. Ink is never transformed by a paper resize. The optional `paperSize` prop also applies subsequent dimension changes; its initial value is ignored so it cannot overwrite larger recovered dimensions. Treat `onReady` dimensions as authoritative after recovery.

## Activity and tools

Props are `active`, `inputEnabled`, `fingerDrawing`, `paperColor` (resolved `#RRGGBB`), and `paperStyle` (`light` or `dark`, selected by the paper luminance). Paper appearance only changes PKCanvasView background/traits and the palette color style, never strokes or revision. The host owns the block’s `auto`/custom color choice and resolves `auto` against the app theme. No outer host, window, or global appearance is overridden. Keep `active=true` while saving. Set `inputEnabled=false` before exporting and keep it false until the upload/page commit acknowledgment resolves. That lock rejects new contacts through hit-testing while preserving already captured PencilKit contacts and delayed pressure updates. Native export remains authoritative and rejects a live stroke; a stale JavaScript activity flag must not veto retries. Deactivating hides the palette and flushes the scoped native draft. Removal from the window, backgrounding and destruction also flush. The view itself never calls a backend.

`fingerDrawing` changes policy only when the prop value changes; re-renders do not override the native palette's Draw with Finger preference. Direct finger touches can pass through the view while Pencil-only drawing is selected, except during a Pencil stroke when PencilKit needs palm rejection. This requires the host's overlay wrapper to pass through hit testing (for example `pointerEvents="box-none"`). The host can instead lock notebook scrolling during an active drawing and provide an explicit scroll/finish action. New contacts outside the paper bounds are always refused so separate Pencil taps reach notebook controls. UIKit continues delivering a contact that began on paper after it crosses an edge; original out-of-bounds ink remains in PKDrawing, while PNG previews still render the chosen paper rectangle.

The native activity state combines PencilKit recognizer state with a passive ended/cancelled touch observer. It does not expire stationary contacts on a timer, and it clears interrupted activity on deactivation, backgrounding, or removal. Identical metadata layouts do not reapply canvas transforms. Activating Write makes the canvas first responder, shows the palette, and reasserts it once after the current attachment/focus turn.

Imperative methods are `setToolsVisible(boolean)`, `undo()`, `redo()`, `resizePaper(width,height)`, `flushDraft()`, `exportDrawing()`, and `acknowledgeSave(revision, savedDrawingId?)`.

## Export, recovery and acknowledgment

`exportDrawing()` returns `{sessionId, revision, inkFormat: "pencilkit-v1", previewFormat: "themed-v1", inkBase64, previewBase64, darkPreviewBase64, width, height}`. Ink remains editable PKDrawing data. Both PNGs have transparent backgrounds at exact integer paper dimensions and scale 1. Explicit light/dark trait collections render the two variants, including PencilKit’s adaptive black/white ink. The notebook overlays the appropriate variant on its selected paper color. Each of the three decoded upload payloads is limited to 1 MiB. Inline export permits blank drawings and erasing every stroke. Export first requires a successful native recovery write for changed ink; failure leaves the native drawing intact.

Provide a draft key scoped to account, notebook page and block. Never include credentials. Native recovery stores PKDrawing bytes, paper dimensions and its source asset ID in an atomic private file. Writes are throttled to 300 ms during interaction and immediate when a stroke finishes. Metadata events are throttled to 100 ms with an immediate final event; this does not throttle native ink.

Recovery normally requires the same `sourceId`. If a local upload journal proves the notebook's newer asset is the same pending drawing, the host may provide `acceptedRecoverySourceId` with the older source ID. Otherwise mismatched recovery fails without deleting or applying that draft. Use distinct keys from the older modal API because modal recovery has no source binding.

After upload and the notebook block reference are durably saved, call `acknowledgeSave(exportedRevision, savedDrawingId)`. It clears the draft only if that exact export is still current and no stroke is active; it returns false for a stale export. On success it binds any future draft to the acknowledged asset. A failed write or deletion throws and leaves the current drawing available. The host owns the upload journal, retry UI, account changes and keeping the overlay alive after save failure.

## Events and validation

`onReady` and `onChange` carry `{sessionId, revision, width, height, minimumWidth, minimumHeight, hasInk, canUndo, canRedo, recovered, dirty}`. `onError` carries `{sessionId, message}` and may include minimum dimensions. Initial document failures use the requested session ID so the host can display the error. `onToolActivity` carries `{sessionId, drawing}`.

The native fixture compiles these actual UIKit source files, exercises real PencilKit tools, resize/export and source-bound recovery on an iPad Simulator, and checks synthetic pressure/tilt serialization. The Expo wrapper separately typechecks against the app's compiled ExpoModulesCore and CocoaPods headers. Simulator finger gestures cannot verify physical Pencil pressure sensing, palm rejection, or end-to-end Scribble behavior beside WebView text; those need an iPad and Apple Pencil. Full app integration is validated by the host separately.
