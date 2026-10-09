import React, { useEffect, useEffectEvent, useId } from "react";
import { View } from "react-native";
import { useOptionalScreenIsFocused } from "../utils/navigation-focus";
import { useIsNoteSubjectPreviewOpen } from "../utils/note-subject-preview-state";
import type { MultipleChoiceKeyboardProps } from "./multiple-choice-keyboard";

export default function MultipleChoiceKeyboard({ enabled, questionKey: _questionKey, onSelectIndex, onConfirm, ...viewProps }: MultipleChoiceKeyboardProps) {
  const id = useId();
  const screenFocused = useOptionalScreenIsFocused();
  const previewOpen = useIsNoteSubjectPreviewOpen();
  const active = enabled && screenFocused && !previewOpen;
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!active || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.querySelector('[role="dialog"], dialog[open]')) return;
    if (event.target instanceof Element) {
      if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (event.target.closest('button, a, [role="button"]') && !document.getElementById(id)?.contains(event.target)) return;
    }
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      onSelectIndex(Number(event.key) - 1);
    } else if (event.key === "Enter" && onConfirm) {
      event.preventDefault();
      event.stopPropagation();
      onConfirm();
    }
  });
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => handleKeyDown(event);
    // Pressable consumes Enter before it reaches a bubbling window listener.
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Effect Events read the current handlers without resubscribing.
  }, [active]);
  return <View {...viewProps} nativeID={id} />;
}
