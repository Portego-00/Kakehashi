import { drawingPayload, type NotebookDrawingPayload, type NotebookDrawingReference } from "./handwriting-api";

type Cache = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
type PendingDrawing = { payload: NotebookDrawingPayload; saved?: NotebookDrawingReference };
export function handwritingDraftKey(accountId: string, pageId: string, sourceId?: string) {
  return `notebook-handwriting-v1:${encodeURIComponent(accountId)}:${encodeURIComponent(pageId)}:${sourceId || "new"}`;
}

/** Ink is retained until the notebook's new block reference is durable on device. */
export function createHandwritingDraftSession(options: {
  cache: Cache; key: string; isCurrent: () => boolean;
  edit: (payload?: NotebookDrawingPayload) => Promise<NotebookDrawingPayload | null>;
  load: () => Promise<NotebookDrawingPayload | undefined>;
  save: (payload: NotebookDrawingPayload) => Promise<NotebookDrawingReference>;
  persistPage: () => Promise<void>;
  clearNativeDraft: () => Promise<void>;
}) {
  let busy = false;
  const checkCurrent = () => { if (!options.isCurrent()) throw new Error("Your account or page changed. Your handwriting draft is retained."); };
  const read = async (): Promise<PendingDrawing | null> => {
    const raw = await options.cache.getItem(options.key);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingDrawing;
    return { ...pending, payload: drawingPayload(pending.payload) };
  };
  return {
    async edit(): Promise<NotebookDrawingReference | null> {
      if (busy) throw new Error("Finish the current handwriting change first.");
      busy = true;
      try {
        checkCurrent();
        const pending = await read();
        checkCurrent();
        if (pending?.saved) return pending.saved;
        const original = pending?.payload ?? await options.load();
        checkCurrent();
        const edited = await options.edit(original);
        if (!edited) return null;
        const payload = drawingPayload(edited);
        await options.cache.setItem(options.key, JSON.stringify({ payload }));
        checkCurrent();
        let saved: NotebookDrawingReference;
        try { saved = await options.save(payload); }
        catch (error) { throw new Error(`${error instanceof Error ? error.message : "Handwriting could not sync."} Your handwriting is saved on this device. Open Handwriting again to retry.`); }
        await options.cache.setItem(options.key, JSON.stringify({ payload, saved }));
        checkCurrent();
        return saved;
      } finally { busy = false; }
    },
    async commit(drawingId: string) {
      checkCurrent();
      const pending = await read();
      if (pending?.saved?.drawingId !== drawingId) return;
      await options.persistPage();
      checkCurrent();
      await options.clearNativeDraft();
      await options.cache.removeItem(options.key);
    },
  };
}
