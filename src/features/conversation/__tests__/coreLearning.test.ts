import fixture from './fixtures/mural-archive.json';
import expected from './fixtures/mural-archive-expected.json';
import { LanguageRegistry, MeaningLanguages } from '../languages';
import { appendFragment, applyAssessment, canRetryFinalAssessment, correctFragment, createFragment, enqueueFinalAssessment, finalAssessmentPassage, getPassages, newSession, projectLearner, safeSourceURL, validateAssessment, wordKey } from '../model';
import { decodeArchive } from '../storage';
import { TeachingPolicy } from '../teaching';
import type { Assessment, EvidenceKind, SessionRecord } from '../types';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));

function observation(options: { at?: number; kind?: EvidenceKind; context?: string; meaningVisible?: boolean; typed?: boolean; level?: number; outcome?: Assessment['outcome'] } = {}): SessionRecord {
  let session = newSession('en');
  session.startedAt = options.at ?? 800000000;
  const fragment = createFragment({ id: `${session.id}-user`, speaker: 'user', text: 'I cooked pasta.', startMS: 5000, endMS: 6500, receivedAt: session.startedAt, meaningVisible: options.meaningVisible ?? false, typed: options.typed ?? false });
  session = appendFragment(session, fragment);
  session.endedAt = session.startedAt + 60;
  session.assessments = [{ passageID: fragment.id, revisionKey: `${fragment.id}:0`, outcome: options.outcome ?? 'success', suggestedLevel: options.level ?? 5, nextGoal: 'Add a reason.', capability: 'Describes a past event', context: options.context ?? 'food', createdAt: session.startedAt + 10, words: [{ language: 'en', lemma: 'cook', meaning: 'to prepare food', form: 'cooked', quote: 'I cooked pasta', sourceIDs: [fragment.id], confidence: 0.95, kind: options.kind ?? 'independent' }] }];
  return session;
}

