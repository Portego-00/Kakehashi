"use client";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { usePersonalLibrary } from "./use-personal-library";
import { CustomVocabularyDetail } from "./CustomVocabularyDetail";

export function PersonalVocabularyDetail({ wordId }: { wordId: string }) {
  const { user } = useSession();
  const library = usePersonalLibrary(waniKaniUserId(user));
  const entry = library.library.entries[wordId];
  if (library.isPending) return <main className="page"><p role="status">Loading your word…</p></main>;
  if (library.error) return <main className="page"><p role="alert">{library.error.message}</p><button onClick={() => void library.refetch()}>Retry</button></main>;
  if (!entry || entry.kind !== "word") return <main className="page"><h1>Word not found</h1><Link href="/custom-vocabulary/library">Open your vocabulary library</Link></main>;
  const deck = library.library.entries[entry.deckId];
  return <><div className="page"><Link href="/custom-vocabulary/library">Manage your vocabulary</Link>{entry.data.archived ? <p>This word is archived and is not in your study queues.</p> : null}</div><CustomVocabularyDetail word={{ ...entry.data.word, id: entry.id }} packTitle={deck?.kind === "deck" ? deck.data.title : "Your vocabulary"} /></>;
}
