import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import fixture from './fixtures/mural-archive.json';
import { createFragment, newArchive, newSession, nowSeconds } from '../model';
import { ArchiveError, decodeArchive, encodedBytes, exportArchive, importArchive, loadArchive, loadFinalAssessmentTickets, MAXIMUM_ARCHIVE_BYTES, saveArchive, saveLearningSnapshot } from '../storage';
import { LIVE_VOICES } from '../voices';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));

describe('Mural-compatible archives', () => {
  it('round trips the native cross-platform fixture without changing evidence or dates', () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    expect(decodeArchive(exportArchive(archive))).toEqual(archive);
    expect(archive).toEqual({ ...fixture, preferences: { ...fixture.preferences, voice: 'marin' } });
  });

  it.each(LIVE_VOICES)('round trips the saved %s voice', (voice) => {
    const archive = newArchive();
    archive.preferences.voice = voice;
    expect(decodeArchive(exportArchive(archive)).preferences.voice).toBe(voice);
  });

  it.each([undefined, null, 'unknown-voice', 'Marin', 42, { name: 'marin' }])('falls back safely for a legacy or invalid voice: %j', (voice) => {
    const archive = decodeArchive(JSON.stringify({ ...fixture, preferences: { ...fixture.preferences, voice } }));
    expect(archive.preferences.voice).toBe('marin');
    expect(archive.sessions).toEqual(fixture.sessions);
  });

  it('preserves the optional pinyin preference while accepting native archives without it', () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    expect(archive.preferences.showPinyin).toBeUndefined();
    archive.preferences.showPinyin = false;
    expect(decodeArchive(exportArchive(archive)).preferences.showPinyin).toBe(false);
  });

  it('merges UUIDs case-insensitively, preserving local settings and existing sessions', () => {
    const current = decodeArchive(JSON.stringify(fixture));
    const imported = decodeArchive(JSON.stringify(fixture));
    imported.sessions.forEach((session) => { session.id = session.id.toLowerCase(); session.title = 'Imported title'; });
    imported.preferences.learningLanguageID = 'es';
    const merged = importArchive(current, exportArchive(imported));
    expect(merged).toEqual(current);
    expect(current.sessions[0].title).toBe('The weekend');
  });

  it('drops stale or unsupported assessment evidence when merging and leaves the source untouched', () => {
    const incoming = decodeArchive(JSON.stringify(fixture));
    incoming.sessions[0].fragments[2].revision++;
    incoming.sessions[1].assessments[0].words[0].sourceIDs = ['missing'];
    const merged = importArchive(newArchive(), exportArchive(incoming));
    expect(merged.sessions[0].assessments).toEqual([]);
    expect(merged.sessions[1].assessments[0].words).toEqual([]);
    expect(incoming.sessions[0].assessments).toHaveLength(1);
    expect(incoming.sessions[1].assessments[0].words).toHaveLength(1);
    expect(merged.preferences.learningLanguageID).toBe('ja');
  });

  it('migrates version 1 provenance to Norwegian rather than the new Japanese default', () => {
    const legacy = { ...newArchive(), schemaVersion: 1, preferences: { ...newArchive().preferences, voice: undefined, learningLanguageID: undefined, hiddenWords: ['katt|cat'] }, sessions: [{ ...newSession('nb'), languageID: undefined }] };
    const restored = decodeArchive(JSON.stringify(legacy));
    expect(restored.preferences.learningLanguageID).toBe('nb');
    expect(restored.preferences.voice).toBe('marin');
    expect(restored.preferences.hiddenWords).toEqual(['nb|katt|cat']);
    expect(restored.sessions[0].languageID).toBe('nb');
  });

  it.each([
    ['invalid', '{'],
    ['unsupportedVersion', JSON.stringify({ ...newArchive(), schemaVersion: 99 })],
    ['unsupportedLanguage', JSON.stringify({ ...newArchive(), preferences: { ...newArchive().preferences, learningLanguageID: 'xx' } })],
    ['invalid', JSON.stringify({ ...newArchive(), preferences: { ...newArchive().preferences, sessionMinutes: 0 } })],
    ['invalid', JSON.stringify({ ...newArchive(), sessions: [{ ...newSession(), startedAt: 1e99 }] })],
    ['invalid', JSON.stringify({ ...newArchive(), sessions: [{ ...newSession(), voiceSeconds: -1 }] })],
    ['invalid', JSON.stringify({ ...newArchive(), sessions: [{ ...newSession(), languageID: undefined }] })],
    ['invalid', JSON.stringify({ ...newArchive(), sessions: [{ ...newSession(), id: 'bad-id' }] })],
  ])('rejects malformed archives with %s', (kind, json) => {
    try { decodeArchive(json); throw new Error('Expected rejection'); }
    catch (error) { expect(error).toBeInstanceOf(ArchiveError); expect(error).toHaveProperty('kind', kind); }
  });

  it('rejects duplicate records, reversed fragment timing, and cross-language topics', () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    expect(() => decodeArchive(JSON.stringify({ ...archive, sessions: [...archive.sessions, { ...archive.sessions[0], id: archive.sessions[0].id.toLowerCase() }] }))).toThrow(ArchiveError);
    archive.sessions[0].fragments[0].endMS = -1;
    expect(() => decodeArchive(JSON.stringify(archive))).toThrow(ArchiveError);
    archive.sessions[0].fragments[0].endMS = 2000;
    archive.sessions[0].topics[0].languageID = 'ja';
    expect(() => decodeArchive(JSON.stringify(archive))).toThrow(ArchiveError);
  });

  it('bounds the actual UTF-8 size before parsing and retains current data on rejection', () => {
    expect(encodedBytes('Aé日本🙂')).toBe(Buffer.byteLength('Aé日本🙂'));
    expect(() => decodeArchive('あ'.repeat(Math.ceil(MAXIMUM_ARCHIVE_BYTES / 3) + 1))).toThrow(expect.objectContaining({ kind: 'tooLarge' }));
    const current = decodeArchive(JSON.stringify(fixture));
    const original = exportArchive(current);
    expect(() => importArchive(current, '{')).toThrow(ArchiveError);
    expect(exportArchive(current)).toBe(original);
  });
});

