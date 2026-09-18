import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { z } from 'zod';
import { LanguageRegistry } from './languages';
import { enqueueFinalAssessment, invalidateChangedAssessments, newArchive, nowSeconds, validateAssessment } from './model';
import type { Archive, FinalAssessmentTicket } from './types';
import { DEFAULT_LIVE_VOICE, LIVE_VOICES } from './voices';

export const MAXIMUM_ARCHIVE_BYTES = 30_000_000;
const MAXIMUM_SESSIONS = 10000;
const MAX_DATE = 63113904000;
const MIN_DATE = -63114076800;
const date = z.number().finite().min(MIN_DATE).max(MAX_DATE);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const optionalString = z.string().nullish();
const counter = z.number().int().min(0).max(1_000_000_000);
const wordSchema = z.object({ lemma: z.string(), meaning: z.string(), form: z.string(), kind: z.enum(['exposure', 'understanding', 'assisted', 'independent', 'lapse']), confidence: z.number(), sourceIDs: z.array(z.string()), quote: z.string(), language: z.string() });
const assessmentSchema = z.object({ passageID: z.string(), revisionKey: z.string(), outcome: z.enum(['success', 'partial', 'breakdown', 'uncertain']), suggestedLevel: z.number().int(), nextGoal: z.string(), capability: z.string(), words: z.array(wordSchema), createdAt: date, context: z.string() });
const fragmentSchema = z.object({ id: z.string(), revision: z.number().int().min(0).max(1_000_000), previousTexts: z.array(z.string()), speaker: z.enum(['user', 'assistant']), text: z.string().max(50000), startMS: z.number().int().nonnegative(), endMS: z.number().int().nonnegative(), receivedAt: date, meaningVisible: z.boolean(), typed: z.boolean() }).refine((fragment) => fragment.endMS >= fragment.startMS);
const topicSchema = z.object({ id: uuid, languageID: z.string(), query: z.string(), text: z.string(), sources: z.array(z.object({ title: z.string(), url: z.string() })), retrievedAt: date });
const sessionSchema = z.object({
  id: uuid, languageID: z.string(), providerID: optionalString, startedAt: date, endedAt: date.nullish(), themeID: optionalString, title: z.string(),
  fragments: z.array(fragmentSchema), assessments: z.array(assessmentSchema), translations: z.record(z.string(), z.string()), topics: z.array(topicSchema),
  voiceSeconds: z.number().finite().min(0).max(31_536_000), usageFinal: z.boolean(), inputTokens: counter, outputTokens: counter, searchCalls: counter, endReason: optionalString,
}).refine((session) => new Set(session.fragments.map((f) => f.id)).size === session.fragments.length && session.topics.every((topic) => topic.languageID === session.languageID));
const archiveSchema = z.object({
  schemaVersion: z.literal(2), sessions: z.array(sessionSchema).max(MAXIMUM_SESSIONS),
  preferences: z.object({ learningLanguageID: z.string(), voice: z.enum(LIVE_VOICES).catch(DEFAULT_LIVE_VOICE), meaningVisible: z.boolean(), meaningLanguage: z.string(), sessionMinutes: z.number().int().min(1).max(60), hiddenWords: z.array(z.string()), interests: z.string(), hasOnboarded: z.boolean(), aiConsentVersion: z.number().int().nullish(), showPinyin: z.boolean().optional() }),
}).refine((archive) => new Set(archive.sessions.map((s) => s.id.toLowerCase())).size === archive.sessions.length);
const ticketsSchema = z.array(z.object({ sessionID: uuid, passageID: z.string(), revisionKey: z.string(), attempts: z.number().int().min(0).max(3), lastAttemptAt: z.number().finite().nullish() })).max(MAXIMUM_SESSIONS).refine((tickets) => new Set(tickets.map((t) => t.sessionID.toLowerCase())).size === tickets.length);

export class ArchiveError extends Error {
  constructor(public readonly kind: 'tooLarge' | 'unsupportedVersion' | 'unsupportedLanguage' | 'invalid') {
    super({ tooLarge: 'This backup is too large to import. Export and remove older conversations to free up space.', unsupportedVersion: 'This backup needs a newer version of the conversation feature.', unsupportedLanguage: 'This backup contains an unsupported language module.', invalid: 'This backup has invalid or duplicate records.' }[kind]);
    this.name = 'ArchiveError';
  }
}

