import kakehashiHomeWidget from "./homeWidgetController";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type {
  WidgetContentMode,
  WidgetStreakGradientPreset,
} from "../utils/store";
import {
  normalizeStreakSnapshotForUpdate,
  persistWidgetSnapshot,
  resolveBackgroundReviewSchedule,
  resolveProjectedReviewTotalForLocalDay,
  selectWidgetTimelineTimestamps,
  type BackgroundReviewSyncData,
} from "./homeWidgetBackgroundSync";

import type { CriticalWidgetItem } from "./criticalWidgetData";

export type { BackgroundReviewSyncData } from "./homeWidgetBackgroundSync";

export const KAKEHASHI_HOME_WIDGET_NAME = "KakehashiHomeWidget";
const WIDGET_APP_GROUP_IDENTIFIER = "group.com.kakehashi.reviewdata";
const LAST_WIDGET_SNAPSHOT_STORAGE_KEY = "kakehashi-last-widget-snapshot-input";
const STREAK_ICON_VERSION = "v5";
const REVIEW_ILLUSTRATION_VERSION = "v6";
const REVIEW_ACCESSORY_ICON_VERSION = "v2";
const MAX_WIDGET_TIMELINE_ENTRIES = 60;

type StreakIconKey =
  | "active"
  | "inactive"
  | "day42"
  | "day84"
  | "day126"
  | "day168";

type StreakIconUris = Partial<Record<StreakIconKey, string>>;
const STREAK_ICON_KEYS: StreakIconKey[] = [
  "active",
  "inactive",
  "day42",
  "day84",
  "day126",
  "day168",
];

type StreakRecentDay = {
  dayKey?: string;
  label: string;
  active: boolean;
  isToday: boolean;
};

type ReviewUpcomingBucket = {
  date: string;
  count: number;
};

type ReviewIllustrationKey = "low" | "mid" | "high" | "veryHigh";
type ReviewIllustrationUris = Partial<Record<ReviewIllustrationKey, string>>;
const REVIEW_ILLUSTRATION_KEYS: ReviewIllustrationKey[] = [
  "low",
  "mid",
  "high",
  "veryHigh",
];

const STREAK_ICON_ASSET_MODULES: Record<StreakIconKey, number> = {
  active: require("../../assets/widgets/streak-icons/png/active.png") as number,
  inactive:
    require("../../assets/widgets/streak-icons/png/inactive.png") as number,
  day42: require("../../assets/widgets/streak-icons/png/day42.png") as number,
  day84: require("../../assets/widgets/streak-icons/png/day84.png") as number,
  day126: require("../../assets/widgets/streak-icons/png/day126.png") as number,
  day168: require("../../assets/widgets/streak-icons/png/day168.png") as number,
};

const REVIEW_ILLUSTRATION_ASSET_MODULES: Record<ReviewIllustrationKey, number> =
  {
    low: require("../../assets/widgets/streak-icons/png/LowReviewsWidgetWidgetSafe.png") as number,
    mid: require("../../assets/widgets/streak-icons/png/MidReviewsWidgetWidgetSafe.png") as number,
    high: require("../../assets/widgets/streak-icons/png/HighReviewsWidgetWidgetSafe.png") as number,
    veryHigh:
      require("../../assets/widgets/streak-icons/png/VeryHighReviewsWidgetWidgetSafe.png") as number,
  };
const REVIEW_ACCESSORY_ICON_ASSET_MODULE =
  require("../../assets/widgets/review-icon/crab-bridge.png") as number;
const STREAK_GRADIENT_PRESET_COLORS: Record<
  WidgetStreakGradientPreset,
  [string, string, string]
> = {
  automatic: ["#7DD3FC", "#2563EB", "#1E1B4B"],
  defaults: ["#FF7A18", "#FF5A3D", "#FF3F6C"],
  sunset: ["#FF7A18", "#FF5A3D", "#FF3F6C"],
  ocean: ["#0EA5E9", "#2563EB", "#4338CA"],
  emerald: ["#10B981", "#059669", "#0F766E"],
  violet: ["#A855F7", "#7C3AED", "#4C1D95"],
  rose: ["#FB7185", "#F43F5E", "#BE185D"],
  amber: ["#F59E0B", "#F97316", "#EA580C"],
  aurora: ["#06B6D4", "#14B8A6", "#22C55E"],
  slate: ["#64748B", "#475569", "#334155"],
  skyline: ["#38BDF8", "#6366F1", "#A78BFA"],
  obsidian: ["#111827", "#030712", "#020617"],
  graphite: ["#4B5563", "#1F2937", "#111827"],
  midnightBloom: ["#4338CA", "#312E81", "#111827"],
};

const DEFAULT_STREAK_GRADIENT_COLORS: [string, string, string] =
  STREAK_GRADIENT_PRESET_COLORS.sunset;

const DEFAULT_REVIEW_GRADIENT_BY_BUCKET: Record<
  ReviewIllustrationKey,
  [string, string, string]
> = {
  low: ["#10B981", "#0F766E", "#134E4A"],
  mid: ["#0EA5E9", "#2563EB", "#1E3A8A"],
  high: ["#F59E0B", "#F97316", "#C2410C"],
  veryHigh: ["#FB7185", "#E11D48", "#9F1239"],
};


export type HomeWidgetSnapshotInput = {
  contentMode: WidgetContentMode;
  streakGradientPreset: WidgetStreakGradientPreset;
  isDarkTheme?: boolean;
  streakTimezone?: string;
  reviewCount: number;
  nextReviewDate: string | null;
  todayReviewTotal: number;
  reviewUpcomingBuckets: ReviewUpcomingBucket[];
  criticalCount: number;
  topCriticalItem: CriticalWidgetItem | null;
  criticalItems?: CriticalWidgetItem[];
  recentMistakesCount: number;
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  streakRecentDays: StreakRecentDay[];
};

