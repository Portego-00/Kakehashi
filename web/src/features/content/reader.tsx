"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Link2, Trash2 } from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { ContentHeader, ContentPage, EmptyState, Panel, SectionHead } from "./ui";
import { createLocalId, readLocal, writeLocal } from "./storage";
import styles from "./content.module.css";

interface ReaderHistoryItem { id: string; title: string; text: string; source?: string; createdAt: string }

export function ReaderWorkspace() {
  const [mode, setMode] = useState<"paste" | "url">("paste");
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("Untitled reading");
  const [activeText, setActiveText] = useState("");
  const [history, setHistory] = useState<ReaderHistoryItem[]>(() => readLocal("reader-history", []));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const characterCount = useMemo(() => [...draft].length, [draft]);
  const activeCharacterCount = useMemo(() => [...activeText].length, [activeText]);

  function saveReading(nextTitle: string, text: string, source?: string) {
    const item = { id: createLocalId("reading"), title: nextTitle || "Untitled reading", text, source, createdAt: new Date().toISOString() };
    const next = [item, ...history].slice(0, 30);
    setHistory(next);
    writeLocal("reader-history", next);
    setTitle(item.title);
    setActiveText(text);
  }

  function openPaste(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) { setMessage("Paste some Japanese text first."); return; }
    if ([...text].length > 40_000) { setMessage("This reading is over 40,000 characters. Split it into shorter sections, or import it as a book."); return; }
    setMessage("");
    saveReading(title.trim(), text);
  }

  async function openUrl(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/reader/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const payload = await response.json() as { title?: string; text?: string; url?: string; truncated?: boolean; error?: string };
      if (!response.ok || !payload.text) throw new Error(payload.error || "No readable text was found at that address.");
      saveReading(`${payload.title || new URL(url).hostname}${payload.truncated ? " — excerpt" : ""}`, payload.text, payload.url || url);
      setTitle(payload.title || "Imported article");
      setDraft(payload.text);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That page could not be imported.");
    }
  }

  function clearHistory() {
    setHistory([]);
    writeLocal("reader-history", []);
  }

  return (
    <ContentPage variant={activeText ? "media" : "reader"}>
      {activeText ? (
        <div className={styles.readerDesk}>
          <h1 className={styles.visuallyHidden}>{title}</h1>
          <div className={styles.readerDeskToolbar}>
            <button className={styles.secondaryButton} type="button" aria-label="Back to imports" onClick={() => setActiveText("")}><ArrowLeft size={16} aria-hidden="true" />Imports</button>
            <strong title={title}>{title}</strong>
            <span>{activeCharacterCount.toLocaleString()} {activeCharacterCount === 1 ? "character" : "characters"}</span>
          </div>
          <JapaneseReader text={activeText} />
        </div>
      ) : (
        <>
          <ContentHeader title="Reading desk" description="Paste Japanese or bring in a public article, then select words for WaniKani-aware lookup and browser pronunciation." />
          <div className={styles.split}>
            <Panel>
              <div className={styles.tabs} role="tablist" aria-label="Reading import type">
                <button className={`${styles.tab} ${mode === "paste" ? styles.tabActive : ""}`} role="tab" aria-selected={mode === "paste"} type="button" onClick={() => setMode("paste")}>Paste text</button>
                <button className={`${styles.tab} ${mode === "url" ? styles.tabActive : ""}`} role="tab" aria-selected={mode === "url"} type="button" onClick={() => setMode("url")}>Import URL</button>
              </div>
              {mode === "paste" ? (
                <form className={styles.workspace} onSubmit={openPaste}>
                  <div className={styles.field}><label htmlFor="reading-title">Title</label><input id="reading-title" className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                  <div className={styles.field}><label htmlFor="reading-text">Japanese text</label><textarea id="reading-text" className={styles.textarea} lang="ja" maxLength={40_000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ここに日本語の文章を貼り付けてください。" /><span className={styles.hint}>{characterCount.toLocaleString()} / 40,000 characters · kept only in this browser</span></div>
                  {message ? <p className={styles.error} role="alert">{message}</p> : null}
                  <button className={styles.button} type="submit">Open reader</button>
                </form>
              ) : (
                <form className={styles.workspace} onSubmit={(event) => void openUrl(event)}>
                  <div className={styles.field}><label htmlFor="article-url">Public article URL</label><div className={styles.inline}><Link2 aria-hidden="true" size={18} /><input id="article-url" className={styles.input} type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.jp/article" /></div><span className={styles.hint}>Static HTML pages work best. Private-network and non-HTTP addresses are blocked.</span></div>
                  {message ? <p className={styles.error} role="alert">{message}</p> : null}
                  <button className={styles.button} type="submit" disabled={status === "loading"}>{status === "loading" ? "Importing…" : "Import article"}</button>
                </form>
              )}
            </Panel>
            <Panel>
              <SectionHead title="Recent readings" detail={history.length ? <button className={styles.iconButton} type="button" onClick={clearHistory} aria-label="Clear reading history"><Trash2 size={16} aria-hidden="true" /></button> : undefined} />
              {history.length ? <div className={styles.workspace}>{history.map((item) => <button key={item.id} type="button" className={styles.libraryItem} onClick={() => { setActiveText(item.text); setTitle(item.title); }}><strong>{item.title}</strong><span className={styles.meta}><Clock3 size={14} aria-hidden="true" /> {new Date(item.createdAt).toLocaleString()}</span></button>)}</div> : <EmptyState title="Nothing saved yet">Your last 30 pasted and imported readings appear here on this device.</EmptyState>}
            </Panel>
          </div>
        </>
      )}
    </ContentPage>
  );
}