describe('account-scoped conversation storage and recovery', () => {
  const database = new Map<string, string>();
  const originalOS = Platform.OS;
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }); });
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });
  beforeEach(() => {
    database.clear();
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => database.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { database.set(key, value); });
  });

  it('isolates accounts and never puts retry metadata into the public backup', async () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    const session = archive.sessions[0];
    const tickets = [{ sessionID: session.id, passageID: 'test', revisionKey: 'test:0', attempts: 0 }];
    await saveLearningSnapshot('111', archive, tickets);
    expect(await loadArchive('111')).toEqual(archive);
    expect(await loadArchive('222')).toEqual(newArchive());
    expect(await loadFinalAssessmentTickets('111')).toEqual(tickets);
    expect(exportArchive(await loadArchive('111'))).not.toContain('kakehashiFinalAssessments');
    expect(exportArchive(await loadArchive('111'))).not.toContain('apiKey');
  });

  it('recovers interrupted conversations and queues only their final unassessed passage', async () => {
    const archive = newArchive();
    const session = newSession();
    session.fragments = [createFragment({ speaker: 'user', text: '日本語を話したいです。' })];
    archive.sessions = [session];
    await saveArchive('333', archive);
    const recovered = await loadArchive('333');
    expect(recovered.sessions[0].endedAt).toBeGreaterThanOrEqual(session.startedAt);
    expect(recovered.sessions[0].endReason).toBe('App closed before finalization');
    expect(await loadFinalAssessmentTickets('333')).toEqual([{ sessionID: session.id, passageID: session.fragments[0].id, revisionKey: `${session.fragments[0].id}:0`, attempts: 0 }]);
    expect(await loadArchive('333')).toEqual(recovered);
  });

  it('recovers the last committed backup after a damaged primary without resetting history', async () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    await saveArchive('444', archive);
    await saveArchive('444', { ...archive, preferences: { ...archive.preferences, interests: 'new' } });
    database.set('conversation.v1.account.444', '{broken');
    expect(await loadArchive('444')).toEqual(archive);
  });

  it('refuses to overwrite unreadable history when both saved copies are damaged', async () => {
    database.set('conversation.v1.account.555', '{broken');
    database.set('conversation.v1.account.555.backup', '{broken');
    await expect(loadArchive('555')).rejects.toThrow('saved files are preserved');
    await expect(saveArchive('555', newArchive())).rejects.toThrow('saved files are preserved');
    expect(database.get('conversation.v1.account.555')).toBe('{broken');
  });

  it('serializes saves and drops recovery metadata when its session is deleted', async () => {
    const archive = newArchive();
    const session = { ...newSession(), endedAt: nowSeconds() };
    archive.sessions = [session];
    await saveLearningSnapshot('666', archive, [{ sessionID: session.id, passageID: 'p', revisionKey: 'p:0', attempts: 0 }]);
    await Promise.all([
      saveArchive('666', { ...archive, preferences: { ...archive.preferences, interests: 'first' } }),
      saveArchive('666', { ...archive, sessions: [], preferences: { ...archive.preferences, interests: 'second' } }),
    ]);
    expect((await loadArchive('666')).preferences.interests).toBe('second');
    expect(await loadFinalAssessmentTickets('666')).toEqual([]);
    expect(database.get('conversation.v1.account.666.backup')).not.toContain(session.id);
    database.set('conversation.v1.account.666', '{broken');
    expect((await loadArchive('666')).sessions).toEqual([]);
  });
});
