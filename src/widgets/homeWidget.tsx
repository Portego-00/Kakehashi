import {
  Circle,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  aspectRatio,
  allowsTightening,
  clipped,
  clipShape,
  font,
  frame,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
  offset,
  opacity,
  padding,
  resizable,
  shadow,
  widgetAccentedRenderingMode,
} from "@expo/ui/swift-ui/modifiers";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import type { Widget, WidgetEnvironment } from "expo-widgets";
import type { ReactElement } from "react";
import { Platform } from "react-native";
import type {
  WidgetContentMode,
  WidgetStreakGradientPreset,
} from "../utils/store";

export const KAKEHASHI_HOME_WIDGET_NAME = "KakehashiHomeWidget";
const WIDGET_APP_GROUP_IDENTIFIER = "group.com.kakehashi.reviewdata";
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

type TopCriticalItem = {
  characters: string | null;
  meaning: string;
  percentage: number;
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
  topCriticalItem: TopCriticalItem | null;
  recentMistakesCount: number;
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  streakRecentDays: StreakRecentDay[];
};

type HomeWidgetProps = {
  contentMode: WidgetContentMode;
  updatedAtLabel: string;
  reviewsCountValue: number;
  reviewsPrimaryLabel: string;
  reviewsSecondaryLabel: string;
  reviewsTertiaryLabel: string;
  reviewsImageUri: string;
  reviewsImageAspectRatio: number;
  reviewsIconUri: string;
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

type WidgetController<T extends object> = Pick<
  Widget<T>,
  "updateSnapshot" | "updateTimeline" | "reload" | "getTimeline"
>;

type CreateWidgetFn = <T extends object>(
  name: string,
  widget: (props: T, context: WidgetEnvironment) => ReactElement,
) => Widget<T>;

const NOOP_WIDGET: WidgetController<HomeWidgetProps> = {
  updateSnapshot: () => {},
  updateTimeline: () => {},
  reload: () => {},
  getTimeline: async () => [],
};

const DEFAULT_WIDGET_PROPS: HomeWidgetProps = {
  contentMode: "reviews",
  updatedAtLabel: "",
  reviewsCountValue: 0,
  reviewsPrimaryLabel: "0 available",
  reviewsSecondaryLabel: "No upcoming reviews",
  reviewsTertiaryLabel: "0 total today",
  reviewsImageUri: "",
  reviewsImageAspectRatio: 1.6,
  reviewsIconUri: "",
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
      await sourceFile.copy(destinationFile);
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
      await sourceFile.copy(destinationFile);
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

    await sourceFile.copy(destinationFile);
    cachedReviewAccessoryIconUri = destinationFile.uri;
    return destinationFile.uri;
  })().finally(() => {
    pendingReviewAccessoryIconUriPromise = null;
  });

  return pendingReviewAccessoryIconUriPromise;
}

