import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export interface ReviewSpeechNativeModule {
  getCapabilities(locale: string): Promise<{ supported: boolean; reason?: string }>;
  start(sessionId: number, locale: string): Promise<void>;
  stop(sessionId: number): Promise<void>;
  abort(sessionId: number): Promise<void>;
  addListener(name: "speechEvent", listener: (event: {
    sessionId: number; name: string; payload: unknown;
  }) => void): { remove(): void };
}

// An OTA update can reach an older binary without this native module.
export default Platform.OS === "ios"
  ? requireOptionalNativeModule<ReviewSpeechNativeModule>("ReviewSpeech")
  : null;
