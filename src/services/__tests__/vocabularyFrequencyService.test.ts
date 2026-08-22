import fetchMock from "jest-fetch-mock";

const NOW = Date.UTC(2026, 7, 18, 12);
const DAY_MS = 24 * 60 * 60 * 1000;

const vocabularySubject = {
  id: 123,
  object: "vocabulary",
  data: {
    characters: "食べる",
    readings: [{ reading: "たべる", accepted_answer: true }],
  },
};

interface CachedRow {
  cache_key: string;
  status: "found" | "not_found";
  frequency_rank: number | null;
  word_id: number | null;
  reading_index: number | null;
  matched_text: string | null;
  matched_reading: string | null;
  source_url: string;
  fetched_at: number;
}

function loadService(cachedRow: CachedRow | null) {
  jest.resetModules();

  const getFirstAsync = jest.fn(async () => cachedRow);
  const runAsync = jest.fn(async () => undefined);
  const openDatabaseAsync = jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getFirstAsync,
    runAsync,
  }));

  jest.doMock("expo-sqlite", () => ({ openDatabaseAsync }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const service = require("../vocabularyFrequencyService") as typeof import("../vocabularyFrequencyService");
  return { service, getFirstAsync, openDatabaseAsync, runAsync };
}

function createFoundRow(fetchedAt: number): CachedRow {
  return {
    cache_key: "123|食べる|たべる",
    status: "found",
    frequency_rank: 1_500,
    word_id: 456,
    reading_index: 0,
    matched_text: "食べる",
    matched_reading: "たべる",
    source_url: "https://jiten.moe/search?query=食べる",
    fetched_at: fetchedAt,
  };
}

function createJitenResponse(
  status = 200,
  retryAfter: string | null = null,
  body: unknown = { results: [], dictionaryResults: [] },
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "retry-after" ? retryAfter : null,
    },
    json: jest.fn(async () => body),
  } as unknown as Response;
}

function createVocabularySubject(id: number) {
  return {
    ...vocabularySubject,
    id,
    data: {
      ...vocabularySubject.data,
      characters: `単語${id}`,
    },
  };
}

