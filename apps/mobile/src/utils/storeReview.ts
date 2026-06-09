import * as Linking from "expo-linking";
import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";

const IOS_REVIEW_URL = "https://apps.apple.com/app/id6757765444?action=write-review";
const ANDROID_REVIEW_URLS = [
  "market://details?id=com.portego00.kakehashi&showAllReviews=true",
  "https://play.google.com/store/apps/details?id=com.portego00.kakehashi&showAllReviews=true",
];

export async function requestAppStoreReview(): Promise<boolean> {
  try {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      return true;
    }
  } catch (error) {
    console.warn("StoreReview.requestReview failed, falling back to store URL:", error);
  }

  const fallbackUrls =
    Platform.OS === "android"
      ? [StoreReview.storeUrl(), ...ANDROID_REVIEW_URLS]
      : [StoreReview.storeUrl(), IOS_REVIEW_URL];

  for (const url of fallbackUrls) {
    if (!url) continue;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // Try the next URL fallback.
    }
  }

  return false;
}
