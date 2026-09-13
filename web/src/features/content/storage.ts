import type { CommunityPost, ContentKind, ContentRecord } from "./types";
import { getDemoModeEpoch, isDemoMode } from "@/features/demo/runtime";
import { DEMO_ASSET_URLS } from "@/features/demo/media-assets";

const DB_NAME = "kakehashi-content-v1";
const DB_VERSION = 2;
const ASSET_STORE = "assets";
const FILE_HANDLE_STORE = "file-handles";
const PREFIX = "kakehashi:content:v1";

function storagePrefix(demo = isDemoMode()) {
  return demo ? `${PREFIX}:demo` : PREFIX;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocal<T>(key: string, fallback: T, demo = isDemoMode()): T {
  if (!canUseStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(`${storagePrefix(demo)}:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown, demo = isDemoMode()) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(`${storagePrefix(demo)}:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key: string, demo = isDemoMode()) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(`${storagePrefix(demo)}:${key}`);
}

function openDatabase(demo = isDemoMode()): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not provide IndexedDB storage."));
      return;
    }
    const request = indexedDB.open(demo ? `${DB_NAME}-demo` : DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE);
      if (!database.objectStoreNames.contains(FILE_HANDLE_STORE)) database.createObjectStore(FILE_HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local library."));
  });
}

export async function saveAsset(id: string, value: Blob) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, "readwrite");
    transaction.objectStore(ASSET_STORE).put(value, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save this file."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The file save was cancelled."));
  });
  database.close();
}

export async function loadAsset(id: string): Promise<Blob | null> {
  const demo = isDemoMode();
  const database = await openDatabase();
  const value = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(ASSET_STORE, "readonly").objectStore(ASSET_STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read this file."));
  });
  database.close();
  if (value) return value;
  const demoUrl = demo ? DEMO_ASSET_URLS[id] : undefined;
  if (!demoUrl) return null;
  const response = await fetch(demoUrl);
  if (!response.ok) throw new Error("The demo sample could not be loaded. Please try again.");
  const sample = await response.blob();
  // A user may leave the demo while this download is in flight.
  if (isDemoMode()) await saveAsset(id, sample).catch(() => undefined);
  return sample;
}

export async function removeAsset(id: string, demo = isDemoMode()) {
  const database = await openDatabase(demo);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, "readwrite");
    transaction.objectStore(ASSET_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove this file."));
  });
  database.close();
}

export async function saveFileHandle(id: string, handle: FileSystemFileHandle) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FILE_HANDLE_STORE, "readwrite");
      transaction.objectStore(FILE_HANDLE_STORE).put(handle, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save this file link."));
      transaction.onabort = () => reject(transaction.error ?? new Error("The file link save was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadFileHandle(id: string): Promise<FileSystemFileHandle | null> {
  const database = await openDatabase();
  try {
    const value = await new Promise<FileSystemFileHandle | undefined>((resolve, reject) => {
      const request = database.transaction(FILE_HANDLE_STORE, "readonly").objectStore(FILE_HANDLE_STORE).get(id);
      request.onsuccess = () => resolve(request.result as FileSystemFileHandle | undefined);
      request.onerror = () => reject(request.error ?? new Error("Could not read this file link."));
    });
    return value ?? null;
  } finally {
    database.close();
  }
}

export async function removeFileHandle(id: string, demo = isDemoMode()) {
  const database = await openDatabase(demo);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FILE_HANDLE_STORE, "readwrite");
      transaction.objectStore(FILE_HANDLE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove this file link."));
    });
  } finally {
    database.close();
  }
}

export function contentKey(kind: ContentKind) {
  return `library:${kind}`;
}

export function loadLibrary(kind: ContentKind, demo = isDemoMode()): ContentRecord[] {
  return readLocal<ContentRecord[]>(contentKey(kind), [], demo).filter((record) => record.kind === kind && typeof record.id === "string");
}

export function saveLibrary(kind: ContentKind, records: ContentRecord[], demo = isDemoMode()) {
  return writeLocal(contentKey(kind), records, demo);
}

export function upsertRecord(record: ContentRecord) {
  const records = loadLibrary(record.kind);
  const next = [record, ...records.filter((item) => item.id !== record.id)];
  if (!saveLibrary(record.kind, next)) throw new Error("Browser storage is full or unavailable.");
  return next;
}

export function updateRecordInPlace(record: ContentRecord) {
  const records = loadLibrary(record.kind);
  const index = records.findIndex((item) => item.id === record.id);
  if (index < 0) throw new Error("This item is no longer in the library.");
  const next = [...records];
  next[index] = record;
  if (!saveLibrary(record.kind, next)) throw new Error("Browser storage is full or unavailable.");
  return next;
}

