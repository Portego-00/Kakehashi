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
  View
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
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import SrsLevelIcon from "../../src/components/SrsLevelIcon";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface TestConfig {
  includeRadicals: boolean;
  includeKanji: boolean;
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  numberOfQuestions: number;
  srsGroups: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  questionTypes: {
    meaning: boolean;
    reading: boolean;
  };
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
}

// Deprecated count options grid replaced by slider

const SRS_CHIPS = [
  { key: "apprentice", label: "Apprentice" },
  { key: "guru", label: "Guru" },
  { key: "master", label: "Master" },
  { key: "enlightened", label: "Enlightened" },
  { key: "burned", label: "Burned" },
] as const;

const createDefaultConfig = (userLevel: number): TestConfig => ({
  includeRadicals: true,
  includeKanji: true,
  includeVocabulary: true,
  includeKanaVocabulary: true,
  numberOfQuestions: 20,
  srsGroups: {
    apprentice: true,
    guru: true,
    master: true,
    enlightened: true,
    burned: true,
  },
  questionTypes: {
    meaning: true,
    reading: true,
  },
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: userLevel,
  selectedListIds: [],
});

const sanitizeConfig = (
  rawConfig: Partial<TestConfig>,
  userLevel: number,
): TestConfig => {
  const defaults = createDefaultConfig(userLevel);
  const srsGroups = rawConfig.srsGroups ?? defaults.srsGroups;
  const questionTypes = rawConfig.questionTypes ?? defaults.questionTypes;
  const { minLevel, maxLevel } = normalizeLevelRange(
    rawConfig.minLevel,
    rawConfig.maxLevel,
    userLevel,
  );

  return {
    includeRadicals: pickBoolean(
      rawConfig.includeRadicals,
      defaults.includeRadicals,
    ),
    includeKanji: pickBoolean(rawConfig.includeKanji, defaults.includeKanji),
    includeVocabulary: pickBoolean(
      rawConfig.includeVocabulary,
      defaults.includeVocabulary,
    ),
    includeKanaVocabulary: pickBoolean(
      rawConfig.includeKanaVocabulary,
      defaults.includeKanaVocabulary,
    ),
    numberOfQuestions: clampNumber(
      rawConfig.numberOfQuestions,
      5,
      100,
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
    questionTypes: {
      meaning: pickBoolean(questionTypes.meaning, defaults.questionTypes.meaning),
      reading: pickBoolean(questionTypes.reading, defaults.questionTypes.reading),
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

export default function TestConfigScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const userLevel = userData?.level ?? 60;
  
  const [config, setConfig] = useState<TestConfig>(() =>
    createDefaultConfig(userLevel),
  );
  const [isConfigHydrated, setIsConfigHydrated] = useState(false);
  const initialUserLevelRef = useRef(userLevel);
  const hasCheckedForResumableSessionRef = useRef(false);

  const updateConfig = (key: keyof TestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateQuestionTypes = (type: 'meaning' | 'reading', value: boolean) => {
    setConfig(prev => ({
      ...prev,
      questionTypes: { ...prev.questionTypes, [type]: value }
    }));
  };

  const canStartTest = () => {
    const hasSubjectTypes = config.includeRadicals || config.includeKanji || 
                           config.includeVocabulary || config.includeKanaVocabulary;
    const hasQuestionTypes = config.questionTypes.meaning || config.questionTypes.reading;
    const hasAnySrs =
      config.srsGroups.apprentice ||
      config.srsGroups.guru ||
      config.srsGroups.master ||
      config.srsGroups.enlightened ||
      config.srsGroups.burned;
    return hasSubjectTypes && hasQuestionTypes && hasAnySrs;
  };

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      const stored = await loadExtraStudyConfig<TestConfig>(
        EXTRA_STUDY_CONFIG_STORAGE_KEYS.TEST,
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
      const hasSavedSession = await hasExtraStudySessionState(
        EXTRA_STUDY_SESSION_STORAGE_KEYS.RANDOM_TEST,
      );
      if (!hasSavedSession || !isMounted) {
        return;
      }

      Alert.alert("Resume Random Test?", "You have a random test in progress.", [
        { text: "Not Now", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearExtraStudySessionState(
              EXTRA_STUDY_SESSION_STORAGE_KEYS.RANDOM_TEST,
            );
          },
        },
        {
          text: "Resume",
          onPress: () => {
            router.push({
              pathname: "/test-session",
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

    saveExtraStudyConfig(EXTRA_STUDY_CONFIG_STORAGE_KEYS.TEST, config);
  }, [config, isConfigHydrated]);

  // Animated expand for level range section
  const expandAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: config.useCustomLevelRange ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [config.useCustomLevelRange, expandAnim]);

  const startTest = async () => {
    if (!canStartTest()) return;
    
    await clearExtraStudySessionState(EXTRA_STUDY_SESSION_STORAGE_KEYS.RANDOM_TEST);

    try {
      // Store config in AsyncStorage
      const testSessionId = `test_${Date.now()}`;
      await AsyncStorage.setItem(`test_config_${testSessionId}`, JSON.stringify(config));
      
      // Navigate to test screen with just the session ID
      router.push({
        pathname: "/test-session",
        params: {
          sessionId: testSessionId
        }
      });
    } catch (error) {
      console.error('Failed to save test config:', error);
      // Fallback to direct navigation (could still cause 414 error with many items)
      router.push({
        pathname: "/test-session",
        params: {
          includeRadicals: config.includeRadicals.toString(),
          includeKanji: config.includeKanji.toString(),
          includeVocabulary: config.includeVocabulary.toString(),
          includeKanaVocabulary: config.includeKanaVocabulary.toString(),
          numberOfQuestions: config.numberOfQuestions.toString(),
          includeMeaning: config.questionTypes.meaning.toString(),
          includeReading: config.questionTypes.reading.toString(),
          srsApprentice: String(config.srsGroups.apprentice),
          srsGuru: String(config.srsGroups.guru),
          srsMaster: String(config.srsGroups.master),
          srsEnlightened: String(config.srsGroups.enlightened),
          srsBurned: String(config.srsGroups.burned),
          selectedListIds: config.selectedListIds.join(","),
        }
      });
    }
  };

  const listCountTypes = useMemo(() => {
    const types: ("radical" | "kanji" | "vocabulary" | "kana_vocabulary")[] = [];
    if (config.includeRadicals) {
      types.push("radical");
    }
    if (config.includeKanji) {
      types.push("kanji");
    }
    if (config.includeVocabulary) {
      types.push("vocabulary");
    }
    if (config.includeKanaVocabulary) {
      types.push("kana_vocabulary");
    }
    return types;
  }, [
    config.includeKanaVocabulary,
    config.includeKanji,
    config.includeRadicals,
    config.includeVocabulary,
  ]);

  // deprecated visual helper

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      
      {/* Header similar to search screen */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Random Test</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Question Types Section (chips UI) */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Question Types</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>What types of questions should be included?</Text>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[
                styles.chip,
                config.questionTypes.meaning
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateQuestionTypes('meaning', !config.questionTypes.meaning)}
              activeOpacity={0.7}
            >
              <Ionicons name="language" size={16} color={config.questionTypes.meaning ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.questionTypes.meaning ? theme.primary : theme.textColor }]}>Meaning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                config.questionTypes.reading
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateQuestionTypes('reading', !config.questionTypes.reading)}
              activeOpacity={0.7}
            >
              <Ionicons name="text" size={16} color={config.questionTypes.reading ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.questionTypes.reading ? theme.primary : theme.textColor }]}>Reading</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Number of Questions (slider) */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Number of Questions</Text>
          <View style={styles.sliderContainer}> 
            <Text style={[styles.sliderCount, { color: theme.textColor }]}>{config.numberOfQuestions}</Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={5}
              maximumValue={100}
              step={5}
              value={config.numberOfQuestions}
              onValueChange={(v) => updateConfig('numberOfQuestions', Math.round(v as number))}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
          </View>
        </View>

        {/* Subject Types (chips UI) */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Subject Types</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Choose which types of subjects to include in your test</Text>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[
                styles.chip,
                config.includeRadicals
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateConfig('includeRadicals', !config.includeRadicals)}
              activeOpacity={0.7}
            >
              <Ionicons name="shapes" size={16} color={config.includeRadicals ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.includeRadicals ? theme.primary : theme.textColor }]}>Radicals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                config.includeKanji
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateConfig('includeKanji', !config.includeKanji)}
              activeOpacity={0.7}
            >
              <Ionicons name="language" size={16} color={config.includeKanji ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.includeKanji ? theme.primary : theme.textColor }]}>Kanji</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                config.includeVocabulary
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateConfig('includeVocabulary', !config.includeVocabulary)}
              activeOpacity={0.7}
            >
              <Ionicons name="library" size={16} color={config.includeVocabulary ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.includeVocabulary ? theme.primary : theme.textColor }]}>Vocabulary</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                config.includeKanaVocabulary
                  ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                  : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
              ]}
              onPress={() => updateConfig('includeKanaVocabulary', !config.includeKanaVocabulary)}
              activeOpacity={0.7}
            >
              <Ionicons name="text" size={16} color={config.includeKanaVocabulary ? theme.primary : theme.textSecondary} />
              <Text style={[styles.chipText, { color: config.includeKanaVocabulary ? theme.primary : theme.textColor }]}>Kana Vocab</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SRS Stages */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Include SRS Stages</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Choose which progression stages to include</Text>
          <View style={styles.chipsContainer}>
            {SRS_CHIPS.map(({ key, label }) => {
              const selected = config.srsGroups[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }
                      : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }
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
                  <Text style={[styles.chipText, { color: selected ? theme.primary : theme.textColor }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Levels */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Levels</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>By default includes levels 1 to your level ({userLevel}). Enable a custom range to restrict.</Text>
          <View style={[styles.levelToggleRow, { borderColor: config.useCustomLevelRange ? theme.secondary : theme.border, backgroundColor: config.useCustomLevelRange ? `${theme.secondary}15` : 'transparent' }]}>
            <Text style={[styles.levelToggleText, { color: theme.textColor }]}>Use custom level range</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={config.useCustomLevelRange}
              onValueChange={(v) => setConfig(prev => ({ ...prev, useCustomLevelRange: v }))}
              trackColor={{ false: '#767577', true: theme.secondary }}
              thumbColor={'#f4f3f4'}
            />
          </View>

          <Animated.View
            style={{
              overflow: 'hidden',
              height: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }),
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
                onValueChange={(v) => {
                  const val = Math.min(Math.round(v), config.maxLevel);
                  setConfig(prev => ({ ...prev, minLevel: val }));
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
                onValueChange={(v) => {
                  const val = Math.max(Math.round(v), config.minLevel);
                  setConfig(prev => ({ ...prev, maxLevel: val }));
                }}
                minimumTrackTintColor={theme.secondary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.secondary}
              />
            </View>
          </Animated.View>
        </View>

        <SubjectListsFilterCard
          selectedListIds={config.selectedListIds}
          onChange={(ids) => updateConfig("selectedListIds", ids)}
          subjectTypes={listCountTypes}
          description="Optional: only include subjects from these saved lists."
        />

        <View style={{ height: 80 }} />

        {!canStartTest() && (
          <View style={[styles.warningContainer, { backgroundColor: theme.isDark ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255, 152, 0, 0.1)' }]}>
            <Ionicons name="warning" size={20} color="#ff9800" />
            <Text style={[styles.warningText, { color: '#ff9800' }]}>
              Please select at least one subject type, question type, and SRS stage to start the test.
            </Text>
          </View>
        )}
      </ScrollView>
      {/* Sticky footer button */}
      <View style={[styles.stickyFooter, { backgroundColor: theme.cardBackground }]}> 
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: canStartTest() ? theme.primary : theme.border, opacity: canStartTest() ? 1 : 0.7 }]}
          onPress={startTest}
          disabled={!canStartTest()}
          activeOpacity={0.8}
        >
          <Ionicons name="play" size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Random Test</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
    // Subject Type Grid (2x2)
  subjectTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectTypeCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 120,
    position: 'relative',
  },
  subjectTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  subjectTypeSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  subjectTypeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Question Types (vertical list)
  optionsList: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  questionTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionSubtext: {
    fontSize: 13,
  },

  // deprecated count grid styles removed in favor of slider
  levelToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  levelToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  levelSliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelLabel: {
    fontSize: 14,
  },
  levelValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderCount: {
    width: 52,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 40,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
}); 
