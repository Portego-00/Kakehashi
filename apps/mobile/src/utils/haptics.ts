import * as ExpoHaptics from "expo-haptics";

import { useSettingsStore } from "./store";

export {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";

const isHapticFeedbackEnabled = (): boolean =>
  useSettingsStore.getState().hapticFeedbackEnabled ?? true;

export const impactAsync: typeof ExpoHaptics.impactAsync = async (style) => {
  if (!isHapticFeedbackEnabled()) {
    return;
  }
  await ExpoHaptics.impactAsync(style);
};

export const notificationAsync: typeof ExpoHaptics.notificationAsync = async (
  type,
) => {
  if (!isHapticFeedbackEnabled()) {
    return;
  }
  await ExpoHaptics.notificationAsync(type);
};

export const selectionAsync: typeof ExpoHaptics.selectionAsync = async () => {
  if (!isHapticFeedbackEnabled()) {
    return;
  }
  await ExpoHaptics.selectionAsync();
};

export const performAndroidHapticsAsync: typeof ExpoHaptics.performAndroidHapticsAsync =
  async (type) => {
    if (!isHapticFeedbackEnabled()) {
      return;
    }
    await ExpoHaptics.performAndroidHapticsAsync(type);
  };
