import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteRecord,
  loadAsset,
  loadFileHandle,
  loadLibrary,
  removeFileHandle,
  saveFileHandle,
  saveLibrary,
} from "../storage";
import type { ContentRecord } from "../types";

type EventHandler = ((event: Event) => void) | null;

interface RequestMock {
  result: unknown;
  error: DOMException | null;
  onsuccess: EventHandler;
  onerror: EventHandler;
}

interface TransactionMock {
  error: DOMException | null;
  oncomplete: EventHandler;
  onerror: EventHandler;
  onabort: EventHandler;
  objectStore(name: string): IDBObjectStore;
}

function installIndexedDbMock() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>([
    ["assets", new Map()],
  ]);

  function transactionFor(storeName: string) {
    const values = stores.get(storeName);
    if (!values) throw new DOMException(`Missing store: ${storeName}`, "NotFoundError");
    const transaction: TransactionMock = {
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: () => ({
        put: (value: unknown, key: IDBValidKey) => {
          values.set(key, value);
          queueMicrotask(() => transaction.oncomplete?.(new Event("complete")));
          return {} as IDBRequest;
        },
        get: (key: IDBValidKey) => {
          const request: RequestMock = { result: undefined, error: null, onsuccess: null, onerror: null };
          queueMicrotask(() => {
            request.result = values.get(key);
            request.onsuccess?.(new Event("success"));
          });
          return request as unknown as IDBRequest;
        },
        delete: (key: IDBValidKey) => {
          values.delete(key);
          queueMicrotask(() => transaction.oncomplete?.(new Event("complete")));
          return {} as IDBRequest;
        },
      }) as IDBObjectStore,
    };
    return transaction as unknown as IDBTransaction;
  }

  const open = vi.fn((name: string, version?: number) => {
    const database = {
      name,
      version: version ?? 1,
      objectStoreNames: { contains: (name: string) => stores.has(name) },
      createObjectStore: (name: string) => {
        stores.set(name, new Map());
        return {} as IDBObjectStore;
      },
      transaction: (storeName: string) => transactionFor(storeName),
      close: vi.fn(),
    } as unknown as IDBDatabase;
    const request = {
      result: database,
      error: null,
      onupgradeneeded: null as EventHandler,
      onsuccess: null as EventHandler,
      onerror: null as EventHandler,
    };
    queueMicrotask(() => {
      request.onupgradeneeded?.(new Event("upgradeneeded"));
      request.onsuccess?.(new Event("success"));
    });
    return request as unknown as IDBOpenDBRequest;
  });
  vi.stubGlobal("indexedDB", { open } as unknown as IDBFactory);
  return { open, stores };
}

function fileHandle(name: string) {
  return {
    kind: "file",
    name,
    getFile: vi.fn(async () => new File([], name)),
  } as unknown as FileSystemFileHandle;
}

describe("linked file handle storage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("upgrades the database without replacing existing assets", async () => {
    const { open, stores } = installIndexedDbMock();
    const existingAsset = new Blob(["existing"]);
    stores.get("assets")?.set("asset-1", existingAsset);
    const handle = fileHandle("manga.cbz");

    await saveFileHandle("linked-1", handle);

    expect(open).toHaveBeenCalledWith("kakehashi-content-v1", 2);
    await expect(loadAsset("asset-1")).resolves.toBe(existingAsset);
    await expect(loadFileHandle("linked-1")).resolves.toBe(handle);

    await removeFileHandle("linked-1");
    await expect(loadFileHandle("linked-1")).resolves.toBeNull();
  });

  it("removes every linked handle when deleting its library record", async () => {
    installIndexedDbMock();
    const firstHandle = fileHandle("page-1.png");
    const secondHandle = fileHandle("page-2.png");
    await saveFileHandle("linked-1", firstHandle);
    await saveFileHandle("linked-2", secondHandle);
    const record: ContentRecord = {
      id: "manga-1",
      kind: "manga",
      title: "Linked manga",
      assetIds: [],
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
      progress: 0,
      metadata: { linkedFileIds: JSON.stringify(["linked-1", "linked-2", "linked-1"]) },
    };
    saveLibrary("manga", [record]);

    await deleteRecord(record);

    expect(loadLibrary("manga")).toEqual([]);
    await expect(loadFileHandle("linked-1")).resolves.toBeNull();
    await expect(loadFileHandle("linked-2")).resolves.toBeNull();
  });
});
