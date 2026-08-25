"use client";

import Link from "next/link";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, FilePlus2, Trash2 } from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { extractEpub, extractReadableTextFromHtml } from "./parsers";
import { ContentHeader, ContentPage, EmptyState, Panel, Progress, SectionHead, UndoNotice } from "./ui";
import { createLocalId, deleteRecord, loadAsset, loadLibrary, readLocal, saveAsset, upsertRecord, writeLocal } from "./storage";
import type { ContentRecord } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import styles from "./content.module.css";

const PAGE_SIZE = 1600;

async function importBook(file: File): Promise<ContentRecord> {
  const isEpub = file.name.toLowerCase().endsWith(".epub") || file.type === "application/epub+zip";
  const rawAssetId = createLocalId("epub-source");
  const textAssetId = createLocalId("epub-text");
  let title = file.name.replace(/\.(epub|html?|txt)$/i, "");
  let text = "";
  if (isEpub) {
    const extracted = await extractEpub(file);
    title = extracted.title;
    text = extracted.text;
  } else {
    const raw = await file.text();
    text = /html/i.test(file.type) || /\.html?$/i.test(file.name) ? extractReadableTextFromHtml(raw) : raw.trim();
  }
  if (!text) throw new Error("No readable text was found in that file.");
  await Promise.all([saveAsset(rawAssetId, file), saveAsset(textAssetId, new Blob([text], { type: "text/plain;charset=utf-8" }))]);
  const now = new Date().toISOString();
  return {
    id: createLocalId("book"), kind: "epub", title, fileName: file.name, mimeType: file.type || (isEpub ? "application/epub+zip" : "text/plain"), assetIds: [rawAssetId, textAssetId], createdAt: now, updatedAt: now, progress: 0, currentPage: 1, totalPages: Math.max(1, Math.ceil([...text].length / PAGE_SIZE)), metadata: { textAssetId },
  };
}

export function EpubLibrary() {
  const { user } = useSession();
  const firstLibraryReveal = useFirstContentReveal();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const [books, setBooks] = useState<ContentRecord[]>(() => loadLibrary("epub"));
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => { setBooks(loadLibrary("epub")); setMessage("The book could not be removed from browser storage, so it was restored."); },
  });
  const today = new Date().toISOString().slice(0, 10);
  const readingSeconds = readLocal<number>(`reading-seconds:${today}`, 0);
  const dailyGoalMinutes = settings.study.epubDailyGoalMinutes;
  const dailyGoalSeconds = dailyGoalMinutes * 60;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const record = await importBook(file);
      setBooks(upsertRecord(record));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That book could not be imported.");
    } finally { setBusy(false); }
  }, []);

  function remove(book: ContentRecord) {
    setBooks((current) => current.filter((item) => item.id !== book.id));
    deletion.requestDeletion(book);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <ContentPage variant="library">
      <ContentHeader title="Book library" description="Import EPUB, HTML, or plain-text Japanese books. Files and progress stay in this browser’s IndexedDB." />
      <div className={styles.split}>
        <div className={styles.workspace}>
          <label className={styles.dropzone} data-dragging={dragging} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <FilePlus2 aria-hidden="true" size={28} /><strong>{busy ? "Importing and preparing chapters…" : "Drop a book here or choose a file"}</strong><span className={styles.hint}>EPUB · HTML · TXT</span><input className={styles.fileInput} type="file" accept=".epub,.html,.htm,.txt,application/epub+zip,text/html,text/plain" disabled={busy} onChange={(event) => void handleFiles(event.target.files ?? [])} />
          </label>
          {message ? <div className={styles.notice} role="alert">{message}</div> : null}
        </div>
        <Panel><SectionHead title="Today’s reading" detail={`${Math.floor(readingSeconds / 60)} min`} /><Progress label={`${dailyGoalMinutes} minute daily goal`} value={readingSeconds / dailyGoalSeconds} /><p className={styles.hint}>Active reading time is counted locally while a book is open.</p></Panel>
      </div>
      <section><SectionHead title="Your books" detail={`${books.length} local ${books.length === 1 ? "book" : "books"}`} />
        {books.length ? <div className={styles.libraryGrid} {...firstLibraryReveal}>{books.map((book) => <article className={styles.libraryItem} key={book.id}><BookOpen aria-hidden="true" size={24} /><h2>{book.title}</h2><p>{book.fileName}</p><Progress label={book.progress > 0 ? `Page ${book.currentPage} of ${book.totalPages}` : "Not started"} value={book.progress} /><div className={styles.libraryActions}><Link className={styles.button} href={`/epubs/${book.id}`}>{book.progress > 0 ? "Continue" : "Read"}</Link><button className={styles.iconButton} type="button" onClick={() => void remove(book)} aria-label={`Remove ${book.title}`}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div> : <EmptyState title="Your shelf is empty">Choose an EPUB, HTML, or text file. Compressed EPUB reading requires a browser with the standard DecompressionStream API.</EmptyState>}
      </section>
      {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => { deletion.undoDeletion(); setBooks(loadLibrary("epub")); }} /> : null}
    </ContentPage>
  );
}

