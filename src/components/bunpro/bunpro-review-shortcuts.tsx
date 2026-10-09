import React, { useEffect, useRef } from "react";
import { KeyboardExtendedBaseView, type KeyboardExtendedViewType } from "react-native-external-keyboard";
import { Platform } from "react-native";

export function BunproReviewShortcuts({ enabled, questionKey, onKey }: { enabled: boolean; questionKey: string; onKey: (key: string) => void }) {
  const ref = useRef<KeyboardExtendedViewType>(null);
  useEffect(() => { if (!enabled) { ref.current?.blur?.(); return; } const timer = setTimeout(() => ref.current?.focus(), Platform.OS === "android" ? 140 : 90); return () => clearTimeout(timer); }, [enabled, questionKey]);
  return <KeyboardExtendedBaseView ref={ref} canBeFocused={enabled} focusable={enabled} autoFocus={enabled} haloEffect={false} style={{ width: 1, height: 1, position: "absolute" }} onKeyUpPress={({ nativeEvent }) => {
    if (!enabled || !nativeEvent.hasNoModifiers) return;
    const code = nativeEvent.keyCode;
    const key = nativeEvent.unicodeChar || ((Platform.OS === "ios" ? [40, 88] : [66, 160]).includes(code) ? "Enter" : "");
    if (key) onKey(key === "\r" || key === "\n" ? "Enter" : key);
  }} />;
}
