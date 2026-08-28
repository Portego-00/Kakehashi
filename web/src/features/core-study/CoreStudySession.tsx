"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ExternalLink, Info, Mic, Plus, RotateCcw, Search, SkipForward, Umbrella, Volume2, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LoadingState, Skeleton } from "@/components/ui/States";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { composeKanaInput } from "@/lib/kana";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import { SubjectDetailPanels, type SubjectDetailTab } from "@/features/subjects/components/SubjectDetail";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { useSession } from "@/lib/session";
import { WaniKaniApiError, wkCollection, wkRequest } from "@/lib/wanikani/client";
import { userQuery, wkKeys } from "@/lib/wanikani/queries";
import type { Assignment, ReviewCreateResponse, ReviewStatistic, StudyMaterial, Subject } from "@/types/wanikani";
import { AnkiAnswerContent } from "./AnkiAnswerContent";
import { LessonTeaching } from "./LessonTeaching";
import { VocabularyFrequencyBadge } from "./VocabularyFrequencyBadge";
import { checkAnswer, type AnswerResult, type QuestionKind } from "./answer-checker";
import { createQuestionQueue, kindsForSubject, lessonAssignments, moveCoreQuestionPairToEnd, reviewAssignments, type CoreQuestion } from "./queue";
import { deliverReview, enqueueReview, loadReviewOutbox, noteReviewFailure, removeReview } from "./review-outbox";
import { coreSessionKey, lessonsStartedToday, recordLessonStarted, selectCoreAssignments } from "./session-planning";
import { speechRecognitionConstructor, type BrowserSpeechRecognition } from "./speech-recognition";
import { canonicalAnswer, questionOrderForMode, shouldPauseAfterResult, usesSelfAssessment } from "./study-preferences";
import { canRevealStudyDetails, vacationDateLabel, vacationStartedAt, vacationStudyMessage, WANIKANI_VACATION_SETTINGS_URL } from "./vacation";
import styles from "./core-study.module.css";
import { pickPreferredPronunciationAudios } from "../../../../src/utils/pronunciationAudio";

