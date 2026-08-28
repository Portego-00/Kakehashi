import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import type { ForwardedRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractBookEpub } from "./epub-import";
import type { EpubRenditionPageState } from "./EpubRendition";
import type { ContentRecord } from "./types";
import { EpubLibrary, EpubReader } from "./epubs";

const fixtures = vi.hoisted(() => ({
  assets: new Map<string, Blob>(),
  books: [] as ContentRecord[],
  next: vi.fn(async () => undefined),
  previous: vi.fn(async () => undefined),
  clearWordSelection: vi.fn(() => undefined),
  setWordSelection: vi.fn((requestId: string, text: string) => { void requestId; void text; }),
  initialCfis: [] as Array<string | undefined>,
  renditionState: {
    status: "ready",
    cfi: "epubcfi(/6/4!/4/2)",
    progress: 0.25,
    page: 2,
    total: 8,
    atStart: false,
    atEnd: false,
    locationsReady: true,
    displayedPage: 2,
    displayedTotal: 8,
  } as EpubRenditionPageState,
  removeAsset: vi.fn(async (id: string) => { void id; }),
  loadAsset: vi.fn(async (id: string) => { void id; return null as Blob | null; }),
  saveAsset: vi.fn(async (id: string, blob: Blob) => { void id; void blob; }),
  updateRecordInPlace: vi.fn((record: ContentRecord) => [record]),
  upsertRecord: vi.fn((record: ContentRecord) => [record] as ContentRecord[]),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "booktester" } } }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    study: { epubDailyGoalMinutes: 20 },
    integrations: { jpdbApiKey: "configured-test-key" },
    reader: { recognitionMode: "wk-jpdb", detailsInteraction: "click" },
  }),
}));

vi.mock("./storage", () => ({
  createLocalId: (prefix: string) => `${prefix}-test`,
  deleteRecord: vi.fn(async () => undefined),
  loadAsset: fixtures.loadAsset,
  loadLibrary: (kind: string) => kind === "epub" ? fixtures.books : [],
  readLocal: vi.fn((_key: string, fallback: unknown) => fallback),
  removeAsset: fixtures.removeAsset,
  saveAsset: fixtures.saveAsset,
  updateRecordInPlace: fixtures.updateRecordInPlace,
  upsertRecord: fixtures.upsertRecord,
  writeLocal: vi.fn(() => true),
}));

vi.mock("./epub-import", () => ({
  extractBookEpub: vi.fn(),
}));

vi.mock("./EpubRendition", () => ({
  EpubRendition: forwardRef(function MockEpubRendition(
    props: { className?: string; initialCfi?: string; source: Blob; onLookupSourcesChange?: (sources: Array<{ id: string; text: string }>) => void; onStateChange?: (state: unknown) => void; onWordSelect?: (selection: { id: string; text: string; index: number; surface: string; sourceId?: string } | null) => void },
    ref: ForwardedRef<{ next(): Promise<void>; previous(): Promise<void>; clearWordSelection(): void; setWordSelection(requestId: string, text: string): void }>,
  ) {
    const { className, initialCfi, source, onLookupSourcesChange, onStateChange, onWordSelect } = props;
    useImperativeHandle(ref, () => ({ next: fixtures.next, previous: fixtures.previous, clearWordSelection: fixtures.clearWordSelection, setWordSelection: fixtures.setWordSelection }), []);
    useEffect(() => {
      fixtures.initialCfis.push(initialCfi);
    }, [initialCfi]);
    useEffect(() => {
      onStateChange?.(fixtures.renditionState);
    }, [onStateChange]);
    useEffect(() => {
      onLookupSourcesChange?.([{ id: "epub-lookup-test", text: "学校へ行く。" }]);
    }, [onLookupSourcesChange]);
    return <div className={className} data-testid="epub-rendition" data-source-size={source.size}>
      <button type="button" onClick={() => onWordSelect?.({ id: "epub-word-test", text: "学校へ行く。", index: 0, surface: "学校", sourceId: "epub-lookup-test" })}>Select EPUB word</button>
    </div>;
  }),
}));

vi.mock("./JapaneseReader", () => ({
  useJapaneseReaderAnalysisContexts: (sources: Array<{ id: string; text: string }>) => new Map(sources.map((source) => [source.id, {
    text: source.text,
    start: 0,
    analysis: { status: "ready", sourceText: source.text, tokens: [], message: "Ready" },
  }])),
  JapaneseReader: ({ text, inspectorOnly, selectionRequest, onSelectionResolved }: {
    text: string;
    inspectorOnly?: boolean;
    selectionRequest?: { id: string; index: number };
    onSelectionResolved?: (selection: { requestId: string; text: string; start: number; end: number }) => void;
  }) => {
    useEffect(() => {
      if (selectionRequest) onSelectionResolved?.({ requestId: selectionRequest.id, text: "学校", start: 0, end: 2 });
    }, [onSelectionResolved, selectionRequest]);
    return <aside data-inspector-only={inspectorOnly ? "true" : undefined}>学校 · School<span hidden>{text}</span></aside>;
  },
}));

