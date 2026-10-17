"use client";

import { useCallback, useState } from "react";
import { updateWebSettings, WEB_SETTINGS_SAVE_ERROR, type WebSettings } from "@/features/settings/settings";
import { useWorkspacePreferences } from "@/features/settings/use-workspace-preferences";

type ForecastWorkspaceSettings = Pick<WebSettings["workspace"], "forecastViewMode" | "forecastChartMode" | "forecastBreakdown">;

export const REVIEW_FORECAST_PREVIEW_PREFERENCES = {
  viewMode: "chart" as const,
  chartMode: "hourly" as const,
  breakdown: "off" as const,
  settingsError: "",
  onViewModeChange: () => {},
  onChartModeChange: () => {},
  onBreakdownChange: () => {},
};

export function useReviewForecastPreferences(username: string) {
  const workspace = useWorkspacePreferences(username);
  const [settingsError, setSettingsError] = useState("");
  const update = useCallback((patch: Partial<ForecastWorkspaceSettings>) => {
    try {
      updateWebSettings(window.localStorage, username, (settings) => ({
        ...settings,
        workspace: { ...settings.workspace, ...patch },
      }));
      setSettingsError("");
    } catch { setSettingsError(WEB_SETTINGS_SAVE_ERROR); }
  }, [username]);

  return {
    settingsError,
    viewMode: workspace.forecastViewMode,
    chartMode: workspace.forecastChartMode,
    breakdown: workspace.forecastBreakdown,
    onViewModeChange: useCallback((forecastViewMode: ForecastWorkspaceSettings["forecastViewMode"]) => update({ forecastViewMode }), [update]),
    onChartModeChange: useCallback((forecastChartMode: ForecastWorkspaceSettings["forecastChartMode"]) => update({ forecastChartMode }), [update]),
    onBreakdownChange: useCallback((forecastBreakdown: ForecastWorkspaceSettings["forecastBreakdown"]) => update({ forecastBreakdown }), [update]),
  };
}
