import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CUSTOM_CONTEXT_SENTENCE_VERSION,
  type CreateCustomContextSentenceInput,
  type CustomContextSentence,
  type CustomContextSentenceDisplayMode,
  type UpdateCustomContextSentenceInput,
  type UpsertCustomContextSentenceInput,
} from "../types/customContextSentence";

export const CUSTOM_CONTEXT_SENTENCE_STORAGE_KEY_PREFIX =
  "custom_context_sentences:v1";

type StoredCustomContextSentencePayload = {
  version: typeof CUSTOM_CONTEXT_SENTENCE_VERSION;
  sentences: CustomContextSentence[];
};

const mutationQueues = new Map<string, Promise<void>>();
let generatedIdSequence = 0;

function normalizeUserId(userId: string): string {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new TypeError("A WaniKani user ID is required.");
  }

  return userId.trim();
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeSubjectId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError("subjectId must be a positive integer.");
  }

  return value;
}

function normalizeDisplayMode(value: unknown): CustomContextSentenceDisplayMode {
  if (value !== "kanji" && value !== "kana") {
    throw new TypeError('displayMode must be either "kanji" or "kana".');
  }

  return value;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function parseStoredSentence(value: unknown): CustomContextSentence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<CustomContextSentence>;
  if (
    candidate.version !== undefined &&
    candidate.version !== CUSTOM_CONTEXT_SENTENCE_VERSION
  ) {
    return null;
  }

  try {
    const createdAt = normalizeTimestamp(candidate.createdAt);
    const updatedAt = normalizeTimestamp(candidate.updatedAt);
    if (!createdAt || !updatedAt) {
      return null;
    }

    return {
      version: CUSTOM_CONTEXT_SENTENCE_VERSION,
      id: normalizeRequiredString(candidate.id, "id"),
      subjectId: normalizeSubjectId(candidate.subjectId),
      japanese: normalizeRequiredString(candidate.japanese, "japanese"),
      kana: normalizeRequiredString(candidate.kana, "kana"),
      english: normalizeRequiredString(candidate.english, "english"),
      displayMode:
        candidate.displayMode === "kana" || candidate.displayMode === "kanji"
          ? candidate.displayMode
          : "kanji",
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

function parseStoredPayload(rawValue: string | null): CustomContextSentence[] {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return [];
  }

  let rawSentences: unknown[];
  if (Array.isArray(parsed)) {
    rawSentences = parsed;
  } else if (parsed && typeof parsed === "object") {
    const payload = parsed as {
      version?: unknown;
      sentences?: unknown;
    };
    if (
      payload.version !== undefined &&
      payload.version !== CUSTOM_CONTEXT_SENTENCE_VERSION
    ) {
      return [];
    }
    rawSentences = Array.isArray(payload.sentences) ? payload.sentences : [];
  } else {
    return [];
  }

  const recordsById = new Map<string, CustomContextSentence>();
  for (const rawSentence of rawSentences) {
    const sentence = parseStoredSentence(rawSentence);
    if (sentence) {
      recordsById.set(sentence.id, sentence);
    }
  }

  return Array.from(recordsById.values());
}

function cloneSentence(sentence: CustomContextSentence): CustomContextSentence {
  return { ...sentence };
}

async function readSentences(
  storageKey: string,
): Promise<CustomContextSentence[]> {
  const rawValue = await AsyncStorage.getItem(storageKey);
  return parseStoredPayload(rawValue);
}

async function writeSentences(
  storageKey: string,
  sentences: CustomContextSentence[],
): Promise<void> {
  const payload: StoredCustomContextSentencePayload = {
    version: CUSTOM_CONTEXT_SENTENCE_VERSION,
    sentences,
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
}

function enqueueMutation<T>(
  storageKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previousMutation = mutationQueues.get(storageKey) ?? Promise.resolve();
  const result = previousMutation.catch(() => undefined).then(operation);
  const queueTail = result.then(
    () => undefined,
    () => undefined,
  );

  mutationQueues.set(storageKey, queueTail);
  void queueTail.then(() => {
    if (mutationQueues.get(storageKey) === queueTail) {
      mutationQueues.delete(storageKey);
    }
  });

  return result;
}

async function waitForPendingMutations(storageKey: string): Promise<void> {
  await mutationQueues.get(storageKey);
}

function normalizeCreateInput(
  input: CreateCustomContextSentenceInput,
): CreateCustomContextSentenceInput {
  if (!input || typeof input !== "object") {
    throw new TypeError("A custom context sentence is required.");
  }

  return {
    subjectId: normalizeSubjectId(input.subjectId),
    japanese: normalizeRequiredString(input.japanese, "japanese"),
    kana: normalizeRequiredString(input.kana, "kana"),
    english: normalizeRequiredString(input.english, "english"),
    displayMode: normalizeDisplayMode(input.displayMode),
  };
}

function createSentence(
  input: CreateCustomContextSentenceInput,
  id: string,
  timestamp: string,
): CustomContextSentence {
  const normalizedInput = normalizeCreateInput(input);
  return {
    version: CUSTOM_CONTEXT_SENTENCE_VERSION,
    id: normalizeRequiredString(id, "id"),
    ...normalizedInput,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createGeneratedId(existingIds: ReadonlySet<string>): string {
  let id: string;
  do {
    generatedIdSequence += 1;
    id = [
      "custom-context",
      Date.now().toString(36),
      generatedIdSequence.toString(36),
      Math.random().toString(36).slice(2, 10),
    ].join("-");
  } while (existingIds.has(id));

  return id;
}

export function getCustomContextSentenceStorageKey(userId: string): string {
  return `${CUSTOM_CONTEXT_SENTENCE_STORAGE_KEY_PREFIX}:${encodeURIComponent(
    normalizeUserId(userId),
  )}`;
}

export async function getAllCustomContextSentences(
  userId: string,
): Promise<CustomContextSentence[]> {
  const storageKey = getCustomContextSentenceStorageKey(userId);
  await waitForPendingMutations(storageKey);
  const sentences = await readSentences(storageKey);
  return sentences.map(cloneSentence);
}

export async function getCustomContextSentencesForSubject(
  userId: string,
  subjectId: number,
): Promise<CustomContextSentence[]> {
  const normalizedSubjectId = normalizeSubjectId(subjectId);
  const sentences = await getAllCustomContextSentences(userId);
  return sentences.filter(
    (sentence) => sentence.subjectId === normalizedSubjectId,
  );
}

export async function getCustomContextSentenceCount(
  userId: string,
  subjectId?: number,
): Promise<number> {
  if (subjectId === undefined) {
    return (await getAllCustomContextSentences(userId)).length;
  }

  return (await getCustomContextSentencesForSubject(userId, subjectId)).length;
}

export async function addCustomContextSentence(
  userId: string,
  input: CreateCustomContextSentenceInput,
): Promise<CustomContextSentence> {
  const storageKey = getCustomContextSentenceStorageKey(userId);

  return enqueueMutation(storageKey, async () => {
    const sentences = await readSentences(storageKey);
    const existingIds = new Set(sentences.map((sentence) => sentence.id));
    const timestamp = new Date().toISOString();
    const sentence = createSentence(
      input,
      createGeneratedId(existingIds),
      timestamp,
    );

    await writeSentences(storageKey, [...sentences, sentence]);
    return cloneSentence(sentence);
  });
}

export async function updateCustomContextSentence(
  userId: string,
  id: string,
  updates: UpdateCustomContextSentenceInput,
): Promise<CustomContextSentence | null> {
  const storageKey = getCustomContextSentenceStorageKey(userId);
  const normalizedId = normalizeRequiredString(id, "id");
  if (!updates || typeof updates !== "object") {
    throw new TypeError("Custom context sentence updates are required.");
  }

  return enqueueMutation(storageKey, async () => {
    const sentences = await readSentences(storageKey);
    const sentenceIndex = sentences.findIndex(
      (sentence) => sentence.id === normalizedId,
    );
    if (sentenceIndex < 0) {
      return null;
    }

    const existing = sentences[sentenceIndex];
    const normalizedInput = normalizeCreateInput({
      subjectId: updates.subjectId ?? existing.subjectId,
      japanese: updates.japanese ?? existing.japanese,
      kana: updates.kana ?? existing.kana,
      english: updates.english ?? existing.english,
      displayMode: updates.displayMode ?? existing.displayMode,
    });
    const updated: CustomContextSentence = {
      ...existing,
      ...normalizedInput,
      updatedAt: new Date().toISOString(),
    };
    const nextSentences = [...sentences];
    nextSentences[sentenceIndex] = updated;

    await writeSentences(storageKey, nextSentences);
    return cloneSentence(updated);
  });
}

export async function upsertCustomContextSentence(
  userId: string,
  input: UpsertCustomContextSentenceInput,
): Promise<CustomContextSentence> {
  const storageKey = getCustomContextSentenceStorageKey(userId);
  if (!input || typeof input !== "object") {
    throw new TypeError("A custom context sentence is required.");
  }
  const normalizedId =
    input.id === undefined ? null : normalizeRequiredString(input.id, "id");

  return enqueueMutation(storageKey, async () => {
    const sentences = await readSentences(storageKey);
    const normalizedInput = normalizeCreateInput(input);
    const sentenceIndex = normalizedId
      ? sentences.findIndex((sentence) => sentence.id === normalizedId)
      : -1;

    if (sentenceIndex >= 0) {
      const existing = sentences[sentenceIndex];
      const updated: CustomContextSentence = {
        ...existing,
        ...normalizedInput,
        updatedAt: new Date().toISOString(),
      };
      const nextSentences = [...sentences];
      nextSentences[sentenceIndex] = updated;
      await writeSentences(storageKey, nextSentences);
      return cloneSentence(updated);
    }

    const existingIds = new Set(sentences.map((sentence) => sentence.id));
    const id = normalizedId ?? createGeneratedId(existingIds);
    const timestamp = new Date().toISOString();
    const sentence = createSentence(normalizedInput, id, timestamp);
    await writeSentences(storageKey, [...sentences, sentence]);
    return cloneSentence(sentence);
  });
}

export async function deleteCustomContextSentence(
  userId: string,
  id: string,
): Promise<boolean> {
  const storageKey = getCustomContextSentenceStorageKey(userId);
  const normalizedId = normalizeRequiredString(id, "id");

  return enqueueMutation(storageKey, async () => {
    const sentences = await readSentences(storageKey);
    const nextSentences = sentences.filter(
      (sentence) => sentence.id !== normalizedId,
    );
    if (nextSentences.length === sentences.length) {
      return false;
    }

    await writeSentences(storageKey, nextSentences);
    return true;
  });
}
