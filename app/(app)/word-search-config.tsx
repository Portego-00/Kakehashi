import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SrsLevelIcon from "../../src/components/SrsLevelIcon";
import SubjectListsFilterCard from "../../src/components/SubjectListsFilterCard";
import {
  EXTRA_STUDY_CONFIG_STORAGE_KEYS,
  loadExtraStudyConfig,
  saveExtraStudyConfig,
} from "../../src/utils/extraStudyConfigPersistence";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  hasExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import {
  WORD_SEARCH_WORD_COUNTS,
  createDefaultWordSearchConfig,
  getWordSearchAllowedSrsStages,
  sanitizeWordSearchConfig,
  type WordSearchConfig,
} from "../../src/utils/wordSearchConfig";

const SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.WORD_SEARCH;

const DIRECTIONS = [
  {
    id: "kanji-to-kana" as const,
    title: "Find kana",
    example: "日本  →  にほん",
    description: "Read a kanji clue, then find its reading.",
  },
  {
    id: "kana-to-kanji" as const,
    title: "Find kanji",
    example: "にほん  →  日本",
    description: "Read a kana clue, then find the written word.",
  },
];

const WORD_COUNT_LABELS = {
  6: "Quick",
  8: "Standard",
  10: "Challenge",
} as const;

function WordSearchConfigContent() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const userLevel = useAuthStore((state) => state.userData?.level ?? 60);
  const [config, setConfig] = useState<WordSearchConfig>(() =>
    createDefaultWordSearchConfig(userLevel),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const checkedResumeRef = useRef(false);

  const updateConfig = <K extends keyof WordSearchConfig>(
    key: K,
    value: WordSearchConfig[K],
  ) => setConfig((current) => ({ ...current, [key]: value }));

  const allowedStageCount = useMemo(
    () => getWordSearchAllowedSrsStages(config).size,
    [config],
  );
  const canStart = allowedStageCount > 0;
  const levelExpandAnim = useRef(
    new Animated.Value(config.useCustomLevelRange ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(levelExpandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, levelExpandAnim]);

  useEffect(() => {
    let mounted = true;
    void loadExtraStudyConfig<WordSearchConfig>(
      EXTRA_STUDY_CONFIG_STORAGE_KEYS.WORD_SEARCH,
    ).then((saved) => {
      if (!mounted) {
        return;
      }
      if (saved) {
        setConfig(
          sanitizeWordSearchConfig(saved, initialUserLevelRef.current),
        );
      }
      setIsHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    void saveExtraStudyConfig(
      EXTRA_STUDY_CONFIG_STORAGE_KEYS.WORD_SEARCH,
      config,
    );
  }, [config, isHydrated]);

  useEffect(() => {
    setConfig((current) => sanitizeWordSearchConfig(current, userLevel));
  }, [userLevel]);

  useEffect(() => {
    if (checkedResumeRef.current) {
      return;
    }
    checkedResumeRef.current = true;
    let mounted = true;
    void hasExtraStudySessionState(SESSION_KEY).then((hasSavedSession) => {
      if (!mounted || !hasSavedSession) {
        return;
      }
      Alert.alert("Resume Word Search?", "You have a puzzle in progress.", [
        { text: "Not Now", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => void clearExtraStudySessionState(SESSION_KEY),
        },
        {
          text: "Resume",
          onPress: () =>
            router.push({
              pathname: "/word-search-session" as any,
              params: { resume: "true" },
            }),
        },
      ]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const startPuzzle = async () => {
    if (!canStart) {
      Alert.alert(
        "Pick an SRS stage",
        "Choose at least one stage to build a puzzle from.",
      );
      return;
    }
    await clearExtraStudySessionState(SESSION_KEY);
    const sessionId = `word_search_${Date.now()}`;
    try {
      await AsyncStorage.setItem(
        `word_search_config_${sessionId}`,
        JSON.stringify(config),
      );
      router.push({
        pathname: "/word-search-session" as any,
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save Word Search config", error);
      Alert.alert("Couldn't Start", "Please try building the puzzle again.");
    }
  };

  const srsOptions = [
    { key: "apprentice", label: "Apprentice" },
    { key: "guru", label: "Guru" },
    { key: "master", label: "Master" },
    { key: "enlightened", label: "Enlightened" },
    { key: "burned", label: "Burned" },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundColor,
            paddingTop: Math.max(20, insets.top),
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Word Search
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              boxShadow: theme.isDark
                ? "0 2px 4px rgba(0,0,0,0.24)"
                : "0 2px 4px rgba(0,0,0,0.08)",
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Study Direction
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Choose which Japanese form appears as the clue.
          </Text>
          <View style={styles.directionList}>
            {DIRECTIONS.map((direction) => {
              const selected = config.direction === direction.id;
              return (
                <TouchableOpacity
                  key={direction.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => updateConfig("direction", direction.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.directionOption,
                    {
                      backgroundColor: selected
                        ? `${theme.primary}20`
                        : theme.isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={styles.directionCopy}>
                    <View style={styles.directionHeader}>
                      <Text
                        style={[
                          styles.directionTitle,
                          { color: selected ? theme.primary : theme.textColor },
                        ]}
                      >
                        {direction.title}
                      </Text>
                      <Text
                        style={[styles.example, { color: theme.textSecondary }]}
                      >
                        {direction.example}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {direction.description}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={21}
                    color={selected ? theme.primary : theme.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              boxShadow: theme.isDark
                ? "0 2px 4px rgba(0,0,0,0.24)"
                : "0 2px 4px rgba(0,0,0,0.08)",
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Puzzle Length
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Pick how many words to hide in the grid.
          </Text>
          <View style={styles.countOptions}>
            {WORD_SEARCH_WORD_COUNTS.map((count) => {
              const selected = config.wordCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => updateConfig("wordCount", count)}
                  activeOpacity={0.8}
                  style={[
                    styles.countOption,
                    {
                      backgroundColor: selected
                        ? `${theme.primary}20`
                        : theme.isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countLabel,
                      { color: selected ? theme.primary : theme.textColor },
                    ]}
                  >
                    {WORD_COUNT_LABELS[count]}
                  </Text>
                  <Text
                    style={[styles.countValue, { color: theme.textSecondary }]}
                  >
                    {count} words
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              boxShadow: theme.isDark
                ? "0 2px 4px rgba(0,0,0,0.24)"
                : "0 2px 4px rgba(0,0,0,0.08)",
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Include SRS Stages
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Pick which progression stages feed the puzzle pool.
          </Text>
          <View style={styles.chips}>
            {srsOptions.map(({ key, label }) => {
              const selected = config.srsGroups[key];
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setConfig((current) => ({
                      ...current,
                      srsGroups: {
                        ...current.srsGroups,
                        [key]: !current.srsGroups[key],
                      },
                    }))
                  }
                  activeOpacity={0.8}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? `${theme.primary}20`
                        : theme.backgroundColor,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <SrsLevelIcon
                    level={label}
                    size={16}
                    color={selected ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? theme.primary : theme.textColor },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              boxShadow: theme.isDark
                ? "0 2px 4px rgba(0,0,0,0.24)"
                : "0 2px 4px rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View style={styles.levelHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Level Range
            </Text>
            <Switch
              value={config.useCustomLevelRange}
              onValueChange={(value) =>
                updateConfig("useCustomLevelRange", value)
              }
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            {config.useCustomLevelRange
              ? `Using levels ${config.minLevel} to ${config.maxLevel}`
              : config.selectedListIds.length > 0
                ? "Using all levels in selected lists"
                : `Using levels 1 to your level (${userLevel})`}
          </Text>

          <Animated.View
            style={{
              overflow: "hidden",
              maxHeight: levelExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 220],
              }),
              opacity: levelExpandAnim,
            }}
          >
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: theme.textColor }]}>
                Min
              </Text>
              <Text style={[styles.sliderValue, { color: theme.textColor }]}>
                {config.minLevel}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={userLevel}
              step={1}
              value={config.minLevel}
              onValueChange={(value) =>
                updateConfig(
                  "minLevel",
                  Math.min(Math.round(value), config.maxLevel),
                )
              }
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />

            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: theme.textColor }]}>
                Max
              </Text>
              <Text style={[styles.sliderValue, { color: theme.textColor }]}>
                {config.maxLevel}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={userLevel}
              step={1}
              value={config.maxLevel}
              onValueChange={(value) =>
                updateConfig(
                  "maxLevel",
                  Math.max(Math.round(value), config.minLevel),
                )
              }
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </Animated.View>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={["vocabulary"]}
          description="Optional: only include words from these saved lists."
        />

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
            paddingBottom: Math.max(18, insets.bottom),
            boxShadow: theme.isDark
              ? "0 -2px 8px rgba(0,0,0,0.30)"
              : "0 -2px 8px rgba(0,0,0,0.10)",
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start Word Search"
          disabled={!canStart}
          onPress={() => void startPuzzle()}
          activeOpacity={0.8}
          style={[
            styles.startButton,
            {
              backgroundColor: canStart ? theme.primary : theme.border,
              opacity: canStart ? 1 : 0.7,
            },
          ]}
        >
          <Ionicons name="search" size={22} color="#FFFFFF" />
          <Text style={styles.startButtonText}>Start Word Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function WordSearchConfigScreen() {
  return <WordSearchConfigContent />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", marginLeft: 12 },
  backButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: {
    borderCurve: "continuous",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  sectionDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  directionList: { gap: 10 },
  directionOption: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 82,
    padding: 12,
  },
  directionCopy: { flex: 1, gap: 4 },
  directionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  directionTitle: { fontSize: 15, fontWeight: "700" },
  example: { fontFamily: "SourceHanSansJP-Bold", fontSize: 14 },
  optionDescription: { fontSize: 13, lineHeight: 18 },
  countOptions: { flexDirection: "row", gap: 8 },
  countOption: {
    borderCurve: "continuous",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 66,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  countValue: { fontSize: 12, fontVariant: ["tabular-nums"] },
  countLabel: { fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  levelHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sliderLabel: { fontSize: 14, fontWeight: "600" },
  sliderValue: { fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "700" },
  slider: { height: 40, width: "100%" },
  footerSpacer: { height: 80 },
  stickyFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  startButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
