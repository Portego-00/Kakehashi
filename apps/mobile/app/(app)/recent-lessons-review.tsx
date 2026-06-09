import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import RecentLessonsResultsScreen from "../../src/components/RecentLessonsResultsScreen";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import { Subject } from "../../src/types/wanikani";
import { getStudyMaterials, type Assignment } from "../../src/utils/api";
import {
  filterRecentLessonAssignments,
  getRecentLessonsWindowLabel,
  resolveRecentLessonsWindow,
} from "../../src/utils/recentLessonsWindow";
import {
  GroupedReviewItem,
  prepareReviewData,
  shuffleArray,
} from "../../src/utils/reviewUtils";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Define interface for question
interface Question {
  type: "meaning" | "reading";
  itemId: number;
}

export default function RecentLessonsReview() {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    acceptUserSynonymsAsAnswers,
    reviewQuestionOrderEnabled,
    meaningFirst,
  } = useSettingsStore();
  const effectiveAnkiGrouping =
    ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both";
  const preferredQuestionType: "meaning" | "reading" = meaningFirst
    ? "meaning"
    : "reading";
  const params = useLocalSearchParams<{ window?: string | string[]; days?: string | string[] }>();
  const recentLessonsWindow = useMemo(
    () => resolveRecentLessonsWindow({ window: params.window, days: params.days }),
    [params.window, params.days],
  );
  const recentLessonsWindowLabel = useMemo(
    () => getRecentLessonsWindowLabel(recentLessonsWindow),
    [recentLessonsWindow],
  );
  const { dashboardData, isLoading: dashboardLoading } = useDashboardData();
  const [isPreparing, setIsPreparing] = useState(true);
  const [loadedWindow, setLoadedWindow] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<GroupedReviewItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState<
    Record<number, { meaning: number; reading: number }>
  >({});
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [answeredParts, setAnsweredParts] = useState<
    Record<number, { meaning: boolean; reading: boolean }>
  >({});
  const [answeredIncorrectly, setAnsweredIncorrectly] = useState<
    Record<number, { meaning: boolean; reading: boolean }>
  >({});
  const [answerStats, setAnswerStats] = useState({
    answered: 0,
    correct: 0,
    completedItems: 0,
    meaningAttempts: 0,
    readingAttempts: 0,
    meaningCorrect: 0,
    readingCorrect: 0,
  });
  const [allCompleted, setAllCompleted] = useState(false);

  // Wrap up mode state
  const [isWrapUpMode, setIsWrapUpMode] = useState(false);
  const [studyMaterialsMap, setStudyMaterialsMap] = useState<Map<number, { meaning_synonyms?: string[] }>>(new Map());

  // Handler for when a synonym is added from the review screen
  const handleSynonymAdded = useCallback((subjectId: number, newSynonyms: string[]) => {
    setStudyMaterialsMap(prev => {
      const updated = new Map(prev);
      updated.set(subjectId, { meaning_synonyms: newSynonyms });
      return updated;
    });
  }, []);

  const WRAP_UP_TARGET_SUBJECTS = 10;

  // Helper function to get remaining subjects count
  const getRemainingSubjectsCount = useCallback(() => {
    const remainingQuestions = questions.slice(currentQuestionIndex);
    const uniqueSubjectIds = new Set(remainingQuestions.map((q) => q.itemId));
    return uniqueSubjectIds.size;
  }, [questions, currentQuestionIndex]);

  // Check if wrap up is available (more than target subjects remaining)
  const isWrapUpAvailable =
    getRemainingSubjectsCount() > WRAP_UP_TARGET_SUBJECTS;

  // Generate non-randomized questions for recent lessons (meaning and reading back-to-back)
  const generateSequentialQuestions = useCallback((
    items: GroupedReviewItem[]
  ): Question[] => {
    const questions: Question[] = [];
    const forceReadingFirst =
      reviewQuestionOrderEnabled && preferredQuestionType === "reading";

    // For each item, add meaning first, then reading (if applicable)
    items.forEach((item) => {
      if (effectiveAnkiGrouping && item.readingQuestion) {
        // In anki grouped mode, only add one "meaning" question per subject
        // The ReviewQuestionScreen will handle showing both meaning and reading
        questions.push({ type: "meaning", itemId: item.id });
      } else {
        if (item.readingQuestion && forceReadingFirst) {
          questions.push({ type: "reading", itemId: item.id });
          questions.push({ type: "meaning", itemId: item.id });
        } else {
          // Regular mode - add meaning first, then reading (if applicable)
          questions.push({ type: "meaning", itemId: item.id });
          if (item.readingQuestion) {
            questions.push({ type: "reading", itemId: item.id });
          }
        }
      }
    });

    // Don't shuffle - keep meaning and reading together
    return questions;
  }, [effectiveAnkiGrouping, reviewQuestionOrderEnabled, preferredQuestionType]);

  // Wrap up mode: reorder remaining questions to complete exactly WRAP_UP_TARGET_SUBJECTS more subjects
  const handleWrapUp = useCallback(() => {
    if (isWrapUpMode) return; // Already in wrap up mode

    console.log("[Recent Lessons Wrap Up] Activating wrap up mode");
    setIsWrapUpMode(true);

    // Build all remaining questions after the current one
    const remainingQuestions = questions.slice(currentQuestionIndex);
    const currentQuestion = questions[currentQuestionIndex];
    const questionsAfterCurrent = currentQuestion
      ? remainingQuestions.filter((q) => q !== currentQuestion)
      : remainingQuestions;

    // Ordered unique subject ids as they appear in the remaining queue
    const orderedSubjectIds: number[] = [];
    for (const q of questionsAfterCurrent) {
      if (!orderedSubjectIds.includes(q.itemId))
        orderedSubjectIds.push(q.itemId);
    }

    // Helper to check partial completion for a subject
    const isSubjectPartial = (subjectId: number): boolean => {
      const parts = answeredParts[subjectId];
      const subjectItem = reviewItems.find((item) => item.id === subjectId);
      if (!subjectItem) return false;
      const isRadical = !subjectItem.readingQuestion; // radicals are single-part
      if (isRadical) return false;
      return Boolean(parts) && parts.meaning !== parts.reading;
    };

    // Helper to check not-started for a subject
    const isSubjectNotStarted = (subjectId: number): boolean => {
      const parts = answeredParts[subjectId];
      const subjectItem = reviewItems.find((item) => item.id === subjectId);
      if (!subjectItem) return false;
      const isRadical = !subjectItem.readingQuestion;
      if (isRadical) {
        return !parts?.meaning;
      }
      return !parts?.meaning && !parts?.reading;
    };

    // Build the set of target subject ids (max WRAP_UP_TARGET_SUBJECTS)
    const targetSubjectIds: number[] = [];
    const pushTarget = (sid: number) => {
      if (
        !targetSubjectIds.includes(sid) &&
        targetSubjectIds.length < WRAP_UP_TARGET_SUBJECTS
      ) {
        targetSubjectIds.push(sid);
      }
    };

    // Always include the current subject first if present
    if (currentQuestion) pushTarget(currentQuestion.itemId);

    // Prioritize partially completed subjects in queue order
    for (const sid of orderedSubjectIds) {
      if (isSubjectPartial(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    // Fill remaining slots with not-started subjects in queue order
    for (const sid of orderedSubjectIds) {
      if (!isSubjectPartial(sid) && isSubjectNotStarted(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    // As a final fallback, include any other pending subjects by queue order
    for (const sid of orderedSubjectIds) {
      if (!targetSubjectIds.includes(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    console.log(
      `[Recent Lessons Wrap Up] Target subjects (${targetSubjectIds.length}):`,
      targetSubjectIds
    );

    // Filter remaining questions to only include those belonging to the target subjects
    const filteredRemaining = questionsAfterCurrent.filter((q) =>
      targetSubjectIds.includes(q.itemId)
    );

    console.log(
      `[Recent Lessons Wrap Up] Filtered questions: ${
        filteredRemaining.length
      } questions for ${
        new Set(filteredRemaining.map((q) => q.itemId)).size
      } subjects`
    );

    // New questions: keep everything up to and including current, then filtered remainder only
    const newQuestions = [
      ...questions.slice(0, currentQuestionIndex + 1),
      ...filteredRemaining,
    ];

    setQuestions(newQuestions);

    console.log(
      `[Recent Lessons Wrap Up] Current question preserved at index ${currentQuestionIndex}:`,
      questions[currentQuestionIndex]
    );
  }, [
    isWrapUpMode,
    questions,
    currentQuestionIndex,
    answeredParts,
    reviewItems,
  ]);

  // Prepare review items from dashboard data
  useEffect(() => {
    // If we've already loaded data for this selected window, don't reload even if dashboard updates
    if (loadedWindow === recentLessonsWindow) {
      return;
    }

    // Wait until dashboard is totally done loading key components
    if (dashboardLoading) {
      return;
    }

    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsPreparing(false);
      return;
    }

    setIsPreparing(true);

    try {
      const recentAssignments = filterRecentLessonAssignments(
        dashboardData.assignments as Assignment[],
        recentLessonsWindow,
      );

      if (recentAssignments.length === 0) {
        const emptyMessage =
          recentLessonsWindow === "apprentice"
            ? "You don't have any lessons in Apprentice stages that need reviewing."
            : `You don't have any lessons started in ${recentLessonsWindowLabel.toLowerCase()}.`;

        Alert.alert(
          "No Recent Lessons",
          emptyMessage,
          [{ text: "OK", onPress: () => router.back() }]
        );
        setIsPreparing(false);
        // Mark as loaded so we don't try again repeatedly
        setLoadedWindow(recentLessonsWindow);
        return;
      }

      // Map subject IDs from assignments
      const subjectMap = new Map(
        dashboardData.subjects.map((s: any) => [s.id, s])
      );
      const subjectsForReview: any[] = [];
      const assignmentsForReview: any[] = [];

      for (const assignment of recentAssignments) {
        const subject = subjectMap.get(assignment.data.subject_id);
        if (subject) {
          subjectsForReview.push(subject);
          assignmentsForReview.push(assignment.data);
        }
      }

      // Prepare review data
      const reviewData = prepareReviewData(
        subjectsForReview,
        assignmentsForReview
      );

      // Load study materials for user synonyms if setting is enabled
      if (acceptUserSynonymsAsAnswers && apiToken) {
        const subjectIds = subjectsForReview.map((s: any) => s.id);
        getStudyMaterials(apiToken, { subject_ids: subjectIds })
          .then((studyMaterialsResponse) => {
            const materialsMap = new Map<number, { meaning_synonyms?: string[] }>();
            if (studyMaterialsResponse?.data) {
              studyMaterialsResponse.data.forEach((material: any) => {
                if (material.data?.subject_id) {
                  materialsMap.set(material.data.subject_id, {
                    meaning_synonyms: material.data.meaning_synonyms || [],
                  });
                }
              });
            }
            setStudyMaterialsMap(materialsMap);
          })
          .catch((error) => {
            console.warn("[User Synonyms] Failed to load study materials:", error);
          });
      }

      console.log(
        "Review data prepared from dashboard:",
        reviewData.length,
        "items"
      );

      // Shuffle the items for practice
      const shuffledItems = shuffleArray(reviewData);

      // Generate questions - use sequential for recent lessons (meaning and reading back-to-back)
      const allQuestions = generateSequentialQuestions(shuffledItems);

      setReviewItems(shuffledItems);
      setQuestions(allQuestions);
      setCurrentQuestionIndex(0);

      setProgress({
        current: 0,
        total: shuffledItems.length,
      });

      const initialAnswered: Record<
        number,
        { meaning: boolean; reading: boolean }
      > = {};

      const initialAnsweredIncorrectly: Record<
        number,
        { meaning: boolean; reading: boolean }
      > = {};

      shuffledItems.forEach((it) => {
        initialAnswered[it.id] = {
          meaning: false,
          reading: !it.readingQuestion,
        };

        initialAnsweredIncorrectly[it.id] = {
          meaning: false,
          reading: false,
        };
      });

      setAnsweredParts(initialAnswered);
      setAnsweredIncorrectly(initialAnsweredIncorrectly);

      setAnswerStats({
        answered: 0,
        correct: 0,
        completedItems: 0,
        meaningAttempts: 0,
        readingAttempts: 0,
        meaningCorrect: 0,
        readingCorrect: 0,
      });

      const initialIncorrect: Record<
        number,
        { meaning: number; reading: number }
      > = {};
      shuffledItems.forEach((item) => {
        initialIncorrect[item.id] = { meaning: 0, reading: 0 };
      });
      setIncorrectAnswers(initialIncorrect);
      setAllCompleted(false);
      setIsWrapUpMode(false);

      // Mark as successfully loaded
      setLoadedWindow(recentLessonsWindow);
    } catch (error) {
      console.error("Error preparing review items:", error);
      Alert.alert("Error", "Failed to load review items. Please try again.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsPreparing(false);
    }
  }, [
    apiToken,
    dashboardLoading, // wait for dashboard loading to finish
    isAuthLoading,
    dashboardData.assignments, // re-run if assignments change
    dashboardData.subjects,
    loadedWindow, // Don't run if already loaded for selected window
    recentLessonsWindow,
    recentLessonsWindowLabel,
    acceptUserSynonymsAsAnswers,
    generateSequentialQuestions,
  ]);

  const requeueQuestion = useCallback((question: Question) => {
    const remainingQuestions = questions.slice(currentQuestionIndex + 1);
    const insertPosition = Math.floor(
      Math.random() * (remainingQuestions.length + 1)
    );

    const newQuestions = [
      ...questions.slice(0, currentQuestionIndex + 1),
      ...remainingQuestions.slice(0, insertPosition),
      question,
      ...remainingQuestions.slice(insertPosition),
    ];

    setQuestions(newQuestions);
    setCurrentQuestionIndex((prev) => prev + 1);
    setAllCompleted(false);
  }, [questions, currentQuestionIndex]);

  const handleAskAgain = useCallback(
    (
      item: { id: number; subject: Subject },
      questionType: "meaning" | "reading"
    ) => {
      requeueQuestion({
        type: questionType,
        itemId: item.id,
      });
    },
    [requeueQuestion]
  );

  const handleSkip = useCallback(
    (
      item: { id: number; subject: Subject },
      _questionType: "meaning" | "reading"
    ) => {
      const reviewItem = reviewItems.find((candidate) => candidate.id === item.id);
      if (!reviewItem) {
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= questions.length) {
          setAllCompleted(true);
        } else {
          setCurrentQuestionIndex(nextIndex);
        }
        return;
      }

      const hadMeaningMarkedCorrect =
        Boolean(answeredParts[item.id]?.meaning) &&
        !Boolean(answeredIncorrectly[item.id]?.meaning);
      const hadReadingMarkedCorrect =
        Boolean(reviewItem.readingQuestion) &&
        Boolean(answeredParts[item.id]?.reading) &&
        !Boolean(answeredIncorrectly[item.id]?.reading);
      const removedCorrectCount =
        (hadMeaningMarkedCorrect ? 1 : 0) + (hadReadingMarkedCorrect ? 1 : 0);

      if (removedCorrectCount > 0) {
        setAnswerStats((prev) => ({
          ...prev,
          correct: Math.max(0, prev.correct - removedCorrectCount),
          meaningCorrect: Math.max(
            0,
            prev.meaningCorrect - (hadMeaningMarkedCorrect ? 1 : 0)
          ),
          readingCorrect: Math.max(
            0,
            prev.readingCorrect - (hadReadingMarkedCorrect ? 1 : 0)
          ),
        }));
      }

      setAnsweredParts((prev) => ({
        ...prev,
        [item.id]: {
          meaning: false,
          reading: !reviewItem.readingQuestion,
        },
      }));

      setAnsweredIncorrectly((prev) => ({
        ...prev,
        [item.id]: {
          meaning: false,
          reading: false,
        },
      }));

      setIncorrectAnswers((prev) => ({
        ...prev,
        [item.id]: {
          meaning: 0,
          reading: 0,
        },
      }));

      const remainingQuestions = questions
        .slice(currentQuestionIndex + 1)
        .filter((question) => question.itemId !== item.id);

      const forceReadingFirst =
        reviewQuestionOrderEnabled && preferredQuestionType === "reading";
      const resetQuestions: Question[] =
        !effectiveAnkiGrouping && reviewItem.readingQuestion
          ? forceReadingFirst
            ? [
                { type: "reading", itemId: item.id },
                { type: "meaning", itemId: item.id },
              ]
            : [
                { type: "meaning", itemId: item.id },
                { type: "reading", itemId: item.id },
              ]
          : [{ type: "meaning", itemId: item.id }];

      const nextQuestions = [
        ...questions.slice(0, currentQuestionIndex),
        ...remainingQuestions,
        ...resetQuestions,
      ];

      setQuestions(nextQuestions);
      setCurrentQuestionIndex(currentQuestionIndex);
      setAllCompleted(false);
    },
    [
      reviewItems,
      currentQuestionIndex,
      questions,
      answeredParts,
      answeredIncorrectly,
      effectiveAnkiGrouping,
      reviewQuestionOrderEnabled,
      preferredQuestionType,
    ]
  );

  // Handle answer from ReviewQuestionScreen
  const handleAnswer = (
    item: { id: number; subject: Subject },
    questionType: "meaning" | "reading",
    isCorrect: boolean,
    wasIncorrect: boolean
  ) => {
    // Track attempts by question type
    if (questionType === "meaning") {
      setAnswerStats((prev) => ({
        ...prev,
        meaningAttempts: prev.meaningAttempts + 1,
        answered: prev.answered + 1,
      }));
    } else {
      setAnswerStats((prev) => ({
        ...prev,
        readingAttempts: prev.readingAttempts + 1,
        answered: prev.answered + 1,
      }));
    }

    if (isCorrect) {
      // Update correct count if this is the first correct answer for this type
      if (questionType === "meaning") {
        if (!answeredIncorrectly[item.id]?.meaning) {
          setAnswerStats((prev) => ({
            ...prev,
            meaningCorrect: prev.meaningCorrect + 1,
          }));
        }

        // Also update the general correct counter
        setAnswerStats((prev) => ({
          ...prev,
          correct: prev.correct + 1,
        }));
      } else {
        if (!answeredIncorrectly[item.id]?.reading) {
          setAnswerStats((prev) => ({
            ...prev,
            readingCorrect: prev.readingCorrect + 1,
          }));
        }

        // Also update the general correct counter
        setAnswerStats((prev) => ({
          ...prev,
          correct: prev.correct + 1,
        }));
      }

      // Track meaning/reading completion for this item
      setAnsweredParts((prev) => {
        const updated = { ...prev };
        const entry = updated[item.id] ?? {
          meaning: false,
          reading: !reviewItems.find((ri) => ri.id === item.id)
            ?.readingQuestion,
        };
        const wasCompleted = entry.meaning && entry.reading;
        entry[questionType] = true;
        updated[item.id] = entry;

        const isCompleted = entry.meaning && entry.reading;
        if (!wasCompleted && isCompleted) {
          // Update progress counter for completed items
          setProgress((p) => ({ ...p, current: p.current + 1 }));

          // Check if there were no errors for this item
          const noMeaningErrors = !answeredIncorrectly[item.id]?.meaning;
          const noReadingErrors = !answeredIncorrectly[item.id]?.reading;

          // Update completed items count if both parts were answered correctly on first try
          if (noMeaningErrors && noReadingErrors) {
            setAnswerStats((prev) => ({
              ...prev,
              completedItems: prev.completedItems + 1,
            }));
          }
        }

        return updated;
      });

      // Move to next question
      if (currentQuestionIndex + 1 >= questions.length) {
        setAllCompleted(true);
      } else {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } else {
      // Mark this part as answered incorrectly (only once per part)
      if (!answeredIncorrectly[item.id]?.[questionType]) {
        setAnsweredIncorrectly((prev) => {
          const updated = { ...prev };
          updated[item.id] = {
            ...updated[item.id],
            [questionType]: true,
          };
          return updated;
        });

        // Update incorrect count if this is the first time getting it wrong
        setIncorrectAnswers((prev) => {
          const update = { ...prev };
          if (questionType === "meaning") {
            update[item.id].meaning += 1;
          } else {
            update[item.id].reading += 1;
          }
          return update;
        });
      }

      // Add this question back to the queue to be asked again later.
      const newQuestion: Question = {
        type: questionType,
        itemId: item.id,
      };
      requeueQuestion(newQuestion);
      console.log(`Requeued ${questionType} question for item ${item.id}`);
    }
  };

  // Handle navigation actions
  const handleRestart = () => {
    // Reset data loaded to force reload
    setLoadedWindow(null);
    setIsPreparing(true);
  };

  const handleBackToDashboard = () => {
    router.dismissAll();
    router.replace({
      pathname: "/",
      params: { refreshLessonsReviews: "true" },
    });
  };

  // Render the current question
  const renderCurrentQuestion = () => {
    if (currentQuestionIndex >= questions.length) return null;

    const currentQuestion = questions[currentQuestionIndex];
    const item = reviewItems.find((item) => item.id === currentQuestion.itemId);

    if (!item) return null;

    // Create a properly formatted WK Subject from GroupedReviewItem
    const wkSubject: Subject = {
      id: item.subjectId,
      object: item.type as "radical" | "kanji" | "vocabulary" | "kana_vocabulary",
      data: {
        level: item.level,
        characters: item.characters || null,
        character_images: item.characterImages,
        meanings: item.meanings,
        readings: item.readings,
        pronunciation_audios: item.pronunciationAudios,
      },
    };

    return (
      <ReviewQuestionScreen
        item={{ id: item.id, subject: wkSubject, srsStage: item.srsStage }}
        studyMaterials={studyMaterialsMap.get(item.subjectId)}
        onSynonymAdded={handleSynonymAdded}
        questionType={currentQuestion.type}
        onAnswer={handleAnswer}
        onAskAgain={handleAskAgain}
        onSkip={handleSkip}
        onExit={() => router.back()}
        showBackgroundColor={true}
        totalItems={progress.total}
        currentItem={answerStats.answered}
        completedCount={progress.current}
        correctAnswersCount={answerStats.correct}
        // Wrap up functionality
        isWrapUpAvailable={isWrapUpAvailable && !isWrapUpMode}
        isWrapUpMode={isWrapUpMode}
        remainingSubjectsCount={getRemainingSubjectsCount()}
        onWrapUp={handleWrapUp}
      />
    );
  };

  if (isPreparing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading recent lessons...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {allCompleted ? (
          <RecentLessonsResultsScreen
            reviewItems={reviewItems}
            answerStats={answerStats}
            incorrectAnswers={incorrectAnswers}
            answeredParts={answeredParts}
            onRestart={handleRestart}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : (
          renderCurrentQuestion()
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f6f6f6",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginLeft: 8,
  },
  progressContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    color: "white",
    fontWeight: "bold",
  },
  progressCorrect: {
    backgroundColor: "#4caf50",
  },
  progressIncorrect: {
    backgroundColor: "#f44336",
  },
  accuracyText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
});
