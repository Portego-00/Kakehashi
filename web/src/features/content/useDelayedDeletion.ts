"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DelayedDeletionOptions<T> {
  delay?: number;
  onCommit: (item: T) => Promise<void> | void;
  onError?: (error: unknown, item: T) => void;
}

export function useDelayedDeletion<T>({ delay = 7_000, onCommit, onError }: DelayedDeletionOptions<T>) {
  const [pending, setPending] = useState<T | null>(null);
  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<number | null>(null);
  const commitRef = useRef(onCommit);
  const errorRef = useRef(onError);

  useEffect(() => { commitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  const commit = useCallback((item: T) => {
    void Promise.resolve(commitRef.current(item)).catch((error) => errorRef.current?.(error, item));
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const requestDeletion = useCallback((item: T) => {
    clearTimer();
    if (pendingRef.current) commit(pendingRef.current);
    pendingRef.current = item;
    setPending(item);
    timerRef.current = window.setTimeout(() => {
      const current = pendingRef.current;
      pendingRef.current = null;
      timerRef.current = null;
      setPending(null);
      if (current) commit(current);
    }, delay);
  }, [clearTimer, commit, delay]);

  const undoDeletion = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setPending(null);
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer();
    const current = pendingRef.current;
    pendingRef.current = null;
    if (current) commit(current);
  }, [clearTimer, commit]);

  return { pending, requestDeletion, undoDeletion };
}
