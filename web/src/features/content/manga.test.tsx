import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentRecord } from "./types";

const fixtures = vi.hoisted(() => ({
  assets: new Map<string, Blob>(),
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
  JapaneseReader: ({ text, appearance, ariaLabel, interaction }: { text: string; appearance?: string; ariaLabel?: string; interaction?: string }) => (
    <div data-testid="japanese-reader" aria-label={ariaLabel} data-appearance={appearance} data-interaction={interaction}>{text}</div>
  ),
}));

vi.mock("./MangaPageSelector", () => ({
  MangaPageSelector: ({ alt, disabled, onSelectionComplete, tooltip }: {
    alt: string;
    disabled?: boolean;
    onSelectionComplete: (selection: { x: number; y: number; width: number; height: number }) => void;
    tooltip?: { busy?: boolean; content: ReactNode; tone?: string } | null;
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
      >{tooltip.content}</div> : null}
    </div>
  ),
}));

vi.mock("./manga-import", () => ({
  prepareMangaImport: fixtures.prepareMangaImport,
}));

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
  };
});

import { MangaLibrary, MangaReader } from "./manga";
import {
  loadAsset,
  loadLibrary,
  loadMangaOcrPage,
  saveAsset,
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

function seedReader(record = mangaRecord()) {
  saveLibrary("manga", [record]);
  record.assetIds.forEach((assetId, index) => {
    fixtures.assets.set(assetId, new Blob([`page ${index + 1}`], { type: "image/jpeg" }));
  });
  return record;
}

describe("manga library and reader", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    fixtures.assets.clear();
    fixtures.jpdbApiKey = "";
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:https://kakehashi.local/manga-page"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(min-width: 56rem)",
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
    expect(await screen.findByText("OCR model ready offline")).toBeInTheDocument();
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
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-interaction", "tooltip");
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
    expect(screen.getByText("Text recognized.")).toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: "JPDB translation" })).toHaveTextContent("TranslationJPDBIt is a cat.");
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

  it("keeps the spread stage and spread DOM mounted while pages change", async () => {
    seedReader();

    render(<MangaReader mangaId="manga-reader-test" />);
    await screen.findByRole("button", { name: "Select text on よつばと！, page 1" });
    const stage = screen.getByTestId("manga-spread-stage");
    const spread = screen.getByTestId("manga-spread");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();

    expect(screen.getByTestId("manga-spread-stage")).toBe(stage);
    expect(screen.getByTestId("manga-spread")).toBe(spread);
    expect(spread).toHaveAttribute("data-transition-layer", "incoming");
    expect(stage.querySelector('[data-transition-layer="outgoing"]')).toBeInTheDocument();
    await waitFor(() => expect(stage.querySelector('[data-transition-layer="outgoing"]')).not.toBeInTheDocument());
  });

  it("supports PageDown and PageUp keyboard navigation", async () => {
    seedReader();
    render(<MangaReader mangaId="manga-reader-test" />);
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 1" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "PageDown" });
    expect(await screen.findByRole("button", { name: "Select text on よつばと！, page 2" })).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    await waitFor(() => expect(fixtures.exitFullscreen).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Fullscreen" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("selection-tooltip-よつばと！, page 1")).not.toBeInTheDocument();
  });
});
