"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { Download, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { updateWebSettings, WEB_SETTINGS_SAVE_ERROR } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { reviewPlaybackSnapshot, subscribeReviewPlayback } from "./review-playback";
import { canUseReviewAsr } from "./review-asr-access";
import { LOCAL_ASR_CHANGED, supportsLocalAsr } from "./asr-model-assets";
import { downloadReviewVoiceModel, hasReviewVoiceModel } from "./review-voice-assets";
import { resolveVoiceTranscript } from "./review-voice-reading";
import { listenForReviewAnswer } from "./review-recognition";
import { setVoiceSessionActive, subscribeVoiceSession, voiceSessionServerSnapshot, voiceSessionSnapshot } from "./review-voice-session";
import type { AsrLanguage } from "./japanese-asr-protocol";
import styles from "./review-asr.module.css";

type Props = {
  language?: AsrLanguage; enabled?: boolean; onStart?: () => void; questionKey: string; value: string; blocked: boolean;
  onTranscript: (text: string) => void; onAnswer: (text: string) => void;
  isAcceptedAnswer?: (text: string) => boolean;
  resolveTranscript?: (text: string) => string | null;
};
export function ReviewAsrAnswer(props: Props) {
  const { user, isDemo, status } = useSession();
  const username = user?.data.username ?? "anonymous";
  const preferences = useWebSettings(username).study;
  if (status !== "authenticated" || !canUseReviewAsr(user?.data.username, isDemo)) return null;
  const enableVoiceAnswers = () => {
    try { updateWebSettings(window.localStorage, username, current => ({ ...current, study: { ...current.study, reviewAsrEnabled: true } })); }
    catch { throw new Error(WEB_SETTINGS_SAVE_ERROR); }
  };
  return <LocalReviewAsrAnswer {...props} enabled={props.enabled ?? preferences.reviewAsrEnabled} onEnable={enableVoiceAnswers} />;
}
const noopSubscribe = () => () => {};
const visibleSnapshot = () => !document.hidden;
const visibleServerSnapshot = () => true;
const subscribeVisibility = (listener: () => void) => { document.addEventListener("visibilitychange", listener); return () => document.removeEventListener("visibilitychange", listener); };
const mediaSnapshot = () => Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")).some(media => !media.paused && !media.ended);
const subscribeMedia = (listener: () => void) => { const events = ["play", "pause", "ended", "error"]; for (const event of events) document.addEventListener(event, listener, true); return () => { for (const event of events) document.removeEventListener(event, listener, true); }; };