export type HomeWidgetProps = {
  contentMode: WidgetContentMode;
  timelineAnchor?: boolean;
  updatedAtLabel: string;
  reviewsCountValue: number;
  reviewsPrimaryLabel: string;
  reviewsSecondaryLabel: string;
  reviewsTertiaryLabel: string;
  reviewsImageUri: string;
  reviewIllustrationUris: ReviewIllustrationUris;
  reviewsImageAspectRatio: number;
  reviewsIconUri: string;
  criticalItems: CriticalWidgetItem[];
  criticalCount: number;
  criticalPrimaryLabel: string;
  criticalSecondaryLabel: string;
  criticalTertiaryLabel: string;
  streakPrimaryLabel: string;
  streakSecondaryLabel: string;
  streakTertiaryLabel: string;
  streakGradientColors: [string, string, string];
  streakRecentDays: StreakRecentDay[];
  streakIconUris: StreakIconUris;
};

export type HomeWidgetScheduledUpdateDebugEntry = {
  timestamp: number;
  isoDate: string;
  localDateLabel: string;
  isFuture: boolean;
  mode: WidgetContentMode;
  reviewsCountValue: number;
  reviewsSecondaryLabel: string;
  streakPrimaryLabel: string;
  streakSecondaryLabel: string;
  streakTertiaryLabel: string;
};

export type HomeWidgetScheduledUpdatesDebugResult = {
  source: "nativeTimeline" | "lastRequestedTimeline" | "none";
  generatedAt: string;
  entryCount: number;
  entries: HomeWidgetScheduledUpdateDebugEntry[];
  error?: string;
};

const DEFAULT_WIDGET_PROPS: HomeWidgetProps = {
  contentMode: "reviews",
  timelineAnchor: false,
  updatedAtLabel: "",
  reviewsCountValue: 0,
  reviewsPrimaryLabel: "0 available",
  reviewsSecondaryLabel: "No upcoming reviews",
  reviewsTertiaryLabel: "0 total today",
  reviewsImageUri: "",
  reviewIllustrationUris: {},
  reviewsImageAspectRatio: 1.6,
  reviewsIconUri: "",
  criticalItems: [],
  criticalCount: 0,
  criticalPrimaryLabel: "0 critical items",
  criticalSecondaryLabel: "No critical items right now",
  criticalTertiaryLabel: "0 recent mistakes",
  streakPrimaryLabel: "0",
  streakSecondaryLabel: "Best 0",
  streakTertiaryLabel: "Freeze in 7d",
  streakGradientColors: ["#FF7A18", "#FF5A3D", "#FF3F6C"],
  streakRecentDays: [
    { label: "M", active: false, isToday: false },
    { label: "T", active: false, isToday: false },
    { label: "W", active: false, isToday: false },
    { label: "T", active: false, isToday: false },
    { label: "F", active: false, isToday: false },
    { label: "S", active: false, isToday: false },
    { label: "S", active: false, isToday: true },
  ],
  streakIconUris: {},
};

let cachedStreakIconUris: StreakIconUris | null = null;
let pendingStreakIconUrisPromise: Promise<StreakIconUris> | null = null;
let cachedReviewIllustrationUris: ReviewIllustrationUris | null = null;
let pendingReviewIllustrationUrisPromise: Promise<ReviewIllustrationUris> | null =
  null;
let cachedReviewAccessoryIconUri: string | null = null;
let pendingReviewAccessoryIconUriPromise: Promise<string> | null = null;
let latestWidgetSnapshotInput: HomeWidgetSnapshotInput | null = null;
let lastRequestedTimelineEntries: {
  date: Date;
  props: HomeWidgetProps;
}[] = [];

function hasAllStreakIconUris(
  iconUris: StreakIconUris | null,
): iconUris is StreakIconUris {
  if (!iconUris) {
    return false;
  }
  return STREAK_ICON_KEYS.every((key) => Boolean(iconUris[key]));
}
function hasAllReviewIllustrationUris(
  illustrationUris: ReviewIllustrationUris | null,
): illustrationUris is ReviewIllustrationUris {
  if (!illustrationUris) {
    return false;
  }
  return REVIEW_ILLUSTRATION_KEYS.every((key) => {
    const uri = illustrationUris[key];
    if (!uri) {
      return false;
    }
    return uri.includes(`-${REVIEW_ILLUSTRATION_VERSION}.png`);
  });
}

const getSharedWidgetContainer = () => {
  const sharedContainers = Paths.appleSharedContainers;
  return (
    sharedContainers[WIDGET_APP_GROUP_IDENTIFIER] ??
    Object.values(sharedContainers)[0] ??
    null
  );
};

async function ensureSharedStreakIconUris(): Promise<StreakIconUris> {
  if (hasAllStreakIconUris(cachedStreakIconUris)) {
    return cachedStreakIconUris;
  }
  if (pendingStreakIconUrisPromise) {
    return pendingStreakIconUrisPromise;
  }

  pendingStreakIconUrisPromise = (async () => {
    if (Platform.OS !== "ios") {
      cachedStreakIconUris = {};
      return {};
    }

    const sharedContainer = getSharedWidgetContainer();
    if (!sharedContainer) {
      cachedStreakIconUris = {};
      return {};
    }

    const streakIconsDirectory = new Directory(
      sharedContainer,
      "widgets",
      "streak-icons",
    );
    if (!streakIconsDirectory.exists) {
      streakIconsDirectory.create({ idempotent: true, intermediates: true });
    }

    const iconUris: StreakIconUris = { ...(cachedStreakIconUris ?? {}) };
    for (const iconKey of STREAK_ICON_KEYS) {
      const moduleId = STREAK_ICON_ASSET_MODULES[iconKey];
      const existingUri = iconUris[iconKey];
      if (existingUri) {
        const existingFile = new File(existingUri);
        if (existingFile.exists) {
          continue;
        }
      }

      const asset = Asset.fromModule(moduleId);
      await asset.downloadAsync();
      const sourceUri = asset.localUri ?? asset.uri;

      if (!sourceUri || !sourceUri.startsWith("file://")) {
        continue;
      }

      const sourceFile = new File(sourceUri);
      if (!sourceFile.exists) {
        continue;
      }

      const destinationFile = new File(
        streakIconsDirectory,
        `${iconKey}-${STREAK_ICON_VERSION}.png`,
      );
      if (destinationFile.exists) {
        destinationFile.delete();
      }
      sourceFile.copy(destinationFile);
      iconUris[iconKey] = destinationFile.uri;
    }

    cachedStreakIconUris = iconUris;
    return iconUris;
  })().finally(() => {
    pendingStreakIconUrisPromise = null;
  });

  return pendingStreakIconUrisPromise;
}

