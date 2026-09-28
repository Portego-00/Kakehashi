import { useFeatureFlag } from "./useFeatureFlags";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { isPortegoUsername } from "../utils/portegoAccess";
import { getMaxTabsForDevice, partitionTabs } from "../utils/tabNavigation";

export function useTabNavigation() {
  const { userData } = useAuthStore();
  const { customTabOrder, gravatarEmail } = useSettingsStore();
  const songsFlag = useFeatureFlag("show_songs_tab");
  const email = gravatarEmail?.trim().toLowerCase() ?? "";
  return partitionTabs(customTabOrder, getMaxTabsForDevice(),
    (songsFlag || email === "portego2000@hotmail.es") && email !== "kakehashi.app@gmail.com",
    isPortegoUsername(userData?.username));
}
