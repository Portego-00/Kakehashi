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
import SrsLevelIcon from "../../src/components/SrsLevelIcon";
import SubjectListsFilterCard from "../../src/components/SubjectListsFilterCard";
import {
  EXTRA_STUDY_CONFIG_STORAGE_KEYS,
  clampNumber,
  loadExtraStudyConfig,
  normalizeLevelRange,
  pickBoolean,
  saveExtraStudyConfig,
} from "../../src/utils/extraStudyConfigPersistence";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  hasExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type CrosswordSizeId = "small" | "medium" | "large";
type CrosswordClueDisplayMode = "english" | "kanji" | "english_kanji";

interface CrosswordSizePreset {
  id: CrosswordSizeId;
  label: string;
  description: string;
  gridSize: number;
  defaultMaxWords: number;
  minWords: number;
  maxWords: number;
}

const SIZE_PRESETS: CrosswordSizePreset[] = [
  {
    id: "small",
    label: "Small",
    description: "Fits on screen, quick to solve",
    gridSize: 9,
    defaultMaxWords: 6,
    minWords: 4,
    maxWords: 10,
  },
  {
    id: "medium",
    label: "Medium",
    description: "A balanced challenge",
    gridSize: 13,
    defaultMaxWords: 10,
    minWords: 6,
    maxWords: 16,
  },
  {
    id: "large",
    label: "Large",
    description: "More words, more crossings",
    gridSize: 17,
    defaultMaxWords: 16,
    minWords: 10,
    maxWords: 24,
  },
];

interface CrosswordConfig {
  size: CrosswordSizeId;
  maxWords: number;
  srsGroups: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
  hiraganaOnly: boolean;
  clueDisplayMode: CrosswordClueDisplayMode;
  playAudioOnCorrectAnswer: boolean;
}

const createDefaultConfig = (userLevel: number): CrosswordConfig => ({
  size: "medium",
  maxWords: SIZE_PRESETS.find((preset) => preset.id === "medium")!
    .defaultMaxWords,
  srsGroups: {
    apprentice: true,
    guru: true,
    master: true,
    enlightened: true,
    burned: true,
  },
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: userLevel,
  selectedListIds: [],
  hiraganaOnly: false,
  clueDisplayMode: "english",
  playAudioOnCorrectAnswer: true,
});

const sanitizeConfig = (
  rawConfig: Partial<CrosswordConfig>,
  userLevel: number
): CrosswordConfig => {
  const defaults = createDefaultConfig(userLevel);
  const sizeId =
    rawConfig.size && SIZE_PRESETS.some((preset) => preset.id === rawConfig.size)
      ? (rawConfig.size as CrosswordSizeId)
      : defaults.size;
  const preset = SIZE_PRESETS.find((p) => p.id === sizeId)!;
  const srsGroups = rawConfig.srsGroups ?? defaults.srsGroups;
  const { minLevel, maxLevel } = normalizeLevelRange(
    rawConfig.minLevel,
    rawConfig.maxLevel,
    userLevel
  );

  return {
    size: sizeId,
    maxWords: clampNumber(
      rawConfig.maxWords,
      preset.minWords,
      preset.maxWords,
      preset.defaultMaxWords,
      1
    ),
    srsGroups: {
      apprentice: pickBoolean(
        srsGroups.apprentice,
        defaults.srsGroups.apprentice
      ),
      guru: pickBoolean(srsGroups.guru, defaults.srsGroups.guru),
      master: pickBoolean(srsGroups.master, defaults.srsGroups.master),
      enlightened: pickBoolean(
        srsGroups.enlightened,
        defaults.srsGroups.enlightened
      ),
      burned: pickBoolean(srsGroups.burned, defaults.srsGroups.burned),
    },
    useCustomLevelRange: pickBoolean(
      rawConfig.useCustomLevelRange,
      defaults.useCustomLevelRange
    ),
    minLevel,
    maxLevel,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
    hiraganaOnly: pickBoolean(rawConfig.hiraganaOnly, defaults.hiraganaOnly),
    clueDisplayMode:
      rawConfig.clueDisplayMode === "kanji" ||
      rawConfig.clueDisplayMode === "english_kanji"
        ? rawConfig.clueDisplayMode
        : "english",
    playAudioOnCorrectAnswer: pickBoolean(
      rawConfig.playAudioOnCorrectAnswer,
      defaults.playAudioOnCorrectAnswer
    ),
  };
};

