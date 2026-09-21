"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { personalWordSchema, type PersonalEntry, type PersonalOperation, type PersonalWordInput } from "./personal-vocabulary";
import styles from "./personal-library.module.css";

const EMPTY_WORD: PersonalWordInput = { characters: "", reading: "", meanings: [], partsOfSpeech: [], meaningMnemonic: "", readingMnemonic: "", contextSentences: [] };
export function PersonalWordEditor({ entry, deckId, revision, onSave, onCancel }: {
  entry?: Extract<PersonalEntry, { kind: "word" }>; deckId: string; revision: number;
  onSave: (operations: PersonalOperation[], revision: number, eventId: string) => Promise<unknown>; onCancel: () => void;
}) {
  const initial = entry?.data.word ?? EMPTY_WORD;
  const [word, setWord] = useState(initial);
  const [meanings, setMeanings] = useState(initial.meanings.join(" | "));
  const [parts, setParts] = useState(initial.partsOfSpeech.join(" | "));
  const [expectedRevision] = useState(revision);
  const [id] = useState(() => entry?.id ?? `personal:${crypto.randomUUID()}`);
  const [eventId, setEventId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = () => { setEventId(crypto.randomUUID()); setError(""); };
  const update = (patch: Partial<PersonalWordInput>) => { setWord({ ...word, ...patch }); changed(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const reading = word.reading.trim() || (/\p{Script=Han}/u.test(word.characters) ? "" : word.characters);
    const parsed = personalWordSchema.safeParse({ ...word, reading, meanings: meanings.split("|").map((value) => value.trim()).filter(Boolean), partsOfSpeech: parts.split("|").map((value) => value.trim()).filter(Boolean), contextSentences: word.contextSentences.filter((sentence) => sentence.ja.trim() || sentence.en.trim()) });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")); return; }
    setSaving(true); setError("");
    try { await onSave([entry ? { action: "edit_word", id, word: parsed.data } : { action: "create_word", id, deckId, word: parsed.data }], expectedRevision, eventId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your word could not be saved."); }
    finally { setSaving(false); }
  }
  return <form className={styles.editor} onSubmit={submit}>
    <h2>{entry ? "Edit word" : "Add a word"}</h2>
    <p>{entry ? "Editing preserves this word’s stage, next review, and history." : "Your word will be ready for lessons after you save it."}</p>
    <fieldset disabled={saving} className={styles.fields}>
      <div className={styles.twoColumns}>
        <label>Japanese spelling<input required maxLength={120} value={word.characters} onChange={(event) => update({ characters: event.target.value })} lang="ja" autoFocus /></label>
        <label>Reading<input maxLength={160} value={word.reading} onChange={(event) => update({ reading: event.target.value })} lang="ja" /><span>Required for kanji words. Kana-only words can use their spelling.</span></label>
      </div>
      <label>Accepted meanings<input required value={meanings} maxLength={4020} onChange={(event) => { setMeanings(event.target.value); changed(); }} /><span>Separate accepted answers with |, for example: book | volume.</span></label>
      <label>Parts of speech<input value={parts} maxLength={810} onChange={(event) => { setParts(event.target.value); changed(); }} placeholder="noun | expression" /></label>
      <label>Meaning notes or mnemonic<textarea rows={3} maxLength={3000} value={word.meaningMnemonic} onChange={(event) => update({ meaningMnemonic: event.target.value })} /></label>
      <label>Reading notes or mnemonic<textarea rows={2} maxLength={3000} value={word.readingMnemonic ?? ""} onChange={(event) => update({ readingMnemonic: event.target.value })} /></label>
      <h3>Example sentences <span className={styles.muted}>(optional)</span></h3>
      {word.contextSentences.map((sentence, index) => <div key={index} className={styles.sentence}>
        <label>Japanese sentence {index + 1}<textarea rows={2} maxLength={1000} value={sentence.ja} lang="ja" onChange={(event) => update({ contextSentences: word.contextSentences.map((value, i) => i === index ? { ...value, ja: event.target.value } : value) })} /></label>
        <label>English sentence {index + 1}<textarea rows={2} maxLength={1000} value={sentence.en} onChange={(event) => update({ contextSentences: word.contextSentences.map((value, i) => i === index ? { ...value, en: event.target.value } : value) })} /></label>
        <Button type="button" size="small" onClick={() => update({ contextSentences: word.contextSentences.filter((_, i) => i !== index) })}>Remove sentence {index + 1}</Button>
      </div>)}
      {word.contextSentences.length < 5 ? <Button type="button" onClick={() => update({ contextSentences: [...word.contextSentences, { ja: "", en: "" }] })}>Add example sentence</Button> : null}
    </fieldset>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {revision !== expectedRevision ? <p role="alert">Your library changed while this editor was open. Cancel and reopen the word to load the latest version.</p> : null}
    <div className={styles.actions}><Button type="submit" tone="primary" state={saving ? "loading" : "idle"} disabled={revision !== expectedRevision}>Save word</Button><Button type="button" disabled={saving} onClick={onCancel}>Cancel</Button></div>
  </form>;
}
