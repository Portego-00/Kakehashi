import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTheme } from "../utils/theme";

export interface FilterOption {
  id: string | number;
  label: string;
}

export interface FilterSection {
  id: string;
  title: string;
  options: FilterOption[];
}

interface CommonFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (values: Record<string, any>) => void;
  currentValues: Record<string, any>;
  sections: FilterSection[];
  title?: string;
  applyButtonLabel?: string;
}

export const CommonFilterModal: React.FC<CommonFilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentValues,
  sections,
  title = "Filters",
  applyButtonLabel = "Apply Filters",
}) => {
  const { theme } = useTheme();
  const [pendingValues, setPendingValues] =
    useState<Record<string, any>>(currentValues);

  const filterPanelAnimation = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPendingValues({ ...currentValues });
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
      ]).start();
    }
  }, [visible, currentValues, filterPanelAnimation, backdropOpacity]);

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
  }, [onClose, filterPanelAnimation, backdropOpacity]);

  const handleApply = useCallback(() => {
    onApply(pendingValues);
    animateClose();
  }, [pendingValues, onApply, animateClose]);

  const handleOptionPress = (sectionId: string, optionId: string | number) => {
    setPendingValues((prev) => ({
      ...prev,
      [sectionId]: optionId,
    }));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableWithoutFeedback onPress={animateClose}>
          <View style={styles.backdropTouchable} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
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
            styles.content,
            {
              backgroundColor: theme.isDark
                ? "rgba(30,30,30,0.8)"
                : "rgba(255,255,255,0.8)",
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textColor }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={animateClose} style={styles.closeButton}>
              <Ionicons
                name="close-circle"
                size={30}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                {section.title}
              </Text>
              <View style={styles.optionsRow}>
                {section.options.map((option) => {
                  const isSelected = pendingValues[section.id] === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                          borderColor: isSelected
                            ? theme.primary
                            : "transparent",
                        },
                      ]}
                      onPress={() => handleOptionPress(section.id, option.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? "white" : theme.textSecondary,
                            fontWeight: isSelected ? "700" : "500",
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
          ))}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { borderColor: theme.border },
              ]}
              onPress={animateClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.applyButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: "white" }]}>
                {applyButtonLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
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
  panel: {
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
    zIndex: 1000,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 15,
  },
  footer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  applyButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
