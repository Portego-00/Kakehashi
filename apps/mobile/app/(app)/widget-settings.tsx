import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type WidgetContentMode,
  type WidgetStreakGradientPreset,
  useAuthStore,
  useSettingsStore,
} from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import {
  getHomeWidgetScheduledUpdatesDebug,
  type HomeWidgetScheduledUpdatesDebugResult,
  updateHomeWidgetDisplayPreferences,
} from "../../src/widgets/homeWidget";

const WIDGET_CONTENT_OPTIONS: {
  value: WidgetContentMode;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "reviews",
    title: "Current & Upcoming Reviews",
    description: "Show available reviews, next review timing, and today total",
    icon: "time",
  },
  // {
  //   value: "critical",
  //   title: "Critical Items",
  //   description: "Show critical item count and recent mistakes context",
  //   icon: "warning",
  // },
  {
    value: "streak",
    title: "App Use Streak",
    description: "Show current streak, best streak, and freeze status",
    icon: "flame",
  },
];

const WIDGET_COLOR_MODE_OPTIONS: {
  value: WidgetStreakGradientPreset;
  title: string;
  description: string;
}[] = [
  {
    value: "automatic",
    title: "Automatic",
    description: "Changes by morning, afternoon, and night",
  },
  {
    value: "defaults",
    title: "Defaults",
    description: "Uses curated defaults for streak and review widgets",
  },
];

const WIDGET_STREAK_GRADIENT_OPTIONS: {
  value: WidgetStreakGradientPreset;
  label: string;
  preview: [string, string];
}[] = [
  { value: "sunset", label: "Sunset", preview: ["#FF7A18", "#FF3F6C"] },
  { value: "ocean", label: "Ocean", preview: ["#0EA5E9", "#4338CA"] },
  { value: "emerald", label: "Emerald", preview: ["#10B981", "#0F766E"] },
  { value: "violet", label: "Violet", preview: ["#A855F7", "#4C1D95"] },
  { value: "rose", label: "Rose", preview: ["#FB7185", "#BE185D"] },
  { value: "amber", label: "Amber", preview: ["#F59E0B", "#EA580C"] },
  { value: "aurora", label: "Aurora", preview: ["#06B6D4", "#22C55E"] },
  { value: "slate", label: "Slate", preview: ["#64748B", "#334155"] },
  { value: "skyline", label: "Skyline", preview: ["#38BDF8", "#A78BFA"] },
  { value: "obsidian", label: "Obsidian", preview: ["#111827", "#020617"] },
  { value: "graphite", label: "Graphite", preview: ["#374151", "#111827"] },
  {
    value: "midnightBloom",
    label: "Midnight Bloom",
    preview: ["#312E81", "#111827"],
  },
];

