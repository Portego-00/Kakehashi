import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import SubjectListsFilterCard from "../../src/components/SubjectListsFilterCard";
import SrsLevelIcon from "../../src/components/SrsLevelIcon";
import KeyboardManager, {
  JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
} from "../../src/modules/KeyboardManager";
import type { ListeningSolutionMode } from "../../src/types/listening";
import { consumePendingAnimeSelection } from "../../src/utils/animeSelectionBridge";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Keys for AsyncStorage (for non-store settings that are session-config level)
// Note: listeningAutoPlayAudio is persisted via the Zustand settings store

interface Config {
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  solutionMode: ListeningSolutionMode;
  numberOfQuestions: number;
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
  sessionAnimes: string[] | null; // null = use global settings
  selectedListIds: string[];
}

const createDefaultConfig = (
  userLevel: number,
  immersionKitAnimes: string[] | null | undefined,
): Config => ({
  includeVocabulary: true,
  includeKanaVocabulary: false,
  solutionMode: "multiple_choice",
  numberOfQuestions: 10,
  srsGroups: {
    apprentice: true,
    guru: true,
    master: true,
    enlightened: true,
    burned: false,
  },
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: userLevel,
  sessionAnimes: immersionKitAnimes ?? [],
  selectedListIds: [],
});

const sanitizeSessionAnimes = (
  rawSessionAnimes: unknown,
  fallback: string[] | null,
): string[] | null => {
  if (rawSessionAnimes === null) {
    return null;
  }

  if (Array.isArray(rawSessionAnimes)) {
    return rawSessionAnimes.filter((item): item is string => typeof item === "string");
  }

  return fallback;
};

const sanitizeConfig = (
  rawConfig: Partial<Config>,
  userLevel: number,
  immersionKitAnimes: string[] | null | undefined,
): Config => {
  const defaults = createDefaultConfig(userLevel, immersionKitAnimes);
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
    solutionMode:
      rawConfig.solutionMode === "writing" ? "writing" : "multiple_choice",
    numberOfQuestions: clampNumber(
      rawConfig.numberOfQuestions,
      5,
      20,
      defaults.numberOfQuestions,
      5,
    ),
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
    sessionAnimes: sanitizeSessionAnimes(
      rawConfig.sessionAnimes,
      defaults.sessionAnimes,
    ),
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
  };
};

