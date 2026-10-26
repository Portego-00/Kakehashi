import type { TextInputInstance, ViewInstance } from "react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Pressable,
  TextInput,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SettingsIcon as Ionicons } from "../../ui/settings/settings-icon";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SettingsSearchRegistryContext,
  SettingsSectionAnchorContext,
  SettingsSearchSection,
  settingsSearchMatches,
  type SettingsSearchEntry,
} from "../../ui/settings/settings-search";
import { SETTINGS_CATEGORIES } from "./settings-categories";
import { StatusBar } from "expo-status-bar";

import OpenSourceModal from "../../components/OpenSourceModal";
import {
  SettingsControllerProvider,
  useSettingsControllerContext,
} from "./SettingsControllerContext";
import {
  useSettingsController,
  resolveSectionKeyFromScrollParam,
} from "./useSettingsController";
import { styles } from "./styles";
import { SupportSection } from "./sections/SupportSection";
import { VoiceSettingsSection } from "./sections/VoiceSettingsSection";
import { VocabularyContextSection } from "./sections/VocabularyContextSection";
import { ReadingDefaultsSection } from "./sections/ReadingDefaultsSection";
import { MusicPlaybackSection } from "./sections/MusicPlaybackSection";
import { LessonSettingsSection } from "./sections/LessonSettingsSection";
import { SubjectDetailsSection } from "./sections/SubjectDetailsSection";
import { SubjectListsSection } from "./sections/SubjectListsSection";
import { ReviewSettingsSection } from "./sections/ReviewSettingsSection";
import { BunproReviewSettingsSection } from "./sections/BunproReviewSettingsSection";
import { NotesSection } from "./sections/NotesSection";
import { HapticSection } from "./sections/HapticSection";
import { KanjiLearningSection } from "./sections/KanjiLearningSection";
import { UserProfileSection } from "./sections/UserProfileSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ThemeSection } from "./sections/ThemeSection";
import { WidgetSection } from "./sections/WidgetSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { DataStorageSection } from "./sections/DataStorageSection";
import { LevelRecapSection } from "./sections/LevelRecapSection";
import { PatreonSupportersSection } from "./sections/PatreonSupportersSection";
import { AccountSection } from "./sections/AccountSection";
import { ApiDebugSection } from "./sections/ApiDebugSection";
import { LevelAnalyticsExportModal } from "./modals/LevelAnalyticsExportModal";
import { AndroidVocabularyVoicePickerModal } from "./modals/AndroidVocabularyVoicePickerModal";
import { AndroidSrsProgressionCardModePickerModal } from "./modals/AndroidSrsProgressionCardModePickerModal";
import { ReminderTimeModal } from "./modals/ReminderTimeModal";
import { AnswerStopDetailsPreviewModal } from "./modals/AnswerStopDetailsPreviewModal";
import { ReviewShortcutModal } from "./modals/ReviewShortcutModal";
import { BunproSurveyModal } from "./modals/BunproSurveyModal";
import { CacheAnalysisModal } from "./modals/CacheAnalysisModal";
import { NotificationsDebugModal } from "./modals/NotificationsDebugModal";

export default function SettingsScreen() {
  const controller = useSettingsController();

  return (
    <SettingsControllerProvider value={controller}>
      <SettingsScreenContent />
    </SettingsControllerProvider>
  );
}

const SETTINGS_SECTIONS: readonly [string, React.ComponentType][] = [
  ["support", SupportSection],
  ["voice", VoiceSettingsSection],
  ["vocabContext", VocabularyContextSection],
  ["readingDefaults", ReadingDefaultsSection],
  ["musicPlayback", MusicPlaybackSection],
  ["lessons", LessonSettingsSection],
  ["subjectLists", SubjectListsSection],
  ["subjectDetails", SubjectDetailsSection],
  ["reviews", ReviewSettingsSection],
  ["bunproReviews", BunproReviewSettingsSection],
  ["notes", NotesSection],
  ["haptic", HapticSection],
  ["kanji", KanjiLearningSection],
  ["profile", UserProfileSection],
  ["appearance", AppearanceSection],
  ["theme", ThemeSection],
  ["widgets", WidgetSection],
  ["notifications", NotificationsSection],
  ["dataStorage", DataStorageSection],
  ["levelRecap", LevelRecapSection],
  ["patreon", PatreonSupportersSection],
  ["account", AccountSection],
  ["apiDebug", ApiDebugSection],
];

