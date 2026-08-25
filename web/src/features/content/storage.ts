import type { CommunityPost, ContentKind, ContentRecord } from "./types";

const DB_NAME = "kakehashi-content-v1";
const ASSET_STORE = "assets";
const PREFIX = "kakehashi:content:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocal<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(`${PREFIX}:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not provide IndexedDB storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE);
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
  const database = await openDatabase();
  const value = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(ASSET_STORE, "readonly").objectStore(ASSET_STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read this file."));
  });
  database.close();
  return value ?? null;
}

export async function removeAsset(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, "readwrite");
    transaction.objectStore(ASSET_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove this file."));
  });
  database.close();
}

export function contentKey(kind: ContentKind) {
  return `library:${kind}`;
}

export function loadLibrary(kind: ContentKind): ContentRecord[] {
  return readLocal<ContentRecord[]>(contentKey(kind), []).filter((record) => record.kind === kind && typeof record.id === "string");
}

export function saveLibrary(kind: ContentKind, records: ContentRecord[]) {
  return writeLocal(contentKey(kind), records);
}

export function upsertRecord(record: ContentRecord) {
  const records = loadLibrary(record.kind);
  const next = [record, ...records.filter((item) => item.id !== record.id)];
  if (!saveLibrary(record.kind, next)) throw new Error("Browser storage is full or unavailable.");
  return next;
}

export async function deleteRecord(record: ContentRecord) {
  const next = loadLibrary(record.kind).filter((item) => item.id !== record.id);
  if (!saveLibrary(record.kind, next)) throw new Error("Browser storage did not accept the library update.");
  await Promise.all(record.assetIds.map((assetId) => removeAsset(assetId).catch(() => undefined)));
}

export const communityStorage = {
  load: () => readLocal<CommunityPost[]>("community", []),
  save: (posts: CommunityPost[]) => writeLocal("community", posts),
};

export function createLocalId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}
