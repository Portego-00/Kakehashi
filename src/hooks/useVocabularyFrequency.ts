import { useEffect, useMemo, useState } from "react";
import {
  getVocabularyFrequency,
  type VocabularyFrequencyResult,
  type VocabularyFrequencySubject,
} from "../services/vocabularyFrequencyService";

interface VocabularyFrequencyState {
  result: VocabularyFrequencyResult | null;
  isLoading: boolean;
  error: Error | null;
}

interface InternalVocabularyFrequencyState extends VocabularyFrequencyState {
  requestKey: string;
}

export function useVocabularyFrequency(
  subject: VocabularyFrequencySubject,
): VocabularyFrequencyState {
  const readingsKey = useMemo(
    () =>
      Array.isArray(subject.data.readings)
        ? subject.data.readings
            .filter((reading) => reading.accepted_answer !== false)
            .map((reading) => reading.reading ?? "")
            .join("|")
        : "",
    [subject.data.readings],
  );
  const requestSubject = useMemo<VocabularyFrequencySubject>(
    () => ({
      id: subject.id,
      object: subject.object,
      data: {
        characters: subject.data.characters,
        readings: readingsKey
          ? readingsKey.split("|").map((reading) => ({ reading }))
          : [],
      },
    }),
    [readingsKey, subject.data.characters, subject.id, subject.object],
  );
  const requestKey = `${requestSubject.id}|${requestSubject.object}|${
    requestSubject.data.characters ?? ""
  }|${readingsKey}`;
  const [state, setState] = useState<InternalVocabularyFrequencyState>({
    requestKey,
    result: null,
    isLoading:
      subject.object === "vocabulary" || subject.object === "kana_vocabulary",
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const isVocabulary =
      requestSubject.object === "vocabulary" ||
      requestSubject.object === "kana_vocabulary";

    if (!isVocabulary || !requestSubject.data.characters) {
      setState({ requestKey, result: null, isLoading: false, error: null });
      return () => controller.abort();
    }

    setState({
      requestKey,
      result: null,
      isLoading: true,
      error: null,
    });

    getVocabularyFrequency(requestSubject, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ requestKey, result, isLoading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            requestKey,
            result: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => controller.abort();
  }, [requestKey, requestSubject]);

  if (state.requestKey !== requestKey) {
    return {
      result: null,
      isLoading:
        requestSubject.object === "vocabulary" ||
        requestSubject.object === "kana_vocabulary",
      error: null,
    };
  }

  return {
    result: state.result,
    isLoading: state.isLoading,
    error: state.error,
  };
}
