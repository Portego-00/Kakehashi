import type { RequestOptions } from "@/lib/wanikani/client";
import type { Assignment, AssignmentData, CharacterImage, LevelProgression, ReviewCreateResponse, ReviewStatistic, StudyMaterial, Subject, SubjectReading, SubjectType, WKCollection, WKResource, WKSummary } from "@/types/wanikani";
import facts from "./wanikani-subjects.generated.json";
import { DEMO_RADICAL_FACTS } from "./radicals";
import { DEMO_USER } from "./runtime";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const EPOCH = "2026-01-01T00:00:00.000Z";
export const DEMO_WANIKANI_STORAGE_KEY = "kakehashi:demo:wanikani:v1";

interface SubjectFact {
  id: number;
  object: SubjectType;
  characters: string | null;
  meanings: string[];
  slug?: string;
  sourceUrl?: string;
  characterImages?: CharacterImage[];
  readings?: string[] | SubjectReading[];
  level: number;
  audio?: string[];
  context?: { ja: string; en: string };
  similarCharacters?: string[];
}

function resource<T, O extends string>(id: number, object: O, endpoint: string, data: T, updatedAt = EPOCH): WKResource<T, O> {
  return { id, object, url: `/api/wanikani/${endpoint}/${id}`, data_updated_at: updatedAt, data };
}

const subjectFacts: SubjectFact[] = [...DEMO_RADICAL_FACTS, ...facts as unknown as SubjectFact[]];
const kanjiByCharacter = new Map(subjectFacts.filter((item) => item.object === "kanji").map((item) => [item.characters, item.id]));
const radicalsByKanji = new Map<number, number[]>();
for (const radical of DEMO_RADICAL_FACTS) {
  for (const kanjiId of radical.amalgamationSubjectIds) {
    const components = radicalsByKanji.get(kanjiId) ?? [];
    components.push(radical.id);
    radicalsByKanji.set(kanjiId, components);
  }
}

export const DEMO_SUBJECTS: Subject[] = subjectFacts.map((fact) => {
  const readings = (fact.readings ?? []).map((reading, index) => typeof reading === "string"
    ? { reading, primary: index === 0, accepted_answer: true }
    : reading);
  const isVocabulary = fact.object === "vocabulary" || fact.object === "kana_vocabulary";
  const componentIds = isVocabulary ? [...new Set(Array.from(fact.characters ?? "").flatMap((character) => kanjiByCharacter.has(character) ? [kanjiByCharacter.get(character)!] : []))] : radicalsByKanji.get(fact.id) ?? [];
  const slug = fact.slug ?? (fact.object === "radical" ? fact.meanings[0].toLowerCase() : fact.characters!);
  return resource(fact.id, fact.object, "subjects", {
    level: fact.level, lesson_position: fact.id, spaced_repetition_system_id: 1,
    created_at: EPOCH, slug,
    document_url: fact.sourceUrl ?? `https://www.wanikani.com/${fact.object === "radical" ? "radicals" : fact.object}/${encodeURIComponent(slug)}`,
    hidden_at: null, characters: fact.characters, character_images: fact.characterImages ?? [],
    meanings: fact.meanings.map((meaning, index) => ({ meaning, primary: index === 0, accepted_answer: true })),
    auxiliary_meanings: [], readings,
    component_subject_ids: componentIds, amalgamation_subject_ids: [],
    visually_similar_subject_ids: (fact.similarCharacters ?? []).flatMap((character) => kanjiByCharacter.has(character) ? [kanjiByCharacter.get(character)!] : []),
    context_sentences: fact.context ? [fact.context] : [],
    pronunciation_audios: (fact.audio ?? []).map((url, index) => ({
      url, content_type: "audio/mpeg", metadata: {
        gender: index === 0 ? "female" : "male", source_id: fact.id,
        pronunciation: readings.find((reading) => reading.primary)?.reading ?? "",
        voice_actor_id: index === 0 ? 1 : 2, voice_actor_name: index === 0 ? "Kyoko" : "Kenichi", voice_description: "Tokyo accent",
      },
    })),
    parts_of_speech: [],
  });
});
const subjectsById = new Map(DEMO_SUBJECTS.map((subject) => [subject.id, subject]));
for (const subject of DEMO_SUBJECTS) {
  for (const componentId of subject.data.component_subject_ids ?? []) subjectsById.get(componentId)?.data.amalgamation_subject_ids?.push(subject.id);
}

interface DemoState {
  version: 1;
  createdAt: number;
  assignments: Record<number, Assignment>;
  materials: Record<number, StudyMaterial>;
  reviews: ReviewCreateResponse[];
}
let volatileState: DemoState | null = null;

