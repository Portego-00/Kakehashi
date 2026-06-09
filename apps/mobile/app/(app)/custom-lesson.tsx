import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AddToSubjectListsModal from "../../src/components/AddToSubjectListsModal";
import LessonDetailScreen from "../../src/components/LessonDetailScreen";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import { Subject as ApiSubject, getSubjects } from "../../src/utils/api";
import { getAllSubjects } from "../../src/utils/cache";
import {
  buildReviewQuestionQueue,
  sortReviewItemsForQueue,
  type OrderableReviewItem,
  type ReviewQueueQuestion,
} from "../../src/utils/reviewOrdering";
import { useSubjectColors } from "../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Define interfaces similar to the regular lesson screen
interface LessonItem {
  id: number;
  assignmentId: number; // We'll use a fake ID for custom lessons
  subjectId: number;
  subject: ApiSubject;
  meaningDone: boolean;
  readingDone: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  submitted?: boolean;
  submissionFailed?: boolean;
}

interface LessonBatch {
  items: LessonItem[];
  completed: boolean;
}

// Type interface for lesson counts
interface TypeCounts {
  radical: number;
  kanji: number;
  vocabulary: number;
}

enum LessonsMode {
  LESSON = "lesson", // Learning new items
  REVIEW = "review", // Quiz on what was just learned
  BATCH_COMPLETE = "batch_complete", // Showing batch completion screen
}

// Helper function to check if a subject is of a specific type
const isSubjectType = (subject: any, type: string): boolean => {
  return subject.object === type;
};

