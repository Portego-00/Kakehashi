"use client";

import {
  WaniKaniApiError,
  getWaniKaniSummary,
  getWaniKaniSummaryCounts,
  type WaniKaniSummaryCounts,
} from "@kakehashi/core";
import { useEffect, useState } from "react";
import {
  loadWaniKaniSession,
  type StoredWaniKaniSession,
} from "./wanikani-session";

type WaniKaniSummaryState = {
  counts: WaniKaniSummaryCounts;
  dataUpdatedAt: string | null;
  error: string | null;
  session: StoredWaniKaniSession | null;
  status: "missing" | "loading" | "ready" | "error";
};

const emptyCounts: WaniKaniSummaryCounts = {
  lessons: 0,
  reviews: 0,
};

export function useWaniKaniSummary(): WaniKaniSummaryState {
  const [state, setState] = useState<WaniKaniSummaryState>({
    counts: emptyCounts,
    dataUpdatedAt: null,
    error: null,
    session: null,
    status: "loading",
  });

  useEffect(() => {
    let isCancelled = false;
    const session = loadWaniKaniSession();

    if (!session) {
      setState({
        counts: emptyCounts,
        dataUpdatedAt: null,
        error: null,
        session: null,
        status: "missing",
      });
      return;
    }

    setState((current) => ({
      ...current,
      error: null,
      session,
      status: "loading",
    }));

    getWaniKaniSummary(session.apiToken)
      .then((summary) => {
        if (isCancelled) return;

        setState({
          counts: getWaniKaniSummaryCounts(summary.data),
          dataUpdatedAt: summary.data_updated_at,
          error: null,
          session,
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        setState({
          counts: emptyCounts,
          dataUpdatedAt: null,
          error: getSummaryErrorMessage(error),
          session,
          status: "error",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}

function getSummaryErrorMessage(error: unknown): string {
  if (error instanceof WaniKaniApiError) {
    if (error.status === 401) {
      return "The saved WaniKani token is no longer valid.";
    }

    return error.message;
  }

  return "Could not load WaniKani queue data.";
}
