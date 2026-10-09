import { useCallback, useEffect, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import AudioSessionManager from "../modules/AudioSessionManager";

/** A voice result belongs to the occurrence that requested it, including hidden mixed lanes. */
export function useBunproVoiceAnswer({ enabled, questionKey, language, onAnswer }: { enabled: boolean; questionKey: string; language: "ja-JP" | "en-US"; onAnswer: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const capture = useRef<{ key: string; listening: boolean } | null>(null);
  const latest = useRef({ enabled, questionKey, onAnswer });
  latest.current = { enabled, questionKey, onAnswer };
  const stop = useCallback(() => {
    if (!capture.current) return;
    const wasListening = capture.current.listening;
    capture.current = null; setListening(false);
    try { if (wasListening) ExpoSpeechRecognitionModule.abort(); } catch { /* Already stopped. */ }
    void AudioSessionManager.overrideSpeaker().catch(() => undefined);
  }, []);
  useEffect(() => { if (!enabled || capture.current?.key !== questionKey) stop(); return stop; }, [enabled, questionKey, stop]);
  useSpeechRecognitionEvent("result", event => {
    if (!capture.current?.listening || !latest.current.enabled || capture.current.key !== latest.current.questionKey || !event.isFinal) return;
    const answer = event.results[0]?.transcript?.trim();
    if (answer) latest.current.onAnswer(answer);
  });
  useSpeechRecognitionEvent("end", () => { if (capture.current?.listening) stop(); });
  useSpeechRecognitionEvent("error", () => { if (capture.current?.listening) { setError("Speech recognition could not hear an answer. You can keep typing."); stop(); } });
  const start = async () => {
    if (!enabled || capture.current) return;
    const key = questionKey; capture.current = { key, listening: false }; setError("");
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) { setError("Microphone and speech recognition permission is needed for voice answers."); stop(); return; }
      if (!latest.current.enabled || latest.current.questionKey !== key || capture.current?.key !== key) return;
      capture.current.listening = true;
      setListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language, interimResults: false, continuous: false, addsPunctuation: false });
    } catch { setError("Speech recognition could not start. You can keep typing."); stop(); }
  };
  return { listening, error, start, stop };
}
