import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const STARTUP_UPDATE_TIMEOUT_MS = 5000;

export type StartupUpdateStatus = "checking" | "applying" | null;
export type StartupUpdateOutcome = "skipped" | "no-update" | "timed-out" | "failed" | "reload-requested";
export interface StartupUpdateResult {
  reloadTriggered: boolean;
  outcome: StartupUpdateOutcome;
}
export interface StartupUpdateOptions {
  onStatus?: (status: StartupUpdateStatus) => void;
  reloadScreenOptions?: Updates.ReloadScreenOptions;
  timeoutMs?: number;
}

export async function applyStartupUpdate({
  onStatus,
  reloadScreenOptions,
  timeoutMs = STARTUP_UPDATE_TIMEOUT_MS,
}: StartupUpdateOptions = {}): Promise<StartupUpdateResult> {
  if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) {
    onStatus?.(null);
    return { reloadTriggered: false, outcome: "skipped" };
  }

  const budgetMs = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : STARTUP_UPDATE_TIMEOUT_MS;
  const deadline = Date.now() + budgetMs;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reloadTriggered = false;
  const withinDeadline = () => active && Date.now() < deadline;
  type NetworkOutcome = "ready-to-reload" | "no-update" | "timed-out" | "failed";

  const prepareUpdate = async (): Promise<NetworkOutcome> => {
    try {
      if (!withinDeadline()) return "timed-out";
      onStatus?.("checking");
      if (!withinDeadline()) return "timed-out";
      const update = await Updates.checkForUpdateAsync();
      // Native update requests cannot be cancelled. These guards also handle
      // suspended JS, where the promise may resume before an overdue timer fires.
      if (!withinDeadline()) return "timed-out";
      if (!update.isAvailable && !update.isRollBackToEmbedded) return "no-update";

      onStatus?.("applying");
      if (!withinDeadline()) return "timed-out";
      const fetched = await Updates.fetchUpdateAsync();
      if (!withinDeadline()) return "timed-out";
      return fetched.isNew || fetched.isRollBackToEmbedded ? "ready-to-reload" : "no-update";
    } catch {
      // Consume rejections even when the caller has already continued startup.
      return withinDeadline() ? "failed" : "timed-out";
    }
  };

  try {
    const timeout = new Promise<NetworkOutcome>((resolve) => {
      timer = setTimeout(() => {
        active = false;
        resolve("timed-out");
      }, budgetMs);
    });
    const outcome = await Promise.race([prepareUpdate(), timeout]);
    active = false;
    clearTimeout(timer);
    if (outcome !== "ready-to-reload") return { reloadTriggered: false, outcome };
    if (Date.now() >= deadline) return { reloadTriggered: false, outcome: "timed-out" };

    // The network budget ends here. Once native reload is requested, continuing
    // to app content on a timer could let the restart interrupt active study.
    await Updates.reloadAsync({ reloadScreenOptions });
    reloadTriggered = true;
    return { reloadTriggered, outcome: "reload-requested" };
  } catch {
    return { reloadTriggered: false, outcome: "failed" };
  } finally {
    active = false;
    clearTimeout(timer);
    if (!reloadTriggered) onStatus?.(null);
  }
}
