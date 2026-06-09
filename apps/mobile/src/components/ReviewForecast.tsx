import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  Layout,
} from "react-native-reanimated";
import SrsLevelIcon from "./SrsLevelIcon";
import { DayForecast, SubjectTypeBreakdown } from "../types/wanikani";
import { isAssignmentInReviewQueueState } from "../utils/api";
import { useSubjectColors, withAlpha } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

type ReviewForecastProps = {
  forecast: DayForecast[];
  currentReviewCount?: number;
  currentLevel?: number;
  subjects?: any[];
  assignments?: any[];
};

type ViewMode = "list" | "chart";
type ChartMode = "hourly" | "daily";
type ForecastBreakdownMode = "subject" | "srs";
type SrsBreakdownKey =
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened";
type SrsBreakdown = Record<SrsBreakdownKey, number>;

// Storage key for view mode preference
const VIEW_MODE_STORAGE_KEY = "wanikani_forecast_view_mode";
const BREAKDOWN_MODE_STORAGE_KEY = "wanikani_forecast_breakdown_mode";
const REVIEW_FORECAST_DEBUG_PREFIX = "[ReviewForecastDebug]";

/**
 * ReviewForecast component displays upcoming review counts organized by day and hour
 *
 * This component visualizes the WaniKani review forecast data, showing how many
 * reviews will become available each day and hour over the next 7 days. It allows
 * users to expand/collapse each day to see the hourly breakdown or view as a bar chart.
 *
 * Features:
 * - Toggle between expandable list view and bar chart view
 * - Bar chart can show hourly (24h) or daily (7 days) cumulative reviews
 * - Expandable/collapsible day sections with smooth animations in list view
 * - Visual bar graphs for hourly review counts
 * - Shows both individual and cumulative review counts
 * - Auto-expands "Today" by default in list view
 * - Persists view mode preference using AsyncStorage
 *
 * @param props.forecast - Array of DayForecast objects containing the review forecast data
 *
 * @example
 * <ReviewForecast forecast={dashboardData.forecast} />
 */
