import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreparedMangaImport } from "./manga-import";
import type { ContentRecord } from "./types";

const fixtures = vi.hoisted(() => ({
  assets: new Map<string, Blob>(),
  handles: new Map<string, FileSystemFileHandle>(),
  decodeMangaImage: vi.fn(),
  downloadMangaOcrModel: vi.fn(),
  exitFullscreen: vi.fn(),
  fullscreenElement: null as Element | null,
  getMangaOcrModelStatus: vi.fn(),
  jpdbApiKey: "",
  prepareMangaImport: vi.fn(),
  recognizeMangaSelection: vi.fn(),
  requestFullscreen: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ integrations: { jpdbApiKey: fixtures.jpdbApiKey } }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "reader-test" } } }),
}));

vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text, appearance, ariaLabel, supplement }: { text: string; appearance?: string; ariaLabel?: string; supplement?: ReactNode }) => (
    <div data-testid="japanese-reader-shell"><div data-testid="japanese-reader" aria-label={ariaLabel} data-appearance={appearance}>{text}</div>{supplement}</div>
  ),
}));

vi.mock("./MangaPageSelector", () => ({
  MangaPageSelector: ({ alt, disabled, onSelectionComplete, tooltip }: {
    alt: string;
    disabled?: boolean;
    onSelectionComplete: (selection: { x: number; y: number; width: number; height: number }) => void;
    tooltip?: { busy?: boolean; content: ReactNode; onDismiss?: () => void; tone?: string } | null;
  }) => (
    <div>
      <button
        type="button"
        aria-label={`Select text on ${alt}`}
        disabled={disabled}
        onClick={() => onSelectionComplete({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })}
      >
        Select test text
      </button>
      {tooltip ? <div
        data-testid={`selection-tooltip-${alt}`}
        data-busy={tooltip.busy ? "true" : "false"}
        data-tone={tooltip.tone ?? "default"}
      >
        {tooltip.onDismiss ? <button type="button" aria-label="Close OCR result" onClick={tooltip.onDismiss}>Close</button> : null}
        {tooltip.content}
      </div> : null}
    </div>
  ),
}));

vi.mock("./manga-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manga-import")>();
  return { ...actual, prepareMangaImport: fixtures.prepareMangaImport };
});

vi.mock("./manga-ocr-assets", () => ({
  downloadMangaOcrModel: fixtures.downloadMangaOcrModel,
  getMangaOcrModelStatus: fixtures.getMangaOcrModelStatus,
  MANGA_OCR_MODEL_TOTAL_BYTES: 121_486_877,
}));

vi.mock("./manga-ocr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manga-ocr")>();
  return { ...actual, recognizeMangaSelection: fixtures.recognizeMangaSelection };
});

vi.mock("./manga-pdf", () => ({
  openMangaPdf: vi.fn(),
}));

vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    saveAsset: vi.fn(async (id: string, value: Blob) => { fixtures.assets.set(id, value); }),
    loadAsset: vi.fn(async (id: string) => fixtures.assets.get(id) ?? null),
    removeAsset: vi.fn(async (id: string) => { fixtures.assets.delete(id); }),
    saveFileHandle: vi.fn(async (id: string, handle: FileSystemFileHandle) => { fixtures.handles.set(id, handle); }),
    loadFileHandle: vi.fn(async (id: string) => fixtures.handles.get(id) ?? null),
    removeFileHandle: vi.fn(async (id: string) => { fixtures.handles.delete(id); }),
  };
});

import { MangaLibrary, MangaReader } from "./manga";
import {
  loadAsset,
  loadFileHandle,
  loadLibrary,
  loadMangaOcrPage,
  removeAsset,
  removeFileHandle,
  saveAsset,
  saveFileHandle,
  saveLibrary,
  saveMangaOcrPage,
} from "./storage";

function mangaRecord(overrides: Partial<ContentRecord> = {}): ContentRecord {
  return {
    id: "manga-reader-test",
    kind: "manga",
    title: "よつばと！",
    fileName: "よつばと！.cbz",
    mimeType: "image/*",
    assetIds: ["page-1", "page-2", "page-3"],
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    progress: 0,
    currentPage: 1,
    totalPages: 3,
    metadata: {
      sourceType: "cbz",
      isPdf: false,
      readingDirection: "rtl",
      pagePlacements: JSON.stringify([null, null, null]),
    },
    ...overrides,
  };
}

function linkedFileHandle(file: File, initialPermission: PermissionState = "granted") {
  let permission = initialPermission;
  const grantPermission = () => {
    permission = "granted";
  };
  const queryPermission = vi.fn(async () => permission);
  const requestPermission = vi.fn(async () => {
    grantPermission();
    return permission;
  });
  const getFile = vi.fn(async () => file);
  const handle = {
    kind: "file",
    name: file.name,
    getFile,
    queryPermission,
    requestPermission,
  } as unknown as FileSystemFileHandle;
  return { getFile, grantPermission, handle, queryPermission, requestPermission };
}

function seedReader(record = mangaRecord()) {
  saveLibrary("manga", [record]);
  record.assetIds.forEach((assetId, index) => {
    fixtures.assets.set(assetId, new Blob([`page ${index + 1}`], { type: "image/jpeg" }));
  });
  return record;
}

function seedMangaShelf(titles = ["Manga A", "Manga B", "Manga C"]) {
  const records = titles.map((title, index) => mangaRecord({
    id: `manga-${index + 1}`,
    title,
    fileName: `${title}.cbz`,
    assetIds: [],
    totalPages: 1,
  }));
  saveLibrary("manga", records);
  return records;
}

function mangaShelfOrder() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

function mangaShelfItem(title: string) {
  return screen.getByRole("heading", { level: 2, name: title }).closest("li")!;
}

async function waitForMangaLibraryReady() {
  await waitFor(() => expect(screen.queryByText("Checking OCR model…")).not.toBeInTheDocument());
}

