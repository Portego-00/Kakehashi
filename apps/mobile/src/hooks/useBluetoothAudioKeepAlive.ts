import {
  Audio,
  type AudioSound,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from "@/src/utils/expoAvCompat";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const SILENT_LOOP_SOURCE = require("../../assets/audio/silence-1s.mp3");

const KEEP_ALIVE_AUDIO_MODE = {
  allowsRecordingIOS: false,
  interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeAndroid: InterruptionModeAndroid.MixWithOthers,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
} as const;

function isAppleNativeAudioPlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "macos";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default function useBluetoothAudioKeepAlive(
  enabled: boolean,
  logPrefix = "AudioKeepAlive",
) {
  const keepAliveSoundRef = useRef<AudioSound | null>(null);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );

  const stopKeepAlive = useCallback(async () => {
    const keepAliveSound = keepAliveSoundRef.current;
    if (!keepAliveSound) {
      return;
    }

    keepAliveSoundRef.current = null;

    try {
      keepAliveSound.setOnPlaybackStatusUpdate(null);
      try {
        await keepAliveSound.stopAsync();
      } catch {
        // Ignore stop errors for already-stopped sounds.
      }
      await keepAliveSound.unloadAsync();
    } catch {
      // Ignore unload errors so cleanup never blocks navigation.
    }
  }, []);

  useEffect(() => {
    if (!isAppleNativeAudioPlatform()) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAppleNativeAudioPlatform()) {
      return;
    }

    let cancelled = false;

    const startKeepAlive = async () => {
      if (!enabled || !isAppActive) {
        await stopKeepAlive();
        return;
      }

      try {
        await Audio.setAudioModeAsync(KEEP_ALIVE_AUDIO_MODE);
      } catch (error) {
        console.warn(
          `[${logPrefix}] Failed to configure keep-alive audio mode: ${toErrorMessage(error)}`,
        );
      }

      if (cancelled) {
        return;
      }

      if (keepAliveSoundRef.current) {
        try {
          const status = await keepAliveSoundRef.current.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            await keepAliveSoundRef.current.playAsync();
          }
          return;
        } catch {
          await stopKeepAlive();
          if (cancelled) {
            return;
          }
        }
      }

      try {
        const { sound } = await Audio.Sound.createAsync(SILENT_LOOP_SOURCE, {
          shouldPlay: true,
          duckOthers: false,
          isLooping: true,
          volume: 1,
          progressUpdateIntervalMillis: 60000,
        });

        if (cancelled || !enabled || !isAppActive) {
          try {
            await sound.stopAsync();
          } catch {
            // Ignore stop errors while tearing down.
          }
          await sound.unloadAsync();
          return;
        }

        keepAliveSoundRef.current = sound;
      } catch (error) {
        console.warn(
          `[${logPrefix}] Failed to start Bluetooth keep-alive audio: ${toErrorMessage(error)}`,
        );
      }
    };

    void startKeepAlive();

    return () => {
      cancelled = true;
      void stopKeepAlive();
    };
  }, [enabled, isAppActive, logPrefix, stopKeepAlive]);
}
