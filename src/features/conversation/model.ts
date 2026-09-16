import * as Crypto from 'expo-crypto';
import { LanguageRegistry } from './languages';
import { DEFAULT_LIVE_VOICE } from './voices';
import type { Archive, Assessment, ConversationTheme, FinalAssessmentTicket, Fragment, LearnerState, Passage, Preferences, SessionRecord, SourceLink, TopicBrief, WordProposal, WordState } from './types';

export const APPLE_EPOCH_UNIX_SECONDS = 978307200;
export const nowSeconds = (): number => Date.now() / 1000 - APPLE_EPOCH_UNIX_SECONDS;
export const dateFromSeconds = (seconds: number): Date => new Date((seconds + APPLE_EPOCH_UNIX_SECONDS) * 1000);
export const createID = (): string => Crypto.randomUUID();
export const canonical = (text: string): string => text.normalize('NFC');
export const containsCanonical = (text: string, query: string): boolean => canonical(text).toLowerCase().includes(canonical(query).toLowerCase());
export const wordKey = (word: WordProposal): string => `${word.language}|${canonical(word.lemma.trim().toLowerCase())}|${canonical(word.meaning.toLowerCase())}`;

export function defaultPreferences(): Preferences {
  return { learningLanguageID: LanguageRegistry.defaultID, voice: DEFAULT_LIVE_VOICE, meaningVisible: true, meaningLanguage: 'English', sessionMinutes: 15, hiddenWords: [], interests: '', hasOnboarded: false, showPinyin: true };
}
export function newArchive(): Archive { return { schemaVersion: 2, sessions: [], preferences: defaultPreferences() }; }
export function newSession(languageID = LanguageRegistry.defaultID, theme?: ConversationTheme | null): SessionRecord {
  const language = LanguageRegistry.get(languageID);
  if (!language) throw new Error('This conversation language is not supported.');
  return { id: createID(), languageID, startedAt: nowSeconds(), themeID: theme?.id, title: theme?.title ?? language.defaultTitle, fragments: [], assessments: [], translations: {}, topics: [], voiceSeconds: 0, usageFinal: false, inputTokens: 0, outputTokens: 0, searchCalls: 0 };
}
export function createFragment(input: Pick<Fragment, 'speaker' | 'text'> & Partial<Fragment>): Fragment {
  return { id: createID(), revision: 0, previousTexts: [], startMS: 0, endMS: input.startMS ?? 0, receivedAt: nowSeconds(), meaningVisible: false, typed: false, ...input };
}
function makePassage(fragments: Fragment[]): Passage {
  return { id: fragments[0].id, speaker: fragments[0].speaker, fragments, text: fragments.map((f) => f.text).join(''), revisionKey: fragments.map((f) => `${f.id}:${f.revision}`).join(','), startMS: fragments[0].startMS, endMS: Math.max(...fragments.map((f) => f.endMS)) };
}

/** Grouping is for presentation; silence or another speaker is not proof a turn is complete. */
export function getPassages(input: SessionRecord | Fragment[]): Passage[] {
  const fragments = Array.isArray(input) ? input : input.fragments;
  const result: Passage[] = [];
  const sorted = fragments.map((fragment, index) => ({ fragment, index })).sort((a, b) => a.fragment.startMS - b.fragment.startMS || a.index - b.index);
  for (const { fragment } of sorted) {
    let index = result.length - 1;
    while (index >= 0 && result[index].speaker !== fragment.speaker) index--;
    const previous = result[index];
    if (previous && fragment.startMS - previous.endMS <= 2200 && !fragment.typed && !previous.fragments[previous.fragments.length - 1].typed) {
      result[index] = makePassage([...previous.fragments, fragment]);
    } else result.push(makePassage([fragment]));
  }
  return result.sort((a, b) => a.startMS - b.startMS);
}
export function invalidateChangedAssessments(session: SessionRecord): SessionRecord {
  const current = new Map(getPassages(session).map((p) => [p.id, p.revisionKey]));
  return { ...session, assessments: session.assessments.filter((a) => current.get(a.passageID) === a.revisionKey) };
}
export function appendFragment(session: SessionRecord, fragment: Fragment): SessionRecord {
  if (session.fragments.some((f) => f.id === fragment.id)) return session;
  return invalidateChangedAssessments({ ...session, fragments: [...session.fragments, fragment] });
}
export function correctFragment(session: SessionRecord, id: string, text: string): SessionRecord {
  const fragment = session.fragments.find((f) => f.id === id);
  if (!fragment || fragment.text === text) return session;
  return invalidateChangedAssessments({
    ...session, translations: {},
    fragments: session.fragments.map((f) => f.id === id ? { ...f, previousTexts: [...f.previousTexts, f.text], text, revision: f.revision + 1 } : f),
  });
}

