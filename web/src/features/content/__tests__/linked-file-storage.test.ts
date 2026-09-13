import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureContentScope,
  deleteRecord,
  loadAsset,
  loadFileHandle,
  loadLibrary,
  removeFileHandle,
  saveFileHandle,
  saveLibrary,
} from "../storage";
import type { ContentRecord } from "../types";
import { setDemoMode } from "@/features/demo/runtime";
import { DEMO_MANGA_ID } from "@/features/demo/media-assets";

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
  afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });

  it("loads a bundled demo page into a separate database and leaves personal asset reads alone", async () => {
    const { open } = installIndexedDbMock();
    const sample = new Blob(["demo-page"], { type: "image/jpeg" });
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => sample }));
    vi.stubGlobal("fetch", fetchMock);
    const assetId = `${DEMO_MANGA_ID}-page-1`;
    await expect(loadAsset(assetId)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    setDemoMode(true);
    await expect(loadAsset(assetId)).resolves.toBe(sample);
    expect(fetchMock).toHaveBeenCalledWith("/demo/frieren/page-01.jpg");
    expect(open).toHaveBeenLastCalledWith("kakehashi-content-v1-demo", 2);
    await expect(loadAsset(assetId)).resolves.toBe(sample);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not save an in-flight demo download after the demo session ends", async () => {
    const { open, stores } = installIndexedDbMock();
    const sample = new Blob(["demo-page"]);
    vi.stubGlobal("fetch", vi.fn(async () => {
      setDemoMode(false);
      return { ok: true, blob: async () => sample };
    }));
    setDemoMode(true);
    await expect(loadAsset(`${DEMO_MANGA_ID}-page-1`)).resolves.toBe(sample);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("kakehashi-content-v1-demo", 2);
    expect(stores.get("assets")?.size).toBe(0);
  });

  it("rejects stale import writes, including after leaving and re-entering demo, and cleans only the origin database", async () => {
    const { open } = installIndexedDbMock();
    setDemoMode(true);
    const scope = captureContentScope();
    await scope.saveAsset("partial-import", new Blob(["page"]));
    setDemoMode(false);
    expect(() => scope.saveLibrary("manga", [])).toThrow("session changed");
    await scope.removeAsset("partial-import");
    expect(open).toHaveBeenLastCalledWith("kakehashi-content-v1-demo", 2);
    setDemoMode(true);
    expect(() => scope.saveAsset("next-page", new Blob(["page"]))).toThrow("session changed");
  });

  it("commits an already-requested demo deletion in its original library after switching accounts", async () => {
    installIndexedDbMock();
    const record: ContentRecord = { id: "same-id", kind: "manga", title: "Personal manga", assetIds: [], createdAt: "2026-01-01", updatedAt: "2026-01-01", progress: 0.8 };
    saveLibrary("manga", [record]);
    setDemoMode(true);
    const scope = captureContentScope();
    scope.saveLibrary("manga", [{ ...record, title: "Demo manga" }]);
    scope.saveMangaOcrPage(record.id, 1, "日本語");
    setDemoMode(false);
    await scope.deleteRecord(record);
    expect(loadLibrary("manga")).toEqual([record]);
    expect(scope.loadLibrary("manga")).toEqual([]);
    expect(window.localStorage.getItem(`kakehashi:content:v1:demo:manga-ocr:${record.id}`)).toBeNull();
  });

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
