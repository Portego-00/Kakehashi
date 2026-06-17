import { router, useLocalSearchParams } from "expo-router";
import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewResultsScreen from "../../src/components/ReviewResultsScreen";
import {
  type Subject as ApiSubject,
  getAllAssignmentsCached,
  getSubjects,
  getStudyMaterials,
} from "../../src/utils/api";
import type { Subject as WaniKaniSubject } from "../../src/types/wanikani";
import { getAllSubjects } from "../../src/utils/cache";
import {
  buildReviewQuestionQueue,
  generateReviewQuestions,
  sortReviewItemsForQueue,
  type OrderableReviewItem,
  type ReviewQueueQuestion,
} from "../../src/utils/reviewOrdering";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  loadExtraStudySessionState,
  saveExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Define interfaces similar to the regular review screen
interface ReviewItem {
  id: number;
  assignmentId: number; // We'll use a fake ID for custom reviews
  subjectId: number;
  subject: WaniKaniSubject;
  srsStage?: number;
  availableAt?: string | null;
  meaningDone: boolean;
  readingDone: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  progressCounted?: boolean;
  meaningCorrectlyAnswered?: boolean;
  readingCorrectlyAnswered?: boolean;
  meaningIncorrectCounted?: boolean;
  readingIncorrectCounted?: boolean;
}

interface CustomReviewProgressState {
  current: number;
  total: number;
  meaningCorrect: number;
  readingCorrect: number;
  totalItems: number;
  answeredCount: number;
  completedItems: number;
  meaningAttempts: number;
  readingAttempts: number;
  correctAnswersCount: number;
}

interface CustomReviewSavedSession {
  savedAt: number;
  reviewItems: ReviewItem[];
  activeQueue: ReviewQueueQuestion[];
  currentQuestion: ReviewQueueQuestion | null;
  progress: CustomReviewProgressState;
  isWrapUpMode: boolean;
  wrapUpDeferredQuestions?: ReviewQueueQuestion[];
  sessionUsesAnkiGrouping: boolean;
  studyMaterialEntries: [number, { meaning_synonyms?: string[] }][];
}

const EMPTY_PROGRESS_STATE: CustomReviewProgressState = {
  current: 0,
  total: 0,
  meaningCorrect: 0,
  readingCorrect: 0,
  totalItems: 0,
  answeredCount: 0,
  completedItems: 0,
  meaningAttempts: 0,
  readingAttempts: 0,
  correctAnswersCount: 0,
};

const CUSTOM_REVIEW_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW;

