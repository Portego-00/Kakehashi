"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, ExternalLink, Mic, Square, Volume2 } from "lucide-react";
import { ContentHeader, ContentPage, EmptyState, Panel, SectionHead } from "./ui";
import { createLocalId, readLocal, writeLocal } from "./storage";
import { PUBLIC_TRANSLATION_MAX_CHARACTERS } from "./translation";
import styles from "./content.module.css";

interface TranslationHistory { id: string; source: string; translation: string; target: string; createdAt: string }
interface TranslationAvailability { available: boolean; configured: boolean; mode: "configured" | "public"; provider: string; maxCharacters: number }
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function TranslatorWorkspace() {
  const [source, setSource] = useState("");
  const [translation, setTranslation] = useState("");
  const [target, setTarget] = useState("en");
  const [history, setHistory] = useState<TranslationHistory[]>(() => readLocal("translation-history", []));
  const [status, setStatus] = useState<"idle" | "loading" | "listening" | "error">("idle");
  const [message, setMessage] = useState("");
  const [recognizer, setRecognizer] = useState<SpeechRecognitionLike | null>(null);
  const [availability, setAvailability] = useState<TranslationAvailability | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/translator/translate", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Translation availability could not be checked.");
      setAvailability(await response.json() as TranslationAvailability);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setAvailability({ available: false, configured: false, mode: "public", provider: "Unavailable", maxCharacters: PUBLIC_TRANSLATION_MAX_CHARACTERS });
      setMessage(error instanceof Error ? error.message : "Translation availability could not be checked.");
    });
    return () => controller.abort();
  }, []);

  async function translate(event: FormEvent) {
    event.preventDefault();
    if (!source.trim()) return;
    setStatus("loading"); setMessage("");
    try {
      const response = await fetch("/translator/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: source, target }) });
      const payload = await response.json() as { translation?: string; error?: string; configured?: boolean };
      if (!response.ok || !payload.translation) throw new Error(payload.error || "Translation failed.");
      setTranslation(payload.translation);
      const item = { id: createLocalId("translation"), source: source.trim(), translation: payload.translation, target, createdAt: new Date().toISOString() };
      const next = [item, ...history].slice(0, 30);
      setHistory(next); writeLocal("translation-history", next); setStatus("idle");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Translation failed."); }
  }

  function speak(text: string, lang: string) {
    if (!text || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = lang; speechSynthesis.speak(utterance);
  }

  function startListening() {
    const browser = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setMessage("Speech recognition is not available in this browser. Chrome and Edge usually provide it."); return; }
    const instance = new Constructor();
    instance.lang = "ja-JP"; instance.interimResults = true; instance.continuous = true;
    instance.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript || "").join("");
      setSource(text);
    };
    instance.onerror = () => { setMessage("Speech recognition stopped after a browser or microphone error."); setStatus("error"); };
    instance.onend = () => setStatus((current) => current === "listening" ? "idle" : current);
    instance.start(); setRecognizer(instance); setStatus("listening"); setMessage("");
  }

  function stopListening() { recognizer?.stop(); setRecognizer(null); setStatus("idle"); }

  const maxCharacters = availability?.maxCharacters ?? PUBLIC_TRANSLATION_MAX_CHARACTERS;

  return <ContentPage variant="tool">
    <ContentHeader title="Translator" description="Capture Japanese with browser speech recognition, translate short passages, and listen with system voices." />
    <div className={styles.notice} role="status">{!availability ? "Checking translation availability…" : availability.available && availability.mode === "configured" ? "The site translation backend is ready. Speech recognition and text-to-speech may use your browser vendor’s online speech service." : availability.available ? <>The built-in MyMemory fallback is ready for short passages. Submitted text is sent to <a href="https://mymemory.translated.net/doc/spec.php" target="_blank" rel="noreferrer">MyMemory</a>; speech features may also use your browser vendor’s online service.</> : "Translation is currently unavailable. Dictionary and Google Translate links remain available below."}</div>
    <form className={styles.split} onSubmit={(event) => void translate(event)}>
      <Panel><SectionHead title="Japanese" detail={`${[...source].length} / ${maxCharacters} characters`} /><div className={styles.field}><label className="sr-only" htmlFor="translation-source">Japanese text</label><textarea id="translation-source" className={styles.textarea} lang="ja" maxLength={maxCharacters} value={source} onChange={(event) => setSource(event.target.value)} placeholder="日本語を入力するか、マイクを使ってください。" /></div><div className={styles.toolbar}>{status === "listening" ? <button className={styles.dangerButton} type="button" onClick={stopListening}><Square size={15} aria-hidden="true" />Stop listening</button> : <button className={styles.secondaryButton} type="button" onClick={startListening}><Mic size={16} aria-hidden="true" />Speak Japanese</button>}<button className={styles.iconButton} type="button" onClick={() => speak(source, "ja-JP")} aria-label="Read Japanese aloud"><Volume2 size={17} aria-hidden="true" /></button></div></Panel>
      <Panel><SectionHead title="Translation" detail={<select className={styles.select} aria-label="Translation language" value={target} onChange={(event) => setTarget(event.target.value)}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ko">Korean</option><option value="zh">Chinese</option></select>} />{translation ? <p className={styles.readingSurface}>{translation}</p> : <EmptyState title="No translation yet">Enter Japanese and choose Translate. The provider in use is shown above before any text is sent.</EmptyState>}<div className={styles.toolbar}><button className={styles.button} type="submit" disabled={status === "loading" || !source.trim() || !availability?.available}>{status === "loading" ? "Translating…" : !availability ? "Checking…" : "Translate"}</button><button className={styles.iconButton} type="button" disabled={!translation} onClick={() => void navigator.clipboard.writeText(translation)} aria-label="Copy translation"><Copy size={17} aria-hidden="true" /></button><button className={styles.iconButton} type="button" disabled={!translation} onClick={() => speak(translation, target)} aria-label="Read translation aloud"><Volume2 size={17} aria-hidden="true" /></button></div></Panel>
    </form>
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    <div className={styles.toolbar}><a className={styles.secondaryButton} href={`https://jisho.org/search/${encodeURIComponent(source)}`} target="_blank" rel="noreferrer">Jisho <ExternalLink size={15} aria-hidden="true" /></a><a className={styles.secondaryButton} href={`https://translate.google.com/?sl=ja&tl=${target}&text=${encodeURIComponent(source)}&op=translate`} target="_blank" rel="noreferrer">Open Google Translate <ExternalLink size={15} aria-hidden="true" /></a></div>
    {history.length ? <section><SectionHead title="Local history" detail={`${history.length} entries`} /><div className={styles.postList}>{history.map((item) => <button className={styles.post} type="button" key={item.id} onClick={() => { setSource(item.source); setTranslation(item.translation); setTarget(item.target); }}><div><h2 lang="ja">{item.source}</h2><p>{item.translation}</p></div><time className={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</time></button>)}</div></section> : null}
  </ContentPage>;
}
