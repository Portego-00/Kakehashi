import type { SubjectType } from "@/types/wanikani";

export type SearchState = {
  query: string;
  types: SubjectType[];
  srs: string[];
  minLevel: number;
  maxLevel: number;
  visiblePages: number;
};

const SUBJECT_TYPES = new Set<SubjectType>(["radical", "kanji", "vocabulary", "kana_vocabulary"]);
const SRS_STAGES = new Set(["apprentice", "guru", "master", "enlightened", "burned", "locked"]);

export const DEFAULT_SEARCH_STATE: SearchState = {
  query: "",
  types: [],
  srs: [],
  minLevel: 1,
  maxLevel: 60,
  visiblePages: 1,
};

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: SearchParamValue) {
  return (first(value) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function boundedInteger(value: SearchParamValue, fallback: number, minimum: number, maximum: number) {
  const number = Number(first(value));
  return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

export function searchStateFromParams(params: Record<string, SearchParamValue>): SearchState {
  const minLevel = boundedInteger(params.min, DEFAULT_SEARCH_STATE.minLevel, 1, 60);
  const maxLevel = boundedInteger(params.max, DEFAULT_SEARCH_STATE.maxLevel, minLevel, 60);
  return {
    query: first(params.q)?.slice(0, 200) ?? "",
    types: list(params.types).filter((value): value is SubjectType => SUBJECT_TYPES.has(value as SubjectType)),
    srs: list(params.srs).filter((value) => SRS_STAGES.has(value)),
    minLevel,
    maxLevel,
    visiblePages: boundedInteger(params.pages, 1, 1, 50),
  };
}

export function searchHref(state: SearchState) {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query);
  if (state.types.length) params.set("types", state.types.join(","));
  if (state.srs.length) params.set("srs", state.srs.join(","));
  if (state.minLevel > 1) params.set("min", String(state.minLevel));
  if (state.maxLevel < 60) params.set("max", String(state.maxLevel));
  if (state.visiblePages > 1) params.set("pages", String(state.visiblePages));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}