function book(overrides: Partial<ContentRecord> = {}): ContentRecord {
  return {
    id: "book-1",
    kind: "epub",
    title: "縦書きの本",
    fileName: "vertical.epub",
    mimeType: "application/epub+zip",
    assetIds: ["raw-1", "text-1", "cover-1"],
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    progress: 0,
    currentPage: 1,
    totalPages: 8,
    metadata: {
      rawAssetId: "raw-1",
      textAssetId: "text-1",
      coverAssetId: "cover-1",
      format: "epub",
      writingMode: "vertical-rl",
      chapterCount: 2,
    },
    ...overrides,
  };
}

describe("Books library and reader", () => {
  beforeEach(() => {
    fixtures.assets.clear();
    fixtures.books = [];
    fixtures.next.mockClear();
    fixtures.previous.mockClear();
    fixtures.clearWordSelection.mockClear();
    fixtures.setWordSelection.mockClear();
    fixtures.initialCfis.length = 0;
    fixtures.renditionState = {
      status: "ready",
      cfi: "epubcfi(/6/4!/4/2)",
      progress: 0.25,
      page: 2,
      total: 8,
      atStart: false,
      atEnd: false,
      locationsReady: true,
      displayedPage: 2,
      displayedTotal: 8,
    };
    fixtures.removeAsset.mockClear();
    fixtures.loadAsset.mockReset();
    fixtures.loadAsset.mockImplementation(async (id: string) => fixtures.assets.get(id) ?? null);
    fixtures.saveAsset.mockClear();
    fixtures.updateRecordInPlace.mockClear();
    fixtures.upsertRecord.mockReset();
    fixtures.upsertRecord.mockImplementation((record: ContentRecord) => [record, ...fixtures.books]);
    vi.mocked(extractBookEpub).mockReset();
    const NativeUrl = URL;
    class UrlWithObjectUrls extends NativeUrl {}
    UrlWithObjectUrls.createObjectURL = vi.fn(() => "blob:https://kakehashi.local/book-cover");
    UrlWithObjectUrls.revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", UrlWithObjectUrls);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the manga-style import action and cover shelf while retaining the daily goal", async () => {
    fixtures.books = [book(), book({ id: "book-2", title: "二冊目", assetIds: ["raw-2", "text-2"], metadata: { rawAssetId: "raw-2", textAssetId: "text-2", format: "epub" } })];
    fixtures.assets.set("cover-1", new Blob(["cover"], { type: "image/png" }));

    render(<EpubLibrary />);

    expect(screen.getByRole("button", { name: "Import book" })).toBeInTheDocument();
    expect(screen.queryByText("Drop a book here or choose a file")).not.toBeInTheDocument();
    expect(screen.getByText("20 minute daily goal")).toBeInTheDocument();
    const shelf = screen.getByRole("list", { name: "Book library" });
    expect(within(shelf).getAllByRole("listitem")).toHaveLength(2);
    expect(within(shelf).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["縦書きの本", "二冊目"]);
    expect(within(shelf).getByRole("link", { name: "Read 縦書きの本" })).toHaveAttribute("href", "/epubs/book-1");
    expect(within(shelf).getByText("EPUB · 2 chapters")).toBeInTheDocument();
    expect(await within(shelf).findByAltText("Cover of 縦書きの本")).toHaveAttribute("src", "blob:https://kakehashi.local/book-cover");
  });

  it("imports an image-only EPUB for the raw rendition even without fallback text", async () => {
    vi.mocked(extractBookEpub).mockResolvedValue({
      chapters: [{
        blocks: [{ type: "image", path: "OPS/page.jpg", alt: "挿絵", mediaType: "image/jpeg" }],
        path: "OPS/page.xhtml",
        text: "",
        title: null,
        writingMode: "vertical-rl",
      }],
      language: "ja",
      pageProgressionDirection: "rtl",
      text: "",
      title: "絵だけの本",
    });
    const { container } = render(<EpubLibrary />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, {
      target: { files: [new File(["epub"], "pictures.epub", { type: "application/epub+zip" })] },
    });

    expect(await screen.findByRole("heading", { name: "絵だけの本" })).toBeInTheDocument();
    expect(screen.queryByText("No readable text was found in that file.")).not.toBeInTheDocument();
    expect(fixtures.saveAsset).toHaveBeenCalledTimes(1);
    expect(fixtures.saveAsset).toHaveBeenCalledWith("epub-source-test", expect.any(File));
  });

  it("removes imported blobs when the library index cannot be saved", async () => {
    vi.mocked(extractBookEpub).mockResolvedValue({
      chapters: [{ blocks: [], path: "OPS/chapter.xhtml", text: "第一章", title: null, writingMode: "vertical-rl" }],
      language: "ja",
      pageProgressionDirection: "rtl",
      text: "第一章",
      title: "保存できない本",
    });
    fixtures.upsertRecord.mockImplementationOnce(() => {
      throw new Error("Browser storage is full or unavailable.");
    });
    const { container } = render(<EpubLibrary />);

    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File(["epub"], "full.epub", { type: "application/epub+zip" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Browser storage is full or unavailable.");
    expect(fixtures.removeAsset).toHaveBeenCalledTimes(1);
    expect(fixtures.removeAsset).toHaveBeenCalledWith("epub-source-test");
    expect(screen.queryByRole("heading", { name: "保存できない本" })).not.toBeInTheDocument();
  });

  it("opens the raw EPUB in the focused RTL reader without an OCR rail", async () => {
    fixtures.books = [book()];
    fixtures.assets.set("raw-1", new Blob(["epub bytes"], { type: "application/epub+zip" }));
    fixtures.assets.set("text-1", { text: async () => "昔々、あるところに。" } as Blob);

    render(<EpubReader bookId="book-1" />);

    const rendition = await screen.findByTestId("epub-rendition");
    expect(rendition).toHaveAttribute("data-source-size", "10");
    expect(screen.getByTestId("epub-reader-page-surface")).toContainElement(rendition);
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/epubs");
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "縦書きの本 pages" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Recognized text" })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("2 / 8")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fixtures.next).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(fixtures.previous).toHaveBeenCalledOnce());
    expect(fixtures.updateRecordInPlace).toHaveBeenCalledWith(expect.objectContaining({
      currentPage: 2,
      totalPages: 8,
      metadata: expect.objectContaining({ epubCfi: "epubcfi(/6/4!/4/2)" }),
    }));
    expect(fixtures.initialCfis).toEqual([undefined]);
    expect(fixtures.loadAsset).toHaveBeenCalledTimes(1);
    expect(fixtures.loadAsset).toHaveBeenCalledWith("raw-1");
  });

  it("opens word details from EPUB text, refines one filled selection, and clears it on close", async () => {
    fixtures.books = [book()];
    fixtures.assets.set("raw-1", new Blob(["epub bytes"], { type: "application/epub+zip" }));

    render(<EpubReader bookId="book-1" />);
    const trigger = await screen.findByRole("button", { name: "Select EPUB word" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Word details" });
    expect(within(dialog).getByRole("button", { name: "Close word details" })).toHaveFocus();
    expect(within(dialog).getByText(/学校 · School/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("article")).not.toBeInTheDocument();
    await waitFor(() => expect(fixtures.setWordSelection).toHaveBeenCalledWith("epub-word-test", "学校"));

    fireEvent.click(within(dialog).getByRole("button", { name: "Close word details" }));
    expect(screen.queryByRole("dialog", { name: "Word details" })).not.toBeInTheDocument();
    expect(fixtures.clearWordSelection).toHaveBeenCalledOnce();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps every character reachable in one continuous vertical text document", async () => {
    const ending = "最後まで読めます。";
    fixtures.books = [book({
      title: "長い文章",
      fileName: "long-story.txt",
      mimeType: "text/plain",
      assetIds: ["raw-1", "text-1"],
      totalPages: 3,
      metadata: {
        rawAssetId: "raw-1",
        textAssetId: "text-1",
        format: "text",
        writingMode: "vertical-rl",
      },
    })];
    fixtures.assets.set("text-1", { text: async () => `${"長い本文です。".repeat(400)}\n${ending}` } as Blob);

    render(<EpubReader bookId="book-1" />);

    const document = await screen.findByRole("article", { name: "長い文章, continuous vertical document" });
    expect(document).toHaveTextContent(ending);
    expect(document).toHaveTextContent("長い本文です。");
    expect(screen.queryByRole("navigation", { name: "Book page navigation" })).not.toBeInTheDocument();
  });

  it("shows the rendered physical page instead of the coarser generated text location", async () => {
    fixtures.books = [book()];
    fixtures.assets.set("raw-1", new Blob(["epub bytes"], { type: "application/epub+zip" }));
    fixtures.assets.set("text-1", { text: async () => "第一章" } as Blob);
    fixtures.renditionState = {
      status: "relocated",
      cfi: "epubcfi(/6/2!/4/8)",
      progress: 0.5,
      page: 2,
      total: 2,
      atStart: false,
      atEnd: false,
      locationsReady: true,
      displayedPage: 4,
      displayedTotal: 6,
    };

    render(<EpubReader bookId="book-1" />);

    expect(await screen.findByText("4 / 6")).toBeInTheDocument();
    expect(screen.queryByText("2 / 2")).not.toBeInTheDocument();
  });

  it("does not claim a whole-book page total before EPUB locations are ready", async () => {
    fixtures.books = [book({ totalPages: 1 })];
    fixtures.assets.set("raw-1", new Blob(["epub bytes"], { type: "application/epub+zip" }));
    fixtures.assets.set("text-1", { text: async () => "第一章" } as Blob);
    fixtures.renditionState = {
      status: "ready",
      cfi: "epubcfi(/6/2!/4/2)",
      progress: 0,
      page: 1,
      total: 1,
      atStart: true,
      atEnd: false,
      locationsReady: false,
    };

    render(<EpubReader bookId="book-1" />);

    expect(await screen.findByText("Page 1")).toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
    expect(fixtures.updateRecordInPlace).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ locationsReady: false }),
    }));
  });
});