async function ensureSharedReviewIllustrationUris(): Promise<ReviewIllustrationUris> {
  if (hasAllReviewIllustrationUris(cachedReviewIllustrationUris)) {
    return cachedReviewIllustrationUris;
  }
  if (pendingReviewIllustrationUrisPromise) {
    return pendingReviewIllustrationUrisPromise;
  }

  pendingReviewIllustrationUrisPromise = (async () => {
    if (Platform.OS !== "ios") {
      cachedReviewIllustrationUris = {};
      return {};
    }

    const sharedContainer = getSharedWidgetContainer();
    if (!sharedContainer) {
      cachedReviewIllustrationUris = {};
      return {};
    }

    const reviewIllustrationsDirectory = new Directory(
      sharedContainer,
      "widgets",
      "review-illustrations",
    );
    if (!reviewIllustrationsDirectory.exists) {
      reviewIllustrationsDirectory.create({ idempotent: true, intermediates: true });
    }

    const illustrationUris: ReviewIllustrationUris = {
      ...(cachedReviewIllustrationUris ?? {}),
    };

    for (const illustrationKey of REVIEW_ILLUSTRATION_KEYS) {
      const moduleId = REVIEW_ILLUSTRATION_ASSET_MODULES[illustrationKey];
      const existingUri = illustrationUris[illustrationKey];
      if (existingUri) {
        const existingFile = new File(existingUri);
        if (existingFile.exists) {
          continue;
        }
      }

      const asset = Asset.fromModule(moduleId);
      await asset.downloadAsync();
      const sourceUri = asset.localUri ?? asset.uri;

      if (!sourceUri || !sourceUri.startsWith("file://")) {
        continue;
      }

      const sourceFile = new File(sourceUri);
      if (!sourceFile.exists) {
        continue;
      }

      const destinationFile = new File(
        reviewIllustrationsDirectory,
        `${illustrationKey}-${REVIEW_ILLUSTRATION_VERSION}.png`,
      );
      if (destinationFile.exists) {
        destinationFile.delete();
      }
      sourceFile.copy(destinationFile);
      illustrationUris[illustrationKey] = destinationFile.uri;
    }

    cachedReviewIllustrationUris = illustrationUris;
    return illustrationUris;
  })().finally(() => {
    pendingReviewIllustrationUrisPromise = null;
  });

  return pendingReviewIllustrationUrisPromise;
}

async function ensureSharedReviewAccessoryIconUri(): Promise<string> {
  if (cachedReviewAccessoryIconUri) {
    return cachedReviewAccessoryIconUri;
  }
  if (pendingReviewAccessoryIconUriPromise) {
    return pendingReviewAccessoryIconUriPromise;
  }

  pendingReviewAccessoryIconUriPromise = (async () => {
    if (Platform.OS !== "ios") {
      cachedReviewAccessoryIconUri = "";
      return "";
    }

    const sharedContainer = getSharedWidgetContainer();
    if (!sharedContainer) {
      cachedReviewAccessoryIconUri = "";
      return "";
    }

    const reviewIconsDirectory = new Directory(
      sharedContainer,
      "widgets",
      "review-icons",
    );
    if (!reviewIconsDirectory.exists) {
      reviewIconsDirectory.create({ idempotent: true, intermediates: true });
    }

    const destinationFile = new File(
      reviewIconsDirectory,
      `crab-bridge-${REVIEW_ACCESSORY_ICON_VERSION}.png`,
    );
    if (destinationFile.exists) {
      cachedReviewAccessoryIconUri = destinationFile.uri;
      return destinationFile.uri;
    }

    const asset = Asset.fromModule(REVIEW_ACCESSORY_ICON_ASSET_MODULE);
    await asset.downloadAsync();
    const sourceUri = asset.localUri ?? asset.uri;

    if (!sourceUri || !sourceUri.startsWith("file://")) {
      cachedReviewAccessoryIconUri = "";
      return "";
    }

    const sourceFile = new File(sourceUri);
    if (!sourceFile.exists) {
      cachedReviewAccessoryIconUri = "";
      return "";
    }

    sourceFile.copy(destinationFile);
    cachedReviewAccessoryIconUri = destinationFile.uri;
    return destinationFile.uri;
  })().finally(() => {
    pendingReviewAccessoryIconUriPromise = null;
  });

  return pendingReviewAccessoryIconUriPromise;
}

const UPDATED_AT_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const WIDGET_DEBUG_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const STREAK_DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STREAK_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
  timeZone: "UTC",
});
const DAY_KEY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

const pluralize = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : plural;

