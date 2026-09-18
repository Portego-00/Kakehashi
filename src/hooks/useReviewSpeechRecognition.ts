import { useEffect, useRef } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import type { ExpoSpeechRecognitionNativeEventMap } from "expo-speech-recognition";
import native from "../../modules/review-speech";
import { createReviewSpeechRecognition, type ReviewSpeechEvents, type ReviewSpeechEventName } from "../utils/reviewSpeechRecognition";

export const ReviewSpeechRecognition = createReviewSpeechRecognition(ExpoSpeechRecognitionModule, native);
type LegacyListeners = { [K in keyof ExpoSpeechRecognitionNativeEventMap]: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void };

export function useReviewSpeechEvent<K extends Exclude<ReviewSpeechEventName, "status">>(
  name: K, listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void,
) {
  const latest = useRef(listener);
  latest.current = listener;
  const legacyListener = (event: ExpoSpeechRecognitionNativeEventMap[K]) => {
    if (ReviewSpeechRecognition.usesLegacy()) latest.current(event);
  };
  useSpeechRecognitionEvent(name, legacyListener as LegacyListeners[K]);
  useEffect(() => ReviewSpeechRecognition.subscribe(name, (event) => {
    latest.current(event);
  }), [name]);
}

export function useReviewSpeechStatus(listener: (event: ReviewSpeechEvents["status"]) => void) {
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => ReviewSpeechRecognition.subscribe("status", (event) => latest.current(event)), []);
}
