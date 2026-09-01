"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Expand, FileText, Images, KeyRound, Languages, LoaderCircle, Minimize2, Pencil, Square, Trash2, Upload, Volume2, X } from "lucide-react";
import { MotionConfig, Reorder, useDragControls, type Transition } from "motion/react";
import { LoadingState } from "@/components/ui/States";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { JAPANESE_VOICE_DOWNLOAD_LABEL, JAPANESE_VOICE_NAME } from "@/features/speech/japanese-voice-assets";
import { useJapaneseVoice } from "@/features/speech/use-japanese-voice";
import { useSession } from "@/lib/session";
import { FileDropOverlay } from "./FileDropOverlay";
import { JapaneseReader, useJapaneseReaderAnalysisContexts } from "./JapaneseReader";
import { LocalFilePicker } from "./LocalFilePicker";
import { MangaPageSelector } from "./MangaPageSelector";
import { linkedFileIds, linkedMetadata, requestLinkedFilePermission, requestPersistentLocalStorage } from "./local-file-source";
import { createMangaCoverThumbnail } from "./manga-cover-thumbnail";
import { resolveLinkedMangaSource, type LinkedMangaSourceResult } from "./manga-linked-source";
import { isMangaContainer, isMangaImage, prepareMangaImport, type MangaImportSource, type PreparedMangaImport } from "./manga-import";
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
  removeFileHandle,
  reorderLibrary,
  saveAsset,
  saveFileHandle,
  saveLibrary,
  saveMangaOcrPage,
  updateRecordInPlace,
} from "./storage";
import type { ContentRecord } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import { ContentHeader, ContentPage, EmptyState, Progress, UndoNotice } from "./ui";
import styles from "./content.module.css";

const TWO_PAGE_QUERY = "(min-width: 56rem)";
const MANGA_REORDER_TRANSITION: Transition = {
  layout: { type: "spring", visualDuration: 0.24, bounce: 0.08 },
  scale: { duration: 0.14, ease: [0.2, 0, 0, 1] },
};

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

type MangaImportProgress =
  | { stage: "preparing"; current: number; total: number; name: string }
  | { stage: "saving"; current: number; total: number; name: string; pageCount: number; sourceType: MangaImportSource; linked: boolean };

type ReadyLinkedMangaSource = Extract<LinkedMangaSourceResult, { status: "ready" }>;
type MangaSourceAccess = "permission" | "missing" | "unavailable" | null;

const EMPTY_MANGA_TRANSLATION: MangaTranslationState = { status: "idle", sourceText: "" };
const MANGA_PICKER_ACCEPT = {
  "application/epub+zip": [".epub"],
  "application/pdf": [".pdf"],
  "application/vnd.comicbook+zip": [".cbz"],
  "application/zip": [".zip"],
  "image/*": [".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"],
} as const;

function groupMangaImportFiles(files: readonly File[]) {
  const isLooseImage = (file: File) => !isMangaContainer(file) && isMangaImage(file);
  const imageFiles = files.filter(isLooseImage);
  let includedImageGroup = false;

  return files.flatMap((file) => {
    if (!isLooseImage(file)) return [[file]];
    if (includedImageGroup) return [];
    includedImageGroup = true;
    return [imageFiles];
  });
}

function mangaImportGroupName(files: readonly File[]) {
  if (files.length === 1) return files[0].name;
  return `${files.length.toLocaleString()} image pages`;
}

function mangaImportProgressDetail(progress: MangaImportProgress) {
  if (progress.stage === "preparing") return `Preparing “${progress.name}” in this browser.`;
  if (progress.linked) {
    return progress.sourceType === "images"
      ? `Linking ${progress.pageCount.toLocaleString()} original page${progress.pageCount === 1 ? "" : "s"} for “${progress.name}”.`
      : `Linking “${progress.name}” to its original file.`;
  }
  if (progress.sourceType === "pdf") return `Saving “${progress.name}” in this browser.`;
  return `Saving ${progress.pageCount.toLocaleString()} page${progress.pageCount === 1 ? "" : "s"} for “${progress.name}” in this browser.`;
}

function linkedHandlesForMangaImport(
  sourceFiles: readonly File[],
  preparedAssets: readonly File[],
  sourceType: MangaImportSource,
  handleByFile: ReadonlyMap<File, FileSystemFileHandle | null>,
) {
  const filesToLink = sourceType === "images" ? preparedAssets : sourceFiles.slice(0, 1);
  const handles = filesToLink.map((file) => handleByFile.get(file) ?? null);
  return handles.length > 0 && handles.every((handle): handle is FileSystemFileHandle => handle !== null)
    ? handles
    : null;
}

async function preparedMangaCoverThumbnail(prepared: PreparedMangaImport) {
  let cover: Blob | null = prepared.assets[0] ?? null;
  if (!cover) return null;

  if (prepared.sourceType === "pdf") {
    const document = await openMangaPdf(cover);
    try {
      cover = await document.renderPage(1);
    } finally {
      await document.destroy();
    }
  }

  return createMangaCoverThumbnail(cover);
}

