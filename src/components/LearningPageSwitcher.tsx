import * as Haptics from "expo-haptics";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { LearningPage } from "../utils/learningPages";
import { useTheme } from "../utils/theme";

type LearningPageSwitcherProps = {
  pages: readonly LearningPage[];
  activePageId: string | null;
  onSelectPage: (id: string | null) => void;
};

export default function LearningPageSwitcher({
  pages,
  activePageId,
  onSelectPage,
}: LearningPageSwitcherProps) {
  const { theme } = useTheme();
  const options = [{ id: null, name: "All" }, ...pages];

  return (
    <View style={[styles.container, { borderBottomColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
      >
        {options.map((option) => {
          const isActive = option.id === activePageId;
          return (
            <TouchableOpacity
              key={option.id ?? "default"}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${option.name} learning page`}
              onPress={() => {
                if (isActive) return;
                Haptics.selectionAsync();
                onSelectPage(option.id);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.primary : theme.cardBackground,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.chipText,
                  { color: isActive ? "#ffffff" : theme.textColor },
                ]}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