export function resetDemoWaniKani() {
  volatileState = null;
  try { if (typeof window !== "undefined") window.localStorage.removeItem(DEMO_WANIKANI_STORAGE_KEY); } catch { /* In-memory reset still succeeds. */ }
}

function readState(): DemoState {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DEMO_WANIKANI_STORAGE_KEY) : null;
    const value = raw ? JSON.parse(raw) as Partial<DemoState> : null;
    if (value?.version === 1 && typeof value.createdAt === "number" && value.assignments && value.materials && Array.isArray(value.reviews)) return value as DemoState;
  } catch { /* A demo remains usable when browser storage is unavailable. */ }
  if (!volatileState) saveState({ version: 1, createdAt: Date.now(), assignments: {}, materials: {}, reviews: [] });
  return volatileState!;
}

function saveState(state: DemoState) {
  volatileState = state;
  try { if (typeof window !== "undefined") window.localStorage.setItem(DEMO_WANIKANI_STORAGE_KEY, JSON.stringify(state)); } catch { /* Keep this visit's progress in memory. */ }
}

function iso(timestamp: number) { return new Date(timestamp).toISOString(); }

// Independent, repeatable samples keep the fictional account consistent across
// requests and reloads, without making neighboring subjects look identical.
function sample(id: number, salt: number) {
  let value = Math.imul(id ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

const CURRENT_LEVEL_DAYS = 6.4;
const LEVEL_DAYS = Array.from({ length: 20 }, (_, index) => {
  const level = index + 1;
  const breakDays = [7, 13, 18].includes(level) ? 7 + sample(level, 37) * 6 : 0;
  return Math.round((7.5 + sample(level, 19) * 7 + breakDays) * 10) / 10;
});
const LEVEL_AGES = Array.from({ length: 21 }, (_, index) => CURRENT_LEVEL_DAYS + LEVEL_DAYS.slice(index).reduce((total, days) => total + days, 0));

function levelStartedAt(level: number, now: number) {
  return now - LEVEL_AGES[level - 1] * DAY;
}

function levelProgressions(now: number): LevelProgression[] {
  return LEVEL_AGES.map((_, index) => {
    const started = iso(levelStartedAt(index + 1, now));
    const passed = index === 20 ? null : iso(levelStartedAt(index + 2, now));
    return resource(index + 1, "level_progression", "level_progressions", {
      level: index + 1, created_at: started, started_at: started, unlocked_at: started,
      passed_at: passed, completed_at: passed, abandoned_at: null,
    });
  });
}

function initialAssignment(subject: Subject, now: number): Assignment {
  const level = subject.data.level;
  const age = LEVEL_AGES[level - 1];
  const isVocabulary = subject.object === "vocabulary" || subject.object === "kana_vocabulary";
  const roll = sample(subject.id, subject.object === "radical" ? 127 : 41);
  const maxStage = age > 180 ? 9 : age > 60 ? 8 : age > 30 ? 7 : age > 14 ? 6 : 5;
  const currentStages = subject.object === "radical" ? [3, 4, 5, 5, 5]
    : isVocabulary ? [0, 0, 0, 1, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 3, 4, 4, 4, 5, 5];
  const stage = level === 21 ? currentStages[Math.floor(roll * currentStages.length)]
    : isVocabulary && roll < (level >= 18 ? 0.45 : 0.13) ? 1 + Math.floor(sample(subject.id, 43) * 4)
      : Math.min(maxStage, 5 + Math.floor(Math.sqrt(roll) * (maxStage - 4)));
  const unlocked = levelStartedAt(level, now) + (isVocabulary ? sample(subject.id, 47) * 2 * DAY : 0);
  const started = stage === 0 ? null : level === 21 && stage <= 3
    ? Math.max(unlocked, now - ([0, 4, 12, 36][stage] + sample(subject.id, 53) * 12) * HOUR)
    : unlocked + sample(subject.id, 53) * DAY;
  const passed = started !== null && stage >= 5 ? Math.min(now - HOUR, started + (3.5 + sample(subject.id, 59) * (level === 21 ? 0.7 : 3)) * DAY) : null;
  const burned = stage === 9 && started !== null ? started + (170 + sample(subject.id, 71) * Math.max(0, age - 175)) * DAY : null;
  const overdue = sample(subject.id, 61) < 0.045;
  const intervalHours = [0, 4, 8, 23, 47, 167, 335, 719, 2879][stage] ?? 0;
  const due = stage === 0 || stage === 9 ? null : iso(now + (overdue ? -(0.25 + sample(subject.id, 67) * 8) : 0.5 + sample(subject.id, 67) * intervalHours) * HOUR);
  return resource(subject.id + 100_000, "assignment", "assignments", {
    subject_id: subject.id, subject_type: subject.object, srs_stage: stage,
    available_at: due, started_at: started === null ? null : iso(started),
    unlocked_at: iso(unlocked), passed_at: passed === null ? null : iso(passed),
    burned_at: burned === null ? null : iso(burned),
    resurrected_at: null, hidden: false, created_at: iso(unlocked),
  }, iso(Math.max(unlocked, started ?? 0, passed ?? 0, burned ?? 0)));
}

function assignmentsFor(state: DemoState) {
  return DEMO_SUBJECTS.map((subject) => state.assignments[subject.id + 100_000] ?? initialAssignment(subject, state.createdAt));
}

function statisticsFor(state: DemoState): ReviewStatistic[] {
  return assignmentsFor(state).filter((assignment) => assignment.data.srs_stage > 0).flatMap((assignment) => {
    const id = assignment.data.subject_id;
    // Historical answer totals must not shrink when a visitor misses a review
    // and the live assignment moves down a stage.
    const initial = initialAssignment(subjectsById.get(id)!, state.createdAt);
    const stage = initial.data.srs_stage;
    const reviews = state.reviews.filter((review) => review.data.subject_id === id);
    if (stage === 0 && reviews.length === 0) return [];
    const correct = stage === 0 ? 0 : Math.max(1, stage - 1) + Math.floor(sample(id, 73) * stage * 5);
    const incorrect = stage === 0 ? 0 : sample(id, 79) < 0.12 ? 5 + Math.floor(sample(id, 83) * 10) : Math.floor(sample(id, 83) * 4);
    const hasReading = assignment.data.subject_type !== "radical";
    const initialReadingCorrect = stage === 0 || !hasReading ? 0 : Math.max(1, correct - Math.floor(sample(id, 89) * 4));
    const meaningIncorrect = incorrect + reviews.reduce((total, review) => total + review.data.incorrect_meaning_answers, 0);
    const readingIncorrect = hasReading ? incorrect + reviews.reduce((total, review) => total + review.data.incorrect_reading_answers, 0) : 0;
    const meaningCorrect = correct + reviews.length;
    const readingCorrect = hasReading ? initialReadingCorrect + reviews.length : 0;
    let meaningMaxStreak = Math.min(correct, 2 + Math.floor(sample(id, 97) * 24));
    let readingMaxStreak = Math.min(initialReadingCorrect, 2 + Math.floor(sample(id, 101) * 20));
    let meaningCurrentStreak = Math.floor(sample(id, 103) * (meaningMaxStreak + 1));
    let readingCurrentStreak = Math.floor(sample(id, 107) * (readingMaxStreak + 1));
    for (const review of reviews) {
      meaningCurrentStreak = review.data.incorrect_meaning_answers > 0 ? 0 : meaningCurrentStreak + 1;
      readingCurrentStreak = !hasReading || review.data.incorrect_reading_answers > 0 ? 0 : readingCurrentStreak + 1;
      meaningMaxStreak = Math.max(meaningMaxStreak, meaningCurrentStreak);
      readingMaxStreak = Math.max(readingMaxStreak, readingCurrentStreak);
    }
    const lastReviewed = reviews.at(-1)?.data.created_at ?? initial.data.burned_at ?? iso(Math.max(
      Date.parse(assignment.data.started_at!),
      state.createdAt - sample(id, 113) * (stage <= 4 ? 3 : stage <= 6 ? 10 : 45) * DAY,
    ));
    return [resource(id + 200_000, "review_statistic", "review_statistics", {
      subject_id: id, subject_type: assignment.data.subject_type, meaning_correct: meaningCorrect,
      meaning_incorrect: meaningIncorrect, meaning_max_streak: meaningMaxStreak, meaning_current_streak: meaningCurrentStreak,
      reading_correct: readingCorrect,
      reading_incorrect: readingIncorrect, reading_max_streak: readingMaxStreak, reading_current_streak: readingCurrentStreak,
      percentage_correct: Math.round((meaningCorrect + readingCorrect) / (meaningCorrect + readingCorrect + meaningIncorrect + readingIncorrect) * 100), hidden: false, created_at: assignment.data.started_at!,
    }, lastReviewed)];
  });
}

export function getDemoDataset(now = Date.now()) {
  const state = readState();
  if (!state.createdAt) state.createdAt = now;
  return { subjects: structuredClone(DEMO_SUBJECTS), assignments: assignmentsFor(state) };
}

function collection<T>(path: string, data: T[]): WKCollection<T> {
  return { object: "collection", url: `/api/wanikani/${path}`, data_updated_at: EPOCH, pages: { next_url: null, previous_url: null, per_page: data.length }, total_count: data.length, data };
}

function filterCollection<T extends WKResource<object>>(records: T[], params: URLSearchParams, now: number): T[] {
  const includes = (key: string, value: string | number | undefined) => !params.has(key) || params.get(key)!.split(",").includes(String(value));
  return records.filter((record) => {
    const data = record.data as Partial<AssignmentData & { level: number; slug: string; hidden_at: string | null }>;
    if (!includes("ids", record.id) || !includes("types", record.object) || !includes("levels", data.level)
      || !includes("slugs", data.slug) || !includes("subject_ids", data.subject_id)
      || !includes("subject_types", data.subject_type) || !includes("srs_stages", data.srs_stage)) return false;
    if (params.has("hidden") && (data.hidden === true || Boolean(data.hidden_at)) !== (params.get("hidden") === "true")) return false;
    if (params.get("immediately_available_for_review") === "true" && (!data.started_at || !data.available_at || data.srs_stage === 9 || Date.parse(data.available_at) > now)) return false;
    if (params.get("immediately_available_for_lessons") === "true" && (!data.unlocked_at || data.started_at || data.srs_stage !== 0)) return false;
    if (params.has("started") && Boolean(data.started_at) !== (params.get("started") === "true")) return false;
    if (params.has("unlocked") && Boolean(data.unlocked_at) !== (params.get("unlocked") === "true")) return false;
    if (params.has("burned") && Boolean(data.burned_at) !== (params.get("burned") === "true")) return false;
    if (params.has("available_before") && (!data.available_at || Date.parse(data.available_at) > Date.parse(params.get("available_before")!))) return false;
    if (params.has("available_after") && (!data.available_at || Date.parse(data.available_at) < Date.parse(params.get("available_after")!))) return false;
    if (params.has("updated_after") && Date.parse(record.data_updated_at) <= Date.parse(params.get("updated_after")!)) return false;
    return !params.has("page_after_id") || record.id > Number(params.get("page_after_id"));
  });
}

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { name: "WaniKaniApiError", status });
}

