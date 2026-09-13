"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Layers3, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { connectToAnki, exportSentenceToAnki, getAnkiApiKey, guessAnkiFields, loadAnkiExportConfig, loadAnkiFields, saveAnkiExportConfig, type AnkiExportConfig, type AnkiSentence } from "./client";
import styles from "./anki-export.module.css";
import { setAnkiExportEnabled, useAnkiExportEnabled } from "./settings";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not export to Anki. Please try again.";
}

export function AnkiExportButton(props: AnkiSentence) {
  const enabled = useAnkiExportEnabled();
  if (!enabled || !props.japanese.trim() || !props.english.trim()) return null;
  return <SentenceExport key={JSON.stringify([props.japanese, props.english])} {...props} />;
}

function SentenceExport(sentence: AnkiSentence) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function add() {
    if (inFlight.current || added) return;
    const config = loadAnkiExportConfig();
    setError("");
    if (!config) { setOpen(true); return; }
    inFlight.current = true;
    setBusy(true);
    try { await exportSentenceToAnki(config, sentence); setAdded(true); }
    catch (cause) { setError(errorMessage(cause)); setOpen(true); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <div className={styles.exportAction} onKeyDown={(event) => event.stopPropagation()}>
    <Button type="button" size="small" tone="ghost" state={busy ? "loading" : added ? "success" : "idle"}
      disabled={added} aria-label={added ? "Sentence added to Anki" : "Add sentence to Anki"}
      onClick={(event) => { event.stopPropagation(); void add(); }}>
      {!busy && !added ? <Layers3 size={15} aria-hidden /> : null}{added ? "Added" : "Anki"}
    </Button>
    {added ? <span className={styles.srOnly} role="status">Sentence added to Anki.</span> : null}
    {open ? <AnkiExportDialog sentence={sentence} initialError={error} onClose={() => setOpen(false)} onSaved={() => setAdded(true)} /> : null}
  </div>;
}

export function AnkiExportSettingsButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const enabled = useAnkiExportEnabled();
  return <div className={styles.settings}>
    <label className={styles.toggle}><span><strong>Enable Anki export</strong><span className={styles.hint}>Show export buttons beside context sentences in this browser.</span></span>
      <input type="checkbox" checked={enabled} onChange={(event) => {
        try { setAnkiExportEnabled(event.target.checked); setError(""); }
        catch { setError("This browser could not save the Anki export setting."); }
      }} />
    </label>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {enabled ? <Button type="button" size="small" onClick={() => setOpen(true)}><Layers3 size={16} aria-hidden />Configure Anki export</Button> : null}
    {open && enabled ? <AnkiExportDialog onClose={() => setOpen(false)} onSaved={() => {}} /> : null}
  </div>;
}

