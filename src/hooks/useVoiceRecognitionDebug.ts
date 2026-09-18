import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceDebugAlternative {
  transcript: string;
  reading: string;
  confidence: number;
}

export interface VoiceDebugTrace {
  id: number;
  subject: string;
  locale: string;
  requiresOnDeviceRecognition: boolean;
  taskHint: string;
  contextualStrings: string[];
  requestedAt: number;
  phase: string;
  firstResultMs?: number;
  latestResultMs?: number;
  final: boolean;
  alternatives: VoiceDebugAlternative[];
  selectedAnswer?: string;
  error?: string;
}

type CaptureDetails = Pick<VoiceDebugTrace,
  "subject" | "locale" | "requiresOnDeviceRecognition" | "taskHint" | "contextualStrings">;

/** Session-only diagnostics: no audio, disk persistence, or analytics. */
export function useVoiceRecognitionDebug(enabled: boolean) {
  const [traces, setTraces] = useState<VoiceDebugTrace[]>([]);
  const nextId = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) setTraces([]);
  }, [enabled]);

  const startTrace = useCallback((details: CaptureDetails): number | undefined => {
    if (!enabledRef.current) return undefined;
    const id = ++nextId.current;
    const trace: VoiceDebugTrace = {
      ...details, id, requestedAt: Date.now(), phase: "Starting", final: false, alternatives: [],
    };
    setTraces((previous) => [trace, ...previous].slice(0, 3));
    return id;
  }, []);

  const updateTrace = useCallback((id: number | undefined, patch: Partial<Pick<VoiceDebugTrace,
    "phase" | "final" | "alternatives" | "selectedAnswer" | "error">>) => {
    if (!enabledRef.current || id === undefined) return;
    const now = Date.now();
    setTraces((previous) => previous.map((trace) => trace.id !== id ? trace : {
      ...trace,
      ...patch,
      ...(patch.alternatives ? {
        firstResultMs: trace.firstResultMs ?? now - trace.requestedAt,
        latestResultMs: now - trace.requestedAt,
      } : {}),
    }));
  }, []);

  const clearTraces = useCallback(() => setTraces([]), []);
  return { traces: enabled ? traces : [], startTrace, updateTrace, clearTraces };
}
