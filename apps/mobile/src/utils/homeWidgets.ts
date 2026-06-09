export type HomeWidgetId =
  | "lessonsReviews"
  | "recentMistakes"
  | "streak"
  | "extraStudy"
  | "subjectLists"
  | "reviewForecast"
  | "levelProgress"
  | "incompleteLevels"
  | "recentUnlocks"
  | "criticalItems"
  | "burnedItems"
  | "reviewHeatmap"
  | "levelTiming"
  | "reviewStats"
  | "dailyStudyActivity"
  | "srsBreakdown";

export type HomeWidgetSourceTab = "home" | "level" | "items" | "analytics";

export type HomeWidgetDefinition = {
  id: HomeWidgetId;
  title: string;
  description: string;
  sourceTab: HomeWidgetSourceTab;
};

export const HOME_WIDGET_DEFINITIONS: HomeWidgetDefinition[] = [
  {
    id: "lessonsReviews",
    title: "Lessons & Reviews",
    description: "Your main study queue cards.",
    sourceTab: "home",
  },
  {
    id: "recentMistakes",
    title: "Recent Mistakes",
    description: "Quickly revisit recent wrong answers.",
    sourceTab: "home",
  },
  {
    id: "streak",
    title: "Usage Streak",
    description: "Track your current and longest streaks.",
    sourceTab: "home",
  },
  {
    id: "extraStudy",
    title: "Extra Study",
    description: "Practice modes that do not affect SRS.",
    sourceTab: "home",
  },
  {
    id: "subjectLists",
    title: "Subject Lists",
    description: "Entry point to saved study collections.",
    sourceTab: "home",
  },
  {
    id: "reviewForecast",
    title: "Review Forecast",
    description: "Upcoming review load by day and hour.",
    sourceTab: "home",
  },
  {
    id: "levelProgress",
    title: "Level Progress",
    description: "Current level progress with kanji blocks.",
    sourceTab: "level",
  },
  {
    id: "incompleteLevels",
    title: "Incomplete Levels",
    description: "Track unfinished previous levels.",
    sourceTab: "level",
  },
  {
    id: "recentUnlocks",
    title: "Recent Unlocks",
    description: "Items unlocked recently.",
    sourceTab: "items",
  },
  {
    id: "criticalItems",
    title: "Critical Items",
    description: "Items currently in critical condition.",
    sourceTab: "items",
  },
  {
    id: "burnedItems",
    title: "Burned Items",
    description: "Recently burned items and progress.",
    sourceTab: "items",
  },
  {
    id: "reviewHeatmap",
    title: "Review Heatmap",
    description: "Yearly activity heatmap.",
    sourceTab: "analytics",
  },
  {
    id: "levelTiming",
    title: "Level Timing",
    description: "How fast each level was completed.",
    sourceTab: "analytics",
  },
  {
    id: "reviewStats",
    title: "Review Stats",
    description: "Accuracy and review totals.",
    sourceTab: "analytics",
  },
  {
    id: "dailyStudyActivity",
    title: "Today's Study",
    description: "Lessons and reviews completed today.",
    sourceTab: "analytics",
  },
  {
    id: "srsBreakdown",
    title: "SRS Breakdown",
    description: "Distribution across SRS stages.",
    sourceTab: "analytics",
  },
];

export const DEFAULT_HOME_WIDGET_ORDER: HomeWidgetId[] = [
  "lessonsReviews",
  "recentMistakes",
  "streak",
  "extraStudy",
  "reviewForecast",
];

const VALID_HOME_WIDGET_IDS = new Set<HomeWidgetId>(
  HOME_WIDGET_DEFINITIONS.map((widget) => widget.id),
);

export function isHomeWidgetId(value: unknown): value is HomeWidgetId {
  return (
    typeof value === "string" &&
    VALID_HOME_WIDGET_IDS.has(value as HomeWidgetId)
  );
}

export function normalizeHomeWidgetOrder(
  value: unknown,
  fallback = DEFAULT_HOME_WIDGET_ORDER,
): HomeWidgetId[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const unique: HomeWidgetId[] = [];

  value.forEach((entry) => {
    if (!isHomeWidgetId(entry)) {
      return;
    }

    if (!unique.includes(entry)) {
      unique.push(entry);
    }
  });

  if (unique.length === 0) {
    return [...fallback];
  }

  if (!unique.includes("lessonsReviews")) {
    unique.unshift("lessonsReviews");
  }

  return unique;
}
