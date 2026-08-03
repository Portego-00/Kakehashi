import * as Speech from "expo-speech";

const KANJI_READING_SPEECH_OPTIONS = {
  language: "ja-JP",
  pitch: 1,
  rate: 0.8,
};

let mostRecentSpeechRequest = 0;

/**
 * Speaks a kanji reading with the device's Japanese text-to-speech voice.
 * A new tap replaces a pending request instead of queuing another reading.
 */
export async function speakKanjiReading(reading: string): Promise<void> {
  const requestId = ++mostRecentSpeechRequest;

  await Speech.stop();
  if (requestId !== mostRecentSpeechRequest) {
    return;
  }

  Speech.speak(reading, KANJI_READING_SPEECH_OPTIONS);
}
