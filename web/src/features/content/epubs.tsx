"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Expand, Minimize2, Trash2, Upload, X } from "lucide-react";
import { LoadingState } from "@/components/ui/States";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import { EpubRendition } from "./EpubRendition";
import type { EpubLookupSource, EpubRenditionHandle, EpubRenditionPageState, EpubWordSelectionRequest } from "./EpubRendition";
import { extractBookEpub } from "./epub-import";
import { FileDropOverlay } from "./FileDropOverlay";
import { LocalFilePicker } from "./LocalFilePicker";
import type { LocalFileAccept } from "./LocalFilePicker";
import { JapaneseReader, useJapaneseReaderAnalysisContexts, type JapaneseReaderAnalysisContext } from "./JapaneseReader";
import { extractReadableTextFromHtml } from "./parsers";
import { ContentHeader, ContentPage, EmptyState, Progress, UndoNotice } from "./ui";
import {
  createLocalId,
  deleteRecord,
  loadAsset,
  loadLibrary,
  readLocal,
  removeAsset,
  saveAsset,
  updateRecordInPlace,
  upsertRecord,
  writeLocal,
} from "./storage";
import type { ContentRecord } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

const PAGE_SIZE = 1600;
const BOOK_PICKER_ACCEPT = {
  "application/epub+zip": [".epub"],
  "text/html": [".html", ".htm"],
  "text/plain": [".txt"],
} satisfies LocalFileAccept;