const toNonNegativeInteger = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayKeyFormatter(timezone: string): Intl.DateTimeFormat {
  const normalizedTimezone = timezone.trim();
  const cachedFormatter = DAY_KEY_FORMATTER_CACHE.get(normalizedTimezone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  DAY_KEY_FORMATTER_CACHE.set(normalizedTimezone, formatter);
  return formatter;
}

function toDayKeyInTimezone(date: Date, timezone: string): string {
  try {
    const parts = getDayKeyFormatter(timezone).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to local formatting if timezone formatting fails.
  }

  return toLocalDayKey(date);
}

function utcDateToDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeyToUtcDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date(0);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dayKey: string, amount: number): string {
  const date = dayKeyToUtcDate(dayKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateToDayKey(date);
}

function buildProjectedStreakRecentDays(
  days: StreakRecentDay[],
  referenceDate: Date,
  timezone?: string,
): StreakRecentDay[] {
  if (days.length === 0) {
    return [];
  }

  const hasSortableDayKeys = days.every(
    (day) =>
      typeof day.dayKey === "string" && STREAK_DAY_KEY_PATTERN.test(day.dayKey),
  );

  if (!hasSortableDayKeys) {
    const recentDaysWindow = days.slice(-7);
    const providedTodayIndex = recentDaysWindow.findIndex((day) => day.isToday);
    const todayIndex =
      providedTodayIndex >= 0
        ? providedTodayIndex
        : Math.max(0, recentDaysWindow.length - 1);

    return recentDaysWindow.map((day, index) => ({
      ...day,
      isToday: index === todayIndex,
    }));
  }

  const sortedDays = [...days].sort((left, right) =>
    (left.dayKey ?? "").localeCompare(right.dayKey ?? ""),
  );
  const dayByKey = new Map<string, StreakRecentDay>();
  for (const day of sortedDays) {
    if (day.dayKey) {
      dayByKey.set(day.dayKey, day);
    }
  }

  const referenceDayKey =
    typeof timezone === "string" && timezone.trim().length > 0
      ? toDayKeyInTimezone(referenceDate, timezone)
      : toLocalDayKey(referenceDate);
  const projected: StreakRecentDay[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayKey = addDays(referenceDayKey, -offset);
    const sourceDay = dayByKey.get(dayKey);
    projected.push({
      dayKey,
      label:
        sourceDay?.label && sourceDay.label.trim().length > 0
          ? sourceDay.label
          : STREAK_DAY_LABEL_FORMATTER.format(dayKeyToUtcDate(dayKey)),
      active: Boolean(sourceDay?.active),
      isToday: offset === 0,
    });
  }

  return projected;
}

function formatUpcomingReviewBucketLabel(
  nextReviewDate: string | null,
  nextReviewCount: number | null,
): string {
  if (!nextReviewDate) {
    return "No upcoming reviews";
  }

  const nextReviewMs = Date.parse(nextReviewDate);
  if (Number.isNaN(nextReviewMs)) {
    return "No upcoming reviews";
  }

  const date = new Date(nextReviewMs);
  const hourLabel = `${String(date.getHours()).padStart(2, "0")}:00`;
  const bucketCount =
    nextReviewCount !== null && nextReviewCount > 0
      ? nextReviewCount
      : 1;
  return `+${bucketCount} at ${hourLabel}`;
}

type NormalizedReviewUpcomingBucket = {
  timestamp: number;
  count: number;
};

function normalizeReviewUpcomingBuckets(
  input: HomeWidgetSnapshotInput,
  baselineDate: Date,
): NormalizedReviewUpcomingBucket[] {
  const baselineTimestamp = baselineDate.getTime();
  const aggregatedBuckets = new Map<number, number>();

  for (const bucket of input.reviewUpcomingBuckets ?? []) {
    const parsedCount = toNonNegativeInteger(bucket?.count ?? 0);
    if (parsedCount <= 0) {
      continue;
    }

    const parsedTimestamp = Date.parse(bucket?.date ?? "");
    if (Number.isNaN(parsedTimestamp) || parsedTimestamp <= baselineTimestamp) {
      continue;
    }

    const roundedTimestamp = new Date(parsedTimestamp);
    roundedTimestamp.setMinutes(0, 0, 0);
    const timestampKey = roundedTimestamp.getTime();

    aggregatedBuckets.set(
      timestampKey,
      (aggregatedBuckets.get(timestampKey) ?? 0) + parsedCount,
    );
  }

  return Array.from(aggregatedBuckets.entries())
    .sort(([leftTimestamp], [rightTimestamp]) => leftTimestamp - rightTimestamp)
    .map(([timestamp, count]) => ({
      timestamp,
      count,
    }));
}

function buildProjectedReviewSnapshot(
  input: HomeWidgetSnapshotInput,
  reviewUpcomingBuckets: NormalizedReviewUpcomingBucket[],
  baselineDate: Date,
  referenceDate: Date,
): {
  projectedReviewCount: number;
  projectedNextReviewDate: string | null;
  projectedNextReviewCount: number | null;
} {
  const baselineTimestamp = baselineDate.getTime();
  const referenceTimestamp = referenceDate.getTime();
  const baseReviewCount = toNonNegativeInteger(input.reviewCount);

  let gainedReviews = 0;
  let nextBucketTimestamp: number | null = null;
  let nextBucketCount: number | null = null;

  for (const bucket of reviewUpcomingBuckets) {
    if (
      bucket.timestamp > baselineTimestamp &&
      bucket.timestamp <= referenceTimestamp
    ) {
      gainedReviews += bucket.count;
      continue;
    }

    if (bucket.timestamp > referenceTimestamp) {
      nextBucketTimestamp = bucket.timestamp;
      nextBucketCount = bucket.count;
      break;
    }
  }

  const fallbackNextReviewTimestamp = input.nextReviewDate
    ? Date.parse(input.nextReviewDate)
    : Number.NaN;
  const projectedNextReviewTimestamp =
    nextBucketTimestamp ??
    (Number.isNaN(fallbackNextReviewTimestamp) ||
    fallbackNextReviewTimestamp <= referenceTimestamp
      ? null
      : fallbackNextReviewTimestamp);

  return {
    projectedReviewCount: baseReviewCount + gainedReviews,
    projectedNextReviewDate:
      projectedNextReviewTimestamp === null
        ? null
        : new Date(projectedNextReviewTimestamp).toISOString(),
    projectedNextReviewCount:
      projectedNextReviewTimestamp === null
        ? null
        : nextBucketTimestamp === projectedNextReviewTimestamp
          ? nextBucketCount
          : null,
  };
}

function resolveReviewIllustrationUri(
  reviewCount: number,
  illustrationUris: ReviewIllustrationUris,
): string | null {
  if (reviewCount <= 25) {
    return (
      illustrationUris.low ??
      illustrationUris.mid ??
      illustrationUris.high ??
      illustrationUris.veryHigh ??
      null
    );
  }

  if (reviewCount <= 100) {
    return (
      illustrationUris.mid ??
      illustrationUris.high ??
      illustrationUris.veryHigh ??
      illustrationUris.low ??
      null
    );
  }

  if (reviewCount <= 250) {
    return (
      illustrationUris.high ??
      illustrationUris.mid ??
      illustrationUris.veryHigh ??
      illustrationUris.low ??
      null
    );
  }

  return (
    illustrationUris.veryHigh ??
    illustrationUris.high ??
    illustrationUris.mid ??
    illustrationUris.low ??
    null
  );
}

function resolveReviewIllustrationAspectRatio(reviewCount: number): number {
  if (reviewCount <= 25) {
    // LowReviewsWidgetWidgetSafe.png: 680 x 453
    return 680 / 453;
  }

  if (reviewCount <= 100) {
    // MidReviewsWidgetWidgetSafe.png: 680 x 362
    return 680 / 362;
  }

  if (reviewCount <= 250) {
    // HighReviewsWidgetWidgetSafe.png: 680 x 456
    return 680 / 456;
  }

  // VeryHighReviewsWidgetWidgetSafe.png: 680 x 443
  return 680 / 443;
}

function buildCriticalSecondaryLabel(input: HomeWidgetSnapshotInput): string {
  const criticalItem = input.topCriticalItem;
  if (!criticalItem) {
    return input.criticalCount > 0
      ? `${input.criticalCount} critical ${pluralize(input.criticalCount, "item", "items")}`
      : "No critical items right now";
  }

  const identifier =
    criticalItem.characters?.trim() ||
    criticalItem.meaning?.trim() ||
    "Lowest accuracy item";
  return `${identifier} · ${Math.round(criticalItem.percentage)}% correct`;
}

function resolveReviewIllustrationKey(
  reviewCount: number,
): ReviewIllustrationKey {
  if (reviewCount <= 25) {
    return "low";
  }
  if (reviewCount <= 100) {
    return "mid";
  }
  if (reviewCount <= 250) {
    return "high";
  }
  return "veryHigh";
}

function resolveAutomaticGradientColors(
  referenceDate: Date,
  isDarkTheme: boolean,
): [string, string, string] {
  const hour = referenceDate.getHours();
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 19;

  if (isDarkTheme) {
    if (isMorning) {
      return ["#334155", "#1E293B", "#0F172A"];
    }
    if (isAfternoon) {
      return ["#164E63", "#155E75", "#0F172A"];
    }
    return ["#111827", "#0F172A", "#020617"];
  }

  if (isMorning) {
    return ["#FDE68A", "#FDBA74", "#FB7185"];
  }
  if (isAfternoon) {
    return ["#7DD3FC", "#38BDF8", "#60A5FA"];
  }
  return ["#6366F1", "#4338CA", "#1E1B4B"];
}

function resolveGradientColors(
  input: HomeWidgetSnapshotInput,
  reviewCount: number,
  referenceDate: Date,
): [string, string, string] {
  if (input.streakGradientPreset === "automatic") {
    return resolveAutomaticGradientColors(
      referenceDate,
      Boolean(input.isDarkTheme),
    );
  }

  if (input.streakGradientPreset === "defaults") {
    if (input.contentMode === "reviews") {
      const reviewKey = resolveReviewIllustrationKey(reviewCount);
      return DEFAULT_REVIEW_GRADIENT_BY_BUCKET[reviewKey];
    }
    return DEFAULT_STREAK_GRADIENT_COLORS;
  }

  return (
    STREAK_GRADIENT_PRESET_COLORS[input.streakGradientPreset] ??
    STREAK_GRADIENT_PRESET_COLORS.sunset
  );
}

function buildWidgetProps(
  input: HomeWidgetSnapshotInput,
  options: {
    referenceDate: Date;
    projectedReviewCount: number;
    projectedTodayReviewTotal: number;
    projectedNextReviewDate: string | null;
    projectedNextReviewCount: number | null;
    reviewIllustrationUris: ReviewIllustrationUris;
    reviewAccessoryIconUri: string;
  },
): HomeWidgetProps {
  const reviewCount = toNonNegativeInteger(options.projectedReviewCount);
  const todayReviewTotal = Math.max(
    reviewCount,
    toNonNegativeInteger(options.projectedTodayReviewTotal),
  );
  const criticalCount = toNonNegativeInteger(input.criticalCount);
  const recentMistakesCount = toNonNegativeInteger(input.recentMistakesCount);
  const currentStreak = toNonNegativeInteger(input.currentStreak);
  const longestStreak = toNonNegativeInteger(input.longestStreak);
  const freezeDaysUntilReload = toNonNegativeInteger(
    input.freezeDaysUntilReload,
  );
  const streakGradientColors = resolveGradientColors(
    input,
    reviewCount,
    options.referenceDate,
  );
  const normalizedRecentDays = (input.streakRecentDays ?? []).map((day) => ({
    dayKey: typeof day.dayKey === "string" ? day.dayKey : undefined,
    label: day.label,
    active: Boolean(day.active),
    isToday: Boolean(day.isToday),
  }));
  const streakRecentDays = buildProjectedStreakRecentDays(
    normalizedRecentDays,
    options.referenceDate,
    input.streakTimezone,
  );

  return {
    contentMode: input.contentMode,
    updatedAtLabel: UPDATED_AT_TIME_FORMATTER.format(options.referenceDate),
    reviewsCountValue: reviewCount,
    reviewsPrimaryLabel: `${reviewCount} available`,
    reviewsSecondaryLabel: formatUpcomingReviewBucketLabel(
      options.projectedNextReviewDate,
      options.projectedNextReviewCount,
    ),
    reviewsTertiaryLabel: `${todayReviewTotal} total today`,
    reviewsImageUri: resolveReviewIllustrationUri(
      reviewCount,
      options.reviewIllustrationUris,
    ) ?? "",
    reviewIllustrationUris: options.reviewIllustrationUris,
    reviewsImageAspectRatio: resolveReviewIllustrationAspectRatio(reviewCount),
    reviewsIconUri: options.reviewAccessoryIconUri,
    criticalItems: (input.criticalItems ?? (input.topCriticalItem ? [input.topCriticalItem] : [])).slice(0, 3),
    criticalCount,
    criticalPrimaryLabel: `${criticalCount} critical ${pluralize(criticalCount, "item", "items")}`,
    criticalSecondaryLabel: buildCriticalSecondaryLabel(input),
    criticalTertiaryLabel: `${recentMistakesCount} recent ${pluralize(recentMistakesCount, "mistake", "mistakes")}`,
    streakPrimaryLabel: `${currentStreak}`,
    streakSecondaryLabel: `Best ${longestStreak}`,
    streakTertiaryLabel: input.freezeAvailable
      ? "Freeze ready"
      : `Freeze in ${freezeDaysUntilReload}d`,
    streakGradientColors,
    streakRecentDays,
    streakIconUris: cachedStreakIconUris ?? {},
  };
}

let hasLoggedWidgetUpdateError = false;
let hasLoggedStreakIconPreparationError = false;
let hasLoggedReviewIllustrationPreparationError = false;
let hasLoggedReviewAccessoryIconPreparationError = false;

function getNextLocalMidnight(date: Date): Date {
  const nextMidnight = new Date(date);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight;
}

function getAutomaticThemeTransitionTimestamps(startDate: Date): number[] {
  const timestamps: number[] = [];
  const transitionHours = [6, 12, 19];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (const hour of transitionHours) {
      const transitionDate = new Date(startDate);
      transitionDate.setDate(startDate.getDate() + dayOffset);
      transitionDate.setHours(hour, 0, 0, 0);
      if (transitionDate.getTime() > startDate.getTime()) {
        timestamps.push(transitionDate.getTime());
      }
    }
  }

  return timestamps;
}

