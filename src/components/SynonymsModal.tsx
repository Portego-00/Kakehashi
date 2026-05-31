import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSubjectColors } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

interface SynonymsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (synonyms: string[]) => Promise<void>;
  currentSynonyms: string[];
  subjectType?: "radical" | "kanji" | "vocabulary";
}

export const SynonymsModal: React.FC<SynonymsModalProps> = ({
  visible,
  onClose,
  onSave,
  currentSynonyms,
  subjectType = "kanji",
}) => {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const [synonyms, setSynonyms] = useState<string[]>(currentSynonyms);
  const [newSynonym, setNewSynonym] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const panelAnimation = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  // Get accent color based on subject type
  const accentColor =
    subjectType === "radical"
      ? subjectColors.radical
      : subjectType === "kanji"
      ? subjectColors.kanji
      : subjectColors.vocabulary;

  useEffect(() => {
    if (visible) {
      setSynonyms([...currentSynonyms]);
      setNewSynonym("");
      Animated.parallel([
        Animated.timing(panelAnimation, {
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
        Animated.timing(panelAnimation, {
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
  }, [visible, currentSynonyms]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(panelAnimation, {
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

  const handleAddSynonym = useCallback(() => {
    const trimmed = newSynonym.trim().toLowerCase();
    if (trimmed && !synonyms.includes(trimmed)) {
      setSynonyms((prev) => [...prev, trimmed]);
      setNewSynonym("");
    }
  }, [newSynonym, synonyms]);

  const handleRemoveSynonym = useCallback((synonym: string) => {
    setSynonyms((prev) => prev.filter((s) => s !== synonym));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(synonyms);
      animateClose();
    } catch (error) {
      console.error("Failed to save synonyms:", error);
    } finally {
      setIsSaving(false);
    }
  }, [synonyms, onSave, animateClose]);

  const hasChanges =
    JSON.stringify(synonyms.sort()) !==
    JSON.stringify([...currentSynonyms].sort());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={animateClose}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.panel,
            {
              transform: [
                {
                  translateY: panelAnimation.interpolate({
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
                Synonyms
              </Text>
              <TouchableOpacity onPress={animateClose} style={styles.closeButton}>
                <Ionicons
                  name="close-circle"
                  size={30}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: theme.textColor }]}
                  placeholder="Enter a synonym..."
                  placeholderTextColor={theme.textSecondary}
                  value={newSynonym}
                  onChangeText={setNewSynonym}
                  onSubmitEditing={handleAddSynonym}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    {
                      backgroundColor: accentColor,
                      opacity: newSynonym.trim() ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleAddSynonym}
                  disabled={!newSynonym.trim()}
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Synonyms List */}
            <View style={styles.synonymsSection}>
              {synonyms.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No synonyms added yet. Add synonyms to accept them as correct
                  answers during reviews.
                </Text>
              ) : (
                <View style={styles.synonymsContainer}>
                  {synonyms.map((synonym) => (
                    <View
                      key={synonym}
                      style={[
                        styles.synonymChip,
                        {
                          backgroundColor: theme.isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.synonymText, { color: theme.textColor }]}
                      >
                        {synonym}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveSynonym(synonym)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.cancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={animateClose}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  {
                    backgroundColor: accentColor,
                    opacity: hasChanges && !isSaving ? 1 : 0.5,
                  },
                ]}
                onPress={handleSave}
                activeOpacity={0.7}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.buttonText, { color: "white" }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  panel: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  synonymsSection: {
    minHeight: 100,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingVertical: 20,
  },
  synonymsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  synonymChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
    gap: 8,
  },
  synonymText: {
    fontSize: 15,
    fontWeight: "500",
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
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