function metadataString(record: ContentRecord, key: string) {
  const value = record.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function metadataPositiveInteger(record: ContentRecord, key: string) {
  const value = record.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function metadataBoolean(record: ContentRecord, key: string) {
  return record.metadata?.[key] === true;
}

function isEpubRecord(record: ContentRecord) {
  return metadataString(record, "format") === "epub"
    || record.mimeType === "application/epub+zip"
    || record.fileName?.toLocaleLowerCase().endsWith(".epub") === true;
}

function bookFormat(record: ContentRecord) {
  if (isEpubRecord(record)) return "EPUB";
  if (record.mimeType === "text/html" || /\.html?$/iu.test(record.fileName ?? "")) return "HTML";
  return "Text";
}

function bookLengthLabel(record: ContentRecord) {
  if (!isEpubRecord(record)) return "Vertical document";
  if (metadataBoolean(record, "locationsReady")) {
    const totalPages = Math.max(1, record.totalPages ?? 1);
    return `${totalPages} ${totalPages === 1 ? "page" : "pages"}`;
  }
  const chapterCount = metadataPositiveInteger(record, "chapterCount");
  if (chapterCount) return `${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"}`;
  return "Page count after opening";
}

function bookProgressLabel(record: ContentRecord) {
  if (record.progress <= 0) return "Not started";
  if (!isEpubRecord(record)) return "Reading";
  const page = Math.max(1, record.currentPage ?? 1);
  return metadataBoolean(record, "locationsReady") && record.totalPages
    ? `Page ${page} of ${record.totalPages}`
    : `Page ${page}`;
}

async function importBook(file: File): Promise<ContentRecord> {
  const isEpub = file.name.toLocaleLowerCase().endsWith(".epub") || file.type === "application/epub+zip";
  const rawAssetId = createLocalId("epub-source");
  const textAssetId = isEpub ? "" : createLocalId("epub-text");
  const savedAssetIds: string[] = [];
  let coverAssetId = "";
  let title = file.name.replace(/\.(epub|html?|txt)$/iu, "");
  let text = "";
  let language = "ja";
  let chapterCount = 1;
  let pageProgressionDirection = "rtl";
  let cover: Blob | undefined;

  if (isEpub) {
    const extracted = await extractBookEpub(file);
    title = extracted.title;
    text = extracted.text;
    language = extracted.language || "ja";
    chapterCount = Math.max(1, extracted.chapters.length);
    pageProgressionDirection = extracted.pageProgressionDirection || "rtl";
    cover = extracted.cover;
  } else {
    const raw = await file.text();
    text = /html/iu.test(file.type) || /\.html?$/iu.test(file.name) ? extractReadableTextFromHtml(raw) : raw.trim();
  }

  if (!text && !isEpub) throw new Error("No readable text was found in that file.");

  try {
    await saveAsset(rawAssetId, file);
    savedAssetIds.push(rawAssetId);
    if (textAssetId) {
      await saveAsset(textAssetId, new Blob([text], { type: "text/plain;charset=utf-8" }));
      savedAssetIds.push(textAssetId);
    }
    if (cover) {
      coverAssetId = createLocalId("epub-cover");
      await saveAsset(coverAssetId, cover);
      savedAssetIds.push(coverAssetId);
    }
  } catch (error) {
    await Promise.all(savedAssetIds.map((assetId) => removeAsset(assetId).catch(() => undefined)));
    throw error;
  }

  const now = new Date().toISOString();
  const metadata: NonNullable<ContentRecord["metadata"]> = {
    rawAssetId,
    format: isEpub ? "epub" : /html/iu.test(file.type) || /\.html?$/iu.test(file.name) ? "html" : "text",
    language,
    chapterCount,
    pageProgressionDirection,
    writingMode: "vertical-rl",
  };
  if (textAssetId) metadata.textAssetId = textAssetId;
  if (coverAssetId) metadata.coverAssetId = coverAssetId;

  return {
    id: createLocalId("book"),
    kind: "epub",
    title: title.trim() || file.name,
    fileName: file.name,
    mimeType: file.type || (isEpub ? "application/epub+zip" : "text/plain"),
    assetIds: savedAssetIds,
    createdAt: now,
    updatedAt: now,
    progress: 0,
    currentPage: 1,
    totalPages: isEpub ? 1 : Math.max(1, Math.ceil(text.length / PAGE_SIZE)),
    metadata,
  };
}

function BookCover({ record }: { record: ContentRecord }) {
  const coverAssetId = metadataString(record, "coverAssetId");
  const [cover, setCover] = useState<{ assetId: string; failed: boolean; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = "";
    if (!coverAssetId) return;

    void loadAsset(coverAssetId).then((cover) => {
      if (!cover) throw new Error("The stored cover is missing.");
      createdUrl = URL.createObjectURL(cover);
      if (cancelled) {
        URL.revokeObjectURL(createdUrl);
        createdUrl = "";
        return;
      }
      setCover({ assetId: coverAssetId, failed: false, url: createdUrl });
    }).catch(() => {
      if (!cancelled) setCover({ assetId: coverAssetId, failed: true, url: "" });
    });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [coverAssetId]);

  const currentCover = cover?.assetId === coverAssetId ? cover : null;
  const coverUrl = currentCover?.url ?? "";
  const failed = !coverAssetId || currentCover?.failed === true;

  return <div className={styles.mangaShelfCover} data-state={failed ? "error" : coverUrl ? "ready" : "loading"}>
    {coverUrl && !failed ? <Image
      src={coverUrl}
      alt={`Cover of ${record.title}`}
      draggable={false}
      fill
      sizes="(max-width: 40rem) 42vw, (max-width: 72rem) 22vw, 12rem"
      unoptimized
      onError={() => setCover((current) => current?.assetId === coverAssetId ? { ...current, failed: true } : current)}
    /> : <span className={styles.mangaShelfCoverPlaceholder} role="img" aria-label={`Cover unavailable for ${record.title}`}>
      <BookOpen size={26} aria-hidden="true" />
    </span>}
  </div>;
}

function BookShelfItem({ book, canRemove, onRemove }: { book: ContentRecord; canRemove: boolean; onRemove: (book: ContentRecord) => void }) {
  return <li className={styles.mangaShelfItem}>
    <article className={styles.mangaShelfCard}>
      <div className={styles.mangaShelfCoverFrame}>
        <Link draggable={false} className={styles.mangaShelfCoverLink} href={`/epubs/${book.id}`} aria-label={`Read ${book.title}`}>
          <BookCover record={book} />
        </Link>
      </div>
      <div className={styles.mangaShelfCopy}>
        <div className={styles.mangaShelfTitleRow}><h2><Link href={`/epubs/${book.id}`}>{book.title}</Link></h2></div>
        <p className={styles.mangaShelfMeta}>{bookFormat(book)} · {bookLengthLabel(book)}</p>
        <Progress label={bookProgressLabel(book)} value={book.progress} />
      </div>
      <div className={styles.mangaShelfActions}>
        <Link className={styles.secondaryButton} href={`/epubs/${book.id}`}>{book.progress > 0 ? "Continue" : "Read"}</Link>
        <button className={styles.iconButton} type="button" disabled={!canRemove} onClick={() => onRemove(book)} aria-label={`Remove ${book.title}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  </li>;
}

export function EpubLibrary() {
  const { user } = useSession();
  const firstLibraryReveal = useFirstContentReveal();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const [books, setBooks] = useState<ContentRecord[]>(() => loadLibrary("epub"));
  const [busy, setBusy] = useState(false);
  const [importName, setImportName] = useState("");
  const [message, setMessage] = useState("");
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => {
      setBooks(loadLibrary("epub"));
      setMessage("The book could not be removed from browser storage, so it was restored.");
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const readingSeconds = readLocal<number>(`reading-seconds:${today}`, 0);
  const dailyGoalMinutes = settings.study.epubDailyGoalMinutes;
  const dailyGoalSeconds = dailyGoalMinutes * 60;

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file || deletion.pending) return;
    setBusy(true);
    setImportName(file.name);
    setMessage("");
    try {
      const record = await importBook(file);
      try {
        setBooks(upsertRecord(record));
      } catch (error) {
        // The archive and cover have already been written to IndexedDB at this
        // point. If the library index cannot be saved, remove those now-orphaned
        // blobs so a failed import does not quietly consume browser storage.
        await Promise.all(record.assetIds.map((assetId) => removeAsset(assetId).catch(() => undefined)));
        throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That book could not be imported.");
    } finally {
      setBusy(false);
      setImportName("");
    }
  }, [deletion.pending]);

  function remove(book: ContentRecord) {
    setBooks((current) => current.filter((item) => item.id !== book.id));
    deletion.requestDeletion(book);
  }

  return <ContentPage variant="library">
    <ContentHeader
      title="Book library"
      description="Import Japanese EPUB, HTML, or text books. Files, covers, and reading progress stay on this device."
      actions={<LocalFilePicker
        className={styles.button}
        accept={BOOK_PICKER_ACCEPT}
        aria-busy={busy || undefined}
        description="Book files"
        disabled={busy || Boolean(deletion.pending)}
        onFiles={handleFiles}
        onPickerError={(error) => setMessage(error.message || "The book picker could not be opened.")}
      >
        <Upload size={16} aria-hidden="true" />
        <span>{busy ? "Importing…" : "Import book"}</span>
      </LocalFilePicker>}
    />
    <FileDropOverlay
      disabled={busy || Boolean(deletion.pending)}
      hint="EPUB · HTML · TXT"
      icon={<Upload size={32} aria-hidden="true" />}
      label="Drop to import a book"
      onFiles={handleFiles}
    />
    {busy ? <LoadingState className={styles.mangaImportStatus} compact label="Importing book…" detail={importName} /> : null}
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    <section className={styles.bookReadingGoal} aria-label="Today’s reading">
      <div className={styles.bookReadingGoalCopy}>
        <strong>Today’s reading</strong>
        <span>{Math.floor(readingSeconds / 60)} of {dailyGoalMinutes} minutes</span>
      </div>
      <Progress label={`${dailyGoalMinutes} minute daily goal`} value={readingSeconds / dailyGoalSeconds} />
    </section>
    {books.length ? <ol className={styles.mangaShelfGrid} aria-label="Book library" {...firstLibraryReveal}>
      {books.map((book) => <BookShelfItem book={book} canRemove={!busy} key={book.id} onRemove={remove} />)}
    </ol> : <EmptyState title="No books yet">Import an EPUB, HTML, or text file. Books and progress remain on this device.</EmptyState>}
    {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => {
      deletion.undoDeletion();
      setBooks(loadLibrary("epub"));
    }} /> : null}
  </ContentPage>;
}

function editableEventTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true']"));
}

export function EpubReader({ bookId }: { bookId: string }) {
  const { user } = useSession();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const initialBook = loadLibrary("epub").find((item) => item.id === bookId) ?? null;
  const [initialCfi] = useState(() => initialBook ? metadataString(initialBook, "epubCfi") || undefined : undefined);
  const [book, setBook] = useState<ContentRecord | null>(initialBook);
  const [source, setSource] = useState<Blob | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(Boolean(initialBook));
  const [renditionReady, setRenditionReady] = useState(false);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lookupSources, setLookupSources] = useState<EpubLookupSource[]>([]);
  const [wordSelection, setWordSelection] = useState<EpubWordSelectionRequest | null>(null);
  const [resolvedLookupId, setResolvedLookupId] = useState<string | null>(null);
  const [message, setMessage] = useState(initialBook ? "" : "This book is not in the local library.");
  const [pageState, setPageState] = useState(() => ({
    page: initialBook?.currentPage ?? 1,
    total: initialBook?.totalPages ?? 1,
    progress: initialBook?.progress ?? 0,
    atStart: (initialBook?.currentPage ?? 1) <= 1,
    atEnd: (initialBook?.currentPage ?? 1) >= (initialBook?.totalPages ?? 1),
    locationsReady: initialBook ? metadataBoolean(initialBook, "locationsReady") : false,
    displayedPage: null as number | null,
    displayedTotal: null as number | null,
  }));
  const bookRef = useRef(initialBook);
  const pageStateRef = useRef(pageState);
  const renditionRef = useRef<EpubRenditionHandle>(null);
  const readerRoot = useRef<HTMLDivElement>(null);
  const lookupDialogRef = useRef<HTMLDialogElement>(null);
  const lookupCloseRef = useRef<HTMLButtonElement>(null);
  const lookupReturnFocusRef = useRef<HTMLElement | null>(null);
  const isEpub = book ? isEpubRecord(book) : false;
  const usesRendition = isEpub && Boolean(source);
  const jpdbAnalysisEnabled = settings.reader.recognitionMode === "wk-jpdb" && Boolean(settings.integrations.jpdbApiKey);
  const lookupAnalysisContexts = useJapaneseReaderAnalysisContexts(lookupSources, {
    apiKey: settings.integrations.jpdbApiKey,
    enabled: jpdbAnalysisEnabled,
  });

  const handleLookupSourcesChange = useCallback((sources: EpubLookupSource[]) => {
    setLookupSources((current) => current.length === sources.length && current.every((source, index) => (
      source.id === sources[index]?.id && source.text === sources[index]?.text
    )) ? current : sources);
  }, []);

  const handleWordSelect = useCallback((selection: EpubWordSelectionRequest | null) => {
    if (selection) {
      lookupReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setResolvedLookupId(null);
    setWordSelection(selection);
  }, []);

  const handleWordSelectionResolved = useCallback((selection: { requestId: string; text: string; start: number; end: number }) => {
    if (selection.requestId !== wordSelection?.id) return;
    renditionRef.current?.setWordSelection(selection.requestId, selection.text);
    setResolvedLookupId(selection.requestId);
  }, [wordSelection?.id]);

  const closeWordLookup = useCallback(() => {
    renditionRef.current?.clearWordSelection();
    setResolvedLookupId(null);
    setWordSelection(null);
    const returnFocus = lookupReturnFocusRef.current;
    lookupReturnFocusRef.current = null;
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    const dialog = lookupDialogRef.current;
    if (!dialog || !wordSelection || resolvedLookupId !== wordSelection.id || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    lookupCloseRef.current?.focus({ preventScroll: true });
  }, [resolvedLookupId, wordSelection]);

  useEffect(() => {
    let cancelled = false;
    const record = loadLibrary("epub").find((item) => item.id === bookId) ?? null;
    if (!record) return;
    const rawAssetId = metadataString(record, "rawAssetId") || record.assetIds[0];
    const textAssetId = metadataString(record, "textAssetId") || record.assetIds[1];

    void (async () => {
      if (isEpubRecord(record)) {
        const rawAsset = rawAssetId ? await loadAsset(rawAssetId) : null;
        if (cancelled) return;
        if (rawAsset) {
          setSource(rawAsset);
          setLoading(false);
          return;
        }
        // Older imports kept a flattened text copy. Only read it as a recovery
        // path when their original archive is missing; normal EPUB opens should
        // not retain both the archive and a second full-book JS string.
        const fallbackTextAsset = textAssetId ? await loadAsset(textAssetId) : null;
        if (cancelled) return;
        if (!fallbackTextAsset) throw new Error("The stored EPUB file is missing.");
        const fallbackText = await fallbackTextAsset.text();
        if (cancelled) return;
        setText(fallbackText);
        setLoading(false);
        return;
      }

      const textAsset = textAssetId ? await loadAsset(textAssetId) : null;
      if (cancelled) return;
      if (!textAsset) throw new Error("The stored book text is missing.");
      const plainText = await textAsset.text();
      if (cancelled) return;
      setText(plainText);
      setLoading(false);
    })().catch((error) => {
      if (cancelled) return;
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "The book could not be opened.");
    });
    return () => { cancelled = true; };
  }, [bookId]);

  useEffect(() => {
    if (!book || (!source && !text)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const key = `reading-seconds:${new Date().toISOString().slice(0, 10)}`;
      writeLocal(key, readLocal<number>(key, 0) + 30);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [book, source, text]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === readerRoot.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const persistPosition = useCallback((nextPage: number, totalPages: number, progress: number, cfi?: string | null, locationsReady?: boolean) => {
    const current = bookRef.current;
    if (!current) return;
    const metadata = { ...current.metadata };
    if (cfi) metadata.epubCfi = cfi;
    if (typeof locationsReady === "boolean") metadata.locationsReady = locationsReady;
    const updated: ContentRecord = {
      ...current,
      currentPage: Math.max(1, nextPage),
      totalPages: Math.max(1, totalPages),
      progress: Math.max(0, Math.min(1, progress)),
      updatedAt: new Date().toISOString(),
      metadata,
    };
    bookRef.current = updated;
    setBook(updated);
    try {
      updateRecordInPlace(updated);
    } catch {
      setMessage("The book opened, but reading progress could not be saved.");
    }
  }, []);

  const handleRenditionState = useCallback((state: EpubRenditionPageState) => {
    setRenditionReady(true);
    const nextPage = state.page ?? 1;
    const totalPages = state.total ?? Math.max(nextPage, 1);
    const progress = state.progress ?? (totalPages > 1 ? (nextPage - 1) / (totalPages - 1) : 1);
    const locationsReady = state.locationsReady;
    const nextState = {
      page: nextPage,
      total: totalPages,
      progress,
      atStart: state.atStart,
      atEnd: state.atEnd,
      locationsReady,
      displayedPage: state.displayedPage ?? null,
      displayedTotal: state.displayedTotal ?? null,
    };
    pageStateRef.current = nextState;
    setPageState(nextState);
    persistPosition(nextPage, totalPages, progress, state.cfi, locationsReady);
  }, [persistPosition]);

  const navigate = useCallback(async (direction: "next" | "previous") => {
    if (navigationBusy || !usesRendition) return;
    const rendition = renditionRef.current;
    if (!rendition) return;
    setNavigationBusy(true);
    setResolvedLookupId(null);
    setWordSelection(null);
    try {
      await rendition[direction]();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The next book page could not be opened.");
    } finally {
      setNavigationBusy(false);
    }
  }, [navigationBusy, usesRendition]);

  useEffect(() => {
    function handleReaderKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && wordSelection) {
        event.preventDefault();
        closeWordLookup();
        return;
      }
      if (!usesRendition || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editableEventTarget(event.target)) return;
      if (event.key === "ArrowLeft" || event.key === "PageDown") {
        event.preventDefault();
        void navigate("next");
      } else if (event.key === "ArrowRight" || event.key === "PageUp") {
        event.preventDefault();
        void navigate("previous");
      }
    }
    window.addEventListener("keydown", handleReaderKey);
    return () => window.removeEventListener("keydown", handleReaderKey);
  }, [closeWordLookup, navigate, usesRendition, wordSelection]);

  async function toggleFullscreen() {
    const root = readerRoot.current;
    if (!root) return;
    try {
      closeWordLookup();
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      setMessage("Fullscreen could not be opened in this browser.");
    }
  }

  if (!book) return <ContentPage variant="media">
    <div className={styles.epubReaderToolbar}><Link className={styles.secondaryButton} href="/epubs"><ArrowLeft size={16} aria-hidden="true" />Library</Link></div>
    {message ? <div className={styles.errorNotice} role="alert">{message}</div> : null}
    <EmptyState title="Book unavailable">If site data was cleared, return to the book library and import the file again.</EmptyState>
  </ContentPage>;

  const readerReady = usesRendition ? renditionReady : Boolean(text) && !loading;
  const previousDisabled = !readerReady || navigationBusy || pageState.atStart;
  const nextDisabled = !readerReady || navigationBusy || pageState.atEnd;
  const visiblePage = Math.max(1, pageState.displayedPage ?? pageState.page);
  const visibleTotal = pageState.displayedTotal && pageState.displayedTotal > 1 ? pageState.displayedTotal : null;
  const counter = visibleTotal ? `${visiblePage} / ${visibleTotal}` : `Page ${visiblePage}`;
  const lookupAnalysisContext = wordSelection?.sourceId
    ? lookupAnalysisContexts.get(wordSelection.sourceId) ?? (jpdbAnalysisEnabled ? {
      text: wordSelection.text,
      start: 0,
      analysis: {
        status: "loading",
        sourceText: wordSelection.text,
        tokens: [],
        message: "Analyzing this book page…",
      },
    } satisfies JapaneseReaderAnalysisContext : undefined)
    : undefined;
  // The resume point is an initialization input. Keeping it stable prevents a
  // newly persisted relocation CFI from rebuilding the rendition on every page.
  return <ContentPage variant="media">
    <div ref={readerRoot} className={styles.epubReader} data-fullscreen={isFullscreen ? "true" : "false"} aria-busy={!readerReady || navigationBusy} aria-keyshortcuts={usesRendition ? "ArrowLeft ArrowRight PageUp PageDown" : undefined}>
      <h1 className={styles.visuallyHidden}>{book.title}</h1>
      <div className={styles.epubReaderToolbar}>
        <Link className={styles.secondaryButton} href="/epubs"><ArrowLeft size={16} aria-hidden="true" />Library</Link>
        <button className={styles.secondaryButton} type="button" aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      {message ? <div className={styles.errorNotice} role="status">{message}</div> : null}
      <section className={styles.epubReaderStage} aria-label={`${book.title} ${usesRendition ? "pages" : "document"}`} data-testid="epub-reader-stage">
        <div className={styles.epubReaderViewport} data-testid="epub-reader-viewport">
          <div className={styles.epubReaderPageSurface} data-testid="epub-reader-page-surface">
            {source ? <EpubRendition
              ref={renditionRef}
              className={styles.epubRendition}
              source={source}
              initialCfi={initialCfi}
              onError={(error) => setMessage(error.message || "The EPUB could not be opened.")}
              onLookupSourcesChange={handleLookupSourcesChange}
              onStateChange={handleRenditionState}
              onWordSelect={handleWordSelect}
            /> : text ? <article className={styles.epubPlainPage} lang="ja" aria-label={`${book.title}, continuous vertical document`}>{text}</article> : null}
          </div>
          {!readerReady ? <div className={styles.epubReaderLoading}><LoadingState compact label="Preparing book pages" detail="Opening the book from this device…" /></div> : null}
        </div>
        {usesRendition ? <nav className={styles.mangaEdgeNavigation} aria-label="Book page navigation">
          <button className={styles.mangaEdgeButton} data-physical-side="left" type="button" aria-label="Next" disabled={nextDisabled} onClick={() => void navigate("next")}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <span className={styles.mangaPageCounter} aria-live="polite">{counter}</span>
          <button className={styles.mangaEdgeButton} data-physical-side="right" type="button" aria-label="Previous" disabled={previousDisabled} onClick={() => void navigate("previous")}>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </nav> : null}
        {usesRendition && wordSelection ? <dialog
          ref={lookupDialogRef}
          className={styles.epubLookupLayer}
          aria-label="Word details"
          onCancel={(event) => { event.preventDefault(); closeWordLookup(); }}
          onClick={(event) => { if (event.target === event.currentTarget) closeWordLookup(); }}
        >
          <div className={styles.epubLookupSheet}>
            <button ref={lookupCloseRef} autoFocus type="button" className={styles.epubLookupClose} aria-label="Close word details" onClick={closeWordLookup}>
              <X size={18} aria-hidden="true" />
            </button>
            <JapaneseReader
              text={wordSelection.text}
              analysisContext={lookupAnalysisContext}
              ariaLabel="Selected EPUB word"
              appearance="compact"
              inspectorMode="inline"
              inspectorOnly
              inspectorActive
              selectionRequest={{ id: wordSelection.id, index: wordSelection.index }}
              subjectReturnTo={`/epubs/${book.id}`}
              onSelectionResolved={handleWordSelectionResolved}
            />
          </div>
        </dialog> : null}
      </section>
    </div>
  </ContentPage>;
}
