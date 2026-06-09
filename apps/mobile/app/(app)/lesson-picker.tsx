import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LessonPicker, {
  LessonPickerItem,
} from "../../src/components/LessonPicker";
import { useSession } from "../../src/contexts/AuthContext";
import {
  getAvailableLessons,
  getAssignmentsOptimized,
  getSubjects,
} from "../../src/utils/api";
import { getRemainingDailyLessonSlots } from "../../src/utils/dailyLessonLimit";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const isLessonPickerSubjectObject = (
  object: string
): object is LessonPickerItem["subject"]["object"] =>
  object === "radical" ||
  object === "kanji" ||
  object === "vocabulary" ||
  object === "kana_vocabulary";

export default function LessonPickerScreen() {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const dailyLessonLimit = useSettingsStore((state) => state.dailyLessonLimit);
  const excludeKanaVocabularyFromLessons = useSettingsStore(
    (state) => state.excludeKanaVocabularyFromLessons
  );
  const { isLoading: isAuthLoading } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [allLessons, setAllLessons] = useState<LessonPickerItem[]>([]);

  const loadLessons = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch available lessons
      const lessonsResponse = await getAvailableLessons(apiToken);

      if (lessonsResponse.data.length === 0) {
        Alert.alert(
          "No Lessons Available",
          "You don't have any lessons available right now.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Extract subject IDs from assignments
      const subjectIds = lessonsResponse.data.map(
        (assignment) => assignment.data.subject_id
      );

      // Fetch subject data for these assignments
      const subjectsResponse = await getSubjects(
        apiToken,
        {
          ids: subjectIds,
        },
        { skipCollectionCache: true }
      );

      // Create lesson picker items by combining assignment and subject data
      const items: LessonPickerItem[] = [];

      lessonsResponse.data.forEach((assignment, index) => {
        const subject = subjectsResponse.data.find(
          (s) => s.id === assignment.data.subject_id
        );

        if (!subject) {
          console.error(
            `Could not find subject for assignment ${assignment.id}`
          );
          return;
        }
        if (!isLessonPickerSubjectObject(subject.object)) {
          return;
        }
        if (
          excludeKanaVocabularyFromLessons &&
          subject.object === "kana_vocabulary"
        ) {
          return;
        }

        items.push({
          id: index, // Use index to match with lessons screen
          assignmentId: assignment.id,
          subjectId: assignment.data.subject_id,
          subject: {
            id: subject.id,
            object: subject.object,
            data: {
              characters: subject.data.characters,
              meanings: subject.data.meanings,
              readings: subject.data.readings ?? undefined,
              level: subject.data.level,
              character_images: subject.data.character_images ?? undefined, // Include character images for radical SVG fallback
            },
          },
        });
      });

      if (items.length === 0) {
        Alert.alert(
          "No Lessons Available",
          "No lessons are available with your current kana vocabulary filter.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      setAllLessons(items);
    } catch (error) {
      console.error("Error loading lessons:", error);
      Alert.alert("Error", "Failed to load lessons. Please try again.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [apiToken, excludeKanaVocabularyFromLessons, isAuthLoading]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const navigateToLessons = useCallback((selectedLessons: LessonPickerItem[]) => {
    router.replace({
      pathname: "/lessons",
      params: {
        selectedLessonIds: JSON.stringify(selectedLessons.map((l) => l.id)),
      },
    });
  }, []);

  const handleStartLessons = useCallback(async (selectedLessons: LessonPickerItem[]) => {
    if (selectedLessons.length === 0) {
      Alert.alert(
        "No Lessons Selected",
        "Please select at least one lesson to start."
      );
      return;
    }

    if (dailyLessonLimit > 0 && apiToken) {
      try {
        const assignmentsResponse = await getAssignmentsOptimized(
          apiToken,
          {},
          { forceFullRefresh: false }
        );
        const remainingDailyLessonSlots = getRemainingDailyLessonSlots(
          dailyLessonLimit,
          assignmentsResponse.data
        );

        if (selectedLessons.length > remainingDailyLessonSlots) {
          const overBy = selectedLessons.length - remainingDailyLessonSlots;
          const lessonPlural = overBy === 1 ? "lesson" : "lessons";
          const slotPlural =
            remainingDailyLessonSlots === 1 ? "slot" : "slots";

          Alert.alert(
            "Daily Lesson Limit Warning",
            `You've selected ${selectedLessons.length} lessons, which is ${overBy} ${lessonPlural} over your remaining daily limit (${remainingDailyLessonSlots} ${slotPlural} left today).`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue",
                onPress: () => navigateToLessons(selectedLessons),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.warn(
          "[LessonPicker] Failed to validate daily lesson limit before start:",
          error
        );
      }
    }

    navigateToLessons(selectedLessons);
  }, [apiToken, dailyLessonLimit, navigateToLessons]);

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading lessons...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <LessonPicker
      lessons={allLessons}
      onStart={handleStartLessons}
      onCancel={handleCancel}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