function KakehashiHomeWidget(
  props: HomeWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const isMedium = environment.widgetFamily === "systemMedium";
  const widgetEnvironment = environment as WidgetEnvironment & {
    showsContainerBackground?: boolean;
    showsWidgetContainerBackground?: boolean;
  };
  const widgetRenderingMode = widgetEnvironment.widgetRenderingMode ?? "fullColor";
  const isAccentedRenderingMode =
    widgetRenderingMode === "accented" || widgetRenderingMode === "vibrant";
  const hasContainerBackground =
    (widgetEnvironment.showsContainerBackground ??
      widgetEnvironment.showsWidgetContainerBackground) !== false;
  const shouldRenderGradientBackground =
    hasContainerBackground && !isAccentedRenderingMode;
  const shouldUseAccentedImageRendering =
    isAccentedRenderingMode || !hasContainerBackground;

  // Expo Widgets serializes this component into the widget extension, so keep
  // this branch self-contained and avoid calling file-scope helpers here.
  if (
    environment.widgetFamily === "accessoryCircular" ||
    environment.widgetFamily === "accessoryRectangular" ||
    environment.widgetFamily === "accessoryInline"
  ) {
    const rawReviewCount = Number.isFinite(props.reviewsCountValue)
      ? props.reviewsCountValue
      : 0;
    const reviewCount = Math.max(0, Math.round(rawReviewCount));
    const countLabel = `${reviewCount}`;
    const reviewStateLabel =
      reviewCount === 1 ? "review ready" : "reviews ready";
    const secondaryLabel =
      typeof props.reviewsSecondaryLabel === "string" &&
      props.reviewsSecondaryLabel.trim().length > 0
        ? props.reviewsSecondaryLabel
        : "No upcoming reviews";

    if (environment.widgetFamily === "accessoryInline") {
      return (
        <Text
          modifiers={[
            font({ size: 14, weight: "semibold" }),
            monospacedDigit(),
            lineLimit(1),
            allowsTightening(true),
          ]}
        >
          {countLabel} {reviewStateLabel}
        </Text>
      );
    }

    if (environment.widgetFamily === "accessoryCircular") {
      const countFontSize =
        countLabel.length >= 5
          ? 12
          : countLabel.length >= 4
            ? 15
            : countLabel.length >= 3
              ? 18
              : 22;

      return (
        <ZStack
          alignment="center"
          modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
        >
          <Circle
            modifiers={[
              frame({ width: 56, height: 56 }),
              foregroundStyle({ type: "hierarchical", style: "quaternary" }),
            ]}
          />
          <VStack alignment="center" spacing={0}>
            {props.reviewsIconUri ? (
              <Image
                uiImage={props.reviewsIconUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: 640 / 489, contentMode: "fit" }),
                  frame({ width: 10, height: 10 }),
                  widgetAccentedRenderingMode("fullColor"),
                ]}
              />
            ) : (
              <Image systemName="clock.fill" size={10} />
            )}
            <Text
              modifiers={[
                font({
                  size: countFontSize,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: 8, weight: "semibold" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                lineLimit(1),
              ]}
            >
              rev
            </Text>
          </VStack>
        </ZStack>
      );
    }

    const countFontSize =
      countLabel.length >= 5
        ? 17
        : countLabel.length >= 4
          ? 17
          : countLabel.length >= 3
            ? 20
            : 24;

    return (
      <ZStack
        alignment="leading"
        modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
      >
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[
            padding({ horizontal: 8, vertical: 5 }),
            frame({ maxWidth: 999, maxHeight: 999, alignment: "leading" }),
          ]}
        >
          <HStack spacing={4} alignment="center">
            {props.reviewsIconUri ? (
              <Image
                uiImage={props.reviewsIconUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: 640 / 489, contentMode: "fit" }),
                  frame({ width: 11, height: 11 }),
                  widgetAccentedRenderingMode("fullColor"),
                ]}
              />
            ) : (
              <Image systemName="clock.fill" size={11} />
            )}
            <Text
              modifiers={[
                font({ size: 11, weight: "semibold" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(1),
              ]}
            >
              Reviews
            </Text>
          </HStack>

          <HStack spacing={5} alignment="lastTextBaseline">
            <Text
              modifiers={[
                font({
                  size: countFontSize,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: 11, weight: "semibold" }),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {reviewStateLabel}
            </Text>
          </HStack>

          <Text
            modifiers={[
              font({ size: 10, weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(1),
              allowsTightening(true),
            ]}
          >
            {secondaryLabel}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (props.contentMode === "reviews") {
    const countLabel = `${Math.max(0, Math.round(props.reviewsCountValue))}`;
    const gradientColors =
      Array.isArray(props.streakGradientColors) &&
      props.streakGradientColors.length >= 2
        ? props.streakGradientColors
        : ["#FF7A18", "#FF5A3D", "#FF3F6C"];
    const imageAspectRatio =
      Number.isFinite(props.reviewsImageAspectRatio) &&
      props.reviewsImageAspectRatio > 0
        ? props.reviewsImageAspectRatio
        : 1.6;
    const imageLayerWidth = isMedium ? 320 : 190;
    const imageLayerHeight = 176;
    const textColumnWidth = isMedium ? 226 : 200;
    const textScrimWidth = isMedium ? 244 : 142;
    const shouldUseAdaptiveReviewTextStyling = !shouldRenderGradientBackground;
    const reviewTitleShadowConfig = shouldRenderGradientBackground
      ? { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.75)" }
      : { radius: 1, x: 0, y: 1, color: "rgba(0, 0, 0, 0.42)" };
    const reviewCountShadowConfig = shouldRenderGradientBackground
      ? { radius: 5, x: 0, y: 2, color: "rgba(0, 0, 0, 0.8)" }
      : { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.5)" };
    const reviewSecondaryShadowConfig = shouldRenderGradientBackground
      ? { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.72)" }
      : { radius: 1, x: 0, y: 1, color: "rgba(0, 0, 0, 0.38)" };

    const reviewImageModifiers = [
      resizable(),
      aspectRatio({ ratio: imageAspectRatio, contentMode: "fill" }),
      frame({
        width: imageLayerWidth,
        height: imageLayerHeight,
      }),
      offset({ x: 0, y: 0 }),
      opacity(0.98),
    ];
    if (shouldUseAccentedImageRendering) {
      reviewImageModifiers.push(widgetAccentedRenderingMode("fullColor"));
    }
    const reviewTitleModifiers = [
      font({ size: 12, weight: "semibold" }),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "primary" })
        : foregroundStyle("#FFFFFF"),
      lineLimit(1),
      shadow(reviewTitleShadowConfig),
    ];
    const reviewCountModifiers = [
      font({
        size: isMedium ? 48 : 38,
        weight: "bold",
        design: "rounded",
      }),
      monospacedDigit(),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "primary" })
        : foregroundStyle("#FFFFFF"),
      lineLimit(1),
      shadow(reviewCountShadowConfig),
    ];
    const reviewSecondaryModifiers = [
      font({ size: isMedium ? 12 : 11, weight: "semibold" }),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "secondary" })
        : foregroundStyle("rgba(255, 255, 255, 0.9)"),
      lineLimit(2),
      shadow(reviewSecondaryShadowConfig),
    ];

    return (
      <ZStack
        alignment="topLeading"
        modifiers={[
          frame({ maxWidth: 999, maxHeight: 999 }),
          clipShape("roundedRectangle", 18),
        ]}
      >
        {shouldRenderGradientBackground ? (
          <RoundedRectangle
            cornerRadius={18}
            modifiers={[
              frame({ maxWidth: 999, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: gradientColors,
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 1, y: 1 },
              }),
            ]}
          />
        ) : null}
        {props.reviewsImageUri ? (
          <HStack
            spacing={0}
            alignment="center"
            modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
          >
            <Spacer />
            <ZStack
              alignment="trailing"
              modifiers={[
                frame({
                  width: imageLayerWidth,
                  maxHeight: 999,
                }),
                clipped(true),
              ]}
            >
              <Image
                uiImage={props.reviewsImageUri}
                modifiers={reviewImageModifiers}
              />
            </ZStack>
          </HStack>
        ) : null}
        <HStack
          spacing={0}
          alignment="center"
          modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
        >
          <RoundedRectangle
            cornerRadius={12}
            modifiers={[
              frame({ width: textScrimWidth, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: [
                  "rgba(0, 0, 0, 0.44)",
                  "rgba(0, 0, 0, 0.22)",
                  "rgba(0, 0, 0, 0)",
                ],
                startPoint: { x: 0, y: 0.5 },
                endPoint: { x: 1, y: 0.5 },
              }),
            ]}
          />
          <Spacer />
        </HStack>
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            padding({
              top: 20,
              bottom: isMedium ? 14 : 12,
              horizontal: isMedium ? 12 : 30,
            }),
            frame({ width: textColumnWidth, alignment: "leading" }),
          ]}
        >
          <HStack spacing={5} alignment="center">
            <Image
              systemName="clock.fill"
              size={12}
              color={shouldUseAdaptiveReviewTextStyling ? undefined : "#FFFFFF"}
            />
            <Text modifiers={reviewTitleModifiers}>
              Reviews
            </Text>
          </HStack>

          <Text modifiers={reviewCountModifiers}>
            {countLabel}
          </Text>

          <Text modifiers={reviewSecondaryModifiers}>
            {props.reviewsSecondaryLabel}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (props.contentMode === "streak") {
    const streakCountMatch = props.streakPrimaryLabel.match(/[0-9]+/);
    const parsedCount = streakCountMatch
      ? Number.parseInt(streakCountMatch[0], 10)
      : Number.NaN;
    const countLabel = Number.isFinite(parsedCount)
      ? String(parsedCount)
      : props.streakPrimaryLabel;
    const countValue = Number.isFinite(parsedCount) ? parsedCount : 0;
    const streakGradientColors =
      Array.isArray(props.streakGradientColors) &&
      props.streakGradientColors.length >= 2
        ? props.streakGradientColors
        : ["#FF7A18", "#FF5A3D", "#FF3F6C"];
    const streakIconUris = props.streakIconUris ?? {};
    const streakRecentDays = Array.isArray(props.streakRecentDays)
      ? props.streakRecentDays
      : [];
    const streakDayNumbers: (number | null)[] = new Array(
      streakRecentDays.length,
    ).fill(null);
    let activeDaysAfter = 0;
    for (let index = streakRecentDays.length - 1; index >= 0; index -= 1) {
      const day = streakRecentDays[index];
      if (!day?.active) {
        continue;
      }
      const streakDay = countValue - activeDaysAfter;
      streakDayNumbers[index] = streakDay > 0 ? streakDay : null;
      activeDaysAfter += 1;
    }
    const displayedStreakDays = isMedium
      ? streakRecentDays
      : streakRecentDays.slice(-3);
    const displayedDaysWithSourceIndex = displayedStreakDays.map(
      (day, index) => ({
        day,
        sourceIndex: isMedium
          ? index
          : streakRecentDays.length - displayedStreakDays.length + index,
      }),
    );

    return (
      <ZStack
        alignment="topLeading"
        modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
      >
        {shouldRenderGradientBackground ? (
          <RoundedRectangle
            cornerRadius={18}
            modifiers={[
              frame({ maxWidth: 999, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: streakGradientColors,
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 1, y: 1 },
              }),
            ]}
          />
        ) : null}
        <VStack
          alignment="leading"
          spacing={10}
          modifiers={[
            padding({
              top: 19,
              bottom: isMedium ? 20 : 11,
              horizontal: isMedium ? 12 : 11,
            }),
          ]}
        >
          <HStack spacing={16} alignment="top">
            <HStack spacing={6} alignment="center">
              <Image systemName="flame.fill" size={15} color="#FFD166" />
              <Text
                modifiers={[
                  font({ size: 14, weight: "bold" }),
                  foregroundStyle("#FFFFFF"),
                  lineLimit(1),
                ]}
              >
                App Streak
              </Text>
            </HStack>
            <Spacer />
          </HStack>

          <HStack spacing={8} alignment="bottom">
            <Text
              modifiers={[
                font({
                  size: isMedium ? 42 : 32,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle("#FFFFFF"),
                lineLimit(1),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: isMedium ? 24 : 18, weight: "bold" }),
                foregroundStyle("rgba(255, 255, 255, 0.95)"),
                offset({ y: isMedium ? -2 : -1 }),
                lineLimit(1),
              ]}
            >
              日
            </Text>
          </HStack>

          {displayedDaysWithSourceIndex.length > 0 ? (
            <VStack alignment="leading" spacing={8}>
                <RoundedRectangle
                  cornerRadius={1}
                  modifiers={[
                    frame({ height: 1 }),
                    foregroundStyle("rgba(255, 255, 255, 0.22)"),
                    opacity(0.95),
                  ]}
                />
              <HStack spacing={0} alignment="top">
                {displayedDaysWithSourceIndex.map(({ day, sourceIndex }) => {
                  const streakDayNumber = streakDayNumbers[sourceIndex];
                  const milestoneVariant =
                    streakDayNumber !== null &&
                    streakDayNumber > 0 &&
                    streakDayNumber % 42 === 0
                      ? streakDayNumber === 84
                        ? "day84"
                        : streakDayNumber === 126
                          ? "day126"
                          : streakDayNumber === 168
                            ? "day168"
                            : "day42"
                      : "none";
                  const iconUri = day.active
                    ? milestoneVariant === "day84"
                      ? streakIconUris.day84
                      : milestoneVariant === "day126"
                        ? streakIconUris.day126
                        : milestoneVariant === "day168"
                          ? streakIconUris.day168
                          : milestoneVariant === "day42"
                            ? streakIconUris.day42
                            : streakIconUris.active
                    : streakIconUris.inactive;
                  const iconName = day.active
                    ? milestoneVariant === "none"
                      ? "checkmark"
                      : "star.fill"
                    : "circle";
                  const iconColor = day.active
                    ? milestoneVariant === "day84"
                      ? "#FFD166"
                      : milestoneVariant === "day126"
                        ? "#C8FF7A"
                        : milestoneVariant === "day168"
                          ? "#B8E8FF"
                          : "#FFFFFF"
                    : "rgba(255, 255, 255, 0.65)";
                  const iconImageModifiers = [
                    resizable(),
                    frame({
                      width: isMedium ? 21 : 18,
                      height: isMedium ? 21 : 18,
                    }),
                  ];
                  if (shouldUseAccentedImageRendering) {
                    iconImageModifiers.push(widgetAccentedRenderingMode("fullColor"));
                  }

                  return (
                    <VStack
                      key={`day-${day.label}-${sourceIndex}`}
                      alignment="center"
                      spacing={4}
                      modifiers={[frame({ maxWidth: 999 })]}
                    >
                      <ZStack
                        alignment="center"
                        modifiers={[
                          frame({
                            width: isMedium ? 27 : 23,
                            height: isMedium ? 27 : 23,
                          }),
                        ]}
                      >
                        <Circle
                          modifiers={[
                            frame({
                              width: isMedium ? 27 : 23,
                              height: isMedium ? 27 : 23,
                            }),
                            foregroundStyle(
                              day.active
                                ? "rgba(255, 255, 255, 0.2)"
                                : "rgba(255, 255, 255, 0.12)",
                            ),
                          ]}
                        />
                        {iconUri ? (
                          <Image uiImage={iconUri} modifiers={iconImageModifiers} />
                        ) : (
                          <Image
                            systemName={iconName}
                            size={11}
                            color={iconColor}
                          />
                        )}
                      </ZStack>
                      <Text
                        modifiers={[
                          font({
                            size: isMedium ? 10 : 9,
                            weight: day.isToday ? "bold" : "semibold",
                          }),
                          foregroundStyle(
                            day.isToday
                              ? "#FFFFFF"
                              : "rgba(255, 255, 255, 0.82)",
                          ),
                          lineLimit(1),
                        ]}
                      >
                        {day.label}
                      </Text>
                    </VStack>
                  );
                })}
              </HStack>
            </VStack>
          ) : null}
        </VStack>
      </ZStack>
    );
  }

  const modeTitle = props.contentMode === "critical" ? "Critical" : "Reviews";
  const modeIcon =
    props.contentMode === "critical"
      ? "exclamationmark.triangle.fill"
      : "clock.fill";
  const primaryLabel =
    props.contentMode === "critical"
      ? props.criticalPrimaryLabel
      : props.reviewsPrimaryLabel;
  const secondaryLabel =
    props.contentMode === "critical"
      ? props.criticalSecondaryLabel
      : props.reviewsSecondaryLabel;
  const tertiaryLabel =
    props.contentMode === "critical"
      ? props.criticalTertiaryLabel
      : props.reviewsTertiaryLabel;

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 12 })]}>
      <HStack spacing={6} alignment="center">
        <Image systemName={modeIcon} size={13} color="#4F46E5" />
        <Text
          modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}
        >
          {modeTitle}
        </Text>
        <Spacer />
        {isMedium ? (
          <Text
            modifiers={[
              font({ size: 10 }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(1),
            ]}
          >
            {props.updatedAtLabel}
          </Text>
        ) : null}
      </HStack>

      <Text
        modifiers={[
          font({ size: isMedium ? 27 : 24, weight: "bold", design: "rounded" }),
          monospacedDigit(),
          lineLimit(1),
        ]}
      >
        {primaryLabel}
      </Text>

      <Text
        modifiers={[
          font({ size: 12 }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
          lineLimit(isMedium ? 2 : 1),
        ]}
      >
        {secondaryLabel}
      </Text>

      {isMedium ? (
        <Text
          modifiers={[
            font({ size: 11 }),
            foregroundStyle({ type: "hierarchical", style: "tertiary" }),
            lineLimit(1),
          ]}
        >
          {tertiaryLabel}
        </Text>
      ) : null}
    </VStack>
  );
}

