import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AddToSubjectListsModal from "../../../src/components/AddToSubjectListsModal";
import KanjiDetails from "../../../src/components/KanjiDetails";
import RadicalDetails from "../../../src/components/RadicalDetails";
import VocabularyDetails from "../../../src/components/VocabularyDetails";
import {
  createStudyMaterial,
  getAssignments,
  getReviewStatistics,
  getSpacedRepetitionSystems,
  getStudyMaterials,
  getSubject,
  getSubjects,
  updateStudyMaterial,
} from "../../../src/utils/api";
import {
  clearStudyMaterialsCache,
  getSubjectById,
} from "../../../src/utils/cache";
import { getNiaiSimilarKanjiSubjects } from "../../../src/utils/niaiSimilarKanji";
import { useAuthStore, useSettingsStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";

type ProgressionStatus = "loading" | "success" | "offline";
type DeferredTaskHandle = {
  cancel: () => void;
};
const PROGRESSION_REQUEST_TIMEOUT_MS = 9000;
const PROGRESSION_LOADING_FAILSAFE_MS = 14000;

function scheduleTaskAfterInteractions(
  task: () => void,
  fallbackDelayMs = 350
): DeferredTaskHandle {
  let completed = false;
  const fallbackTimeout = setTimeout(() => {
    if (completed) return;
    completed = true;
    task();
  }, fallbackDelayMs);

  const interactionTask = InteractionManager.runAfterInteractions(() => {
    if (completed) return;
    completed = true;
    clearTimeout(fallbackTimeout);
    task();
  });

  return {
    cancel: () => {
      if (completed) return;
      completed = true;
      clearTimeout(fallbackTimeout);
      interactionTask.cancel?.();
    },
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function getSettledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function mergeStudyMaterial(
  currentMaterial: any,
  savedMaterial: any,
  updates: Record<string, unknown>,
  subjectId: number
) {
  return {
    ...(currentMaterial || {}),
    ...(savedMaterial || {}),
    data: {
      ...(currentMaterial?.data || {}),
      ...(savedMaterial?.data || {}),
      subject_id: savedMaterial?.data?.subject_id || subjectId,
      ...updates,
    },
  };
}

export default function SubjectDetailsScreen() {
  const { id, initialTab, from } = useLocalSearchParams<{
    id: string;
    initialTab?: string;
    from?: string;
  }>();
  const { apiToken, userData } = useAuthStore();
  const { visuallySimilarKanjiSource } = useSettingsStore();
  const { theme } = useTheme();
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectData, setSubjectData] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [amalgamations, setAmalgamations] = useState<any[]>([]);
  const [studyMaterial, setStudyMaterial] = useState<any>(null);
  const [srsSystem, setSrsSystem] = useState<any>(null);
  const [componentSubjects, setComponentSubjects] = useState<any[]>([]);
  const [visuallySimilarSubjects, setVisuallySimilarSubjects] = useState<any[]>(
    []
  );
  const [reviewStatistics, setReviewStatistics] = useState<any>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [noteType, setNoteType] = useState<"meaning" | "reading">("meaning");
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [progressionStatus, setProgressionStatus] =
    useState<ProgressionStatus>("loading");
  const requestIdRef = useRef(0);
  const deferredTaskRef = useRef<DeferredTaskHandle | null>(null);

  // Helper to load related subjects from consolidated cache first for instant UI
  const loadSubjectsFromCache = async (ids: number[]) => {
    try {
      const results = await Promise.all(ids.map((sid) => getSubjectById(sid)));
      return results.filter(Boolean);
    } catch {
      return [];
    }
  };

  // Try to load from cache first for instant display
  useEffect(() => {
    if (!apiToken || !id) return;
    let cancelled = false;

    const loadFromCache = async () => {
      try {
        const parsedId = parseInt(id as string, 10);
        if (Number.isNaN(parsedId) || cancelled) {
          return;
        }

        const cachedSubject = await getSubjectById(parsedId);
        if (cancelled) {
          return;
        }

        if (cachedSubject) {
          setSubjectData(cachedSubject);
          setInitialLoading(false);
          // Still fetch fresh data in the background
          void fetchSubjectData(false);

          // Immediately try to load related subjects from cache if we have the main subject
          void loadRelatedSubjectsFromCache(cachedSubject);
        } else {
          // No cached data, do a regular fetch
          void fetchSubjectData(true);
        }
      } catch (error) {
        console.warn("Error loading from cache:", error);
        if (!cancelled) {
          void fetchSubjectData(true);
        }
      }
    };

    void loadFromCache();

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      deferredTaskRef.current?.cancel();
      deferredTaskRef.current = null;
    };
    // We intentionally trigger this effect only when subject identity/auth changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, apiToken]);

  const loadRelatedSubjectsFromCache = async (
    subject: any,
    expectedRequestId?: number
  ) => {
    const subjectType = subject.object;
    const shouldUpdate =
      expectedRequestId === undefined
        ? () => true
        : () => requestIdRef.current === expectedRequestId;

    // For radicals, fetch the kanji they appear in (amalgamations)
    if (
      subjectType === "radical" &&
      subject.data.amalgamation_subject_ids?.length > 0
    ) {
      const cachedAmalgamations = await loadSubjectsFromCache(
        subject.data.amalgamation_subject_ids
      );
      if (!shouldUpdate()) {
        return;
      }
      if (cachedAmalgamations.length > 0) {
        startTransition(() => {
          if (shouldUpdate()) {
            setAmalgamations(cachedAmalgamations as any[]);
          }
        });
      }
      return;
    }

    // For kanji...
    if (subjectType === "kanji") {
      const componentPromise = subject.data.component_subject_ids?.length
        ? loadSubjectsFromCache(subject.data.component_subject_ids)
        : Promise.resolve([]);
      const similarPromise =
        visuallySimilarKanjiSource === "niai"
          ? subject.data?.characters
            ? getNiaiSimilarKanjiSubjects(subject.data.characters)
            : Promise.resolve([])
          : subject.data.visually_similar_subject_ids?.length
            ? loadSubjectsFromCache(subject.data.visually_similar_subject_ids)
            : Promise.resolve([]);
      const amalgamationPromise = subject.data.amalgamation_subject_ids?.length
        ? loadSubjectsFromCache(subject.data.amalgamation_subject_ids)
        : Promise.resolve([]);

      const [cachedComponents, cachedSimilarSubjects, cachedAmalgamations] =
        await Promise.all([componentPromise, similarPromise, amalgamationPromise]);

      if (!shouldUpdate()) {
        return;
      }

      startTransition(() => {
        if (!shouldUpdate()) {
          return;
        }
        if (cachedComponents.length > 0) {
          setComponentSubjects(cachedComponents as any[]);
        }
        if (cachedSimilarSubjects.length > 0) {
          setVisuallySimilarSubjects(cachedSimilarSubjects as any[]);
        }
        if (cachedAmalgamations.length > 0) {
          setAmalgamations(cachedAmalgamations as any[]);
        }
      });
      return;
    }

    // For vocabulary...
    if (
      (subjectType === "vocabulary" || subjectType === "kana_vocabulary") &&
      subject.data.component_subject_ids?.length > 0
    ) {
      const cachedComponents = await loadSubjectsFromCache(
        subject.data.component_subject_ids
      );
      if (!shouldUpdate()) {
        return;
      }
      if (cachedComponents.length > 0) {
        startTransition(() => {
          if (shouldUpdate()) {
            setComponentSubjects(cachedComponents as any[]);
          }
        });
      }
    }
  };

  const fetchSubjectData = async (showLoading = true) => {
    if (!apiToken || !id) {
      setError("Missing API token or subject ID");
      setInitialLoading(false);
      return;
    }

    const parsedId = parseInt(id as string, 10);
    if (Number.isNaN(parsedId)) {
      setError("Invalid subject ID");
      setInitialLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    deferredTaskRef.current?.cancel();
    deferredTaskRef.current = null;
    const isCurrentRequest = () => requestId === requestIdRef.current;

    try {
      if (showLoading) {
        setInitialLoading(true);
      }
      setError(null);

      // Fetch the main subject data
      const subject = await getSubject(apiToken, parsedId);
      if (!isCurrentRequest()) {
        return;
      }

      const subjectType = subject.object;
      setSubjectData(subject);

      // Trigger immediate cache load for related items (in case initial useEffect didn't have subjectData yet)
      void loadRelatedSubjectsFromCache(subject, requestId);

      // --- Parallel Data Fetching for Progression & Related Items ---

      // 1. Progression Data (Assignments, Review Stats, Study Materials, SRS)
      // We wrap this in a promise to handle progression status independently
      const fetchProgressionData = async () => {
        if (!isCurrentRequest()) {
          return;
        }

        const progressionFailSafe = setTimeout(() => {
          if (isCurrentRequest()) {
            setProgressionStatus("offline");
          }
        }, PROGRESSION_LOADING_FAILSAFE_MS);

        try {
          setProgressionStatus("loading");

          // Resolve each request independently so one hang/failure doesn't trap
          // the whole progression section in "loading".
          const [assignmentResult, studyMaterialResult, reviewStatsResult] =
            await Promise.allSettled([
              withTimeout(
                getAssignments(apiToken, { subject_ids: [parsedId] }),
                PROGRESSION_REQUEST_TIMEOUT_MS,
                "assignments"
              ),
              withTimeout(
                getStudyMaterials(apiToken, {
                  subject_ids: [parsedId],
                }),
                PROGRESSION_REQUEST_TIMEOUT_MS,
                "study_materials"
              ),
              withTimeout(
                getReviewStatistics(apiToken, {
                  subject_ids: [parsedId],
                }),
                PROGRESSION_REQUEST_TIMEOUT_MS,
                "review_statistics"
              ),
            ]);

          if (!isCurrentRequest()) {
            return;
          }

          const assignments = getSettledValue(assignmentResult);
          const studyMaterials = getSettledValue(studyMaterialResult);
          const reviewStats = getSettledValue(reviewStatsResult);

          if (assignmentResult.status === "rejected") {
            console.warn("Assignments load failed:", assignmentResult.reason);
          }
          if (studyMaterialResult.status === "rejected") {
            console.warn("Study materials load failed:", studyMaterialResult.reason);
          }
          if (reviewStatsResult.status === "rejected") {
            console.warn("Review statistics load failed:", reviewStatsResult.reason);
          }

          const nextAssignmentData = assignments?.data?.[0] ?? null;
          const nextStudyMaterial = studyMaterials?.data?.[0] ?? null;
          const nextReviewStatistics = reviewStats?.data?.[0] ?? null;
          let nextSrsSystem = null;

          // Process Assignments & SRS
          if (nextAssignmentData) {
            const assignmentDataAny = nextAssignmentData.data as any;
            const srsId = assignmentDataAny.spaced_repetition_system_id;
            if (srsId) {
              try {
                const srsData = await withTimeout(
                  getSpacedRepetitionSystems(apiToken, {
                    ids: [srsId],
                  }),
                  PROGRESSION_REQUEST_TIMEOUT_MS,
                  "spaced_repetition_systems"
                );
                if (!isCurrentRequest()) {
                  return;
                }
                if (srsData?.data?.length > 0) {
                  nextSrsSystem = srsData.data[0];
                }
              } catch (srsError) {
                console.warn("SRS system load failed:", srsError);
              }
            }
          }

          if (!isCurrentRequest()) {
            return;
          }

          const hasAnyProgressData = Boolean(
            nextAssignmentData || nextStudyMaterial || nextReviewStatistics
          );

          startTransition(() => {
            if (!isCurrentRequest()) {
              return;
            }
            setAssignmentData(nextAssignmentData);
            setStudyMaterial(nextStudyMaterial);
            setReviewStatistics(nextReviewStatistics);
            setSrsSystem(nextSrsSystem);
            setProgressionStatus(hasAnyProgressData ? "success" : "offline");
          });
        } catch (err) {
          if (!isCurrentRequest()) {
            return;
          }

          console.warn("Error fetching progression data:", err);
          // If we fail specifically here (network?), we can set offline status
          if (
            err instanceof Error &&
            (err.message.includes("Network") || err.message.includes("offline"))
          ) {
            setProgressionStatus("offline");
          } else {
            // Default to offline/error state for progression if we can't get it
            setProgressionStatus("offline");
          }
        } finally {
          clearTimeout(progressionFailSafe);
        }
      };

      // 2. Related Subjects Revalidation (Background)
      const fetchRelatedSubjects = async () => {
        if (!isCurrentRequest()) {
          return;
        }

        try {
          // Radical Amalgamations
          if (
            subjectType === "radical" &&
            subject.data.amalgamation_subject_ids?.length > 0
          ) {
            const radicalAmalgamations = await getSubjects(
              apiToken,
              { ids: subject.data.amalgamation_subject_ids },
              { skipCollectionCache: true }
            );
            if (!isCurrentRequest()) {
              return;
            }
            if (radicalAmalgamations.data.length > 0) {
              startTransition(() => {
                if (isCurrentRequest()) {
                  setAmalgamations(radicalAmalgamations.data);
                }
              });
            }
            return;
          }

          // Kanji Components, Similar, Amalgamations
          if (subjectType === "kanji") {
            const componentPromise = subject.data.component_subject_ids?.length
              ? getSubjects(
                  apiToken,
                  { ids: subject.data.component_subject_ids },
                  { skipCollectionCache: true }
                )
                  .then((res) => res.data)
                  .catch((e) => {
                    console.warn("Error revalidating kanji components:", e);
                    return [];
                  })
              : Promise.resolve([]);

            const similarPromise =
              visuallySimilarKanjiSource === "niai"
                ? subject.data?.characters
                  ? getNiaiSimilarKanjiSubjects(subject.data.characters).catch((e) => {
                      console.warn("Error loading Niai similar kanji:", e);
                      return [];
                    })
                  : Promise.resolve([])
                : subject.data.visually_similar_subject_ids?.length
                  ? getSubjects(
                      apiToken,
                      { ids: subject.data.visually_similar_subject_ids },
                      { skipCollectionCache: true }
                    )
                      .then((res) => res.data)
                      .catch((e) => {
                        console.warn("Error revalidating similar subjects:", e);
                        return [];
                      })
                  : Promise.resolve([]);

            const amalgamationPromise = subject.data.amalgamation_subject_ids?.length
              ? getSubjects(
                  apiToken,
                  { ids: subject.data.amalgamation_subject_ids },
                  { skipCollectionCache: true }
                )
                  .then((res) => res.data)
                  .catch((e) => {
                    console.warn("Error revalidating kanji amalgamations:", e);
                    return [];
                  })
              : Promise.resolve([]);

            const [
              refreshedComponents,
              refreshedSimilarSubjects,
              refreshedAmalgamations,
            ] = await Promise.all([
              componentPromise,
              similarPromise,
              amalgamationPromise,
            ]);

            if (!isCurrentRequest()) {
              return;
            }

            startTransition(() => {
              if (!isCurrentRequest()) {
                return;
              }
              if (refreshedComponents.length > 0) {
                setComponentSubjects(refreshedComponents);
              }
              if (refreshedSimilarSubjects.length > 0) {
                setVisuallySimilarSubjects(refreshedSimilarSubjects);
              }
              if (refreshedAmalgamations.length > 0) {
                setAmalgamations(refreshedAmalgamations);
              }
            });
            return;
          }

          // Vocabulary Components
          if (
            (subjectType === "vocabulary" || subjectType === "kana_vocabulary") &&
            subject.data.component_subject_ids?.length > 0
          ) {
            const vocabComponents = await getSubjects(
              apiToken,
              { ids: subject.data.component_subject_ids },
              { skipCollectionCache: true }
            );
            if (!isCurrentRequest()) {
              return;
            }
            if (vocabComponents.data.length > 0) {
              startTransition(() => {
                if (isCurrentRequest()) {
                  setComponentSubjects(vocabComponents.data);
                }
              });
            }
          }
        } catch (revalidationError) {
          console.warn("Error revalidating related subjects:", revalidationError);
        }
      };

      // Execute fetches
      deferredTaskRef.current = scheduleTaskAfterInteractions(() => {
        if (!isCurrentRequest()) {
          return;
        }
        void fetchProgressionData();
        void fetchRelatedSubjects();
      });

      setInitialLoading(false);
    } catch (error) {
      if (!isCurrentRequest()) {
        return;
      }

      console.error("Error fetching subject data:", error);
      // Only set error if we don't have cached data
      // If showLoading is false, we're doing background revalidation, so don't show error
      if (showLoading && !subjectData) {
        setError("Failed to load subject data. Please try again.");
      }
      setInitialLoading(false);
    }
  };

  const handleSubjectPress = useCallback(
    (subjectId: number) => {
      // Navigate to the subject details screen, propagating the 'from' parameter if it exists
      if (from) {
        router.push({
          pathname: "/subject/[id]",
          params: { id: subjectId.toString(), from: from as string },
        });
      } else {
        router.push({
          pathname: "/subject/[id]",
          params: { id: subjectId.toString() },
        });
      }
    },
    [router, from]
  );

  const handleSaveNote = async () => {
    if (!apiToken || !id || !subjectData) return;

    const subjectId = parseInt(id as string, 10);
    if (Number.isNaN(subjectId)) return;

    setIsSavingNote(true);
    try {
      // Prepare updates for the note
      const updates: any = {};
      if (noteType === "meaning") {
        updates.meaning_note = noteText;
      } else {
        updates.reading_note = noteText;
      }

      let savedMaterial: any;

      if (studyMaterial && studyMaterial.id) {
        // Update existing study material
        savedMaterial = await updateStudyMaterial(
          apiToken,
          studyMaterial.id,
          updates
        );
      } else {
        // Create new study material or handle case where we think there's no material but API says otherwise
        try {
          savedMaterial = await createStudyMaterial(apiToken, {
            subject_id: subjectId,
            ...updates,
          });
        } catch (createError: any) {
          // If we get a 422 error, it might mean the study material already exists
          // Try to fetch study materials again and then update
          if (createError.message?.includes("422")) {
            const studyMaterials = await getStudyMaterials(
              apiToken,
              {
                subject_ids: [subjectId],
              },
              { skipCache: true }
            );

            if (studyMaterials.data.length > 0) {
              const existingMaterial = studyMaterials.data[0];
              savedMaterial = await updateStudyMaterial(
                apiToken,
                existingMaterial.id,
                updates
              );
            } else {
              throw createError; // Re-throw if we still can't find the material
            }
          } else {
            throw createError; // Re-throw non-422 errors
          }
        }
      }

      await clearStudyMaterialsCache(subjectId);
      setStudyMaterial((currentMaterial: any) =>
        mergeStudyMaterial(currentMaterial, savedMaterial, updates, subjectId)
      );

      setShowNoteModal(false);
    } catch (error) {
      Alert.alert(
        "Error",
        `Failed to save note: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleEditNote = (type: "meaning" | "reading") => {
    setNoteType(type);
    // Set initial value based on existing notes
    if (studyMaterial && studyMaterial.data) {
      if (type === "meaning") {
        setNoteText(studyMaterial.data.meaning_note || "");
      } else {
        setNoteText(studyMaterial.data.reading_note || "");
      }
    } else {
      setNoteText("");
    }
    setShowNoteModal(true);
  };

  const handleSynonymsChange = async (synonyms: string[]) => {
    if (!apiToken || !id || !subjectData) return;

    const subjectId = parseInt(id as string, 10);
    if (Number.isNaN(subjectId)) return;

    try {
      const updates = {
        meaning_synonyms: synonyms,
      };

      let savedMaterial: any;

      if (studyMaterial && studyMaterial.id) {
        // Update existing study material
        savedMaterial = await updateStudyMaterial(
          apiToken,
          studyMaterial.id,
          updates
        );
      } else {
        // Create new study material
        try {
          savedMaterial = await createStudyMaterial(apiToken, {
            subject_id: subjectId,
            ...updates,
          });
        } catch (createError: any) {
          // If we get a 422 error, study material might already exist
          if (createError.message?.includes("422")) {
            const studyMaterials = await getStudyMaterials(
              apiToken,
              {
                subject_ids: [subjectId],
              },
              { skipCache: true }
            );

            if (studyMaterials.data.length > 0) {
              const existingMaterial = studyMaterials.data[0];
              savedMaterial = await updateStudyMaterial(
                apiToken,
                existingMaterial.id,
                updates
              );
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }

      // Update local state with the saved material
      // Note: We don't call fetchSubjectData here because it would immediately
      // fetch study materials from the API, which might return stale data due to
      // eventual consistency, overwriting the freshly saved synonyms.
      await clearStudyMaterialsCache(subjectId);
      setStudyMaterial((currentMaterial: any) =>
        mergeStudyMaterial(currentMaterial, savedMaterial, updates, subjectId)
      );
    } catch (error) {
      console.error("❌ Error saving synonyms:", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
      Alert.alert(
        "Error",
        `Failed to save synonyms: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error; // Re-throw so the modal knows it failed
    }
  };

  // Only show loading screen if we don't have cached data yet
  if (initialLoading && !subjectData) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundColor },
        ]}
      >
        <ActivityIndicator size="large" color={theme.secondary} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>
          Loading subject details...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: theme.backgroundColor },
        ]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      </View>
    );
  }

  if (!subjectData) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: theme.backgroundColor },
        ]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>
          No subject data found.
        </Text>
      </View>
    );
  }

  // Prepare data for the radical details component
  const prepareRadicalData = () => {
    const meanings = subjectData.data.meanings;
    const userSynonyms = studyMaterial?.data?.meaning_synonyms || [];
    const assignmentSrsStage = assignmentData?.data?.srs_stage;
    const nextReviewAt = assignmentData?.data?.available_at;

    // Get review statistics
    const meaningCorrect = reviewStatistics?.data?.meaning_correct || 0;
    const meaningIncorrect = reviewStatistics?.data?.meaning_incorrect || 0;
    const meaningCurrentStreak =
      reviewStatistics?.data?.meaning_current_streak || 0;
    const meaningMaxStreak = reviewStatistics?.data?.meaning_max_streak || 0;

    return {
      id: subjectData.id,
      object: subjectData.object,
      level: subjectData.data.level,
      characters: subjectData.data.characters,
      meanings: meanings,
      mnemonic: subjectData.data.meaning_mnemonic,
      characterImages: subjectData.data.character_images || [],
      imageUrl: subjectData.data.character_images?.[0]?.url,
      documentUrl: subjectData.data.document_url || null,
      amalgamationSubjects: amalgamations.map((subject) => ({
        id: subject.id,
        characters: subject.data.characters,
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        level: subject.data.level,
      })),
      userSynonyms,
      srsStage: assignmentSrsStage || 0,
      srsSystem: srsSystem?.data,
      currentStreak: meaningCurrentStreak,
      longestStreak: meaningMaxStreak,
      meaningNote: studyMaterial?.data?.meaning_note || "",
      meaningCorrect,
      meaningIncorrect,
      percentageCorrect: reviewStatistics?.data?.percentage_correct || 100,
      nextReviewAt,
      onEditNote: () => handleEditNote("meaning"),
    };
  };

  // Prepare data for the kanji details component
  const prepareKanjiData = () => {
    const meanings = subjectData.data.meanings;
    const readings = subjectData.data.readings || [];
    const userSynonyms = studyMaterial?.data?.meaning_synonyms || [];
    const assignmentSrsStage = assignmentData?.data?.srs_stage;
    const nextReviewAt = assignmentData?.data?.available_at;

    // Get review statistics
    const meaningCorrect = reviewStatistics?.data?.meaning_correct || 0;
    const meaningIncorrect = reviewStatistics?.data?.meaning_incorrect || 0;
    const readingCorrect = reviewStatistics?.data?.reading_correct || 0;
    const readingIncorrect = reviewStatistics?.data?.reading_incorrect || 0;
    const meaningCurrentStreak =
      reviewStatistics?.data?.meaning_current_streak || 0;
    const meaningMaxStreak = reviewStatistics?.data?.meaning_max_streak || 0;
    const readingCurrentStreak =
      reviewStatistics?.data?.reading_current_streak || 0;
    const readingMaxStreak = reviewStatistics?.data?.reading_max_streak || 0;

    return {
      id: subjectData.id,
      object: subjectData.object,
      level: subjectData.data.level,
      characters: subjectData.data.characters,
      meanings: meanings,
      readings: readings,
      meaningMnemonic: subjectData.data.meaning_mnemonic,
      readingMnemonic: subjectData.data.reading_mnemonic,
      meaningHint: subjectData.data.meaning_hint,
      readingHint: subjectData.data.reading_hint,
      componentSubjects: componentSubjects.map((subject) => ({
        id: subject.id,
        characters: subject.data.characters || null,
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        characterImages: subject.data.character_images || [],
        imageUrl: subject.data.character_images?.[0]?.url || null,
        level: subject.data.level,
      })),
      visuallySimilarSubjects: visuallySimilarSubjects.map((subject) => ({
        id: subject.id,
        characters: subject.data.characters,
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        level: subject.data.level,
      })),
      amalgamationSubjects: amalgamations.map((subject) => ({
        id: subject.id,
        characters: subject.data.characters,
        meanings: subject.data.meanings.map((m: any) => m.meaning),
        level: subject.data.level,
      })),
      userSynonyms,
      srsStage: assignmentSrsStage || 0,
      srsSystem: srsSystem?.data,
      currentStreak: meaningCurrentStreak,
      longestStreak: meaningMaxStreak,
      meaningNote: studyMaterial?.data?.meaning_note || "",
      readingNote: studyMaterial?.data?.reading_note || "",
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      meaningCurrentStreak,
      meaningMaxStreak,
      readingCurrentStreak,
      readingMaxStreak,
      percentageCorrect: reviewStatistics?.data?.percentage_correct || 100,
      nextReviewAt,
      onEditNote: handleEditNote,
    };
  };

  // Prepare data for the vocabulary details component
  const prepareVocabularyData = () => {
    const meanings = subjectData.data.meanings;
    const readings = subjectData.data.readings || [];
    const userSynonyms = studyMaterial?.data?.meaning_synonyms || [];
    const assignmentSrsStage = assignmentData?.data?.srs_stage;
    const nextReviewAt = assignmentData?.data?.available_at;

    // Get review statistics
    const meaningCorrect = reviewStatistics?.data?.meaning_correct || 0;
    const meaningIncorrect = reviewStatistics?.data?.meaning_incorrect || 0;
    const readingCorrect = reviewStatistics?.data?.reading_correct || 0;
    const readingIncorrect = reviewStatistics?.data?.reading_incorrect || 0;
    const meaningCurrentStreak =
      reviewStatistics?.data?.meaning_current_streak || 0;
    const meaningMaxStreak = reviewStatistics?.data?.meaning_max_streak || 0;
    const readingCurrentStreak =
      reviewStatistics?.data?.reading_current_streak || 0;
    const readingMaxStreak = reviewStatistics?.data?.reading_max_streak || 0;

    return {
      id: subjectData.id,
      object: subjectData.object,
      level: subjectData.data.level,
      characters: subjectData.data.characters,
      meanings: meanings,
      readings: readings,
      partsOfSpeech: subjectData.data.parts_of_speech || [],
      meaningMnemonic: subjectData.data.meaning_mnemonic,
      readingMnemonic: subjectData.data.reading_mnemonic,
      meaningHint: subjectData.data.meaning_hint,
      readingHint: subjectData.data.reading_hint,
      componentSubjects: subjectData.data.component_subject_ids
        ? componentSubjects.map((subject) => ({
            id: subject.id,
            characters: subject.data.characters,
            meanings: subject.data.meanings.map((m: any) => m.meaning),
            level: subject.data.level,
          }))
        : [],
      contextSentences: (subjectData.data.context_sentences || []).map(
        (sentence: any) => ({
          ja: sentence.ja || sentence.japanese,
          en: sentence.en || sentence.english,
        })
      ),
      audioFiles: subjectData.data.pronunciation_audios || [],
      userSynonyms,
      srsStage: assignmentSrsStage || 0,
      srsSystem: srsSystem?.data,
      currentStreak: meaningCurrentStreak,
      longestStreak: meaningMaxStreak,
      meaningNote: studyMaterial?.data?.meaning_note || "",
      readingNote: studyMaterial?.data?.reading_note || "",
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      meaningCurrentStreak,
      meaningMaxStreak,
      readingCurrentStreak,
      readingMaxStreak,
      percentageCorrect: reviewStatistics?.data?.percentage_correct || 100,
      nextReviewAt,
      onEditNote: handleEditNote,
    };
  };

  // Render the appropriate component based on subject type
  const subjectLabel =
    subjectData?.data?.meanings?.find((m: any) => m.primary)?.meaning ||
    subjectData?.data?.meanings?.[0]?.meaning ||
    subjectData?.data?.characters ||
    undefined;

  switch (subjectData.object) {
    case "radical":
      return (
        <>
          <RadicalDetails
            radical={prepareRadicalData()}
            progressionStatus={progressionStatus}
            onSubjectPress={handleSubjectPress}
            userLevel={userData?.level}
            onSynonymsChange={handleSynonymsChange}
            onAddToList={() => setShowAddToListModal(true)}
            onOpenConstellation={() =>
              router.push({
                pathname: "/constellation",
                params: {
                  id: subjectData.id,
                  rootId: subjectData.id,
                  constellationDepth: "1",
                },
              })
            }
          />

          <Modal
            visible={showNoteModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowNoteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                  {noteType === "meaning" ? "Meaning Note" : "Reading Note"}
                </Text>

                <TextInput
                  style={[
                    styles.noteInput,
                    {
                      borderColor: theme.border,
                      color: theme.textColor,
                      backgroundColor: theme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "white",
                    },
                  ]}
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={`Add your ${noteType} note here...`}
                  placeholderTextColor={theme.textLight}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowNoteModal(false)}
                    disabled={isSavingNote}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={handleSaveNote}
                    disabled={isSavingNote}
                  >
                    {isSavingNote ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[styles.modalButtonText, { color: "white" }]}
                      >
                        Save
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <AddToSubjectListsModal
            visible={showAddToListModal}
            subjectId={subjectData.id}
            subjectType={subjectData.object}
            subjectLabel={subjectLabel}
            onClose={() => setShowAddToListModal(false)}
          />
        </>
      );
    case "kanji":
      return (
        <>
          <KanjiDetails
            kanji={prepareKanjiData()}
            progressionStatus={progressionStatus}
            onSubjectPress={handleSubjectPress}
            userLevel={userData?.level}
            initialTab={initialTab as "meaning" | "reading" | undefined}
            onSynonymsChange={handleSynonymsChange}
            onAddToList={() => setShowAddToListModal(true)}
            onOpenConstellation={() =>
              router.push({
                pathname: "/constellation",
                params: {
                  id: subjectData.id,
                  rootId: subjectData.id,
                  constellationDepth: "1",
                },
              })
            }
          />

          <Modal
            visible={showNoteModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowNoteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                  {noteType === "meaning" ? "Meaning Note" : "Reading Note"}
                </Text>

                <TextInput
                  style={[
                    styles.noteInput,
                    {
                      borderColor: theme.border,
                      color: theme.textColor,
                      backgroundColor: theme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "white",
                    },
                  ]}
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={`Add your ${noteType} note here...`}
                  placeholderTextColor={theme.textLight}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowNoteModal(false)}
                    disabled={isSavingNote}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={handleSaveNote}
                    disabled={isSavingNote}
                  >
                    {isSavingNote ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[styles.modalButtonText, { color: "white" }]}
                      >
                        Save
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <AddToSubjectListsModal
            visible={showAddToListModal}
            subjectId={subjectData.id}
            subjectType={subjectData.object}
            subjectLabel={subjectLabel}
            onClose={() => setShowAddToListModal(false)}
          />
        </>
      );
    case "vocabulary":
    case "kana_vocabulary":
      return (
        <>
          <VocabularyDetails
            vocabulary={prepareVocabularyData()}
            progressionStatus={progressionStatus}
            onSubjectPress={handleSubjectPress}
            userLevel={userData?.level}
            initialTab={initialTab as "meaning" | "reading" | "context" | undefined}
            onSynonymsChange={handleSynonymsChange}
            onAddToList={() => setShowAddToListModal(true)}
            onOpenConstellation={() =>
              router.push({
                pathname: "/constellation",
                params: {
                  id: subjectData.id,
                  rootId: subjectData.id,
                  constellationDepth: "1",
                },
              })
            }
          />

          <Modal
            visible={showNoteModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowNoteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                  {noteType === "meaning" ? "Meaning Note" : "Reading Note"}
                </Text>

                <TextInput
                  style={[
                    styles.noteInput,
                    {
                      borderColor: theme.border,
                      color: theme.textColor,
                      backgroundColor: theme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "white",
                    },
                  ]}
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={`Add your ${noteType} note here...`}
                  placeholderTextColor={theme.textLight}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowNoteModal(false)}
                    disabled={isSavingNote}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={handleSaveNote}
                    disabled={isSavingNote}
                  >
                    {isSavingNote ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[styles.modalButtonText, { color: "white" }]}
                      >
                        Save
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <AddToSubjectListsModal
            visible={showAddToListModal}
            subjectId={subjectData.id}
            subjectType={subjectData.object}
            subjectLabel={subjectLabel}
            onClose={() => setShowAddToListModal(false)}
          />
        </>
      );
    default:
      return (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.error }]}>
            Unknown subject type: {subjectData.object}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  notImplementedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notImplementedText: {
    fontSize: 18,
  },
  refreshingIndicator: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 4,
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 450,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: "transparent",
    minWidth: 80,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
