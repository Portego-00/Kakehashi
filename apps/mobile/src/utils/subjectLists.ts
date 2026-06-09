import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./store";

const SUBJECT_LISTS_STORAGE_KEY = "subject_lists:v1";
const LOCAL_SUBJECT_LISTS_SCHEMA_VERSION = 2;
const MAX_LIST_NAME_LENGTH = 60;
const SUBJECT_LISTS_SYNC_COOLDOWN_MS = 20_000;
const SUBJECT_LISTS_TABLE_NAME = "subject_lists";

type SubjectListSyncStatus = "synced" | "pending_upsert" | "pending_delete";

export interface SubjectList {
  id: string;
  name: string;
  subjectIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface SubjectListRecord extends SubjectList {
  ownerUserId: string | null;
  deletedAt: string | null;
  syncStatus: SubjectListSyncStatus;
}

interface SubjectListsPayload {
  version: 2;
  lists: SubjectListRecord[];
}

type SubjectListRow = {
  user_id: string;
  list_id: string;
  name: string;
  subject_ids: unknown;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

let didWarnAboutMissingSyncTable = false;
let inFlightSync: Promise<void> | null = null;
let queuedSync = false;
let lastSyncAttemptAt = 0;

const createEmptyPayload = (): SubjectListsPayload => ({
  version: LOCAL_SUBJECT_LISTS_SCHEMA_VERSION,
  lists: [],
});

function nowIso(): string {
  return new Date().toISOString();
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function compareUpdatedAtDesc(left: { updatedAt: string }, right: { updatedAt: string }): number {
  const leftTime = parseTimestamp(left.updatedAt);
  const rightTime = parseTimestamp(right.updatedAt);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return 0;
}

function sanitizeListName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Untitled List";
  }
  if (trimmed.length <= MAX_LIST_NAME_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_LIST_NAME_LENGTH);
}

function normalizeSubjectIds(subjectIds: unknown): number[] {
  if (!Array.isArray(subjectIds)) {
    return [];
  }

  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const value of subjectIds) {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    if (!Number.isFinite(numeric)) continue;
    const id = Math.trunc(numeric);
    if (id <= 0 || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

function normalizeSyncStatus(
  status: unknown,
  deletedAt: string | null
): SubjectListSyncStatus {
  if (status === "synced" || status === "pending_upsert" || status === "pending_delete") {
    return status;
  }
  return deletedAt ? "pending_delete" : "pending_upsert";
}

function generateListId(): string {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRecord(raw: Partial<SubjectListRecord>): SubjectListRecord {
  const timestamp = nowIso();
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : timestamp;
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt
      ? raw.updatedAt
      : createdAt;
  const deletedAt =
    typeof raw.deletedAt === "string" && raw.deletedAt ? raw.deletedAt : null;
  const syncStatus = normalizeSyncStatus(raw.syncStatus, deletedAt);

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : generateListId(),
    name: sanitizeListName(typeof raw.name === "string" ? raw.name : ""),
    subjectIds: normalizeSubjectIds(raw.subjectIds),
    createdAt,
    updatedAt,
    ownerUserId:
      typeof raw.ownerUserId === "string" && raw.ownerUserId.trim()
        ? raw.ownerUserId
        : null,
    deletedAt:
      syncStatus === "pending_delete" && !deletedAt ? updatedAt : deletedAt,
    syncStatus,
  };
}

function normalizePayload(rawPayload: unknown): SubjectListsPayload {
  if (!rawPayload || typeof rawPayload !== "object") {
    return createEmptyPayload();
  }

  const parsed = rawPayload as Partial<SubjectListsPayload> & {
    version?: unknown;
    lists?: unknown;
  };

  const rawLists = Array.isArray(parsed.lists) ? parsed.lists : [];
  const lists = rawLists.map((entry) => {
    const rawEntry = (entry ?? {}) as Partial<SubjectListRecord>;
    const normalizedEntry = normalizeRecord(rawEntry);

    if (parsed.version === LOCAL_SUBJECT_LISTS_SCHEMA_VERSION) {
      return normalizedEntry;
    }

    // Legacy entries (schema v1) become locally owned unsynced records.
    return {
      ...normalizedEntry,
      ownerUserId: null,
      deletedAt: null,
      syncStatus: "pending_upsert" as const,
    };
  });

  return {
    version: LOCAL_SUBJECT_LISTS_SCHEMA_VERSION,
    lists: sortRecords(lists),
  };
}

function sortRecords(records: SubjectListRecord[]): SubjectListRecord[] {
  return [...records].sort((left, right) => {
    const byUpdatedAt = compareUpdatedAtDesc(left, right);
    if (byUpdatedAt !== 0) {
      return byUpdatedAt;
    }
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }
    return left.id.localeCompare(right.id);
  });
}

function isLatestSchema(rawPayload: unknown): boolean {
  if (!rawPayload || typeof rawPayload !== "object") {
    return false;
  }
  return (
    (rawPayload as { version?: unknown }).version ===
    LOCAL_SUBJECT_LISTS_SCHEMA_VERSION
  );
}

async function readPayload(): Promise<SubjectListsPayload> {
  try {
    const rawValue = await AsyncStorage.getItem(SUBJECT_LISTS_STORAGE_KEY);
    if (!rawValue) {
      return createEmptyPayload();
    }

    const parsed: unknown = JSON.parse(rawValue);
    const payload = normalizePayload(parsed);

    if (!isLatestSchema(parsed)) {
      await writePayload(payload);
    }

    return payload;
  } catch (error) {
    console.warn("Failed to load subject lists:", error);
    return createEmptyPayload();
  }
}

async function writePayload(payload: SubjectListsPayload): Promise<void> {
  const normalized = normalizePayload(payload);
  await AsyncStorage.setItem(SUBJECT_LISTS_STORAGE_KEY, JSON.stringify(normalized));
}

function getCurrentUserId(): string | null {
  const candidate = useAuthStore.getState().userData?.id;
  if (typeof candidate !== "string") {
    return null;
  }
  const trimmed = candidate.trim();
  return trimmed ? trimmed : null;
}

function toPublicList(record: SubjectListRecord): SubjectList {
  return {
    id: record.id,
    name: record.name,
    subjectIds: [...record.subjectIds],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isVisibleForUser(record: SubjectListRecord, userId: string | null): boolean {
  if (record.deletedAt) {
    return false;
  }

  if (!userId) {
    return true;
  }

  return record.ownerUserId === userId || record.ownerUserId === null;
}

function canMutateForUser(record: SubjectListRecord, userId: string | null): boolean {
  if (record.deletedAt) {
    return false;
  }

  if (!userId) {
    return true;
  }

  return record.ownerUserId === userId || record.ownerUserId === null;
}

function findRecordIndexForMutation(
  lists: SubjectListRecord[],
  listId: string,
  userId: string | null
): number {
  return lists.findIndex(
    (record) => record.id === listId && canMutateForUser(record, userId)
  );
}

function markPendingUpsert(
  record: SubjectListRecord,
  userId: string | null,
  timestamp: string
): SubjectListRecord {
  return {
    ...record,
    ownerUserId: userId ?? record.ownerUserId,
    deletedAt: null,
    updatedAt: timestamp,
    syncStatus: "pending_upsert",
  };
}

function areSubjectIdsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const target = tableName.toLowerCase();
  return code === "42P01" || (message.includes("does not exist") && message.includes(target));
}

async function adoptOrphanRecordsForUser(userId: string): Promise<void> {
  const payload = await readPayload();
  let hasChanges = false;

  payload.lists = payload.lists.map((record) => {
    if (record.ownerUserId !== null) {
      return record;
    }

    hasChanges = true;
    return {
      ...record,
      ownerUserId: userId,
      syncStatus: record.deletedAt ? "pending_delete" : "pending_upsert",
    };
  });

  if (hasChanges) {
    payload.lists = sortRecords(payload.lists);
    await writePayload(payload);
  }
}

function toRowPayload(userId: string, record: SubjectListRecord): SubjectListRow {
  return {
    user_id: userId,
    list_id: record.id,
    name: sanitizeListName(record.name),
    subject_ids: normalizeSubjectIds(record.subjectIds),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

function fromRowPayload(row: SubjectListRow): SubjectListRecord {
  return normalizeRecord({
    id: row.list_id,
    ownerUserId: row.user_id,
    name: row.name,
    subjectIds: normalizeSubjectIds(row.subject_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt:
      typeof row.deleted_at === "string" && row.deleted_at ? row.deleted_at : null,
    syncStatus: "synced",
  });
}

async function markPendingRecordsAsSynced(
  userId: string,
  pendingSnapshot: SubjectListRecord[]
): Promise<void> {
  if (pendingSnapshot.length === 0) {
    return;
  }

  const snapshotMap = new Map<string, SubjectListRecord>();
  pendingSnapshot.forEach((record) => {
    snapshotMap.set(record.id, record);
  });

  const payload = await readPayload();
  let hasChanges = false;

  payload.lists = payload.lists.map((record) => {
    if (record.ownerUserId !== userId) {
      return record;
    }

    const snapshot = snapshotMap.get(record.id);
    if (!snapshot) {
      return record;
    }

    if (
      record.updatedAt !== snapshot.updatedAt ||
      record.deletedAt !== snapshot.deletedAt ||
      record.name !== snapshot.name ||
      !areSubjectIdsEqual(record.subjectIds, snapshot.subjectIds)
    ) {
      return record;
    }

    if (record.syncStatus === "synced") {
      return record;
    }

    hasChanges = true;
    return {
      ...record,
      syncStatus: "synced",
    };
  });

  if (hasChanges) {
    payload.lists = sortRecords(payload.lists);
    await writePayload(payload);
  }
}

async function pushPendingChanges(userId: string): Promise<boolean> {
  const payload = await readPayload();
  const pending = payload.lists.filter(
    (record) => record.ownerUserId === userId && record.syncStatus !== "synced"
  );

  if (pending.length === 0) {
    return true;
  }

  const rows = pending.map((record) => toRowPayload(userId, record));
  const { error } = await supabase
    .from(SUBJECT_LISTS_TABLE_NAME)
    .upsert(rows, { onConflict: "user_id,list_id" });

  if (error) {
    if (isMissingTableError(error, SUBJECT_LISTS_TABLE_NAME)) {
        if (!didWarnAboutMissingSyncTable) {
          didWarnAboutMissingSyncTable = true;
          console.warn(
            "Subject list sync table is missing. Configure the Supabase schema to enable syncing."
          );
        }
      return false;
    }
    throw error;
  }

  await markPendingRecordsAsSynced(userId, pending);
  return true;
}

async function fetchRemoteRows(userId: string): Promise<SubjectListRecord[] | null> {
  const { data, error } = await supabase
    .from(SUBJECT_LISTS_TABLE_NAME)
    .select("user_id, list_id, name, subject_ids, created_at, updated_at, deleted_at")
    .eq("user_id", userId);

  if (error) {
    if (isMissingTableError(error, SUBJECT_LISTS_TABLE_NAME)) {
        if (!didWarnAboutMissingSyncTable) {
          didWarnAboutMissingSyncTable = true;
          console.warn(
            "Subject list sync table is missing. Configure the Supabase schema to enable syncing."
          );
        }
      return null;
    }
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => fromRowPayload(row as SubjectListRow))
    .filter((record) => record.ownerUserId === userId);
}

async function mergeRemoteRows(
  userId: string,
  remoteRecords: SubjectListRecord[]
): Promise<boolean> {
  const payload = await readPayload();
  const remoteById = new Map<string, SubjectListRecord>();
  remoteRecords.forEach((record) => {
    remoteById.set(record.id, record);
  });

  let hasChanges = false;
  let hasPendingAfterMerge = false;

  payload.lists = payload.lists.map((record) => {
    if (record.ownerUserId !== userId) {
      return record;
    }

    const remote = remoteById.get(record.id);
    if (!remote) {
      if (record.syncStatus === "synced") {
        hasChanges = true;
        hasPendingAfterMerge = true;
        return {
          ...record,
          syncStatus: record.deletedAt ? "pending_delete" : "pending_upsert",
        };
      }

      hasPendingAfterMerge = true;
      return record;
    }

    remoteById.delete(record.id);

    if (record.syncStatus !== "synced") {
      hasPendingAfterMerge = true;
      return record;
    }

    const localTime = parseTimestamp(record.updatedAt);
    const remoteTime = parseTimestamp(remote.updatedAt);

    if (remoteTime > localTime) {
      hasChanges = true;
      return remote;
    }

    if (localTime > remoteTime) {
      const desiredSyncStatus: SubjectListSyncStatus = record.deletedAt
        ? "pending_delete"
        : "pending_upsert";

      hasChanges = true;
      hasPendingAfterMerge = true;
      return {
        ...record,
        syncStatus: desiredSyncStatus,
      };
    }

    if (
      record.name !== remote.name ||
      record.deletedAt !== remote.deletedAt ||
      !areSubjectIdsEqual(record.subjectIds, remote.subjectIds)
    ) {
      hasChanges = true;
      return remote;
    }

    return record;
  });

  if (remoteById.size > 0) {
    hasChanges = true;
    for (const record of remoteById.values()) {
      payload.lists.push(record);
    }
  }

  if (hasChanges) {
    payload.lists = sortRecords(payload.lists);
    await writePayload(payload);
  }

  if (!hasPendingAfterMerge) {
    hasPendingAfterMerge = payload.lists.some(
      (record) => record.ownerUserId === userId && record.syncStatus !== "synced"
    );
  }

  return hasPendingAfterMerge;
}

async function runSyncForUser(userId: string): Promise<void> {
  await adoptOrphanRecordsForUser(userId);

  const pushed = await pushPendingChanges(userId);
  if (!pushed) {
    return;
  }

  const remoteRecords = await fetchRemoteRows(userId);
  if (!remoteRecords) {
    return;
  }

  const hasPendingAfterMerge = await mergeRemoteRows(userId, remoteRecords);
  if (hasPendingAfterMerge) {
    await pushPendingChanges(userId);
  }
}

function queueSync(options?: { force?: boolean }): Promise<void> | null {
  const userId = getCurrentUserId();
  if (!userId) {
    return null;
  }

  const force = Boolean(options?.force);
  const now = Date.now();
  const shouldThrottle =
    !force && now - lastSyncAttemptAt < SUBJECT_LISTS_SYNC_COOLDOWN_MS;

  if (inFlightSync) {
    if (force) {
      queuedSync = true;
    }
    return inFlightSync;
  }

  if (shouldThrottle) {
    return null;
  }

  lastSyncAttemptAt = now;
  inFlightSync = runSyncForUser(userId)
    .catch((error) => {
      console.error("Failed to sync subject lists:", error);
    })
    .finally(() => {
      inFlightSync = null;
      if (queuedSync) {
        queuedSync = false;
        queueSync({ force: true });
      }
    });

  return inFlightSync;
}

function getVisibleRecords(
  payload: SubjectListsPayload,
  userId: string | null
): SubjectListRecord[] {
  return sortRecords(
    payload.lists.filter((record) => isVisibleForUser(record, userId))
  );
}

export async function syncSubjectListsNow(): Promise<void> {
  const syncPromise = queueSync({ force: true });
  if (syncPromise) {
    await syncPromise;
  }
}

export async function getSubjectLists(): Promise<SubjectList[]> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const localVisible = getVisibleRecords(payload, userId).map((record) =>
    toPublicList(record)
  );

  const syncPromise = queueSync();
  if (!syncPromise || localVisible.length > 0) {
    return localVisible;
  }

  await syncPromise;
  const refreshedPayload = await readPayload();
  return getVisibleRecords(refreshedPayload, userId).map((record) =>
    toPublicList(record)
  );
}

export async function saveSubjectLists(lists: SubjectList[]): Promise<void> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const scopedIds = new Set(getVisibleRecords(payload, userId).map((record) => record.id));
  const preserved = payload.lists.filter((record) => !scopedIds.has(record.id));

  const nextScopedRecords = lists.map((list) =>
    normalizeRecord({
      ...list,
      ownerUserId: userId,
      deletedAt: null,
      syncStatus: "pending_upsert",
    })
  );

  payload.lists = sortRecords([...preserved, ...nextScopedRecords]);
  await writePayload(payload);
  void queueSync({ force: true });
}

export async function createSubjectList(
  name: string,
  initialSubjectIds: number[] = []
): Promise<SubjectList> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const timestamp = nowIso();

  const newRecord = normalizeRecord({
    id: generateListId(),
    ownerUserId: userId,
    name,
    subjectIds: initialSubjectIds,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncStatus: "pending_upsert",
  });

  payload.lists = sortRecords([newRecord, ...payload.lists]);
  await writePayload(payload);
  void queueSync({ force: true });
  return toPublicList(newRecord);
}

export async function renameSubjectList(
  listId: string,
  nextName: string
): Promise<SubjectList | null> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const idx = findRecordIndexForMutation(payload.lists, listId, userId);
  if (idx === -1) {
    return null;
  }

  const timestamp = nowIso();
  const updated = markPendingUpsert(
    {
      ...payload.lists[idx],
      name: sanitizeListName(nextName),
    },
    userId,
    timestamp
  );

  payload.lists[idx] = updated;
  payload.lists = sortRecords(payload.lists);
  await writePayload(payload);
  void queueSync({ force: true });
  return toPublicList(updated);
}

export async function deleteSubjectList(listId: string): Promise<boolean> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const idx = findRecordIndexForMutation(payload.lists, listId, userId);
  if (idx === -1) {
    return false;
  }

  const timestamp = nowIso();
  payload.lists[idx] = normalizeRecord({
    ...payload.lists[idx],
    ownerUserId: userId ?? payload.lists[idx].ownerUserId,
    deletedAt: timestamp,
    updatedAt: timestamp,
    syncStatus: "pending_delete",
  });

  payload.lists = sortRecords(payload.lists);
  await writePayload(payload);
  void queueSync({ force: true });
  return true;
}

export async function replaceSubjectIdsInList(
  listId: string,
  subjectIds: number[]
): Promise<SubjectList | null> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const idx = findRecordIndexForMutation(payload.lists, listId, userId);
  if (idx === -1) {
    return null;
  }

