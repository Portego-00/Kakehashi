"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { usePersonalLibrary } from "./use-personal-library";
import { PersonalWordEditor } from "./PersonalWordEditor";
import { PersonalVocabularyImport } from "./PersonalVocabularyImport";
import { type PersonalEntry, type PersonalOperation } from "./personal-vocabulary";
import styles from "./personal-library.module.css";

type WordEntry = Extract<PersonalEntry, { kind: "word" }>;
type View = { type: "browse" } | { type: "word"; entry?: WordEntry; deckId: string } | { type: "import"; deckId: string } | { type: "deck"; id?: string; title?: string };
export function PersonalVocabularyLibrary() {
  const { user, isDemo } = useSession();
  const scope = waniKaniUserId(user);
  if (isDemo) return <main className="page"><h1>Your vocabulary library</h1><p>Sign in to create private decks and import vocabulary.</p><Link href="/custom-vocabulary">Back to vocabulary</Link></main>;
  if (!scope) return <main className="page"><p role="status">Loading your account…</p></main>;
  return <AccountLibrary key={scope} scope={scope} />;
}
function AccountLibrary({ scope }: { scope: string }) {
  const query = usePersonalLibrary(scope);
  const [view, setView] = useState<View>({ type: "browse" });
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const decks = useMemo(() => Object.values(query.library.entries).filter((entry) => entry.kind === "deck"), [query.library]);
  const deckId = decks.some((deck) => deck.id === selected) ? selected : decks[0]?.id ?? "";
  const words = useMemo(() => Object.values(query.library.entries).filter((entry): entry is WordEntry => entry.kind === "word" && entry.deckId === deckId), [query.library, deckId]);
  const existing = useMemo(() => words.map((entry) => entry.data.word), [words]);
  const visible = words.filter((entry) => entry.data.archived === archived && `${entry.data.word.characters} ${entry.data.word.reading} ${entry.data.word.meanings.join(" ")}`.normalize("NFKC").toLowerCase().includes(search.normalize("NFKC").toLowerCase()));
  async function save(operations: PersonalOperation[], revision: number, eventId: string) {
    const result = await query.mutate({ operations, expectedRevision: revision, eventId });
    const created = operations.find((operation) => operation.action === "create_deck");
    if (created) setSelected(created.id);
    setView({ type: "browse" }); setPage(0);
    setNotice(result.added ? `${result.added} ${result.added === 1 ? "word added" : "words added"} to your lessons.${result.skipped ? ` ${result.skipped} duplicates skipped.` : ""}` : result.skipped ? `${result.skipped} duplicate words skipped. Existing progress is unchanged.` : "Library saved to your account.");
    return result;
  }
  async function archiveWord(entry: WordEntry) {
    setSaving(true); setError("");
    try {
      await query.mutate({ expectedRevision: query.library.revision, eventId: crypto.randomUUID(), operations: [{ action: "archive_word", id: entry.id, archived: !entry.data.archived }] });
      setNotice(entry.data.archived ? "Word restored with its existing review progress." : "Word archived. Its review history is preserved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this word."); }
    finally { setSaving(false); }
  }
  const open = (next: View) => { setView(next); setNotice(""); setError(""); };
  return <main className={`page ${styles.page}`}>
    <header className={styles.header}><div><Link href="/custom-vocabulary">← Back to vocabulary</Link><h1>Your vocabulary library</h1><p>Create private decks and import words into your own review schedule.</p></div><div className={styles.actions}><Button size="small" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh library</Button><Link href="/settings#custom-srs-settings">Scheduling settings</Link></div></header>
    {query.isPending ? <p role="status">Loading your private decks…</p> : null}
    {query.error ? <div role="alert" className={styles.error}>{query.error.message} <Button onClick={() => void query.refetch()}>Retry loading library</Button></div> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <p role="status" aria-live="polite">{notice}</p>
    {query.data ? <>
      {view.type === "word" ? <PersonalWordEditor key={view.entry?.id ?? `new:${view.deckId}`} entry={view.entry} deckId={view.deckId} revision={query.library.revision} onSave={save} onCancel={() => setView({ type: "browse" })} /> : view.type === "import" ? <PersonalVocabularyImport deckId={view.deckId} revision={query.library.revision} existing={existing} onSave={save} onCancel={() => setView({ type: "browse" })} /> : view.type === "deck" ? <DeckEditor id={view.id} title={view.title} revision={query.library.revision} onSave={save} onCancel={() => setView({ type: "browse" })} /> : <>
        <div className={styles.toolbar}><label>Deck<select value={deckId} onChange={(event) => { setSelected(event.target.value); setPage(0); setSearch(""); setArchived(false); }}>{decks.length ? decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.data.title}</option>) : <option value="">No decks yet</option>}</select></label><div className={styles.actions}><Button onClick={() => open({ type: "deck" })}>New deck</Button><Button tone="primary" disabled={!deckId} onClick={() => open({ type: "word", deckId })}>Add word</Button><Button disabled={!deckId} onClick={() => open({ type: "import", deckId })}>Import CSV / TSV</Button></div></div>
        {!decks.length ? <section className={styles.empty}><h2>Start with a deck</h2><p>Give your words a home, then add them one at a time or import a spreadsheet. Your library is private to your account.</p><Button tone="primary" onClick={() => open({ type: "deck" })}>Create your first deck</Button></section> : <>
          <div className={styles.toolbar}><label>Search this deck<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Spelling, reading, or meaning" /></label><label className={styles.checkbox}><input type="checkbox" checked={archived} onChange={(event) => { setArchived(event.target.checked); setPage(0); }} />Show archived words</label><Button size="small" onClick={() => open({ type: "deck", id: deckId, title: decks.find((deck) => deck.id === deckId)?.data.title })}>Rename deck</Button></div>
          <p>{visible.length} {archived ? "archived" : "active"} {visible.length === 1 ? "word" : "words"}{search ? " matching your search" : ""}. {archived ? "Restore a word to resume its existing schedule." : "New words appear in lessons. Archived words stop appearing in study queues."}</p>
          <ul className={styles.words} aria-label="Your vocabulary words">{visible.slice(page * 50, page * 50 + 50).map((entry) => <li key={entry.id}><div><Link href={`/custom-vocabulary/words/${encodeURIComponent(entry.id)}`} className={styles.word} lang="ja">{entry.data.word.characters}</Link><span lang="ja" className={styles.reading}>{entry.data.word.reading}</span><p>{entry.data.word.meanings.join("; ")}</p></div><div className={styles.actions}><Button size="small" onClick={() => open({ type: "word", entry, deckId })}>Edit <span className="sr-only">{entry.data.word.characters}</span></Button><Button size="small" disabled={saving} onClick={() => void archiveWord(entry)}>{entry.data.archived ? "Restore" : "Archive"}<span className="sr-only"> {entry.data.word.characters}</span></Button></div></li>)}</ul>
          {!visible.length ? <p className={styles.empty}>{search ? "No words match your search." : archived ? "No archived words in this deck." : "This deck is empty. Add a word or import your vocabulary."}</p> : null}
          {visible.length > 50 ? <div className={styles.actions}><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page + 1} of {Math.ceil(visible.length / 50)}</span><Button disabled={(page + 1) * 50 >= visible.length} onClick={() => setPage(page + 1)}>Next page</Button></div> : null}

        </>}
      </>}
      <footer className={styles.footer}><p>Text-only library · up to 100 decks and 10,000 words per account, including archived words. Audio and images are not imported.</p></footer>
    </> : null}
  </main>;
}
function DeckEditor({ id, title = "", revision, onSave, onCancel }: { id?: string; title?: string; revision: number; onSave: (operations: PersonalOperation[], revision: number, eventId: string) => Promise<unknown>; onCancel: () => void }) {
  const [value, setValue] = useState(title);
  const [identity] = useState(() => id ?? `personal:${crypto.randomUUID()}`);
  const [eventId, setEventId] = useState(() => crypto.randomUUID());
  const [expectedRevision] = useState(revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className={styles.editor} onSubmit={async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await onSave([{ action: id ? "rename_deck" : "create_deck", id: identity, title: value.trim() }], expectedRevision, eventId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the deck."); }
    finally { setSaving(false); }
  }}><h2>{id ? "Rename deck" : "Create a deck"}</h2><label>Deck name<input autoFocus required maxLength={100} value={value} disabled={saving} onChange={(event) => { setValue(event.target.value); setEventId(crypto.randomUUID()); }} placeholder="Words from my reading" /></label>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{revision !== expectedRevision ? <p role="alert">Your library changed. Cancel and reopen this form.</p> : null}<div className={styles.actions}><Button type="submit" tone="primary" state={saving ? "loading" : "idle"} disabled={!value.trim() || revision !== expectedRevision}>Save deck</Button><Button type="button" disabled={saving} onClick={onCancel}>Cancel</Button></div></form>;
}
