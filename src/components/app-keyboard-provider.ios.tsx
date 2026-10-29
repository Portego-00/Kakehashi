import React, { type PropsWithChildren, useMemo } from "react";
import { KeyboardProvider, useAnimatedKeyboard } from "react-native-keyboard-controller";
import { ReviewKeyboardContext } from "../contexts/ReviewKeyboardContext";

function ReviewKeyboardObserver({ children }: PropsWithChildren) {
  const { height, state } = useAnimatedKeyboard();
  const keyboard = useMemo(() => ({ height, state }), [height, state]);
  return <ReviewKeyboardContext.Provider value={keyboard}>{children}</ReviewKeyboardContext.Provider>;
}

export function AppKeyboardProvider({ children }: PropsWithChildren) {
  return (
    <KeyboardProvider preload={false}>
      <ReviewKeyboardObserver>{children}</ReviewKeyboardObserver>
    </KeyboardProvider>
  );
}
