import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  getCachedVocabularyFrequency,
  getVocabularyFrequency,
  type VocabularyFrequencyResult,
  type VocabularyFrequencySubject,
} from "../../services/vocabularyFrequencyService";
import { useVocabularyFrequencyRanks } from "../useVocabularyFrequencyRanks";

jest.mock("../../services/vocabularyFrequencyService", () => ({
  getCachedVocabularyFrequency: jest.fn(),
  getVocabularyFrequency: jest.fn(),
}));

const getCachedFrequencyMock = jest.mocked(getCachedVocabularyFrequency);
const getFrequencyMock = jest.mocked(getVocabularyFrequency);

function createSubject(id: number): VocabularyFrequencySubject {
  return {
    id,
    object: "vocabulary",
    data: {
      characters: `単語${id}`,
      readings: [{ reading: `たんご${id}`, accepted_answer: true }],
    },
  };
}

function createResult(rank: number): VocabularyFrequencyResult {
  return {
    provider: "jiten",
    frequencyRank: rank,
    wordId: rank,
    readingIndex: 0,
    matchedText: `単語${rank}`,
    matchedReading: null,
    sourceUrl: "https://jiten.moe/search",
    fetchedAt: 1,
    isStale: false,
  };
}

describe("useVocabularyFrequencyRanks", () => {
  beforeEach(() => {
    getCachedFrequencyMock.mockReset();
    getFrequencyMock.mockReset();
  });

  it("uses cached ranks first and automatically checks a small missing set", async () => {
    const subjects = [createSubject(1), createSubject(2), createSubject(3)];
    getCachedFrequencyMock.mockImplementation(async (subject) => {
      if (subject.id === 1) {
        return { status: "found", result: createResult(1_500) };
      }
      if (subject.id === 2) {
        return {
          status: "not_found",
          fetchedAt: 1,
          isStale: false,
        };
      }
      return { status: "missing" };
    });
    getFrequencyMock.mockResolvedValue(createResult(900));

    const { result } = renderHook(() =>
      useVocabularyFrequencyRanks({ subjects, enabled: true }),
    );

    await waitFor(() => expect(result.current.dataReady).toBe(true));

    expect(result.current.ranks.get(1)).toBe(1_500);
    expect(result.current.ranks.get(2)).toBeNull();
    expect(result.current.ranks.get(3)).toBe(900);
    expect(getFrequencyMock).toHaveBeenCalledTimes(1);
    expect(getFrequencyMock).toHaveBeenCalledWith(
      subjects[2],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("requires approval before checking a large uncached set", async () => {
    const subjects = [createSubject(1), createSubject(2), createSubject(3)];
    getCachedFrequencyMock.mockResolvedValue({ status: "missing" });
    getFrequencyMock.mockImplementation(async (subject) =>
      createResult(subject.id * 100),
    );

    const { result } = renderHook(() =>
      useVocabularyFrequencyRanks({
        subjects,
        enabled: true,
        automaticLookupLimit: 1,
      }),
    );

    await waitFor(() => expect(result.current.needsApproval).toBe(true));
    expect(result.current.unresolvedCount).toBe(3);
    expect(getFrequencyMock).not.toHaveBeenCalled();

    act(() => result.current.approveLookup());

    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(getFrequencyMock).toHaveBeenCalledTimes(3);
  });

  it("halts on a local cache error and retries without sending words", async () => {
    const subjects = [createSubject(1)];
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    getCachedFrequencyMock.mockRejectedValueOnce(new Error("SQLite failed"));
    getFrequencyMock.mockResolvedValue(createResult(800));

    const { result } = renderHook(() =>
      useVocabularyFrequencyRanks({ subjects, enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.lookupError).toEqual({ phase: "cache" }),
    );
    expect(getFrequencyMock).not.toHaveBeenCalled();

    getCachedFrequencyMock.mockResolvedValue({ status: "missing" });
    act(() => result.current.retryLookup());

    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(result.current.ranks.get(1)).toBe(800);
    warnSpy.mockRestore();
  });

  it("keeps completed network results and retries only unresolved words", async () => {
    const subjects = [createSubject(1), createSubject(2)];
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let rejectSecondLookup: ((reason?: unknown) => void) | null = null;

    getCachedFrequencyMock.mockResolvedValue({ status: "missing" });
    getFrequencyMock.mockImplementation((subject) => {
      if (subject.id === 1) {
        return Promise.resolve(createResult(1_000));
      }
      return new Promise((_, reject) => {
        rejectSecondLookup = reject;
      });
    });

    const { result } = renderHook(() =>
      useVocabularyFrequencyRanks({ subjects, enabled: true }),
    );

    await waitFor(() => expect(getFrequencyMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      rejectSecondLookup?.(new Error("offline"));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.lookupError).toEqual({ phase: "network" }),
    );
    expect(result.current.ranks.get(1)).toBe(1_000);
    expect(result.current.ranks.has(2)).toBe(false);

    getFrequencyMock.mockImplementation(async (subject) =>
      createResult(subject.id * 1_000),
    );
    act(() => result.current.retryLookup());

    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(result.current.ranks.get(2)).toBe(2_000);
    expect(getFrequencyMock).toHaveBeenCalledTimes(3);
    warnSpy.mockRestore();
  });

  it("clears an old not-found rank before refreshing a stale rescan", async () => {
    const subjects = [createSubject(1)];
    getCachedFrequencyMock
      .mockResolvedValueOnce({
        status: "not_found",
        fetchedAt: 1,
        isStale: false,
      })
      .mockResolvedValueOnce({
        status: "not_found",
        fetchedAt: 1,
        isStale: true,
      });
    getFrequencyMock.mockResolvedValue(createResult(700));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useVocabularyFrequencyRanks({ subjects, enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(result.current.ranks.get(1)).toBeNull();

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.dataReady).toBe(true));
    rerender({ enabled: true });

    await waitFor(() => expect(result.current.ranks.get(1)).toBe(700));
    expect(getFrequencyMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates readiness before a same-candidate forced rescan", async () => {
    const subjects = [createSubject(1)];
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let resolveRescan:
      | ((value: {
          status: "found";
          result: VocabularyFrequencyResult;
        }) => void)
      | null = null;

    getCachedFrequencyMock
      .mockResolvedValueOnce({ status: "missing" })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRescan = resolve;
          }),
      );
    getFrequencyMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() =>
      useVocabularyFrequencyRanks({ subjects, enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.lookupError).toEqual({ phase: "network" }),
    );
    expect(getFrequencyMock).toHaveBeenCalledTimes(1);

    act(() => result.current.resetLookupState());
    await waitFor(() => expect(getCachedFrequencyMock).toHaveBeenCalledTimes(2));
    expect(getFrequencyMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRescan?.({ status: "found", result: createResult(500) });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(result.current.ranks.get(1)).toBe(500);
    expect(getFrequencyMock).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("cancels an in-flight lookup when the candidate set changes", async () => {
    const firstSubjects = [createSubject(1)];
    const secondSubjects = [createSubject(2)];
    let firstSignal: AbortSignal | undefined;

    getCachedFrequencyMock.mockResolvedValue({ status: "missing" });
    getFrequencyMock.mockImplementation((subject, options) => {
      if (subject.id === 2) {
        return Promise.resolve(createResult(600));
      }

      firstSignal = options?.signal;
      return new Promise((_, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () =>
            reject(
              Object.assign(new Error("cancelled"), { name: "AbortError" }),
            ),
          { once: true },
        );
      });
    });

    const { result, rerender } = renderHook(
      ({ subjects }: { subjects: VocabularyFrequencySubject[] }) =>
        useVocabularyFrequencyRanks({ subjects, enabled: true }),
      { initialProps: { subjects: firstSubjects } },
    );

    await waitFor(() => expect(firstSignal).toBeDefined());
    rerender({ subjects: secondSubjects });

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    await waitFor(() => expect(result.current.dataReady).toBe(true));
    expect(result.current.ranks.has(1)).toBe(false);
    expect(result.current.ranks.get(2)).toBe(600);
  });
});
