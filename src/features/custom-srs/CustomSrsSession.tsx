import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, BackHandler, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LessonDetailScreen from "../../components/LessonDetailScreen";
import ReviewQuestionScreen from "../../components/ReviewQuestionScreen";
import { useActivityTracking } from "../../hooks/useActivityTracking";
import { fontStyles } from "../../utils/fonts";
import { useSettingsStore } from "../../utils/store";
import { useSubjectColors } from "../../utils/subjectColors";
import { useTheme } from "../../utils/theme";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { prefetchCustomVocabularyAudio } from "./audio-cache";
import { CustomSrsConflictError } from "./client";
import { customLessonWords, customReviewWords, useCustomSrs } from "./data";
import { answerCustomSessionQuestion, confirmCustomSessionWord, createCustomSessionQuiz, customLessonBatch, customLessonBatchSize, customNextReviewLabel, customSessionStats, customSrsStageName, type CustomSessionQuiz } from "./session";
import { customSubjectIdToWord, customWordToSubject, customWordUsesKanji } from "./subject";
import { goBackFromCustomVocabulary } from "./navigation";
import type { CustomSrsAssignment, CustomSrsState, CustomVocabularyWord } from "./types";

type Phase = "loading" | "teaching" | "quiz" | "results";
interface PendingSave {
  wordId: string;
  eventId: string;
  quiz: CustomSessionQuiz;
  incorrectAnswers: number;
}

