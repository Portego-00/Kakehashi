import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AddToSubjectListsModal from "../../src/components/AddToSubjectListsModal";
import LessonDetailScreen from "../../src/components/LessonDetailScreen";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import {
  getPendingProgressAssignmentIds,
  getPendingProgressCounts,
  queueProgressAndAttemptSend,
  syncPendingProgress,
} from "../../src/services/offlineStudyProgressService";
import { markLessonStartedInAssignmentCaches } from "../../src/services/studyProgressAssignmentCacheService";
import {
  Assignment as ApiAssignment,
  Subject as ApiSubject,
  getAvailableLessons,
  getAssignmentsOptimized,
  getUserData,
  getStudyMaterials,
  getSubjects,
  isRateLimitError,
  isUnauthorizedError,
} from "../../src/utils/api";
import {
  buildReviewQuestionQueue,
  type OrderableReviewItem,
} from "../../src/utils/reviewOrdering";
import {
  sortLessonItemsForQueue,
  type LessonOrderSetting,
  type LessonTypeOrderSetting,
  type OrderableLessonItem,
} from "../../src/utils/lessonOrdering";
import { getRemainingDailyLessonSlots } from "../../src/utils/dailyLessonLimit";
import { useSubjectColors } from "../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface LessonItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  availableAt?: string | null;
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

const orderLessonAssignments = (
  assignments: ApiAssignment[],
  subjectsById: Map<number, ApiSubject>,
  options: {
    userLevel: number;
    lessonOrder: LessonOrderSetting;
    lessonTypeOrderEnabled: boolean;
    lessonTypeOrder: LessonTypeOrderSetting[];
    interleaveLessonTypesEnabled: boolean;
    prioritizeCriticalItems: boolean;
  }
): ApiAssignment[] => {
  type OrderableAssignment = OrderableLessonItem & { assignment: ApiAssignment };

  const orderable: OrderableAssignment[] = assignments.map((assignment) => {
    const subject = subjectsById.get(assignment.data.subject_id);
    const subjectObject =
      subject?.object === "radical" ||
      subject?.object === "kanji" ||
      subject?.object === "vocabulary" ||
      subject?.object === "kana_vocabulary"
        ? subject.object
        : "vocabulary";
    return {
      id: assignment.id,
      subjectId: assignment.data.subject_id,
      subject: {
        id: subject?.id,
        object: subjectObject,
        data: { level: subject?.data.level ?? 0 },
      },
      availableAt:
        assignment.data.available_at ??
        assignment.data.unlocked_at ??
        null,
      assignment,
    };
  });

  return sortLessonItemsForQueue(orderable, {
    lessonOrder: options.lessonOrder,
    lessonTypeOrderEnabled: options.lessonTypeOrderEnabled,
    lessonTypeOrder: options.lessonTypeOrder,
    interleaveLessonTypesEnabled: options.interleaveLessonTypesEnabled,
    prioritizeCriticalItems: options.prioritizeCriticalItems,
    userLevel: options.userLevel,
  }).map((item) => item.assignment);
};

