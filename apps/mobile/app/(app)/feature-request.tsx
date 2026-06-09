import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../../src/utils/theme";

export default function FeatureRequestScreen() {
  const { theme } = useTheme();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const categories = [
    "Study Experience",
    "Review System",
    "Statistics", 
    "User Interface",
    "Performance",
    "New Feature"
  ];

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(
        selectedCategories.filter((item) => item !== category)
      );
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const resetForm = () => {
    setSelectedCategories([]);
    setMessage("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    resetForm();
    router.back();
  };

  const handleTextInputFocus = () => {
    setTimeout(() => {
      textInputRef.current?.measureInWindow((x, y, width, height) => {
        scrollViewRef.current?.scrollTo({
          y: y - 100, // Scroll a bit above the input
          animated: true,
        });
      });
    }, 100);
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0 && message.trim() === "") {
      Alert.alert("Error", "Please select at least one category or add a description.");
      return;
    }

    setIsSubmitting(true);

    try {
      const FORMSPREE_ENDPOINT = "https://formspree.io/f/xblkalbk";
      
      const featureData = {
        type: "Feature Request",
        categories: selectedCategories.join(", "),
        message: message.trim(),
        timestamp: new Date().toISOString(),
        app: "Kakehashi"
      };
      
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(featureData),
      });
      
      if (response.ok) {
        Alert.alert(
          "Feature Request Sent",
          "Thank you for your suggestion! We'll consider it for future updates.",
          [
            {
              text: "OK",
              onPress: handleClose
            }
          ]
        );
      } else {
        throw new Error("Failed to submit");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send feature request. Please check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={theme.statusBarStyle} />
      
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Request Feature
        </Text>
        <TouchableOpacity 
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[styles.submitHeaderButton, { opacity: isSubmitting ? 0.6 : 1 }]}
        >
          <Text style={[styles.submitHeaderText, { color: theme.primary }]}>
            {isSubmitting ? "Sending..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            What area would this improve?
          </Text>
          
          <View style={styles.categoriesContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategories.includes(category)
                      ? theme.primary + "20"
                      : theme.backgroundColor,
                    borderColor: selectedCategories.includes(category)
                      ? theme.primary
                      : theme.border,
                  },
                ]}
                onPress={() => toggleCategory(category)}
              >
                <Ionicons
                  name={selectedCategories.includes(category) ? "checkmark-circle" : "add-circle-outline"}
                  size={16}
                  color={selectedCategories.includes(category) ? theme.primary : theme.textSecondary}
                  style={styles.chipIcon}
                />
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: selectedCategories.includes(category)
                        ? theme.primary
                        : theme.textColor,
                    },
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Describe your feature idea
          </Text>
          
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                color: theme.textColor,
                borderColor: theme.border,
                backgroundColor: theme.backgroundColor,
              },
            ]}
            multiline
            numberOfLines={8}
            placeholder="What feature would you like to see? How would it work?"
            placeholderTextColor={theme.textSecondary}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
            onFocus={handleTextInputFocus}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "Sending Request..." : "Send Request"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
    width: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  submitHeaderButton: {
    padding: 4,
    width: 60,
    alignItems: "flex-end",
  },
  submitHeaderText: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    padding: 20,
    paddingBottom: 16,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  chipIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
  },
  textInput: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 150,
  },
  submitButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 40,
  },
  submitButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