/** Avoid relying on a TextEncoder global in native Hermes. */
export function encodedBytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
  }
  return bytes;
}
function checkedArchive(input: unknown): Archive {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) throw new ArchiveError('invalid');
  if (!LanguageRegistry.get(parsed.data.preferences.learningLanguageID) || parsed.data.sessions.some((s) => !LanguageRegistry.get(s.languageID))) throw new ArchiveError('unsupportedLanguage');
  return parsed.data;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ArchiveError('invalid');
  return value as Record<string, unknown>;
}
function migrate(input: unknown): unknown {
  const root = object(input);
  if (!Number.isInteger(root.schemaVersion)) throw new ArchiveError('invalid');
  if (root.schemaVersion !== 1 && root.schemaVersion !== 2) throw new ArchiveError('unsupportedVersion');
  if (root.schemaVersion === 2) return root;
  // Mural version 1 was exclusively Norwegian. The Kakehashi Japanese default must
  // never relabel that historic evidence during migration.
  const preferences = object(root.preferences);
  if (!Array.isArray(root.sessions) || !Array.isArray(preferences.hiddenWords) || preferences.hiddenWords.some((word) => typeof word !== 'string')) throw new ArchiveError('invalid');
  return {
    ...root, schemaVersion: 2,
    preferences: { ...preferences, learningLanguageID: 'nb', hiddenWords: preferences.hiddenWords.map((word) => `nb|${word}`) },
    sessions: root.sessions.map((value) => {
      const session = object(value);
      if (!Array.isArray(session.topics)) throw new ArchiveError('invalid');
      return { ...session, languageID: 'nb', topics: session.topics.map((topic) => ({ ...object(topic), languageID: 'nb' })) };
    }),
  };
}
export function decodeArchive(data: string): Archive {
  if (encodedBytes(data) > MAXIMUM_ARCHIVE_BYTES) throw new ArchiveError('tooLarge');
  let raw: unknown;
  try { raw = JSON.parse(data); } catch { throw new ArchiveError('invalid'); }
  return checkedArchive(migrate(raw));
}
export function exportArchive(archive: Archive): string {
  const encoded = JSON.stringify(checkedArchive(archive), null, 2);
  if (encodedBytes(encoded) > MAXIMUM_ARCHIVE_BYTES) throw new ArchiveError('tooLarge');
  return encoded;
}
export function mergeArchives(current: Archive, incoming: Archive): Archive {
  const existing = checkedArchive(current);
  const incomingArchive = checkedArchive(incoming);
  const known = new Set(existing.sessions.map((session) => session.id.toLowerCase()));
  const additions = incomingArchive.sessions.filter((session) => !known.has(session.id.toLowerCase()));
  if (additions.length > MAXIMUM_SESSIONS - existing.sessions.length) throw new ArchiveError('tooLarge');
  const merged = {
    ...existing,
    sessions: [...existing.sessions, ...additions.map((session) => {
      const cleaned = invalidateChangedAssessments(session);
      return { ...cleaned, assessments: cleaned.assessments.flatMap((assessment) => { const validated = validateAssessment(assessment, cleaned); return validated ? [validated] : []; }) };
    })],
  };
  exportArchive(merged);
  return merged;
}
/** Import merges history by UUID, preserving current settings and existing sessions. */
export function importArchive(current: Archive, encoded: string): Archive { return mergeArchives(current, decodeArchive(encoded)); }
export const ArchiveCodec = { encode: exportArchive, decode: decodeArchive, merge: mergeArchives, MAXIMUM_ENCODED_BYTES: MAXIMUM_ARCHIVE_BYTES };

