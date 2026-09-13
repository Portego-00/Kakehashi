import { drawingPayload, type NotebookDrawingPayload, type NotebookDrawingReference } from "./handwriting-api";
import { isNotebookDrawingId, isNotebookDrawingSize } from "../../../web/src/features/notebooks/handwriting";

type Cache = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export type NativeInkPending = { version: 1; sourceId: string; revision: number; payload: NotebookDrawingPayload; saved?: NotebookDrawingReference };
export function nativeInkDraftKey(accountId: string, pageId: string, blockId: string) {
  return `notebook-native-inline-v1:${encodeURIComponent(accountId)}:${encodeURIComponent(pageId)}:${encodeURIComponent(blockId)}`;
}
const queues = new Map<string, Promise<unknown>>();
function serial<T>(key: string, action: () => Promise<T>): Promise<T> {
  const pending = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(action);
  queues.set(key, pending);
  void pending.finally(() => { if (queues.get(key) === pending) queues.delete(key); }).catch(() => undefined);
  return pending;
}
function sameSnapshot(a: NativeInkPending | null, b: NativeInkPending) {
  return a?.sourceId === b.sourceId && a.revision === b.revision && a.payload.inkBase64 === b.payload.inkBase64 && a.payload.width === b.payload.width && a.payload.height === b.payload.height && a.payload.previewFormat === b.payload.previewFormat;
}
export function createNativeInkJournal(cache: Cache, key: string) {
  const read = async (sourceId: string): Promise<NativeInkPending | null> => {
    const raw = await cache.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw) as NativeInkPending;
    if (item.version !== 1 || typeof item.sourceId !== "string" || !Number.isSafeInteger(item.revision) || item.revision < 0) throw new Error("Your drawing recovery could not be read. It remains on this device.");
    const payload = drawingPayload(item.payload);
    if (payload.inkFormat !== "pencilkit-v1") throw new Error("This drawing recovery uses a different format.");
    if (item.saved && (!isNotebookDrawingId(item.saved.drawingId) || !isNotebookDrawingSize(item.saved.width, item.saved.height) || item.saved.inkFormat !== "pencilkit-v1" || item.saved.width !== payload.width || item.saved.height !== payload.height || item.saved.previewFormat !== payload.previewFormat)) throw new Error("Your drawing recovery reference is invalid. It remains on this device.");
    if (item.sourceId !== sourceId && item.saved?.drawingId !== sourceId) throw new Error("This drawing changed on another device. Your local ink is retained.");
    return { ...item, payload };
  };
  return {
    read: (sourceId: string) => serial(key, () => read(sourceId)),
    stage(sourceId: string, revision: number, value: NotebookDrawingPayload) {
      const payload = drawingPayload(value);
      if (payload.inkFormat !== "pencilkit-v1" || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Save this area using its native drawing tools.");
      return serial(key, async () => {
        const previous = await read(sourceId);
        const identical = previous?.payload.inkBase64 === payload.inkBase64 && previous.payload.width === payload.width && previous.payload.height === payload.height && previous.payload.previewFormat === payload.previewFormat;
        const item: NativeInkPending = { version: 1, sourceId: previous?.sourceId ?? sourceId, revision, payload, ...(identical && previous?.saved ? { saved: previous.saved } : {}) };
        await cache.setItem(key, JSON.stringify(item));
        return item;
      });
    },
    uploaded(item: NativeInkPending, saved: NotebookDrawingReference) {
      return serial(key, async () => {
        const current = await read(item.sourceId);
        if (!sameSnapshot(current, item)) throw new Error("Newer handwriting is retained on this device. Tap Done again to sync it.");
        await cache.setItem(key, JSON.stringify({ ...item, saved }));
      });
    },
    clear(expected: NativeInkPending) {
      return serial(key, async () => {
        const current = await read(expected.sourceId);
        if (sameSnapshot(current, expected) && current?.saved?.drawingId === expected.saved?.drawingId) await cache.removeItem(key);
      });
    },
  };
}
