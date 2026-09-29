import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

export async function requestStreakReview(
  userId: string,
  currentStreak: number,
): Promise<boolean> {
  if (currentStreak < 5) return false;

  // Preserve the existing five-day cache for users already prompted.
  const eligibleKeys = [`rate_app_streak_prompted_${userId}`];
  if (currentStreak >= 100) {
    eligibleKeys.push(`rate_app_streak_100_prompted_${userId}`);
  }

  const cachedValues = await AsyncStorage.multiGet(eligibleKeys);
  const pendingKeys = eligibleKeys.filter(
    (key) => !cachedValues.some(([cachedKey, value]) => cachedKey === key && value === "true"),
  );
  if (pendingKeys.length === 0 || !(await StoreReview.isAvailableAsync())) {
    return false;
  }

  // Consume all eligible milestones together so a long streak requests only once.
  await AsyncStorage.multiSet(pendingKeys.map((key) => [key, "true"]));
  try {
    await StoreReview.requestReview();
  } catch (error) {
    // Keep previously completed milestones when this attempt fails.
    await AsyncStorage.multiRemove(pendingKeys).catch(() => {});
    throw error;
  }
  return true;
}