function LocalReviewAsrAnswer({ questionKey, value, blocked, onTranscript, onAnswer, isAcceptedAnswer, resolveTranscript, onStart, language = "ja", enabled, onEnable }: Props & { onEnable: () => void }) {
  const supported = useSyncExternalStore(noopSubscribe, supportsLocalAsr, () => false);
  const detachedPlaying = useSyncExternalStore(subscribeReviewPlayback, reviewPlaybackSnapshot, voiceSessionServerSnapshot);
  const active = useSyncExternalStore(subscribeVoiceSession, voiceSessionSnapshot, voiceSessionServerSnapshot);
  const [saved, setSaved] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const mediaPlaying = useSyncExternalStore(subscribeMedia, mediaSnapshot, voiceSessionServerSnapshot);
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot, visibleServerSnapshot);
  const [revision, setRevision] = useState(0);
  const [activity, setActivity] = useState<"idle" | "preparing" | "listening" | "submitted">("idle");
  const [error, setError] = useState("");
  const lastVoiceValue = useRef<string | null>(null);
  const previousInput = useRef({ questionKey, value });
  const submittedQuestion = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const resultSequence = useRef(0);
  const pendingCandidate = useRef("");
  const acceptedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearAcceptedTimer() { if (acceptedTimer.current) clearTimeout(acceptedTimer.current); acceptedTimer.current = null; }
  const begin = useEffectEvent(() => { lastVoiceValue.current = null; setError(""); onStart?.(); });
  const result = useEffectEvent(async (text: string, final: boolean, samples: Float32Array, capture: AbortController) => {
    const sequence = ++resultSequence.current;
    const normalized = await resolveVoiceTranscript(text, language, samples, final, capture.signal);
    if (sequence !== resultSequence.current) return;
    if (capture.signal.aborted || blocked || !enabled || !visible || detachedPlaying || mediaPlaying || !voiceSessionSnapshot() || submittedQuestion.current === questionKey) return;
    const candidate = normalized && (resolveTranscript ? resolveTranscript(normalized) : normalized);
    if (candidate !== pendingCandidate.current || final) clearAcceptedTimer();
    pendingCandidate.current = candidate ?? "";
    if (!candidate) {
      if (final && text.trim()) setError(`Heard “${text}”. Please say the reading again or pause voice answers to type it.`);
      return;
    }
    lastVoiceValue.current = candidate;
    onTranscript(candidate);
    const submit = () => {
      if (capture.signal.aborted || !voiceSessionSnapshot() || submittedQuestion.current === questionKey) return;
      submittedQuestion.current = questionKey;
      capture.abort();
      setActivity("submitted");
      onAnswer(candidate);
    };
    if (final) submit();
    // A short confirmation avoids grading the first word of a longer answer.
    else if (!acceptedTimer.current && isAcceptedAnswer?.(candidate)) acceptedTimer.current = setTimeout(submit, 700);
  });
  useEffect(() => {
    mounted.current = true;
    const check = () => { void hasReviewVoiceModel().then(value => { if (mounted.current) setSaved(value); }).catch(() => { if (mounted.current) setSaved(false); }); };
    const changed = () => { controller.current?.abort(); check(); setRevision(value => value + 1); };
    check();
    window.addEventListener(LOCAL_ASR_CHANGED, changed);
    return () => { mounted.current = false; downloadController.current?.abort(); window.removeEventListener(LOCAL_ASR_CHANGED, changed); };
  }, []);
  useEffect(() => {
    const previous = previousInput.current; previousInput.current = { questionKey, value };
    if (previous.questionKey === questionKey && previous.value !== value && value !== lastVoiceValue.current && submittedQuestion.current !== questionKey) setVoiceSessionActive(false);
  }, [questionKey, value]);
  useEffect(() => {
    if (!active) submittedQuestion.current = null;
    if (!active || blocked || activity !== "submitted") return;
    // A checker can request another answer without grading (e.g. a Bunpro hint).
    // Resume after its state update; graded answers remain paused by `blocked`.
    const timer = setTimeout(() => {
      if (submittedQuestion.current !== questionKey) return;
      submittedQuestion.current = null;
      setRevision(value => value + 1);
    }, 1_200);
    return () => clearTimeout(timer);
  }, [active, activity, blocked, questionKey]);
  useEffect(() => {
    if (blocked) submittedQuestion.current = null;
    if (!active || !enabled || !supported || !saved || blocked || detachedPlaying || mediaPlaying || !visible || submittedQuestion.current === questionKey) return;
    const capture = new AbortController(); controller.current = capture;
    begin(); setActivity("preparing");
    void listenForReviewAnswer({ language, signal: capture.signal, onReady: () => { if (!capture.signal.aborted) setActivity("listening"); }, onResult: (text, final, samples) => { void result(text, final, samples, capture).catch(cause => { if (!capture.signal.aborted) { setError(cause instanceof Error ? cause.message : "The reading could not be resolved. Try again."); } }); } }).catch(cause => {
      if (capture.signal.aborted) return;
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser, then start voice answers again." : cause instanceof Error ? cause.message : "Voice recognition stopped. Start it again or type your answer.");
      setVoiceSessionActive(false);
    });
    return () => { capture.abort(); if (controller.current === capture) controller.current = null; clearAcceptedTimer(); setActivity("idle"); };
  }, [active, enabled, supported, saved, blocked, detachedPlaying, mediaPlaying, visible, questionKey, language, revision]);
  async function download() {
    if (downloadController.current) return;
    const current = new AbortController(); downloadController.current = current;
    setVoiceSessionActive(false); setDownloadProgress(0); setError("");
    try {
      await downloadReviewVoiceModel(percent => { if (mounted.current && !current.signal.aborted) setDownloadProgress(percent); }, current.signal);
      if (mounted.current && !current.signal.aborted) { setSaved(true); onEnable(); }
    } catch (cause) {
      if (mounted.current && !current.signal.aborted) setError(cause instanceof Error ? cause.message : "The download failed. Try again.");
    } finally {
      if (downloadController.current === current) downloadController.current = null;
      if (mounted.current) setDownloadProgress(null);
    }
  }
  const downloading = downloadProgress !== null;
  return <div className={styles.answerControl}>
    {downloading || (supported && !saved) ? <>
      <Button type="button" tone="ghost" size="small" disabled={blocked || downloading} onClick={() => void download()}>
        <Download size={17} aria-hidden />{downloading ? `Downloading… ${downloadProgress}%` : "Download and enable · 241 MB"}
      </Button>
      {downloading ? <>
        <progress className={styles.progress} max={100} value={downloadProgress} aria-label="Speech recognition model download" />
        <Button type="button" tone="ghost" size="small" onClick={() => downloadController.current?.abort()}>Cancel download</Button>
      </> : null}
    </> : <Button type="button" tone="ghost" size="small" aria-pressed={active} disabled={!active && (blocked || !enabled || !saved || !supported)} onClick={() => setVoiceSessionActive(!active)}>
      {active ? <MicOff size={17} aria-hidden /> : <Mic size={17} aria-hidden />}{active ? "Pause voice answers" : "Start voice answers"}
    </Button>}
    <span role={error ? "alert" : "status"} className={styles.status}>{error || (!supported ? "Local speech recognition is unavailable in this browser." : downloading ? "Downloading to this browser. You can keep studying." : !saved ? "Download once for Japanese and English voice answers." : !enabled ? "Enable voice answers in Settings → Reviews." : active && (blocked || detachedPlaying || mediaPlaying || !visible) ? "Voice answers resume with the next question." : active && activity === "preparing" ? "Preparing voice recognition…" : active && activity === "listening" ? `Listening for ${language === "en" ? "an English meaning" : "a Japanese reading"}. Answers submit when you finish speaking.` : active && activity === "submitted" ? "Answer submitted." : "Start once to answer successive questions by voice.")}</span>
  </div>;
}
