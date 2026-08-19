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
  const openDatabaseAsync = jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getFirstAsync,
  }));

  jest.doMock("expo-sqlite", () => ({ openDatabaseAsync }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const service = require("../vocabularyFrequencyService") as typeof import("../vocabularyFrequencyService");
  return { service, getFirstAsync, openDatabaseAsync };
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

describe("getCachedVocabularyFrequency", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
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
});