function buildTimelineEntries(
  input: HomeWidgetSnapshotInput,
  reviewIllustrationUris: ReviewIllustrationUris,
  reviewAccessoryIconUri: string,
) {
  const now = new Date();
  const reviewUpcomingBuckets = normalizeReviewUpcomingBuckets(input, now);
  const timelineTimestamps = new Set<number>([now.getTime()]);
  const timelineAnchorTimestamps = new Set<number>();

  // Lock Screen accessory families always render reviews, even when the
  // Home Screen widget is configured for streaks.
  for (const bucket of reviewUpcomingBuckets) {
    timelineTimestamps.add(bucket.timestamp);
  }
  const nextReviewTimestamp = input.nextReviewDate
    ? Date.parse(input.nextReviewDate)
    : Number.NaN;
  if (!Number.isNaN(nextReviewTimestamp) && nextReviewTimestamp > now.getTime()) {
    const rounded = new Date(nextReviewTimestamp);
    rounded.setMinutes(0, 0, 0);
    timelineTimestamps.add(rounded.getTime());
  }

  // Always include the next 7 local midnights.
  let midnight = getNextLocalMidnight(now);
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    timelineTimestamps.add(midnight.getTime());
    timelineAnchorTimestamps.add(midnight.getTime());
    const nextMidnight = new Date(midnight);
    nextMidnight.setDate(midnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    midnight = nextMidnight;
  }

  if (input.streakGradientPreset === "automatic") {
    for (const timestamp of getAutomaticThemeTransitionTimestamps(now)) {
      timelineTimestamps.add(timestamp);
      timelineAnchorTimestamps.add(timestamp);
    }
  }

  const clampedTimestamps = selectWidgetTimelineTimestamps(
    timelineTimestamps,
    timelineAnchorTimestamps,
    now.getTime(),
    MAX_WIDGET_TIMELINE_ENTRIES,
  );

  return clampedTimestamps
    .map((timestamp) => {
      const referenceDate = new Date(timestamp);
      const projectedReviews = buildProjectedReviewSnapshot(
        input,
        reviewUpcomingBuckets,
        now,
        referenceDate,
      );
      const projectedTodayReviewTotal =
        resolveProjectedReviewTotalForLocalDay({
          baselineDate: now,
          referenceDate,
          currentReviews: projectedReviews.projectedReviewCount,
          baselineTodayTotal: input.todayReviewTotal,
          upcomingBuckets: input.reviewUpcomingBuckets,
        });

      return {
        date: referenceDate,
        props: {
          ...buildWidgetProps(input, {
            referenceDate,
            projectedReviewCount: projectedReviews.projectedReviewCount,
            projectedTodayReviewTotal,
            projectedNextReviewDate: projectedReviews.projectedNextReviewDate,
            projectedNextReviewCount: projectedReviews.projectedNextReviewCount,
            reviewIllustrationUris,
            reviewAccessoryIconUri,
          }),
          // Native background refreshes replace review timestamps, while these
          // entries must survive so streak days and automatic themes still advance.
          timelineAnchor: timelineAnchorTimestamps.has(timestamp),
        },
      };
    });
}

