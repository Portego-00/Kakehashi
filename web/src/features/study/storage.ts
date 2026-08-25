import type { StudyFilters, StudyModeId, StudySession, SubjectList } from "./types";

const PREFIX = "kakehashi:study:v1";
export type StudyStorageScope = string | number;

function accountPrefix(scope: StudyStorageScope) {
  return `${PREFIX}:account:${encodeURIComponent(String(scope))}`;
}

export function subjectListsKey(scope: StudyStorageScope) {
  return `${accountPrefix(scope)}:subject-lists`;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function configKey(scope: StudyStorageScope, mode: StudyModeId) {
  return `${accountPrefix(scope)}:config:${mode}`;
}

export function sessionKey(scope: StudyStorageScope, mode: StudyModeId) {
  return `${accountPrefix(scope)}:session:${mode}`;
}

export function loadStudyConfig(scope: StudyStorageScope, mode: StudyModeId): Partial<StudyFilters> | null {
  const value = readJson<unknown>(configKey(scope, mode));
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<StudyFilters>)
    : null;
}

export function saveStudyConfig(scope: StudyStorageScope, mode: StudyModeId, filters: StudyFilters) {
  return writeJson(configKey(scope, mode), filters);
}

export function loadStudySession(scope: StudyStorageScope, mode: StudyModeId): StudySession | null {
  const value = readJson<Partial<StudySession>>(sessionKey(scope, mode));
  if (!value || value.version !== 1 || value.mode !== mode || !Array.isArray(value.questions) || !Array.isArray(value.answers)) return null;
  return value as StudySession;
}

export function saveStudySession(scope: StudyStorageScope, session: StudySession) {
  return writeJson(sessionKey(scope, session.mode), { ...session, updatedAt: new Date().toISOString() });
}

export function clearStudySession(scope: StudyStorageScope, mode: StudyModeId) {
  if (!hasStorage()) return;
  window.localStorage.removeItem(sessionKey(scope, mode));
}

export function loadSubjectLists(scope: StudyStorageScope): SubjectList[] {
  const value = readJson<unknown>(subjectListsKey(scope));
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SubjectList =>
    Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.subjectIds)),
  );
}

export function saveSubjectLists(scope: StudyStorageScope, lists: SubjectList[]) {
  return writeJson(subjectListsKey(scope), lists);
}

export function loadModeState<T>(scope: StudyStorageScope, mode: StudyModeId, name: string): T | null {
  return readJson<T>(`${accountPrefix(scope)}:mode:${mode}:${name}`);
}

export function saveModeState(scope: StudyStorageScope, mode: StudyModeId, name: string, state: unknown) {
  return writeJson(`${accountPrefix(scope)}:mode:${mode}:${name}`, state);
}

export function clearModeState(scope: StudyStorageScope, mode: StudyModeId, name: string) {
  if (!hasStorage()) return;
  window.localStorage.removeItem(`${accountPrefix(scope)}:mode:${mode}:${name}`);
}
