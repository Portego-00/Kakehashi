"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from "react";
import type { Book, Rendition } from "epubjs";
import {
  adjustEpubCaretToTappedCharacter,
  buildEpubWordSelection,
  epubCaretFromPoint,
  epubLookupTextSources,
  epubRangesForOffsets,
  isEpubLookupIgnoredTarget,
  nearestEpubTermRange,
  type EpubWordSelectionAnchor,
  type EpubWordSelectionRequest,
} from "./epub-word-selection";

const VERTICAL_THEME_NAME = "kakehashi-vertical";
const PAGE_SIZE = 1600;
const MAX_BACKGROUND_LOCATION_BYTES = 32 * 1024 * 1024;
const MAX_BACKGROUND_LOCATION_SPINE_ITEMS = 200;
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const EPUB_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "img-src blob: data:",
  "style-src 'unsafe-inline' blob: data:",
  "font-src blob: data:",
  "media-src blob: data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export interface EpubRenditionHandle {
  previous(): Promise<void>;
  next(): Promise<void>;
  setWordSelection(requestId: string, text: string): void;
  clearWordSelection(): void;
}

export interface EpubRenditionPageState {
  status: "ready" | "relocated";
  cfi: string | null;
  progress: number | null;
  page: number | null;
  total: number | null;
  atStart: boolean;
  atEnd: boolean;
  locationsReady: boolean;
  displayedPage?: number | null;
  displayedTotal?: number | null;
}

export interface EpubLookupSource {
  id: string;
  text: string;
}

export interface EpubRenditionProps {
  source: Blob;
  initialCfi?: string;
  className?: string;
  onStateChange?: (state: EpubRenditionPageState) => void;
  onLookupSourcesChange?: (sources: EpubLookupSource[]) => void;
  onWordSelect?: (selection: EpubWordSelectionRequest | null) => void;
  onError?: (error: Error) => void;
}

export type { EpubWordSelectionRequest } from "./epub-word-selection";

interface EpubJsLocation {
  start?: {
    cfi?: unknown;
    index?: unknown;
    percentage?: unknown;
    page?: unknown;
    displayed?: { page?: unknown; total?: unknown };
  };
  atStart?: unknown;
  atEnd?: unknown;
}

interface EpubJsLocations {
  locationFromCfi(cfi: string): unknown;
  percentageFromCfi(cfi: string): unknown;
  length(): unknown;
}

interface EpubJsContents {
  document: Document;
  content: Element;
  cfiFromRange(range: Range): string;
}

interface EpubJsView {
  contents?: EpubJsContents;
}

