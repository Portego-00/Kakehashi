import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getBestContrastTextColor } from "../../utils/subjectColors";
import BunproTogglePill from "./BunproTogglePill";

type BunproProgressCardProps = {
  panelBackground: string;
  panelBorder: string;
  themeTextColor: string;
  graphGridColor: string;
  isDark: boolean;
  compactLayout: boolean;
  accent: string;
  progressMode: "grammar" | "vocab";
  onSetProgressMode: (mode: "grammar" | "vocab") => void;
  activeSrsBuckets: Record<string, number> | null;
  srsStages: string[];
  stagePalette: string[];
  dimmedStageColor: string;
};

export default function BunproProgressCard({
  panelBackground,
  panelBorder,
  themeTextColor,
  graphGridColor,
  isDark,
  compactLayout,
  accent,
  progressMode,
  onSetProgressMode,
  activeSrsBuckets,
  srsStages,
  stagePalette,
  dimmedStageColor,
}: BunproProgressCardProps) {
  const footerBackground = isDark ? "#7f7f81" : "#d2d2d4";
  const footerTextColor = getBestContrastTextColor(footerBackground, "#1f1f24", "#ffffff");

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
          Progress
        </Text>
        <BunproTogglePill
          leftLabel="Grammar"
          rightLabel="Vocab"
          activeSide={progressMode === "grammar" ? "left" : "right"}
          onLeftPress={() => onSetProgressMode("grammar")}
          onRightPress={() => onSetProgressMode("vocab")}
          accent={accent}
          compactLayout={compactLayout}
        />
      </View>

      <View style={styles.progressGrid}>
        {srsStages.map((stage, index) => {
          const stageCount = activeSrsBuckets?.[stage] ?? 0;
          const isActive = stageCount > 0;
          const stageBackground = isActive ? stagePalette[index] : dimmedStageColor;
          const stageTextColor = getBestContrastTextColor(stageBackground, "#141519", "#ffffff");

          return (
            <View
              key={stage}
              style={[
                styles.progressStageCard,
                {
                  backgroundColor: stageBackground,
                },
              ]}
            >
              <View>
                <Text style={[styles.progressStageLabel, { color: stageTextColor }]}>{stage}</Text>
                <Text style={[styles.progressStageCount, { color: stageTextColor }]}>{stageCount}</Text>
              </View>
              <Ionicons
                name="language-outline"
                size={22}
                color={
                  stageTextColor === "#ffffff"
                    ? isActive
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.5)"
                    : isActive
                    ? "rgba(23,23,27,0.45)"
                    : "rgba(23,23,27,0.25)"
                }
              />
            </View>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: graphGridColor }]} />

      <View style={styles.progressFooterRow}>
        <View
          style={[
            styles.progressFooterCard,
            { backgroundColor: footerBackground },
          ]}
        >
          <Text style={[styles.progressFooterTitle, { color: footerTextColor }]}>Ghosts</Text>
          <Text style={[styles.progressFooterCount, { color: footerTextColor }]}>
            {activeSrsBuckets?.ghost ?? 0}
          </Text>
        </View>
        <View
          style={[
            styles.progressFooterCard,
            { backgroundColor: footerBackground },
          ]}
        >
          <Text style={[styles.progressFooterTitle, { color: footerTextColor }]}>Self-Study</Text>
          <Text style={[styles.progressFooterCount, { color: footerTextColor }]}>
            {activeSrsBuckets?.self_study ?? 0}
          </Text>
        </View>
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
  progressGrid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  progressStageCard: {
    width: "48.5%",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStageLabel: {
    textTransform: "capitalize",
    fontSize: 12,
  },
  progressStageCount: {
    marginTop: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  divider: {
    marginTop: 4,
    height: 1,
  },
  progressFooterRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 10,
  },
  progressFooterCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  progressFooterTitle: {
    fontSize: 12,
  },
  progressFooterCount: {
    fontSize: 17,
    fontWeight: "800",
  },
});