export function EpubReader({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<ContentRecord | null>(() => loadLibrary("epub").find((item) => item.id === bookId) ?? null);
  const [text, setText] = useState("");
  const [page, setPage] = useState(() => loadLibrary("epub").find((item) => item.id === bookId)?.currentPage ?? 1);
  const [message, setMessage] = useState(() => loadLibrary("epub").some((item) => item.id === bookId) ? "" : "This book is not in the local library.");

  useEffect(() => {
    const record = loadLibrary("epub").find((item) => item.id === bookId) ?? null;
    const textAssetId = typeof record?.metadata?.textAssetId === "string" ? record.metadata.textAssetId : record?.assetIds[1];
    if (!record || !textAssetId) return;
    void loadAsset(textAssetId).then(async (asset) => {
      if (!asset) throw new Error("The stored book text is missing.");
      setText(await asset.text());
    }).catch((error) => setMessage(error instanceof Error ? error.message : "The book could not be opened."));
  }, [bookId]);

  useEffect(() => {
    if (!book || !text) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const key = `reading-seconds:${new Date().toISOString().slice(0, 10)}`;
      writeLocal(key, readLocal<number>(key, 0) + 30);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [book, text]);

  const characters = useMemo(() => [...text], [text]);
  const totalPages = Math.max(1, Math.ceil(characters.length / PAGE_SIZE));
  const pageText = characters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).join("");

  function changePage(nextPage: number) {
    if (!book) return;
    const currentPage = Math.max(1, Math.min(totalPages, nextPage));
    setPage(currentPage);
    const updated = { ...book, currentPage, totalPages, progress: currentPage / totalPages, updatedAt: new Date().toISOString() };
    setBook(updated);
    upsertRecord(updated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!book || !text) return <ContentPage variant="reader"><ContentHeader title="Book reader" description="Opening your local book…" /><EmptyState title={message || "Preparing book"}>{message ? "Return to the library and import it again if the browser’s site data was cleared." : "Large EPUB files can take a moment to prepare."}</EmptyState></ContentPage>;
  return <ContentPage variant="reader"><ContentHeader title={book.title} description={`Page ${page} of ${totalPages}`} actions={<Link className={styles.secondaryButton} href="/epubs">Library</Link>} /><Progress label="Book progress" value={page / totalPages} /><JapaneseReader text={pageText} ariaLabel={`${book.title}, page ${page}`} /><nav className={styles.toolbar} aria-label="Book pages"><button className={styles.secondaryButton} type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous page</button><span className={styles.meta}>Page {page} / {totalPages}</span><button className={styles.button} type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next page</button></nav></ContentPage>;
}
