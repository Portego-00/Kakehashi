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
  TextInput,
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
import type { ContextSentencePracticeConfig } from "../../src/types/contextSentencePractice";
import type { ListeningSolutionMode } from "../../src/types/listening";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type Config = ContextSentencePracticeConfig;

const DEFAULT_SRS_GROUPS = {
  apprentice: true,
  guru: true,
  master: true,
  enlightened: true,
  burned: false,
};

const createDefaultConfig = (userLevel: number): Config => ({
  includeVocabulary: true,
  includeKanaVocabulary: false,
  solutionMode: "multiple_choice",
  numberOfQuestions: 15,
  enableSentenceAudio: false,
  autoPlaySentenceAudio: false,
  hideTranslationUntilTap: false,
  enableJpdbSentenceBreakdown: false,
  stopAfterAnswer: true,
  srsGroups: { ...DEFAULT_SRS_GROUPS },
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: userLevel,
  selectedListIds: [],
  devSelectedSubjectIds: [],
});

const parseDevSelectedSubjectIds = (rawValue: unknown): number[] => {
  const values = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === "string"
      ? rawValue.split(/[,\s]+/)
      : [];

  const parsedIds = values
    .map((value) => {
      const parsed =
        typeof value === "number"
          ? value
          : Number.parseInt(String(value), 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
      }

      return parsed;
    })
    .filter((value): value is number => value !== null);

  return Array.from(new Set(parsedIds));
};

const formatDevSelectedSubjectIds = (ids: number[] | undefined): string => {
  if (!ids || ids.length === 0) {
    return "";
  }

  return ids.join(", ");
};

const sanitizeConfig = (rawConfig: Partial<Config>, userLevel: number): Config => {
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
    solutionMode:
      rawConfig.solutionMode === "writing" ? "writing" : "multiple_choice",
    numberOfQuestions: clampNumber(
      rawConfig.numberOfQuestions,
      5,
      50,
      defaults.numberOfQuestions,
      5,
    ),
    enableSentenceAudio: pickBoolean(
      rawConfig.enableSentenceAudio,
      defaults.enableSentenceAudio,
    ),
    autoPlaySentenceAudio: pickBoolean(
      rawConfig.autoPlaySentenceAudio,
      defaults.autoPlaySentenceAudio,
    ),
    hideTranslationUntilTap: pickBoolean(
      rawConfig.hideTranslationUntilTap,
      defaults.hideTranslationUntilTap,
    ),
    enableJpdbSentenceBreakdown: pickBoolean(
      rawConfig.enableJpdbSentenceBreakdown,
      defaults.enableJpdbSentenceBreakdown,
    ),
    stopAfterAnswer: pickBoolean(
      rawConfig.stopAfterAnswer,
      defaults.stopAfterAnswer,
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
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
    devSelectedSubjectIds: parseDevSelectedSubjectIds(
      rawConfig.devSelectedSubjectIds,
    ),
  };
};

