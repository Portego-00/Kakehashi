import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import OpenSourceModal from "../../components/OpenSourceModal";
import {
  SettingsControllerProvider,
  useSettingsControllerContext,
} from "./SettingsControllerContext";
import { useSettingsController } from "./useSettingsController";
import { styles } from "./styles";
import { SupportSection } from "./sections/SupportSection";
import { VoiceSettingsSection } from "./sections/VoiceSettingsSection";
import { VocabularyContextSection } from "./sections/VocabularyContextSection";
import { ReadingDefaultsSection } from "./sections/ReadingDefaultsSection";
import { MusicPlaybackSection } from "./sections/MusicPlaybackSection";
import { LessonSettingsSection } from "./sections/LessonSettingsSection";
import { SubjectListsSection } from "./sections/SubjectListsSection";
import { ReviewSettingsSection } from "./sections/ReviewSettingsSection";
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
import { VoiceSelectionModal } from "./modals/VoiceSelectionModal";
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

function SettingsScreenContent() {
  const {
    PerformanceDashboard,
    handleBack,
    handleSettingsScroll,
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
  } = useSettingsControllerContext();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <OpenSourceModal
        visible={showOpenSourceModal}
        onClose={() => setShowOpenSourceModal(false)}
      />

      <View
        style={[styles.header, { backgroundColor: theme.headerBackground }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>
          Settings
        </Text>
      </View>

      <View
        style={[
          styles.sectionChipBar,
          {
            borderBottomColor: theme.border,
            backgroundColor: theme.backgroundColor,
          },
        ]}
        onLayout={(event) => {
          setSectionChipBarWidth(event.nativeEvent.layout.width);
        }}
      >
        <ScrollView
          ref={sectionChipScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionChipContent}
        >
          {sectionChips.map((sectionChip) => {
            const isSelected = selectedSectionKey === sectionChip.key;

            return (
              <TouchableOpacity
                key={sectionChip.key}
                style={[
                  styles.sectionChip,
                  {
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected
                      ? theme.primary
                      : theme.cardBackground,
                  },
                ]}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  updateSectionChipLayout(sectionChip.key, x, width);
                }}
                onPress={() => {
                  scrollToSection(sectionChip.key, true);
                }}
              >
                <Ionicons
                  name={sectionChip.icon}
                  size={14}
                  color={isSelected ? "#fff" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.sectionChipText,
                    { color: isSelected ? "#fff" : theme.textColor },
                  ]}
                >
                  {sectionChip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        ref={scrollViewRef}
        onScroll={handleSettingsScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: settingsBottomPadding }}
      >
        <SupportSection />
        <VoiceSettingsSection />
        <VocabularyContextSection />
        <ReadingDefaultsSection />
        <MusicPlaybackSection />
        <LessonSettingsSection />
        <SubjectListsSection />
        <ReviewSettingsSection />
        <HapticSection />
        <KanjiLearningSection />
        <UserProfileSection />
        <AppearanceSection />
        <ThemeSection />
        <WidgetSection />
        <NotificationsSection />
        <DataStorageSection />
        <LevelRecapSection />
        <PatreonSupportersSection />
        <AccountSection />
        <ApiDebugSection />
      </ScrollView>

      <LevelAnalyticsExportModal />
      <AndroidVocabularyVoicePickerModal />
      <AndroidSrsProgressionCardModePickerModal />
      <ReminderTimeModal />
      <AnswerStopDetailsPreviewModal />
      <ReviewShortcutModal />
      <BunproSurveyModal />
      <VoiceSelectionModal />
      <CacheAnalysisModal />
      <NotificationsDebugModal />

      {__DEV__ && PerformanceDashboard ? (
        <PerformanceDashboard
          visible={showPerformanceDashboard}
          onClose={() => setShowPerformanceDashboard(false)}
        />
      ) : null}
    </View>
  );
}
