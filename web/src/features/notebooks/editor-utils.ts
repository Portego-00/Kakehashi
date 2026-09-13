import { toHiragana } from "wanakana";
import type { Subject, SubjectType } from "@/types/wanikani";

export function isSafeNotebookLink(href: string) {
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href)) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function findNotebookSubjects(subjects: Subject[], query: string, limit = 30, options?: { types?: readonly SubjectType[] }): Subject[] {
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase();
  const kana = toHiragana(needle);
  const results: Array<{ subject: Subject; score: number }> = [];
  for (const subject of subjects) {
    if (options?.types?.length && !options.types.includes(subject.object)) continue;
    const japanese = (subject.data.characters || subject.data.slug).normalize("NFKC").toLocaleLowerCase();
    const meanings = [...subject.data.meanings.map((entry) => entry.meaning), ...subject.data.auxiliary_meanings.filter((entry) => entry.type === "whitelist").map((entry) => entry.meaning)].map((meaning) => meaning.normalize("NFKC").toLocaleLowerCase());
    const readings = subject.data.readings?.map((entry) => toHiragana(entry.reading.normalize("NFKC"))) || [];
    const exact = japanese === needle || meanings.includes(needle) || readings.includes(needle) || readings.includes(kana);
    const partial = japanese.includes(needle) || meanings.some((meaning) => meaning.includes(needle)) || readings.some((reading) => reading.includes(needle) || reading.includes(kana));
    if (!needle || exact || partial) results.push({ subject, score: exact ? 0 : 1 });
  }
  return results.sort((a, b) => a.score - b.score || a.subject.data.level - b.subject.data.level).slice(0, limit).map((result) => result.subject);
}
