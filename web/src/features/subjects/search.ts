import { toHiragana, toRomaji } from "wanakana";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { srsBucketForStage } from "@/features/progress/calculations";

export interface SubjectSearchFilters {
  query: string;
  types: SubjectType[];
  minLevel: number;
  maxLevel: number;
  srs: string[];
}

export interface SubjectSearchResult {
  subject: Subject;
  assignment?: Assignment;
  score: number;
  matchedOn: string;
}

const SPACE_RE = /\s+/g;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(SPACE_RE, " ");
}

function subsequenceScore(query: string, candidate: string) {
  let queryIndex = 0;
  let gap = 0;
  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] === query[queryIndex]) queryIndex += 1;
    else if (queryIndex > 0) gap += 1;
  }
  if (queryIndex !== query.length) return 0;
  const maximumGap = Math.max(2, Math.floor(query.length * 0.4));
  return gap <= maximumGap ? Math.max(10, 45 - gap) : 0;
}

export function fuzzyFieldScore(rawQuery: string, rawCandidate: string) {
  const query = normalize(rawQuery);
  const candidate = normalize(rawCandidate);
  if (!query || !candidate) return 0;
  if (query === candidate) return 120;
  if (candidate.startsWith(query)) return 95 - Math.min(20, candidate.length - query.length);
  const index = candidate.indexOf(query);
  if (index >= 0) return 70 - Math.min(20, index);
  return subsequenceScore(query, candidate);
}

function subjectFields(subject: Subject) {
  const characters = subject.data.characters ?? "";
  const readings = subject.data.readings?.map((reading) => reading.reading) ?? [];
  const meanings = subject.data.meanings.map((meaning) => meaning.meaning);
  const fields = [
    { label: "characters", value: characters, boost: 35 },
    { label: "slug", value: subject.data.slug, boost: 25 },
    ...meanings.map((value, index) => ({ label: "meaning", value, boost: index === 0 ? 20 : 12 })),
    ...readings.map((value, index) => ({ label: "reading", value, boost: index === 0 ? 20 : 12 })),
  ];
  if (characters) fields.push({ label: "romaji", value: toRomaji(characters), boost: 8 });
  for (const reading of readings) fields.push({ label: "romaji", value: toRomaji(reading), boost: 8 });
  return fields;
}

export function searchSubjects(subjects: Subject[], assignments: Assignment[], filters: SubjectSearchFilters): SubjectSearchResult[] {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const query = normalize(filters.query);
  const hiraganaQuery = query ? toHiragana(query) : "";
  const queries = Array.from(new Set([query, hiraganaQuery].filter(Boolean)));
  const types = new Set(filters.types);
  const srs = new Set(filters.srs.map((value) => value.toLowerCase()));
  const results: SubjectSearchResult[] = [];

  for (const subject of subjects) {
    if (subject.data.hidden_at || subject.data.level < filters.minLevel || subject.data.level > filters.maxLevel) continue;
    if (types.size > 0 && !types.has(subject.object)) continue;
    const assignment = assignmentBySubject.get(subject.id);
    const bucket = srsBucketForStage(assignment?.data.srs_stage ?? 0).toLowerCase();
    if (srs.size > 0 && !srs.has(bucket)) continue;

    let score = query ? 0 : 1;
    let matchedOn = "catalog";
    for (const field of subjectFields(subject)) {
      for (const candidateQuery of queries) {
        const matchScore = fuzzyFieldScore(candidateQuery, field.value);
        if (matchScore === 0) continue;
        const fieldScore = matchScore + field.boost;
        if (fieldScore > score) {
          score = fieldScore;
          matchedOn = field.label;
        }
      }
    }
    if (score > 0) results.push({ subject, assignment, score, matchedOn });
  }

  return results.sort((a, b) => b.score - a.score || a.subject.data.level - b.subject.data.level || a.subject.id - b.subject.id);
}

export const DEFAULT_SEARCH_FILTERS: SubjectSearchFilters = {
  query: "",
  types: [],
  minLevel: 1,
  maxLevel: 60,
  srs: [],
};