interface LearningSnapshot { archive: Archive; finalAssessments: FinalAssessmentTicket[] }
const locks = new Map<string, Promise<unknown>>();
function storageKey(accountID: string | number): string {
  const account = String(accountID).trim();
  if (!account || account.length > 256 || (typeof accountID === 'number' && (!Number.isSafeInteger(accountID) || accountID < 0))) throw new Error('Sign in to save your conversations.');
  return `conversation.v1.account.${encodeURIComponent(account)}`;
}
async function serialized<T>(accountID: string | number, action: (key: string) => Promise<T>): Promise<T> {
  const key = storageKey(accountID);
  const pending = (locks.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => action(key));
  locks.set(key, pending);
  try { return await pending; }
  finally { if (locks.get(key) === pending) locks.delete(key); }
}
function fileURI(key: string): string {
  if (!FileSystem.documentDirectory) throw new Error('Local conversation storage is unavailable.');
  return `${FileSystem.documentDirectory}conversations/${key}.json`;
}
async function readEncoded(key: string, pending = false): Promise<string | null> {
  if (Platform.OS === 'web') return pending ? null : AsyncStorage.getItem(key);
  const path = `${fileURI(key)}${pending ? '.pending' : ''}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  if (info.isDirectory || (info.size ?? 0) > MAXIMUM_ARCHIVE_BYTES) throw new ArchiveError('tooLarge');
  const encoded = await FileSystem.readAsStringAsync(path);
  if (encodedBytes(encoded) > MAXIMUM_ARCHIVE_BYTES) throw new ArchiveError('tooLarge');
  return encoded;
}
async function writeEncoded(key: string, encoded: string): Promise<void> {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, encoded);
  const path = fileURI(key);
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}conversations`, { intermediates: true });
  const temporary = `${path}.pending`;
  await FileSystem.writeAsStringAsync(temporary, encoded);
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.moveAsync({ from: temporary, to: path });
}
function decodeSnapshot(encoded: string): LearningSnapshot {
  const archive = decodeArchive(encoded);
  const metadata = object(JSON.parse(encoded)).kakehashiFinalAssessments;
  const parsed = ticketsSchema.safeParse(metadata ?? []);
  if (!parsed.success) throw new ArchiveError('invalid');
  return { archive, finalAssessments: parsed.data };
}
function encodeSnapshot(snapshot: LearningSnapshot): string {
  const parsed = ticketsSchema.safeParse(snapshot.finalAssessments);
  if (!parsed.success) throw new ArchiveError('invalid');
  const encoded = JSON.stringify({ ...checkedArchive(snapshot.archive), kakehashiFinalAssessments: parsed.data });
  if (encodedBytes(encoded) > MAXIMUM_ARCHIVE_BYTES) throw new ArchiveError('tooLarge');
  return encoded;
}
async function readSnapshot(key: string): Promise<LearningSnapshot> {
  let lastError: unknown;
  const candidates = [
    { key, pending: false }, { key: `${key}.backup`, pending: false },
    { key, pending: true }, { key: `${key}.backup`, pending: true },
  ];
  for (const candidate of candidates) {
    try { const encoded = await readEncoded(candidate.key, candidate.pending); if (encoded != null) return decodeSnapshot(encoded); }
    catch (error) { lastError = error; }
  }
  if (lastError) throw new Error('Your conversation history could not be read. The saved files are preserved; restore a backup before saving new conversations.', { cause: lastError });
  return { archive: newArchive(), finalAssessments: [] };
}
async function writeSnapshot(key: string, snapshot: LearningSnapshot, previous?: LearningSnapshot): Promise<void> {
  const encoded = encodeSnapshot(snapshot);
  const prior = previous ?? await readSnapshot(key);
  const retained = new Set(snapshot.archive.sessions.map((session) => session.id.toLowerCase()));
  const removedSessions = prior.archive.sessions.some((session) => !retained.has(session.id.toLowerCase()));
  const backup = removedSessions ? {
    archive: { ...prior.archive, preferences: snapshot.archive.preferences, sessions: prior.archive.sessions.filter((session) => retained.has(session.id.toLowerCase())) },
    finalAssessments: prior.finalAssessments.filter((ticket) => retained.has(ticket.sessionID.toLowerCase())),
  } : prior;
  // Both files hold complete snapshots. A killed app between replacement steps can
  // always recover committed history. Explicitly deleted conversations must also
  // leave the recovery copy, so a future file failure cannot resurrect them.
  await writeEncoded(`${key}.backup`, encodeSnapshot(backup));
  await writeEncoded(key, encoded);
}

export async function loadArchive(accountID: string | number): Promise<Archive> {
  return serialized(accountID, async (key) => {
    const snapshot = await readSnapshot(key);
    if (!snapshot.archive.sessions.some((session) => session.endedAt == null)) return snapshot.archive;
    const recoveredAt = nowSeconds();
    let tickets = snapshot.finalAssessments;
    const archive = { ...snapshot.archive, sessions: snapshot.archive.sessions.map((session) => {
      if (session.endedAt != null) return session;
      const recovered = { ...session, endedAt: recoveredAt, endReason: 'App closed before finalization' };
      tickets = enqueueFinalAssessment(recovered, tickets);
      return recovered;
    }) };
    await writeSnapshot(key, { archive, finalAssessments: tickets }, snapshot);
    return archive;
  });
}
export async function saveArchive(accountID: string | number, archive: Archive): Promise<void> {
  return serialized(accountID, async (key) => { const previous = await readSnapshot(key); await writeSnapshot(key, { archive, finalAssessments: previous.finalAssessments.filter((ticket) => archive.sessions.some((s) => s.id === ticket.sessionID)) }, previous); });
}
export async function loadFinalAssessmentTickets(accountID: string | number): Promise<FinalAssessmentTicket[]> {
  return serialized(accountID, async (key) => (await readSnapshot(key)).finalAssessments);
}
export async function saveFinalAssessmentTickets(accountID: string | number, finalAssessments: FinalAssessmentTicket[]): Promise<void> {
  return serialized(accountID, async (key) => { const previous = await readSnapshot(key); await writeSnapshot(key, { ...previous, finalAssessments }, previous); });
}
export async function saveLearningSnapshot(accountID: string | number, archive: Archive, finalAssessments: FinalAssessmentTicket[]): Promise<void> {
  return serialized(accountID, async (key) => { await writeSnapshot(key, { archive, finalAssessments }); });
}
