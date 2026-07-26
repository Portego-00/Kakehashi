import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../utils/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

type StudyMenuAction = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  systemImage: string;
  count?: number;
  disabled?: boolean;
  requiresList?: boolean;
  onPress: () => void;
};

type SubjectListStudyMenuProps = {
  selectedItemCount: number;
  selectedKanjiCount: number;
  hasSelectedLists: boolean;
  triggerStyle?: StyleProp<ViewStyle>;
  onStandardReview: () => void;
  onKanjiMatch: () => void;
  onCustomLessons: () => void;
  onRandomTest: () => void;
  onSimilarKanji: () => void;
  onKanjiWriting: () => void;
};

export default function SubjectListStudyMenu({
  selectedItemCount,
  selectedKanjiCount,
  hasSelectedLists,
  triggerStyle,
  onStandardReview,
  onKanjiMatch,
  onCustomLessons,
  onRandomTest,
  onSimilarKanji,
  onKanjiWriting,
}: SubjectListStudyMenuProps) {
  const { theme } = useTheme();
  const [isFallbackMenuVisible, setIsFallbackMenuVisible] = useState(false);
  const actions = useMemo<StudyMenuAction[]>(
    () => [
      {
        id: "review",
        label: "Standard Review",
        description: "Meaning and reading questions for all selected items",
        icon: "checkmark-circle-outline",
        systemImage: "checkmark.circle",
        count: selectedItemCount,
        onPress: onStandardReview,
      },
      {
        id: "kanji-match",
        label: "Kanji Match",
        description: "Connect selected kanji to their meanings",
        icon: "git-compare-outline",
        systemImage: "link",
        count: selectedKanjiCount,
        disabled: selectedKanjiCount < 2,
        onPress: onKanjiMatch,
      },
      {
        id: "lessons",
        label: "Custom Lessons",
        description: "Revisit lesson content for the selected items",
        icon: "school-outline",
        systemImage: "graduationcap",
        onPress: onCustomLessons,
      },
      {
        id: "random-test",
        label: "Random Test",
        description: "Configure a mixed test for this list",
        icon: "dice-outline",
        systemImage: "dice",
        requiresList: true,
        onPress: onRandomTest,
      },
      {
        id: "similar-kanji",
        label: "Similar Kanji",
        description: "Match lookalike kanji from this list",
        icon: "copy-outline",
        systemImage: "square.on.square",
        requiresList: true,
        onPress: onSimilarKanji,
      },
      {
        id: "kanji-writing",
        label: "Kanji Writing",
        description: "Configure writing practice for this list",
        icon: "brush-outline",
        systemImage: "pencil",
        requiresList: true,
        onPress: onKanjiWriting,
      },
    ],
    [
      onCustomLessons,
      onKanjiMatch,
      onKanjiWriting,
      onRandomTest,
      onSimilarKanji,
      onStandardReview,
      selectedItemCount,
      selectedKanjiCount,
    ],
  );
  const visibleActions = actions.filter(
    (action) => !action.requiresList || hasSelectedLists,
  );

  if (selectedItemCount === 0) {
    return (
      <View style={[styles.trigger, triggerStyle, { opacity: 0.35 }]}>
        <Ionicons
          name="play-circle-outline"
          size={24}
          color={theme.textSecondary}
        />
      </View>
    );
  }

  if (Platform.OS === "ios" && SwiftUI) {
    return (
      <SwiftUI.Host
        matchContents
        style={[styles.trigger, triggerStyle]}
      >
        <SwiftUI.Menu
          label={
            <SwiftUI.RNHostView matchContents>
              <View
                style={[
                  styles.trigger,
                  triggerStyle,
                  { backgroundColor: theme.cardBackground },
                ]}
                accessibilityLabel="Choose study mode"
              >
                <Ionicons
                  name="play-circle-outline"
                  size={24}
                  color={theme.textColor}
                />
              </View>
            </SwiftUI.RNHostView>
          }
        >
          {visibleActions
            .filter((action) => !action.disabled)
            .map((action) => (
              <SwiftUI.Button
                key={action.id}
                label={
                  action.count === undefined
                    ? action.label
                    : `${action.label} (${action.count})`
                }
                systemImage={action.systemImage}
                onPress={action.onPress}
              />
            ))}
        </SwiftUI.Menu>
      </SwiftUI.Host>
    );
  }

  const runFallbackAction = (action: StudyMenuAction) => {
    setIsFallbackMenuVisible(false);
    action.onPress();
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          triggerStyle,
          { backgroundColor: theme.cardBackground },
        ]}
        onPress={() => setIsFallbackMenuVisible(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Choose study mode"
      >
        <Ionicons
          name="play-circle-outline"
          size={24}
          color={theme.textColor}
        />
      </TouchableOpacity>

      <Modal
        visible={isFallbackMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFallbackMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.heading}>
                <Text style={[styles.title, { color: theme.textColor }]}>
                  Choose Study Mode
                </Text>
                <Text style={[styles.summary, { color: theme.textSecondary }]}>
                  {selectedItemCount} selected item
                  {selectedItemCount === 1 ? "" : "s"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsFallbackMenuVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close study mode menu"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.options}
              showsVerticalScrollIndicator={false}
            >
              {visibleActions.map((action, index) => (
                <React.Fragment key={action.id}>
                  {index === 3 ? (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: theme.border },
                      ]}
                    />
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.option,
                      action.disabled && styles.optionDisabled,
                    ]}
                    onPress={() => runFallbackAction(action)}
                    disabled={action.disabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: action.disabled }}
                  >
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={
                        action.disabled
                          ? theme.textLight
                          : theme.textSecondary
                      }
                    />
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionTitle,
                          {
                            color: action.disabled
                              ? theme.textLight
                              : theme.textColor,
                          },
                        ]}
                      >
                        {action.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {action.description}
                      </Text>
                    </View>
                    {action.count !== undefined ? (
                      <Text
                        style={[
                          styles.count,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {action.count}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "88%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  summary: {
    marginTop: 2,
    fontSize: 12,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  options: {
    flexShrink: 1,
  },
  option: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  count: {
    minWidth: 28,
    textAlign: "right",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