describe("getCachedVocabularyFrequency", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns a fresh cached match without requesting Jiten", async () => {
    const { service } = loadService(createFoundRow(NOW - 2 * DAY_MS));

    await expect(
      service.getCachedVocabularyFrequency(vocabularySubject),
    ).resolves.toEqual({
      status: "found",
      result: expect.objectContaining({
        frequencyRank: 1_500,
        fetchedAt: NOW - 2 * DAY_MS,
        isStale: false,
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a stale cached match usable and marks it stale", async () => {
    const { service } = loadService(createFoundRow(NOW - 31 * DAY_MS));

    const lookup = await service.getCachedVocabularyFrequency(vocabularySubject);

    expect(lookup.status).toBe("found");
    if (lookup.status === "found") {
      expect(lookup.result).toMatchObject({
        frequencyRank: 1_500,
        isStale: true,
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("distinguishes a cached not-found result from an uncached subject", async () => {
    const notFoundRow: CachedRow = {
      ...createFoundRow(NOW - 8 * DAY_MS),
      status: "not_found",
      frequency_rank: null,
      word_id: null,
      reading_index: null,
      matched_text: null,
      matched_reading: null,
    };
    const { service: cachedService } = loadService(notFoundRow);

    await expect(
      cachedService.getCachedVocabularyFrequency(vocabularySubject),
    ).resolves.toEqual({
      status: "not_found",
      fetchedAt: NOW - 8 * DAY_MS,
      isStale: true,
    });

    const { service: uncachedService } = loadService(null);
    await expect(
      uncachedService.getCachedVocabularyFrequency(vocabularySubject),
    ).resolves.toEqual({ status: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not initialize the cache for unsupported subject types", async () => {
    const { service, openDatabaseAsync } = loadService(null);

    await expect(
      service.getCachedVocabularyFrequency({
        ...vocabularySubject,
        object: "kanji",
      }),
    ).resolves.toEqual({ status: "missing" });
    expect(openDatabaseAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries database initialization after a transient open failure", async () => {
    jest.resetModules();
    const getFirstAsync = jest.fn(async () => null);
    const openDatabaseAsync = jest
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue({
        execAsync: jest.fn(async () => undefined),
        getFirstAsync,
      });
    jest.doMock("expo-sqlite", () => ({ openDatabaseAsync }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../vocabularyFrequencyService") as typeof import("../vocabularyFrequencyService");

    await expect(
      service.getCachedVocabularyFrequency(vocabularySubject),
    ).rejects.toThrow("database unavailable");
    await expect(
      service.getCachedVocabularyFrequency(vocabularySubject),
    ).resolves.toEqual({ status: "missing" });
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it("preserves Jiten's retry delay when the request limit is reached", async () => {
    const { service, runAsync } = loadService(null);
    fetchMock.mockResponseOnce("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": "2" },
    });

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({
      name: "VocabularyFrequencyRequestError",
      kind: "rate_limit",
      status: 429,
      retryAfterMs: 2_000,
    });
    expect(runAsync).not.toHaveBeenCalled();
  });

  it("accepts an HTTP-date retry delay and falls back to one minute", async () => {
    const retryAt = NOW + 45_000;
    const { service: datedService } = loadService(null);
    fetchMock.mockResponseOnce("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": new Date(retryAt).toUTCString() },
    });

    await expect(
      datedService.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 45_000,
    });

    const { service: fallbackService } = loadService(null);
    fetchMock.mockResponseOnce("Rate limit exceeded", { status: 429 });

    await expect(
      fallbackService.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 60_000,
    });
  });

  it("turns a held request timeout into an automatic one-minute retry", async () => {
    jest.useFakeTimers();
    const { service, runAsync } = loadService(null);
    fetchMock.mockImplementationOnce(
      (_request, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () =>
              reject(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              ),
            { once: true },
          );
        }),
    );

    const assertion = expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({
      name: "VocabularyFrequencyRequestError",
      kind: "timeout",
      status: null,
      retryAfterMs: 60_000,
    });

    await jest.advanceTimersByTimeAsync(8_000);
    await assertion;
    expect(runAsync).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does not cache an unexpected successful response as not found", async () => {
    const { service, runAsync } = loadService(null);
    fetchMock.mockResponseOnce(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({
      name: "VocabularyFrequencyRequestError",
      kind: "invalid_response",
      status: 200,
    });
    expect(runAsync).not.toHaveBeenCalled();
  });

  it("accepts nullable result arrays as a valid not-found response", async () => {
    const { service, runAsync } = loadService(null);
    fetchMock.mockResponseOnce(
      JSON.stringify({ results: null, dictionaryResults: null }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).resolves.toBeNull();
    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls[0]).toContain("not_found");
  });

  it("shares the retry window with later Jiten lookups", async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    const { service } = loadService(null);
    fetchMock
      .mockResponseOnce("Rate limit exceeded", {
        status: 429,
        headers: { "Retry-After": "2" },
      })
      .mockResponseOnce(
        JSON.stringify({
          results: [
            {
              wordId: 456,
              readingIndex: 0,
              text: "食べる",
              rubyText: "食[た]べる",
              frequencyRank: 1_500,
            },
          ],
          dictionaryResults: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({ kind: "rate_limit" });

    const nextLookup = service.getVocabularyFrequency(vocabularySubject);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);
    await expect(nextLookup).resolves.toMatchObject({ frequencyRank: 1_500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it("limits provider concurrency and spaces request starts", async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    const { service } = loadService(null);
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const completeRequests: (() => void)[] = [];
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          activeRequests += 1;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          completeRequests.push(() => {
            activeRequests -= 1;
            resolve(createJitenResponse());
          });
        }),
    );

    const lookups = [1, 2, 3].map((id) =>
      service.getVocabularyFrequency(createVocabularySubject(id)),
    );

    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(maxActiveRequests).toBe(2);

    await jest.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    completeRequests.shift()?.();
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(maxActiveRequests).toBe(2);

    completeRequests.splice(0).forEach((complete) => complete());
    await Promise.all(lookups);
  });

  it("extends a shared block when a later in-flight request has a longer retry delay", async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    const { service } = loadService(null);
    const resolveRequests: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequests.push(resolve);
        }),
    );

    const firstLookup = service.getVocabularyFrequency(
      createVocabularySubject(1),
    );
    const secondLookup = service.getVocabularyFrequency(
      createVocabularySubject(2),
    );
    const queuedLookup = service.getVocabularyFrequency(
      createVocabularySubject(3),
    );
    const firstAssertion = expect(firstLookup).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 2_000,
    });
    const secondAssertion = expect(secondLookup).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 3_000,
    });

    await jest.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveRequests[0](createJitenResponse(429, "2"));
    await jest.advanceTimersByTimeAsync(0);
    await firstAssertion;
    expect(service.getJitenRequestBlockDeadline()).toBe(NOW + 2_250);

    await jest.advanceTimersByTimeAsync(750);
    resolveRequests[1](createJitenResponse(429, "3"));
    await jest.advanceTimersByTimeAsync(0);
    await secondAssertion;
    expect(service.getJitenRequestBlockDeadline()).toBe(NOW + 4_000);

    await jest.advanceTimersByTimeAsync(1_250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1_750);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    resolveRequests[2](createJitenResponse());
    await expect(queuedLookup).resolves.toBeNull();
  });

  it("aborts a queued cooldown wait without starting another request", async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    const { service } = loadService(null);
    fetchMock.mockResponseOnce("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": "2" },
    });

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({ kind: "rate_limit" });

    const controller = new AbortController();
    const queuedLookup = service.getVocabularyFrequency(
      createVocabularySubject(2),
      { signal: controller.signal },
    );
    const queuedAssertion = expect(queuedLookup).rejects.toMatchObject({
      name: "AbortError",
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    controller.abort();
    await queuedAssertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh cache hit immediately during a provider block", async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    const { service, getFirstAsync } = loadService(null);
    fetchMock.mockResponseOnce("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": "2" },
    });

    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).rejects.toMatchObject({ kind: "rate_limit" });
    expect(service.getJitenRequestBlockDeadline()).toBe(NOW + 2_000);

    getFirstAsync.mockResolvedValue(createFoundRow(NOW));
    await expect(
      service.getVocabularyFrequency(vocabularySubject),
    ).resolves.toMatchObject({ frequencyRank: 1_500, isStale: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
