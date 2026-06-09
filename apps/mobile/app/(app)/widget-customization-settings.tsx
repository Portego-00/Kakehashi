import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LessonsReviewsCard from "../../src/components/LessonsReviewsCard";
import UsageStreakCard from "../../src/components/UsageStreakCard";
import { type UsageStreakDay } from "../../src/hooks/useUsageStreak";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import {
  DEFAULT_WIDGET_CARD_STYLE_COLORS,
  normalizeWidgetCardColor,
  type WidgetCardStyleColorKey,
} from "../../src/utils/widgetCardStyles";

// Only import expo/ui on iOS - it uses SwiftUI which doesn't exist on Android
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

type WidgetCardKey = "lessons" | "reviews" | "streak";

type DraftState = Record<WidgetCardStyleColorKey, string>;

const WIDGET_CARD_OPTIONS: {
  key: WidgetCardKey;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "lessons", title: "Lesson Card", icon: "book-outline" },
  { key: "reviews", title: "Review Card", icon: "checkmark-done-outline" },
  { key: "streak", title: "App Streak", icon: "flame-outline" },
];

const CARD_COLOR_FIELDS: Record<
  WidgetCardKey,
  { key: WidgetCardStyleColorKey; label: string }[]
> = {
  lessons: [
    { key: "widgetLessonCardGradientStart", label: "Gradient Start" },
    { key: "widgetLessonCardGradientEnd", label: "Gradient End" },
  ],
  reviews: [
    { key: "widgetReviewCardGradientStart", label: "Gradient Start" },
    { key: "widgetReviewCardGradientEnd", label: "Gradient End" },
  ],
  streak: [
    { key: "widgetStreakCardGradientStart", label: "Gradient Start" },
    { key: "widgetStreakCardGradientMiddle", label: "Gradient Middle" },
    { key: "widgetStreakCardGradientEnd", label: "Gradient End" },
  ],
};

