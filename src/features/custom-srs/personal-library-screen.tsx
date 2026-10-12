import { Picker } from "@react-native-picker/picker";
import { randomUUID } from "expo-crypto";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../utils/theme";
import CustomVocabularyHeader from "./custom-vocabulary-header";
import { useCustomSrs } from "./data";
import { VocabularyButton, VocabularyField, VocabularyMessage } from "./native-controls";
import { goBackFromCustomVocabulary } from "./navigation";
import type { PersonalEntry } from "./personal-library";
import { PersonalWordForm, type SaveVocabulary } from "./personal-word-form";
import { VocabularyImportForm } from "./vocabulary-import-form";

type WordEntry = Extract<PersonalEntry, { kind: "word" }>;
type ViewState = { type: "browse" } | { type: "deck"; id?: string; title?: string } | { type: "word"; deckId: string; entry?: WordEntry } | { type: "import"; deckId: string };

export default function PersonalLibraryScreen() {
  const srs = useCustomSrs();
  const params = useLocalSearchParams<{ deckId?: string }>();
  return <PersonalLibraryAccount key={srs.accountId} srs={srs} initialDeckId={params.deckId} />;
}

function PersonalLibraryAccount({ srs, initialDeckId }: { srs: ReturnType<typeof useCustomSrs>; initialDeckId?: string }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewState>({ type: "browse" });
  const [selected, setSelected] = useState(initialDeckId ?? "");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const archiveRetry = useRef<{ wordId: string; archived: boolean; revision: number; eventId: string } | null>(null);
  const library = srs.library;
  const decks = Object.values(library.entries).filter((entry) => entry.kind === "deck");
  const deckId = decks.some((entry) => entry.id === selected) ? selected : decks[0]?.id ?? "";
  const words = useMemo(() => Object.values(library.entries).filter((entry): entry is WordEntry => entry.kind === "word" && entry.deckId === deckId), [library, deckId]);
  const visible = words.filter((entry) => entry.data.archived === archived && (!search.trim() || `${entry.data.word.characters} ${entry.data.word.reading} ${entry.data.word.meanings.join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const existing = useMemo(() => words.map((entry) => entry.data.word), [words]);
  const blocked = srs.loading || srs.syncing || srs.pendingCount > 0 || Boolean(srs.error);
  const open = (next: ViewState) => { setView(next); setError(""); setNotice(""); };
  const save: SaveVocabulary = async (operations, revision, eventId) => {
    const result = await srs.saveLibrary(operations, revision, eventId);
    const createdDeck = operations.find((operation) => operation.action === "create_deck");
    if (createdDeck) { setSelected(createdDeck.id); setPage(0); setSearch(""); setArchived(false); }
    setView({ type: "browse" });
    setNotice(result && "added" in result && (result.added || result.skipped) ? `${result.added} words added${result.skipped ? `; ${result.skipped} duplicates skipped` : ""}.` : "Your library is saved.");
    return result;
  };
  const archiveWord = async (entry: WordEntry) => {
    setSaving(true); setError("");
    const archived = !entry.data.archived;
    if (archiveRetry.current?.wordId !== entry.id || archiveRetry.current.archived !== archived || archiveRetry.current.revision !== library.revision) archiveRetry.current = { wordId: entry.id, archived, revision: library.revision, eventId: randomUUID() };
    try { await save([{ action: "archive_word", id: entry.id, archived }], archiveRetry.current.revision, archiveRetry.current.eventId); archiveRetry.current = null; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this word."); }
    finally { setSaving(false); }
  };
  const title = view.type === "word" ? view.entry ? "Edit word" : "Add word" : view.type === "import" ? "Import vocabulary" : view.type === "deck" ? view.id ? "Rename deck" : "Create a deck" : "Personal decks";
  return <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
    <Stack.Screen options={{ title, headerShown: false }} />
    <CustomVocabularyHeader title={title} onBack={() => view.type === "browse" ? goBackFromCustomVocabulary() : setView({ type: "browse" })} />
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
      {srs.loading ? <VocabularyMessage>Loading your personal decks…</VocabularyMessage> : null}
      {srs.error ? <><VocabularyMessage error>{srs.error}</VocabularyMessage><VocabularyButton label="Retry loading library" disabled={saving} onPress={() => { void srs.refresh().catch(() => undefined); }} /></> : null}
      {error ? <VocabularyMessage error>{error}</VocabularyMessage> : null}
      {notice ? <VocabularyMessage>{notice}</VocabularyMessage> : null}
      {view.type === "word" ? <PersonalWordForm key={view.entry?.id ?? `new:${view.deckId}`} entry={view.entry} deckId={view.deckId} revision={library.revision} blocked={blocked} onSave={save} onCancel={() => setView({ type: "browse" })} />
        : view.type === "import" ? <VocabularyImportForm key={view.deckId} deckId={view.deckId} revision={library.revision} existing={existing} blocked={blocked} onSave={save} onCancel={() => setView({ type: "browse" })} />
        : view.type === "deck" ? <DeckForm key={view.id ?? "new"} id={view.id} title={view.title} revision={library.revision} blocked={blocked} onSave={save} onCancel={() => setView({ type: "browse" })} />
        : <>
          <VocabularyMessage>Create private decks or import words into your own review schedule. Your library and progress sync with web.</VocabularyMessage>
          <VocabularyButton label="New deck" primary disabled={blocked} onPress={() => open({ type: "deck" })} />
          {decks.length ? <>
            <Picker accessibilityLabel="Deck" enabled={!saving} selectedValue={deckId} onValueChange={(value) => { setSelected(value); setPage(0); setSearch(""); setArchived(false); }} style={{ color: theme.textColor }} itemStyle={{ color: theme.textColor, height: 120 }}>{decks.map((deck) => <Picker.Item key={deck.id} label={deck.data.title} value={deck.id} />)}</Picker>
            <VocabularyButton label="Open deck for study" onPress={() => router.push({ pathname: "/custom-vocabulary", params: { packId: deckId } } as never)} />
            <VocabularyButton label="Add word" disabled={blocked} onPress={() => open({ type: "word", deckId })} />
            <VocabularyButton label="Import CSV / TSV" disabled={blocked} onPress={() => open({ type: "import", deckId })} />
            <VocabularyButton label="Rename deck" disabled={blocked} onPress={() => open({ type: "deck", id: deckId, title: decks.find((deck) => deck.id === deckId)?.data.title })} />
            <VocabularyField label="Search this deck" value={search} placeholder="Spelling, reading, or meaning" onChangeText={(value) => { setSearch(value); setPage(0); }} />
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Text style={{ flex: 1, color: theme.textColor }}>Show archived words</Text><Switch accessibilityLabel="Show archived words" value={archived} onValueChange={(value) => { setArchived(value); setPage(0); }} /></View>
            <VocabularyMessage>{visible.length} {archived ? "archived" : "active"} words. {archived ? "Restore a word to resume its existing schedule." : "New words appear in lessons. Archived words stop appearing in study queues."}</VocabularyMessage>
            {visible.slice(page * 50, page * 50 + 50).map((entry) => <View key={entry.id} style={{ padding: 14, gap: 10, backgroundColor: theme.cardBackground, borderRadius: 12, borderCurve: "continuous" }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${entry.data.word.characters}`} onPress={() => router.push({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId: entry.id } } as never)}><Text selectable style={{ color: theme.textColor, fontSize: 21 }}>{entry.data.word.characters}</Text><Text selectable style={{ color: theme.textSecondary, fontSize: 15 }}>{entry.data.word.reading} · {entry.data.word.meanings.join("; ")}</Text></Pressable>
              <VocabularyButton label={`Edit ${entry.data.word.characters}`} disabled={blocked || saving} onPress={() => open({ type: "word", deckId, entry })} />
              <VocabularyButton label={`${entry.data.archived ? "Restore" : "Archive"} ${entry.data.word.characters}`} disabled={blocked || saving} onPress={() => { void archiveWord(entry); }} />
            </View>)}
            {!visible.length ? <VocabularyMessage>{search ? "No words match your search." : archived ? "No archived words in this deck." : "This deck is empty. Add a word or import your vocabulary."}</VocabularyMessage> : null}
            {visible.length > 50 ? <><VocabularyMessage>Page {page + 1} of {Math.ceil(visible.length / 50)}</VocabularyMessage><VocabularyButton label="Previous page" disabled={page === 0} onPress={() => setPage(page - 1)} /><VocabularyButton label="Next page" disabled={(page + 1) * 50 >= visible.length} onPress={() => setPage(page + 1)} /></> : null}
          </> : <VocabularyMessage>Start with a deck, then add words individually or import a spreadsheet.</VocabularyMessage>}
          <VocabularyButton label="Scheduling settings" onPress={() => router.push("/custom-vocabulary/settings" as never)} />
          <VocabularyMessage>Text-only library · up to 100 decks and 10,000 words, including archived words. Audio and images are not imported.</VocabularyMessage>
        </>}
    </ScrollView>
  </View>;
}

