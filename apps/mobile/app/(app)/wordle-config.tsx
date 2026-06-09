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
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface WordleConfig {
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  wordLength: number;
  maxAttempts: number;
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
}

const WORD_LENGTH_OPTIONS = [3, 4, 5, 6, 7] as const;
const WORDLE_SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.WORDLE;

const createDefaultConfig = (userLevel: number): WordleConfig => ({
  includeVocabulary: true,
  includeKanaVocabulary: true,
  wordLength: 5,
  maxAttempts: 6,
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
});

const sanitizeConfig = (
  rawConfig: Partial<WordleConfig>,
  userLevel: number,
): WordleConfig => {
  const defaults = createDefaultConfig(userLevel);
  const srsGroups = rawConfig.srsGroups ?? defaults.srsGroups;
  const { minLevel, maxLevel } = normalizeLevelRange(
    rawConfig.minLevel,
    rawConfig.maxLevel,
    userLevel,
  );

  return {
    includeVocabulary: pickBoolean(
      rawConfig.includeVocabulary,
      defaults.includeVocabulary,
    ),
    includeKanaVocabulary: pickBoolean(
      rawConfig.includeKanaVocabulary,
      defaults.includeKanaVocabulary,
    ),
    wordLength: clampNumber(
      rawConfig.wordLength,
      WORD_LENGTH_OPTIONS[0],
      WORD_LENGTH_OPTIONS[WORD_LENGTH_OPTIONS.length - 1],
      defaults.wordLength,
      1,
    ),
    maxAttempts: clampNumber(rawConfig.maxAttempts, 4, 8, defaults.maxAttempts, 1),
    srsGroups: {
      apprentice: pickBoolean(
        srsGroups.apprentice,
        defaults.srsGroups.apprentice,
      ),
      guru: pickBoolean(srsGroups.guru, defaults.srsGroups.guru),
      master: pickBoolean(srsGroups.master, defaults.srsGroups.master),
      enlightened: pickBoolean(
        srsGroups.enlightened,
        defaults.srsGroups.enlightened,
      ),
      burned: pickBoolean(srsGroups.burned, defaults.srsGroups.burned),
    },
    useCustomLevelRange: pickBoolean(
      rawConfig.useCustomLevelRange,
      defaults.useCustomLevelRange,
    ),
    minLevel,
    maxLevel,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
  };
};

