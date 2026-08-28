import niaiData from "./data/niai-similar-kanji.json";
import type { Subject } from "@/types/wanikani";
import { filterStudySubjects, shuffle } from "./engine";
import type { StudyDataset, StudyFilters } from "./types";

const NIAI = niaiData as Record<string, string>;

export interface SimilarKanjiBoardItem {
  subjectId: number;
  characters: string;
  meaning: string;
}

export interface SimilarKanjiBoardRound {
  id: string;
  items: SimilarKanjiBoardItem[];
}

function meaning(subject: Subject) {
  return subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? "Unknown";
}

export function niaiCharacters(character: string): string[] {
  return [...(NIAI[character] ?? "")];
}

export function buildSimilarKanjiBoards(dataset: StudyDataset, filters: StudyFilters, random: () => number = Math.random): SimilarKanjiBoardRound[] {
  const learnedIds = new Set(dataset.assignments.filter((assignment) => assignment.data.srs_stage > 0 && !assignment.data.hidden).map((assignment) => assignment.data.subject_id));
  const selectedIds = new Set(filters.selectedSubjectIds);
  const allKanji = dataset.subjects.filter((subject) => subject.object === "kanji"
    && subject.data.characters
    && (!selectedIds.size || selectedIds.has(subject.id))
    && (!filters.similarKanjiOnlyLearned || learnedIds.has(subject.id)));
  const byId = new Map(allKanji.map((subject) => [subject.id, subject]));
  const byCharacter = new Map(allKanji.map((subject) => [subject.data.characters!, subject]));
  const targets = shuffle(filterStudySubjects(dataset, { ...filters, subjectTypes: ["kanji"] }), random);
  const used = new Set<number>();
  const rounds: SimilarKanjiBoardRound[] = [];

  for (const target of targets) {
    if (rounds.length >= filters.count || used.has(target.id) || !target.data.characters) continue;
    const related = filters.similarKanjiSource === "niai"
      ? niaiCharacters(target.data.characters).map((character) => byCharacter.get(character)).filter((subject): subject is Subject => Boolean(subject))
      : (target.data.visually_similar_subject_ids ?? []).map((id) => byId.get(id)).filter((subject): subject is Subject => Boolean(subject));
    const group = [target, ...shuffle(related.filter((subject) => subject.id !== target.id && !used.has(subject.id)), random)]
      .filter((subject, index, values) => values.findIndex((candidate) => candidate.id === subject.id) === index)
      .slice(0, filters.similarKanjiGroupSize);
    if (group.length < 2) continue;
    group.forEach((subject) => used.add(subject.id));
    rounds.push({ id: `${target.id}:${rounds.length}`, items: group.map((subject) => ({ subjectId: subject.id, characters: subject.data.characters!, meaning: meaning(subject) })) });
  }

  if (!rounds.length) {
    const fallback = shuffle(targets.filter((subject) => subject.data.characters), random).slice(0, filters.similarKanjiGroupSize);
    if (fallback.length >= 2) rounds.push({ id: "meaning-match", items: fallback.map((subject) => ({ subjectId: subject.id, characters: subject.data.characters!, meaning: meaning(subject) })) });
  }
  return rounds;
}
