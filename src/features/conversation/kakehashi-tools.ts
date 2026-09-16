import { z } from 'zod';

// WaniKani v2 read-only filters: https://docs.api.wanikani.com/20170710/
// Model arguments never select a URL, HTTP method, account or credential.
const API_BASE = 'https://api.wanikani.com/v2';
const ENDPOINTS = new Set(['user', 'summary', 'assignments', 'review_statistics', 'subjects']);
const MAX_PAGES = 3;
const MAX_ROWS = 1500;
const CALL_TIMEOUT_MS = 25_000;
const kindSchema = z.enum(['all', 'kanji', 'vocabulary']);
const levelsSchema = z.array(z.number().int().min(1).max(60)).max(5);
const limitSchema = z.number().int().min(1).max(30);
const subjectID = z.number().int().positive().max(1_000_000);
const argumentsSchemas = {
  get_kakehashi_learning_profile: z.object({}).strict(),
  get_kakehashi_study_items: z.object({ status: z.enum(['learned', 'due', 'weak']), kind: kindSchema, levels: levelsSchema, limit: limitSchema }).strict(),
  search_kakehashi_subjects: z.object({ query: z.string().trim().min(1).max(80), kind: kindSchema, levels: levelsSchema, limit: limitSchema }).strict(),
  get_kakehashi_subject_details: z.object({ ids: z.array(subjectID).min(1).max(20) }).strict(),
};
export type KakehashiToolName = keyof typeof argumentsSchemas;
type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type KakehashiToolResult = { [key: string]: JSONValue };
export type KakehashiAuthSnapshot = { accountId: string | null; token: string | null; authenticated: boolean };
export type KakehashiToolsDependencies = {
  getAuth: () => KakehashiAuthSnapshot;
  subscribeAuth: (listener: () => void) => () => void;
  request: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
};

const kindParameter = { type: 'string', enum: ['all', 'kanji', 'vocabulary'], description: 'Vocabulary includes kana-only vocabulary; all includes vocabulary and kanji, not radicals.' };
const levelsParameter = { type: 'array', items: { type: 'integer', minimum: 1, maximum: 60 }, maxItems: 5, description: 'Up to five WaniKani levels. Empty means all levels for study items, or the current and previous two levels for broad subject search.' };
const limitParameter = { type: 'integer', minimum: 1, maximum: 30 };
export const KakehashiToolDefinitions: readonly { type: 'function'; name: KakehashiToolName; strict: boolean; description: string; parameters: { type: 'object'; properties: Record<string, JSONValue>; required: string[]; additionalProperties: false } }[] = [
  { type: 'function' as const, name: 'get_kakehashi_learning_profile', strict: true, description: 'Read the signed-in Kakehashi learner’s current WaniKani level, started kanji/vocabulary counts and lesson/review summary. WaniKani progress is not a measure of speaking fluency. Requires no token argument.', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } },
  { type: 'function' as const, name: 'get_kakehashi_study_items', strict: true, description: 'Read real started (learned), currently due, or weak (less than 85% correct) WaniKani kanji/vocabulary for practice. Results are bounded samples, not a complete learning history; obey the returned coverage. Learned means lessons started, not mastery.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['learned', 'due', 'weak'] }, kind: kindParameter, levels: levelsParameter, limit: limitParameter }, required: ['status', 'kind', 'levels', 'limit'], additionalProperties: false } },
  { type: 'function' as const, name: 'search_kakehashi_subjects', strict: true, description: 'Find curriculum kanji/vocabulary by Japanese characters, reading or English meaning. Japanese text first tries exact WaniKani slug across all levels; broader matching scans up to five specified levels, defaulting to the learner’s current and previous two levels. A missing result does not mean a word is absent from WaniKani. Use subject details to see personal progress.', parameters: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 80 }, kind: kindParameter, levels: levelsParameter, limit: limitParameter }, required: ['query', 'kind', 'levels', 'limit'], additionalProperties: false } },
  { type: 'function' as const, name: 'get_kakehashi_subject_details', strict: true, description: 'Read up to twenty WaniKani subjects with meanings, readings, example sentences and the signed-in learner’s assignment and review statistics. This cannot change lessons, reviews, notes or account settings.', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 1_000_000 }, minItems: 1, maxItems: 20 } }, required: ['ids'], additionalProperties: false } },
];

