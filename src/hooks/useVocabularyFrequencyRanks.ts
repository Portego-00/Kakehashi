import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getCachedVocabularyFrequency,
  getJitenRequestBlockDeadline,
  getVocabularyFrequency,
  VocabularyFrequencyRequestError,
  type VocabularyFrequencySubject,
} from "../services/vocabularyFrequencyService";

const CACHE_LOOKUP_CONCURRENCY = 12;
const NETWORK_LOOKUP_CONCURRENCY = 2;
const NETWORK_RESULT_FLUSH_SIZE = 25;
const MAX_NO_PROGRESS_AUTOMATIC_RETRIES = 3;
export const DEFAULT_AUTOMATIC_FREQUENCY_LOOKUP_LIMIT = 50;

export type VocabularyFrequencyLookupError =
  | { phase: "cache" }
  | {
      phase: "network";
      reason: "request";
      cause?: "rate_limit" | "timeout";
      retryAt?: number;
    }
  | {
      phase: "network";
      reason: "automatic_retry";
      cause: "rate_limit" | "timeout";
      retryAt: number;
    };

interface UseVocabularyFrequencyRanksOptions {
  subjects: readonly VocabularyFrequencySubject[];
  enabled: boolean;
  automaticLookupLimit?: number;
}

export interface VocabularyFrequencyProgress {
  completed: number;
  total: number;
}

