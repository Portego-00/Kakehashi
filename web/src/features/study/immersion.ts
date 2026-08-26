import type { StudyFilters, StudyQuestion } from "./types";

export interface ImmersionExample {
  sentence: string;
  translation: string;
  title: string;
  audio?: string;
  imageUrl?: string;
}

const DEFAULT_RATE_LIMIT_DELAY_MS = 2_000;
const MAX_RATE_LIMIT_DELAY_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 3;

class ImmersionLookupError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs?: number) {
    super(message);
    this.name = "ImmersionLookupError";
  }
}

function retryDelay(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function fetchImmersionExamples(characters: string, sources: string[], signal?: AbortSignal): Promise<ImmersionExample[]> {
  const response = await fetch("/api/study/immersion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: characters, sources }),
    signal,
  });
  if (!response.ok) throw new ImmersionLookupError(`Immersion lookup failed with ${response.status}.`, response.status, retryDelay(response));
  const payload = await response.json() as { examples?: ImmersionExample[]; example?: ImmersionExample | null };
  if (Array.isArray(payload.examples)) return payload.examples;
  return payload.example ? [payload.example] : [];
}

export async function fetchImmersionExample(characters: string, sources: string[], signal?: AbortSignal): Promise<ImmersionExample | null> {
  return (await fetchImmersionExamples(characters, sources, signal))[0] ?? null;
}

interface StreamAnimeContextOptions {
  limit?: number;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}

async function fetchImmersionExampleWithRetry(characters: string, sources: string[], { signal, sleep = (ms) => wait(ms, signal) }: StreamAnimeContextOptions): Promise<ImmersionExample | null> {
  let rateLimitRetries = 0;
  while (true) {
    try {
      return await fetchImmersionExample(characters, sources, signal);
    } catch (error) {
      if (!(error instanceof ImmersionLookupError) || error.status !== 429 || rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) throw error;
      rateLimitRetries += 1;
      const delay = Math.min(MAX_RATE_LIMIT_DELAY_MS, error.retryAfterMs ?? DEFAULT_RATE_LIMIT_DELAY_MS * rateLimitRetries);
      await sleep(delay);
    }
  }
}

function enrichQuestion(question: StudyQuestion, example: ImmersionExample, characterPool: string[], filters: StudyFilters): StudyQuestion {
  const characters = question.characters!;
  const masked = example.sentence.replaceAll(characters, "＿＿");
  const characterPhase = question.kind === "listening-characters";
  const distractors = characterPool.filter((value) => value !== characters).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = filters.answerMode === "multiple-choice"
    ? characterPhase
      ? [characters, ...distractors].sort(() => Math.random() - 0.5)
      : question.choices
    : undefined;
  return {
    ...question,
    prompt: masked,
    promptLabel: `${question.promptLabel} · ${example.title}`,
    choices,
    audioUrl: example.audio,
    imageUrl: example.imageUrl,
    sourceTitle: example.title,
    sentence: { ja: example.sentence, en: example.translation, masked },
  };
}

/**
 * Resolves one vocabulary item's two listening phases at a time. The caller can
 * start a session from the first yielded batch while the remaining clips load.
 */
export async function* streamAnimeContext(questions: StudyQuestion[], filters: StudyFilters, options: StreamAnimeContextOptions = {}): AsyncGenerator<StudyQuestion[]> {
  const characterPool = [...new Set(questions.map((question) => question.characters).filter((value): value is string => Boolean(value)))];
  const groupedQuestions = new Map<string, StudyQuestion[]>();
  for (const question of questions) {
    if (!question.characters) continue;
    groupedQuestions.set(question.characters, [...(groupedQuestions.get(question.characters) ?? []), question]);
  }

  const limit = Math.max(0, options.limit ?? Number.POSITIVE_INFINITY);
  let yielded = 0;
  for (const [characters, group] of groupedQuestions) {
    if (yielded >= limit || options.signal?.aborted) return;
    try {
      const example = await fetchImmersionExampleWithRetry(characters, filters.animeSources, options);
      if (!example?.audio || !example.imageUrl || !example.sentence.includes(characters)) continue;
      const batch = group.slice(0, limit - yielded).map((question) => enrichQuestion(question, example, characterPool, filters));
      if (!batch.length) continue;
      yielded += batch.length;
      yield batch;
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      // One missing or failed example should not prevent the remainder from loading.
    }
  }
}

export async function addAnimeContext(questions: StudyQuestion[], filters: StudyFilters): Promise<StudyQuestion[]> {
  const enriched: StudyQuestion[] = [];
  for await (const batch of streamAnimeContext(questions, filters)) enriched.push(...batch);
  return enriched;
}
