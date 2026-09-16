import { ConversationController, AI_CONSENT_VERSION } from '../use-conversation';
import { createFragment, enqueueFinalAssessment, newArchive, newSession, nowSeconds } from '../model';
import type { Archive, FinalAssessmentTicket } from '../types';
import { abortError, type ConversationAPI, type JSONObject, type ResponseRequest } from '../api';
import type { LiveCallbacks, LiveConnectOptions, WebRTCLiveTransport } from '../live-transport-core';
import { saveLearningSnapshot } from '../storage';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
jest.mock('../live-transport', () => ({ createLiveTransport: jest.fn() }));
jest.mock('../credentials', () => ({ readKey: jest.fn(async () => 'sk-personal-key'), saveKey: jest.fn(), clearKey: jest.fn() }));
jest.mock('../storage', () => ({
  loadArchive: jest.fn(async () => mockArchive),
  loadFinalAssessmentTickets: jest.fn(async () => mockTickets),
  saveLearningSnapshot: jest.fn(async () => {}),
  exportArchive: (archive: Archive) => JSON.stringify(archive),
  importArchive: (archive: Archive, json: string) => ({ ...archive, sessions: [...archive.sessions, ...JSON.parse(json).sessions] }),
}));

let mockArchive: Archive;
let mockTickets: FinalAssessmentTicket[];
const result = (text: string) => ({ text, sources: [], usage: { input: 10, output: 5, searches: 0 } });
const assessment = () => result(JSON.stringify({ outcome: 'uncertain', suggestedLevel: 0, nextGoal: '', capability: '', words: [] }));
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup() {
  const respond = jest.fn(async (request: ResponseRequest) => request.schema ? assessment() : result('元気ですか？'));
  const api = { respond } as unknown as ConversationAPI;
  let callbacks!: LiveCallbacks;
  const transport = {
    started: false,
    connect: jest.fn(async (_api: ConversationAPI, _instructions: string, _options: LiveConnectOptions) => {
      callbacks.onEvent({ type: 'mural.session.created', session: { id: 'live_1' } });
      transport.started = true;
      callbacks.onEvent({ type: 'session.started', session: { id: 'live_1' } });
    }),
    send: jest.fn((_event: JSONObject) => true), mute: jest.fn(() => true), disconnect: jest.fn(),
    close: jest.fn(async () => { callbacks.onEvent({ type: 'session.closed', usage: { seconds: 37 }, reason: 'close_requested' }); return true; }),
  };
  const factory = jest.fn((value: LiveCallbacks) => { callbacks = value; return transport as unknown as WebRTCLiveTransport; });
  const execute = jest.fn(async (name: string, _args: unknown, _signal?: AbortSignal): Promise<unknown> => name === 'get_kakehashi_learning_profile'
    ? { level: 8 }
    : { status: 'learned', items: [{ id: 1001, kind: 'vocabulary', characters: '日本', readings: ['にほん'], meanings: ['Japan'], level: 2, progress: { lessonStarted: true } }] });
  const toolsetFactory = jest.fn(() => ({ definitions: [{ type: 'function', name: 'get_kakehashi_learning_profile' }], execute, dispose: jest.fn() }));
  const controller = new ConversationController('Portego-account', true, api, factory, toolsetFactory);
  return { controller, respond, transport, factory, toolsetFactory, execute, event: (event: Record<string, unknown>) => callbacks.onEvent(event) };
}