interface EpubClickEvent {
  button?: number;
  clientX?: number;
  clientY?: number;
  defaultPrevented?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

type ActiveEpubWordSelection = EpubWordSelectionAnchor & {
  contents: EpubJsContents;
  highlightCfis: string[];
};

const EPUB_WORD_HIGHLIGHT_CLASS = "kakehashi-epub-word-highlight";

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function epubSpineLength(spine: unknown) {
  return finiteNumber(spine && typeof spine === "object" && "length" in spine ? spine.length : null);
}

function shouldGenerateWholeBookLocations(source: Blob, spine: unknown) {
  const sourceSize = finiteNumber(source.size);
  const sectionCount = epubSpineLength(spine);
  return (sourceSize === null || sourceSize <= MAX_BACKGROUND_LOCATION_BYTES)
    && (sectionCount === null || sectionCount <= MAX_BACKGROUND_LOCATION_SPINE_ITEMS);
}

function pageState(
  status: EpubRenditionPageState["status"],
  location: EpubJsLocation | null | undefined,
  locations?: EpubJsLocations,
  spine?: unknown,
  fallbackCfi?: string,
): EpubRenditionPageState {
  const cfi = typeof location?.start?.cfi === "string" ? location.start.cfi : fallbackCfi || null;
  let wholeBookPage: number | null = null;
  let wholeBookTotal: number | null = null;
  let wholeBookProgress: number | null = null;
  let locationsReady = false;
  if (cfi && locations) {
    try {
      const locationIndex = finiteNumber(locations.locationFromCfi(cfi));
      const locationCount = finiteNumber(locations.length());
      const percentage = finiteNumber(locations.percentageFromCfi(cfi));
      if (locationIndex !== null && locationIndex >= 0 && locationCount !== null && locationCount > 0) {
        wholeBookTotal = Math.floor(locationCount);
        wholeBookPage = Math.min(wholeBookTotal, Math.floor(locationIndex) + 1);
        locationsReady = true;
      }
      if (percentage !== null) wholeBookProgress = Math.min(1, Math.max(0, percentage));

      const displayedTotal = finiteNumber(location?.start?.displayed?.total);
      const spineIndex = finiteNumber(location?.start?.index);
      const spineLength = epubSpineLength(spine);
      if (
        locationCount === 0
        && displayedTotal !== null
        && displayedTotal <= 1
        && spineIndex !== null
        && spineIndex >= 0
        && spineLength !== null
        && spineLength > 0
      ) {
        wholeBookTotal = Math.floor(spineLength);
        wholeBookPage = Math.min(wholeBookTotal, Math.floor(spineIndex) + 1);
        wholeBookProgress = wholeBookTotal > 1 ? Math.min(1, spineIndex / (wholeBookTotal - 1)) : 1;
        locationsReady = true;
      }
    } catch {
      // Some EPUBs contain CFIs that cannot be resolved by generated locations.
      // The displayed rendition values below remain a useful fallback.
    }
  }

  if (wholeBookProgress === null) {
    const spineIndex = finiteNumber(location?.start?.index);
    const sectionCount = epubSpineLength(spine);
    const displayedPage = finiteNumber(location?.start?.displayed?.page);
    const displayedTotal = finiteNumber(location?.start?.displayed?.total);
    if (spineIndex !== null && spineIndex >= 0 && sectionCount !== null && sectionCount > 0) {
      const sectionProgress = displayedPage !== null && displayedTotal !== null && displayedTotal > 0
        ? Math.max(0, Math.min(1, (displayedPage - 1) / displayedTotal))
        : 0;
      wholeBookProgress = location?.atEnd === true
        ? 1
        : Math.max(0, Math.min(1, (spineIndex + sectionProgress) / sectionCount));
    }
  }

  const page = wholeBookPage
    ?? finiteNumber(location?.start?.displayed?.page)
    ?? finiteNumber(location?.start?.page);
  const total = wholeBookTotal ?? finiteNumber(location?.start?.displayed?.total);
  const locatedProgress = wholeBookProgress ?? finiteNumber(location?.start?.percentage);
  const progress = locatedProgress === null
    ? page !== null && total !== null && total > 0
      ? total > 1 ? Math.min(1, Math.max(0, (page - 1) / (total - 1))) : location?.atEnd === true ? 1 : 0
      : null
    : Math.min(1, Math.max(0, locatedProgress));

  return {
    status,
    cfi,
    progress,
    page,
    total,
    atStart: location?.atStart === true,
    atEnd: location?.atEnd === true,
    locationsReady,
    displayedPage: finiteNumber(location?.start?.displayed?.page),
    displayedTotal: finiteNumber(location?.start?.displayed?.total),
  };
}

function blockEpubNetworkRequest(): Promise<never> {
  return Promise.reject(new Error("External EPUB network requests are blocked."));
}

const EPUB_SUBRESOURCE_URL_ATTRIBUTES: Record<string, readonly string[]> = {
  audio: ["src"],
  embed: ["src"],
  iframe: ["src"],
  image: ["href", "xlink:href"],
  img: ["src", "srcset"],
  input: ["src"],
  link: ["href"],
  object: ["data"],
  script: ["src"],
  source: ["src", "srcset"],
  track: ["src"],
  use: ["href", "xlink:href"],
  video: ["poster", "src"],
};

function containsRemoteEpubUrl(value: string) {
  // Packaged EPUB assets are relative when this hook runs and are replaced with
  // blob URLs by EPUB.js afterwards. Keep those, data URLs, and fragments, but
  // remove subresources that would make the iframe initiate a network request.
  return /(?:^|[\s,])(?:https?:)?\/\//iu.test(value.trim())
    || /(?:^|[\s,])(?:ftp|file|javascript|vbscript):/iu.test(value.trim());
}

function prepareEpubChapterDocument(chapterDocument: Document) {
  for (const meta of Array.from(chapterDocument.getElementsByTagName("meta"))) {
    if (meta.getAttribute("http-equiv")?.trim().toLocaleLowerCase() === "refresh") meta.remove();
  }

  for (const element of Array.from(chapterDocument.getElementsByTagName("*"))) {
    const attributes = EPUB_SUBRESOURCE_URL_ATTRIBUTES[element.localName.toLocaleLowerCase()];
    if (!attributes) continue;
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value && containsRemoteEpubUrl(value)) element.removeAttribute(attribute);
    }
  }

  const root = chapterDocument.documentElement;
  if (!root) return;
  if (root.localName.toLocaleLowerCase() === "html") {
    // EPUB.js chooses its pagination axis from the computed writing mode on
    // <html> while loading the iframe. Many InDesign EPUBs put only the legacy
    // -epub-writing-mode declaration on <body>, so the later rendition theme is
    // too late and the entire vertical chapter gets measured as one horizontal
    // page. Put the intended mode on the root before EPUB.js performs that sniff.
    const rootStyle = (root as HTMLElement).style;
    rootStyle.setProperty("writing-mode", "vertical-rl", "important");
    rootStyle.setProperty("-webkit-writing-mode", "vertical-rl", "important");
    rootStyle.setProperty("text-orientation", "mixed", "important");
    rootStyle.setProperty("direction", "ltr", "important");
  }
  let head = chapterDocument.head
    ?? Array.from(chapterDocument.getElementsByTagNameNS("*", "head"))[0]
    ?? null;
  if (!head) {
    head = chapterDocument.createElementNS(root.namespaceURI || XHTML_NAMESPACE, "head") as HTMLHeadElement;
    const body = Array.from(chapterDocument.getElementsByTagNameNS("*", "body"))[0];
    root.insertBefore(head, body ?? root.firstChild);
  }

  const policy = chapterDocument.createElementNS(head.namespaceURI || XHTML_NAMESPACE, "meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", EPUB_CONTENT_SECURITY_POLICY);
  head.insertBefore(policy, head.firstChild);
}

