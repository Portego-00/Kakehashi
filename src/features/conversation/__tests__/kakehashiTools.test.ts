import { KakehashiLearningTools, KakehashiToolDefinitions, type KakehashiAuthSnapshot, type KakehashiToolsDependencies } from '../kakehashi-tools';

const NOW = Date.parse('2026-09-15T12:00:00Z');
const USER = { data: { id: 'account-a', level: 12, username: 'private-name', profile_url: 'private-profile', subscription: { period_ends_at: 'private-billing' }, current_vacation_started_at: null } };
function response(body: unknown, status = 200): Response { return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as Response; }
function collection(data: unknown[], total = data.length, next: string | null = null) { return { data, total_count: total, pages: { next_url: next, per_page: 500 } }; }
function subject(id: number, options: { characters?: string; meaning?: string; level?: number; kind?: string } = {}) { return { id, object: options.kind ?? 'vocabulary', data: { characters: options.characters ?? '料理', slug: options.characters ?? '料理', level: options.level ?? 12, meanings: [{ meaning: options.meaning ?? 'cooking', primary: true }], readings: [{ reading: 'りょうり', primary: true }], meaning_mnemonic: 'Not sent to the model', context_sentences: [{ ja: '料理をします。', en: 'I cook.' }], parts_of_speech: ['noun'], component_subject_ids: [10, 11], pronunciation_audios: [{ url: 'https://example.com/audio' }] } }; }
function assignment(subjectId: number, options: { stage?: number; due?: string; started?: string | null } = {}) { return { id: 1000 + subjectId, object: 'assignment', data: { subject_id: subjectId, subject_type: 'vocabulary', srs_stage: options.stage ?? 4, started_at: options.started === undefined ? '2026-09-10T00:00:00Z' : options.started, available_at: options.due ?? '2026-09-14T00:00:00Z', burned_at: null, passed_at: null, hidden: false } }; }
function statistic(subjectId: number, accuracy: number) { return { id: 2000 + subjectId, data: { subject_id: subjectId, percentage_correct: accuracy, meaning_incorrect: 3, reading_incorrect: 2, hidden: false } }; }
function harness(handler: (url: URL, init: RequestInit) => Response | Promise<Response> = () => response(collection([]))) {
  let auth: KakehashiAuthSnapshot = { accountId: 'account-a', token: 'test-token-only', authenticated: true };
  const listeners = new Set<() => void>();
  const request = jest.fn(async (url: string, init: RequestInit) => new URL(url).pathname.endsWith('/user') ? response(USER) : handler(new URL(url), init));
  const deps: KakehashiToolsDependencies = { getAuth: () => auth, subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); }, request, now: () => NOW };
  const tools = new KakehashiLearningTools('account-a', deps);
  return { tools, deps, request, switchAuth: (next: KakehashiAuthSnapshot) => { auth = next; listeners.forEach(listener => listener()); }, listeners };
}

