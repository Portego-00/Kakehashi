"use client";

import { useCallback } from "react";
import { loadWebSettings, saveWebSettings, type WebSettings } from "@/features/settings/settings";
import { useWorkspacePreferences } from "@/features/settings/use-workspace-preferences";

type ForecastWorkspaceSettings = Pick<WebSettings["workspace"], "forecastViewMode" | "forecastChartMode" | "forecastBreakdown">;

export const REVIEW_FORECAST_PREVIEW_PREFERENCES = {
  viewMode: "chart" as const,
  chartMode: "hourly" as const,
  breakdown: "off" as const,
  onViewModeChange: () => {},
  onChartModeChange: () => {},
  onBreakdownChange: () => {},
};

export function useReviewForecastPreferences(username: string) {
  const workspace = useWorkspacePreferences(username);
  const update = useCallback((patch: Partial<ForecastWorkspaceSettings>) => {
    const settings = loadWebSettings(window.localStorage, username);
    saveWebSettings(window.localStorage, username, {
      ...settings,
      workspace: { ...settings.workspace, ...patch },
    });
  }, [username]);

  return {
    viewMode: workspace.forecastViewMode,
    chartMode: workspace.forecastChartMode,
    breakdown: workspace.forecastBreakdown,
    onViewModeChange: useCallback((forecastViewMode: ForecastWorkspaceSettings["forecastViewMode"]) => update({ forecastViewMode }), [update]),
    onChartModeChange: useCallback((forecastChartMode: ForecastWorkspaceSettings["forecastChartMode"]) => update({ forecastChartMode }), [update]),
    onBreakdownChange: useCallback((forecastBreakdown: ForecastWorkspaceSettings["forecastBreakdown"]) => update({ forecastBreakdown }), [update]),
  };
}
