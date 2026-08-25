"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, useEffect, useState } from "react";
import { FileImage, FileText, Images, Trash2, Upload } from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { ContentHeader, ContentPage, EmptyState, Panel, Progress, SectionHead, UndoNotice } from "./ui";
import { createLocalId, deleteRecord, loadAsset, loadLibrary, saveAsset, upsertRecord } from "./storage";
import type { ContentRecord } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

export function MangaLibrary() {
  const firstLibraryReveal = useFirstContentReveal();
  const [manga, setManga] = useState<ContentRecord[]>(() => loadLibrary("manga"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => { setManga(loadLibrary("manga")); setMessage("The manga could not be removed from browser storage, so it was restored."); },
  });

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).toSorted((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
    if (!files.length) return;
    setBusy(true); setMessage("");
    try {
      const pdfFiles = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
      if (pdfFiles.length && files.length > 1) throw new Error("Import one PDF at a time, or select a set of image pages.");
      if (!pdfFiles.length && files.some((file) => !file.type.startsWith("image/"))) throw new Error("Manga imports support a single PDF or image files.");
      const assetIds: string[] = [];
      for (const file of files) {
        const assetId = createLocalId("manga-page");
        await saveAsset(assetId, file);
        assetIds.push(assetId);
      }
      const first = files[0];
      const isPdf = pdfFiles.length === 1;
      const now = new Date().toISOString();
      const record: ContentRecord = { id: createLocalId("manga"), kind: "manga", title: first.name.replace(/(?:[-_ ]?\d+)?\.[^.]+$/, "") || "Manga", fileName: isPdf ? first.name : `${files.length} image pages`, mimeType: isPdf ? "application/pdf" : "image/*", assetIds, createdAt: now, updatedAt: now, progress: 0, currentPage: 1, totalPages: isPdf ? undefined : files.length, metadata: { isPdf } };
      setManga(upsertRecord(record));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Those pages could not be imported."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  function remove(item: ContentRecord) {
    setManga((current) => current.filter((candidate) => candidate.id !== item.id));
    deletion.requestDeletion(item);
  }

  return <ContentPage variant="library">
    <ContentHeader title="Manga library" description="Keep local manga as a PDF or ordered image set. Kakehashi does not upload pages and intentionally does not include camera OCR." actions={<label className={styles.button}><Upload size={16} aria-hidden="true" />{busy ? "Importing…" : "Import manga"}<input className={styles.fileInput} type="file" accept=".pdf,application/pdf,image/*" multiple disabled={busy} onChange={(event) => void importFiles(event)} /></label>} />
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    <div className={styles.notice}>For image pages, select the full set together; filenames are sorted naturally. Text lookup is user-driven: type or paste a word from the page while reading.</div>
    {manga.length ? <div className={styles.libraryGrid} {...firstLibraryReveal}>{manga.map((item) => <article className={styles.libraryItem} key={item.id}>{item.metadata?.isPdf ? <FileText size={26} aria-hidden="true" /> : <Images size={26} aria-hidden="true" />}<h2>{item.title}</h2><p>{item.fileName}</p><Progress label={item.progress > 0 ? `Page ${item.currentPage}${item.totalPages ? ` of ${item.totalPages}` : ""}` : "Not started"} value={item.progress} /><div className={styles.libraryActions}><Link className={styles.button} href={`/manga/${item.id}`}>{item.progress > 0 ? "Continue" : "Read"}</Link><button className={styles.iconButton} type="button" onClick={() => remove(item)} aria-label={`Remove ${item.title}`}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div> : <EmptyState title="No manga yet">Import one PDF or a selection of image pages. All files remain in this browser.</EmptyState>}
    {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => { deletion.undoDeletion(); setManga(loadLibrary("manga")); }} /> : null}
  </ContentPage>;
}

export function MangaReader({ mangaId }: { mangaId: string }) {
  const [record, setRecord] = useState<ContentRecord | null>(() => loadLibrary("manga").find((candidate) => candidate.id === mangaId) ?? null);
  const [urls, setUrls] = useState<string[]>([]);
  const [page, setPage] = useState(() => loadLibrary("manga").find((candidate) => candidate.id === mangaId)?.currentPage ?? 1);
  const [lookupText, setLookupText] = useState("");
  const [message, setMessage] = useState(() => loadLibrary("manga").some((candidate) => candidate.id === mangaId) ? "" : "This manga is not in the local library.");

  useEffect(() => {
    const item = loadLibrary("manga").find((candidate) => candidate.id === mangaId) ?? null;
    if (!item) return;
    let objectUrls: string[] = [];
    void Promise.all(item.assetIds.map((id) => loadAsset(id))).then((assets) => {
      if (assets.some((asset) => !asset)) throw new Error("One or more local pages are missing.");
      objectUrls = assets.map((asset) => URL.createObjectURL(asset!));
      setUrls(objectUrls);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "The manga could not be opened."));
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [mangaId]);

  function changePage(nextPage: number) {
    if (!record || record.metadata?.isPdf) return;
    const currentPage = Math.max(1, Math.min(urls.length, nextPage));
    const updated = { ...record, currentPage, totalPages: urls.length, progress: currentPage / urls.length, updatedAt: new Date().toISOString() };
    setPage(currentPage); setRecord(updated); upsertRecord(updated);
  }

  if (!record || !urls.length) return <ContentPage variant="media"><ContentHeader title="Manga reader" description="Opening local pages…" /><EmptyState title={message || "Preparing pages"}>If site data was cleared, return to the manga library and import the file again.</EmptyState></ContentPage>;
  const isPdf = Boolean(record.metadata?.isPdf);
  return <ContentPage variant="media">
    <ContentHeader title={record.title} description={isPdf ? "Local PDF reader" : `Page ${page} of ${urls.length}`} actions={<Link className={styles.secondaryButton} href="/manga">Library</Link>} />
    <div className={styles.mediaGrid}>
      <Panel>{isPdf ? <object className={styles.pdfFrame} data={urls[0]} type="application/pdf" aria-label={record.title}><a className={styles.button} href={urls[0]} target="_blank" rel="noreferrer">Open PDF in browser</a></object> : <><Image className={styles.mangaImage} src={urls[page - 1]} width={1200} height={1800} unoptimized alt={`${record.title}, page ${page}`} /><nav className={styles.toolbar} aria-label="Manga pages"><button className={styles.secondaryButton} type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><span className={styles.meta}>{page} / {urls.length}</span><button className={styles.button} type="button" disabled={page >= urls.length} onClick={() => changePage(page + 1)}>Next</button></nav></>}</Panel>
      <Panel className={styles.sticky}><SectionHead title="Manual text lookup" detail="No OCR" /><div className={styles.field}><label htmlFor="manga-text">Type or paste text from the page</label><textarea id="manga-text" className={styles.textarea} lang="ja" value={lookupText} onChange={(event) => setLookupText(event.target.value)} placeholder="気になる言葉を入力" /></div><p className={styles.hint}><FileImage size={15} aria-hidden="true" /> Camera and automatic image OCR are deliberately excluded from the web app.</p></Panel>
    </div>
    {lookupText.trim() ? <JapaneseReader text={lookupText} ariaLabel="Manga text lookup" /> : null}
  </ContentPage>;
}