export function useVocabularyFrequencyRanks({
  subjects,
  enabled,
  automaticLookupLimit = DEFAULT_AUTOMATIC_FREQUENCY_LOOKUP_LIMIT,
}: UseVocabularyFrequencyRanksOptions) {
  const [ranks, setRanks] = useState<Map<number, number | null>>(new Map());
  const [isScanningCache, setIsScanningCache] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cacheScanKey, setCacheScanKey] = useState<string | null>(null);
  const [approvedLookupKey, setApprovedLookupKey] = useState<string | null>(
    null,
  );
  const [lookupError, setLookupError] =
    useState<VocabularyFrequencyLookupError | null>(null);
  const [cacheRetryToken, setCacheRetryToken] = useState(0);
  const [progress, setProgress] = useState<VocabularyFrequencyProgress>({
    completed: 0,
    total: 0,
  });
  const noProgressAutomaticRetryCountRef = useRef(0);

  const candidateKey = useMemo(
    () => subjects.map((subject) => subject.id).join(","),
    [subjects],
  );
  const candidateSubjectsRef = useRef({ candidateKey, subjects });
  if (candidateSubjectsRef.current.candidateKey !== candidateKey) {
    candidateSubjectsRef.current = { candidateKey, subjects };
  }
  const candidateSubjects = candidateSubjectsRef.current.subjects;

  useEffect(() => {
    if (!enabled) {
      noProgressAutomaticRetryCountRef.current = 0;
      setIsScanningCache(false);
      setCacheScanKey(null);
      setLookupError(null);
      setProgress({ completed: 0, total: 0 });
      return;
    }

    let isDisposed = false;
    let didFail = false;
    let nextSubjectIndex = 0;
    let completedLookups = 0;
    const progressUpdateInterval = Math.max(
      1,
      Math.ceil(candidateSubjects.length / 20),
    );
    const cachedRanks = new Map<number, number | null>();

    noProgressAutomaticRetryCountRef.current = 0;
    setIsScanningCache(true);
    setCacheScanKey(null);
    setLookupError(null);
    setProgress({ completed: 0, total: candidateSubjects.length });

    const scanNext = async () => {
      while (!isDisposed && !didFail) {
        const subjectIndex = nextSubjectIndex;
        nextSubjectIndex += 1;
        if (subjectIndex >= candidateSubjects.length) {
          return;
        }

        const subject = candidateSubjects[subjectIndex];
        try {
          const cached = await getCachedVocabularyFrequency(subject);
          if (cached.status === "found") {
            cachedRanks.set(subject.id, cached.result.frequencyRank);
          } else if (cached.status === "not_found" && !cached.isStale) {
            cachedRanks.set(subject.id, null);
          }
        } catch (error) {
          if (!isDisposed) {
            didFail = true;
            console.warn(
              `[Vocabulary Frequency] Failed to read the local cache for subject ${subject.id}:`,
              error,
            );
          }
          return;
        }

        completedLookups += 1;
        if (
          !isDisposed &&
          (completedLookups === candidateSubjects.length ||
            completedLookups % progressUpdateInterval === 0)
        ) {
          setProgress({
            completed: completedLookups,
            total: candidateSubjects.length,
          });
        }
      }
    };

    const workerCount = Math.min(
      CACHE_LOOKUP_CONCURRENCY,
      candidateSubjects.length,
    );
    void Promise.all(
      Array.from({ length: workerCount }, () => scanNext()),
    ).then(() => {
      if (isDisposed) {
        return;
      }

      setRanks((previous) => {
        const next = new Map(previous);
        candidateSubjects.forEach((subject) => next.delete(subject.id));
        cachedRanks.forEach((rank, subjectId) => next.set(subjectId, rank));
        return next;
      });
      setIsScanningCache(false);

      if (didFail) {
        setCacheScanKey(null);
        setLookupError({ phase: "cache" });
      } else {
        setCacheScanKey(candidateKey);
      }
    });

    return () => {
      isDisposed = true;
    };
  }, [cacheRetryToken, candidateKey, candidateSubjects, enabled]);

  const cacheReady =
    !enabled || (!isScanningCache && cacheScanKey === candidateKey);
  const unresolvedSubjects = useMemo(
    () =>
      cacheReady
        ? candidateSubjects.filter((subject) => !ranks.has(subject.id))
        : [],
    [cacheReady, candidateSubjects, ranks],
  );
  const needsApproval =
    enabled &&
    cacheReady &&
    unresolvedSubjects.length > automaticLookupLimit &&
    approvedLookupKey !== candidateKey;

  useEffect(() => {
    if (lookupError?.phase !== "network") {
      return;
    }

    const retryAt = lookupError.retryAt;
    if (retryAt === undefined) {
      return;
    }

    const timeoutId = setTimeout(
      () => {
        setLookupError((current) => {
          if (
            current?.phase !== "network" ||
            current.retryAt !== retryAt
          ) {
            return current;
          }

          const sharedRetryAt = getJitenRequestBlockDeadline();
          if (sharedRetryAt > Date.now()) {
            return { ...current, retryAt: sharedRetryAt };
          }

          if (current.reason === "automatic_retry") {
            return null;
          }

          return current.cause
            ? {
                phase: "network",
                reason: "request",
                cause: current.cause,
              }
            : { phase: "network", reason: "request" };
        });
      },
      Math.max(0, retryAt - Date.now()),
    );

    return () => clearTimeout(timeoutId);
  }, [lookupError]);

  useEffect(() => {
    if (!enabled || !cacheReady || needsApproval || lookupError) {
      setIsLoading(false);
      return;
    }

    if (unresolvedSubjects.length === 0) {
      setIsLoading(false);
      setProgress({
        completed: candidateSubjects.length,
        total: candidateSubjects.length,
      });
      return;
    }

    const controller = new AbortController();
    const attemptSubjects = unresolvedSubjects.slice(
      0,
      NETWORK_RESULT_FLUSH_SIZE,
    );
    const loadedRanks = new Map<number, number | null>();
    let isDisposed = false;
    let failure: unknown = null;
    let nextSubjectIndex = 0;
    const initiallyResolvedCount =
      candidateSubjects.length - unresolvedSubjects.length;
    let completedLookups = initiallyResolvedCount;
    const progressUpdateInterval = Math.max(
      1,
      Math.ceil(attemptSubjects.length / 20),
    );

    setIsLoading(true);
    setProgress({
      completed: initiallyResolvedCount,
      total: candidateSubjects.length,
    });

    const loadNext = async () => {
      while (!controller.signal.aborted && !isDisposed) {
        const subjectIndex = nextSubjectIndex;
        nextSubjectIndex += 1;
        if (subjectIndex >= attemptSubjects.length) {
          return;
        }

        const subject = attemptSubjects[subjectIndex];
        try {
          const result = await getVocabularyFrequency(subject, {
            signal: controller.signal,
          });
          if (isDisposed) {
            return;
          }

          loadedRanks.set(subject.id, result?.frequencyRank ?? null);
          completedLookups += 1;
          if (
            completedLookups === candidateSubjects.length ||
            (completedLookups - initiallyResolvedCount) %
              progressUpdateInterval ===
              0
          ) {
            setProgress({
              completed: completedLookups,
              total: candidateSubjects.length,
            });
          }
        } catch (error) {
          if (isDisposed || (controller.signal.aborted && failure !== null)) {
            return;
          }

          failure = error;
          console.warn(
            `[Vocabulary Frequency] Failed to load a rank for subject ${subject.id}:`,
            error,
          );
          controller.abort();
          return;
        }
      }
    };

    const workerCount = Math.min(
      NETWORK_LOOKUP_CONCURRENCY,
      attemptSubjects.length,
    );
    void Promise.all(
      Array.from({ length: workerCount }, () => loadNext()),
    ).then(() => {
      if (isDisposed) {
        return;
      }

      setRanks((previous) => {
        const next = new Map(previous);
        loadedRanks.forEach((rank, subjectId) => next.set(subjectId, rank));
        return next;
      });
      setIsLoading(false);
      if (failure instanceof VocabularyFrequencyRequestError) {
        if (failure.kind === "rate_limit" || failure.kind === "timeout") {
          noProgressAutomaticRetryCountRef.current =
            loadedRanks.size > 0
              ? 0
              : noProgressAutomaticRetryCountRef.current + 1;
          if (
            noProgressAutomaticRetryCountRef.current >=
            MAX_NO_PROGRESS_AUTOMATIC_RETRIES
          ) {
            const retryAt =
              Date.now() +
              Math.max(1_000, failure.retryAfterMs ?? 60_000);
            setLookupError({
              phase: "network",
              reason: "request",
              cause: failure.kind,
              retryAt,
            });
            return;
          }
          setLookupError({
            phase: "network",
            reason: "automatic_retry",
            cause: failure.kind,
            retryAt:
              Date.now() + Math.max(1_000, failure.retryAfterMs ?? 60_000),
          });
          return;
        }
      }
      if (failure !== null) {
        noProgressAutomaticRetryCountRef.current = 0;
        setLookupError({ phase: "network", reason: "request" });
      } else {
        noProgressAutomaticRetryCountRef.current = 0;
      }
    });

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [
    cacheReady,
    candidateSubjects.length,
    enabled,
    lookupError,
    needsApproval,
    unresolvedSubjects,
  ]);

  const approveLookup = useCallback(() => {
    setApprovedLookupKey(candidateKey);
  }, [candidateKey]);

  const retryLookup = useCallback(() => {
    if (lookupError?.phase === "cache") {
      setLookupError(null);
      setCacheRetryToken((current) => current + 1);
      return;
    }

    if (lookupError?.phase === "network") {
      const retryAt = Math.max(
        lookupError.retryAt ?? 0,
        getJitenRequestBlockDeadline(),
      );
      if (Date.now() < retryAt) {
        setLookupError({ ...lookupError, retryAt });
        return;
      }
    }

    noProgressAutomaticRetryCountRef.current = 0;
    setLookupError(null);
  }, [lookupError]);

  const resetLookupState = useCallback(() => {
    noProgressAutomaticRetryCountRef.current = 0;
    setApprovedLookupKey(null);
    setCacheScanKey(null);
    setLookupError(null);
    setCacheRetryToken((current) => current + 1);
  }, []);

  const resolvedCount = cacheReady
    ? candidateSubjects.length - unresolvedSubjects.length
    : 0;
  const canUseResults =
    !enabled ||
    (cacheReady && (resolvedCount > 0 || unresolvedSubjects.length === 0));

  return {
    ranks,
    isScanningCache,
    isLoading,
    progress,
    dataReady: !enabled || (cacheReady && unresolvedSubjects.length === 0),
    canUseResults,
    resolvedCount,
    needsApproval,
    unresolvedCount: unresolvedSubjects.length,
    lookupError,
    approveLookup,
    retryLookup,
    resetLookupState,
  };
}