export default function WidgetSettings() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const userData = useAuthStore((state) => state.userData);
  const {
    widgetContentMode,
    setWidgetContentMode,
    widgetStreakGradient,
    setWidgetStreakGradient,
  } = useSettingsStore();
  const isIOS = Platform.OS === "ios";
  const isPortegoDebugUser =
    userData?.username?.trim().toLowerCase() === "portego";
  const [widgetDebugData, setWidgetDebugData] =
    useState<HomeWidgetScheduledUpdatesDebugResult | null>(null);
  const [isWidgetDebugLoading, setIsWidgetDebugLoading] = useState(false);
  const [widgetDebugLastRefreshedAt, setWidgetDebugLastRefreshedAt] =
    useState<Date | null>(null);

  const handleWidgetContentModeChange = (mode: WidgetContentMode) => {
    setWidgetContentMode(mode);
    updateHomeWidgetDisplayPreferences({
      contentMode: mode,
      isDarkTheme: isDark,
    });
  };

  const handleWidgetGradientChange = (preset: WidgetStreakGradientPreset) => {
    setWidgetStreakGradient(preset);
    updateHomeWidgetDisplayPreferences({
      streakGradientPreset: preset,
      isDarkTheme: isDark,
    });
  };

  const refreshWidgetDebugData = useCallback(async () => {
    if (!isIOS) {
      return;
    }

    setIsWidgetDebugLoading(true);
    try {
      const debugData = await getHomeWidgetScheduledUpdatesDebug();
      setWidgetDebugData(debugData);
      setWidgetDebugLastRefreshedAt(new Date());
    } catch {
      setWidgetDebugData({
        source: "none",
        generatedAt: new Date().toISOString(),
        entryCount: 0,
        entries: [],
        error: "Failed to load widget timeline entries.",
      });
      setWidgetDebugLastRefreshedAt(new Date());
    } finally {
      setIsWidgetDebugLoading(false);
    }
  }, [isIOS]);

  useEffect(() => {
    if (!isIOS || !isPortegoDebugUser) {
      return;
    }

    void refreshWidgetDebugData();
  }, [isIOS, isPortegoDebugUser, refreshWidgetDebugData]);

  const futureWidgetDebugEntries = useMemo(
    () =>
      (widgetDebugData?.entries ?? []).filter(
        (entry) => entry.isFuture,
      ),
    [widgetDebugData],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
            paddingTop: 60,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Home Widget
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Widget Content
          </Text>

          {isIOS ? (
            WIDGET_CONTENT_OPTIONS.map((option, index) => {
              const isSelected = widgetContentMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.settingItem,
                    {
                      borderBottomColor:
                        index === WIDGET_CONTENT_OPTIONS.length - 1
                          ? "transparent"
                          : theme.border,
                    },
                  ]}
                  onPress={() => handleWidgetContentModeChange(option.value)}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={theme.primary}
                    style={styles.settingIcon}
                  />
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingText, { color: theme.textColor }]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSelected ? theme.primary : theme.textSecondary}
                  />
                </TouchableOpacity>
              );
            })
          ) : (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="phone-portrait"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  iOS Home Screen Widgets
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Widget support is currently available on iOS devices.
                </Text>
              </View>
            </View>
          )}
        </View>

        {isIOS ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              Widget Theme
            </Text>
            <View style={styles.settingItemColumn}>
              <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                Choose a color mode first, or pick a manual gradient preset.
              </Text>
              <View style={styles.modeSelector}>
                {WIDGET_COLOR_MODE_OPTIONS.map((option) => {
                  const isSelected = widgetStreakGradient === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modeButton,
                        {
                          borderColor: isSelected ? theme.primary : theme.border,
                          backgroundColor: theme.cardBackground,
                        },
                      ]}
                      onPress={() => handleWidgetGradientChange(option.value)}
                    >
                      <View style={styles.modeTextContainer}>
                        <Text
                          style={[
                            styles.modeTitle,
                            { color: isSelected ? theme.primary : theme.textColor },
                          ]}
                        >
                          {option.title}
                        </Text>
                        <Text
                          style={[
                            styles.modeDescription,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={isSelected ? theme.primary : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text
                style={[
                  styles.manualSectionTitle,
                  { color: theme.textSecondary, borderTopColor: theme.border },
                ]}
              >
                Manual Gradient Presets
              </Text>
              <View style={styles.gradientSelector}>
                {WIDGET_STREAK_GRADIENT_OPTIONS.map((option) => {
                  const isSelected = widgetStreakGradient === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.gradientButton,
                        {
                          borderColor: isSelected ? theme.primary : theme.border,
                          backgroundColor: theme.cardBackground,
                        },
                      ]}
                      onPress={() => handleWidgetGradientChange(option.value)}
                    >
                      <View style={styles.gradientPreviewContainer}>
                        <LinearGradient
                          colors={option.preview as any}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientPreview}
                        />
                      </View>
                      <Text
                        style={[
                          styles.gradientLabel,
                          {
                            color: isSelected
                              ? theme.primary
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {isIOS && isPortegoDebugUser ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              Widget Debug
            </Text>
            <View style={styles.settingItemColumn}>
              <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                Portego-only tool: inspect currently scheduled home widget
                timeline updates.
              </Text>
              <TouchableOpacity
                style={[
                  styles.debugRefreshButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.cardBackground,
                    opacity: isWidgetDebugLoading ? 0.7 : 1,
                  },
                ]}
                onPress={() => {
                  void refreshWidgetDebugData();
                }}
                disabled={isWidgetDebugLoading}
              >
                <Text
                  style={[styles.debugRefreshText, { color: theme.primary }]}
                >
                  {isWidgetDebugLoading
                    ? "Refreshing…"
                    : "Refresh Scheduled Updates"}
                </Text>
                <Ionicons
                  name="refresh"
                  size={16}
                  color={theme.primary}
                />
              </TouchableOpacity>

              {widgetDebugLastRefreshedAt ? (
                <Text style={[styles.debugMetaText, { color: theme.textSecondary }]}>
                  Last refreshed{" "}
                  {widgetDebugLastRefreshedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              ) : null}

              {widgetDebugData ? (
                <View
                  style={[
                    styles.debugTimelineCard,
                    { borderColor: theme.border, backgroundColor: theme.backgroundColor },
                  ]}
                >
                  <Text style={[styles.debugMetaText, { color: theme.textSecondary }]}>
                    Source: {widgetDebugData.source} · {widgetDebugData.entryCount}{" "}
                    entries
                  </Text>
                  {widgetDebugData.error ? (
                    <Text style={[styles.debugErrorText, { color: theme.error }]}>
                      {widgetDebugData.error}
                    </Text>
                  ) : null}
                  {futureWidgetDebugEntries.length === 0 ? (
                    <Text
                      style={[styles.debugEmptyText, { color: theme.textSecondary }]}
                    >
                      No future widget updates are currently scheduled.
                    </Text>
                  ) : (
                    futureWidgetDebugEntries.map((entry, index) => {
                      const subtitle =
                        entry.mode === "reviews"
                          ? `${entry.reviewsCountValue} reviews · ${entry.reviewsSecondaryLabel}`
                          : `${entry.streakPrimaryLabel} · ${entry.streakSecondaryLabel} · ${entry.streakTertiaryLabel}`;

                      return (
                        <View
                          key={`${entry.timestamp}-${index}`}
                          style={[
                            styles.debugTimelineRow,
                            {
                              borderBottomColor: theme.border,
                              borderBottomWidth:
                                index === futureWidgetDebugEntries.length - 1
                                  ? 0
                                  : StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.debugTimelineTitle, { color: theme.textColor }]}
                          >
                            {entry.localDateLabel} · {entry.mode}
                          </Text>
                          <Text
                            style={[
                              styles.debugTimelineSubtitle,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {subtitle}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  content: {
    paddingTop: 16,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingItemColumn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
  },
  settingSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  gradientSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modeSelector: {
    marginTop: 10,
    gap: 10,
  },
  modeButton: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  manualSectionTitle: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gradientButton: {
    width: "31.5%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
  },
  gradientPreviewContainer: {
    width: "100%",
    height: 22,
    borderRadius: 6,
    overflow: "hidden",
  },
  gradientPreview: {
    width: "100%",
    height: 22,
  },
  gradientLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  debugRefreshButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  debugRefreshText: {
    fontSize: 13,
    fontWeight: "700",
  },
  debugMetaText: {
    marginTop: 8,
    fontSize: 12,
  },
  debugTimelineCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  debugTimelineRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  debugTimelineTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  debugTimelineSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  debugEmptyText: {
    marginTop: 8,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  debugErrorText: {
    marginTop: 8,
    fontSize: 12,
    paddingHorizontal: 10,
  },
});