export default function ContextSentencePracticeConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const {
    autoSwitchKeyboard,
    setAutoSwitchKeyboard,
  } = useSettingsStore();
  const userLevel = userData?.level ?? 60;
  const [config, setConfig] = useState<Config>(() =>
    createDefaultConfig(userLevel),
  );
  const [devSelectedSubjectIdsInput, setDevSelectedSubjectIdsInput] =
    useState("");
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const hasCheckedForResumableSessionRef = useRef(false);

  const devSelectedSubjectIdsPreview = useMemo(
    () => parseDevSelectedSubjectIds(devSelectedSubjectIdsInput),
    [devSelectedSubjectIdsInput],
  );

  const updateConfig = (key: keyof Config, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const canStart = () => {
    const hasSubjectTypes =
      config.includeVocabulary || config.includeKanaVocabulary;
    const hasAnySrs =
      config.srsGroups.apprentice ||
      config.srsGroups.guru ||
      config.srsGroups.master ||
      config.srsGroups.enlightened ||
      config.srsGroups.burned;

    return hasSubjectTypes && hasAnySrs;
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

  const handleKeyboardToggle = async (value: boolean) => {
    if (value && KeyboardManager) {
      const hasJapaneseKeyboard = await KeyboardManager.hasJapaneseKeyboard();
      if (!hasJapaneseKeyboard) {
        Alert.alert(
          "No Japanese Keyboard",
          JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
        );
        return;
      }
    }

    setAutoSwitchKeyboard(value);
  };

  const start = async () => {
    if (!canStart()) {
      return;
    }

    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
    );

    try {
      const configToStart: Config = {
        ...config,
        devSelectedSubjectIds: __DEV__ ? devSelectedSubjectIdsPreview : [],
      };
      const sessionId = `context_sentence_${Date.now()}`;
      await AsyncStorage.setItem(
        `context_sentence_config_${sessionId}`,
        JSON.stringify(configToStart),
      );

      router.push({
        pathname: "/context-sentence-practice-session",
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save context sentence config:", error);

      const solutionMode: ListeningSolutionMode =
        config.solutionMode === "writing" ? "writing" : "multiple_choice";

      router.push({
        pathname: "/context-sentence-practice-session",
        params: {
          includeVocabulary: String(config.includeVocabulary),
          includeKanaVocabulary: String(config.includeKanaVocabulary),
          solutionMode,
          numberOfQuestions: String(config.numberOfQuestions),
          srsApprentice: String(config.srsGroups.apprentice),
          srsGuru: String(config.srsGroups.guru),
          srsMaster: String(config.srsGroups.master),
          srsEnlightened: String(config.srsGroups.enlightened),
          srsBurned: String(config.srsGroups.burned),
          useCustomLevelRange: String(config.useCustomLevelRange),
          minLevel: String(config.minLevel),
          maxLevel: String(config.maxLevel),
          selectedListIds: config.selectedListIds?.join(",") || "",
          enableSentenceAudio: String(config.enableSentenceAudio),
          autoPlaySentenceAudio: String(config.autoPlaySentenceAudio),
          hideTranslationUntilTap: String(config.hideTranslationUntilTap),
          enableJpdbSentenceBreakdown: String(config.enableJpdbSentenceBreakdown),
          stopAfterAnswer: String(config.stopAfterAnswer),
          devSelectedSubjectIds: __DEV__
            ? devSelectedSubjectIdsPreview.join(",")
            : "",
        },
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<Config>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
      );
      if (!isMounted) {
        return;
      }

      if (stored) {
        const sanitizedConfig = sanitizeConfig(
          stored,
          initialUserLevelRef.current,
        );
        setConfig(sanitizedConfig);
        if (__DEV__) {
          setDevSelectedSubjectIdsInput(
            formatDevSelectedSubjectIds(sanitizedConfig.devSelectedSubjectIds),
          );
        }
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
        EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
      );
      if (!hasSavedSession || !isMounted) {
        return;
      }

      Alert.alert(
        "Resume Context Sentence Practice?",
        "You have a context sentence practice session in progress.",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              void clearExtraStudySessionState(
                EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
              );
            },
          },
          {
            text: "Resume",
            onPress: () => {
              router.push({
                pathname: "/context-sentence-practice-session",
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
    setConfig((prev) => sanitizeConfig(prev, userLevel));
  }, [userLevel]);

  useEffect(() => {
    if (!isConfigHydrated) {
      return;
    }

    saveExtraStudyConfig(
      EXTRA_STUDY_CONFIG_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
      config,
    );
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
    [],
  );

  const expandAnim = useRef(
    new Animated.Value(config.useCustomLevelRange ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, expandAnim]);

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
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Context Sentences</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.sectionElevated, { backgroundColor: theme.cardBackground }]}> 
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={theme.textSecondary}
            />
            <Text style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>Sentence Cloze Practice</Text>
          </View>
          <Text style={[styles.overviewTitle, { color: theme.textColor }]}>Choose subject types</Text>
          <View style={styles.overviewChipsRow}>
            <TouchableOpacity
              style={[
                styles.overviewChip,
                {
                  borderColor: config.includeVocabulary ? theme.primary : theme.border,
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
                  !config.includeKanaVocabulary,
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

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Number of Questions</Text>
          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>
              {config.numberOfQuestions}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={5}
              maximumValue={50}
              step={5}
              value={config.numberOfQuestions}
              onValueChange={(value) =>
                updateConfig("numberOfQuestions", Math.round(value))
              }
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </View>
        </View>

        {__DEV__ && (
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Dev Question Picker
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.textSecondary, marginBottom: 10 },
              ]}
            >
              Enter comma-separated WaniKani subject IDs. In dev builds, only
              those questions are asked in this order.
            </Text>
            <TextInput
              value={devSelectedSubjectIdsInput}
              onChangeText={(value) => {
                setDevSelectedSubjectIdsInput(value);
                updateConfig(
                  "devSelectedSubjectIds",
                  parseDevSelectedSubjectIds(value),
                );
              }}
              placeholder="e.g. 246, 12345, 67890"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.devInput,
                {
                  borderColor: theme.border,
                  color: theme.textColor,
                  backgroundColor: theme.backgroundColor,
                },
              ]}
            />
            <Text style={[styles.devHint, { color: theme.textSecondary }]}>
              {devSelectedSubjectIdsPreview.length > 0
                ? `${devSelectedSubjectIdsPreview.length} question${devSelectedSubjectIdsPreview.length === 1 ? "" : "s"} selected`
                : "Leave empty to use random question selection."}
            </Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Answer Mode</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Choose whether you answer with multiple choice or by typing the missing word.</Text>

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
                  <Text style={[styles.toggleText, { color: theme.textColor }]}>Switch to Japanese Keyboard</Text>
                  <View style={{ flex: 1 }} />
                  <Switch
                    value={autoSwitchKeyboard}
                    onValueChange={handleKeyboardToggle}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              )}
              <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                Writing mode accepts kanji or hiragana answers. Keyboard auto-switch is optional.
              </Text>
            </>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Sentence Assist
          </Text>
          <Text
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Configure in-question sentence audio and translation reveal behavior.
          </Text>

          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.enableSentenceAudio
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.enableSentenceAudio
                  ? `${theme.primary}15`
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="volume-high-outline"
              size={16}
              color={config.enableSentenceAudio ? theme.primary : theme.textSecondary}
            />
            <View style={styles.assistToggleLabelContainer}>
              <Text
                style={[styles.assistToggleMainText, { color: theme.textColor }]}
              >
                Sentence Audio (TTS)
              </Text>
              <Text
                style={[
                  styles.assistToggleSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Enables Japanese sentence text-to-speech playback during questions.
              </Text>
            </View>
            <Switch
              value={config.enableSentenceAudio}
              onValueChange={(value) => updateConfig("enableSentenceAudio", value)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {config.enableSentenceAudio && (
            <View
              style={[
                styles.toggleRow,
                {
                  borderColor: config.autoPlaySentenceAudio
                    ? theme.primary
                    : theme.border,
                  backgroundColor: config.autoPlaySentenceAudio
                    ? `${theme.primary}15`
                    : "transparent",
                },
              ]}
            >
              <Ionicons
                name="play-circle-outline"
                size={16}
                color={
                  config.autoPlaySentenceAudio
                    ? theme.primary
                    : theme.textSecondary
                }
              />
              <View style={styles.assistToggleLabelContainer}>
                <Text
                  style={[
                    styles.assistToggleMainText,
                    { color: theme.textColor },
                  ]}
                >
                  Auto-play Sentence Audio
                </Text>
                <Text
                  style={[
                    styles.assistToggleSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Automatically plays sentence audio when each question starts.
                </Text>
              </View>
              <Switch
                value={config.autoPlaySentenceAudio}
                onValueChange={(value) =>
                  updateConfig("autoPlaySentenceAudio", value)
                }
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          )}

          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.hideTranslationUntilTap
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.hideTranslationUntilTap
                  ? `${theme.primary}15`
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={
                config.hideTranslationUntilTap ? theme.primary : theme.textSecondary
              }
            />
            <View style={styles.assistToggleLabelContainer}>
              <Text
                style={[styles.assistToggleMainText, { color: theme.textColor }]}
              >
                Hide Translation Until Tap
              </Text>
              <Text
                style={[
                  styles.assistToggleSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Blurs the English translation until you tap to reveal it.
              </Text>
            </View>
            <Switch
              value={config.hideTranslationUntilTap}
              onValueChange={(value) =>
                updateConfig("hideTranslationUntilTap", value)
              }
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.enableJpdbSentenceBreakdown
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.enableJpdbSentenceBreakdown
                  ? `${theme.primary}15`
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={
                config.enableJpdbSentenceBreakdown
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <View style={styles.assistToggleLabelContainer}>
              <Text
                style={[styles.assistToggleMainText, { color: theme.textColor }]}
              >
                JPDB Sentence Breakdown
              </Text>
              <Text
                style={[
                  styles.assistToggleSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Tap grammar and vocabulary inside the sentence to see details in a tooltip.
              </Text>
            </View>
            <Switch
              value={config.enableJpdbSentenceBreakdown}
              onValueChange={(value) =>
                updateConfig("enableJpdbSentenceBreakdown", value)
              }
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.stopAfterAnswer
                  ? theme.primary
                  : theme.border,
                backgroundColor: config.stopAfterAnswer
                  ? `${theme.primary}15`
                  : "transparent",
                marginBottom: 0,
              },
            ]}
          >
            <Ionicons
              name="pause-circle-outline"
              size={16}
              color={config.stopAfterAnswer ? theme.primary : theme.textSecondary}
            />
            <View style={styles.assistToggleLabelContainer}>
              <Text
                style={[styles.assistToggleMainText, { color: theme.textColor }]}
              >
                Stop After Answer
              </Text>
              <Text
                style={[
                  styles.assistToggleSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Shows result first, then waits for you to continue to the next question.
              </Text>
            </View>
            <Switch
              value={config.stopAfterAnswer}
              onValueChange={(value) => updateConfig("stopAfterAnswer", value)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Include SRS Stages</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Choose which progression stages to include</Text>
          <View style={styles.chipsContainer}>
            {srsChips.map(({ key, label }) => {
              const selected = config.srsGroups[key as keyof Config["srsGroups"]];
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
                        [key]: !prev.srsGroups[key],
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

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Levels</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>By default includes levels 1 to your level ({userLevel}). Enable a custom range to restrict.</Text>
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
            <Text style={[styles.toggleText, { color: theme.textColor }]}>Use custom level range</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={config.useCustomLevelRange}
              onValueChange={(value) => updateConfig("useCustomLevelRange", value)}
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
                <Text style={[styles.levelLabel, { color: theme.textSecondary }]}>Min Level</Text>
                <Text style={[styles.levelValue, { color: theme.textColor }]}>{config.minLevel}</Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.minLevel}
                onValueChange={(value) => {
                  const rounded = Math.min(Math.round(value), config.maxLevel);
                  updateConfig("minLevel", rounded);
                }}
                minimumTrackTintColor={theme.secondary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.secondary}
              />
              <View style={[styles.levelSliderRow, { marginTop: 12 }]}>
                <Text style={[styles.levelLabel, { color: theme.textSecondary }]}>Max Level</Text>
                <Text style={[styles.levelValue, { color: theme.textColor }]}>{config.maxLevel}</Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={userLevel}
                step={1}
                value={config.maxLevel}
                onValueChange={(value) => {
                  const rounded = Math.max(Math.round(value), config.minLevel);
                  updateConfig("maxLevel", rounded);
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
                style={[styles.levelSummaryText, { color: theme.textSecondary }]}
              >
                Levels 1 - {userLevel}
              </Text>
            </View>
          )}
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds || []}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={listCountTypes}
          description="Optional: only include subjects from these saved lists."
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
          <Ionicons name="play" size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Context Sentence Practice</Text>
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
  devInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  devHint: {
    fontSize: 13,
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
  assistToggleLabelContainer: {
    flex: 1,
    marginRight: 8,
  },
  assistToggleMainText: {
    fontSize: 14,
    fontWeight: "600",
  },
  assistToggleSubtext: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  assistInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  assistInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
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
