import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, Layout } from "react-native-reanimated";
import BunproTogglePill from "./BunproTogglePill";

type JlptRow = {
  level: "5" | "4" | "3" | "2" | "1";
  started: number;
  row: {
    beginner: number;
    adept: number;
    seasoned: number;
    expert: number;
    master: number;
    total_count: number;
  };
};

type BunproJlptProgressCardProps = {
  panelBackground: string;
  panelBorder: string;
  themeTextColor: string;
  softText: string;
  compactLayout: boolean;
  accent: string;
  isDark: boolean;
  jlptMode: "grammar" | "vocab";
  onSetJlptMode: (mode: "grammar" | "vocab") => void;
  jlptRows: JlptRow[];
  stagePalette: string[];
  srsStages: string[];
};

export default function BunproJlptProgressCard({
  panelBackground,
  panelBorder,
  themeTextColor,
  softText,
  compactLayout,
  accent,
  isDark,
  jlptMode,
  onSetJlptMode,
  jlptRows,
  stagePalette,
  srsStages,
}: BunproJlptProgressCardProps) {
  const segmentLayoutTransition = React.useMemo(
    () => Layout.duration(340).easing(Easing.out(Easing.cubic)),
    []
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
          JLPT Progress
        </Text>
        <BunproTogglePill
          leftLabel="Grammar"
          rightLabel="Vocab"
          activeSide={jlptMode === "grammar" ? "left" : "right"}
          onLeftPress={() => onSetJlptMode("grammar")}
          onRightPress={() => onSetJlptMode("vocab")}
          accent={accent}
          compactLayout={compactLayout}
          size="compact"
        />
      </View>

      <View style={styles.jlptRowsContainer}>
        {jlptRows.map((entry) => {
          const total = Math.max(1, entry.row.total_count);
          const stageCounts = [
            entry.row.beginner,
            entry.row.adept,
            entry.row.seasoned,
            entry.row.expert,
            entry.row.master,
          ];

          return (
            <View key={entry.level} style={styles.jlptRow}>
              <Text style={[styles.jlptLevelLabel, { color: themeTextColor }]}>
                N{entry.level}
              </Text>
              <View
                style={[
                  styles.jlptTrack,
                  { backgroundColor: isDark ? "#111318" : "#edf0f4" },
                ]}
              >
                <View style={styles.jlptSegmentsRow}>
                  {stageCounts.map((count, index) => (
                    <Animated.View
                      key={`segment-${entry.level}-${srsStages[index]}`}
                      layout={segmentLayoutTransition}
                      style={{
                        width: `${(count / total) * 100}%`,
                        backgroundColor: stagePalette[index],
                        height: "100%",
                      }}
                    />
                  ))}
                </View>
              </View>
              <Text style={[styles.jlptCountLabel, { color: softText }]}>
                {entry.started}/{entry.row.total_count}
              </Text>
            </View>
          );
        })}
      </View>
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
  jlptRowsContainer: {
    marginTop: 4,
    gap: 8,
  },
  jlptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  jlptLevelLabel: {
    width: 26,
    fontSize: 14,
    fontWeight: "700",
  },
  jlptTrack: {
    flex: 1,
    borderRadius: 6,
    height: 16,
    overflow: "hidden",
  },
  jlptSegmentsRow: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
  },
  jlptCountLabel: {
    minWidth: 52,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "600",
  },
});
