import { Picker } from "@react-native-picker/picker";
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import React, { useMemo, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { IMPORT_BYTE_LIMIT, IMPORT_WORD_LIMIT } from "../../../web/src/features/custom-srs/personal-vocabulary";
import { IMPORT_FIELDS, parseVocabularyTable, previewVocabularyImport, suggestImportColumns, type ImportColumns, type ImportField } from "../../../web/src/features/custom-srs/vocabulary-import";
import { useTheme } from "../../utils/theme";
import { VocabularyButton, VocabularyField, VocabularyMessage } from "./native-controls";
import type { PersonalOperation, PersonalWordInput } from "./personal-library";
import type { SaveVocabulary } from "./personal-word-form";

const LABELS: Record<ImportField, string> = { characters: "Japanese spelling", reading: "Reading", meanings: "Accepted meanings", meaningMnemonic: "Meaning notes", readingMnemonic: "Reading notes", partsOfSpeech: "Parts of speech", sentenceJa: "Japanese sentence", sentenceEn: "English sentence" };
export function VocabularyImportForm({ deckId, revision, existing, blocked, onSave, onCancel }: { deckId: string; revision: number; existing: PersonalWordInput[]; blocked: boolean; onSave: SaveVocabulary; onCancel: () => void }) {
  const { theme } = useTheme();
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("");
  const [delimiter, setDelimiter] = useState<"," | "\t">(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ImportColumns | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [expectedRevision] = useState(revision);
  const [identity, setIdentity] = useState(randomUUID);
  const [page, setPage] = useState(0);
  const mounted = useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const parsed = useMemo(() => {
    if (!source) return { rows: [] as string[][], error: "" };
    try { return { rows: parseVocabularyTable(source, delimiter), error: "" }; }
    catch (cause) { return { rows: [] as string[][], error: cause instanceof Error ? cause.message : "Could not read this file." }; }
  }, [source, delimiter]);
  const columns = useMemo(() => mapping ?? suggestImportColumns(hasHeader ? parsed.rows[0] ?? [] : []), [mapping, hasHeader, parsed.rows]);
  const preview = useMemo(() => previewVocabularyImport(parsed.rows, columns, hasHeader, existing), [parsed.rows, columns, hasHeader, existing]);
  const valid = preview.filter((row) => row.word && !row.duplicate && !row.error);
  const invalid = preview.filter((row) => row.error);
  const duplicates = preview.filter((row) => row.duplicate).length;
  const request = useRef<{ eventId: string; operations: PersonalOperation[] } | null>(null);
  const change = () => { setIdentity(randomUUID()); setPage(0); setError(""); };
  const stale = revision !== expectedRevision;
  const chooseFile = async () => {
    setReading(true); setError("");
    try {
      const selection = await File.pickFileAsync();
      const file = Array.isArray(selection) ? selection[0] : selection;
      if (!file || !mounted.current) return;
      if (file.size > IMPORT_BYTE_LIMIT) throw new Error("Choose a file smaller than 2 MB.");
      const text = await file.text();
      if (!mounted.current) return;
      setSource(text); setFilename(file.name); setDelimiter(file.name.toLowerCase().endsWith(".tsv") || text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",");
      setMapping(null); setHasHeader(true); change();
    } catch (cause) {
      if (mounted.current && !(cause instanceof Error && /cancel/i.test(cause.message))) setError(cause instanceof Error ? cause.message : "Could not read this file. Choose UTF-8 CSV or TSV.");
    } finally { if (mounted.current) setReading(false); }
  };
  const save = async () => {
    if (!valid.length || invalid.length || valid.length > IMPORT_WORD_LIMIT || saving || reading || stale || blocked) return;
    setSaving(true); setError("");
    if (request.current?.eventId !== identity) request.current = { eventId: identity, operations: valid.map((row) => ({ action: "create_word", id: `personal:${randomUUID()}`, deckId, word: row.word! })) };
    try { await onSave(request.current.operations, expectedRevision, identity); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your import could not be saved. Retry with this preview."); }
    finally { setSaving(false); }
  };
  return <View style={{ gap: 16 }}>
    <VocabularyMessage>Choose a UTF-8 CSV or TSV file, or paste delimited text. Check the preview before importing. Up to 1,000 words and 2 MB per import; text fields only.</VocabularyMessage>
    <VocabularyButton label="Choose CSV / TSV file" busy={reading} disabled={saving} onPress={() => { void chooseFile(); }} />
    {filename ? <VocabularyMessage>{filename}</VocabularyMessage> : null}
    <VocabularyField label="Vocabulary CSV or TSV text" multiline value={source} editable={!saving && !reading} placeholder="characters,reading,meanings" onChangeText={(text) => { setSource(text); setMapping(null); change(); }} />
    {source ? <>
      <View style={{ flexDirection: "row", gap: 10 }}><VocabularyButton label="Comma (CSV)" primary={delimiter === ","} disabled={saving} onPress={() => { setDelimiter(","); setMapping(null); change(); }} /><VocabularyButton label="Tab (TSV)" primary={delimiter === "\t"} disabled={saving} onPress={() => { setDelimiter("\t"); setMapping(null); change(); }} /></View>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Text style={{ flex: 1, color: theme.textColor }}>First row contains column names</Text><Switch accessibilityLabel="First row contains column names" disabled={saving} value={hasHeader} onValueChange={(value) => { setHasHeader(value); setMapping(null); change(); }} /></View>
      {!parsed.error ? <>
        <VocabularyButton label={showMapping ? "Hide column mapping" : "Map columns"} disabled={saving} onPress={() => setShowMapping(!showMapping)} />
        {showMapping ? IMPORT_FIELDS.map((field) => <View key={field}><Text style={{ color: theme.textColor, fontWeight: "600" }}>{LABELS[field]}{field === "characters" || field === "meanings" ? " (required)" : ""}</Text><Picker accessibilityLabel={`${LABELS[field]} column`} enabled={!saving} selectedValue={columns[field]} onValueChange={(value) => { setMapping({ ...columns, [field]: Number(value) }); change(); }} style={{ color: theme.textColor }} itemStyle={{ color: theme.textColor, height: 120 }}><Picker.Item label="Not included" value={-1} />{(parsed.rows[0] ?? []).map((header, index) => <Picker.Item key={index} label={hasHeader ? header || `Column ${index + 1}` : `Column ${index + 1}`} value={index} />)}</Picker></View>) : null}
        {columns.characters < 0 || columns.meanings < 0 ? <VocabularyMessage error>Map Japanese spelling and accepted meanings to preview the import.</VocabularyMessage> : null}
      </> : null}
      <VocabularyMessage>Separate meanings or parts of speech with |. Kanji words need a reading. Duplicates use spelling + reading within this deck, including archived words.</VocabularyMessage>
    </> : null}
    {error || parsed.error ? <VocabularyMessage error>{error || parsed.error}</VocabularyMessage> : null}
    {preview.length ? <>
      <VocabularyMessage>{valid.length} ready · {duplicates} duplicates skipped · {invalid.length} rows need fixing</VocabularyMessage>
      {invalid.length ? <VocabularyMessage error>Fix the flagged rows before importing. No words have been saved.</VocabularyMessage> : null}
      {preview.slice(page * 25, page * 25 + 25).map((row) => <View key={row.row} style={{ padding: 12, gap: 5, backgroundColor: theme.cardBackground, borderRadius: 10 }}><Text selectable style={{ color: theme.textColor }}>{row.row}. {row.word?.characters ?? "—"} · {row.word?.reading ?? "—"}</Text><VocabularyMessage error={Boolean(row.error)}>{row.error ?? `${row.word?.meanings.join("; ")} · ${row.duplicate ? "Duplicate — skipped" : "Ready"}`}</VocabularyMessage></View>)}
      {preview.length > 25 ? <><VocabularyMessage>Page {page + 1} of {Math.ceil(preview.length / 25)}</VocabularyMessage><VocabularyButton label="Previous rows" disabled={saving || page === 0} onPress={() => setPage(page - 1)} /><VocabularyButton label="Next rows" disabled={saving || (page + 1) * 25 >= preview.length} onPress={() => setPage(page + 1)} /></> : null}
    </> : null}
    {stale ? <VocabularyMessage error>Your library changed. Cancel and reopen the import to preview the latest duplicates.</VocabularyMessage> : null}
    <VocabularyButton label={`Import ${valid.length} words`} primary busy={saving} disabled={!valid.length || Boolean(invalid.length) || Boolean(parsed.error) || valid.length > IMPORT_WORD_LIMIT || reading || stale || blocked} onPress={() => { void save(); }} />
    <VocabularyButton label="Cancel" disabled={saving || reading} onPress={onCancel} />
  </View>;
}