describe("manga library and reader", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    fixtures.assets.clear();
    fixtures.handles.clear();
    fixtures.jpdbApiKey = "";
    vi.clearAllMocks();
    fixtures.decodeMangaImage.mockResolvedValue(undefined);
    vi.mocked(loadAsset).mockImplementation(async (assetId: string) => fixtures.assets.get(assetId) ?? null);
    vi.mocked(saveAsset).mockImplementation(async (assetId: string, asset: Blob) => { fixtures.assets.set(assetId, asset); });
    vi.mocked(removeAsset).mockImplementation(async (assetId: string) => { fixtures.assets.delete(assetId); });
    vi.mocked(loadFileHandle).mockImplementation(async (handleId: string) => fixtures.handles.get(handleId) ?? null);
    vi.mocked(saveFileHandle).mockImplementation(async (handleId: string, handle: FileSystemFileHandle) => { fixtures.handles.set(handleId, handle); });
    vi.mocked(removeFileHandle).mockImplementation(async (handleId: string) => { fixtures.handles.delete(handleId); });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:https://kakehashi.local/manga-page"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "Image", {
      configurable: true,
      value: class MockMangaImage {
        decoding = "auto";
        loading = "auto";
        src = "";

        decode() {
          return fixtures.decodeMangaImage();
        }
      },
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(min-width: 56rem)" || query === "(pointer: fine)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 1800, close: vi.fn() })));
    fixtures.fullscreenElement = null;
    fixtures.getMangaOcrModelStatus.mockResolvedValue({
      downloadedBytes: 121_486_877,
      ready: true,
      totalBytes: 121_486_877,
    });
    fixtures.downloadMangaOcrModel.mockResolvedValue(undefined);
    fixtures.recognizeMangaSelection.mockImplementation(async (_blob, _selection, options) => {
      options?.onProgress?.({ stage: "preparing-model" });
      options?.onProgress?.({ stage: "recognizing" });
      return "猫 です";
    });
    fixtures.requestFullscreen.mockImplementation(function (this: HTMLElement) {
      fixtures.fullscreenElement = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    fixtures.exitFullscreen.mockImplementation(() => {
      fixtures.fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fixtures.fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: fixtures.requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: fixtures.exitFullscreen,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("imports manga files dropped onto the library", async () => {
    const page = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Blue Period 01",
      fileName: "Blue Period 01.cbz",
      sourceType: "cbz",
      pageCount: 1,
      assets: [page],
      metadata: { readingDirection: "rtl", pagePlacements: [null] },
    });

    render(<MangaLibrary />);
    expect(screen.getByText("Import manga")).toBeInTheDocument();
    expect(screen.queryByText("Drop to import manga")).not.toBeInTheDocument();

    const archive = new File(["archive"], "Blue Period 01.cbz", { type: "application/vnd.comicbook+zip" });
    fireEvent.dragEnter(window, { dataTransfer: { files: [archive], types: ["Files"] } });
    expect(screen.getByText("Drop to import manga")).toBeInTheDocument();

    fireEvent.drop(window, { dataTransfer: { files: [archive], types: ["Files"] } });

    expect(await screen.findByRole("heading", { name: "Blue Period 01" })).toBeInTheDocument();
    expect(screen.queryByText("Drop to import manga")).not.toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenCalledWith([archive]);
  });

  it("links dropped manga to the original file instead of copying every page", async () => {
    const firstPage = new File(["first"], "page-0001.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second"], "page-0002.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Linked volume",
      fileName: "Linked volume.cbz",
      sourceType: "cbz",
      pageCount: 2,
      assets: [firstPage, secondPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null, null] },
    });
    const archive = new File(["archive"], "Linked volume.cbz", { type: "application/vnd.comicbook+zip" });
    const linked = linkedFileHandle(archive);

    render(<MangaLibrary />);
    fireEvent.drop(window, {
      dataTransfer: {
        files: [archive],
        items: [{ kind: "file", getAsFileSystemHandle: vi.fn(async () => linked.handle) }],
        types: ["Files"],
      },
    });

    expect(await screen.findByRole("heading", { name: "Linked volume" })).toBeInTheDocument();
    const record = loadLibrary("manga")[0];
    expect(record.assetIds).toEqual([]);
    expect(JSON.parse(String(record.metadata?.linkedFileIds))).toHaveLength(1);
    expect(saveFileHandle).toHaveBeenCalledTimes(1);
    expect(saveAsset).not.toHaveBeenCalled();
    expect(fixtures.handles.size).toBe(1);
  });

  it("announces when a dropped manga is still being prepared", async () => {
    const page = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    let finishSave: (() => void) | undefined;
    vi.mocked(saveAsset).mockImplementation(async (assetId: string, asset: Blob) => {
      fixtures.assets.set(assetId, asset);
      await new Promise<void>((resolve) => { finishSave = resolve; });
    });
    let finishImport: ((value: {
      title: string;
      fileName: string;
      sourceType: "cbz";
      pageCount: number;
      assets: File[];
      metadata: { readingDirection: "rtl"; pagePlacements: null[] };
    }) => void) | undefined;
    fixtures.prepareMangaImport.mockReturnValue(new Promise((resolve) => { finishImport = resolve; }));

    const { container } = render(<MangaLibrary />);
    const uploadButton = screen.getByRole("button", { name: "Import manga" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archive = new File(["archive"], "Pending.cbz", { type: "application/vnd.comicbook+zip" });
    fireEvent.drop(window, { dataTransfer: { files: [archive], types: ["Files"] } });

    expect(uploadButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Importing…")).not.toHaveAttribute("aria-live");
    expect(input).toBeDisabled();
    const progressLabel = screen.getByText("Importing manga…");
    const progressStatus = progressLabel.closest('[role="status"]');
    expect(progressStatus).toHaveAttribute("aria-live", "polite");
    expect(progressStatus).toHaveAttribute("aria-atomic", "true");
    expect(progressStatus).toHaveTextContent("Preparing “Pending.cbz” in this browser.");

    await act(async () => {
      finishImport?.({
        title: "Pending",
        fileName: "Pending.cbz",
        sourceType: "cbz",
        pageCount: 1,
        assets: [page],
        metadata: { readingDirection: "rtl", pagePlacements: [null] },
      });
    });

    expect(await screen.findByText("Saving 1 page for “Pending” in this browser.")).toBeInTheDocument();
    await act(async () => { finishSave?.(); });
    expect(await screen.findByRole("heading", { name: "Pending" })).toBeInTheDocument();
    expect(uploadButton).not.toHaveAttribute("aria-busy");
    expect(input).toBeEnabled();
    expect(screen.queryByText("Importing manga…")).not.toBeInTheDocument();
    expect(screen.getByText("Imported “Pending”.")).toBeInTheDocument();
  });

  it("imports a CBZ as locally stored pages with reader-ready record metadata", async () => {
    const firstPage = new File(["first"], "page-0001.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second"], "page-0002.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "ダンジョン飯 01",
      fileName: "ダンジョン飯 01.cbz",
      sourceType: "cbz",
      pageCount: 2,
      assets: [firstPage, secondPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null, "left"] },
    });

    const { container } = render(<MangaLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const archive = new File(["archive"], "ダンジョン飯 01.cbz", { type: "application/vnd.comicbook+zip" });
    fireEvent.change(input!, { target: { files: [archive] } });

    expect(await screen.findByRole("heading", { name: "ダンジョン飯 01" })).toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenCalledWith([archive]);
    expect(saveAsset).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveAsset).mock.calls.map(([, asset]) => asset)).toEqual([firstPage, secondPage]);

    const record = loadLibrary("manga")[0];
    expect(record).toMatchObject({
      kind: "manga",
      title: "ダンジョン飯 01",
      fileName: "ダンジョン飯 01.cbz",
      mimeType: "image/*",
      currentPage: 1,
      totalPages: 2,
      progress: 0,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null, "left"]),
      },
    });
    expect(record.assetIds).toEqual(vi.mocked(saveAsset).mock.calls.map(([assetId]) => assetId));
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute("href", `/manga/${record.id}`);
  });

  it("imports multiple manga containers as separate library entries", async () => {
    seedMangaShelf(["Manga C", "Manga A", "Manga B"]);
    let finishFirst: ((prepared: PreparedMangaImport) => void) | undefined;
    let finishSecond: ((prepared: PreparedMangaImport) => void) | undefined;
    fixtures.prepareMangaImport.mockImplementation((files: File[]) => new Promise<PreparedMangaImport>((resolve) => {
      const source = files[0];
      if (source.name === "Volume 01.cbz") finishFirst = resolve;
      else finishSecond = resolve;
    }));

    const { container } = render(<MangaLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const first = new File(["first"], "Volume 01.cbz", { type: "application/vnd.comicbook+zip" });
    const second = new File(["second"], "Volume 02.cbz", { type: "application/vnd.comicbook+zip" });

    expect(input.multiple).toBe(true);
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByText("Importing manga 1 of 2…")).toBeInTheDocument();
    expect(screen.getByText("Preparing “Volume 01.cbz” in this browser.")).toBeInTheDocument();
    await act(async () => {
      finishFirst?.({
        title: "Volume 01",
        fileName: first.name,
        sourceType: "cbz",
        pageCount: 1,
        assets: [new File([first.name], "page-0001.jpg", { type: "image/jpeg" })],
        metadata: { readingDirection: "rtl", pagePlacements: [null] },
      });
    });

    expect(await screen.findByText("Importing manga 2 of 2…")).toBeInTheDocument();
    expect(screen.getByText("Preparing “Volume 02.cbz” in this browser.")).toBeInTheDocument();
    await act(async () => {
      finishSecond?.({
        title: "Volume 02",
        fileName: second.name,
        sourceType: "cbz",
        pageCount: 1,
        assets: [new File([second.name], "page-0001.jpg", { type: "image/jpeg" })],
        metadata: { readingDirection: "rtl", pagePlacements: [null] },
      });
    });

    expect(await screen.findByRole("heading", { name: "Volume 01" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Volume 02" })).toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenNthCalledWith(1, [first]);
    expect(fixtures.prepareMangaImport).toHaveBeenNthCalledWith(2, [second]);
    expect(mangaShelfOrder()).toEqual(["Manga C", "Manga A", "Manga B", "Volume 01", "Volume 02"]);
    expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga C", "Manga A", "Manga B", "Volume 01", "Volume 02"]);
    expect(screen.getByText("Imported 2 manga.")).toBeInTheDocument();
    expect(screen.queryByText(/Importing manga \d/u)).not.toBeInTheDocument();
  });

  it("keeps the existing shelf unchanged when a later manga in the batch fails", async () => {
    seedMangaShelf(["Manga C", "Manga A", "Manga B"]);
    const savedPage = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockImplementation(async (files: File[]) => {
      if (files[0].name === "Broken.cbz") throw new Error("Broken.cbz could not be prepared.");
      return {
        title: "Volume 01",
        fileName: files[0].name,
        sourceType: "cbz",
        pageCount: 1,
        assets: [savedPage],
        metadata: { readingDirection: "rtl", pagePlacements: [null] },
      };
    });

    const { container } = render(<MangaLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const first = new File(["first"], "Volume 01.cbz", { type: "application/vnd.comicbook+zip" });
    const broken = new File(["broken"], "Broken.cbz", { type: "application/vnd.comicbook+zip" });
    fireEvent.change(input, { target: { files: [first, broken] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Broken.cbz could not be prepared. Nothing from this import was added.");
    expect(mangaShelfOrder()).toEqual(["Manga C", "Manga A", "Manga B"]);
    expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga C", "Manga A", "Manga B"]);
    expect(fixtures.assets.size).toBe(0);
    expect(removeAsset).toHaveBeenCalledTimes(1);
    expect(input).toBeEnabled();
    expect(screen.queryByText(/Importing manga \d/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Imported (?:\d+ manga|“)/u)).not.toBeInTheDocument();
  });

  it("keeps multiple loose image pages grouped as one manga", async () => {
    fixtures.prepareMangaImport.mockImplementation(async (files: File[]) => ({
      title: "Chapter 01",
      fileName: `${files.length} image pages`,
      sourceType: "images",
      pageCount: files.length,
      assets: files,
      metadata: { readingDirection: "rtl", pagePlacements: files.map(() => null) },
    }));

    const { container } = render(<MangaLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const first = new File(["first"], "chapter-01-page-01.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "chapter-01-page-02.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByRole("heading", { name: "Chapter 01" })).toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenCalledTimes(1);
    expect(fixtures.prepareMangaImport).toHaveBeenCalledWith([first, second]);
    expect(loadLibrary("manga")).toHaveLength(1);
    expect(loadLibrary("manga")[0].totalPages).toBe(2);
  });

  it("keeps MIME-recognized containers separate from loose image pages", async () => {
    const archive = new File(["archive"], "misnamed-cover.jpg", { type: "application/zip" });
    const first = new File(["first"], "chapter-page-01.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "chapter-page-02.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockImplementation(async (files: File[]) => {
      if (files[0] === archive) {
        return {
          title: "Archive volume",
          fileName: archive.name,
          sourceType: "cbz",
          pageCount: 1,
          assets: [new File(["page"], "page-0001.jpg", { type: "image/jpeg" })],
          metadata: { readingDirection: "rtl", pagePlacements: [null] },
        };
      }
      return {
        title: "Loose chapter",
        fileName: `${files.length} image pages`,
        sourceType: "images",
        pageCount: files.length,
        assets: files,
        metadata: { readingDirection: "rtl", pagePlacements: files.map(() => null) },
      };
    });

    const { container } = render(<MangaLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [archive, first, second] } });

    expect(await screen.findByRole("heading", { name: "Archive volume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loose chapter" })).toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenNthCalledWith(1, [archive]);
    expect(fixtures.prepareMangaImport).toHaveBeenNthCalledWith(2, [first, second]);
    expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Archive volume", "Loose chapter"]);
  });

  it("offers EPUB import and records extracted EPUB pages as manga", async () => {
    const page = new File(["page"], "page-0001.png", { type: "image/png" });
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "ルックバック",
      fileName: "ルックバック.epub",
      sourceType: "epub",
      pageCount: 1,
      assets: [page],
      metadata: { readingDirection: "ltr", pagePlacements: ["center"] },
    });

    const { container } = render(<MangaLibrary />);
    expect(screen.queryByText(/DRM-free image EPUBs/u)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add JPDB API key" })).toHaveAttribute("href", "/settings#jpdb-api-key");
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.accept).toContain(".epub");
    expect(input?.accept).toContain("application/epub+zip");

    const epub = new File(["epub"], "ルックバック.epub", { type: "application/epub+zip" });
    fireEvent.change(input!, { target: { files: [epub] } });

    expect(await screen.findByRole("heading", { name: "ルックバック" })).toBeInTheDocument();
    expect(loadLibrary("manga")[0]).toMatchObject({
      fileName: "ルックバック.epub",
      mimeType: "image/*",
      totalPages: 1,
      metadata: {
        sourceType: "epub",
        isPdf: false,
        readingDirection: "ltr",
        pagePlacements: JSON.stringify(["center"]),
      },
    });
  });

  it("shows stored manga as cover thumbnails and persists inline title edits", async () => {
    seedReader();

    render(<MangaLibrary />);

    const cover = await screen.findByRole("img", { name: "Cover of よつばと！" });
    expect(cover).toHaveAttribute("src", "blob:https://kakehashi.local/manga-page");
    expect(cover).toHaveAttribute("draggable", "false");

    fireEvent.click(screen.getByRole("button", { name: "Edit title for よつばと！" }));
    const titleInput = screen.getByRole("textbox", { name: "Manga title" });
    expect(titleInput).toHaveValue("よつばと！");

    fireEvent.change(titleInput, { target: { value: "よつばと！ 第1巻" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));

    expect(await screen.findByRole("heading", { name: "よつばと！ 第1巻" })).toBeInTheDocument();
    expect(loadLibrary("manga")[0]).toMatchObject({
      id: "manga-reader-test",
      title: "よつばと！ 第1巻",
      fileName: "よつばと！.cbz",
    });
    expect(screen.getByRole("img", { name: "Cover of よつばと！ 第1巻" })).toBe(cover);
  });

  it("removes manga records whose locally stored files no longer exist", async () => {
    const available = mangaRecord({
      id: "available-manga",
      title: "Available manga",
      assetIds: ["available-page"],
      totalPages: 1,
    });
    const missing = mangaRecord({
      id: "missing-manga",
      title: "Missing manga",
      assetIds: ["missing-page"],
      totalPages: 1,
    });
    const later = mangaRecord({
      id: "later-manga",
      title: "Later manga",
      assetIds: ["later-page"],
      totalPages: 1,
    });
    saveLibrary("manga", [available, missing, later]);
    fixtures.assets.set("available-page", new Blob(["available"], { type: "image/jpeg" }));
    fixtures.assets.set("later-page", new Blob(["later"], { type: "image/jpeg" }));

    render(<MangaLibrary />);
    expect(screen.getByRole("heading", { name: "Available manga" })).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Missing manga" })).not.toBeInTheDocument());
    expect(loadLibrary("manga").map((record) => record.id)).toEqual(["available-manga", "later-manga"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Removed manga whose local files were no longer available.");
  });

  it("keeps manga metadata when local asset storage cannot be read", async () => {
    const record = mangaRecord({
      id: "unreadable-manga",
      title: "Unreadable manga",
      assetIds: ["unreadable-page"],
      totalPages: 1,
    });
    saveLibrary("manga", [record]);
    vi.mocked(loadAsset).mockRejectedValue(new DOMException("Storage unavailable", "UnknownError"));

    render(<MangaLibrary />);

    expect(await screen.findByRole("img", { name: "Cover unavailable for Unreadable manga" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unreadable manga" })).toBeInTheDocument();
    expect(loadLibrary("manga").map((candidate) => candidate.id)).toEqual(["unreadable-manga"]);
    expect(removeAsset).not.toHaveBeenCalled();
  });

  it("keeps a linked manga in the library when its thumbnail and saved handle were cleared", async () => {
    const record = mangaRecord({
      id: "cleared-linked-manga",
      title: "Cleared linked manga",
      assetIds: ["cleared-cover"],
      totalPages: 12,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify(Array.from({ length: 12 }, () => null)),
        linkedFileIds: JSON.stringify(["cleared-file-handle"]),
      },
    });
    saveLibrary("manga", [record]);

    render(<MangaLibrary />);

    expect(await screen.findByRole("img", { name: "Cover unavailable for Cleared linked manga" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cleared linked manga" })).toBeInTheDocument();
    expect(loadLibrary("manga").map((candidate) => candidate.id)).toEqual([record.id]);
    expect(screen.queryByText("Removed manga whose local files were no longer available.")).not.toBeInTheDocument();
  });

  it("reopens a linked manga from its original archive after remounting", async () => {
    const archive = new File(["archive"], "Linked reader.cbz", { type: "application/vnd.comicbook+zip" });
    const pages = [1, 2, 3].map((pageNumber) => new File(
      [`page-${pageNumber}`],
      `page-${String(pageNumber).padStart(4, "0")}.jpg`,
      { type: "image/jpeg" },
    ));
    const linked = linkedFileHandle(archive);
    fixtures.handles.set("linked-reader-file", linked.handle);
    saveLibrary("manga", [mangaRecord({
      title: "Linked reader",
      assetIds: [],
      totalPages: pages.length,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify(pages.map(() => null)),
        linkedFileIds: JSON.stringify(["linked-reader-file"]),
      },
    })]);
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Linked reader",
      fileName: archive.name,
      sourceType: "cbz",
      pageCount: pages.length,
      assets: pages,
      metadata: { readingDirection: "rtl", pagePlacements: pages.map(() => null) },
    });

    render(<MangaReader mangaId="manga-reader-test" />);

    expect(await screen.findByRole("button", { name: "Select text on Linked reader, page 1" })).toBeInTheDocument();
    expect(linked.getFile).toHaveBeenCalled();
    expect(fixtures.prepareMangaImport).toHaveBeenCalledWith([archive]);
    expect(loadAsset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: "Select text on Linked reader, page 2" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByRole("button", { name: "Select text on Linked reader, page 1" })).toBeInTheDocument();
    expect(fixtures.prepareMangaImport).toHaveBeenCalledTimes(1);
  });

  it("asks once for permission before reopening a linked manga", async () => {
    const archive = new File(["archive"], "Permission reader.cbz", { type: "application/vnd.comicbook+zip" });
    const page = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    const linked = linkedFileHandle(archive, "prompt");
    fixtures.handles.set("permission-reader-file", linked.handle);
    saveLibrary("manga", [mangaRecord({
      title: "Permission reader",
      assetIds: [],
      totalPages: 1,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null]),
        linkedFileIds: JSON.stringify(["permission-reader-file"]),
      },
    })]);
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Permission reader",
      fileName: archive.name,
      sourceType: "cbz",
      pageCount: 1,
      assets: [page],
      metadata: { readingDirection: "rtl", pagePlacements: [null] },
    });

    render(<MangaReader mangaId="manga-reader-test" />);
    const allow = await screen.findByRole("button", { name: "Allow file access" });
    expect(screen.getByText("Allow access to the original manga file to continue.")).toBeInTheDocument();

    fireEvent.click(allow);

    expect(await screen.findByRole("button", { name: "Select text on Permission reader, page 1" })).toBeInTheDocument();
    expect(linked.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Allow file access" })).not.toBeInTheDocument();
  });

  it("restores a grouped permission grant for linked loose-image pages with one prompt", async () => {
    const firstPage = new File(["first"], "page-0001.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second"], "page-0002.jpg", { type: "image/jpeg" });
    const firstLinkedPage = linkedFileHandle(firstPage, "prompt");
    const secondLinkedPage = linkedFileHandle(secondPage, "prompt");
    firstLinkedPage.requestPermission.mockImplementation(async () => {
      firstLinkedPage.grantPermission();
      secondLinkedPage.grantPermission();
      return "granted";
    });
    fixtures.handles.set("permission-page-1", firstLinkedPage.handle);
    fixtures.handles.set("permission-page-2", secondLinkedPage.handle);
    saveLibrary("manga", [mangaRecord({
      title: "Linked image pages",
      assetIds: [],
      totalPages: 2,
      metadata: {
        sourceType: "images",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null, null]),
        linkedFileIds: JSON.stringify(["permission-page-1", "permission-page-2"]),
      },
    })]);

    render(<MangaReader mangaId="manga-reader-test" />);
    const allow = await screen.findByRole("button", { name: "Allow file access" });
    expect(screen.getByRole("button", { name: "Locate original pages" })).toBeInTheDocument();

    fireEvent.click(allow);

    expect(await screen.findByRole("button", { name: "Select text on Linked image pages, page 1" })).toBeInTheDocument();
    expect(firstLinkedPage.requestPermission).toHaveBeenCalledTimes(1);
    expect(secondLinkedPage.requestPermission).not.toHaveBeenCalled();
  });

  it("requests independently protected linked pages one at a time", async () => {
    const firstPage = new File(["first"], "page-0001.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second"], "page-0002.jpg", { type: "image/jpeg" });
    const firstLinkedPage = linkedFileHandle(firstPage, "prompt");
    const secondLinkedPage = linkedFileHandle(secondPage, "prompt");
    fixtures.handles.set("independent-page-1", firstLinkedPage.handle);
    fixtures.handles.set("independent-page-2", secondLinkedPage.handle);
    saveLibrary("manga", [mangaRecord({
      title: "Independent image pages",
      assetIds: [],
      totalPages: 2,
      metadata: {
        sourceType: "images",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null, null]),
        linkedFileIds: JSON.stringify(["independent-page-1", "independent-page-2"]),
      },
    })]);

    render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Allow file access" }));

    const secondAllow = await screen.findByRole("button", { name: "Allow file access" });
    await waitFor(() => expect(secondAllow).toBeEnabled());
    expect(firstLinkedPage.requestPermission).toHaveBeenCalledTimes(1);
    expect(secondLinkedPage.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(secondAllow);

    expect(await screen.findByRole("button", { name: "Select text on Independent image pages, page 1" })).toBeInTheDocument();
    expect(secondLinkedPage.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("can restore a lost link with the existing copied-file fallback", async () => {
    const original = mangaRecord({
      title: "Lost link reader",
      assetIds: [],
      totalPages: 1,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null]),
        linkedFileIds: JSON.stringify(["lost-reader-file"]),
      },
    });
    saveLibrary("manga", [original]);
    const replacementArchive = new File(["replacement"], "Lost link reader.cbz", { type: "application/vnd.comicbook+zip" });
    const replacementPage = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Lost link reader",
      fileName: replacementArchive.name,
      sourceType: "cbz",
      pageCount: 1,
      assets: [replacementPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null] },
    });

    const { container } = render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByText("Locate original file");
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { files: [replacementArchive] } });

    expect(await screen.findByRole("button", { name: "Select text on Lost link reader, page 1" })).toBeInTheDocument();
    const restored = loadLibrary("manga")[0];
    expect(restored.assetIds).toHaveLength(1);
    expect(restored.metadata?.linkedFileIds).toBe("[]");
  });

  it("relinks a missing manga handle without storing another full copy", async () => {
    const original = mangaRecord({
      title: "Relinked reader",
      assetIds: [],
      totalPages: 1,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null]),
        linkedFileIds: JSON.stringify(["cleared-reader-file"]),
      },
    });
    saveLibrary("manga", [original]);
    const replacementArchive = new File(["replacement"], "Relinked reader.cbz", { type: "application/vnd.comicbook+zip" });
    const replacementPage = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    const replacement = linkedFileHandle(replacementArchive);
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("showOpenFilePicker", vi.fn(async () => [replacement.handle]));
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Relinked reader",
      fileName: replacementArchive.name,
      sourceType: "cbz",
      pageCount: 1,
      assets: [replacementPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null] },
    });

    const firstView = render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Locate original file" }));

    expect(await screen.findByRole("button", { name: "Select text on Relinked reader, page 1" })).toBeInTheDocument();
    const relinked = loadLibrary("manga")[0];
    const relinkedId = JSON.parse(String(relinked.metadata?.linkedFileIds))[0] as string;
    expect(relinkedId).not.toBe("cleared-reader-file");
    expect(relinked.assetIds).toEqual([]);
    expect(saveFileHandle).toHaveBeenCalledWith(relinkedId, replacement.handle);
    expect(removeFileHandle).toHaveBeenCalledWith("cleared-reader-file");
    expect(saveAsset).not.toHaveBeenCalled();

    firstView.unmount();
    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on Relinked reader, page 1" })).toBeInTheDocument();
  });

  it("falls back to a complete browser copy when only part of a loose-page link can be saved", async () => {
    saveLibrary("manga", [mangaRecord({
      title: "Partially linked pages",
      assetIds: [],
      totalPages: 2,
      metadata: {
        sourceType: "images",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null, null]),
        linkedFileIds: JSON.stringify(["old-page-1", "old-page-2"]),
      },
    })]);
    const firstPage = new File(["first"], "page-0001.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second"], "page-0002.jpg", { type: "image/jpeg" });
    const firstHandle = linkedFileHandle(firstPage);
    const secondHandle = linkedFileHandle(secondPage);
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("showOpenFilePicker", vi.fn(async () => [firstHandle.handle, secondHandle.handle]));
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Partially linked pages",
      fileName: firstPage.name,
      sourceType: "images",
      pageCount: 2,
      assets: [firstPage, secondPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null, null] },
    });
    vi.mocked(saveFileHandle)
      .mockImplementationOnce(async (id, handle) => { fixtures.handles.set(id, handle); })
      .mockRejectedValueOnce(new Error("The second file link could not be saved."));

    render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Locate original pages" }));

    expect(await screen.findByRole("button", { name: "Select text on Partially linked pages, page 1" })).toBeInTheDocument();
    const restored = loadLibrary("manga")[0];
    expect(restored.assetIds).toHaveLength(2);
    expect(restored.metadata?.linkedFileIds).toBe("[]");
    const attemptedHandleIds = vi.mocked(saveFileHandle).mock.calls.map(([id]) => id);
    expect(attemptedHandleIds).toHaveLength(2);
    expect(attemptedHandleIds.every((id) => !fixtures.handles.has(id))).toBe(true);
    expect(vi.mocked(saveAsset).mock.calls.map(([, asset]) => asset)).toEqual([firstPage, secondPage]);
  });

  it("preserves the old manga source when reconnect metadata cannot be committed", async () => {
    const oldCover = new Blob(["old cover"], { type: "image/webp" });
    fixtures.assets.set("old-cover", oldCover);
    const original = mangaRecord({
      title: "Safe reconnect",
      assetIds: ["old-cover"],
      totalPages: 1,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null]),
        linkedFileIds: JSON.stringify(["old-missing-handle"]),
      },
    });
    saveLibrary("manga", [original]);
    const replacementArchive = new File(["replacement"], "Safe reconnect.cbz", { type: "application/vnd.comicbook+zip" });
    const replacementPage = new File(["page"], "page-0001.jpg", { type: "image/jpeg" });
    const replacement = linkedFileHandle(replacementArchive);
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("showOpenFilePicker", vi.fn(async () => [replacement.handle]));
    fixtures.prepareMangaImport.mockResolvedValue({
      title: "Safe reconnect",
      fileName: replacementArchive.name,
      sourceType: "cbz",
      pageCount: 1,
      assets: [replacementPage],
      metadata: { readingDirection: "rtl", pagePlacements: [null] },
    });

    render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByRole("button", { name: "Locate original file" });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Locate original file" }));

      expect(await screen.findByText("Browser storage is full or unavailable.")).toBeInTheDocument();
      expect(loadLibrary("manga")[0]).toEqual(original);
      expect(fixtures.assets.get("old-cover")).toBe(oldCover);
      const freshHandleId = vi.mocked(saveFileHandle).mock.calls.at(-1)?.[0];
      expect(freshHandleId).toBeTruthy();
      expect(freshHandleId).not.toBe("old-missing-handle");
      expect(removeFileHandle).toHaveBeenCalledWith(freshHandleId);
      expect(removeFileHandle).not.toHaveBeenCalledWith("old-missing-handle");
    } finally {
      setItem.mockRestore();
    }
  });

  it("reorders manga with Alt+Arrow and keeps the saved order after remounting", async () => {
    seedMangaShelf();
    const view = render(<MangaLibrary />);
    await waitForMangaLibraryReady();

    const item = mangaShelfItem("Manga B");
    item.focus();
    fireEvent.keyDown(item, { altKey: true, key: "ArrowLeft" });

    expect(mangaShelfOrder()).toEqual(["Manga B", "Manga A", "Manga C"]);
    expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga B", "Manga A", "Manga C"]);
    const announcement = screen.getByText("Manga B moved to position 1 of 3.");
    expect(announcement).toHaveAttribute("role", "status");
    expect(announcement).toHaveAttribute("aria-live", "polite");

    view.unmount();
    render(<MangaLibrary />);
    await waitForMangaLibraryReady();
    expect(mangaShelfOrder()).toEqual(["Manga B", "Manga A", "Manga C"]);
  });

  it("does not save a manga order when a keyboard move crosses the shelf boundary", async () => {
    seedMangaShelf();
    render(<MangaLibrary />);
    await waitForMangaLibraryReady();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    try {
      const firstItem = mangaShelfItem("Manga A");
      firstItem.focus();
      fireEvent.keyDown(firstItem, { altKey: true, key: "ArrowLeft" });

      expect(mangaShelfOrder()).toEqual(["Manga A", "Manga B", "Manga C"]);
      expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga A", "Manga B", "Manga C"]);
      expect(setItem).not.toHaveBeenCalled();
      expect(screen.queryByText(/moved to position/iu)).not.toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });

  it("restores the previous manga order when browser storage rejects a keyboard reorder", async () => {
    seedMangaShelf();
    render(<MangaLibrary />);
    await waitForMangaLibraryReady();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });

    try {
      const item = mangaShelfItem("Manga B");
      item.focus();
      fireEvent.keyDown(item, { altKey: true, key: "ArrowLeft" });

      expect(mangaShelfOrder()).toEqual(["Manga A", "Manga B", "Manga C"]);
      expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga A", "Manga B", "Manga C"]);
      expect(screen.getByRole("alert")).toHaveTextContent("The manga order could not be saved");
      expect(screen.getByText("The position of Manga B could not be saved.")).toHaveAttribute("role", "status");
    } finally {
      setItem.mockRestore();
    }
  });

  it("keeps whole-card reordering accessible without native controls and leaves editing interactive", async () => {
    seedMangaShelf();
    render(<MangaLibrary />);
    await waitForMangaLibraryReady();

    const shelf = screen.getByRole("list", { name: "Manga library order" });
    const item = mangaShelfItem("Manga A");
    expect(shelf).toHaveAttribute("aria-describedby", "manga-reorder-instructions");
    expect(item).toHaveAttribute("tabindex", "0");
    expect(item).toHaveAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowUp Alt+ArrowRight Alt+ArrowDown");
    expect(item).toHaveAttribute("draggable", "false");
    expect(screen.getByRole("link", { name: "Read Manga A" })).toHaveAttribute("draggable", "false");
    expect(screen.getByRole("link", { name: "Manga A" })).toHaveAttribute("draggable", "false");
    expect(screen.queryByTitle(/Drag Manga A to reorder/iu)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move Manga A (?:earlier|later)/iu })).not.toBeInTheDocument();

    item.focus();
    expect(item).toHaveFocus();
    const editButton = screen.getByRole("button", { name: "Edit title for Manga A" });
    fireEvent.pointerDown(editButton, { button: 0, pointerId: 1, pointerType: "mouse" });
    fireEvent.click(editButton);

    expect(screen.getByRole("textbox", { name: "Manga title" })).toHaveValue("Manga A");
    expect(loadLibrary("manga").map((record) => record.title)).toEqual(["Manga A", "Manga B", "Manga C"]);
  });

  it("predownloads the OCR model with visible byte progress", async () => {
    fixtures.getMangaOcrModelStatus.mockResolvedValue({
      downloadedBytes: 0,
      ready: false,
      totalBytes: 121_486_877,
    });
    let finishDownload: (() => void) | undefined;
    fixtures.downloadMangaOcrModel.mockImplementation((options: {
      onProgress?: (progress: { asset: "vision"; assetLabel: string; loadedBytes: number; totalBytes: number }) => void;
    }) => new Promise<void>((resolve) => {
      finishDownload = resolve;
      options.onProgress?.({
        asset: "vision",
        assetLabel: "Vision model",
        loadedBytes: 52_293_486,
        totalBytes: 121_486_877,
      });
    }));

    render(<MangaLibrary />);
    fireEvent.click(await screen.findByRole("button", { name: "Download OCR model" }));

    const progress = await screen.findByRole("progressbar", { name: "OCR model download" });
    expect(progress).toHaveAttribute("value", "52293486");
    expect(progress).toHaveAttribute("max", "121486877");
    expect(screen.getByText("Vision model · 52.3 MB / 121.5 MB")).toBeInTheDocument();

    await act(async () => { finishDownload?.(); });
    await waitFor(() => expect(screen.queryByRole("progressbar", { name: "OCR model download" })).not.toBeInTheDocument());
    expect(screen.queryByText("OCR model ready offline")).not.toBeInTheDocument();
  });

  it("clears the previous OCR result on a new selection and replaces it when recognition completes", async () => {
    seedReader();
    const pageBlob = fixtures.assets.get("page-1");
    saveMangaOcrPage("manga-reader-test", 1, "既存テキスト");
    let resolveRecognition: ((text: string) => void) | undefined;
    fixtures.recognizeMangaSelection.mockImplementation(() => new Promise<string>((resolve) => {
      resolveRecognition = resolve;
    }));

    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("既存テキスト");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("aria-label", "Recognized manga text from page 1");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-appearance", "compact");
    expect(screen.queryByRole("textbox", { name: /recognized page text/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recognize selection/iu })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select text on よつばと！, page 1" }));

    expect(screen.queryByTestId("japanese-reader")).not.toBeInTheDocument();
    expect(screen.queryByText("既存テキスト")).not.toBeInTheDocument();
    expect(loadMangaOcrPage("manga-reader-test", 1)).toBeNull();
    expect(fixtures.recognizeMangaSelection).toHaveBeenCalledWith(
      pageBlob,
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }),
    );

    await act(async () => { resolveRecognition?.("猫 です"); });

    await waitFor(() => expect(screen.getByTestId("japanese-reader")).toHaveTextContent(/^猫 です$/u));
    expect(loadMangaOcrPage("manga-reader-test", 1)?.text).toBe("猫 です");
    expect(screen.queryByText("Text recognized.")).not.toBeInTheDocument();
  });

  it("automatically translates recognized text with the saved JPDB key", async () => {
    seedReader();
    fixtures.jpdbApiKey = "configured-jpdb-key";
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      provider: "jpdb",
      translation: "It is a cat.",
      isTruncated: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" }));

    expect(await screen.findByText("It is a cat.")).toBeInTheDocument();
    const translation = screen.getByRole("region", { name: "JPDB translation" });
    expect(translation).toHaveTextContent("TranslationJPDBIt is a cat.");
    expect(screen.getByTestId("japanese-reader-shell")).toContainElement(translation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/manga/translate", expect.objectContaining({
      method: "POST",
      signal: expect.any(AbortSignal),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      text: "猫 です",
      apiKey: "configured-jpdb-key",
    });
  });

  it("does not request a translation when no JPDB key is configured", async () => {
    seedReader();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" }));

    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("猫 です");
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "JPDB translation" })).not.toBeInTheDocument();
  });

  it("aborts and ignores an older JPDB translation when a new selection starts", async () => {
    seedReader();
    fixtures.jpdbApiKey = "configured-jpdb-key";
    fixtures.recognizeMangaSelection
      .mockResolvedValueOnce("猫です")
      .mockResolvedValueOnce("犬です");
    let resolveFirstTranslation: ((response: Response) => void) | undefined;
    let requestCount = 0;
    const fetchMock = vi.fn<typeof fetch>(() => {
      requestCount += 1;
      if (requestCount === 1) return new Promise<Response>((resolve) => { resolveFirstTranslation = resolve; });
      return Promise.resolve(new Response(JSON.stringify({ translation: "It is a dog.", isTruncated: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MangaReader mangaId="manga-reader-test" />);
    const selector = await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });
    fireEvent.click(selector);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Translating")).toBeInTheDocument();

    fireEvent.click(selector);
    expect(await screen.findByText("It is a dog.")).toBeInTheDocument();
    expect((fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(true);

    await act(async () => {
      resolveFirstTranslation?.(new Response(JSON.stringify({ translation: "It is a cat.", isTruncated: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
      await Promise.resolve();
    });
    expect(screen.queryByText("It is a cat.")).not.toBeInTheDocument();
    expect(screen.getByText("It is a dog.")).toBeInTheDocument();
  });

  it("opens the cover alone, then advances to the 2–3 spread and saves resume progress", async () => {
    seedReader();

    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select text on よつばと！, page 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const pageTwo = await screen.findByRole("button", { name: "Select text on よつばと！, page 2" });
    const pageThree = screen.getByRole("button", { name: "Select text on よつばと！, page 3" });
    expect(screen.queryByRole("button", { name: "Select text on よつばと！, page 1" })).not.toBeInTheDocument();
    expect(screen.getByText("2–3 / 3")).toBeInTheDocument();
    expect(pageTwo.closest("[data-side]")).toHaveAttribute("data-side", "right");
    expect(pageThree.closest("[data-side]")).toHaveAttribute("data-side", "left");
    expect(vi.mocked(loadAsset).mock.calls.map(([assetId]) => assetId)).toEqual(["page-1", "page-2", "page-3"]);
    expect(loadLibrary("manga")[0]).toMatchObject({ currentPage: 3, totalPages: 3, progress: 1 });
  });

  it("blocks repeat navigation and selection while the next spread is still loading", async () => {
    const assetIds = ["page-1", "page-2", "page-3", "page-4", "page-5"];
    seedReader(mangaRecord({ assetIds, totalPages: assetIds.length }));

    render(<MangaReader mangaId="manga-reader-test" />);
    const coverSelection = await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });
    let releasePages: (() => void) | undefined;
    const pagesMayLoad = new Promise<void>((resolve) => { releasePages = resolve; });
    vi.mocked(loadAsset).mockImplementation(async (assetId: string) => {
      if (assetId === "page-2" || assetId === "page-3") await pagesMayLoad;
      return fixtures.assets.get(assetId) ?? null;
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(coverSelection).toBeDisabled());
    fireEvent.click(coverSelection);
    fireEvent.keyDown(window, { key: "ArrowLeft", repeat: true });
    fireEvent.keyDown(window, { key: "ArrowLeft", repeat: true });

    expect(fixtures.recognizeMangaSelection).not.toHaveBeenCalled();
    expect(vi.mocked(loadAsset).mock.calls.some(([assetId]) => assetId === "page-4" || assetId === "page-5")).toBe(false);

    await act(async () => { releasePages?.(); });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeEnabled();
    expect(screen.getByText("2–3 / 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select text on よつばと！, page 4" })).not.toBeInTheDocument();
  });

  it("discards a recognition result when navigation changes its source spread", async () => {
    seedReader();
    let resolveRecognition: ((text: string) => void) | undefined;
    fixtures.recognizeMangaSelection.mockImplementation(() => new Promise<string>((resolve) => {
      resolveRecognition = resolve;
    }));

    render(<MangaReader mangaId="manga-reader-test" />);
    fireEvent.click(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();

    await act(async () => { resolveRecognition?.("古い結果"); });

    expect(loadMangaOcrPage("manga-reader-test", 1)).toBeNull();
    expect(screen.queryByText("古い結果")).not.toBeInTheDocument();
    expect(screen.getByText("Drag across Japanese text on a page to recognize it.")).toBeInTheDocument();
  });

  it.each([
    ["rtl", "ArrowLeft", "ArrowRight"],
    ["ltr", "ArrowRight", "ArrowLeft"],
  ] as const)("uses %s reading direction for arrow-key spread navigation", async (direction, forwardKey, backKey) => {
    seedReader(mangaRecord({
      metadata: {
        sourceType: "images",
        isPdf: false,
        readingDirection: direction,
        pagePlacements: JSON.stringify([null, null, null]),
      },
    }));

    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: forwardKey });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled());

    fireEvent.keyDown(window, { key: backKey });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();
  });

  it.each([
    ["rtl", "left", "right"],
    ["ltr", "right", "left"],
  ] as const)("places %s next and previous controls on their physical page edges", async (direction, nextSide, previousSide) => {
    seedReader(mangaRecord({
      metadata: {
        sourceType: "images",
        isPdf: false,
        readingDirection: direction,
        pagePlacements: JSON.stringify([null, null, null]),
      },
    }));

    render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });

    const stage = screen.getByTestId("manga-spread-stage");
    const viewport = screen.getByTestId("manga-spread-viewport");
    const next = screen.getByRole("button", { name: "Next" });
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(stage).toContainElement(next);
    expect(stage).toContainElement(previous);
    expect(stage).toContainElement(viewport);
    expect(viewport).not.toContainElement(next);
    expect(viewport).not.toContainElement(previous);
    expect(next).toHaveAttribute("data-physical-side", nextSide);
    expect(previous).toHaveAttribute("data-physical-side", previousSide);
  });

  it("keeps the displayed spread settled while the next spread is prepared", async () => {
    seedReader();

    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();

    let releasePages: (() => void) | undefined;
    const pagesReady = new Promise<void>((resolve) => { releasePages = resolve; });
    vi.mocked(loadAsset).mockImplementation(async (assetId: string) => {
      if (assetId !== "page-1") await pagesReady;
      return fixtures.assets.get(assetId) ?? null;
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(loadAsset).toHaveBeenCalledWith("page-2"));

    expect(screen.getByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.queryByText("Opening pages…")).not.toBeInTheDocument();

    await act(async () => { releasePages?.(); });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();
  });

  it("decodes the exact target page URLs before starting their transition", async () => {
    seedReader();

    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();

    fixtures.decodeMangaImage.mockClear();
    let releaseDecode: (() => void) | undefined;
    const decoded = new Promise<void>((resolve) => { releaseDecode = resolve; });
    fixtures.decodeMangaImage.mockImplementation(() => decoded);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fixtures.decodeMangaImage).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();
    expect(screen.getByTestId("manga-spread-stage").querySelector('[data-transition-layer="outgoing"]')).not.toBeInTheDocument();

    await act(async () => { releaseDecode?.(); });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();
  });

  it("keeps the spread stage and spread DOM mounted while pages change", async () => {
    seedReader();

    render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });
    const stage = screen.getByTestId("manga-spread-stage");
    const viewport = screen.getByTestId("manga-spread-viewport");
    const spread = screen.getByTestId("manga-spread");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();

    expect(screen.getByTestId("manga-spread-stage")).toBe(stage);
    expect(screen.getByTestId("manga-spread")).not.toBe(spread);
    expect(screen.getByTestId("manga-spread")).toHaveAttribute("data-transition-layer", "incoming");
    expect(stage.querySelector('[data-transition-layer="outgoing"]')).toBe(spread);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() => expect(stage.querySelector('[data-transition-layer="outgoing"]')).not.toBeInTheDocument());
    expect(screen.getByTestId("manga-spread-stage")).toBe(stage);
    expect(screen.getByTestId("manga-spread-viewport")).toBe(viewport);
    expect(screen.getByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("supports PageDown and PageUp keyboard navigation", async () => {
    seedReader();
    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "PageDown" });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled());

    fireEvent.keyDown(window, { key: "PageUp" });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();
  });

  it("resumes an out-of-range saved page at the final valid spread", async () => {
    const assetIds = ["page-1", "page-2", "page-3", "page-4", "page-5"];
    seedReader(mangaRecord({ assetIds, currentPage: 99, totalPages: assetIds.length }));

    render(<MangaReader mangaId="manga-reader-test" />);

    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select text on よつばと！, page 5" })).toBeInTheDocument();
    expect(screen.getByText("4–5 / 5")).toBeInTheDocument();
  });

  it("tracks fullscreen entry and exit while forwarding structured OCR progress and results as a page tooltip", async () => {
    seedReader();
    let resolveRecognition: ((text: string) => void) | undefined;
    fixtures.recognizeMangaSelection.mockImplementation((_blob, _selection, options) => new Promise<string>((resolve) => {
      resolveRecognition = resolve;
      options?.onProgress?.({ stage: "downloading-model", loadedBytes: 1_000_000, totalBytes: 2_000_000 });
    }));

    render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });
    const fullscreenButton = screen.getByRole("button", { name: "Fullscreen" });
    expect(fullscreenButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(fullscreenButton);
    await waitFor(() => expect(fixtures.requestFullscreen).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Exit fullscreen" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Select text on よつばと！, page 1" }));
    const progressTooltip = await screen.findByTestId("selection-tooltip-よつばと！, page 1");
    expect(progressTooltip).toHaveTextContent("Downloading OCR model · 1.0 MB / 2.0 MB");
    expect(progressTooltip).toHaveAttribute("data-busy", "true");

    await act(async () => { resolveRecognition?.("猫です"); });
    await waitFor(() => expect(screen.getByTestId("selection-tooltip-よつばと！, page 1")).toHaveTextContent("猫です"));
    expect(screen.getByTestId("selection-tooltip-よつばと！, page 1")).toHaveAttribute("data-busy", "false");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-appearance", "compact");

    fireEvent.click(screen.getByRole("button", { name: "Close OCR result" }));
    expect(screen.queryByTestId("selection-tooltip-よつばと！, page 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    await waitFor(() => expect(fixtures.exitFullscreen).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Fullscreen" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("selection-tooltip-よつばと！, page 1")).not.toBeInTheDocument();
  });
});
