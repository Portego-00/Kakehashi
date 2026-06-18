import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_TEXT_SIZE_OPTIONS,
  DEFAULT_APP_TEXT_SIZE_SCALE,
  formatAppTextSizeScale,
  normalizeAppTextSizeScale,
  type AppTextSizeScale,
} from "../../src/utils/appTextSize";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

export default function AppTextSizeSettings() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const appTextSizeScale = useSettingsStore((state) => state.appTextSizeScale);
  const setAppTextSizeScale = useSettingsStore(
    (state) => state.setAppTextSizeScale,
  );
  const currentScale = normalizeAppTextSizeScale(appTextSizeScale);

  const resetTextSize = () => {
    setAppTextSizeScale(DEFAULT_APP_TEXT_SIZE_SCALE);
  };

  const selectTextSize = (scale: AppTextSizeScale) => {
    setAppTextSizeScale(scale);
  };

  const currentValueLabel = formatAppTextSizeScale(currentScale);

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
          App Text Size
        </Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetTextSize}
          accessibilityRole="button"
          accessibilityLabel="Reset app text size"
        >
          <Text style={[styles.resetButtonText, { color: theme.primary }]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sizeHeader}>
            <View style={styles.sizeTitleContainer}>
              <Text style={[styles.cardTitle, { color: theme.textColor }]}>
                Text Size
              </Text>
              <Text
                style={[styles.cardDescription, { color: theme.textSecondary }]}
              >
                Choose the app text size for this device.
              </Text>
            </View>
            <Text style={[styles.currentValue, { color: theme.primary }]}>
              {currentValueLabel}
            </Text>
          </View>

          <View
            style={[
              styles.optionList,
              {
                borderColor: theme.border,
                backgroundColor: theme.isDark ? "#161616" : "#f8f8f8",
              },
            ]}
          >
            {APP_TEXT_SIZE_OPTIONS.map((option, index) => {
              const isSelected = option.scale === currentScale;
              const isLast = index === APP_TEXT_SIZE_OPTIONS.length - 1;

              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionRow,
                    {
                      borderBottomColor: isLast
                        ? "transparent"
                        : theme.border,
                      backgroundColor: isSelected
                        ? theme.isDark
                          ? "rgba(76, 154, 255, 0.16)"
                          : "rgba(0, 122, 255, 0.08)"
                        : "transparent",
                    },
                  ]}
                  onPress={() => selectTextSize(option.scale)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${option.label}, ${formatAppTextSizeScale(
                    option.scale
                  )}`}
                >
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionTitle,
                        { color: theme.textColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionValue,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {formatAppTextSizeScale(option.scale)}
                  </Text>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSelected ? theme.primary : theme.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.textColor }]}>
            Preview
          </Text>
          <View
            style={[
              styles.previewPanel,
              {
                backgroundColor: theme.isDark ? "#161616" : "#f8f8f8",
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              selectable
              style={[
                styles.previewJapanese,
                {
                  color: theme.textColor,
                  fontSize: 34,
                  lineHeight: 44,
                },
              ]}
            >
              日本語
            </Text>
            <Text
              selectable
              style={[
                styles.previewReading,
                {
                  color: theme.textSecondary,
                  fontSize: 15,
                  lineHeight: 22,
                },
              ]}
            >
              kanji, vocabulary, and review details
            </Text>
            <Text
              selectable
              style={[
                styles.previewBody,
                {
                  color: theme.textColor,
                  fontSize: 17,
                  lineHeight: 25,
                },
              ]}
            >
              Learning on a larger display should feel comfortable without
              changing your system settings.
            </Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  resetButton: {
    width: 44,
    alignItems: "flex-end",
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sizeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  sizeTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  currentValue: {
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  optionList: {
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionTextContainer: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionValue: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  previewPanel: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
  },
  previewJapanese: {
    fontWeight: "800",
  },
  previewReading: {
    marginTop: 4,
    fontWeight: "600",
  },
  previewBody: {
    marginTop: 14,
  },
});