describe('Conversation orchestration', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    mockArchive = newArchive(); mockArchive.preferences.aiConsentVersion = AI_CONSENT_VERSION;
    mockArchive.preferences.meaningVisible = false; mockTickets = [];
    (saveLearningSnapshot as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('migrates practice to Japanese while retaining translation choice and legacy learning records', async () => {
    const legacy = newSession('es'); legacy.endedAt = nowSeconds();
    legacy.fragments = [createFragment({ speaker: 'user', text: 'Hola', startMS: 0, endMS: 1 })];
    mockArchive.preferences.learningLanguageID = 'es'; mockArchive.preferences.meaningLanguage = 'Spanish';
    mockArchive.sessions = [legacy]; mockTickets = enqueueFinalAssessment(legacy, []);
    const x = setup(); await x.controller.load(); await settle();
    expect(x.controller.getSnapshot().archive.preferences).toMatchObject({ learningLanguageID: 'ja', meaningLanguage: 'Spanish' });
    expect(x.controller.getSnapshot().archive.sessions).toEqual([legacy]);
    expect(x.respond).not.toHaveBeenCalled();
    await expect(x.controller.updatePreferences({ learningLanguageID: 'fr' })).rejects.toThrow('practise Japanese');
    await x.controller.updatePreferences({ meaningLanguage: 'Arabic' });
    await x.controller.sendTyped('こんにちは');
    expect(x.controller.getSnapshot().session?.languageID).toBe('ja');
    await x.controller.stop(); x.controller.dispose();
  });

  it('requires the updated connected-learning disclosure before any model request', async () => {
    mockArchive.preferences.aiConsentVersion = 1;
    const x = setup(); await x.controller.load();
    expect(await x.controller.sendTyped('こんにちは')).toBe(false);
    expect(x.respond).not.toHaveBeenCalled(); expect(x.toolsetFactory).not.toHaveBeenCalled();
    expect(x.execute).not.toHaveBeenCalled();
    await x.controller.updatePreferences({ aiConsentVersion: AI_CONSENT_VERSION });
    expect(await x.controller.sendTyped('こんにちは')).toBe(true);
    await x.controller.stop(); x.controller.dispose();
  });

  it('loads actual WaniKani context once for written practice, reuses it for helpers and Live, and refreshes next session', async () => {
    const x = setup(); await x.controller.load();
    expect(x.execute).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot().learningContext.status).toBe('idle');
    await x.controller.sendTyped('こんにちは');
    expect(x.execute).toHaveBeenCalledTimes(2);
    expect(x.execute).toHaveBeenCalledWith('get_kakehashi_learning_profile', {}, expect.any(AbortSignal));
    expect(x.execute).toHaveBeenCalledWith('get_kakehashi_study_items', { status: 'learned', kind: 'vocabulary', levels: [], limit: 8 }, expect.any(AbortSignal));
    expect(x.controller.getSnapshot().learningContext).toMatchObject({ status: 'loaded', level: 8, words: [{ characters: '日本' }] });
    expect(x.respond.mock.calls[0][0].instructions).toContain('"characters":"日本"');
    expect(x.execute.mock.invocationCallOrder.at(-1)!).toBeLessThan(x.respond.mock.invocationCallOrder[0]);
    await x.controller.help(); await x.controller.sendTyped('日本が好きです');
    expect(x.respond.mock.calls.at(-1)![0].instructions).toContain('"level":8');
    await x.controller.start();
    expect(x.execute).toHaveBeenCalledTimes(2);
    expect(x.transport.connect.mock.calls[0][1]).toContain('"characters":"日本"');
    await x.controller.stop(); await x.controller.start();
    expect(x.execute).toHaveBeenCalledTimes(4);
    await x.controller.stop(); x.controller.dispose();
  });

  it('waits for the bounded context read before opening voice and uses ordinary practice when unavailable', async () => {
    const x = setup(); await x.controller.load();
    x.execute.mockImplementation(async () => new Promise(() => {}));
    const starting = x.controller.start(); await settle();
    expect(x.controller.getSnapshot().learningContext.status).toBe('loading');
    expect(x.factory).not.toHaveBeenCalled();
    await x.controller.updatePreferences({ voice: 'willow' });
    await jest.advanceTimersByTimeAsync(8000); await starting;
    expect(x.controller.getSnapshot()).toMatchObject({ connection: 'active', learningContext: { status: 'unavailable', words: [], level: null } });
    expect(x.transport.connect.mock.calls[0][1]).toContain('Do not claim to know');
    expect(x.transport.connect.mock.calls[0][2].voice).toBe('marin');
    await x.controller.stop(); x.controller.dispose();
  });

  it.each(['voice', 'typed'] as const)('discards a %s startup context read when practice is closed', async (mode) => {
    const x = setup(); await x.controller.load();
    let completeProfile!: (value: unknown) => void;
    x.execute.mockImplementationOnce(() => new Promise(resolve => { completeProfile = resolve; }));
    const starting = mode === 'voice' ? x.controller.start() : x.controller.sendTyped('こんにちは');
    await settle();
    expect(x.controller.getSnapshot().learningContext.status).toBe('loading');
    const signal = x.execute.mock.calls[0][2];
    x.controller.setActive(false); await settle();
    expect(signal?.aborted).toBe(true);
    completeProfile({ level: 60 }); await starting;
    expect(x.factory).not.toHaveBeenCalled();
    expect(x.respond.mock.calls.every(([request]) => request.schema !== undefined)).toBe(true);
    expect(x.controller.getSnapshot().learningContext.level).toBeNull();
    x.controller.dispose();
  });

  it('does not connect or reveal a completed sibling result after an account change invalidates context', async () => {
    const x = setup(); await x.controller.load();
    x.execute.mockRejectedValueOnce(abortError());
    await x.controller.start();
    expect(x.factory).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot().learningContext.words).toEqual([]);
    x.controller.dispose();
  });

  it('connects typed replies, written help and live delegation to the same account tools', async () => {
    const x = setup(); await x.controller.load(); await x.controller.sendTyped('苦手な単語を練習したいです');
    expect(x.toolsetFactory).toHaveBeenCalledWith('Portego-account');
    const toolset = x.toolsetFactory.mock.results[0].value;
    expect(x.respond.mock.calls[0][0].toolset).toBe(toolset);
    expect(x.respond.mock.calls[0][0].instructions).toContain('not spoken fluency');
    await x.controller.help();
    expect(x.respond.mock.calls.at(-1)![0].toolset).toBe(toolset);
    await x.controller.start();
    x.event({ type: 'session.delegation.created', delegation: { target: 'client', id: 'personal-learning' } });
    await jest.advanceTimersByTimeAsync(500);
    expect(x.respond.mock.calls.at(-1)![0].toolset).toBe(toolset);
    expect(x.transport.send.mock.calls.some(([event]) => event.type === 'session.commentary.append' && event.delegation_id === 'personal-learning')).toBe(true);
    expect(x.toolsetFactory).toHaveBeenCalledTimes(1);
    await x.controller.stop(); await settle();
    const assessments = x.respond.mock.calls.map(([request]) => request).filter(request => request.schema);
    expect(assessments.length).toBeGreaterThan(0);
    expect(assessments.every(request => request.toolset === undefined)).toBe(true);
    x.controller.dispose(); expect(toolset.dispose).toHaveBeenCalledTimes(1);
  });

  it('starts a written conversation without opening a microphone and returns actual assistant text', async () => {
    const x = setup(); await x.controller.load();
    expect(await x.controller.sendTyped('こんにちは')).toBe(true);
    expect(x.factory).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot()).toMatchObject({ connection: 'active', voiceSession: false });
    expect(x.controller.getSnapshot().session?.fragments.map((fragment) => [fragment.speaker, fragment.text, fragment.typed])).toEqual([
      ['user', 'こんにちは', true], ['assistant', '元気ですか？', false],
    ]);
    await x.controller.stop(); await settle();
    expect(x.controller.getSnapshot().session?.usageFinal).toBe(true);
    x.controller.dispose();
  });

  it('continues a written session in live voice, retaining history and non-overlapping timeline offsets', async () => {
    const x = setup(); await x.controller.load(); await x.controller.sendTyped('こんにちは');
    const id = x.controller.getSnapshot().session!.id;
    const oldEnd = Math.max(...x.controller.getSnapshot().session!.fragments.map((fragment) => fragment.endMS));
    await x.controller.start();
    expect(x.transport.connect.mock.calls[0][2].history).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'user' })]));
    x.event({ type: 'session.input_transcript.delta', event_id: 'voice-user', delta: 'はい。', start_ms: 0, end_ms: 200 });
    expect(x.controller.getSnapshot().session!.id).toBe(id);
    expect(x.controller.getSnapshot().session!.fragments.at(-1)!.startMS).toBeGreaterThan(oldEnd);
    await x.controller.stop(); x.controller.dispose();
  });

  it('saves a voice change without interrupting a live session and uses it for the next one', async () => {
    mockArchive.preferences.voice = 'cedar';
    const x = setup(); await x.controller.load(); await x.controller.start();
    expect(x.transport.connect.mock.calls[0][2].voice).toBe('cedar');
    const sessionID = x.controller.getSnapshot().session!.id;
    const sentCommands = x.transport.send.mock.calls.length;
    await x.controller.updatePreferences({ voice: 'willow' });
    expect(x.controller.getSnapshot().archive.preferences.voice).toBe('willow');
    expect(saveLearningSnapshot).toHaveBeenLastCalledWith('Portego-account', expect.objectContaining({ preferences: expect.objectContaining({ voice: 'willow' }) }), expect.any(Array));
    expect(x.controller.getSnapshot()).toMatchObject({ connection: 'active', session: { id: sessionID } });
    expect(x.transport.connect).toHaveBeenCalledTimes(1);
    expect(x.transport.close).not.toHaveBeenCalled();
    expect(x.transport.disconnect).not.toHaveBeenCalled();
    expect(x.transport.send).toHaveBeenCalledTimes(sentCommands);
    await x.controller.stop(); await x.controller.start();
    expect(x.transport.connect.mock.calls[1][2].voice).toBe('willow');
    await x.controller.stop(); x.controller.dispose();
  });

  it('keeps the startup voice when preferences change during connection setup', async () => {
    mockArchive.preferences.voice = 'cedar';
    const x = setup(); await x.controller.load();
    let finishSave!: () => void;
    (saveLearningSnapshot as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    const starting = x.controller.start(); await settle();
    expect(x.controller.getSnapshot().connection).toBe('connecting');
    await x.controller.updatePreferences({ voice: 'willow' });
    finishSave(); await starting;
    expect(x.transport.connect.mock.calls[0][2].voice).toBe('cedar');
    expect(x.controller.getSnapshot().archive.preferences.voice).toBe('willow');
    await x.controller.stop(); x.controller.dispose();
  });

  it('preserves overlapping transcript fragments, cumulative usage, and final assessment evidence', async () => {
    const x = setup(); await x.controller.load(); await x.controller.start();
    x.event({ type: 'session.input_transcript.delta', event_id: 'u1', delta: 'こんにちは', start_ms: 100, end_ms: 400 });
    x.event({ type: 'session.output_transcript.delta', event_id: 'a1', delta: 'こんにちは！', start_ms: 300, end_ms: 700 });
    x.event({ type: 'session.input_transcript.delta', event_id: 'u1', delta: 'duplicate', start_ms: 100, end_ms: 400 });
    x.event({ type: 'session.usage.updated', usage: { seconds: 20 } });
    x.event({ type: 'session.usage.updated', usage: { seconds: 30 } });
    expect(x.controller.getSnapshot().session!.voiceSeconds).toBe(30);
    await x.controller.stop(); await settle();
    const session = x.controller.getSnapshot().session!;
    expect(session.fragments.map((fragment) => fragment.text)).toEqual(['こんにちは', 'こんにちは！']);
    expect(session.voiceSeconds).toBe(37); expect(session.usageFinal).toBe(true);
    expect(session.assessments).toHaveLength(1);
    expect(saveLearningSnapshot).toHaveBeenCalledWith('Portego-account', expect.anything(), expect.arrayContaining([expect.objectContaining({ sessionID: session.id })]));
    x.controller.dispose();
  });

  it('coalesces meaning requests without cancelling every growing transcript, then translates the latest revision', async () => {
    mockArchive.preferences.meaningVisible = true;
    const x = setup(); await x.controller.load(); await x.controller.start();
    let complete!: (value: ReturnType<typeof result>) => void;
    x.respond.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    x.event({ type: 'session.output_transcript.delta', event_id: 'a1', delta: 'こんにちは', start_ms: 100, end_ms: 500 });
    await jest.advanceTimersByTimeAsync(500);
    expect(x.respond).toHaveBeenCalledTimes(1);
    x.event({ type: 'session.output_transcript.delta', event_id: 'a2', delta: '、お元気ですか？', start_ms: 550, end_ms: 1000 });
    expect(x.respond.mock.calls[0][0].signal?.aborted).toBe(false);
    complete(result('Hello')); await settle();
    expect(x.controller.getSnapshot().meaning).toBe('Hello');
    await jest.advanceTimersByTimeAsync(500);
    expect(x.respond).toHaveBeenCalledTimes(2);
    expect(x.respond.mock.calls[1][0].input).toBe('こんにちは、お元気ですか？');
    await x.controller.stop(); x.controller.dispose();
  });

  it('aborts translations and starts no further processing when AI consent is revoked', async () => {
    mockArchive.preferences.meaningVisible = true;
    const x = setup(); await x.controller.load(); await x.controller.start();
    x.respond.mockImplementation(() => new Promise(() => {}));
    x.event({ type: 'session.output_transcript.delta', event_id: 'a1', delta: 'こんにちは', start_ms: 100, end_ms: 500 });
    await jest.advanceTimersByTimeAsync(500);
    const signal = x.respond.mock.calls[0][0].signal;
    await x.controller.updatePreferences({ aiConsentVersion: null });
    expect(signal?.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(6000);
    expect(x.respond).toHaveBeenCalledTimes(1);
    expect(x.controller.getSnapshot().meaning).toBe('');
    x.controller.dispose();
  });

  it('sends every byte of long Japanese typed replies in protocol-sized appends', async () => {
    const x = setup(); await x.controller.load(); await x.controller.start();
    const text = 'これは長い返事です。'.repeat(70);
    x.respond.mockResolvedValue(result(text));
    await x.controller.sendTyped('続けてください');
    const commentary = x.transport.send.mock.calls.map((call) => call[0]).filter((event) => event.type === 'session.commentary.append');
    expect(commentary.map((event) => event.content).join('')).toBe(text);
    expect(commentary.every((event) => Buffer.byteLength(String(event.content), 'utf8') <= 480)).toBe(true);
    await x.controller.stop(); x.controller.dispose();
  });

  it('returns failure so the composer can preserve a draft after a failed reply', async () => {
    const x = setup(); await x.controller.load();
    x.respond.mockRejectedValue(new Error('Offline'));
    expect(await x.controller.sendTyped('こんにちは')).toBe(false);
    expect(x.controller.getSnapshot().error).toBe('Offline');
    await x.controller.stop(); x.controller.dispose();
  });

  it('releases an active session when leaving the tab and rejects further requests', async () => {
    const x = setup(); await x.controller.load(); await x.controller.start();
    x.controller.setActive(false); await settle();
    expect(x.transport.close).toHaveBeenCalledTimes(1);
    expect(x.controller.getSnapshot().connection).toBe('ended');
    expect(await x.controller.sendTyped('late')).toBe(false);
    expect(x.respond).not.toHaveBeenCalled();
    x.controller.dispose();
  });

  it('never creates a paid voice session if the initial archive cannot be saved', async () => {
    const x = setup(); await x.controller.load();
    (saveLearningSnapshot as jest.Mock).mockRejectedValue(new Error('Disk full'));
    await x.controller.start();
    expect(x.factory).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot().connection).toBe('failed');
    expect(x.controller.getSnapshot().error).toContain('Disk full');
    x.controller.dispose();
  });

  it('reactivates safely after a StrictMode setup-cleanup-setup sequence', async () => {
    const x = setup();
    const initialLoad = x.controller.load();
    x.controller.dispose();
    const replacementLoad = x.controller.load();
    x.controller.setActive(true);
    await Promise.all([initialLoad, replacementLoad]);
    expect(x.controller.getSnapshot().loading).toBe(false);
    expect(await x.controller.sendTyped('こんにちは')).toBe(true);
    await x.controller.stop(); x.controller.dispose();
  });

  it('provides real help and sourced-topic replies in a written conversation', async () => {
    const x = setup(); await x.controller.load(); await x.controller.sendTyped('こんにちは');
    x.respond.mockResolvedValueOnce(result('もっと簡単に話しましょう。'));
    await x.controller.help();
    expect(x.controller.getSnapshot().session!.fragments.at(-1)!.text).toBe('もっと簡単に話しましょう。');
    x.respond.mockResolvedValueOnce(result('このニュースをどう思いますか？'));
    await x.controller.discuss({ id: 'topic', languageID: 'ja', query: 'Space', text: 'Verified topic information.', sources: [{ title: 'Space agency', url: 'https://example.org/space' }], retrievedAt: nowSeconds() });
    expect(x.respond.mock.calls.at(-1)![0].instructions).toContain('Verified topic information.');
    expect(x.controller.getSnapshot().session!.fragments.at(-1)!.text).toBe('このニュースをどう思いますか？');
    expect(x.controller.getSnapshot().selectedTheme?.id).toBe('current');
    expect(x.controller.getSnapshot().session!.topics).toHaveLength(1);
    expect(x.transport.send).not.toHaveBeenCalled();
    await x.controller.stop(); x.controller.dispose();
  });

  it('does not start recovered assessment work after data is deleted during its persistence barrier', async () => {
    const record = newSession(); record.endedAt = nowSeconds();
    record.fragments = [createFragment({ speaker: 'user', text: 'こんにちは', startMS: 0, endMS: 1 })];
    mockArchive.sessions = [record]; mockTickets = enqueueFinalAssessment(record, []);
    let commit!: () => void;
    (saveLearningSnapshot as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { commit = resolve; }));
    const x = setup(); await x.controller.load(); await settle();
    expect(saveLearningSnapshot).toHaveBeenCalled();
    await x.controller.deleteLearningData();
    commit(); await settle();
    expect(x.respond).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot().archive.sessions).toEqual([]);
    x.controller.dispose();
  });

  it('does not start recovered assessment work when its retry ledger cannot be committed', async () => {
    const record = newSession(); record.endedAt = nowSeconds();
    record.fragments = [createFragment({ speaker: 'user', text: 'こんにちは', startMS: 0, endMS: 1 })];
    mockArchive.sessions = [record]; mockTickets = enqueueFinalAssessment(record, []);
    (saveLearningSnapshot as jest.Mock).mockRejectedValue(new Error('Disk full'));
    const x = setup(); await x.controller.load(); await settle();
    expect(x.respond).not.toHaveBeenCalled();
    expect(x.controller.getSnapshot().error).toContain('Disk full');
    x.controller.dispose();
  });
});