describe('Kakehashi read-only learning tools', () => {
  it('exposes strict function definitions without credential, URL or mutation arguments', () => {
    expect(KakehashiToolDefinitions.map(tool => tool.name)).toEqual(['get_kakehashi_learning_profile', 'get_kakehashi_study_items', 'search_kakehashi_subjects', 'get_kakehashi_subject_details']);
    for (const tool of KakehashiToolDefinitions) { expect(tool.type).toBe('function'); expect(tool.strict).toBe(true); expect(tool.parameters.additionalProperties).toBe(false); expect(Object.keys(tool.parameters.properties)).not.toEqual(expect.arrayContaining(['token'])); }
  });

  it('reads fresh ownership/profile and correct due counts, returning no identity, billing or credential fields', async () => {
    const h = harness(url => url.pathname.endsWith('/summary') ? response({ data: { lessons: [{ available_at: '2026-09-15T00:00:00Z', subject_ids: [1, 2] }], reviews: [{ available_at: '2026-09-15T00:00:00Z', subject_ids: [5, 6] }, { available_at: '2026-09-15T13:00:00Z', subject_ids: [7] }], next_reviews_at: '2026-09-15T13:00:00Z' } }) : response(collection([assignment(1)], url.searchParams.get('subject_types') === 'kanji' ? 90 : 220)));
    const result = await h.tools.execute('get_kakehashi_learning_profile', {});
    expect(result).toMatchObject({ level: 12, lessonsAvailable: 2, reviewsDue: 2, reviewsInNext24Hours: 3, startedKanji: 90, startedVocabulary: 220 });
    const json = JSON.stringify(result);
    for (const privateValue of ['test-token-only', 'account-a', 'private-name', 'private-profile', 'private-billing']) expect(json).not.toContain(privateValue);
    expect(h.request).toHaveBeenCalledTimes(4);
    for (const [url, init] of h.request.mock.calls) { expect(new URL(url).origin).toBe('https://api.wanikani.com'); expect(init).toMatchObject({ method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer test-token-only', 'Wanikani-Revision': '20170710' } }); expect(init.body).toBeUndefined(); }
    h.tools.dispose();
  });

  it.each([
    ['get_kakehashi_study_items', { status: 'learned', kind: 'all', levels: [], limit: 1000 }],
    ['get_kakehashi_study_items', { status: 'learned', kind: 'all', levels: [61], limit: 20 }],
    ['get_kakehashi_subject_details', { ids: ['10'] }],
    ['get_kakehashi_subject_details', { ids: [10], token: 'arbitrary' }],
    ['get_kakehashi_learning_profile', { url: 'https://example.com' }],
    ['get_kakehashi_learning_profile', 'not JSON'],
    ['get_kakehashi_learning_profile', ' '.repeat(4097)],
  ])('rejects invalid model arguments before any network call: %s', async (name, args) => {
    const h = harness();
    expect(await h.tools.execute(name, args)).toMatchObject({ error: { code: 'invalid_arguments' } });
    expect(h.request).not.toHaveBeenCalled(); h.tools.dispose();
  });

  it('never dispatches unknown or inherited function names', async () => {
    const h = harness();
    for (const name of ['create_review', 'update_user', 'toString', '__proto__']) expect(await h.tools.execute(name, {})).toMatchObject({ error: { code: 'unknown_tool' } });
    expect(h.request).not.toHaveBeenCalled(); h.tools.dispose();
  });

  it('normalizes due assignments with meanings/readings and excludes future or unstarted entries', async () => {
    const h = harness(url => url.pathname.endsWith('/assignments') ? response(collection([assignment(1), assignment(2, { due: '2026-09-16T00:00:00Z' }), assignment(3, { started: null })])) : response(collection([subject(1)])));
    const result = await h.tools.execute('get_kakehashi_study_items', { status: 'due', kind: 'vocabulary', levels: [12], limit: 20 });
    expect(result.items).toEqual([expect.objectContaining({ id: 1, characters: '料理', meanings: ['cooking'], readings: ['りょうり'], progress: expect.objectContaining({ lessonStarted: true, srsStage: 4 }) })]);
    const url = new URL(h.request.mock.calls[1][0]);
    expect(url.searchParams.get('immediately_available_for_review')).toBe('true'); expect(url.searchParams.get('levels')).toBe('12'); expect(url.searchParams.get('subject_types')).toBe('vocabulary,kana_vocabulary');
    h.tools.dispose();
  });

  it('uses bounded pagination and marks learned history as a sample', async () => {
    const h = harness(url => {
      if (url.pathname.endsWith('/subjects')) return response(collection(url.searchParams.get('ids')!.split(',').map(id => subject(Number(id)))));
      const page = Number(url.searchParams.get('page_after_id') ?? '0');
      return response(collection(Array.from({ length: 500 }, (_, i) => assignment(page + i + 1)), 4000, `https://api.wanikani.com/v2/assignments?page_after_id=${page + 500}`));
    });
    const result = await h.tools.execute('get_kakehashi_study_items', { status: 'learned', kind: 'all', levels: [], limit: 3 });
    expect(result.items).toHaveLength(3); expect(result.coverage).toMatchObject({ fetchedRecords: 1500, pages: 3, boundedSample: true }); expect(result.totalMatchingApiFilter).toBe(4000);
    expect(h.request.mock.calls.filter(([url]) => url.includes('/assignments?'))).toHaveLength(3); h.tools.dispose();
  });

  it('does not follow an external pagination URL or leak credentials in its error', async () => {
    const h = harness(() => response(collection([assignment(1)], 100, 'https://attacker.example/assignments?page_after_id=99')));
    expect(await h.tools.execute('get_kakehashi_study_items', { status: 'learned', kind: 'all', levels: [], limit: 3 })).toMatchObject({ error: { code: 'invalid_response' } });
    expect(h.request).toHaveBeenCalledTimes(2); h.tools.dispose();
  });

  it('preserves local filters when a pagination link supplies unexpected parameters', async () => {
    const h = harness(url => {
      if (url.pathname.endsWith('/subjects')) return response(collection([subject(1), subject(2)]));
      if (url.searchParams.has('page_after_id')) return response(collection([assignment(2)], 2));
      return response(collection([assignment(1)], 2, 'https://api.wanikani.com/v2/assignments?page_after_id=2&subject_types=radical&hidden=true'));
    });
    await h.tools.execute('get_kakehashi_study_items', { status: 'learned', kind: 'kanji', levels: [], limit: 3 });
    const next = new URL(h.request.mock.calls[2][0]); expect(next.searchParams.get('subject_types')).toBe('kanji'); expect(next.searchParams.get('hidden')).toBe('false'); h.tools.dispose();
  });

  it('finds exact Japanese subjects and restricts broad meaning search to explicit/current levels', async () => {
    const h = harness(() => response(collection([subject(1)])));
    const exact = await h.tools.execute('search_kakehashi_subjects', { query: '料理', kind: 'all', levels: [], limit: 10 });
    expect(exact.searchScope).toBe('Exact Japanese slug'); expect(new URL(h.request.mock.calls[1][0]).searchParams.get('slugs')).toBe('料理');
    const broad = await h.tools.execute('search_kakehashi_subjects', { query: 'cook', kind: 'all', levels: [], limit: 10 });
    expect(broad).toMatchObject({ levels: [10, 11, 12], matchesInSample: 1, scannedSubjects: 1 });
    expect(new URL(h.request.mock.calls[3][0]).searchParams.get('levels')).toBe('10,11,12'); h.tools.dispose();
  });

  it('joins weak review statistics and assignments, and does not send unsupported level filters', async () => {
    const h = harness(url => url.pathname.endsWith('/review_statistics') ? response(collection([statistic(1, 80), statistic(2, 40), statistic(3, 100)])) : url.pathname.endsWith('/subjects') ? response(collection([subject(1), subject(2)])) : response(collection([assignment(1), assignment(2)])));
    const result = await h.tools.execute('get_kakehashi_study_items', { status: 'weak', kind: 'vocabulary', levels: [12], limit: 2 });
    expect(result.items).toEqual([expect.objectContaining({ id: 2, progress: expect.objectContaining({ accuracyPercent: 40, lessonStarted: true }) }), expect.objectContaining({ id: 1, progress: expect.objectContaining({ accuracyPercent: 80 }) })]);
    const url = new URL(h.request.mock.calls[1][0]); expect(url.searchParams.get('percentages_less_than')).toBe('85'); expect(url.searchParams.has('levels')).toBe(false); h.tools.dispose();
  });

  it('returns bounded details and personal progress while omitting mnemonics/audio/identifiers', async () => {
    const h = harness(url => url.pathname.endsWith('/subjects') ? response(collection([subject(1)])) : url.pathname.endsWith('/assignments') ? response(collection([assignment(1)])) : response(collection([statistic(1, 70)])));
    const result = await h.tools.execute('get_kakehashi_subject_details', { ids: [1, 1, 99] });
    expect(result.items).toEqual([expect.objectContaining({ id: 1, examples: [{ japanese: '料理をします。', meaning: 'I cook.' }], progress: expect.objectContaining({ accuracyPercent: 70 }) })]); expect(result.unavailableSubjectIds).toEqual([99]);
    expect(JSON.stringify(result)).not.toMatch(/mnemonic|pronunciation_audios|test-token-only|account-a/); h.tools.dispose();
  });

  it.each([401, 403, 429, 500])('returns safe errors for HTTP %s without forwarding response bodies', async status => {
    const h = harness(() => response({ error: 'sensitive test-token-only private diagnostics' }, status));
    const result = await h.tools.execute('get_kakehashi_learning_profile', {});
    expect(result.error).toBeDefined(); expect(JSON.stringify(result)).not.toMatch(/sensitive|test-token-only|private diagnostics/); h.tools.dispose();
  });

  it('rejects token ownership mismatch before fetching personal learning', async () => {
    const h = harness(); h.request.mockImplementationOnce(async () => response({ data: { ...USER.data, id: 'account-b' } }));
    await expect(h.tools.execute('get_kakehashi_learning_profile', {})).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.request).toHaveBeenCalledTimes(1); expect(h.listeners.size).toBe(0);
  });

  it('cancels immediately even when the transport ignores abort, and never returns stale data after account changes', async () => {
    let complete!: (value: Response) => void;
    const h = harness(() => new Promise(resolve => { complete = resolve; }));
    const pending = h.tools.execute('get_kakehashi_learning_profile', {});
    while (!complete) await Promise.resolve();
    const signal = h.request.mock.calls[1][1].signal!;
    h.switchAuth({ accountId: 'account-b', token: 'different-test-token', authenticated: true });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(signal.aborted).toBe(true);
    complete(response({ data: { lessons: [], reviews: [] } })); await Promise.resolve();
    h.switchAuth({ accountId: 'account-a', token: 'test-token-only', authenticated: true });
    await expect(h.tools.execute('get_kakehashi_learning_profile', {})).rejects.toMatchObject({ name: 'AbortError' }); expect(h.request).toHaveBeenCalledTimes(2);
  });

  it('accepts explicit cancellation without poisoning the reusable account adapter', async () => {
    const h = harness(); const signal = new AbortController(); signal.abort();
    await expect(h.tools.execute('get_kakehashi_learning_profile', {}, signal.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.request).not.toHaveBeenCalled();
    expect(await h.tools.execute('get_kakehashi_subject_details', { ids: [1] })).toMatchObject({ items: [] }); h.tools.dispose();
  });

  it('cancels an in-flight request and can execute another call on the same account', async () => {
    let complete!: (value: Response) => void;
    const h = harness(() => new Promise(resolve => { complete = resolve; }));
    const controller = new AbortController();
    const pending = h.tools.execute('get_kakehashi_learning_profile', {}, controller.signal);
    while (!complete) await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    complete(response({ data: { lessons: [], reviews: [] } }));
    h.request.mockImplementation(async url => new URL(url).pathname.endsWith('/user') ? response(USER) : response(collection([])));
    expect(await h.tools.execute('get_kakehashi_subject_details', { ids: [1] })).toMatchObject({ items: [] }); h.tools.dispose();
  });

  it('bounds waiting for a stalled transport with a safe timeout result', async () => {
    jest.useFakeTimers();
    const h = harness(() => new Promise(() => {}));
    try {
      const pending = h.tools.execute('get_kakehashi_learning_profile', {});
      await jest.advanceTimersByTimeAsync(25_001);
      expect(await pending).toMatchObject({ error: { code: 'timeout' } });
      expect(h.request.mock.calls[1][1].signal?.aborted).toBe(true);
    } finally { h.tools.dispose(); jest.useRealTimers(); }
  });

  it('does not request data when the authenticated store has no token', async () => {
    const h = harness();
    const tools = new KakehashiLearningTools('account-a', { ...h.deps, getAuth: () => ({ accountId: 'account-a', token: null, authenticated: true }) });
    expect(await tools.execute('get_kakehashi_learning_profile', {})).toMatchObject({ error: { code: 'account_unavailable' } });
    expect(h.request).not.toHaveBeenCalled(); tools.dispose(); h.tools.dispose();
  });
});