/** Provider suggestions never become learning evidence until checked against original fragments. */
export function validateAssessment(proposal: Assessment, session: SessionRecord): Assessment | null {
  if (!LanguageRegistry.get(session.languageID)) return null;
  const passages = getPassages(session);
  const passage = passages.find((p) => p.id === proposal.passageID && p.speaker === 'user');
  if (!passage || passage.revisionKey !== proposal.revisionKey || !Number.isInteger(proposal.suggestedLevel) || proposal.suggestedLevel < 0 || proposal.suggestedLevel > 5 || proposal.words.length > 12) return null;
  const allowed = new Set(passage.fragments.map((f) => f.id));
  const words = proposal.words.flatMap((word): WordProposal[] => {
    if (word.language !== session.languageID || !word.sourceIDs.length || word.sourceIDs.some((id) => !allowed.has(id)) || !Number.isFinite(word.confidence) || word.confidence < 0.8 || word.confidence > 1 || !word.lemma || word.lemma.length >= 100 || !word.meaning || word.meaning.length >= 180 || !word.form || !word.quote || !containsCanonical(passage.text, word.quote) || !containsCanonical(word.quote, word.form)) return [];
    const referencedText = passage.fragments.filter((f) => word.sourceIDs.includes(f.id)).map((f) => f.text).join('');
    if (!containsCanonical(referencedText, word.quote)) return [];
    if (word.kind === 'independent') {
      const modeled = passages.some((p) => p.speaker === 'assistant' && p.startMS <= passage.startMS && passage.startMS - p.endMS < 90000 && containsCanonical(p.text, word.form));
      if (modeled || passage.fragments.some((f) => f.meaningVisible || f.typed)) return [{ ...word, kind: 'assisted' }];
    }
    return [{ ...word }];
  });
  return { ...proposal, nextGoal: proposal.nextGoal.slice(0, 300), capability: proposal.capability.slice(0, 160), words };
}
export function applyAssessment(session: SessionRecord, proposal: Assessment): SessionRecord {
  const assessment = validateAssessment(proposal, session);
  if (!assessment) return session;
  return { ...session, assessments: [...session.assessments.filter((a) => a.passageID !== assessment.passageID), assessment] };
}
function dayKey(seconds: number): string {
  const date = dateFromSeconds(seconds);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function projectLearner(sessions: SessionRecord[], languageID = LanguageRegistry.defaultID, hiddenWords: string[] = [], now = nowSeconds()): LearnerState {
  const hidden = new Set(hiddenWords.map(canonical));
  let level = 0, count = 0, successes = 0;
  let nextGoal = 'Start with a greeting and one small question. Adjust from what the learner actually says.';
  const capabilities = new Map<string, Set<string>>();
  const events = new Map<string, { word: WordProposal; at: number; context: string }[]>();
  for (const session of sessions.filter((s) => s.languageID === languageID).sort((a, b) => a.startedAt - b.startedAt)) {
    const seen = new Set<string>();
    for (const raw of [...session.assessments].sort((a, b) => a.createdAt - b.createdAt)) {
      if (seen.has(raw.passageID)) continue;
      seen.add(raw.passageID);
      const a = validateAssessment(raw, session);
      if (!a) continue;
      count++;
      if (a.outcome === 'breakdown') { level = Math.max(0, level - 1); successes = 0; }
      else if (a.outcome === 'success') {
        successes++;
        if (successes >= 2) { level = Math.min(5, Math.max(level, Math.min(level + 1, a.suggestedLevel))); successes = 0; }
      } else successes = 0;
      if (a.nextGoal) nextGoal = a.nextGoal;
      if (a.outcome === 'success' && a.capability) {
        const evidence = capabilities.get(a.capability) ?? new Set<string>();
        evidence.add(`${dayKey(a.createdAt)}|${a.context}`);
        capabilities.set(a.capability, evidence);
      }
      const seenWords = new Set<string>();
      for (const word of a.words) {
        const key = wordKey(word);
        if (hidden.has(key) || seenWords.has(key)) continue;
        seenWords.add(key);
        const observations = events.get(key) ?? [];
        observations.push({ word, at: a.createdAt, context: a.context });
        events.set(key, observations);
      }
    }
  }
  const words: WordState[] = [];
  for (const [key, observations] of events) {
    const last = observations[observations.length - 1];
    const independent = observations.filter((o) => o.word.kind === 'independent');
    const days = new Set(independent.map((o) => dayKey(o.at))).size;
    const contexts = new Set(independent.map((o) => o.context)).size;
    const lastRecall = independent[independent.length - 1]?.at;
    let bars = independent.length ? 1 : 0;
    if (days >= 2) bars = 2;
    if (days >= 3 && contexts >= 2 && independent[independent.length - 1].at - independent[0].at >= 7 * 86400) bars = 3;
    const dueAt = (lastRecall ?? last.at) + [1, 1, 4, 14][bars] * 86400;
    if (now > dueAt && bars > 1) bars--;
    const lapses = observations.filter((o) => o.word.kind === 'lapse');
    if (lapses.length && lapses[lapses.length - 1].at > (lastRecall ?? -Infinity)) bars = Math.min(bars, 1);
    words.push({ id: key, lemma: last.word.lemma, meaning: last.word.meaning, form: last.word.form, example: last.word.quote, bars, understandingCount: observations.filter((o) => o.word.kind === 'understanding').length, independentCount: independent.length, lastSeen: last.at, dueAt, label: ['New', 'Fragile', 'Growing', 'Steady'][bars], explanation: !independent.length ? 'Heard or used with support. Try using it in your own words.' : bars === 1 ? 'Used independently. We’ll bring it back soon.' : bars === 2 ? 'Recalled on different days. Still worth revisiting.' : 'Recalled across days and contexts. Strength can fade with time.' });
  }
  return { challenge: level, observationCount: count, nextGoal, capabilities: [...capabilities].filter(([, support]) => support.size >= 3).map(([capability]) => capability).sort(), words: words.sort((a, b) => b.lastSeen - a.lastSeen), levelLabel: count < 4 ? 'Getting to know you' : 'Finding your pace' };
}

export function safeSourceURL(source: SourceLink | string): string | null {
  const value = typeof source === 'string' ? source : source.url;
  const authority = /^https:\/\/([^/?#]+)/.exec(value)?.[1];
  if (!authority || authority.includes('@') || /[\s\u0000-\u001f]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export const isTopicFresh = (topic: TopicBrief, now = nowSeconds()): boolean => now >= topic.retrievedAt && now - topic.retrievedAt < 6 * 3600;
export const translationKey = (passage: Passage, meaningLanguage: string): string => `${meaningLanguage}::${passage.revisionKey}`;

export function finalAssessmentPassage(session: SessionRecord): Passage | undefined {
  if (session.endedAt == null) return undefined;
  const users = getPassages(session).filter((p) => p.speaker === 'user');
  const passage = users[users.length - 1];
  return passage && passage.text.length >= 3 && !session.assessments.some((a) => a.passageID === passage.id && a.revisionKey === passage.revisionKey) ? passage : undefined;
}
export function enqueueFinalAssessment(session: SessionRecord, tickets: FinalAssessmentTicket[]): FinalAssessmentTicket[] {
  const passage = finalAssessmentPassage(session);
  if (passage && tickets.some((t) => t.sessionID === session.id && t.passageID === passage.id && t.revisionKey === passage.revisionKey)) return tickets;
  return [...tickets.filter((t) => t.sessionID !== session.id), ...(passage ? [{ sessionID: session.id, passageID: passage.id, revisionKey: passage.revisionKey, attempts: 0 }] : [])];
}
export function canRetryFinalAssessment(ticket: FinalAssessmentTicket, session: SessionRecord, now = nowSeconds()): boolean {
  const passage = finalAssessmentPassage(session);
  if (!passage || ticket.sessionID !== session.id || ticket.passageID !== passage.id || ticket.revisionKey !== passage.revisionKey || ticket.attempts < 0 || ticket.attempts >= 3 || !Number.isFinite(now) || session.endedAt == null || now < session.endedAt || now - session.endedAt > 7 * 86400) return false;
  if (ticket.lastAttemptAt == null) return ticket.attempts === 0;
  return ticket.attempts > 0 && Number.isFinite(ticket.lastAttemptAt) && now - ticket.lastAttemptAt >= 60 * 2 ** (ticket.attempts - 1);
}

export const Transcript = { passages: getPassages };
export const LearningEngine = { validate: validateAssessment, project: projectLearner };