export default function CustomReviewScreen() {
  useActivityTracking("custom_review");
  const { apiToken } = useAuthStore();
  const { theme } = useTheme();
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    acceptUserSynonymsAsAnswers,
    customReviewOrder,
    backToBackQuestions,
    reviewQuestionOrderEnabled,
    meaningFirst,
  } = useSettingsStore();
  const effectiveAnkiGrouping =
    ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both";
  const preferredQuestionType: "meaning" | "reading" = meaningFirst
    ? "meaning"
    : "reading";
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [activeQueue, setActiveQueue] = useState<ReviewQueueQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQueueQuestion | null>(null);
  const [progress, setProgress] = useState<CustomReviewProgressState>(
    EMPTY_PROGRESS_STATE,
  );
  const [isFinished, setIsFinished] = useState(false);
  const [hasError, setHasError] = useState(false);
  // Wrap up mode state
  const [isWrapUpMode, setIsWrapUpMode] = useState(false);
  const wrapUpDeferredQuestionsRef = useRef<ReviewQueueQuestion[]>([]);
  const [studyMaterialsMap, setStudyMaterialsMap] = useState<Map<number, { meaning_synonyms?: string[] }>>(new Map());
  const [sessionUsesAnkiGrouping, setSessionUsesAnkiGrouping] = useState(
    effectiveAnkiGrouping,
  );

  // Handler for when a synonym is added from the review screen
  const handleSynonymAdded = useCallback((subjectId: number, newSynonyms: string[]) => {
    setStudyMaterialsMap(prev => {
      const updated = new Map(prev);
      updated.set(subjectId, { meaning_synonyms: newSynonyms });
      return updated;
    });
  }, []);

  const WRAP_UP_TARGET_SUBJECTS = 10;

  // Helper: remaining subjects count (unique subjects left, including current)
  const getRemainingSubjectsCount = useCallback(() => {
    const uniqueSubjectIds = new Set(activeQueue.map(q => q.itemId));
    return uniqueSubjectIds.size;
  }, [activeQueue]);

  const isWrapUpAvailable = getRemainingSubjectsCount() > WRAP_UP_TARGET_SUBJECTS;

  const hasReadingQuestion = (reviewItem: ReviewItem): boolean => {
    if (reviewItem.subject.object === "radical") {
      return false;
    }

    const readings = reviewItem.subject.data.readings;
    if (
      reviewItem.subject.object === "vocabulary" ||
      reviewItem.subject.object === "kana_vocabulary"
    ) {
      if (!readings) {
        return false;
      }

      if (Array.isArray(readings) && readings.length === 0) {
        return false;
      }
    }

    return true;
  };

  // Safe navigation back to dashboard - handles case where there's no stack to dismiss
  const navigateToDashboard = useCallback(() => {
    try {
      router.dismissAll();
    } catch {
      // Ignore error if there's nothing to dismiss
    }
    router.replace("/");
  }, []);

  const clearSavedCustomReviewSession = useCallback(async () => {
    await clearExtraStudySessionState(CUSTOM_REVIEW_SESSION_KEY);
  }, []);

  const restoreSavedCustomReviewSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<CustomReviewSavedSession>(
      CUSTOM_REVIEW_SESSION_KEY,
    );
    if (!savedSession) {
      return false;
    }

    if (!Array.isArray(savedSession.reviewItems) || !Array.isArray(savedSession.activeQueue)) {
      await clearSavedCustomReviewSession();
      return false;
    }

    const restoredQueue = savedSession.activeQueue.filter(
      (question): question is ReviewQueueQuestion =>
        !!question &&
        typeof question === "object" &&
        typeof question.itemId === "number" &&
        (question.type === "meaning" || question.type === "reading"),
    );
    if (restoredQueue.length === 0) {
      await clearSavedCustomReviewSession();
      return false;
    }

    const fallbackCurrentQuestion = restoredQueue[0] ?? null;
    const requestedCurrentQuestion =
      savedSession.currentQuestion &&
      typeof savedSession.currentQuestion.itemId === "number" &&
      (savedSession.currentQuestion.type === "meaning" ||
        savedSession.currentQuestion.type === "reading")
        ? savedSession.currentQuestion
        : fallbackCurrentQuestion;
    const restoredCurrentQuestion =
      requestedCurrentQuestion &&
      restoredQueue.some(
        (question) =>
          question.itemId === requestedCurrentQuestion.itemId &&
          question.type === requestedCurrentQuestion.type,
      )
        ? requestedCurrentQuestion
        : fallbackCurrentQuestion;

    const normalizedStudyMaterialEntries = Array.isArray(
      savedSession.studyMaterialEntries,
    )
      ? savedSession.studyMaterialEntries.filter(
          (entry): entry is [number, { meaning_synonyms?: string[] }] =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "number" &&
            !!entry[1] &&
            typeof entry[1] === "object",
        )
      : [];
    const restoredWrapUpDeferredQuestions = Array.isArray(
      savedSession.wrapUpDeferredQuestions,
    )
      ? savedSession.wrapUpDeferredQuestions.filter(
          (question): question is ReviewQueueQuestion =>
            !!question &&
            typeof question === "object" &&
            typeof question.itemId === "number" &&
            (question.type === "meaning" || question.type === "reading"),
        )
      : [];

    setReviewItems(savedSession.reviewItems as ReviewItem[]);
    setActiveQueue(restoredQueue);
    setCurrentQuestion(restoredCurrentQuestion);
    setProgress({
      ...EMPTY_PROGRESS_STATE,
      ...(savedSession.progress || {}),
    });
    setIsWrapUpMode(savedSession.isWrapUpMode === true);
    wrapUpDeferredQuestionsRef.current =
      savedSession.isWrapUpMode === true ? restoredWrapUpDeferredQuestions : [];
    setStudyMaterialsMap(new Map(normalizedStudyMaterialEntries));
    setSessionUsesAnkiGrouping(
      typeof savedSession.sessionUsesAnkiGrouping === "boolean"
        ? savedSession.sessionUsesAnkiGrouping
        : effectiveAnkiGrouping,
    );
    setIsFinished(!restoredCurrentQuestion);
    setHasError(false);
    setIsLoading(false);
    return true;
  }, [clearSavedCustomReviewSession, effectiveAnkiGrouping]);

  const saveCustomReviewSessionForLater = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || reviewItems.length === 0 || activeQueue.length === 0) {
      return false;
    }

    const payload: CustomReviewSavedSession = {
      savedAt: Date.now(),
      reviewItems,
      activeQueue,
      currentQuestion,
      progress,
      isWrapUpMode,
      wrapUpDeferredQuestions: wrapUpDeferredQuestionsRef.current,
      sessionUsesAnkiGrouping,
      studyMaterialEntries: Array.from(studyMaterialsMap.entries()),
    };

    return saveExtraStudySessionState(CUSTOM_REVIEW_SESSION_KEY, payload);
  }, [
    activeQueue,
    currentQuestion,
    isWrapUpMode,
    progress,
    reviewItems,
    sessionUsesAnkiGrouping,
    studyMaterialsMap,
  ]);

  // Load selected subjects
  const loadCustomReview = useCallback(async () => {
    const resumeRequested =
      params.resume === "true" ||
      (typeof params.subjectIds !== "string" && params.resume !== "false");
    if (resumeRequested) {
      const restored = await restoreSavedCustomReviewSession();
      if (restored) {
        return;
      }
    }

    if (!apiToken || typeof params.subjectIds !== "string") {
      navigateToDashboard();
      return;
    }

    try {
      setIsLoading(true);
      setHasError(false);
      setIsFinished(false);
      setIsWrapUpMode(false);
      wrapUpDeferredQuestionsRef.current = [];
      setSessionUsesAnkiGrouping(effectiveAnkiGrouping);
      await clearSavedCustomReviewSession();

      // Parse subject IDs from params
      const subjectIds = params.subjectIds
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

      // Resolve subjects from durable local cache first so custom review works offline.
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
            const fetchedSubjectsById = new Map<number, ApiSubject>(
              subjectsResponse.data.map((subject) => [subject.id, subject]),
            );
            loadedSubjects = subjectIds
              .map(
                (subjectId) =>
                  subjectsById.get(subjectId) ?? fetchedSubjectsById.get(subjectId),
              )
              .filter((subject): subject is ApiSubject => Boolean(subject));
          } catch (error) {
            if (loadedSubjects.length === 0) {
              throw error;
            }
            console.warn(
              "[Custom Review] Failed to fetch missing subjects from API, continuing with cached subset:",
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

      const subjectIdToStage = new Map<number, number>();
      const subjectIdToAvailableAt = new Map<number, string | null>();
      const loadedSubjectIds = loadedSubjects.map((subject) => subject.id);
      try {
        const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
          subject_ids: loadedSubjectIds,
        });
        assignmentsResponse.data.forEach((assignment) => {
          subjectIdToStage.set(
            assignment.data.subject_id,
            assignment.data.srs_stage,
          );
          subjectIdToAvailableAt.set(
            assignment.data.subject_id,
            assignment.data.available_at ?? null,
          );
        });
      } catch (error) {
        console.warn(
          "[Custom Review] Failed to load assignment SRS stages:",
          error,
        );
      }

      // Load study materials for user synonyms if setting is enabled
      if (acceptUserSynonymsAsAnswers) {
        try {
          const studyMaterialsResponse = await getStudyMaterials(apiToken, {
            subject_ids: loadedSubjectIds,
          });
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
        } catch (error) {
          console.warn("[User Synonyms] Failed to load study materials:", error);
        }
      }

      // Create review items from subjects
      const items: ReviewItem[] = loadedSubjects.map((subject) => ({
        id: subject.id,
        assignmentId: -subject.id, // Negative ID to indicate custom review
        subjectId: subject.id,
        subject: subject as WaniKaniSubject,
        srsStage: subjectIdToStage.get(subject.id),
        availableAt: subjectIdToAvailableAt.get(subject.id) ?? null,
        meaningDone: false,
        readingDone: false,
        meaningIncorrect: 0,
        readingIncorrect: 0,
        progressCounted: false,
        meaningCorrectlyAnswered: false,
        readingCorrectlyAnswered: false,
        meaningIncorrectCounted: false,
        readingIncorrectCounted: false,
      }));

      const sortableItems = items as (ReviewItem & OrderableReviewItem)[];
      const sortedItems = sortReviewItemsForQueue(sortableItems, {
        reviewOrder: customReviewOrder,
      });
      const allQuestions = generateReviewQuestions(sortedItems, {
        groupQuestions: effectiveAnkiGrouping,
      });
      const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
      const orderedQuestions = buildReviewQuestionQueue(sortedItems, {
        groupQuestions: effectiveAnkiGrouping,
        backToBack: useBackToBack,
        questionTypeOrderEnabled: reviewQuestionOrderEnabled,
        questionTypeOrder: preferredQuestionType,
        maxQuestionGap: 10,
      });

      // Set up the review
      setReviewItems(sortedItems);
      setActiveQueue(orderedQuestions);
      setCurrentQuestion(orderedQuestions[0] || null);

      // In grouped mode, 1 question per item; otherwise divide by 2 since each item has meaning+reading
      const totalForProgress = effectiveAnkiGrouping
        ? sortedItems.length
        : allQuestions.length / 2;

      setProgress({
        ...EMPTY_PROGRESS_STATE,
        total: totalForProgress,
        totalItems: sortedItems.length,
      });
    } catch (error) {
      console.error("Error loading custom review:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    apiToken,
    params.resume,
    params.subjectIds,
    effectiveAnkiGrouping,
    acceptUserSynonymsAsAnswers,
    customReviewOrder,
    backToBackQuestions,
    reviewQuestionOrderEnabled,
    preferredQuestionType,
    clearSavedCustomReviewSession,
    navigateToDashboard,
    restoreSavedCustomReviewSession,
  ]);

  useEffect(() => {
    loadCustomReview();
  }, [loadCustomReview]);

  // Wrap up: toggle between the trimmed queue and the full remaining queue.
  const handleWrapUp = useCallback(() => {
    if (isWrapUpMode) {
      const remainingInActive = currentQuestion
        ? activeQueue.slice(1)
        : activeQueue.slice();
      const restoredQueue = currentQuestion
        ? [
            currentQuestion,
            ...remainingInActive,
            ...wrapUpDeferredQuestionsRef.current,
          ]
        : [...remainingInActive, ...wrapUpDeferredQuestionsRef.current];

      wrapUpDeferredQuestionsRef.current = [];
      setIsWrapUpMode(false);
      setActiveQueue(restoredQueue);

      if (restoredQueue.length > 0) {
        setCurrentQuestion(restoredQueue[0]);
        setIsFinished(false);
      } else {
        setCurrentQuestion(null);
        setIsFinished(true);
      }
      return;
    }

    setIsWrapUpMode(true);

    // Build all remaining questions excluding the current one to avoid duplication
    const remainingInActive = currentQuestion ? activeQueue.slice(1) : activeQueue.slice();
    const questionsAfterCurrent = [...remainingInActive];

    // Ordered unique subject ids as they appear
    const orderedSubjectIds: number[] = [];
    for (const q of questionsAfterCurrent) {
      if (!orderedSubjectIds.includes(q.itemId)) orderedSubjectIds.push(q.itemId);
    }

    // Helpers to inspect subject completion state
    const isSubjectPartial = (subjectId: number): boolean => {
      const item = reviewItems.find(it => it.id === subjectId);
      if (!item) return false;
      const isRadical = item.subject.object === 'radical';
      const hasNoReading = !item.subject.data.readings || item.subject.data.readings.length === 0;
      if (isRadical || hasNoReading) return false;
      return (item.meaningDone && !item.readingDone) || (!item.meaningDone && item.readingDone);
    };

    const isSubjectNotStarted = (subjectId: number): boolean => {
      const item = reviewItems.find(it => it.id === subjectId);
      if (!item) return false;
      const isRadical = item.subject.object === 'radical';
      const hasNoReading = !item.subject.data.readings || item.subject.data.readings.length === 0;
      if (isRadical || hasNoReading) {
        return !item.meaningDone;
      }
      return !item.meaningDone && !item.readingDone;
    };

    // Build target subjects list up to WRAP_UP_TARGET_SUBJECTS
    const targetSubjectIds: number[] = [];
    const pushTarget = (sid: number) => {
      if (!targetSubjectIds.includes(sid) && targetSubjectIds.length < WRAP_UP_TARGET_SUBJECTS) {
        targetSubjectIds.push(sid);
      }
    };

    // Include current subject if any
    if (currentQuestion) pushTarget(currentQuestion.itemId);

    // Prioritize partials by queue order
    for (const sid of orderedSubjectIds) {
      if (isSubjectPartial(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    // Fill with not-started subjects
    for (const sid of orderedSubjectIds) {
      if (!isSubjectPartial(sid) && isSubjectNotStarted(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    // Fallback to any other pending subjects
    for (const sid of orderedSubjectIds) {
      if (!targetSubjectIds.includes(sid)) pushTarget(sid);
      if (targetSubjectIds.length >= WRAP_UP_TARGET_SUBJECTS) break;
    }

    // Filter remaining questions to only selected subjects
    const filteredRemaining = questionsAfterCurrent.filter(q => targetSubjectIds.includes(q.itemId));
    wrapUpDeferredQuestionsRef.current = questionsAfterCurrent.filter(
      q => !targetSubjectIds.includes(q.itemId)
    );

    // Rebuild active queue: keep current question, then filtered remainder
    const newActive = currentQuestion ? [currentQuestion, ...filteredRemaining] : filteredRemaining;
    setActiveQueue(newActive);
  }, [isWrapUpMode, activeQueue, currentQuestion, reviewItems]);

  // Move to the next question
  const moveToNextQuestion = () => {
    const updatedQueue = activeQueue.slice(1);
    setActiveQueue(updatedQueue);
    
    if (updatedQueue.length > 0) {
      setCurrentQuestion(updatedQueue[0]);
    } else {
      setIsFinished(true);
    }
  };

  // Add a question back to the queue (for incorrect answers)
  const requeueQuestion = (question: ReviewQueueQuestion) => {
    const queueWithoutCurrent = activeQueue.slice(1);

    // If there are no more items in the queue, re-ask the same question
    if (queueWithoutCurrent.length === 0) {
      setActiveQueue([question]);
      setCurrentQuestion(question);
      return;
    }

    // Insert at a random position that is not the beginning to avoid immediate repeat
    const insertPosition = Math.floor(Math.random() * queueWithoutCurrent.length) + 1; // 1..length
    const newQueue = [...queueWithoutCurrent];
    newQueue.splice(insertPosition, 0, question);

    setActiveQueue(newQueue);
    setCurrentQuestion(newQueue[0]);
  };

  const handleAskAgain = (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading"
  ) => {
    requeueQuestion({ type: questionType, itemId: item.id });
  };

  const handleSkip = (
    item: { id: number; subject: any },
    _questionType: "meaning" | "reading"
  ) => {
    const reviewItem = reviewItems.find((reviewItem) => reviewItem.id === item.id);
    if (!reviewItem) {
      moveToNextQuestion();
      return;
    }

    const hadMeaningMarkedCorrect = reviewItem.meaningCorrectlyAnswered === true;
    const hadReadingMarkedCorrect = reviewItem.readingCorrectlyAnswered === true;

    if (hadMeaningMarkedCorrect || hadReadingMarkedCorrect) {
      setProgress((prev) => ({
        ...prev,
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

    setReviewItems((prevItems) =>
      prevItems.map((existingItem) =>
        existingItem.id === item.id
          ? {
              ...existingItem,
              meaningDone: false,
              readingDone: false,
              meaningIncorrect: 0,
              readingIncorrect: 0,
              meaningCorrectlyAnswered: false,
              readingCorrectlyAnswered: false,
              meaningIncorrectCounted: false,
              readingIncorrectCounted: false,
              progressCounted: false,
            }
          : existingItem
      )
    );

    const remainingQuestions = activeQueue.slice(1).filter(
      (question) => question.itemId !== item.id
    );

    const resetQuestions: ReviewQueueQuestion[] = [{ type: "meaning", itemId: item.id }];
    if (!sessionUsesAnkiGrouping && hasReadingQuestion(reviewItem)) {
      resetQuestions.push({ type: "reading", itemId: item.id });
    }

    const reorderedQueue = [...remainingQuestions, ...resetQuestions];
    setActiveQueue(reorderedQueue);

    if (reorderedQueue.length > 0) {
      setCurrentQuestion(reorderedQueue[0]);
      setIsFinished(false);
      return;
    }

    setCurrentQuestion(null);
    setIsFinished(true);
  };

  // Handle answer from ReviewQuestionScreen
  const handleAnswer = (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading",
    isCorrect: boolean,
    _wasIncorrect: boolean,
    isGroupedAnswer: boolean = false
  ) => {
    const updatedItems = [...reviewItems];
    const itemIndex = updatedItems.findIndex((ri) => ri.id === item.id);

    if (itemIndex === -1) return;

    // For accuracy calculation: count every answer submission
    // For grouped answers (Anki mode with meaning+reading), only count once
    if (!isGroupedAnswer || questionType === "meaning") {
      setProgress((prev) => ({
        ...prev,
        answeredCount: prev.answeredCount + 1,
        correctAnswersCount: isCorrect
          ? prev.correctAnswersCount + 1
          : prev.correctAnswersCount,
      }));
    }

    // Track attempts by question type (for detailed stats)
    if (questionType === "meaning") {
      setProgress((prev) => ({
        ...prev,
        meaningAttempts: prev.meaningAttempts + 1,
      }));
    } else {
      setProgress((prev) => ({
        ...prev,
        readingAttempts: prev.readingAttempts + 1,
      }));
    }

    if (isCorrect) {
      // Mark as done
      if (questionType === "meaning") {
        updatedItems[itemIndex].meaningDone = true;
        if (!updatedItems[itemIndex].meaningCorrectlyAnswered) {
          updatedItems[itemIndex].meaningCorrectlyAnswered = true;
          setProgress((prev) => ({
            ...prev,
            meaningCorrect: prev.meaningCorrect + 1,
          }));
        }
      } else {
        updatedItems[itemIndex].readingDone = true;
        if (!updatedItems[itemIndex].readingCorrectlyAnswered) {
          updatedItems[itemIndex].readingCorrectlyAnswered = true;
          setProgress((prev) => ({
            ...prev,
            readingCorrect: prev.readingCorrect + 1,
          }));
        }
      }

      // Move to the next question right away (optimistic UI)
      // For grouped answers, only move after both answers are processed (on the reading call)
      if (!isGroupedAnswer || questionType === "reading") {
        moveToNextQuestion();
      }
    } else {
      // Increment incorrect count (but only once)
      if (questionType === "meaning" && !updatedItems[itemIndex].meaningIncorrectCounted) {
        updatedItems[itemIndex].meaningIncorrect += 1;
        updatedItems[itemIndex].meaningIncorrectCounted = true;
      } else if (questionType === "reading" && !updatedItems[itemIndex].readingIncorrectCounted) {
        updatedItems[itemIndex].readingIncorrect += 1;
        updatedItems[itemIndex].readingIncorrectCounted = true;
      }

      // Requeue the question
      requeueQuestion({ type: questionType, itemId: item.id });
    }

    // Check if item is complete
    const isRadical = updatedItems[itemIndex].subject.object === "radical";
    const hasNoReading = !updatedItems[itemIndex].subject.data.readings ||
      updatedItems[itemIndex].subject.data.readings.length === 0;

    const isItemComplete = updatedItems[itemIndex].meaningDone &&
      (updatedItems[itemIndex].readingDone || isRadical || hasNoReading);

    if (isItemComplete && !updatedItems[itemIndex].progressCounted) {
      setProgress((prev) => ({
        ...prev,
        current: prev.current + 1,
        completedItems: prev.completedItems + 1,
      }));
      updatedItems[itemIndex].progressCounted = true;
    }

    setReviewItems(updatedItems);
  };

  useEffect(() => {
    if (isFinished) {
      void clearSavedCustomReviewSession();
    }
  }, [clearSavedCustomReviewSession, isFinished]);

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    void clearSavedCustomReviewSession();
    router.dismissAll();
    router.replace("/");
  };

  // Render current question
  const renderCurrentQuestion = () => {
    if (!currentQuestion) return null;
    
    const item = reviewItems.find((item) => item.id === currentQuestion.itemId);
    if (!item) {
      moveToNextQuestion();
      return null;
    }

    return (
      <ReviewQuestionScreen
        item={{ id: item.id, subject: item.subject, srsStage: item.srsStage }}
        studyMaterials={studyMaterialsMap.get(item.subjectId)}
        onSynonymAdded={handleSynonymAdded}
        questionType={currentQuestion.type}
        onAnswer={handleAnswer}
        onAskAgain={handleAskAgain}
        onSkip={handleSkip}
        onExit={() => {
          Alert.alert(
            "Exit Review",
            "Want to continue this custom review later?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue Later",
                onPress: async () => {
                  const wasSaved = await saveCustomReviewSessionForLater();
                  if (!wasSaved) {
                    Alert.alert(
                      "Couldn't Save Progress",
                      "Please try again in a moment.",
                    );
                    return;
                  }
                  navigateToDashboard();
                },
              },
              {
                text: "Exit",
                style: "destructive",
                onPress: async () => {
                  await clearSavedCustomReviewSession();
                  navigateToDashboard();
                },
              },
            ]
          );
        }}
        showHeader={true}
        showBackgroundColor={true}
        totalItems={progress.totalItems}
        currentItem={progress.answeredCount}
        completedCount={progress.completedItems}
        correctAnswersCount={progress.correctAnswersCount}
        // No SRS progression for custom reviews
        srsProgression={undefined}
        onSRSCardDismiss={undefined}
        // Wrap up
        isWrapUpAvailable={isWrapUpAvailable && !isWrapUpMode}
        isWrapUpMode={isWrapUpMode}
        remainingSubjectsCount={getRemainingSubjectsCount()}
        onWrapUp={handleWrapUp}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading custom review...
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
            Unable to Load Review
          </Text>
          <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
            Connect to WiFi to start your custom review
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={loadCustomReview}
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      
      {!isFinished ? (
        <View style={styles.reviewContainer}>{renderCurrentQuestion()}</View>
      ) : (
        <ReviewResultsScreen
          reviewItems={reviewItems}
          progress={progress}
          submittingResults={false} // No submission for custom reviews
          onBackToDashboard={handleBackToDashboard}
        />
      )}
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
  reviewContainer: {
    flex: 1,
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
});
