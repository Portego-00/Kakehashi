import AsyncStorage from "@react-native-async-storage/async-storage";
import { permanentStorage } from "./permanentStorage";

export const KAKEHASHI_REPOSITORY_URL =
  "https://github.com/Portego-00/Kakehashi";

const OPEN_SOURCE_ANNOUNCEMENT_STORAGE_KEY_PREFIX =
  "open_source_announcement_seen";

export function getOpenSourceAnnouncementSeenKey(userId: string) {
  return `${OPEN_SOURCE_ANNOUNCEMENT_STORAGE_KEY_PREFIX}_${userId}`;
}

export async function hasSeenOpenSourceAnnouncement(
  userId: string,
): Promise<boolean> {
  const cacheKey = getOpenSourceAnnouncementSeenKey(userId);

  try {
    if (permanentStorage.getString(cacheKey) === "true") {
      return true;
    }
  } catch (error) {
    console.warn("Failed to read open-source announcement from MMKV:", error);
  }

  try {
    const legacyValue = await AsyncStorage.getItem(cacheKey);
    if (legacyValue === "true") {
      try {
        permanentStorage.set(cacheKey, "true");
      } catch (error) {
        console.warn(
          "Failed to migrate open-source announcement to MMKV:",
          error,
        );
      }

      return true;
    }
  } catch (error) {
    console.warn(
      "Failed to read open-source announcement from AsyncStorage:",
      error,
    );
  }

  return false;
}

export async function markOpenSourceAnnouncementSeen(
  userId: string,
): Promise<void> {
  const cacheKey = getOpenSourceAnnouncementSeenKey(userId);

  try {
    permanentStorage.set(cacheKey, "true");
  } catch (error) {
    console.warn("Failed to write open-source announcement to MMKV:", error);
    await AsyncStorage.setItem(cacheKey, "true");
    return;
  }

  AsyncStorage.setItem(cacheKey, "true").catch((error) => {
    console.warn(
      "Failed to mirror open-source announcement to AsyncStorage:",
      error,
    );
  });
}
