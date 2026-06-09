import { NavigationContext } from "@react-navigation/native";
import { useContext, useEffect } from "react";
import { timeTrackingService } from "../services/timeTrackingService";
import type { ActivityKey } from "../services/timeTrackingCore";

type ActivityTrackingOptions = {
  /**
   * - "mount": active from mount to unmount. For study flows (reviews,
   *   lessons, extra study sessions): screens pushed on top (subject details,
   *   search, ...) keep the flow mounted underneath, so its clock keeps
   *   running until the user backs out or the flow navigates away.
   * - "focus": active only while the screen is focused. For content screens
   *   (news, songs, videos, EPUB reader) and tab screens, which stay mounted
   *   when the user moves elsewhere.
   */
  mode?: "mount" | "focus";
  /**
   * Stops the clock while false, e.g. when a session shows its results
   * screen and the study part is over.
   */
  enabled?: boolean;
};

/**
 * Attributes on-screen time to an activity in the local time-tracking ledger.
 * Only the most recently begun activity accrues time, so nesting tracked
 * screens never double counts.
 *
 * Uses the optional NavigationContext instead of useFocusEffect so components
 * can still render outside a navigator (e.g. in tests), where "focus" mode
 * falls back to mount/unmount behavior.
 */
export function useActivityTracking(
  activity: ActivityKey,
  options: ActivityTrackingOptions = {}
): void {
  const { mode = "mount", enabled = true } = options;
  const navigation = useContext(NavigationContext);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let token: number | null = null;
    const start = () => {
      if (token === null) {
        token = timeTrackingService.begin(activity);
      }
    };
    const stop = () => {
      if (token !== null) {
        timeTrackingService.end(token);
        token = null;
      }
    };

    if (mode !== "focus" || !navigation) {
      start();
      return stop;
    }

    if (navigation.isFocused()) {
      start();
    }
    const unsubscribeFocus = navigation.addListener("focus", start);
    const unsubscribeBlur = navigation.addListener("blur", stop);

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      stop();
    };
  }, [activity, mode, enabled, navigation]);
}