export default function CrosswordConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const userLevel = userData?.level ?? 60;

  const [config, setConfig] = useState<CrosswordConfig>(() =>
    createDefaultConfig(userLevel)
  );
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const hasCheckedForResumableSessionRef = useRef(false);

  const updateConfig = <K extends keyof CrosswordConfig>(
    key: K,
    value: CrosswordConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const currentPreset = useMemo(
    () => SIZE_PRESETS.find((preset) => preset.id === config.size)!,
    [config.size]
  );

  const canStart = () => {
    return (
      config.srsGroups.apprentice ||
      config.srsGroups.guru ||
      config.srsGroups.master ||
      config.srsGroups.enlightened ||
      config.srsGroups.burned
    );
  };

  const start = async () => {
    if (!canStart()) {
      Alert.alert(
        "Pick at least one SRS stage",
        "Choose at least one SRS stage to draw vocabulary from."
      );
      return;
    }

    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CROSSWORD
    );

    try {
      const sessionId = `xw_${Date.now()}`;
      await AsyncStorage.setItem(
        `crossword_config_${sessionId}`,
        JSON.stringify(config)
      );
      router.push({
        pathname: "/crossword-session",
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save crossword config:", error);
      router.push({
        pathname: "/crossword-session",
        params: {
          size: config.size,
          maxWords: String(config.maxWords),
          srsApprentice: String(config.srsGroups.apprentice),
          srsGuru: String(config.srsGroups.guru),
          srsMaster: String(config.srsGroups.master),
          srsEnlightened: String(config.srsGroups.enlightened),
          srsBurned: String(config.srsGroups.burned),
          useCustomLevelRange: String(config.useCustomLevelRange),
          minLevel: String(config.minLevel),
          maxLevel: String(config.maxLevel),
          selectedListIds: config.selectedListIds.join(","),
          hiraganaOnly: String(config.hiraganaOnly),
          clueDisplayMode: config.clueDisplayMode,
          playAudioOnCorrectAnswer: String(config.playAudioOnCorrectAnswer),
        },
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<CrosswordConfig>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.CROSSWORD
      );
      if (!isMounted) return;
      if (stored) {
        setConfig(sanitizeConfig(stored, initialUserLevelRef.current));
      }
      setIsConfigHydrated(true);
    };
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasCheckedForResumableSessionRef.current) return;
    hasCheckedForResumableSessionRef.current = true;

    let isMounted = true;
    const checkForSavedSession = async () => {
      const hasSavedSession = await hasExtraStudySessionState(
        EXTRA_STUDY_SESSION_STORAGE_KEYS.CROSSWORD
      );
      if (!hasSavedSession || !isMounted) return;

      Alert.alert("Resume Crossword?", "You have a crossword in progress.", [
        { text: "Not Now", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearExtraStudySessionState(
              EXTRA_STUDY_SESSION_STORAGE_KEYS.CROSSWORD
            );
          },
        },
        {
          text: "Resume",
          onPress: () => {
            router.push({
              pathname: "/crossword-session",
              params: { resume: "true" },
            });
          },
        },
      ]);
    };
    void checkForSavedSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setConfig((prev) => sanitizeConfig(prev, userLevel));
  }, [userLevel]);

  useEffect(() => {
    if (!isConfigHydrated) return;
    saveExtraStudyConfig(EXTRA_STUDY_CONFIG_STORAGE_KEYS.CROSSWORD, config);
  }, [config, isConfigHydrated]);

  const srsChips = useMemo(
    () =>
      [
        { key: "apprentice", label: "Apprentice" },
        { key: "guru", label: "Guru" },
        { key: "master", label: "Master" },
        { key: "enlightened", label: "Enlightened" },
        { key: "burned", label: "Burned" },
      ] as const,
    []
  );

  const clueDisplayOptions = useMemo(
    () =>
      [
        {
          value: "english",
          label: "English",
          description: "Meaning clues in English",
        },
        {
          value: "kanji",
          label: "Kanji",
          description: "Character form when available",
        },
        {
          value: "english_kanji",
          label: "English + Kanji",
          description: "Both clue styles together",
        },
      ] as const,
    []
  );

  const expandAnim = useRef(
    new Animated.Value(config.useCustomLevelRange ? 1 : 0)
  ).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, expandAnim]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[styles.header, { backgroundColor: theme.backgroundColor }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Crossword
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Crossword Size
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.textSecondary },
            ]}
          >
            Bigger grids fit more crossings but take longer to fill.
          </Text>
          <View style={styles.sizeOptions}>
            {SIZE_PRESETS.map((preset) => {
              const selected = preset.id === config.size;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.sizeOption,
                    selected
                      ? {
                          backgroundColor: `${theme.primary}22`,
                          borderColor: theme.primary,
                        }
                      : {
                          backgroundColor: theme.isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.03)",
                          borderColor: theme.border,
                        },
                  ]}
                  onPress={() => {
                    setConfig((prev) => ({
                      ...prev,
                      size: preset.id,
                      maxWords: preset.defaultMaxWords,
                    }));
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sizeOptionLabel,
                      { color: selected ? theme.primary : theme.textColor },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[
                      styles.sizeOptionDetail,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {preset.gridSize}×{preset.gridSize}
                  </Text>
                  <Text
                    style={[
                      styles.sizeOptionDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {preset.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Number of Words
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>
              {config.maxWords}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={currentPreset.minWords}
              maximumValue={currentPreset.maxWords}
              step={1}
              value={config.maxWords}
              onValueChange={(v) => updateConfig("maxWords", Math.round(v))}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </View>
          <Text
            style={[styles.helperText, { color: theme.textSecondary }]}
          >
            Generation may place fewer words if no compatible crossings exist.
          </Text>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Include SRS Stages
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.textSecondary },
            ]}
          >
            Choose which progression stages to draw vocabulary from
          </Text>
          <View style={styles.chipsContainer}>
            {srsChips.map(({ key, label }) => {
              const selected = (config.srsGroups as Record<string, boolean>)[
                key
              ];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    selected
                      ? {
                          backgroundColor: `${theme.primary}22`,
                          borderColor: theme.primary,
                        }
                      : {
                          backgroundColor: theme.isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.03)",
                          borderColor: theme.border,
                        },
                  ]}
                  onPress={() =>
                    setConfig((prev) => ({
                      ...prev,
                      srsGroups: {
                        ...prev.srsGroups,
                        [key]: !prev.srsGroups[
                          key as keyof typeof prev.srsGroups
                        ],
                      },
                    }))
                  }
                  activeOpacity={0.7}
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
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Levels
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.textSecondary },
            ]}
          >
            By default includes levels 1 to your level ({userLevel}). Enable a
            custom range to restrict.
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.useCustomLevelRange
                  ? theme.secondary
                  : theme.border,
                backgroundColor: config.useCustomLevelRange
                  ? `${theme.secondary}15`
                  : "transparent",
              },
            ]}
          >
            <Text style={[styles.toggleText, { color: theme.textColor }]}>
              Use custom level range
            </Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={config.useCustomLevelRange}
              onValueChange={(v) => updateConfig("useCustomLevelRange", v)}
              trackColor={{ false: "#767577", true: theme.secondary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <Animated.View
            style={{
              overflow: "hidden",
              height: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 140],
              }),
              opacity: expandAnim,
            }}
          >
            <View>
              <View style={styles.levelSliderRow}>
                <Text
                  style={[styles.levelLabel, { color: theme.textSecondary }]}
                >
                  Min Level
                </Text>
                <Text
                  style={[styles.levelValue, { color: theme.textColor }]}
                >
                  {config.minLevel}
                </Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.minLevel}
                onValueChange={(v) => {
                  const value = Math.min(Math.round(v), config.maxLevel);
                  updateConfig("minLevel", value);
                }}
                minimumTrackTintColor={theme.secondary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.secondary}
              />
              <View style={[styles.levelSliderRow, { marginTop: 12 }]}>
                <Text
                  style={[styles.levelLabel, { color: theme.textSecondary }]}
                >
                  Max Level
                </Text>
                <Text
                  style={[styles.levelValue, { color: theme.textColor }]}
                >
                  {config.maxLevel}
                </Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.maxLevel}
                onValueChange={(v) => {
                  const value = Math.max(Math.round(v), config.minLevel);
                  updateConfig("maxLevel", value);
                }}
                minimumTrackTintColor={theme.secondary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.secondary}
              />
            </View>
          </Animated.View>

          {!config.useCustomLevelRange && (
            <View style={styles.levelSummaryRow}>
              <Ionicons
                name="stats-chart"
                size={16}
                color={theme.textSecondary}
              />
              <Text
                style={[
                  styles.levelSummaryText,
                  { color: theme.textSecondary },
                ]}
              >
                Levels 1 - {userLevel}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Vocabulary Filter
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.hiraganaOnly
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.hiraganaOnly
                  ? `${theme.primary}15`
                  : "transparent",
                marginBottom: 0,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleText, { color: theme.textColor }]}>
                Hiragana-only words
              </Text>
              <Text
                style={[
                  styles.helperText,
                  { color: theme.textSecondary, marginTop: 2 },
                ]}
              >
                Skip vocab that contains kanji or katakana
              </Text>
            </View>
            <Switch
              value={config.hiraganaOnly}
              onValueChange={(v) => updateConfig("hiraganaOnly", v)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Clue Language
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.textSecondary },
            ]}
          >
            Pick how clues are shown before and during the puzzle.
          </Text>
          <View style={styles.chipsContainer}>
            {clueDisplayOptions.map((option) => {
              const selected = config.clueDisplayMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.chip,
                    selected
                      ? {
                          backgroundColor: `${theme.primary}22`,
                          borderColor: theme.primary,
                        }
                      : {
                          backgroundColor: theme.isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.03)",
                          borderColor: theme.border,
                        },
                  ]}
                  onPress={() => updateConfig("clueDisplayMode", option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? theme.primary : theme.textColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Audio Reinforcement
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.textSecondary },
            ]}
          >
            Hear solved words to reinforce recall.
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.playAudioOnCorrectAnswer
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.playAudioOnCorrectAnswer
                  ? `${theme.primary}15`
                  : "transparent",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleText, { color: theme.textColor }]}>
                Play audio on correct answers
              </Text>
              <Text
                style={[
                  styles.helperText,
                  { color: theme.textSecondary, marginTop: 2 },
                ]}
              >
                Read the solved word aloud when you get it right
              </Text>
            </View>
            <Switch
              value={config.playAudioOnCorrectAnswer}
              onValueChange={(v) => updateConfig("playAudioOnCorrectAnswer", v)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={["vocabulary", "kana_vocabulary"]}
          description="Optional: only include vocabulary from these saved lists."
        />

        <View style={{ height: 80 }} />
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          { backgroundColor: theme.cardBackground, shadowColor: "#000" },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.startButton,
            {
              backgroundColor: canStart() ? theme.primary : theme.border,
              opacity: canStart() ? 1 : 0.7,
            },
          ]}
          onPress={start}
          disabled={!canStart()}
          activeOpacity={0.8}
        >
          <Ionicons
            name="grid"
            size={24}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.startButtonText}>Start Crossword</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", marginLeft: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  sectionDescription: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  helperText: { fontSize: 12, marginTop: 8 },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderCount: {
    width: 52,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 40,
  },
  sizeOptions: {
    flexDirection: "row",
    gap: 8,
  },
  sizeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  sizeOptionLabel: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  sizeOptionDetail: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  sizeOptionDescription: { fontSize: 12, lineHeight: 16 },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleText: { fontSize: 14, fontWeight: "600" },
  levelSliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelLabel: { fontSize: 14 },
  levelValue: { fontSize: 16, fontWeight: "600" },
  levelSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelSummaryText: { fontSize: 14 },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  startButtonText: { color: "white", fontSize: 18, fontWeight: "600" },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  restrictedWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  restrictedSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