function buildImmediateWidgetProps(
  input: HomeWidgetSnapshotInput,
  reviewIllustrationUris: ReviewIllustrationUris,
  reviewAccessoryIconUri: string,
): HomeWidgetProps {
  const now = new Date();
  const projectedReviews = buildProjectedReviewSnapshot(
    input,
    normalizeReviewUpcomingBuckets(input, now),
    now,
    now,
  );
  const projectedTodayReviewTotal = resolveProjectedReviewTotalForLocalDay({
    baselineDate: now,
    referenceDate: now,
    currentReviews: projectedReviews.projectedReviewCount,
    baselineTodayTotal: input.todayReviewTotal,
    upcomingBuckets: input.reviewUpcomingBuckets,
  });
  return buildWidgetProps(input, {
    referenceDate: now,
    projectedReviewCount: projectedReviews.projectedReviewCount,
    projectedTodayReviewTotal,
    projectedNextReviewDate: projectedReviews.projectedNextReviewDate,
    projectedNextReviewCount: projectedReviews.projectedNextReviewCount,
    reviewIllustrationUris,
    reviewAccessoryIconUri,
  });
}

function sanitizeWidgetPropsForNative(props: HomeWidgetProps): HomeWidgetProps {
  try {
    const sanitized = JSON.parse(
      JSON.stringify(props, (_key, value) => {
        if (value === null) {
          return "";
        }
        if (typeof value === "number" && !Number.isFinite(value)) {
          return 0;
        }
        return value;
      }),
    ) as HomeWidgetProps;
    return sanitized;
  } catch {
    return props;
  }
}

