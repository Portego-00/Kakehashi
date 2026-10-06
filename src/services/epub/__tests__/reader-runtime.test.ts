import { JSDOM } from "jsdom";
import { strToU8, zipSync } from "fflate";
import { File } from "expo-file-system";
import { epubLibraryService } from "../../epubLibraryService";

const mockFiles = new Map<string, string>();
jest.mock("../format-style-sheet", () => ({ __esModule: true, default: (css: string) => css }));
jest.mock("expo-file-system", () => {
  const path = (parts: (string | { uri: string })[]) => parts.map((part) => typeof part === "string" ? part : part.uri).join("/");
  return {
    Paths: { document: "documents" },
    Directory: class { uri: string; constructor(...parts: (string | { uri: string })[]) { this.uri = path(parts); } create() {} },
    File: class {
      uri: string;
      constructor(...parts: (string | { uri: string })[]) { this.uri = path(parts); }
      get exists() { return mockFiles.has(this.uri); }
      get name() { return this.uri.split("/").pop(); }
      create() { mockFiles.set(this.uri, ""); }
      write(value: string) { mockFiles.set(this.uri, value); }
      async text() { return mockFiles.get(this.uri); }
      delete() { mockFiles.delete(this.uri); }
    },
  };
});

async function importBook() {
  const bytes = zipSync({
    "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>'),
    "book.opf": strToU8('<package><metadata><dc:title>Reading test</dc:title><dc:language>ja</dc:language></metadata><manifest><item id="c1" href="chapter.html" media-type="text/html" /></manifest><spine><itemref idref="c1" /></spine></package>'),
    "chapter.html": strToU8('<html><body><p id="intro">今日は<ruby>日本<rt>にほん</rt></ruby>語を読む。</p><p id="later">続きの文章を読んでいます。</p></body></html>'),
  });
  const file = new File("reading.epub");
  Object.assign(file, { bytes: async () => bytes });
  return epubLibraryService.importFromFile(file);
}

type Message = { type: string; payload?: { page?: number; text?: string; passage?: unknown } };