function nativeDependencies(): KakehashiToolsDependencies {
  // Resolve lazily so injected tests never load stores, native services or credentials.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require('../../utils/store') as typeof import('../../utils/store');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fetchWaniKaniApi } = require('../../utils/api') as typeof import('../../utils/api');
  return {
    getAuth: () => { const state = useAuthStore.getState(); return { accountId: state.userData?.id ?? null, token: state.apiToken, authenticated: state.isAuthenticated }; },
    subscribeAuth: listener => useAuthStore.subscribe(listener),
    request: (url, init) => fetchWaniKaniApi(url, init),
  };
}
class ToolFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function aborted(): Error { const error = new Error('Learning request cancelled.'); error.name = 'AbortError'; return error; }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ToolFailure('invalid_response', 'WaniKani returned an unexpected response.');
  return value as Record<string, unknown>;
}
function rows(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.slice(0, MAX_ROWS).map(object) : []; }
function integer(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback; }
function text(value: unknown, max = 160): string { return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max) : ''; }
function date(value: unknown): string | null { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function kinds(kind: z.infer<typeof kindSchema>): string { return kind === 'kanji' ? 'kanji' : kind === 'vocabulary' ? 'vocabulary,kana_vocabulary' : 'kanji,vocabulary,kana_vocabulary'; }
function subjectAllowed(resource: Record<string, unknown>): boolean { return ['kanji', 'vocabulary', 'kana_vocabulary'].includes(String(resource.object)); }
function normalizedSubject(resource: Record<string, unknown>, detailed = false): KakehashiToolResult {
  const data = object(resource.data);
  const preferred = (list: unknown, key: string, max: number) => rows(list).sort((a, b) => Number(!!b.primary) - Number(!!a.primary)).map(item => text(item[key])).filter(Boolean).slice(0, max);
  const result: KakehashiToolResult = { id: integer(resource.id), kind: text(resource.object, 24), characters: text(data.characters ?? data.slug, 80), level: integer(data.level), meanings: preferred(data.meanings, 'meaning', 4), readings: preferred(data.readings, 'reading', 6) };
  if (detailed) {
    result.partsOfSpeech = Array.isArray(data.parts_of_speech) ? data.parts_of_speech.slice(0, 6).map(part => text(part, 40)) : [];
    result.examples = rows(data.context_sentences).slice(0, 2).map(sentence => ({ japanese: text(sentence.ja, 200), meaning: text(sentence.en, 240) }));
    result.componentSubjectIds = Array.isArray(data.component_subject_ids) ? data.component_subject_ids.filter(id => typeof id === 'number' && Number.isSafeInteger(id) && id > 0).slice(0, 20) as number[] : [];
  }
  return result;
}
function normalizeProgress(assignment?: Record<string, unknown>, statistic?: Record<string, unknown>): KakehashiToolResult {
  const a = assignment ? object(assignment.data) : undefined;
  const s = statistic ? object(statistic.data) : undefined;
  return {
    lessonStarted: !!a?.started_at, srsStage: a ? integer(a.srs_stage) : null,
    startedAt: date(a?.started_at), dueAt: date(a?.available_at), passedAt: date(a?.passed_at), burnedAt: date(a?.burned_at),
    accuracyPercent: s && typeof s.percentage_correct === 'number' ? Math.min(100, Math.max(0, s.percentage_correct)) : null,
    meaningMistakes: s ? integer(s.meaning_incorrect) : null, readingMistakes: s ? integer(s.reading_incorrect) : null,
  };
}
type Collection = { data: Record<string, unknown>[]; total: number; truncated: boolean; pages: number };
type Query = Record<string, string | number | boolean>;

/** Local read-only bridge. Neither tokens nor full API responses leave this module. */
export class KakehashiLearningTools {
  readonly definitions = KakehashiToolDefinitions;
  private readonly dependencies: KakehashiToolsDependencies;
  private readonly token: string | null;
  private readonly active = new Set<AbortController>();
  private invalidated = false;
  private unsubscribe: () => void;

  constructor(private readonly accountId: string, dependencies?: KakehashiToolsDependencies) {
    this.dependencies = dependencies ?? nativeDependencies();
    this.token = this.dependencies.getAuth().token;
    this.unsubscribe = this.dependencies.subscribeAuth(() => { if (!this.sameAccount()) this.dispose(); });
  }
  dispose(): void { this.invalidated = true; this.unsubscribe?.(); for (const controller of this.active) controller.abort(); this.active.clear(); }
  private sameAccount(): boolean { const auth = this.dependencies.getAuth(); return auth.authenticated && !!this.token && auth.token === this.token && auth.accountId === this.accountId; }
  private assertCurrent(signal: AbortSignal): void { if (signal.aborted || this.invalidated) throw aborted(); if (!this.sameAccount()) throw new ToolFailure('account_unavailable', 'Sign in to the same Kakehashi account to use learning context.'); }
  private now(): number { return this.dependencies.now?.() ?? Date.now(); }

  async execute(name: string, rawArguments: unknown, externalSignal?: AbortSignal): Promise<KakehashiToolResult> {
    if (externalSignal?.aborted || this.invalidated) throw aborted();
    if (!Object.prototype.hasOwnProperty.call(argumentsSchemas, name)) return { error: { code: 'unknown_tool', message: 'This learning tool is not available.' } };
    const controller = new AbortController();
    this.active.add(controller);
    const forwardAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, CALL_TIMEOUT_MS);
    try {
      this.assertCurrent(controller.signal);
      let args: unknown = rawArguments;
      if (typeof args === 'string') { if (args.length > 4096) throw new ToolFailure('invalid_arguments', 'The learning tool arguments are invalid.'); try { args = JSON.parse(args); } catch { throw new ToolFailure('invalid_arguments', 'The learning tool arguments are invalid.'); } }
      const parsed = argumentsSchemas[name as KakehashiToolName].safeParse(args);
      if (!parsed.success) throw new ToolFailure('invalid_arguments', 'The learning tool arguments are invalid.');
      // Validate actual token ownership before exposing any account-specific data.
      const user = object((await this.get('user', {}, controller.signal)).data);
      if (user.id !== this.accountId) { this.dispose(); throw new ToolFailure('account_unavailable', 'The WaniKani account changed. Reopen conversation practice.'); }
      let result: KakehashiToolResult;
      if (name === 'get_kakehashi_learning_profile') result = await this.profile(user, controller.signal);
      else if (name === 'get_kakehashi_study_items') result = await this.study(argumentsSchemas.get_kakehashi_study_items.parse(parsed.data), controller.signal);
      else if (name === 'search_kakehashi_subjects') result = await this.search(argumentsSchemas.search_kakehashi_subjects.parse(parsed.data), integer(user.level, 1), controller.signal);
      else result = await this.details(argumentsSchemas.get_kakehashi_subject_details.parse(parsed.data).ids, controller.signal);
      this.assertCurrent(controller.signal);
      return { source: 'WaniKani via the signed-in Kakehashi account', retrievedAt: new Date(this.now()).toISOString(), ...result };
    } catch (error) {
      if (externalSignal?.aborted || this.invalidated) throw aborted();
      if (timedOut) return { error: { code: 'timeout', message: 'Learning information took too long to load. Try again later.' } };
      if (error instanceof ToolFailure) return { error: { code: error.code, message: error.message } };
      // Never return provider error bodies, URLs, headers or arbitrary exception text.
      return { error: { code: 'unavailable', message: 'Learning information could not be loaded. Try again later.' } };
    } finally { clearTimeout(timeout); externalSignal?.removeEventListener('abort', forwardAbort); this.active.delete(controller); }
  }

  private async get(endpoint: string, query: Query, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assertCurrent(signal);
    if (!ENDPOINTS.has(endpoint)) throw new ToolFailure('invalid_request', 'This learning request is not allowed.');
    const url = new URL(`${API_BASE}/${endpoint}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const operation = (async () => {
      const response = await this.dependencies.request(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${this.token}`, 'Wanikani-Revision': '20170710' }, signal, redirect: 'error' });
      this.assertCurrent(signal);
      if (!response.ok) {
        // Consume the body to release the shared transport's response deadline.
        await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) throw new ToolFailure('permission_denied', 'The signed-in WaniKani token cannot read this learning information.');
        if (response.status === 429) throw new ToolFailure('rate_limited', 'WaniKani is temporarily limiting requests. Try again later.');
        throw new ToolFailure('unavailable', 'WaniKani learning information is temporarily unavailable.');
      }
      const value: unknown = await response.json();
      this.assertCurrent(signal);
      return object(value);
    })();
    // The shared rate limiter may be waiting for a slot. Cancellation must still
    // return immediately; its eventual fetch also receives the aborted signal.
    return new Promise((resolve, reject) => {
      const cancel = () => reject(aborted());
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
    });
  }

  private async collection(endpoint: string, query: Query, signal: AbortSignal, maxPages = MAX_PAGES, maxRows = MAX_ROWS): Promise<Collection> {
    const result: Collection = { data: [], total: 0, truncated: false, pages: 0 };
    let cursor: string | undefined;
    const seen = new Set<string>();
    while (result.pages < maxPages && result.data.length < maxRows) {
      const response = await this.get(endpoint, { ...query, ...(cursor ? { page_after_id: cursor } : {}) }, signal);
      if (!Array.isArray(response.data) || response.data.length > 1000) throw new ToolFailure('invalid_response', 'WaniKani returned an unexpected collection.');
      const batch = rows(response.data);
      result.total = integer(response.total_count, batch.length);
      result.pages++;
      result.data.push(...batch.slice(0, maxRows - result.data.length));
      const next = response.pages && object(response.pages).next_url;
      result.truncated = !!next || result.data.length < result.total;
      if (!next) break;
      const nextURL = new URL(String(next));
      if (nextURL.origin !== new URL(API_BASE).origin || nextURL.pathname !== `/v2/${endpoint}` || nextURL.username || nextURL.password || nextURL.hash) throw new ToolFailure('invalid_response', 'WaniKani returned an unexpected pagination link.');
      const nextCursor = nextURL.searchParams.get('page_after_id');
      if (!nextCursor || !/^\d{1,12}$/.test(nextCursor) || seen.has(nextCursor)) throw new ToolFailure('invalid_response', 'WaniKani returned an unexpected pagination cursor.');
      // Carry only the numeric cursor. Filters remain those built locally above.
      seen.add(nextCursor); cursor = nextCursor;
    }
    return result;
  }

  private async profile(user: Record<string, unknown>, signal: AbortSignal): Promise<KakehashiToolResult> {
    const summary = object((await this.get('summary', {}, signal)).data);
    const kanji = await this.collection('assignments', { started: true, hidden: false, subject_types: 'kanji' }, signal, 1, 1);
    const vocabulary = await this.collection('assignments', { started: true, hidden: false, subject_types: 'vocabulary,kana_vocabulary' }, signal, 1, 1);
    const count = (value: unknown, dueOnly: boolean) => new Set(rows(value).filter(bucket => !dueOnly || (date(bucket.available_at) !== null && Date.parse(String(bucket.available_at)) <= this.now())).flatMap(bucket => Array.isArray(bucket.subject_ids) ? bucket.subject_ids.filter(id => typeof id === 'number' && Number.isSafeInteger(id)) : [])).size;
    return { level: integer(user.level), vacationMode: !!user.current_vacation_started_at, lessonsAvailable: count(summary.lessons, true), reviewsDue: count(summary.reviews, true), reviewsInNext24Hours: count(summary.reviews, false), nextReviewsAt: date(summary.next_reviews_at), startedKanji: kanji.total, startedVocabulary: vocabulary.total, interpretation: 'Started means lessons begun. WaniKani level and SRS progress do not establish conversational fluency.' };
  }

  private async subjectMap(ids: number[], signal: AbortSignal, detailed = false): Promise<Map<number, KakehashiToolResult>> {
    if (!ids.length) return new Map();
    const response = await this.collection('subjects', { ids: [...new Set(ids)].join(','), hidden: false }, signal, 1, 30);
    return new Map(response.data.filter(subjectAllowed).map(item => [integer(item.id), normalizedSubject(item, detailed)]));
  }
  private async study(args: z.infer<typeof argumentsSchemas.get_kakehashi_study_items>, signal: AbortSignal): Promise<KakehashiToolResult> {
    const query: Query = { hidden: false, subject_types: kinds(args.kind) };
    let sample: Collection;
    if (args.status === 'weak') {
      sample = await this.collection('review_statistics', { ...query, percentages_less_than: 85 }, signal);
      sample.data = sample.data.filter(item => { const data = object(item.data); return !data.hidden && typeof data.percentage_correct === 'number' && data.percentage_correct < 85; }).sort((a, b) => Number(object(a.data).percentage_correct) - Number(object(b.data).percentage_correct));
    } else {
      if (args.levels.length) query.levels = [...new Set(args.levels)].join(',');
      query.started = true;
      if (args.status === 'due') query.immediately_available_for_review = true;
      sample = await this.collection('assignments', query, signal);
      sample.data = sample.data.filter(item => { const data = object(item.data); return !data.hidden && !!data.started_at && (args.status !== 'due' || (!data.burned_at && date(data.available_at) !== null && Date.parse(String(data.available_at)) <= this.now())); }).sort((a, b) => args.status === 'due' ? String(object(a.data).available_at).localeCompare(String(object(b.data).available_at)) : String(object(b.data).started_at).localeCompare(String(object(a.data).started_at)));
    }
    // Review-statistics has no level filter, so weak items are joined to subjects
    // in bounded batches before level filtering instead of sending an unsupported filter.
    const selected: { record: Record<string, unknown>; subject: KakehashiToolResult }[] = [];
    for (let offset = 0; offset < Math.min(sample.data.length, args.levels.length && args.status === 'weak' ? 90 : args.limit); offset += 30) {
      const records = sample.data.slice(offset, offset + Math.min(30, args.levels.length && args.status === 'weak' ? 30 : args.limit - offset));
      const subjects = await this.subjectMap(records.map(item => integer(object(item.data).subject_id)), signal);
      for (const record of records) { const subject = subjects.get(integer(object(record.data).subject_id)); if (subject && (!args.levels.length || args.levels.includes(Number(subject.level)))) selected.push({ record, subject }); }
      if (selected.length >= args.limit) break;
    }
    const chosen = selected.slice(0, args.limit);
    let assignments = new Map<number, Record<string, unknown>>();
    if (args.status === 'weak' && chosen.length) { const response = await this.collection('assignments', { subject_ids: chosen.map(item => item.subject.id).join(','), hidden: false }, signal, 1, 30); assignments = new Map(response.data.map(item => [integer(object(item.data).subject_id), item])); }
    return { status: args.status, levels: args.levels, items: chosen.map(({ record, subject }) => ({ ...subject, progress: args.status === 'weak' ? normalizeProgress(assignments.get(Number(subject.id)), record) : normalizeProgress(record) })), totalMatchingApiFilter: sample.total, coverage: { fetchedRecords: sample.data.length, pages: sample.pages, boundedSample: sample.truncated || chosen.length < sample.data.length, weakLevelFilterAppliedAfterSampling: args.status === 'weak' && args.levels.length > 0 }, selection: args.status === 'weak' ? 'Lowest accuracy among fetched records; fewer results may be returned when filtering levels.' : args.status === 'due' ? 'Earliest due among fetched records.' : 'Most recently started among fetched records. Started does not mean mastered.' };
  }

  private async search(args: z.infer<typeof argumentsSchemas.search_kakehashi_subjects>, level: number, signal: AbortSignal): Promise<KakehashiToolResult> {
    const levels = args.levels.length ? [...new Set(args.levels)] : [Math.max(1, level - 2), Math.max(1, level - 1), Math.max(1, level)].filter((value, index, all) => all.indexOf(value) === index);
    if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(args.query) && !args.query.includes(',')) {
      const exact = await this.collection('subjects', { slugs: args.query, types: kinds(args.kind), hidden: false, ...(args.levels.length ? { levels: levels.join(',') } : {}) }, signal, 1, 30);
      const found = exact.data.filter(subjectAllowed).map(item => normalizedSubject(item));
      if (found.length) return { items: found.slice(0, args.limit), searchScope: 'Exact Japanese slug', levels: args.levels, boundedSample: exact.truncated || found.length > args.limit };
    }
    const candidates = await this.collection('subjects', { types: kinds(args.kind), levels: levels.join(','), hidden: false }, signal);
    const query = args.query.normalize('NFKC').toLocaleLowerCase();
    const found = candidates.data.filter(subjectAllowed).map(item => normalizedSubject(item)).filter(item => [item.characters, ...(item.meanings as string[]), ...(item.readings as string[])].some(value => String(value).normalize('NFKC').toLocaleLowerCase().includes(query)));
    return { items: found.slice(0, args.limit), searchScope: 'Substring search within selected levels only', levels, boundedSample: candidates.truncated || found.length > args.limit, scannedSubjects: candidates.data.length, matchesInSample: found.length };
  }
  private async details(ids: number[], signal: AbortSignal): Promise<KakehashiToolResult> {
    const unique = [...new Set(ids)];
    const subjects = await this.subjectMap(unique, signal, true);
    const assignments = await this.collection('assignments', { subject_ids: unique.join(','), hidden: false }, signal, 1, 30);
    const stats = await this.collection('review_statistics', { subject_ids: unique.join(','), hidden: false }, signal, 1, 30);
    const a = new Map(assignments.data.map(item => [integer(object(item.data).subject_id), item]));
    const s = new Map(stats.data.map(item => [integer(object(item.data).subject_id), item]));
    return { items: unique.filter(id => subjects.has(id)).map(id => ({ ...subjects.get(id)!, progress: normalizeProgress(a.get(id), s.get(id)) })), unavailableSubjectIds: unique.filter(id => !subjects.has(id)) };
  }
}