describe('Mural cross-platform learning parity', () => {
  it('matches the original Swift/Kotlin archive fixture passages and projected evidence', () => {
    const archive = decodeArchive(JSON.stringify(fixture));
    for (const session of archive.sessions) {
      expect(getPassages(session).map((passage) => ({ speaker: passage.speaker, text: passage.text, fragmentIDs: passage.fragments.map((fragment) => fragment.id) }))).toEqual(expected.passages[session.id as keyof typeof expected.passages]);
    }
    const learner = projectLearner(archive.sessions, expected.languageID, archive.preferences.hiddenWords, expected.now);
    expect({ ...learner, words: learner.words.map(({ label: _label, explanation: _explanation, ...word }) => word).sort((a, b) => a.id.localeCompare(b.id)), levelLabel: undefined }).toEqual({ ...expected.learner, levelLabel: undefined });
  });

  it('preserves all eight original language modules, 24 themes each, and adds Japanese', () => {
    expect(LanguageRegistry.all.map((language) => language.id)).toEqual(['ja', 'nb', 'es', 'en', 'fr', 'de', 'it', 'pt', 'zh']);
    for (const language of LanguageRegistry.all) {
      expect(language.themes).toHaveLength(24);
      expect(language.teachingFocus).toHaveLength(6);
      expect(new Set(language.themes.map((theme) => theme.id)).size).toBe(24);
    }
    expect(LanguageRegistry.defaultID).toBe('ja');
    expect(MeaningLanguages.greeting('Japanese')).toBe('こんにちは！');
  });

  it('groups close same-speaker speech even across an interjection but separates typed messages', () => {
    const fragments = [
      createFragment({ id: 'u1', speaker: 'user', text: 'I cooked', startMS: 0, endMS: 1000 }),
      createFragment({ id: 'a1', speaker: 'assistant', text: 'Mm.', startMS: 1100, endMS: 1200 }),
      createFragment({ id: 'u2', speaker: 'user', text: ' pasta.', startMS: 1500, endMS: 2000 }),
      createFragment({ id: 'u3', speaker: 'user', text: 'Thanks.', startMS: 2001, endMS: 2002, typed: true }),
    ];
    expect(getPassages(fragments).map((p) => p.text)).toEqual(['I cooked pasta.', 'Mm.', 'Thanks.']);
  });

  it('invalidates stale evidence and translations after a correction and records revision history', () => {
    const original = observation();
    original.translations = { 'English::old:0': 'I cooked pasta.' };
    const updated = correctFragment(original, original.fragments[0].id, 'I ordered pasta.');
    expect(updated.assessments).toEqual([]);
    expect(updated.translations).toEqual({});
    expect(updated.fragments[0].previousTexts).toEqual(['I cooked pasta.']);
    expect(updated.fragments[0].revision).toBe(1);
    expect(validateAssessment(original.assessments[0], updated)).toBeNull();
    expect(original.fragments[0].text).toBe('I cooked pasta.');
    expect(projectLearner([updated], 'en').words).toEqual([]);
  });

  it('invalidates an assessment when a late fragment extends its passage', () => {
    const original = observation();
    const updated = appendFragment(original, createFragment({ speaker: 'user', text: ' yesterday.', startMS: 7000, endMS: 7500 }));
    expect(updated.assessments).toEqual([]);
    expect(getPassages(updated)[0].text).toBe('I cooked pasta. yesterday.');
    expect(appendFragment(updated, updated.fragments[1])).toBe(updated);
  });

  it.each([{ typed: true }, { meaningVisible: true }])('never awards unaided recall for supported production: %j', (support) => {
    const session = observation(support);
    expect(validateAssessment(session.assessments[0], session)?.words[0].kind).toBe('assisted');
    const word = projectLearner([session], 'en').words[0];
    expect(word.independentCount).toBe(0);
    expect(word.bars).toBe(0);
  });

  it('downgrades immediate imitation but allows recall after 90 seconds', () => {
    const session = observation();
    session.fragments.unshift(createFragment({ speaker: 'assistant', text: 'I cooked rice.', startMS: 0, endMS: 2000 }));
    expect(validateAssessment(session.assessments[0], session)?.words[0].kind).toBe('assisted');
    session.fragments[1].startMS = 92000;
    session.fragments[1].endMS = 94000;
    expect(validateAssessment(session.assessments[0], session)?.words[0].kind).toBe('independent');
  });

  it('omits fabricated, foreign, uncertain and wrongly attributed evidence', () => {
    const session = observation();
    const proposal = session.assessments[0];
    const valid = proposal.words[0];
    const invalid = [
      { ...valid, quote: 'I baked pizza' }, { ...valid, sourceIDs: ['another-passage'] },
      { ...valid, language: 'es' }, { ...valid, confidence: 0.79 }, { ...valid, confidence: NaN },
      { ...valid, form: 'ate' }, { ...valid, lemma: '' },
    ];
    expect(validateAssessment({ ...proposal, words: invalid }, session)?.words).toEqual([]);
    expect(validateAssessment({ ...proposal, suggestedLevel: 6 }, session)).toBeNull();
    expect(validateAssessment({ ...proposal, words: Array(13).fill(valid) }, session)).toBeNull();
  });

  it('normalizes canonically equivalent accented vocabulary without removing accents', () => {
    const session = observation();
    session.fragments[0].text = 'I visited the cafe\u0301.';
    const proposal = session.assessments[0];
    proposal.words = [{ ...proposal.words[0], lemma: ' CAFÉ ', form: 'café', quote: 'the café', meaning: 'a café' }];
    expect(validateAssessment(proposal, session)?.words).toHaveLength(1);
    expect(wordKey(proposal.words[0])).toBe('en|café|a café');
  });

  it('requires successes in pairs, advances at most one stage and lowers on breakdown', () => {
    const sessions = [0, 1, 2, 3].map((day) => observation({ at: 800000000 + day * 86400 }));
    expect(projectLearner(sessions.slice(0, 1), 'en').challenge).toBe(0);
    expect(projectLearner(sessions.slice(0, 2), 'en').challenge).toBe(1);
    expect(projectLearner(sessions, 'en').challenge).toBe(2);
    expect(projectLearner([...sessions, observation({ at: 800000000 + 5 * 86400, outcome: 'breakdown' })], 'en').challenge).toBe(1);
    expect(projectLearner(sessions, 'ja').observationCount).toBe(0);
  });

  it('requires independent recall over days and contexts, then fades overdue or lapsed words', () => {
    const start = 800000000;
    const sessions = [observation({ at: start }), observation({ at: start + 86400 }), observation({ at: start + 7 * 86400, context: 'family' })];
    const steady = projectLearner(sessions, 'en', [], start + 8 * 86400).words[0];
    expect(steady.bars).toBe(3);
    expect(steady.independentCount).toBe(3);
    expect(projectLearner(sessions, 'en', [], steady.dueAt + 1).words[0].bars).toBe(2);
    expect(projectLearner([...sessions, observation({ at: start + 8 * 86400, kind: 'lapse' })], 'en', [], start + 9 * 86400).words[0].bars).toBe(1);
    expect(projectLearner(sessions, 'en', [steady.id], start + 8 * 86400).words).toEqual([]);
    expect(projectLearner([sessions[0], observation({ at: start + 60 }), observation({ at: start + 120 })], 'en', [], start + 180).words[0].bars).toBe(1);
  });

  it('queues only final missing evidence and rejects stale retries after revisions or deletion', () => {
    const session = observation();
    session.assessments = [];
    const tickets = enqueueFinalAssessment(session, []);
    expect(tickets).toHaveLength(1);
    expect(enqueueFinalAssessment(session, tickets)).toBe(tickets);
    expect(canRetryFinalAssessment(tickets[0], session, session.endedAt! + 1)).toBe(true);
    expect(canRetryFinalAssessment({ ...tickets[0], attempts: 1, lastAttemptAt: session.endedAt }, session, session.endedAt! + 59)).toBe(false);
    expect(canRetryFinalAssessment({ ...tickets[0], attempts: 1, lastAttemptAt: session.endedAt }, session, session.endedAt! + 60)).toBe(true);
    expect(canRetryFinalAssessment({ ...tickets[0], attempts: 3 }, session, session.endedAt! + 1000)).toBe(false);
    expect(canRetryFinalAssessment(tickets[0], correctFragment(session, session.fragments[0].id, 'I ate pasta.'), session.endedAt! + 1)).toBe(false);
    const completed = applyAssessment(session, observation().assessments[0]);
    expect(completed).toBe(session);
    expect(finalAssessmentPassage({ ...session, endedAt: undefined })).toBeUndefined();
  });

  it('keeps prompts language-specific and handles locale identifiers for speech repair', () => {
    const japanese = LanguageRegistry.get('ja')!;
    expect(TeachingPolicy.voice(japanese, projectLearner([], 'ja'), null, 'travel', 'Spanish')).toContain('Meaning subtitles in Spanish are a separate application feature');
    expect(TeachingPolicy.assessment(japanese)).toContain('language must be ja');
    expect(TeachingPolicy.translation(japanese, 'Spanish')).toContain('Do not answer questions in it');
    expect(TeachingPolicy.shouldRedirectSpeech(japanese, 'ja_JP', 0.99)).toBe(false);
    expect(TeachingPolicy.shouldRedirectSpeech(japanese, 'en-US', 0.99)).toBe(true);
    expect(TeachingPolicy.shouldRedirectSpeech(japanese, 'en', 0.88)).toBe(false);
    expect(TeachingPolicy.shouldRedirectSpeech(japanese, 'und', 0.99)).toBe(false);
    expect(TeachingPolicy.shouldRedirectSpeech(japanese, 'en', Infinity)).toBe(false);
  });

  it('allows only attributable HTTPS source links without credentials', () => {
    expect(safeSourceURL('https://example.org/story')).toBe('https://example.org/story');
    for (const url of ['javascript:alert(1)', 'http://example.org', 'https://name:password@example.org', 'file:///secret', 'invalid']) expect(safeSourceURL(url)).toBeNull();
  });
});
