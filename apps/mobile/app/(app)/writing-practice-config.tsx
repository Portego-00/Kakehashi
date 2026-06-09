import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
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
  loadExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import SubjectListsFilterCard from "../../src/components/SubjectListsFilterCard";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import SrsLevelIcon from "../../src/components/SrsLevelIcon";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface WritingPracticeConfig {
  numberOfKanji: number;
  useForceFreehandMode: boolean;
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  srsStages: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  selectedListIds: string[];
}

interface WritingPracticeSavedSessionSummary {
  mode?: "guided" | "freehand";
}

const createDefaultConfig = (userLevel: number): WritingPracticeConfig => ({
  numberOfKanji: 10,
  useForceFreehandMode: false,
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: userLevel,
  srsStages: {
    apprentice: true,
    guru: true,
    master: true,
    enlightened: true,
    burned: true,
  },
  selectedListIds: [],
});

const sanitizeConfig = (
  rawConfig: Partial<WritingPracticeConfig>,
  userLevel: number,
): WritingPracticeConfig => {
  const defaults = createDefaultConfig(userLevel);
  const srsStages = rawConfig.srsStages ?? defaults.srsStages;
  const { minLevel, maxLevel } = normalizeLevelRange(
    rawConfig.minLevel,
    rawConfig.maxLevel,
    userLevel,
  );

  return {
    numberOfKanji: clampNumber(
      rawConfig.numberOfKanji,
      5,
      50,
      defaults.numberOfKanji,
      5,
    ),
    useForceFreehandMode: pickBoolean(
      rawConfig.useForceFreehandMode,
      defaults.useForceFreehandMode,
    ),
    useCustomLevelRange: pickBoolean(
      rawConfig.useCustomLevelRange,
      defaults.useCustomLevelRange,
    ),
    minLevel,
    maxLevel,
    srsStages: {
      apprentice: pickBoolean(
        srsStages.apprentice,
        defaults.srsStages.apprentice,
      ),
      guru: pickBoolean(srsStages.guru, defaults.srsStages.guru),
      master: pickBoolean(srsStages.master, defaults.srsStages.master),
      enlightened: pickBoolean(
        srsStages.enlightened,
        defaults.srsStages.enlightened,
      ),
      burned: pickBoolean(srsStages.burned, defaults.srsStages.burned),
    },
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
  };
};

