import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Assignment, Subject } from "../utils/api";
import {
  LevelProgress,
  getIncompletePreviousLevels,
} from "../utils/levelProgress";
import { useSubjectColors } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

interface IncompleteLevelsProgressProps {
  subjects: Subject[];
  assignments: Assignment[];
  currentLevel: number;
}

function SubjectStat({
  type,
  guru,
  total,
}: {
  type: "radical" | "kanji" | "vocabulary";
  guru: number;
  total: number;
}) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const color =
    type === "radical"
      ? subjectColors.radical
      : type === "kanji"
      ? subjectColors.kanji
      : subjectColors.vocabulary;
  const percent = total > 0 ? (guru / total) * 100 : 0;

  return (
    <View style={[styles.statPill, { backgroundColor: theme.cardBackground }]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <View style={styles.statContent}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Text>
        <Text style={[styles.statValue, { color: theme.textColor }]}>
          {guru}/{total}
        </Text>
        {/* Mini progress bar at the bottom */}
        <View style={styles.miniProgressTrack}>
          <View
            style={[
              styles.miniProgressFill,
              { width: `${percent}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function CompactLevelCard({
  levelData,
  isCurrent = false,
}: {
  levelData: LevelProgress;
  isCurrent?: boolean;
}) {
  const { theme } = useTheme();

  const handlePress = () => {
    router.push(`/level-progress/${levelData.level}`);
  };

  return (
    <TouchableOpacity
      style={[
        styles.compactCard, 
        {
          backgroundColor: theme.cardBackground,
          borderColor: isCurrent ? theme.primary : "transparent",
          borderWidth: isCurrent ? 1 : 0,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Left: Level Indicator */}
      <View style={styles.cardLeft}>
        <View
          style={[
            styles.levelBadge,
            {
              backgroundColor: isCurrent
                ? theme.primary
                : theme.isDark
                ? "#333"
                : "#e0e0e0",
            },
          ]}
        >
          <Text
            style={[
              styles.levelNumber,
              { color: isCurrent ? "#fff" : theme.textColor },
            ]}
          >
            {levelData.level}
          </Text>
        </View>
      </View>

      {/* Middle: Stats Grid */}
      <View style={styles.cardMiddle}>
        <View style={styles.statsRow}>
          <SubjectStat
            type="radical"
            guru={levelData.radical.guru}
            total={levelData.radical.total}
          />
          <SubjectStat
            type="kanji"
            guru={levelData.kanji.guru}
            total={levelData.kanji.total}
          />
          <SubjectStat
            type="vocabulary"
            guru={levelData.vocabulary.guru}
            total={levelData.vocabulary.total}
          />
        </View>
      </View>

      {/* Right: Chevron */}
      <View style={styles.cardRight}>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function IncompleteLevelsProgress({
  subjects,
  assignments,
  currentLevel,
}: IncompleteLevelsProgressProps) {
  const { theme } = useTheme();
  const [levelProgressData, setLevelProgressData] = useState<LevelProgress[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateLevelProgress = async () => {
      setIsLoading(true);
      try {
        const levels = getIncompletePreviousLevels(
          subjects,
          assignments,
          currentLevel
        );
        setLevelProgressData(levels);
      } catch (error) {
        console.error("Error calculating level progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (subjects.length > 0 && assignments.length > 0) {
      calculateLevelProgress();
    } else {
      setIsLoading(false);
    }
  }, [subjects, assignments, currentLevel]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.secondary} />
      </View>
    );
  }

  if (levelProgressData.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: theme.cardBackground },
        ]}
      >
        <Ionicons name="checkmark-circle" size={48} color="#38a169" />
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
          All Previous Levels Complete!
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          You&apos;ve reached Guru+ on all subjects from previous levels.
        </Text>
      </View>
    );
  }

  const currentLevelData = levelProgressData.find(
    (level) => level.level === currentLevel
  );
  const incompletePreviousLevels = levelProgressData
    .filter((level) => level.level < currentLevel)
    .sort((a, b) => b.level - a.level);

  return (
    <View style={styles.container}>
      {/* Current Level Section */}
      {currentLevelData && (
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            CURRENT LEVEL
          </Text>
          <CompactLevelCard levelData={currentLevelData} isCurrent={true} />
        </View>
      )}

      {/* Previous Levels - Compact List */}
      {incompletePreviousLevels.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            PREVIOUS LEVELS
          </Text>
          {incompletePreviousLevels.map((levelData) => (
            <CompactLevelCard key={levelData.level} levelData={levelData} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    padding: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: "center",
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    marginRight: 12,
  },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNumber: {
    fontSize: 16,
    fontWeight: "bold",
  },

  cardMiddle: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingRight: 8,
  },
  cardRight: {
    paddingLeft: 4,
    justifyContent: "center",
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statDot: {
    width: 3,
    height: "100%",
    borderRadius: 1.5,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 1,
    opacity: 0.8,
  },
  statValue: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 3,
  },
  miniProgressTrack: {
    height: 3,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 1.5,
    overflow: "hidden",
    width: "100%",
  },
  miniProgressFill: {
    height: "100%",
    borderRadius: 1.5,
  },
});