  const timestamp = nowIso();
  const updated = markPendingUpsert(
    {
      ...payload.lists[idx],
      subjectIds: normalizeSubjectIds(subjectIds),
    },
    userId,
    timestamp
  );

  payload.lists[idx] = updated;
  payload.lists = sortRecords(payload.lists);
  await writePayload(payload);
  void queueSync({ force: true });
  return toPublicList(updated);
}

export async function addSubjectsToLists(
  listIds: string[],
  subjectIds: number[]
): Promise<SubjectList[]> {
  const normalizedListIds = new Set(listIds);
  const normalizedSubjectIds = normalizeSubjectIds(subjectIds);
  if (normalizedListIds.size === 0 || normalizedSubjectIds.length === 0) {
    return [];
  }

  const payload = await readPayload();
  const userId = getCurrentUserId();
  const changed: SubjectListRecord[] = [];
  const timestamp = nowIso();

  payload.lists = payload.lists.map((record) => {
    if (!normalizedListIds.has(record.id) || !canMutateForUser(record, userId)) {
      return record;
    }

    const nextSubjectIds = normalizeSubjectIds([
      ...record.subjectIds,
      ...normalizedSubjectIds,
    ]);
    if (nextSubjectIds.length === record.subjectIds.length) {
      return record;
    }

    const updated = markPendingUpsert(
      {
        ...record,
        subjectIds: nextSubjectIds,
      },
      userId,
      timestamp
    );
    changed.push(updated);
    return updated;
  });

  if (changed.length > 0) {
    payload.lists = sortRecords(payload.lists);
    await writePayload(payload);
    void queueSync({ force: true });
  }

  return changed.map((record) => toPublicList(record));
}

