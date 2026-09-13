import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EpubRendition, type EpubRenditionHandle, type EpubRenditionPageState } from "./EpubRendition";

const mocks = vi.hoisted(() => {
  type Listener = (...values: unknown[]) => void;
  type ContentHook = (chapterDocument: Document) => void;
  const renditionListeners = new Map<string, Set<Listener>>();
  const bookListeners = new Map<string, Set<Listener>>();
  const spineContentHooks: ContentHook[] = [];

  function on(listeners: Map<string, Set<Listener>>, event: string, listener: Listener) {
    const current = listeners.get(event) ?? new Set<Listener>();
    current.add(listener);
    listeners.set(event, current);
  }

  function off(listeners: Map<string, Set<Listener>>, event: string, listener: Listener) {
    listeners.get(event)?.delete(listener);
  }

  function emit(listeners: Map<string, Set<Listener>>, event: string, ...values: unknown[]) {
    listeners.get(event)?.forEach((listener) => listener(...values));
  }

  const initialLocation = {
    start: { cfi: "epubcfi(/6/2!/4/2)", percentage: 0.25, displayed: { page: 2, total: 8 } },
    atStart: false,
    atEnd: false,
  };
  const nextLocation = {
    start: { cfi: "epubcfi(/6/4!/4/2)", percentage: 0.5, displayed: { page: 4, total: 8 } },
    atStart: false,
    atEnd: false,
  };

  const rendition = {
    started: Promise.resolve(),
    location: initialLocation,
    themes: { register: vi.fn(), select: vi.fn() },
    annotations: { highlight: vi.fn(), remove: vi.fn(), underline: vi.fn() },
    flow: vi.fn(),
    spread: vi.fn(),
    direction: vi.fn(),
    display: vi.fn(async () => {
      emit(renditionListeners, "relocated", initialLocation);
    }),
    prev: vi.fn(async () => undefined),
    next: vi.fn(async () => {
      rendition.location = nextLocation;
      emit(renditionListeners, "relocated", nextLocation);
    }),
    on: vi.fn((event: string, listener: Listener) => on(renditionListeners, event, listener)),
    off: vi.fn((event: string, listener: Listener) => off(renditionListeners, event, listener)),
    destroy: vi.fn(),
  };
  const book = {
    ready: Promise.resolve(),
    rendition,
    spine: {
      length: 24,
      hooks: {
        content: {
          register: vi.fn((hook: ContentHook) => spineContentHooks.push(hook)),
          deregister: vi.fn((hook: ContentHook) => {
            const index = spineContentHooks.indexOf(hook);
            if (index >= 0) spineContentHooks.splice(index, 1);
          }),
        },
      },
    },
    locations: {
      generate: vi.fn(async () => ["epubcfi(/6/2!/4/2)", "epubcfi(/6/4!/4/2)"]),
      locationFromCfi: vi.fn((cfi: string) => cfi === nextLocation.start.cfi ? 12 : cfi === initialLocation.start.cfi ? 6 : -1),
      percentageFromCfi: vi.fn((cfi: string) => cfi === nextLocation.start.cfi ? 0.55 : cfi === initialLocation.start.cfi ? 0.3 : null),
      length: vi.fn(() => 24),
    },
    renderTo: vi.fn(() => rendition),
    on: vi.fn((event: string, listener: Listener) => on(bookListeners, event, listener)),
    off: vi.fn((event: string, listener: Listener) => off(bookListeners, event, listener)),
    destroy: vi.fn(() => rendition.destroy()),
  };
  const createBook = vi.fn((data?: ArrayBuffer, options?: unknown) => {
    void data;
    void options;
    return book;
  });

  return {
    book,
    bookListeners,
    createBook,
    emitBook: (event: string, value: unknown) => emit(bookListeners, event, value),
    emitRendition: (event: string, ...values: unknown[]) => emit(renditionListeners, event, ...values),
    initialLocation,
    nextLocation,
    rendition,
    renditionListeners,
    spineContentHooks,
  };
});