function assignmentById(state: DemoState, id: number) {
  const subject = subjectsById.get(id - 100_000);
  if (!subject) fail("This demo assignment does not exist.", 404);
  return state.assignments[id] ?? initialAssignment(subject, state.createdAt);
}

/** Resolves every demo WaniKani request locally; never forwards unknown endpoints. */
export async function demoWaniKaniRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
  const cleanPath = path.replace(/^https:\/\/api\.wanikani\.com\/v2\//, "").replace(/^\/?api\/wanikani\//, "").replace(/^\//, "");
  const url = new URL(cleanPath, "https://demo.invalid/");
  const [endpoint, rawId, action] = url.pathname.slice(1).split("/");
  const id = rawId ? Number(rawId) : null;
  const method = options.method?.toUpperCase() ?? "GET";
  const state = readState();
  const now = Date.now();
  let result: unknown;

  if (method === "GET") {
    let records: Array<WKResource<object>> | undefined;
    if (endpoint === "user") result = { ...DEMO_USER, data: { ...DEMO_USER.data, started_at: iso(levelStartedAt(1, state.createdAt)) } };
    else if (endpoint === "subjects") records = DEMO_SUBJECTS;
    else if (endpoint === "assignments") records = assignmentsFor(state);
    else if (endpoint === "review_statistics") records = statisticsFor(state);
    else if (endpoint === "study_materials") records = Object.values(state.materials);
    else if (endpoint === "reviews") records = state.reviews;
    else if (endpoint === "resets") records = [];
    else if (endpoint === "level_progressions") records = levelProgressions(state.createdAt);
    else if (endpoint === "summary") {
      const assignments = assignmentsFor(state);
      const lessons = assignments.filter((item) => item.data.srs_stage === 0 && item.data.unlocked_at).map((item) => item.data.subject_id);
      const reviewGroups = new Map<string, number[]>();
      for (const assignment of assignments) {
        if (!assignment.data.available_at || assignment.data.srs_stage === 9) continue;
        const available = iso(Math.max(Math.floor(now / HOUR) * HOUR, Math.floor(Date.parse(assignment.data.available_at) / HOUR) * HOUR));
        reviewGroups.set(available, [...reviewGroups.get(available) ?? [], assignment.data.subject_id]);
      }
      const reviews = [...reviewGroups].sort(([left], [right]) => left.localeCompare(right)).map(([available_at, subject_ids]) => ({ available_at, subject_ids }));
      result = { object: "report", url: "/api/wanikani/summary", data_updated_at: iso(now), data: { lessons: [{ available_at: iso(now), subject_ids: lessons }], reviews, next_reviews_at: reviews[0]?.available_at ?? null } } satisfies WKSummary;
    }
    if (records) {
      result = id === null ? collection(cleanPath, filterCollection(records, url.searchParams, now)) : records.find((record) => record.id === id);
      if (!result) fail("This demo item does not exist.", 404);
    }
  } else if (endpoint === "assignments" && id !== null && action === "start" && method === "PUT") {
    const assignment = assignmentById(state, id);
    if (assignment.data.srs_stage !== 0) return structuredClone(assignment) as T;
    const timestamp = iso(now);
    result = { ...assignment, data_updated_at: timestamp, data: { ...assignment.data, started_at: timestamp, srs_stage: 1, available_at: iso(now + 4 * HOUR) } } satisfies Assignment;
    state.assignments[id] = result as Assignment;
    saveState(state);
  } else if (endpoint === "reviews" && method === "POST") {
    const body = options.body as { review?: { assignment_id?: number; incorrect_meaning_answers?: number; incorrect_reading_answers?: number; created_at?: string } } | undefined;
    const input = body?.review;
    if (!input?.assignment_id) fail("Choose a demo assignment to review.");
    const assignment = assignmentById(state, input.assignment_id);
    const startingStage = assignment.data.srs_stage;
    if (startingStage < 1 || startingStage >= 9) fail("This demo assignment is not reviewable.");
    const incorrectMeaning = Math.max(0, Math.trunc(input.incorrect_meaning_answers ?? 0));
    const incorrectReading = Math.max(0, Math.trunc(input.incorrect_reading_answers ?? 0));
    const endingStage = incorrectMeaning + incorrectReading > 0 ? Math.max(1, startingStage - 1) : Math.min(9, startingStage + 1);
    const timestamp = iso(now);
    const next: Assignment = { ...assignment, data_updated_at: timestamp, data: {
      ...assignment.data, srs_stage: endingStage,
      available_at: endingStage === 9 ? null : iso(now + ([0, 4, 8, 23, 47, 167, 335, 719, 2879][endingStage] ?? 4) * HOUR),
      passed_at: endingStage >= 5 ? assignment.data.passed_at ?? timestamp : assignment.data.passed_at,
      burned_at: endingStage === 9 ? timestamp : null,
    } };
    const review = resource(400_000 + state.reviews.length, "review", "reviews", {
      assignment_id: assignment.id, subject_id: assignment.data.subject_id, starting_srs_stage: startingStage,
      ending_srs_stage: endingStage, incorrect_meaning_answers: incorrectMeaning, incorrect_reading_answers: incorrectReading, created_at: timestamp,
    }, timestamp);
    state.assignments[assignment.id] = next;
    state.reviews.push(review);
    result = { ...review, resources_updated: { assignment: next, review_statistic: statisticsFor(state).find((item) => item.data.subject_id === assignment.data.subject_id) } } satisfies ReviewCreateResponse;
    saveState(state);
  } else if (endpoint === "study_materials" && (method === "PUT" || method === "POST")) {
    const input = (options.body as { study_material?: Partial<StudyMaterial["data"]> } | undefined)?.study_material;
    const existing = id === null ? undefined : state.materials[id];
    const subject = subjectsById.get(input?.subject_id ?? existing?.data.subject_id ?? 0);
    if (!subject) fail("Choose a demo subject before saving notes.");
    const materialId = existing?.id ?? subject.id + 300_000;
    const timestamp = iso(now);
    result = resource(materialId, "study_material", "study_materials", {
      subject_id: subject.id, subject_type: subject.object, meaning_synonyms: input?.meaning_synonyms ?? existing?.data.meaning_synonyms ?? [],
      meaning_note: input?.meaning_note === undefined ? existing?.data.meaning_note ?? null : input.meaning_note,
      reading_note: input?.reading_note === undefined ? existing?.data.reading_note ?? null : input.reading_note,
      hidden: false, created_at: existing?.data.created_at ?? timestamp,
    }, timestamp);
    state.materials[materialId] = result as StudyMaterial;
    saveState(state);
  }
  if (result === undefined) fail("This action is unavailable in the demo.", 404);
  return structuredClone(result) as T;
}