function errorFrom(value: unknown) {
  if (value instanceof Error) return value;
  if (typeof value === "string" && value.trim()) return new Error(value);
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return new Error(value.message);
  }
  return new Error("The EPUB could not be rendered.");
}

function colorToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function verticalTheme() {
  const rootStyles = window.getComputedStyle(window.document.documentElement);
  const surface = colorToken(rootStyles, "--color-surface", "#f7f5f2");
  const ink = colorToken(rootStyles, "--color-ink", "#242321");
  const accent = colorToken(rootStyles, "--color-accent", "#76553a");

  return {
    "html, body": {
      background: surface,
      color: ink,
      cursor: "default !important",
      "writing-mode": "vertical-rl !important",
      "-webkit-writing-mode": "vertical-rl !important",
      "text-orientation": "mixed !important",
      // Japanese glyphs run top-to-bottom; vertical-rl already makes columns
      // and paginated flow progress from right to left.
      direction: "ltr !important",
    },
    "body, body *": {
      cursor: "pointer !important",
    },
    a: { color: accent },
    "img, svg, video": {
      cursor: "default !important",
      "writing-mode": "horizontal-tb !important",
      "-webkit-writing-mode": "horizontal-tb !important",
      direction: "ltr !important",
      display: "block",
      "object-fit": "contain !important",
      "break-inside": "avoid",
      "page-break-inside": "avoid",
    },
    "audio, canvas, embed, object": { cursor: "default !important" },
    "button, input, select, textarea": { cursor: "auto !important" },
  };
}