const PREVIEW_STREAK_DAYS: UsageStreakDay[] = [
  { dayKey: "preview-1", label: "M", active: true, isToday: false },
  { dayKey: "preview-2", label: "T", active: true, isToday: false },
  { dayKey: "preview-3", label: "W", active: false, isToday: false },
  { dayKey: "preview-4", label: "T", active: true, isToday: false },
  { dayKey: "preview-5", label: "F", active: true, isToday: false },
  { dayKey: "preview-6", label: "S", active: true, isToday: false },
  { dayKey: "preview-7", label: "S", active: true, isToday: true },
];

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toEditableHex(value: string): string {
  return normalizeWidgetCardColor(value, "#000000").replace(/^#/, "").toUpperCase();
}

export default function WidgetCustomizationSettings() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const widgetLessonCardFollowTheme = useSettingsStore(
    (state) => state.widgetLessonCardFollowTheme
  );
  const widgetReviewCardFollowTheme = useSettingsStore(
    (state) => state.widgetReviewCardFollowTheme
  );
  const widgetStreakCardFollowTheme = useSettingsStore(
    (state) => state.widgetStreakCardFollowTheme
  );
  const widgetLessonCardGradientStart = useSettingsStore(
    (state) => state.widgetLessonCardGradientStart
  );
  const widgetLessonCardGradientEnd = useSettingsStore(
    (state) => state.widgetLessonCardGradientEnd
  );
  const widgetReviewCardGradientStart = useSettingsStore(
    (state) => state.widgetReviewCardGradientStart
  );
  const widgetReviewCardGradientEnd = useSettingsStore(
    (state) => state.widgetReviewCardGradientEnd
  );
  const widgetStreakCardGradientStart = useSettingsStore(
    (state) => state.widgetStreakCardGradientStart
  );
  const widgetStreakCardGradientMiddle = useSettingsStore(
    (state) => state.widgetStreakCardGradientMiddle
  );
  const widgetStreakCardGradientEnd = useSettingsStore(
    (state) => state.widgetStreakCardGradientEnd
  );
  const widgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.widgetSrsBreakdownGroupStages
  );
  const setWidgetLessonCardFollowTheme = useSettingsStore(
    (state) => state.setWidgetLessonCardFollowTheme
  );
  const setWidgetReviewCardFollowTheme = useSettingsStore(
    (state) => state.setWidgetReviewCardFollowTheme
  );
  const setWidgetStreakCardFollowTheme = useSettingsStore(
    (state) => state.setWidgetStreakCardFollowTheme
  );
  const setWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.setWidgetSrsBreakdownGroupStages
  );
  const setWidgetCardStyleColor = useSettingsStore(
    (state) => state.setWidgetCardStyleColor
  );

  const activeColors = useMemo(
    () => ({
      widgetLessonCardGradientStart: normalizeWidgetCardColor(
        widgetLessonCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientStart
      ),
      widgetLessonCardGradientEnd: normalizeWidgetCardColor(
        widgetLessonCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientEnd
      ),
      widgetReviewCardGradientStart: normalizeWidgetCardColor(
        widgetReviewCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientStart
      ),
      widgetReviewCardGradientEnd: normalizeWidgetCardColor(
        widgetReviewCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientEnd
      ),
      widgetStreakCardGradientStart: normalizeWidgetCardColor(
        widgetStreakCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientStart
      ),
      widgetStreakCardGradientMiddle: normalizeWidgetCardColor(
        widgetStreakCardGradientMiddle,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientMiddle
      ),
      widgetStreakCardGradientEnd: normalizeWidgetCardColor(
        widgetStreakCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientEnd
      ),
    }),
    [
      widgetLessonCardGradientEnd,
      widgetLessonCardGradientStart,
      widgetReviewCardGradientEnd,
      widgetReviewCardGradientStart,
      widgetStreakCardGradientEnd,
      widgetStreakCardGradientMiddle,
      widgetStreakCardGradientStart,
    ]
  );

  const [selectedCard, setSelectedCard] = useState<WidgetCardKey>("lessons");
  const selectedCardFollowTheme =
    selectedCard === "lessons"
      ? widgetLessonCardFollowTheme
      : selectedCard === "reviews"
        ? widgetReviewCardFollowTheme
        : widgetStreakCardFollowTheme;

  const setCardFollowTheme = (card: WidgetCardKey, follow: boolean) => {
    if (card === "lessons") {
      setWidgetLessonCardFollowTheme(follow);
      return;
    }

    if (card === "reviews") {
      setWidgetReviewCardFollowTheme(follow);
      return;
    }

    setWidgetStreakCardFollowTheme(follow);
  };

  const [drafts, setDrafts] = useState<DraftState>({
    widgetLessonCardGradientStart: toEditableHex(
      activeColors.widgetLessonCardGradientStart
    ),
    widgetLessonCardGradientEnd: toEditableHex(
      activeColors.widgetLessonCardGradientEnd
    ),
    widgetReviewCardGradientStart: toEditableHex(
      activeColors.widgetReviewCardGradientStart
    ),
    widgetReviewCardGradientEnd: toEditableHex(
      activeColors.widgetReviewCardGradientEnd
    ),
    widgetStreakCardGradientStart: toEditableHex(
      activeColors.widgetStreakCardGradientStart
    ),
    widgetStreakCardGradientMiddle: toEditableHex(
      activeColors.widgetStreakCardGradientMiddle
    ),
    widgetStreakCardGradientEnd: toEditableHex(activeColors.widgetStreakCardGradientEnd),
  });

  useEffect(() => {
    setDrafts({
      widgetLessonCardGradientStart: toEditableHex(
        activeColors.widgetLessonCardGradientStart
      ),
      widgetLessonCardGradientEnd: toEditableHex(
        activeColors.widgetLessonCardGradientEnd
      ),
      widgetReviewCardGradientStart: toEditableHex(
        activeColors.widgetReviewCardGradientStart
      ),
      widgetReviewCardGradientEnd: toEditableHex(
        activeColors.widgetReviewCardGradientEnd
      ),
      widgetStreakCardGradientStart: toEditableHex(
        activeColors.widgetStreakCardGradientStart
      ),
      widgetStreakCardGradientMiddle: toEditableHex(
        activeColors.widgetStreakCardGradientMiddle
      ),
      widgetStreakCardGradientEnd: toEditableHex(
        activeColors.widgetStreakCardGradientEnd
      ),
    });
  }, [activeColors]);

  const applyColor = (key: WidgetCardStyleColorKey, value: string) => {
    const normalized = normalizeWidgetCardColor(
      value,
      DEFAULT_WIDGET_CARD_STYLE_COLORS[key]
    );
    setWidgetCardStyleColor(key, normalized);
    setDrafts((prev) => ({
      ...prev,
      [key]: toEditableHex(normalized),
    }));
  };

  const handleDraftChange = (key: WidgetCardStyleColorKey, nextDraft: string) => {
    const sanitized = nextDraft.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);

    setDrafts((prev) => ({
      ...prev,
      [key]: sanitized.toUpperCase(),
    }));

    if (sanitized.length === 6) {
      applyColor(key, sanitized);
    }
  };

  const handleDraftBlur = (key: WidgetCardStyleColorKey) => {
    const withHash = `#${drafts[key]}`;

    if (isValidHexColor(withHash)) {
      applyColor(key, withHash);
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: toEditableHex(activeColors[key]),
    }));
  };

  const resetDefaults = () => {
    setWidgetLessonCardFollowTheme(true);
    setWidgetReviewCardFollowTheme(true);
    setWidgetStreakCardFollowTheme(true);
    setWidgetSrsBreakdownGroupStages(false);
    (Object.keys(DEFAULT_WIDGET_CARD_STYLE_COLORS) as WidgetCardStyleColorKey[]).forEach(
      (key) => {
        setWidgetCardStyleColor(key, DEFAULT_WIDGET_CARD_STYLE_COLORS[key]);
      }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 60),
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
          Widget Customization
        </Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetDefaults}
          accessibilityRole="button"
          accessibilityLabel="Reset widget styles"
        >
          <Text style={[styles.resetButtonText, { color: theme.primary }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
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
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Card Styles
          </Text>
          <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
            Pick a card and customize its gradient colors.
          </Text>

          <View style={styles.segmentRow}>
            {WIDGET_CARD_OPTIONS.map((option) => {
              const selected = option.key === selectedCard;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.segmentButton,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected
                        ? theme.isDark
                          ? "rgba(58, 134, 255, 0.2)"
                          : "rgba(58, 134, 255, 0.12)"
                        : "transparent",
                    },
                  ]}
                  onPress={() => setSelectedCard(option.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${option.title}`}
                >
                  <Ionicons
                    name={option.icon}
                    size={14}
                    color={selected ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: selected ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {option.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRowCompact}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.inlineSwitchLabel, { color: theme.textColor }]}>
                Follow app theme for this card
              </Text>
            </View>
            <Switch
              value={selectedCardFollowTheme}
              onValueChange={(value) => setCardFollowTheme(selectedCard, value)}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor={selectedCardFollowTheme ? "#fff" : "#f4f3f4"}
            />
          </View>

          <View style={styles.switchRowCompact}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.inlineSwitchLabel, { color: theme.textColor }]}>
                Group Apprentice and Guru stages
              </Text>
              <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
                Applies to SRS chart, in-card details, and the SRS details page.
              </Text>
            </View>
            <Switch
              value={widgetSrsBreakdownGroupStages}
              onValueChange={setWidgetSrsBreakdownGroupStages}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor={widgetSrsBreakdownGroupStages ? "#fff" : "#f4f3f4"}
            />
          </View>

          <View style={styles.previewWrap}>
            {selectedCard === "streak" ? (
              <UsageStreakCard
                currentStreak={23}
                longestStreak={54}
                freezeAvailable
                freezeDaysUntilReload={0}
                recentDays={PREVIEW_STREAK_DAYS}
                isLoading={false}
                error={null}
              />
            ) : (
              <LessonsReviewsCard
                type={selectedCard}
                count={selectedCard === "lessons" ? 12 : 37}
                onPress={() => {}}
              />
            )}
          </View>

          {selectedCardFollowTheme ? (
            <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
              Disable theme follow for this card to edit its custom colors.
            </Text>
          ) : null}

          <View
            style={[
              styles.colorControlsWrap,
              { opacity: selectedCardFollowTheme ? 0.55 : 1 },
            ]}
            pointerEvents={selectedCardFollowTheme ? "none" : "auto"}
          >
            {CARD_COLOR_FIELDS[selectedCard].map((field) => {
              const colorValue = activeColors[field.key];

              return (
                <View key={field.key} style={[styles.colorRow, { borderColor: theme.border }]}>
                  <View style={styles.colorLabelWrap}>
                    <Text style={[styles.colorLabel, { color: theme.textColor }]}>
                      {field.label}
                    </Text>
                  </View>

                  <View style={styles.colorControlWrap}>
                    <View
                      style={[
                        styles.colorPreview,
                        { backgroundColor: colorValue, borderColor: theme.border },
                      ]}
                    />

                    {Platform.OS === "ios" && SwiftUI ? (
                      <SwiftUI.Host
                        matchContents
                        style={styles.colorPickerButtonHost}
                        colorScheme={theme.isDark ? "dark" : "light"}
                      >
                        <SwiftUI.ColorPicker
                          label=""
                          selection={colorValue}
                          supportsOpacity={false}
                          onSelectionChange={(value: string) =>
                            applyColor(field.key, value)
                          }
                        />
                      </SwiftUI.Host>
                    ) : (
                      <View style={styles.inputRow}>
                        <Text style={[styles.hashPrefix, { color: theme.textSecondary }]}>
                          #
                        </Text>
                        <TextInput
                          value={drafts[field.key]}
                          onChangeText={(text) => handleDraftChange(field.key, text)}
                          onBlur={() => handleDraftBlur(field.key)}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          maxLength={6}
                          style={[
                            styles.hexInput,
                            {
                              color: theme.textColor,
                              borderColor: theme.border,
                              backgroundColor: theme.isDark ? "#1f1f1f" : "#f6f6f6",
                            },
                          ]}
                          selectionColor={colorValue}
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
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
    justifyContent: "space-between",
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  resetButton: {
    minWidth: 56,
    alignItems: "flex-end",
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  switchRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  switchTextWrap: {
    flex: 1,
    gap: 4,
  },
  inlineSwitchLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  segmentButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  previewWrap: {
    marginTop: 4,
  },
  colorControlsWrap: {
    gap: 10,
  },
  colorRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  colorLabelWrap: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  colorControlWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorPickerButtonHost: {
    width: 32,
    height: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hashPrefix: {
    fontSize: 16,
    fontWeight: "600",
  },
  hexInput: {
    width: 96,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