export default function WordleConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const userLevel = userData?.level ?? 60;
  const isPortegoUser = isPortegoUsername(userData?.username);

  const [config, setConfig] = useState<WordleConfig>(() =>
    createDefaultConfig(userLevel),
  );
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const hasCheckedForResumableSessionRef = useRef(false);

  const updateConfig = <K extends keyof WordleConfig>(
    key: K,
    value: WordleConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const canStart = useMemo(() => {
    const hasSubjectTypes =
      config.includeVocabulary || config.includeKanaVocabulary;
    const hasAnySrs =
      config.srsGroups.apprentice ||
      config.srsGroups.guru ||
      config.srsGroups.master ||
      config.srsGroups.enlightened ||
      config.srsGroups.burned;
    return hasSubjectTypes && hasAnySrs;
  }, [config]);

  const start = async () => {
    if (!isPortegoUser || !canStart) {
      return;
    }

    await clearExtraStudySessionState(WORDLE_SESSION_KEY);

    try {
      const sessionId = `wordle_${Date.now()}`;
      await AsyncStorage.setItem(
        `wordle_config_${sessionId}`,
        JSON.stringify(config),
      );

      router.push({
        pathname: "/wordle-session",
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save Wordle config:", error);
      router.push({
        pathname: "/wordle-session",
        params: {
          includeVocabulary: String(config.includeVocabulary),
          includeKanaVocabulary: String(config.includeKanaVocabulary),
          wordLength: String(config.wordLength),
          maxAttempts: String(config.maxAttempts),
          srsApprentice: String(config.srsGroups.apprentice),
          srsGuru: String(config.srsGroups.guru),
          srsMaster: String(config.srsGroups.master),
          srsEnlightened: String(config.srsGroups.enlightened),
          srsBurned: String(config.srsGroups.burned),
          useCustomLevelRange: String(config.useCustomLevelRange),
          minLevel: String(config.minLevel),
          maxLevel: String(config.maxLevel),
          selectedListIds: config.selectedListIds.join(","),
        },
      });
    }
  };

  useEffect(() => {
    if (!isPortegoUser) {
      return;
    }

    let isMounted = true;

    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<WordleConfig>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.WORDLE,
      );
      if (!isMounted) {
        return;
      }

      if (stored) {
        setConfig(sanitizeConfig(stored, initialUserLevelRef.current));
      }

      setIsConfigHydrated(true);
    };

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, [isPortegoUser]);

  useEffect(() => {
    if (!isPortegoUser) {
      return;
    }

    if (hasCheckedForResumableSessionRef.current) {
      return;
    }
    hasCheckedForResumableSessionRef.current = true;

    let isMounted = true;
    const checkForSavedSession = async () => {
      const hasSavedSession = await hasExtraStudySessionState(WORDLE_SESSION_KEY);
      if (!hasSavedSession || !isMounted) {
        return;
      }

      Alert.alert("Resume Kana Wordle?", "You have a Wordle run in progress.", [
        { text: "Not Now", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearExtraStudySessionState(WORDLE_SESSION_KEY);
          },
        },
        {
          text: "Resume",
          onPress: () => {
            router.push({
              pathname: "/wordle-session",
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
  }, [isPortegoUser]);

  useEffect(() => {
    if (!isPortegoUser) {
      return;
    }
    setConfig((prev) => sanitizeConfig(prev, userLevel));
  }, [isPortegoUser, userLevel]);

  useEffect(() => {
    if (!isPortegoUser || !isConfigHydrated) {
      return;
    }

    void saveExtraStudyConfig(EXTRA_STUDY_CONFIG_STORAGE_KEYS.WORDLE, config);
  }, [config, isConfigHydrated, isPortegoUser]);

  const srsChips = useMemo(
    () =>
      [
        { key: "apprentice", label: "Apprentice" },
        { key: "guru", label: "Guru" },
        { key: "master", label: "Master" },
        { key: "enlightened", label: "Enlightened" },
        { key: "burned", label: "Burned" },
      ] as const,
    [],
  );

  const listCountTypes = useMemo(() => {
    const types: ("vocabulary" | "kana_vocabulary")[] = [];
    if (config.includeVocabulary) {
      types.push("vocabulary");
    }
    if (config.includeKanaVocabulary) {
      types.push("kana_vocabulary");
    }
    return types;
  }, [config.includeKanaVocabulary, config.includeVocabulary]);

  const expandAnim = useRef(
    new Animated.Value(config.useCustomLevelRange ? 1 : 0),
  ).current;

  useEffect(() => {
    if (!isPortegoUser) {
      return;
    }

    Animated.timing(expandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, expandAnim, isPortegoUser]);

  if (!isPortegoUser) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="lock-closed-outline" size={28} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>
          Wordle Is Portego-Only
        </Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>
          This mode is currently enabled only for the Portego account.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <StatusBar style={theme.statusBarStyle} />

      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}> 
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Kana Wordle</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <View style={styles.modeHeaderRow}>
            <Ionicons name="sparkles-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.modeHeaderText, { color: theme.textSecondary }]}>Word Game</Text>
          </View>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>No Clues Mode</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}> 
            Guess the hidden reading from color feedback only, like classic Wordle.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Included Subjects</Text>
          <View style={styles.toggleRows}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textColor }]}>Vocabulary</Text>
              <Switch
                value={config.includeVocabulary}
                onValueChange={(value) => updateConfig("includeVocabulary", value)}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textColor }]}>Kana Vocabulary</Text>
              <Switch
                value={config.includeKanaVocabulary}
                onValueChange={(value) => updateConfig("includeKanaVocabulary", value)}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Word Length</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}> 
            Choose how many kana each hidden word has.
          </Text>
          <View style={styles.lengthOptions}>
            {WORD_LENGTH_OPTIONS.map((length) => {
              const isSelected = config.wordLength === length;
              return (
                <TouchableOpacity
                  key={String(length)}
                  style={[
                    styles.lengthOption,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected
                        ? `${theme.primary}20`
                        : theme.isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                    },
                  ]}
                  onPress={() => updateConfig("wordLength", length)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.lengthOptionText,
                      { color: isSelected ? theme.primary : theme.textColor },
                    ]}
                  >
                    {length}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderLabel, { color: theme.textColor }]}>Attempts</Text>
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>
              {config.maxAttempts}
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={4}
            maximumValue={8}
            step={1}
            value={config.maxAttempts}
            onValueChange={(value) => updateConfig("maxAttempts", Math.round(value))}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Include SRS Stages</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}> 
            Pick which progression stages feed the game pool.
          </Text>
          <View style={styles.chipsContainer}>
            {srsChips.map(({ key, label }) => {
              const selected = (config.srsGroups as Record<string, boolean>)[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? `${theme.primary}20` : theme.backgroundColor,
                    },
                  ]}
                  onPress={() =>
                    setConfig((prev) => ({
                      ...prev,
                      srsGroups: {
                        ...prev.srsGroups,
                        [key]: !selected,
                      },
                    }))
                  }
                  activeOpacity={0.8}
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

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <View style={styles.levelHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Level Range</Text>
            <Switch
              value={config.useCustomLevelRange}
              onValueChange={(value) => updateConfig("useCustomLevelRange", value)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}> 
            {config.useCustomLevelRange
              ? `Using levels ${config.minLevel} to ${config.maxLevel}`
              : "Using all unlocked levels"}
          </Text>

          <Animated.View
            style={{
              overflow: "hidden",
              maxHeight: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 220],
              }),
              opacity: expandAnim,
            }}
          >
            <View style={styles.levelSliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textColor }]}>Min</Text>
              <Text style={[styles.sliderCount, { color: theme.textColor }]}>
                {config.minLevel}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={userLevel}
              step={1}
              value={config.minLevel}
              onValueChange={(value) => {
                const nextMin = Math.min(Math.round(value), config.maxLevel);
                updateConfig("minLevel", nextMin);
              }}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />

            <View style={styles.levelSliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textColor }]}>Max</Text>
              <Text style={[styles.sliderCount, { color: theme.textColor }]}>
                {config.maxLevel}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={userLevel}
              step={1}
              value={config.maxLevel}
              onValueChange={(value) => {
                const nextMax = Math.max(Math.round(value), config.minLevel);
                updateConfig("maxLevel", nextMax);
              }}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </Animated.View>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={listCountTypes}
          description="Optional: only include words from these saved lists."
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
              backgroundColor: canStart ? theme.primary : theme.border,
              opacity: canStart ? 1 : 0.7,
            },
          ]}
          onPress={start}
          disabled={!canStart}
          activeOpacity={0.8}
        >
          <Ionicons name="game-controller" size={22} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Kana Wordle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  gatedTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
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
  modeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  modeHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  sectionDescription: { fontSize: 14, lineHeight: 20 },
  toggleRows: { marginTop: 8, gap: 10 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { fontSize: 15, fontWeight: "500" },
  lengthOptions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  lengthOption: {
    width: 52,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lengthOptionText: {
    fontSize: 18,
    fontWeight: "700",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  sliderCount: {
    fontSize: 16,
    fontWeight: "700",
  },
  slider: { width: "100%", height: 40 },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  levelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelSliderRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  startButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  startButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
