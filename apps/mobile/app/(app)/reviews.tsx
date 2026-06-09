import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewResultsScreen from "../../src/components/ReviewResultsScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import useBluetoothAudioKeepAlive from "../../src/hooks/useBluetoothAudioKeepAlive";
import {
  getPendingProgressAssignmentIds,
  getPendingProgressCounts,
  queueProgressAndAttemptSend,
  syncPendingProgress,
} from "../../src/services/offlineStudyProgressService";
import { markReviewSubmittedInAssignmentCaches } from "../../src/services/studyProgressAssignmentCacheService";
import {
  ApiError,
  getAvailableReviews,
  getReviewCount,
  getSubjects,
  getStudyMaterials,
  isAssignmentInReviewQueueState,
  isRateLimitError,
  isUnauthorizedError,
  Subject,
} from "../../src/utils/api";
import { errorService } from "../../src/services/errorService";
import { getAllSubjects } from "../../src/utils/cache";
import {
  buildReviewQuestionQueue,
  DEFAULT_MAX_QUESTION_GAP,
  generateReviewQuestions,
  rebuildReviewQueueAfterSkip,
  sortReviewItemsForQueue,
  type ReviewQueueQuestion,
} from "../../src/utils/reviewOrdering";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type ReviewSubject = Subject & {
  object: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
};

// Define interface for review items
interface ReviewItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  subject: ReviewSubject;
  meaningDone: boolean;
  readingDone: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  submitted?: boolean; // Add this field to track submission status
  submissionFailed?: boolean; // Track if submission failed
  progressCounted?: boolean;
  meaningCorrectlyAnswered?: boolean;
  readingCorrectlyAnswered?: boolean;
  meaningIncorrectCounted?: boolean;
  readingIncorrectCounted?: boolean;
  srsStage?: number; // Add SRS stage for sorting
  availableAt?: string | null;
}

// Define interface for failed submission
interface FailedSubmission {
  assignmentId: number;
  subjectId?: number;
  meaningIncorrect: number;
  readingIncorrect: number;
  createdAt?: string | null;
  availableAt?: string | null;
  currentSrsStage?: number;
  retryCount: number;
  isPermissionError?: boolean; // Track if failure was due to missing permissions (401)
  statusCode?: number | null;
  failureReason?: string;
}

const REVIEW_PERMISSION_WARNING_TITLE = "Review Permission Required";
const REVIEW_PERMISSION_WARNING_MESSAGE =
  "Your API token does not have review write permission (reviews:create). Open WaniKani Personal Access Tokens, enable review write access, then log in again with the updated token.";

