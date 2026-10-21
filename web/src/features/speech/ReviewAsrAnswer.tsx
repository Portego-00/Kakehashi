"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { hasEnglishAsr } from "./english-asr-assets";
import { canUseReviewAsr } from "./review-asr-access";
import { hasJapaneseAsr, JAPANESE_ASR_CHANGED, supportsJapaneseAsr } from "./japanese-asr-assets";
import { recordJapaneseReading } from "./japanese-asr-recorder";
import type { AsrLanguage, JapaneseAsrRequest, JapaneseAsrResponse } from "./japanese-asr-protocol";
import styles from "./review-asr.module.css";

type Props = { language?: AsrLanguage; enabled?: boolean; onStart?: () => void; questionKey: string; value: string; blocked: boolean; onTranscript: (text: string) => void };

export function ReviewAsrAnswer(props: Props) {
  const { user, isDemo, status } = useSession();
  const preferences = useWebSettings(user?.data.username ?? "anonymous").study;
  if (status !== "authenticated" || !canUseReviewAsr(user?.data.username, isDemo)) return null;
  return <LocalReviewAsrAnswer {...props} enabled={props.enabled ?? preferences.reviewAsrEnabled} />;
}

const noopSubscribe = () => () => {};
function LocalReviewAsrAnswer({ questionKey, value, blocked, onTranscript, onStart, language = "ja", enabled }: Props) {
  const supported = useSyncExternalStore(noopSubscribe, supportsJapaneseAsr, () => false);
  const [saved, setSaved] = useState(false);
  const [activity, setActivity] = useState<"idle" | "preparing" | "listening" | "recognizing">("idle");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const finishRecording = useRef<(() => void) | null>(null);
  const worker = useRef<Worker | null>(null);
  const ready = useRef(false);
  const pending = useRef<((error: Error) => void) | null>(null);
  const sequence = useRef(0);

  function disposeWorker() {
    worker.current?.terminate(); worker.current = null; ready.current = false;
    pending.current?.(new DOMException("Recognition cancelled.", "AbortError")); pending.current = null;
  }
  function cancel() {
    controller.current?.abort(); controller.current = null; finishRecording.current = null;
    if (pending.current) disposeWorker();
  }
  useEffect(() => {
    let active = true;
    const check = () => { void (language === "en" ? hasEnglishAsr() : hasJapaneseAsr()).then(saved => { if (active) setSaved(saved); }).catch(() => { if (active) setSaved(false); }); };
    const changed = () => { cancel(); disposeWorker(); setActivity("idle"); check(); };
    check();
    const hidden = () => { if (document.hidden) { cancel(); disposeWorker(); setActivity("idle"); } };
    window.addEventListener(JAPANESE_ASR_CHANGED, changed);
    document.addEventListener("visibilitychange", hidden);
    return () => { active = false; cancel(); disposeWorker(); window.removeEventListener(JAPANESE_ASR_CHANGED, changed); document.removeEventListener("visibilitychange", hidden); };
    // This effect owns the recorder and worker for this mounted control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  useEffect(() => () => { cancel(); setActivity("idle"); setError(""); }, [questionKey, value, blocked, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function request(type: "prepare" | "recognize", samples?: Float32Array) {
    worker.current ??= new Worker(new URL("./japanese-asr.worker.ts", import.meta.url), { type: "module" });
    const currentWorker = worker.current;
    const id = ++sequence.current;
    return new Promise<JapaneseAsrResponse>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, result?: JapaneseAsrResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); currentWorker.onmessage = null; currentWorker.onerror = null; pending.current = null;
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => { finish(new Error("Speech recognition took too long. Try a shorter answer or type it.")); disposeWorker(); }, 90_000);
      pending.current = error => finish(error);
      currentWorker.onmessage = ({ data }: MessageEvent<JapaneseAsrResponse>) => {
        if (data.id !== id) return;
        finish(data.error ? new Error(data.error) : undefined, data);
      };
      currentWorker.onerror = () => { finish(new Error("The local speech model could not run in this browser. You can keep typing.")); disposeWorker(); };
      const message: JapaneseAsrRequest = type === "recognize" ? { id, type, language, samples: samples! } : { id, type, language };
      try { currentWorker.postMessage(message, samples ? [samples.buffer] : []); }
      catch { finish(new Error("Speech recognition could not start. Try again or type your answer.")); disposeWorker(); }
    });
  }

  async function start() {
    if (!enabled || !supported || !saved || blocked || controller.current) return;
    onStart?.();
    const capture = new AbortController(); controller.current = capture;
    setError("");
    try {
      if (!ready.current) { setActivity("preparing"); await request("prepare"); ready.current = true; }
      capture.signal.throwIfAborted();
      setActivity("preparing");
      const samples = await recordJapaneseReading(capture.signal, finish => { finishRecording.current = finish; setActivity("listening"); });
      capture.signal.throwIfAborted();
      finishRecording.current = null;
      setActivity("recognizing");
      const result = await request("recognize", samples);
      capture.signal.throwIfAborted();
      controller.current = null;
      setActivity("idle");
      if (result.text) onTranscript(result.text);
    } catch (cause) {
      if (capture.signal.aborted) return;
      controller.current = null; setActivity("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser or keep typing." : cause instanceof Error ? cause.message : "Speech recognition failed. Try again or type it.");
    }
  }

  return <div className={styles.answerControl}>
    <Button type="button" tone="ghost" size="small" disabled={blocked || !enabled || !saved || !supported || activity === "preparing" || activity === "recognizing"} onClick={() => activity === "listening" ? finishRecording.current?.() : void start()}>
      {activity === "listening" ? <Square size={16} aria-hidden /> : <Mic size={17} aria-hidden />}
      {activity === "listening" ? "Stop recording" : activity === "preparing" ? "Preparing microphone…" : activity === "recognizing" ? "Recognizing…" : "Record answer"}
    </Button>
    {activity !== "idle" ? <Button type="button" tone="ghost" size="small" onClick={() => { cancel(); setActivity("idle"); }} aria-label="Cancel speech recognition"><X size={16} aria-hidden />Cancel</Button> : null}
    <span role={error ? "alert" : "status"} className={styles.status}>{error || (!supported ? "Local speech recognition is unavailable in this browser." : !saved ? `Download ${language === "en" ? "English" : "Japanese"} speech recognition in Settings → Reviews.` : !enabled ? "Enable voice answers in Settings → Reviews." : activity === "listening" ? `Say the ${language === "en" ? "meaning in English" : "reading in Japanese"}. Recording stops after a pause or six seconds.` : activity === "recognizing" ? "Recognizing on this device…" : activity === "preparing" ? "Loading the local speech model…" : "")}</span>
  </div>;
}