describe("mobile EPUB runtime", () => {
  const readers: JSDOM[] = [];
  beforeEach(() => { jest.useFakeTimers(); mockFiles.clear(); });
  afterEach(() => { readers.splice(0).forEach((dom) => dom.window.close()); jest.useRealTimers(); });

  async function openReader(initialPage = 1, fontsReady?: Promise<void>) {
    const book = await importBook();
    const html = mockFiles.get(`documents/epub-library/${book.id}.html`)!;
    const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
    readers.push(dom);
    const { window } = dom;
    const messages: Message[] = [];
    Object.assign(window, { __WK_EPUB_INITIAL_PAGE__: initialPage, ReactNativeWebView: { postMessage: (raw: string) => messages.push(JSON.parse(raw)) } });
    Object.defineProperty(window, "innerWidth", { value: 400, configurable: true });
    if (fontsReady) Object.defineProperty(window.document, "fonts", { value: { ready: fontsReady } });
    const scroll = window.document.getElementById("wk-scroll")!;
    Object.defineProperties(scroll, { scrollWidth: { value: 3200 }, clientWidth: { value: 400 } });
    Object.assign(scroll, { scrollTo: ({ left }: { left: number }) => { scroll.scrollLeft = left; } });
    Object.assign(window.Range.prototype, {
      getClientRects() { return [{ left: 350, right: 380, top: 18, bottom: 50, width: 30, height: 32 }]; },
      getBoundingClientRect(this: Range) {
        // The second paragraph is on page 3 in the synthetic layout.
        const later = this.startContainer.parentElement?.id === "later";
        const right = 382 - (later ? 800 : 0) + scroll.scrollLeft;
        return { left: right - 20, right, top: 18, bottom: 50, width: 20, height: 32 };
      },
    });
    window.eval(window.document.querySelector("script")!.textContent!);
    await jest.advanceTimersByTimeAsync(200);
    const runtime = (window as unknown as { __WK_EPUB__: { [key: string]: (...args: any[]) => any } }).__WK_EPUB__;
    return { book, dom, window, messages, runtime };
  }

  it("restores the saved page without emitting a temporary page 1", async () => {
    const { runtime, messages } = await openReader(4);
    expect(messages.find((message) => message.type === "ready")?.payload?.page).toBe(4);
    expect(messages.filter((message) => message.type === "page").every((message) => message.payload?.page === 4)).toBe(true);
    expect(runtime.getPageInfo()).toEqual({ page: 4, totalPages: 8 });
  });

  it("waits for fonts before restoring and announcing the page", async () => {
    let finishFonts!: () => void;
    const ready = new Promise<void>((resolve) => { finishFonts = resolve; });
    const { messages, runtime } = await openReader(5, ready);
    expect(messages.some((message) => message.type === "ready" || message.type === "page")).toBe(false);
    finishFonts();
    await jest.advanceTimersByTimeAsync(200);
    expect(runtime.getPageInfo().page).toBe(5);
    expect(messages.find((message) => message.type === "ready")?.payload?.page).toBe(5);
  });

  it("anchors selected text without counting furigana and preserves book markup", async () => {
    const { window, messages, runtime } = await openReader();
    const paragraph = window.document.getElementById("intro")!;
    const originalHtml = paragraph.innerHTML;
    const range = window.document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()!.addRange(range);
    window.document.dispatchEvent(new window.Event("selectionchange"));
    await jest.advanceTimersByTimeAsync(150);
    const selection = messages.filter((message) => message.type === "selection").pop()!.payload!;
    expect(selection.text).toBe("今日は日本語を読む。");
    // The imported wrapper contributes eight whitespace characters before the paragraph.
    expect(selection.passage).toEqual({ start: { sectionId: "wk-epub-section-1", offset: 8 }, end: { sectionId: "wk-epub-section-1", offset: 18 } });
    runtime.setAnnotations([{ kind: "highlight", passage: selection.passage }]);
    await jest.advanceTimersByTimeAsync(30);
    expect(window.document.getElementById("wk-saved-highlight-overlays")!.children.length).toBeGreaterThan(0);
    expect(paragraph.innerHTML).toBe(originalHtml);
    runtime.setAnnotations([]);
    await jest.advanceTimersByTimeAsync(30);
    expect(window.document.getElementById("wk-saved-highlight-overlays")!.children).toHaveLength(0);
  });

  it("uses the text anchor to navigate even if the stored page number is stale", async () => {
    const { window, messages, runtime } = await openReader();
    const text = window.document.getElementById("later")!.firstChild!;
    const range = window.document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 4);
    window.getSelection()!.addRange(range);
    window.document.dispatchEvent(new window.Event("selectionchange"));
    await jest.advanceTimersByTimeAsync(150);
    const selection = messages.filter((message) => message.type === "selection").pop()!.payload!;
    runtime.goToAnnotation({ page: 1, passage: selection.passage });
    expect(runtime.getPageInfo().page).toBe(3);
    runtime.goToAnnotation({ page: 6 });
    expect(runtime.getPageInfo().page).toBe(6);
  });

  it("captures a bookmark excerpt and leaves the reading position unchanged", async () => {
    const { runtime, messages } = await openReader();
    runtime.captureBookmark();
    const bookmark = messages.find((message) => message.type === "bookmark")!.payload!;
    expect(bookmark.page).toBe(1);
    expect(bookmark.text).toContain("今日は日本語を読む。");
    expect(runtime.getPageInfo().page).toBe(1);
  });

  it("upgrades an existing imported book and retains its saved page", async () => {
    const book = await importBook();
    const recordPath = `documents/epub-library/${book.id}.json`;
    const htmlPath = `documents/epub-library/${book.id}.html`;
    const record = JSON.parse(mockFiles.get(recordPath)!);
    record.schemaVersion = 11;
    record.metadata.lastReadPage = 7;
    mockFiles.set(recordPath, JSON.stringify(record));
    mockFiles.set(htmlPath, mockFiles.get(htmlPath)!.replace("wk-horizontal-pagination-v15", "wk-horizontal-pagination-v14"));
    const restored = await epubLibraryService.getBook(book.id);
    expect(restored!.metadata.lastReadPage).toBe(7);
    expect(restored!.schemaVersion).toBe(12);
    expect(mockFiles.get(htmlPath)).toContain("wk-horizontal-pagination-v15");
    await Promise.all([epubLibraryService.updateReadingProgress(book.id, 3, 20), epubLibraryService.updateReadingProgress(book.id, 4, 20)]);
    expect((await epubLibraryService.getBook(book.id))!.metadata.lastReadPage).toBe(4);
  });
});
