import type { ExpoSpeechRecognitionNativeEventMap, ExpoSpeechRecognitionOptions } from "expo-speech-recognition";
import type { ReviewSpeechNativeModule } from "../../modules/review-speech";

export type ReviewSpeechSelection = {
  engine: "speech-transcriber" | "legacy";
  processing: "on-device" | "system-selected";
  fallbackReason?: string;
};
export type ReviewSpeechEventName = "start" | "end" | "error" | "result" | "volumechange" | "status";
export type ReviewSpeechEvents = ExpoSpeechRecognitionNativeEventMap & {
  status: { message: string };
};
type LegacyRecognizer = {
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  abort(): void;
};

/** Routes controls and scopes new-engine events to a single capture. */
export function createReviewSpeechRecognition(legacy: LegacyRecognizer, native: ReviewSpeechNativeModule | null) {
  let nextSessionId = 0;
  let active: { id: number; selection: ReviewSpeechSelection; cancelled: boolean; subscription?: { remove(): void } } | undefined;
  const listeners = new Map<ReviewSpeechEventName, Set<(payload: never) => void>>();
  const emit = <K extends ReviewSpeechEventName>(name: K, payload: ReviewSpeechEvents[K]) => {
    listeners.get(name)?.forEach((listener) => listener(payload as never));
  };
  const finish = (id: number) => {
    if (active?.id !== id) return;
    active.subscription?.remove();
    active = undefined;
    emit("end", null);
  };
  const fail = (id: number, error: unknown) => {
    if (active?.id !== id) return;
    emit("error", { error: "audio-capture", message: error instanceof Error ? error.message : String(error), code: -1 });
    finish(id);
  };

  return {
    async select(locale: string): Promise<ReviewSpeechSelection> {
      let fallbackReason = "This app build does not include SpeechTranscriber.";
      if (native) {
        try {
          const capability = await native.getCapabilities(locale);
          if (capability.supported) return { engine: "speech-transcriber", processing: "on-device" };
          fallbackReason = capability.reason ?? "SpeechTranscriber does not support this device or language.";
        } catch {
          fallbackReason = "SpeechTranscriber availability could not be checked.";
        }
      }
      return { engine: "legacy", processing: "system-selected", fallbackReason };
    },
    usesLegacy() { return active?.selection.engine !== "speech-transcriber"; },
    subscribe<K extends ReviewSpeechEventName>(name: K, listener: (payload: ReviewSpeechEvents[K]) => void) {
      const group = listeners.get(name) ?? new Set();
      listeners.set(name, group);
      group.add(listener);
      return () => { group.delete(listener); };
    },
    start(options: ExpoSpeechRecognitionOptions, selection: ReviewSpeechSelection) {
      if (active?.selection.engine === "speech-transcriber") throw new Error("Speech recognition is still stopping.");
      const session = { id: ++nextSessionId, selection, cancelled: false, subscription: undefined as { remove(): void } | undefined };
      active = session;
      if (selection.engine === "legacy" || !native) {
        legacy.start(options);
        return;
      }
      session.subscription = native.addListener("speechEvent", (event) => {
        if (active !== session || event.sessionId !== session.id) return;
        if (event.name === "end") { finish(session.id); return; }
        if (session.cancelled) return;
        if (event.name in { start: 1, result: 1, error: 1, volumechange: 1, status: 1 }) {
          emit(event.name as ReviewSpeechEventName, event.payload as ReviewSpeechEvents[ReviewSpeechEventName]);
        }
      });
      void native.start(session.id, options.lang ?? "ja-JP").catch((error) => fail(session.id, error));
    },
    stop() {
      if (active?.selection.engine === "speech-transcriber" && native) {
        const id = active.id;
        void native.stop(id).catch((error) => fail(id, error));
      } else legacy.stop();
    },
    abort() {
      if (active?.selection.engine === "speech-transcriber" && native) {
        const id = active.id;
        active.cancelled = true;
        void native.abort(id).catch((error) => fail(id, error));
      } else legacy.abort();
    },
  };
}