const createWidgetForCurrentPlatform = () => {
  if (Platform.OS !== "ios") {
    return NOOP_WIDGET;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const widgetsModule = require("expo-widgets") as {
    createWidget: CreateWidgetFn;
  };

  return widgetsModule.createWidget<HomeWidgetProps>(
    KAKEHASHI_HOME_WIDGET_NAME,
    KakehashiHomeWidget,
  );
};

const kakehashiHomeWidget = createWidgetForCurrentPlatform();

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

function normalizeSnapshotInputForLiveStreakSession(
  input: HomeWidgetSnapshotInput,
): HomeWidgetSnapshotInput {
  if (input.contentMode !== "streak") {
    return input;
  }

  const sourceRecentDays = Array.isArray(input.streakRecentDays)
    ? input.streakRecentDays
    : [];
  if (sourceRecentDays.length === 0) {
    return input;
  }

  const now = new Date();
  const timezone = input.streakTimezone;
  const currentDayKey =
    typeof timezone === "string" && timezone.trim().length > 0
      ? toDayKeyInTimezone(now, timezone)
      : toLocalDayKey(now);

  const hasSortableDayKeys = sourceRecentDays.every(
    (day) =>
      typeof day.dayKey === "string" && STREAK_DAY_KEY_PATTERN.test(day.dayKey),
  );
  const shouldMarkTodayActive =
    toNonNegativeInteger(input.currentStreak) > 0 ||
    sourceRecentDays.some((day) => Boolean(day.active));

  let normalizedRecentDays: StreakRecentDay[];

  if (hasSortableDayKeys) {
    const dayByKey = new Map<string, StreakRecentDay>();
    for (const day of sourceRecentDays) {
      if (day.dayKey) {
        dayByKey.set(day.dayKey, day);
      }
    }

    normalizedRecentDays = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dayKey = addDays(currentDayKey, -offset);
      const sourceDay = dayByKey.get(dayKey);
      normalizedRecentDays.push({
        dayKey,
        label:
          sourceDay?.label && sourceDay.label.trim().length > 0
            ? sourceDay.label
            : STREAK_DAY_LABEL_FORMATTER.format(dayKeyToUtcDate(dayKey)),
        // Opening the app should count as activity for today.
        active:
          offset === 0
            ? shouldMarkTodayActive || Boolean(sourceDay?.active)
            : Boolean(sourceDay?.active),
        isToday: offset === 0,
      });
    }
  } else {
    const fallbackRecentDays = sourceRecentDays.slice(-7);
    normalizedRecentDays = fallbackRecentDays.map((day, index) => {
      const isToday = index === fallbackRecentDays.length - 1;
      return {
        ...day,
        active: isToday ? shouldMarkTodayActive || Boolean(day.active) : Boolean(day.active),
        isToday,
      };
    });
  }

  const didChange =
    normalizedRecentDays.length !== sourceRecentDays.length ||
    normalizedRecentDays.some((day, index) => {
      const sourceDay = sourceRecentDays[index];
      if (!sourceDay) {
        return true;
      }

      return (
        (day.dayKey ?? null) !== (sourceDay.dayKey ?? null) ||
        day.label !== sourceDay.label ||
        day.active !== Boolean(sourceDay.active) ||
        day.isToday !== Boolean(sourceDay.isToday)
      );
    });

  if (!didChange) {
    return input;
  }

  return {
    ...input,
    streakRecentDays: normalizedRecentDays,
  };
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
    projectedNextReviewDate: string | null;
    projectedNextReviewCount: number | null;
    reviewIllustrationUris: ReviewIllustrationUris;
    reviewAccessoryIconUri: string;
  },
): HomeWidgetProps {
  const reviewCount = toNonNegativeInteger(options.projectedReviewCount);
  const todayReviewTotal = Math.max(
    reviewCount,
    toNonNegativeInteger(input.todayReviewTotal),
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
    reviewsImageAspectRatio: resolveReviewIllustrationAspectRatio(reviewCount),
    reviewsIconUri: options.reviewAccessoryIconUri,
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
    const nextMidnight = new Date(midnight);
    nextMidnight.setDate(midnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    midnight = nextMidnight;
  }

  if (input.streakGradientPreset === "automatic") {
    for (const timestamp of getAutomaticThemeTransitionTimestamps(now)) {
      timelineTimestamps.add(timestamp);
    }
  }

  const sortedTimestamps = Array.from(timelineTimestamps).sort(
    (leftTimestamp, rightTimestamp) => leftTimestamp - rightTimestamp,
  );
  const clampedTimestamps =
    sortedTimestamps.length > MAX_WIDGET_TIMELINE_ENTRIES
      ? sortedTimestamps.slice(0, MAX_WIDGET_TIMELINE_ENTRIES)
      : sortedTimestamps;

  return clampedTimestamps
    .map((timestamp) => {
      const referenceDate = new Date(timestamp);
      const projectedReviews = buildProjectedReviewSnapshot(
        input,
        reviewUpcomingBuckets,
        now,
        referenceDate,
      );

      return {
        date: referenceDate,
        props: buildWidgetProps(input, {
          referenceDate,
          projectedReviewCount: projectedReviews.projectedReviewCount,
          projectedNextReviewDate: projectedReviews.projectedNextReviewDate,
          projectedNextReviewCount: projectedReviews.projectedNextReviewCount,
          reviewIllustrationUris,
          reviewAccessoryIconUri,
        }),
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
  return buildWidgetProps(input, {
    referenceDate: now,
    projectedReviewCount: projectedReviews.projectedReviewCount,
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

export function updateHomeWidgetSnapshot(input: HomeWidgetSnapshotInput) {
  const normalizedInput = normalizeSnapshotInputForLiveStreakSession(input);
  latestWidgetSnapshotInput = normalizedInput;

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
    return;
  }

  void Promise.all(pendingAssetPreparations)
    .then(() => {
      const latestInput = latestWidgetSnapshotInput;
      if (!latestInput) {
        return;
      }

      try {
        updateTimelineWithProps(latestInput);
      } catch (error) {
        if (!hasLoggedWidgetUpdateError) {
          hasLoggedWidgetUpdateError = true;
          console.warn("Unable to update home widget snapshot:", error);
        }
      }
    });
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

export function updateHomeWidgetDisplayPreferences(
  updates: Partial<
    Pick<HomeWidgetSnapshotInput, "contentMode" | "streakGradientPreset" | "isDarkTheme">
  >,
) {
  const latestInput = latestWidgetSnapshotInput;
  if (!latestInput) {
    return;
  }

  updateHomeWidgetSnapshot({
    ...latestInput,
    ...updates,
  });
}

export function resetHomeWidgetSnapshot() {
  try {
    kakehashiHomeWidget.updateSnapshot(DEFAULT_WIDGET_PROPS);
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