export default function ReviewScreen() {
  const isFocused = useIsFocused();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const { theme } = useTheme();
  const { dashboardData, refreshLessonsAndReviews, refreshRecentMistakes } =
    useDashboardData();
  // Use a ref so loadReviews can read the latest dashboard data without
  // having it as a dependency (which would re-trigger the load effect).
  const dashboardDataRef = useRef(dashboardData);
  dashboardDataRef.current = dashboardData;
  // Track whether any reviews were submitted so we can refresh on unmount
  const hasSubmittedReviewsRef = useRef(false);
  // Guard to ensure end-of-session submission check runs only once
  const hasCheckedFinalSubmissionsRef = useRef(false);
  // Track async review submissions still in-flight when session ends
  const pendingSubmissionCountRef = useRef(0);
  const hasShownReviewPermissionWarningRef = useRef(false);
  const skippedItemIdsRef = useRef<number[]>([]);
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    reviewOrder,
    reviewTypeOrderEnabled,
    reviewTypeOrder,
    prioritizeCriticalItems,
    acceptUserSynonymsAsAnswers,
    backToBackQuestions,
    reviewQuestionOrderEnabled,
    meaningFirst,
    srsProgressionCardDisplayMode,
    backToBackImmediateRetryIncorrect,
    reviewBatchSizeEnabled,
    reviewBatchSize,
    reviewWrapUpTargetSubjects,
    autoplayVocabularyAudio,
  } = useSettingsStore();
  const shouldShowSrsProgression = srsProgressionCardDisplayMode !== "hidden";
  const effectiveAnkiGrouping =
    ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both";
  const preferredQuestionType: "meaning" | "reading" = meaningFirst
    ? "meaning"
    : "reading";
  const [isLoading, setIsLoading] = useState(true);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]); // Master queue
  const [activeQueue, setActiveQueue] = useState<ReviewQueueQuestion[]>([]); // Active queue
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQueueQuestion | null>(null); // Currently displayed question
  const [masterQueue, setMasterQueue] = useState<ReviewQueueQuestion[]>([]); // Full queue of questions
  const [failedSubmissions, setFailedSubmissions] = useState<
    FailedSubmission[]
  >([]);
  const [progress, setProgress] = useState({
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
  });
  const [isFinished, setIsFinished] = useState(false);
  const [submittingResults, setSubmittingResults] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [reviewPermissionWarning, setReviewPermissionWarning] = useState<
    string | null
  >(null);
  const [srsProgression, setSrsProgression] = useState<{
    newLevel: string;
    newStage: number;
    isCorrect: boolean;
    show: boolean;
    nextReviewInterval: string;
  } | null>(null);
  
  // Wrap up mode state
  const [isWrapUpMode, setIsWrapUpMode] = useState(false);
  const WRAP_UP_TARGET_SUBJECTS = Math.min(
    20,
    Math.max(5, reviewWrapUpTargetSubjects)
  );
  const REVIEW_MAX_QUESTION_GAP = Math.min(
    WRAP_UP_TARGET_SUBJECTS,
    DEFAULT_MAX_QUESTION_GAP
  );

  // Study materials for user synonyms (keyed by subject ID)
  const [studyMaterialsMap, setStudyMaterialsMap] = useState<Map<number, { meaning_synonyms?: string[] }>>(new Map());

  const shouldKeepReviewAudioWarm =
    autoplayVocabularyAudio && !isLoading && !isFinished && isFocused;
  useBluetoothAudioKeepAlive(shouldKeepReviewAudioWarm, "Reviews");

  const refreshPendingReviewCount = useCallback(async () => {
    try {
      const counts = await getPendingProgressCounts();
      setPendingReviewCount(counts.review);
    } catch (error) {
      console.warn("[Reviews] Failed to load pending review queue count:", error);
    }
  }, []);

  // Handler for when a synonym is added from the review screen
  const handleSynonymAdded = useCallback((subjectId: number, newSynonyms: string[]) => {
    setStudyMaterialsMap(prev => {
      const updated = new Map(prev);
      updated.set(subjectId, { meaning_synonyms: newSynonyms });
      return updated;
    });
  }, []);

  // Active queue settings
  const ACTIVE_QUEUE_SIZE = 10; // Number of questions to keep in active queue
  const REFILL_THRESHOLD = 3; // Refill active queue when it has this many items left
  const MAX_SUBMISSION_RETRIES = 3; // Maximum number of times to retry submitting a review

  const resolveProgressCreatedAt = useCallback(
    (
      availableAt: string | null | undefined,
      fallbackCreatedAt?: string | null
    ): string | null => {
      const now = new Date();
      const baseDate =
        fallbackCreatedAt && !Number.isNaN(Date.parse(fallbackCreatedAt))
          ? new Date(fallbackCreatedAt)
          : now;
      const availableAtMs = availableAt ? Date.parse(availableAt) : NaN;

      // Match Tsurukame semantics: only include created_at when completion is
      // strictly after assignment.available_at.
      if (Number.isFinite(availableAtMs) && baseDate.getTime() <= availableAtMs) {
        return null;
      }

      return baseDate.toISOString();
    },
    []
  );
  
  // Helper function to get remaining subjects count
  const getRemainingSubjectsCount = useCallback(() => {
    const allRemainingQuestions = [...activeQueue, ...masterQueue];
    const uniqueSubjectIds = new Set(allRemainingQuestions.map(q => q.itemId));
    return uniqueSubjectIds.size;
  }, [activeQueue, masterQueue]);
  
  // Check if wrap up is available (more than target subjects remaining)
  const isWrapUpAvailable = getRemainingSubjectsCount() > WRAP_UP_TARGET_SUBJECTS;

  // Helper function to get SRS level name
  const getSRSLevelName = (stage: number): string => {
    switch (stage) {
      case 1:
        return "Apprentice I";
      case 2:
        return "Apprentice II";
      case 3:
        return "Apprentice III";
      case 4:
        return "Apprentice IV";
      case 5:
        return "Guru I";
      case 6:
        return "Guru II";
      case 7:
        return "Master";
      case 8:
        return "Enlightened";
      case 9:
        return "Burned";
      default:
        return "Apprentice I";
    }
  };

  // SRS stage intervals in hours (WaniKani's default intervals)
  const SRS_INTERVALS_HOURS: Record<number, number> = {
    1: 4,        // 4 hours
    2: 8,        // 8 hours
    3: 23,       // ~1 day
    4: 47,       // ~2 days
    5: 167,      // ~1 week
    6: 335,      // ~2 weeks
    7: 719,      // ~1 month
    8: 2879,     // ~4 months
    9: 0,        // Burned - no more reviews
  };

  // Format interval for display (fallback when API response unavailable)
  const formatSRSInterval = (stage: number): string => {
    if (stage >= 9) return "Burned!";
    const hours = SRS_INTERVALS_HOURS[stage] || 4;

    if (hours < 24) {
      return `${hours}h`;
    } else if (hours < 168) {
      const days = Math.round(hours / 24);
      return days === 1 ? "1 day" : `${days} days`;
    } else if (hours < 720) {
      const weeks = Math.round(hours / 168);
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    } else {
      const months = Math.round(hours / 720);
      return months === 1 ? "1 month" : `${months} months`;
    }
  };

  // Format next review time from API response's available_at timestamp
  const formatNextReviewTime = (availableAt: string | null, srsStage: number): string => {
    // If burned, no more reviews
    if (srsStage >= 9) return "Burned!";

    // If no available_at, fall back to interval-based display
    if (!availableAt) return formatSRSInterval(srsStage);

    const reviewDate = new Date(availableAt);
    const now = new Date();
    const diffMs = reviewDate.getTime() - now.getTime();

    // If in the past or very soon, it's available now
    if (diffMs <= 5 * 60 * 1000) return "Now";

    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const minutes = Math.ceil(diffMs / (1000 * 60));
      return `${minutes}m`;
    } else if (diffHours < 24) {
      const hours = Math.round(diffHours);
      return `${hours}h`;
    } else if (diffHours < 168) {
      const days = Math.round(diffHours / 24);
      return days === 1 ? "1 day" : `${days} days`;
    } else if (diffHours < 720) {
      const weeks = Math.round(diffHours / 168);
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    } else {
      const months = Math.round(diffHours / 720);
      return months === 1 ? "1 month" : `${months} months`;
    }
  };

  // Helper function to calculate SRS progression using WaniKani's algorithm
  const calculateSRSProgression = (
    currentStage: number,
    meaningIncorrect: number,
    readingIncorrect: number,
    isRadical: boolean,
    isVocabWithoutReading: boolean
  ): { newStage: number; isCorrect: boolean; nextReviewInterval: string } => {
    // Count incorrect adjustment count (number of question types with at least 1 wrong)
    // For radicals and kana vocab, only meaning matters
    const meaningWrong = meaningIncorrect > 0 ? 1 : 0;
    const readingWrong = (!isRadical && !isVocabWithoutReading && readingIncorrect > 0) ? 1 : 0;
    const incorrectAdjustmentCount = meaningWrong + readingWrong;

    if (incorrectAdjustmentCount === 0) {
      // All correct - level up by 1 (max 9)
      const newStage = Math.min(currentStage + 1, 9);
      return {
        newStage,
        isCorrect: true,
        nextReviewInterval: formatSRSInterval(newStage)
      };
    } else {
      // WaniKani's penalty formula:
      // new_srs_stage = current_srs_stage - (incorrect_adjustment_count / 2) - ceil(current_srs_stage / 2)
      // But we simplify: for most cases, any wrong answer drops the stage
      // The actual formula penalizes higher stages more severely
      const penalty = Math.floor(incorrectAdjustmentCount / 2) + Math.ceil(currentStage / 2);
      const newStage = Math.max(currentStage - penalty, 1);

      return {
        newStage,
        isCorrect: false,
        nextReviewInterval: formatSRSInterval(newStage)
      };
    }
  };

  // Load reviews when the component mounts
  // OPTIMIZATION: Uses smart caching to minimize API calls while ensuring fresh data
  // 1. Fetches hidden-filtered current review count (1 API call)
  // 2. If cache matches that count, uses cached data (0 additional calls)
  // 3. If cache is stale, fetches fresh assignments (but still uses cached subjects)
  const loadReviews = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      hasCheckedFinalSubmissionsRef.current = false;
      pendingSubmissionCountRef.current = 0;
      hasShownReviewPermissionWarningRef.current = false;
      skippedItemIdsRef.current = [];
      setFailedSubmissions([]);
      setSubmittingResults(false);
      setReviewPermissionWarning(null);

      // Step 1: Get current visible review count (hidden items excluded).
      // This avoids /summary phantom hidden reviews.
      console.log("[Reviews] Fetching visible review count...");
      const currentReviewCount = await getReviewCount(apiToken);
      const now = new Date();
      console.log(`[Reviews] Visible count shows ${currentReviewCount} reviews available`);

      if (currentReviewCount === 0) {
        Alert.alert(
          "No Reviews Available",
          "You don't have any reviews available right now.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Snapshot dashboard data from ref (avoids reactive dependency on dashboardData)
      const cachedDashboard = dashboardDataRef.current;

      // Use cached user level from dashboard (or from summary context)
      const userLevel = cachedDashboard.currentLevel || 1;

      // Step 2: Check if cached assignments match the visible review count
      // Filter cached assignments that should be available for review
      const cachedAvailableReviews = (cachedDashboard.assignments || []).filter(
        (assignment: any) => {
          const assignmentData = assignment?.data;
          if (!isAssignmentInReviewQueueState(assignmentData)) {
            return false;
          }

          const availableAtMs = Date.parse(assignmentData.available_at);
          if (Number.isNaN(availableAtMs)) {
            return false;
          }

          return availableAtMs <= now.getTime();
        }
      );

      const cachedReviewCount = cachedAvailableReviews.length;
      const cacheMatchesVisibleCount = cachedReviewCount === currentReviewCount;

      console.log(`[Reviews] Cache has ${cachedReviewCount} reviews, visible count has ${currentReviewCount} - ${cacheMatchesVisibleCount ? 'MATCH' : 'MISMATCH'}`);

      // Step 3: Determine which assignments to use
      let availableReviewAssignments: any[];

      if (cacheMatchesVisibleCount && cachedReviewCount > 0) {
        // Cache is fresh - use it (saves API calls)
        console.log("[Reviews] Using cached assignments (cache matches visible count)");
        availableReviewAssignments = cachedAvailableReviews;
      } else {
        // Cache is stale - fetch fresh assignments
        console.log("[Reviews] Cache stale, fetching fresh assignments...");
        const assignmentsResponse = await getAvailableReviews(apiToken);
        availableReviewAssignments = assignmentsResponse.data;
        console.log(`[Reviews] Fetched ${availableReviewAssignments.length} fresh assignments`);
      }

      // Defensive normalization: keep queue eligibility aligned with local
      // review-state logic even if API-side filters evolve.
      availableReviewAssignments = availableReviewAssignments.filter(
        (assignment: any) => {
          const assignmentData = assignment?.data;
          if (!isAssignmentInReviewQueueState(assignmentData)) {
            return false;
          }

          const availableAtMs = Date.parse(assignmentData.available_at);
          return Number.isFinite(availableAtMs) && availableAtMs <= now.getTime();
        }
      );
      const pendingProgressAssignmentIds =
        await getPendingProgressAssignmentIds().catch(() => ({
          lesson: new Set<number>(),
          review: new Set<number>(),
        }));
      availableReviewAssignments = availableReviewAssignments.filter(
        (assignment: any) =>
          !pendingProgressAssignmentIds.review.has(assignment.id)
      );

      if (availableReviewAssignments.length === 0) {
        Alert.alert(
          "No Reviews Available",
          "You don't have any reviews available right now.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Step 4: Use cached subjects (subjects rarely change, safe to cache)
      // Create a map of subjects from cached dashboard data for quick lookup
      let subjectsList: Subject[] = cachedDashboard.subjects || [];

      // If dashboard state has no subjects (race condition: cache was minified
      // and inflation/refresh hasn't completed yet), fall back to permanent storage
      if (subjectsList.length === 0) {
        console.log("[Reviews] Dashboard subjects empty, loading from permanent cache...");
        subjectsList = await getAllSubjects();
        console.log(`[Reviews] Loaded ${subjectsList.length} subjects from permanent cache`);
      }

      // If permanent cache is also empty (fresh install, cache cleared),
      // fetch the specific subjects we need from the API
      if (subjectsList.length === 0) {
        console.log("[Reviews] Permanent cache also empty, fetching subjects from API...");
        const neededIds = availableReviewAssignments.map(
          (a: any) => a.data.subject_id
        );
        const response = await getSubjects(apiToken, { ids: neededIds });
        subjectsList = response.data;
        console.log(`[Reviews] Fetched ${subjectsList.length} subjects from API`);
      }

      const subjectMap = new Map<number, Subject>(
        subjectsList.map((s: Subject) => [s.id, s])
      );

      // If assignments reference subject IDs that are missing locally (e.g. newly
      // added WaniKani content before the next full subject-cache refresh),
      // recover by fetching only those IDs.
      const missingSubjectIds = [
        ...new Set(
          availableReviewAssignments
            .map((assignment: any) => assignment?.data?.subject_id)
            .filter(
              (subjectId: unknown): subjectId is number =>
                typeof subjectId === "number" && !subjectMap.has(subjectId)
            )
        ),
      ];

      if (missingSubjectIds.length > 0) {
        console.warn(
          `[Reviews] ${missingSubjectIds.length} assignment subjects missing from local cache, fetching missing IDs from API...`
        );

        const SUBJECT_RECOVERY_BATCH_SIZE = 500;

        try {
          for (
            let startIndex = 0;
            startIndex < missingSubjectIds.length;
            startIndex += SUBJECT_RECOVERY_BATCH_SIZE
          ) {
            const subjectIdBatch = missingSubjectIds.slice(
              startIndex,
              startIndex + SUBJECT_RECOVERY_BATCH_SIZE
            );
            if (subjectIdBatch.length === 0) {
              continue;
            }

            const subjectsResponse = await getSubjects(apiToken, {
              ids: subjectIdBatch,
            });

            subjectsResponse.data.forEach((subject) => {
              subjectMap.set(subject.id, subject);
            });
          }

          const unresolvedSubjectIds = missingSubjectIds.filter(
            (subjectId) => !subjectMap.has(subjectId)
          );

          if (unresolvedSubjectIds.length > 0) {
            console.warn(
              `[Reviews] Failed to recover ${unresolvedSubjectIds.length} missing subjects after API fetch`
            );
          } else {
            console.log(
              `[Reviews] Recovered ${missingSubjectIds.length} missing subjects from API`
            );
          }
        } catch (missingSubjectFetchError) {
          console.warn(
            "[Reviews] Failed to fetch missing subjects from API, continuing with cached subset:",
            missingSubjectFetchError
          );
        }
      }

      // Extract subject IDs for study materials
      const subjectIds = availableReviewAssignments.map(
        (assignment: any) => assignment.data.subject_id
      );

      // Fetch study materials for user synonyms if setting is enabled
      if (acceptUserSynonymsAsAnswers) {
        try {
          const studyMaterialsResponse = await getStudyMaterials(apiToken, {
            subject_ids: subjectIds,
          });

          // Create a map of subject ID to study material data
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
          console.log(`[User Synonyms] Loaded study materials for ${materialsMap.size} subjects`);
        } catch (error) {
          console.warn("[User Synonyms] Failed to load study materials:", error);
          // Continue without study materials - feature will gracefully degrade
        }
      }

      // Create review items by combining assignment and subject data
      const items: ReviewItem[] = [];
      let missingSubjectCount = 0;

      availableReviewAssignments.forEach((assignment: any) => {
        const subject = subjectMap.get(assignment.data.subject_id);

        if (!subject) {
          // Subject not in cache - this shouldn't happen often
          missingSubjectCount++;
          console.warn(
            `[Reviews] Subject ${assignment.data.subject_id} not in cache for assignment ${assignment.id}`
          );
          return;
        }

        items.push({
          id: assignment.id,
          assignmentId: assignment.id,
          subjectId: assignment.data.subject_id,
          subject: subject as ReviewSubject,
          meaningDone: false,
          readingDone: false,
          meaningIncorrect: 0,
          readingIncorrect: 0,
          submitted: false,
          progressCounted: false,
          meaningCorrectlyAnswered: false,
          readingCorrectlyAnswered: false,
          meaningIncorrectCounted: false,
          readingIncorrectCounted: false,
          srsStage: assignment.data.srs_stage,
          availableAt: assignment.data.available_at,
        });
      });

      if (missingSubjectCount > 0) {
        console.warn(`[Reviews] ${missingSubjectCount} subjects were missing from cache`);
      }

      if (items.length === 0) {
        const prepError = new Error("Failed to prepare review items: all subjects missing from cache");
        errorService.logError(prepError, {
          extra: {
            context: "reviews_load",
            step: "prepare_items",
            missingSubjectCount,
            availableAssignments: availableReviewAssignments.length,
            cachedSubjectsCount: subjectMap.size,
            currentReviewCount,
            userLevel,
          },
        });
        Alert.alert("Error", "Failed to prepare review items.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      console.log(`[Reviews] Prepared ${items.length} review items (API calls: 1 visible-count${cacheMatchesVisibleCount ? '' : ' + 1 assignments'}${acceptUserSynonymsAsAnswers ? ' + 1 study materials' : ''})`);

      // Sort items using the selected review-order strategy.
      const sortedItems = sortReviewItemsForQueue(items, {
        reviewOrder,
        reviewTypeOrderEnabled,
        reviewTypeOrder,
        prioritizeCriticalItems,
        userLevel,
      });

      // Apply review batch size cap if enabled.
      const cappedItems = reviewBatchSizeEnabled
        ? sortedItems.slice(0, reviewBatchSize)
        : sortedItems;

      if (reviewBatchSizeEnabled && sortedItems.length > reviewBatchSize) {
        console.log(`[Reviews] Batch size cap applied: ${reviewBatchSize} of ${sortedItems.length} items`);
      }

      const allQuestions = generateReviewQuestions(cappedItems, {
        groupQuestions: effectiveAnkiGrouping,
      });

      // Determine the final question order based on settings.
      // Back-to-back mode keeps paired questions consecutive while preserving
      // the selected item ordering.
      const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
      const orderedQuestions = buildReviewQuestionQueue(cappedItems, {
        groupQuestions: effectiveAnkiGrouping,
        backToBack: useBackToBack,
        questionTypeOrderEnabled: reviewQuestionOrderEnabled,
        questionTypeOrder: preferredQuestionType,
        maxQuestionGap: REVIEW_MAX_QUESTION_GAP,
      });

      // Initialize the master queue
      setMasterQueue(orderedQuestions.slice(ACTIVE_QUEUE_SIZE));

      // Initialize the active queue with the first batch of questions
      const initialActiveQueue = orderedQuestions.slice(0, ACTIVE_QUEUE_SIZE);
      setActiveQueue(initialActiveQueue);

      // Set the current question to the first one
      if (initialActiveQueue.length > 0) {
        setCurrentQuestion(initialActiveQueue[0]);
      }

      setReviewItems(cappedItems);
      setProgress({
        current: 0,
        total: effectiveAnkiGrouping ? cappedItems.length : allQuestions.length / 2, // In grouped mode, 1 question per item, otherwise divide by 2 since each item has meaning+reading
        meaningCorrect: 0,
        readingCorrect: 0,
        totalItems: cappedItems.length,
        answeredCount: 0,
        completedItems: 0,
        meaningAttempts: 0,
        readingAttempts: 0,
        correctAnswersCount: 0,
      });
    } catch (error) {
      console.error("Error loading reviews:", error);

      // Log the error to Supabase with context
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const isRateLimit = isRateLimitError(error);
      errorService.logError(errorObj, {
        extra: {
          context: "reviews_load",
          step: "load_reviews_catch",
          isRateLimit,
          userLevel: dashboardDataRef.current.currentLevel || null,
          cachedAssignmentsCount: (dashboardDataRef.current.assignments || []).length,
          cachedSubjectsCount: (dashboardDataRef.current.subjects || []).length,
          errorName: errorObj.name,
          errorMessage: errorObj.message,
        },
      });

      if (isRateLimit) {
        Alert.alert(
          "Too Many Requests",
          "You've made too many requests to WaniKani. The rate limit resets every minute. Please wait a moment and try again.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        Alert.alert("Error", "Failed to load reviews. Please try again.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiToken, isAuthLoading, reviewOrder, reviewTypeOrderEnabled, reviewTypeOrder, prioritizeCriticalItems, acceptUserSynonymsAsAnswers, backToBackQuestions, reviewQuestionOrderEnabled, preferredQuestionType, effectiveAnkiGrouping, reviewBatchSizeEnabled, reviewBatchSize, REVIEW_MAX_QUESTION_GAP]);

  // Wrap up mode: reorder queue to complete exactly WRAP_UP_TARGET_SUBJECTS more subjects
  const handleWrapUp = useCallback(() => {
    if (isWrapUpMode) return; // Already in wrap up mode

    setIsWrapUpMode(true);
    
    // Build a list of all remaining questions, excluding the current one
    const remainingInActive = currentQuestion ? activeQueue.slice(1) : activeQueue.slice();
    const questionsAfterCurrent = [...remainingInActive, ...masterQueue];
    
    // Ordered unique subject ids as they appear in the queue
    const orderedSubjectIds: number[] = [];
    for (const q of questionsAfterCurrent) {
      if (!orderedSubjectIds.includes(q.itemId)) orderedSubjectIds.push(q.itemId);
    }
    
    // Helper to determine if a subject is in a partial state (one part done, other pending)
    const isSubjectPartial = (subjectId: number): boolean => {
      const reviewItem = reviewItems.find(item => item.id === subjectId);
      if (!reviewItem) return false;
      const isRadical = reviewItem.subject.object === 'radical';
      const isVocabWithoutReading = (reviewItem.subject.object === 'vocabulary' || reviewItem.subject.object === 'kana_vocabulary') && !reviewItem.subject.data.readings;
      if (isRadical || isVocabWithoutReading) return false; // single-part items cannot be partial
      return (reviewItem.meaningDone && !reviewItem.readingDone) || (!reviewItem.meaningDone && reviewItem.readingDone);
    };
    
    // Helper to determine if a subject has not been started
    const isSubjectNotStarted = (subjectId: number): boolean => {
      const reviewItem = reviewItems.find(item => item.id === subjectId);
      if (!reviewItem) return false;
      const isRadical = reviewItem.subject.object === 'radical';
      const isVocabWithoutReading = (reviewItem.subject.object === 'vocabulary' || reviewItem.subject.object === 'kana_vocabulary') && !reviewItem.subject.data.readings;
      if (isRadical || isVocabWithoutReading) {
        return !reviewItem.meaningDone;
      }
      return !reviewItem.meaningDone && !reviewItem.readingDone;
    };
    
    // Build the set of target subject ids (max WRAP_UP_TARGET_SUBJECTS)
    const targetSubjectIds: number[] = [];
    const pushTarget = (sid: number) => {
      if (!targetSubjectIds.includes(sid) && targetSubjectIds.length < WRAP_UP_TARGET_SUBJECTS) {
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

    // Filter remaining questions to only include those belonging to the target subjects
    const filteredRemainingQuestions = questionsAfterCurrent.filter(q => targetSubjectIds.includes(q.itemId));

    // Rebuild the queues: keep current question, then only filtered remaining
    const newActiveQueue = currentQuestion
      ? [currentQuestion, ...filteredRemainingQuestions.slice(0, ACTIVE_QUEUE_SIZE - 1)]
      : filteredRemainingQuestions.slice(0, ACTIVE_QUEUE_SIZE);
    const newMasterQueue = filteredRemainingQuestions.slice(currentQuestion ? (ACTIVE_QUEUE_SIZE - 1) : ACTIVE_QUEUE_SIZE);
    
    setActiveQueue(newActiveQueue);
    setMasterQueue(newMasterQueue);
  }, [isWrapUpMode, activeQueue, masterQueue, reviewItems, currentQuestion, WRAP_UP_TARGET_SUBJECTS]);


  // Move to the next question
  const moveToNextQuestion = () => {
    // Get a reference to the queue without the current question
    const updatedActiveQueue = activeQueue.slice(1);

    // Check if the queue needs refilling BEFORE updating the state
    if (
      updatedActiveQueue.length <= REFILL_THRESHOLD &&
      masterQueue.length > 0
    ) {
      // Calculate how many items to add
      const remaining = ACTIVE_QUEUE_SIZE - updatedActiveQueue.length;
      const itemsToAdd = Math.min(remaining, masterQueue.length);

      if (itemsToAdd > 0) {
        // Take the next batch of questions from the master queue
        const newItems = masterQueue.slice(0, itemsToAdd);
        const updatedMasterQueue = masterQueue.slice(itemsToAdd);

        // Create the new active queue with the added items
        const newActiveQueue = [...updatedActiveQueue, ...newItems];

        // Update the states
        setActiveQueue(newActiveQueue);
        setMasterQueue(updatedMasterQueue);

        // Set the new current question
        if (newActiveQueue.length > 0) {
          setCurrentQuestion(newActiveQueue[0]);
        } else {
          setIsFinished(true);
          checkForUnsubmittedItems();
        }

        return; // Exit early as we've already updated everything
      }
    }

    // If we didn't need to refill or couldn't refill, just update normally
    setActiveQueue(updatedActiveQueue);

    // Set new current question
    if (updatedActiveQueue.length > 0) {
      setCurrentQuestion(updatedActiveQueue[0]);
    } else if (masterQueue.length > 0) {
      // If active queue is empty but master queue has questions, refill and try again
      // Take items from master queue
      const itemsToAdd = Math.min(ACTIVE_QUEUE_SIZE, masterQueue.length);
      const newItems = masterQueue.slice(0, itemsToAdd);
      const updatedMasterQueue = masterQueue.slice(itemsToAdd);

      // Update states
      setActiveQueue(newItems);
      setMasterQueue(updatedMasterQueue);

      // Set current question
      if (newItems.length > 0) {
        setCurrentQuestion(newItems[0]);
      } else {
        setIsFinished(true);
        checkForUnsubmittedItems();
      }
    } else {
      // No more questions!
      setIsFinished(true);
      checkForUnsubmittedItems();
    }
  };

  // Refill the active queue if it's getting low
  const refillActiveQueueIfNeeded = (currentQueue: ReviewQueueQuestion[]) => {
    if (currentQueue.length <= REFILL_THRESHOLD && masterQueue.length > 0) {
      const remaining = ACTIVE_QUEUE_SIZE - currentQueue.length;
      const itemsToAdd = Math.min(remaining, masterQueue.length);

      if (itemsToAdd <= 0) return;

      // Take the next batch of questions from the master queue
      const newItems = masterQueue.slice(0, itemsToAdd);
      const updatedMasterQueue = masterQueue.slice(itemsToAdd);

      // Update the queues
      const newQueue = [...currentQueue, ...newItems];
      setActiveQueue(newQueue);
      setMasterQueue(updatedMasterQueue);

      // If we don't have a current question, set it to the first item in the new queue
      if (!currentQuestion && newQueue.length > 0) {
        setCurrentQuestion(newQueue[0]);
      }

      return newQueue; // Return the new queue for callers to use
    }

    return currentQueue; // Return the unchanged queue if no refill was needed
  };

  // Add a question back to the queue (used when answered incorrectly)
  const requeueQuestion = (question: ReviewQueueQuestion) => {
    // Remove current question from the active queue
    const queueWithoutCurrent = activeQueue.slice(1);
    const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
    const useLegacyImmediateBackToBackRetry =
      useBackToBack && backToBackImmediateRetryIncorrect;

    // Original requeue logic (random position)
    // Only insert at position 0 if there are no other positions available
    if (queueWithoutCurrent.length === 0) {
      // If no other positions, we have to put it at position 0
      const newActiveQueue = [question];
      setActiveQueue(newActiveQueue);
      setCurrentQuestion(question); // Set as current to force component reset
    } else {
      if (useLegacyImmediateBackToBackRetry) {
        const pairedType = question.type === "meaning" ? "reading" : "meaning";
        const pairedQuestionIndex = queueWithoutCurrent.findIndex(
          (q) => q.itemId === question.itemId && q.type === pairedType
        );

        let newActiveQueue: ReviewQueueQuestion[];

        if (pairedQuestionIndex !== -1) {
          // Keep legacy order: paired question first, then the failed one.
          const pairedQuestion = queueWithoutCurrent[pairedQuestionIndex];
          const queueWithoutPaired = [
            ...queueWithoutCurrent.slice(0, pairedQuestionIndex),
            ...queueWithoutCurrent.slice(pairedQuestionIndex + 1),
          ];
          newActiveQueue = [pairedQuestion, question, ...queueWithoutPaired];
        } else {
          // If there's no pair left, retry this failed question immediately.
          newActiveQueue = [question, ...queueWithoutCurrent];
        }

        setActiveQueue(newActiveQueue);
        setCurrentQuestion(newActiveQueue[0]);
        return;
      }

      let insertPosition = 1;

      if (useBackToBack) {
        // In back-to-back mode, only insert between subjects (not between
        // adjacent questions that belong to the same subject).
        const allowedInsertPositions: number[] = [];
        for (let position = 1; position <= queueWithoutCurrent.length; position += 1) {
          const leftQuestion = queueWithoutCurrent[position - 1];
          const rightQuestion = queueWithoutCurrent[position];
          const splitsSameSubjectPair =
            !!rightQuestion && leftQuestion.itemId === rightQuestion.itemId;

          if (!splitsSameSubjectPair) {
            allowedInsertPositions.push(position);
          }
        }

        if (allowedInsertPositions.length > 0) {
          insertPosition =
            allowedInsertPositions[
              Math.floor(Math.random() * allowedInsertPositions.length)
            ];
        } else {
          insertPosition = queueWithoutCurrent.length;
        }
      } else {
        // Position to insert the question (avoiding position 0)
        // Random position between 1 and length of queue (inclusive)
        const min = 1;
        const max = queueWithoutCurrent.length + 1;
        insertPosition = Math.floor(Math.random() * (max - min)) + min;
      }

      // Create a new queue with the question reinserted
      const newActiveQueue = [
        queueWithoutCurrent[0],
        ...queueWithoutCurrent.slice(1, insertPosition),
        question,
        ...queueWithoutCurrent.slice(insertPosition),
      ];

      // Update the active queue
      setActiveQueue(newActiveQueue);

      // Make sure we have the first question set as current
      setCurrentQuestion(newActiveQueue[0]);
    }
  };

  useEffect(() => {
    if (isAuthLoading || !apiToken) {
      setPendingReviewCount(0);
      return;
    }

    void syncPendingProgress(apiToken)
      .catch((error) => {
        console.warn("[Reviews] Failed to sync pending study progress:", error);
      })
      .finally(() => {
        void refreshPendingReviewCount();
      });
  }, [apiToken, isAuthLoading, refreshPendingReviewCount]);

  useEffect(() => {
    if (isAuthLoading || !apiToken) {
      setPendingReviewCount(0);
      return;
    }

    void refreshPendingReviewCount();
    const intervalId = setInterval(() => {
      void refreshPendingReviewCount();
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [apiToken, isAuthLoading, refreshPendingReviewCount]);

  useEffect(() => {
    loadReviews().then(() => {
      // Ensure the progress state includes correctAnswersCount
      setProgress((prev) => ({
        ...prev,
        correctAnswersCount: 0, // Initialize with 0
      }));
    });
  }, [loadReviews]);

  // Refresh dashboard counts when leaving the screen (e.g. swipe-back gesture)
  // This ensures the review/lesson counts are up-to-date even if the user
  // didn't finish reviews or use the explicit exit button.
  useEffect(() => {
    return () => {
      if (
        !hasSubmittedReviewsRef.current &&
        pendingSubmissionCountRef.current === 0
      ) {
        return;
      }

      void (async () => {
        const MAX_WAIT_MS = 5000;
        const POLL_INTERVAL_MS = 100;
        let waitedMs = 0;

        while (
          pendingSubmissionCountRef.current > 0 &&
          waitedMs < MAX_WAIT_MS
        ) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          waitedMs += POLL_INTERVAL_MS;
        }

        try {
          await Promise.all([
            refreshLessonsAndReviews(),
            refreshRecentMistakes(),
          ]);
        } catch (error) {
          console.error(
            "[Reviews] Failed to refresh lessons/reviews on flow exit:",
            error
          );
        }
      })();
    };
  }, [refreshLessonsAndReviews, refreshRecentMistakes]);

  // Define the shape of the API response for type safety
  interface ReviewSubmissionResponse {
    data: {
      starting_srs_stage: number;
      ending_srs_stage: number;
    };
    resources_updated: {
      assignment: {
        data: {
          srs_stage: number;
          available_at: string | null;
        };
      };
    };
  }

  interface SubmissionAttemptResult {
    response: ReviewSubmissionResponse | null;
    failure?: FailedSubmission;
  }

  const clearSubmissionFailure = useCallback((assignmentId: number) => {
    setFailedSubmissions((prev) =>
      prev.filter((fs) => fs.assignmentId !== assignmentId)
    );
    setReviewItems((prevItems) =>
      prevItems.map((ri) =>
        ri.assignmentId === assignmentId
          ? { ...ri, submissionFailed: false, submitted: true }
          : ri
      )
    );
  }, []);

  const upsertFailedSubmission = useCallback((submission: FailedSubmission) => {
    setFailedSubmissions((prev) => {
      const existingIndex = prev.findIndex(
        (fs) => fs.assignmentId === submission.assignmentId
      );

      if (existingIndex === -1) {
        return [...prev, submission];
      }

      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...submission };
      return next;
    });

    setReviewItems((prevItems) =>
      prevItems.map((ri) =>
        ri.assignmentId === submission.assignmentId
          ? { ...ri, submissionFailed: true }
          : ri
      )
    );
  }, []);

  const showReviewPermissionWarning = useCallback(() => {
    setReviewPermissionWarning(REVIEW_PERMISSION_WARNING_MESSAGE);

    if (hasShownReviewPermissionWarningRef.current) {
      return;
    }

    hasShownReviewPermissionWarningRef.current = true;
    Alert.alert(
      REVIEW_PERMISSION_WARNING_TITLE,
      REVIEW_PERMISSION_WARNING_MESSAGE
    );
  }, []);

  const waitForPendingSubmissions = useCallback(async () => {
    const MAX_WAIT_MS = 5000;
    const POLL_INTERVAL_MS = 100;
    let waitedMs = 0;

    while (
      pendingSubmissionCountRef.current > 0 &&
      waitedMs < MAX_WAIT_MS
    ) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      waitedMs += POLL_INTERVAL_MS;
    }

    if (pendingSubmissionCountRef.current > 0) {
      console.warn(
        `[Reviews] Proceeding with final submission check while ${pendingSubmissionCountRef.current} submission(s) are still pending`
      );
    }
  }, []);

  // Submit a review to WaniKani with retry handling
  const submitReviewWithRetry = async (
    apiToken: string,
    assignmentId: number,
    meaningIncorrect: number,
    readingIncorrect: number,
    options: {
      subjectId?: number;
      availableAt?: string | null;
      createdAt?: string | null;
      currentSrsStage?: number;
    } = {}
  ): Promise<SubmissionAttemptResult> => {
    try {
      const createdAt = resolveProgressCreatedAt(
        options.availableAt,
        options.createdAt
      );
      const queueResult = await queueProgressAndAttemptSend(apiToken, {
        assignmentId,
        subjectId: options.subjectId,
        progressType: "review",
        meaningIncorrectCount: meaningIncorrect,
        readingIncorrectCount: readingIncorrect,
        createdAt,
        availableAt: options.availableAt ?? null,
      });
      const response = queueResult.response as ReviewSubmissionResponse | null;

      if (response || queueResult.queued) {
        await markReviewSubmittedInAssignmentCaches({
          assignmentId,
          meaningIncorrectCount: meaningIncorrect,
          readingIncorrectCount: readingIncorrect,
          completedAt: createdAt ?? new Date().toISOString(),
          currentSrsStage: options.currentSrsStage,
          endingSrsStage: response?.data?.ending_srs_stage,
          nextReviewAt:
            response?.resources_updated?.assignment?.data?.available_at ??
            undefined,
        }).catch((cacheError) => {
          console.warn(
            "[Reviews] Failed to update local assignment review time:",
            cacheError
          );
        });
      }

      if (!response) {
        if (queueResult.queued) {
          hasSubmittedReviewsRef.current = true;
        }
        if (queueResult.failure?.isPermissionError) {
          showReviewPermissionWarning();
        }

        return {
          response: null,
          failure: {
            assignmentId,
            subjectId: options.subjectId,
            meaningIncorrect,
            readingIncorrect,
            createdAt,
            availableAt: options.availableAt ?? null,
            currentSrsStage: options.currentSrsStage,
            retryCount: 0,
            isPermissionError: queueResult.failure?.isPermissionError,
            statusCode: queueResult.failure?.statusCode ?? null,
            failureReason:
              queueResult.failure?.message ?? "Unknown review submission error",
          },
        };
      }

      // Mark that at least one review was submitted (for unmount refresh).
      hasSubmittedReviewsRef.current = true;
      return { response };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const statusCode = error instanceof ApiError ? error.statusCode : null;
      const apiErrorDetails = error instanceof ApiError ? error.details : null;
      const isPermissionError = isUnauthorizedError(error);
      const failureReason = errorObj.message || "Unknown review submission error";
      const isRateLimit = isRateLimitError(error);

      console.error(
        `[Reviews] Error submitting assignment ${assignmentId}:`,
        errorObj
      );

      errorService.logError(errorObj, {
        extra: {
          context: "reviews_submit",
          step: "submit_review_attempt",
          assignmentId,
          meaningIncorrect,
          readingIncorrect,
          statusCode,
          failureReason,
          apiErrorDetails,
          isPermissionError,
          isRateLimit,
          errorName: errorObj.name,
          errorMessage: errorObj.message,
        },
      });

      if (isPermissionError) {
        showReviewPermissionWarning();
      }

      return {
        response: null,
        failure: {
          assignmentId,
          subjectId: options.subjectId,
          meaningIncorrect,
          readingIncorrect,
          createdAt: options.createdAt ?? null,
          availableAt: options.availableAt ?? null,
          currentSrsStage: options.currentSrsStage,
          retryCount: 0,
          isPermissionError,
          statusCode,
          failureReason,
        },
      };
    } finally {
      void refreshPendingReviewCount();
    }
  };

  // Handle answer from ReviewQuestionScreen
  const handleAnswer = async (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading",
    isCorrect: boolean,
    _wasIncorrect: boolean,
    isGroupedAnswer: boolean = false
  ) => {
    // Find the review item
    const updatedItems = [...reviewItems];
    const itemIndex = updatedItems.findIndex((ri) => ri.id === item.id);

    if (itemIndex === -1) return;
    skippedItemIdsRef.current = skippedItemIdsRef.current.filter(
      (itemId) => itemId !== item.id
    );

    // For accuracy calculation: count every answer submission
    // For grouped answers (Anki mode with meaning+reading), only count once
    if (!isGroupedAnswer || questionType === "meaning") {
      setProgress((prev) => ({
        ...prev,
        answeredCount: prev.answeredCount + 1,
        // If correct, also increment correct count
        correctAnswersCount: isCorrect 
          ? (prev.correctAnswersCount ? prev.correctAnswersCount + 1 : 1)
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

    // If correct, mark this part as done
    if (isCorrect) {
      // Update item status based on question type
      if (questionType === "meaning") {
        updatedItems[itemIndex].meaningDone = true;

        // Only increment meaning correct count if this is the first time getting it right
        if (!updatedItems[itemIndex].meaningCorrectlyAnswered) {
          updatedItems[itemIndex].meaningCorrectlyAnswered = true;
          setProgress((prev) => ({
            ...prev,
            meaningCorrect: prev.meaningCorrect + 1,
          }));
        }
      } else {
        updatedItems[itemIndex].readingDone = true;

        // Only increment reading correct count if this is the first time getting it right
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
      // If incorrect, increment the incorrect count (but only once)
      if (
        questionType === "meaning" &&
        !updatedItems[itemIndex].meaningIncorrectCounted
      ) {
        updatedItems[itemIndex].meaningIncorrect += 1;
        updatedItems[itemIndex].meaningIncorrectCounted = true;
      } else if (
        questionType === "reading" &&
        !updatedItems[itemIndex].readingIncorrectCounted
      ) {
        updatedItems[itemIndex].readingIncorrect += 1;
        updatedItems[itemIndex].readingIncorrectCounted = true;
      }

      // Create a new question with the same type and item ID
      const newQuestion: ReviewQueueQuestion = {
        type: questionType,
        itemId: item.id,
      };

      // Add this question back to the queue and move to next question
      requeueQuestion(newQuestion);
    }

    // Check if this item is now completely done (meaning and reading if applicable)
    const isRadical = updatedItems[itemIndex].subject.object === "radical";
    // Check if it's vocabulary that only has meaning (no reading)
    const isVocabWithoutReading =
      (updatedItems[itemIndex].subject.object === "vocabulary" ||
        updatedItems[itemIndex].subject.object === "kana_vocabulary") &&
      !updatedItems[itemIndex].subject.data.readings;

    // Item is complete if:
    // - For radicals and vocab without reading: meaning is done
    // - For everything else: both meaning and reading are done
    const isItemComplete =
      updatedItems[itemIndex].meaningDone &&
      (updatedItems[itemIndex].readingDone ||
        isRadical ||
        isVocabWithoutReading);

    // If item is complete and hasn't been submitted, submit it to WaniKani
    if (isItemComplete && !updatedItems[itemIndex].submitted && apiToken) {
      // Mark as submitted optimistically - we'll handle retries separately
      updatedItems[itemIndex].submitted = true;

      // Store the current SRS stage for comparison
      const currentSRSStage = updatedItems[itemIndex].srsStage || 1;

      // Submit to WaniKani and show SRS card with actual response data
      pendingSubmissionCountRef.current += 1;
      const createdAt = resolveProgressCreatedAt(
        updatedItems[itemIndex].availableAt,
        new Date().toISOString()
      );
      submitReviewWithRetry(
        apiToken,
        updatedItems[itemIndex].assignmentId,
        updatedItems[itemIndex].meaningIncorrect,
        isRadical || isVocabWithoutReading
          ? 0
          : updatedItems[itemIndex].readingIncorrect,
        {
          subjectId: updatedItems[itemIndex].subjectId,
          availableAt: updatedItems[itemIndex].availableAt ?? null,
          createdAt,
          currentSrsStage: currentSRSStage,
        }
      )
        .then(({ response, failure }) => {
          if (response) {
            clearSubmissionFailure(updatedItems[itemIndex].assignmentId);

            // Use actual API response data for SRS progression display
            const startingStage = response.data.starting_srs_stage;
            const endingStage = response.data.ending_srs_stage;
            const availableAt = response.resources_updated.assignment.data.available_at;
            const isCorrect = endingStage > startingStage;

            // Format the next review time from the API response
            const nextReviewInterval = formatNextReviewTime(availableAt, endingStage);

            // Only show SRS progression if setting is enabled
            if (shouldShowSrsProgression) {
              setSrsProgression({
                newLevel: getSRSLevelName(endingStage),
                newStage: endingStage,
                isCorrect,
                show: true,
                nextReviewInterval,
              });
            }
          } else {
            if (failure) {
              upsertFailedSubmission(failure);
            }

            // Show fallback SRS card using calculated values (only if setting is enabled)
            if (shouldShowSrsProgression) {
              const progression = calculateSRSProgression(
                currentSRSStage,
                updatedItems[itemIndex].meaningIncorrect,
                updatedItems[itemIndex].readingIncorrect,
                isRadical,
                isVocabWithoutReading
              );

              setSrsProgression({
                newLevel: getSRSLevelName(progression.newStage),
                newStage: progression.newStage,
                isCorrect: progression.isCorrect,
                show: true,
                nextReviewInterval: progression.nextReviewInterval,
              });
            }
          }
        })
        .catch((error) => {
          console.error("Error in submission process:", error);
        })
        .finally(() => {
          pendingSubmissionCountRef.current = Math.max(
            0,
            pendingSubmissionCountRef.current - 1
          );
        });

      // Update progress - we'll do this optimistically regardless of submission success
      // For progress bar purposes, count an item as complete when both parts are done,
      // regardless of whether there were incorrect attempts
      setProgress((prev) => ({
        ...prev,
        completedItems: prev.completedItems + 1,
        current: prev.current + 1,
      }));
    } else if (isItemComplete && !updatedItems[itemIndex].progressCounted) {
      // Still update progress even if we can't submit
      // For progress bar purposes, count an item as complete when both parts are done,
      // regardless of whether there were incorrect attempts
      setProgress((prev) => ({
        ...prev,
        current: prev.current + 1,
        completedItems: prev.completedItems + 1,
      }));

      // Mark as counted in progress to avoid double-counting
      updatedItems[itemIndex].progressCounted = true;
    }

    setReviewItems(updatedItems);
  };

  // Function to dismiss SRS progression card
  const dismissSRSCard = () => {
    setSrsProgression(null);
  };

  // Handle Ask Again from paused-wrong state (legacy behavior).
  // This keeps the existing requeue logic and does not reset the item.
  const handleAskAgain = (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading"
  ) => {
    const newQuestion: ReviewQueueQuestion = {
      type: questionType,
      itemId: item.id,
    };

    requeueQuestion(newQuestion);
  };

  // Handle Skip (empty-submit setting): reset item and move it to the end.
  const handleSkip = (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading"
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

    // For skipped reviews:
    // 1) Remove active task
    // 2) Reset task state (both meaning/reading + wrong counters)
    // 3) Append to the end of the full review queue
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
              submitted: false,
              submissionFailed: false,
            }
          : existingItem
      )
    );

    const useBackToBack = backToBackQuestions && !effectiveAnkiGrouping;
    const remainingQuestions = [...activeQueue.slice(1), ...masterQueue];
    const { queue: reorderedQueue, skippedItemIds } =
      rebuildReviewQueueAfterSkip({
        items: reviewItems,
        remainingQuestions,
        skippedItemId: item.id,
        skippedItemIds: skippedItemIdsRef.current,
        skippedQuestionType: questionType,
        groupQuestions: effectiveAnkiGrouping,
        backToBack: useBackToBack,
        maxQuestionGap: REVIEW_MAX_QUESTION_GAP,
        questionTypeOrderEnabled: reviewQuestionOrderEnabled,
        questionTypeOrder: preferredQuestionType,
      });
    skippedItemIdsRef.current = skippedItemIds;
    const nextActiveQueue = reorderedQueue.slice(0, ACTIVE_QUEUE_SIZE);
    const nextMasterQueue = reorderedQueue.slice(ACTIVE_QUEUE_SIZE);

    setActiveQueue(nextActiveQueue);
    setMasterQueue(nextMasterQueue);

    if (nextActiveQueue.length > 0) {
      setCurrentQuestion(nextActiveQueue[0]);
      setIsFinished(false);
      return;
    }

    setCurrentQuestion(null);
    setIsFinished(true);
    checkForUnsubmittedItems();
  };

  // Retry all failed submissions
  const retryFailedSubmissions = async (
    submissions: FailedSubmission[]
  ): Promise<FailedSubmission[]> => {
    if (!apiToken || submissions.length === 0) return submissions;

    let remainingSubmissions: FailedSubmission[] = [];

    // Try each failed submission
    for (const submission of submissions) {
      // Skip if we've tried too many times
      if (submission.retryCount >= MAX_SUBMISSION_RETRIES) {
        remainingSubmissions.push(submission);
        continue;
      }

      try {
        const { response, failure } = await submitReviewWithRetry(
          apiToken,
          submission.assignmentId,
          submission.meaningIncorrect,
          submission.readingIncorrect,
          {
            subjectId: submission.subjectId,
            createdAt: submission.createdAt ?? null,
            availableAt: submission.availableAt ?? null,
            currentSrsStage: submission.currentSrsStage,
          }
        );

        if (response) {
          clearSubmissionFailure(submission.assignmentId);
        } else {
          remainingSubmissions.push({
            assignmentId: submission.assignmentId,
            subjectId: submission.subjectId,
            meaningIncorrect: submission.meaningIncorrect,
            readingIncorrect: submission.readingIncorrect,
            createdAt: submission.createdAt ?? null,
            availableAt: submission.availableAt ?? null,
            currentSrsStage: submission.currentSrsStage,
            retryCount: submission.retryCount + 1,
            isPermissionError: failure?.isPermissionError,
            statusCode: failure?.statusCode,
            failureReason: failure?.failureReason,
          });
          upsertFailedSubmission({
            assignmentId: submission.assignmentId,
            subjectId: submission.subjectId,
            meaningIncorrect: submission.meaningIncorrect,
            readingIncorrect: submission.readingIncorrect,
            createdAt: submission.createdAt ?? null,
            availableAt: submission.availableAt ?? null,
            currentSrsStage: submission.currentSrsStage,
            retryCount: submission.retryCount + 1,
            isPermissionError: failure?.isPermissionError,
            statusCode: failure?.statusCode,
            failureReason: failure?.failureReason,
          });
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error retrying submission for assignment ${submission.assignmentId}:`,
          error
        );
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const statusCode = error instanceof ApiError ? error.statusCode : null;
        const isPermissionError = isUnauthorizedError(error);
        const failureReason = errorObj.message || "Unknown retry failure";

        remainingSubmissions.push({
          assignmentId: submission.assignmentId,
          subjectId: submission.subjectId,
          meaningIncorrect: submission.meaningIncorrect,
          readingIncorrect: submission.readingIncorrect,
          createdAt: submission.createdAt ?? null,
          availableAt: submission.availableAt ?? null,
          currentSrsStage: submission.currentSrsStage,
          retryCount: submission.retryCount + 1,
          isPermissionError,
          statusCode,
          failureReason,
        });

        errorService.logError(errorObj, {
          extra: {
            context: "reviews_submit",
            step: "retry_failed_submission_exception",
            assignmentId: submission.assignmentId,
            retryCount: submission.retryCount + 1,
            statusCode,
            failureReason,
            isPermissionError,
            errorName: errorObj.name,
            errorMessage: errorObj.message,
          },
        });
      }
    }

    return remainingSubmissions;
  };

  // Add a helper function to check for unsubmitted items
  const checkForUnsubmittedItems = async () => {
    if (!apiToken || hasCheckedFinalSubmissionsRef.current) return;

    hasCheckedFinalSubmissionsRef.current = true;
    setSubmittingResults(true);

    try {
      await waitForPendingSubmissions();

      // First retry any failed submissions we know about
      let remainingFailures = await retryFailedSubmissions(failedSubmissions);

      // Look for any items that weren't submitted yet
      const unsubmittedItems = reviewItems.filter((item) => {
        const isRadical = item.subject.object === "radical";
        const isVocabWithoutReading =
          (item.subject.object === "vocabulary" ||
            item.subject.object === "kana_vocabulary") &&
          !item.subject.data.readings;

        const isComplete =
          item.meaningDone &&
          (item.readingDone || isRadical || isVocabWithoutReading);
        return isComplete && (!item.submitted || item.submissionFailed);
      });

      if (unsubmittedItems.length > 0) {
        // Try to submit any unsubmitted items
        for (const item of unsubmittedItems) {
          const isRadical = item.subject.object === "radical";
          const isVocabWithoutReading =
            (item.subject.object === "vocabulary" ||
              item.subject.object === "kana_vocabulary") &&
            !item.subject.data.readings;

          const readingIncorrect = isRadical || isVocabWithoutReading ? 0 : item.readingIncorrect;
          const { response, failure } = await submitReviewWithRetry(
            apiToken,
            item.assignmentId,
            item.meaningIncorrect,
            readingIncorrect,
            {
              subjectId: item.subjectId,
              availableAt: item.availableAt ?? null,
              createdAt: resolveProgressCreatedAt(
                item.availableAt ?? null,
                new Date().toISOString()
              ),
              currentSrsStage: item.srsStage,
            }
          );

          if (response) {
            clearSubmissionFailure(item.assignmentId);
            remainingFailures = remainingFailures.filter(
              (fs) => fs.assignmentId !== item.assignmentId
            );
          } else {
            const existingRetryCount =
              remainingFailures.find((fs) => fs.assignmentId === item.assignmentId)
                ?.retryCount ?? 0;
            const failedSubmission: FailedSubmission = {
              assignmentId: item.assignmentId,
              subjectId: item.subjectId,
              meaningIncorrect: item.meaningIncorrect,
              readingIncorrect,
              createdAt: resolveProgressCreatedAt(
                item.availableAt ?? null,
                new Date().toISOString()
              ),
              availableAt: item.availableAt ?? null,
              currentSrsStage: item.srsStage,
              retryCount: existingRetryCount + 1,
              isPermissionError: failure?.isPermissionError,
              statusCode: failure?.statusCode,
              failureReason: failure?.failureReason,
            };

            remainingFailures = [
              ...remainingFailures.filter(
                (fs) => fs.assignmentId !== item.assignmentId
              ),
              failedSubmission,
            ];
            upsertFailedSubmission(failedSubmission);
          }

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Try one more time for any that failed
        if (remainingFailures.length > 0) {
          remainingFailures = await retryFailedSubmissions(remainingFailures);
        }
      }

      const pendingSyncResult = await syncPendingProgress(apiToken);
      if (pendingSyncResult.sent > 0) {
        hasSubmittedReviewsRef.current = true;
      }
      void refreshPendingReviewCount();

      const pendingProgressAssignmentIds =
        await getPendingProgressAssignmentIds().catch(() => ({
          lesson: new Set<number>(),
          review: new Set<number>(),
        }));
      remainingFailures = remainingFailures.filter((submission) =>
        pendingProgressAssignmentIds.review.has(submission.assignmentId)
      );

      setFailedSubmissions(remainingFailures);

      // If we still have failed submissions after retries, only log details
      if (remainingFailures.length > 0) {
        console.warn(
          `${remainingFailures.length} submissions still failed after retries`
        );
        const unresolvedError = new Error(
          `${remainingFailures.length} review submission(s) unresolved after retries`
        );
        errorService.logError(unresolvedError, {
          extra: {
            context: "reviews_submit",
            step: "finalize_remaining_failures",
            unresolvedCount: remainingFailures.length,
            failures: remainingFailures.map((submission) => ({
              assignmentId: submission.assignmentId,
              retryCount: submission.retryCount,
              isPermissionError: submission.isPermissionError ?? false,
              statusCode: submission.statusCode ?? null,
              failureReason: submission.failureReason ?? "Unknown failure",
            })),
          },
        });
      }
    } catch (error) {
      console.error("Error submitting remaining reviews:", error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const statusCode = error instanceof ApiError ? error.statusCode : null;
      const isPermissionError = isUnauthorizedError(error);

      errorService.logError(errorObj, {
        extra: {
          context: "reviews_submit",
          step: "check_unsubmitted_items_catch",
          statusCode,
          isPermissionError,
          errorName: errorObj.name,
          errorMessage: errorObj.message,
        },
      });
    } finally {
      setSubmittingResults(false);
    }
  };

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    void refreshRecentMistakes();
    router.dismissAll();
    router.replace({
      pathname: "/",
      params: { refreshLessonsReviews: "true" },
    });
  };

  // Render the current question
  const renderCurrentQuestion = () => {
    // If no current question and queue is empty, check if we're finished
    if (!currentQuestion) {
      // Try to refill the queue if it's empty
      if (activeQueue.length === 0) {
        refillActiveQueueIfNeeded([]);
      }

      // If there's still no active questions, we're finished
      if (activeQueue.length === 0 && masterQueue.length === 0) {
        setIsFinished(true);
        return null;
      }

      // If we have questions in the active queue but no current question, set it
      if (activeQueue.length > 0 && !currentQuestion) {
        setCurrentQuestion(activeQueue[0]);
      }

      // If we still don't have a current question, show loading
      if (!currentQuestion) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading next question...</Text>
          </View>
        );
      }
    }

    // Find the review item for the current question
    const item = reviewItems.find((item) => item.id === currentQuestion.itemId);
    if (!item) {
      console.error(
        "Could not find item for current question:",
        currentQuestion
      );
      moveToNextQuestion(); // Skip this item and move to the next
      return null;
    }

    return (
      <ReviewQuestionScreen
        item={{ id: item.id, subject: item.subject as any, srsStage: item.srsStage }}
        questionType={currentQuestion.type}
        onAnswer={handleAnswer}
        onAskAgain={handleAskAgain}
        onSkip={handleSkip}
        reviewPermissionWarning={reviewPermissionWarning}
        onDismissReviewPermissionWarning={() => setReviewPermissionWarning(null)}
        studyMaterials={studyMaterialsMap.get(item.subjectId)}
        onSynonymAdded={handleSynonymAdded}
        onExit={() => {
          const exitReviews = () => {
            void refreshRecentMistakes();
            router.dismissAll();
            router.replace({
              pathname: "/",
              params: { refreshLessonsReviews: "true" },
            });
          };

          if (progress.answeredCount === 0) {
            exitReviews();
            return;
          }

          Alert.alert(
            "Exit Reviews",
            "Are you sure you want to exit? Your progress will not be saved.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Exit",
                onPress: exitReviews,
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
        srsProgression={srsProgression || undefined}
        onSRSCardDismiss={dismissSRSCard}
        // Wrap up functionality
        isWrapUpAvailable={isWrapUpAvailable && !isWrapUpMode}
        isWrapUpMode={isWrapUpMode}
        wrapUpTargetSubjects={WRAP_UP_TARGET_SUBJECTS}
        remainingSubjectsCount={getRemainingSubjectsCount()}
        onWrapUp={handleWrapUp}
        acceptCharactersAsCorrectForReading={true}
      />
    );
  };

  const renderPendingReviewSyncBadge = () => {
    if (pendingReviewCount <= 0 || isLoading || isFinished) {
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
          <View style={styles.pendingSyncBadgeContent}>
            <MaterialCommunityIcons
              name="wifi-off"
              size={11}
              color={theme.textSecondary}
            />
            <Text style={[styles.pendingSyncBadgeText, { color: theme.textColor }]}>
              {pendingReviewCount} review{pendingReviewCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading reviews...</Text>
        </View>
        {renderPendingReviewSyncBadge()}
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
          reviewItems={reviewItems as any}
          progress={progress}
          submittingResults={submittingResults}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
      {renderPendingReviewSyncBadge()}
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
  reviewContainer: {
    flex: 1,
  },
  pendingSyncBadgeContainer: {
    position: "absolute",
    top: 140,
    alignSelf: "center",
    zIndex: 50,
  },
  pendingSyncBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    minWidth: 82,
  },
  pendingSyncBadgeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pendingSyncBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  progressContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  progressText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
