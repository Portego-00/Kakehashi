"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Download, Expand, FileText, Images, KeyRound, Languages, Minimize2, Pencil, Trash2, Upload, X } from "lucide-react";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import { JapaneseReader } from "./JapaneseReader";
import { MangaPageSelector } from "./MangaPageSelector";
import { prepareMangaImport, type MangaImportSource } from "./manga-import";
import {
  downloadMangaOcrModel,
  getMangaOcrModelStatus,
  MANGA_OCR_MODEL_TOTAL_BYTES,
  type MangaOcrModelDownloadProgress,
} from "./manga-ocr-assets";
import { disposeMangaOcr, recognizeMangaSelection, type MangaOcrSelection } from "./manga-ocr";
import type { MangaOcrProgress } from "./manga-ocr-protocol";
import {
  buildMangaSpreads,
  mangaPageSide,
  mangaSpreadIndexForPage,
  type MangaPagePlacement,
  type MangaReadingDirection,
  type MangaSpread,
} from "./manga-pagination";
import { openMangaPdf, type MangaPdfDocument } from "./manga-pdf";
import {
  createLocalId,
  deleteRecord,
  loadAsset,
  loadLibrary,
  loadMangaOcrPage,
  removeAsset,
  saveAsset,
  saveLibrary,
  saveMangaOcrPage,
  upsertRecord,
} from "./storage";
import type { ContentRecord } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import { ContentHeader, ContentPage, EmptyState, Progress, UndoNotice } from "./ui";
import styles from "./content.module.css";

const TWO_PAGE_QUERY = "(min-width: 56rem)";

interface LoadedMangaPage {
  blob: Blob;
  height: number;
  pageNumber: number;
  url: string;
  width: number;
}

interface LoadedMangaSpread {
  direction: "next" | "previous";
  key: string;
  pages: LoadedMangaPage[];
  spread: MangaSpread;
}

type MangaOcrState =
  | { status: "idle" }
  | { status: "downloading-model"; loadedBytes: number; totalBytes: number; pageNumber: number; selection: MangaOcrSelection }
  | { status: "preparing-model" | "recognizing"; pageNumber: number; selection: MangaOcrSelection }
  | { status: "complete"; pageNumber: number; selection: MangaOcrSelection; recognizedText: string }
  | { status: "error"; pageNumber: number; selection: MangaOcrSelection; message: string };

type MangaOcrModelUiState =
  | { status: "checking"; loadedBytes: number; totalBytes: number }
  | { status: "available" | "ready"; loadedBytes: number; totalBytes: number }
  | { status: "downloading"; loadedBytes: number; totalBytes: number; assetLabel: string }
  | { status: "error"; loadedBytes: number; totalBytes: number; message: string };

type MangaTranslationState =
  | { status: "idle"; sourceText: "" }
  | { status: "loading"; sourceText: string }
  | { status: "ready"; sourceText: string; translation: string; isTruncated: boolean }
  | { status: "error"; sourceText: string; message: string };

const EMPTY_MANGA_TRANSLATION: MangaTranslationState = { status: "idle", sourceText: "" };

function mangaSource(record: ContentRecord): MangaImportSource {
  const source = record.metadata?.sourceType;
  if (source === "cbz" || source === "epub" || source === "images" || source === "pdf") return source;
  return record.metadata?.isPdf ? "pdf" : "images";
}

function sourceIcon(record: ContentRecord) {
  return mangaSource(record) === "pdf"
    ? <FileText size={26} aria-hidden="true" />
    : <Images size={26} aria-hidden="true" />;
}

function sourceLabel(record: ContentRecord) {
  const source = mangaSource(record);
  if (source === "cbz") return "CBZ";
  if (source === "epub") return "EPUB";
  if (source === "pdf") return "PDF";
  return "Images";
}

function MangaCover({ record }: { record: ContentRecord }) {
  const coverAssetId = record.assetIds[0];
  const source = mangaSource(record);
  const [coverUrl, setCoverUrl] = useState("");
  const [failed, setFailed] = useState(!coverAssetId);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = "";

    async function loadCover() {
      setCoverUrl("");
      setFailed(false);
      const storedAsset = await loadAsset(coverAssetId);
      if (!storedAsset) throw new Error("The cover is missing.");

      let cover = storedAsset;
      if (source === "pdf") {
        const document = await openMangaPdf(storedAsset);
        try {
          cover = await document.renderPage(1);
        } finally {
          await document.destroy();
        }
      }

      createdUrl = URL.createObjectURL(cover);
      if (cancelled) {
        URL.revokeObjectURL(createdUrl);
        createdUrl = "";
        return;
      }
      setCoverUrl(createdUrl);
    }

    if (coverAssetId) {
      void loadCover().catch(() => {
        if (!cancelled) setFailed(true);
      });
    }

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [coverAssetId, source]);

  return <div className={styles.mangaShelfCover} data-state={failed ? "error" : coverUrl ? "ready" : "loading"}>
    {coverUrl && !failed ? <Image
      src={coverUrl}
      alt={`Cover of ${record.title}`}
      fill
      sizes="(max-width: 40rem) 42vw, (max-width: 72rem) 22vw, 12rem"
      unoptimized
      onError={() => setFailed(true)}
    /> : <span className={styles.mangaShelfCoverPlaceholder} role="img" aria-label={`Cover unavailable for ${record.title}`}>
      {sourceIcon(record)}
    </span>}
  </div>;
}

