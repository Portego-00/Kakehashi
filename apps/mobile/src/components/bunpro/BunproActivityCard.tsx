import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, Layout } from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { getBestContrastTextColor } from "../../utils/subjectColors";

type ActivityPoint = {
  key: string;
  label: string;
};

type ActivityChartPaths = {
  grammarPath: string;
  vocabPath: string;
  grammarAreaPath: string;
  vocabAreaPath: string;
};

type BunproActivityCardProps = {
  panelBackground: string;
  panelBorder: string;
  themeTextColor: string;
  softText: string;
  graphGridColor: string;
  accent: string;
  accentSoft: string;
  compactLayout: boolean;
  activityChartWidth: number;
  activityChartHeight: number;
  activityPoints: ActivityPoint[];
  activityChart: ActivityChartPaths;
  showActivityGrammar: boolean;
  showActivityVocab: boolean;
  onToggleActivityGrammar: () => void;
  onToggleActivityVocab: () => void;
};

export default function BunproActivityCard({
  panelBackground,
  panelBorder,
  themeTextColor,
  softText,
  graphGridColor,
  accent,
  accentSoft,
  compactLayout,
  activityChartWidth,
  activityChartHeight,
  activityPoints,
  activityChart,
  showActivityGrammar,
  showActivityVocab,
  onToggleActivityGrammar,
  onToggleActivityVocab,
}: BunproActivityCardProps) {
  const grammarActiveTextColor = getBestContrastTextColor(accent, "#17171c", "#ffffff");
  const vocabActiveTextColor = getBestContrastTextColor(accentSoft, "#17171c", "#ffffff");

  const chartLayoutTransition = useMemo(
    () => Layout.duration(280).easing(Easing.out(Easing.cubic)),
    []
  );

  const chartAnimationKey = useMemo(
    () =>
      [
        showActivityGrammar ? "g1" : "g0",
        showActivityVocab ? "v1" : "v0",
        activityChart.grammarPath,
        activityChart.vocabPath,
        activityChart.grammarAreaPath,
        activityChart.vocabAreaPath,
      ].join("|"),
    [
      activityChart.grammarAreaPath,
      activityChart.grammarPath,
      activityChart.vocabAreaPath,
      activityChart.vocabPath,
      showActivityGrammar,
      showActivityVocab,
    ]
  );

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: panelBackground, borderColor: panelBorder },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitle,
            compactLayout && styles.sectionTitleCompact,
            { color: themeTextColor },
          ]}
        >
          Activity
        </Text>
        <Text style={[styles.sectionMeta, { color: softText }]}>Last 14 days</Text>
      </View>

      <View style={styles.seriesToggleRow}>
        <View style={styles.seriesToggleMeta}>
          <Ionicons name="settings-outline" size={14} color={softText} />
          <Text style={[styles.sectionMeta, { color: softText }]}>Series</Text>
        </View>
        <View style={styles.seriesToggleButtons}>
          <TouchableOpacity
            style={[
              styles.seriesToggleButton,
              {
                borderColor: accent,
                backgroundColor: showActivityGrammar ? accent : "transparent",
              },
            ]}
            onPress={onToggleActivityGrammar}
          >
            <Text
              style={[
                styles.seriesToggleText,
                { color: showActivityGrammar ? grammarActiveTextColor : accent },
              ]}
            >
              Grammar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.seriesToggleButton,
              {
                borderColor: accentSoft,
                backgroundColor: showActivityVocab ? accentSoft : "transparent",
              },
            ]}
            onPress={onToggleActivityVocab}
          >
            <Text
              style={[
                styles.seriesToggleText,
                { color: showActivityVocab ? vocabActiveTextColor : accentSoft },
              ]}
            >
              Vocab
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showActivityGrammar || showActivityVocab ? (
        <Animated.View
          key={chartAnimationKey}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          layout={chartLayoutTransition}
        >
          <View style={styles.activityChartWrapper}>
            <Svg width={activityChartWidth} height={activityChartHeight}>
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = activityChartHeight - 14 - (activityChartHeight - 22) * ratio;
                return (
                  <Line
                    key={`grid-${ratio}`}
                    x1={0}
                    y1={y}
                    x2={activityChartWidth}
                    y2={y}
                    stroke={graphGridColor}
                    strokeWidth={1}
                  />
                );
              })}

              {showActivityGrammar && activityChart.grammarAreaPath ? (
                <Path d={activityChart.grammarAreaPath} fill={"rgba(219, 100, 102, 0.24)"} />
              ) : null}

              {showActivityVocab && activityChart.vocabAreaPath ? (
                <Path d={activityChart.vocabAreaPath} fill={"rgba(216, 188, 188, 0.2)"} />
              ) : null}

              {showActivityGrammar && activityChart.grammarPath ? (
                <Path
                  d={activityChart.grammarPath}
                  stroke={accent}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {showActivityVocab && activityChart.vocabPath ? (
                <Path
                  d={activityChart.vocabPath}
                  stroke={accentSoft}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>

          <View style={styles.activityLabelsRow}>
            {activityPoints.map((point) => (
              <Text key={point.key} style={[styles.activityDayLabel, { color: softText }]}>
                {point.label}
              </Text>
            ))}
          </View>

          <View style={styles.legendRow}>
            {showActivityGrammar ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: accent }]} />
                <Text style={[styles.legendLabel, { color: softText }]}>Grammar</Text>
              </View>
            ) : null}

            {showActivityVocab ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: accentSoft }]} />
                <Text style={[styles.legendLabel, { color: softText }]}>Vocab</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : (
        <Animated.Text
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.emptyLabel, { color: softText }]}
        >
          Enable at least one series to view activity.
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  sectionTitleCompact: {
    fontSize: 16,
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "500",
  },
  seriesToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  seriesToggleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seriesToggleButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seriesToggleButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seriesToggleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activityChartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  activityLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },
  activityDayLabel: {
    fontSize: 9,
    width: 14,
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendSwatch: {
    width: 24,
    height: 7,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyLabel: {
    fontSize: 13,
    marginTop: 4,
  },
});