function AnkiExportDialog({ sentence, initialError = "", onClose, onSaved }: { sentence?: AnkiSentence; initialError?: string; onClose: () => void; onSaved: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [stored] = useState(loadAnkiExportConfig);
  const [apiKey, setApiKey] = useState(getAnkiApiKey);
  const [collection, setCollection] = useState<{ decks: string[]; models: string[] } | null>(null);
  const [deckName, setDeckName] = useState(stored?.deckName ?? "");
  const [modelName, setModelName] = useState(stored?.modelName ?? "");
  const [fields, setFields] = useState<string[]>([]);
  const [japaneseField, setJapaneseField] = useState(stored?.japaneseField ?? "");
  const [englishField, setEnglishField] = useState(stored?.englishField ?? "");
  const [tags, setTags] = useState(stored?.tags.join(" ") ?? "kakehashi context-sentence");
  const [connecting, setConnecting] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError);
  const fieldRequest = useRef(0);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  async function selectModel(name: string) {
    const request = ++fieldRequest.current;
    setModelName(name); setFields([]); setLoadingFields(true); setError("");
    try {
      const loaded = await loadAnkiFields(name);
      if (!mounted.current || request !== fieldRequest.current) return;
      setFields(loaded);
      const mapping = stored?.modelName === name && loaded.includes(stored.japaneseField) && loaded.includes(stored.englishField)
        ? stored : guessAnkiFields(loaded);
      setJapaneseField(mapping.japaneseField); setEnglishField(mapping.englishField);
    } catch (cause) { if (mounted.current && request === fieldRequest.current) setError(errorMessage(cause)); }
    finally { if (mounted.current && request === fieldRequest.current) setLoadingFields(false); }
  }

  async function connect() {
    if (connecting) return;
    setConnecting(true); setError(""); setCollection(null); setFields([]);
    try {
      const result = await connectToAnki(apiKey);
      if (!mounted.current) return;
      setCollection(result);
      setDeckName(result.decks.includes(deckName) ? deckName : result.decks[0] ?? "");
      const model = result.models.includes(modelName) ? modelName : result.models[0];
      if (model) await selectModel(model);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setConnecting(false); }
  }

  const canSave = !!collection?.decks.includes(deckName) && !!collection.models.includes(modelName)
    && fields.includes(japaneseField) && fields.includes(englishField) && japaneseField !== englishField
    && !connecting && !loadingFields && !saving;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave || submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    const config: AnkiExportConfig = { deckName, modelName, japaneseField, englishField, tags: [...new Set(tags.split(/[\s,]+/).filter(Boolean))] };
    try {
      saveAnkiExportConfig(config);
      if (sentence) await exportSentenceToAnki(config, sentence);
      onSaved(); onClose();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!saving) onClose(); }}
    onClose={onClose} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <header className={styles.header}><h2 id={titleId}>{sentence ? "Add sentence to Anki" : "Anki export"}</h2>
      <button type="button" className={styles.close} aria-label="Close Anki export" disabled={saving} onClick={onClose}><X size={18} aria-hidden /></button>
    </header>
    <form className={styles.body} onSubmit={(event) => void save(event)}>
      {sentence ? <div className={styles.preview}><p lang="ja">{sentence.japanese}</p><p>{sentence.english}</p></div> : null}
      <p className={styles.hint}>Open Anki on this computer with <a href="https://ankiweb.net/shared/info/2055492159" target="_blank" rel="noreferrer">AnkiConnect installed</a>. Connect below, then allow Kakehashi in Anki and allow local network access if your browser asks.</p>
      <label className={styles.field}>AnkiConnect API key (optional)<input type="password" value={apiKey} autoComplete="off" disabled={connecting || saving} onChange={(event) => { setApiKey(event.target.value); setCollection(null); setFields([]); }} /></label>
      <p className={styles.hint}>Only needed if you set an API key in AnkiConnect. It is kept for this page session.</p>
      <Button type="button" state={connecting ? "loading" : "idle"} disabled={saving} onClick={() => void connect()}>{connecting ? "Waiting for Anki…" : collection ? "Reconnect to Anki" : "Connect to Anki"}</Button>
      {collection ? <>
        {!collection.decks.length || !collection.models.length ? <p role="alert">Create a deck and note type in Anki, then reconnect.</p> : null}
        <label className={styles.field}>Deck<select value={deckName} disabled={saving} onChange={(event) => setDeckName(event.target.value)}>{collection.decks.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className={styles.field}>Note type<select value={modelName} disabled={saving} onChange={(event) => void selectModel(event.target.value)}>{collection.models.map((name) => <option key={name}>{name}</option>)}</select></label>
        {loadingFields ? <p role="status">Loading fields…</p> : <>
          <label className={styles.field}>Japanese sentence field<select value={japaneseField} disabled={saving} onChange={(event) => setJapaneseField(event.target.value)}>{fields.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className={styles.field}>English translation field<select value={englishField} disabled={saving} onChange={(event) => setEnglishField(event.target.value)}>{fields.map((name) => <option key={name}>{name}</option>)}</select></label>
          {fields.length < 2 ? <p role="alert">Choose a note type with at least two fields.</p> : japaneseField === englishField ? <p role="alert">Choose two different fields.</p> : null}
        </>}
        <label className={styles.field}>Tags<input value={tags} disabled={saving} onChange={(event) => setTags(event.target.value)} /></label>
        <p className={styles.hint}>Separate tags with spaces or commas. Other note fields are left empty.</p>
      </> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}><Button type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" tone="primary" disabled={!canSave} state={saving ? "loading" : "idle"}>{sentence ? "Save and add sentence" : "Save settings"}</Button></div>
    </form>
  </dialog>;
}
