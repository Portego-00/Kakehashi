import {
  JLPT_BANK_VERSION,
  type JlptLevel,
  type JlptQuestion,
  type JlptSession,
} from "./types";
import { jlptQuestionSemanticKey } from "./editorial";

const PREFIX = "kakehashi:jlpt:v1";
export const JLPT_SESSION_EVENT = "kakehashi-jlpt-session-change";

interface JlptQuestionHistory {
  version: 1;
  bankVersion: typeof JLPT_BANK_VERSION;
  seenByLevel: Partial<Record<JlptLevel, string[]>>;
  seenSemanticKeysByLevel?: Partial<Record<JlptLevel, string[]>>;
}

export function jlptSessionKey(scope: string | number) {
  return `${PREFIX}:account:${encodeURIComponent(String(scope))}:session`;
}

export function jlptQuestionHistoryKey(scope: string | number) {
  return `${PREFIX}:account:${encodeURIComponent(String(scope))}:question-history`;
}

export function jlptSessionSnapshot(scope: string | number) {
  if (!canStore()) return "";
  return window.localStorage.getItem(jlptSessionKey(scope)) ?? "";
}

function canStore() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function loadJlptSession(scope: string | number): JlptSession | null {
  if (!canStore()) return null;
  return parseJlptSessionSnapshot(
    window.localStorage.getItem(jlptSessionKey(scope)) ?? "",
  );
}

function parseJlptQuestionHistory(raw: string): JlptQuestionHistory | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<JlptQuestionHistory>;
    if (
      value.version !== 1 ||
      value.bankVersion !== JLPT_BANK_VERSION ||
      !value.seenByLevel ||
      typeof value.seenByLevel !== "object"
    )
      return null;
    return value as JlptQuestionHistory;
  } catch {
    return null;
  }
}

export function loadJlptQuestionHistory(
  scope: string | number,
  level: JlptLevel,
) {
  if (!canStore()) return new Set<string>();
  const history = parseJlptQuestionHistory(
    window.localStorage.getItem(jlptQuestionHistoryKey(scope)) ?? "",
  );
  const ids = history?.seenByLevel[level];
  return new Set(
    Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [],
  );
}

export function loadJlptSemanticHistory(
  scope: string | number,
  level: JlptLevel,
) {
  if (!canStore()) return new Set<string>();
  const history = parseJlptQuestionHistory(
    window.localStorage.getItem(jlptQuestionHistoryKey(scope)) ?? "",
  );
  const keys = history?.seenSemanticKeysByLevel?.[level];
  return new Set(
    Array.isArray(keys)
      ? keys.filter((key): key is string => typeof key === "string")
      : [],
  );
}

export function rememberJlptQuestions(
  scope: string | number,
  level: JlptLevel,
  questionIds: readonly string[],
) {
  if (!canStore()) return false;
  try {
    const key = jlptQuestionHistoryKey(scope);
    const current = parseJlptQuestionHistory(
      window.localStorage.getItem(key) ?? "",
    );
    const seenByLevel = current?.seenByLevel ?? {};
    const nextIds = [
      ...new Set([...(seenByLevel[level] ?? []), ...questionIds]),
    ];
    const next: JlptQuestionHistory = {
      version: 1,
      bankVersion: JLPT_BANK_VERSION,
      seenByLevel: { ...seenByLevel, [level]: nextIds },
      seenSemanticKeysByLevel: current?.seenSemanticKeysByLevel,
    };
    window.localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function rememberJlptQuestionSelection(
  scope: string | number,
  level: JlptLevel,
  questions: readonly JlptQuestion[],
) {
  if (!canStore()) return false;
  try {
    const key = jlptQuestionHistoryKey(scope);
    const current = parseJlptQuestionHistory(
      window.localStorage.getItem(key) ?? "",
    );
    const seenByLevel = current?.seenByLevel ?? {};
    const seenSemanticKeysByLevel = current?.seenSemanticKeysByLevel ?? {};
    const questionIds = questions.map((question) => question.id);
    const semanticKeys = questions.map(jlptQuestionSemanticKey);
    const next: JlptQuestionHistory = {
      version: 1,
      bankVersion: JLPT_BANK_VERSION,
      seenByLevel: {
        ...seenByLevel,
        [level]: [...new Set([...(seenByLevel[level] ?? []), ...questionIds])],
      },
      seenSemanticKeysByLevel: {
        ...seenSemanticKeysByLevel,
        [level]: [
          ...new Set([
            ...(seenSemanticKeysByLevel[level] ?? []),
            ...semanticKeys,
          ]),
        ],
      },
    };
    window.localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function parseJlptSessionSnapshot(raw: string): JlptSession | null {
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
    )
      return null;
    return {
      ...value,
      listeningPlays: value.listeningPlays ?? {},
    } as JlptSession;
  } catch {
    return null;
  }
}

export function saveJlptSession(scope: string | number, session: JlptSession) {
  if (!canStore()) return false;
  try {
    window.localStorage.setItem(jlptSessionKey(scope), JSON.stringify(session));
    window.dispatchEvent(
      new CustomEvent(JLPT_SESSION_EVENT, { detail: { scope: String(scope) } }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearJlptSession(scope: string | number) {
  if (!canStore()) return;
  window.localStorage.removeItem(jlptSessionKey(scope));
  window.dispatchEvent(
    new CustomEvent(JLPT_SESSION_EVENT, { detail: { scope: String(scope) } }),
  );
}

export function subscribeJlptSession(
  scope: string | number,
  onChange: () => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const key = jlptSessionKey(scope);
  const normalizedScope = String(scope);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  const onSession = (event: Event) => {
    if (
      (event as CustomEvent<{ scope?: string }>).detail?.scope ===
      normalizedScope
    )
      onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(JLPT_SESSION_EVENT, onSession);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(JLPT_SESSION_EVENT, onSession);
  };
}
