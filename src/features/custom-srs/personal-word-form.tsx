import { randomUUID } from "expo-crypto";
import React, { useState } from "react";
import { View } from "react-native";
import { personalWordSchema } from "../../../web/src/features/custom-srs/personal-vocabulary";
import { VocabularyButton, VocabularyField, VocabularyMessage } from "./native-controls";
import type { PersonalEntry, PersonalOperation, PersonalWordInput } from "./personal-library";

const EMPTY_WORD: PersonalWordInput = { characters: "", reading: "", meanings: [], partsOfSpeech: [], meaningMnemonic: "", readingMnemonic: "", contextSentences: [] };
export type SaveVocabulary = (operations: PersonalOperation[], revision: number, eventId: string) => Promise<unknown>;

export function PersonalWordForm({ entry, deckId, revision, blocked, onSave, onCancel }: { entry?: Extract<PersonalEntry, { kind: "word" }>; deckId: string; revision: number; blocked: boolean; onSave: SaveVocabulary; onCancel: () => void }) {
  const initial = entry?.data.word ?? EMPTY_WORD;
  const [word, setWord] = useState(initial);
  const [meanings, setMeanings] = useState(initial.meanings.join(" | "));
  const [parts, setParts] = useState(initial.partsOfSpeech.join(" | "));
  const [expectedRevision] = useState(revision);
  const [id] = useState(() => entry?.id ?? `personal:${randomUUID()}`);
  const [eventId, setEventId] = useState(randomUUID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stale = revision !== expectedRevision;
  const changed = () => { setEventId(randomUUID()); setError(""); };
  const update = (patch: Partial<PersonalWordInput>) => { setWord({ ...word, ...patch }); changed(); };
  const save = async () => {
    if (saving || blocked || stale) return;
    const reading = word.reading.trim() || (/\p{Script=Han}/u.test(word.characters) ? "" : word.characters);
    const parsed = personalWordSchema.safeParse({ ...word, reading, meanings: meanings.split("|").map((value) => value.trim()).filter(Boolean), partsOfSpeech: parts.split("|").map((value) => value.trim()).filter(Boolean), contextSentences: word.contextSentences.filter((sentence) => sentence.ja.trim() || sentence.en.trim()) });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")); return; }
    setSaving(true); setError("");
    try { await onSave([entry ? { action: "edit_word", id, word: parsed.data } : { action: "create_word", id, deckId, word: parsed.data }], expectedRevision, eventId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your word could not be saved. Your edits are still here."); }
    finally { setSaving(false); }
  };
  return <View style={{ gap: 16 }}>
    <VocabularyMessage>{entry ? "Editing preserves this word’s stage, next review, and history." : "Your word will be ready for lessons after you save it."}</VocabularyMessage>
    <VocabularyField label="Japanese spelling" value={word.characters} maxLength={120} editable={!saving} onChangeText={(characters) => update({ characters })} />
    <VocabularyField label="Reading" value={word.reading} maxLength={160} editable={!saving} help="Required for kanji words. Kana-only words can use their spelling." onChangeText={(reading) => update({ reading })} />
    <VocabularyField label="Accepted meanings" value={meanings} maxLength={4020} editable={!saving} help="Separate accepted answers with |, for example: book | volume." onChangeText={(value) => { setMeanings(value); changed(); }} />
    <VocabularyField label="Parts of speech" value={parts} maxLength={810} editable={!saving} placeholder="noun | expression" onChangeText={(value) => { setParts(value); changed(); }} />
    <VocabularyField label="Meaning notes or mnemonic" value={word.meaningMnemonic} maxLength={3000} multiline editable={!saving} onChangeText={(meaningMnemonic) => update({ meaningMnemonic })} />
    <VocabularyField label="Reading notes or mnemonic" value={word.readingMnemonic ?? ""} maxLength={3000} multiline editable={!saving} onChangeText={(readingMnemonic) => update({ readingMnemonic })} />
    {word.contextSentences.map((sentence, index) => <View key={index} style={{ gap: 10 }}>
      <VocabularyField label={`Japanese sentence ${index + 1}`} value={sentence.ja} maxLength={1000} multiline editable={!saving} onChangeText={(ja) => update({ contextSentences: word.contextSentences.map((value, i) => i === index ? { ...value, ja } : value) })} />
      <VocabularyField label={`English sentence ${index + 1}`} value={sentence.en} maxLength={1000} multiline editable={!saving} onChangeText={(en) => update({ contextSentences: word.contextSentences.map((value, i) => i === index ? { ...value, en } : value) })} />
      <VocabularyButton label={`Remove sentence ${index + 1}`} disabled={saving} onPress={() => update({ contextSentences: word.contextSentences.filter((_, i) => i !== index) })} />
    </View>)}
    {word.contextSentences.length < 5 ? <VocabularyButton label="Add example sentence" disabled={saving} onPress={() => update({ contextSentences: [...word.contextSentences, { ja: "", en: "" }] })} /> : null}
    {error ? <VocabularyMessage error>{error}</VocabularyMessage> : null}
    {stale ? <VocabularyMessage error>Your library changed. Cancel and reopen the word before saving.</VocabularyMessage> : null}
    <VocabularyButton label="Save word" primary busy={saving} disabled={blocked || stale} onPress={() => { void save(); }} />
    <VocabularyButton label="Cancel" disabled={saving} onPress={onCancel} />
  </View>;
}
