import { KakehashiLearningTools } from '../kakehashi-tools';
import { emptyKakehashiContext, loadKakehashiContext } from '../learning-context';

const word = (id = 1) => ({ id, kind: 'vocabulary', characters: `言葉${id}`, readings: ['ことば'], meanings: ['word'], level: 4, progress: { lessonStarted: true } });
const success = { status: 'learned', items: [word()] };
const response = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('guaranteed WaniKani practice context', () => {
  afterEach(() => jest.useRealTimers());

  it('starts no work for an already-aborted session', async () => {
    const controller = new AbortController(); controller.abort();
    const execute = jest.fn();
    await expect(loadKakehashiContext({ execute }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(execute).not.toHaveBeenCalled();
    expect(emptyKakehashiContext().status).toBe('idle');
    expect(emptyKakehashiContext('loading').words).toEqual([]);
  });

  it('uses the real identity-checked adapter for two fixed reads and returns only normalized study evidence', async () => {
    const accountId = 'test-account', token = 'wk-test-only-secret';
    const privateMarker = 'private-data-must-not-leave-adapter';
    const request = jest.fn(async (input: string, _init: RequestInit) => {
      const url = new URL(input);
      if (url.pathname === '/v2/user') return response({ data: { id: accountId, level: 21, username: privateMarker, subscription: privateMarker } });
      if (url.pathname === '/v2/summary') return response({ data: { lessons: [], reviews: [] } });
      if (url.pathname === '/v2/assignments') return response({
        data: Array.from({ length: 8 }, (_, index) => ({ id: index + 101, data: { subject_id: index + 1, started_at: '2026-09-01T00:00:00Z', srs_stage: 4 } })),
        total_count: 8, pages: { next_url: null },
      });
      if (url.pathname === '/v2/subjects') return response({
        data: Array.from({ length: 8 }, (_, index) => ({ id: index + 1, object: index ? 'vocabulary' : 'kana_vocabulary', data: { characters: `言葉${index + 1}`, level: 4, readings: [{ reading: 'ことば', primary: true }], meanings: [{ meaning: 'word', primary: true }], unrelated: privateMarker } })),
        total_count: 8, pages: { next_url: null },
      });
      throw new Error('Unexpected endpoint');
    });
    const adapter = new KakehashiLearningTools(accountId, { getAuth: () => ({ accountId, token, authenticated: true }), subscribeAuth: () => () => {}, request });
    try {
      const context = await loadKakehashiContext(adapter);
      expect(context.status).toBe('loaded');
      expect(context.level).toBe(21);
      expect(context.words).toHaveLength(8);
      expect(context.words[0]).toEqual({ id: 1, characters: '言葉1', readings: ['ことば'], meanings: ['word'], level: 4 });
      expect(context.prompt).toContain('studiedVocabulary');
      expect(context.prompt).toContain('not a complete history or proof of mastery');
      expect(context.retrievedAt).not.toBeNull();
      for (const value of [token, privateMarker, accountId, 'srsStage']) expect(JSON.stringify(context)).not.toContain(value);
      expect(request).toHaveBeenCalledTimes(7);
      const urls = request.mock.calls.map(([input]) => new URL(input));
      expect(urls.filter(url => url.pathname === '/v2/subjects')).toHaveLength(1);
      expect(urls.find(url => url.pathname === '/v2/subjects')?.searchParams.get('ids')?.split(',')).toHaveLength(8);
      for (const [, init] of request.mock.calls) expect(init).toMatchObject({ method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    } finally { adapter.dispose(); }
  });

  it('retains actual level when vocabulary fails and never repeats provider error details', async () => {
    const execute = jest.fn(async (name: string) => name === 'get_kakehashi_learning_profile' ? { level: 12, secret: 'private' } : { error: { code: 'unavailable', message: 'sk-sensitive-in-provider-body' } });
    const context = await loadKakehashiContext({ execute });
    expect(context).toMatchObject({ status: 'partial', level: 12, words: [] });
    expect(context.prompt).toContain('No studied vocabulary was returned');
    expect(JSON.stringify(context)).not.toMatch(/sk-sensitive|private/);
    expect(execute).toHaveBeenCalledWith('get_kakehashi_study_items', { status: 'learned', kind: 'vocabulary', levels: [], limit: 8 }, expect.any(AbortSignal));
  });

  it('retains verified words when the profile is unavailable, without claiming a level', async () => {
    const execute = jest.fn(async (name: string) => name === 'get_kakehashi_learning_profile' ? { error: { code: 'timeout' } } : success);
    expect(await loadKakehashiContext({ execute })).toMatchObject({ status: 'partial', level: null, words: [{ characters: '言葉1' }] });
  });

  it('distinguishes successful empty vocabulary from a failed read', async () => {
    const execute = jest.fn(async (name: string) => name === 'get_kakehashi_learning_profile' ? { level: 1 } : { status: 'learned', items: [] });
    const context = await loadKakehashiContext({ execute });
    expect(context).toMatchObject({ status: 'loaded', level: 1, words: [] });
    expect(context.message).toContain('No studied vocabulary was returned');
  });

  it('excludes unstarted items and non-vocabulary, deduplicates and caps selected words', async () => {
    const items = [word(1), word(1), { ...word(2), kind: 'kanji' }, { ...word(3), progress: { lessonStarted: false } }, ...Array.from({ length: 12 }, (_, i) => word(i + 4))];
    const execute = jest.fn(async (name: string) => name === 'get_kakehashi_learning_profile' ? { level: 10 } : { status: 'learned', items });
    const context = await loadKakehashiContext({ execute });
    expect(context.status).toBe('partial');
    expect(context.words).toHaveLength(8);
    expect(context.words.map(item => item.id)).toEqual([1, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('finishes by the whole-load deadline even if a transport ignores cancellation', async () => {
    jest.useFakeTimers();
    const signals: AbortSignal[] = [];
    const execute = jest.fn(async (name: string, _args: unknown, signal?: AbortSignal) => {
      signals.push(signal!);
      if (name === 'get_kakehashi_learning_profile') return { level: 7 };
      return new Promise(() => {});
    });
    const pending = loadKakehashiContext({ execute });
    await jest.advanceTimersByTimeAsync(8_000);
    expect(await pending).toMatchObject({ status: 'partial', level: 7, words: [] });
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('discards completed evidence on cancellation or identity invalidation', async () => {
    const controller = new AbortController();
    const execute = jest.fn(async (name: string) => name === 'get_kakehashi_learning_profile' ? { level: 7 } : new Promise(() => {}));
    const pending = loadKakehashiContext({ execute }, controller.signal);
    const expectation = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve(); controller.abort();
    await expectation;

    const invalidated = jest.fn(async (name: string) => {
      if (name === 'get_kakehashi_learning_profile') return { level: 7 };
      const error = new Error('Account changed'); error.name = 'AbortError'; throw error;
    });
    await expect(loadKakehashiContext({ execute: invalidated })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns safe unavailable context when both reads fail', async () => {
    const execute = jest.fn(async () => { throw new Error('Bearer private-token https://private.example'); });
    const context = await loadKakehashiContext({ execute });
    expect(context).toMatchObject({ status: 'unavailable', level: null, words: [], retrievedAt: null });
    expect(context.prompt).toContain('Continue ordinary Japanese practice');
    expect(JSON.stringify(context)).not.toMatch(/private|Bearer|https/);
  });
});
