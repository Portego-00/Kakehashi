import { NativeModules, Platform } from "react-native";

interface KeyboardManagerInterface {
  /** Returns true if the user has at least one Japanese keyboard installed on their device. */
  hasJapaneseKeyboard(): Promise<boolean>;
  /**
   * Set whether the active text field should present a Japanese keyboard.
   * If the text field is currently focused, the keyboard reloads automatically.
   */
  setUseJapaneseKeyboard(enabled: boolean): Promise<boolean>;
}

const { KeyboardManager } = NativeModules;

export const JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS =
  Platform.OS === "android"
    ? "Add Japanese to your Android keyboard first.\nOpen Settings -> System -> Keyboard -> On-screen keyboard -> Gboard -> Languages -> Add keyboard -> Japanese."
    : "You must add a Japanese keyboard to your device.\nOpen Settings -> General -> Keyboard -> Keyboards -> Add New Keyboard.";

const supportsKeyboardManager =
  Platform.OS === "ios" || Platform.OS === "android";

export default (
  supportsKeyboardManager ? KeyboardManager ?? null : null
) as KeyboardManagerInterface | null;
