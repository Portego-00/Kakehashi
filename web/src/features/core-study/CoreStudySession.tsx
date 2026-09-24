"use client";

import { useReviewAnswerFocus } from "@/features/study/use-review-answer-focus";
import { studyShortcutAction, shortcutLabel, DEFAULT_STUDY_SHORTCUTS } from "@/features/settings/study-shortcuts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Bookmark, Check, ChevronDown, ChevronUp, ExternalLink, Mic, Plus, RotateCcw, Search, SkipForward, Umbrella, Volume2, X } from "lucide-react";
import Link from "next/link";
import { ReviewSettingsButton } from "@/features/study/components/ReviewSettingsButton";
import { advanceReviewRetrySchedule, createReviewRetrySchedule, insertReviewRetry, orderReviewRetries, retainWrapUpReviews } from "@/features/study/review-queue";
import { useReviewOrdering } from "./use-review-ordering";
import { reorderPendingCoreQuestions } from "./reorder-pending";
import { FormEvent, type MouseEvent, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ReviewLoading } from "./ReviewLoading";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { composeKanaInput, finalizeKanaInput } from "@/lib/kana";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import { SubjectDetailPanels, type SubjectDetailTab } from "@/features/subjects/components/SubjectDetail";
import { AddToSubjectListsDialog } from "@/features/subjects/components/AddToSubjectListsDialog";
import { useSubjectLists } from "@/features/subjects/use-subject-lists";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { useSession } from "@/lib/session";
import { WaniKaniApiError, wkCollection, wkRequest } from "@/lib/wanikani/client";
import { userQuery, wkKeys } from "@/lib/wanikani/queries";
import type { Assignment, ReviewStatistic, StudyMaterial, Subject } from "@/types/wanikani";
import quiz from "@/features/study/study.module.css";
import { AnkiAnswerContent } from "./AnkiAnswerContent";
import { LESSON_SESSION_MAX_AGE, loadPickedLessons, pickedLessonBatch, savePickedLessons } from "./picked-lessons";
import { LessonBatchComplete } from "./LessonBatchComplete";
import { LessonLoading } from "./LessonLoading";
import { LessonPicker } from "./LessonPicker";
import { LessonTeaching } from "./LessonTeaching";
import { wanikaniSessionResults } from "@/features/mixed-reviews/session-results";
import { ReviewAccuracy, coreAccuracy } from "@/features/study/components/ReviewAccuracy";
import { CoreStudyResults } from "./CoreStudyResults";
import type { ReviewResultItem } from "./review-results";
import { SrsProgressionSlot, type SrsProgression } from "./SrsProgressionSlot";
import { BunproProgression } from "@/features/bunpro/BunproProgression";
import { VocabularyFrequencyBadge } from "./VocabularyFrequencyBadge";
import { checkAnswer, type AnswerResult, type QuestionKind } from "./answer-checker";
import { createQuestionQueue, kindsForSubject, lessonAssignments, moveCoreQuestionPairToEnd, reviewAssignments, type CoreQuestion } from "./queue";
import { predictedReviewStage } from "./review-sync";
import { loadReviewOutbox } from "./review-outbox";
import { useReviewSync } from "./use-review-sync";
import { coreSessionKey, lessonsStartedToday, recordLessonStarted, selectCoreAssignments } from "./session-planning";
import { speechRecognitionConstructor, type BrowserSpeechRecognition } from "./speech-recognition";
import { canonicalAnswer, questionOrderForMode, shouldPauseAfterResult, usesSelfAssessment } from "./study-preferences";
import { canRevealStudyDetails, vacationDateLabel, vacationStartedAt, vacationStudyMessage, WANIKANI_VACATION_SETTINGS_URL } from "./vacation";
import { usePhoneStudyInput } from "./use-phone-study-input";
import { useMobileReviewViewport } from "./use-mobile-review-viewport";
import styles from "./core-study.module.css";
import { reviewSubjectFont } from "./review-subject-font";
import { useReviewFontReady } from "./use-review-font-ready";
import { pickPreferredPronunciationAudios } from "../../../../src/utils/pronunciationAudio";

import { ReviewExitGuard } from "./ReviewExitGuard";
import { ReviewDetailsReveal, REVIEW_DETAILS_DURATION_MS } from "@/features/study/components/ReviewDetailsReveal";

import { MixedPreviousBadge } from "@/features/mixed-reviews/MixedPreviousBadge";
import { wkHead, type MixedBridge } from "@/features/mixed-reviews/ordering";

type Mode = "lessons" | "reviews";
type Phase = "loading" | "resume" | "teaching" | "quiz" | "results";
type ErrorCounts = Record<number, { meaning: number; reading: number }>;
type PreviousAnswerItem = { subject: Subject; kind: QuestionKind; isCorrect: boolean };
type LessonTeachingSnapshot = { savedAt?: string; subjectIds: number[]; index: number; tab: SubjectDetailTab };
type SessionSnapshot = {
  savedAt?: string;
  startedAt?: string;
  questionIds: string[];
  completed: Record<number, QuestionKind[]>;
  errors: ErrorCounts;
  submittedIds: number[];
};

const EMPTY_SUBJECTS: Subject[] = [];
const noopSubscribe = () => () => {};
const singleKanji = /^[\u3400-\u4DBF\u4E00-\u9FFF]$/;
const reviewShortcutInteractiveSelector = "input, textarea, select, button, a, audio, video, [contenteditable]:not([contenteditable=\"false\"])";
const reviewAdvanceNativeEnterSelector = "input, textarea, select, a, audio, video, [contenteditable]:not([contenteditable=\"false\"])";
const coreStudyIdsPerRequest = 500;
const lessonTeachingTabs = new Set<SubjectDetailTab>(["meaning", "reading", "stroke", "context"]);

function lessonTeachingSessionKey(username: string) {
  return `kakehashi:core-study:${username}:lesson-teaching`;
}

function clearLessonTeachingSession(storage: Storage, username: string) {
  try { storage.removeItem(lessonTeachingSessionKey(username)); } catch { /* Storage may be unavailable. */ }
}

function loadLessonTeachingSession(storage: Storage, username: string) {
  try {
    const raw = storage.getItem(lessonTeachingSessionKey(username));
    const parsed = raw ? JSON.parse(raw) as Partial<LessonTeachingSnapshot> : null;
    const subjectIds = parsed?.subjectIds;
    const age = parsed?.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : Infinity;
    const validIds = Array.isArray(subjectIds)
      && subjectIds.length > 0
      && subjectIds.every((id) => Number.isInteger(id) && id > 0)
      && new Set(subjectIds).size === subjectIds.length;
    if (!validIds || !Number.isInteger(parsed?.index) || parsed!.index! < 0 || parsed!.index! >= subjectIds.length || !lessonTeachingTabs.has(parsed?.tab as SubjectDetailTab) || !Number.isFinite(age) || age < 0 || age > LESSON_SESSION_MAX_AGE) {
      if (raw) clearLessonTeachingSession(storage, username);
      return null;
    }
    return parsed as LessonTeachingSnapshot;
  } catch {
    clearLessonTeachingSession(storage, username);
    return null;
  }
}

export async function fetchCoreStudyCollectionByIds<T>(resource: "assignments" | "subjects" | "study_materials", parameter: "ids" | "subject_ids", ids: readonly number[]) {
  if (!ids.length) return [];
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += coreStudyIdsPerRequest) chunks.push(ids.slice(index, index + coreStudyIdsPerRequest));
  return (await Promise.all(chunks.map((chunk) => wkCollection<T>(`${resource}?${parameter}=${chunk.join(",")}`)))).flat();
}

