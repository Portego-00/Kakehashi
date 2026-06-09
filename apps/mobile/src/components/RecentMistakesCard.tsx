import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Haptics from "@/src/utils/haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { RecentMistake } from "../types/wanikani";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { useSubjectColors } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TimePeriod = "hour" | "day" | "week";

type RecentMistakesCardProps = {
  recentMistakes: RecentMistake[];
  style?: StyleProp<ViewStyle>;
};

const MistakeItemCharacter = ({
  item,
  textColor,
}: {
  item: RecentMistake;
  textColor: string;
}) => {
  const isRadical = item.type === "radical";

  const bestImg =
    isRadical && item.character_images?.length
      ? pickBestImage(item.character_images)
      : null;
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, textColor);

  if (item.characters) {
    return (
      <Text style={[styles.itemCharacter, { color: textColor }]} numberOfLines={1}>
        {item.characters}
      </Text>
    );
  }

  if (svgXml) {
    return <SvgXml xml={svgXml} width={24} height={24} />;
  }

  return (
    <Text style={[styles.itemCharacter, { color: textColor }]} numberOfLines={1}>
      {item.meaning.charAt(0).toUpperCase()}
    </Text>
  );
};

const TIME_PERIOD_VALUES = ["1h", "24h", "7d"];
const TIME_PERIODS: TimePeriod[] = ["hour", "day", "week"];

export default function RecentMistakesCard({
  recentMistakes,
  style,
}: RecentMistakesCardProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to 24h (index 1)
  const isFirstRender = useRef(true);

  const timePeriod = TIME_PERIODS[selectedIndex];

  // Filter mistakes based on the selected time period
  const filteredMistakes = useMemo(() => {
    if (!recentMistakes || recentMistakes.length === 0) return [];

    const now = new Date();
    let cutoffTime: Date;

    switch (timePeriod) {
      case "hour":
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "day":
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    return recentMistakes.filter(
      (m) => new Date(m.updatedAt) >= cutoffTime
    );
  }, [recentMistakes, timePeriod]);

  const hasMistakes = filteredMistakes.length > 0;

  // Animate layout changes when filtered mistakes change (but not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    LayoutAnimation.configureNext({
      duration: 250,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
  }, [filteredMistakes.length]);

  if (!recentMistakes || recentMistakes.length === 0) {
    return null;
  }

  const handleSegmentChange = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndex(index);
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case "hour":
        return "Past hour";
      case "day":
        return "Past 24 hours";
      case "week":
        return "Past week";
    }
  };

  const handleItemPress = (item: RecentMistake) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/subject/[id]",
      params: { id: item.id },
    });
  };

  const handleExtraStudy = () => {
    if (!hasMistakes) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subjectIds = filteredMistakes.map((m) => m.id).join(",");
    router.push({
      pathname: "/custom-review",
      params: { subjectIds },
    });
  };

  const handleRedoLessons = () => {
    if (!hasMistakes) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subjectIds = filteredMistakes.map((m) => m.id).join(",");
    router.push({
      pathname: "/custom-lesson",
      params: { subjectIds },
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "radical":
        return subjectColors.radical;
      case "kanji":
        return subjectColors.kanji;
      case "vocabulary":
      case "kana_vocabulary":
        return subjectColors.vocabulary;
      default:
        return "#888888";
    }
  };

  return (
    <View
      style={[
        styles.container,
        style,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "rgba(0,0,0,0.1)",
        },
      ]}
    >
      {/* Header with title and segmented control */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Recent Mistakes
          </Text>
        </View>
        <SegmentedControl
          values={TIME_PERIOD_VALUES}
          selectedIndex={selectedIndex}
          onChange={(event) => handleSegmentChange(event.nativeEvent.selectedSegmentIndex)}
          style={styles.segmentedControl}
          tintColor={subjectColors.vocabulary}
          fontStyle={{ color: theme.textSecondary, fontSize: 12 }}
          activeFontStyle={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
        />
      </View>

      {/* Content area with animation */}
      <View style={styles.contentContainer}>
        {hasMistakes ? (
          <>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {getTimePeriodLabel()}.
            </Text>

            {/* Items horizontal scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.itemsContainer}
              decelerationRate="fast"
            >
              {filteredMistakes.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemCard,
                    { backgroundColor: getTypeColor(item.type) },
                  ]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.8}
                >
                  <MistakeItemCharacter item={item} textColor="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color={theme.textLight}
            />
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
              No mistakes in the {getTimePeriodLabel().toLowerCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Action buttons - always visible but disabled when no mistakes */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: hasMistakes
                ? theme.isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)"
                : theme.isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.02)",
              borderColor: hasMistakes ? theme.border : theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              opacity: hasMistakes ? 1 : 0.5,
            },
          ]}
          onPress={handleExtraStudy}
          activeOpacity={hasMistakes ? 0.7 : 1}
          disabled={!hasMistakes}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: hasMistakes ? theme.textColor : theme.textLight },
            ]}
          >
            Extra Study
          </Text>
          {hasMistakes && (
            <View
              style={[
                styles.actionBadge,
                { backgroundColor: subjectColors.vocabulary },
              ]}
            >
              <Text style={styles.actionBadgeText}>{filteredMistakes.length}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={16}
            color={hasMistakes ? theme.textSecondary : theme.textLight}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonSecondary,
            {
              backgroundColor: hasMistakes
                ? theme.isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)"
                : theme.isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.02)",
              borderColor: hasMistakes ? theme.border : theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              opacity: hasMistakes ? 1 : 0.5,
            },
          ]}
          onPress={handleRedoLessons}
          activeOpacity={hasMistakes ? 0.7 : 1}
          disabled={!hasMistakes}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: hasMistakes ? theme.textColor : theme.textLight },
            ]}
          >
            Redo Lessons
          </Text>
          <Ionicons
            name="refresh"
            size={14}
            color={hasMistakes ? theme.textSecondary : theme.textLight}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  countBadge: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  countText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  segmentedControl: {
    width: 130,
    height: 28,
  },
  contentContainer: {
    minHeight: 60,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
  },
  itemsContainer: {
    paddingVertical: 4,
  },
  itemCard: {
    minWidth: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    paddingHorizontal: 10,
  },
  itemCharacter: {
    fontSize: 20,
    fontWeight: "600",
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonSecondary: {
    flex: 0,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionBadge: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actionBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
});