export async function removeSubjectFromList(
  listId: string,
  subjectId: number
): Promise<SubjectList | null> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const idx = findRecordIndexForMutation(payload.lists, listId, userId);
  if (idx === -1) {
    return null;
  }

  const nextSubjectIds = payload.lists[idx].subjectIds.filter((id) => id !== subjectId);
  if (nextSubjectIds.length === payload.lists[idx].subjectIds.length) {
    return toPublicList(payload.lists[idx]);
  }

  const timestamp = nowIso();
  const updated = markPendingUpsert(
    {
      ...payload.lists[idx],
      subjectIds: nextSubjectIds,
    },
    userId,
    timestamp
  );

  payload.lists[idx] = updated;
  payload.lists = sortRecords(payload.lists);
  await writePayload(payload);
  void queueSync({ force: true });
  return toPublicList(updated);
}

export async function setSubjectMembershipForLists(
  subjectId: number,
  selectedListIds: string[]
): Promise<void> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  const selectedSet = new Set(selectedListIds);
  let hasChanges = false;
  const timestamp = nowIso();

  payload.lists = payload.lists.map((record) => {
    if (!canMutateForUser(record, userId)) {
      return record;
    }

    const isSelected = selectedSet.has(record.id);
    const hasSubject = record.subjectIds.includes(subjectId);

    if (isSelected && !hasSubject) {
      hasChanges = true;
      return markPendingUpsert(
        {
          ...record,
          subjectIds: normalizeSubjectIds([...record.subjectIds, subjectId]),
        },
        userId,
        timestamp
      );
    }

    if (!isSelected && hasSubject) {
      hasChanges = true;
      return markPendingUpsert(
        {
          ...record,
          subjectIds: record.subjectIds.filter((id) => id !== subjectId),
        },
        userId,
        timestamp
      );
    }

    return record;
  });

  if (hasChanges) {
    payload.lists = sortRecords(payload.lists);
    await writePayload(payload);
    void queueSync({ force: true });
  }
}

export async function getListIdsContainingSubject(
  subjectId: number
): Promise<string[]> {
  const payload = await readPayload();
  const userId = getCurrentUserId();
  return getVisibleRecords(payload, userId)
    .filter((record) => record.subjectIds.includes(subjectId))
    .map((record) => record.id);
}

export async function getSubjectIdSetForListIds(
  listIds: string[]
): Promise<Set<number>> {
  const normalizedListIds = new Set(listIds);
  const result = new Set<number>();
  if (normalizedListIds.size === 0) {
    return result;
  }

  const payload = await readPayload();
  const userId = getCurrentUserId();
  getVisibleRecords(payload, userId).forEach((record) => {
    if (!normalizedListIds.has(record.id)) return;
    record.subjectIds.forEach((subjectId) => result.add(subjectId));
  });

  return result;
}

export async function clearSubjectLists(): Promise<void> {
  await AsyncStorage.removeItem(SUBJECT_LISTS_STORAGE_KEY);
}
