import { decodeInlineInk, encodeInlineInk, type InlineInkDocument } from "../../../web/src/features/notebooks/inline-ink";
import type { NotebookDrawingPayload, NotebookDrawingReference } from "./handwriting-api";

type Cache = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
type Draft = { version: 1; sourceId: string; inkBase64: string; saved?: NotebookDrawingReference };
const writes = new Map<string, Promise<unknown>>();

// Accepted local writes finish even if navigation unmounts their editor. The
// account/page/block key and shared queue prevent cross-page and remount races.
function serial<T>(key: string, action: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) || Promise.resolve()).catch(() => undefined).then(action);
  writes.set(key, next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => undefined);
  return next;
}

export function inlineHandwritingDraftKey(accountId: string, pageId: string, blockId: string) {
  return `notebook-inline-ink-v1:${encodeURIComponent(accountId)}:${encodeURIComponent(pageId)}:${encodeURIComponent(blockId)}`;
}

export function createInlineHandwritingDraftSession(options: {
  cache: Cache; key: string; isCurrent: () => boolean;
  loadOriginal: (drawingId: string) => Promise<NotebookDrawingPayload>;
  save: (payload: NotebookDrawingPayload) => Promise<NotebookDrawingReference>;
  persistPage: () => Promise<void>;
}) {
  let saving = false;
  const current = () => { if (!options.isCurrent()) throw new Error("Your account or page changed. Your handwriting draft is retained."); };
  const read = async (): Promise<Draft | null> => {
    const raw = await options.cache.getItem(options.key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (draft.version !== 1 || typeof draft.sourceId !== "string") throw new Error("This handwriting draft could not be read. It is still stored on this device.");
    decodeInlineInk(draft.inkBase64);
    return draft;
  };
  const matches = (draft: Draft, sourceId: string) => draft.sourceId === sourceId || draft.saved?.drawingId === sourceId;
  const conflict = () => new Error("This handwriting changed elsewhere. Your local draft is retained; reopen the original page before continuing.");

  return {
    async load(sourceId: string): Promise<InlineInkDocument | null> {
      current();
      const draft = await serial(options.key, read);
      current();
      if (draft) {
        if (!matches(draft, sourceId)) throw conflict();
        return decodeInlineInk(draft.inkBase64);
      }
      if (!sourceId) return null;
      const original = await options.loadOriginal(sourceId);
      current();
      const recovered = await serial(options.key, read);
      current();
      if (recovered) {
        if (!matches(recovered, sourceId)) throw conflict();
        return decodeInlineInk(recovered.inkBase64);
      }
      if (original.inkFormat !== "strokes-v1") throw new Error("This drawing uses the original handwriting editor.");
      return decodeInlineInk(original.inkBase64);
    },
    async stage(sourceId: string, document: InlineInkDocument): Promise<void> {
      // A captured block session may receive its final DOM snapshot after the
      // page closes. Local-only staging stays bound to that original private key.
      const inkBase64 = encodeInlineInk(document);
      await serial(options.key, async () => {
        const previous = await read();
        if (previous && !matches(previous, sourceId)) throw conflict();
        const saved = previous?.inkBase64 === inkBase64 ? previous.saved : undefined;
        await options.cache.setItem(options.key, JSON.stringify({ version: 1, sourceId, inkBase64, ...(saved ? { saved } : {}) } satisfies Draft));
      });
    },
    async save(sourceId: string, payload: NotebookDrawingPayload): Promise<NotebookDrawingReference> {
      current();
      if (saving) throw new Error("This handwriting is already saving.");
      if (payload.inkFormat !== "strokes-v1") throw new Error("This writing area needs editable strokes.");
      const document = decodeInlineInk(payload.inkBase64);
      if (document.width !== payload.width || document.height !== payload.height) throw new Error("The handwriting size changed. Try saving again.");
      const inkBase64 = encodeInlineInk(document);
      saving = true;
      try {
        // Stage before any network request. Retrying after upload/insertion was
        // interrupted reuses its immutable asset instead of consuming quota again.
        const draft = await serial(options.key, async () => {
          const previous = await read();
          if (previous && !matches(previous, sourceId)) throw conflict();
          const next: Draft = { version: 1, sourceId, inkBase64, ...(previous?.inkBase64 === inkBase64 && previous.saved ? { saved: previous.saved } : {}) };
          await options.cache.setItem(options.key, JSON.stringify(next));
          return next;
        });
        current();
        if (draft.saved) return draft.saved;
        const saved = await options.save({ ...payload, inkBase64 });
        await serial(options.key, async () => {
          const latest = await read();
          if (!latest || latest.inkBase64 !== inkBase64 || !matches(latest, sourceId)) throw new Error("Your drawing changed while saving. The latest strokes are kept on this device; tap Done again.");
          await options.cache.setItem(options.key, JSON.stringify({ ...latest, saved }));
        });
        current();
        return saved;
      } finally { saving = false; }
    },
    async commit(drawingId: string) {
      current();
      const draft = await serial(options.key, read);
      if (draft?.saved?.drawingId !== drawingId) return;
      await options.persistPage();
      current();
      await serial(options.key, async () => {
        const latest = await read();
        if (latest?.saved?.drawingId === drawingId && latest.inkBase64 === draft.inkBase64) await options.cache.removeItem(options.key);
      });
    },
  };
}
