"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Volume2 } from "lucide-react";
import type { StudyQuestion } from "../types";
import styles from "./audio-vocab-prompt.module.css";

export type AudioVocabPlayer = { play: (rate?: number) => Promise<void> };

type AudioVocabPromptProps = {
  question: StudyQuestion;
  ref?: Ref<AudioVocabPlayer>;
};

export function AudioVocabPrompt({ question, ref }: AudioVocabPromptProps) {
  return (
    <AudioVocabQuestion
      key={`${question.id}:${question.audioVocabSentence ?? question.audioUrl}`}
      question={question}
      ref={ref}
    />
  );
}

function AudioVocabQuestion({ question, ref }: AudioVocabPromptProps) {
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mountedRef = useRef(true);
  const playbackRequestRef = useRef(0);
  const sentence = question.audioVocabSentence?.trim();
  const targetReading = question.reading?.trim() || question.characters;
  const stopSentence = useCallback(() => {
    const utterance = utteranceRef.current;
    if (!utterance) return;
    utteranceRef.current = null;
    utterance.onstart = null;
    utterance.onend = null;
    utterance.onerror = null;
    window.speechSynthesis.cancel();
  }, []);
  const play = useCallback(
    async (rate = 1) => {
      if (!mountedRef.current) return;
      const request = ++playbackRequestRef.current;
      setAudioError(null);
      setPlaying(false);
      if (sentence) {
        if (
          !window.speechSynthesis ||
          typeof window.SpeechSynthesisUtterance !== "function"
        ) {
          setAudioError(
            "Sentence audio isn’t supported in this browser. Try another browser or choose word recordings.",
          );
          return;
        }
        const isCurrent = () =>
          mountedRef.current && request === playbackRequestRef.current;
        try {
          if (utteranceRef.current) stopSentence();
          else window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `${targetReading ? `${targetReading}。` : ""}${sentence}`,
          );
          utterance.lang = "ja-JP";
          utterance.rate = rate;
          const japaneseVoice = window.speechSynthesis
            .getVoices()
            .find((voice) => /^ja(?:[-_]|$)/i.test(voice.lang));
          if (japaneseVoice) utterance.voice = japaneseVoice;
          utterance.onstart = () => {
            if (isCurrent()) setPlaying(true);
          };
          utterance.onend = () => {
            if (!isCurrent()) return;
            utteranceRef.current = null;
            setPlaying(false);
          };
          utterance.onerror = (event) => {
            if (!isCurrent()) return;
            utteranceRef.current = null;
            setPlaying(false);
            if (event.error === "canceled" || event.error === "interrupted")
              return;
            setAudioError(
              event.error === "not-allowed"
                ? "Tap the speaker to play the word and sentence."
                : event.error === "language-unavailable" ||
                    event.error === "voice-unavailable"
                  ? "A Japanese voice isn’t available. Enable a Japanese voice in your device settings or choose word recordings."
                  : "Sentence audio couldn’t play. Tap the speaker to retry.",
            );
          };
          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        } catch {
          if (isCurrent()) {
            setPlaying(false);
            setAudioError(
              "Sentence audio couldn’t play. Tap the speaker to retry.",
            );
          }
        }
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = rate;
      try {
        if (audio.error) audio.load();
        await audio.play();
      } catch (error) {
        const name =
          error && typeof error === "object" && "name" in error
            ? error.name
            : null;
        if (
          !mountedRef.current ||
          request !== playbackRequestRef.current ||
          name === "AbortError"
        )
          return;
        setPlaying(false);
        setAudioError(
          name === "NotAllowedError"
            ? "Tap the speaker to play the word."
            : "Audio couldn’t play. Check your connection and tap the speaker to retry.",
        );
      }
    },
    [sentence, stopSentence, targetReading],
  );
  useImperativeHandle(ref, () => ({ play }), [play]);

  useEffect(() => {
    mountedRef.current = true;
    const audio = audioRef.current;
    const autoplayTimer =
      question.autoPlayAudio !== false
        ? window.setTimeout(() => void play(), 0)
        : undefined;
    return () => {
      mountedRef.current = false;
      playbackRequestRef.current += 1;
      window.clearTimeout(autoplayTimer);
      audio?.pause();
      stopSentence();
    };
  }, [
    play,
    question.autoPlayAudio,
    question.id,
    question.audioUrl,
    stopSentence,
  ]);

  return (
    <>
      <div className={styles.question}>
        <h2 id="question-prompt">What does this word mean?</h2>
        <div className={styles.playback}>
          <button
            type="button"
            className={styles.speaker}
            onClick={() => void play()}
            aria-label="Play vocabulary audio"
            data-playing={playing}
          >
            <Volume2 size={52} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.slow}
            onClick={() => void play(0.75)}
            aria-label="Play vocabulary audio slowly"
          >
            0.75×<span>Slower</span>
          </button>
        </div>
        {!sentence ? (
          <audio
            ref={audioRef}
            src={question.audioUrl}
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => {
              setPlaying(false);
              setAudioError(
                "Audio couldn’t load. Check your connection and tap the speaker to retry.",
              );
            }}
          />
        ) : null}
        <p className={styles.playbackHint} role="status">
          {audioError ??
            (sentence
              ? "Listen to the word, then its sentence."
              : playing
                ? "Playing…"
                : "Tap to listen again")}
        </p>
      </div>
    </>
  );
}
