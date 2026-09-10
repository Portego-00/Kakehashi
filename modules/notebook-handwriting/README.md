# Notebook handwriting

The notebook now uses the [native inline PencilKit view](./INLINE.md). The modal API below remains available for compatibility with existing callers. Inline support requires a newer native binary than the original modal module.

Local Expo module for iPad handwriting. Expo autolinks this directory at `./modules`; no npm package or config plugin is required. Existing generated iOS projects need CocoaPods installation before the next native build. This module needs a **new iOS binary**; publishing JavaScript alone cannot add PencilKit to an old installation.

```ts
import {
  isHandwritingAvailable,
  editHandwriting,
  clearHandwritingDraft,
  cancelHandwriting,
} from '@/modules/notebook-handwriting';

const result = await editHandwriting({
  inkBase64: existingDrawing?.inkBase64,
  width: 768,
  height: 1024,
  theme: 'dark',
  draftKey: 'account-id/page-id/block-id',
});
```

`isHandwritingAvailable()` is true only on an iPad with this native module installed. iPhones, Android, web, and older iOS binaries return false without attempting to load an unsupported module. Those devices can render the separately saved preview. Calling `editHandwriting` when unavailable rejects with a useful error.

`editHandwriting` presents a full-screen UIKit controller with PencilKit's tool palette, undo/redo, a finger-drawing toggle, and pinch zoom/panning. Pencil drawing is enabled by default. With finger drawing off, one finger pans; with it on, two fingers pan. The entire paper fits initially, with space reserved below it for the PencilKit palette. The paper remains white regardless of app theme, so the ink and preview have the same colors everywhere.

Done returns `{ inkBase64, previewBase64, width, height }`. Ink is the original editable `PKDrawing` data. Preview is an opaque PNG at exactly the integer paper dimensions (scale 1). Dimensions default to 768×1024, are bounded to 1–4096 per side and 16 million pixels, and each decoded payload is limited to 1 MiB. Empty drawings cannot be saved. Invalid input, export failures, and failed recovery writes never replace the caller's existing drawing. An export or recovery failure keeps the canvas open.

Cancel resolves `null`; changed strokes require explicit discard confirmation. No notebook/backend calls happen inside this module. The caller owns upload, block insertion, and retaining the returned result if those operations fail.

Provide a stable `draftKey` scoped to the account, notebook page, and block (or a stable new-block slot). Use IDs, never credentials. The native editor atomically saves a private recovery draft after changes settle for 300 ms and immediately on backgrounding, Done, or programmatic cancellation. Recovery files have hashed names, device file protection, and are excluded from backup. Only the matching key restores a draft. Done requires a successful draft write when a key is supplied. A corrupt recovery draft raises an error while retaining the file, rather than silently losing it.

Call `clearHandwritingDraft(key)` only after the notebook block reference is durably saved. Explicitly discarding in the native editor also removes that recovery draft. Call `cancelHandwriting()` on account changes/unmount to dismiss without a discard prompt while keeping the scoped draft. Without a draft key, the module does not persist or restore any recovery file.

Validation includes the optional-module Jest suite, real SDK compilation, and an isolated iPad simulator fixture running these exact UIKit/PencilKit source files. The Expo bridge is separately typechecked against the project's compiled ExpoModulesCore module and actual CocoaPods headers. Simulator finger input verifies canvas behavior; Apple Pencil pressure, tilt, palm rejection, and physical-device latency still require an actual iPad and Pencil. A full signed-in release build is a separate integration check.