function EpubRenditionComponent(
  { source, initialCfi, className, onStateChange, onLookupSourcesChange, onWordSelect, onError }: EpubRenditionProps,
  ref: ForwardedRef<EpubRenditionHandle>,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const onLookupSourcesChangeRef = useRef(onLookupSourcesChange);
  const onWordSelectRef = useRef(onWordSelect);
  const onErrorRef = useRef(onError);
  const setWordSelectionRef = useRef<(requestId: string, text: string) => void>(() => undefined);
  const clearWordSelectionRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onLookupSourcesChangeRef.current = onLookupSourcesChange;
    onWordSelectRef.current = onWordSelect;
    onErrorRef.current = onError;
  }, [onError, onLookupSourcesChange, onStateChange, onWordSelect]);

  const reportError = useCallback((value: unknown) => {
    const error = errorFrom(value);
    onErrorRef.current?.(error);
    return error;
  }, []);

  const navigate = useCallback(async (direction: "previous" | "next") => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      clearWordSelectionRef.current();
      onWordSelectRef.current?.(null);
      if (direction === "previous") await rendition.prev();
      else await rendition.next();
    } catch (value) {
      throw reportError(value);
    }
  }, [reportError]);

  useImperativeHandle(ref, () => ({
    previous: () => navigate("previous"),
    next: () => navigate("next"),
    setWordSelection: (requestId, text) => setWordSelectionRef.current(requestId, text),
    clearWordSelection: () => clearWordSelectionRef.current(),
  }), [navigate]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let book: Book | null = null;
    let rendition: Rendition | null = null;
    let latestLocation: EpubJsLocation | null = null;
    let ready = false;
    let generatedLocations: EpubJsLocations | undefined;
    let wordTapCount = 0;
    let lookupSourceCount = 0;
    let activeWord: ActiveEpubWordSelection | null = null;
    const lookupSourceByContainer = new WeakMap<Element, EpubLookupSource>();

    const publishLookupSources = (contents: EpubJsContents) => {
      const sources = epubLookupTextSources(contents.content).map(({ container, text }) => {
        const previous = lookupSourceByContainer.get(container);
        const source = previous?.text === text
          ? previous
          : { id: `epub-lookup-${++lookupSourceCount}`, text };
        lookupSourceByContainer.set(container, source);
        return source;
      });
      onLookupSourcesChangeRef.current?.(sources);
    };

    const clearWordSelection = () => {
      if (rendition && activeWord) {
        for (const cfi of activeWord.highlightCfis) {
          try {
            rendition.annotations.remove(cfi, "highlight");
          } catch {
            // The highlighted iframe may already have been unloaded by EPUB.js.
          }
        }
      }
      activeWord = null;
    };

    const setWordSelection = (requestId: string, text: string) => {
      if (!rendition || !activeWord || activeWord.request.id !== requestId) return;
      for (const cfi of activeWord.highlightCfis) {
        try {
          rendition.annotations.remove(cfi, "highlight");
        } catch {
          // A reflow can remove the view before the lookup response arrives.
        }
      }
      activeWord.highlightCfis = [];

      const selectedRange = nearestEpubTermRange(activeWord.joinedText, text, activeWord.absoluteIndex)
        ?? { start: activeWord.initialStart, end: activeWord.initialEnd };
      const rootStyles = window.getComputedStyle(window.document.documentElement);
      const accent = colorToken(rootStyles, "--color-accent", "#9b4f2e");
      for (const range of epubRangesForOffsets(activeWord, selectedRange.start, selectedRange.end)) {
        try {
          const cfiRange = activeWord.contents.cfiFromRange(range);
          if (!cfiRange) continue;
          rendition.annotations.highlight(cfiRange, { kind: "word-selection" }, undefined, EPUB_WORD_HIGHLIGHT_CLASS, {
            fill: accent,
            "fill-opacity": "0.26",
            stroke: accent,
            "stroke-opacity": "0.52",
            "stroke-width": "1",
            "mix-blend-mode": "normal",
          });
          activeWord.highlightCfis.push(cfiRange);
        } catch {
          // Invalid ranges in one malformed inline node should not close the book.
        }
      }
    };

    setWordSelectionRef.current = setWordSelection;
    clearWordSelectionRef.current = clearWordSelection;

    const handleBookError = (value: unknown) => {
      if (!disposed) reportError(value);
    };
    const handleRenditionError = (value: unknown) => {
      if (!disposed) reportError(value);
    };
    const handleRelocated = (location: EpubJsLocation) => {
      if (activeWord) {
        clearWordSelection();
        onWordSelectRef.current?.(null);
      }
      latestLocation = location;
      if (ready && !disposed) {
        onStateChangeRef.current?.(pageState("relocated", location, generatedLocations, book?.spine));
      }
    };
    const handleRendered = (_section: unknown, view: EpubJsView) => {
      if (view?.contents) publishLookupSources(view.contents);
    };
    const handleContentClick = (event: EpubClickEvent, contents: EpubJsContents) => {
      if (
        event.button !== undefined && event.button !== 0
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
      ) return;
      if (event.defaultPrevented || isEpubLookupIgnoredTarget(event.target ?? null)) {
        clearWordSelection();
        onWordSelectRef.current?.(null);
        return;
      }
      const clientX = finiteNumber(event.clientX);
      const clientY = finiteNumber(event.clientY);
      const document = contents?.document;
      const content = contents?.content;
      if (clientX === null || clientY === null || !document || !content) return;
      const caret = epubCaretFromPoint(document, clientX, clientY);
      const adjustedCaret = caret ? adjustEpubCaretToTappedCharacter(document, caret, clientX, clientY) : null;
      const selection = adjustedCaret
        ? buildEpubWordSelection(document, content, adjustedCaret.node, adjustedCaret.offset, `epub-word-${++wordTapCount}`)
        : null;
      clearWordSelection();
      if (!selection) {
        onWordSelectRef.current?.(null);
        return;
      }
      let lookupSource = lookupSourceByContainer.get(selection.container);
      if (!lookupSource || lookupSource.text !== selection.joinedText) {
        publishLookupSources(contents);
        lookupSource = lookupSourceByContainer.get(selection.container);
      }
      if (lookupSource?.text === selection.joinedText) selection.request.sourceId = lookupSource.id;
      activeWord = Object.assign(selection, { contents, highlightCfis: [] });
      onWordSelectRef.current?.(selection.request);
    };
    const handleContentKeyDown = (event: { key?: string }) => {
      if (event.key !== "Escape" || !activeWord) return;
      clearWordSelection();
      onWordSelectRef.current?.(null);
    };

    const initialize = async () => {
      try {
        const [epubModule, data] = await Promise.all([import("epubjs"), source.arrayBuffer()]);
        if (disposed) return;

        book = epubModule.default(data, {
          replacements: "blobUrl",
          requestMethod: blockEpubNetworkRequest,
        });
        book.spine.hooks.content.register(prepareEpubChapterDocument);
        book.on("openFailed", handleBookError);
        rendition = book.renderTo(mount, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
          defaultDirection: "rtl",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        rendition.on("relocated", handleRelocated);
        rendition.on("rendered", handleRendered);
        rendition.on("click", handleContentClick);
        rendition.on("keydown", handleContentKeyDown);
        rendition.on("displayerror", handleRenditionError);
        rendition.on("loaderror", handleRenditionError);
        rendition.themes.register(VERTICAL_THEME_NAME, verticalTheme());
        rendition.themes.select(VERTICAL_THEME_NAME);

        await Promise.all([book.ready, rendition.started]);
        if (disposed) return;

        // EPUB metadata can override constructor defaults during startup, so force
        // the Japanese book layout again immediately before the first display.
        rendition.flow("paginated");
        rendition.spread("none");
        rendition.direction("rtl");
        let displayedCfi = initialCfi?.trim() || undefined;
        if (displayedCfi) {
          try {
            await rendition.display(displayedCfi);
          } catch {
            latestLocation = null;
            displayedCfi = undefined;
            await rendition.display();
          }
        } else {
          await rendition.display();
        }
        if (disposed) return;

        // Reveal the first spine item before walking the rest of the book. The
        // initial rendition values are replaced by whole-book locations below.
        ready = true;
        const displayedLocation = latestLocation ?? (rendition.location as unknown as EpubJsLocation | undefined);
        onStateChangeRef.current?.(pageState("ready", displayedLocation, undefined, book.spine, displayedCfi));

        if (!shouldGenerateWholeBookLocations(source, book.spine)) return;

        try {
          await book.locations.generate(PAGE_SIZE);
          generatedLocations = book.locations;
        } catch {
          return;
        }
        if (disposed) return;

        const resolvedLocation = latestLocation ?? (rendition.location as unknown as EpubJsLocation | undefined);
        onStateChangeRef.current?.(pageState("relocated", resolvedLocation, generatedLocations, book.spine, displayedCfi));
      } catch (value) {
        if (!disposed) reportError(value);
      }
    };

    void initialize();

    return () => {
      disposed = true;
      clearWordSelection();
      setWordSelectionRef.current = () => undefined;
      clearWordSelectionRef.current = () => undefined;
      if (renditionRef.current === rendition) renditionRef.current = null;
      rendition?.off("relocated", handleRelocated);
      rendition?.off("rendered", handleRendered);
      rendition?.off("click", handleContentClick);
      rendition?.off("keydown", handleContentKeyDown);
      rendition?.off("displayerror", handleRenditionError);
      rendition?.off("loaderror", handleRenditionError);
      book?.off("openFailed", handleBookError);
      book?.spine.hooks.content.deregister(prepareEpubChapterDocument);
      // Book owns the rendition created by renderTo and destroys it recursively,
      // including its generated asset URLs and iframe manager.
      if (book) book.destroy();
      else rendition?.destroy();
      mount.replaceChildren();
    };
  }, [initialCfi, reportError, source]);

  return <div ref={mountRef} className={className} data-testid="epub-rendition" />;
}

export const EpubRendition = forwardRef(EpubRenditionComponent);