export default function WritingPracticeConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const userLevel = userData?.level ?? 60;
  const isIOS = Platform.OS === "ios";

  const [config, setConfig] = useState<WritingPracticeConfig>(() =>
    createDefaultConfig(userLevel),
  );
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const hasCheckedForResumableSessionRef = useRef(false);

  const updateConfig = (key: keyof WritingPracticeConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Animated expand for level range section
  const expandAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, expandAnim]);

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

  const startPractice = async () => {
    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.WRITING_PRACTICE,
    );

    try {
      // Store config in AsyncStorage
      const sessionId = `writing_${Date.now()}`;
      await AsyncStorage.setItem(
        `writing_config_${sessionId}`,
        JSON.stringify(config)
      );

      // Navigate to practice screen with session ID
      router.push({
        pathname: config.useForceFreehandMode
          && isIOS
          ? "/writing-practice-freehand-session"
          : "/writing-practice-session",
        params: { sessionId },
      });
    } catch (error) {
      console.error("Failed to save writing practice config:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<WritingPracticeConfig>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.WRITING_PRACTICE,
      );
      if (!isMounted) {
        return;
      }

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
    if (hasCheckedForResumableSessionRef.current) {
      return;
    }
    hasCheckedForResumableSessionRef.current = true;

    let isMounted = true;
    const checkForSavedSession = async () => {
      const savedSession = await loadExtraStudySessionState<WritingPracticeSavedSessionSummary>(
        EXTRA_STUDY_SESSION_STORAGE_KEYS.WRITING_PRACTICE,
      );
      if (!savedSession || !isMounted) {
        return;
      }

      const targetPath =
        savedSession.mode === "freehand"
          ? "/writing-practice-freehand-session"
          : "/writing-practice-session";

      Alert.alert("Resume Kanji Writing Practice?", "You have a session in progress.", [
        { text: "Not Now", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearExtraStudySessionState(
              EXTRA_STUDY_SESSION_STORAGE_KEYS.WRITING_PRACTICE,
            );
          },
        },
        {
          text: "Resume",
          onPress: () => {
            router.push({
              pathname: targetPath,
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
    if (!isConfigHydrated) {
      return;
    }

    saveExtraStudyConfig(EXTRA_STUDY_CONFIG_STORAGE_KEYS.WRITING_PRACTICE, config);
  }, [config, isConfigHydrated]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Kanji Writing Practice
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Description Card */}
        <View
          style={[
            styles.descriptionCard,
            { backgroundColor: theme.isDark ? "#1a3a2a" : "#e8f5e9" },
          ]}
        >
          <Ionicons
            name="brush"
            size={24}
            color={theme.isDark ? "#4caf50" : "#2e7d32"}
          />
          <View style={styles.descriptionTextContainer}>
            <Text
              style={[
                styles.descriptionTitle,
                { color: theme.isDark ? "#81c784" : "#2e7d32" },
              ]}
            >
              Practice stroke order
            </Text>
            <Text
              style={[
                styles.descriptionText,
                { color: theme.isDark ? "#a5d6a7" : "#4caf50" },
              ]}
            >
              Draw kanji stroke by stroke. Get feedback on correct stroke order
              and direction.
            </Text>
          </View>
        </View>

        {/* Practice Mode */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Practice Mode
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Guided checks each stroke. Unguided checks only on submit.
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.useForceFreehandMode
                  ? "#4caf50"
                  : theme.border,
                backgroundColor: config.useForceFreehandMode
                  ? "#4caf5015"
                  : "transparent",
                marginBottom: 0,
                opacity: isIOS ? 1 : 0.6,
              },
            ]}
          >
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleText, { color: theme.textColor }]}>
                Unguided test
              </Text>
              <Text style={[styles.toggleSubtext, { color: theme.textSecondary }]}>
                {isIOS
                  ? "No per-stroke correction. You submit once for final grading."
                  : "iOS only. Guided mode will be used on this device."}
              </Text>
            </View>
            <Switch
              value={config.useForceFreehandMode}
              onValueChange={(v) => {
                if (!isIOS) {
                  return;
                }
                updateConfig("useForceFreehandMode", v);
              }}
              trackColor={{ false: "#767577", true: "#4caf50" }}
              thumbColor="#f4f3f4"
              disabled={!isIOS}
            />
          </View>
        </View>

        {/* Number of Kanji */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Number of Kanji
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>
              {config.numberOfKanji}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={5}
              maximumValue={50}
              step={5}
              value={config.numberOfKanji}
              onValueChange={(v) => updateConfig("numberOfKanji", Math.round(v))}
              minimumTrackTintColor="#4caf50"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#4caf50"
            />
          </View>
        </View>

        {/* SRS Stages */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Include SRS Stages
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Choose which progression stages to include
          </Text>
          <View style={styles.chipsContainer}>
            {srsChips.map(({ key, label }) => {
              const selected = config.srsStages[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: "#4caf5022", borderColor: "#4caf50" }
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
                      srsStages: {
                        ...prev.srsStages,
                        [key]: !prev.srsStages[key],
                      },
                    }))
                  }
                  activeOpacity={0.7}
                >
                  <SrsLevelIcon
                    level={label}
                    size={16}
                    color={selected ? "#4caf50" : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? "#4caf50" : theme.textColor },
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
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Levels
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            By default includes levels 1 to your level ({userLevel}). Enable a
            custom range to restrict.
          </Text>
          <View
            style={[
              styles.toggleRow,
              {
                borderColor: config.useCustomLevelRange
                  ? "#4caf50"
                  : theme.border,
                backgroundColor: config.useCustomLevelRange
                  ? "#4caf5015"
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
              onValueChange={(v) =>
                setConfig((prev) => ({ ...prev, useCustomLevelRange: v }))
              }
              trackColor={{ false: "#767577", true: "#4caf50" }}
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
                <Text style={[styles.levelLabel, { color: theme.textSecondary }]}>
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
                  setConfig((prev) => ({ ...prev, minLevel: val }));
                }}
                minimumTrackTintColor="#4caf50"
                maximumTrackTintColor={theme.border}
                thumbTintColor="#4caf50"
              />
              <View style={[styles.levelSliderRow, { marginTop: 12 }]}>
                <Text style={[styles.levelLabel, { color: theme.textSecondary }]}>
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
                  setConfig((prev) => ({ ...prev, maxLevel: val }));
                }}
                minimumTrackTintColor="#4caf50"
                maximumTrackTintColor={theme.border}
                thumbTintColor="#4caf50"
              />
            </View>
          </Animated.View>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={["kanji"]}
          description="Optional: only include kanji from these saved lists."
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky footer button */}
      <View style={[styles.stickyFooter, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: "#4caf50" }]}
          onPress={startPractice}
          activeOpacity={0.8}
        >
          <Ionicons name="brush" size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Practice</Text>
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
  descriptionCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  descriptionTextContainer: {
    flex: 1,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
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
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderCount: {
    width: 40,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
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
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggleSubtext: {
    fontSize: 12,
    marginTop: 2,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
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
});
