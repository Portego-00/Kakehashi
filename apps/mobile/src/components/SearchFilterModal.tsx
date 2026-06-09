import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import SrsLevelIcon from "./SrsLevelIcon";
import { useSubjectColors } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

// Duplicate the type here to avoid circular dependency if it's not exported centrally
// In a real scenario, this should be imported from a shared types file
export type WaniKaniItemType =
  | "radical"
  | "kanji"
  | "vocabulary"
  | "kana_vocabulary";

export const DEFAULT_SEARCH_ITEM_TYPES: WaniKaniItemType[] = [
  "radical",
  "kanji",
  "vocabulary",
  "kana_vocabulary",
];
export const ALL_SEARCH_SRS_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface SearchFilters {
  minLevel: number;
  maxLevel: number;
  types: Set<WaniKaniItemType>;
  srsStages: Set<number>;
}

export const createDefaultSearchFilters = (): SearchFilters => ({
  minLevel: 1,
  maxLevel: 60,
  types: new Set(DEFAULT_SEARCH_ITEM_TYPES),
  srsStages: new Set(ALL_SEARCH_SRS_STAGES),
});

interface SearchFilterModalProps {
  visible: boolean;
  currentFilters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
}

export const SearchFilterModal: React.FC<SearchFilterModalProps> = ({
  visible,
  currentFilters,
  onClose,
  onApply,
}) => {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const [pendingFilters, setPendingFilters] = useState<SearchFilters | null>(
    null
  );

  // Animation values
  const filterPanelAnimation = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Picker states
  const [showMinLevelPicker, setShowMinLevelPicker] = useState(false);
  const [showMaxLevelPicker, setShowMaxLevelPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setPendingFilters({
        ...currentFilters,
        types: new Set(currentFilters.types),
        srsStages: new Set(currentFilters.srsStages ?? ALL_SEARCH_SRS_STAGES),
      });
      Animated.parallel([
        Animated.timing(filterPanelAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(filterPanelAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setPendingFilters(null);
      });
    }
  }, [visible, currentFilters]);

  // If panel is closing or not visible (and not animating out), we might want to return null,
  // but Modal handles visibility. However, we need 'visible' prop on Modal to be true until animation finishes?
  // Actually, 'visible' prop controls the Modal mounting. If we want exit animations, we need to keep the Modal visible
  // until the animation completes.
  // The provided code managed this by animating OUT first, then setting visible to false in `handleCloseFilters`.
  // Here, the parent controls `visible`. If parent sets visible=false immediately, correct exit animation won't play.
  // We need to coordinate closing:
  // 1. User clicks close -> call `handleClose`
  // 2. `handleClose` -> animate out -> then call `onClose` prop.
  // 3. Parent sets `visible` to false.

  // So we accept `visible` to triggering OPEN animation.
  // We need a local `modalVisible` to keep it open during exit animation?
  // Let's refine the flow:
  // If parent simply toggles `visible`, we need to detect `visible` changing from true to false?
  // That's tricky with React effects + animations.
  // BETTER: The component should expose a `close()` method or just handle the closing logic internally and call `onClose` when done.
  // But standard React props are declarative.
  // We will assume the parent passes `visible=true`. When user requests close, we handle animation and THEN call `onClose`.
  // If the parent forces `visible=false` externally, it might snap shut. That's acceptable for now or we can use `useEffect`.

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(filterPanelAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (pendingFilters) {
      onApply(pendingFilters);
    }
    animateClose();
  }, [pendingFilters, onApply, animateClose]);

  const handleFilterPress = useCallback((types: WaniKaniItemType[]) => {
    setPendingFilters((prev) => {
      if (!prev) return null;
      const newTypes = new Set(prev.types);
      const allSelected = types.every((type) => newTypes.has(type));
      if (allSelected) {
        types.forEach((type) => newTypes.delete(type));
      } else {
        types.forEach((type) => newTypes.add(type));
      }
      return { ...prev, types: newTypes };
    });
  }, []);

  const handleLevelChange = useCallback((min: number, max: number) => {
    setPendingFilters((prev) =>
      prev ? { ...prev, minLevel: min, maxLevel: max } : null
    );
  }, []);

  const handleSrsFilterPress = useCallback((stages: number[]) => {
    setPendingFilters((prev) => {
      if (!prev) return null;

      const nextStages = new Set(prev.srsStages);
      const allSelected = stages.every((stage) => nextStages.has(stage));

      if (allSelected) {
        stages.forEach((stage) => nextStages.delete(stage));
      } else {
        stages.forEach((stage) => nextStages.add(stage));
      }

      return { ...prev, srsStages: nextStages };
    });
  }, []);

  // We render the Modal always if visible is true, OR if we are animating out?
  // Let's rely on the parent keeping `visible` true until we call `onClose`.

  if (!visible && !pendingFilters) return null; // Simple optimization, though Modal handles it.

  const filtersToDisplay = pendingFilters || currentFilters;

  return (
    <Modal
      visible={visible} // Parent controls this. We assume parent waits for onClose to set false.
      transparent
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.filterPanelBackdrop, { opacity: backdropOpacity }]}
      >
        <TouchableWithoutFeedback onPress={animateClose}>
          <View style={styles.backdropTouchable} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Filter Panel */}
      <Animated.View
        style={[
          styles.filterPanel,
          {
            transform: [
              {
                translateY: filterPanelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView
          intensity={90}
          tint={theme.isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.filterPanelContent,
            {
              backgroundColor: theme.isDark
                ? "rgba(30,30,30,0.8)"
                : "rgba(255,255,255,0.8)",
            },
          ]}
        >
          {/* Modal handle */}
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              Filters
            </Text>
            <TouchableOpacity
              onPress={animateClose}
              style={styles.modalCloseButton}
            >
              <Ionicons
                name="close-circle"
                size={30}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text
              style={[
                styles.filterSectionTitle,
                { color: theme.textSecondary },
              ]}
            >
              Subject Types
            </Text>
            <View style={styles.typeFiltersRow}>
              {[
                {
                  id: "radical",
                  label: "Radicals",
                  color: subjectColors.radical,
                  mappedTypes: ["radical"] as WaniKaniItemType[],
                },
                {
                  id: "kanji",
                  label: "Kanji",
                  color: subjectColors.kanji,
                  mappedTypes: ["kanji"] as WaniKaniItemType[],
                },
                {
                  id: "vocabulary",
                  label: "Vocabulary",
                  color: subjectColors.vocabulary,
                  mappedTypes: [
                    "vocabulary",
                    "kana_vocabulary",
                  ] as WaniKaniItemType[],
                },
              ].map((type) => {
                const isSelected = type.mappedTypes.every((mappedType) =>
                  filtersToDisplay.types.has(mappedType)
                );
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? type.color
                          : theme.cardBackground,
                        borderColor: isSelected ? type.color : theme.border,
                      },
                    ]}
                    onPress={() => handleFilterPress(type.mappedTypes)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: isSelected ? "white" : theme.textColor,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text
              style={[
                styles.filterSectionTitle,
                { color: theme.textSecondary },
              ]}
            >
              Level Range
            </Text>

            <View style={styles.levelInputsRow}>
              <TouchableOpacity
                style={[
                  styles.levelInputCompact,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowMinLevelPicker(true)}
              >
                <Text
                  style={[
                    styles.levelInputLabelSmall,
                    { color: theme.textSecondary },
                  ]}
                >
                  Min Level
                </Text>
                <Text
                  style={[styles.levelInputValue, { color: theme.textColor }]}
                >
                  {filtersToDisplay.minLevel}
                </Text>
              </TouchableOpacity>

              <View style={styles.levelArrow}>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={theme.textLight}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.levelInputCompact,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowMaxLevelPicker(true)}
              >
                <Text
                  style={[
                    styles.levelInputLabelSmall,
                    { color: theme.textSecondary },
                  ]}
                >
                  Max Level
                </Text>
                <Text
                  style={[styles.levelInputValue, { color: theme.textColor }]}
                >
                  {filtersToDisplay.maxLevel}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickLevelsScroll}
            >
              {[
                { min: 1, max: 10, label: "1-10" },
                { min: 11, max: 20, label: "11-20" },
                { min: 21, max: 30, label: "21-30" },
                { min: 31, max: 40, label: "31-40" },
                { min: 41, max: 50, label: "41-50" },
                { min: 51, max: 60, label: "51-60" },
                { min: 1, max: 60, label: "All" },
              ].map((range, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.quickLevelChip,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => {
                    handleLevelChange(range.min, range.max);
                  }}
                >
                  <Text
                    style={[styles.quickLevelText, { color: theme.textColor }]}
                  >
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text
              style={[
                styles.filterSectionTitle,
                { color: theme.textSecondary },
              ]}
            >
              SRS Levels
            </Text>
            <View style={styles.srsFiltersGrid}>
              {[
                {
                  key: "not-started",
                  label: "Not Started",
                  stages: [0],
                  color: "#6b7280",
                  iconLevel: null as string | null,
                },
                {
                  key: "apprentice",
                  label: "Apprentice",
                  stages: [1, 2, 3, 4],
                  color: "#dd0093",
                  iconLevel: "Apprentice",
                },
                {
                  key: "guru",
                  label: "Guru",
                  stages: [5, 6],
                  color: "#882d9e",
                  iconLevel: "Guru",
                },
                {
                  key: "master",
                  label: "Master",
                  stages: [7],
                  color: "#294dd1",
                  iconLevel: "Master",
                },
                {
                  key: "enlightened",
                  label: "Enlight.",
                  stages: [8],
                  color: "#0093dd",
                  iconLevel: "Enlightened",
                },
                {
                  key: "burned",
                  label: "Burned",
                  stages: [9],
                  color: "#434343",
                  iconLevel: "Burned",
                },
              ].map((group) => {
                const isSelected = group.stages.every((stage) =>
                  filtersToDisplay.srsStages.has(stage)
                );
                const iconColor = isSelected ? "white" : group.color;

                return (
                  <TouchableOpacity
                    key={group.key}
                    style={[
                      styles.srsChip,
                      {
                        backgroundColor: isSelected
                          ? group.color
                          : theme.cardBackground,
                        borderColor: isSelected ? group.color : theme.border,
                      },
                    ]}
                    onPress={() => handleSrsFilterPress(group.stages)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${group.label} SRS filter`}
                  >
                    {group.iconLevel ? (
                      <SrsLevelIcon
                        level={group.iconLevel}
                        size={12}
                        color={iconColor}
                      />
                    ) : (
                      <Ionicons
                        name="lock-closed-outline"
                        size={12}
                        color={iconColor}
                      />
                    )}
                    <Text
                      style={[
                        styles.srsChipLabel,
                        {
                          color: isSelected ? "white" : theme.textColor,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalCancelButton,
                { borderColor: theme.border },
              ]}
              onPress={animateClose}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modalButtonText, { color: theme.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalApplyButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalButtonText, { color: "white" }]}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Min Level Picker Modal */}
      <Modal
        visible={showMinLevelPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMinLevelPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMinLevelPicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.pickerModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <View style={styles.pickerModalHeader}>
                  <TouchableOpacity
                    onPress={() => setShowMinLevelPicker(false)}
                  >
                    <Text
                      style={[
                        styles.pickerCancelText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.pickerModalTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Select Minimum Level
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowMinLevelPicker(false)}
                  >
                    <Text
                      style={[styles.pickerDoneText, { color: theme.primary }]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
                <Picker
                  selectedValue={filtersToDisplay.minLevel}
                  onValueChange={(value) =>
                    handleLevelChange(value, filtersToDisplay.maxLevel)
                  }
                  style={[styles.picker, { color: theme.textColor }]}
                  itemStyle={[styles.pickerItem, { color: theme.textColor }]}
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((level) => (
                    <Picker.Item
                      key={`min-level-${level}`}
                      label={`Level ${level}`}
                      value={level}
                    />
                  ))}
                </Picker>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Max Level Picker Modal */}
      <Modal
        visible={showMaxLevelPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMaxLevelPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMaxLevelPicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.pickerModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <View style={styles.pickerModalHeader}>
                  <TouchableOpacity
                    onPress={() => setShowMaxLevelPicker(false)}
                  >
                    <Text
                      style={[
                        styles.pickerCancelText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.pickerModalTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Select Maximum Level
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowMaxLevelPicker(false)}
                  >
                    <Text
                      style={[styles.pickerDoneText, { color: theme.primary }]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
                <Picker
                  selectedValue={filtersToDisplay.maxLevel}
                  onValueChange={(value) =>
                    handleLevelChange(filtersToDisplay.minLevel, value)
                  }
                  style={[styles.picker, { color: theme.textColor }]}
                  itemStyle={[styles.pickerItem, { color: theme.textColor }]}
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((level) => (
                    <Picker.Item
                      key={`max-level-${level}`}
                      label={`Level ${level}`}
                      value={level}
                    />
                  ))}
                </Picker>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  filterPanelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 998,
  },
  backdropTouchable: {
    flex: 1,
  },
  filterPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 100000,
  },
  filterPanelContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  modalCloseButton: {
    padding: 4,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeFiltersRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 15,
  },
  levelInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  levelInputCompact: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  levelInputLabelSmall: {
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "600",
    opacity: 0.7,
  },
  levelInputValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  levelArrow: {
    width: 24,
    alignItems: "center",
  },
  quickLevelsScroll: {
    gap: 10,
    paddingRight: 20,
  },
  quickLevelChip: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  quickLevelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  srsFiltersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  srsChip: {
    flexBasis: "31.8%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  srsChipLabel: {
    fontSize: 11,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  modalApplyButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  pickerCancelText: {
    fontSize: 17,
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: "600",
  },
  picker: {
    width: "100%",
    height: 216,
  },
  pickerItem: {
    fontSize: 20,
  },
});
