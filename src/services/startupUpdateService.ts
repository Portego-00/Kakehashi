import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const STARTUP_UPDATE_TIMEOUT_MS = 5000;
export const STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS = 60_000;

export type StartupUpdateStatus = "checking" | "applying" | null;
export type StartupUpdateOutcome = "skipped" | "no-update" | "timed-out" | "failed" | "reload-requested";
export interface StartupUpdateResult {
  reloadTriggered: boolean;
  outcome: StartupUpdateOutcome;
}
export interface StartupUpdateOptions {
  onStatus?: (status: StartupUpdateStatus) => void;
  reloadScreenOptions?: Updates.ReloadScreenOptions;
  /** Time allowed to check whether an update is available. */
  timeoutMs?: number;
  /** Separate download allowance once an update has been found. */
  downloadTimeoutMs?: number;
}

export async function applyStartupUpdate({
  onStatus,
  reloadScreenOptions,
  timeoutMs = STARTUP_UPDATE_TIMEOUT_MS,
  downloadTimeoutMs = STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS,
}: StartupUpdateOptions = {}): Promise<StartupUpdateResult> {
  if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) {
    onStatus?.(null);
    return { reloadTriggered: false, outcome: "skipped" };
  }

  const budgetMs = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : STARTUP_UPDATE_TIMEOUT_MS;
  const downloadBudgetMs = Number.isFinite(downloadTimeoutMs)
    ? Math.max(0, downloadTimeoutMs)
    : STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS;
  let deadline = Date.now() + budgetMs;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reloadTriggered = false;
  const withinDeadline = () => active && Date.now() < deadline;
  type NetworkOutcome = "ready-to-reload" | "no-update" | "timed-out" | "failed";

  const prepareUpdate = async (startDownloadBudget: () => void): Promise<NetworkOutcome> => {
    try {
      if (!withinDeadline()) return "timed-out";
      onStatus?.("checking");
      if (!withinDeadline()) return "timed-out";
      const update = await Updates.checkForUpdateAsync();
      // Native update requests cannot be cancelled. These guards also handle
      // suspended JS, where the promise may resume before an overdue timer fires.
      if (!withinDeadline()) return "timed-out";
      if (!update.isAvailable && !update.isRollBackToEmbedded) return "no-update";

      // Downloading the bundle and assets needs its own allowance; a slow check
      // must not consume the time available to apply an update on this launch.
      startDownloadBudget();
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
    const outcome = await new Promise<NetworkOutcome>((resolve) => {
      const startBudget = (durationMs: number) => {
        deadline = Date.now() + durationMs;
        clearTimeout(timer);
        timer = setTimeout(() => {
          active = false;
          resolve("timed-out");
        }, durationMs);
      };
      startBudget(budgetMs);
      void prepareUpdate(() => startBudget(downloadBudgetMs)).then(resolve);
    });
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