export default function CustomLessonScreen() {
  const { apiToken } = useAuthStore();
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    lessonBatchSize,
    customReviewOrder,
    backToBackQuestions,
    skipCustomLessonQuiz,
  } = useSettingsStore();
  const effectiveAnkiGrouping =
    ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both";
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const batchSize = lessonBatchSize; // Use setting from store
  const [lessonBatches, setLessonBatches] = useState<LessonBatch[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [mode, setMode] = useState<LessonsMode>(LessonsMode.LESSON);
  
  // Queue-based review state (like reviews.tsx)
  const [reviewItems, setReviewItems] = useState<LessonItem[]>([]);
  const [masterQueue, setMasterQueue] = useState<ReviewQueueQuestion[]>([]);
  const [activeQueue, setActiveQueue] = useState<ReviewQueueQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQueueQuestion | null>(null);
  const [sessionCompleting, setSessionCompleting] = useState(false);
  
  // Queue configuration
  const ACTIVE_QUEUE_SIZE = 10;
  const REFILL_THRESHOLD = 3;
  
  const [progress, setProgress] = useState({
    totalItems: 0,
    completedItems: 0,
    currentBatch: 0,
    totalBatches: 0,
  });

  const [completedBatchStats, setCompletedBatchStats] = useState<{
    batchNumber: number;
    itemCount: number;
    typeCounts: TypeCounts;
  } | null>(null);

  // Add state for tracking type counts
  const [typeCounts, setTypeCounts] = useState<TypeCounts>({
    radical: 0,
    kanji: 0,
    vocabulary: 0
  });

  const [relatedSubjects, setRelatedSubjects] = useState<{[key: number]: ApiSubject}>({});
  const [listModalSubject, setListModalSubject] = useState<{
    id: number;
    type: string;
    label?: string;
  } | null>(null);

  // Safe navigation back to dashboard - handles case where there's no stack to dismiss
  const navigateToDashboard = useCallback(() => {
    try {
      router.dismissAll();
    } catch {
      // Ignore error if there's nothing to dismiss
    }
    router.replace("/");
  }, []);

  // Load selected subjects
  const loadCustomLesson = useCallback(async () => {
    if (!apiToken || !params.subjectIds) {
      navigateToDashboard();
      return;
    }

    try {
      setIsLoading(true);
      setHasError(false);

      // Parse subject IDs from params
      const subjectIds = (params.subjectIds as string)
        .split(",")
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (subjectIds.length === 0) {
        Alert.alert(
          "No Subjects Found",
          "Could not load the selected subjects.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Resolve selected subjects from durable local cache first so this works offline.
      const cachedSubjects = (await getAllSubjects()) as ApiSubject[];
      const subjectsById = new Map<number, ApiSubject>(
        cachedSubjects.map((subject) => [subject.id, subject as ApiSubject]),
      );
      let loadedSubjects = subjectIds
        .map((subjectId) => subjectsById.get(subjectId))
        .filter((subject): subject is ApiSubject => Boolean(subject));

      if (loadedSubjects.length !== subjectIds.length) {
        const missingSubjectIds = subjectIds.filter(
          (subjectId) => !subjectsById.has(subjectId),
        );
        if (missingSubjectIds.length > 0) {
          try {
            const subjectsResponse = await getSubjects(apiToken, {
              ids: missingSubjectIds,
            });
            subjectsResponse.data.forEach((subject) => {
              subjectsById.set(subject.id, subject);
            });
            loadedSubjects = subjectIds
              .map((subjectId) => subjectsById.get(subjectId))
              .filter((subject): subject is ApiSubject => Boolean(subject));
          } catch (error) {
            if (loadedSubjects.length === 0) {
              throw error;
            }
            console.warn(
              "[Custom Lesson] Failed to fetch missing subjects from API, continuing with cached subset:",
              error,
            );
          }
        }
      }

      if (loadedSubjects.length === 0) {
        Alert.alert(
          "No Subjects Found",
          "Could not load the selected subjects.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Create lesson items from subjects
      const items: LessonItem[] = loadedSubjects.map((subject) => ({
        id: subject.id,
        assignmentId: -subject.id, // Negative ID to indicate custom lesson
        subjectId: subject.id,
        subject: subject,
        meaningDone: false,
        readingDone: false,
        meaningIncorrect: 0,
        readingIncorrect: 0,
        submitted: false, // No actual submission for custom lessons
      }));

      // Calculate the counts for each subject type
      const counts: TypeCounts = {
        radical: 0,
        kanji: 0,
        vocabulary: 0
      };

      items.forEach(item => {
        const subjectType = item.subject.object;
        if (subjectType === 'radical') {
          counts.radical++;
        } else if (subjectType === 'kanji') {
          counts.kanji++;
        } else if (subjectType === 'vocabulary' || subjectType === 'kana_vocabulary') {
          counts.vocabulary++;
        }
      });

      setTypeCounts(counts);

      // Collect all related subject IDs that we need to fetch
      const relatedIds = new Set<number>();
      
      // For each subject, collect component subjects and amalgamation subjects
      items.forEach(item => {
        // Component subjects (for kanji and vocabulary)
        if (item.subject.data.component_subject_ids) {
          item.subject.data.component_subject_ids.forEach(id => {
            relatedIds.add(id);
          });
        }
        
        // Amalgamation subjects (for radicals and kanji)
        if (item.subject.data.amalgamation_subject_ids) {
          item.subject.data.amalgamation_subject_ids.forEach(id => {
            relatedIds.add(id);
          });
        }

        // Visually similar kanji (for kanji when using WaniKani source)
        if (item.subject.data.visually_similar_subject_ids) {
          item.subject.data.visually_similar_subject_ids.forEach(id => {
            relatedIds.add(id);
          });
        }
      });
      
      // Fetch all related subjects in one request
      if (relatedIds.size > 0) {
        try {
          const relatedSubjectIds = Array.from(relatedIds);

          // Convert to a lookup map for easier access
          const subjectsMap: {[key: number]: ApiSubject} = {};
          const missingRelatedSubjectIds: number[] = [];

          relatedSubjectIds.forEach((subjectId) => {
            const cachedSubject = subjectsById.get(subjectId);
            if (cachedSubject) {
              subjectsMap[subjectId] = cachedSubject;
            } else {
              missingRelatedSubjectIds.push(subjectId);
            }
          });

          if (missingRelatedSubjectIds.length > 0) {
            console.log(
              `Fetching ${missingRelatedSubjectIds.length} related subjects from API`
            );
            const relatedSubjectsResponse = await getSubjects(apiToken, {
              ids: missingRelatedSubjectIds,
            });
            relatedSubjectsResponse.data.forEach((subject) => {
              subjectsMap[subject.id] = subject;
              subjectsById.set(subject.id, subject);
            });
          }
          
          setRelatedSubjects(subjectsMap);
        } catch (error) {
          console.error("Error fetching related subjects:", error);
          // Continue anyway as this isn't critical
        }
      }

      // Organize items into batches
      const batches: LessonBatch[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push({
          items: items.slice(i, Math.min(i + batchSize, items.length)),
          completed: false
        });
      }

      setLessonBatches(batches);
      setCurrentBatchIndex(0);
      setCurrentItemIndex(0);
      setMode(LessonsMode.LESSON);
      setCompletedBatchStats(null);
      
      setProgress({
        totalItems: items.length,
        completedItems: 0,
        currentBatch: 1,
        totalBatches: batches.length,
      });
    } catch (error) {
      console.error("Error loading custom lesson:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiToken, batchSize, navigateToDashboard, params.subjectIds]);

  useEffect(() => {
    loadCustomLesson();
  }, [loadCustomLesson]);

  const handleNextItem = () => {
    const currentBatch = lessonBatches[currentBatchIndex];

    if (mode === LessonsMode.LESSON) {
      // Move to next item in lesson mode
      if (currentItemIndex < currentBatch.items.length - 1) {
        // Still have more items in this batch
        setCurrentItemIndex(currentItemIndex + 1);
      } else {
        if (skipCustomLessonQuiz) {
          // Skip the review quiz and go directly to batch completion.
          setReviewItems([]);
          setMasterQueue([]);
          setActiveQueue([]);
          setCurrentQuestion(null);
          handleSessionComplete();
        } else {
          // Finished going through all items in batch - start review
          setMode(LessonsMode.REVIEW);
          const items = [...currentBatch.items];
          initializeReviewQueue(items);
        }
      }
    }
  };

  const handlePrevItem = () => {
    if (mode === LessonsMode.LESSON && currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
    }
  };
  
  // Initialize review queue when starting review mode
  const initializeReviewQueue = (items: LessonItem[]) => {
    const sortableItems = items as (LessonItem & OrderableReviewItem)[];
    const sortedItems = sortReviewItemsForQueue(sortableItems, {
      reviewOrder: customReviewOrder,
    });
    const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
    const orderedQuestions = buildReviewQuestionQueue(sortedItems, {
      groupQuestions: effectiveAnkiGrouping,
      backToBack: useBackToBack,
      maxQuestionGap: 10,
    });

    setReviewItems(sortedItems);
    setMasterQueue(orderedQuestions);
    setActiveQueue(
      orderedQuestions.slice(0, Math.min(ACTIVE_QUEUE_SIZE, orderedQuestions.length))
    );
    setCurrentQuestion(orderedQuestions[0] || null);
    setSessionCompleting(false); // Reset completion flag
  };

  // Move to next question in queue
  const moveToNextQuestion = () => {
    if (sessionCompleting) return; // Prevent multiple completion calls
    
    if (activeQueue.length <= 1) {
      // Queue is empty or will be empty, check if we're done
      if (masterQueue.length <= ACTIVE_QUEUE_SIZE) {
        // Session complete
        setSessionCompleting(true);
        handleSessionComplete();
        return;
      }
    }
    
    // Remove current question from active queue
    const newActiveQueue = activeQueue.slice(1);
    setActiveQueue(newActiveQueue);
    
    // Refill queue if needed
    refillActiveQueueIfNeeded(newActiveQueue);
    
    // Set next question
    const nextQuestion = newActiveQueue[0] || null;
    setCurrentQuestion(nextQuestion);
  };

  // Requeue question for incorrect answers
  const requeueQuestion = () => {
    if (!currentQuestion) return;
    
    // Remove current question from active queue
    const newActiveQueue = activeQueue.slice(1);
    
    // Insert question at random position (avoid position 0)
    const insertPosition = newActiveQueue.length > 0 
      ? Math.floor(Math.random() * newActiveQueue.length) + 1
      : 0;
    
    newActiveQueue.splice(insertPosition, 0, { ...currentQuestion });
    setActiveQueue(newActiveQueue);
    
    // Refill queue if needed
    refillActiveQueueIfNeeded(newActiveQueue);
    
    // Set next question
    const nextQuestion = newActiveQueue[0] || null;
    setCurrentQuestion(nextQuestion);
  };

  // Skip current question without counting it as incorrect.
  const handleSkip = (
    _item: { id: number; subject: any },
    _questionType: "meaning" | "reading"
  ) => {
    requeueQuestion();
  };

  // Refill active queue from master queue
  const refillActiveQueueIfNeeded = (currentActiveQueue: ReviewQueueQuestion[]) => {
    if (currentActiveQueue.length <= REFILL_THRESHOLD && masterQueue.length > ACTIVE_QUEUE_SIZE) {
      const needed = ACTIVE_QUEUE_SIZE - currentActiveQueue.length;
      const toAdd = masterQueue.slice(ACTIVE_QUEUE_SIZE, ACTIVE_QUEUE_SIZE + needed);
      
      setActiveQueue(prev => [...prev, ...toAdd]);
    }
  };

  // Handle session completion
  const handleSessionComplete = () => {
    // Mark batch as completed
    const updatedBatches = [...lessonBatches];
    updatedBatches[currentBatchIndex].completed = true;
    setLessonBatches(updatedBatches);

    // Calculate type counts for the completed batch
    const completedBatch = updatedBatches[currentBatchIndex];
    const batchTypeCounts: TypeCounts = {
      radical: 0,
      kanji: 0,
      vocabulary: 0,
    };

    completedBatch.items.forEach((item) => {
      const subjectType = item.subject.object;
      if (subjectType === "radical") {
        batchTypeCounts.radical++;
      } else if (subjectType === "kanji") {
        batchTypeCounts.kanji++;
      } else if (
        subjectType === "vocabulary" ||
        subjectType === "kana_vocabulary"
      ) {
        batchTypeCounts.vocabulary++;
      }
    });

    // Keep "remaining in lesson" counts accurate for the next batch.
    setTypeCounts((prev) => ({
      radical: Math.max(0, prev.radical - batchTypeCounts.radical),
      kanji: Math.max(0, prev.kanji - batchTypeCounts.kanji),
      vocabulary: Math.max(0, prev.vocabulary - batchTypeCounts.vocabulary),
    }));

    // Move to next batch or finish
    if (currentBatchIndex < updatedBatches.length - 1) {
      setCompletedBatchStats({
        batchNumber: currentBatchIndex + 1,
        itemCount: completedBatch.items.length,
        typeCounts: batchTypeCounts,
      });
      setMode(LessonsMode.BATCH_COMPLETE);
      setSessionCompleting(false); // Reset for next batch

      setProgress((prev) => ({
        ...prev,
        completedItems: prev.completedItems + completedBatch.items.length,
        currentBatch: prev.currentBatch + 1,
      }));
    } else {
      // All done!
      Alert.alert(
        "Custom Lessons Complete",
        "You've completed all your custom lessons!",
        [
          { 
            text: "Return to Dashboard", 
            onPress: () => {
              navigateToDashboard();
            }
          }
        ]
      );
    }
  };

  const handleContinueToNextBatch = () => {
    setCurrentBatchIndex(currentBatchIndex + 1);
    setCurrentItemIndex(0);
    setMode(LessonsMode.LESSON);
    setCompletedBatchStats(null);
    setReviewItems([]);
    setMasterQueue([]);
    setActiveQueue([]);
    setCurrentQuestion(null);
    setSessionCompleting(false);
  };

  const handleAnswer = async (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading",
    isCorrect: boolean
  ) => {
    if (!currentQuestion) return;
    
    // Find the review item
    const updatedItems = [...reviewItems];
    const itemIndex = updatedItems.findIndex((ri) => ri.id === item.id);
    if (itemIndex === -1) return;

    // Update the item based on the answer
    if (isCorrect) {
      if (questionType === "meaning") {
        updatedItems[itemIndex].meaningDone = true;
      } else {
        updatedItems[itemIndex].readingDone = true;
      }
      
      // Move to next question
      moveToNextQuestion();
    } else {
      // Increment incorrect count
      if (questionType === "meaning") {
        updatedItems[itemIndex].meaningIncorrect += 1;
      } else {
        updatedItems[itemIndex].readingIncorrect += 1;
      }
      
      // Requeue the question
      requeueQuestion();
    }

    setReviewItems(updatedItems);

    // For custom lessons, we don't actually submit assignments to API
    // Just mark as submitted locally for consistency
    const isRadical = updatedItems[itemIndex].subject.object === "radical";
    const isVocabWithoutReading =
      (updatedItems[itemIndex].subject.object === "vocabulary" ||
        updatedItems[itemIndex].subject.object === "kana_vocabulary") &&
      !updatedItems[itemIndex].subject.data.readings;

    const isItemComplete =
      updatedItems[itemIndex].meaningDone &&
      (updatedItems[itemIndex].readingDone || isRadical || isVocabWithoutReading);

    if (isItemComplete && !updatedItems[itemIndex].submitted) {
      updatedItems[itemIndex].submitted = true;
      setReviewItems(updatedItems);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading custom lesson...
          </Text>
        </View>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color={theme.textLight} />
          <Text style={[styles.offlineTitle, { color: theme.textColor }]}>
            Unable to Load Lesson
          </Text>
          <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
            Connect to WiFi to start your custom lesson
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={loadCustomLesson}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.textLight }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: theme.textColor }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If we're in lesson mode, show the lesson detail screen
  if (mode === LessonsMode.LESSON && lessonBatches.length > 0) {
    const currentBatch = lessonBatches[currentBatchIndex];
    const currentItem = currentBatch.items[currentItemIndex];
    
    return (
      <>
        <LessonDetailScreen
          item={currentItem}
          onNext={handleNextItem}
          onPrev={handlePrevItem}
          canGoBack={currentItemIndex > 0}
          canGoForward={true}
          progress={{
            current: currentItemIndex + 1,
            total: currentBatch.items.length,
            batchCurrent: currentBatchIndex + 1,
            batchTotal: lessonBatches.length,
          }}
          onExit={() => {
            Alert.alert(
              "Exit Custom Lessons",
              "Are you sure you want to exit? Your progress will not be saved.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Exit", onPress: () => navigateToDashboard() },
              ]
            );
          }}
          relatedSubjects={relatedSubjects}
          typeCounts={typeCounts}
          batchItems={currentBatch.items}
          currentBatchIndex={currentItemIndex}
          onBatchItemPress={(index) => {
            setCurrentItemIndex(index);
          }}
          onSubjectPress={(subjectId) => {
            // Navigate to subject detail page
            router.push(`/subject/${subjectId}`);
          }}
          onAddSubjectToList={(subject) => {
            const label =
              subject.data?.meanings?.find((meaning: any) => meaning.primary)
                ?.meaning ||
              subject.data?.meanings?.[0]?.meaning ||
              subject.data?.characters ||
              undefined;
            setListModalSubject({
              id: subject.id,
              type: subject.object,
              label,
            });
          }}
        />

        <AddToSubjectListsModal
          visible={!!listModalSubject}
          subjectId={listModalSubject?.id ?? 0}
          subjectType={listModalSubject?.type}
          subjectLabel={listModalSubject?.label}
          onClose={() => setListModalSubject(null)}
        />
      </>
    );
  }

  // If we're in review mode, show the review question screen
  if (mode === LessonsMode.REVIEW && reviewItems.length > 0 && currentQuestion) {
    const currentItem = reviewItems.find(item => item.id === currentQuestion.itemId);
    
    if (!currentItem) {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
          <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>Error loading question</Text>
          </View>
        </View>
      );
    }
    
    // Create a version of the subject that satisfies the component's type requirements
    const adaptedSubject = {
      id: currentItem.subject.id,
      object: currentItem.subject.object as
        | "radical"
        | "kanji"
        | "vocabulary"
        | "kana_vocabulary",
      data: {
        characters: currentItem.subject.data.characters,
        meanings: currentItem.subject.data.meanings,
        readings: currentItem.subject.data.readings || undefined,
        character_images: currentItem.subject.data.character_images || undefined,
        pronunciation_audios:
          currentItem.subject.data.pronunciation_audios || undefined,
      }
    };
    
    return (
      <ReviewQuestionScreen
        item={{ id: currentItem.id, subject: adaptedSubject }}
        questionType={currentQuestion.type}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        onExit={() => {
          Alert.alert(
            "Exit Custom Lessons",
            "Are you sure you want to exit? Your progress will not be saved.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Exit", onPress: () => navigateToDashboard() },
            ]
          );
        }}
        showHeader={true}
        showBackgroundColor={true}
        totalItems={reviewItems.length}
        currentItem={activeQueue.length > 0 ? 
          (effectiveAnkiGrouping ? 
            reviewItems.length - (activeQueue.length + masterQueue.length - ACTIVE_QUEUE_SIZE) :
            (reviewItems.length * 2) - (activeQueue.length + masterQueue.length - ACTIVE_QUEUE_SIZE)
          ) : 
          (effectiveAnkiGrouping ? reviewItems.length : reviewItems.length * 2)
        }
        completedCount={reviewItems.filter(item => 
          (item.meaningDone && item.readingDone) || 
          (item.meaningDone && isSubjectType(item.subject, "radical")) ||
          (item.meaningDone && isSubjectType(item.subject, "vocabulary") && !item.subject.data.readings)
        ).length}
        correctAnswersCount={reviewItems.reduce((count, item) => {
          let correctCount = 0;
          if (item.meaningDone) correctCount++;
          if (item.readingDone) correctCount++;
          return count + correctCount;
        }, 0)}
        isLessonFlow={true}
        // No SRS progression for custom lessons
        srsProgression={undefined}
        onSRSCardDismiss={undefined}
      />
    );
  }

  // If we're in batch completion mode, show the batch completion screen
  if (mode === LessonsMode.BATCH_COMPLETE && completedBatchStats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View
          style={[
            styles.batchCompleteContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.batchCompleteContent,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <View style={styles.batchCompleteHeader}>
              <Text
                style={[styles.batchCompleteTitle, { color: theme.textColor }]}
              >
                Batch Complete!
              </Text>
              <Text
                style={[
                  styles.batchCompleteSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                Great job! You&apos;ve completed batch{" "}
                {completedBatchStats.batchNumber} of {lessonBatches.length}
              </Text>
            </View>

            <View style={styles.batchStatsContainer}>
              <Text style={[styles.batchStatsTitle, { color: theme.textColor }]}>
                Items Learned:
              </Text>
              <View style={styles.batchStatsGrid}>
                {completedBatchStats.typeCounts.radical > 0 && (
                  <View
                    style={[
                      styles.batchStatItem,
                      { backgroundColor: subjectColors.radical },
                    ]}
                  >
                    <Text style={styles.batchStatNumber}>
                      {completedBatchStats.typeCounts.radical}
                    </Text>
                    <Text style={styles.batchStatLabel}>
                      Radical
                      {completedBatchStats.typeCounts.radical !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
                {completedBatchStats.typeCounts.kanji > 0 && (
                  <View
                    style={[
                      styles.batchStatItem,
                      { backgroundColor: subjectColors.kanji },
                    ]}
                  >
                    <Text style={styles.batchStatNumber}>
                      {completedBatchStats.typeCounts.kanji}
                    </Text>
                    <Text style={styles.batchStatLabel}>Kanji</Text>
                  </View>
                )}
                {completedBatchStats.typeCounts.vocabulary > 0 && (
                  <View
                    style={[
                      styles.batchStatItem,
                      { backgroundColor: subjectColors.vocabulary },
                    ]}
                  >
                    <Text style={styles.batchStatNumber}>
                      {completedBatchStats.typeCounts.vocabulary}
                    </Text>
                    <Text style={styles.batchStatLabel}>
                      Vocabular
                      {completedBatchStats.typeCounts.vocabulary !== 1
                        ? "ies"
                        : "y"}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.batchTotalText, { color: theme.textColor }]}>
                Total: {completedBatchStats.itemCount} item
                {completedBatchStats.itemCount !== 1 ? "s" : ""}
              </Text>
            </View>

            <View style={styles.batchProgressContainer}>
              <Text
                style={[styles.batchProgressText, { color: theme.textSecondary }]}
              >
                {progress.completedItems} of {progress.totalItems} items completed
              </Text>
              <View
                style={[
                  styles.batchProgressBar,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.batchProgressFill,
                    {
                      backgroundColor: subjectColors.kanji,
                      width: `${(progress.completedItems / progress.totalItems) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.batchActionRow}>
              <TouchableOpacity
                style={[
                  styles.batchHomeButton,
                  { backgroundColor: theme.cardBackground, borderColor: theme.border },
                ]}
                onPress={navigateToDashboard}
              >
                <Ionicons name="home" size={20} color={theme.textColor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.batchContinueButton,
                  { backgroundColor: subjectColors.kanji },
                ]}
                onPress={handleContinueToNextBatch}
              >
                <Text style={styles.batchContinueButtonText}>Next batch</Text>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Fallback
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <View style={styles.loadingContainer}>
        <Text style={[styles.errorText, { color: theme.error }]}>No lessons available</Text>
      </View>
    </View>
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
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 24,
    textAlign: "center",
  },
  offlineText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  batchCompleteContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  batchCompleteContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  batchCompleteHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  batchCompleteTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  batchCompleteSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  batchStatsContainer: {
    marginBottom: 24,
  },
  batchStatsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  batchStatsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  batchStatItem: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  batchStatNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  batchStatLabel: {
    fontSize: 12,
    color: "white",
    opacity: 0.9,
    textAlign: "center",
  },
  batchTotalText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  batchProgressContainer: {
    marginBottom: 24,
  },
  batchProgressText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  batchProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  batchProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  batchActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  batchHomeButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  batchContinueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  batchContinueButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
