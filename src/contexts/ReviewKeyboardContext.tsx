import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export type ReviewKeyboardInfo = {
  height: SharedValue<number>;
  state: SharedValue<number>;
};

export const ReviewKeyboardContext = createContext<ReviewKeyboardInfo | null>(null);

export function useReviewKeyboard(): ReviewKeyboardInfo {
  const keyboard = useContext(ReviewKeyboardContext);
  if (!keyboard) {
    throw new Error("Review keyboard requires AppKeyboardProvider.");
  }
  return keyboard;
}