export default function LessonsScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const { apiToken, userData, setUserData } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const { refreshLessonsAndReviews } = useDashboardData();
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    lessonBatchSize,
    dailyLessonLimit,
    prioritizeCriticalItems,
    acceptUserSynonymsAsAnswers,
    backToBackQuestions,
    reviewQuestionOrderEnabled,
    meaningFirst,
    lessonOrder,
    lessonTypeOrderEnabled,
    lessonTypeOrder,
    interleaveLessonTypesEnabled,
    excludeKanaVocabularyFromLessons,
  } = useSettingsStore();
  const effectiveAnkiGrouping =
    ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both";
  const preferredQuestionType: "meaning" | "reading" = meaningFirst
    ? "meaning"
    : "reading";
  const { selectedLessonIds } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [allLessons, setAllLessons] = useState<LessonItem[]>([]);
  const [lessonBatches, setLessonBatches] = useState<LessonBatch[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [mode, setMode] = useState<LessonsMode>(LessonsMode.LESSON);

  // Queue-based review state (like reviews.tsx)
  const [reviewItems, setReviewItems] = useState<LessonItem[]>([]);
  const [masterQueue, setMasterQueue] = useState<
    { type: "meaning" | "reading"; itemId: number }[]
  >([]);
  const [activeQueue, setActiveQueue] = useState<
    { type: "meaning" | "reading"; itemId: number }[]
  >([]);
  const [currentQuestion, setCurrentQuestion] = useState<{
    type: "meaning" | "reading";
    itemId: number;
  } | null>(null);
  const [sessionCompleting, setSessionCompleting] = useState(false);

  // Queue configuration
  const ACTIVE_QUEUE_SIZE = 10;
  const REFILL_THRESHOLD = 3;

  // State for batch completion screen
  const [completedBatchStats, setCompletedBatchStats] = useState<{
    batchNumber: number;
    itemCount: number;
    typeCounts: TypeCounts;
  } | null>(null);
  const [isFinalBatchComplete, setIsFinalBatchComplete] = useState(false);
  const [showSaveCurrentLessonsModal, setShowSaveCurrentLessonsModal] =
    useState(false);

  const [progress, setProgress] = useState({
    totalItems: 0,
    completedItems: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [pendingLessonCount, setPendingLessonCount] = useState(0);

  // Add state for tracking type counts
  const [typeCounts, setTypeCounts] = useState<TypeCounts>({
    radical: 0,
    kanji: 0,
    vocabulary: 0,
  });

  const [relatedSubjects, setRelatedSubjects] = useState<{
    [key: number]: ApiSubject;
  }>({});
  const [listModalSubject, setListModalSubject] = useState<{
    id: number;
    type: string;
    label?: string;
  } | null>(null);

  // Study materials for user synonyms
  const [studyMaterialsMap, setStudyMaterialsMap] = useState<Map<number, { meaning_synonyms?: string[] }>>(new Map());
  const currentLessonSubjectIds = useMemo(() => {
    const uniqueIds = new Set<number>();
    allLessons.forEach((lesson) => {
      if (Number.isInteger(lesson.subjectId) && lesson.subjectId > 0) {
        uniqueIds.add(lesson.subjectId);
      }
    });
    return Array.from(uniqueIds);
  }, [allLessons]);

  // Handler for when a synonym is added during review
  const handleSynonymAdded = useCallback((subjectId: number, newSynonyms: string[]) => {
    setStudyMaterialsMap(prev => {
      const updated = new Map(prev);
      updated.set(subjectId, { meaning_synonyms: newSynonyms });
      return updated;
    });
  }, []);

  const refreshPendingLessonCount = useCallback(async () => {
    try {
      const counts = await getPendingProgressCounts();
      setPendingLessonCount(counts.lesson);
    } catch (error) {
      console.warn("[Lessons] Failed to load pending lesson queue count:", error);
    }
  }, []);

  // Load lessons when the component mounts
  useEffect(() => {
    loadLessons();
    // loadLessons reads the latest settings from this render; making it a
    // dependency would restart the session setup on every local state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !apiToken) {
      setPendingLessonCount(0);
      return;
    }

    void syncPendingProgress(apiToken)
      .catch((error) => {
        console.warn("[Lessons] Failed to sync pending study progress:", error);
      })
      .finally(() => {
        void refreshPendingLessonCount();
      });
  }, [apiToken, isAuthLoading, refreshPendingLessonCount]);

  useEffect(() => {
    if (isAuthLoading || !apiToken) {
      setPendingLessonCount(0);
      return;
    }

    void refreshPendingLessonCount();
    const intervalId = setInterval(() => {
      void refreshPendingLessonCount();
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [apiToken, isAuthLoading, refreshPendingLessonCount]);

  // Fetch study materials when entering review mode
  useEffect(() => {
    if (mode !== LessonsMode.REVIEW || !acceptUserSynonymsAsAnswers || !apiToken || reviewItems.length === 0) {
      return;
    }

    const subjectIds = reviewItems.map(item => item.subjectId);

    getStudyMaterials(apiToken, { subject_ids: subjectIds }, { skipCache: true })
      .then((response) => {
        const materialsMap = new Map<number, { meaning_synonyms?: string[] }>();
        if (response?.data) {
          response.data.forEach((material: any) => {
            if (material.data?.subject_id) {
              materialsMap.set(material.data.subject_id, {
                meaning_synonyms: material.data.meaning_synonyms || [],
              });
            }
          });
        }
        setStudyMaterialsMap(materialsMap);
        console.log(`[Lessons] Loaded study materials for ${materialsMap.size} subjects`);
      })
      .catch((error) => {
        console.warn("[Lessons] Failed to load study materials:", error);
      });
  }, [mode, acceptUserSynonymsAsAnswers, apiToken, reviewItems]);

  const loadLessons = async () => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsFinalBatchComplete(false);
      setShowSaveCurrentLessonsModal(false);

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

      // Parse selected lesson IDs if provided
      const selectedIds: number[] | null = selectedLessonIds
        ? JSON.parse(
            Array.isArray(selectedLessonIds)
              ? selectedLessonIds[0]
              : selectedLessonIds
          )
        : null;

      const selectedIdSet = selectedIds ? new Set(selectedIds) : null;
      const hasSelectedLessonFilter = selectedIdSet !== null;

      let remainingDailyLessonSlots = Number.POSITIVE_INFINITY;
      if (dailyLessonLimit > 0 && !hasSelectedLessonFilter) {
        const assignmentsResponse = await getAssignmentsOptimized(
          apiToken,
          {},
          { forceFullRefresh: false }
        );
        remainingDailyLessonSlots = getRemainingDailyLessonSlots(
          dailyLessonLimit,
          assignmentsResponse.data
        );

        if (remainingDailyLessonSlots <= 0) {
          Alert.alert(
            "Daily Lesson Limit Reached",
            "You've reached your daily lesson limit. Come back tomorrow for more lessons.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }
      }

      const selectedAssignments = lessonsResponse.data.filter(
        (_, index) => !selectedIdSet || selectedIdSet.has(index)
      );
      const pendingProgressAssignmentIds =
        await getPendingProgressAssignmentIds().catch(() => ({
          lesson: new Set<number>(),
          review: new Set<number>(),
        }));
      const availableLessonAssignments = selectedAssignments.filter(
        (assignment) => !pendingProgressAssignmentIds.lesson.has(assignment.id)
      );

      if (availableLessonAssignments.length === 0) {
        Alert.alert(
          "No Lessons Available",
          "There are no lessons available within your current daily limit.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const needsLevelForOrdering =
        prioritizeCriticalItems ||
        lessonOrder === "currentLevelFirst" ||
        lessonOrder === "lowestLevelFirst";
      const needsSubjectsForOrdering =
        needsLevelForOrdering ||
        lessonTypeOrderEnabled ||
        interleaveLessonTypesEnabled;
      const needsSubjectsForLessonFiltering =
        excludeKanaVocabularyFromLessons;
      const needsSubjects =
        needsSubjectsForOrdering || needsSubjectsForLessonFiltering;

      let currentUserLevel = userData?.level ?? null;
      if (needsLevelForOrdering && !currentUserLevel) {
        try {
          const userDataResponse = await getUserData(apiToken);
          currentUserLevel = userDataResponse.data.level;
          setUserData(userDataResponse.data);
        } catch (userDataError) {
          console.warn(
            "[Lessons] Failed to load user level for lesson prioritization:",
            userDataError
          );
        }
      }

      let subjectsById = new Map<number, ApiSubject>();

      if (needsSubjects) {
        const allSubjectIds = availableLessonAssignments.map(
          (assignment) => assignment.data.subject_id
        );

        const allSubjectsResponse = await getSubjects(
          apiToken,
          {
            ids: allSubjectIds,
          },
          { skipCollectionCache: true }
        );

        subjectsById = new Map(
          allSubjectsResponse.data.map((subject) => [subject.id, subject])
        );
      }

      const filteredAssignments = excludeKanaVocabularyFromLessons
        ? availableLessonAssignments.filter((assignment) => {
            const subject = subjectsById.get(assignment.data.subject_id);
            return subject?.object !== "kana_vocabulary";
          })
        : availableLessonAssignments;

      if (filteredAssignments.length === 0) {
        Alert.alert(
          "No Lessons Available",
          "No lessons are available after applying your kana vocabulary filter.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const orderedAssignments = orderLessonAssignments(
        filteredAssignments,
        subjectsById,
        {
          userLevel: currentUserLevel ?? 1,
          lessonOrder,
          lessonTypeOrderEnabled,
          lessonTypeOrder,
          interleaveLessonTypesEnabled,
          prioritizeCriticalItems,
        }
      );

      const cappedAssignments =
        !hasSelectedLessonFilter && Number.isFinite(remainingDailyLessonSlots)
          ? orderedAssignments.slice(0, remainingDailyLessonSlots)
          : orderedAssignments;

      if (cappedAssignments.length === 0) {
        Alert.alert(
          "No Lessons Available",
          "There are no lessons available within your current daily limit.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      if (subjectsById.size === 0) {
        const subjectIds = cappedAssignments.map(
          (assignment) => assignment.data.subject_id
        );

        const subjectsResponse = await getSubjects(
          apiToken,
          {
            ids: subjectIds,
          },
          { skipCollectionCache: true }
        );

        subjectsById = new Map(
          subjectsResponse.data.map((subject) => [subject.id, subject])
        );
      }

      // Create lesson items by combining assignment and subject data
      const items: LessonItem[] = [];

      cappedAssignments.forEach((assignment) => {
        const subject = subjectsById.get(assignment.data.subject_id);

        if (!subject) {
          // Skip if no matching subject
          console.error(
            `Could not find subject for assignment ${assignment.id}`
          );
          return;
        }

        items.push({
          id: items.length, // Unique ID for this lesson item
          assignmentId: assignment.id,
          subjectId: assignment.data.subject_id,
          availableAt: assignment.data.available_at ?? null,
          subject: subject,
          meaningDone: false,
          readingDone: false,
          meaningIncorrect: 0,
          readingIncorrect: 0,
          submitted: false,
        });
      });

      if (items.length === 0) {
        Alert.alert("Error", "Failed to prepare lesson items.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      // Calculate the counts for each subject type
      const counts: TypeCounts = {
        radical: 0,
        kanji: 0,
        vocabulary: 0,
      };

      items.forEach((item) => {
        const subjectType = item.subject.object;
        if (subjectType === "radical") {
          counts.radical++;
        } else if (subjectType === "kanji") {
          counts.kanji++;
        } else if (
          subjectType === "vocabulary" ||
          subjectType === "kana_vocabulary"
        ) {
          counts.vocabulary++;
        }
      });

      setTypeCounts(counts);

      // Collect all related subject IDs that we need to fetch
      const relatedIds = new Set<number>();

      // For each subject, collect component subjects and amalgamation subjects
      items.forEach((item) => {
        // Component subjects (for kanji and vocabulary)
        if (item.subject.data.component_subject_ids) {
          item.subject.data.component_subject_ids.forEach((id) => {
            relatedIds.add(id);
          });
        }

        // Amalgamation subjects (for radicals and kanji)
        if (item.subject.data.amalgamation_subject_ids) {
          item.subject.data.amalgamation_subject_ids.forEach((id) => {
            relatedIds.add(id);
          });
        }

        // Visually similar kanji (for kanji when using WaniKani source)
        if (item.subject.data.visually_similar_subject_ids) {
          item.subject.data.visually_similar_subject_ids.forEach((id) => {
            relatedIds.add(id);
          });
        }
      });

      // Fetch all related subjects in one request
      if (relatedIds.size > 0) {
        try {
          console.log(`Fetching ${relatedIds.size} related subjects`);
          const relatedSubjectsResponse = await getSubjects(
            apiToken,
            {
              ids: Array.from(relatedIds),
            },
            { skipCollectionCache: true }
          );

          // Convert to a lookup map for easier access
          const subjectsMap: { [key: number]: ApiSubject } = {};
          relatedSubjectsResponse.data.forEach((subject) => {
            subjectsMap[subject.id] = subject;
          });

          setRelatedSubjects(subjectsMap);
        } catch (error) {
          console.error("Error fetching related subjects:", error);
          // Continue anyway as this isn't critical
        }
      }

      // Organize items into batches
      const batches: LessonBatch[] = [];
      for (let i = 0; i < items.length; i += lessonBatchSize) {
        batches.push({
          items: items.slice(i, Math.min(i + lessonBatchSize, items.length)),
          completed: false,
        });
      }

      setAllLessons(items);
      setLessonBatches(batches);
      setCurrentBatchIndex(0);
      setCurrentItemIndex(0);
      setMode(LessonsMode.LESSON);

      setProgress({
        totalItems: items.length,
        completedItems: 0,
        currentBatch: 1,
        totalBatches: batches.length,
      });
    } catch (error) {
      console.error("Error loading lessons:", error);

      if (isRateLimitError(error)) {
        Alert.alert(
          "Too Many Requests",
          "You've made too many requests to WaniKani. The rate limit resets every minute. Please wait a moment and try again.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        Alert.alert("Error", "Failed to load lessons. Please try again.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextItem = () => {
    const currentBatch = lessonBatches[currentBatchIndex];

    if (mode === LessonsMode.LESSON) {
      // Move to next item in lesson mode
      if (currentItemIndex < currentBatch.items.length - 1) {
        // Still have more items in this batch
        setCurrentItemIndex(currentItemIndex + 1);
      } else {
        // Finished going through all items in batch - start review
        setMode(LessonsMode.REVIEW);
        const items = [...currentBatch.items];
        setReviewItems(items);
        initializeReviewQueue(items);
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
    // Check if back-to-back mode is enabled (and anki grouped mode is not on)
    const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
    const shouldForceQuestionTypeOrder =
      reviewQuestionOrderEnabled && !effectiveAnkiGrouping;

    let finalQuestions: { type: "meaning" | "reading"; itemId: number }[];

    if (useBackToBack) {
      // Keep paired questions consecutive in lesson-review mode.
      finalQuestions = generateQuestionsFromItems(items, {
        forceQuestionTypeOrder: shouldForceQuestionTypeOrder,
        questionTypeOrder: preferredQuestionType,
      });
    } else if (shouldForceQuestionTypeOrder) {
      // In spread mode, use the shared queue builder so the selected type is always first.
      const queueItems: OrderableReviewItem[] = items.map((item) => {
        const subjectObject =
          item.subject.object === "radical" ||
          item.subject.object === "kanji" ||
          item.subject.object === "vocabulary" ||
          item.subject.object === "kana_vocabulary"
            ? item.subject.object
            : "vocabulary";

        return {
          id: item.id,
          subject: {
            object: subjectObject,
            data: {
              level: item.subject.data.level,
              readings: item.subject.data.readings,
            },
          },
        };
      });

      finalQuestions = buildReviewQuestionQueue(queueItems, {
        groupQuestions: effectiveAnkiGrouping,
        backToBack: false,
        maxQuestionGap: 10,
        questionTypeOrderEnabled: true,
        questionTypeOrder: preferredQuestionType,
      });
    } else {
      // Preserve existing default behavior when override is disabled.
      const questions = generateQuestionsFromItems(items, {
        forceQuestionTypeOrder: false,
        questionTypeOrder: "meaning",
      });
      finalQuestions = pseudorandomShuffle(questions);
    }

    setMasterQueue(finalQuestions);
    setActiveQueue(
      finalQuestions.slice(0, Math.min(ACTIVE_QUEUE_SIZE, finalQuestions.length))
    );
    setCurrentQuestion(finalQuestions[0] || null);
    setSessionCompleting(false); // Reset completion flag
  };

  // Generate questions from lesson items
  const generateQuestionsFromItems = (
    items: LessonItem[],
    options: {
      forceQuestionTypeOrder: boolean;
      questionTypeOrder: "meaning" | "reading";
    }
  ) => {
    const { forceQuestionTypeOrder, questionTypeOrder } = options;
    const questions: { type: "meaning" | "reading"; itemId: number }[] = [];

    items.forEach((item) => {
      // Add reading question for kanji and vocabulary with readings
      const isRadical = item.subject.object === "radical";
      const isVocabWithoutReading =
        (item.subject.object === "vocabulary" ||
          item.subject.object === "kana_vocabulary") &&
        !item.subject.data.readings;

      const hasReading = !isRadical && !isVocabWithoutReading;

      if (effectiveAnkiGrouping && hasReading) {
        // In anki grouped mode, only add one "meaning" question per subject
        // The ReviewQuestionScreen will handle showing both meaning and reading
        questions.push({ type: "meaning", itemId: item.id });
      } else {
        if (hasReading && forceQuestionTypeOrder && questionTypeOrder === "reading") {
          questions.push({ type: "reading", itemId: item.id });
          questions.push({ type: "meaning", itemId: item.id });
        } else {
          // Regular mode - add meaning first, then reading when available
          questions.push({ type: "meaning", itemId: item.id });
          if (hasReading) {
            questions.push({ type: "reading", itemId: item.id });
          }
        }
      }
    });

    return questions;
  };

  // Shuffle questions with spacing constraints
  const pseudorandomShuffle = (
    questions: { type: "meaning" | "reading"; itemId: number }[]
  ) => {
    const shuffled = [...questions];

    // Simple shuffle - can be enhanced with spacing logic if needed
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
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
    const queueWithoutCurrent = activeQueue.slice(1);

    // Check if back-to-back mode is enabled (and anki grouped mode is not on)
    const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;

    let newActiveQueue: { type: "meaning" | "reading"; itemId: number }[];

    if (useBackToBack) {
      // Back-to-back requeue logic:
      // 1. If the paired question (other type for same subject) is in the queue, show it next, then this question
      // 2. If no paired question (already answered or single-part item), show this question immediately

      const pairedType = currentQuestion.type === "meaning" ? "reading" : "meaning";
      const pairedQuestionIndex = queueWithoutCurrent.findIndex(
        (q) => q.itemId === currentQuestion.itemId && q.type === pairedType
      );

      if (pairedQuestionIndex !== -1) {
        // Found paired question - move it to position 0, put incorrect question at position 1
        const pairedQuestion = queueWithoutCurrent[pairedQuestionIndex];
        const queueWithoutPaired = [
          ...queueWithoutCurrent.slice(0, pairedQuestionIndex),
          ...queueWithoutCurrent.slice(pairedQuestionIndex + 1),
        ];
        // Paired question first, then the incorrect question, then the rest
        newActiveQueue = [pairedQuestion, { ...currentQuestion }, ...queueWithoutPaired];
      } else {
        // No paired question in queue - show the incorrect question immediately
        newActiveQueue = [{ ...currentQuestion }, ...queueWithoutCurrent];
      }
    } else {
      // Original requeue logic: insert at random position (avoid position 0)
      newActiveQueue = [...queueWithoutCurrent];
      const insertPosition =
        newActiveQueue.length > 0
          ? Math.floor(Math.random() * newActiveQueue.length) + 1
          : 0;

      newActiveQueue.splice(insertPosition, 0, { ...currentQuestion });
    }

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
  const refillActiveQueueIfNeeded = (
    currentActiveQueue: { type: "meaning" | "reading"; itemId: number }[]
  ) => {
    if (
      currentActiveQueue.length <= REFILL_THRESHOLD &&
      masterQueue.length > ACTIVE_QUEUE_SIZE
    ) {
      const needed = ACTIVE_QUEUE_SIZE - currentActiveQueue.length;
      // Take items from after the initial active queue portion
      const startIndex = ACTIVE_QUEUE_SIZE;
      const endIndex = Math.min(startIndex + needed, masterQueue.length);
      const toAdd = masterQueue.slice(startIndex, endIndex);

      if (toAdd.length > 0) {
        // Update active queue with new items
        const newActiveQueue = [...currentActiveQueue, ...toAdd];
        setActiveQueue(newActiveQueue);

        // Remove the added items from master queue by creating a new queue
        // that excludes the items we just added
        const updatedMasterQueue = [
          ...masterQueue.slice(0, ACTIVE_QUEUE_SIZE),
          ...masterQueue.slice(endIndex),
        ];
        setMasterQueue(updatedMasterQueue);
      }
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

    // Update the overall type counts by subtracting the completed batch counts
    setTypeCounts((prev) => ({
      radical: Math.max(0, prev.radical - batchTypeCounts.radical),
      kanji: Math.max(0, prev.kanji - batchTypeCounts.kanji),
      vocabulary: Math.max(0, prev.vocabulary - batchTypeCounts.vocabulary),
    }));

    const isFinalBatch = currentBatchIndex >= updatedBatches.length - 1;

    // Always show completion screen so users can save the current lesson session to lists.
    setCompletedBatchStats({
      batchNumber: currentBatchIndex + 1,
      itemCount: completedBatch.items.length,
      typeCounts: batchTypeCounts,
    });
    setMode(LessonsMode.BATCH_COMPLETE);
    setIsFinalBatchComplete(isFinalBatch);
    setSessionCompleting(false); // Reset for next action

    setProgress((prev) => ({
      ...prev,
      completedItems: Math.min(prev.totalItems, prev.completedItems + reviewItems.length),
      currentBatch: isFinalBatch ? prev.totalBatches : prev.currentBatch + 1,
    }));
  };

  // Handle continuing to next batch from batch completion screen
  const handleContinueToNextBatch = () => {
    setCurrentBatchIndex(currentBatchIndex + 1);
    setCurrentItemIndex(0);
    setMode(LessonsMode.LESSON);
    setCompletedBatchStats(null);
    setIsFinalBatchComplete(false);
  };

  const navigateBackToDashboard = useCallback(() => {
    void refreshLessonsAndReviews();
    router.dismissAll();
    router.replace({
      pathname: "/",
      params: { refreshLessonsReviews: "true" },
    });
  }, [refreshLessonsAndReviews]);

  const handleGoToDashboard = () => {
    navigateBackToDashboard();
  };

  const handleAnswer = async (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading",
    isCorrect: boolean,
    wasIncorrect?: boolean,
    isGroupedAnswer?: boolean
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

      // Only move to next question if:
      // - Not a grouped answer, OR
      // - It's a grouped answer AND this is the reading question (process once)
      if (!isGroupedAnswer || (isGroupedAnswer && questionType === "reading")) {
        moveToNextQuestion();
      }
    } else {
      // Increment incorrect count
      if (questionType === "meaning") {
        updatedItems[itemIndex].meaningIncorrect += 1;
      } else {
        updatedItems[itemIndex].readingIncorrect += 1;
      }

      // Only requeue if:
      // - Not a grouped answer, OR
      // - It's a grouped answer AND this is the reading question (process once)
      if (!isGroupedAnswer || (isGroupedAnswer && questionType === "reading")) {
        requeueQuestion();
      }
    }

    setReviewItems(updatedItems);

    // Check if item is complete and start assignment
    const isRadical = updatedItems[itemIndex].subject.object === "radical";
    const isVocabWithoutReading =
      (updatedItems[itemIndex].subject.object === "vocabulary" ||
        updatedItems[itemIndex].subject.object === "kana_vocabulary") &&
      !updatedItems[itemIndex].subject.data.readings;

    const isItemComplete =
      updatedItems[itemIndex].meaningDone &&
      (updatedItems[itemIndex].readingDone ||
        isRadical ||
        isVocabWithoutReading);

    if (isItemComplete && !updatedItems[itemIndex].submitted && apiToken) {
      try {
        const completedAt = new Date();
        const completedAtIso = completedAt.toISOString();
        const availableAtMs = Date.parse(
          updatedItems[itemIndex].availableAt ?? ""
        );
        const createdAt =
          Number.isFinite(availableAtMs) &&
          completedAt.getTime() <= availableAtMs
            ? null
            : completedAtIso;

        const queueResult = await queueProgressAndAttemptSend(apiToken, {
          assignmentId: updatedItems[itemIndex].assignmentId,
          subjectId: updatedItems[itemIndex].subjectId,
          progressType: "lesson",
          createdAt,
          availableAt: updatedItems[itemIndex].availableAt ?? null,
        });
        updatedItems[itemIndex].submitted = true;
        updatedItems[itemIndex].submissionFailed =
          !queueResult.response && !queueResult.queued;
        setReviewItems(updatedItems);

        if (queueResult.response || queueResult.queued) {
          await markLessonStartedInAssignmentCaches({
            assignmentId: updatedItems[itemIndex].assignmentId,
            startedAt: completedAtIso,
          }).catch((cacheError) => {
            console.warn(
              "[Lessons] Failed to update local assignment review time:",
              cacheError
            );
          });
        }

        if (queueResult.failure?.isPermissionError) {
          Alert.alert(
            "Permission Error",
            "Your API token doesn't have write permissions. Please update your token in WaniKani settings to allow starting assignments.",
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        console.error("Error starting lesson assignment:", error);
        updatedItems[itemIndex].submissionFailed = true;
        setReviewItems(updatedItems);

        // Show appropriate error message based on error type
        if (isUnauthorizedError(error)) {
          Alert.alert(
            "Permission Error",
            "Your API token doesn't have write permissions. Please update your token in WaniKani settings to allow starting assignments.",
            [{ text: "OK" }]
          );
        }
      } finally {
        void refreshPendingLessonCount();
      }
    }
  };

  const renderPendingLessonSyncBadge = () => {
    if (pendingLessonCount <= 0) {
      return null;
    }

    return (
      <View style={styles.pendingSyncBadgeContainer} pointerEvents="none">
        <View
          style={[
            styles.pendingSyncBadge,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.pendingSyncBadgeText, { color: theme.textColor }]}>
            {pendingLessonCount} lesson sync
            {pendingLessonCount === 1 ? "" : "s"} pending
          </Text>
        </View>
      </View>
    );
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
        {renderPendingLessonSyncBadge()}
      </View>
    );
  }

  // If we're in lesson mode, show the lesson detail screen
  if (mode === LessonsMode.LESSON && lessonBatches.length > 0) {
    const currentBatch = lessonBatches[currentBatchIndex];
    const currentItem = currentBatch.items[currentItemIndex];

    return (
      <>
        <View style={styles.screenWrapper}>
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
                "Exit Lessons",
                "Are you sure you want to exit? Your progress will be saved, but incomplete lessons won't count.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Exit",
                    onPress: navigateBackToDashboard,
                  },
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
          {renderPendingLessonSyncBadge()}
        </View>

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
  if (
    mode === LessonsMode.REVIEW &&
    reviewItems.length > 0 &&
    currentQuestion
  ) {
    const currentItem = reviewItems.find(
      (item) => item.id === currentQuestion.itemId
    );

    if (!currentItem) {
      return (
        <View
          style={[styles.container, { backgroundColor: theme.backgroundColor }]}
        >
          <StatusBar
            barStyle={theme.isDark ? "light-content" : "dark-content"}
          />
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              Error loading question
            </Text>
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
        character_images:
          currentItem.subject.data.character_images || undefined,
        pronunciation_audios:
          currentItem.subject.data.pronunciation_audios || undefined,
      },
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ReviewQuestionScreen
          item={{ id: currentItem.id, subject: adaptedSubject }}
          questionType={currentQuestion.type}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
          onExit={() => {
            Alert.alert(
              "Exit Lessons",
              "Are you sure you want to exit? Your progress will be saved, but incomplete lessons won't count.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Exit",
                  onPress: navigateBackToDashboard,
                },
              ]
            );
          }}
          showHeader={true}
          showBackgroundColor={true}
          totalItems={reviewItems.length}
          currentItem={
            activeQueue.length > 0
              ? effectiveAnkiGrouping
                ? reviewItems.length -
                  (activeQueue.length + masterQueue.length - ACTIVE_QUEUE_SIZE)
                : reviewItems.length * 2 -
                  (activeQueue.length + masterQueue.length - ACTIVE_QUEUE_SIZE)
              : effectiveAnkiGrouping
              ? reviewItems.length
              : reviewItems.length * 2
          }
          completedCount={
            reviewItems.filter(
              (item) =>
                (item.meaningDone && item.readingDone) ||
                (item.meaningDone && isSubjectType(item.subject, "radical")) ||
                (item.meaningDone &&
                  isSubjectType(item.subject, "vocabulary") &&
                  !item.subject.data.readings)
            ).length
          }
          correctAnswersCount={reviewItems.reduce((count, item) => {
            let correctCount = 0;
            if (item.meaningDone) correctCount++;
            if (item.readingDone) correctCount++;
            return count + correctCount;
          }, 0)}
          isLessonFlow={true}
          studyMaterials={studyMaterialsMap.get(currentItem.subjectId)}
          onSynonymAdded={handleSynonymAdded}
        />
        {renderPendingLessonSyncBadge()}
      </View>
    );
  }

  // If we're in batch completion mode, show the batch completion screen
  if (mode === LessonsMode.BATCH_COMPLETE && completedBatchStats) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
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
                {isFinalBatchComplete ? "Lessons Complete!" : "Batch Complete!"}
              </Text>
              <Text
                style={[
                  styles.batchCompleteSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                {isFinalBatchComplete
                  ? "Amazing work! You finished all lessons in this session."
                  : `Great job! You've completed batch ${completedBatchStats.batchNumber} of ${lessonBatches.length}`}
              </Text>
            </View>

            <View style={styles.batchStatsContainer}>
              <Text
                style={[styles.batchStatsTitle, { color: theme.textColor }]}
              >
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
                style={[
                  styles.batchProgressText,
                  { color: theme.textSecondary },
                ]}
              >
                {progress.completedItems} of {progress.totalItems} items
                completed
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
                      width: `${
                        (progress.completedItems / progress.totalItems) * 100
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.batchSaveLessonsButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                  opacity: currentLessonSubjectIds.length > 0 ? 1 : 0.6,
                },
              ]}
              onPress={() => setShowSaveCurrentLessonsModal(true)}
              disabled={currentLessonSubjectIds.length === 0}
            >
              <Ionicons name="bookmark-outline" size={18} color={theme.textColor} />
              <Text
                style={[
                  styles.batchSaveLessonsButtonText,
                  { color: theme.textColor },
                ]}
              >
                Save current lessons to list ({currentLessonSubjectIds.length})
              </Text>
            </TouchableOpacity>

            <View style={styles.batchActionRow}>
              <TouchableOpacity
                style={[
                  styles.batchHomeButton,
                  { backgroundColor: theme.cardBackground, borderColor: theme.border },
                ]}
                onPress={handleGoToDashboard}
              >
                <Ionicons name="home" size={20} color={theme.textColor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.batchContinueButton,
                  { backgroundColor: subjectColors.kanji },
                ]}
                onPress={
                  isFinalBatchComplete
                    ? handleGoToDashboard
                    : handleContinueToNextBatch
                }
              >
                <Text style={styles.batchContinueButtonText}>
                  {isFinalBatchComplete ? "Finish" : "Next batch"}
                </Text>
                <Ionicons
                  name={isFinalBatchComplete ? "checkmark" : "chevron-forward"}
                  size={20}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <AddToSubjectListsModal
          visible={showSaveCurrentLessonsModal}
          subjectIds={currentLessonSubjectIds}
          subjectLabel={`Current lessons (${currentLessonSubjectIds.length})`}
          onClose={() => setShowSaveCurrentLessonsModal(false)}
        />
        {renderPendingLessonSyncBadge()}
      </View>
    );
  }

  // Fallback
  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <View style={styles.loadingContainer}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          No lessons available
        </Text>
        <TouchableOpacity
          style={[
            styles.buttonContainer,
            { backgroundColor: subjectColors.kanji },
          ]}
          onPress={handleGoToDashboard}
        >
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
      {renderPendingLessonSyncBadge()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  screenWrapper: {
    flex: 1,
  },
  pendingSyncBadgeContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 20,
    alignSelf: "center",
    zIndex: 50,
  },
  pendingSyncBadge: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingSyncBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
  errorText: {
    fontSize: 18,
    color: "#e53935",
    marginBottom: 20,
  },
  buttonContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Batch completion screen styles
  batchCompleteContainer: {
    flex: 1,
    backgroundColor: "#f6f6f6",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  batchCompleteContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  batchCompleteHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  batchCompleteTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  batchCompleteSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  batchStatsContainer: {
    width: "100%",
    marginBottom: 32,
  },
  batchStatsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  batchStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  batchStatItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
    marginVertical: 4,
    minWidth: 80,
  },
  batchStatNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  batchStatLabel: {
    fontSize: 12,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  batchTotalText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  batchProgressContainer: {
    width: "100%",
    marginBottom: 32,
  },
  batchProgressText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  batchProgressBar: {
    height: 8,
    backgroundColor: "#eee",
    borderRadius: 4,
    overflow: "hidden",
  },
  batchProgressFill: {
    height: "100%",
    backgroundColor: "transparent",
    borderRadius: 4,
  },
  batchSaveLessonsButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  batchSaveLessonsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  batchActionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  batchHomeButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  batchContinueButton: {
    backgroundColor: "transparent",
    flex: 1,
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  batchContinueButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
});