type Mode = "lessons" | "reviews";
type Phase = "loading" | "resume" | "teaching" | "quiz" | "results";
type ErrorCounts = Record<number, { meaning: number; reading: number }>;
type SrsProgression = { startingStage: number; endingStage: number; nextReviewInterval: string; isCorrect: boolean };
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
const SESSION_MAX_AGE = 24 * 60 * 60_000;
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
    const age = parsed?.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : 0;
    const validIds = Array.isArray(subjectIds)
      && subjectIds.length > 0
      && subjectIds.every((id) => Number.isInteger(id) && id > 0)
      && new Set(subjectIds).size === subjectIds.length;
    if (!validIds || !Number.isInteger(parsed?.index) || parsed!.index! < 0 || parsed!.index! >= subjectIds.length || !lessonTeachingTabs.has(parsed?.tab as SubjectDetailTab) || age > SESSION_MAX_AGE) {
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

function SrsProgressionNotice({ progression, mode }: { progression: SrsProgression; mode: "normal" | "compact" }) {
  const endingLabel = srsStageLabel(progression.endingStage);
  return <aside className={styles.srsProgression} data-mode={mode} data-correct={progression.isCorrect} role="status" aria-label="SRS progression">
    {mode === "normal" ? <span>{srsStageLabel(progression.startingStage)} →</span> : null}
    <strong>{endingLabel}</strong>
    <small>{progression.endingStage >= 9 ? "Burned" : `Next review ${progression.nextReviewInterval}`}</small>
  </aside>;
}

function SrsProgressionSlot({ progression, mode, idleContent = null }: { progression: SrsProgression | null; mode: "normal" | "compact" | "hidden"; idleContent?: ReactNode }) {
  if (mode === "hidden") return idleContent;
  return <div
    className={styles.srsProgressionSlot}
    data-srs-progression-slot
    data-mode={mode}
    data-progression-visible={Boolean(progression)}
  >
    {progression ? <SrsProgressionNotice progression={progression} mode={mode} /> : idleContent}
  </div>;
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

export function CoreStudySession({ mode }: { mode: Mode }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const currentUserQuery = useQuery(userQuery());
  const liveUser = currentUserQuery.data ?? user;
  const currentVacationStartedAt = vacationStartedAt(liveUser);
  const isOnVacation = Boolean(currentVacationStartedAt);
  const username = liveUser?.data.username || user?.data.username || "anonymous";
  const webSettings = useWebSettings(username);
  const preferences = webSettings.study;
  const [phase, setPhase] = useState<Phase>("loading");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonTab, setLessonTab] = useState<SubjectDetailTab>("meaning");
  const [lessonTeachingSnapshot, setLessonTeachingSnapshot] = useState<LessonTeachingSnapshot | null>(null);
  const [lessonBatchIds, setLessonBatchIds] = useState<number[] | null>(mode === "reviews" ? [] : null);
  const [lessonBatchStorageReady, setLessonBatchStorageReady] = useState(mode === "reviews");
  const [questions, setQuestions] = useState<CoreQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [completed, setCompleted] = useState<Record<number, QuestionKind[]>>({});
  const [errors, setErrors] = useState<ErrorCounts>({});
  const [submittedIds, setSubmittedIds] = useState<number[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [resumeSnapshot, setResumeSnapshot] = useState<SessionSnapshot | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const [wrapUpActive, setWrapUpActive] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [outboxMessage, setOutboxMessage] = useState("");
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

  useEffect(() => {
    if (!srsProgression) return;
    const timer = window.setTimeout(() => setSrsProgression(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [srsProgression]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLessonStartsToday(lessonsStartedToday(window.localStorage, username));
      setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (mode !== "lessons") return;
    const timer = window.setTimeout(() => {
      const snapshot = loadLessonTeachingSession(window.localStorage, username);
      setLessonTeachingSnapshot(snapshot);
      setLessonBatchIds(snapshot?.subjectIds ?? null);
      setLessonBatchStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, username]);

  const assignmentQuery = useQuery({
    queryKey: ["core-study", mode, "assignments"],
    queryFn: () => wkCollection<Assignment>(mode === "reviews" ? "assignments?immediately_available_for_review=true" : "assignments?immediately_available_for_lessons=true"),
    enabled: currentUserQuery.isSuccess && !isOnVacation,
    staleTime: 30_000,
  });
  const available = useMemo(() => mode === "reviews" ? reviewAssignments(assignmentQuery.data || []) : lessonAssignments(assignmentQuery.data || []), [assignmentQuery.data, mode]);
  const candidateAssignments = available;
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
    () => selectCoreAssignments(candidateAssignments, subjects, mode, preferences, assignmentLimit, { userLevel: liveUser?.data.level ?? 1 }),
    [assignmentLimit, candidateAssignments, liveUser?.data.level, mode, preferences, subjects],
  );
  const lessonAssignmentBySubjectId = useMemo(() => new Map(
    [...candidateAssignments, ...(restoredAssignmentsQuery.data ?? [])].map((assignment) => [assignment.data.subject_id, assignment]),
  ), [candidateAssignments, restoredAssignmentsQuery.data]);
  const restoredLessonAssignments = useMemo(() => lessonBatchIds?.map((subjectId) => lessonAssignmentBySubjectId.get(subjectId)).filter((assignment): assignment is Assignment => Boolean(assignment)) ?? [], [lessonAssignmentBySubjectId, lessonBatchIds]);
  const lessonBatchResolved = mode !== "lessons" || Boolean(
    lessonBatchStorageReady
    && lessonBatchIds !== null
    && (lessonBatchIds.length === 0 || restoredLessonAssignments.length === lessonBatchIds.length),
  );

  useEffect(() => {
    if (mode !== "lessons" || !lessonBatchStorageReady || !assignmentQuery.isSuccess || !subjectsQuery.isSuccess) return;
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
  }, [assignmentQuery.isSuccess, lessonBatchIds, lessonBatchStorageReady, mode, plannedAssignments, restoredAssignmentsQuery.isError, restoredAssignmentsQuery.isLoading, restoredLessonAssignments.length, subjectsQuery.isSuccess, username]);

  const selectedAssignments = useMemo(() => {
    if (mode !== "lessons") return plannedAssignments;
    return lessonBatchResolved ? restoredLessonAssignments : [];
  }, [lessonBatchResolved, mode, plannedAssignments, restoredLessonAssignments]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const selectedSubjects = useMemo(() => selectedAssignments.map((assignment) => subjectById.get(assignment.data.subject_id)).filter((subject): subject is Subject => Boolean(subject)), [selectedAssignments, subjectById]);
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
    if (!subjectsQuery.isSuccess || !lessonBatchResolved) return;
    const initializationKey = `${username}:${mode}:${selectedAssignments.map((assignment) => assignment.id).join(",")}`;
    if (initializedSessionKeyRef.current === initializationKey) return;
    const queue = makeQueue();
    const timer = window.setTimeout(() => {
      if (initializedSessionKeyRef.current === initializationKey) return;
      initializedSessionKeyRef.current = initializationKey;
      let restored: SessionSnapshot | null = null;
      try {
        const raw = window.localStorage.getItem(coreSessionKey(username, mode));
        const parsed = raw ? JSON.parse(raw) as Partial<SessionSnapshot> : null;
        const age = parsed?.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : 0;
        if (parsed && Array.isArray(parsed.questionIds) && parsed.completed && parsed.errors && Array.isArray(parsed.submittedIds) && age <= SESSION_MAX_AGE) restored = parsed as SessionSnapshot;
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
  }, [lessonBatchResolved, lessonTeachingSnapshot, subjectsQuery.isSuccess, selectedAssignments, selectedSubjects, selectedIds, mode, makeQueue, username]);

  useEffect(() => {
    if (phase !== "quiz") return;
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

  useEffect(() => {
    if (phase !== "quiz" || !questions[0]) return;
    if (!window.matchMedia("(min-width: 48rem)").matches) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase, questions]);

  useEffect(() => {
    if (mode !== "reviews" || isOnVacation || !assignmentQuery.isSuccess || username === "anonymous") return;
    let cancelled = false;
    const drain = async () => {
      const pending = loadReviewOutbox(window.localStorage, username);
      if (!pending.length) return;
      setOutboxMessage(`Recovering ${pending.length} saved review${pending.length === 1 ? "" : "s"}…`);
      let recovered = 0;
      for (const entry of pending) {
        try {
          await deliverReview(entry, {
            readAssignment: (assignmentId) => wkRequest<Assignment>(`assignments/${assignmentId}`, { cache: "no-store", fresh: true }),
            submitReview: async (queued) => { await wkRequest<ReviewCreateResponse>("reviews", { method: "POST", body: { review: { assignment_id: queued.assignmentId, incorrect_meaning_answers: queued.incorrectMeaningAnswers, incorrect_reading_answers: queued.incorrectReadingAnswers, created_at: queued.createdAt } } }); },
          });
          removeReview(window.localStorage, username, entry.assignmentId);
          recovered += 1;
        } catch (cause) {
          noteReviewFailure(window.localStorage, username, entry.assignmentId, formatFailure(cause, "It remains saved for another retry."));
          if (cause instanceof WaniKaniApiError && cause.status === 429) break;
        }
      }
      if (cancelled) return;
      const remaining = loadReviewOutbox(window.localStorage, username).length;
      setOutboxCount(remaining);
      setOutboxMessage(remaining ? `${remaining} completed review${remaining === 1 ? " is" : "s are"} saved for retry.` : recovered ? "Saved review progress was reconciled with WaniKani." : "");
      if (recovered) await queryClient.invalidateQueries({ queryKey: wkKeys.assignments() });
    };
    void drain();
    return () => { cancelled = true; };
  }, [mode, isOnVacation, assignmentQuery.isSuccess, username, queryClient]);

  const current = questions[0];
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
  const totalItems = sessionItemIds.size || selectedAssignments.length;
  const completedItems = submittedIds.filter((id) => sessionItemIds.has(id)).length;
  const currentUsesSelfAssessment = Boolean(current && usesSelfAssessment(current.kind, preferences));
  const revealStudyDetails = canRevealStudyDetails(mode, feedback?.status) || Boolean(currentUsesSelfAssessment && ankiRevealed);
  const answerStopped = Boolean(feedback && feedback.status !== "blocked" && shouldPauseAfterResult(feedback.status, preferences));
  const unresolvedCloseAnswer = feedback?.status === "close" && preferences.pauseOnClose;
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
    const frame = window.requestAnimationFrame(() => setStudyDetailsExpanded(studyDetailsShouldOpen));
    return () => window.cancelAnimationFrame(frame);
  }, [studyDetailsShouldOpen]);

  const reviewMutation = useMutation({
    mutationFn: async (payload: { assignmentId: number; counts: { meaning: number; reading: number } }) => {
      if (isOnVacation) throw new Error(vacationStudyMessage("reviews"));
      const entry = enqueueReview(window.localStorage, username, { assignmentId: payload.assignmentId, incorrectMeaningAnswers: payload.counts.meaning, incorrectReadingAnswers: payload.counts.reading, createdAt: new Date().toISOString() });
      setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
      try {
        const responses: ReviewCreateResponse[] = [];
        const delivery = await deliverReview(entry, {
          readAssignment: (assignmentId) => wkRequest<Assignment>(`assignments/${assignmentId}`, { cache: "no-store", fresh: true }),
          submitReview: async (queued) => { responses.push(await wkRequest<ReviewCreateResponse>("reviews", { method: "POST", body: { review: { assignment_id: queued.assignmentId, incorrect_meaning_answers: queued.incorrectMeaningAnswers, incorrect_reading_answers: queued.incorrectReadingAnswers, created_at: queued.createdAt } } })); },
        });
        removeReview(window.localStorage, username, payload.assignmentId);
        setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
        return delivery === "submitted" ? responses[0] ?? null : null;
      } catch (cause) {
        noteReviewFailure(window.localStorage, username, payload.assignmentId, formatFailure(cause, "It remains saved for another retry."));
        throw cause;
      }
    },
    retry: 0,
  });
  const lessonMutation = useMutation({
    mutationFn: (assignmentId: number) => {
      if (isOnVacation) throw new Error(vacationStudyMessage("lessons"));
      return wkRequest<Assignment>(`assignments/${assignmentId}/start`, { method: "PUT", body: { assignment: { started_at: new Date().toISOString() } } });
    },
    onSuccess: (_, assignmentId) => {
      recordLessonStarted(window.localStorage, username, assignmentId);
    },
    retry: 0,
  });

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
    recognition.onresult = (event) => { setAnswer(event.results[0]?.[0]?.transcript?.trim() || ""); setSpeechError(""); };
    recognition.onerror = (event) => setSpeechError(event.error === "not-allowed" ? "Microphone permission was denied. You can keep typing." : "The browser could not recognize that answer. Try again or type it.");
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setSpeechError("");
    setListening(true);
    try { recognition.start(); } catch { setListening(false); setSpeechError("Speech recognition could not start. You can keep typing."); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || feedback) return;
    const result = checkAnswer(current.subject, current.kind, answer, preferences.acceptUserSynonymsAsAnswers ? material : undefined, current.kind === "reading" ? { singleKanjiReadings, acceptAnyKanjiOnyomiReading: preferences.acceptAnyKanjiOnyomiReading } : undefined);
    setFeedback(result);
    if (result.status === "blocked") return;
    setAnsweredKinds([current.kind]);
    const correct = result.status === "correct" || result.status === "close";
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (preferences.answerFeedbackSoundEnabled && !(result.status === "close" && preferences.pauseOnClose)) playAnswerFeedback(correct);
    if (result.status === "correct" && current.kind === "reading" && preferences.autoplayAudio && audioFor(current.subject, preferences.vocabularyAudioVoice)) void playAudio(current.subject);
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
  }

  function resolveCloseAnswer(correct: boolean) {
    if (!current || feedback?.status !== "close" || !preferences.pauseOnClose || advancingQuestionRef.current) return;
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    advance(correct);
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
    if (nextOpen) window.requestAnimationFrame(() => document.getElementById("study-item-details")?.scrollIntoView({ block: "start" }));
  }

  async function advanceNow(correctOverride?: boolean) {
    if (!current || !feedback || feedback.status === "blocked") {
      if (feedback?.status === "blocked") setAnswer("");
      setFeedback(null);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSessionError("");
    const resolvedAnsweredKinds = answeredKinds.length ? answeredKinds : [current.kind];
    const resolvedCorrect = correctOverride ?? lastCorrect;
    const answeredKindSet = new Set(resolvedAnsweredKinds);
    const retryQuestions = resolvedAnsweredKinds.map((kind) => questions.find((question) => question.assignment.id === current.assignment.id && question.kind === kind) || { ...current, id: `${current.assignment.id}:${kind}`, kind });
    const remaining = questions.filter((question, index) => index !== 0 && !(question.assignment.id === current.assignment.id && answeredKindSet.has(question.kind)));
    if (mode === "reviews") setPreviousAnswerItem({ subject: current.subject, kind: current.kind, isCorrect: resolvedCorrect });
    if (!resolvedCorrect) {
      const retryImmediately = preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect;
      setQuestions(retryImmediately ? [...retryQuestions, ...remaining] : [...remaining, ...retryQuestions]);
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      setAnsweredKinds([]);
      setContextTranslationOpen(false);
      setStudyDetailsOverride(null);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const finishedKinds = [...(completed[current.assignment.id] || []), ...resolvedAnsweredKinds].filter((value, index, all) => all.indexOf(value) === index);
    const subjectDone = kindsForSubject(current.subject).every((kind) => finishedKinds.includes(kind));
    try {
      if (subjectDone && !submittedIds.includes(current.assignment.id)) {
        if (mode === "reviews") {
          const response = await reviewMutation.mutateAsync({ assignmentId: current.assignment.id, counts: errors[current.assignment.id] || { meaning: 0, reading: 0 } });
          if (response && preferences.srsProgressionCardDisplayMode !== "hidden") {
            const startingStage = response.data.starting_srs_stage;
            const endingStage = response.data.ending_srs_stage;
            setReserveResultsProgressionSlot(remaining.length === 0);
            setSrsProgression({ startingStage, endingStage, isCorrect: endingStage > startingStage, nextReviewInterval: formatNextReviewInterval(response.resources_updated?.assignment?.data.available_at, endingStage) });
          }
        } else await lessonMutation.mutateAsync(current.assignment.id);
        setSubmittedIds((previous) => [...previous, current.assignment.id]);
      }
      setCompleted((previous) => ({ ...previous, [current.assignment.id]: finishedKinds }));
      setQuestions(remaining);
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      setAnsweredKinds([]);
      setContextTranslationOpen(false);
      setStudyDetailsOverride(null);
      if (!remaining.length) {
        window.localStorage.removeItem(coreSessionKey(username, mode));
        if (mode === "lessons") clearLessonTeachingSession(window.localStorage, username);
        await Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]);
        setDisplayNow(Date.now());
        setPhase("results");
      } else window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) {
      setSessionError(formatFailure(cause, mode === "reviews" ? "The completed review is saved locally and will reconcile before another submission." : "The lesson remains in place; retry when the connection returns."));
    }
  }

  function advance(correctOverride?: boolean) {
    if (advancingQuestionRef.current || (unresolvedCloseAnswer && correctOverride === undefined)) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const collapseDetailsFirst = (studyDetailsOpen || studyDetailsExpanded) && !reducedMotion;
    advancingQuestionRef.current = true;

    const run = () => {
      advanceTimerRef.current = null;
      void advanceNow(correctOverride).finally(() => {
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
    advanceTimerRef.current = window.setTimeout(run, 280);
  }

  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (!feedback || feedback.status === "blocked" || shouldPauseAfterResult(feedback.status, preferences)) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [feedback, lastCorrect, preferences]);

  useEffect(() => {
    if (phase !== "quiz" || !preferences.keyboardShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && unresolvedCloseAnswer) {
        if (shouldIgnoreReviewShortcut(event)) return;
        event.preventDefault();
        if (!reviewMutation.isPending && !lessonMutation.isPending) resolveCloseAnswer(true);
        return;
      }
      if (event.key === "Enter" && feedback) {
        if (shouldIgnoreReviewAdvance(event)) return;
        event.preventDefault();
        if (!reviewMutation.isPending && !lessonMutation.isPending) void advance();
        return;
      }
      if (event.key === "Enter" && shouldIgnoreReviewShortcut(event)) return;
      if (event.key === "Enter" && current && usesSelfAssessment(current.kind, preferences) && !feedback) {
        event.preventDefault();
        if (!ankiRevealed) revealSelfAssessmentAnswer();
      }
      if (ankiRevealed && !feedback && (event.key === "1" || event.key === "2")) {
        event.preventDefault();
        gradeSelf(event.key === "2");
      }
      if (event.key === " " && current && !shouldIgnoreReviewShortcut(event)) {
        event.preventDefault();
        void playAudio(current.subject);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function wrapUp() {
    const keep = new Set<number>();
    for (const question of questions) {
      if (keep.size >= preferences.reviewWrapUpSize && !keep.has(question.assignment.id)) continue;
      keep.add(question.assignment.id);
    }
    const trimmed = questions.filter((question) => keep.has(question.assignment.id));
    setQuestions(trimmed);
    setTotalQuestions(answered + trimmed.length);
    setWrapUpActive(true);
  }

  function skipCurrentQuestion() {
    if (!current || feedback || mode !== "reviews") return;
    setQuestions(moveCoreQuestionPairToEnd(questions));
    setAnswer("");
    setAnkiRevealed(false);
    setAnsweredKinds([]);
    setContextTranslationOpen(false);
    setStudyDetailsOverride(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function continueSavedSession() {
    setResumeSnapshot(null);
    setPhase("quiz");
  }

  function restartSession() {
    window.localStorage.removeItem(coreSessionKey(username, mode));
    let queue = makeQueue();
    if (mode === "lessons") {
      clearLessonTeachingSession(window.localStorage, username);
      const subjectIds = plannedAssignments.map((assignment) => assignment.data.subject_id);
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
    setQuestions(queue);
    setTotalQuestions(queue.length);
    setLessonIndex(0);
    setLessonTab("meaning");
    setAnkiRevealed(false);
    setAnsweredKinds([]);
    setContextTranslationOpen(false);
    setStudyDetailsOverride(null);
    setReserveResultsProgressionSlot(false);
    setSessionStartedAt(new Date().toISOString());
    setPhase(mode === "lessons" ? "loading" : queue.length ? "quiz" : "results");
  }

  if (currentVacationStartedAt) return <div className={styles.stage}><section className={styles.vacationPause} role="status"><div className={styles.vacationIcon}><Umbrella size={28} aria-hidden /></div><div><h1>Vacation Mode</h1><p>{vacationStudyMessage(mode)}</p><span>On vacation since {vacationDateLabel(currentVacationStartedAt)}</span></div><div className="cluster"><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink><a href={WANIKANI_VACATION_SETTINGS_URL} target="_blank" rel="noreferrer">Turn off in WaniKani</a></div></section></div>;
  if (currentUserQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Study availability could not be checked</h1><p className={styles.error} role="alert">Kakehashi could not confirm whether Vacation Mode is active. No lesson or review session has been started.</p><div className="cluster"><Button onClick={() => void currentUserQuery.refetch()}>Try Again</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></div></div>;
  if (currentUserQuery.isLoading) return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><LoadingState compact label="Checking Vacation Mode" detail="No study session starts until your current account state is confirmed." /></div></div>;
  if (assignmentQuery.error || subjectsQuery.error || (restoredAssignmentsQuery.error && !lessonBatchResolved)) return <div className={styles.stage}><div className={styles.loading}><h1>{mode === "lessons" ? "Lessons" : "Reviews"} could not load</h1><p className={styles.error} role="alert">{formatFailure(assignmentQuery.error || subjectsQuery.error || restoredAssignmentsQuery.error, "Refresh when the connection is available.")}</p><Button onClick={() => {
    if (assignmentQuery.error) void assignmentQuery.refetch();
    if (subjectsQuery.error) void subjectsQuery.refetch();
    if (restoredAssignmentsQuery.error) void restoredAssignmentsQuery.refetch();
  }}>Try Again</Button></div></div>;
  if (materialsQuery.error || answerContextQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Answer data could not load</h1><p className={styles.error} role="alert">{formatFailure(materialsQuery.error || answerContextQuery.error, "Retry before answering so personal synonyms and reading warnings are checked correctly.")}</p><Button onClick={() => { if (materialsQuery.error) void materialsQuery.refetch(); if (answerContextQuery.error) void answerContextQuery.refetch(); }}>Try Again</Button></div></div>;
  if (assignmentQuery.isLoading || subjectsQuery.isLoading || materialsQuery.isLoading || answerContextQuery.isLoading || phase === "loading") return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><Skeleton height="4rem" /><LoadingState compact label={`Loading ${mode}`} detail="Fetching the queue and answer data for your first item." /></div></div>;

  if (phase === "resume" && resumeSnapshot) {
    const age = resumeSnapshot.savedAt ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((displayNow - new Date(resumeSnapshot.savedAt).getTime()) / 60_000)), "minute") : "earlier";
    const remainingItems = new Set(questions.map((question) => question.assignment.id)).size;
    return <div className={styles.stage}><section className={styles.resume}><RotateCcw size={36} aria-hidden /><div><h1>Resume {mode}?</h1><p>Your saved session has {remainingItems} {remainingItems === 1 ? "item" : "items"} remaining and was updated {age}.</p></div><div className="cluster"><Button tone="primary" onClick={continueSavedSession}>Continue Session</Button><Button tone="ghost" onClick={restartSession}>Start Fresh</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></section></div>;
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
      onStartReview={() => {
        setLessonTab("meaning");
        setPhase("quiz");
      }}
    />;
  }

  if (phase === "results") {
    const incorrect = Object.values(errors).reduce((total, row) => total + row.meaning + row.reading, 0);
    const attempts = Math.max(1, progress + incorrect);
    const accuracy = selectedAssignments.length ? Math.round((progress / attempts) * 100) : 0;
    const minutes = Math.max(1, Math.round((displayNow - new Date(sessionStartedAt).getTime()) / 60_000));
    const dailyLimitReached = mode === "lessons" && preferences.dailyLessonLimit > 0 && dailyRemaining <= 0 && available.length > 0;
    return <div className={styles.stage}>{reserveResultsProgressionSlot ? <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} /> : null}<section className={styles.results}><Check size={44} style={{ marginInline: "auto", color: "var(--color-success)" }} aria-hidden /><div><h1>{selectedAssignments.length ? `${mode === "lessons" ? "Lessons" : "Reviews"} Complete` : dailyLimitReached ? "Daily Lesson Limit Reached" : `No ${mode} Waiting`}</h1><p>{selectedAssignments.length ? outboxCount ? "Your answers are complete. Saved submissions will reconcile when WaniKani is available." : "Your WaniKani progress is up to date." : dailyLimitReached ? `You have reached today’s ${preferences.dailyLessonLimit}-lesson limit in this browser.` : mode === "lessons" ? "New lessons will appear after you unlock more subjects." : "Come back when the next review becomes available."}</p></div>{selectedAssignments.length ? <div className={styles.resultGrid}><div><div className={styles.resultNumber}>{submittedIds.length}</div><span>items completed</span></div><div><div className={styles.resultNumber}>{accuracy}%</div><span>answer accuracy</span></div><div><div className={styles.resultNumber}>{incorrect}</div><span>incorrect attempts</span></div><div><div className={styles.resultNumber}>{minutes}</div><span>minutes studied</span></div></div> : null}<div className="cluster" style={{ justifyContent: "center" }}><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink>{selectedAssignments.length ? <Button tone="ghost" onClick={() => window.location.reload()}><RotateCcw size={17} />Check for More</Button> : null}</div></section></div>;
  }

  if (!current) return null;
  const feedbackTone = feedback?.status === "correct" ? styles.feedbackCorrect : feedback?.status === "close" || feedback?.status === "blocked" ? styles.feedbackClose : styles.feedbackWrong;
  const mistakes = (errors[current.assignment.id]?.meaning || 0) + (errors[current.assignment.id]?.reading || 0);
  const wrapUpAvailable = mode === "reviews" && !wrapUpActive && new Set(questions.map((question) => question.assignment.id)).size > preferences.reviewWrapUpSize;
  const contextSentences = (current.subject.data.context_sentences || []).filter((sentence) => sentence.ja.trim()).slice(0, 3);
  const selfAssessment = currentUsesSelfAssessment;
  const jitaiFamily = resolveJitaiFontFamily(preferences, current.id);
  const subjectType = current.subject.object.replace("_", " ");
  const itemProgress = totalItems ? Math.min(1, completedItems / totalItems) : 0;
  const isVocabularyQuestion = current.subject.object === "vocabulary" || current.subject.object === "kana_vocabulary";
  const showContextHint = mode === "reviews" && preferences.showVocabContextSentencesInReviews && isVocabularyQuestion && contextSentences.length > 0;
  const showReviewMetadata = mode === "reviews" && preferences.showReviewItemLevelAndSrsStage;
  const reviewCharacterScale = preferences.reviewCharacterFontScale ?? 1;
  const reviewInputScale = preferences.reviewInputFontScale ?? 1;
  const reviewCharacterSize = `clamp(${5.5 * reviewCharacterScale}rem, ${16 * reviewCharacterScale}vw, ${10 * reviewCharacterScale}rem)`;
  const searchQuery = current.subject.data.characters || current.subject.data.slug;
  const ankiMeaningAnswer = canonicalAnswer(current.subject, "meaning");
  const ankiReadingAnswer = kindsForSubject(current.subject).includes("reading") ? canonicalAnswer(current.subject, "reading") : undefined;
  const otherMeaningAnswers = [
    ...current.subject.data.meanings.filter((meaning) => meaning.accepted_answer && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
    ...current.subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist" && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
  ];
  const otherReadingAnswers = (current.subject.data.readings || []).filter((reading) => reading.accepted_answer && reading.reading !== ankiReadingAnswer).map((reading) => reading.reading);
  const synonymCandidate = answer.trim().toLocaleLowerCase();
  const canAddSynonym = mode === "reviews"
    && preferences.showAddSynonymButton
    && answerStopped
    && feedback?.status === "incorrect"
    && current.kind === "meaning"
    && Boolean(synonymCandidate)
    && !(material?.data.meaning_synonyms ?? []).some((synonym) => synonym.toLocaleLowerCase() === synonymCandidate);
  const questionMetadata = <div className={styles.itemMeta} aria-label="Question status">{showReviewMetadata ? <><span>Level {current.subject.data.level}</span><span><SrsStageIcon stage={current.assignment.data.srs_stage} size={16} />{srsStageLabel(current.assignment.data.srs_stage)}</span></> : null}<span>{mistakes} {mistakes === 1 ? "mistake" : "mistakes"}</span></div>;

  return <div className={styles.studyShell}>
    <section className={styles.question} aria-labelledby="study-prompt-title">
      <header className={styles.promptBand} style={{ "--subject-color": subjectColor(current.subject), "--jitai-font": jitaiFamily } as React.CSSProperties} aria-label={`${mode === "lessons" ? "Lesson quiz" : "Review"} prompt`}>
        <div className={styles.bandHeader}>
          <div className={styles.sessionProgress}><span>{mode === "lessons" ? "Lesson Quiz" : "Reviews"}</span><strong>{Math.min(totalItems, completedItems + 1)} / {totalItems}</strong></div>
          <div className={styles.bandActions}>{wrapUpAvailable ? <Button className={styles.bandAction} tone="ghost" size="small" onClick={wrapUp}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}{mode === "reviews" && preferences.allowSkippingReviews && !feedback ? <Button className={styles.bandAction} tone="ghost" size="small" aria-label="Skip review" onClick={skipCurrentQuestion}><SkipForward size={15} aria-hidden />Skip</Button> : null}{mode === "reviews" && preferences.reviewSearchButtonEnabled ? <ButtonLink className={styles.bandAction} href={`/search?q=${encodeURIComponent(searchQuery)}`} target="_blank" rel="noopener noreferrer" tone="ghost" size="small" aria-label="Search this item"><Search size={15} aria-hidden />Search</ButtonLink> : null}<ButtonLink className={styles.bandAction} href="/dashboard" tone="ghost" size="small">Pause</ButtonLink></div>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={totalItems} aria-valuenow={completedItems}><span style={{ "--study-progress": itemProgress } as React.CSSProperties} /></div>
        {outboxMessage ? <p className={styles.syncNotice} role="status" aria-live="polite">{outboxMessage}</p> : null}
        <div className={styles.subjectGlyph}>
          {previousAnswerItem ? <Link className={styles.previousAnswerCard} data-animate={preferences.reviewAnimatePreviousQuestion || undefined} data-correct={previousAnswerItem.isCorrect} href={`/subjects/${previousAnswerItem.subject.id}`} aria-label={`Previous ${previousAnswerItem.kind} answer: ${primaryMeaning(previousAnswerItem.subject)}, ${previousAnswerItem.isCorrect ? "correct" : "incorrect"}`}><SubjectCharacter subject={previousAnswerItem.subject} className={styles.previousAnswerCharacter} imageSize="100%" /><span aria-hidden>{previousAnswerItem.isCorrect ? <Check size={13} /> : "×"}</span></Link> : null}
          <SubjectCharacter subject={current.subject} className={current.subject.data.characters || current.subject.data.character_images?.length ? styles.characters : styles.subjectText} style={{ fontSize: reviewCharacterSize }} eager />
          <VocabularyFrequencyBadge subject={current.subject} enabled={mode === "reviews" && preferences.showVocabularyFrequency} />
          {showContextHint ? <div className={styles.contextHint}>
            <div className={styles.contextHintContent}>{contextSentences.map((sentence, index) => <div className={styles.contextHintSentenceGroup} key={`${sentence.ja}-${index}`}><p lang="ja">• {sentence.ja}</p>{contextTranslationOpen && sentence.en.trim() ? <p>• {sentence.en}</p> : null}</div>)}</div>
            {contextSentences.some((sentence) => sentence.en.trim()) ? <Button className={styles.contextHintButton} type="button" tone="ghost" size="small" aria-expanded={contextTranslationOpen} onClick={() => setContextTranslationOpen((open) => !open)}>{contextTranslationOpen ? "Hide translations" : "Show translations"}</Button> : null}
          </div> : null}
        </div>
      </header>

      <div className={styles.promptTypeStrip}>
        <div className={styles.promptIdentity}><span className={styles.promptSubject}>{subjectType}</span><span className={styles.promptDivider} aria-hidden /><h1 className={styles.promptKind} id="study-prompt-title">{current.kind}</h1></div>
        <span className={styles.promptInstruction}>Enter the {current.kind}</span>
      </div>

      <div className={styles.answerRegion}>
        <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} idleContent={questionMetadata} />

        {selfAssessment && !feedback ? <AnkiAnswerContent
          revealed={ankiRevealed}
          hideAnswerCompletely={preferences.ankiHideAnswerCompletely}
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
          showReplayAudioButton={preferences.ankiShowReplayAudioButton && Boolean(audioFor(current.subject, preferences.vocabularyAudioVoice))}
          buttonlessMode={preferences.ankiButtonlessMode}
          replayingAudio={replayingAudio}
          onReveal={revealSelfAssessmentAnswer}
          onReplayAudio={() => replayAudio(current.subject)}
          onGradeIncorrect={() => gradeSelf(false)}
          onGradeCorrect={() => gradeSelf(true)}
          onShowDetails={toggleStudyDetails}
          onSkip={skipCurrentQuestion}
        /> : null}

        {!selfAssessment ? <form className={styles.answerForm} onSubmit={submit}>
          <label className={styles.answerLabel} htmlFor="review-answer">Your answer</label>
          <div className={styles.answerRow}>
            <input ref={inputRef} id="review-answer" name="review-answer" className={styles.answerInput} style={{ fontSize: `${reviewInputScale}rem` }} value={answer} onChange={(event) => setAnswer(current.kind === "reading" ? composeKanaInput(event.target.value) : event.target.value)} disabled={Boolean(feedback && feedback.status !== "blocked")} aria-describedby="review-answer-helper" autoComplete="off" spellCheck={current.kind !== "reading"} inputMode={current.kind === "reading" ? "text" : undefined} placeholder={current.kind === "reading" ? "Type kana or romaji…" : "Type the English meaning…"} />
            <Button className={styles.checkButton} tone="primary" disabled={!answer.trim() || Boolean(feedback)}>Check Answer</Button>
          </div>
          <p id="review-answer-helper" className={styles.answerHelper}>{current.kind === "reading" ? "Kana and romaji are accepted." : preferences.acceptUserSynonymsAsAnswers ? "Accepted meanings and your synonyms are checked." : "Accepted WaniKani meanings are checked."}</p>
          {speechError ? <p className={styles.error} role="alert">{speechError}</p> : null}
        </form> : null}

        <div className={styles.studyTools} aria-label="Answer controls">
          <Button className={styles.toolButton} type="button" tone="ghost" disabled={!audioFor(current.subject, preferences.vocabularyAudioVoice)} onClick={() => void playAudio(current.subject)}><Volume2 size={17} aria-hidden /><span>{audioFor(current.subject, preferences.vocabularyAudioVoice) ? "Audio" : "No audio"}</span></Button>
          <span className={styles.inputMode}><span lang="ja">あ</span><span className={styles.secondaryToolLabel}>{current.kind === "reading" ? "Hiragana / romaji" : "English meaning"}</span></span>
          {preferences.voiceAnswers && !selfAssessment ? <Button className={styles.toolButton} type="button" tone="ghost" disabled={!voiceAvailable || listening || Boolean(feedback)} aria-label={!voiceAvailable ? "Voice answer unavailable" : listening ? "Listening for voice answer" : "Voice answer"} onClick={startVoiceAnswer}><Mic size={17} aria-hidden /><span>{listening ? "Listening…" : "Voice"}</span></Button> : null}
          <Button className={styles.toolButton} type="button" tone="ghost" disabled={!revealStudyDetails || advancingQuestion} aria-controls="study-item-details" aria-expanded={studyDetailsShouldOpen} onClick={toggleStudyDetails}><Info size={17} aria-hidden /><span>Info</span></Button>
        </div>

        <p className={styles.shortcut}>{preferences.keyboardShortcuts ? "Enter checks or advances · Space plays audio" : "Keyboard shortcuts are off"}</p>

        {feedback ? <div className={`${styles.feedback} ${feedbackTone}`} role="status" aria-live="polite">
          <strong>{feedback.status === "correct" ? "Correct" : feedback.status === "close" ? "Accepted with a typo" : feedback.status === "blocked" ? "Try another answer" : "Incorrect"}</strong>
          <p>{feedback.message}</p>
          {answerStopped && preferences.showAnswerStopSubjectDetails ? <div className={styles.answerStopDetails}><span>Expected answer</span><strong>{canonicalAnswer(current.subject, current.kind)}</strong>{contextSentences[0] ? <p><span lang="ja">{contextSentences[0].ja}</span><br />{contextSentences[0].en}</p> : null}</div> : null}
          {sessionError ? <p className={styles.error} role="alert">{sessionError}</p> : null}
          <div className={styles.feedbackActions}>
            {unresolvedCloseAnswer ? <>
              <Button type="button" tone="danger" disabled={advancingQuestion} onClick={() => resolveCloseAnswer(false)}><X size={17} aria-hidden />Mark Incorrect</Button>
              <Button type="button" tone="primary" disabled={advancingQuestion} onClick={() => resolveCloseAnswer(true)}><Check size={17} aria-hidden />Mark Correct</Button>
            </> : <>
              {canAddSynonym ? <Button type="button" tone="ghost" disabled={addSynonymMutation.isPending || advancingQuestion} state={addSynonymMutation.isPending ? "loading" : "idle"} onClick={() => addSynonymMutation.mutate({ subject: current.subject, assignmentId: current.assignment.id, kind: current.kind, synonym: synonymCandidate, existingMaterial: material })}><Plus size={17} aria-hidden />Add as synonym</Button> : null}
              <Button tone={feedback.status === "incorrect" ? "danger" : "primary"} disabled={advancingQuestion || addSynonymMutation.isPending} onClick={() => void advance()} state={reviewMutation.isPending || lessonMutation.isPending ? "loading" : "idle"}>{feedback.status === "blocked" ? "Try Again" : answerStopped ? "Next Question" : "Continue now"}<ArrowRight size={17} /></Button>
            </>}
          </div>
        </div> : null}

        {revealStudyDetails ? <div className={styles.detailsPanelReveal} data-open={studyDetailsExpanded} aria-hidden={!studyDetailsExpanded} inert={!studyDetailsExpanded ? true : undefined}><div>
          <section id="study-item-details" className={styles.detailsPanel} aria-labelledby="study-details-title" style={{ "--subject-color": subjectColor(current.subject) } as React.CSSProperties}>
            <div className={styles.detailsHeader}>
              <div><span className={styles.sectionLabel}>Answer revealed</span><h2 id="study-details-title">Item details</h2></div>
              <ButtonLink href={`/subjects/${current.subject.id}`} target="_blank" rel="noopener noreferrer" tone="ghost" size="small">Open full subject<ExternalLink size={15} aria-hidden /></ButtonLink>
            </div>
            <div className={styles.detailsIdentity}>
              <SubjectCharacter subject={current.subject} className={styles.detailsCharacter} imageSize="100%" data-type={current.subject.object === "kana_vocabulary" ? "vocabulary" : current.subject.object} />
              <div className={styles.detailsIdentityCopy}><h3>{primaryMeaning(current.subject)}</h3>{current.subject.data.readings?.length ? <p lang="ja">{current.subject.data.readings.filter((reading) => reading.primary).map((reading) => reading.reading).join(" · ") || current.subject.data.readings[0].reading}</p> : null}</div>
              <div className={styles.detailsIdentityMeta}><span>Level {current.subject.data.level}</span><span><SrsStageIcon stage={current.assignment.data.srs_stage} size={16} />{srsStageLabel(current.assignment.data.srs_stage)}</span></div>
            </div>
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
          </section>
        </div></div> : null}
      </div>
    </section>
  </div>;
}