vi.mock("epubjs", () => ({ default: mocks.createBook }));

describe("EpubRendition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bookListeners.clear();
    mocks.renditionListeners.clear();
    mocks.spineContentHooks.length = 0;
    mocks.book.spine.length = 24;
    mocks.rendition.location = mocks.initialLocation;
    document.documentElement.style.setProperty("--color-surface", "#f4f0e8");
    document.documentElement.style.setProperty("--color-ink", "#29251f");
    document.documentElement.style.setProperty("--color-accent", "#9b4f2e");
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("style");
  });

  it("opens raw EPUB bytes with vertical RTL pagination and owns navigation lifecycle", async () => {
    const raw = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
    const source = { arrayBuffer: vi.fn().mockResolvedValue(raw) } as unknown as Blob;
    const ref = createRef<EpubRenditionHandle>();
    const states: EpubRenditionPageState[] = [];
    const onError = vi.fn();
    const view = render(
      <EpubRendition
        ref={ref}
        source={source}
        initialCfi="epubcfi(/6/2!/4/2)"
        className="book-rendition"
        onStateChange={(state) => states.push(state)}
        onError={onError}
      />,
    );

    await waitFor(() => expect(states).toContainEqual({
      status: "relocated",
      cfi: "epubcfi(/6/2!/4/2)",
      progress: 0.3,
      page: 7,
      total: 24,
      atStart: false,
      atEnd: false,
      locationsReady: true,
      displayedPage: 2,
      displayedTotal: 8,
    }));
    expect(states[0]).toEqual({
      status: "ready",
      cfi: "epubcfi(/6/2!/4/2)",
      progress: 0.25,
      page: 2,
      total: 8,
      atStart: false,
      atEnd: false,
      locationsReady: false,
      displayedPage: 2,
      displayedTotal: 8,
    });

    expect(source.arrayBuffer).toHaveBeenCalledOnce();
    expect(mocks.createBook).toHaveBeenCalledWith(raw, {
      replacements: "blobUrl",
      requestMethod: expect.any(Function),
    });
    expect(mocks.book.renderTo).toHaveBeenCalledWith(screen.getByTestId("epub-rendition"), {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
      defaultDirection: "rtl",
      allowScriptedContent: false,
    });
    expect(screen.getByTestId("epub-rendition")).toHaveClass("book-rendition");
    expect(mocks.rendition.flow).toHaveBeenCalledWith("paginated");
    expect(mocks.rendition.spread).toHaveBeenCalledWith("none");
    expect(mocks.rendition.direction).toHaveBeenCalledWith("rtl");
    expect(mocks.rendition.display).toHaveBeenCalledWith("epubcfi(/6/2!/4/2)");
    expect(mocks.book.locations.generate).toHaveBeenCalledWith(1600);
    expect(mocks.book.locations.locationFromCfi).toHaveBeenCalledWith("epubcfi(/6/2!/4/2)");
    expect(mocks.book.locations.percentageFromCfi).toHaveBeenCalledWith("epubcfi(/6/2!/4/2)");
    expect(mocks.book.locations.length).toHaveBeenCalled();

    expect(mocks.rendition.themes.register).toHaveBeenCalledWith(
      "kakehashi-vertical",
      expect.objectContaining({
        "html, body": expect.objectContaining({
          background: "#f4f0e8",
          color: "#29251f",
          cursor: "default !important",
          "writing-mode": "vertical-rl !important",
          "text-orientation": "mixed !important",
          direction: "ltr !important",
        }),
        "body, body *": { cursor: "pointer !important" },
        a: { color: "#9b4f2e" },
        "img, svg, video": expect.objectContaining({
          "writing-mode": "horizontal-tb !important",
          "object-fit": "contain !important",
        }),
      }),
    );
    expect(mocks.rendition.themes.select).toHaveBeenCalledWith("kakehashi-vertical");

    await act(async () => ref.current?.next());
    expect(mocks.rendition.next).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({
      status: "relocated",
      cfi: "epubcfi(/6/4!/4/2)",
      progress: 0.55,
      page: 13,
      total: 24,
      atStart: false,
      atEnd: false,
      locationsReady: true,
      displayedPage: 4,
      displayedTotal: 8,
    });

    act(() => mocks.emitRendition("relocated", {
      start: { cfi: "epubcfi(/unresolved)", percentage: 0.625, displayed: { page: 5, total: 8 } },
      atStart: false,
      atEnd: false,
    }));
    expect(states.at(-1)).toEqual({
      status: "relocated",
      cfi: "epubcfi(/unresolved)",
      progress: 0.625,
      page: 5,
      total: 8,
      atStart: false,
      atEnd: false,
      locationsReady: false,
      displayedPage: 5,
      displayedTotal: 8,
    });

    act(() => mocks.emitRendition("relocated", {
      start: { cfi: "epubcfi(/single-local-page)", displayed: { page: 1, total: 1 } },
      atStart: true,
      atEnd: false,
    }));
    expect(states.at(-1)).toEqual({
      status: "relocated",
      cfi: "epubcfi(/single-local-page)",
      progress: 0,
      page: 1,
      total: 1,
      atStart: true,
      atEnd: false,
      locationsReady: false,
      displayedPage: 1,
      displayedTotal: 1,
    });

    await act(async () => ref.current?.previous());
    expect(mocks.rendition.prev).toHaveBeenCalledOnce();

    const displayError = new Error("Chapter display failed");
    act(() => mocks.emitRendition("displayerror", displayError));
    expect(onError).toHaveBeenCalledWith(displayError);

    view.unmount();
    expect(mocks.rendition.off).toHaveBeenCalledWith("relocated", expect.any(Function));
    expect(mocks.rendition.off).toHaveBeenCalledWith("displayerror", expect.any(Function));
    expect(mocks.book.off).toHaveBeenCalledWith("openFailed", expect.any(Function));
    expect(mocks.book.destroy).toHaveBeenCalledOnce();
    expect(mocks.rendition.destroy).toHaveBeenCalledOnce();
  });

  it("retries the first spine item when a saved CFI is stale", async () => {
    mocks.rendition.display.mockRejectedValueOnce(new Error("No Section Found"));
    const states: EpubRenditionPageState[] = [];
    const onError = vi.fn();
    const view = render(<EpubRendition
      source={{ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as Blob}
      initialCfi="epubcfi(/stale)"
      onStateChange={(state) => states.push(state)}
      onError={onError}
    />);

    await waitFor(() => expect(mocks.rendition.display).toHaveBeenCalledTimes(2));
    expect(mocks.rendition.display.mock.calls[0]).toEqual(["epubcfi(/stale)"]);
    expect(mocks.rendition.display.mock.calls[1]).toEqual([]);
    await waitFor(() => expect(states.some((state) => state.status === "ready")).toBe(true));
    expect(onError).not.toHaveBeenCalled();

    view.unmount();
  });

  it("injects a pre-serialization CSP that permits embedded assets but no network origins", async () => {
    const view = render(<EpubRendition
      source={{ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as Blob}
    />);

    await waitFor(() => expect(mocks.book.spine.hooks.content.register).toHaveBeenCalledOnce());
    expect(mocks.book.spine.hooks.content.register.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.book.renderTo.mock.invocationCallOrder[0]);
    const chapterDocument = document.implementation.createHTMLDocument("Untrusted chapter");
    chapterDocument.head.innerHTML = `<meta http-equiv="refresh" content="0;url=https://tracker.example" />
      <link rel="stylesheet" href="https://tracker.example/book.css" />`;
    chapterDocument.body.innerHTML = `<img src="blob:https://kakehashi.local/embedded-cover" />
      <img src="https://tracker.example/pixel.png" />
      <img src="../images/packaged.png" />`;
    mocks.spineContentHooks[0](chapterDocument);

    const policy = chapterDocument.head.firstElementChild;
    expect(policy?.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(policy?.getAttribute("content")).toContain("default-src 'none'");
    expect(policy?.getAttribute("content")).toContain("img-src blob: data:");
    expect(policy?.getAttribute("content")).toContain("style-src 'unsafe-inline' blob: data:");
    expect(policy?.getAttribute("content")).toContain("font-src blob: data:");
    expect(policy?.getAttribute("content")).toContain("media-src blob: data:");
    expect(policy?.getAttribute("content")).toContain("connect-src 'none'");
    expect(policy?.getAttribute("content")).toContain("frame-src 'none'");
    expect(policy?.getAttribute("content")).toContain("object-src 'none'");
    expect(chapterDocument.head.querySelector('meta[http-equiv="refresh"]')).not.toBeInTheDocument();
    expect(chapterDocument.body.querySelector('img[src^="blob:"]')).not.toBeNull();
    expect(chapterDocument.querySelector('link[href^="https:"]')).not.toBeInTheDocument();
    expect(chapterDocument.querySelector('img[src^="https:"]')).not.toBeInTheDocument();
    expect(chapterDocument.querySelector('img[src="../images/packaged.png"]')).not.toBeNull();
    const rootStyle = (chapterDocument.documentElement as HTMLElement).style;
    expect(rootStyle.getPropertyValue("writing-mode")).toBe("vertical-rl");
    expect(rootStyle.getPropertyValue("text-orientation")).toBe("mixed");
    expect(rootStyle.getPropertyValue("direction")).toBe("ltr");

    const createOptions = mocks.createBook.mock.calls[0]?.[1] as { requestMethod?: (...args: unknown[]) => Promise<unknown> };
    await expect(createOptions.requestMethod?.("https://tracker.example/font.woff2")).rejects.toThrow("blocked");

    view.unmount();
  });

  it("reports ready before location generation completes, then publishes definitive whole-book pages", async () => {
    let finishLocations: (() => void) | undefined;
    mocks.book.locations.generate.mockImplementationOnce(() => new Promise<string[]>((resolve) => {
      finishLocations = () => resolve([mocks.initialLocation.start.cfi]);
    }));
    const states: EpubRenditionPageState[] = [];
    const view = render(<EpubRendition
      source={{ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as Blob}
      onStateChange={(state) => states.push(state)}
    />);

    await waitFor(() => expect(states[0]).toEqual(expect.objectContaining({
      status: "ready",
      page: 2,
      total: 8,
      locationsReady: false,
    })));
    expect(mocks.book.locations.generate).toHaveBeenCalledWith(1600);
    expect(states).toHaveLength(1);

    await act(async () => finishLocations?.());
    await waitFor(() => expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "relocated",
      page: 7,
      total: 24,
      locationsReady: true,
    })));

    view.unmount();
  });

  it("uses spine indexes as definitive pages for image-only EPUBs", async () => {
    const imageLocation = {
      start: { cfi: "epubcfi(/6/6)", index: 2, displayed: { page: 1, total: 1 } },
      atStart: false,
      atEnd: false,
    };
    mocks.rendition.location = imageLocation as unknown as typeof mocks.rendition.location;
    mocks.rendition.display.mockImplementationOnce(async () => {
      mocks.emitRendition("relocated", imageLocation);
    });
    mocks.book.locations.generate.mockResolvedValueOnce([]);
    mocks.book.locations.length.mockReturnValueOnce(0);
    mocks.book.spine.length = 5;
    const states: EpubRenditionPageState[] = [];
    const view = render(<EpubRendition
      source={{ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as Blob}
      onStateChange={(state) => states.push(state)}
    />);

    await waitFor(() => expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "relocated",
      page: 3,
      total: 5,
      progress: 0.5,
      locationsReady: true,
    })));

    view.unmount();
  });

  it("selects a ruby-spanning word from an iframe click and keeps only a filled highlight", async () => {
    const onWordSelect = vi.fn();
    const onLookupSourcesChange = vi.fn();
    const ref = createRef<EpubRenditionHandle>();
    const view = render(<EpubRendition
      ref={ref}
      source={{ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as Blob}
      onLookupSourcesChange={onLookupSourcesChange}
      onWordSelect={onWordSelect}
    />);
    await waitFor(() => expect(mocks.rendition.display).toHaveBeenCalled());

    const chapter = document.implementation.createHTMLDocument("Lookup chapter");
    chapter.body.innerHTML = `<p id="story"><ruby>小<rt>ちい</rt></ruby>さいかばんです。</p>`;
    const paragraph = chapter.getElementById("story")!;
    const baseText = paragraph.querySelector("ruby")!.firstChild as Text;
    const createRange = chapter.createRange.bind(chapter);
    vi.spyOn(chapter, "createRange").mockImplementation(() => {
      const range = createRange();
      Object.defineProperty(range, "getClientRects", {
        configurable: true,
        value: () => [{ left: 0, right: 20, top: 0, bottom: 20, width: 20, height: 20 }],
      });
      return range;
    });
    Object.defineProperty(chapter, "caretPositionFromPoint", {
      configurable: true,
      value: () => ({ offsetNode: baseText, offset: 0 }),
    });
    const contents = {
      document: chapter,
      content: chapter.body,
      cfiFromRange: vi.fn((range: Range) => `epubcfi(${range.toString()})`),
    };

    act(() => mocks.emitRendition("rendered", {}, { contents }));
    expect(onLookupSourcesChange).toHaveBeenCalledWith([{ id: "epub-lookup-1", text: "小さいかばんです。" }]);

    act(() => mocks.emitRendition("click", {
      button: 0,
      clientX: 10,
      clientY: 10,
      defaultPrevented: false,
      target: paragraph,
    }, contents));

    expect(onWordSelect).toHaveBeenLastCalledWith(expect.objectContaining({
      id: "epub-word-1",
      sourceId: "epub-lookup-1",
      surface: "小さい",
      text: "小さいかばんです。",
    }));
    expect(mocks.rendition.annotations.highlight).not.toHaveBeenCalled();

    act(() => ref.current?.setWordSelection("epub-word-1", "小さい"));
    expect(mocks.rendition.annotations.highlight).toHaveBeenCalledTimes(2);
    expect(mocks.rendition.annotations.highlight).toHaveBeenCalledWith(
      expect.any(String),
      { kind: "word-selection" },
      undefined,
      "kakehashi-epub-word-highlight",
      expect.objectContaining({ fill: "#9b4f2e", "fill-opacity": "0.26" }),
    );
    expect(mocks.rendition.annotations.underline).not.toHaveBeenCalled();

    act(() => mocks.emitRendition("keydown", { key: "Escape" }));
    expect(onWordSelect).toHaveBeenLastCalledWith(null);
    expect(mocks.rendition.annotations.remove).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(mocks.rendition.off).toHaveBeenCalledWith("click", expect.any(Function));
    expect(mocks.rendition.off).toHaveBeenCalledWith("rendered", expect.any(Function));
    expect(mocks.rendition.off).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it.each([
    { label: "large archive", size: 33 * 1024 * 1024, spineLength: 24 },
    { label: "long reading order", size: 1024 * 1024, spineLength: 201 },
  ])("does not scan every chapter for locations in a $label EPUB", async ({ size, spineLength }) => {
    mocks.book.spine.length = spineLength;
    const states: EpubRenditionPageState[] = [];
    const source = {
      size,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Blob;
    const view = render(<EpubRendition source={source} onStateChange={(state) => states.push(state)} />);

    await waitFor(() => expect(states[0]).toEqual(expect.objectContaining({ status: "ready", locationsReady: false })));
    expect(mocks.book.locations.generate).not.toHaveBeenCalled();

    view.unmount();
  });

  it("still generates locations at the documented background-index boundary", async () => {
    mocks.book.spine.length = 200;
    const source = {
      size: 32 * 1024 * 1024,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Blob;
    const view = render(<EpubRendition source={source} />);

    await waitFor(() => expect(mocks.book.locations.generate).toHaveBeenCalledWith(1600));

    view.unmount();
  });
});