function DeckForm({ id, title = "", revision, blocked, onSave, onCancel }: { id?: string; title?: string; revision: number; blocked: boolean; onSave: SaveVocabulary; onCancel: () => void }) {
  const [value, setValue] = useState(title);
  const [identity] = useState(() => id ?? `personal:${randomUUID()}`);
  const [eventId, setEventId] = useState(randomUUID);
  const [expectedRevision] = useState(revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!value.trim() || saving || blocked || revision !== expectedRevision) return;
    setSaving(true); setError("");
    try { await onSave([{ action: id ? "rename_deck" : "create_deck", id: identity, title: value.trim() }], expectedRevision, eventId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your deck could not be saved. Your edits are still here."); }
    finally { setSaving(false); }
  };
  return <View style={{ gap: 16 }}><VocabularyField label="Deck name" value={value} maxLength={100} editable={!saving} placeholder="Words from my reading" onChangeText={(text) => { setValue(text); setEventId(randomUUID()); setError(""); }} />
    {error ? <VocabularyMessage error>{error}</VocabularyMessage> : null}
    {revision !== expectedRevision ? <VocabularyMessage error>Your library changed. Cancel and reopen this form.</VocabularyMessage> : null}
    <VocabularyButton label="Save deck" primary busy={saving} disabled={!value.trim() || blocked || revision !== expectedRevision} onPress={() => { void save(); }} /><VocabularyButton label="Cancel" disabled={saving} onPress={onCancel} />
  </View>;
}
