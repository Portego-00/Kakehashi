import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ColorValue,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withAlpha } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import {
  DEFAULT_WIDGET_CARD_STYLE_COLORS,
  normalizeWidgetCardColor,
} from "../utils/widgetCardStyles";
import { isAssignmentInReviewQueueState } from "../utils/api";

const { width: screenWidth } = Dimensions.get("window");
const isTablet = screenWidth > 768;

type LessonsReviewsCardProps = {
  type: "lessons" | "reviews";
  count: number;
  pendingSyncCount?: number;
  totalLessonCount?: number; // Total available lessons before daily-cap filtering
  onPress: () => void;
  onLessonPicker?: () => void; // Optional callback for lesson picker
  isDone?: boolean;
  isDailyLimitReached?: boolean; // Optional flag to indicate lessons are blocked by daily cap
  nextLessonTime?: string; // Optional timestamp for next available lesson
  nextReviewTime?: string; // Optional timestamp for next available review
  currentLevel?: number;
  subjects?: any[];
  assignments?: any[];
};

export default function LessonsReviewsCard({
  type,
  count,
  pendingSyncCount: pendingSyncCountProp = 0,
  totalLessonCount,
  onPress,
  onLessonPicker,
  isDone,
  isDailyLimitReached,
  nextLessonTime,
  nextReviewTime,
  currentLevel,
  subjects,
  assignments,
}: LessonsReviewsCardProps) {
  const { theme, themeMode } = useTheme();
  const widgetLessonCardFollowTheme = useSettingsStore(
    (state) => state.widgetLessonCardFollowTheme
  );
  const widgetReviewCardFollowTheme = useSettingsStore(
    (state) => state.widgetReviewCardFollowTheme
  );
  const widgetLessonCardGradientStart = useSettingsStore(
    (state) => state.widgetLessonCardGradientStart
  );
  const widgetLessonCardGradientEnd = useSettingsStore(
    (state) => state.widgetLessonCardGradientEnd
  );
  const widgetReviewCardGradientStart = useSettingsStore(
    (state) => state.widgetReviewCardGradientStart
  );
  const widgetReviewCardGradientEnd = useSettingsStore(
    (state) => state.widgetReviewCardGradientEnd
  );
  const isLessons = type === "lessons";
  const pendingSyncCount = Math.max(0, pendingSyncCountProp);
  // Dashboard counts already exclude pending offline progress IDs.
  const displayCount = Math.max(0, count);
  const followsTheme = isLessons
    ? widgetLessonCardFollowTheme
    : widgetReviewCardFollowTheme;
  const totalAvailableLessons = isLessons
    ? Math.max(0, totalLessonCount ?? count)
    : displayCount;
  const lessonsBlockedByDailyLimit =
    isLessons && Boolean(isDailyLimitReached) && displayCount === 0;
  const canShowLessonPicker =
    isLessons && Boolean(onLessonPicker) && totalAvailableLessons > 0;
  const isGrayedOut =
    (isLessons && (Boolean(isDone) || Boolean(isDailyLimitReached))) ||
    displayCount === 0;
  const pendingSyncLabel = pendingSyncCount
    ? `${pendingSyncCount} ${isLessons ? "lesson" : "review"}${
        pendingSyncCount === 1 ? "" : "s"
      } awaiting sync`
    : null;
  const hasCriticalReviews = React.useMemo(() => {
    if (
      isLessons ||
      !displayCount ||
      !currentLevel ||
      !Array.isArray(subjects) ||
      !Array.isArray(assignments) ||
      subjects.length === 0 ||
      assignments.length === 0
    ) {
      return false;
    }

    const nowMs = Date.now();
    const subjectMap = new Map(subjects.map((subject) => [subject?.id, subject]));

    return assignments.some((assignment) => {
      if (!isAssignmentInReviewQueueState(assignment?.data)) {
        return false;
      }

      const availableAtMs = Date.parse(assignment.data.available_at);
      if (Number.isNaN(availableAtMs) || availableAtMs > nowMs) {
        return false;
      }

      const subject = subjectMap.get(assignment.data.subject_id);
      if (!subject) {
        return false;
      }

      if (subject.data?.level !== currentLevel) {
        return false;
      }

      if (subject.object !== "radical" && subject.object !== "kanji") {
        return false;
      }

      return (
        typeof assignment.data.srs_stage === "number" &&
        assignment.data.srs_stage >= 1 &&
        assignment.data.srs_stage <= 4
      );
    });
  }, [assignments, currentLevel, displayCount, isLessons, subjects]);
  const reviewCountBadgeBorderColor =
    !isLessons && hasCriticalReviews
      ? themeMode === "sepia"
        ? "#A8402F"
        : theme.error
      : "transparent";
  const renderLessonPickerButton = () => {
    if (!canShowLessonPicker || !onLessonPicker) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={onLessonPicker}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="options-outline" size={16} color="white" />
        <Text style={styles.pickerButtonText}>Lesson Picker</Text>
      </TouchableOpacity>
    );
  };

  // Format next lesson/review time if provided
  const formatNextTime = (timestamp?: string) => {
    if (!timestamp) return null;

    const now = new Date();
    const nextTime = new Date(timestamp);
    const diffMs = nextTime.getTime() - now.getTime();

    // Calculate time units
    const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    const remainingMinutes = diffMinutes % 60;

    if (diffDays > 0) {
      return `Next in ${diffDays}d ${remainingHours}h`;
    } else if (diffHours > 0) {
      return `Next in ${diffHours}h ${remainingMinutes}m`;
    } else if (diffMinutes > 0) {
      return `Next in ${diffMinutes}m`;
    } else {
      return `Coming soon`;
    }
  };

  const getGradientColors = (): readonly [ColorValue, ColorValue] => {
    if (isGrayedOut) {
      return theme.isDark ? ["#505050", "#404040"] : ["#c0c0c0", "#a0a0a0"]; // Grayed out gradient
    }

    if (!followsTheme) {
      return isLessons
        ? ([
            normalizeWidgetCardColor(
              widgetLessonCardGradientStart,
              DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientStart
            ),
            normalizeWidgetCardColor(
              widgetLessonCardGradientEnd,
              DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientEnd
            ),
          ] as const)
        : ([
            normalizeWidgetCardColor(
              widgetReviewCardGradientStart,
              DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientStart
            ),
            normalizeWidgetCardColor(
              widgetReviewCardGradientEnd,
              DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientEnd
            ),
          ] as const);
    }

    // Preserve legacy defaults exactly in light mode
    if (!theme.isDark && themeMode !== "sepia") {
      return isLessons
        ? (["#fe5bb6", "#fa1f62"] as const) // Lessons (pink)
        : (["#47acdd", "#0093dd"] as const); // Reviews (blue)
    }

    if (themeMode === "sepia") {
      return isLessons
        ? [withAlpha(theme.primary, 0.88), theme.primary]
        : [withAlpha(theme.secondary, 0.86), theme.secondary];
    }

    if (themeMode === "midnight") {
      return isLessons ? ["#5f153c", "#45102c"] : ["#15425f", "#103249"];
    }

    if (theme.isDark) {
      return isLessons ? ["#8e2758", "#6f1a46"] : ["#2b6f98", "#1f5575"];
    }
    return isLessons ? ["#fe5bb6", "#fa1f62"] : ["#47acdd", "#0093dd"];
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { shadowColor: theme.isDark ? "#000000" : "#000000" },
      ]}
      onPress={onPress}
      disabled={displayCount === 0 || lessonsBlockedByDailyLimit}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={getGradientColors()}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Background Image */}
        {isLessons ? (
          <Image
            source={
              displayCount === 0
                ? require("../../assets/images/NoLessons.png")
                : require("../../assets/images/Lessons.png")
            }
            style={[
              styles.backgroundImage,
              !isTablet && styles.backgroundImageMobile,
              displayCount === 0 && styles.noLessonsImage,
            ]}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={
              displayCount === 0
                ? require("../../assets/images/ReviewsFinished.png")
                : require("../../assets/images/Reviews.png")
            }
            style={[
              styles.backgroundImage,
              styles.reviewsBackgroundImage,
              !isTablet && styles.backgroundImageMobile,
            ]}
            resizeMode="contain"
          />
        )}

        <View
          style={[
            styles.contentContainer,
            !isTablet && styles.contentContainerMobile,
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  isGrayedOut
                    ? { color: theme.isDark ? "#808080" : "#444" }
                    : null,
                ]}
              >
                {isLessons ? "Lessons" : "Reviews"}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    borderColor: reviewCountBadgeBorderColor,
                    borderWidth: !isLessons && hasCriticalReviews ? 2 : 0,
                  },
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text style={[styles.countText, { color: theme.textColor }]}>
                  {displayCount}
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={[
              styles.subtitle,
              isGrayedOut ? { color: theme.isDark ? "#808080" : "#444" } : null,
            ]}
          >
            {isGrayedOut
              ? isLessons
                ? lessonsBlockedByDailyLimit
                  ? "You've reached your daily lesson limit for today."
                  : "You've done all your available lessons!"
                : "There are no more reviews to do right now."
              : isLessons
              ? "We cooked up these lessons just for you."
              : "Review these items to level them up!"}
          </Text>

          {pendingSyncLabel ? (
            <View style={styles.pendingSyncRow}>
              <Ionicons name="cloud-upload-outline" size={14} color="white" />
              <Text style={styles.pendingSyncText}>{pendingSyncLabel}</Text>
            </View>
          ) : null}

          <View style={styles.bottomRow}>
            {lessonsBlockedByDailyLimit ? (
              <View style={styles.blockedLessonsContainer}>
                <Text style={styles.nextTimeText}>More lessons unlock tomorrow.</Text>
                {renderLessonPickerButton()}
              </View>
            ) : isLessons && displayCount === 0 ? (
              <Text style={styles.nextTimeText}>
                {nextLessonTime
                  ? formatNextTime(nextLessonTime)
                  : "No lessons available right now."}
              </Text>
            ) : !isLessons && displayCount === 0 && nextReviewTime ? (
              <Text style={styles.nextTimeText}>
                {formatNextTime(nextReviewTime)}
              </Text>
            ) : (
              <View style={styles.bottomLeft}>
                <View
                  style={[
                    styles.startButton,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text
                    style={[styles.startButtonText, { color: theme.textColor }]}
                  >
                    {isLessons ? "Start Lessons" : "Start Reviews"}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      isGrayedOut
                        ? theme.textSecondary
                        : isLessons
                        ? "#fa1f62"
                        : "#0093dd"
                    }
                  />
                </View>
                {renderLessonPickerButton()}
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// This component is used in the Index screen to render both cards stacked
export function LessonsReviewsCardPair({
  lessonCount,
  totalLessonCount,
  reviewCount,
  pendingLessonSyncCount = 0,
  pendingReviewSyncCount = 0,
  onLessonsPress,
  onReviewsPress,
  onLessonPicker,
  isDoneLessons,
  isLessonDailyLimitReached,
  nextLessonTime,
  nextReviewTime,
  isIPadLandscape,
  currentLevel,
  subjects,
  assignments,
}: {
  lessonCount: number;
  totalLessonCount?: number;
  reviewCount: number;
  pendingLessonSyncCount?: number;
  pendingReviewSyncCount?: number;
  onLessonsPress: () => void;
  onReviewsPress: () => void;
  onLessonPicker?: () => void;
  isDoneLessons?: boolean;
  isLessonDailyLimitReached?: boolean;
  nextLessonTime?: string;
  nextReviewTime?: string;
  isIPadLandscape?: boolean;
  currentLevel?: number;
  subjects?: any[];
  assignments?: any[];
}) {
  return (
    <View
      style={[
        styles.cardPairContainer,
        isIPadLandscape && styles.cardPairContainerHorizontal,
      ]}
    >
      <LessonsReviewsCard
        type="lessons"
        count={lessonCount}
        pendingSyncCount={pendingLessonSyncCount}
        totalLessonCount={totalLessonCount}
        onPress={onLessonsPress}
        onLessonPicker={onLessonPicker}
        isDone={isDoneLessons}
        isDailyLimitReached={isLessonDailyLimitReached}
        nextLessonTime={nextLessonTime}
      />
      <LessonsReviewsCard
        type="reviews"
        count={reviewCount}
        pendingSyncCount={pendingReviewSyncCount}
        onPress={onReviewsPress}
        nextReviewTime={nextReviewTime}
        currentLevel={currentLevel}
        subjects={subjects}
        assignments={assignments}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardPairContainer: {
    flexDirection: "column",
  },
  cardPairContainerHorizontal: {
    flexDirection: "row",
    gap: 12,
  },
  container: {
    flex: 1,
    borderRadius: 12,
    minHeight: 150,
    marginHorizontal: 4,
    marginVertical: 8,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    borderRadius: 12,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
    zIndex: 1,
    position: "relative",
  },
  contentContainerMobile: {
    paddingRight: 120, // Leave space for smaller image on mobile
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    gap: 4,
  },
  pickerButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  countBadge: {
    borderRadius: 18,
    minWidth: 36,
    height: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
    color: "white",
    marginVertical: 8,
  },
  nextTimeText: {
    fontSize: 14,
    color: "white",
    opacity: 0.9,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 16,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  backgroundImage: {
    position: "absolute",
    right: 18,
    top: -20,
    width: 150,
    zIndex: 0,
  },
  backgroundImageMobile: {
    width: 100, // Smaller on mobile
    right: 10,
    top: -40, // Higher position, even with negative margin
  },
  reviewsBackgroundImage: {
    top: -30,
    transform: [{ scale: 1.1 }],
  },
  noLessonsImage: {
    top: -75, // Adjust for square image to center it better
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  blockedLessonsContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  pendingSyncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pendingSyncText: {
    fontSize: 12,
    color: "white",
    opacity: 0.95,
    fontWeight: "600",
  },
});
