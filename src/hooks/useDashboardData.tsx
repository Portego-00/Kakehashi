import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, InteractionManager } from "react-native";
import { SRS_COLORS } from "../constants/srsColors";
import {
  BurnedItem,
  CriticalItem,
  DayForecast,
  LevelItem,
  RecentMistake,
  SrsLevel,
  SubjectTypeBreakdown,
  UnlockItem,
  WaniKaniItemType,
} from "../types/wanikani";
import {
  buildVisibleReviewDataFromAssignments,
  clearInMemoryCache,
  getAssignmentsOptimized,
  getLevelProgressions,
  getResets,
  getRecentLessonAssignments,
  getRecentReviewStatistics,
  getReviewCount,
  getReviewForecast,
  getReviewStatisticsOptimized,
  getSubjects,
  getSummary,
  getUserData,
  isAssignmentInLessonQueueState,
  isAssignmentInReviewQueueState,
  type Assignment,
  type CollectionResponse,
  type VisibleReviewData,
} from "../utils/api";
import { getPendingProgressAssignmentIds } from "../services/offlineStudyProgressService";
import { apiDebugger } from "../utils/apiDebugger";
import { getSubjectById, prefetchSubjectsByLevel } from "../utils/cache";
import { getDashboardCache, saveDashboardCache } from "../utils/dashboardCache";
import {
  calculateLevelTimeRemaining,
  formatTimeInterval,
} from "../utils/levelProgress";
import {
  getFullDashboardDataFromPermanentStorage,
  saveAssignmentsToPermanentStorage,
} from "../utils/permanentStorage";
import { updateBadgeWithReviewCount } from "../utils/badgeNotifications";
import { updateLastReviewCount } from "../utils/reviewNotifications";
import { shouldUseNativeReviewNotificationSystem } from "../utils/reviewNotificationIntegration";
import { startupDiagnostics } from "../utils/startupDiagnostics";
import { useAuthStore } from "../utils/store";

// Define loading stages for progress tracking
enum LoadingStage {
  IDLE = 0,
  SUMMARY = 1,
  USER_DATA = 2,
  ASSIGNMENTS = 3,
  SUBJECTS = 4,
  FORECAST = 5,
  STATS = 6,
  LEVEL_DATA = 7,
  LESSONS = 8,
  COMPLETE = 9,
}

const TOTAL_LOADING_STAGES = 9; // Number of stages excluding IDLE

type DashboardDataType = {
  lessonCount: number;
  reviewCount: number;
  forecast: DayForecast[];
  levelItems: LevelItem[];
  srsLevels: SrsLevel[];
  recentUnlocks: UnlockItem[];
  burnedItems: BurnedItem[];
  criticalItems: CriticalItem[];
  recentMistakes: RecentMistake[];
  levelProgressions: any[];
  resets: any[];
  reviewStatistics: any[];
  currentLevel: number;
  completedCount: number;
  totalCount: number;
  srsStagesCompleted: number;
  srsStagesTotal: number;
  nextLessonDate: string | null;
  nextReviewDate: string | null;
  pendingLessonSyncCount: number;
  pendingReviewSyncCount: number;
  recentLessonCount: number;
  learnedKanjiCount: number;
  levelTimeRemaining: {
    timeText: string;
    isEstimate: boolean;
  };
  subjects: any[];
  assignments: any[];
  dataLoadingState: {
    summary: boolean;
    userData: boolean;
    assignments: boolean;
    subjects: boolean;
    forecast: boolean;
    stats: boolean;
    levelData: boolean;
    lessons: boolean;
  };
};

const initialDashboardData: DashboardDataType = {
  lessonCount: 0,
  reviewCount: 0,
  forecast: [],
  levelItems: [],
  srsLevels: [],
  recentUnlocks: [],
  burnedItems: [],
  criticalItems: [],
  recentMistakes: [],
  levelProgressions: [],
  resets: [],
  reviewStatistics: [],
  currentLevel: 1,
  completedCount: 0,
  totalCount: 0,
  srsStagesCompleted: 0,
  srsStagesTotal: 0,
  nextLessonDate: null,
  nextReviewDate: null,
  pendingLessonSyncCount: 0,
  pendingReviewSyncCount: 0,
  recentLessonCount: 0,
  learnedKanjiCount: 0,
  levelTimeRemaining: {
    timeText: "Unknown",
    isEstimate: true,
  },
  subjects: [],
  assignments: [],
  dataLoadingState: {
    summary: false,
    userData: false,
    assignments: false,
    subjects: false,
    forecast: false,
    stats: false,
    levelData: false,
    lessons: false,
  },
};

interface DashboardContextType {
  dashboardData: DashboardDataType;
  isLoading: boolean;
  loadingProgress: number;
  refreshData: () => Promise<void>;
  refreshLessonsAndReviews: () => Promise<void>;
  refreshRecentMistakes: () => Promise<void>;
  errorStatus: string | null;
  isFreshData: boolean;
}

type LessonAndReviewCounts = {
  lessonCount: number;
  reviewCount: number;
  nextLessonDate: string | null;
  nextReviewDate: string | null;
};

type PendingProgressAssignmentIds = {
  lesson: Set<number>;
  review: Set<number>;
};

const EMPTY_PENDING_PROGRESS_ASSIGNMENT_IDS: PendingProgressAssignmentIds = {
  lesson: new Set<number>(),
  review: new Set<number>(),
};

function getLessonAndReviewCountsFromAssignments(
  assignmentsData: any[],
  pendingProgressAssignmentIds: PendingProgressAssignmentIds = EMPTY_PENDING_PROGRESS_ASSIGNMENT_IDS
): LessonAndReviewCounts {
  const now = new Date();
  const assignmentsExcludingPendingReviews =
    pendingProgressAssignmentIds.review.size > 0
      ? assignmentsData.filter(
          (assignment) => !pendingProgressAssignmentIds.review.has(assignment.id)
        )
      : assignmentsData;
  const visibleReviewData = buildVisibleReviewDataFromAssignments(
    assignmentsExcludingPendingReviews,
    { now }
  );
  const lessonAssignments = assignmentsData.filter((assignment) => {
    if (pendingProgressAssignmentIds.lesson.has(assignment.id)) {
      return false;
    }
    return isAssignmentInLessonQueueState(assignment?.data);
  });

  const lessonCount = lessonAssignments.length;
  const reviewCount = visibleReviewData.currentReviews;

  let nextLessonDate: string | null = null;
  let nextReviewDate: string | null = null;

  if (reviewCount === 0) {
    const upcomingReviews = assignmentsData
      .filter((assignment) => {
        if (!isAssignmentInReviewQueueState(assignment?.data)) {
          return false;
        }
        if (pendingProgressAssignmentIds.review.has(assignment.id)) {
          return false;
        }
        return new Date(assignment.data.available_at).getTime() > now.getTime();
      })
      .sort(
        (leftAssignment, rightAssignment) =>
          new Date(leftAssignment.data.available_at).getTime() -
          new Date(rightAssignment.data.available_at).getTime()
      );

    if (upcomingReviews.length > 0) {
      nextReviewDate = upcomingReviews[0].data.available_at;
    }
  }

  return { lessonCount, reviewCount, nextLessonDate, nextReviewDate };
}

