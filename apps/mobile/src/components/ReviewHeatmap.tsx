import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Assignment } from "../utils/api";
import {
  DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
  normalizeAnalyticsWidgetColor,
} from "../utils/analyticsWidgetStyles";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

interface ReviewData {
  date: string; // YYYY-MM-DD format
  count: number;
}

// Helper to get local YYYY-MM-DD string
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface ReviewHeatmapProps {
  // Optional props for future customization
  showYearSelector?: boolean;
  compactMode?: boolean;
  assignments?: Assignment[]; // Pass assignments from dashboard data
}

interface HeatmapCell {
  date: Date;
  count: number;
  dateString: string; // YYYY-MM-DD
}

interface HeatmapPage {
  key: string;
  label: string;
  type: "year" | "past-year";
  year?: number;
}

interface HeatmapRange {
  rangeStart: Date;
  rangeEnd: Date;
  gridStartDate: Date;
  gridEndDate: Date;
}

const TOTAL_YEAR_PAGES = 5;
const DEFAULT_PAGE_INDEX = 1; // "Past year"

const isDateWithinRange = (
  date: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean => {
  return date >= rangeStart && date <= rangeEnd;
};

const ReviewHeatmap: React.FC<ReviewHeatmapProps> = ({
  showYearSelector = true,
  compactMode = false,
  assignments = [],
}) => {
  const { theme } = useTheme();
  const widgetReviewHeatmapLevel1Color = useSettingsStore(
    (state) => state.widgetReviewHeatmapLevel1Color,
  );
  const widgetReviewHeatmapLevel2Color = useSettingsStore(
    (state) => state.widgetReviewHeatmapLevel2Color,
  );
  const widgetReviewHeatmapLevel3Color = useSettingsStore(
    (state) => state.widgetReviewHeatmapLevel3Color,
  );
  const widgetReviewHeatmapLevel4Color = useSettingsStore(
    (state) => state.widgetReviewHeatmapLevel4Color,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedPageIndex, setSelectedPageIndex] =
    useState(DEFAULT_PAGE_INDEX);
  const [reviewData, setReviewData] = useState<ReviewData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  const heatmapPages = useMemo<HeatmapPage[]>(() => {
    const yearPages = Array.from({ length: TOTAL_YEAR_PAGES }, (_, index) => {
      const year = currentYear - index;
      return {
        key: `year-${year}`,
        label: String(year),
        type: "year" as const,
        year,
      };
    });

    return [
      yearPages[0],
      { key: "past-year", label: "Past year", type: "past-year" as const },
      ...yearPages.slice(1),
    ];
  }, [currentYear]);

  const selectedPage =
    heatmapPages[selectedPageIndex] ?? heatmapPages[DEFAULT_PAGE_INDEX];

  const selectedRange = useMemo<HeatmapRange>(() => {
    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;

    if (selectedPage.type === "past-year") {
      rangeEnd = new Date(now);
      rangeEnd.setHours(23, 59, 59, 999);

      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 364);
      rangeStart.setHours(0, 0, 0, 0);
    } else {
      const year = selectedPage.year ?? currentYear;
      rangeStart = new Date(year, 0, 1);
      rangeStart.setHours(0, 0, 0, 0);

      rangeEnd = new Date(year, 11, 31);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const gridStartDate = new Date(rangeStart);
    gridStartDate.setDate(rangeStart.getDate() - rangeStart.getDay());
    gridStartDate.setHours(0, 0, 0, 0);

    const gridEndDate = new Date(rangeEnd);
    gridEndDate.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));
    gridEndDate.setHours(23, 59, 59, 999);

    return {
      rangeStart,
      rangeEnd,
      gridStartDate,
      gridEndDate,
    };
  }, [selectedPage, currentYear]);

  // Process assignments data to extract review activity for the selected range
  useEffect(() => {
    setIsLoading(true);

    try {
      // Group review activities by date from assignments
      const reviewsByDate: { [key: string]: number } = {};
      const now = new Date();

      assignments.forEach((assignment) => {
        const assignmentData = assignment.data;

        // Use data_updated_at to track when items were last touched (reviewed or updated)
        // Only if they have actually been started in lessons
        if (assignmentData.started_at && assignment.data_updated_at) {
          const updatedDate = new Date(assignment.data_updated_at);

          if (
            updatedDate <= now &&
            isDateWithinRange(
              updatedDate,
              selectedRange.rangeStart,
              selectedRange.rangeEnd,
            )
          ) {
            const dateString = getLocalDateString(updatedDate);
            reviewsByDate[dateString] = (reviewsByDate[dateString] || 0) + 1;
          }
        }

        // Also count milestone achievements as review activity
        // These are more granular indicators of specific progress steps
        const milestonedates = [
          assignmentData.started_at, // When lesson was completed
          assignmentData.passed_at, // When reached Guru (stage 5)
          assignmentData.burned_at, // When reached Burned (stage 9)
        ].filter(Boolean);

        milestonedates.forEach((dateStr) => {
          const date = new Date(dateStr!);

          if (
            date <= now &&
            isDateWithinRange(
              date,
              selectedRange.rangeStart,
              selectedRange.rangeEnd,
            )
          ) {
            const dateString = getLocalDateString(date);
            // Avoid double-counting if milestone is same day as data_updated_at for this assignment
            // (We just increment anyway as we want to capture "activity events")
            reviewsByDate[dateString] = (reviewsByDate[dateString] || 0) + 1;
          }
        });
      });

      // Convert to array format
      const reviewDataArray = Object.entries(reviewsByDate).map(
        ([date, count]) => ({
          date,
          count,
        })
      );

      setReviewData(reviewDataArray);
    } catch {
      setReviewData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange, assignments]);

  // Generate heatmap grid data
  const heatmapData = useMemo(() => {
    const cells: HeatmapCell[] = [];
    const reviewMap = new Map<string, number>();

    // Create map for quick lookups
    reviewData.forEach(({ date, count }) => {
      reviewMap.set(date, count);
    });

    // Generate all cells from start Sunday to end Saturday
    const currentDate = new Date(selectedRange.gridStartDate);
    while (currentDate <= selectedRange.gridEndDate) {
      const dateString = getLocalDateString(currentDate);
      const count = reviewMap.get(dateString) || 0;

      cells.push({
        date: new Date(currentDate),
        count,
        dateString,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return cells;
  }, [selectedRange, reviewData]);

  // Group cells into weeks
  const weeks = useMemo(() => {
    const weekGroups: HeatmapCell[][] = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      weekGroups.push(heatmapData.slice(i, i + 7));
    }
    return weekGroups;
  }, [heatmapData]);

  /* Responsive Layout Constants */
  const { width } = Dimensions.get("window");
  const isTablet = width > 768;

  // Scale up for tablet
  const CELL_SIZE = isTablet ? 20 : 12;
  const CELL_GAP = isTablet ? 4 : 2;
  const WEEK_WIDTH = CELL_SIZE + CELL_GAP;
  const DAY_LABEL_WIDTH = isTablet ? 40 : 30;

  // Calculate scroll position to show "today" when it exists in the selected range
  const scrollToToday = useMemo(() => {
    if (weeks.length === 0) {
      return null;
    }

    const today = new Date();
    if (
      !isDateWithinRange(today, selectedRange.rangeStart, selectedRange.rangeEnd)
    ) {
      return null;
    }

    const todayString = getLocalDateString(today);

    // Find which week contains today
    let todayWeekIndex = -1;
    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
      const week = weeks[weekIndex];
      if (week.some((cell) => cell.dateString === todayString)) {
        todayWeekIndex = weekIndex;
        break;
      }
    }

    if (todayWeekIndex === -1) return null;

    // Calculate scroll position
    // Add some padding to center "today" in view
    const scrollPosition = Math.max(0, todayWeekIndex * WEEK_WIDTH - 100);

    return scrollPosition;
  }, [weeks, selectedRange, WEEK_WIDTH]);

  // Auto-scroll to today's position when data loads
  useEffect(() => {
    if (scrollToToday !== null && scrollViewRef.current && !isLoading) {
      // Small delay to ensure the ScrollView has rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: scrollToToday, animated: true });
      }, 200);
    }
  }, [scrollToToday, isLoading]);

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    const monthCursor = new Date(
      selectedRange.rangeStart.getFullYear(),
      selectedRange.rangeStart.getMonth(),
      1,
    );
    const endMonth = new Date(
      selectedRange.rangeEnd.getFullYear(),
      selectedRange.rangeEnd.getMonth(),
      1,
    );

    while (monthCursor <= endMonth) {
      labels.push(
        monthCursor.toLocaleDateString("en-US", {
          month: "short",
        }),
      );
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    return labels.length > 0 ? labels : ["Jan", "Feb", "Mar", "Apr"];
  }, [selectedRange]);

  // Get color intensity based on review count
  const heatmapScaleColors = useMemo(
    () => [
      normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel1Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel1Color,
      ),
      normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel2Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel2Color,
      ),
      normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel3Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel3Color,
      ),
      normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel4Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel4Color,
      ),
    ],
    [
      widgetReviewHeatmapLevel1Color,
      widgetReviewHeatmapLevel2Color,
      widgetReviewHeatmapLevel3Color,
      widgetReviewHeatmapLevel4Color,
    ],
  );

  const getColorIntensity = (count: number): string => {
    if (count === 0) {
      return theme.isDark ? "#0d1117" : "#ebedf0";
    }

    const maxCount = Math.max(...reviewData.map((r) => r.count), 1);
    const intensity = Math.min(count / Math.max(maxCount / 4, 1), 1);

    if (intensity <= 0.25) return heatmapScaleColors[0];
    if (intensity <= 0.5) return heatmapScaleColors[1];
    if (intensity <= 0.75) return heatmapScaleColors[2];
    return heatmapScaleColors[3];
  };

  // Format date for tooltip
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.cardBackground }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Review Activity
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading review data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Review Activity
        </Text>
        {showYearSelector && (
          <View style={styles.yearSelector}>
            <TouchableOpacity
              onPress={() => {
                setSelectedPageIndex((currentIndex) =>
                  Math.min(currentIndex + 1, heatmapPages.length - 1),
                );
              }}
              style={[
                styles.yearButton,
                {
                  opacity: selectedPageIndex < heatmapPages.length - 1 ? 1 : 0.3,
                },
              ]}
              disabled={selectedPageIndex >= heatmapPages.length - 1}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <Text style={[styles.yearText, { color: theme.textColor }]}>
              {selectedPage.label}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSelectedPageIndex((currentIndex) =>
                  Math.max(currentIndex - 1, 0),
                );
              }}
              style={[
                styles.yearButton,
                {
                  opacity: selectedPageIndex > 0 ? 1 : 0.3,
                },
              ]}
              disabled={selectedPageIndex <= 0}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.heatmapContainer}
      >
        <View style={styles.heatmapWrapper}>
          {/* Month labels */}
          <View style={[styles.monthLabels, { paddingLeft: DAY_LABEL_WIDTH }]}>
            {monthLabels.map((month, index) => (
              <Text
                key={`${month}-${index}`}
                style={[
                  styles.monthLabel,
                  {
                    color: theme.textSecondary,
                    width: WEEK_WIDTH * (weeks.length / monthLabels.length),
                    fontSize: isTablet ? 14 : 12,
                  },
                ]}
              >
                {month}
              </Text>
            ))}
          </View>

          <View style={styles.heatmapContent}>
            {/* Day labels */}
            <View
              style={[
                styles.dayLabels,
                { width: DAY_LABEL_WIDTH, gap: CELL_GAP },
              ]}
            >
              {["", "Mon", "", "Wed", "", "Fri", ""].map((day, index) => (
                <Text
                  key={index}
                  style={[
                    styles.dayLabel,
                    {
                      color: theme.textSecondary,
                      height: CELL_SIZE,
                      lineHeight: CELL_SIZE,
                      fontSize: isTablet ? 14 : 12,
                    },
                  ]}
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* Heatmap grid */}
            <View style={[styles.heatmapGrid, { gap: CELL_GAP }]}>
              {weeks.map((week, weekIndex) => (
                <View
                  key={weekIndex}
                  style={[styles.weekColumn, { gap: CELL_GAP }]}
                >
                  {week.map((cell, dayIndex) => (
                    <TouchableOpacity
                      key={`${weekIndex}-${dayIndex}`}
                      style={[
                        styles.cell,
                        {
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          backgroundColor: getColorIntensity(cell.count),
                          opacity:
                            isDateWithinRange(
                              cell.date,
                              selectedRange.rangeStart,
                              selectedRange.rangeEnd,
                            )
                              ? 1
                              : 0.3,
                        },
                      ]}
                      onPress={() => {
                        if (cell.count > 0) {
                          Alert.alert(
                            formatDate(cell.date),
                            `${cell.count} review${
                              cell.count === 1 ? "" : "s"
                            } completed`
                          );
                        }
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>
          Less
        </Text>
        <View style={[styles.legendScale, { gap: CELL_GAP }]}>
          {[0, 1, 2, 3, 4].map((level) => {
            let backgroundColor: string;

            if (level === 0) {
              backgroundColor = theme.isDark ? "#0d1117" : "#ebedf0";
            } else {
              backgroundColor = heatmapScaleColors[level - 1];
            }

            return (
              <View
                key={level}
                style={[
                  styles.legendCell,
                  {
                    backgroundColor,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>
          More
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  yearButton: {
    padding: 4,
  },
  yearText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  heatmapContainer: {
    paddingRight: 20,
  },
  heatmapWrapper: {
    flexDirection: "column",
  },
  monthLabels: {
    flexDirection: "row",
    marginBottom: 8,
  },
  monthLabel: {
    textAlign: "center",
  },
  heatmapContent: {
    flexDirection: "row",
  },
  dayLabels: {
    flexDirection: "column",
    marginRight: 8,
    justifyContent: "space-between",
  },
  dayLabel: {
    textAlign: "right",
  },
  heatmapGrid: {
    flexDirection: "row",
  },
  weekColumn: {
    flexDirection: "column",
  },
  cell: {
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
  },
  legendText: {
    fontSize: 12,
  },
  legendScale: {
    flexDirection: "row",
  },
  legendCell: {
    borderRadius: 2,
  },
});

export default ReviewHeatmap;