export async function updateHomeWidgetSnapshot(
  input: HomeWidgetSnapshotInput,
  options: { recordAppActivity?: boolean } = {},
): Promise<void> {
  const normalizedInput = normalizeStreakSnapshotForUpdate(input, options);
  latestWidgetSnapshotInput = normalizedInput;
  const snapshotPersistence = persistWidgetSnapshot(
    AsyncStorage,
    LAST_WIDGET_SNAPSHOT_STORAGE_KEY,
    normalizedInput,
  );

  const updateTimelineWithProps = (snapshotInput: HomeWidgetSnapshotInput) => {
    const reviewIllustrationUris = cachedReviewIllustrationUris ?? {};
    const reviewAccessoryIconUri = cachedReviewAccessoryIconUri ?? "";
    const timelineEntries = buildTimelineEntries(
      snapshotInput,
      reviewIllustrationUris,
      reviewAccessoryIconUri,
    );
    const immediateProps = buildImmediateWidgetProps(
      snapshotInput,
      reviewIllustrationUris,
      reviewAccessoryIconUri,
    );
    const immediatePropsForNative = sanitizeWidgetPropsForNative(immediateProps);
    const timelineEntriesForNative = timelineEntries.map((entry) => ({
      date: entry.date,
      props: sanitizeWidgetPropsForNative(entry.props),
    }));
    lastRequestedTimelineEntries = timelineEntries.map((entry) => ({
      date: new Date(entry.date),
      props: entry.props,
    }));
    try {
      // Push a snapshot so the currently rendered widget instance updates immediately.
      kakehashiHomeWidget.updateSnapshot(immediatePropsForNative);
    } catch {
      // Ignore snapshot update failures. This function is best effort only.
    }

    try {
      kakehashiHomeWidget.updateTimeline(timelineEntriesForNative);
    } catch {
      // Ignore timeline update failures. This function is best effort only.
    }
  };

  try {
    updateTimelineWithProps(normalizedInput);
  } catch (error) {
    if (!hasLoggedWidgetUpdateError) {
      hasLoggedWidgetUpdateError = true;
      console.warn("Unable to update home widget snapshot:", error);
    }
  }

  const pendingAssetPreparations: Promise<unknown>[] = [];

  if (normalizedInput.contentMode === "streak" && !cachedStreakIconUris) {
    pendingAssetPreparations.push(
      ensureSharedStreakIconUris().catch((error) => {
        if (!hasLoggedStreakIconPreparationError) {
          hasLoggedStreakIconPreparationError = true;
          console.warn("Unable to prepare streak widget icons:", error);
        }
      }),
    );
  }

  if (
    normalizedInput.contentMode === "reviews" &&
    !cachedReviewIllustrationUris
  ) {
    pendingAssetPreparations.push(
      ensureSharedReviewIllustrationUris().catch((error) => {
        if (!hasLoggedReviewIllustrationPreparationError) {
          hasLoggedReviewIllustrationPreparationError = true;
          console.warn(
            "Unable to prepare review widget illustrations:",
            error,
          );
        }
      }),
    );
  }

  if (cachedReviewAccessoryIconUri === null) {
    pendingAssetPreparations.push(
      ensureSharedReviewAccessoryIconUri().catch((error) => {
        if (!hasLoggedReviewAccessoryIconPreparationError) {
          hasLoggedReviewAccessoryIconPreparationError = true;
          console.warn(
            "Unable to prepare review widget accessory icon:",
            error,
          );
        }
      }),
    );
  }

  if (pendingAssetPreparations.length === 0) {
    await snapshotPersistence;
    return;
  }

  await Promise.all(pendingAssetPreparations);

  const latestInput = latestWidgetSnapshotInput;
  if (latestInput) {
    try {
      updateTimelineWithProps(latestInput);
    } catch (error) {
      if (!hasLoggedWidgetUpdateError) {
        hasLoggedWidgetUpdateError = true;
        console.warn("Unable to update home widget snapshot:", error);
      }
    }
  }

  await snapshotPersistence;
}

function mapTimelineEntriesToDebugEntries(
  entries: { date: Date; props: HomeWidgetProps }[],
  nowTimestamp: number,
): HomeWidgetScheduledUpdateDebugEntry[] {
  return entries
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((entry) => {
      const timestamp = entry.date.getTime();
      return {
        timestamp,
        isoDate: entry.date.toISOString(),
        localDateLabel: WIDGET_DEBUG_DATE_TIME_FORMATTER.format(entry.date),
        isFuture: timestamp > nowTimestamp,
        mode: entry.props.contentMode,
        reviewsCountValue: toNonNegativeInteger(entry.props.reviewsCountValue),
        reviewsSecondaryLabel: entry.props.reviewsSecondaryLabel,
        streakPrimaryLabel: entry.props.streakPrimaryLabel,
        streakSecondaryLabel: entry.props.streakSecondaryLabel,
        streakTertiaryLabel: entry.props.streakTertiaryLabel,
      };
    });
}

