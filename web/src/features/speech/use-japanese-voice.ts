"use client";

import { useEffect, useSyncExternalStore } from "react";
import { hasSavedJapaneseVoice, supportsJapaneseVoice } from "./japanese-voice-assets";
import type { JapaneseVoiceWorkerRequest, JapaneseVoiceWorkerResponse } from "./japanese-voice-protocol";

export type JapaneseVoiceActivity = "idle" | "downloading" | "synthesizing" | "playing";

export interface JapaneseVoiceState {
  checked: boolean;
  supported: boolean;
  downloaded: boolean;
  activity: JapaneseVoiceActivity;
  activeSentence: string | null;
  progress: number | null;
  message: string | null;
  error: string | null;
}

const initialState: JapaneseVoiceState = {
  checked: false,
  supported: true,
  downloaded: false,
  activity: "idle",
  activeSentence: null,
  progress: null,
  message: null,
  error: null,
};

let state = initialState;
let checkPromise: Promise<void> | null = null;
let downloadPromise: Promise<void> | null = null;
let worker: Worker | null = null;
let workerIdleTimer: ReturnType<typeof setTimeout> | null = null;
let requestSequence = 0;
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;
let audioEndResolve: (() => void) | null = null;
let playbackSequence = 0;

const listeners = new Set<() => void>();
const pending = new Map<string, {
  resolve: (response: JapaneseVoiceWorkerResponse) => void;
  reject: (error: Error) => void;
}>();

function emit(patch: Partial<JapaneseVoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return initialState;
}

function asFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|storage|space/iu.test(message)) return "There is not enough browser storage for the Japanese voice.";
  if (/network|fetch|load failed|failed to fetch/iu.test(message)) return "The Japanese voice could not be downloaded. Check your connection and try again.";
  if (/database is busy/iu.test(message)) return "Close any other Kakehashi tabs, then try the voice download again.";
  if (/not saved/iu.test(message)) return message;
  return "The Japanese voice could not start. Try again, or reload the page if the problem continues.";
}

function failPending(error: Error) {
  pending.forEach(({ reject }) => reject(error));
  pending.clear();
}

function scheduleWorkerCleanup() {
  if (workerIdleTimer) clearTimeout(workerIdleTimer);
  workerIdleTimer = setTimeout(() => {
    if (pending.size > 0) return;
    worker?.terminate();
    worker = null;
    workerIdleTimer = null;
  }, 60_000);
}

function getWorker() {
  if (workerIdleTimer) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  if (worker) return worker;
  worker = new Worker(new URL("./japanese-voice.worker.ts", import.meta.url), { type: "module", name: "kakehashi-japanese-voice" });
  worker.onmessage = (event: MessageEvent<JapaneseVoiceWorkerResponse>) => {
    const response = event.data;
    const operation = pending.get(response.id);
    if (!operation) return;
    if (response.type === "progress") {
      emit({ progress: Math.max(state.progress ?? 0, response.progress), message: response.message });
      return;
    }
    pending.delete(response.id);
    scheduleWorkerCleanup();
    if (response.type === "error") operation.reject(new Error(response.message));
    else operation.resolve(response);
  };
  worker.onerror = () => {
    const error = new Error("The Japanese voice worker could not start.");
    failPending(error);
    worker?.terminate();
    worker = null;
    if (workerIdleTimer) clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  };
  return worker;
}

function requestVoice(request: { type: "prepare" } | { type: "synthesize"; text: string }) {
  const id = `voice-${Date.now()}-${requestSequence++}`;
  return new Promise<JapaneseVoiceWorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ ...request, id } as JapaneseVoiceWorkerRequest);
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error("The Japanese voice worker could not start."));
    }
  });
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextConstructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Audio playback is not supported by this browser.");
  audioContext = new AudioContextConstructor();
  return audioContext;
}

export async function checkJapaneseVoice() {
  if (state.checked) return;
  if (checkPromise) return checkPromise;
  checkPromise = (async () => {
    const supported = supportsJapaneseVoice();
    if (!supported) {
      emit({ checked: true, supported: false, downloaded: false });
      return;
    }
    try {
      emit({ checked: true, supported: true, downloaded: await hasSavedJapaneseVoice() });
    } catch {
      emit({ checked: true, supported: false, downloaded: false });
    }
  })().finally(() => {
    checkPromise = null;
  });
  return checkPromise;
}

export async function downloadJapaneseVoice() {
  await checkJapaneseVoice();
  if (!state.supported) return;
  if (state.downloaded) return;
  if (downloadPromise) return downloadPromise;

  emit({ activity: "downloading", progress: 0, message: "Starting Japanese voice download…", error: null });
  downloadPromise = (async () => {
    try {
      await requestVoice({ type: "prepare" });
      if (!await hasSavedJapaneseVoice()) throw new Error("The Japanese voice was not saved by this browser.");
      emit({ activity: "idle", downloaded: true, progress: null, message: "Japanese voice saved in this browser.", error: null });
      void navigator.storage?.persist?.().catch(() => false);
    } catch (error) {
      emit({ activity: "idle", downloaded: false, progress: null, message: null, error: asFriendlyError(error) });
    }
  })().finally(() => {
    downloadPromise = null;
  });
  return downloadPromise;
}

export function stopJapaneseVoice() {
  playbackSequence += 1;
  if (audioSource) {
    const source = audioSource;
    audioSource = null;
    const finish = audioEndResolve;
    audioEndResolve = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The source may already have ended.
    }
    source.disconnect();
    finish?.();
  }
  if (state.activity === "playing" || state.activity === "synthesizing") {
    emit({ activity: "idle", activeSentence: null, progress: null, message: null });
  }
}

export async function playJapaneseSentence(text: string) {
  const context = getAudioContext();
  const resumePromise = context.state === "suspended" ? context.resume() : Promise.resolve();
  await checkJapaneseVoice();
  if (!state.downloaded || !await hasSavedJapaneseVoice()) {
    emit({ downloaded: false, error: "The saved Japanese voice is no longer available. Download it again." });
    return;
  }

  stopJapaneseVoice();
  const operation = playbackSequence;
  emit({ activity: "synthesizing", activeSentence: text, progress: null, message: "Creating speech…", error: null });
  try {
    const response = await requestVoice({ type: "synthesize", text });
    if (operation !== playbackSequence || response.type !== "audio") return;
    await resumePromise;
    const samples = new Float32Array(response.samples);
    const buffer = context.createBuffer(1, samples.length, response.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    audioSource = source;
    emit({ activity: "playing", message: "Playing Japanese sentence…" });
    await new Promise<void>((resolve) => {
      const finish = () => {
        if (audioEndResolve === finish) audioEndResolve = null;
        resolve();
      };
      audioEndResolve = finish;
      source.onended = finish;
      source.start();
    });
    try {
      source.disconnect();
    } catch {
      // Stopping playback may already have disconnected this source.
    }
    if (operation === playbackSequence) {
      audioSource = null;
      emit({ activity: "idle", activeSentence: null, message: null });
    }
  } catch (error) {
    if (operation === playbackSequence) {
      audioSource = null;
      emit({ activity: "idle", activeSentence: null, progress: null, message: null, error: asFriendlyError(error) });
    }
  }
}

export function useJapaneseVoice() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void checkJapaneseVoice();
  }, []);
  return {
    ...snapshot,
    download: downloadJapaneseVoice,
    play: playJapaneseSentence,
    stop: stopJapaneseVoice,
  };
}