export default function ReviewForecast({
  forecast,
  currentReviewCount = 0,
  currentLevel,
  subjects,
  assignments,
}: ReviewForecastProps) {
  const debugLog = (message: string, payload?: unknown) => {
    if (!__DEV__) return;
    if (payload !== undefined) {
      console.log(`${REVIEW_FORECAST_DEBUG_PREFIX} ${message}`, payload);
      return;
    }
    console.log(`${REVIEW_FORECAST_DEBUG_PREFIX} ${message}`);
  };

  const subjectColors = useSubjectColors();
  const SUBJECT_COLORS = {
    radical: subjectColors.radical,
    kanji: subjectColors.kanji,
    vocabulary: subjectColors.vocabulary,
    kana_vocabulary: subjectColors.vocabulary,
  } as const;
  const { theme } = useTheme();
  const SRS_COLORS: Record<SrsBreakdownKey, string> = {
    apprentice: theme.isDark ? "#ff33aa" : "#dd0093",
    guru: theme.isDark ? "#c744e8" : "#882d9e",
    master: theme.isDark ? "#4c73ff" : "#294dd1",
    enlightened: theme.isDark ? "#2ebeff" : "#0093dd",
  };
  const subjectLegendItems = [
    {
      key: "radical",
      symbol: "幺",
      color: SUBJECT_COLORS.radical,
    },
    {
      key: "kanji",
      symbol: "字",
      color: SUBJECT_COLORS.kanji,
    },
    {
      key: "vocabulary",
      symbol: "語",
      color: SUBJECT_COLORS.vocabulary,
    },
  ] as const;
  const srsLegendItems = [
    {
      key: "apprentice",
      level: "Apprentice",
      color: SRS_COLORS.apprentice,
    },
    { key: "guru", level: "Guru", color: SRS_COLORS.guru },
    {
      key: "master",
      level: "Master",
      color: SRS_COLORS.master,
    },
    {
      key: "enlightened",
      level: "Enlightened",
      color: SRS_COLORS.enlightened,
    },
  ] as const;
  const { forecastShowSubjectColors, setForecastShowSubjectColors } =
    useSettingsStore();
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [chartMode, setChartMode] = useState<ChartMode>("hourly");
  const [forecastBreakdownMode, setForecastBreakdownMode] =
    useState<ForecastBreakdownMode>("subject");
  const [hasLoadedBreakdownMode, setHasLoadedBreakdownMode] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get("window"));

  const createEmptySrsBreakdown = (): SrsBreakdown => ({
    apprentice: 0,
    guru: 0,
    master: 0,
    enlightened: 0,
  });

  const getSrsBreakdownKey = (srsStage?: number): SrsBreakdownKey | null => {
    if (typeof srsStage !== "number") return null;
    if (srsStage >= 1 && srsStage <= 4) return "apprentice";
    if (srsStage >= 5 && srsStage <= 6) return "guru";
    if (srsStage === 7) return "master";
    if (srsStage === 8) return "enlightened";
    return null;
  };

  const getSrsBreakdownTotal = (breakdown: SrsBreakdown): number =>
    breakdown.apprentice +
    breakdown.guru +
    breakdown.master +
    breakdown.enlightened;

  const assignmentStageMap = useMemo(() => {
    const map = new Map<number, number>();
    assignments?.forEach((assignment) => {
      const subjectId = assignment?.data?.subject_id;
      const srsStage = assignment?.data?.srs_stage;
      if (typeof subjectId === "number" && typeof srsStage === "number") {
        map.set(subjectId, srsStage);
      }
    });
    return map;
  }, [assignments]);

  // Helper function to identify if reviews contain critical items
  const areReviewsCritical = (
    subjectBreakdown?: SubjectTypeBreakdown,
    subjectIds?: number[]
  ): boolean => {
    if (!subjectIds || !currentLevel || !subjects || !assignments) return false;

    // Create assignment lookup map
    const assignmentMap = new Map();
    assignments.forEach((a) => assignmentMap.set(a.data.subject_id, a));

    // Create subject lookup map
    const subjectMap = new Map();
    subjects.forEach((s) => subjectMap.set(s.id, s));

    // Check if any of the specific subject IDs being reviewed are critical
    return subjectIds.some((subjectId) => {
      const subject = subjectMap.get(subjectId);
      const assignment = assignmentMap.get(subjectId);

      if (!subject || !assignment) return false;

      // Must be from current level
      if (subject.data.level !== currentLevel) return false;

      // Must be radical or kanji
      if (subject.object !== "radical" && subject.object !== "kanji")
        return false;

      // Must be in apprentice stage (SRS 1-4)
      return assignment.data.srs_stage >= 1 && assignment.data.srs_stage <= 4;
    });
  };

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

  // Check if we have a large screen for more bars
  const isLargeScreen = screenData.width > 768;

  // Load saved view mode preference on component mount
  useEffect(() => {
    const loadSavedViewMode = async () => {
      try {
        const savedViewMode = await AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY);
        if (savedViewMode === "list" || savedViewMode === "chart") {
          setViewMode(savedViewMode);
        }
      } catch (error) {
        console.warn("Failed to load view mode preference", error);
      }
    };

    loadSavedViewMode();
  }, []);

  useEffect(() => {
    const loadSavedBreakdownMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(BREAKDOWN_MODE_STORAGE_KEY);
        if (savedMode === "subject" || savedMode === "srs") {
          setForecastBreakdownMode(savedMode);
        }
      } catch (error) {
        console.warn("Failed to load forecast breakdown mode", error);
      } finally {
        setHasLoadedBreakdownMode(true);
      }
    };

    loadSavedBreakdownMode();
  }, []);

  useEffect(() => {
    if (!hasLoadedBreakdownMode) return;

    AsyncStorage.setItem(BREAKDOWN_MODE_STORAGE_KEY, forecastBreakdownMode).catch(
      (error) => {
        console.warn("Failed to save forecast breakdown mode", error);
      }
    );
  }, [forecastBreakdownMode, hasLoadedBreakdownMode]);

  // Expand only "Today" by default whenever forecast changes
  useEffect(() => {
    if (forecast?.length) {
      const initial: Record<string, boolean> = {};
      forecast.forEach((d) => {
        initial[d.day] = d.day === "Today";
      });
      setExpandedDays(initial);
    }
  }, [forecast]);

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const handleViewModeChange = async (newViewMode: ViewMode) => {
    setViewMode(newViewMode);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, newViewMode);
    } catch (error) {
      console.warn("Failed to save view mode preference", error);
    }
  };

  const cycleForecastBreakdownMode = () => {
    if (!forecastShowSubjectColors) {
      if (forecastBreakdownMode !== "subject") {
        setForecastBreakdownMode("subject");
      }
      setForecastShowSubjectColors(true);
      return;
    }

    if (forecastBreakdownMode === "subject") {
      setForecastBreakdownMode("srs");
      return;
    }

    setForecastBreakdownMode("subject");
    setForecastShowSubjectColors(false);
  };

  // Helper function to create cumulative subject breakdown
  const createCumulativeBreakdown = (
    breakdowns: (SubjectTypeBreakdown | undefined)[]
  ): SubjectTypeBreakdown => {
    const cumulative: SubjectTypeBreakdown = {
      radical: 0,
      kanji: 0,
      vocabulary: 0,
      kana_vocabulary: 0,
    };

    breakdowns.forEach((breakdown) => {
      if (breakdown) {
        cumulative.radical += breakdown.radical;
        cumulative.kanji += breakdown.kanji;
        cumulative.vocabulary += breakdown.vocabulary;
        cumulative.kana_vocabulary += breakdown.kana_vocabulary;
      }
    });

    return cumulative;
  };

  const createCumulativeSrsBreakdown = (
    breakdowns: (SrsBreakdown | undefined)[]
  ): SrsBreakdown => {
    const cumulative = createEmptySrsBreakdown();

    breakdowns.forEach((breakdown) => {
      if (!breakdown) return;
      cumulative.apprentice += breakdown.apprentice;
      cumulative.guru += breakdown.guru;
      cumulative.master += breakdown.master;
      cumulative.enlightened += breakdown.enlightened;
    });

    return cumulative;
  };

  const createSrsBreakdownFromSubjectIds = useCallback(
    (subjectIds?: number[]): SrsBreakdown | undefined => {
      if (!subjectIds?.length || assignmentStageMap.size === 0) return undefined;

      const breakdown = createEmptySrsBreakdown();
      let counted = 0;

      subjectIds.forEach((subjectId) => {
        const srsStage = assignmentStageMap.get(subjectId);
        const srsKey = getSrsBreakdownKey(srsStage);
        if (!srsKey) return;
        breakdown[srsKey]++;
        counted++;
      });

      return counted > 0 ? breakdown : undefined;
    },
    [assignmentStageMap]
  );

  // Helper to calculate breakdown from assignments
  const calculateCurrentBreakdown = useCallback(
    (): SubjectTypeBreakdown | undefined => {
      if (!assignments || !subjects || currentReviewCount === 0) return undefined;

      const breakdown: SubjectTypeBreakdown = {
        radical: 0,
        kanji: 0,
        vocabulary: 0,
        kana_vocabulary: 0,
      };

      const now = new Date();
      // Create map for fast lookups
      const subjectMap = new Map();
      subjects.forEach((s) => subjectMap.set(s.id, s));

      let counted = 0;

      assignments.forEach((a) => {
        if (!isAssignmentInReviewQueueState(a?.data)) {
          return;
        }

        const availableAt = new Date(a.data.available_at);
        if (availableAt <= now) {
          const subject = subjectMap.get(a.data.subject_id);
          if (subject) {
            const type = subject.object as keyof SubjectTypeBreakdown;
            if (breakdown[type] !== undefined) {
              breakdown[type]++;
              counted++;
            }
          }
        }
      });

      if (counted === 0) return undefined;

      return breakdown;
    },
    [assignments, currentReviewCount, subjects]
  );

  const calculateCurrentSrsBreakdown = useCallback(
    (): SrsBreakdown | undefined => {
      if (!assignments || currentReviewCount === 0) return undefined;

      const breakdown = createEmptySrsBreakdown();
      const now = new Date();
      let counted = 0;

      assignments.forEach((assignment) => {
        if (!isAssignmentInReviewQueueState(assignment?.data)) return;

        const availableAt = new Date(assignment.data.available_at);
        if (availableAt <= now) {
          const srsKey = getSrsBreakdownKey(assignment.data.srs_stage);
          if (!srsKey) return;
          breakdown[srsKey]++;
          counted++;
        }
      });

      return counted > 0 ? breakdown : undefined;
    },
    [assignments, currentReviewCount]
  );

  // Debug snapshot to diagnose overcounting and mismatch between props and computed totals.
  useEffect(() => {
    if (!__DEV__) return;

    const now = new Date();
    const nowMs = now.getTime();
    const currentHour = now.getHours();
    const todayData = forecast?.[0];
    const todayHours = todayData?.hours || [];

    const todayTotalFromHours = todayHours.reduce((sum, h) => sum + h.count, 0);
    const todayPastAndCurrentHours = todayHours
      .filter((h) => h.hour <= currentHour)
      .reduce((sum, h) => sum + h.count, 0);
    const todayFutureIncludingCurrentHour = todayHours
      .filter((h) => h.hour >= currentHour)
      .reduce((sum, h) => sum + h.count, 0);
    const todayFutureAfterCurrentHour = todayHours
      .filter((h) => h.hour > currentHour)
      .reduce((sum, h) => sum + h.count, 0);
    const todayCurrentHourCount =
      todayHours.find((h) => h.hour === currentHour)?.count || 0;

    const assignmentQueueNowCount = assignments
      ? assignments.reduce((count, assignment) => {
          if (!isAssignmentInReviewQueueState(assignment?.data)) return count;
          const availableAtMs = Date.parse(assignment.data.available_at);
          if (Number.isNaN(availableAtMs)) return count;
          return availableAtMs <= nowMs ? count + 1 : count;
        }, 0)
      : undefined;

    const assignmentQueueInNext7DaysCount = assignments
      ? assignments.reduce((count, assignment) => {
          if (!isAssignmentInReviewQueueState(assignment?.data)) return count;
          const availableAtMs = Date.parse(assignment.data.available_at);
          if (Number.isNaN(availableAtMs)) return count;
          const diffMs = availableAtMs - nowMs;
          return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000
            ? count + 1
            : count;
        }, 0)
      : undefined;

    const currentBreakdown = calculateCurrentBreakdown();
    const currentBreakdownTotal = currentBreakdown
      ? currentBreakdown.radical +
        currentBreakdown.kanji +
        currentBreakdown.vocabulary +
        currentBreakdown.kana_vocabulary
      : 0;
    const currentSrsBreakdown = calculateCurrentSrsBreakdown();
    const currentSrsBreakdownTotal = currentSrsBreakdown
      ? getSrsBreakdownTotal(currentSrsBreakdown)
      : 0;

    const hourlyInitialRunningTotal =
      (todayData?.cumulativeCount || 0) + currentReviewCount;
    const hourlyRunningAfterFutureSubtraction =
      hourlyInitialRunningTotal - todayFutureIncludingCurrentHour;

    debugLog("inputs", {
      now: now.toISOString(),
      currentHour,
      timezoneOffsetMinutes: now.getTimezoneOffset(),
      resolvedTimeZone:
        Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || "unknown",
      chartMode,
      viewMode,
      forecastShowSubjectColors,
      forecastBreakdownMode,
      currentLevel,
      currentReviewCount,
      forecastDays: forecast?.length || 0,
      subjectsCount: subjects?.length || 0,
      assignmentsCount: assignments?.length || 0,
    });

    debugLog("today-forecast-raw", {
      day: todayData?.day,
      totalCount: todayData?.totalCount || 0,
      cumulativeCount: todayData?.cumulativeCount || 0,
      hoursCount: todayHours.length,
      todayTotalFromHours,
      todayPastAndCurrentHours,
      todayCurrentHourCount,
      todayFutureIncludingCurrentHour,
      todayFutureAfterCurrentHour,
    });

    debugLog("assignment-cross-check", {
      assignmentQueueNowCount,
      assignmentQueueInNext7DaysCount,
      currentBreakdownTotal,
      currentBreakdown,
      currentSrsBreakdownTotal,
      currentSrsBreakdown,
    });

    debugLog("ui-cumulative-values", {
      listTodayCumulativeShown: (todayData?.cumulativeCount || 0) + currentReviewCount,
      hourlyInitialRunningTotal,
      hourlyRunningAfterFutureSubtraction,
    });

    debugLog(
      "per-day-cumulative-rendered",
      (forecast || []).map((day) => ({
        day: day.day,
        totalCount: day.totalCount,
        cumulativeFromForecast: day.cumulativeCount,
        cumulativeShownInList: day.cumulativeCount + currentReviewCount,
      }))
    );
  }, [
    assignments,
    calculateCurrentBreakdown,
    calculateCurrentSrsBreakdown,
    chartMode,
    currentLevel,
    currentReviewCount,
    forecastBreakdownMode,
    forecastShowSubjectColors,
    forecast,
    subjects,
    viewMode,
  ]);

  // Prepare data for chart view
  const getChartData = () => {
    if (!forecast?.length) return [];

    // Estimate or calculate breakdown of currently available reviews
    // We do this outside the conditional because daily view also needs to include current reviews in its cumulative breakdown
    let currentBreakdown: SubjectTypeBreakdown | undefined =
      calculateCurrentBreakdown();
    const currentSrsBreakdown = calculateCurrentSrsBreakdown();

    // For fallback logic, we need today's data and current hour.
    const todayData = forecast[0];
    const currentHour = new Date().getHours();

    // Fallback logic for breakdown if calculateCurrentBreakdown returned undefined but we have reviews
    if (
      !currentBreakdown &&
      todayData?.day === "Today" &&
      todayData.hours &&
      currentReviewCount > 0
    ) {
      // Note: reusing the logic from hourly view to estimate breakdown based on past hours
      // Calculate the breakdown of all past hours (including current hour)
      const pastHoursBreakdown = createCumulativeBreakdown(
        todayData.hours
          .filter((h) => h.hour <= currentHour)
          .map((h) => h.subjectBreakdown)
      );

      const breakdownTotal =
        pastHoursBreakdown.radical +
        pastHoursBreakdown.kanji +
        pastHoursBreakdown.vocabulary +
        pastHoursBreakdown.kana_vocabulary;

      if (breakdownTotal > 0) {
        currentBreakdown = pastHoursBreakdown;
        debugLog("fallback-breakdown-from-past-hours", {
          breakdown: pastHoursBreakdown,
          breakdownTotal,
          currentReviewCount,
        });
      } else {
        // Try to get breakdown from all hours in today
        const allTodayBreakdown = createCumulativeBreakdown(
          todayData.hours.map((h) => h.subjectBreakdown)
        );
        // If still no breakdown, create a default one (assume all vocabulary)
        if (
          allTodayBreakdown.radical +
            allTodayBreakdown.kanji +
            allTodayBreakdown.vocabulary +
            allTodayBreakdown.kana_vocabulary ===
          0
        ) {
          currentBreakdown = {
            radical: 0,
            kanji: 0,
            vocabulary: currentReviewCount,
            kana_vocabulary: 0,
          };
          debugLog("fallback-breakdown-defaulted-to-vocabulary", {
            currentReviewCount,
          });
        } else {
          currentBreakdown = allTodayBreakdown;
          debugLog("fallback-breakdown-from-all-today-hours", {
            breakdown: allTodayBreakdown,
            currentReviewCount,
          });
        }
      }
    }

    if (chartMode === "daily") {
      // Show daily cumulative data - start with current reviews available now
      // Add current review count to the first day's cumulative count
      let runningTotal =
        (forecast[0]?.cumulativeCount || 0) + currentReviewCount;

      return forecast.map((day, index) => {
        // For cumulative breakdown, we must include the current breakdown PLUS the forecast ones up to this day
        const forecastBreakdowns = forecast
          .slice(0, index + 1)
          .map((d) => d.subjectBreakdown);
        // Prepend currentBreakdown to the list of breakdowns to sum up
        const cumulativeBreakdown = createCumulativeBreakdown([
          currentBreakdown,
          ...forecastBreakdowns,
        ]);

        // Collect all subject IDs for this day
        const daySubjectIds =
          day.hours?.flatMap((h) => h.subjectIds || []) || [];
        const forecastSrsBreakdowns = forecast.slice(0, index + 1).map((d) =>
          createSrsBreakdownFromSubjectIds(
            d.hours?.flatMap((h) => h.subjectIds || []) || []
          )
        );
        const cumulativeSrsBreakdown = createCumulativeSrsBreakdown([
          currentSrsBreakdown,
          ...forecastSrsBreakdowns,
        ]);

        if (index === 0) {
          // For the first day (Today), use cumulative count + current reviews
          // For cumulative breakdown, we need to include all previous breakdowns

          return {
            label:
              day.day === "Today"
                ? "Today"
                : day.day === "Tomorrow"
                ? "Tomorrow"
                : day.day.slice(0, 3),
            value: runningTotal,
            count: day.totalCount,
            isToday: day.day === "Today",
            subjectBreakdown: cumulativeBreakdown,
            srsBreakdown: cumulativeSrsBreakdown,
            subjectIds: daySubjectIds,
          };
        } else {
          // For subsequent days, add the new reviews to the running total
          runningTotal += day.totalCount;

          return {
            label:
              day.day === "Today"
                ? "Today"
                : day.day === "Tomorrow"
                ? "Tomorrow"
                : day.day.slice(0, 3),
            value: runningTotal,
            count: day.totalCount,
            isToday: day.day === "Today",
            subjectBreakdown: cumulativeBreakdown,
            srsBreakdown: cumulativeSrsBreakdown,
            subjectIds: daySubjectIds,
          };
        }
      });
    } else {
      // Show hourly data for the next 48 hours (or 24 on smaller screens)
      const maxHours = isLargeScreen ? 48 : 24;
      const hourlyData = [];
      const currentHour = new Date().getHours();

      // Start with current available reviews + cumulative forecast
      const todayData = forecast[0];
      let runningTotal = (todayData?.cumulativeCount || 0) + currentReviewCount;

      // If we're looking at Today, subtract the reviews that haven't happened yet today
      if (todayData?.day === "Today" && todayData.hours) {
        const futureHoursToday = todayData.hours
          .filter((h) => h.hour >= currentHour)
          .reduce((sum, h) => sum + h.count, 0);
        runningTotal = runningTotal - futureHoursToday;
      }

      // Get all available days for hourly data
      const availableDays = forecast.slice(0, 3); // Today, Tomorrow, and day after

      // Track cumulative breakdown for hourly data
      const allHourlyBreakdowns: (SubjectTypeBreakdown | undefined)[] = [];
      const allHourlySrsBreakdowns: (SrsBreakdown | undefined)[] = [];

      // Initialize hoursAdded counter
      let hoursAdded = 0;

      // Always include a "Now" bar so hourly graph mode has an explicit current-time anchor.
      // Breakdown data is optional and can be missing depending on loading order.
      const currentSubjectIds: number[] = [];
      if (forecast[0]?.hours) {
        forecast[0].hours
          .filter((h) => h.hour <= currentHour)
          .forEach((h) => {
            if (h.subjectIds) {
              currentSubjectIds.push(...h.subjectIds);
            }
          });
      }

      hourlyData.push({
        label: "Now",
        value: Math.max(runningTotal, 0),
        count: 0, // No new reviews at "Now", just showing current state
        isToday: true,
        dayLabel: "",
        subjectBreakdown: currentBreakdown,
        srsBreakdown: currentSrsBreakdown,
        subjectIds: currentSubjectIds,
      } as any);
      hoursAdded++;

      // Include current breakdowns in cumulative stacking when available.
      allHourlyBreakdowns.push(currentBreakdown);
      allHourlySrsBreakdowns.push(currentSrsBreakdown);
      for (const day of availableDays) {
        if (hoursAdded >= maxHours || !day.hours) break;

        // For today, start from the next hour after current; for other days, start from 0
        const startHour = day.day === "Today" ? currentHour + 1 : 0;

        for (let i = 0; i < day.hours.length && hoursAdded < maxHours; i++) {
          const hour = day.hours[i];
          if (hour.hour >= startHour) {
            runningTotal += hour.count;
            allHourlyBreakdowns.push(hour.subjectBreakdown);
            const hourSrsBreakdown = createSrsBreakdownFromSubjectIds(
              hour.subjectIds || []
            );
            allHourlySrsBreakdowns.push(hourSrsBreakdown);

            // Calculate cumulative breakdown up to this hour
            const cumulativeBreakdown =
              createCumulativeBreakdown(allHourlyBreakdowns);
            const cumulativeSrsBreakdown =
              createCumulativeSrsBreakdown(allHourlySrsBreakdowns);

            hourlyData.push({
              label:
                hour.hour === 0
                  ? "12A"
                  : hour.hour === 12
                  ? "12P"
                  : hour.hour > 12
                  ? `${hour.hour - 12}P`
                  : `${hour.hour}A`,
              value: runningTotal,
              count: hour.count,
              isToday: day.day === "Today",
              dayLabel:
                day.day === "Today"
                  ? ""
                  : day.day === "Tomorrow"
                  ? "(T)"
                  : "(+2)",
              subjectBreakdown: cumulativeBreakdown,
              srsBreakdown: cumulativeSrsBreakdown,
              subjectIds: hour.subjectIds || [],
            } as any);
            hoursAdded++;
          }
        }
      }

      return hourlyData;
    }
  };

  const chartData = getChartData();
  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const listNowSubjectBreakdown = useMemo(
    () => calculateCurrentBreakdown(),
    [calculateCurrentBreakdown]
  );
  const listNowSrsBreakdown = useMemo(
    () => calculateCurrentSrsBreakdown(),
    [calculateCurrentSrsBreakdown]
  );

  // Helper function to render colored subject type bars (vertical stacking for charts)
  const renderColoredBar = (
    breakdown: SubjectTypeBreakdown,
    totalHeight: number,
    width: string = "80%",
    isCritical: boolean = false
  ) => {
    const total =
      breakdown.radical +
      breakdown.kanji +
      breakdown.vocabulary +
      breakdown.kana_vocabulary;
    if (total === 0)
      return (
        <View
          style={{
            width: width as any,
            height: 2,
            backgroundColor: "#ddd",
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
      );

    const segments: React.ReactNode[] = [];
    let currentHeight = 0;

    // Order matters for visual stacking (bottom to top)
    const types: (keyof SubjectTypeBreakdown)[] = [
      "radical",
      "kanji",
      "vocabulary",
      "kana_vocabulary",
    ];

    types.forEach((type) => {
      if (breakdown[type] > 0) {
        const segmentHeight = (breakdown[type] / total) * totalHeight;
        segments.push(
          <View
            key={type}
            style={{
              position: "absolute",
              bottom: currentHeight,
              width: "100%",
              height: Math.max(segmentHeight, 1), // Minimum 1px height
              backgroundColor: SUBJECT_COLORS[type],
            }}
          />
        );
        currentHeight += segmentHeight;
      }
    });

    return (
      <View
        style={{
          width: width as any,
          height: totalHeight,
          position: "relative",
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          overflow: "hidden",
        }}
      >
        {segments}
        {isCritical && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: 2,
              borderColor: "#FF6B6B",
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: "rgba(255, 107, 107, 0.2)", // Light red overlay
            }}
          />
        )}
      </View>
    );
  };

  const renderSrsColoredBar = (
    breakdown: SrsBreakdown,
    totalHeight: number,
    width: string = "80%",
    isCritical: boolean = false
  ) => {
    const total = getSrsBreakdownTotal(breakdown);
    if (total === 0)
      return (
        <View
          style={{
            width: width as any,
            height: 2,
            backgroundColor: "#ddd",
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
      );

    const segments: React.ReactNode[] = [];
    let currentHeight = 0;
    const stages: SrsBreakdownKey[] = [
      "apprentice",
      "guru",
      "master",
      "enlightened",
    ];

    stages.forEach((stage) => {
      if (breakdown[stage] > 0) {
        const segmentHeight = (breakdown[stage] / total) * totalHeight;
        segments.push(
          <View
            key={stage}
            style={{
              position: "absolute",
              bottom: currentHeight,
              width: "100%",
              height: Math.max(segmentHeight, 1),
              backgroundColor: SRS_COLORS[stage],
            }}
          />
        );
        currentHeight += segmentHeight;
      }
    });

    return (
      <View
        style={{
          width: width as any,
          height: totalHeight,
          position: "relative",
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          overflow: "hidden",
        }}
      >
        {segments}
        {isCritical && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: 2,
              borderColor: "#FF6B6B",
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: "rgba(255, 107, 107, 0.2)",
            }}
          />
        )}
      </View>
    );
  };

  // Helper function to render horizontal colored bars (for list view)
  const renderHorizontalColoredBar = (
    breakdown: SubjectTypeBreakdown,
    width: string = "100%"
  ) => {
    const total =
      breakdown.radical +
      breakdown.kanji +
      breakdown.vocabulary +
      breakdown.kana_vocabulary;
    if (total === 0)
      return (
        <View
          style={{
            width: width as any,
            height: "100%",
            backgroundColor: "#62d862",
          }}
        />
      );

    const segments: React.ReactNode[] = [];
    let currentWidth = 0;

    // Order matters for visual arrangement (left to right)
    const types: (keyof SubjectTypeBreakdown)[] = [
      "radical",
      "kanji",
      "vocabulary",
      "kana_vocabulary",
    ];

    types.forEach((type) => {
      if (breakdown[type] > 0) {
        const segmentWidth = (breakdown[type] / total) * 100; // percentage
        segments.push(
          <View
            key={type}
            style={{
              position: "absolute",
              left: `${currentWidth}%`,
              width: `${segmentWidth}%`,
              height: "100%",
              backgroundColor: SUBJECT_COLORS[type],
            }}
          />
        );
        currentWidth += segmentWidth;
      }
    });

    return (
      <View
        style={{
          width: width as any,
          height: "100%",
          position: "relative",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {segments}
      </View>
    );
  };

  const renderHorizontalSrsColoredBar = (
    breakdown: SrsBreakdown,
    width: string = "100%"
  ) => {
    const total = getSrsBreakdownTotal(breakdown);
    if (total === 0)
      return (
        <View
          style={{
            width: width as any,
            height: "100%",
            backgroundColor: "#62d862",
          }}
        />
      );

    const segments: React.ReactNode[] = [];
    let currentWidth = 0;
    const stages: SrsBreakdownKey[] = [
      "apprentice",
      "guru",
      "master",
      "enlightened",
    ];

    stages.forEach((stage) => {
      if (breakdown[stage] > 0) {
        const segmentWidth = (breakdown[stage] / total) * 100;
        segments.push(
          <View
            key={stage}
            style={{
              position: "absolute",
              left: `${currentWidth}%`,
              width: `${segmentWidth}%`,
              height: "100%",
              backgroundColor: SRS_COLORS[stage],
            }}
          />
        );
        currentWidth += segmentWidth;
      }
    });

    return (
      <View
        style={{
          width: width as any,
          height: "100%",
          position: "relative",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {segments}
      </View>
    );
  };

  // Helper function to render traditional single-color bar
  const renderSingleColorBar = (
    height: number,
    color: string,
    width: string = "80%"
  ) => (
    <View
      style={{
        width: width as any,
        height,
        backgroundColor: color,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        minHeight: 2,
      }}
    />
  );

  const renderChartView = () => (
    <Animated.View
      layout={Layout.duration(200).easing(Easing.ease)}
      style={styles.chartContainer}
    >
      {/* Bar chart */}
      {chartMode === "hourly" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chartScrollView}
          contentContainerStyle={styles.chartBarsScrollable}
        >
          {chartData.map((item, index) => {
            const barHeight = Math.max((item.value / maxValue) * 120, 2);
            const isCritical = areReviewsCritical(
              (item as any).subjectBreakdown,
              (item as any).subjectIds
            );
            const barColor = isCritical
              ? theme.error
              : chartMode === "hourly"
              ? item.isToday
                ? theme.primary
                : withAlpha(theme.primary, 0.55)
              : index === 0
              ? theme.primary
              : withAlpha(theme.primary, 0.55);

            // Only show value if it's different from the previous bar or it's the first bar
            const showValue =
              index === 0 || chartData[index - 1].value !== item.value;

            return (
              <Animated.View
                key={`${item.label}-${index}`}
                entering={FadeInDown.delay(index * 50).duration(300)}
                style={[
                  styles.chartBarContainerScrollable,
                  isLargeScreen && styles.chartBarContainerScrollableLarge,
                ]}
              >
                <Text
                  style={[styles.chartBarValue, { color: theme.textSecondary }]}
                >
                  {showValue && item.value > 0 ? item.value : ""}
                </Text>
                <View style={[styles.chartBar, { height: barHeight }]}>
                  {forecastShowSubjectColors &&
                  forecastBreakdownMode === "subject" &&
                  (item as any).subjectBreakdown
                    ? renderColoredBar(
                        (item as any).subjectBreakdown,
                        barHeight,
                        "100%",
                        isCritical
                      )
                    : forecastShowSubjectColors &&
                      forecastBreakdownMode === "srs" &&
                      (item as any).srsBreakdown &&
                      getSrsBreakdownTotal((item as any).srsBreakdown) > 0
                    ? renderSrsColoredBar(
                        (item as any).srsBreakdown,
                        barHeight,
                        "100%",
                        isCritical
                      )
                    : renderSingleColorBar(barHeight, barColor, "100%")}
                </View>
                <Text
                  style={[styles.chartBarLabel, { color: theme.textSecondary }]}
                >
                  {item.label}
                  {(item as any).dayLabel && (
                    <Text
                      style={[
                        styles.chartBarDayLabel,
                        { color: theme.textLight },
                      ]}
                    >
                      {"\n"}
                      {(item as any).dayLabel}
                    </Text>
                  )}
                </Text>
              </Animated.View>
            );
          })}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.chartBarsDaily,
            { paddingHorizontal: isLargeScreen ? 16 : 8 },
          ]}
        >
          {chartData.map((item, index) => {
            const barHeight = Math.max((item.value / maxValue) * 100, 2);
            const isCritical = areReviewsCritical(
              (item as any).subjectBreakdown,
              (item as any).subjectIds
            );
            const barColor = isCritical
              ? theme.error
              : index === 0
              ? theme.primary
              : withAlpha(theme.primary, 0.55);

            // Only show value if it's different from the previous bar or it's the first bar
            const showValue =
              index === 0 || chartData[index - 1].value !== item.value;

            // Calculate available width accounting for card padding and chart padding
            const cardPadding = 32; // 16px on each side
            const chartPadding = isLargeScreen ? 32 : 16; // paddingHorizontal * 2
            const availableWidth =
              screenData.width - cardPadding - chartPadding;
            const maxBarWidth =
              Math.floor(availableWidth / chartData.length) - 4; // 4px margin between bars

            return (
              <Animated.View
                key={`${item.label}-${index}`}
                entering={FadeInDown.delay(index * 50).duration(300)}
                style={[styles.chartBarContainer, { maxWidth: maxBarWidth }]}
              >
                <Text
                  style={[styles.chartBarValue, { color: theme.textSecondary }]}
                >
                  {showValue && item.value > 0 ? item.value : ""}
                </Text>
                <View style={[styles.chartBar, { height: barHeight }]}>
                  {forecastShowSubjectColors &&
                  forecastBreakdownMode === "subject" &&
                  (item as any).subjectBreakdown
                    ? renderColoredBar(
                        (item as any).subjectBreakdown,
                        barHeight,
                        "100%",
                        isCritical
                      )
                    : forecastShowSubjectColors &&
                      forecastBreakdownMode === "srs" &&
                      (item as any).srsBreakdown &&
                      getSrsBreakdownTotal((item as any).srsBreakdown) > 0
                    ? renderSrsColoredBar(
                        (item as any).srsBreakdown,
                        barHeight,
                        "100%",
                        isCritical
                      )
                    : renderSingleColorBar(barHeight, barColor, "100%")}
                </View>
                <Text
                  style={[styles.chartBarLabel, { color: theme.textSecondary }]}
                >
                  {item.label}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );

  const renderListView = () => (
    <>
      {forecast.map((day) => {
        const isToday = day.day === "Today";
        const nonZeroHours = day.hours?.filter((h) => h.count > 0) || [];
        const shouldShowNowRow = isToday;
        const shouldShowNoReviewsText =
          nonZeroHours.length === 0 && (!isToday || currentReviewCount === 0);
        const nowRowWidth = currentReviewCount > 0 ? 100 : 0;

        return (
          <Animated.View
            key={day.day}
            // Animate each block so neighbouring blocks slide smoothly
            layout={Layout.duration(200).easing(Easing.ease)}
            style={styles.dayContainer}
          >
            <TouchableOpacity
              style={[styles.dayHeader, { borderColor: theme.border }]}
              onPress={() => toggleDay(day.day)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={expandedDays[day.day] ? "chevron-down" : "chevron-forward"}
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.dayTitle, { color: theme.textColor }]}>
                {day.day}
              </Text>
              <Text style={[styles.dayCount, { color: theme.textSecondary }]}>
                {day.totalCount}
              </Text>
              <Text style={[styles.dayCumulative, { color: theme.textLight }]}>
                {day.cumulativeCount + currentReviewCount}
              </Text>
            </TouchableOpacity>

            {expandedDays[day.day] && day.hours?.length ? (
              <Animated.View
                // Fade + slide hours list just like the old easeInEaseOut preset
                entering={FadeInDown.duration(200)}
                exiting={FadeOutUp.duration(200)}
                layout={Layout.duration(200).easing(Easing.ease)}
                style={styles.hoursContainer}
              >
                {shouldShowNowRow && (
                  <View
                    style={styles.hourRow}
                  >
                    <Text style={[styles.hourText, { color: theme.textSecondary }]}>
                      Now
                    </Text>
                    <View
                      style={[
                        styles.barContainer,
                        {
                          backgroundColor: theme.isDark ? "#2a2a2a" : "#f0f0f0",
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: `${nowRowWidth}%`,
                          height: "100%",
                        }}
                      >
                        {forecastShowSubjectColors &&
                        forecastBreakdownMode === "subject" &&
                        listNowSubjectBreakdown ? (
                          renderHorizontalColoredBar(listNowSubjectBreakdown, "100%")
                        ) : forecastShowSubjectColors &&
                          forecastBreakdownMode === "srs" &&
                          listNowSrsBreakdown &&
                          getSrsBreakdownTotal(listNowSrsBreakdown) > 0 ? (
                          renderHorizontalSrsColoredBar(listNowSrsBreakdown, "100%")
                        ) : (
                          <View
                            style={[
                              styles.bar,
                              {
                                width: "100%",
                                backgroundColor: theme.primary,
                              },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                    <Text style={[styles.hourCount, { color: theme.textSecondary }]}>
                      0
                    </Text>
                    <Text style={[styles.hourCumulative, { color: theme.textLight }]}>
                      {currentReviewCount}
                    </Text>
                  </View>
                )}

                {nonZeroHours.map((hour) => {
                  const isCritical = areReviewsCritical(
                    hour.subjectBreakdown,
                    hour.subjectIds
                  );
                  const hourSrsBreakdown = createSrsBreakdownFromSubjectIds(
                    hour.subjectIds || []
                  );
                  return (
                    <View
                      key={hour.hour}
                      style={[
                        styles.hourRow,
                        isCritical && {
                          backgroundColor: withAlpha(theme.error, 0.16),
                        },
                      ]}
                    >
                      <Text style={[styles.hourText, { color: theme.textSecondary }]}>
                        {hour.hour === 0
                          ? "12 am"
                          : hour.hour === 12
                          ? "12 pm"
                          : hour.hour > 12
                          ? `${hour.hour - 12} pm`
                          : `${hour.hour} am`}
                      </Text>
                      <View
                        style={[
                          styles.barContainer,
                          {
                            backgroundColor: theme.isDark ? "#2a2a2a" : "#f0f0f0",
                          },
                        ]}
                      >
                        <View
                          style={{
                            width: `${Math.min(
                              100,
                              (hour.count / day.totalCount) * 100
                            )}%`,
                            height: "100%",
                          }}
                        >
                          {forecastShowSubjectColors &&
                          forecastBreakdownMode === "subject" &&
                          hour.subjectBreakdown ? (
                            renderHorizontalColoredBar(hour.subjectBreakdown, "100%")
                          ) : forecastShowSubjectColors &&
                            forecastBreakdownMode === "srs" &&
                            hourSrsBreakdown &&
                            getSrsBreakdownTotal(hourSrsBreakdown) > 0 ? (
                            renderHorizontalSrsColoredBar(hourSrsBreakdown, "100%")
                          ) : (
                            <View
                              style={[
                                styles.bar,
                                {
                                  width: "100%",
                                  backgroundColor: theme.primary,
                                },
                              ]}
                            />
                          )}
                        </View>
                      </View>
                      <Text style={[styles.hourCount, { color: theme.textSecondary }]}>
                        {hour.count}
                      </Text>
                      <Text style={[styles.hourCumulative, { color: theme.textLight }]}>
                        {hour.cumulativeCount + currentReviewCount}
                      </Text>
                    </View>
                  );
                })}

                {shouldShowNoReviewsText && (
                  <Text style={[styles.noReviewsText, { color: theme.textLight }]}>
                    No reviews scheduled for this day.
                  </Text>
                )}
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </>
  );

  const renderBreakdownLegend = () => {
    if (!forecastShowSubjectColors) return null;

    const isSubjectMode = forecastBreakdownMode === "subject";

    return (
      <Animated.View
        entering={FadeInDown.duration(180)}
        style={styles.breakdownLegend}
      >
        <Text style={[styles.breakdownLegendTitle, { color: theme.textLight }]}>
          {isSubjectMode ? "Type" : "SRS"}
        </Text>
        <View style={styles.breakdownLegendItems}>
          {isSubjectMode
            ? subjectLegendItems.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.breakdownLegendSubjectChip,
                    {
                      backgroundColor: item.color,
                      borderColor: withAlpha(theme.textColor, 0.45),
                    },
                  ]}
                >
                  <Text style={styles.breakdownLegendSubjectText}>
                    {item.symbol}
                  </Text>
                </View>
              ))
            : srsLegendItems.map((item) => (
                <View key={item.key} style={styles.breakdownLegendIcon}>
                  <SrsLevelIcon level={item.level} size={11} color={item.color} />
                </View>
              ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Review Forecast
        </Text>
      </View>

      <Animated.View
        layout={Layout.duration(200).easing(Easing.ease)}
        style={[
          styles.container,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            borderWidth: 1,
            shadowColor: theme.isDark ? "#000" : "#000",
          },
        ]}
      >
        <View style={styles.header}>
          {/* Main View Mode Toggle (Chart vs List) */}
          <View
            style={[
              styles.viewModeSegment,
              {
                backgroundColor: theme.isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === "chart" && styles.viewModeButtonActive,
                viewMode === "chart" && {
                  backgroundColor: theme.cardBackground,
                  shadowColor: "#000",
                },
              ]}
              onPress={() => handleViewModeChange("chart")}
            >
              <MaterialCommunityIcons
                name="chart-bar"
                size={20}
                color={
                  viewMode === "chart" ? theme.primary : theme.textSecondary
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === "list" && styles.viewModeButtonActive,
                viewMode === "list" && {
                  backgroundColor: theme.cardBackground,
                  shadowColor: "#000",
                },
              ]}
              onPress={() => handleViewModeChange("list")}
            >
              <MaterialCommunityIcons
                name="format-list-bulleted"
                size={20}
                color={
                  viewMode === "list" ? theme.primary : theme.textSecondary
                }
              />
            </TouchableOpacity>
          </View>

          {/* Chart Settings Toolbar */}
          {/* Chart Settings Toolbar */}
          <View style={styles.chartControls}>
            {viewMode === "chart" && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={{ width: 140, marginRight: 12 }}
              >
                <SegmentedControl
                  values={["Hourly", "Daily"]}
                  selectedIndex={chartMode === "hourly" ? 0 : 1}
                  onChange={(event) => {
                    setChartMode(
                      event.nativeEvent.selectedSegmentIndex === 0
                        ? "hourly"
                        : "daily"
                    );
                  }}
                  appearance={theme.isDark ? "dark" : "light"}
                />
              </Animated.View>
            )}

            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: forecastShowSubjectColors
                    ? theme.primary + "20" // 20% opacity
                    : "transparent",
                  borderColor: forecastShowSubjectColors
                    ? theme.primary
                    : theme.border,
                },
              ]}
              onPress={cycleForecastBreakdownMode}
            >
              <MaterialCommunityIcons
                name={
                  !forecastShowSubjectColors
                    ? "chart-bar"
                    : forecastBreakdownMode === "subject"
                    ? "chart-bar-stacked"
                    : "layers-triple"
                }
                size={20}
                color={
                  forecastShowSubjectColors
                    ? theme.primary
                    : theme.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {renderBreakdownLegend()}

        {viewMode === "chart" ? renderChartView() : renderListView()}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    height: 36,
  },
  viewModeSegment: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 2,
    height: 36,
    alignItems: "center",
  },
  viewModeButton: {
    paddingHorizontal: 12,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  viewModeButtonActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  chartControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chartContainer: {
    minHeight: 180,
    justifyContent: "center",
  },
  chartScrollView: {
    height: 160,
  },
  chartBarsScrollable: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    minWidth: "100%",
  },
  chartBarsDaily: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 1,
    minWidth: 30,
  },
  chartBarContainerScrollable: {
    alignItems: "center",
    width: 32,
    marginHorizontal: 2,
  },
  chartBarContainerScrollableLarge: {
    width: 24,
    marginHorizontal: 1,
  },
  chartBarValue: {
    fontSize: 10,
    marginBottom: 4,
    height: 12,
  },
  chartBar: {
    width: "80%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: "hidden",
    minHeight: 2,
  },
  chartBarLabel: {
    fontSize: 8,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 10,
    height: 20,
  },
  chartBarDayLabel: {
    fontSize: 6,
    marginTop: 1,
  },
  dayContainer: {
    marginBottom: 8,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dayTitle: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  dayCount: {
    width: 40,
    fontSize: 14,
    textAlign: "right",
  },
  dayCumulative: {
    width: 40,
    fontSize: 14,
    textAlign: "right",
    marginLeft: 8,
  },
  hoursContainer: {
    marginTop: 8,
    paddingLeft: 26,
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  criticalHourRow: {
    backgroundColor: "rgba(255, 107, 107, 0.1)", // Light red background for critical hours
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  hourText: {
    width: 50,
    fontSize: 12,
  },
  barContainer: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#62d862",
  },
  hourCount: {
    width: 30,
    fontSize: 12,
    textAlign: "right",
  },
  hourCumulative: {
    width: 30,
    fontSize: 12,
    textAlign: "right",
    marginLeft: 8,
  },
  noReviewsText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  breakdownLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownLegendTitle: {
    fontSize: 10,
    fontWeight: "600",
    marginRight: 6,
  },
  breakdownLegendItems: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownLegendIcon: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownLegendSubjectChip: {
    minWidth: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  breakdownLegendSubjectText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
