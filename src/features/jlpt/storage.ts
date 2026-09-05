import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  JLPT_BANK_VERSION,
  jlptQuestionSemanticKey,
  type JlptLevel,
  type JlptQuestion,
  type JlptSession,
} from "./domain";

const PREFIX = "kakehashi:jlpt:native:v1";
const historyWriteQueues = new Map<string, Promise<void>>();

type QuestionHistory = {
  version: 1;
  bankVersion: typeof JLPT_BANK_VERSION;
  seenByLevel: Partial<Record<JlptLevel, string[]>>;
  seenSemanticKeysByLevel: Partial<Record<JlptLevel, string[]>>;
};

function normalizedScope(scope: string | number) {
  return encodeURIComponent(String(scope || "anonymous"));
}

export function jlptNativeSessionKey(scope: string | number) {
  return `${PREFIX}:account:${normalizedScope(scope)}:session`;
}

export function jlptNativeHistoryKey(scope: string | number) {
  return `${PREFIX}:account:${normalizedScope(scope)}:history`;
}

export function parseNativeJlptSession(raw: string | null): JlptSession | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<JlptSession>;
    if (
      value.version !== 1 ||
      value.bankVersion !== JLPT_BANK_VERSION ||
      !value.id ||
      !value.level ||
      !value.mode ||
      !Array.isArray(value.sectionQuestionIds) ||
      !Array.isArray(value.answers)
    ) {
      return null;
    }
    return {
      ...value,
      listeningPlays: value.listeningPlays ?? {},
    } as JlptSession;
  } catch {
    return null;
  }
}

export async function loadNativeJlptSession(scope: string | number) {
  return parseNativeJlptSession(
    await AsyncStorage.getItem(jlptNativeSessionKey(scope)),
  );
}

export async function saveNativeJlptSession(
  scope: string | number,
  session: JlptSession,
) {
  await AsyncStorage.setItem(
    jlptNativeSessionKey(scope),
    JSON.stringify(session),
  );
}

export async function clearNativeJlptSession(scope: string | number) {
  await AsyncStorage.removeItem(jlptNativeSessionKey(scope));
}

function parseHistory(raw: string | null): QuestionHistory | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<QuestionHistory>;
    if (
      value.version !== 1 ||
      value.bankVersion !== JLPT_BANK_VERSION ||
      !value.seenByLevel ||
      !value.seenSemanticKeysByLevel
    ) {
      return null;
    }
    return value as QuestionHistory;
  } catch {
    return null;
  }
}

export async function loadNativeJlptHistory(
  scope: string | number,
  level: JlptLevel,
) {
  const history = parseHistory(
    await AsyncStorage.getItem(jlptNativeHistoryKey(scope)),
  );
  return {
    questionIds: new Set(history?.seenByLevel[level] ?? []),
    semanticKeys: new Set(history?.seenSemanticKeysByLevel[level] ?? []),
  };
}

export async function rememberNativeJlptSelection(
  scope: string | number,
  level: JlptLevel,
  questions: readonly JlptQuestion[],
) {
  const key = jlptNativeHistoryKey(scope);
  const previous = historyWriteQueues.get(key) ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(async () => {
      const current = parseHistory(await AsyncStorage.getItem(key));
      const seenByLevel = current?.seenByLevel ?? {};
      const seenSemanticKeysByLevel = current?.seenSemanticKeysByLevel ?? {};
      const next: QuestionHistory = {
        version: 1,
        bankVersion: JLPT_BANK_VERSION,
        seenByLevel: {
          ...seenByLevel,
          [level]: [
            ...new Set([
              ...(seenByLevel[level] ?? []),
              ...questions.map((question) => question.id),
            ]),
          ],
        },
        seenSemanticKeysByLevel: {
          ...seenSemanticKeysByLevel,
          [level]: [
            ...new Set([
              ...(seenSemanticKeysByLevel[level] ?? []),
              ...questions.map(jlptQuestionSemanticKey),
            ]),
          ],
        },
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
    });
  historyWriteQueues.set(key, write);
  try {
    await write;
  } finally {
    if (historyWriteQueues.get(key) === write) historyWriteQueues.delete(key);
  }
}