function MangaShelfItem({
  item,
  onRemove,
  onRename,
}: {
  item: ContentRecord;
  onRemove: (item: ContentRecord) => void;
  onRename: (item: ContentRecord, title: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);
  const [titleError, setTitleError] = useState("");

  function cancelEditing() {
    setDraftTitle(item.title);
    setTitleError("");
    setEditing(false);
  }

  function saveTitle() {
    const title = draftTitle.trim();
    if (!title) {
      setTitleError("Enter a title.");
      return;
    }
    if (onRename(item, title)) {
      setDraftTitle(title);
      setTitleError("");
      setEditing(false);
    }
  }

  return <article className={styles.mangaShelfItem}>
    <Link className={styles.mangaShelfCoverLink} href={`/manga/${item.id}`} aria-label={`Read ${item.title}`}>
      <MangaCover record={item} />
    </Link>
    <div className={styles.mangaShelfCopy}>
      {editing ? <form className={styles.mangaTitleForm} onSubmit={(event) => {
        event.preventDefault();
        saveTitle();
      }}>
        <input
          className={styles.input}
          aria-label="Manga title"
          autoFocus
          maxLength={200}
          value={draftTitle}
          onChange={(event) => {
            setDraftTitle(event.target.value);
            setTitleError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
        />
        <button className={styles.iconButton} type="submit" aria-label="Save title">
          <Check size={16} aria-hidden="true" />
        </button>
        <button className={styles.iconButton} type="button" aria-label="Cancel title editing" onClick={cancelEditing}>
          <X size={16} aria-hidden="true" />
        </button>
        {titleError ? <span className={styles.mangaTitleError} role="alert">{titleError}</span> : null}
      </form> : <div className={styles.mangaShelfTitleRow}>
        <h2><Link href={`/manga/${item.id}`}>{item.title}</Link></h2>
        <button className={styles.mangaShelfEditButton} type="button" aria-label={`Edit title for ${item.title}`} onClick={() => {
          setDraftTitle(item.title);
          setTitleError("");
          setEditing(true);
        }}>
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>}
      <p className={styles.mangaShelfMeta}>{sourceLabel(item)} · {item.totalPages ?? item.assetIds.length} pages</p>
      <Progress
        label={item.progress > 0 ? `Page ${item.currentPage}${item.totalPages ? ` of ${item.totalPages}` : ""}` : "Not started"}
        value={item.progress}
      />
    </div>
    <div className={styles.mangaShelfActions}>
      <Link className={styles.secondaryButton} href={`/manga/${item.id}`}>{item.progress > 0 ? "Continue" : "Read"}</Link>
      <button className={styles.iconButton} type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.title}`}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  </article>;
}

async function imageSize(blob: Blob) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function wideReaderSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(TWO_PAGE_QUERY).matches;
}

function subscribeToWideReader(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(TWO_PAGE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useWideMangaReader() {
  return useSyncExternalStore(subscribeToWideReader, wideReaderSnapshot, () => true);
}

function readingDirection(record: ContentRecord): MangaReadingDirection {
  return record.metadata?.readingDirection === "ltr" ? "ltr" : "rtl";
}

function pagePlacements(value: string | number | boolean | null | undefined): MangaPagePlacement[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((placement) => placement === "left" || placement === "right" || placement === "center" ? placement : null);
  } catch {
    return [];
  }
}

function formatModelBytes(bytes: number) {
  return `${(Math.max(0, bytes) / 1_000_000).toFixed(1)} MB`;
}

function ocrStatusText(state: MangaOcrState) {
  if (state.status === "downloading-model") {
    return `Downloading OCR model · ${formatModelBytes(state.loadedBytes)} / ${formatModelBytes(state.totalBytes)}`;
  }
  if (state.status === "preparing-model") return "Preparing OCR on this device…";
  if (state.status === "recognizing") return "Recognizing selected text…";
  if (state.status === "error") return state.message;
  if (state.status === "complete") return state.recognizedText;
  return "";
}

function isOcrBusy(state: MangaOcrState) {
  return state.status === "downloading-model" || state.status === "preparing-model" || state.status === "recognizing";
}

function MangaRecognitionLoader({ state, compact = false }: { state: MangaOcrState; compact?: boolean }) {
  if (!isOcrBusy(state)) return null;
  return <div
    className={styles.mangaRecognitionLoader}
    data-compact={compact ? "true" : "false"}
    data-stage={state.status}
    role="status"
    aria-label="Recognizing selected text"
    aria-live="polite"
    aria-busy="true"
  >
    <span className={styles.mangaRecognitionGlyph} aria-hidden="true"><span /></span>
    <span>{ocrStatusText(state)}</span>
  </div>;
}

function MangaTranslation({ state, compact = false }: { state: MangaTranslationState; compact?: boolean }) {
  if (state.status === "idle") return null;
  return <section
    className={styles.mangaTranslation}
    data-compact={compact ? "true" : "false"}
    data-state={state.status}
    aria-label="JPDB translation"
    aria-live={compact ? undefined : "polite"}
    aria-busy={state.status === "loading" || undefined}
  >
    <div className={styles.mangaTranslationLabel}>
      <Languages size={compact ? 13 : 15} aria-hidden="true" />
      <strong>Translation</strong>
      <span>JPDB</span>
    </div>
    {state.status === "loading" ? <div className={styles.mangaTranslationLoading}>
      <span>Translating</span>
      <i aria-hidden="true"><span /><span /><span /></i>
    </div> : state.status === "ready" ? <>
      <p>{state.translation}</p>
      {state.isTruncated ? <small>JPDB shortened this translation.</small> : null}
    </> : <p className={styles.error}>{state.message}</p>}
  </section>;
}

function mangaTurnOrigin(navigation: "next" | "previous", direction: MangaReadingDirection) {
  if (navigation === "next") return direction === "rtl" ? "from-left" : "from-right";
  return direction === "rtl" ? "from-right" : "from-left";
}

function editableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true']"));
}

function MangaOcrModelControl({
  activeDownload,
  refreshToken = 0,
}: {
  activeDownload?: { loadedBytes: number; totalBytes: number };
  refreshToken?: number;
}) {
  const [state, setState] = useState<MangaOcrModelUiState>({
    status: "checking",
    loadedBytes: 0,
    totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
  });

  useEffect(() => {
    let current = true;
    void getMangaOcrModelStatus().then((status) => {
      if (!current) return;
      setState({
        status: status.ready ? "ready" : "available",
        loadedBytes: status.downloadedBytes,
        totalBytes: status.totalBytes,
      });
    }).catch((error: unknown) => {
      if (!current) return;
      setState({
        status: "error",
        loadedBytes: 0,
        totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
        message: error instanceof Error ? error.message : "The OCR model status could not be checked.",
      });
    });
    return () => { current = false; };
  }, [refreshToken]);

  async function startDownload() {
    setState((current) => ({
      status: "downloading",
      loadedBytes: current.loadedBytes,
      totalBytes: current.totalBytes,
      assetLabel: "OCR model",
    }));
    try {
      await downloadMangaOcrModel({
        onProgress: (progress: MangaOcrModelDownloadProgress) => setState({
          status: "downloading",
          loadedBytes: progress.loadedBytes,
          totalBytes: progress.totalBytes,
          assetLabel: progress.assetLabel,
        }),
      });
      setState({
        status: "ready",
        loadedBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
        totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
      });
    } catch (error) {
      setState((current) => ({
        status: "error",
        loadedBytes: current.loadedBytes,
        totalBytes: current.totalBytes,
        message: error instanceof Error ? error.message : "The OCR model could not be downloaded.",
      }));
    }
  }

  const isDownloading = state.status === "downloading" || Boolean(activeDownload);
  const isReady = state.status === "ready";
  const shownLoadedBytes = activeDownload?.loadedBytes ?? state.loadedBytes;
  const shownTotalBytes = activeDownload?.totalBytes ?? state.totalBytes;
  const label = isReady
    ? "OCR model ready offline"
    : activeDownload
      ? `OCR model · ${formatModelBytes(activeDownload.loadedBytes)} / ${formatModelBytes(activeDownload.totalBytes)}`
      : state.status === "downloading"
        ? `${state.assetLabel} · ${formatModelBytes(state.loadedBytes)} / ${formatModelBytes(state.totalBytes)}`
      : state.status === "checking"
        ? "Checking OCR model…"
        : state.loadedBytes > 0
          ? `${formatModelBytes(state.loadedBytes)} of ${formatModelBytes(state.totalBytes)} saved`
          : `${formatModelBytes(state.totalBytes)} download`;

  return <div className={styles.mangaModelControl} data-state={state.status}>
    <div className={styles.mangaModelStatus} role="status" aria-live="polite">
      {isReady ? <CircleCheck size={17} aria-hidden="true" /> : null}
      <span>{label}</span>
    </div>
    {isDownloading ? <progress
      className={styles.mangaModelProgress}
      aria-label="OCR model download"
      max={shownTotalBytes}
      value={shownLoadedBytes}
    /> : null}
    {state.status === "error" ? <p className={styles.error}>{state.message}</p> : null}
    {!isReady && !activeDownload && state.status !== "checking" ? <button
      className={styles.secondaryButton}
      type="button"
      disabled={isDownloading}
      onClick={() => void startDownload()}
    >
      <Download size={16} aria-hidden="true" />
      {isDownloading ? "Downloading…" : state.loadedBytes > 0 ? "Resume download" : "Download OCR model"}
    </button> : null}
  </div>;
}

export function MangaLibrary() {
  const firstLibraryReveal = useFirstContentReveal();
  const [manga, setManga] = useState<ContentRecord[]>(() => loadLibrary("manga"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => {
      setManga(loadLibrary("manga"));
      setMessage("The manga could not be removed from browser storage, so it was restored.");
    },
  });

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const savedAssetIds: string[] = [];
    setBusy(true);
    setMessage("");

    try {
      const prepared = await prepareMangaImport(files);
      const importMetadata = prepared.metadata ?? {
        readingDirection: "rtl" as const,
        pagePlacements: Array<MangaPagePlacement>(prepared.pageCount).fill(null),
      };
      for (const asset of prepared.assets) {
        const assetId = createLocalId("manga-page");
        await saveAsset(assetId, asset);
        savedAssetIds.push(assetId);
      }

      const now = new Date().toISOString();
      const record: ContentRecord = {
        id: createLocalId("manga"),
        kind: "manga",
        title: prepared.title,
        fileName: prepared.fileName,
        mimeType: prepared.sourceType === "pdf" ? "application/pdf" : "image/*",
        assetIds: savedAssetIds,
        createdAt: now,
        updatedAt: now,
        progress: 0,
        currentPage: 1,
        totalPages: prepared.pageCount,
        metadata: {
          sourceType: prepared.sourceType,
          isPdf: prepared.sourceType === "pdf",
          readingDirection: importMetadata.readingDirection,
          pagePlacements: JSON.stringify(importMetadata.pagePlacements),
        },
      };
      setManga(upsertRecord(record));
    } catch (error) {
      await Promise.all(savedAssetIds.map((assetId) => removeAsset(assetId).catch(() => undefined)));
      setMessage(error instanceof Error ? error.message : "Those pages could not be imported.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function remove(item: ContentRecord) {
    setManga((current) => current.filter((candidate) => candidate.id !== item.id));
    deletion.requestDeletion(item);
  }

  function rename(item: ContentRecord, title: string) {
    const updated = { ...item, title, updatedAt: new Date().toISOString() };
    const next = manga.map((candidate) => candidate.id === item.id ? updated : candidate);
    if (!saveLibrary("manga", next)) {
      setMessage("The title could not be saved in browser storage.");
      return false;
    }
    setManga(next);
    setMessage("");
    return true;
  }

  return <ContentPage variant="library">
    <ContentHeader
      title="Manga library"
      description="Import single-image-page EPUB, CBZ, ZIP, PDF, or image pages. Page images stay in this browser."
      actions={<>
        <MangaOcrModelControl />
        <Link className={styles.secondaryButton} href="/settings#jpdb-api-key">
          <KeyRound size={16} aria-hidden="true" />
          Add JPDB API key
        </Link>
        <label className={styles.button}>
          <Upload size={16} aria-hidden="true" />
          {busy ? "Importing…" : "Import manga"}
          <input
            className={styles.fileInput}
            type="file"
            accept=".epub,.cbz,.zip,.pdf,application/epub+zip,application/pdf,application/zip,application/vnd.comicbook+zip,image/*"
            multiple
            disabled={busy}
            onChange={(event) => void importFiles(event)}
          />
        </label>
      </>}
    />
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    {manga.length ? <div className={styles.mangaShelfGrid} {...firstLibraryReveal}>
      {manga.map((item) => <MangaShelfItem
        item={item}
        key={item.id}
        onRemove={remove}
        onRename={rename}
      />)}
    </div> : <EmptyState title="No manga yet">Import one EPUB, CBZ, ZIP, or PDF, or select a set of image pages. All files remain in this browser.</EmptyState>}
    {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => {
      deletion.undoDeletion();
      setManga(loadLibrary("manga"));
    }} /> : null}
  </ContentPage>;
}

export function MangaReader({ mangaId }: { mangaId: string }) {
  const { user } = useSession();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const initialRecord = loadLibrary("manga").find((candidate) => candidate.id === mangaId) ?? null;
  const initialPage = initialRecord?.currentPage ?? 1;
  const initialOcrText = loadMangaOcrPage(mangaId, initialPage)?.text ?? "";
  const [record, setRecord] = useState<ContentRecord | null>(initialRecord);
  const [page, setPage] = useState(initialPage);
  const [loadedSpread, setLoadedSpread] = useState<LoadedMangaSpread | null>(null);
  const [outgoingSpread, setOutgoingSpread] = useState<LoadedMangaSpread | null>(null);
  const [turnOrigin, setTurnOrigin] = useState<"from-left" | "from-right">("from-left");
  const [isSpreadLoading, setIsSpreadLoading] = useState(Boolean(initialRecord));
  const [navigationDirection, setNavigationDirection] = useState<"next" | "previous">("next");
  const [activeOcrPage, setActiveOcrPage] = useState(initialPage);
  const [ocrText, setOcrText] = useState(initialOcrText);
  const [ocrState, setOcrState] = useState<MangaOcrState>({ status: "idle" });
  const [translation, setTranslation] = useState<MangaTranslationState>(EMPTY_MANGA_TRANSLATION);
  const [modelRefreshToken, setModelRefreshToken] = useState(0);
  const [message, setMessage] = useState(initialRecord ? "" : "This manga is not in the local library.");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pdfDocument = useRef<MangaPdfDocument | null>(null);
  const ocrAbort = useRef<AbortController | null>(null);
  const spreadLoadGeneration = useRef(0);
  const navigationPending = useRef(Boolean(initialRecord));
  const loadedSpreadKeyRef = useRef<string | null>(null);
  const loadedSpreadRef = useRef<LoadedMangaSpread | null>(null);
  const outgoingSpreadRef = useRef<LoadedMangaSpread | null>(null);
  const pageUrls = useRef(new Set<string>());
  const spreadTransitionTimer = useRef<number | null>(null);
  const readerRoot = useRef<HTMLDivElement | null>(null);
  const wideReader = useWideMangaReader();
  const totalPages = Math.max(1, record?.totalPages ?? record?.assetIds.length ?? 1);
  const direction = record ? readingDirection(record) : "rtl";
  const serializedPlacements = record?.metadata?.pagePlacements;
  const placements = useMemo(() => pagePlacements(serializedPlacements), [serializedPlacements]);
  const spreads = useMemo(
    () => buildMangaSpreads(totalPages, { twoPage: wideReader, placements, direction }),
    [direction, placements, totalPages, wideReader],
  );
  const currentSpreadIndex = Math.max(0, mangaSpreadIndexForPage(spreads, page));
  const targetSpread = spreads[currentSpreadIndex] ?? spreads[0];
  const targetSpreadKey = `${mangaId}:${wideReader ? "spread" : "page"}:${direction}:${targetSpread?.key ?? "missing"}`;
  const targetSpreadKeyRef = useRef(targetSpreadKey);
  const displayedSpreadIsCurrent = loadedSpread?.key === targetSpreadKey;

  useLayoutEffect(() => {
    targetSpreadKeyRef.current = targetSpreadKey;
    loadedSpreadKeyRef.current = loadedSpread?.key ?? null;
    loadedSpreadRef.current = loadedSpread;
  }, [loadedSpread, targetSpreadKey]);

  const revokeSpreadUrls = useCallback((spread: LoadedMangaSpread | null) => {
    for (const loadedPage of spread?.pages ?? []) {
      if (!pageUrls.current.delete(loadedPage.url)) continue;
      URL.revokeObjectURL(loadedPage.url);
    }
  }, []);

  const finishOutgoingSpread = useCallback((spread: LoadedMangaSpread) => {
    if (outgoingSpreadRef.current !== spread) return;
    outgoingSpreadRef.current = null;
    setOutgoingSpread(null);
    revokeSpreadUrls(spread);
    spreadTransitionTimer.current = null;
  }, [revokeSpreadUrls]);

  useEffect(() => () => {
    spreadLoadGeneration.current += 1;
    navigationPending.current = false;
    const document = pdfDocument.current;
    pdfDocument.current = null;
    if (document) void document.destroy();
    ocrAbort.current?.abort();
    ocrAbort.current = null;
    if (spreadTransitionTimer.current !== null) window.clearTimeout(spreadTransitionTimer.current);
    for (const url of pageUrls.current) URL.revokeObjectURL(url);
    pageUrls.current.clear();
    disposeMangaOcr();
  }, [mangaId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === readerRoot.current);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const sourceText = ocrText.trim();
    if (!jpdbApiKey || !sourceText) return;
    const controller = new AbortController();
    let current = true;
    const timer = window.setTimeout(() => {
      setTranslation({ status: "loading", sourceText });
      void fetch("/manga/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, apiKey: jpdbApiKey }),
        signal: controller.signal,
      }).then(async (response) => {
        const payload = await response.json() as { error?: unknown; isTruncated?: unknown; translation?: unknown };
        if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "JPDB translation failed.");
        const translatedText = typeof payload.translation === "string" ? payload.translation.trim() : "";
        if (!translatedText) throw new Error("JPDB did not return a translation for this selection.");
        if (!current) return;
        setTranslation({
          status: "ready",
          sourceText,
          translation: translatedText,
          isTruncated: payload.isTruncated === true,
        });
      }).catch((error: unknown) => {
        if (!current || controller.signal.aborted) return;
        setTranslation({
          status: "error",
          sourceText,
          message: error instanceof Error ? error.message : "JPDB translation is temporarily unavailable.",
        });
      });
    }, 0);
    return () => {
      current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [jpdbApiKey, ocrText]);

  useEffect(() => {
    let cancelled = false;
    let adoptedUrls = false;
    const createdUrls: string[] = [];
    const trackedPageUrls = pageUrls.current;
    const generation = spreadLoadGeneration.current + 1;
    spreadLoadGeneration.current = generation;
    navigationPending.current = true;
    ocrAbort.current?.abort();
    ocrAbort.current = null;

    async function openSpread() {
      if (spreadTransitionTimer.current !== null) {
        window.clearTimeout(spreadTransitionTimer.current);
        spreadTransitionTimer.current = null;
      }
      const abandonedOutgoingSpread = outgoingSpreadRef.current;
      if (abandonedOutgoingSpread) {
        outgoingSpreadRef.current = null;
        setOutgoingSpread(null);
        revokeSpreadUrls(abandonedOutgoingSpread);
      }
      setOcrState({ status: "idle" });
      setOcrText("");
      setTranslation(EMPTY_MANGA_TRANSLATION);
      setIsSpreadLoading(true);
      if (!targetSpread) return;
      const item = loadLibrary("manga").find((candidate) => candidate.id === mangaId);
      if (!item) throw new Error("This manga is not in the local library.");
      const source = mangaSource(item);
      let pageCount = source === "pdf" ? item.totalPages ?? 1 : item.assetIds.length;

      if (source === "pdf") {
        let document = pdfDocument.current;
        if (!document) {
          const storedPdf = await loadAsset(item.assetIds[0]);
          if (!storedPdf) throw new Error("The local PDF is missing.");
          document = await openMangaPdf(storedPdf);
          if (cancelled) {
            await document.destroy();
            return;
          }
          pdfDocument.current = document;
        }
        pageCount = document.pageCount;
      }

      const pageNumbers = targetSpread.pages.filter((pageNumber) => pageNumber <= pageCount);
      if (!pageNumbers.length) throw new Error("This manga spread does not contain a readable page.");
      const pagesWithBlobs = await Promise.all(pageNumbers.map(async (pageNumber) => {
        if (source === "pdf") {
          const document = pdfDocument.current;
          if (!document) throw new Error("The local PDF could not be opened.");
          return { blob: await document.renderPage(pageNumber), pageNumber };
        }
        const assetId = item.assetIds[pageNumber - 1];
        const storedPage = await loadAsset(assetId);
        if (!storedPage) throw new Error("This local manga page is missing.");
        return { blob: storedPage, pageNumber };
      }));
      const measuredPages = await Promise.all(pagesWithBlobs.map(async ({ blob, pageNumber }) => ({
        blob,
        pageNumber,
        ...await imageSize(blob),
      })));
      if (cancelled || spreadLoadGeneration.current !== generation || targetSpreadKeyRef.current !== targetSpreadKey) return;

      const loadedPages = measuredPages.map((loadedPage) => {
        const url = URL.createObjectURL(loadedPage.blob);
        createdUrls.push(url);
        trackedPageUrls.add(url);
        return { ...loadedPage, url };
      });
      const focusPage = targetSpread.pages.includes(page) ? page : targetSpread.resumePage;
      const cachedText = loadMangaOcrPage(mangaId, focusPage)?.text ?? "";
      setActiveOcrPage(focusPage);
      setOcrText(cachedText);
      setOcrState({ status: "idle" });
      const nextLoadedSpread: LoadedMangaSpread = {
        direction: navigationDirection,
        key: targetSpreadKey,
        pages: loadedPages,
        spread: targetSpread,
      };
      const previousLoadedSpread = loadedSpreadRef.current;
      if (previousLoadedSpread && previousLoadedSpread.key !== nextLoadedSpread.key) {
        const nextTurnOrigin = mangaTurnOrigin(navigationDirection, direction);
        setTurnOrigin(nextTurnOrigin);
        outgoingSpreadRef.current = previousLoadedSpread;
        setOutgoingSpread(previousLoadedSpread);
        spreadTransitionTimer.current = window.setTimeout(
          () => finishOutgoingSpread(previousLoadedSpread),
          380,
        );
      } else {
        revokeSpreadUrls(previousLoadedSpread);
      }
      loadedSpreadRef.current = nextLoadedSpread;
      setLoadedSpread(nextLoadedSpread);
      adoptedUrls = true;
      navigationPending.current = false;
      setIsSpreadLoading(false);
      setMessage("");

      const resumePage = Math.max(...pageNumbers);
      const updated: ContentRecord = {
        ...item,
        currentPage: resumePage,
        totalPages: pageCount,
        progress: resumePage / pageCount,
        updatedAt: new Date().toISOString(),
      };
      if (record?.totalPages !== pageCount) setRecord(updated);
      try {
        upsertRecord(updated);
      } catch {
        setMessage("The pages opened, but reading progress could not be saved.");
      }
    }

    void openSpread().catch((error) => {
      if (!cancelled && spreadLoadGeneration.current === generation && targetSpreadKeyRef.current === targetSpreadKey) {
        navigationPending.current = false;
        setIsSpreadLoading(false);
        setMessage(error instanceof Error ? error.message : "The manga pages could not be opened.");
      }
    });

    return () => {
      cancelled = true;
      if (!adoptedUrls) for (const url of createdUrls) {
        trackedPageUrls.delete(url);
        URL.revokeObjectURL(url);
      }
    };
  }, [direction, finishOutgoingSpread, mangaId, navigationDirection, page, record?.totalPages, revokeSpreadUrls, targetSpread, targetSpreadKey]);

  const changeSpread = useCallback((offset: -1 | 1) => {
    if (navigationPending.current || loadedSpreadKeyRef.current !== targetSpreadKeyRef.current) return;
    const nextSpread = spreads[currentSpreadIndex + offset];
    if (!nextSpread) return;
    navigationPending.current = true;
    ocrAbort.current?.abort();
    ocrAbort.current = null;
    setOcrState({ status: "idle" });
    setOcrText("");
    setTranslation(EMPTY_MANGA_TRANSLATION);
    setNavigationDirection(offset > 0 ? "next" : "previous");
    setPage(nextSpread.resumePage);
  }, [currentSpreadIndex, spreads]);

  useEffect(() => {
    const handleReaderKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editableEventTarget(event.target)) return;
      let offset: -1 | 1 | null = null;
      if (event.key === "PageDown") offset = 1;
      else if (event.key === "PageUp") offset = -1;
      else if (event.key === "ArrowLeft") offset = direction === "rtl" ? 1 : -1;
      else if (event.key === "ArrowRight") offset = direction === "rtl" ? -1 : 1;
      if (!offset) return;
      event.preventDefault();
      changeSpread(offset);
    };
    window.addEventListener("keydown", handleReaderKey);
    return () => window.removeEventListener("keydown", handleReaderKey);
  }, [changeSpread, direction]);

  async function recognize(loadedPage: LoadedMangaPage, selectionToRead: MangaOcrSelection, spreadKey: string) {
    if (spreadKey !== targetSpreadKeyRef.current || loadedSpreadKeyRef.current !== spreadKey || navigationPending.current) return;
    ocrAbort.current?.abort();
    const controller = new AbortController();
    ocrAbort.current = controller;
    setActiveOcrPage(loadedPage.pageNumber);
    setOcrText("");
    setTranslation(EMPTY_MANGA_TRANSLATION);
    setOcrState({
      status: "downloading-model",
      loadedBytes: 0,
      totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
      pageNumber: loadedPage.pageNumber,
      selection: selectionToRead,
    });
    try {
      saveMangaOcrPage(mangaId, loadedPage.pageNumber, "");
      const recognized = await recognizeMangaSelection(loadedPage.blob, selectionToRead, {
        signal: controller.signal,
        onProgress: (progress: MangaOcrProgress) => {
          if (ocrAbort.current !== controller || targetSpreadKeyRef.current !== spreadKey) return;
          if (progress.stage === "downloading-model") {
            setOcrState({
              status: progress.stage,
              loadedBytes: progress.loadedBytes,
              totalBytes: progress.totalBytes,
              pageNumber: loadedPage.pageNumber,
              selection: selectionToRead,
            });
          } else {
            if (progress.stage === "preparing-model") setModelRefreshToken((value) => value + 1);
            setOcrState({
              status: progress.stage,
              pageNumber: loadedPage.pageNumber,
              selection: selectionToRead,
            });
          }
        },
      });
      if (ocrAbort.current !== controller || targetSpreadKeyRef.current !== spreadKey || controller.signal.aborted) return;
      if (!recognized) throw new Error("No text was recognized. Try a tighter selection around the Japanese text.");
      saveMangaOcrPage(mangaId, loadedPage.pageNumber, recognized);
      setOcrText(recognized);
      setOcrState({
        status: "complete",
        pageNumber: loadedPage.pageNumber,
        selection: selectionToRead,
        recognizedText: recognized,
      });
      setModelRefreshToken((value) => value + 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (ocrAbort.current !== controller || targetSpreadKeyRef.current !== spreadKey) return;
      setOcrState({
        status: "error",
        pageNumber: loadedPage.pageNumber,
        selection: selectionToRead,
        message: error instanceof Error ? error.message : "The selected text could not be recognized.",
      });
    } finally {
      if (ocrAbort.current === controller) ocrAbort.current = null;
    }
  }

  async function toggleFullscreen() {
    const root = readerRoot.current;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      setMessage("Fullscreen could not be opened in this browser.");
    }
  }

  const activeTranslation = jpdbApiKey && translation.sourceText === ocrText.trim()
    ? translation
    : EMPTY_MANGA_TRANSLATION;

  function tooltipFor(pageNumber: number) {
    if (!isFullscreen || ocrState.status === "idle" || ocrState.pageNumber !== pageNumber) return null;
    const text = ocrStatusText(ocrState);
    return {
      selection: ocrState.selection,
      content: ocrState.status === "complete"
        ? <span className={styles.mangaFullscreenOcrResult}>
          <span lang="ja">{text}</span>
          <MangaTranslation state={activeTranslation} compact />
        </span>
        : isOcrBusy(ocrState)
          ? <MangaRecognitionLoader state={ocrState} compact />
          : text,
      tone: ocrState.status === "error" ? "error" as const : "default" as const,
      busy: isOcrBusy(ocrState),
    };
  }

  if (!record) return <ContentPage variant="media">
    <div className={styles.mangaReaderToolbar}>
      <Link className={styles.secondaryButton} href="/manga"><ArrowLeft size={16} aria-hidden="true" />Library</Link>
    </div>
    {message ? <div className={styles.errorNotice} role="alert">{message}</div> : null}
    <EmptyState title="Manga unavailable">If site data was cleared, return to the manga library and import the file again.</EmptyState>
  </ContentPage>;

  const leftNavigationOffset: -1 | 1 = direction === "rtl" ? 1 : -1;
  const rightNavigationOffset: -1 | 1 = direction === "rtl" ? -1 : 1;
  const navigationIsDisabled = isSpreadLoading || !displayedSpreadIsCurrent;
  const pageCounter = targetSpread.pages.length > 1
    ? `${targetSpread.pages[0]}–${targetSpread.pages.at(-1)} / ${totalPages}`
    : `${targetSpread.pages[0]} / ${totalPages}`;

  return <ContentPage variant="media">
    <div
      ref={readerRoot}
      className={styles.mangaReader}
      data-fullscreen={isFullscreen ? "true" : "false"}
      aria-busy={isSpreadLoading}
      aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown"
    >
      <h1 className={styles.visuallyHidden}>{record.title}</h1>
      <div className={styles.mangaReaderToolbar}>
        <Link className={styles.secondaryButton} href="/manga"><ArrowLeft size={16} aria-hidden="true" />Library</Link>
        <button className={styles.secondaryButton} type="button" aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      {message ? <div className={styles.errorNotice} role="status">{message}</div> : null}
      <div className={styles.mangaReaderGrid}>
        <section className={styles.mangaSpreadColumn} aria-label="Manga pages">
          <div className={styles.mangaSpreadStage} data-testid="manga-spread-stage">
            <div className={styles.mangaSpreadViewport} data-testid="manga-spread-viewport">
              {outgoingSpread ? <div
                className={`${styles.mangaSpread} ${styles.mangaOutgoingSpread}`}
                data-page-count={outgoingSpread.pages.length}
                data-transition-layer="outgoing"
                data-turn-origin={turnOrigin}
                aria-hidden="true"
              >
                {outgoingSpread.pages.map((loadedPage) => <div
                  className={styles.mangaSpreadPage}
                  data-side={mangaPageSide(
                    outgoingSpread.spread,
                    loadedPage.pageNumber,
                    direction,
                    placements[loadedPage.pageNumber - 1] ?? null,
                  )}
                  key={loadedPage.pageNumber}
                >
                  <Image
                    className={styles.mangaPageImage}
                    src={loadedPage.url}
                    width={loadedPage.width}
                    height={loadedPage.height}
                    sizes="(max-width: 56rem) 100vw, 70vw"
                    unoptimized
                    alt=""
                  />
                </div>)}
              </div> : null}
              {loadedSpread ? <div
                className={`${styles.mangaSpread} ${styles.mangaIncomingSpread}`}
                data-page-count={loadedSpread.pages.length}
                data-transition={loadedSpread.direction}
                data-reading-direction={direction}
                data-animating={outgoingSpread ? "true" : "false"}
                data-transition-layer="incoming"
                data-turn-origin={turnOrigin}
                data-testid="manga-spread"
              >
                {loadedSpread.pages.map((loadedPage) => <div
                  className={styles.mangaSpreadPage}
                  data-side={mangaPageSide(
                    loadedSpread.spread,
                    loadedPage.pageNumber,
                    direction,
                    placements[loadedPage.pageNumber - 1] ?? null,
                  )}
                  key={loadedPage.pageNumber}
                >
                  <MangaPageSelector
                    src={loadedPage.url}
                    width={loadedPage.width}
                    height={loadedPage.height}
                    alt={`${record.title}, page ${loadedPage.pageNumber}`}
                    disabled={isSpreadLoading || !displayedSpreadIsCurrent}
                    onSelectionComplete={(selection) => void recognize(loadedPage, selection, loadedSpread.key)}
                    tooltip={tooltipFor(loadedPage.pageNumber)}
                  />
                </div>)}
              </div> : <EmptyState title="Preparing pages">Opening the locally stored manga…</EmptyState>}
              {isSpreadLoading ? <div className={styles.mangaSpreadLoading} role="status">Opening pages…</div> : null}
            </div>
            <nav className={styles.mangaEdgeNavigation} aria-label="Manga page navigation">
              <button
                className={styles.mangaEdgeButton}
                data-physical-side="left"
                type="button"
                aria-label={leftNavigationOffset > 0 ? "Next" : "Previous"}
                disabled={navigationIsDisabled || currentSpreadIndex + leftNavigationOffset < 0 || currentSpreadIndex + leftNavigationOffset >= spreads.length}
                onClick={() => changeSpread(leftNavigationOffset)}
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <span className={styles.mangaPageCounter} aria-live="polite">{pageCounter}</span>
              <button
                className={styles.mangaEdgeButton}
                data-physical-side="right"
                type="button"
                aria-label={rightNavigationOffset > 0 ? "Next" : "Previous"}
                disabled={navigationIsDisabled || currentSpreadIndex + rightNavigationOffset < 0 || currentSpreadIndex + rightNavigationOffset >= spreads.length}
                onClick={() => changeSpread(rightNavigationOffset)}
              >
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </nav>
          </div>
        </section>
        <aside className={styles.mangaOcrRail} aria-label="Recognized text">
          <MangaOcrModelControl
            refreshToken={modelRefreshToken}
            activeDownload={ocrState.status === "downloading-model" ? {
              loadedBytes: ocrState.loadedBytes,
              totalBytes: ocrState.totalBytes,
            } : undefined}
          />
          {isOcrBusy(ocrState) ? <MangaRecognitionLoader state={ocrState} /> : ocrState.status !== "idle" ? <p
            className={ocrState.status === "error" ? styles.error : styles.success}
            role="status"
            aria-live="polite"
          >{ocrState.status === "complete" ? "Text recognized." : ocrStatusText(ocrState)}</p> : null}
          {!isOcrBusy(ocrState) && ocrText.trim() ? <div className={styles.mangaRecognitionResult} key={`${activeOcrPage}:${ocrText}`}>
            <JapaneseReader
              text={ocrText}
              ariaLabel={`Recognized manga text from page ${activeOcrPage}`}
              interaction="tooltip"
              appearance="compact"
            />
            <MangaTranslation state={activeTranslation} />
          </div> : !isOcrBusy(ocrState) ? <p className={styles.mangaOcrEmpty}>Drag across Japanese text on a page to recognize it.</p> : null}
        </aside>
      </div>
    </div>
  </ContentPage>;
}
