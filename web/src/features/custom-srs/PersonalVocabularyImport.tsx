"use client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IMPORT_BYTE_LIMIT, IMPORT_WORD_LIMIT, type PersonalOperation, type PersonalWordInput } from "./personal-vocabulary";
import { IMPORT_FIELDS, parseVocabularyTable, previewVocabularyImport, suggestImportColumns, type ImportColumns, type ImportField } from "./vocabulary-import";
import styles from "./personal-library.module.css";

const LABELS: Record<ImportField, string> = { characters: "Japanese spelling", reading: "Reading", meanings: "Accepted meanings", meaningMnemonic: "Meaning notes", readingMnemonic: "Reading notes", partsOfSpeech: "Parts of speech", sentenceJa: "Japanese sentence", sentenceEn: "English sentence" };
export function PersonalVocabularyImport({ deckId, revision, existing, onSave, onCancel }: {
  deckId: string; revision: number; existing: PersonalWordInput[];
  onSave: (operations: PersonalOperation[], revision: number, eventId: string) => Promise<unknown>; onCancel: () => void;
}) {
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("");
  const [delimiter, setDelimiter] = useState<"," | "\t">(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ImportColumns | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [expectedRevision] = useState(revision);
  const [identity, setIdentity] = useState(() => crypto.randomUUID());
  const [page, setPage] = useState(0);
  const parsed = useMemo(() => {
    if (!source) return { rows: [], error: "" };
    try { return { rows: parseVocabularyTable(source, delimiter), error: "" }; }
    catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : "Could not read this file." }; }
  }, [source, delimiter]);
  const columns = mapping ?? suggestImportColumns(hasHeader ? parsed.rows[0] ?? [] : []);
  const preview = previewVocabularyImport(parsed.rows, columns, hasHeader, existing);
  const valid = preview.filter((row) => row.word && !row.duplicate && !row.error);
  const invalid = preview.filter((row) => row.error);
  const duplicates = preview.filter((row) => row.duplicate).length;
  const request = useRef<{ eventId: string; operations: PersonalOperation[] } | null>(null);
  const change = () => { setIdentity(crypto.randomUUID()); setPage(0); setError(""); };
  async function fileSelected(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > IMPORT_BYTE_LIMIT) { setError("Choose a file smaller than 2 MB."); return; }
    setReading(true);
    try {
      const text = await file.text();
      setSource(text); setFilename(file.name); setDelimiter(file.name.toLowerCase().endsWith(".tsv") || text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",");
      setMapping(null); setHasHeader(true); change();
    } catch { setError("This file could not be read. Try exporting it as UTF-8 CSV or TSV."); }
    finally { setReading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid.length || invalid.length || valid.length > IMPORT_WORD_LIMIT || saving || revision !== expectedRevision) return;
    setSaving(true); setError("");
    if (request.current?.eventId !== identity) request.current = { eventId: identity, operations: valid.map((row) => ({ action: "create_word", id: `personal:${crypto.randomUUID()}`, deckId, word: row.word! })) };
    try { await onSave(request.current.operations, expectedRevision, identity); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your import could not be saved. Retry with this preview."); }
    finally { setSaving(false); }
  }
  return <form className={styles.editor} onSubmit={submit}>
    <h2>Import vocabulary</h2>
    <p>Upload UTF-8 CSV or TSV, map the columns, then check the preview. Up to 1,000 words and 2 MB per import. Text fields only.</p>
    <a href="/templates/custom-vocabulary.csv" download>Download a CSV template</a>
    <fieldset className={styles.fields} disabled={saving || reading}>
      <label>CSV or TSV file<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => { void fileSelected(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
      {filename ? <p>{filename}</p> : null}
      <details><summary>Or paste delimited text</summary><textarea aria-label="Vocabulary CSV or TSV text" rows={6} value={source} onChange={(event) => { setSource(event.target.value); setMapping(null); change(); }} /></details>
      {source ? <>
        <div className={styles.twoColumns}><label>Separator<select value={delimiter} onChange={(event) => { setDelimiter(event.target.value as "," | "\t"); setMapping(null); change(); }}><option value=",">Comma (CSV)</option><option value={"\t"}>Tab (TSV)</option></select></label><label className={styles.checkbox}><input type="checkbox" checked={hasHeader} onChange={(event) => { setHasHeader(event.target.checked); setMapping(null); change(); }} />First row contains column names</label></div>
        {!parsed.error ? <div className={styles.mapping}>{IMPORT_FIELDS.map((field) => <label key={field}>{LABELS[field]}{field === "characters" || field === "meanings" ? " (required)" : ""}<select value={columns[field]} onChange={(event) => { setMapping({ ...columns, [field]: Number(event.target.value) }); change(); }}><option value={-1}>Not included</option>{(parsed.rows[0] ?? []).map((header, index) => <option key={index} value={index}>{hasHeader ? header || `Column ${index + 1}` : `Column ${index + 1}`}</option>)}</select></label>)}</div> : null}
        <p>Separate multiple meanings or parts of speech with |. Kanji words need a reading. Duplicates use spelling + reading within this deck, including archived words, and are skipped.</p>
      </> : null}
    </fieldset>
    {reading ? <p role="status">Reading your file…</p> : null}
    {source && !parsed.error && (columns.characters < 0 || columns.meanings < 0) ? <p role="alert">Map Japanese spelling and accepted meanings to preview the import.</p> : null}
    {parsed.error || error ? <p role="alert" className={styles.error}>{error || parsed.error}</p> : null}
    {preview.length ? <section aria-label="Import preview"><h3>Preview</h3><p role="status">{valid.length} ready · {duplicates} duplicates skipped · {invalid.length} rows need fixing</p>
      {invalid.length ? <p className={styles.error}>Fix the flagged rows in your source file before importing. No words have been saved.</p> : null}
      <div className={styles.tableScroll}><table><thead><tr><th>Row</th><th>Word</th><th>Reading</th><th>Meanings</th><th>Status</th></tr></thead><tbody>{preview.slice(page * 25, page * 25 + 25).map((row) => <tr key={row.row}><td>{row.row}</td><td lang="ja">{row.word?.characters ?? "—"}</td><td lang="ja">{row.word?.reading ?? "—"}</td><td>{row.word?.meanings.join("; ")}</td><td>{row.error ?? (row.duplicate ? "Duplicate · skipped" : "Ready")}</td></tr>)}</tbody></table></div>
      {preview.length > 25 ? <div className={styles.actions}><Button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous rows</Button><span>Page {page + 1} of {Math.ceil(preview.length / 25)}</span><Button type="button" disabled={(page + 1) * 25 >= preview.length} onClick={() => setPage(page + 1)}>Next rows</Button></div> : null}
    </section> : null}
    {revision !== expectedRevision ? <p role="alert">Your library changed. Cancel and reopen the import to preview the latest duplicates.</p> : null}
    <div className={styles.actions}><Button type="submit" tone="primary" state={saving ? "loading" : "idle"} disabled={!valid.length || Boolean(invalid.length) || Boolean(parsed.error) || valid.length > IMPORT_WORD_LIMIT || reading || revision !== expectedRevision}>Import {valid.length} words</Button><Button type="button" disabled={saving} onClick={onCancel}>Cancel</Button></div>
  </form>;
}