function SettingsScreenContent() {
  const {
    PerformanceDashboard,
    handleBack,
    handleSettingsScroll,
    handleSettingsScrollBeginDrag,
    scrollToSection,
    scrollViewRef,
    sectionChipScrollViewRef,
    sectionChips,
    selectedSectionKey,
    setSectionChipBarWidth,
    setShowOpenSourceModal,
    setShowPerformanceDashboard,
    settingsBottomPadding,
    showOpenSourceModal,
    showPerformanceDashboard,
    theme,
    updateSectionChipLayout,
    updateSectionOffset,
  } = useSettingsControllerContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    category?: string;
    scrollTo?: string;
  }>();
  const initialSection =
    resolveSectionKeyFromScrollParam(params.scrollTo) ??
    SETTINGS_CATEGORIES.find((category) => category.id === params.category)
      ?.sections[0];
  const pendingInitialJump = useRef(initialSection);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelInitialJump = () => {
    pendingInitialJump.current = undefined;
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
  };
  useEffect(() => {
    pendingInitialJump.current = initialSection;
  }, [initialSection]);
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
    },
    [],
  );
  const requestedCategory = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!params.category || requestedCategory.current === params.category)
      return;
    requestedCategory.current = params.category;
    const section = SETTINGS_CATEGORIES.find(
      (category) => category.id === params.category,
    )?.sections[0];
    const chip = sectionChips.find((entry) => entry.key === section);
    if (chip) scrollToSection(chip.key, false);
  }, [params.category, sectionChips, scrollToSection]);
  const [query, setQuery] = useState("");
  const [, refreshIndex] = useState(0);
  const entries = useRef(new Map<string, SettingsSearchEntry>());
  const searchRef = useRef<TextInputInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const scrollY = useRef(0);
  const anchors = useRef(
    new Map<string, (callback: (y: number) => void) => void>(),
  );
  const registerAnchor = useCallback(
    (key: string, measure: (callback: (y: number) => void) => void) => {
      anchors.current.set(key, measure);
      return () => {
        if (anchors.current.get(key) === measure) anchors.current.delete(key);
      };
    },
    [],
  );
  const goToSection = (key: string, animated: boolean) => {
    const section = sectionChips.find((chip) => chip.key === key);
    if (!section) return;
    const measure = anchors.current.get(key);
    if (!measure || !contentRef.current) {
      scrollToSection(section.key, animated);
      return;
    }
    contentRef.current.measureInWindow((_x, top) =>
      measure((y) => {
        const target = Math.max(0, scrollY.current + y - top - 12);
        updateSectionOffset(section.key, target + 8);
        scrollToSection(section.key, animated, target);
      }),
    );
  };
  const register = useCallback((entry: SettingsSearchEntry) => {
    entries.current.set(entry.id, entry);
    refreshIndex((version) => version + 1);
    return () => {
      entries.current.delete(entry.id);
      refreshIndex((version) => version + 1);
    };
  }, []);
  const searching = query.trim().length > 0;
  const results = settingsSearchMatches([...entries.current.values()], query);
  const sections = useMemo(
    () =>
      SETTINGS_SECTIONS.map(([key, Component]) => {
        const section = sectionChips.find((chip) => chip.key === key);
        return section ? (
          <SettingsSearchSection key={key} section={section}>
            <Component />
          </SettingsSearchSection>
        ) : null;
      }),
    [sectionChips],
  );
  const openResult = (entry: SettingsSearchEntry) => {
    cancelInitialJump();
    searchRef.current?.blur();
    Keyboard.dismiss();
    setQuery("");
    entry.reveal();
    const section = sectionChips.find((chip) => chip.key === entry.section.key);
    if (section) goToSection(section.key, false);
    setTimeout(() => {
      contentRef.current?.measureInWindow((_x, top) => {
        entry.measure((y) =>
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollY.current + y - top - 12),
            animated: true,
          }),
        );
      });
    }, 250);
  };
  return (
    <SettingsSearchRegistryContext.Provider value={register}>
      <SettingsSectionAnchorContext.Provider value={registerAnchor}>
        <View
          style={[styles.container, { backgroundColor: theme.backgroundColor }]}
        >
          <StatusBar style={theme.statusBarStyle} />
          <OpenSourceModal
            visible={showOpenSourceModal}
            onClose={() => setShowOpenSourceModal(false)}
          />
          <View
            style={[
              styles.header,
              {
                paddingTop: insets.top + 4,
                paddingLeft: insets.left + 12,
                paddingRight: insets.right + 12,
                backgroundColor: theme.backgroundColor,
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              onPress={handleBack}
            >
              <Ionicons name="back" size={22} color={theme.textColor} />
            </TouchableOpacity>
            <Text
              style={[styles.title, { color: theme.textColor }]}
              numberOfLines={1}
            >
              Settings
            </Text>
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minHeight: 40,
                paddingLeft: 9,
                borderWidth: 1,
                borderRadius: 9,
                borderColor: theme.border,
                backgroundColor: theme.cardBackground,
              }}
            >
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                ref={searchRef}
                accessibilityLabel="Search settings"
                placeholder="Search"
                placeholderTextColor={theme.textSecondary}
                value={query}
                onChangeText={(text) => {
                  cancelInitialJump();
                  setQuery(text);
                }}
                onFocus={cancelInitialJump}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (results[0]) openResult(results[0]);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 40,
                  paddingVertical: 0,
                  fontSize: 14,
                  color: theme.textColor,
                }}
              />
              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear settings search"
                  onPress={() => setQuery("")}
                  hitSlop={6}
                  style={{
                    width: 30,
                    minHeight: 40,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>
              ) : (
                <View style={{ width: 4 }} />
              )}
            </View>
          </View>
          <View
            style={[
              styles.sectionChipBar,
              {
                borderBottomColor: theme.border,
                backgroundColor: theme.backgroundColor,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}
          >
            <ScrollView
              ref={sectionChipScrollViewRef}
              onLayout={(event) =>
                setSectionChipBarWidth(event.nativeEvent.layout.width)
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionChipContent}
              keyboardShouldPersistTaps="handled"
            >
              {sectionChips.map((chip) => {
                const selected = selectedSectionKey === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    accessibilityRole="button"
                    accessibilityLabel={chip.label + " settings"}
                    accessibilityState={{ selected }}
                    hitSlop={{ top: 2, bottom: 2 }}
                    onLayout={(event) =>
                      updateSectionChipLayout(
                        chip.key,
                        event.nativeEvent.layout.x,
                        event.nativeEvent.layout.width,
                      )
                    }
                    style={[
                      styles.sectionChip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected
                          ? theme.primary
                          : theme.cardBackground,
                      },
                    ]}
                    onPress={() => {
                      cancelInitialJump();
                      setQuery("");
                      searchRef.current?.blur();
                      Keyboard.dismiss();
                      goToSection(chip.key, true);
                    }}
                  >
                    <Ionicons
                      name={chip.key}
                      size={15}
                      color={selected ? "#fff" : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sectionChipText,
                        { color: selected ? "#fff" : theme.textColor },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <View ref={contentRef} style={{ flex: 1 }} collapsable={false}>
            <ScrollView
              ref={scrollViewRef}
              style={[styles.content, searching && { opacity: 0 }]}
              pointerEvents={searching ? "none" : "auto"}
              accessibilityElementsHidden={searching}
              importantForAccessibility={
                searching ? "no-hide-descendants" : "auto"
              }
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              removeClippedSubviews={false}
              onScroll={(event) => {
                scrollY.current = event.nativeEvent.contentOffset.y;
                handleSettingsScroll(event);
              }}
              scrollEventThrottle={16}
              onScrollBeginDrag={handleSettingsScrollBeginDrag}
              onTouchStart={cancelInitialJump}
              onContentSizeChange={() => {
                const section = sectionChips.find(
                  (chip) => chip.key === pendingInitialJump.current,
                );
                if (!section) return;
                if (jumpTimer.current) clearTimeout(jumpTimer.current);
                jumpTimer.current = setTimeout(
                  () => goToSection(section.key, false),
                  260,
                );
              }}
              contentContainerStyle={{ paddingBottom: settingsBottomPadding }}
            >
              {sections}
            </ScrollView>
            {searching ? (
              <ScrollView
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: theme.backgroundColor,
                }}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={{
                  padding: 14,
                  paddingBottom: settingsBottomPadding,
                }}
              >
                <Text
                  accessibilityLiveRegion="polite"
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    paddingBottom: 8,
                  }}
                >
                  {results.length
                    ? results.length + " matching settings"
                    : "No matching settings"}
                </Text>
                {results.map((entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      entry.label + ", " + entry.section.label
                    }
                    onPress={() => openResult(entry)}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      minHeight: 60,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                      opacity: pressed ? 0.6 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    })}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: theme.textColor,
                        }}
                      >
                        {entry.label}
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: theme.textSecondary }}
                      >
                        {entry.section.label}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
          <LevelAnalyticsExportModal />
          <AndroidVocabularyVoicePickerModal />
          <AndroidSrsProgressionCardModePickerModal />
          <ReminderTimeModal />
          <AnswerStopDetailsPreviewModal />
          <ReviewShortcutModal />
          <BunproSurveyModal />
          <CacheAnalysisModal />
          <NotificationsDebugModal />

          {__DEV__ && PerformanceDashboard ? (
            <PerformanceDashboard
              visible={showPerformanceDashboard}
              onClose={() => setShowPerformanceDashboard(false)}
            />
          ) : null}
        </View>
      </SettingsSectionAnchorContext.Provider>
    </SettingsSearchRegistryContext.Provider>
  );
}
