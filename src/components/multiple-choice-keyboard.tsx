import React, { useEffect, useRef } from "react";
import { Platform, type ViewProps } from "react-native";
import {
  KeyboardExtendedBaseView,
  type KeyboardExtendedViewType,
  type OnKeyPress,
} from "react-native-external-keyboard";
import { useOptionalScreenIsFocused } from "../utils/navigation-focus";
import { useIsNoteSubjectPreviewOpen } from "../utils/note-subject-preview-state";

export type MultipleChoiceKeyboardProps = Pick<ViewProps, "children" | "style" | "testID" | "accessibilityRole"> & {
  enabled: boolean;
  questionKey: string;
  onSelectIndex: (index: number) => void;
  onConfirm?: () => void;
};

/** Captures physical keys without opening a software keyboard. */
export default function MultipleChoiceKeyboard({
  enabled,
  questionKey,
  onSelectIndex,
  onConfirm,
  ...viewProps
}: MultipleChoiceKeyboardProps) {
  const keyboardRef = useRef<KeyboardExtendedViewType>(null);
  const screenFocused = useOptionalScreenIsFocused();
  const previewOpen = useIsNoteSubjectPreviewOpen();
  const active = enabled && screenFocused && !previewOpen;

  useEffect(() => {
    if (!active) {
      keyboardRef.current?.blur?.();
      return;
    }
    const timer = setTimeout(() => keyboardRef.current?.focus(), Platform.OS === "android" ? 140 : 90);
    return () => clearTimeout(timer);
  }, [active, questionKey]);

  const handleKeyUp = ({ nativeEvent: key }: OnKeyPress) => {
    if (!active || !key.hasNoModifiers) return;
    // Key-up fires once per physical press, even when a key is held down.
    if (/^[1-4]$/.test(key.unicodeChar)) {
      onSelectIndex(Number(key.unicodeChar) - 1);
      return;
    }
    if (key.unicodeChar === "\r" || key.unicodeChar === "\n") {
      onConfirm?.();
      return;
    }
    if (key.unicodeChar) return;
    // Some external keyboards report only a platform key code, including numpads.
    const firstDigitCodes = Platform.OS === "ios" ? [30, 89] : [8, 145];
    for (const first of firstDigitCodes) {
      if (key.keyCode >= first && key.keyCode <= first + 3) {
        onSelectIndex(key.keyCode - first);
        return;
      }
    }
    const enterCodes = Platform.OS === "ios" ? [40, 88] : [66, 160];
    if (enterCodes.includes(key.keyCode)) onConfirm?.();
  };

  return (
    <KeyboardExtendedBaseView
      {...viewProps}
      ref={keyboardRef}
      autoFocus={active}
      canBeFocused={active}
      focusable={active}
      haloEffect={false}
      onKeyUpPress={handleKeyUp}
    />
  );
}