function formatNextReviewInterval(availableAt: string | null | undefined, stage: number) {
  if (stage >= 9) return "Burned";
  const fallbackHours: Record<number, number> = { 1: 4, 2: 8, 3: 23, 4: 47, 5: 167, 6: 335, 7: 719, 8: 2879 };
  const difference = availableAt ? new Date(availableAt).getTime() - Date.now() : (fallbackHours[stage] || 4) * 60 * 60_000;
  if (!Number.isFinite(difference) || difference <= 5 * 60_000) return "Now";
  const hours = difference / (60 * 60_000);
  if (hours < 1) return `${Math.ceil(difference / 60_000)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  if (hours < 168) { const days = Math.round(hours / 24); return `${days} ${days === 1 ? "day" : "days"}`; }
  if (hours < 720) { const weeks = Math.round(hours / 168); return `${weeks} ${weeks === 1 ? "week" : "weeks"}`; }
  const months = Math.round(hours / 720);
  return `${months} ${months === 1 ? "month" : "months"}`;
}

function shouldIgnoreReviewShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return true;
  return event.target instanceof Element && Boolean(event.target.closest(reviewShortcutInteractiveSelector));
}

function shouldIgnoreReviewAdvance(event: KeyboardEvent) {
  if (event.defaultPrevented) return true;
  return event.target instanceof Element && Boolean(event.target.closest(reviewAdvanceNativeEnterSelector));
}

function subjectColor(subject: Subject) {
  return subject.object === "radical" ? "var(--color-radical)" : subject.object === "kanji" ? "var(--color-kanji)" : "var(--color-vocabulary)";
}

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.meanings[0]?.meaning || subject.data.slug;
}

function preferredAudiosFor(subject: Subject, voice: WebStudyPreferences["vocabularyAudioVoice"] = "female") {
  return pickPreferredPronunciationAudios(subject.data.pronunciation_audios, subject.data.readings, voice, { preferredContentType: "audio/mpeg" });
}

function audioFor(subject: Subject, voice: WebStudyPreferences["vocabularyAudioVoice"] = "female") {
  return preferredAudiosFor(subject, voice)[0];
}

function formatFailure(cause: unknown, fallback: string) {
  if (cause instanceof WaniKaniApiError && cause.status === 429) {
    const seconds = cause.retryAfterMs ? Math.max(1, Math.ceil(cause.retryAfterMs / 1_000)) : 60;
    return `WaniKani’s rate limit is active. Try again in about ${seconds} seconds; your place is saved.`;
  }
  return cause instanceof Error ? `${cause.message} ${fallback}` : fallback;
}

export function CoreStudySession({ mode, pickLessons = false, mixed }: { mode: Mode; pickLessons?: boolean; mixed?: MixedBridge }) {
  const [pickedLessonIds, setPickedLessonIds] = useState<number[] | null>(null);
  const [pickingLessons, setPickingLessons] = useState(pickLessons && mode === "lessons");
  const queryClient = useQueryClient();
  const { user } = useSession();
  const currentUserQuery = useQuery(userQuery());
  // A failed background refresh retains the last confirmed Vacation Mode status.
  const hasConfirmedUser = currentUserQuery.data !== undefined;
  const availabilityCheckFailed = currentUserQuery.isError && !hasConfirmedUser;
  const liveUser = currentUserQuery.data ?? user;
  const currentVacationStartedAt = vacationStartedAt(liveUser);
  const isOnVacation = Boolean(currentVacationStartedAt);
  const username = liveUser?.data.username || user?.data.username || "anonymous";
  const webSettings = useWebSettings(username);
  const subjectLists = useSubjectLists(username);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const preferences = webSettings.study;
  const phoneInput = usePhoneStudyInput();
  const [phase, setPhase] = useState<Phase>("loading");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonTab, setLessonTab] = useState<SubjectDetailTab>("meaning");
  const [lessonTeachingSnapshot, setLessonTeachingSnapshot] = useState<LessonTeachingSnapshot | null>(null);
  const [lessonBatchIds, setLessonBatchIds] = useState<number[] | null>(mode === "reviews" ? [] : null);
  const [lessonBatchStorageReady, setLessonBatchStorageReady] = useState(mode === "reviews");
  const [reviewSettingsOpen, setReviewSettingsOpen] = useState(false);
  const [reviewSessionAssignments, setReviewSessionAssignments] = useState<Assignment[] | null>(null);
  const [questions, setQuestions] = useState<CoreQuestion[]>([]);
  useReviewOrdering(preferences, (next) => setQuestions((pending) => reorderPendingCoreQuestions(pending, next, mode, liveUser?.data.level)));
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [completed, setCompleted] = useState<Record<number, QuestionKind[]>>({});
  const [errors, setErrors] = useState<ErrorCounts>({});
  const [startedLessonIds, setStartedLessonIds] = useState<number[]>([]);
  const [submittedIds, setSubmittedIds] = useState<number[]>([]);
  const [resultItems, setResultItems] = useState<ReviewResultItem[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [resumeSnapshot, setResumeSnapshot] = useState<SessionSnapshot | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const [wrapUpActive, setWrapUpActive] = useState(false);
  const [lessonStartsToday, setLessonStartsToday] = useState(0);
  const [displayNow, setDisplayNow] = useState(() => Date.now());
  const [ankiRevealed, setAnkiRevealed] = useState(false);
  const [answeredKinds, setAnsweredKinds] = useState<QuestionKind[]>([]);
  const [contextTranslationOpen, setContextTranslationOpen] = useState(false);
  const [studyDetailsOverride, setStudyDetailsOverride] = useState<{ questionId: string; open: boolean } | null>(null);
  const [studyDetailsExpanded, setStudyDetailsExpanded] = useState(false);
  const [advancingQuestion, setAdvancingQuestion] = useState(false);
  const [srsProgression, setSrsProgression] = useState<SrsProgression | null>(null);
  const [previousAnswerItem, setPreviousAnswerItem] = useState<PreviousAnswerItem | null>(null);
  const [reserveResultsProgressionSlot, setReserveResultsProgressionSlot] = useState(false);
  const [replayingAudio, setReplayingAudio] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useReviewAnswerFocus(inputRef, mixed?.active !== false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const advancingQuestionRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const initializedSessionKeyRef = useRef("");
  const voiceAvailable = useSyncExternalStore(noopSubscribe, () => Boolean(speechRecognitionConstructor()), () => false);

  useEffect(() => { void installCustomJitaiFonts(preferences.jitaiCustomFonts).catch(() => undefined); }, [preferences.jitaiCustomFonts]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const progressionSubjectId = srsProgression?.subjectId;
  useEffect(() => {
    if (progressionSubjectId === undefined) return;
    const timer = window.setTimeout(() => setSrsProgression(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [progressionSubjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLessonStartsToday(lessonsStartedToday(window.localStorage, username));
      setStartedLessonIds(loadReviewOutbox(window.localStorage, username, "lesson").filter((entry) => entry.operation === "lesson").map((entry) => entry.assignmentId));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (mode !== "lessons") return;
    const timer = window.setTimeout(() => {
      let snapshot = pickLessons ? null : loadLessonTeachingSession(window.localStorage, username);
      let picked = pickLessons ? null : loadPickedLessons(window.localStorage, username);
      const startedToday = lessonsStartedToday(window.localStorage, username);
      const remaining = preferences.dailyLessonLimit > 0 ? Math.max(0, preferences.dailyLessonLimit - startedToday) : Infinity;
      const limit = Math.min(preferences.lessonsBatchSize, remaining);
      if (snapshot && snapshot.subjectIds.length > limit) {
        picked = [...new Set([...snapshot.subjectIds, ...(picked ?? [])])];
        savePickedLessons(window.localStorage, username, picked);
        const ids = snapshot.subjectIds.slice(0, limit);
        snapshot = ids.length ? { ...snapshot, subjectIds: ids, index: snapshot.index < ids.length ? snapshot.index : 0 } : null;
        if (snapshot) {
          try { window.localStorage.setItem(lessonTeachingSessionKey(username), JSON.stringify(snapshot)); } catch { /* Continue in memory. */ }
        } else clearLessonTeachingSession(window.localStorage, username);
      }
      setLessonTeachingSnapshot(snapshot);
      setPickedLessonIds(picked);
      setLessonBatchIds(snapshot?.subjectIds ?? null);
      setLessonBatchStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, username, pickLessons, preferences.lessonsBatchSize, preferences.dailyLessonLimit]);

  const assignmentQuery = useQuery({
    queryKey: ["core-study", mode, "assignments"],
    queryFn: () => wkCollection<Assignment>(mode === "reviews" ? "assignments?immediately_available_for_review=true" : "assignments?immediately_available_for_lessons=true"),
    enabled: hasConfirmedUser && !isOnVacation,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const available = useMemo(() => mode === "reviews" ? reviewAssignments(assignmentQuery.data || []) : lessonAssignments(assignmentQuery.data || []), [assignmentQuery.data, mode]);
  const candidateAssignments = useMemo(() => mode === "lessons" ? available.filter((assignment) => !startedLessonIds.includes(assignment.id)) : available, [available, mode, startedLessonIds]);
  const candidateIds = useMemo(() => candidateAssignments.map((assignment) => assignment.data.subject_id), [candidateAssignments]);
  const restoredAssignmentsQuery = useQuery({
    queryKey: ["core-study", "lessons", "restored-assignments", lessonBatchIds?.join(",") ?? ""],
    queryFn: () => fetchCoreStudyCollectionByIds<Assignment>("assignments", "subject_ids", lessonBatchIds ?? []),
    enabled: mode === "lessons" && lessonBatchStorageReady && Boolean(lessonTeachingSnapshot && lessonBatchIds?.length) && !isOnVacation,
    staleTime: 30_000,
  });
  const subjectRequestIds = useMemo(() => Array.from(new Set([...(mode === "lessons" ? lessonBatchIds ?? [] : []), ...candidateIds])), [candidateIds, lessonBatchIds, mode]);
  const subjectsQuery = useQuery({
    queryKey: ["core-study", mode, "subjects", subjectRequestIds.join(",")],
    queryFn: () => fetchCoreStudyCollectionByIds<Subject>("subjects", "ids", subjectRequestIds),
    enabled: assignmentQuery.isSuccess && !isOnVacation,
    staleTime: 24 * 60 * 60_000,
  });
  const subjects = subjectsQuery.data || EMPTY_SUBJECTS;
  const dailyRemaining = preferences.dailyLessonLimit > 0 ? Math.max(0, preferences.dailyLessonLimit - lessonStartsToday) : Number.POSITIVE_INFINITY;
  const assignmentLimit = mode === "lessons" ? Math.min(preferences.lessonsBatchSize, dailyRemaining) : preferences.reviewBatchSize;
  const plannedAssignments = useMemo(
    () => {
      if (mode === "lessons" && pickedLessonIds) {
        const bySubject = new Map(candidateAssignments.map((assignment) => [assignment.data.subject_id, assignment]));
        return pickedLessonBatch(pickedLessonIds, candidateIds, preferences.lessonsBatchSize, dailyRemaining).map((id) => bySubject.get(id)!);
      }
      return selectCoreAssignments(candidateAssignments, subjects, mode, preferences, assignmentLimit, { userLevel: liveUser?.data.level ?? 1 });
    },
    [assignmentLimit, candidateAssignments, candidateIds, dailyRemaining, pickedLessonIds, liveUser?.data.level, mode, preferences, subjects],
  );
  const lessonAssignmentBySubjectId = useMemo(() => new Map(
    [...available, ...(restoredAssignmentsQuery.data ?? [])].map((assignment) => [assignment.data.subject_id, assignment]),
  ), [available, restoredAssignmentsQuery.data]);
  const restoredLessonAssignments = useMemo(() => lessonBatchIds?.map((subjectId) => lessonAssignmentBySubjectId.get(subjectId)).filter((assignment): assignment is Assignment => Boolean(assignment)) ?? [], [lessonAssignmentBySubjectId, lessonBatchIds]);
  const lessonBatchResolved = mode !== "lessons" || Boolean(
    lessonBatchStorageReady
    && lessonBatchIds !== null
    && (lessonBatchIds.length === 0 || restoredLessonAssignments.length === lessonBatchIds.length),
  );

  useEffect(() => {
    if (pickingLessons || mode !== "lessons" || !lessonBatchStorageReady || !assignmentQuery.isSuccess || !subjectsQuery.isSuccess) return;
    if (lessonBatchIds !== null && (lessonBatchIds.length === 0 || restoredLessonAssignments.length === lessonBatchIds.length)) return;
    if (lessonBatchIds?.length && (restoredAssignmentsQuery.isLoading || restoredAssignmentsQuery.isError)) return;
    const timer = window.setTimeout(() => {
      const subjectIds = plannedAssignments.map((assignment) => assignment.data.subject_id);
      if (lessonBatchIds?.length) {
        clearLessonTeachingSession(window.localStorage, username);
      }
      if (subjectIds.length) {
        const snapshot: LessonTeachingSnapshot = { savedAt: new Date().toISOString(), subjectIds, index: 0, tab: "meaning" };
        try { window.localStorage.setItem(lessonTeachingSessionKey(username), JSON.stringify(snapshot)); } catch { /* The lesson remains usable when storage is unavailable. */ }
        setLessonTeachingSnapshot(snapshot);
      } else {
        clearLessonTeachingSession(window.localStorage, username);
        setLessonTeachingSnapshot(null);
      }
      setLessonBatchIds(subjectIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pickingLessons, assignmentQuery.isSuccess, lessonBatchIds, lessonBatchStorageReady, mode, plannedAssignments, restoredAssignmentsQuery.isError, restoredAssignmentsQuery.isLoading, restoredLessonAssignments.length, subjectsQuery.isSuccess, username]);

  const selectedAssignments = useMemo(() => {
    if (mode !== "lessons") return reviewSessionAssignments ?? plannedAssignments;
    return lessonBatchResolved ? restoredLessonAssignments : [];
  }, [lessonBatchResolved, mode, plannedAssignments, restoredLessonAssignments, reviewSessionAssignments]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const selectedSubjects = useMemo(() => selectedAssignments.map((assignment) => subjectById.get(assignment.data.subject_id)).filter((subject): subject is Subject => Boolean(subject)), [selectedAssignments, subjectById]);
  const reviewFontText = selectedSubjects.map((subject) => subject.data.characters ?? "").join("");
  const reviewFontReady = useReviewFontReady(reviewSubjectFont.style.fontFamily, reviewFontText);
  const selectedIds = useMemo(() => selectedAssignments.map((assignment) => assignment.data.subject_id), [selectedAssignments]);
  const answerContextIds = useMemo(() => Array.from(new Set(selectedSubjects.flatMap((subject) => {
    const characters = subject.data.characters?.normalize("NFKC").trim() || "";
    return subject.object === "vocabulary" && singleKanji.test(characters) ? subject.data.component_subject_ids || [] : [];
  }))), [selectedSubjects]);
  const answerContextQuery = useQuery({
    queryKey: ["core-study", mode, "answer-context", answerContextIds.join(",")],
    queryFn: () => fetchCoreStudyCollectionByIds<Subject>("subjects", "ids", answerContextIds),
    enabled: subjectsQuery.isSuccess && !isOnVacation && answerContextIds.length > 0,
    staleTime: 24 * 60 * 60_000,
  });
  const singleKanjiReadings = useMemo(() => {
    const readings: Record<string, string[]> = {};
    for (const subject of [...selectedSubjects, ...(answerContextQuery.data || [])]) {
      const characters = subject.data.characters?.normalize("NFKC").trim() || "";
      if (subject.object !== "kanji" || !singleKanji.test(characters)) continue;
      readings[characters] = Array.from(new Set((subject.data.readings || []).map((reading) => reading.reading).filter(Boolean)));
    }
    return readings;
  }, [answerContextQuery.data, selectedSubjects]);
  const materialsKey = ["core-study", mode, "materials", selectedIds.join(",")] as const;
  const materialsQuery = useQuery({
    queryKey: materialsKey,
    queryFn: () => fetchCoreStudyCollectionByIds<StudyMaterial>("study_materials", "subject_ids", selectedIds),
    enabled: subjectsQuery.isSuccess && !isOnVacation,
    staleTime: 5 * 60_000,
  });

  const questionOrder = questionOrderForMode(mode, preferences);
  const queueOptions = useMemo(() => ({
    mode,
    shuffleSubjects: false,
    answerOrder: questionOrder,
    reviewQuestionOrderEnabled: mode === "reviews" && preferences.reviewQuestionOrderEnabled,
    backToBackQuestions: mode === "reviews" && preferences.backToBackQuestions,
    maxQuestionGap: 10,
  } as const), [mode, preferences.backToBackQuestions, preferences.reviewQuestionOrderEnabled, questionOrder]);
  const makeQueue = useMemo(() => () => createQuestionQueue(selectedAssignments, selectedSubjects, queueOptions), [queueOptions, selectedAssignments, selectedSubjects]);

  useEffect(() => {
    if (phase === "results" && resultItems.length) return;
    if (!subjectsQuery.isSuccess || !lessonBatchResolved) return;
    const initializationKey = `${username}:${mode}:${selectedAssignments.map((assignment) => assignment.id).join(",")}`;
    if (initializedSessionKeyRef.current === initializationKey) return;
    const queue = makeQueue();
    const timer = window.setTimeout(() => {
      if (initializedSessionKeyRef.current === initializationKey) return;
      initializedSessionKeyRef.current = initializationKey;
      if (mode === "reviews") setReviewSessionAssignments(selectedAssignments);
      let restored: SessionSnapshot | null = null;
      try {
        if (mode === "reviews") window.localStorage.removeItem(coreSessionKey(username, mode));
        const raw = mode === "lessons" ? window.localStorage.getItem(coreSessionKey(username, mode)) : null;
        const parsed = raw ? JSON.parse(raw) as Partial<SessionSnapshot> : null;
        const age = parsed?.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : Infinity;
        if (parsed && Array.isArray(parsed.questionIds) && parsed.completed && parsed.errors && Array.isArray(parsed.submittedIds) && Number.isFinite(age) && age >= 0 && age <= LESSON_SESSION_MAX_AGE) restored = parsed as SessionSnapshot;
      } catch { window.localStorage.removeItem(coreSessionKey(username, mode)); }

      const byId = new Map(queue.map((question) => [question.id, question]));
      const restoredQueue = restored?.questionIds.map((id) => byId.get(id)).filter((question): question is CoreQuestion => Boolean(question)) || [];
      setAnkiRevealed(false);
      setAnsweredKinds([]);
      setContextTranslationOpen(false);
      setStudyDetailsOverride(null);
      if (restored && restoredQueue.length) {
        const assignmentIds = new Set(selectedAssignments.map((assignment) => assignment.id));
        setCompleted(Object.fromEntries(Object.entries(restored.completed).filter(([id]) => assignmentIds.has(Number(id)))));
        setErrors(Object.fromEntries(Object.entries(restored.errors).filter(([id]) => assignmentIds.has(Number(id)))));
        setSubmittedIds(restored.submittedIds.filter((id) => assignmentIds.has(id)));
        setQuestions(restoredQueue);
        setTotalQuestions(restoredQueue.length + Object.values(restored.completed).reduce((total, kinds) => total + kinds.length, 0));
        setSessionStartedAt(restored.startedAt || new Date().toISOString());
        setResumeSnapshot(restored);
        setDisplayNow(Date.now());
        setPhase("resume");
      } else {
        if (restored) window.localStorage.removeItem(coreSessionKey(username, mode));
        const teachingSnapshot = mode === "lessons"
          && lessonTeachingSnapshot?.subjectIds.length === selectedIds.length
          && lessonTeachingSnapshot.subjectIds.every((subjectId, index) => subjectId === selectedIds[index])
          ? lessonTeachingSnapshot
          : null;
        const startedAt = new Date().toISOString();
        setLessonIndex(teachingSnapshot?.index ?? 0);
        setLessonTab(teachingSnapshot?.tab ?? "meaning");
        setSessionStartedAt(startedAt);
        setQuestions(queue);
        setTotalQuestions(queue.length);
        setPhase(mode === "lessons" && selectedSubjects.length ? "teaching" : queue.length ? "quiz" : "results");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lessonBatchResolved, lessonTeachingSnapshot, subjectsQuery.isSuccess, selectedAssignments, selectedSubjects, selectedIds, mode, makeQueue, username, phase, resultItems.length]);

  useEffect(() => {
    if (mode !== "lessons" || phase !== "quiz") return;
    const snapshot: SessionSnapshot = { savedAt: new Date().toISOString(), startedAt: sessionStartedAt, questionIds: questions.map((question) => question.id), completed, errors, submittedIds };
    window.localStorage.setItem(coreSessionKey(username, mode), JSON.stringify(snapshot));
  }, [phase, questions, completed, errors, submittedIds, mode, sessionStartedAt, username]);

  useEffect(() => {
    if (mode !== "lessons" || phase !== "teaching" || !selectedIds.length) return;
    try {
      const snapshot: LessonTeachingSnapshot = { savedAt: new Date().toISOString(), subjectIds: selectedIds, index: lessonIndex, tab: lessonTab };
      window.localStorage.setItem(lessonTeachingSessionKey(username), JSON.stringify(snapshot));
    } catch { /* The lesson remains usable when storage is unavailable. */ }
  }, [lessonIndex, lessonTab, mode, phase, selectedIds, username]);

  const studyKeys = preferences.studyShortcuts ?? DEFAULT_STUDY_SHORTCUTS;
  useEffect(() => {
    if (mixed?.active === false || phase !== "quiz" || !questions[0]) return;
    if (!window.matchMedia("(min-width: 48rem)").matches) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase, questions, mixed?.active]);

  const reviewSync = useReviewSync(username, !isOnVacation && assignmentQuery.isSuccess && username !== "anonymous", (entry, confirmation) => {
    if (confirmation.stage !== undefined) {
      setResultItems((items) => items.map((item) => item.assignmentId === entry.assignmentId ? { ...item, endingStage: confirmation.stage } : item));
      // A late response may correct its own visible cue, never replace a newer one.
      setSrsProgression((previous) => previous?.assignmentId === entry.assignmentId ? { ...previous, endingStage: confirmation.stage!, isCorrect: confirmation.stage! > previous.startingStage, nextReviewInterval: formatNextReviewInterval(confirmation.availableAt, confirmation.stage!) } : previous);
    }
    void Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]).catch(() => undefined);
  }, mode === "lessons" ? "lesson" : "review");
  const current = questions[0];
  const answerAccuracy = coreAccuracy(completed, errors, questions[0] && feedback && feedback.status !== "blocked" ? { id: questions[0].assignment.id, kinds: answeredKinds.length ? answeredKinds : [questions[0].kind], correct: lastCorrect } : undefined);
  const reportMixedAccuracy = useEffectEvent(() => mixed?.reportAccuracy?.(answerAccuracy));
  useEffect(() => { reportMixedAccuracy(); }, [answerAccuracy.correct, answerAccuracy.answered]);
  const outboxCount = reviewSync.pendingCount;
  const outboxMessage = reviewSync.permissionError;
  const reportMixedResults = useEffectEvent(() => mixed?.reportResults?.({ items: wanikaniSessionResults(resultItems), durationMs: Math.max(0, displayNow - new Date(sessionStartedAt).getTime()), pendingCount: outboxCount, error: outboxMessage }));
  useEffect(() => { reportMixedResults(); }, [resultItems, displayNow, sessionStartedAt, outboxCount, outboxMessage]);
  const finishReviewSync = reviewSync.finish;
  useEffect(() => {
    if (phase === "results") finishReviewSync();
  }, [mode, phase, finishReviewSync]);

  const retrySchedule = useRef(createReviewRetrySchedule());
  const mixedPrevious = useRef<string | undefined>(undefined);
  const reportMixed = useEffectEvent(() => {
    const previous = mixedPrevious.current;
    mixedPrevious.current = current?.id;
    const head = wkHead(isOnVacation ? undefined : current, liveUser?.data.level ?? 1, Boolean(previous && current && previous.split(":")[0] === String(current.assignment.id) && preferences.backToBackQuestions), preferences.backToBackQuestions ? new Set(questions.map(question => question.assignment.id)).size : questions.length);
    const open = openReviewIds();
    mixed?.report(head ? { ...head, pending: questions.map(question => ({ id: question.id, subjectId: String(question.assignment.id), open: open.has(question.assignment.id) })), activate: (id) => {
      setAnswer(""); setFeedback(null); setAnkiRevealed(false); setAnsweredKinds([]); setStudyDetailsOverride(null);
      setQuestions(pending => {
      const selected = pending.find(question => question.id === id);
      if (!selected || pending[0] === selected) return pending;
      const pair = preferences.backToBackQuestions ? pending.filter(question => question !== selected && question.assignment.id === selected.assignment.id) : [];
      return [selected, ...pair, ...pending.filter(question => question !== selected && !pair.includes(question))];
      });
    } } : null);
  });
  const mixedFailed = Boolean(availabilityCheckFailed || assignmentQuery.error || subjectsQuery.error || materialsQuery.error || answerContextQuery.error);
  const mixedLoading = currentUserQuery.isPending || (!isOnVacation && (assignmentQuery.isPending || subjectsQuery.isPending || materialsQuery.isLoading || answerContextQuery.isLoading));
  const reportMixedError = useEffectEvent(() => mixed?.reportError?.(mixedFailed));
  useEffect(() => { reportMixedError(); }, [mixedFailed]);
  useEffect(() => { if (!mixedFailed && !mixedLoading && (isOnVacation || phase === "quiz" || phase === "results")) reportMixed(); }, [questions, phase, mixedFailed, mixedLoading, isOnVacation]);
  const selfAssessmentKinds = useMemo<QuestionKind[]>(() => {
    if (!current) return [];
    if (preferences.ankiMode !== "both" || !preferences.ankiGroupQuestions) return [current.kind];
    const completedKinds = completed[current.assignment.id] || [];
    const availableKinds = kindsForSubject(current.subject).filter((kind) => !completedKinds.includes(kind) && questions.some((question) => question.assignment.id === current.assignment.id && question.kind === kind));
    return availableKinds.length > 1 ? availableKinds : [current.kind];
  }, [completed, current, preferences.ankiGroupQuestions, preferences.ankiMode, questions]);
  const groupedSelfAssessment = selfAssessmentKinds.length > 1;
  const material = current ? materialsQuery.data?.find((item) => item.data.subject_id === current.subject.id) : undefined;
  const addSynonymMutation = useMutation({
    mutationFn: async ({ subject, synonym, existingMaterial }: { subject: Subject; assignmentId: number; kind: QuestionKind; synonym: string; existingMaterial?: StudyMaterial }) => {
      const meaningSynonyms = [...new Set([...(existingMaterial?.data.meaning_synonyms ?? []), synonym])];
      return wkRequest<StudyMaterial>(existingMaterial ? `study_materials/${existingMaterial.id}` : "study_materials", {
        method: existingMaterial ? "PUT" : "POST",
        body: { study_material: { ...(existingMaterial ? {} : { subject_id: subject.id }), meaning_synonyms: meaningSynonyms } },
      });
    },
    onSuccess: (saved, payload) => {
      queryClient.setQueryData<StudyMaterial[]>(materialsKey, (materials = []) => [
        ...materials.filter((candidate) => candidate.data.subject_id !== payload.subject.id),
        saved,
      ]);
      setErrors((previous) => {
        const counts = previous[payload.assignmentId];
        if (!counts) return previous;
        return { ...previous, [payload.assignmentId]: { ...counts, [payload.kind]: Math.max(0, counts[payload.kind] - 1) } };
      });
      setLastCorrect(true);
      setFeedback({ status: "correct", message: `Added “${payload.synonym}” as a synonym and marked the answer correct.`, canonical: canonicalAnswer(payload.subject, "meaning") });
      setSessionError("");
    },
    onError: (cause) => setSessionError(formatFailure(cause, "The synonym was not saved. Try again before continuing.")),
    retry: 0,
  });
  const baseProgress = createQuestionQueue(selectedAssignments, selectedSubjects, queueOptions).length;
  const progress = totalQuestions || baseProgress;
  const answered = Math.max(0, progress - questions.length);
  const sessionItemIds = new Set([...questions.map((question) => question.assignment.id), ...submittedIds]);
  const totalItems = wrapUpActive ? sessionItemIds.size : sessionItemIds.size || selectedAssignments.length;
  const completedItems = submittedIds.filter((id) => sessionItemIds.has(id)).length;
  const reportMixedProgress = useEffectEvent(() => mixed?.reportProgress?.({ completed: completedItems, total: totalItems }));
  useEffect(() => { reportMixedProgress(); }, [completedItems, totalItems]);
  const currentUsesSelfAssessment = Boolean(current && usesSelfAssessment(current.kind, preferences));
  const reviewViewportRef = useMobileReviewViewport<HTMLDivElement>(mixed?.active !== false && phase === "quiz" && !currentUsesSelfAssessment);
  const revealStudyDetails = canRevealStudyDetails(mode, feedback?.status) || Boolean(currentUsesSelfAssessment && ankiRevealed);
  const answerStopped = Boolean(feedback && feedback.status !== "blocked" && shouldPauseAfterResult(feedback.status, preferences));
  const unresolvedCloseAnswer = feedback?.status === "close" && (preferences.pauseOnCorrect || preferences.pauseOnClose);
  const studyDetailsOpenByDefault = Boolean(answerStopped && preferences.showAnswerStopSubjectDetails && !currentUsesSelfAssessment);
  const studyDetailsOverrideForCurrent = current && studyDetailsOverride?.questionId === current.id ? studyDetailsOverride.open : undefined;
  const studyDetailsOpen = Boolean(current && revealStudyDetails && (studyDetailsOverrideForCurrent ?? studyDetailsOpenByDefault));
  const studyDetailsShouldOpen = studyDetailsOpen && !advancingQuestion;
  const detailSettings = webSettings.subjectDetails ?? DEFAULT_WEB_SETTINGS.subjectDetails;
  const detailSubject = current?.subject;
  const detailRelationIds = useMemo(() => {
    const data = detailSubject?.data;
    return Array.from(new Set([...(data?.component_subject_ids ?? []), ...(data?.amalgamation_subject_ids ?? []), ...(data?.visually_similar_subject_ids ?? [])])).slice(0, 150);
  }, [detailSubject]);
  const detailRelations = useQuery({
    queryKey: ["wanikani", "subjects", `relations:${detailRelationIds.join(",")}`],
    queryFn: () => wkCollection<Subject>(`subjects?ids=${detailRelationIds.join(",")}`),
    enabled: studyDetailsOpen && detailRelationIds.length > 0,
    staleTime: 24 * 60 * 60_000,
  });
  const detailStatistic = useQuery({
    queryKey: ["wanikani", "review-statistics", `subject:${detailSubject?.id ?? 0}`],
    queryFn: () => wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${detailSubject!.id}`),
    enabled: studyDetailsOpen && Boolean(detailSubject),
    staleTime: 15 * 60_000,
  });
  const detailCharacters = detailSubject?.data.characters;
  const detailIsVocabulary = detailSubject?.object === "vocabulary" || detailSubject?.object === "kana_vocabulary";
  const detailReadings = useMemo(() => detailSubject?.data.readings?.map((reading) => reading.reading) ?? [], [detailSubject]);
  const ankiNeedsPitchAccent = Boolean(current && ankiRevealed && usesSelfAssessment(current.kind, preferences) && selfAssessmentKinds.includes("reading") && (preferences.ankiShowPitchAccentNumbers || preferences.ankiShowPitchAccentGraph));
  const detailEnrichments = useQuery({
    queryKey: ["subject-enrichments", detailSubject?.id ?? 0, detailCharacters, detailReadings.join(",")],
    queryFn: ({ signal }) => fetchSubjectEnrichments({ id: detailSubject!.id, level: detailSubject!.data.level, characters: detailCharacters!, readings: detailReadings }, signal),
    enabled: Boolean(detailSubject && detailCharacters && (ankiNeedsPitchAccent || (studyDetailsOpen && ((detailSettings.showPitchAccent && detailSubject.object !== "radical") || (detailSettings.showPatternsOfUse && detailIsVocabulary))))),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const immersionSources = webSettings.study.immersionKitAnimeSources;
  const detailImmersion = useQuery({
    queryKey: ["immersion", "subject-detail", detailCharacters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(detailCharacters!, immersionSources, signal),
    enabled: Boolean(studyDetailsOpen && detailSettings.showImmersionExamples && detailCharacters && detailIsVocabulary),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    let openingFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      // Paint the collapsed panel before opening, including automatic answer stops.
      openingFrame = window.requestAnimationFrame(() => setStudyDetailsExpanded(studyDetailsShouldOpen));
    });
    return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(openingFrame); };
  }, [studyDetailsShouldOpen]);


  async function playAudio(subject: Subject) {
    const audios = preferredAudiosFor(subject, preferences.vocabularyAudioVoice);
    for (let index = 0; index < audios.length; index += 1) {
      const player = new Audio(audios[index].url);
      if (index === audios.length - 1) {
        await player.play().catch(() => undefined);
        continue;
      }
      await new Promise<void>((resolve) => {
        player.addEventListener("ended", () => resolve(), { once: true });
        player.addEventListener("error", () => resolve(), { once: true });
        void player.play().catch(() => resolve());
      });
    }
  }

  async function replayAudio(subject: Subject) {
    setReplayingAudio(true);
    try {
      await playAudio(subject);
    } finally {
      setReplayingAudio(false);
    }
  }

  function startVoiceAnswer() {
    if (!current || !preferences.voiceAnswers) return;
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) { setSpeechError("Speech recognition is not available in this browser."); return; }
    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = current.kind === "reading" ? "ja-JP" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => { if (feedback?.status === "blocked") setFeedback(null); setAnswer(event.results[0]?.[0]?.transcript?.trim() || ""); setSpeechError(""); };
    recognition.onerror = (event) => setSpeechError(event.error === "not-allowed" ? "Microphone permission was denied. You can keep typing." : "The browser could not recognize that answer. Try again or type it.");
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setSpeechError("");
    setListening(true);
    try { recognition.start(); } catch { setListening(false); setSpeechError("Speech recognition could not start. You can keep typing."); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (feedback) { if (!unresolvedCloseAnswer) void advance(); return; }
    if (!current) return;
    const submitted = current.kind === "reading" ? finalizeKanaInput(answer) : answer;
    setAnswer(submitted);
    const result = checkAnswer(current.subject, current.kind, submitted, preferences.acceptUserSynonymsAsAnswers ? material : undefined, current.kind === "reading" ? { singleKanjiReadings, acceptAnyKanjiOnyomiReading: preferences.acceptAnyKanjiOnyomiReading } : undefined);
    setFeedback(result);
    if (result.status === "blocked") return;
    setAnsweredKinds([current.kind]);
    const correct = result.status === "correct" || result.status === "close";
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (preferences.answerFeedbackSoundEnabled && !(result.status === "close" && (preferences.pauseOnCorrect || preferences.pauseOnClose))) playAnswerFeedback(correct);
    if ((correct || (result.status === "incorrect" && preferences.pauseOnWrong)) && current.kind === "reading" && (current.subject.object === "vocabulary" || current.subject.object === "kana_vocabulary") && preferences.autoplayAudio && audioFor(current.subject, preferences.vocabularyAudioVoice)) void playAudio(current.subject);
  }

  function preservePhoneInputFocus(event: MouseEvent<HTMLButtonElement>) {
    // Cancel the focus change here; canceling pointerdown suppresses Safari's tap click.
    if (phoneInput && document.activeElement === inputRef.current) event.preventDefault();
  }

  function gradeSelf(correct: boolean) {
    if (!current || feedback) return;
    const gradedKinds = selfAssessmentKinds.length ? selfAssessmentKinds : [current.kind];
    const canonical = gradedKinds.map((kind) => canonicalAnswer(current.subject, kind)).join(" · ");
    setFeedback({ status: correct ? "correct" : "incorrect", message: correct ? "Marked correct in Anki mode." : `Marked incorrect. The answer is ${canonical}.`, canonical });
    setLastCorrect(correct);
    setAnsweredKinds(gradedKinds);
    if (!correct) setErrors((previous) => {
      const row = { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0 };
      gradedKinds.forEach((kind) => { row[kind] += 1; });
      return { ...previous, [current.assignment.id]: row };
    });
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    advance(correct, undefined, gradedKinds);
  }

  function resolveCloseAnswer(correct: boolean) {
    if (!current || feedback?.status !== "close" || !(preferences.pauseOnCorrect || preferences.pauseOnClose) || advancingQuestionRef.current) return;
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    advance(correct);
  }

  function markAnswer(correct: boolean) {
    if (!current || !feedback || feedback.status === "blocked" || advancingQuestionRef.current || addSynonymMutation.isPending) return;
    if (unresolvedCloseAnswer) { resolveCloseAnswer(correct); return; }
    if (correct === lastCorrect) { advance(correct); return; }
    const delta = correct ? -1 : 1;
    const kinds = answeredKinds.length ? answeredKinds : [current.kind];
    const counts = { ...(errors[current.assignment.id] ?? { meaning: 0, reading: 0 }) };
    for (const kind of kinds) counts[kind] = Math.max(0, counts[kind] + delta);
    setErrors((previous) => ({ ...previous, [current.assignment.id]: counts }));
    setLastCorrect(correct);
    setFeedback({ status: correct ? "correct" : "incorrect", message: correct ? "Marked correct." : "Marked incorrect.", canonical: canonicalAnswer(current.subject, current.kind) });
    advance(correct, counts);
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
  }

  function revealSelfAssessmentAnswer() {
    if (!current || ankiRevealed) return;
    setAnkiRevealed(true);
    if (preferences.autoplayAudio && selfAssessmentKinds.includes("reading") && audioFor(current.subject, preferences.vocabularyAudioVoice)) void playAudio(current.subject);
  }

  function toggleStudyDetails() {
    if (!current || !revealStudyDetails || advancingQuestionRef.current) return;
    const nextOpen = !studyDetailsOpen;
    setStudyDetailsOverride({ questionId: current.id, open: nextOpen });
  }

  async function advanceNow(correctOverride?: boolean, errorOverride?: { meaning: number; reading: number }, gradedKinds?: QuestionKind[]) {
    if (!current || (!gradedKinds && (!feedback || feedback.status === "blocked"))) {
      if (feedback?.status === "blocked") setAnswer("");
      setFeedback(null);
      window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
      return;
    }
    setSessionError("");
    const resolvedAnsweredKinds = gradedKinds ?? (answeredKinds.length ? answeredKinds : [current.kind]);
    const resolvedCorrect = correctOverride ?? lastCorrect;
    const answeredKindSet = new Set(resolvedAnsweredKinds);
    const retryQuestions = resolvedAnsweredKinds.map((kind) => questions.find((question) => question.assignment.id === current.assignment.id && question.kind === kind) || { ...current, id: `${current.assignment.id}:${kind}`, kind });
    const remaining = questions.filter((question, index) => index !== 0 && !(question.assignment.id === current.assignment.id && answeredKindSet.has(question.kind)));
    setPreviousAnswerItem({ subject: current.subject, kind: current.kind, isCorrect: resolvedCorrect });
    const retryRandom = resolvedCorrect ? 0 : Math.random();
    function prepareNextQuestions(next: CoreQuestion[]) {
      retrySchedule.current = advanceReviewRetrySchedule(retrySchedule.current, retryQuestions.map(question => question.id), resolvedCorrect, retryRandom);
      const immediate = preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect;
      return orderReviewRetries(next, openReviewIds(current!.assignment.id), question => question.assignment.id, question => question.id, retrySchedule.current, immediate);
    }
    if (!resolvedCorrect) {
      mixed?.onAnswer?.({ id: current.id, source: "wanikani", subject: current.subject, title: primaryMeaning(current.subject), correct: resolvedCorrect });
      const retryImmediately = preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect;
      const next = retryImmediately ? [...retryQuestions, ...remaining] : insertReviewRetry(remaining, retryQuestions, { random: retryRandom, subjectId: preferences.backToBackQuestions ? question => question.assignment.id : undefined });
      setQuestions(prepareNextQuestions(next));
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      setAnsweredKinds([]);
      setContextTranslationOpen(false);
      setStudyDetailsOverride(null);
      window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
      return;
    }
    const finishedKinds = [...(completed[current.assignment.id] || []), ...resolvedAnsweredKinds].filter((value, index, all) => all.indexOf(value) === index);
    const subjectDone = kindsForSubject(current.subject).every((kind) => finishedKinds.includes(kind));
    try {
      if (subjectDone && !submittedIds.includes(current.assignment.id)) {
        let resultingStage: number | undefined = mode === "lessons" ? 1 : undefined;
        if (mode === "reviews") {
          const counts = errorOverride ?? errors[current.assignment.id] ?? { meaning: 0, reading: 0 };
          reviewSync.enqueue({ assignmentId: current.assignment.id, incorrectMeaningAnswers: counts.meaning, incorrectReadingAnswers: counts.reading, createdAt: new Date().toISOString() });
          resultingStage = predictedReviewStage(current.assignment.data.srs_stage, counts.meaning, counts.reading);
          if (preferences.srsProgressionCardDisplayMode !== "hidden") {
            const startingStage = current.assignment.data.srs_stage;
            setReserveResultsProgressionSlot(remaining.length === 0);
            setSrsProgression({ assignmentId: current.assignment.id, subjectId: current.subject.id, startingStage, endingStage: resultingStage, isCorrect: resultingStage > startingStage, nextReviewInterval: formatNextReviewInterval(undefined, resultingStage) });
          }
        } else {
          if (isOnVacation) throw new Error(vacationStudyMessage("lessons"));
          reviewSync.enqueue({ operation: "lesson", assignmentId: current.assignment.id, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: new Date().toISOString() });
          setStartedLessonIds((ids) => [...new Set([...ids, current.assignment.id])]);
          // Daily limits and picked batches follow local completion, never network timing.
          try { recordLessonStarted(window.localStorage, username, current.assignment.id); } catch { /* The durable submission already protects this completion. */ }
          setLessonStartsToday(lessonsStartedToday(window.localStorage, username));
          if (pickedLessonIds) {
            const remainingIds = pickedLessonIds.filter((id) => id !== current.subject.id);
            savePickedLessons(window.localStorage, username, remainingIds);
            setPickedLessonIds(remainingIds);
          }
        }
        setSubmittedIds((previous) => [...previous, current.assignment.id]);
        setResultItems((previous) => [...previous.filter((item) => item.assignmentId !== current.assignment.id), { assignmentId: current.assignment.id, subject: current.subject, meaningMistakes: errorOverride?.meaning ?? errors[current.assignment.id]?.meaning ?? 0, readingMistakes: errorOverride?.reading ?? errors[current.assignment.id]?.reading ?? 0, endingStage: resultingStage }]);
      }
      mixed?.onAnswer?.({ id: current.id, source: "wanikani", subject: current.subject, title: primaryMeaning(current.subject), correct: resolvedCorrect });
      setCompleted((previous) => ({ ...previous, [current.assignment.id]: finishedKinds }));
      setQuestions(prepareNextQuestions(remaining));
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      setAnsweredKinds([]);
      setContextTranslationOpen(false);
      setStudyDetailsOverride(null);
      if (!remaining.length) {
        window.localStorage.removeItem(coreSessionKey(username, mode));
        if (mode === "lessons") clearLessonTeachingSession(window.localStorage, username);
        // Record local completion without waiting for background delivery.
        setDisplayNow(Date.now());
        setPhase("results");
        // Completion must not wait for dashboard queries; the session is already saved.
        void Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]).catch(() => undefined);
      } else window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
    } catch (cause) {
      setSessionError(formatFailure(cause, mode === "reviews" ? "This review could not be saved on this device. Please try again before continuing." : "This lesson could not be saved on this device. Please try again before continuing."));
    }
  }

  function advance(correctOverride?: boolean, errorOverride?: { meaning: number; reading: number }, gradedKinds?: QuestionKind[]) {
    if (advancingQuestionRef.current || (unresolvedCloseAnswer && correctOverride === undefined)) return;
    if (phoneInput) inputRef.current?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const collapseDetailsFirst = (studyDetailsOpen || studyDetailsExpanded) && !reducedMotion;
    advancingQuestionRef.current = true;

    const run = () => {
      advanceTimerRef.current = null;
      void advanceNow(correctOverride, errorOverride, gradedKinds).finally(() => {
        advancingQuestionRef.current = false;
        setAdvancingQuestion(false);
      });
    };

    if (!collapseDetailsFirst) {
      run();
      return;
    }

    setAdvancingQuestion(true);
    setStudyDetailsExpanded(false);
    advanceTimerRef.current = window.setTimeout(run, REVIEW_DETAILS_DURATION_MS);
  }

  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (listDialogOpen || reviewSettingsOpen || mixed?.active === false || !feedback || feedback.status === "blocked") return;
    if (currentUsesSelfAssessment) return;
    if (shouldPauseAfterResult(feedback.status, preferences) || studyDetailsOverrideForCurrent === true || addSynonymMutation.isPending) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [listDialogOpen, reviewSettingsOpen, feedback, lastCorrect, preferences, currentUsesSelfAssessment, studyDetailsOverrideForCurrent, addSynonymMutation.isPending, mixed?.active]);

  useEffect(() => {
    if (mixed?.active === false || phase !== "quiz" || !preferences.keyboardShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]") || event.repeat || event.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = studyShortcutAction(event.key, studyKeys);
      const fromAnsweredInput = event.target === inputRef.current && Boolean(feedback && feedback.status !== "blocked");
      if (action === "skip" && !feedback && !shouldIgnoreReviewShortcut(event)) { event.preventDefault(); skipCurrentQuestion(); return; }
      if ((action === "details" || action === "replayAudio" || action === "markCorrect" || action === "markIncorrect" || action === "addSynonym") && (fromAnsweredInput || !shouldIgnoreReviewShortcut(event)) && !(ankiRevealed && !feedback && (action === "markCorrect" || action === "markIncorrect"))) {
        if (revealStudyDetails && !advancingQuestion && !addSynonymMutation.isPending) {
          if (action === "markCorrect") { event.preventDefault(); markAnswer(true); }
          if (action === "markIncorrect") { event.preventDefault(); markAnswer(false); }
          if (action === "addSynonym") { event.preventDefault(); if (canAddSynonym && current) addSynonymMutation.mutate({ subject: current.subject, assignmentId: current.assignment.id, kind: current.kind, synonym: synonymCandidate, existingMaterial: material }); }
        }
        if (action === "details" && revealStudyDetails) { event.preventDefault(); toggleStudyDetails(); }
        if (action === "replayAudio" && current && revealStudyDetails) { event.preventDefault(); void playAudio(current.subject); }
        return;
      }
      if (action === "progress" && unresolvedCloseAnswer) {
        if (shouldIgnoreReviewShortcut(event)) return;
        event.preventDefault();
        resolveCloseAnswer(true);
        return;
      }
      if (action === "progress" && feedback) {
        if (shouldIgnoreReviewAdvance(event)) return;
        event.preventDefault();
        void advance();
        return;
      }
      if (action === "progress" && shouldIgnoreReviewShortcut(event)) return;
      if (action === "progress" && current && usesSelfAssessment(current.kind, preferences) && !feedback) {
        event.preventDefault();
        if (!ankiRevealed) revealSelfAssessmentAnswer();
      }
      if (ankiRevealed && !feedback && !shouldIgnoreReviewShortcut(event) && (action === "markIncorrect" || action === "markCorrect")) {
        event.preventDefault();
        gradeSelf(action === "markCorrect");
      }

    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function openReviewIds(currentId?: number) {
    return new Set([...Object.keys(completed).map(Number), ...Object.keys(errors).map(Number), ...(currentId === undefined ? [] : [currentId])]);
  }

  function wrapUp(limit = preferences.reviewWrapUpSize) {
    const trimmed = retainWrapUpReviews(questions, openReviewIds(mixed?.active === false ? undefined : current?.assignment.id), question => question.assignment.id, limit);
    setQuestions(trimmed);
    setTotalQuestions(answered + trimmed.length);
    setWrapUpActive(true);
    if (!trimmed.length) setPhase("results");
  }

  const applyMixedWrapUp = useEffectEvent(() => { if (mixed?.wrapUpRequest) wrapUp(mixed.wrapUpRequest.limit); });
  // Apply each parent-issued wrap-up command once to this independently owned queue.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { applyMixedWrapUp(); }, [mixed?.wrapUpRequest?.id]);

  function skipCurrentQuestion() {
    if (!current || feedback || !questions.some((question) => question.assignment.id !== current.assignment.id)) return;
    setQuestions(moveCoreQuestionPairToEnd(questions));
    setAnswer("");
    setAnkiRevealed(false);
    setAnsweredKinds([]);
    setContextTranslationOpen(false);
    setStudyDetailsOverride(null);
    window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
  }

  function continueSavedSession() {
    setResumeSnapshot(null);
    setPhase("quiz");
  }

  function startLessonsOver() {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    advancingQuestionRef.current = false;
    setAdvancingQuestion(false);
    clearLessonTeachingSession(window.localStorage, username);
    savePickedLessons(window.localStorage, username, []);
    try { window.localStorage.removeItem(coreSessionKey(username, "lessons")); } catch { /* Continue in memory. */ }
    initializedSessionKeyRef.current = "";
    setLessonTeachingSnapshot(null);
    setLessonBatchIds(null);
    setPickedLessonIds(null);
    setResumeSnapshot(null);
    setQuestions([]);
    setCompleted({});
    setErrors({});
    setSubmittedIds([]);
    setResultItems([]);
    setFeedback(null);
    setLessonIndex(0);
    setLessonTab("meaning");
    setSessionError("");
    setPickingLessons(true);
    setPhase("loading");
    void assignmentQuery.refetch();
    window.history.replaceState(null, "", "/lesson-picker");
    window.scrollTo({ top: 0 });
  }

  function restartSession(nextLessonIds?: number[]) {
    window.localStorage.removeItem(coreSessionKey(username, mode));
    let queue = makeQueue();
    if (mode === "lessons") {
      clearLessonTeachingSession(window.localStorage, username);
      const subjectIds = nextLessonIds ?? plannedAssignments.map((assignment) => assignment.data.subject_id);
      const snapshot: LessonTeachingSnapshot | null = subjectIds.length
        ? { savedAt: new Date().toISOString(), subjectIds, index: 0, tab: "meaning" }
        : null;
      if (snapshot) {
        try { window.localStorage.setItem(lessonTeachingSessionKey(username), JSON.stringify(snapshot)); } catch { /* The lesson remains usable when storage is unavailable. */ }
      }
      initializedSessionKeyRef.current = "";
      setLessonTeachingSnapshot(snapshot);
      setLessonBatchIds(subjectIds);
      queue = [];
    }
    setResumeSnapshot(null);
    setCompleted({});
    setErrors({});
    setSubmittedIds([]);
    setResultItems([]);
    setQuestions(queue);
    setTotalQuestions(queue.length);
    setLessonIndex(0);
    setLessonTab("meaning");
    setAnkiRevealed(false);
    setAnsweredKinds([]);
    setContextTranslationOpen(false);
    setStudyDetailsOverride(null);
    setReserveResultsProgressionSlot(false);
    setPreviousAnswerItem(null);
    setSessionStartedAt(new Date().toISOString());
    setPhase(mode === "lessons" ? "loading" : queue.length ? "quiz" : "results");
  }

  if (mode === "reviews" && phase === "results" && resultItems.length) return <CoreStudyResults
    items={resultItems}
    mode={mode}
    durationMs={displayNow - new Date(sessionStartedAt).getTime()}
    pendingCount={outboxCount}
    permissionError={outboxMessage}
    progression={reserveResultsProgressionSlot ? <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} /> : null}
  />;

  if (currentVacationStartedAt) return <div className={styles.stage}><section className={styles.vacationPause} role="status"><div className={styles.vacationIcon}><Umbrella size={28} aria-hidden /></div><div><h1>Vacation Mode</h1><p>{vacationStudyMessage(mode)}</p><span>On vacation since {vacationDateLabel(currentVacationStartedAt)}</span></div><div className="cluster"><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink><a href={WANIKANI_VACATION_SETTINGS_URL} target="_blank" rel="noreferrer">Turn off in WaniKani</a></div></section></div>;
  if (availabilityCheckFailed) return <div className={styles.stage}><div className={styles.loading}><h1>Study availability could not be checked</h1><p className={styles.error} role="alert">Kakehashi could not confirm whether Vacation Mode is active. No lesson or review session has been started.</p><div className="cluster"><Button onClick={() => void currentUserQuery.refetch()}>Try Again</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></div></div>;
  if (currentUserQuery.isLoading) return mode === "lessons" ? <LessonLoading picking={pickingLessons} /> : <ReviewLoading />;
  if (assignmentQuery.error || subjectsQuery.error || (restoredAssignmentsQuery.error && !lessonBatchResolved)) return <div className={styles.stage}><div className={styles.loading}><h1>{mode === "lessons" ? "Lessons" : "Reviews"} could not load</h1><p className={styles.error} role="alert">{formatFailure(assignmentQuery.error || subjectsQuery.error || restoredAssignmentsQuery.error, "Refresh when the connection is available.")}</p><Button onClick={() => {
    if (assignmentQuery.error) void assignmentQuery.refetch();
    if (subjectsQuery.error) void subjectsQuery.refetch();
    if (restoredAssignmentsQuery.error) void restoredAssignmentsQuery.refetch();
  }}>Try Again</Button></div></div>;
  if (pickingLessons && assignmentQuery.isSuccess && subjectsQuery.isSuccess && lessonBatchStorageReady) return <LessonPicker
    subjects={subjects.filter((subject) => candidateIds.includes(subject.id))}
    limit={dailyRemaining}
    batchSize={preferences.lessonsBatchSize}
    onStart={(subjectIds) => {
      const availableIds = new Set(candidateIds);
      const ids = subjectIds.filter((id) => availableIds.has(id)).slice(0, dailyRemaining);
      if (!ids.length) return;
      const batchIds = pickedLessonBatch(ids, candidateIds, preferences.lessonsBatchSize, dailyRemaining);
      savePickedLessons(window.localStorage, username, ids);
      setPickedLessonIds(ids);
      const snapshot: LessonTeachingSnapshot = { savedAt: new Date().toISOString(), subjectIds: batchIds, index: 0, tab: "meaning" };
      try { window.localStorage.setItem(lessonTeachingSessionKey(username), JSON.stringify(snapshot)); } catch { /* Continue in memory when storage is unavailable. */ }
      setLessonTeachingSnapshot(snapshot);
      setLessonBatchIds(batchIds);
      setPickingLessons(false);
      window.history.replaceState(null, "", "/lessons");
    }}
  />;
  if (materialsQuery.error || answerContextQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Answer data could not load</h1><p className={styles.error} role="alert">{formatFailure(materialsQuery.error || answerContextQuery.error, "Retry before answering so personal synonyms and reading warnings are checked correctly.")}</p><Button onClick={() => { if (materialsQuery.error) void materialsQuery.refetch(); if (answerContextQuery.error) void answerContextQuery.refetch(); }}>Try Again</Button></div></div>;
  if (assignmentQuery.isLoading || subjectsQuery.isLoading || materialsQuery.isLoading || answerContextQuery.isLoading || (phase === "loading" || (phase === "quiz" && !reviewFontReady))) return mode === "lessons" && phase !== "quiz" ? <LessonLoading picking={pickingLessons} /> : <ReviewLoading />;

  if (phase === "resume" && resumeSnapshot) {
    const age = resumeSnapshot.savedAt ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((displayNow - new Date(resumeSnapshot.savedAt).getTime()) / 60_000)), "minute") : "earlier";
    const remainingItems = new Set(questions.map((question) => question.assignment.id)).size;
    return <div className={styles.stage}><section className={styles.resume}><RotateCcw size={36} aria-hidden /><div><h1>Resume {mode}?</h1><p>Your saved session has {remainingItems} {remainingItems === 1 ? "item" : "items"} remaining and was updated {age}.</p></div><div className="cluster"><Button tone="primary" onClick={continueSavedSession}>Continue Session</Button><Button tone="ghost" onClick={() => restartSession()}>Start Fresh</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></section></div>;
  }

  if (phase === "teaching") {
    return <LessonTeaching
      subjects={selectedSubjects}
      assignments={selectedAssignments}
      materials={materialsQuery.data ?? []}
      materialsLoading={materialsQuery.isLoading}
      materialsKey={materialsKey}
      settings={webSettings}
      currentIndex={lessonIndex}
      activeTab={lessonTab}
      onCurrentIndexChange={setLessonIndex}
      onActiveTabChange={setLessonTab}
      onStartOver={startLessonsOver}
      onStartReview={() => {
        setLessonTab("meaning");
        setPhase("quiz");
      }}
    />;
  }

  if (mode === "lessons" && phase === "results" && submittedIds.length) {
    const remaining = candidateAssignments.filter((assignment) => !submittedIds.includes(assignment.id));
    const remainingById = new Map(remaining.map((assignment) => [assignment.data.subject_id, assignment]));
    const upcoming = pickedLessonIds
      ? pickedLessonIds.map((id) => remainingById.get(id)).filter((assignment): assignment is Assignment => Boolean(assignment)).slice(0, dailyRemaining)
      : selectCoreAssignments(remaining, subjects, "lessons", preferences, dailyRemaining);
    const upcomingSubjects = upcoming.map((assignment) => subjectById.get(assignment.data.subject_id)).filter((subject): subject is Subject => Boolean(subject));
    return <LessonBatchComplete
      pendingCount={outboxCount}
      syncError={outboxMessage}
      completed={selectedSubjects.filter((subject) => submittedIds.some((id) => lessonAssignmentBySubjectId.get(subject.id)?.id === id))}
      upcoming={upcomingSubjects}
      batchSize={preferences.lessonsBatchSize}
      dailyLimitReached={dailyRemaining === 0 && remaining.length > 0}
      onNextBatch={() => restartSession(upcomingSubjects.slice(0, preferences.lessonsBatchSize).map((subject) => subject.id))}
    />;
  }

  if (phase === "results") {
    const incorrect = Object.values(errors).reduce((total, row) => total + row.meaning + row.reading, 0);
    const attempts = Math.max(1, progress + incorrect);
    const accuracy = selectedAssignments.length ? Math.round((progress / attempts) * 100) : 0;
    const minutes = Math.max(1, Math.round((displayNow - new Date(sessionStartedAt).getTime()) / 60_000));
    const dailyLimitReached = mode === "lessons" && preferences.dailyLessonLimit > 0 && dailyRemaining <= 0 && available.length > 0;
    return <div className={styles.stage}>{outboxMessage ? <p className={styles.error} role="alert">{outboxMessage}</p> : null}{reserveResultsProgressionSlot ? <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} /> : null}<section className={styles.results}><Check size={44} style={{ marginInline: "auto", color: "var(--color-success)" }} aria-hidden /><div><h1>{selectedAssignments.length ? `${mode === "lessons" ? "Lessons" : "Reviews"} Complete` : dailyLimitReached ? "Daily Lesson Limit Reached" : `No ${mode} Waiting`}</h1><p>{selectedAssignments.length ? outboxCount ? "Your answers are complete. Saved submissions will reconcile when WaniKani is available." : "Your WaniKani progress is up to date." : dailyLimitReached ? `You have reached today’s ${preferences.dailyLessonLimit}-lesson limit in this browser.` : mode === "lessons" ? "New lessons will appear after you unlock more subjects." : "Come back when the next review becomes available."}</p></div>{selectedAssignments.length ? <div className={styles.resultGrid}><div><div className={styles.resultNumber}>{submittedIds.length}</div><span>items completed</span></div><div><div className={styles.resultNumber}>{accuracy}%</div><span>answer accuracy</span></div><div><div className={styles.resultNumber}>{incorrect}</div><span>incorrect attempts</span></div><div><div className={styles.resultNumber}>{minutes}</div><span>minutes studied</span></div></div> : null}<div className="cluster" style={{ justifyContent: "center" }}><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink>{selectedAssignments.length ? <Button tone="ghost" onClick={() => mode === "lessons" && pickedLessonIds?.length ? restartSession() : window.location.reload()}><RotateCcw size={17} />{mode === "lessons" && pickedLessonIds?.length ? "Next batch" : "Check for More"}</Button> : null}</div></section></div>;
  }

  if (!current) return null;
  const answerResult = feedback ? feedback.status === "correct" ? "correct" : feedback.status === "close" || feedback.status === "blocked" ? "warning" : "incorrect" : undefined;
  const wrapUpAvailable = mode === "reviews" && !wrapUpActive && !mixed?.wrapUpRequest && (mixed?.progress ? mixed.progress.total - mixed.progress.completed : new Set(questions.map((question) => question.assignment.id)).size) > preferences.reviewWrapUpSize;
  const contextSentences = (current.subject.data.context_sentences || []).filter((sentence) => sentence.ja.trim()).slice(0, 3);
  const selfAssessment = currentUsesSelfAssessment;
  const jitaiFamily = resolveJitaiFontFamily(preferences, current.id);
  const subjectType = current.subject.object.replace("_", " ");
  const displayTotal = mixed?.progress?.total ?? totalItems;
  const displayCompleted = mixed?.progress?.completed ?? completedItems;
  const itemProgress = displayTotal ? Math.min(1, displayCompleted / displayTotal) : 0;
  const isVocabularyQuestion = current.subject.object === "vocabulary" || current.subject.object === "kana_vocabulary";
  const showContextHint = preferences.showVocabContextSentencesInReviews && isVocabularyQuestion && contextSentences.length > 0;
  const showReviewMetadata = preferences.showReviewItemLevelAndSrsStage;
  const reviewCharacterScale = preferences.reviewCharacterFontScale ?? 1;
  const reviewCharacterSize = `clamp(${2.75 * reviewCharacterScale}rem, ${9 * reviewCharacterScale}vw, ${6.5 * reviewCharacterScale}rem)`;
  const searchQuery = current.subject.data.characters || current.subject.data.slug;
  const ankiMeaningAnswer = canonicalAnswer(current.subject, "meaning");
  const ankiReadingAnswer = kindsForSubject(current.subject).includes("reading") ? canonicalAnswer(current.subject, "reading") : undefined;
  const otherMeaningAnswers = [
    ...current.subject.data.meanings.filter((meaning) => meaning.accepted_answer && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
    ...current.subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist" && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
  ];
  const otherReadingAnswers = (current.subject.data.readings || []).filter((reading) => reading.accepted_answer && reading.reading !== ankiReadingAnswer).map((reading) => reading.reading);
  const synonymCandidate = answer.trim().toLocaleLowerCase();
  const canAddSynonym = feedback?.status === "incorrect"
    && current.kind === "meaning"
    && Boolean(synonymCandidate)
    && !(material?.data.meaning_synonyms ?? []).some((synonym) => synonym.toLocaleLowerCase() === synonymCandidate);
  const pendingSubjectIds = new Set([
    ...Object.entries(completed).filter(([, kinds]) => kinds.length > 0).map(([id]) => Number(id)),
    ...Object.entries(errors).filter(([, mistakes]) => mistakes.meaning > 0 || mistakes.reading > 0).map(([id]) => Number(id)),
    ...(feedback && feedback.status !== "blocked" ? [current.assignment.id] : []),
  ].filter((id) => !submittedIds.includes(id)));
  const questionMetadata = showReviewMetadata ? <div className={quiz.reviewPromptMetadata} aria-label="Question status"><span>Level {current.subject.data.level}</span><span><SrsStageIcon stage={current.assignment.data.srs_stage} size={16} />{srsStageLabel(current.assignment.data.srs_stage)}</span></div> : null;

  return <div ref={reviewViewportRef} className={`${quiz.quizShell} ${!selfAssessment ? quiz.typedReviewShell : ""}`} data-study-session="active" data-details-open={studyDetailsExpanded || undefined} data-advancing={advancingQuestion || undefined} data-type={current.subject.object} style={{ "--subject-color": subjectColor(current.subject), "--jitai-font": jitaiFamily } as React.CSSProperties} role="region" aria-labelledby="study-prompt-title">
        <ReviewExitGuard pendingSubjects={pendingSubjectIds.size} />
        <div className={quiz.quizTopbar}>
          <div className={styles.sessionProgress}><span>{mixed ? "Mixed reviews" : mode === "lessons" ? "Lesson Quiz" : "Reviews"}</span><strong>{Math.min(displayTotal, displayCompleted + 1)} / {displayTotal}</strong></div>
        <div className={quiz.progressTrack} role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={displayTotal} aria-valuenow={displayCompleted}><span style={{ transform: `scaleX(${itemProgress})` } as React.CSSProperties} /></div>
          <div className={quiz.quizTopbarActions}><ReviewAccuracy {...(mixed?.accuracy ?? answerAccuracy)} />{mode === "lessons" ? <Button className={styles.bandAction} tone="ghost" size="small" onClick={startLessonsOver}>Start over</Button> : null}{wrapUpAvailable ? <Button className={styles.bandAction} tone="ghost" size="small" onClick={() => mixed?.onWrapUp ? mixed.onWrapUp() : wrapUp()}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}{!feedback ? <Button className={quiz.skipButton} tone="ghost" size="small" aria-label="Skip review" disabled={!questions.some((question) => question.assignment.id !== current.assignment.id)} onClick={skipCurrentQuestion}><SkipForward size={17} aria-hidden />Skip</Button> : null}{preferences.reviewSearchButtonEnabled ? <ButtonLink className={quiz.iconButton} href={`/search?q=${encodeURIComponent(searchQuery)}`} target="_blank" rel="noopener noreferrer" tone="ghost" size="small" aria-label="Search this item"><Search size={17} aria-hidden /></ButtonLink> : null}<Button className={quiz.iconButton} type="button" tone="ghost" size="small" aria-label="Add to saved lists" title="Add to saved lists" aria-pressed={subjectLists.lists.some((list) => list.subjectIds.includes(current.subject.id))} aria-haspopup="dialog" disabled={advancingQuestion} onClick={() => { recognitionRef.current?.stop(); setListDialogOpen(true); }}><Bookmark size={18} fill={subjectLists.lists.some((list) => list.subjectIds.includes(current.subject.id)) ? "currentColor" : "none"} aria-hidden /></Button><ReviewSettingsButton order={mode === "lessons" ? "lessonQuestionOrder" : "reviewOrder"} disabled={advancingQuestion} onOpenChange={(open) => { setReviewSettingsOpen(open); if (open) recognitionRef.current?.stop(); }} /><ButtonLink className={quiz.iconButton} href="/dashboard" tone="ghost" size="small" aria-label="Pause"><X size={19} aria-hidden /></ButtonLink></div>
        </div>

          {mixed ? (mixed.active ? <MixedPreviousBadge key={mixed.previous?.id} answer={mixed.previous} claimAnimation={mixed.claimPreviousAnimation} animate={preferences.reviewAnimatePreviousQuestion} /> : null) : previousAnswerItem ? <Link key={`${previousAnswerItem.subject.id}:${previousAnswerItem.kind}`} className={quiz.previousSubjectLink} target="_blank" rel="noopener noreferrer" data-type={previousAnswerItem.subject.object} data-animate={preferences.reviewAnimatePreviousQuestion || undefined} data-correct={previousAnswerItem.isCorrect} href={`/subjects/${previousAnswerItem.subject.id}`} aria-label={`Previous ${previousAnswerItem.kind} answer: ${primaryMeaning(previousAnswerItem.subject)}, ${previousAnswerItem.isCorrect ? "correct" : "incorrect"}`}><SubjectCharacter subject={previousAnswerItem.subject} className={quiz.previousSubjectCharacter} imageSize="1em" /><span className={quiz.previousSubjectStatus} data-correct={previousAnswerItem.isCorrect} aria-hidden>{previousAnswerItem.isCorrect ? <Check size={13} /> : <X size={13} />}</span></Link> : null}
      <header className={quiz.questionCard} aria-label={`${mode === "lessons" ? "Lesson quiz" : "Review"} prompt`}>
        {outboxMessage ? <p className={styles.syncNotice} role="alert">{outboxMessage}</p> : null}
          <h2 style={{ fontSize: reviewCharacterSize }}><SubjectCharacter subject={current.subject} className={current.subject.data.characters || current.subject.data.character_images?.length ? styles.characters : styles.subjectText} data-jitai-font={jitaiFamily && current.subject.data.characters ? true : undefined} style={{ fontSize: "inherit", fontFamily: jitaiFamily ?? reviewSubjectFont.style.fontFamily, fontWeight: 350, "--jitai-standard-font": reviewSubjectFont.style.fontFamily } as React.CSSProperties} eager /></h2>
          <VocabularyFrequencyBadge subject={current.subject} enabled={preferences.showVocabularyFrequency} />
          {showContextHint ? <div className={quiz.reviewContextHint}>
            <div className={styles.contextHintContent}>{contextSentences.map((sentence, index) => <div className={styles.contextHintSentenceGroup} key={`${sentence.ja}-${index}`}><p lang="ja">• {sentence.ja}</p>{contextTranslationOpen && sentence.en.trim() ? <p>• {sentence.en}</p> : null}</div>)}</div>
            {contextSentences.some((sentence) => sentence.en.trim()) ? <Button className={styles.contextHintButton} type="button" tone="ghost" size="small" aria-expanded={contextTranslationOpen} onClick={() => setContextTranslationOpen((open) => !open)}>{contextTranslationOpen ? "Hide translations" : "Show translations"}</Button> : null}
          </div> : null}
        {questionMetadata}
      </header>

      <div className={quiz.answerArea}>

        {selfAssessment ? <div className={quiz.promptTypeStrip} data-tone={current.kind}><span>{subjectType}</span><strong id="study-prompt-title" role="heading" aria-level={1}>{current.kind}</strong></div> : null}
        {selfAssessment && !feedback ? <AnkiAnswerContent studyKeys={studyKeys} detailsOpen={studyDetailsShouldOpen} keyboardShortcuts={preferences.keyboardShortcuts}
          revealed={ankiRevealed}
          questionKind={current.kind}
          groupQuestions={groupedSelfAssessment}
          meaningAnswer={ankiMeaningAnswer}
          readingAnswer={ankiReadingAnswer}
          otherMeaningAnswers={otherMeaningAnswers}
          otherReadingAnswers={otherReadingAnswers}
          userSynonyms={material?.data.meaning_synonyms}
          partsOfSpeech={current.subject.data.parts_of_speech}
          pitchAccents={detailEnrichments.data?.pitchAccents}
          showOtherAcceptedAnswersAndUserSynonyms={preferences.ankiShowOtherAcceptedAnswersAndUserSynonyms}
          showWaniKaniGrammarTags={preferences.ankiShowWaniKaniGrammarTags}
          showPitchAccentNumbers={preferences.ankiShowPitchAccentNumbers}
          showPitchAccentGraph={preferences.ankiShowPitchAccentGraph}
          showReplayAudioButton={Boolean(audioFor(current.subject, preferences.vocabularyAudioVoice))}
          buttonlessMode={preferences.ankiButtonlessMode}
          replayingAudio={replayingAudio}
          onReveal={revealSelfAssessmentAnswer}
          onReplayAudio={() => replayAudio(current.subject)}
          onGradeIncorrect={() => gradeSelf(false)}
          onGradeCorrect={() => gradeSelf(true)}
          onShowDetails={toggleStudyDetails}
          onSkip={skipCurrentQuestion}
        /> : null}

        {!selfAssessment ? <form className={quiz.answerForm} data-result={answerResult} onSubmit={submit}>
          <label className={quiz.promptTypeStrip} data-tone={current.kind} htmlFor="review-answer"><span>{subjectType}</span><strong id="study-prompt-title" role="heading" aria-level={1}>{current.kind}</strong>{current.kind === "reading" ? <small>Romaji → かな</small> : null}</label>
          <div className={quiz.answerInputRow} data-result={answerResult}>
            <input
              ref={answerInputRef}
              id="review-answer"
              name="review-answer"
              aria-label="Your answer"
              style={{ fontSize: phoneInput ? "max(16px, 1rem)" : "1rem" }}
              value={answer}
              onChange={(event) => {
                if (feedback && feedback.status !== "blocked") return;
                if (feedback?.status === "blocked") setFeedback(null);
                setAnswer(current.kind === "reading" ? composeKanaInput(event.target.value) : event.target.value);
              }}
              onKeyDown={(event) => {
                if (!feedback || event.key !== "Enter") return;
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                if (event.repeat || addSynonymMutation.isPending) return;
                if (unresolvedCloseAnswer) resolveCloseAnswer(true);
                else void advance();
              }}
              readOnly={!phoneInput && Boolean(feedback && feedback.status !== "blocked")}
              enterKeyHint={phoneInput ? "go" : undefined}
              aria-describedby="review-answer-helper"
              autoComplete="off"
              spellCheck={current.kind !== "reading"}
              inputMode={current.kind === "reading" ? "text" : undefined}
              placeholder={current.kind === "reading" ? "Type kana or romaji…" : "Type the English meaning…"}
            />
            <Button
              className={quiz.primaryButton}
              tone="primary"
              type={feedback ? "button" : "submit"}
              onMouseDown={preservePhoneInputFocus}
              onClick={feedback ? () => void advance() : undefined}
              disabled={feedback ? unresolvedCloseAnswer || advancingQuestion || addSynonymMutation.isPending : !answer.trim()}
             
            >{feedback ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}{feedback ? unresolvedCloseAnswer ? "Choose result" : feedback.status === "blocked" ? "Try Again" : "Next" : "Check"}</Button>
          </div>
          <p id="review-answer-helper" className="sr-only">{current.kind === "reading" ? "Kana and romaji are accepted." : preferences.acceptUserSynonymsAsAnswers ? "Accepted meanings and your synonyms are checked." : "Accepted WaniKani meanings are checked."}</p>
        </form> : null}

        <div className={quiz.reviewProgressionSlot}>
          {mixed?.bunproProgression ? <BunproProgression progression={mixed.bunproProgression} mode={preferences.srsProgressionCardDisplayMode} /> : <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} />}
        </div>

        {speechError ? <p className={styles.error} role="alert">{speechError}</p> : null}
        {feedback ? <div className={quiz.answerStatus} role="status" aria-live="polite">
          <strong className={quiz.answerVerdict} data-correct={feedback.status === "correct"} data-warning={answerResult === "warning"}>{feedback.status === "correct" ? <Check size={18} aria-hidden /> : feedback.status === "incorrect" ? <X size={18} aria-hidden /> : <RotateCcw size={18} aria-hidden />}{feedback.status === "correct" ? "Correct" : feedback.status === "close" ? "Accepted with a typo" : feedback.status === "blocked" ? "Try another answer" : "Incorrect"}</strong>
          {feedback.status === "incorrect" ? <span className={quiz.correctAnswer}><small>Correct answer</small><strong lang={current.kind === "reading" ? "ja" : undefined}>{canonicalAnswer(current.subject, current.kind)}</strong></span> : feedback.status !== "correct" || feedback.message.startsWith("Added") || feedback.message.startsWith("Marked") ? <span>{feedback.message}</span> : null}
          {sessionError ? <p className={styles.error} role="alert">{sessionError}</p> : null}
        </div> : null}
        <div className={quiz.reviewAnswerControls}>
          {preferences.voiceAnswers && !selfAssessment ? <Button className={quiz.textButton} type="button" tone="ghost" disabled={!voiceAvailable || listening || Boolean(feedback)} aria-label={!voiceAvailable ? "Voice answer unavailable" : listening ? "Listening for voice answer" : "Voice answer"} onClick={startVoiceAnswer}><Mic size={17} aria-hidden /><span>{listening ? "Listening…" : "Voice"}</span></Button> : null}
          {feedback && feedback.status !== "blocked" ? <div className={quiz.closeAnswerActions} aria-label="Answer result controls">
            <Button aria-label="Mark Incorrect" className={quiz.correctionButton} type="button" tone="ghost" disabled={advancingQuestion || addSynonymMutation.isPending} onMouseDown={preservePhoneInputFocus} onClick={() => !unresolvedCloseAnswer && !lastCorrect ? advance() : markAnswer(false)}><X size={17} aria-hidden />Mark Incorrect{preferences.keyboardShortcuts ? <kbd aria-hidden>{!unresolvedCloseAnswer && !lastCorrect ? shortcutLabel(studyKeys.progress) : shortcutLabel(studyKeys.markIncorrect)}</kbd> : null}</Button>
            {unresolvedCloseAnswer || !lastCorrect ? <Button aria-label="Mark Correct" className={quiz.correctionButton} type="button" tone="ghost" disabled={advancingQuestion || addSynonymMutation.isPending} onMouseDown={preservePhoneInputFocus} onClick={() => markAnswer(true)}><Check size={17} aria-hidden />Mark Correct{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(studyKeys.markCorrect)}</kbd> : null}</Button> : null}
            {canAddSynonym ? <Button aria-label="Add as synonym" className={quiz.correctionButton} type="button" tone="ghost" disabled={addSynonymMutation.isPending || advancingQuestion} state={addSynonymMutation.isPending ? "loading" : "idle"} onMouseDown={preservePhoneInputFocus} onClick={() => addSynonymMutation.mutate({ subject: current.subject, assignmentId: current.assignment.id, kind: current.kind, synonym: synonymCandidate, existingMaterial: material })}><Plus size={17} aria-hidden />Add as synonym{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(studyKeys.addSynonym)}</kbd> : null}</Button> : null}
            {selfAssessment && !unresolvedCloseAnswer ? <Button tone="primary" disabled={advancingQuestion || addSynonymMutation.isPending} onClick={() => void advance()}>Next Question<ArrowRight size={17} /></Button> : null}
          </div> : null}

          {revealStudyDetails && (!selfAssessment || feedback || preferences.ankiButtonlessMode) ? <div className={quiz.reviewTools} aria-label="Answer controls">
            <Button className={quiz.itemDetailsButton} type="button" tone="ghost" disabled={!revealStudyDetails || advancingQuestion} aria-controls="study-item-details" aria-expanded={studyDetailsShouldOpen} onClick={toggleStudyDetails}><BookOpen size={17} aria-hidden /><span>{studyDetailsShouldOpen ? "Hide subject details" : "Show subject details"}</span>{preferences.keyboardShortcuts ? <kbd>{shortcutLabel(studyKeys.details)}</kbd> : null}{studyDetailsShouldOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}</Button>
            {audioFor(current.subject, preferences.vocabularyAudioVoice) ? <Button className={quiz.textButton} type="button" tone="ghost" onClick={() => void playAudio(current.subject)}><Volume2 size={17} aria-hidden /><span>Audio</span>{preferences.keyboardShortcuts ? <kbd aria-hidden>R</kbd> : null}</Button> : null}
          </div> : null}

        </div>

        <ReviewDetailsReveal open={studyDetailsExpanded} revealInViewport>
          {revealStudyDetails ? <section id="study-item-details" className={quiz.itemDetails} aria-labelledby="study-details-title" style={{ "--subject-color": subjectColor(current.subject) } as React.CSSProperties}>
            <header className={quiz.itemDetailsHeader}>
              <div className={quiz.itemDetailsIdentity}>
                <SubjectCharacter subject={current.subject} className={quiz.itemDetailsCharacter} imageTone="subject" eager />
                <div><h3 id="study-details-title">Subject details</h3><p>Level {current.subject.data.level} · {subjectType}</p></div>
              </div>
              <Link className={quiz.itemDetailsLink} href={`/subjects/${current.subject.id}`} target="_blank" rel="noopener noreferrer">Open full subject<ExternalLink size={15} aria-hidden /></Link>
            </header>
            <SubjectDetailPanels
              key={`${current.id}:${current.kind}`}
              record={current.subject}
              assignment={current.assignment}
              reviewStatistic={detailStatistic.data?.[0]}
              material={material}
              materialLoading={materialsQuery.isLoading}
              materialsKey={materialsKey}
              relatedSubjects={detailRelations.data ?? []}
              pitchAccents={detailEnrichments.data?.pitchAccents ?? []}
              usagePatterns={detailEnrichments.data?.patterns ?? []}
              immersionExamples={detailImmersion.data ?? []}
              immersionLoading={detailImmersion.isLoading}
              immersionFailed={detailImmersion.isError}
              settings={detailSettings}
              returnTo={mode === "reviews" ? "/reviews" : "/lessons"}
              initialTab={current.kind}
              idPrefix="study-subject"
              embedded
            />
          </section> : null}
        </ReviewDetailsReveal>
        <AddToSubjectListsDialog
          key={current.subject.id}
          open={listDialogOpen}
          subjectId={current.subject.id}
          subjectLabel={current.subject.data.characters || current.subject.data.slug}
          subjectType={current.subject.object}
          subjectLists={subjectLists}
          onClose={() => setListDialogOpen(false)}
        />
        <div className={quiz.reviewKeyboardHint}>
          {preferences.keyboardShortcuts && !(selfAssessment && ankiRevealed && !feedback) ? <p className={quiz.keyboardHint}>Press <kbd>{shortcutLabel(studyKeys.progress)}</kbd> to {feedback ? "continue" : selfAssessment ? "reveal" : "check"}{revealStudyDetails ? <> · <kbd>{shortcutLabel(studyKeys.details)}</kbd> toggles details{audioFor(current.subject, preferences.vocabularyAudioVoice) ? <> · <kbd>{shortcutLabel(studyKeys.replayAudio)}</kbd> replays audio</> : null}</> : null}</p> : null}
        </div>
      </div>
  </div>;
}
