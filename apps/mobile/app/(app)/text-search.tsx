import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTheme } from "../../src/utils/theme";

type SearchMode = "japanese" | "english";

export default function TextSearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("japanese");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const buttonScaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    // Fade in animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Focus the text input on mount
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 300);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleShowHistory = useCallback(() => {
    router.push("/text-history");
  }, [router]);

  const handleModeChange = (index: number) => {
    const mode: SearchMode = index === 0 ? "japanese" : "english";
    setSearchMode(mode);
  };

  const handleClearText = useCallback(() => {
    setInputText("");
    textInputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsSubmitting(true);
    Keyboard.dismiss();

    // Navigate to results screen
    router.push({
      pathname: "/text-results",
      params: {
        inputText: trimmedText,
        sourceLanguage: searchMode,
      },
    });

    setIsSubmitting(false);
  }, [inputText, searchMode, router, buttonScaleAnim]);

  const canSubmit = inputText.trim().length > 0 && !isSubmitting;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundColor, opacity: fadeAnim },
        ]}
      >
        {/* Header */}
        <View
          style={[styles.header, { backgroundColor: theme.backgroundColor }]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Text Search
          </Text>
          <TouchableOpacity
            onPress={handleShowHistory}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={24} color={theme.textColor} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Mode Selection */}
          <View style={styles.modeContainer}>
            <View
              style={[
                styles.segmentedControlWrapper,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <SegmentedControl
                values={["日本語", "English"]}
                selectedIndex={searchMode === "japanese" ? 0 : 1}
                onChange={(event) =>
                  handleModeChange(event.nativeEvent.selectedSegmentIndex)
                }
                style={styles.segmentedControl}
                tintColor={theme.primary}
                backgroundColor={theme.cardBackground}
                fontStyle={{
                  color: theme.textSecondary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
                activeFontStyle={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "700",
                }}
              />
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, { color: theme.textColor }]}>
              {searchMode === "japanese"
                ? "Enter Japanese Text"
                : "Enter English Text"}
            </Text>
            <Text
              style={[styles.instructionsSubtitle, { color: theme.textSecondary }]}
            >
              {searchMode === "japanese"
                ? "Type or paste Japanese text to find vocabulary and kanji matches"
                : "Type English text - it will be translated to Japanese to find matches"}
            </Text>
          </View>

          {/* Text Input Area */}
          <View style={styles.inputSection}>
            <View
              style={[
                styles.textInputContainer,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
              ]}
            >
              <TextInput
                ref={textInputRef}
                style={[styles.textInput, { color: theme.textColor }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  searchMode === "japanese"
                    ? "日本語のテキストを入力..."
                    : "Enter English text..."
                }
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={1000}
              />
              {inputText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearText}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Character count */}
            <Text style={[styles.charCount, { color: inputText.length >= 1000 ? theme.error : theme.textSecondary }]}>
              {inputText.length}/1000
            </Text>
          </View>

          {/* Submit Button */}
          <Animated.View
            style={[
              styles.submitButtonContainer,
              { transform: [{ scale: buttonScaleAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: canSubmit ? theme.primary : theme.textSecondary,
                  opacity: canSubmit ? 1 : 0.5,
                },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Analyze Text</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </TouchableWithoutFeedback>
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
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 24,
  },
  modeContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  segmentedControlWrapper: {
    borderRadius: 25,
    padding: 4,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedControl: {
    width: 260,
    borderRadius: 25,
  },
  instructionsContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  instructionsSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  inputSection: {
    flex: 1,
    marginBottom: 16,
  },
  textInputContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 200,
    maxHeight: 300,
    position: "relative",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
  },
  clearButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  charCount: {
    textAlign: "right",
    marginTop: 8,
    fontSize: 12,
  },
  submitButtonContainer: {
    marginBottom: 24,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    gap: 8,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
});