export default function ListeningPracticeConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const {
    immersionKitAnimes,
    listeningAutoPlayAudio,
    setListeningAutoPlayAudio,
    autoSwitchKeyboard,
    setAutoSwitchKeyboard,
  } = useSettingsStore();
  const userLevel = userData?.level ?? 60;
  const [config, setConfig] = useState<Config>(() =>
    createDefaultConfig(userLevel, immersionKitAnimes),
  );
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const [hasLoadedPersistedConfig, setHasLoadedPersistedConfig] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const initialImmersionKitAnimesRef = useRef(immersionKitAnimes);
  const hasCheckedForResumableSessionRef = useRef(false);

  // Listen for anime selection updates when returning from anime selector
  useFocusEffect(
    useCallback(() => {
      const pendingSelection = consumePendingAnimeSelection();
      if (pendingSelection !== null) {
        setConfig((prev) => ({ ...prev, sessionAnimes: pendingSelection }));
      }
    }, [])
  );

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<Config>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.LISTENING_PRACTICE,
      );
      if (!isMounted) {
        return;
      }

      if (stored) {
        setConfig(
          sanitizeConfig(
            stored,
            initialUserLevelRef.current,
            initialImmersionKitAnimesRef.current,
          ),
        );
        setHasLoadedPersistedConfig(true);
      }

      setIsConfigHydrated(true);
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasCheckedForResumableSessionRef.current) {
      return;
    }
    hasCheckedForResumableSessionRef.current = true;

    let isMounted = true;
    const checkForSavedSession = async () => {
      const hasSavedSession = await hasExtraStudySessionState(
        EXTRA_STUDY_SESSION_STORAGE_KEYS.LISTENING_PRACTICE,
      );
      if (!hasSavedSession || !isMounted) {
        return;
      }

      Alert.alert(
        "Resume Listening Practice?",
        "You have a listening practice session in progress.",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              void clearExtraStudySessionState(
                EXTRA_STUDY_SESSION_STORAGE_KEYS.LISTENING_PRACTICE,
              );
            },
          },
          {
            text: "Resume",
            onPress: () => {
              router.push({
                pathname: "/listening-practice-session",
                params: { resume: "true" },
              });
            },
          },
        ],
      );
    };

    void checkForSavedSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setConfig((prev) => sanitizeConfig(prev, userLevel, immersionKitAnimes));
  }, [immersionKitAnimes, userLevel]);

  useEffect(() => {
    if (hasLoadedPersistedConfig) {
      return;
    }

    if (!immersionKitAnimes || immersionKitAnimes.length === 0) {
      return;
    }

    setConfig((prev) => {
      if (prev.sessionAnimes === null || prev.sessionAnimes.length > 0) {
        return prev;
      }

      return { ...prev, sessionAnimes: immersionKitAnimes };
    });
  }, [hasLoadedPersistedConfig, immersionKitAnimes]);

  useEffect(() => {
    if (!isConfigHydrated) {
      return;
    }

    saveExtraStudyConfig(
      EXTRA_STUDY_CONFIG_STORAGE_KEYS.LISTENING_PRACTICE,
      config,
    );
  }, [config, isConfigHydrated]);

  const updateConfig = (key: keyof Config, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const canStart = () => {
    const hasSubjectTypes =
      config.includeVocabulary || config.includeKanaVocabulary;
    const srs = config.srsGroups || ({} as any);
    const hasAnySrs = Boolean(
      srs.apprentice || srs.guru || srs.master || srs.enlightened || srs.burned
    );
    // Check if there are selected animes (either session or global)
    const selectedAnimes = config.sessionAnimes || immersionKitAnimes || [];
    const hasAnimes = selectedAnimes.length > 0;
    const hasRequiredKeyboard =
      config.solutionMode !== "writing" || autoSwitchKeyboard;
    return hasSubjectTypes && hasAnySrs && hasAnimes && hasRequiredKeyboard;
  };

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

  const start = async () => {
    if (!canStart()) {
      if (config.solutionMode === "writing" && !autoSwitchKeyboard) {
        Alert.alert(
          "Japanese Keyboard Required",
          "Enable \"Switch to Japanese Keyboard\" to start listening writing mode."
        );
      }
      return;
    }

    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.LISTENING_PRACTICE,
    );

    try {
      const sessionId = `listening_${Date.now()}`;
      await AsyncStorage.setItem(
        `listening_config_${sessionId}`,
        JSON.stringify(config)
      );

      router.replace({
        pathname: "/listening-practice-session",
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save listening practice config:", error);
      // Fallback: pass config as URL params
      router.replace({
        pathname: "/listening-practice-session",
        params: {
          includeVocabulary: config.includeVocabulary.toString(),
          includeKanaVocabulary: config.includeKanaVocabulary.toString(),
          solutionMode: config.solutionMode,
          numberOfQuestions: config.numberOfQuestions.toString(),
          srsApprentice: String(config.srsGroups.apprentice),
          srsGuru: String(config.srsGroups.guru),
          srsMaster: String(config.srsGroups.master),
          srsEnlightened: String(config.srsGroups.enlightened),
          srsBurned: String(config.srsGroups.burned),
          useCustomLevelRange: String(config.useCustomLevelRange),
          minLevel: String(config.minLevel),
          maxLevel: String(config.maxLevel),
          selectedListIds: config.selectedListIds.join(","),
          sessionAnimes: config.sessionAnimes
            ? JSON.stringify(config.sessionAnimes)
            : "",
        },
      });
    }
  };

  const handleKeyboardToggle = async (value: boolean) => {
    if (value && KeyboardManager) {
      const hasJapaneseKeyboard = await KeyboardManager.hasJapaneseKeyboard();
      if (!hasJapaneseKeyboard) {
        Alert.alert(
          "No Japanese Keyboard",
          JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS
        );
        return;
      }
    }

    setAutoSwitchKeyboard(value);
  };

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

  // Animated expand for level range section
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

  const handleCustomizeAnimes = () => {
    // Navigate to anime selector with current selection
    router.push({
      pathname: "/listening-anime-selector",
      params: {
        currentSelection: JSON.stringify(
          config.sessionAnimes || immersionKitAnimes || []
        ),
      },
    });
  };

  const selectedAnimes = config.sessionAnimes || [];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Listening Practice
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Overview card */}
        <View
          style={[
            styles.sectionElevated,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="headset-outline"
              size={18}
              color={theme.textSecondary}
            />
            <Text
              style={[styles.sectionHeaderText, { color: theme.textSecondary }]}
            >
              Audio Comprehension Test
            </Text>
          </View>
          <Text style={[styles.overviewTitle, { color: theme.textColor }]}>
            Choose subject types
          </Text>
          <View style={styles.overviewChipsRow}>
            <TouchableOpacity
              style={[
                styles.overviewChip,
                {
                  borderColor: config.includeVocabulary
                    ? theme.primary
                    : theme.border,
                  backgroundColor: config.includeVocabulary
                    ? `${theme.primary}22`
                    : "transparent",
                },
              ]}
              onPress={() =>
                updateConfig("includeVocabulary", !config.includeVocabulary)
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name="library"
                size={16}
                color={
                  config.includeVocabulary ? theme.primary : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.overviewChipText,
                  {
                    color: config.includeVocabulary
                      ? theme.primary
                      : theme.textSecondary,
                  },
                ]}
              >
                Vocabulary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.overviewChip,
                {
                  borderColor: config.includeKanaVocabulary
                    ? theme.primary
                    : theme.border,
                  backgroundColor: config.includeKanaVocabulary
                    ? `${theme.primary}22`
                    : "transparent",
                },
              ]}
              onPress={() =>
                updateConfig(
                  "includeKanaVocabulary",
                  !config.includeKanaVocabulary
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name="text"
                size={16}
                color={
                  config.includeKanaVocabulary
                    ? theme.primary
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.overviewChipText,
                  {
                    color: config.includeKanaVocabulary
                      ? theme.primary
                      : theme.textSecondary,
                  },
                ]}
              >
                Kana Vocab
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Number of Questions */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Number of Questions
          </Text>
          <View style={[styles.sliderContainer]}>
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>
              {config.numberOfQuestions}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={5}
              maximumValue={20}
              step={5}
              value={config.numberOfQuestions}
              onValueChange={(v) =>
                updateConfig("numberOfQuestions", Math.round(v))
              }
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </View>
        </View>

        {/* Answer Mode */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Answer Mode
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Choose whether vocabulary answers are multiple choice or typed.
          </Text>
          <View style={styles.modeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.modeOption,
                {
                  borderColor:
                    config.solutionMode === "multiple_choice"
                      ? theme.primary
                      : theme.border,
                  backgroundColor:
                    config.solutionMode === "multiple_choice"
                      ? `${theme.primary}22`
                      : "transparent",
                },
              ]}
              onPress={() => updateConfig("solutionMode", "multiple_choice")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="grid"
                size={16}
                color={
                  config.solutionMode === "multiple_choice"
                    ? theme.primary
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.modeOptionText,
                  {
                    color:
                      config.solutionMode === "multiple_choice"
                        ? theme.primary
                        : theme.textColor,
                  },
                ]}
              >
                Multiple Choice
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeOption,
                {
                  borderColor:
                    config.solutionMode === "writing"
                      ? theme.primary
                      : theme.border,
                  backgroundColor:
                    config.solutionMode === "writing"
                      ? `${theme.primary}22`
                      : "transparent",
                },
              ]}
              onPress={() => updateConfig("solutionMode", "writing")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={
                  config.solutionMode === "writing"
                    ? theme.primary
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.modeOptionText,
                  {
                    color:
                      config.solutionMode === "writing"
                        ? theme.primary
                        : theme.textColor,
                  },
                ]}
              >
                Writing
              </Text>
            </TouchableOpacity>
          </View>

          {config.solutionMode === "writing" && (
            <>
              {KeyboardManager && (
                <View
                  style={[
                    styles.toggleRow,
                    {
                      borderColor: autoSwitchKeyboard ? theme.primary : theme.border,
                      backgroundColor: autoSwitchKeyboard
                        ? `${theme.primary}15`
                        : "transparent",
                      marginBottom: 6,
                    },
                  ]}
                >
                  <Text style={[styles.toggleText, { color: theme.textColor }]}>
                    Switch to Japanese Keyboard
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Switch
                    value={autoSwitchKeyboard}
                    onValueChange={handleKeyboardToggle}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor={"#f4f3f4"}
                  />
                </View>
              )}
              <Text
                style={[styles.sectionDescription, { color: theme.textSecondary }]}
              >
                Writing mode requires typing the exact vocabulary (including kanji
                when applicable).
              </Text>
              {!autoSwitchKeyboard && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={16} color="#ff9500" />
                  <Text style={styles.warningText}>
                    Enable Japanese keyboard switching to use writing mode.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* SRS Stages */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Include SRS Stages
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Choose which progression stages to include
          </Text>
          <View style={styles.chipsContainer}>
            {srsChips.map(({ key, label }) => {
              const selected = (config.srsGroups as any)[key];
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
                        [key]:
                          !prev.srsGroups[key as keyof typeof prev.srsGroups],
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

        {/* Levels */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Levels
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
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
              thumbColor={"#f4f3f4"}
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
                <Text style={[styles.levelValue, { color: theme.textColor }]}>
                  {config.minLevel}
                </Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.minLevel}
                onValueChange={(v) => {
                  const val = Math.min(Math.round(v), config.maxLevel);
                  updateConfig("minLevel", val);
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
                <Text style={[styles.levelValue, { color: theme.textColor }]}>
                  {config.maxLevel}
                </Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.maxLevel}
                onValueChange={(v) => {
                  const val = Math.max(Math.round(v), config.minLevel);
                  updateConfig("maxLevel", val);
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

        {/* Anime Sources */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Anime Sources
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Examples will come from specific anime selected below.
          </Text>
          <View style={styles.animeActionRow}>
            <View style={styles.animeCountContainer}>
              <Ionicons name="film" size={16} color={theme.textSecondary} />
              <Text style={[styles.animeCount, { color: theme.textColor }]}>
                {selectedAnimes.length} anime selected
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCustomizeAnimes}
              style={[
                styles.customizeButton,
                {
                  borderColor: theme.primary,
                  backgroundColor: `${theme.primary}15`,
                },
              ]}
            >
              <Text
                style={[styles.customizeButtonText, { color: theme.primary }]}
              >
                Edit Selection
              </Text>
            </TouchableOpacity>
          </View>
          {selectedAnimes.length === 0 && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={16} color="#ff9500" />
              <Text style={styles.warningText}>
                No anime selected. Please select at least one anime source.
              </Text>
            </View>
          )}
        </View>

        {/* Playback Settings */}
        <View
          style={[styles.section, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Playback
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Control how audio behaves during practice
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: listeningAutoPlayAudio
                  ? theme.primary
                  : theme.border,
                backgroundColor: listeningAutoPlayAudio
                  ? `${theme.primary}15`
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="play-circle-outline"
              size={20}
              color={listeningAutoPlayAudio ? theme.primary : theme.textSecondary}
            />
            <Text style={[styles.toggleText, { color: theme.textColor }]}>
              Auto-play audio
            </Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={listeningAutoPlayAudio}
              onValueChange={setListeningAutoPlayAudio}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor={"#f4f3f4"}
            />
          </View>
          <Text
            style={[
              styles.playbackHint,
              { color: theme.textSecondary },
            ]}
          >
            {listeningAutoPlayAudio
              ? "Audio will play automatically when moving to the next question"
              : "You'll need to press play manually to hear the audio"}
          </Text>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={listCountTypes}
          description="Optional: only include subjects from these saved lists."
        />

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Sticky footer button */}
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
            name="play"
            size={24}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.startButtonText}>Start Listening Practice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
  sectionElevated: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  overviewChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  overviewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  overviewChipText: {
    fontSize: 12,
  },
  modeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  modeOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
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
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelSliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelLabel: {
    fontSize: 14,
  },
  levelValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  levelSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelSummaryText: {
    fontSize: 14,
  },
  animeActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  animeCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  animeCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  customizeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  customizeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  playbackHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: "#ff9500",
    flex: 1,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
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
});