export function reorderLibrary(kind: ContentKind, orderedIds: readonly string[]) {
  const records = loadLibrary(kind);
  if (records.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("The library changed before its new order could be saved.");
  }
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const orderedRecords: ContentRecord[] = [];
  for (const id of orderedIds) {
    const record = recordsById.get(id);
    if (!record) throw new Error("The library changed before its new order could be saved.");
    orderedRecords.push(record);
  }
  if (!saveLibrary(kind, orderedRecords)) throw new Error("Browser storage is full or unavailable.");
  return orderedRecords;
}

export async function deleteRecord(record: ContentRecord, demo = isDemoMode()) {
  const next = loadLibrary(record.kind, demo).filter((item) => item.id !== record.id);
  if (!saveLibrary(record.kind, next, demo)) throw new Error("Browser storage did not accept the library update.");
  const serializedLinkedFileIds = record.metadata?.linkedFileIds;
  let linkedFileIds: string[] = [];
  if (typeof serializedLinkedFileIds === "string") {
    try {
      const parsed = JSON.parse(serializedLinkedFileIds) as unknown;
      if (Array.isArray(parsed)) linkedFileIds = [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
    } catch {
      // Malformed metadata must not prevent the rest of the record from being deleted.
    }
  }
  await Promise.all([
    ...record.assetIds.map((assetId) => removeAsset(assetId, demo).catch(() => undefined)),
    ...linkedFileIds.map((fileId) => removeFileHandle(fileId, demo).catch(() => undefined)),
  ]);
  if (record.kind === "manga") removeLocal(`manga-ocr:${record.id}`, demo);
}

/** Bind an async import to its originating session; cleanup always uses its original database. */
export function captureContentScope() {
  const demo = isDemoMode();
  const epoch = getDemoModeEpoch();
  const assertCurrent = () => {
    if (epoch !== getDemoModeEpoch()) throw new Error("The session changed. Please import this file again in the current workspace.");
  };
  return {
    assertCurrent,
    isCurrent: () => epoch === getDemoModeEpoch(),
    loadLibrary: (kind: ContentKind) => loadLibrary(kind, demo),
    saveLibrary: (kind: ContentKind, records: ContentRecord[]) => { assertCurrent(); return saveLibrary(kind, records, demo); },
    upsertRecord: (record: ContentRecord) => { assertCurrent(); return upsertRecord(record); },
    updateRecordInPlace: (record: ContentRecord) => { assertCurrent(); return updateRecordInPlace(record); },
    saveAsset: (id: string, value: Blob) => { assertCurrent(); return saveAsset(id, value); },
    saveFileHandle: (id: string, handle: FileSystemFileHandle) => { assertCurrent(); return saveFileHandle(id, handle); },
    saveMangaOcrPage: (id: string, page: number, text: string) => { assertCurrent(); return saveMangaOcrPage(id, page, text); },
    // Cleanup is allowed after a session switch, but can only touch the original scope.
    removeAsset: (id: string) => removeAsset(id, demo),
    removeFileHandle: (id: string) => removeFileHandle(id, demo),
    removeLocal: (key: string) => removeLocal(key, demo),
    deleteRecord: (record: ContentRecord) => deleteRecord(record, demo),
  };
}

export interface MangaOcrPageCache {
  text: string;
  updatedAt: string;
}

type MangaOcrCache = Record<string, MangaOcrPageCache>;

export function loadMangaOcrPage(mangaId: string, pageNumber: number): MangaOcrPageCache | null {
  const cache = readLocal<MangaOcrCache>(`manga-ocr:${mangaId}`, {});
  const value = cache[String(Math.max(1, Math.floor(pageNumber || 1)))];
  return value && typeof value.text === "string" ? value : null;
}

export function saveMangaOcrPage(mangaId: string, pageNumber: number, text: string) {
  const key = `manga-ocr:${mangaId}`;
  const cache = readLocal<MangaOcrCache>(key, {});
  const pageKey = String(Math.max(1, Math.floor(pageNumber || 1)));
  const normalizedText = text.trim();
  const next = { ...cache };
  if (normalizedText) next[pageKey] = { text: normalizedText, updatedAt: new Date().toISOString() };
  else delete next[pageKey];
  if (!writeLocal(key, next)) throw new Error("The OCR text could not be saved in browser storage.");
  return next[pageKey] ?? null;
}

export const communityStorage = {
  load: () => readLocal<CommunityPost[]>("community", []),
  save: (posts: CommunityPost[]) => writeLocal("community", posts),
};

export function createLocalId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}