export async function getHomeWidgetScheduledUpdatesDebug(): Promise<HomeWidgetScheduledUpdatesDebugResult> {
  const nowTimestamp = Date.now();
  const fallbackDebugEntries = mapTimelineEntriesToDebugEntries(
    lastRequestedTimelineEntries,
    nowTimestamp,
  );

  try {
    const nativeEntries = await kakehashiHomeWidget.getTimeline();
    const normalizedNativeEntries = nativeEntries.map((entry) => ({
      date: new Date(entry.date),
      props: entry.props as HomeWidgetProps,
    }));
    const nativeDebugEntries = mapTimelineEntriesToDebugEntries(
      normalizedNativeEntries,
      nowTimestamp,
    );

    if (nativeDebugEntries.length > 0) {
      return {
        source: "nativeTimeline",
        generatedAt: new Date(nowTimestamp).toISOString(),
        entryCount: nativeDebugEntries.length,
        entries: nativeDebugEntries,
      };
    }

    if (fallbackDebugEntries.length > 0) {
      return {
        source: "lastRequestedTimeline",
        generatedAt: new Date(nowTimestamp).toISOString(),
        entryCount: fallbackDebugEntries.length,
        entries: fallbackDebugEntries,
      };
    }

    return {
      source: "none",
      generatedAt: new Date(nowTimestamp).toISOString(),
      entryCount: 0,
      entries: [],
    };
  } catch (error) {
    return {
      source: fallbackDebugEntries.length > 0 ? "lastRequestedTimeline" : "none",
      generatedAt: new Date(nowTimestamp).toISOString(),
      entryCount: fallbackDebugEntries.length,
      entries: fallbackDebugEntries,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateHomeWidgetDisplayPreferences(
  updates: Partial<
    Pick<HomeWidgetSnapshotInput, "contentMode" | "streakGradientPreset" | "isDarkTheme">
  >,
) {
  // Settings can be opened directly after a cold launch, before the dashboard
  // has supplied an in-memory snapshot.
  const latestInput = latestWidgetSnapshotInput ?? await getLastWidgetSnapshotInput();
  if (!latestInput) {
    return;
  }

  await updateHomeWidgetSnapshot({
    ...latestInput,
    ...updates,
  });
}

export function resetHomeWidgetSnapshot() {
  try {
    latestWidgetSnapshotInput = null;
    lastRequestedTimelineEntries = [];
    void AsyncStorage.removeItem(LAST_WIDGET_SNAPSHOT_STORAGE_KEY);
    kakehashiHomeWidget.updateSnapshot(DEFAULT_WIDGET_PROPS);
    kakehashiHomeWidget.updateTimeline([{ date: new Date(), props: DEFAULT_WIDGET_PROPS }]);
  } catch {
    // Ignore widget reset errors. This function is best effort only.
  }
}

export function reloadHomeWidget() {
  try {
    kakehashiHomeWidget.reload();
  } catch {
    // Ignore reload errors. This function is best effort only.
  }
}

export async function getLastWidgetSnapshotInput(): Promise<HomeWidgetSnapshotInput | null> {
  if (latestWidgetSnapshotInput) {
    return latestWidgetSnapshotInput;
  }
  try {
    const raw = await AsyncStorage.getItem(LAST_WIDGET_SNAPSHOT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HomeWidgetSnapshotInput;
      latestWidgetSnapshotInput = parsed;
      return parsed;
    }
  } catch {
    // Best effort only.
  }
  return null;
}

export async function syncHomeWidgetFromBackgroundReviewData(
  reviewData: BackgroundReviewSyncData,
): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return;
  }

  const existingInput = await getLastWidgetSnapshotInput();
  const now = new Date();
  const reviewSchedule = resolveBackgroundReviewSchedule(
    existingInput
      ? {
          nextReviewDate: existingInput.nextReviewDate,
          reviewUpcomingBuckets: existingInput.reviewUpcomingBuckets,
        }
      : null,
    reviewData,
    now,
  );

  const reviewCount = Math.max(0, Math.round(reviewData.currentReviews));
  const todayReviewTotal = resolveProjectedReviewTotalForLocalDay({
    baselineDate: now,
    referenceDate: now,
    currentReviews: reviewCount,
    // Background review data is authoritative for the current local day. Do
    // not carry yesterday's dashboard total across midnight.
    baselineTodayTotal: 0,
    upcomingBuckets: reviewSchedule.reviewUpcomingBuckets,
  });

  const updatedInput: HomeWidgetSnapshotInput = {
    contentMode: existingInput?.contentMode ?? "reviews",
    streakGradientPreset: existingInput?.streakGradientPreset ?? "defaults",
    isDarkTheme: existingInput?.isDarkTheme,
    streakTimezone: existingInput?.streakTimezone,
    reviewCount,
    nextReviewDate: reviewSchedule.nextReviewDate,
    todayReviewTotal,
    reviewUpcomingBuckets: reviewSchedule.reviewUpcomingBuckets,
    criticalCount: existingInput?.criticalCount ?? 0,
    topCriticalItem: existingInput?.topCriticalItem ?? null,
    criticalItems: existingInput?.criticalItems,
    recentMistakesCount: existingInput?.recentMistakesCount ?? 0,
    currentStreak: existingInput?.currentStreak ?? 0,
    longestStreak: existingInput?.longestStreak ?? 0,
    freezeAvailable: existingInput?.freezeAvailable ?? false,
    freezeDaysUntilReload: existingInput?.freezeDaysUntilReload ?? 7,
    streakRecentDays: existingInput?.streakRecentDays ?? [],
  };

  await updateHomeWidgetSnapshot(updatedInput, { recordAppActivity: false });
  reloadHomeWidget();
}