function moveMangaRecord(records: readonly ContentRecord[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return records;
  const sourceIndex = records.findIndex((record) => record.id === sourceId);
  const targetIndex = records.findIndex((record) => record.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return records;
  const next = [...records];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function hasMangaOrder(records: readonly ContentRecord[], orderedIds: readonly string[]) {
  return records.length === orderedIds.length && records.every((record, index) => record.id === orderedIds[index]);
}

function stopMangaDragPropagation(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation();
}

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

function linkedMangaAccessMessage(result: Exclude<LinkedMangaSourceResult, { status: "not-linked" | "ready" }>) {
  if (result.status === "permission") return "Allow access to the original manga file to continue.";
  if (result.status === "missing") return "The link to the original manga was lost. Locate it again to continue.";
  return result.error.message || "The original manga file is temporarily unavailable.";
}

function MangaCover({ record, onMissingAsset }: { record: ContentRecord; onMissingAsset: (recordId: string) => void }) {
  const coverAssetId = record.assetIds[0];
  const linkedIds = linkedFileIds(record);
  const source = mangaSource(record);
  const [coverUrl, setCoverUrl] = useState("");
  const [failed, setFailed] = useState(!coverAssetId);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = "";

    async function loadCover() {
      setCoverUrl("");
      setFailed(false);
      let cover: Blob | null = coverAssetId ? await loadAsset(coverAssetId) : null;

      if (!cover) {
        if (!cancelled) {
          setFailed(true);
          if (!linkedIds.length) onMissingAsset(record.id);
        }
        return;
      }

      if (source === "pdf" && !linkedIds.length) {
        const document = await openMangaPdf(cover);
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
  }, [coverAssetId, linkedIds.length, onMissingAsset, record.id, source]);

  const visibleCoverUrl = coverAssetId ? coverUrl : "";
  const coverFailed = !coverAssetId || failed;

  return <div className={styles.mangaShelfCover} data-state={coverFailed ? "error" : visibleCoverUrl ? "ready" : "loading"}>
    {visibleCoverUrl && !coverFailed ? <Image
      src={visibleCoverUrl}
      alt={`Cover of ${record.title}`}
      draggable={false}
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
  canDrag,
  canRemove,
  canReorder,
  dragging,
  item,
  onClickCapture,
  onDragEnd,
  onDragStart,
  onMissingAsset,
  onMove,
  onRemove,
  onRename,
}: {
  canDrag: boolean;
  canRemove: boolean;
  canReorder: boolean;
  dragging: boolean;
  item: ContentRecord;
  onClickCapture: (event: ReactMouseEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onDragStart: (item: ContentRecord) => void;
  onMissingAsset: (recordId: string) => void;
  onMove: (item: ContentRecord, offset: -1 | 1) => void;
  onRemove: (item: ContentRecord) => void;
  onRename: (item: ContentRecord, title: string) => boolean;
}) {
  const dragControls = useDragControls();
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
      setDraftTitle("");
      setTitleError("Enter a title.");
      return;
    }
    if (onRename(item, title)) {
      setDraftTitle(title);
      setTitleError("");
      setEditing(false);
    }
  }

  function handleReorderKeyDown(event: ReactKeyboardEvent<HTMLLIElement>) {
    if (!canReorder || event.target !== event.currentTarget || !event.altKey) return;
    const offset = event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? -1
      : event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : null;
    if (!offset) return;
    event.preventDefault();
    onMove(item, offset);
  }

  function handleReorderPointerDown(event: ReactPointerEvent<HTMLLIElement>) {
    if (!canDrag || event.pointerType !== "mouse") return;
    dragControls.start(event, { distanceThreshold: 6 });
  }

  return <Reorder.Item
    className={styles.mangaShelfItem}
    value={item.id}
    drag={canDrag}
    dragControls={dragControls}
    dragListener={false}
    dragMomentum={false}
    draggable={false}
    layout="position"
    transition={MANGA_REORDER_TRANSITION}
    whileDrag={canDrag ? { scale: 1.025 } : undefined}
    data-can-drag={canDrag || undefined}
    data-dragging={dragging || undefined}
    tabIndex={canReorder ? 0 : undefined}
    aria-keyshortcuts={canReorder ? "Alt+ArrowLeft Alt+ArrowUp Alt+ArrowRight Alt+ArrowDown" : undefined}
    onClickCapture={onClickCapture}
    onDragStart={() => onDragStart(item)}
    onDragEnd={onDragEnd}
    onKeyDown={handleReorderKeyDown}
    onPointerDown={handleReorderPointerDown}
  >
    <div className={styles.mangaShelfCard}>
      <div className={styles.mangaShelfCoverFrame}>
        <Link draggable={false} className={styles.mangaShelfCoverLink} href={`/manga/${item.id}`} aria-label={`Read ${item.title}`}>
          <MangaCover record={item} onMissingAsset={onMissingAsset} />
        </Link>
      </div>
      <div className={styles.mangaShelfCopy}>
        {editing ? <form className={styles.mangaTitleForm} onPointerDownCapture={stopMangaDragPropagation} onSubmit={(event) => {
          event.preventDefault();
          saveTitle();
        }}>
          <input
            className={styles.input}
            aria-label="Manga title"
            aria-invalid={Boolean(titleError)}
            autoFocus
            maxLength={200}
            placeholder={titleError || undefined}
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
          {titleError ? <span className={styles.visuallyHidden} role="alert">{titleError}</span> : null}
        </form> : <div className={styles.mangaShelfTitleRow}>
          <h2><Link draggable={false} href={`/manga/${item.id}`}>{item.title}</Link></h2>
          <button className={styles.mangaShelfEditButton} type="button" aria-label={`Edit title for ${item.title}`} onPointerDownCapture={stopMangaDragPropagation} onClick={() => {
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
        <Link draggable={false} className={styles.secondaryButton} href={`/manga/${item.id}`} onPointerDownCapture={stopMangaDragPropagation}>{item.progress > 0 ? "Continue" : "Read"}</Link>
        <button className={styles.iconButton} type="button" disabled={!canRemove} onPointerDownCapture={stopMangaDragPropagation} onClick={() => onRemove(item)} aria-label={`Remove ${item.title}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  </Reorder.Item>;
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

async function decodeMangaPage(url: string) {
  const image = new window.Image();
  image.decoding = "async";
  image.loading = "eager";
  image.src = url;
  if (typeof image.decode === "function") await image.decode();
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

type JapaneseVoiceController = ReturnType<typeof useJapaneseVoice>;

function MangaOcrVoiceControl({ text, voice }: { text: string; voice: JapaneseVoiceController }) {
  const promptId = useId();
  const [promptOpen, setPromptOpen] = useState(false);
  const sentence = text.trim();
  const active = voice.activeSentence === sentence
    && (voice.activity === "synthesizing" || voice.activity === "playing");
  const canStop = active;
  const busyElsewhere = voice.activity !== "idle" && !active && voice.activity !== "downloading";
  const downloading = voice.activity === "downloading";
  const showPrompt = promptOpen && voice.checked && voice.supported && !voice.downloaded;
  const buttonLabel = !voice.checked
    ? "Checking Japanese voice"
    : !voice.supported
      ? "Japanese voice unavailable"
      : !voice.downloaded
        ? downloading
          ? "Japanese voice is downloading"
          : "Set up Japanese voice to read recognized text aloud"
        : active
          ? voice.activity === "playing"
            ? "Stop recognized Japanese audio"
            : "Cancel recognized Japanese audio"
          : busyElsewhere
            ? "Japanese voice is busy"
            : "Play recognized Japanese text aloud";
  const buttonState = active ? voice.activity : downloading ? "downloading" : "idle";
  const downloadLabel = downloading
    ? "Cancel download"
    : voice.error
      ? "Retry download"
      : `Download voice · ${JAPANESE_VOICE_DOWNLOAD_LABEL}`;

  return <>
    <button
      className={styles.mangaVoiceButton}
      type="button"
      aria-label={buttonLabel}
      aria-busy={!voice.checked || (active && voice.activity === "synthesizing") || undefined}
      aria-expanded={voice.checked && !voice.downloaded && voice.supported ? showPrompt : undefined}
      aria-controls={voice.checked && !voice.downloaded && voice.supported ? promptId : undefined}
      data-state={buttonState}
      disabled={!sentence || !voice.checked || !voice.supported || busyElsewhere}
      title={buttonLabel}
      onClick={() => {
        if (canStop) {
          voice.stop();
          return;
        }
        if (!voice.downloaded) {
          setPromptOpen((current) => !current);
          return;
        }
        void voice.play(sentence);
      }}
    >
      {!voice.checked || (active && voice.activity === "synthesizing") || downloading
        ? <LoaderCircle className={styles.spin} size={18} aria-hidden="true" />
        : active && voice.activity === "playing"
          ? <Square size={16} aria-hidden="true" />
          : <Volume2 size={18} aria-hidden="true" />}
    </button>
    {showPrompt ? <div
      id={promptId}
      className={styles.mangaVoicePrompt}
      role="group"
      aria-labelledby={`${promptId}-label`}
    >
      <strong id={`${promptId}-label`}>Download Japanese voice?</strong>
      <p>Download {JAPANESE_VOICE_NAME} once and keep it in this browser ({JAPANESE_VOICE_DOWNLOAD_LABEL}).</p>
      {downloading && voice.message ? <p className={styles.hint} role="status">{voice.message}</p> : null}
      {voice.error ? <p className={styles.error} role="alert">{voice.error}</p> : null}
      <button
        className={styles.secondaryButton}
        type="button"
        onClick={() => downloading ? voice.cancelDownload() : void voice.download()}
      >
        {downloading ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        {downloadLabel}
      </button>
    </div> : null}
    {!showPrompt && voice.error ? <p className={`${styles.error} ${styles.mangaVoiceError}`} role="alert">{voice.error}</p> : null}
  </>;
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
  const label = activeDownload
    ? `OCR model · ${formatModelBytes(activeDownload.loadedBytes)} / ${formatModelBytes(activeDownload.totalBytes)}`
    : state.status === "downloading"
      ? `${state.assetLabel} · ${formatModelBytes(state.loadedBytes)} / ${formatModelBytes(state.totalBytes)}`
    : state.status === "checking"
      ? "Checking OCR model…"
      : state.loadedBytes > 0
        ? `${formatModelBytes(state.loadedBytes)} of ${formatModelBytes(state.totalBytes)} saved`
        : `${formatModelBytes(state.totalBytes)} download`;

  if (isReady) return null;

  return <div className={styles.mangaModelControl} data-state={state.status}>
    <div className={styles.mangaModelStatus} role="status" aria-live="polite">
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
  const [importProgress, setImportProgress] = useState<MangaImportProgress | null>(null);
  const [importAnnouncement, setImportAnnouncement] = useState("");
  const [draggedMangaId, setDraggedMangaId] = useState<string | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const draggedMangaIdRef = useRef<string | null>(null);
  const dragStartOrderRef = useRef<string[] | null>(null);
  const mangaOrderRef = useRef(manga);
  const suppressClickAfterDragRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const importInFlightRef = useRef(false);
  const missingMangaCleanupRef = useRef(new Set<string>());
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => {
      setManga(loadLibrary("manga"));
      setMessage("The manga could not be removed from browser storage, so it was restored.");
    },
  });
  const canReorder = manga.length > 1 && !busy && !deletion.pending;
  const canDrag = canReorder;

  const removeMangaWithMissingAsset = useCallback((recordId: string) => {
    if (missingMangaCleanupRef.current.has(recordId)) return;
    const record = loadLibrary("manga").find((candidate) => candidate.id === recordId);
    if (!record) return;
    missingMangaCleanupRef.current.add(recordId);

    const cleanup = deleteRecord(record);
    const stored = loadLibrary("manga");
    mangaOrderRef.current = stored;
    setManga((current) => current.filter((candidate) => candidate.id !== recordId));
    setMessage("Removed manga whose local files were no longer available.");

    void cleanup.catch(() => {
      const restored = loadLibrary("manga");
      mangaOrderRef.current = restored;
      setManga(restored);
      setMessage("A manga with missing local files could not be removed from the library.");
      missingMangaCleanupRef.current.delete(recordId);
    });
  }, []);

  useEffect(() => {
    function resetDragOnBlur() {
      if (!draggedMangaIdRef.current) return;
      const stored = loadLibrary("manga");
      mangaOrderRef.current = stored;
      setManga(stored);
      draggedMangaIdRef.current = null;
      dragStartOrderRef.current = null;
      suppressClickAfterDragRef.current = false;
      setDraggedMangaId(null);
    }
    window.addEventListener("blur", resetDragOnBlur);
    return () => {
      window.removeEventListener("blur", resetDragOnBlur);
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
      draggedMangaIdRef.current = null;
      dragStartOrderRef.current = null;
    };
  }, []);

  async function importFiles(files: File[], handles: Array<FileSystemFileHandle | null> = []) {
    if (!files.length || importInFlightRef.current || deletion.pending) return;
    const importGroups = groupMangaImportFiles(files);
    if (!importGroups.length) return;
    const handleByFile = new Map(files.map((file, index) => [file, handles[index] ?? null]));
    importInFlightRef.current = true;
    const savedAssetIds: string[] = [];
    const savedHandleIds: string[] = [];
    setBusy(true);
    setMessage("");
    setImportAnnouncement("");

    try {
      const records: ContentRecord[] = [];

      for (const [groupIndex, importGroup] of importGroups.entries()) {
        setImportProgress({
          stage: "preparing",
          current: groupIndex + 1,
          total: importGroups.length,
          name: mangaImportGroupName(importGroup),
        });
        const prepared = await prepareMangaImport(importGroup);
        const importMetadata = prepared.metadata ?? {
          readingDirection: "rtl" as const,
          pagePlacements: Array<MangaPagePlacement>(prepared.pageCount).fill(null),
        };
        const linkedHandles = linkedHandlesForMangaImport(
          importGroup,
          prepared.assets,
          prepared.sourceType,
          handleByFile,
        );
        setImportProgress({
          stage: "saving",
          current: groupIndex + 1,
          total: importGroups.length,
          name: prepared.title,
          pageCount: prepared.pageCount,
          sourceType: prepared.sourceType,
          linked: Boolean(linkedHandles),
        });
        const recordAssetIds: string[] = [];
        const recordHandleIds: string[] = [];

        if (linkedHandles) {
          const pendingHandles = linkedHandles.map((handle) => ({
            handle,
            id: createLocalId("manga-file"),
          }));
          const handleSaves = await Promise.allSettled(
            pendingHandles.map(({ handle, id }) => saveFileHandle(id, handle)),
          );
          if (handleSaves.every((result) => result.status === "fulfilled")) {
            recordHandleIds.push(...pendingHandles.map(({ id }) => id));
            savedHandleIds.push(...recordHandleIds);
          } else {
            await Promise.all(pendingHandles.map(({ id }) => removeFileHandle(id).catch(() => undefined)));
          }
        }

        if (recordHandleIds.length) {
          const thumbnail = await preparedMangaCoverThumbnail(prepared).catch(() => null);
          if (thumbnail) {
            const coverAssetId = createLocalId("manga-cover");
            try {
              await saveAsset(coverAssetId, thumbnail);
              recordAssetIds.push(coverAssetId);
              savedAssetIds.push(coverAssetId);
            } catch {
              await removeAsset(coverAssetId).catch(() => undefined);
            }
          }
        }

        if (!recordHandleIds.length) {
          setImportProgress({
            stage: "saving",
            current: groupIndex + 1,
            total: importGroups.length,
            name: prepared.title,
            pageCount: prepared.pageCount,
            sourceType: prepared.sourceType,
            linked: false,
          });
          for (const asset of prepared.assets) {
            const assetId = createLocalId("manga-page");
            recordAssetIds.push(assetId);
            savedAssetIds.push(assetId);
            await saveAsset(assetId, asset);
          }
        }

        const now = new Date().toISOString();
        records.push({
          id: createLocalId("manga"),
          kind: "manga",
          title: prepared.title,
          fileName: prepared.fileName,
          mimeType: prepared.sourceType === "pdf" ? "application/pdf" : "image/*",
          assetIds: recordAssetIds,
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
            ...linkedMetadata(recordHandleIds),
          },
        });
      }

      const next = [...loadLibrary("manga"), ...records];
      if (!saveLibrary("manga", next)) throw new Error("Browser storage is full or unavailable.");
      setManga(next);
      setImportAnnouncement(records.length === 1 ? `Imported “${records[0].title}”.` : `Imported ${records.length} manga.`);
      if (savedHandleIds.length) void requestPersistentLocalStorage();
    } catch (error) {
      await Promise.all([
        ...savedAssetIds.map((assetId) => removeAsset(assetId).catch(() => undefined)),
        ...savedHandleIds.map((handleId) => removeFileHandle(handleId).catch(() => undefined)),
      ]);
      const errorMessage = error instanceof Error ? error.message : "Those pages could not be imported.";
      setMessage(`${errorMessage} Nothing from this import was added.`);
    } finally {
      importInFlightRef.current = false;
      setBusy(false);
      setImportProgress(null);
    }
  }

  function remove(item: ContentRecord) {
    if (importInFlightRef.current) return;
    setManga((current) => current.filter((candidate) => candidate.id !== item.id));
    deletion.requestDeletion(item);
  }

  function rename(item: ContentRecord, title: string) {
    const stored = loadLibrary("manga").find((candidate) => candidate.id === item.id) ?? item;
    const updated = { ...stored, title, updatedAt: new Date().toISOString() };
    try {
      setManga(updateRecordInPlace(updated));
    } catch {
      setMessage("The title could not be saved in browser storage.");
      return false;
    }
    setMessage("");
    return true;
  }

  function persistMangaOrder(next: readonly ContentRecord[], moved: ContentRecord) {
    let savedOrder: ContentRecord[];
    try {
      savedOrder = reorderLibrary("manga", next.map((record) => record.id));
    } catch {
      const restored = loadLibrary("manga");
      mangaOrderRef.current = restored;
      setManga(restored);
      setMessage("The manga order could not be saved in browser storage, so the previous order was restored.");
      setReorderAnnouncement(`The position of ${moved.title} could not be saved.`);
      return;
    }
    mangaOrderRef.current = savedOrder;
    setManga(savedOrder);
    setMessage("");
    const position = savedOrder.findIndex((record) => record.id === moved.id) + 1;
    setReorderAnnouncement(`${moved.title} moved to position ${position} of ${savedOrder.length}.`);
  }

  function startMangaDrag(item: ContentRecord) {
    if (!canReorder) return;
    if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
    mangaOrderRef.current = manga;
    dragStartOrderRef.current = manga.map((record) => record.id);
    draggedMangaIdRef.current = item.id;
    suppressClickAfterDragRef.current = true;
    setDraggedMangaId(item.id);
  }

  function previewMangaOrder(orderedIds: string[]) {
    if (!canReorder || !draggedMangaIdRef.current) return;
    if (hasMangaOrder(mangaOrderRef.current, orderedIds)) return;
    const recordsById = new Map(mangaOrderRef.current.map((record) => [record.id, record]));
    const next = orderedIds.flatMap((id) => {
      const record = recordsById.get(id);
      return record ? [record] : [];
    });
    if (next.length !== mangaOrderRef.current.length) return;
    mangaOrderRef.current = next;
    setManga(next);
  }

  function finishMangaDrag() {
    const sourceId = draggedMangaIdRef.current;
    const startOrder = dragStartOrderRef.current;
    const next = mangaOrderRef.current;
    draggedMangaIdRef.current = null;
    dragStartOrderRef.current = null;
    setDraggedMangaId(null);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickAfterDragRef.current = false;
      suppressClickTimerRef.current = null;
    }, 0);
    if (!sourceId || !startOrder || hasMangaOrder(next, startOrder)) return;
    const moved = next.find((record) => record.id === sourceId);
    if (moved) persistMangaOrder(next, moved);
  }

  function preventClickAfterDrag(event: ReactMouseEvent<HTMLLIElement>) {
    if (!suppressClickAfterDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function moveMangaBy(item: ContentRecord, offset: -1 | 1) {
    if (!canReorder) return;
    const index = manga.findIndex((record) => record.id === item.id);
    const target = manga[index + offset];
    if (target) persistMangaOrder(moveMangaRecord(manga, item.id, target.id), item);
  }

  return <ContentPage variant="library">
    <ContentHeader
      title="Manga library"
      description="Import single-image-page EPUB, CBZ, ZIP, PDF, or image pages. Supported browsers link to the originals on this device."
      actions={<>
        <MangaOcrModelControl />
        <Link className={styles.secondaryButton} href="/settings#jpdb-api-key">
          <KeyRound size={16} aria-hidden="true" />
          Add JPDB API key
        </Link>
        <LocalFilePicker
          className={styles.button}
          accept={MANGA_PICKER_ACCEPT}
          aria-busy={busy || undefined}
          data-disabled={deletion.pending ? "true" : undefined}
          description="Manga files"
          disabled={busy || Boolean(deletion.pending)}
          multiple
          onFiles={importFiles}
          onPickerError={(error) => setMessage(error.message || "The manga picker could not be opened.")}
        >
          <Upload size={16} aria-hidden="true" />
          <span>{busy ? "Importing…" : "Import manga"}</span>
        </LocalFilePicker>
      </>}
    />
    <FileDropOverlay
      disabled={busy || Boolean(deletion.pending)}
      hint="EPUB · CBZ · ZIP · PDF · image pages"
      icon={<Upload size={32} aria-hidden="true" />}
      label="Drop to import manga"
      multiple
      onFiles={importFiles}
    />
    {importProgress ? <LoadingState
      className={styles.mangaImportStatus}
      compact
      label={importProgress.total === 1 ? "Importing manga…" : `Importing manga ${importProgress.current} of ${importProgress.total}…`}
      detail={mangaImportProgressDetail(importProgress)}
    /> : null}
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    {manga.length ? <MotionConfig reducedMotion="user">
      <Reorder.Group
        as="ol"
        axis="xy"
        className={styles.mangaShelfGrid}
        aria-label="Manga library order"
        aria-describedby={manga.length > 1 ? "manga-reorder-instructions" : undefined}
        values={manga.map((record) => record.id)}
        onReorder={previewMangaOrder}
        {...firstLibraryReveal}
      >
        {manga.map((item) => <MangaShelfItem
          canDrag={canDrag}
          canRemove={!busy}
          canReorder={canReorder}
          dragging={draggedMangaId === item.id}
          item={item}
          key={item.id}
          onClickCapture={preventClickAfterDrag}
          onDragEnd={finishMangaDrag}
          onDragStart={startMangaDrag}
          onMissingAsset={removeMangaWithMissingAsset}
          onMove={moveMangaBy}
          onRemove={remove}
          onRename={rename}
        />)}
      </Reorder.Group>
      {manga.length > 1 ? <p className={styles.visuallyHidden} id="manga-reorder-instructions">
        Drag a manga card to reorder it. Keyboard users can focus a card and hold Alt while pressing an arrow key.
      </p> : null}
    </MotionConfig> : <EmptyState title="No manga yet">Import one EPUB, CBZ, ZIP, or PDF, or select a set of image pages. Files remain on this device.</EmptyState>}
    <p className={styles.visuallyHidden} role="status" aria-live="polite">{importAnnouncement}</p>
    <p className={styles.visuallyHidden} role="status" aria-live="polite">{reorderAnnouncement}</p>
    {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => {
      deletion.undoDeletion();
      setManga(loadLibrary("manga"));
    }} /> : null}
  </ContentPage>;
}

export function MangaReader({ mangaId }: { mangaId: string }) {
  const { user } = useSession();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const voice = useJapaneseVoice();
  const stopVoice = voice.stop;
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
  const [sourceAccess, setSourceAccess] = useState<MangaSourceAccess>(null);
  const [sourceRetryToken, setSourceRetryToken] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const ocrAnalysisSources = useMemo(
    () => ocrText.trim() ? [{ id: "active-manga-ocr", text: ocrText }] : [],
    [ocrText],
  );
  const ocrAnalysisContexts = useJapaneseReaderAnalysisContexts(ocrAnalysisSources, {
    apiKey: jpdbApiKey,
    enabled: Boolean(jpdbApiKey && settings.reader?.recognitionMode === "wk-jpdb"),
  });
  const ocrAnalysisContext = ocrAnalysisContexts.get("active-manga-ocr");
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
  const linkedSource = useRef<{ recordId: string; source: ReadyLinkedMangaSource } | null>(null);
  const linkedPermissionHandle = useRef<FileSystemFileHandle | null>(null);
  const sourceRecoveryPending = useRef(false);
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
    if (spreadTransitionTimer.current !== null) window.clearTimeout(spreadTransitionTimer.current);
    spreadTransitionTimer.current = null;
    outgoingSpreadRef.current = null;
    setOutgoingSpread(null);
    revokeSpreadUrls(spread);
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
    spreadTransitionTimer.current = null;
    outgoingSpreadRef.current = null;
    for (const url of pageUrls.current) URL.revokeObjectURL(url);
    pageUrls.current.clear();
    disposeMangaOcr();
    stopVoice();
  }, [mangaId, stopVoice]);

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
      const handleIds = linkedFileIds(item);
      let resolvedLinkedSource: ReadyLinkedMangaSource | null = null;
      if (handleIds.length) {
        const cached = linkedSource.current;
        const linked = cached?.recordId === item.id
          ? cached.source
          : await resolveLinkedMangaSource(item);
        if (linked.status === "permission") {
          linkedPermissionHandle.current = linked.handle;
          setSourceAccess("permission");
          throw new Error(linkedMangaAccessMessage(linked));
        }
        if (linked.status === "missing") {
          setSourceAccess("missing");
          throw new Error(linkedMangaAccessMessage(linked));
        }
        if (linked.status === "unavailable") {
          setSourceAccess("unavailable");
          throw new Error(linkedMangaAccessMessage(linked));
        }
        if (linked.status !== "ready") throw new Error("The linked manga source could not be opened.");
        linkedPermissionHandle.current = null;
        linkedSource.current = { recordId: item.id, source: linked };
        resolvedLinkedSource = linked;
        setSourceAccess(null);
      }

      let pageCount = resolvedLinkedSource?.kind === "pages"
        ? resolvedLinkedSource.pages.length
        : source === "pdf"
          ? item.totalPages ?? 1
          : item.assetIds.length;

      if (source === "pdf") {
        let document = pdfDocument.current;
        if (!document) {
          const storedPdf = resolvedLinkedSource?.kind === "pdf"
            ? resolvedLinkedSource.file
            : await loadAsset(item.assetIds[0]);
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
        if (resolvedLinkedSource?.kind === "pages") {
          const linkedPage = resolvedLinkedSource.pages[pageNumber - 1];
          if (!linkedPage) throw new Error("This linked manga page is missing.");
          return { blob: linkedPage, pageNumber };
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
      await Promise.all(loadedPages.map((loadedPage) => decodeMangaPage(loadedPage.url)));
      if (cancelled || spreadLoadGeneration.current !== generation || targetSpreadKeyRef.current !== targetSpreadKey) return;
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
        updateRecordInPlace(updated);
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
  }, [direction, finishOutgoingSpread, mangaId, navigationDirection, page, record?.totalPages, revokeSpreadUrls, sourceRetryToken, targetSpread, targetSpreadKey]);

  const changeSpread = useCallback((offset: -1 | 1) => {
    if (navigationPending.current || outgoingSpreadRef.current || loadedSpreadKeyRef.current !== targetSpreadKeyRef.current) return;
    const nextSpread = spreads[currentSpreadIndex + offset];
    if (!nextSpread) return;
    navigationPending.current = true;
    ocrAbort.current?.abort();
    ocrAbort.current = null;
    stopVoice();
    setOcrState({ status: "idle" });
    setOcrText("");
    setTranslation(EMPTY_MANGA_TRANSLATION);
    setNavigationDirection(offset > 0 ? "next" : "previous");
    setPage(nextSpread.resumePage);
  }, [currentSpreadIndex, spreads, stopVoice]);

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
    stopVoice();
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

  async function allowLinkedMangaAccess() {
    const permissionHandle = linkedPermissionHandle.current;
    if (!record || !permissionHandle || sourceRecoveryPending.current) return;
    sourceRecoveryPending.current = true;
    const permissionRequest = requestLinkedFilePermission(permissionHandle);
    setIsSpreadLoading(true);
    setMessage("");
    try {
      const permission = await permissionRequest;
      if (permission.status !== "granted") {
        setIsSpreadLoading(false);
        setSourceAccess(permission.status === "permission" ? "permission" : "unavailable");
        setMessage(permission.status === "permission"
          ? "File access was not granted. You can try again or locate the original files."
          : permission.error.message);
        return;
      }
      const linked = await resolveLinkedMangaSource(record);
      if (linked.status === "ready") {
        linkedPermissionHandle.current = null;
        linkedSource.current = { recordId: record.id, source: linked };
        setSourceAccess(null);
        setSourceRetryToken((value) => value + 1);
        return;
      }
      setIsSpreadLoading(false);
      if (linked.status === "permission" || linked.status === "missing" || linked.status === "unavailable") {
        linkedPermissionHandle.current = linked.status === "permission" ? linked.handle : null;
        setSourceAccess(linked.status);
        setMessage(linkedMangaAccessMessage(linked));
      }
    } catch (error) {
      setIsSpreadLoading(false);
      setMessage(error instanceof Error ? error.message : "File access could not be restored.");
    } finally {
      sourceRecoveryPending.current = false;
    }
  }

  async function reconnectLinkedManga(
    files: File[],
    handles: Array<FileSystemFileHandle | null> = [],
  ) {
    if (!record || !files.length || sourceRecoveryPending.current) return;
    sourceRecoveryPending.current = true;
    const previousAssetIds = [...record.assetIds];
    const previousHandleIds = linkedFileIds(record);
    const newAssetIds: string[] = [];
    const newHandleIds: string[] = [];
    let committed = false;
    setIsSpreadLoading(true);
    setMessage("");

    try {
      const prepared = await prepareMangaImport(files);
      const handleByFile = new Map(files.map((file, index) => [file, handles[index] ?? null]));
      const linkedHandles = linkedHandlesForMangaImport(files, prepared.assets, prepared.sourceType, handleByFile);

      if (linkedHandles) {
        const pendingHandles = linkedHandles.map((handle) => ({
          handle,
          id: createLocalId("manga-file"),
        }));
        const saves = await Promise.allSettled(
          pendingHandles.map(({ handle, id }) => saveFileHandle(id, handle)),
        );
        if (saves.every((result) => result.status === "fulfilled")) {
          newHandleIds.push(...pendingHandles.map(({ id }) => id));
        } else {
          await Promise.all(pendingHandles.map(({ id }) => removeFileHandle(id).catch(() => undefined)));
        }
      }

      if (newHandleIds.length) {
        const thumbnail = await preparedMangaCoverThumbnail(prepared).catch(() => null);
        if (thumbnail) {
          const coverAssetId = createLocalId("manga-cover");
          try {
            await saveAsset(coverAssetId, thumbnail);
            newAssetIds.push(coverAssetId);
          } catch {
            await removeAsset(coverAssetId).catch(() => undefined);
          }
        }
      }

      if (!newHandleIds.length) {
        for (const asset of prepared.assets) {
          const assetId = createLocalId("manga-page");
          await saveAsset(assetId, asset);
          newAssetIds.push(assetId);
        }
      }

      const resumePage = Math.min(Math.max(1, record.currentPage ?? 1), prepared.pageCount);
      const updated: ContentRecord = {
        ...record,
        fileName: prepared.fileName,
        mimeType: prepared.sourceType === "pdf" ? "application/pdf" : "image/*",
        assetIds: newAssetIds,
        currentPage: resumePage,
        totalPages: prepared.pageCount,
        progress: record.progress > 0 ? resumePage / prepared.pageCount : 0,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...record.metadata,
          sourceType: prepared.sourceType,
          isPdf: prepared.sourceType === "pdf",
          readingDirection: prepared.metadata.readingDirection,
          pagePlacements: JSON.stringify(prepared.metadata.pagePlacements),
          ...linkedMetadata(newHandleIds),
        },
      };
      spreadLoadGeneration.current += 1;
      linkedPermissionHandle.current = null;
      linkedSource.current = null;
      const document = pdfDocument.current;
      if (document) await document.destroy();
      pdfDocument.current = null;
      updateRecordInPlace(updated);
      committed = true;
      const shownSpread = loadedSpreadRef.current;
      loadedSpreadRef.current = null;
      setLoadedSpread(null);
      revokeSpreadUrls(shownSpread);
      setRecord(updated);
      setPage(resumePage);
      setSourceAccess(null);
      setMessage(newHandleIds.length
        ? "Reconnected to the original manga files."
        : "The manga was restored with a browser-stored copy.");
      setSourceRetryToken((value) => value + 1);
      if (newHandleIds.length) void requestPersistentLocalStorage();

      await Promise.all([
        ...previousAssetIds.map((id) => removeAsset(id).catch(() => undefined)),
        ...previousHandleIds.map((id) => removeFileHandle(id).catch(() => undefined)),
      ]);
    } catch (error) {
      if (!committed) {
        await Promise.all([
          ...newAssetIds.map((id) => removeAsset(id).catch(() => undefined)),
          ...newHandleIds.map((id) => removeFileHandle(id).catch(() => undefined)),
        ]);
      }
      setIsSpreadLoading(false);
      setMessage(error instanceof Error ? error.message : "The original manga files could not be reconnected.");
    } finally {
      sourceRecoveryPending.current = false;
    }
  }

  function retryLinkedManga() {
    linkedSource.current = null;
    setSourceAccess(null);
    setMessage("");
    setIsSpreadLoading(true);
    setSourceRetryToken((value) => value + 1);
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
        ? <div className={styles.mangaFullscreenOcrResult}>
          <JapaneseReader
            text={text}
            analysisContext={ocrAnalysisContext}
            ariaLabel={`Recognized manga text from page ${pageNumber}`}
            appearance="compact"
            supplement={<MangaTranslation state={activeTranslation} compact />}
          />
        </div>
        : isOcrBusy(ocrState)
          ? <MangaRecognitionLoader state={ocrState} compact />
          : text,
      tone: ocrState.status === "error" ? "error" as const : "default" as const,
      busy: isOcrBusy(ocrState),
      onDismiss: isOcrBusy(ocrState) ? undefined : () => setOcrState({ status: "idle" }),
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
  const navigationIsDisabled = isSpreadLoading || Boolean(outgoingSpread) || !displayedSpreadIsCurrent;
  const counterSpread = loadedSpread?.spread ?? targetSpread;
  const pageCounter = counterSpread.pages.length > 1
    ? `${counterSpread.pages[0]}–${counterSpread.pages.at(-1)} / ${totalPages}`
    : `${counterSpread.pages[0]} / ${totalPages}`;

  return <ContentPage variant="media">
    <div
      ref={readerRoot}
      className={styles.mangaReader}
      data-fullscreen={isFullscreen ? "true" : "false"}
      aria-busy={isSpreadLoading || Boolean(outgoingSpread)}
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
      {sourceAccess ? <div className={styles.inline}>
        {sourceAccess === "permission" ? <>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={isSpreadLoading}
            onClick={() => void allowLinkedMangaAccess()}
          >Allow file access</button>
          <LocalFilePicker
            className={styles.secondaryButton}
            accept={MANGA_PICKER_ACCEPT}
            description="Original manga files"
            disabled={isSpreadLoading}
            multiple={mangaSource(record) === "images"}
            onFiles={reconnectLinkedManga}
            onPickerError={(error) => setMessage(error.message || "The manga picker could not be opened.")}
          >Locate original {mangaSource(record) === "images" ? "pages" : "file"}</LocalFilePicker>
        </> : sourceAccess === "missing" ? <LocalFilePicker
          className={styles.secondaryButton}
          accept={MANGA_PICKER_ACCEPT}
          description="Original manga files"
          disabled={isSpreadLoading}
          multiple={mangaSource(record) === "images"}
          onFiles={reconnectLinkedManga}
          onPickerError={(error) => setMessage(error.message || "The manga picker could not be opened.")}
        >
          <Upload size={16} aria-hidden="true" />
          Locate original {mangaSource(record) === "images" ? "pages" : "file"}
        </LocalFilePicker> : <button
          className={styles.secondaryButton}
          type="button"
          disabled={isSpreadLoading}
          onClick={retryLinkedManga}
        >Try again</button>}
      </div> : null}
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
                key={outgoingSpread.key}
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
                  <MangaPageSelector
                    src={loadedPage.url}
                    width={loadedPage.width}
                    height={loadedPage.height}
                    alt={`${record.title}, page ${loadedPage.pageNumber}`}
                    disabled
                    onSelectionComplete={() => undefined}
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
                key={loadedSpread.key}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget && outgoingSpread) finishOutgoingSpread(outgoingSpread);
                }}
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
              </div> : <EmptyState title="Preparing pages">Opening the manga from this device…</EmptyState>}
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
          {isOcrBusy(ocrState) ? <MangaRecognitionLoader state={ocrState} /> : ocrState.status === "error" ? <p
            className={styles.error}
            role="status"
            aria-live="polite"
          >{ocrStatusText(ocrState)}</p> : null}
          {!isFullscreen && !isOcrBusy(ocrState) && ocrText.trim() ? <div className={styles.mangaRecognitionResult} key={`${activeOcrPage}:${ocrText}`}>
            <MangaOcrVoiceControl text={ocrText} voice={voice} />
            <JapaneseReader
              text={ocrText}
              analysisContext={ocrAnalysisContext}
              ariaLabel={`Recognized manga text from page ${activeOcrPage}`}
              appearance="compact"
              supplement={<MangaTranslation state={activeTranslation} />}
            />
          </div> : !isFullscreen && !isOcrBusy(ocrState) ? <p className={styles.mangaOcrEmpty}>Drag across Japanese text on a page to recognize it.</p> : null}
        </aside>
      </div>
    </div>
  </ContentPage>;
}
