import type { Subject } from "@/types/wanikani";
import { pageSubjectIds, type NotebookPage, type NotebookSentence } from "./model";

export function notebookPagesForSubject(pages: NotebookPage[], sentences: NotebookSentence[], subjectId: number): NotebookPage[] {
  return pages.filter((page) => !page.trashedAt && pageSubjectIds(page, sentences).includes(subjectId));
}

/** Add the current shared sentences to practice without changing source subjects. */
export function subjectsWithNotebookSentences(subjects: Subject[], sentences: NotebookSentence[]): Subject[] {
  if (!sentences.length) return subjects;
  const bySubject = new Map<number, NotebookSentence[]>();
  for (const sentence of sentences) {
    for (const subjectId of sentence.subjectIds) {
      const entries = bySubject.get(subjectId) ?? [];
      entries.push(sentence);
      bySubject.set(subjectId, entries);
    }
  }
  return subjects.map((subject) => {
    const shared = bySubject.get(subject.id);
    if (!shared?.length || (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary")) return subject;
    const contextSentences = [...(subject.data.context_sentences ?? [])];
    const known = new Set(contextSentences.map((sentence) => `${sentence.ja.trim()}\u0000${sentence.en.trim()}`));
    for (const sentence of shared) {
      const key = `${sentence.japanese.trim()}\u0000${sentence.english.trim()}`;
      if (!sentence.japanese.trim() || known.has(key)) continue;
      known.add(key);
      contextSentences.push({ ja: sentence.japanese, en: sentence.english });
    }
    return contextSentences.length === (subject.data.context_sentences?.length ?? 0)
      ? subject
      : { ...subject, data: { ...subject.data, context_sentences: contextSentences } };
  });
}