/** Custom progress is committed only through our own cloud service, never WK queues. */
export default function CustomSrsSession({ mode, packId }: { mode: "lessons" | "reviews"; packId?: string }) {
  const { theme } = useTheme();
  const colors = useSubjectColors();
  const insets = useSafeAreaInsets();
  const cloud = useCustomSrs();
  const { refresh, completeLesson, submitReview } = cloud;
  const configuredBatchSize = useSettingsStore((state) => state.lessonBatchSize);
  const meaningFirst = useSettingsStore((state) => state.meaningFirst);
  const ordered = useSettingsStore((state) => state.reviewQuestionOrderEnabled);
  const backToBack = useSettingsStore((state) => state.backToBackQuestions);
  const showContextHints = useSettingsStore((state) => state.showVocabContextSentencesInReviews);
  const offlineAudioEnabled = useSettingsStore((state) => state.offlineVocabularyAudioEnabled);
  const batchSize = customLessonBatchSize(configuredBatchSize);
  const packs = useMemo(() => packId ? CUSTOM_VOCABULARY_PACKS.filter((pack) => pack.id === packId) : CUSTOM_VOCABULARY_PACKS, [packId]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [batch, setBatch] = useState<CustomVocabularyWord[]>([]);
  const [teachingIndex, setTeachingIndex] = useState(0);
  const [batchNumber, setBatchNumber] = useState(1);
  const [batchTotal, setBatchTotal] = useState(1);
  const [quiz, setQuiz] = useState<CustomSessionQuiz | null>(null);
  const [remainingLessons, setRemainingLessons] = useState(0);
  const [remainingReviews, setRemainingReviews] = useState(0);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const [nextBatchError, setNextBatchError] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [toast, setToast] = useState<{ characters: string; assignment: CustomSrsAssignment } | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const quizRef = useRef<CustomSessionQuiz | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);
  const savingRef = useRef(false);
  const studyDurationRef = useRef(0);
  const activeSinceRef = useRef<number | null>(null);
  const completedWordIdsRef = useRef(new Set<string>());

  useActivityTracking(mode === "lessons" ? "lessons" : "reviews", { enabled: phase === "teaching" || phase === "quiz" });

  useEffect(() => {
    const studying = phase === "teaching" || phase === "quiz";
    const recordActiveTime = (active: boolean) => {
      const now = Date.now();
      if (activeSinceRef.current !== null) studyDurationRef.current += now - activeSinceRef.current;
      activeSinceRef.current = active && studying ? now : null;
    };
    recordActiveTime(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (state) => recordActiveTime(state === "active"));
    return () => { recordActiveTime(false); listener.remove(); };
  }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const goBack = useCallback(() => goBackFromCustomVocabulary(), []);
  const openWord = useCallback((wordId: string) => {
    router.push({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId } });
  }, []);

  const exitSession = useCallback(() => {
    if (savingRef.current) return;
    if (phase === "results" || phase === "loading") {
      goBack();
      return;
    }
    Alert.alert(
      mode === "lessons" ? "Exit lessons?" : "Exit reviews?",
      pendingSaveRef.current
        ? "The last word has not been confirmed saved. Retry before leaving to make sure it counts. Earlier completed words are already synced."
        : "Completed words are already synced. Unfinished words will remain available for your next session.",
      [{ text: "Keep studying", style: "cancel" }, { text: "Exit", style: "destructive", onPress: goBack }],
    );
  }, [mode, goBack, phase]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      exitSession();
      return true;
    });
    return () => subscription.remove();
  }, [exitSession]);

  const updateQuiz = useCallback((next: CustomSessionQuiz) => {
    quizRef.current = next;
    setQuiz(next);
  }, []);

  const updateRemaining = useCallback((state: CustomSrsState) => {
    setRemainingLessons(customLessonWords(state, packs).filter((word) => !completedWordIdsRef.current.has(word.id)).length);
    setRemainingReviews(customReviewWords(state, packs).filter((word) => !completedWordIdsRef.current.has(word.id)).length);
  }, [packs]);

  const startBatch = useCallback((words: CustomVocabularyWord[], lessonCount: number, number: number) => {
    const nextBatch = mode === "lessons" ? customLessonBatch(words, batchSize) : words;
    setBatch(nextBatch);
    setTeachingIndex(0);
    setBatchNumber(number);
    setBatchTotal(number - 1 + Math.max(1, Math.ceil(lessonCount / batchSize)));
    setNextBatchError(null);
    setToast(null);
    setElapsedMinutes(0);
    studyDurationRef.current = 0;
    activeSinceRef.current = AppState.currentState === "active" ? Date.now() : null;
    updateQuiz(createCustomSessionQuiz(nextBatch, { meaningFirst, ordered, backToBack }));
    setPhase(nextBatch.length ? (mode === "lessons" ? "teaching" : "quiz") : "results");
  }, [backToBack, batchSize, meaningFirst, mode, ordered, updateQuiz]);

  const initializeSession = useCallback(async () => {
    setLoadError(null);
    try {
      // A dashboard may already have cached data. Revalidate it before fixing the queue.
      const state = await refresh();
      if (!mountedRef.current) return;
      const lessonWords = customLessonWords(state, packs);
      const words = mode === "lessons" ? lessonWords : customReviewWords(state, packs);
      updateRemaining(state);
      startBatch(words, lessonWords.length, 1);
    } catch (error) {
      if (mountedRef.current) setLoadError(error instanceof Error ? error.message : "Could not load your progress.");
    }
  }, [refresh, mode, packs, startBatch, updateRemaining]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!saving) {
      setShowSavingIndicator(false);
      return;
    }
    const timer = setTimeout(() => setShowSavingIndicator(true), 400);
    return () => clearTimeout(timer);
  }, [saving]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveCompletedWord = useCallback(async (pending: PendingSave) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaveConflict(false);
    try {
      const state = mode === "lessons"
        ? await completeLesson(pending.wordId, pending.eventId)
        : await submitReview(pending.wordId, pending.incorrectAnswers, pending.eventId);
      if (!mountedRef.current) return;
      const confirmedQuiz = confirmCustomSessionWord(pending.quiz, pending.wordId);
      completedWordIdsRef.current.add(pending.wordId);
      pendingSaveRef.current = null;
      setPendingSave(null);
      updateRemaining(state);
      updateQuiz(confirmedQuiz);
      const completedItem = confirmedQuiz.items.find((item) => item.word.id === pending.wordId);
      const assignment = state.assignments[pending.wordId];
      if (completedItem && assignment) setToast({ characters: completedItem.word.characters, assignment });
      if (!confirmedQuiz.questions.length) {
        const activeTime = activeSinceRef.current === null ? 0 : Date.now() - activeSinceRef.current;
        setElapsedMinutes(Math.max(1, Math.round((studyDurationRef.current + activeTime) / 60_000)));
        setPhase("results");
      }
    } catch (error) {
      if (mountedRef.current) {
        setSaveConflict(error instanceof CustomSrsConflictError);
        setSaveError(error instanceof CustomSrsConflictError
          ? "This word was updated elsewhere. Reload the remaining items to use the latest schedule. The batch summary will restart; earlier completed words stay saved."
          : error instanceof Error ? error.message : "Could not save your progress. Please try again.");
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [completeLesson, submitReview, mode, updateQuiz, updateRemaining]);

  const reloadAfterConflict = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const state = await refresh();
      if (!mountedRef.current) return;
      const lessons = customLessonWords(state, packs).filter((word) => !completedWordIdsRef.current.has(word.id));
      const words = mode === "lessons" ? lessons : customReviewWords(state, packs).filter((word) => !completedWordIdsRef.current.has(word.id));
      pendingSaveRef.current = null;
      setPendingSave(null);
      setSaveError(null);
      setSaveConflict(false);
      updateRemaining(state);
      startBatch(words, lessons.length, batchNumber);
    } catch (error) {
      if (mountedRef.current) setSaveError(`Could not load the latest progress. ${error instanceof Error ? error.message : "Check your connection and try again."}`);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [batchNumber, refresh, mode, packs, startBatch, updateRemaining]);

  const question = quiz?.questions[0];
  const currentItem = quiz?.items.find((item) => item.word.id === question?.wordId);
  const currentSubject = useMemo(() => currentItem ? customWordToSubject(currentItem.word) : null, [currentItem]);
  const currentReviewSubject = useMemo(() => currentItem && currentSubject ? {
    ...currentSubject,
    object: customWordUsesKanji(currentItem.word) ? "vocabulary" as const : "kana_vocabulary" as const,
    data: {
      ...currentSubject.data,
      readings: currentSubject.data.readings ?? undefined,
      character_images: currentSubject.data.character_images ?? undefined,
      pronunciation_audios: currentSubject.data.pronunciation_audios ?? undefined,
      auxiliary_meanings: currentSubject.data.auxiliary_meanings ?? undefined,
      component_subject_ids: currentSubject.data.component_subject_ids ?? undefined,
      amalgamation_subject_ids: currentSubject.data.amalgamation_subject_ids ?? undefined,
      visually_similar_subject_ids: currentSubject.data.visually_similar_subject_ids ?? undefined,
    },
  } : null, [currentItem, currentSubject]);
  const teachingItems = useMemo(() => batch.map((word) => {
    const subject = customWordToSubject(word);
    return { id: subject.id, subject };
  }), [batch]);
  const audioWindow = useMemo(() => phase === "teaching"
    ? batch.map((word) => word.id)
    : phase === "quiz" ? [...new Set(quiz?.questions.map((entry) => entry.wordId) ?? [])].slice(0, 5) : [], [batch, phase, quiz?.questions]);

  useEffect(() => {
    const controller = new AbortController();
    void prefetchCustomVocabularyAudio(audioWindow, {
      enabled: Boolean(offlineAudioEnabled),
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [audioWindow, offlineAudioEnabled]);

  const handleAnswer = useCallback((answeredItem: { id: number }, type: "meaning" | "reading", isCorrect: boolean) => {
    // Native `wasIncorrect` also includes harmless wrong-script/reading warnings.
    // Only an actual incorrect emission is an SRS miss, not a successful retry.
    const currentQuiz = quizRef.current;
    if (!currentQuiz || !question || !currentSubject || pendingSaveRef.current || answeredItem.id !== currentSubject.id || type !== question.type) return;
    const answered = answerCustomSessionQuestion(currentQuiz, question, quiz?.occurrence ?? -1, isCorrect);
    if (answered.quiz === currentQuiz) return;
    if (!answered.completedWordId) {
      updateQuiz(answered.quiz);
      return;
    }
    const item = answered.quiz.items.find((entry) => entry.word.id === answered.completedWordId)!;
    const pending: PendingSave = {
      wordId: answered.completedWordId,
      eventId: randomUUID(),
      quiz: answered.quiz,
      incorrectAnswers: Math.min(100, item.meaningIncorrect + item.readingIncorrect),
    };
    pendingSaveRef.current = pending;
    setPendingSave(pending);
    void saveCompletedWord(pending);
  }, [currentSubject, question, quiz?.occurrence, saveCompletedWord, updateQuiz]);

  const nextBatch = useCallback(async () => {
    if (loadingNext) return;
    setLoadingNext(true);
    setNextBatchError(null);
    try {
      const state = await refresh();
      if (!mountedRef.current) return;
      const words = customLessonWords(state, packs).filter((word) => !completedWordIdsRef.current.has(word.id));
      updateRemaining(state);
      startBatch(words, words.length, batchNumber + 1);
    } catch (error) {
      if (mountedRef.current) setNextBatchError(error instanceof Error ? error.message : "Could not load your next lessons.");
    } finally {
      if (mountedRef.current) setLoadingNext(false);
    }
  }, [batchNumber, refresh, loadingNext, packs, startBatch, updateRemaining]);

  const stats = quiz ? customSessionStats(quiz) : { completed: 0, accuracy: 100, incorrect: 0 };
  const isEmpty = batch.length === 0;
  const lessonTitle = remainingLessons > 0 ? "Batch complete" : "Lessons complete";

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle={phase === "teaching" || phase === "quiz" ? "light-content" : theme.isDark ? "light-content" : "dark-content"} />
      {phase === "loading" ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.centerContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          {loadError ? <>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.textSecondary} />
            <Text selectable style={[styles.title, { color: theme.textColor }]}>Could not sync your progress</Text>
            <Text selectable style={[styles.description, { color: theme.textSecondary }]}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void initializeSession(); }} style={[styles.primaryButton, { backgroundColor: colors.vocabulary }]}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </> : <>
            <ActivityIndicator size="large" color={colors.vocabulary} />
            <Text style={[styles.description, { color: theme.textSecondary }]}>Loading your {mode}…</Text>
          </>}
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.textButton}><Text style={[styles.textButtonText, { color: theme.textSecondary }]}>Back</Text></Pressable>
        </ScrollView>
      ) : null}

      {phase === "teaching" && teachingItems[teachingIndex] ? (
        <LessonDetailScreen
          item={teachingItems[teachingIndex]}
          onNext={() => teachingIndex + 1 < teachingItems.length ? setTeachingIndex(teachingIndex + 1) : setPhase("quiz")}
          onPrev={() => setTeachingIndex((index) => Math.max(0, index - 1))}
          canGoBack={teachingIndex > 0}
          canGoForward
          progress={{ current: teachingIndex + 1, total: teachingItems.length, batchCurrent: batchNumber, batchTotal }}
          onExit={exitSession}
          batchItems={teachingItems}
          currentBatchIndex={teachingIndex}
          onBatchItemPress={setTeachingIndex}
          typeCounts={{ radical: 0, kanji: 0, vocabulary: teachingItems.length }}
          onSubjectPress={(subjectId) => {
            const word = customSubjectIdToWord(subjectId);
            if (word) openWord(word.id);
            else if (subjectId > 0) router.push({ pathname: "/subject/[id]", params: { id: String(subjectId) } });
          }}
        />
      ) : null}

      {phase === "quiz" && question && currentItem && currentReviewSubject ? (
        <ReviewQuestionScreen
          item={{ id: currentReviewSubject.id, subject: currentReviewSubject, srsStage: cloud.state.assignments[currentItem.word.id]?.stage }}
          questionType={question.type}
          onAnswer={handleAnswer}
          onExit={exitSession}
          onViewSubjectDetails={(subjectId) => {
            const word = customSubjectIdToWord(subjectId);
            if (word) openWord(word.id);
          }}
          showHeader
          showBackgroundColor
          isLessonFlow={mode === "lessons"}
          forceDisableAnkiGrouping
          totalItems={quiz?.items.length ?? 0}
          currentItem={quiz?.answeredCount ?? 0}
          correctAnswersCount={quiz?.correctAnswersCount ?? 0}
          completedCount={stats.completed}
          contextSentencesHint={showContextHints ? currentItem.word.contextSentences : undefined}
          contextHintMaxItems={3}
          contextHintDisplayMode="toggle"
          contextHintTranslationMode="toggle"
        />
      ) : null}

      {phase === "results" ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.resultsContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.closeButton}>
            <Ionicons name="close" size={26} color={theme.textColor} />
          </Pressable>
          <View style={styles.resultHeading}>
            <Ionicons name={isEmpty ? "checkmark-circle-outline" : "checkmark-circle"} size={42} color={colors.vocabulary} />
            <Text selectable style={[styles.title, { color: theme.textColor }]}>{isEmpty ? mode === "lessons" ? "No lessons available" : "All caught up" : mode === "lessons" ? lessonTitle : "Reviews complete"}</Text>
            <Text selectable style={[styles.description, { color: theme.textSecondary }]}>{isEmpty ? mode === "lessons" ? "Explore a pack to add more vocabulary to your lessons." : "Your next reviews will appear here when they’re due." : mode === "lessons" ? `${stats.completed} ${stats.completed === 1 ? "word is" : "words are"} now ready for spaced repetition.` : "Your review progress is synced across mobile and web."}</Text>
          </View>
          {!isEmpty ? <>
            <View style={[styles.stats, { borderColor: theme.border }]}>
              {[{ label: mode === "lessons" ? "Learned" : "Reviewed", value: String(stats.completed) }, { label: "Accuracy", value: `${stats.accuracy}%` }, { label: "Mistakes", value: String(stats.incorrect) }, { label: "Minutes", value: String(elapsedMinutes) }].map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text selectable style={[styles.statValue, { color: theme.textColor }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.words}>
              {quiz?.items.filter((item) => item.saved).map((item) => <Pressable key={item.word.id} accessibilityRole="button" accessibilityLabel={`View ${item.word.characters}`} onPress={() => openWord(item.word.id)} style={[styles.word, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <Text style={[styles.wordCharacters, fontStyles.japaneseBold, { color: colors.vocabulary }]}>{item.word.characters}</Text>
                <Text numberOfLines={2} style={[styles.wordMeaning, { color: theme.textSecondary }]}>{item.word.meanings[0]}</Text>
                {item.meaningIncorrect + item.readingIncorrect > 0 ? <Text style={[styles.mistakes, { color: theme.textSecondary }]}>{item.meaningIncorrect + item.readingIncorrect} {item.meaningIncorrect + item.readingIncorrect === 1 ? "miss" : "misses"}</Text> : null}
              </Pressable>)}
            </View>
          </> : null}
          <View style={styles.actions}>
            {nextBatchError ? <Text selectable accessibilityRole="alert" style={[styles.description, { color: theme.error }]}>{nextBatchError}</Text> : null}
            {mode === "lessons" && remainingLessons > 0 ? <>
              <Text selectable style={[styles.description, { color: theme.textSecondary }]}>{remainingLessons} {remainingLessons === 1 ? "lesson" : "lessons"} remaining{packId ? " in this pack" : ""}</Text>
              <Pressable testID="custom-srs-next-batch" accessibilityRole="button" disabled={loadingNext} onPress={() => { void nextBatch(); }} style={[styles.primaryButton, { backgroundColor: colors.vocabulary, opacity: loadingNext ? 0.6 : 1 }]}>
                {loadingNext ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Next {Math.min(batchSize, remainingLessons)} {Math.min(batchSize, remainingLessons) === 1 ? "lesson" : "lessons"}</Text>}
              </Pressable>
            </> : null}
            {mode === "lessons" && remainingReviews > 0 ? <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: "/custom-vocabulary/reviews", params: packId ? { packId } : {} })} style={[styles.secondaryButton, { borderColor: theme.border }]}><Text style={[styles.textButtonText, { color: theme.textColor }]}>Review {remainingReviews} due {remainingReviews === 1 ? "word" : "words"}</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={goBack} style={remainingLessons > 0 && mode === "lessons" ? styles.textButton : [styles.primaryButton, { backgroundColor: colors.vocabulary }]}>
              <Text style={remainingLessons > 0 && mode === "lessons" ? [styles.textButtonText, { color: theme.textSecondary }] : styles.primaryButtonText}>Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {toast ? <View testID="custom-srs-progression-popup" accessibilityLiveRegion="polite" style={[styles.toast, { top: insets.top + 72, backgroundColor: theme.cardBackground, borderColor: colors.vocabulary }]}>
        <Ionicons name="checkmark-circle-outline" size={24} color={colors.vocabulary} />
        <View style={styles.toastText}>
          <Text style={[styles.toastTitle, { color: theme.textColor }]}>{toast.characters} · {customSrsStageName(toast.assignment.stage)}</Text>
          <Text style={[styles.toastDetail, { color: theme.textSecondary }]}>{customNextReviewLabel(toast.assignment.availableAt, toast.assignment.stage)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss SRS update" onPress={() => setToast(null)} style={styles.dismissButton}><Ionicons name="close" size={20} color={theme.textSecondary} /></Pressable>
      </View> : null}

      {saving ? <View style={styles.savingBlocker} pointerEvents="auto">
        {showSavingIndicator ? <View accessibilityLiveRegion="polite" style={[styles.savingIndicator, { top: insets.top + 72, backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <ActivityIndicator color={colors.vocabulary} />
          <Text style={{ color: theme.textColor }}>Saving progress…</Text>
        </View> : null}
      </View> : null}

      <Modal transparent visible={Boolean(pendingSave) && Boolean(saveError) && !saving} animationType="fade" onRequestClose={exitSession}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={[styles.saveDialog, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.error} />
            <Text selectable style={[styles.dialogTitle, { color: theme.textColor }]}>{saveConflict ? "Progress changed on another device" : "Progress not confirmed saved"}</Text>
            <Text selectable style={[styles.description, { color: theme.textSecondary }]}>{saveError || "Check your connection, then try again. Your answer is kept here."}</Text>
            {!saving && pendingSave ? <>
              {saveConflict ? <Pressable testID="custom-srs-reload-progress" accessibilityRole="button" onPress={() => { void reloadAfterConflict(); }} style={[styles.primaryButton, { backgroundColor: colors.vocabulary }]}><Text style={styles.primaryButtonText}>Reload remaining {mode}</Text></Pressable>
                : <Pressable testID="custom-srs-retry-save" accessibilityRole="button" onPress={() => { void saveCompletedWord(pendingSave); }} style={[styles.primaryButton, { backgroundColor: colors.vocabulary }]}><Text style={styles.primaryButtonText}>Retry save</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={exitSession} style={styles.textButton}><Text style={[styles.textButtonText, { color: theme.textSecondary }]}>Exit session</Text></Pressable>
            </> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 24 },
  resultsContent: { flexGrow: 1, paddingHorizontal: 24, gap: 28, maxWidth: 760, width: "100%", alignSelf: "center" },
  closeButton: { alignSelf: "flex-end", minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  resultHeading: { alignItems: "center", gap: 12 },
  title: { fontSize: 27, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 20, rowGap: 20 },
  stat: { flexGrow: 1, flexBasis: "25%", minWidth: 68, alignItems: "center", gap: 6 },
  statValue: { fontSize: 25, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13 },
  words: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  word: { flexGrow: 1, flexBasis: "44%", padding: 16, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  wordCharacters: { fontSize: 25 },
  wordMeaning: { fontSize: 14 },
  mistakes: { fontSize: 12 },
  actions: { gap: 12, paddingTop: 4 },
  primaryButton: { minHeight: 50, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
  secondaryButton: { minHeight: 50, borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  textButton: { minHeight: 44, padding: 12, alignItems: "center", justifyContent: "center" },
  textButtonText: { fontSize: 16, fontWeight: "600" },
  toast: { position: "absolute", alignSelf: "center", width: "92%", maxWidth: 460, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingVertical: 8, paddingRight: 4, borderWidth: 1, borderRadius: 10, zIndex: 20 },
  toastText: { flex: 1, gap: 3 },
  toastTitle: { fontWeight: "600", fontSize: 15 },
  toastDetail: { fontSize: 13 },
  dismissButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  savingBlocker: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  savingIndicator: { position: "absolute", alignSelf: "center", paddingHorizontal: 16, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", padding: 24, justifyContent: "center", alignItems: "center" },
  saveDialog: { width: "100%", maxWidth: 400, borderRadius: 12, padding: 24, gap: 16, alignItems: "stretch" },
  dialogTitle: { fontWeight: "700", fontSize: 20, textAlign: "center" },
});