const DashboardContext = createContext<DashboardContextType>({
  dashboardData: initialDashboardData,
  isLoading: false,
  loadingProgress: 0,
  refreshData: async () => {},
  refreshLessonsAndReviews: async () => {},
  refreshRecentMistakes: async () => {},
  errorStatus: null,
  isFreshData: false,
});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { apiToken, setUserData, setLearnedKanjiCount, lastWrappedLevel, setLastWrappedLevel } =
    useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(
    LoadingStage.IDLE
  );
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [dashboardData, setDashboardData] =
    useState<DashboardDataType>(initialDashboardData);
  const dashboardDataRef = useRef(dashboardData);
  dashboardDataRef.current = dashboardData;
  const [isFreshData, setIsFreshData] = useState(false);
  const startupDashboardFetchTrackedRef = useRef(false);
  const dashboardForegroundFetchInFlightRef = useRef(false);
  const dashboardBackgroundRefreshInFlightRef = useRef(false);
  const lessonsReviewsRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const recentMistakesRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSyncCountsRefreshInFlightRef = useRef(false);
  const pendingSyncLastTotalRef = useRef(0);
  const pendingSyncTriggeredRefreshInFlightRef = useRef(false);

  // Calculate loading progress based on current stage
  const loadingProgress = loadingStage / TOTAL_LOADING_STAGES;

  const loadPendingProgressAssignmentIds = useCallback(
    async (): Promise<PendingProgressAssignmentIds> => {
      try {
        return await getPendingProgressAssignmentIds();
      } catch (error) {
        console.warn(
          "[Dashboard] Failed to load pending progress assignment IDs:",
          error
        );
        return {
          lesson: new Set<number>(),
          review: new Set<number>(),
        };
      }
    },
    []
  );

  const getLessonAndReviewCountsFromSummary = (summary: any) => {
    const nowMs = Date.now();

    const countAvailableSubjects = (entries: any): number => {
      if (!Array.isArray(entries)) {
        return 0;
      }

      return entries.reduce((total: number, entry: any) => {
        const availableAt = entry?.available_at;
        const subjectIds = entry?.subject_ids;

        if (!availableAt || !Array.isArray(subjectIds) || subjectIds.length === 0) {
          return total;
        }

        const availableAtMs = Date.parse(availableAt);
        if (Number.isNaN(availableAtMs) || availableAtMs > nowMs) {
          return total;
        }

        return total + subjectIds.length;
      }, 0);
    };

    return {
      lessonCount: countAvailableSubjects(summary?.data?.lessons),
      reviewCount: countAvailableSubjects(summary?.data?.reviews),
      nextReviewDate: summary?.data?.next_reviews_at ?? null,
    };
  };

  const reconcileReviewCountWithVisibleEndpoint = useCallback(
    async (
      token: string,
      assignments: CollectionResponse<Assignment>,
      counts: LessonAndReviewCounts
    ): Promise<{
      assignments: CollectionResponse<Assignment>;
      counts: LessonAndReviewCounts;
    }> => {
      try {
        const visibleReviewCount = await getReviewCount(token);

        if (visibleReviewCount === counts.reviewCount) {
          return { assignments, counts };
        }

        console.warn(
          `[Dashboard] Review count mismatch (assignments=${counts.reviewCount}, visible=${visibleReviewCount}). Running full assignments refresh...`
        );

        const fullAssignments = await getAssignmentsOptimized(
          token,
          {},
          { forceFullRefresh: true }
        );
        const refreshedCounts = getLessonAndReviewCountsFromAssignments(
          fullAssignments.data
        );

        if (refreshedCounts.reviewCount === visibleReviewCount) {
          return {
            assignments: fullAssignments,
            counts: refreshedCounts,
          };
        }

        console.warn(
          `[Dashboard] Review count mismatch persisted after full refresh (full=${refreshedCounts.reviewCount}, visible=${visibleReviewCount}). Using visible count for UI consistency.`
        );

        return {
          assignments: fullAssignments,
          counts: {
            ...refreshedCounts,
            reviewCount: visibleReviewCount,
          },
        };
      } catch (error) {
        console.warn(
          "[Dashboard] Failed to reconcile review count with visible endpoint:",
          error
        );
        return { assignments, counts };
      }
    },
    []
  );

  // Process assignments to get counts for lessons and reviews
  const processAssignments = useCallback(
    async (
      token: string,
      forceFullRefresh = false,
      preloadedAssignments: CollectionResponse<Assignment> | null = null,
      preloadedSummary: any | null = null
    ) => {
      try {
        // Reset loading states
        setDashboardData((prev) => ({
          ...prev,
          dataLoadingState: {
            summary: false,
            userData: false,
            assignments: false,
            subjects: false,
            forecast: false,
            stats: false,
            levelData: false,
            lessons: false,
          },
        }));

        setLoadingStage(LoadingStage.SUMMARY);
        const summary =
          preloadedSummary ??
          (await getSummary(token, {
            forceRefresh: forceFullRefresh,
          }));
        const summaryCounts = getLessonAndReviewCountsFromSummary(summary);

        // Update dashboard with summary data immediately
        setDashboardData((prev) => ({
          ...prev,
          lessonCount: summaryCounts.lessonCount,
          // Keep the previous value here; summary cannot filter hidden reviews.
          reviewCount: prev.reviewCount,
          nextReviewDate: summaryCounts.nextReviewDate,
          dataLoadingState: { ...prev.dataLoadingState, summary: true },
        }));

        setLoadingStage(LoadingStage.USER_DATA);
        const previousMaxLevelGranted =
          useAuthStore.getState().userData?.subscription?.max_level_granted ??
          null;
        const userData = await getUserData(token, {
          // Always refresh user data to keep vacation mode status current.
          forceRefresh: true,
        });
        apiDebugger.setDebugAccessByUsername(userData.data.username);
        const latestMaxLevelGranted =
          userData.data.subscription?.max_level_granted ?? null;
        const didSubscriptionAccessExpand =
          typeof previousMaxLevelGranted === "number" &&
          typeof latestMaxLevelGranted === "number" &&
          latestMaxLevelGranted > previousMaxLevelGranted;
        setUserData(userData.data);

        // Update with user data
        setDashboardData((prev) => ({
          ...prev,
          currentLevel: userData.data.level,
          dataLoadingState: { ...prev.dataLoadingState, userData: true },
        }));

        setLoadingStage(LoadingStage.ASSIGNMENTS);

        // Use optimized assignments fetching with updated_after filter
        const shouldForceAssignmentsFullRefresh =
          forceFullRefresh || didSubscriptionAccessExpand;
        let assignments =
          preloadedAssignments ??
          (await getAssignmentsOptimized(token, {}, {
            forceFullRefresh: shouldForceAssignmentsFullRefresh,
          }));
        const pendingProgressAssignmentIds =
          await loadPendingProgressAssignmentIds();

        // Process server-aligned counts first for reconciliation logic.
        let serverCounts = getLessonAndReviewCountsFromAssignments(assignments.data);
        const shouldReconcileLessonCountMismatch =
          !shouldForceAssignmentsFullRefresh &&
          summaryCounts.lessonCount > serverCounts.lessonCount;

        if (shouldReconcileLessonCountMismatch) {
          try {
            const fullAssignments = await getAssignmentsOptimized(
              token,
              {},
              { forceFullRefresh: true }
            );
            assignments = fullAssignments;
            serverCounts = getLessonAndReviewCountsFromAssignments(
              fullAssignments.data
            );
          } catch (fullRefreshError) {
            console.warn(
              "[Dashboard] Failed full assignments refresh after lesson count mismatch:",
              fullRefreshError
            );
          }
        }

        ({ assignments, counts: serverCounts } =
          await reconcileReviewCountWithVisibleEndpoint(
            token,
            assignments,
            serverCounts
          ));
        const counts = getLessonAndReviewCountsFromAssignments(
          assignments.data,
          pendingProgressAssignmentIds
        );

        // Save assignments to permanent storage (survives iOS cache clearing)
        try {
          await saveAssignmentsToPermanentStorage(
            assignments.data,
            assignments.data_updated_at
          );
        } catch (assignmentCacheError) {
          console.warn(
            "⚠️ Failed to save assignments to permanent storage:",
            assignmentCacheError
          );
        }

        // Update with more accurate assignment-based counts
        const latestPendingProgressAssignmentIdsForCounts =
          await loadPendingProgressAssignmentIds();
        setDashboardData((prev) => ({
          ...prev,
          lessonCount: counts.lessonCount,
          reviewCount: counts.reviewCount,
          nextLessonDate: counts.nextLessonDate,
          nextReviewDate: counts.nextReviewDate,
          pendingLessonSyncCount:
            latestPendingProgressAssignmentIdsForCounts.lesson.size,
          pendingReviewSyncCount:
            latestPendingProgressAssignmentIdsForCounts.review.size,
          dataLoadingState: { ...prev.dataLoadingState, assignments: true },
        }));

        // Get all subject ids from assignments
        const allSubjectIds = [
          ...new Set(
            assignments.data.map((assignment) => assignment.data.subject_id)
          ),
        ]; // Remove duplicates

        setLoadingStage(LoadingStage.SUBJECTS);

        // OPTIMIZATION: Use smart batching to avoid URL length limits
        // Estimate URL length to prevent 400 errors from overly long URLs
        let allSubjects: any[] = [];

        // Calculate optimal batch size based on URL length constraints
        // Base URL: ~50 chars, each ID: ~5 chars + comma, safe limit: ~8000 chars
        const baseUrlLength = 50;
        const avgIdLength = 6; // ID + comma
        const maxUrlLength = 8000; // Conservative limit to avoid 400 errors
        const maxIdsPerBatch = Math.floor(
          (maxUrlLength - baseUrlLength) / avgIdLength
        );
        const optimalBatchSize = Math.min(maxIdsPerBatch, 500); // Cap at 500 for performance

        for (let i = 0; i < allSubjectIds.length; i += optimalBatchSize) {
          const batchIds = allSubjectIds.slice(i, i + optimalBatchSize);
          if (batchIds.length === 0) continue;

          try {
            // Fetch subjects from local cache instead of API (MUCH faster!)
            const subjectsBatch = await Promise.all(
              batchIds.map((id) => getSubjectById(id))
            );

            // Filter out nulls (subjects not found in cache)
            const validSubjects = subjectsBatch.filter((s) => s !== null);
            allSubjects = allSubjects.concat(validSubjects);
          } catch (batchError) {
            console.warn(
              `Error fetching subjects batch ${
                Math.floor(i / optimalBatchSize) + 1
              }: ${batchError}`
            );
          }
        }

        // Process subjects into a lookup map
        const subjectsById = allSubjects.reduce((acc, subject) => {
          acc[subject.id] = subject;
          return acc;
        }, {} as Record<number, any>);

        // Get learned kanji count
        const learnedKanjiCount = allSubjects.filter((s) => {
          const assignment = assignments.data.find(
            (a) => a.data.subject_id === s.id
          );
          return (
            s.data.characters &&
            assignment &&
            assignment.data.srs_stage >= 5 &&
            s.object === "kanji"
          );
        }).length;

        // Store learned kanji count for SWR pattern in header
        setLearnedKanjiCount(learnedKanjiCount);

        // OPTIMIZATION: Generate forecast from existing assignments data
        // instead of making duplicate API calls
        setLoadingStage(LoadingStage.FORECAST);
        let forecast: DayForecast[] = [];
        try {
          // Generate forecast directly from assignments we already have
          const forecastData = generateForecastFromAssignments(
            assignments.data
          );
          forecast = generateForecast(forecastData, subjectsById);
        } catch (error) {
          console.warn("Error generating forecast data:", error);
          // Fallback to API call only if needed
          try {
            const forecastData = await getReviewForecast(token);
            forecast = generateForecast(
              forecastData.reviews || [],
              subjectsById
            );
          } catch (fallbackError) {
            console.warn(
              "Error fetching forecast data from API:",
              fallbackError
            );
          }
        }

        // Update with forecast data
        setDashboardData((prev) => ({
          ...prev,
          forecast,
          dataLoadingState: { ...prev.dataLoadingState, forecast: true },
        }));

        // Get review statistics for critical items
        setLoadingStage(LoadingStage.STATS);
        const reviewStats = await getReviewStatisticsOptimized(
          token,
          {},
          { forceFullRefresh }
        );

        // Process SRS levels and other statistics
        const srsLevels = processSrsLevels(assignments.data, subjectsById);
        const recentUnlocks = processRecentUnlocks(
          assignments.data,
          subjectsById
        );
        const burnedItems = processBurnedItems(assignments.data, subjectsById);
        const criticalItems = processCriticalItems(
          reviewStats.data,
          subjectsById
        );

        const isOnVacation = Boolean(userData.data.current_vacation_started_at);

        // Derive recent review statistics (last 7 days) for recent mistakes
        let recentMistakes: RecentMistake[] = [];
        if (!isOnVacation) {
          try {
            const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentReviewStats = reviewStats.data.filter((stat: any) => {
              const updatedAt = Date.parse(stat?.data_updated_at ?? "");
              return Number.isNaN(updatedAt) ? true : updatedAt >= oneWeekAgoMs;
            });
            recentMistakes = processRecentMistakes(
              recentReviewStats,
              subjectsById
            );
          } catch (recentMistakesError) {
            console.warn(
              "Error fetching recent mistakes:",
              recentMistakesError
            );
          }
        }

        // Update with statistics
        setDashboardData((prev) => ({
          ...prev,
          srsLevels,
          recentUnlocks,
          burnedItems,
          criticalItems,
          recentMistakes,
          reviewStatistics: reviewStats.data,
          dataLoadingState: { ...prev.dataLoadingState, stats: true },
        }));

        // Get level progressions and user data
        setLoadingStage(LoadingStage.LEVEL_DATA);
        let levelProgressions: any = { data: [{ data: { level: 1 } }] };
        let resets: any = { data: [] };
        let currentLevelItems: LevelItem[] = [];
        let completedCount = 0;
        let totalCount = 0;
        let srsStagesCompleted = 0;
        let srsStagesTotal = 0;

        try {
          // Get current level info
          [levelProgressions, resets] = await Promise.all([
            getLevelProgressions(token),
            getResets(token),
          ]);
          const currentLevel = userData.data.level;

          // Get level subjects safely
          try {
            // Get all radicals, kanji, and vocabulary for the current level
            const levelSubjects = await getSubjects(
              token,
              {
                levels: [currentLevel],
                types: ["radical", "kanji", "vocabulary"],
              },
              { skipCollectionCache: true }
            );

            // Add level subjects to allSubjects if they're not already there
            // This ensures that even locked items (which don't have assignments yet) are available
            const existingSubjectIds = new Set(allSubjects.map((s) => s.id));
            const newSubjects = levelSubjects.data.filter(
              (s: any) => !existingSubjectIds.has(s.id)
            );

            if (newSubjects.length > 0) {
              allSubjects = [...allSubjects, ...newSubjects];

              // Update subjectsById map with new subjects
              newSubjects.forEach((subject: any) => {
                subjectsById[subject.id] = subject;
              });
            }

            // Process level progress
            const result = processLevelProgress(
              levelSubjects.data,
              assignments.data
            );
            currentLevelItems = result.currentLevelItems;
            completedCount = result.completedCount;
            totalCount = result.totalCount;
            srsStagesCompleted = result.srsStagesCompleted;
            srsStagesTotal = result.srsStagesTotal;
          } catch (error) {
            console.warn("Error fetching level subjects:", error);
          }
        } catch (error) {
          console.warn("Error fetching level data:", error);
        }

        // Calculate level time remaining
        let levelTimeRemainingData = {
          timeText: "Now",
          isEstimate: false,
        };

        try {
          // Get the current level assignments
          const currentLevelValue = userData.data.level;

          const currentLevelAssignments = assignments.data.filter((a) => {
            // Find the subject for this assignment
            const subject = allSubjects.find((s) => s.id === a.data.subject_id);
            // Check if it's from the current level
            return subject && subject.data.level === currentLevelValue;
          });

          // Ensure we have the complete subject data for each assignment
          const currentLevelSubjectsById = allSubjects.reduce(
            (acc, subject) => {
              if (subject.data.level === currentLevelValue) {
                acc[subject.id] = subject;
              }
              return acc;
            },
            {} as Record<number, any>
          );

          // Enhance assignments with their full subject data
          // In Swift, the isLocked property is used to determine if a kanji is locked
          const enhancedAssignments = currentLevelAssignments.map(
            (assignment) => {
              const subject =
                currentLevelSubjectsById[assignment.data.subject_id];

              // In Swift's assignment class, isLocked means the item isn't unlocked yet
              // This is different from "started" which means it has been started in lessons
              const isLocked = !assignment.data.unlocked_at;

              return {
                ...assignment,
                // Attach the subject data to match the Swift implementation
                subject: subject,
                // Set isLocked property to match Swift's definition
                isLocked: isLocked,
              };
            }
          );

          // The WaniKani API only returns assignments for unlocked subjects.
          // Kanji that are still locked (waiting for radicals to guru) have no
          // assignment at all, so synthesize locked entries here to avoid
          // underestimating level-up time.
          const assignedSubjectIds = new Set(
            currentLevelAssignments.map((a) => a.data.subject_id)
          );
          const lockedKanjiEntries = Object.values(currentLevelSubjectsById)
            .filter(
              (subject: any) =>
                subject.object === "kanji" &&
                !subject.data.hidden_at &&
                !assignedSubjectIds.has(subject.id)
            )
            .map((subject: any) => ({
              id: -subject.id,
              object: "assignment",
              url: "",
              data_updated_at: "",
              data: {
                created_at: "",
                subject_type: "kanji" as const,
                subject_id: subject.id,
                unlocked_at: null,
                started_at: null,
                passed_at: null,
                burned_at: null,
                available_at: null,
                resurrected_at: null,
                hidden: false,
                srs_stage: 0,
              },
              subject,
              isLocked: true,
            }));

          const allLevelAssignments = [
            ...enhancedAssignments,
            ...lockedKanjiEntries,
          ];

          // Now call the level time remaining calculator
          const { finish, isEstimate } = calculateLevelTimeRemaining(
            allLevelAssignments,
            levelProgressions.data,
            resets.data
          );

          // Format the finish date into a time text
          const timeText =
            finish <= new Date() ? "Now" : formatTimeInterval(finish);

          levelTimeRemainingData = { timeText, isEstimate };
        } catch (error) {
          console.warn("Error calculating level time remaining:", error);
          levelTimeRemainingData = {
            timeText: "Unknown",
            isEstimate: true,
          };
        }

        // Update with level data
        setDashboardData((prev) => ({
          ...prev,
          levelItems: currentLevelItems,
          levelProgressions: levelProgressions.data,
          resets: resets.data,
          completedCount,
          totalCount,
          srsStagesCompleted,
          srsStagesTotal,
          levelTimeRemaining: levelTimeRemainingData,
          dataLoadingState: { ...prev.dataLoadingState, levelData: true },
        }));

        // OPTIMIZATION: Calculate recent lesson count from existing assignments data
        // instead of making another API call
        setLoadingStage(LoadingStage.LESSONS);
        let recentLessonCount = 0;
        try {
          // Filter assignments for apprentice stages that haven't been passed yet
          recentLessonCount = assignments.data.filter((assignment) => {
            return (
              assignment.data.srs_stage >= 1 &&
              assignment.data.srs_stage <= 4 &&
              !assignment.data.passed_at &&
              !assignment.data.burned_at
            );
          }).length;
        } catch (error) {
          console.warn(
            "Error calculating recent lesson assignments from existing data:",
            error
          );
          // Fallback to API call only if needed
          try {
            const recentLessonResponse = await getRecentLessonAssignments(
              token
            );
            recentLessonCount = recentLessonResponse.data.length;
          } catch (fallbackError) {
            console.warn(
              "Error fetching recent lesson assignments from API:",
              fallbackError
            );
          }
        }

        // Final update with recent lessons
        setDashboardData((prev) => ({
          ...prev,
          recentLessonCount,
          dataLoadingState: { ...prev.dataLoadingState, lessons: true },
        }));

        // CRITICAL: Final update with subjects and assignments arrays AND subjects-dependent data
        const latestPendingProgressAssignmentIdsForFinalSnapshot =
          await loadPendingProgressAssignmentIds();
        setDashboardData((prev) => ({
          ...prev,
          subjects: allSubjects,
          assignments: assignments.data,
          learnedKanjiCount,
          pendingLessonSyncCount:
            latestPendingProgressAssignmentIdsForFinalSnapshot.lesson.size,
          pendingReviewSyncCount:
            latestPendingProgressAssignmentIdsForFinalSnapshot.review.size,
          dataLoadingState: { ...prev.dataLoadingState, subjects: true },
        }));

        // Return the final processed dashboard data
        return {
          lessonCount: counts.lessonCount,
          reviewCount: counts.reviewCount,
          forecast,
          levelItems: currentLevelItems,
          srsLevels,
          recentUnlocks,
          burnedItems,
          criticalItems,
          recentMistakes,
          levelProgressions: levelProgressions.data,
          resets: resets.data,
          reviewStatistics: reviewStats.data,
          currentLevel: userData.data.level,
          completedCount,
          totalCount,
          srsStagesCompleted,
          srsStagesTotal,
          nextLessonDate: counts.nextLessonDate,
          nextReviewDate: counts.nextReviewDate,
          pendingLessonSyncCount:
            latestPendingProgressAssignmentIdsForFinalSnapshot.lesson.size,
          pendingReviewSyncCount:
            latestPendingProgressAssignmentIdsForFinalSnapshot.review.size,
          recentLessonCount,
          learnedKanjiCount,
          levelTimeRemaining: levelTimeRemainingData,
          subjects: allSubjects,
          assignments: assignments.data,
          dataLoadingState: {
            summary: true,
            userData: true,
            assignments: true,
            subjects: true,
            forecast: true,
            stats: true,
            levelData: true,
            lessons: true,
          },
        };
      } catch (error) {
        console.error("Error processing assignments:", error);
        throw error;
      }
    },
    // generateForecast* callbacks are declared later in this component and are
    // stable; processAssignments is only invoked after render has completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loadPendingProgressAssignmentIds,
      reconcileReviewCountWithVisibleEndpoint,
      setLearnedKanjiCount,
      setUserData,
    ]
  );

  const syncReviewNotificationState = useCallback(
    async (visibleReviewData: VisibleReviewData | null) => {
      if (!visibleReviewData) {
        return;
      }

      try {
        await updateBadgeWithReviewCount({
          forceSummaryRefresh: true,
          visibleReviewData,
        });
        // Legacy review baseline tracking is only used on non-iOS paths.
        if (!shouldUseNativeReviewNotificationSystem()) {
          await updateLastReviewCount({
            reviewCount: visibleReviewData.currentReviews,
          });
        }
      } catch (error) {
        console.error(
          "Failed to sync review notifications after assignment refresh:",
          error
        );
      }
    },
    []
  );

  // Helper function to generate forecast data from assignments (avoiding duplicate API calls)
  const generateForecastFromAssignments = useCallback((assignmentsData: any[]): any[] => {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // Convert assignments to forecast format
    const reviews: any[] = [];

    assignmentsData.forEach((assignment) => {
      if (!isAssignmentInReviewQueueState(assignment?.data)) {
        return;
      }

      const availableDate = new Date(assignment.data.available_at);
      // Only include reviews in the next 7 days
      if (availableDate >= now && availableDate <= sevenDaysLater) {
        reviews.push({
          available_at: assignment.data.available_at,
          subject_ids: [assignment.data.subject_id],
        });
      }
    });

    return reviews;
  }, []);

  // Helper function to create empty subject breakdown
  const createEmptyBreakdown = (): SubjectTypeBreakdown => ({
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    kana_vocabulary: 0,
  });

  // Generate review forecast
  const generateForecast = useCallback((
    reviews: any[],
    subjectsById: Record<number, any> = {}
  ): DayForecast[] => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const toLocalDayIndex = (date: Date) =>
      Math.floor(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
          DAY_IN_MS
      );
    const startDayIndex = toLocalDayIndex(startOfToday);

    // Get current hour for filtering
    const currentHour = now.getHours();

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    // Create an array for the next 7 days
    const nextSevenDays: DayForecast[] = [];

    // Add "Today" as the first day
    nextSevenDays.push({
      day: "Today",
      totalCount: 0,
      cumulativeCount: 0,
      subjectBreakdown: createEmptyBreakdown(),
      hours: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0,
        cumulativeCount: 0,
        subjectBreakdown: createEmptyBreakdown(),
        subjectIds: [],
      })),
    });

    // Add the next 6 days with proper names
    for (let i = 1; i <= 6; i++) {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() + i);
      const dayName = i === 1 ? "Tomorrow" : dayNames[date.getDay()];

      nextSevenDays.push({
        day: dayName,
        displayDate: `${date.getMonth() + 1}/${date.getDate()}`,
        totalCount: 0,
        cumulativeCount: 0,
        subjectBreakdown: createEmptyBreakdown(),
        hours: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: 0,
          cumulativeCount: 0,
          subjectBreakdown: createEmptyBreakdown(),
          subjectIds: [],
        })),
      });
    }

    // If no reviews, return the empty structure
    if (!reviews || reviews.length === 0) {
      return nextSevenDays;
    }

    // First pass: collect current hour reviews count for cumulative calculation
    let currentHourReviewsCount = 0;
    reviews.forEach((review) => {
      if (!review.available_at) return;

      const reviewDate = new Date(review.available_at);
      // Use calendar-day indexing instead of ms/24h to avoid DST bucket shifts.
      const diffDays = toLocalDayIndex(reviewDate) - startDayIndex;
      const hour = reviewDate.getHours();

      // Count current hour reviews for cumulative calculation
      if (diffDays === 0 && hour === currentHour) {
        const count = review.subject_ids ? review.subject_ids.length : 1;
        if (count > 0) {
          currentHourReviewsCount += count;
        }
      }
    });

    // Second pass: process all reviews (excluding current hour from display)
    reviews.forEach((review) => {
      if (!review.available_at) return;

      // Parse the review date
      const reviewDate = new Date(review.available_at);

      // Calculate day difference from today
      // Use calendar-day indexing instead of ms/24h to avoid DST bucket shifts.
      const diffDays = toLocalDayIndex(reviewDate) - startDayIndex;

      // Only include reviews for the next 7 days
      if (diffDays < 0 || diffDays >= 7) return;

      // Skip reviews that are in the current hour of today (don't display them)
      const hour = reviewDate.getHours();
      if (diffDays === 0 && hour === currentHour) {
        return; // Skip current hour reviews from display
      }

      // Get the count of items in this review and track by subject type
      const count = review.subject_ids ? review.subject_ids.length : 1;
      if (count <= 0) return;

      // Track subject types if we have subject data
      const subjectBreakdown = createEmptyBreakdown();
      if (review.subject_ids && subjectsById) {
        review.subject_ids.forEach((subjectId: number) => {
          const subject = subjectsById[subjectId];
          if (subject) {
            const subjectType = subject.object as keyof SubjectTypeBreakdown;
            if (subjectBreakdown[subjectType] !== undefined) {
              subjectBreakdown[subjectType]++;
            }
          }
        });
      } else {
        // Fallback if no subject data available
        subjectBreakdown.vocabulary = count;
      }

      // Add to the appropriate day and hour
      nextSevenDays[diffDays].totalCount += count;
      nextSevenDays[diffDays].hours![hour].count += count;

      // Add subject IDs to the hour for critical review detection
      if (review.subject_ids) {
        nextSevenDays[diffDays].hours![hour].subjectIds!.push(
          ...review.subject_ids
        );
      }

      // Add subject breakdown to day and hour
      Object.keys(subjectBreakdown).forEach((type) => {
        const key = type as keyof SubjectTypeBreakdown;
        nextSevenDays[diffDays].subjectBreakdown![key] += subjectBreakdown[key];
        nextSevenDays[diffDays].hours![hour].subjectBreakdown![key] +=
          subjectBreakdown[key];
      });
    });

    // Calculate cumulative counts for days (including current hour reviews)
    let runningTotal = currentHourReviewsCount; // Start with current hour reviews
    nextSevenDays.forEach((day) => {
      runningTotal += day.totalCount;
      day.cumulativeCount = runningTotal;

      // Calculate cumulative counts for hours (including current hour for today)
      let hourlyRunningTotal = 0;
      if (day.day === "Today") {
        hourlyRunningTotal = currentHourReviewsCount; // Start with current hour for today
      }

      day.hours!.forEach((hour) => {
        hourlyRunningTotal += hour.count;
        hour.cumulativeCount = hourlyRunningTotal;
      });
    });

    // Only keep days with reviews (except Today)
    return nextSevenDays.filter(
      (day, index) => index === 0 || day.totalCount > 0
    );
  }, []);

  // Keep forecast in sync with the latest assignments so dashboard cumulative
  // values don't drift when only quick-count refreshes run.
  const rebuildForecastFromAssignments = useCallback((
    assignmentsData: any[],
    subjectsData: any[] = []
  ): DayForecast[] => {
    const forecastData = generateForecastFromAssignments(assignmentsData);
    const subjectsById = subjectsData.reduce((acc, subject) => {
      acc[subject.id] = subject;
      return acc;
    }, {} as Record<number, any>);

    return generateForecast(forecastData, subjectsById);
  }, [generateForecastFromAssignments, generateForecast]);

  // Process SRS levels
  const processSrsLevels = (
    assignments: any[],
    subjectsById: Record<number, any>
  ): SrsLevel[] => {
    const srsLevels: SrsLevel[] = [
      {
        name: "Apprentice",
        count: 0,
        color: SRS_COLORS.apprentice.hex,
        icon: "school",
        breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
      },
      {
        name: "Guru",
        count: 0,
        color: SRS_COLORS.guru.hex,
        icon: "snow",
        breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
      },
      {
        name: "Master",
        count: 0,
        color: SRS_COLORS.master.hex,
        icon: "trophy",
        breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
      },
      {
        name: "Enlightened",
        count: 0,
        color: SRS_COLORS.enlightened.hex,
        icon: "flash",
        breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
      },
      {
        name: "Burned",
        count: 0,
        color: SRS_COLORS.burned.hex,
        icon: "flame",
        breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
      },
    ];

    // Count of subjects we couldn't classify (for debugging)
    let unclassifiedCount = 0;
    let missingSubjectCount = 0;

    assignments.forEach((assignment) => {
      if (assignment.data.started_at) {
        const subject = subjectsById[assignment.data.subject_id];
        if (!subject) {
          missingSubjectCount++;
          return;
        }

        // Determine subject type from the 'object' property
        let subjectType: "radical" | "kanji" | "vocabulary";

        if (subject.object === "radical") {
          subjectType = "radical";
        } else if (subject.object === "kanji") {
          subjectType = "kanji";
        } else if (
          subject.object === "vocabulary" ||
          subject.object === "kana_vocabulary"
        ) {
          subjectType = "vocabulary";
        } else {
          // Fallback for unknown types - count it but log for debugging
          console.warn(
            `Unknown subject type: ${subject.object} for subject ID: ${subject.id}`
          );
          unclassifiedCount++;
          return;
        }

        // Determine SRS level
        let srsLevelIndex;
        const srsStage = assignment.data.srs_stage;

        if (srsStage >= 1 && srsStage <= 4) {
          srsLevelIndex = 0; // Apprentice
        } else if (srsStage >= 5 && srsStage <= 6) {
          srsLevelIndex = 1; // Guru
        } else if (srsStage === 7) {
          srsLevelIndex = 2; // Master
        } else if (srsStage === 8) {
          srsLevelIndex = 3; // Enlightened
        } else if (srsStage === 9) {
          srsLevelIndex = 4; // Burned
        } else {
          return; // Skip if not started
        }

        // Increment the appropriate counters
        srsLevels[srsLevelIndex].count++;
        srsLevels[srsLevelIndex].breakdown[subjectType]++;
      }
    });

    if (unclassifiedCount > 0) {
      console.warn(`Could not classify ${unclassifiedCount} subjects by type`);
    }

    if (missingSubjectCount > 0) {
      console.warn(
        `${missingSubjectCount} assignments had subject IDs that were not found in the subjects data`
      );
    }

    return srsLevels;
  };

  // Process level progress
  const processLevelProgress = (
    levelSubjects: any[],
    assignments: any[]
  ): {
    currentLevelItems: LevelItem[];
    completedCount: number;
    totalCount: number;
    srsStagesCompleted: number;
    srsStagesTotal: number;
  } => {
    // Get only visible (non-hidden) kanji and radical subjects for the level
    // WaniKani marks deprecated/retired subjects with data.hidden_at
    const kanjiSubjects = levelSubjects.filter(
      (subject) => subject.object === "kanji" && !subject.data.hidden_at
    );

    const radicalSubjects = levelSubjects.filter(
      (subject) => subject.object === "radical" && !subject.data.hidden_at
    );

    // Map assignments by subject ID
    const assignmentsMap = assignments.reduce((acc, assignment) => {
      acc[assignment.data.subject_id] = assignment;
      return acc;
    }, {} as Record<number, any>);

    // Track completed kanji and SRS stages
    let completedCount = 0;
    const totalCount = kanjiSubjects.length;
    let srsStagesCompleted = 0;
    const srsStagesTotal = kanjiSubjects.length * 5; // Each kanji has 5 SRS stages to complete (1-5)

    // Process radicals
    const radicalItems: LevelItem[] = radicalSubjects.map((subject) => {
      const assignment = assignmentsMap[subject.id];

      // A subject is "passed" if it has reached Guru status (SRS stage 5+)
      const srsStage = assignment?.data.srs_stage || 0;
      const isPassed = srsStage >= 5;

      return {
        id: subject.id,
        characters: subject.data.characters || subject.data.meanings[0].meaning,
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        imageUrl: subject.data.character_images?.[0]?.url,
        characterImages: subject.data.character_images,
        isPassed: isPassed,
        srsStage: srsStage,
        item_type: "radical",
      };
    });

    // Process kanji
    const kanjiItems: LevelItem[] = kanjiSubjects.map((subject) => {
      const assignment = assignmentsMap[subject.id];

      // A subject is "passed" if it has reached Guru status (SRS stage 5+)
      const srsStage = assignment?.data.srs_stage || 0;
      const isPassed = srsStage >= 5;

      if (isPassed) {
        completedCount++;
      }

      // Calculate SRS stages completed for this kanji
      // SRS stages 1-5 are what we count towards completion
      const kanjiSrsStagesCompleted = Math.min(Math.max(srsStage, 0), 5);
      srsStagesCompleted += kanjiSrsStagesCompleted;

      return {
        id: subject.id,
        characters: subject.data.characters || "",
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        imageUrl: null,
        isPassed: isPassed,
        srsStage: srsStage,
        item_type: "kanji",
      };
    });

    // Combine both radical and kanji items
    const currentLevelItems = [...radicalItems, ...kanjiItems];

    return {
      currentLevelItems,
      completedCount,
      totalCount,
      srsStagesCompleted,
      srsStagesTotal,
    };
  };

  // Process recent unlocks
  const processRecentUnlocks = (
    assignments: any[],
    subjectsById: Record<number, any>
  ): UnlockItem[] => {
    const items = assignments
      .filter((a) => a.data.unlocked_at)
      .map((assignment) => {
        const subject = subjectsById[assignment.data.subject_id];
        if (!subject) return null;

        return {
          id: subject.id,
          characters: subject.data.characters,
          meaning: subject.data.meanings[0].meaning,
          type: subject.object as WaniKaniItemType,
          dateUnlocked: assignment.data.unlocked_at,
        };
      })
      .filter((item): item is UnlockItem => item !== null)
      .sort(
        (a, b) =>
          new Date(b.dateUnlocked).getTime() -
          new Date(a.dateUnlocked).getTime()
      )
      .slice(0, 10);

    return items;
  };

  // Process burned items
  const processBurnedItems = (
    assignments: any[],
    subjectsById: Record<number, any>
  ): BurnedItem[] => {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const items = assignments
      .filter(
        (a) => a.data.burned_at && new Date(a.data.burned_at) >= thirtyDaysAgo
      )
      .map((assignment) => {
        const subject = subjectsById[assignment.data.subject_id];
        if (!subject) return null;

        return {
          id: subject.id,
          characters: subject.data.characters,
          meaning: subject.data.meanings[0].meaning,
          type: subject.object as WaniKaniItemType,
          dateBurned: assignment.data.burned_at,
        };
      })
      .filter((item): item is BurnedItem => item !== null)
      .sort(
        (a, b) =>
          new Date(b.dateBurned).getTime() - new Date(a.dateBurned).getTime()
      )
      .slice(0, 10);

    return items;
  };

  // Process critical items
  const processCriticalItems = (
    reviewStats: any[],
    subjectsById: Record<number, any>
  ): CriticalItem[] => {
    const items = reviewStats
      .map((stat) => {
        const subject = subjectsById[stat.data.subject_id];
        if (!subject) return null;

        return {
          id: subject.id,
          characters: subject.data.characters,
          meaning: subject.data.meanings[0].meaning,
          type: subject.object as WaniKaniItemType,
          percentage: stat.data.percentage_correct,
        };
      })
      .filter((item): item is CriticalItem => item !== null)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 10);

    return items;
  };

  // Process recent mistakes (items reviewed in last 24h that have a recent incorrect answer)
  // The key insight is that when you make a mistake, your current_streak resets to 0.
  // If current_streak is 0 or 1, and incorrect > 0, it means you made a mistake very recently.
  const processRecentMistakes = (
    recentReviewStats: any[],
    subjectsById: Record<number, any>
  ): RecentMistake[] => {
    const items: RecentMistake[] = [];

    for (const stat of recentReviewStats) {
      // Check if this item has a RECENT mistake by looking at the current_streak
      // A recent mistake means: current_streak is 0 or 1 (just made a mistake, got it right at most once since)
      // AND the incorrect count is > 0 (they have actually made a mistake, not just starting fresh)
      const hasMeaningMistake =
        stat.data.meaning_current_streak <= 1 && stat.data.meaning_incorrect > 0;
      const hasReadingMistake =
        stat.data.reading_current_streak <= 1 && stat.data.reading_incorrect > 0;

      // Skip if no recent mistake
      if (!hasMeaningMistake && !hasReadingMistake) {
        continue;
      }

      const subject = subjectsById[stat.data.subject_id];
      if (!subject) continue;

      // Get primary reading if available
      const primaryReading = subject.data.readings?.find(
        (r: any) => r.primary
      )?.reading;

      const item: RecentMistake = {
        id: subject.id,
        characters: subject.data.characters,
        meaning: subject.data.meanings[0].meaning,
        type: subject.object as WaniKaniItemType,
        meaningIncorrect: stat.data.meaning_incorrect,
        readingIncorrect: stat.data.reading_incorrect,
        percentage: stat.data.percentage_correct,
        updatedAt: stat.data_updated_at,
      };

      // Add optional fields only if they exist
      if (primaryReading) {
        item.reading = primaryReading;
      }
      if (subject.data.character_images) {
        item.character_images = subject.data.character_images;
      }

      items.push(item);
    }

    // Sort by update time (most recent first)
    return items.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  };

  // Use the stale-while-revalidate pattern for data fetching
  const fetchDashboardData = useCallback(
    async (forceRefresh = false) => {
      if (!apiToken) return;

      if (
        dashboardForegroundFetchInFlightRef.current ||
        dashboardBackgroundRefreshInFlightRef.current
      ) {
        startupDiagnostics.markEvent("dashboard.fetch.skipped.inflight", {
          forceRefresh,
          foregroundInFlight: dashboardForegroundFetchInFlightRef.current,
          backgroundInFlight: dashboardBackgroundRefreshInFlightRef.current,
        });
        return;
      }

      const shouldTrackStartupFetch =
        startupDiagnostics.isActive() && !startupDashboardFetchTrackedRef.current;
      let startupFetchError: unknown;
      let usedCachedDashboard = false;
      let startupFetchOperationId: number | null = null;

      if (shouldTrackStartupFetch) {
        startupDashboardFetchTrackedRef.current = true;
        startupDiagnostics.markDashboardFetchStarted({
          forceRefresh,
        });
        startupFetchOperationId = startupDiagnostics.beginOperation(
          "dashboard.fetchDashboardData",
          {
            phase: "dashboard",
            details: {
              forceRefresh,
            },
          }
        );
      }

      dashboardForegroundFetchInFlightRef.current = true;
      setErrorStatus(null);

      try {
        // First, try to load from cache if not forcing refresh
        if (!forceRefresh) {
          const cachedData = await getDashboardCache();
          if (cachedData) {
            usedCachedDashboard = true;
            const pendingProgressAssignmentIdsForCachedData =
              await loadPendingProgressAssignmentIds();
            const normalizedCachedData =
              Array.isArray((cachedData as any).assignments) &&
              (cachedData as any).assignments.length > 0
                ? (() => {
                    const normalizedCounts =
                      getLessonAndReviewCountsFromAssignments(
                        (cachedData as any).assignments,
                        pendingProgressAssignmentIdsForCachedData
                      );
                    return {
                      ...cachedData,
                      lessonCount: normalizedCounts.lessonCount,
                      reviewCount: normalizedCounts.reviewCount,
                      nextLessonDate:
                        normalizedCounts.nextLessonDate ??
                        (cachedData as any).nextLessonDate,
                      nextReviewDate:
                        normalizedCounts.nextReviewDate ??
                        (cachedData as any).nextReviewDate,
                      pendingLessonSyncCount:
                        pendingProgressAssignmentIdsForCachedData.lesson.size,
                      pendingReviewSyncCount:
                        pendingProgressAssignmentIdsForCachedData.review.size,
                    };
                  })()
                : {
                    ...cachedData,
                    pendingLessonSyncCount:
                      pendingProgressAssignmentIdsForCachedData.lesson.size,
                    pendingReviewSyncCount:
                      pendingProgressAssignmentIdsForCachedData.review.size,
                  };
            // Use cached data immediately
            setDashboardData(normalizedCachedData);
            setIsFreshData(false);

            // Attempt to inflate cached dashboard with full subjects/assignments from permanent storage
            // This ensures offline components have data even when the cached dashboard was minified
            try {
              const reconstructed =
                await getFullDashboardDataFromPermanentStorage();
              const needsInflation =
                !Array.isArray((cachedData as any).subjects) ||
                !Array.isArray((cachedData as any).assignments) ||
                ((cachedData as any).subjects?.length ?? 0) === 0 ||
                ((cachedData as any).assignments?.length ?? 0) === 0;
              if (reconstructed && needsInflation) {
                const normalizedCounts = Array.isArray(reconstructed.assignments)
                  ? getLessonAndReviewCountsFromAssignments(
                      reconstructed.assignments,
                      pendingProgressAssignmentIdsForCachedData
                    )
                  : null;
                setDashboardData({
                  ...reconstructed,
                  lessonCount:
                    normalizedCounts?.lessonCount ?? reconstructed.lessonCount ?? 0,
                  reviewCount:
                    normalizedCounts?.reviewCount ?? reconstructed.reviewCount ?? 0,
                  nextLessonDate:
                    normalizedCounts?.nextLessonDate ??
                    reconstructed.nextLessonDate ??
                    null,
                  nextReviewDate:
                    normalizedCounts?.nextReviewDate ??
                    reconstructed.nextReviewDate ??
                    null,
                  pendingLessonSyncCount:
                    pendingProgressAssignmentIdsForCachedData.lesson.size,
                  pendingReviewSyncCount:
                    pendingProgressAssignmentIdsForCachedData.review.size,
                });
              }
            } catch (inflateError) {
              console.warn("Offline reconstruction failed:", inflateError);
            }

            let preloadedSummary: any | null = null;
            let preloadedAssignments: CollectionResponse<Assignment> | null =
              null;
            const fastSummaryOperationId = startupDiagnostics.beginOperation(
              "dashboard.refreshSummary.priority",
              {
                phase: "dashboard",
                details: {
                  source: "summary",
                  reason: "cached_dashboard_startup",
                },
              }
            );

            try {
              preloadedSummary = await getSummary(apiToken, {
                forceRefresh: false,
              });

              const { lessonCount, reviewCount, nextReviewDate } =
                getLessonAndReviewCountsFromSummary(preloadedSummary);

              setDashboardData((prevData) => ({
                ...prevData,
                lessonCount,
                // Keep previous value until hidden-filtered count arrives.
                reviewCount: prevData.reviewCount,
                nextReviewDate,
                dataLoadingState: {
                  ...prevData.dataLoadingState,
                  summary: true,
                },
              }));

              startupDiagnostics.endOperation(fastSummaryOperationId, {
                status: "ok",
                details: {
                  lessonCount,
                  reviewCount,
                  nextReviewDate,
                },
              });
            } catch (summaryRefreshError) {
              startupDiagnostics.endOperation(fastSummaryOperationId, {
                status: "error",
                error: summaryRefreshError,
              });
              console.warn(
                "Failed to refresh lesson/review counts from summary:",
                summaryRefreshError
              );
            }

            const fastCountsOperationId = startupDiagnostics.beginOperation(
              "dashboard.refreshLessonReviewCounts.priority",
              {
                phase: "dashboard",
                details: {
                  source: "assignments_optimized",
                  reason: "cached_dashboard_startup",
                },
              }
            );

            try {
              let latestAssignments = await getAssignmentsOptimized(
                apiToken,
                {},
                { forceFullRefresh: false }
              );
              const pendingProgressAssignmentIds =
                await loadPendingProgressAssignmentIds();
              let serverCounts = getLessonAndReviewCountsFromAssignments(
                latestAssignments.data
              );
              ({
                assignments: latestAssignments,
                counts: serverCounts,
              } = await reconcileReviewCountWithVisibleEndpoint(
                apiToken,
                latestAssignments,
                serverCounts
              ));
              preloadedAssignments = latestAssignments;

              const { lessonCount, reviewCount, nextLessonDate, nextReviewDate } =
                getLessonAndReviewCountsFromAssignments(
                  latestAssignments.data,
                  pendingProgressAssignmentIds
                );

              setDashboardData((prevData) => ({
                ...prevData,
                lessonCount,
                reviewCount,
                nextLessonDate,
                nextReviewDate,
                pendingLessonSyncCount: pendingProgressAssignmentIds.lesson.size,
                pendingReviewSyncCount: pendingProgressAssignmentIds.review.size,
                assignments: latestAssignments.data,
                dataLoadingState: {
                  ...prevData.dataLoadingState,
                  assignments: true,
                },
              }));

              void syncReviewNotificationState(
                buildVisibleReviewDataFromAssignments(
                  pendingProgressAssignmentIds.review.size > 0
                    ? latestAssignments.data.filter(
                        (assignment) =>
                          !pendingProgressAssignmentIds.review.has(assignment.id)
                      )
                    : latestAssignments.data
                )
              );

              startupDiagnostics.endOperation(fastCountsOperationId, {
                status: "ok",
                details: {
                  lessonCount,
                  reviewCount,
                  assignmentCount: latestAssignments.data.length,
                },
              });
            } catch (countsRefreshError) {
              startupDiagnostics.endOperation(fastCountsOperationId, {
                status: "error",
                error: countsRefreshError,
              });
              console.warn(
                "Failed to refresh lesson/review counts from assignments:",
                countsRefreshError
              );
            }

            // Revalidate with fresh data after initial interactions so startup
            // animations and first paint are not blocked by heavy JS work.
            const backgroundRefreshOperationId = startupDiagnostics.beginOperation(
              "dashboard.refreshCachedData.background",
              {
                phase: "post-loader",
                details: { deferredUntilIdle: true, deferredStartMs: 1500 },
              }
            );

            dashboardBackgroundRefreshInFlightRef.current = true;

            const runBackgroundRefresh = async () => {
              try {
                setLoadingStage(LoadingStage.SUMMARY);
                const freshData = await processAssignments(
                  apiToken,
                  false,
                  preloadedAssignments,
                  preloadedSummary
                );
                if (freshData) {
                  setIsFreshData(true);
                  await saveDashboardCache(freshData);
                  const pendingProgressAssignmentIds =
                    await loadPendingProgressAssignmentIds();
                  void syncReviewNotificationState(
                    buildVisibleReviewDataFromAssignments(
                      pendingProgressAssignmentIds.review.size > 0
                        ? freshData.assignments.filter(
                            (assignment) =>
                              !pendingProgressAssignmentIds.review.has(assignment.id)
                          )
                        : freshData.assignments
                    )
                  );
                }
                startupDiagnostics.endOperation(backgroundRefreshOperationId, {
                  status: "ok",
                });
              } catch (error) {
                console.error("Error refreshing data in background:", error);
                startupDiagnostics.endOperation(backgroundRefreshOperationId, {
                  status: "error",
                  error,
                });

                // On refresh failure, try one more time to ensure we show offline data with arrays
                try {
                  const reconstructed =
                    await getFullDashboardDataFromPermanentStorage();
                  if (reconstructed) {
                    const pendingProgressAssignmentIdsForReconstructedData =
                      await loadPendingProgressAssignmentIds();
                    const normalizedCounts = Array.isArray(
                      reconstructed.assignments
                    )
                      ? getLessonAndReviewCountsFromAssignments(
                          reconstructed.assignments,
                          pendingProgressAssignmentIdsForReconstructedData
                        )
                      : null;
                    setDashboardData({
                      ...reconstructed,
                      lessonCount:
                        normalizedCounts?.lessonCount ??
                        reconstructed.lessonCount ??
                        0,
                      reviewCount:
                        normalizedCounts?.reviewCount ??
                        reconstructed.reviewCount ??
                        0,
                      nextLessonDate:
                        normalizedCounts?.nextLessonDate ??
                        reconstructed.nextLessonDate ??
                        null,
                      nextReviewDate:
                        normalizedCounts?.nextReviewDate ??
                        reconstructed.nextReviewDate ??
                        null,
                      pendingLessonSyncCount:
                        pendingProgressAssignmentIdsForReconstructedData.lesson.size,
                      pendingReviewSyncCount:
                        pendingProgressAssignmentIdsForReconstructedData.review.size,
                    });
                  }
                } catch (offlineError) {
                  console.warn(
                    "Offline fallback after refresh error failed:",
                    offlineError
                  );
                }
              } finally {
                setLoadingStage(LoadingStage.IDLE);
                dashboardBackgroundRefreshInFlightRef.current = false;
              }
            };

            InteractionManager.runAfterInteractions(() => {
              setTimeout(() => {
                void runBackgroundRefresh();
              }, 1500);
            });

            return;
          }
        }

        // No cache or force refresh, load data normally with progressive updates
        setIsLoading(true);
        setLoadingStage(LoadingStage.SUMMARY);

        const finalData = await processAssignments(apiToken, forceRefresh);
        if (finalData) {
          // The data has already been updated progressively during processAssignments
          // but we ensure the final state is set and cached
          setIsFreshData(true);

          // Cache the fresh data
          await saveDashboardCache(finalData);
          const pendingProgressAssignmentIds =
            await loadPendingProgressAssignmentIds();
          void syncReviewNotificationState(
            buildVisibleReviewDataFromAssignments(
              pendingProgressAssignmentIds.review.size > 0
                ? finalData.assignments.filter(
                    (assignment) =>
                      !pendingProgressAssignmentIds.review.has(assignment.id)
                  )
                : finalData.assignments
            )
          );

          // Prefetch subjects for current level and next level for instant navigation
          if (finalData.currentLevel) {
            // Prefetch the current level - delayed to prioritize dashboard display
            setTimeout(() => {
              prefetchSubjectsByLevel(
                apiToken,
                finalData.currentLevel,
                getSubjects
              );

              // Also prefetch next level if user is close to leveling up
              if (finalData.completedCount > finalData.totalCount * 0.8) {
                prefetchSubjectsByLevel(
                  apiToken,
                  finalData.currentLevel + 1,
                  getSubjects
                );
              }
            }, 1000); // Delay by 1 second to prioritize UI rendering
          }
        } else {
          console.error("Failed to process assignments: no data returned");
          setErrorStatus("Failed to process assignment data.");
        }
      } catch (error) {
        startupFetchError = error;
        console.error("Failed to fetch dashboard data:", error);

        // Try permanent storage fallback for offline functionality
        try {
          const pendingProgressAssignmentIdsForOfflineData =
            await loadPendingProgressAssignmentIds();
          const offlineData = await getFullDashboardDataFromPermanentStorage();
          if (offlineData) {
            const normalizedCounts = Array.isArray(offlineData.assignments)
              ? getLessonAndReviewCountsFromAssignments(
                  offlineData.assignments,
                  pendingProgressAssignmentIdsForOfflineData
                )
              : null;
            setDashboardData({
              ...offlineData,
              lessonCount:
                normalizedCounts?.lessonCount ?? offlineData.lessonCount ?? 0,
              reviewCount:
                normalizedCounts?.reviewCount ?? offlineData.reviewCount ?? 0,
              nextLessonDate:
                normalizedCounts?.nextLessonDate ??
                offlineData.nextLessonDate ??
                null,
              nextReviewDate:
                normalizedCounts?.nextReviewDate ??
                offlineData.nextReviewDate ??
                null,
              pendingLessonSyncCount:
                pendingProgressAssignmentIdsForOfflineData.lesson.size,
              pendingReviewSyncCount:
                pendingProgressAssignmentIdsForOfflineData.review.size,
            });
            setIsFreshData(false);
            setErrorStatus(
              "Using offline data. Some information may be outdated."
            );
            // Don't return here - let the user know we're using offline data
          }
        } catch (offlineError) {
          console.error("❌ Offline fallback also failed:", offlineError);
        }

        // Check if it's an API error
        if (
          error instanceof Error &&
          error.message.includes("API error: 422")
        ) {
          setErrorStatus(
            "Some data could not be loaded due to API limitations. Showing partial data."
          );

          Alert.alert(
            "API Error",
            "The WaniKani API rejected some requests. This could be due to request limitations. Showing partial data.",
            [{ text: "OK" }]
          );
        } else if (
          error instanceof Error &&
          error.message.includes("API error: 401")
        ) {
          // Do not force logout immediately on a single 401.
          // This can happen transiently (resume/race/network edge cases).
          setErrorStatus("Authentication error. Please refresh and try again.");

          Alert.alert(
            "Authentication Error",
            "Could not verify your API token right now. Please pull to refresh. If this keeps happening, log out and log back in from Settings.",
            [{ text: "OK" }]
          );
        } else {
          // Generic error message
          setErrorStatus(
            "Failed to load complete data. Some information may be missing."
          );

          Alert.alert(
            "Error",
            "Failed to load complete dashboard data. Please check your internet connection.",
            [{ text: "OK" }]
          );
        }
      } finally {
        dashboardForegroundFetchInFlightRef.current = false;
        setIsLoading(false);
        setLoadingStage(LoadingStage.IDLE);

        if (shouldTrackStartupFetch) {
          startupDiagnostics.endOperation(startupFetchOperationId, {
            status: startupFetchError ? "error" : "ok",
            error: startupFetchError,
            details: {
              forceRefresh,
              usedCachedDashboard,
            },
          });
          startupDiagnostics.markDashboardFetchCompleted({
            status: startupFetchError ? "error" : "ok",
            error: startupFetchError,
            details: {
              forceRefresh,
              usedCachedDashboard,
            },
          });
        }
      }
    },
    [
      apiToken,
      loadPendingProgressAssignmentIds,
      processAssignments,
      reconcileReviewCountWithVisibleEndpoint,
      syncReviewNotificationState,
    ]
  );

  // Add a function to refresh just the lessons and reviews counts
  const refreshLessonsAndReviews = useCallback(async () => {
    if (!apiToken) return;

    if (
      dashboardForegroundFetchInFlightRef.current ||
      dashboardBackgroundRefreshInFlightRef.current
    ) {
      return;
    }

    if (lessonsReviewsRefreshInFlightRef.current) {
      await lessonsReviewsRefreshInFlightRef.current;
      return;
    }

    const refreshPromise = (async () => {
      let notificationReviewData: VisibleReviewData | null = null;
      let pendingProgressAssignmentIds: PendingProgressAssignmentIds =
        EMPTY_PENDING_PROGRESS_ASSIGNMENT_IDS;

      try {
        setIsLoading(true);
        setLoadingStage(LoadingStage.ASSIGNMENTS);

        // Use optimized assignments fetching with updated_after filter
        let assignments = await getAssignmentsOptimized(
          apiToken,
          {},
          { forceFullRefresh: false }
        );
        let serverCounts = getLessonAndReviewCountsFromAssignments(
          assignments.data
        );

        // If incremental sync returns an unexpectedly tiny lesson count, confirm
        // against summary and recover with a full refresh when needed.
        if (serverCounts.lessonCount <= 1) {
          try {
            const summary = await getSummary(apiToken, { forceRefresh: false });
            const summaryCounts = getLessonAndReviewCountsFromSummary(summary);

            if (summaryCounts.lessonCount > serverCounts.lessonCount) {
              const fullAssignments = await getAssignmentsOptimized(
                apiToken,
                {},
                { forceFullRefresh: true }
              );
              assignments = fullAssignments;
              serverCounts = getLessonAndReviewCountsFromAssignments(
                fullAssignments.data
              );
            }
          } catch (summaryReconciliationError) {
            console.warn(
              "[Dashboard] Failed lesson-count reconciliation during quick refresh:",
              summaryReconciliationError
            );
          }
        }

        ({ assignments, counts: serverCounts } =
          await reconcileReviewCountWithVisibleEndpoint(
            apiToken,
            assignments,
            serverCounts
          ));
        pendingProgressAssignmentIds = await loadPendingProgressAssignmentIds();
        const counts = getLessonAndReviewCountsFromAssignments(
          assignments.data,
          pendingProgressAssignmentIds
        );

        notificationReviewData = buildVisibleReviewDataFromAssignments(
          pendingProgressAssignmentIds.review.size > 0
            ? assignments.data.filter(
                (assignment) =>
                  !pendingProgressAssignmentIds.review.has(assignment.id)
              )
            : assignments.data
        );

        // Calculate updated counts
        const { lessonCount, reviewCount, nextLessonDate, nextReviewDate } =
          counts;
        const refreshedForecast = rebuildForecastFromAssignments(
          assignments.data,
          dashboardDataRef.current.subjects
        );

        // Update lightweight counts plus forecast so cumulative chart math stays aligned.
        setDashboardData((prevData) => ({
          ...prevData,
          lessonCount,
          reviewCount,
          nextLessonDate,
          nextReviewDate,
          pendingLessonSyncCount: pendingProgressAssignmentIds.lesson.size,
          pendingReviewSyncCount: pendingProgressAssignmentIds.review.size,
          assignments: assignments.data,
          forecast: refreshedForecast,
        }));

        // Keep cached dashboard snapshot in sync so pull-to-refresh doesn't
        // briefly rehydrate stale lesson/review counts from old cache entries.
        const updatedDashboardSnapshot: DashboardDataType = {
          ...dashboardDataRef.current,
          lessonCount,
          reviewCount,
          nextLessonDate,
          nextReviewDate,
          pendingLessonSyncCount: pendingProgressAssignmentIds.lesson.size,
          pendingReviewSyncCount: pendingProgressAssignmentIds.review.size,
          assignments: assignments.data,
          forecast: refreshedForecast,
        };
        dashboardDataRef.current = updatedDashboardSnapshot;

        try {
          await saveDashboardCache(updatedDashboardSnapshot);
          await saveAssignmentsToPermanentStorage(
            assignments.data,
            assignments.data_updated_at ?? new Date().toISOString()
          );
        } catch (cacheError) {
          console.warn(
            "Failed to persist lessons/reviews refresh snapshot:",
            cacheError
          );
        }
      } catch (error) {
        console.error("Error refreshing lessons and reviews:", error);

        // Try permanent storage fallback
        try {
          pendingProgressAssignmentIds = await loadPendingProgressAssignmentIds();
          const offlineData = await getFullDashboardDataFromPermanentStorage();
          if (offlineData && offlineData.assignments) {
            notificationReviewData = buildVisibleReviewDataFromAssignments(
              pendingProgressAssignmentIds.review.size > 0
                ? offlineData.assignments.filter(
                    (assignment: any) =>
                      !pendingProgressAssignmentIds.review.has(assignment.id)
                  )
                : offlineData.assignments
            );
            const { lessonCount, reviewCount, nextLessonDate, nextReviewDate } =
              getLessonAndReviewCountsFromAssignments(
                offlineData.assignments,
                pendingProgressAssignmentIds
              );
            const refreshedForecast = rebuildForecastFromAssignments(
              offlineData.assignments,
              offlineData.subjects ?? dashboardDataRef.current.subjects
            );

            setDashboardData((prevData) => ({
              ...prevData,
              lessonCount,
              reviewCount,
              nextLessonDate,
              nextReviewDate,
              pendingLessonSyncCount: pendingProgressAssignmentIds.lesson.size,
              pendingReviewSyncCount: pendingProgressAssignmentIds.review.size,
              assignments: offlineData.assignments,
              forecast: refreshedForecast,
            }));

            const offlineDashboardSnapshot: DashboardDataType = {
              ...dashboardDataRef.current,
              lessonCount,
              reviewCount,
              nextLessonDate,
              nextReviewDate,
              pendingLessonSyncCount: pendingProgressAssignmentIds.lesson.size,
              pendingReviewSyncCount: pendingProgressAssignmentIds.review.size,
              assignments: offlineData.assignments,
              forecast: refreshedForecast,
            };
            dashboardDataRef.current = offlineDashboardSnapshot;

            try {
              await saveDashboardCache(offlineDashboardSnapshot);
            } catch (offlineCacheError) {
              console.warn(
                "Failed to persist offline lessons/reviews snapshot:",
                offlineCacheError
              );
            }
          }
        } catch (offlineError) {
          console.error(
            "❌ Offline fallback for lessons/reviews failed:",
            offlineError
          );
        }
        // Don't show an alert for this quick refresh
      } finally {
        await syncReviewNotificationState(notificationReviewData);
        setIsLoading(false);
        setLoadingStage(LoadingStage.IDLE);
      }
    })();

    lessonsReviewsRefreshInFlightRef.current = refreshPromise;

    try {
      await refreshPromise;
    } finally {
      const pending = lessonsReviewsRefreshInFlightRef.current;
      if (pending === refreshPromise) {
        lessonsReviewsRefreshInFlightRef.current = null;
      }
    }
  }, [
    apiToken,
    loadPendingProgressAssignmentIds,
    rebuildForecastFromAssignments,
    reconcileReviewCountWithVisibleEndpoint,
    syncReviewNotificationState,
  ]);

  useEffect(() => {
    if (!apiToken) {
      pendingSyncLastTotalRef.current = 0;
      setDashboardData((prevData) => ({
        ...prevData,
        pendingLessonSyncCount: 0,
        pendingReviewSyncCount: 0,
      }));
      return;
    }

    let isActive = true;

    const refreshPendingSyncCounts = async () => {
      if (pendingSyncCountsRefreshInFlightRef.current) {
        return;
      }
      pendingSyncCountsRefreshInFlightRef.current = true;

      try {
        const pendingProgressAssignmentIds =
          await loadPendingProgressAssignmentIds();
        if (!isActive) {
          return;
        }

        const pendingLessonSyncCount = pendingProgressAssignmentIds.lesson.size;
        const pendingReviewSyncCount = pendingProgressAssignmentIds.review.size;
        const pendingTotal = pendingLessonSyncCount + pendingReviewSyncCount;
        const previousPendingTotal = pendingSyncLastTotalRef.current;
        const pendingQueueShrank = pendingTotal < previousPendingTotal;

        pendingSyncLastTotalRef.current = pendingTotal;

        setDashboardData((prevData) => ({
          ...prevData,
          pendingLessonSyncCount,
          pendingReviewSyncCount,
        }));

        if (
          pendingQueueShrank &&
          !pendingSyncTriggeredRefreshInFlightRef.current
        ) {
          pendingSyncTriggeredRefreshInFlightRef.current = true;
          try {
            await refreshLessonsAndReviews();
          } finally {
            pendingSyncTriggeredRefreshInFlightRef.current = false;
          }
        }
      } finally {
        pendingSyncCountsRefreshInFlightRef.current = false;
      }
    };

    void refreshPendingSyncCounts();
    const intervalId = setInterval(() => {
      void refreshPendingSyncCounts();
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [apiToken, loadPendingProgressAssignmentIds, refreshLessonsAndReviews]);

  // Lightweight refresh for the Recent Mistakes card (review statistics only).
  const refreshRecentMistakes = useCallback(async () => {
    if (!apiToken) return;

    if (
      dashboardForegroundFetchInFlightRef.current ||
      dashboardBackgroundRefreshInFlightRef.current
    ) {
      return;
    }

    if (recentMistakesRefreshInFlightRef.current) {
      await recentMistakesRefreshInFlightRef.current;
      return;
    }

    const refreshPromise = (async () => {
      try {
        const recentReviewStats = await getRecentReviewStatistics(apiToken);
        const subjectsById = (dashboardDataRef.current.subjects || []).reduce(
          (acc, subject) => {
            acc[subject.id] = subject;
            return acc;
          },
          {} as Record<number, any>
        );
        const recentMistakes = processRecentMistakes(
          recentReviewStats.data,
          subjectsById
        );

        setDashboardData((prevData) => ({
          ...prevData,
          recentMistakes,
        }));

        const updatedDashboardSnapshot: DashboardDataType = {
          ...dashboardDataRef.current,
          recentMistakes,
        };
        dashboardDataRef.current = updatedDashboardSnapshot;

        try {
          await saveDashboardCache(updatedDashboardSnapshot);
        } catch (cacheError) {
          console.warn(
            "Failed to persist recent mistakes refresh snapshot:",
            cacheError
          );
        }
      } catch (error) {
        console.error("Error refreshing recent mistakes:", error);
      }
    })();

    recentMistakesRefreshInFlightRef.current = refreshPromise;

    try {
      await refreshPromise;
    } finally {
      const pending = recentMistakesRefreshInFlightRef.current;
      if (pending === refreshPromise) {
        recentMistakesRefreshInFlightRef.current = null;
      }
    }
  }, [apiToken]);

  const refreshData = useCallback(async () => {
    // Clear in-memory cache before force refresh
    clearInMemoryCache();
    // Use incremental refresh to avoid re-downloading full collections every time.
    await fetchDashboardData(false);
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!startupDiagnostics.isActive()) {
      return;
    }

    startupDiagnostics.markDashboardStage(LoadingStage[loadingStage]);
  }, [loadingStage]);

  useEffect(() => {
    if (apiToken) {
      startupDiagnostics.markEvent("dashboard.fetch.effect.triggered", {
        hasApiToken: true,
      });
      fetchDashboardData();
    }
  }, [apiToken, fetchDashboardData]);

  // Reset dashboard state on logout/token clear to avoid showing stale data
  // from a previous account before the next login fetch completes.
  useEffect(() => {
    if (apiToken) {
      return;
    }

    startupDashboardFetchTrackedRef.current = false;
    dashboardForegroundFetchInFlightRef.current = false;
    dashboardBackgroundRefreshInFlightRef.current = false;
    pendingSyncCountsRefreshInFlightRef.current = false;
    pendingSyncLastTotalRef.current = 0;
    pendingSyncTriggeredRefreshInFlightRef.current = false;
    setDashboardData(initialDashboardData);
    setIsFreshData(false);
    setErrorStatus(null);
    setIsLoading(false);
    setLoadingStage(LoadingStage.IDLE);
  }, [apiToken]);

  // Initialize cached level on first load so we don't show a false level-up card.
  // The home screen compares lastWrappedLevel vs currentLevel to show the recap card.
  useEffect(() => {
    const currentLevel = dashboardData.currentLevel;
    if (lastWrappedLevel === null && currentLevel > 1 && isFreshData) {
      setLastWrappedLevel(currentLevel);
    }
  }, [dashboardData.currentLevel, isFreshData, lastWrappedLevel, setLastWrappedLevel]);

  return (
    <DashboardContext.Provider
      value={{
        dashboardData,
        isLoading,
        loadingProgress,
        refreshData,
        refreshLessonsAndReviews,
        refreshRecentMistakes,
        errorStatus,
        isFreshData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardData() {
  return useContext(DashboardContext);
}
