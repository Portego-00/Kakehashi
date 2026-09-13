import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  loadFileHandle: vi.fn(),
}));

vi.mock("../storage", () => storageMocks);

import {
  linkedFileIds,
  linkedMetadata,
  openLinkedFilePicker,
  requestLinkedFilePermission,
  requestPersistentLocalStorage,
  resolveLinkedFile,
  supportsLinkedLocalFiles,
} from "../local-file-source";

function mockHandle(file: File, permission: PermissionState = "granted") {
  return {
    kind: "file",
    name: file.name,
    getFile: vi.fn(async () => file),
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
  } as unknown as FileSystemFileHandle & {
    getFile: ReturnType<typeof vi.fn>;
    queryPermission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
  };
}

describe("linked local files", () => {
  beforeEach(() => {
    storageMocks.loadFileHandle.mockReset();
    vi.stubGlobal("indexedDB", {});
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reports unsupported browsers without opening a picker", async () => {
    expect(supportsLinkedLocalFiles()).toBe(false);
    expect(await openLinkedFilePicker()).toBeNull();

    vi.stubGlobal("showOpenFilePicker", vi.fn());
    vi.stubGlobal("indexedDB", undefined);
    expect(supportsLinkedLocalFiles()).toBe(false);
    expect(await openLinkedFilePicker()).toBeNull();
  });

  it("returns an empty selection when the user cancels", async () => {
    const picker = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("showOpenFilePicker", picker);

    expect(await openLinkedFilePicker({ multiple: true })).toEqual([]);
  });

  it("does not treat a failure reading a selected file as picker cancellation", async () => {
    const handle = mockHandle(new File([], "busy.cbz"));
    const readError = new DOMException("Read interrupted", "AbortError");
    handle.getFile.mockRejectedValue(readError);
    vi.stubGlobal("showOpenFilePicker", vi.fn().mockResolvedValue([handle]));

    await expect(openLinkedFilePicker()).rejects.toBe(readError);
  });

  it("returns files with their aligned handles and passes native accept options", async () => {
    const firstFile = new File(["one"], "one.cbz", { type: "application/vnd.comicbook+zip" });
    const secondFile = new File(["two"], "two.pdf", { type: "application/pdf" });
    const firstHandle = mockHandle(firstFile);
    const secondHandle = mockHandle(secondFile);
    const picker = vi.fn().mockResolvedValue([firstHandle, secondHandle]);
    vi.stubGlobal("showOpenFilePicker", picker);

    await expect(openLinkedFilePicker({
      multiple: true,
      description: "Manga files",
      accept: {
        "application/pdf": [".pdf"],
        "application/vnd.comicbook+zip": [".cbz"],
      },
    })).resolves.toEqual([
      { file: firstFile, handle: firstHandle },
      { file: secondFile, handle: secondHandle },
    ]);
    expect(picker).toHaveBeenCalledWith({
      multiple: true,
      types: [{
        description: "Manga files",
        accept: {
          "application/pdf": [".pdf"],
          "application/vnd.comicbook+zip": [".cbz"],
        },
      }],
    });
  });

  it("distinguishes permission prompts and requests access only when asked", async () => {
    const file = new File(["page"], "page.png", { type: "image/png" });
    const handle = mockHandle(file, "prompt");
    handle.requestPermission.mockResolvedValue("granted");
    storageMocks.loadFileHandle.mockResolvedValue(handle);

    await expect(resolveLinkedFile("page-1")).resolves.toEqual({ status: "permission", handle });
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(handle.getFile).not.toHaveBeenCalled();

    await expect(resolveLinkedFile("page-1", { requestPermission: true })).resolves.toEqual({ status: "ready", file, handle });
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(handle.getFile).toHaveBeenCalledTimes(1);
  });

  it("keeps denied handles as permission-required", async () => {
    const handle = mockHandle(new File(["video"], "video.mp4"), "denied");
    storageMocks.loadFileHandle.mockResolvedValue(handle);

    await expect(resolveLinkedFile("video-1", { requestPermission: true })).resolves.toEqual({ status: "permission", handle });
    expect(handle.getFile).not.toHaveBeenCalled();
  });

  it("starts a cached-handle permission request synchronously", async () => {
    const handle = mockHandle(new File(["page"], "page.png"), "prompt");
    let resolvePermission!: (value: PermissionState) => void;
    handle.requestPermission.mockImplementation(() => new Promise((resolve) => {
      resolvePermission = resolve;
    }));

    const request = requestLinkedFilePermission(handle);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(storageMocks.loadFileHandle).not.toHaveBeenCalled();
    resolvePermission("granted");
    await expect(request).resolves.toEqual({ status: "granted" });
  });

  it("reports absent handles and deleted linked files as missing", async () => {
    storageMocks.loadFileHandle.mockResolvedValueOnce(null);
    await expect(resolveLinkedFile("not-stored")).resolves.toEqual({ status: "missing" });

    const handle = mockHandle(new File([], "deleted.cbz"));
    handle.getFile.mockRejectedValue(new DOMException("File was removed", "NotFoundError"));
    storageMocks.loadFileHandle.mockResolvedValueOnce(handle);
    await expect(resolveLinkedFile("deleted")).resolves.toEqual({ status: "missing" });
  });

  it("reports transient storage and file failures as unavailable", async () => {
    const storageError = new Error("IndexedDB is temporarily unavailable");
    storageMocks.loadFileHandle.mockRejectedValueOnce(storageError);
    await expect(resolveLinkedFile("stored")).resolves.toEqual({ status: "unavailable", error: storageError });

    const fileError = new DOMException("Device is busy", "UnknownError");
    const handle = mockHandle(new File([], "busy.cbz"));
    handle.getFile.mockRejectedValue(fileError);
    storageMocks.loadFileHandle.mockResolvedValueOnce(handle);
    await expect(resolveLinkedFile("busy")).resolves.toMatchObject({
      status: "unavailable",
      error: { name: "UnknownError", message: "Device is busy" },
    });
  });

  it("round-trips valid metadata while ignoring malformed values", () => {
    expect(linkedMetadata(["page-1", "page-2", "page-1", ""])).toEqual({
      linkedFileIds: JSON.stringify(["page-1", "page-2"]),
    });
    expect(linkedFileIds({ metadata: linkedMetadata(["page-1", "page-2"]) })).toEqual(["page-1", "page-2"]);
    expect(linkedFileIds({ metadata: { linkedFileIds: "not json" } })).toEqual([]);
    expect(linkedFileIds({ metadata: { linkedFileIds: JSON.stringify(["page-1", 2, "page-1", null]) } })).toEqual(["page-1"]);
    expect(linkedFileIds({ metadata: { linkedFileIds: JSON.stringify({ id: "page-1" }) } })).toEqual([]);
  });

  it("requests persistent storage when it is not already granted", async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal("navigator", { storage });

    await expect(requestPersistentLocalStorage()).resolves.toBe(true);
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });
});
