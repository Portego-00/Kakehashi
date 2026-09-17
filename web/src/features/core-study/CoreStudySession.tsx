"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, Mic, Plus, RotateCcw, Search, SkipForward, Umbrella, Volume2, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, type MouseEvent, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LoadingState, Skeleton } from "@/components/ui/States";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { composeKanaInput } from "@/lib/kana";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import { SubjectDetailPanels, type SubjectDetailTab } from "@/features/subjects/components/SubjectDetail";
import { StudySubjectDetailsFrame } from "@/features/study/components/study-subject-details";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { useSession } from "@/lib/session";
import { WaniKaniApiError, wkCollection, wkRequest } from "@/lib/wanikani/client";
import { userQuery, wkKeys } from "@/lib/wanikani/queries";
import type { Assignment, ReviewStatistic, StudyMaterial, Subject, WKUser } from "@/types/wanikani";
import { AnkiAnswerContent } from "./AnkiAnswerContent";
import { LessonTeaching } from "./LessonTeaching";
import { CoreStudyResults } from "./CoreStudyResults";
import type { ReviewResultItem } from "./review-results";
import { SrsProgressionSlot, type SrsProgression } from "./SrsProgressionSlot";
import { VocabularyFrequencyBadge } from "./VocabularyFrequencyBadge";
import { checkAnswer, type AnswerResult, type QuestionKind } from "./answer-checker";
import { canAccessCoreStudy } from "./access";
import { createQuestionQueue, kindsForSubject, lessonAssignments, requeueIncorrectCoreQuestions, reviewAssignments, type CoreQuestion } from "./queue";
import { loadReviewOutbox } from "./review-outbox";
import { predictedReviewStage } from "./review-sync";
import { useReviewSync } from "./use-review-sync";
import { coreSessionKey, lessonsStartedToday, recordLessonStarted, selectCoreAssignments } from "./session-planning";
import { speechRecognitionConstructor, type BrowserSpeechRecognition } from "./speech-recognition";
import { canonicalAnswer, coreQueueOptionsForMode, shouldPauseAfterResult, usesSelfAssessment } from "./study-preferences";
import { canRevealStudyDetails, vacationDateLabel, vacationStartedAt, vacationStudyMessage, WANIKANI_VACATION_SETTINGS_URL } from "./vacation";
import { usePhoneStudyInput } from "./use-phone-study-input";
import { useMobileReviewViewport } from "./use-mobile-review-viewport";
import { hasIncompleteReviewPairs, REVIEW_LEAVE_MESSAGE, REVIEW_LEAVE_TITLE, useReviewLeaveGuard } from "./use-review-leave-guard";
import styles from "./core-study.module.css";
import reviewControls from "./review-controls.module.css";
import detailsStyles from "./review-details.module.css";
import studyStyles from "@/features/study/study.module.css";
import { reviewSubjectFont } from "./review-subject-font";
import { useReviewFontReady } from "./use-review-font-ready";
import { pickPreferredPronunciationAudios } from "../../../../src/utils/pronunciationAudio";

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
    <SrsStageIcon stage={progression.endingStage} size={mode === "compact" ? 24 : 30} /><strong>{endingLabel}</strong>
    <small>{progression.endingStage >= 9 ? "Burned" : `Next review ${progression.nextReviewInterval}`}</small>
  </aside>;
}

function shouldIgnoreReviewShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return true;
  return event.target instanceof Element && Boolean(event.target.closest(reviewShortcutInteractiveSelector));
}

function ReviewLeaveDialog({ open, pendingGroupedReview, onCancel, onLeave }: { open: boolean; pendingGroupedReview: boolean; onCancel: () => void; onLeave: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);
  return <dialog ref={dialogRef} className={styles.leaveDialog} aria-labelledby="leave-reviews-title" aria-describedby="leave-reviews-description"
    onCancel={(event) => { event.preventDefault(); onCancel(); }} onClose={onCancel} onKeyDown={(event) => event.stopPropagation()}>
    {open ? <><h2 id="leave-reviews-title">{REVIEW_LEAVE_TITLE}</h2><p id="leave-reviews-description">{pendingGroupedReview ? "This item’s answers haven’t been saved yet. If you leave now, it will start over. Completed reviews are saved." : REVIEW_LEAVE_MESSAGE}</p><div className="cluster"><Button autoFocus type="button" onClick={onCancel}>Keep reviewing</Button><Button type="button" tone="danger" onClick={onLeave}>Leave reviews</Button></div></> : null}
  </dialog>;
}

function shouldIgnoreReviewAdvance(event: KeyboardEvent) {
  if (event.defaultPrevented) return true;
  return event.target instanceof Element && Boolean(event.target.closest(reviewAdvanceNativeEnterSelector));
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
  const { user, isDemo, status } = useSession();
  if (status === "loading") return <div className={styles.stage}><LoadingState label="Checking study access" /></div>;
  if (status !== "authenticated" || !canAccessCoreStudy(user?.data.username, isDemo)) return <CoreStudyComingSoon mode={mode} />;
  return <VerifiedCoreStudySession key={`${user?.data.username}:${mode}`} mode={mode} />;
}

function CoreStudyComingSoon({ mode }: { mode: Mode }) {
  return <div className={styles.stage}><section className={styles.results}><div><h1>Coming soon</h1><p>{mode === "lessons" ? "Lessons" : "Reviews"} will be available here soon.</p></div><div className="cluster" style={{ justifyContent: "center" }}><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink></div></section></div>;
}

function VerifiedCoreStudySession({ mode }: { mode: Mode }) {
  const currentUserQuery = useQuery(userQuery());
  if (currentUserQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Study availability could not be checked</h1><p className={styles.error} role="alert">Kakehashi could not confirm your current study access and Vacation Mode status. No lesson or review session has been started.</p><div className="cluster"><Button onClick={() => void currentUserQuery.refetch()}>Try Again</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></div></div>;
  if (!currentUserQuery.data) return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><LoadingState compact label="Checking study access" detail="No study session starts until your current account state is confirmed." /></div></div>;
  if (!canAccessCoreStudy(currentUserQuery.data.data.username)) return <CoreStudyComingSoon mode={mode} />;
  return <LiveCoreStudySession mode={mode} liveUser={currentUserQuery.data} />;
}

function LiveCoreStudySession({ mode, liveUser }: { mode: Mode; liveUser: WKUser }) {
  const queryClient = useQueryClient();
  const currentVacationStartedAt = vacationStartedAt(liveUser);
  const isOnVacation = Boolean(currentVacationStartedAt);
  const username = liveUser.data.username;
  const webSettings = useWebSettings(username);
  const preferences = webSettings.study;
  const phoneInput = usePhoneStudyInput();
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
  const [resultItems, setResultItems] = useState<ReviewResultItem[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [resumeSnapshot, setResumeSnapshot] = useState<SessionSnapshot | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const [wrapUpActive, setWrapUpActive] = useState(false);
  const [savedReviewIds, setSavedReviewIds] = useState<number[] | null>(mode === "reviews" ? null : []);
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
  const [skipCueSequence, setSkipCueSequence] = useState(0);
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

  const progressionSubjectId = srsProgression?.subjectId;
  useEffect(() => {
    if (!skipCueSequence) return;
    const timer = window.setTimeout(() => setSkipCueSequence(0), 2_240);
    return () => window.clearTimeout(timer);
  }, [skipCueSequence]);

  useEffect(() => {
    if (progressionSubjectId === undefined) return;
    const timer = window.setTimeout(() => setSrsProgression(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [progressionSubjectId]);

  useEffect(() => {
    // Capture completed reviews before recovery can remove them from the outbox.
    const pendingReviewIds = loadReviewOutbox(window.localStorage, username).map((entry) => entry.assignmentId);
    const timer = window.setTimeout(() => {
      setLessonStartsToday(lessonsStartedToday(window.localStorage, username));
      setSavedReviewIds(pendingReviewIds);
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
    enabled: !isOnVacation,
    staleTime: 30_000,
    refetchOnMount: mode === "reviews" ? "always" : true,
  });
  const available = useMemo(() => mode === "reviews" ? reviewAssignments(assignmentQuery.data || []) : lessonAssignments(assignmentQuery.data || []), [assignmentQuery.data, mode]);
  const candidateAssignments = useMemo(() => mode === "reviews"
    ? available.filter((assignment) => !savedReviewIds?.includes(assignment.id))
    : available, [available, mode, savedReviewIds]);
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

  const queueOptions = useMemo(() => coreQueueOptionsForMode(mode, preferences), [mode, preferences]);
  const makeQueue = useMemo(() => () => createQuestionQueue(selectedAssignments, selectedSubjects, queueOptions), [queueOptions, selectedAssignments, selectedSubjects]);

  useEffect(() => {
    if (phase === "results" && resultItems.length) return;
    if (!subjectsQuery.isSuccess || !lessonBatchResolved || savedReviewIds === null) return;
    if (mode === "reviews" && (initializedSessionKeyRef.current || assignmentQuery.isFetching)) return;
    const initializationKey = `${username}:${mode}:${selectedAssignments.map((assignment) => assignment.id).join(",")}`;
    if (initializedSessionKeyRef.current === initializationKey) return;
    const queue = makeQueue();
    const timer = window.setTimeout(() => {
      if (initializedSessionKeyRef.current === initializationKey) return;
      initializedSessionKeyRef.current = initializationKey;
      let restored: SessionSnapshot | null = null;
      try {
        if (mode === "reviews") window.localStorage.removeItem(coreSessionKey(username, mode));
        const raw = mode === "lessons" ? window.localStorage.getItem(coreSessionKey(username, mode)) : null;
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
  }, [assignmentQuery.isFetching, savedReviewIds, lessonBatchResolved, lessonTeachingSnapshot, subjectsQuery.isSuccess, selectedAssignments, selectedSubjects, selectedIds, mode, makeQueue, username, phase, resultItems.length]);

  useEffect(() => {
    if (phase !== "quiz" || mode === "reviews") return;
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

  const reviewSync = useReviewSync(username, mode === "reviews" && !isOnVacation && assignmentQuery.isSuccess && username !== "anonymous", (entry, confirmation) => {
    if (confirmation.stage !== undefined) {
      setResultItems((items) => items.map((item) => item.assignmentId === entry.assignmentId ? { ...item, endingStage: confirmation.stage } : item));
      // A late response may correct its own visible cue, never replace a newer one.
      setSrsProgression((previous) => previous?.assignmentId === entry.assignmentId ? { ...previous, endingStage: confirmation.stage!, isCorrect: confirmation.stage! > previous.startingStage, nextReviewInterval: formatNextReviewInterval(confirmation.availableAt, confirmation.stage!) } : previous);
    }
    void Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]).catch(() => undefined);
  });
  const outboxCount = reviewSync.pendingCount;
  const outboxMessage = reviewSync.permissionError;
  const finishReviewSync = reviewSync.finish;
  useEffect(() => {
    if (mode === "reviews" && phase === "results") finishReviewSync();
  }, [mode, phase, finishReviewSync]);

  const current = questions[0];
  // A correct first answer is already a partial pair while its feedback is open.
  // Keep an existing partial pair guarded until the second answer is submitted.
  const exitCompleted = current && lastCorrect && feedback && feedback.status !== "blocked" && !completed[current.assignment.id]?.length
    ? { ...completed, [current.assignment.id]: answeredKinds.length ? answeredKinds : [current.kind] }
    : completed;
  const pendingGroupedReview = Boolean(current && feedback && lastCorrect && answeredKinds.length === 2 && !submittedIds.includes(current.assignment.id));
  const leaveGuard = useReviewLeaveGuard(mode === "reviews" && phase === "quiz" && (pendingGroupedReview || hasIncompleteReviewPairs(questions, exitCompleted)));
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
  const reviewViewportRef = useMobileReviewViewport<HTMLDivElement>(phase === "quiz" && !currentUsesSelfAssessment);
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
    if (!current || feedback) return;
    if (!answer.trim() && preferences.allowSkippingReviews) { skipCurrentQuestion(); return; }
    const result = checkAnswer(current.subject, current.kind, answer, preferences.acceptUserSynonymsAsAnswers ? material : undefined, current.kind === "reading" ? { singleKanjiReadings, acceptAnyKanjiOnyomiReading: preferences.acceptAnyKanjiOnyomiReading } : undefined);
    setFeedback(result);
    if (result.status === "blocked") return;
    setAnsweredKinds([current.kind]);
    const correct = result.status === "correct" || result.status === "close";
    setLastCorrect(correct);
    if (preferences.answerFeedbackSoundEnabled && !(result.status === "close" && preferences.pauseOnClose)) playAnswerFeedback(correct);
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
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
  }

  function resolveCloseAnswer(correct: boolean) {
    if (!current || feedback?.status !== "close" || !preferences.pauseOnClose || advancingQuestionRef.current) return;
    setLastCorrect(correct);
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
  }

  async function advanceNow(correctOverride?: boolean) {
    if (!current || !feedback || feedback.status === "blocked") {
      if (feedback?.status === "blocked") setAnswer("");
      setFeedback(null);
      window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
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
      // Like the app, commit at most one mistake per kind only after the user
      // accepts the result. Overrides and skips never commit a provisional miss.
      setErrors((previous) => {
        const row = { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0 };
        resolvedAnsweredKinds.forEach((kind) => { row[kind] = 1; });
        return { ...previous, [current.assignment.id]: row };
      });
      const retryImmediately = Boolean(queueOptions.backToBackQuestions && (mode === "lessons" || preferences.backToBackImmediateRetryIncorrect));
      setQuestions(requeueIncorrectCoreQuestions(remaining, retryQuestions, retryImmediately));
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
          const counts = errors[current.assignment.id] || { meaning: 0, reading: 0 };
          reviewSync.enqueue({ assignmentId: current.assignment.id, incorrectMeaningAnswers: counts.meaning, incorrectReadingAnswers: counts.reading, createdAt: new Date().toISOString() });
          resultingStage = predictedReviewStage(current.assignment.data.srs_stage, counts.meaning, counts.reading);
          if (preferences.srsProgressionCardDisplayMode !== "hidden") {
            const startingStage = current.assignment.data.srs_stage;
            setReserveResultsProgressionSlot(remaining.length === 0);
            setSrsProgression({ assignmentId: current.assignment.id, subjectId: current.subject.id, startingStage, endingStage: resultingStage, isCorrect: resultingStage > startingStage, nextReviewInterval: formatNextReviewInterval(undefined, resultingStage) });
          }
        } else await lessonMutation.mutateAsync(current.assignment.id);
        setSubmittedIds((previous) => [...previous, current.assignment.id]);
        setResultItems((previous) => [...previous.filter((item) => item.assignmentId !== current.assignment.id), { assignmentId: current.assignment.id, subject: current.subject, meaningMistakes: errors[current.assignment.id]?.meaning ?? 0, readingMistakes: errors[current.assignment.id]?.reading ?? 0, endingStage: resultingStage }]);
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
        setDisplayNow(Date.now());
        setPhase("results");
        // Completion must not wait for dashboard queries; the session is already saved.
        void Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]).catch(() => undefined);
      } else window.requestAnimationFrame(() => inputRef.current?.focus(phoneInput ? { preventScroll: true } : undefined));
    } catch (cause) {
      setSessionError(formatFailure(cause, mode === "reviews" ? "This review could not be saved on this device. Please try again before continuing." : "The lesson remains in place; retry when the connection returns."));
    }
  }

  function advance(correctOverride?: boolean) {
    if (leaveGuard.isLeaveDialogOpen || addSynonymMutation.isPending || lessonMutation.isPending || advancingQuestionRef.current || (unresolvedCloseAnswer && correctOverride === undefined)) return;
    if (phoneInput) inputRef.current?.focus({ preventScroll: true });
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
    if (leaveGuard.isLeaveDialogOpen || addSynonymMutation.isPending || !feedback || feedback.status === "blocked" || shouldPauseAfterResult(feedback.status, preferences)) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [feedback, lastCorrect, preferences, leaveGuard.isLeaveDialogOpen, addSynonymMutation.isPending]);

  useEffect(() => {
    if (phase !== "quiz" || !preferences.keyboardShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isReviewButton = target instanceof Element && Boolean(target.closest("button") && target.closest("[data-study-session]") && !target.closest("#study-item-details"));
      // Alt+A also works while composing a typed answer; a plain A remains text.
      if (event.altKey) {
        if ((event.code === "KeyA" || event.key.toLowerCase() === "a") && canSkipQuestion && !busy
          && (target === inputRef.current || isReviewButton || !shouldIgnoreReviewShortcut(event))) {
          event.preventDefault();
          skipCurrentQuestion();
        }
        return;
      }
      // Keep native Enter activation for buttons that choose a specific result.
      if (event.key === "Enter" && target instanceof Element && target.closest("[data-review-action]")) return;
      if (event.key === "Enter" && unresolvedCloseAnswer) {
        if (shouldIgnoreReviewShortcut(event)) return;
        event.preventDefault();
        if (!busy) resolveCloseAnswer(true);
        return;
      }
      if (event.key === "Enter" && feedback) {
        if (shouldIgnoreReviewAdvance(event)) return;
        event.preventDefault();
        if (!busy) void advance();
        return;
      }
      if (event.key === "Enter" && shouldIgnoreReviewShortcut(event)) return;
      if (event.key === "Enter" && current && usesSelfAssessment(current.kind, preferences) && !feedback) {
        event.preventDefault();
        if (!ankiRevealed) revealSelfAssessmentAnswer();
      }
      if (ankiRevealed && !feedback && !event.isComposing && (!shouldIgnoreReviewShortcut(event) || isReviewButton) && !busy && (event.key === "1" || event.key === "2")) {
        event.preventDefault();
        gradeSelf(event.key === "2");
      }
      const isAnsweredInput = event.target === inputRef.current && feedback && feedback.status !== "blocked";
      if (event.isComposing || event.repeat || busy || (shouldIgnoreReviewShortcut(event) && !isAnsweredInput && !isReviewButton)) return;
      const key = event.key.toLowerCase();
      if (key === "d" && revealStudyDetails) { event.preventDefault(); toggleStudyDetails(); }
      if (key === "r" && canReplayAudio && current) { event.preventDefault(); void replayAudio(current.subject); }
      if ((key === "x" || key === "c") && canCorrectAnswer) {
        event.preventDefault();
        if (unresolvedCloseAnswer) resolveCloseAnswer(key === "c");
        else advance(key === "c");
      }
      if (key === "a" && canSkipQuestion) { event.preventDefault(); skipCurrentQuestion(); }
      if (key === "s" && canAddSynonym && current) {
        event.preventDefault();
        addSynonymMutation.mutate({ subject: current.subject, assignmentId: current.assignment.id, kind: current.kind, synonym: synonymCandidate, existingMaterial: material });
      }
      if (key === " " && feedback?.status === "correct") { event.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function wrapUp() {
    const keep = new Set(questions.filter((question) => hasIncompleteReviewPairs([question], exitCompleted)).map((question) => question.assignment.id));
    if (current) keep.add(current.assignment.id);
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
    if (!current || !canSkipQuestion || busy) return;
    setSkipCueSequence((sequence) => sequence + 1);
    if (mode === "reviews") {
      const resetPair = createQuestionQueue([current.assignment], [current.subject], queueOptions);
      setQuestions([...questions.filter((question) => question.assignment.id !== current.assignment.id), ...resetPair]);
      setCompleted((previous) => ({ ...previous, [current.assignment.id]: [] }));
      setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: 0, reading: 0 } }));
    } else {
      setQuestions(requeueIncorrectCoreQuestions(questions.slice(1), [current], Boolean(queueOptions.backToBackQuestions)));
    }
    setFeedback(null);
    setLastCorrect(false);
    setSessionError("");
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
  if (assignmentQuery.error || subjectsQuery.error || (restoredAssignmentsQuery.error && !lessonBatchResolved)) return <div className={styles.stage}><div className={styles.loading}><h1>{mode === "lessons" ? "Lessons" : "Reviews"} could not load</h1><p className={styles.error} role="alert">{formatFailure(assignmentQuery.error || subjectsQuery.error || restoredAssignmentsQuery.error, "Refresh when the connection is available.")}</p><Button onClick={() => {
    if (assignmentQuery.error) void assignmentQuery.refetch();
    if (subjectsQuery.error) void subjectsQuery.refetch();
    if (restoredAssignmentsQuery.error) void restoredAssignmentsQuery.refetch();
  }}>Try Again</Button></div></div>;
  if (materialsQuery.error || answerContextQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Answer data could not load</h1><p className={styles.error} role="alert">{formatFailure(materialsQuery.error || answerContextQuery.error, "Retry before answering so personal synonyms and reading warnings are checked correctly.")}</p><Button onClick={() => { if (materialsQuery.error) void materialsQuery.refetch(); if (answerContextQuery.error) void answerContextQuery.refetch(); }}>Try Again</Button></div></div>;
  if (assignmentQuery.isLoading || subjectsQuery.isLoading || materialsQuery.isLoading || answerContextQuery.isLoading || (phase === "loading" || (phase === "quiz" && !reviewFontReady))) return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><Skeleton height="4rem" /><LoadingState compact label={`Loading ${mode}`} detail="Fetching the queue and answer data for your first item." /></div></div>;

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
    const waitingForSync = mode === "reviews" && outboxCount > 0 && !selectedAssignments.length;
    const dailyLimitReached = mode === "lessons" && preferences.dailyLessonLimit > 0 && dailyRemaining <= 0 && available.length > 0;
    return <div className={styles.stage}>{outboxMessage ? <p className={styles.error} role="alert">{outboxMessage}</p> : null}{reserveResultsProgressionSlot ? <SrsProgressionSlot progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} /> : null}<section className={styles.results}><Check size={44} style={{ marginInline: "auto", color: "var(--color-success)" }} aria-hidden /><div><h1>{waitingForSync ? "Reviews saved for sync" : selectedAssignments.length ? `${mode === "lessons" ? "Lessons" : "Reviews"} Complete` : dailyLimitReached ? "Daily Lesson Limit Reached" : `No ${mode} Waiting`}</h1><p>{waitingForSync ? `${outboxCount} completed review${outboxCount === 1 ? " is" : "s are"} saved on this device and will retry when WaniKani is available.` : selectedAssignments.length ? outboxCount ? "Your answers are complete. Saved submissions will reconcile when WaniKani is available." : "Your WaniKani progress is up to date." : dailyLimitReached ? `You have reached today’s ${preferences.dailyLessonLimit}-lesson limit in this browser.` : mode === "lessons" ? "New lessons will appear after you unlock more subjects." : "Come back when the next review becomes available."}</p></div>{selectedAssignments.length ? <div className={styles.resultGrid}><div><div className={styles.resultNumber}>{submittedIds.length}</div><span>items completed</span></div><div><div className={styles.resultNumber}>{accuracy}%</div><span>answer accuracy</span></div><div><div className={styles.resultNumber}>{incorrect}</div><span>incorrect attempts</span></div><div><div className={styles.resultNumber}>{minutes}</div><span>minutes studied</span></div></div> : null}<div className="cluster" style={{ justifyContent: "center" }}><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink>{selectedAssignments.length || waitingForSync ? <Button tone="ghost" onClick={() => window.location.reload()}><RotateCcw size={17} />Check for More</Button> : null}</div></section></div>;
  }

  if (!current) return null;
  const resultTone = feedback?.status === "correct" ? "correct" : feedback?.status === "close" || feedback?.status === "blocked" ? "warning" : feedback ? "incorrect" : undefined;
  const wrapUpAvailable = mode === "reviews" && !wrapUpActive && new Set(questions.map((question) => question.assignment.id)).size > preferences.reviewWrapUpSize;
  const contextSentences = (current.subject.data.context_sentences || []).filter((sentence) => sentence.ja.trim()).slice(0, 3);
  const selfAssessment = currentUsesSelfAssessment;
  const jitaiFamily = resolveJitaiFontFamily(preferences, current.id);
  const subjectType = current.subject.object.replace("_", " ");
  const itemProgress = totalItems ? Math.min(1, completedItems / totalItems) : 0;
  const isVocabularyQuestion = current.subject.object === "vocabulary" || current.subject.object === "kana_vocabulary";
  const showContextHint = preferences.showVocabContextSentencesInReviews && isVocabularyQuestion && contextSentences.length > 0;
  const showReviewMetadata = preferences.showReviewItemLevelAndSrsStage;
  const reviewCharacterScale = preferences.reviewCharacterFontScale ?? 1;
  const reviewInputScale = preferences.reviewInputFontScale ?? 1;
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
  const canAddSynonym = mode === "reviews"
    && preferences.showAddSynonymButton
    && answerStopped
    && feedback?.status === "incorrect"
    && current.kind === "meaning"
    && Boolean(synonymCandidate)
    && !(material?.data.meaning_synonyms ?? []).some((synonym) => synonym.toLocaleLowerCase() === synonymCandidate);
  const promptLabel = <><span className={styles.quizPromptLabel}>{subjectType}</span><strong className={styles.quizPromptLabel} id="study-prompt-title" role="heading" aria-level={1}>{selfAssessment && groupedSelfAssessment ? "meaning + reading" : current.kind}</strong></>;
  const busy = advancingQuestion || lessonMutation.isPending || addSynonymMutation.isPending;
  const canCorrectAnswer = feedback?.status === "incorrect" || unresolvedCloseAnswer;
  const canSkipQuestion = (!feedback && preferences.allowSkippingReviews) || feedback?.status === "incorrect";
  const canReplayAudio = revealStudyDetails && (current.kind === "reading" || (selfAssessment && groupedSelfAssessment)) && current.subject.object === "vocabulary" && Boolean(audioFor(current.subject, preferences.vocabularyAudioVoice));
  const nextLabel = unresolvedCloseAnswer ? "Choose result" : feedback?.status === "blocked" ? "Try Again" : "Next";

  return <><ReviewLeaveDialog open={leaveGuard.isLeaveDialogOpen} pendingGroupedReview={pendingGroupedReview} onCancel={leaveGuard.cancelLeave} onLeave={leaveGuard.confirmLeave} /><section ref={reviewViewportRef} className={`${studyStyles.quizShell} ${styles.coreQuiz}`} data-study-session="active" data-type={current.subject.object} data-details-open={studyDetailsShouldOpen || undefined} data-advancing={advancingQuestion || undefined} aria-label={mode === "lessons" ? "Lesson quiz" : "Reviews"} aria-labelledby="study-prompt-title">
      <div className={studyStyles.quizTopbar}>
        <span className={studyStyles.numeric}>{Math.min(totalItems, completedItems + 1)} / {totalItems}</span>
        <div className={studyStyles.progressTrack} role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={totalItems} aria-valuenow={completedItems}><span style={{ transform: `scaleX(${itemProgress})` }} /></div>
        <div className={`${studyStyles.quizTopbarActions} ${reviewControls.toolbarActions}`}>
          {wrapUpAvailable ? <Button className={`${styles.bandAction} ${reviewControls.toolbarButton}`} tone="ghost" size="small" onClick={wrapUp}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}
          {mode === "reviews" && preferences.reviewSearchButtonEnabled ? <Link className={`${studyStyles.iconButton} ${reviewControls.toolbarButton}`} href={`/search?q=${encodeURIComponent(searchQuery)}`} target="_blank" rel="noopener noreferrer" aria-label="Search this item"><Search size={17} aria-hidden /></Link> : null}
          <Link className={`${studyStyles.iconButton} ${reviewControls.toolbarButton}`} href="/dashboard" aria-label={mode === "reviews" ? "Exit reviews" : "Exit lesson quiz"}><X size={19} aria-hidden /></Link>
        </div>
      </div>
      <div className={styles.skipCueRegion} role="status" aria-live="polite" aria-atomic="true">{skipCueSequence > 0 ? <span key={skipCueSequence} className={styles.skipCue}><SkipForward size={16} aria-hidden /><span>Skipped</span></span> : null}</div>
      {previousAnswerItem ? <Link className={reviewControls.previousAnswer} data-subject-type={previousAnswerItem.subject.object} data-animate={preferences.reviewAnimatePreviousQuestion || undefined} data-correct={previousAnswerItem.isCorrect} href={`/subjects/${previousAnswerItem.subject.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Previous ${previousAnswerItem.kind} answer: ${primaryMeaning(previousAnswerItem.subject)}, ${previousAnswerItem.isCorrect ? "correct" : "incorrect"}`}><SubjectCharacter subject={previousAnswerItem.subject} className={`${reviewControls.previousAnswerCharacter} ${reviewSubjectFont.className}`} imageSize="100%" /><span className={reviewControls.previousAnswerStatus} data-correct={previousAnswerItem.isCorrect} aria-hidden>{previousAnswerItem.isCorrect ? <Check size={13} /> : <X size={13} />}</span></Link> : null}
      <div className={studyStyles.questionCard} data-type={current.subject.object} aria-label={`${mode === "lessons" ? "Lesson quiz" : "Review"} prompt`}>
        <h2 id="question-prompt" data-question-kind={current.kind} data-character-scale={reviewCharacterScale} style={{ fontSize: reviewCharacterSize }}><SubjectCharacter subject={current.subject} className={reviewSubjectFont.className} style={{ fontFamily: jitaiFamily, fontWeight: 350 }} eager /></h2>
        <div className={studyStyles.reviewPromptExtras}>
          <VocabularyFrequencyBadge className={studyStyles.reviewPromptFrequency} subject={current.subject} enabled={preferences.showVocabularyFrequency} />
          {showReviewMetadata ? <div className={studyStyles.reviewPromptMetadata} aria-label="Question status"><span>Level {current.subject.data.level}</span><span><SrsStageIcon stage={current.assignment.data.srs_stage} size={16} />{srsStageLabel(current.assignment.data.srs_stage)}</span></div> : null}
        </div>
        {showContextHint ? <div className={studyStyles.reviewContextHint}>
          <div>{contextSentences.map((sentence, index) => <div key={`${sentence.ja}-${index}`}><p lang="ja">• {sentence.ja}</p>{contextTranslationOpen && sentence.en.trim() ? <p>• {sentence.en}</p> : null}</div>)}</div>
          {contextSentences.some((sentence) => sentence.en.trim()) ? <button className={studyStyles.textButton} type="button" aria-expanded={contextTranslationOpen} onClick={() => setContextTranslationOpen((open) => !open)}>{contextTranslationOpen ? "Hide translations" : "Show translations"}</button> : null}
        </div> : null}
      </div>

      <div className={studyStyles.answerArea}>
        {outboxMessage ? <p className={styles.error} role="status" aria-live="polite">{outboxMessage}</p> : null}
        {selfAssessment ? <div className={studyStyles.promptTypeStrip} data-tone={current.kind}>{promptLabel}</div> : null}

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
          showReplayAudioButton={preferences.ankiShowReplayAudioButton && selfAssessmentKinds.includes("reading") && Boolean(audioFor(current.subject, preferences.vocabularyAudioVoice))}
          buttonlessMode={preferences.ankiButtonlessMode}
          replayingAudio={replayingAudio}
          onReveal={revealSelfAssessmentAnswer}
          onReplayAudio={() => replayAudio(current.subject)}
          onGradeIncorrect={() => gradeSelf(false)}
          onGradeCorrect={() => gradeSelf(true)}
          onShowDetails={toggleStudyDetails}
          onSkip={canSkipQuestion ? skipCurrentQuestion : undefined}
        /> : null}

        {!selfAssessment ? <form className={studyStyles.answerForm} data-result={resultTone} onSubmit={(event) => {
          if (feedback) { event.preventDefault(); if (unresolvedCloseAnswer) resolveCloseAnswer(true); else if (!busy) advance(); }
          else submit(event);
        }}>
          <label className={studyStyles.promptTypeStrip} data-tone={current.kind} htmlFor="review-answer">{promptLabel}{current.kind === "reading" ? <small>Romaji → かな</small> : null}</label>
          <div className={studyStyles.answerInputRow} data-result={resultTone}>
            <input
              ref={inputRef}
              id="review-answer"
              name="review-answer"
              aria-label="Your answer"
              style={{ fontSize: phoneInput ? `max(16px, ${reviewInputScale}rem)` : `${reviewInputScale}rem` }}
              value={answer}
              onChange={(event) => {
                if (feedback && feedback.status !== "blocked") return;
                if (feedback?.status === "blocked") setFeedback(null);
                setAnswer(current.kind === "reading" ? composeKanaInput(event.target.value) : event.target.value);
              }}
              onKeyDown={(event) => {
                if (!phoneInput || !feedback || event.key !== "Enter") return;
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                if (event.repeat || busy) return;
                if (unresolvedCloseAnswer) resolveCloseAnswer(true);
                else void advance();
              }}
              readOnly={!phoneInput && Boolean(feedback && feedback.status !== "blocked")}
              enterKeyHint={phoneInput ? "go" : undefined}
              aria-describedby={feedback ? "review-answer-status" : undefined}
              aria-invalid={feedback?.status === "incorrect" || feedback?.status === "blocked" || undefined}
              autoComplete="off"
              spellCheck={false}
              lang={current.kind === "reading" ? "ja" : undefined}
              placeholder={current.kind === "reading" ? "Type kana or romaji…" : "Type the English meaning…"}
            />
            <button className={`${studyStyles.primaryButton} ${styles.answerSubmit}`} data-unanswered={!feedback || undefined} type="submit" onMouseDown={preservePhoneInputFocus} disabled={busy || unresolvedCloseAnswer || (!feedback && !answer.trim() && !canSkipQuestion)}>
              {feedback ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}{feedback ? nextLabel : "Check"}
            </button>
          </div>
          {speechError ? <p className={styles.error} role="alert">{speechError}</p> : null}
        </form> : null}

        {!feedback && (canSkipQuestion || (preferences.voiceAnswers && !selfAssessment)) ? <div className={styles.beforeAnswerActions}>
          {preferences.voiceAnswers && !selfAssessment ? <Button type="button" tone="ghost" disabled={!voiceAvailable || listening} aria-label={!voiceAvailable ? "Voice answer unavailable" : listening ? "Listening for voice answer" : "Voice answer"} onClick={startVoiceAnswer}><Mic size={17} aria-hidden />{listening ? "Listening…" : "Voice"}</Button> : null}
          {canSkipQuestion ? <Button type="button" tone="ghost" data-review-action disabled={busy} aria-label="Skip review" aria-keyshortcuts={preferences.keyboardShortcuts ? "Alt+A" : undefined} onMouseDown={preservePhoneInputFocus} onClick={skipCurrentQuestion}><SkipForward size={17} aria-hidden />Skip{preferences.keyboardShortcuts ? <kbd className={styles.actionKey} aria-hidden>Alt A</kbd> : null}</Button> : null}
        </div> : null}

        <div className={studyStyles.answerStopReveal} data-answer-stop data-visible={Boolean(feedback) || revealStudyDetails} aria-hidden={!feedback && !revealStudyDetails} inert={!feedback && !revealStudyDetails ? true : undefined}><div className={studyStyles.answerStopContent}>
          {feedback ? <div id="review-answer-status" className={studyStyles.answerStatus} role="status" aria-live="polite">
            <span className={studyStyles.answerVerdict} data-correct={lastCorrect} data-warning={resultTone === "warning" || undefined}>{feedback.status === "blocked" ? <RotateCcw size={18} aria-hidden /> : lastCorrect ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}<strong>{feedback.status === "correct" ? "Correct" : feedback.status === "close" ? "Accepted with a typo" : feedback.status === "blocked" ? "Try another answer" : "Incorrect"}</strong></span>
            {feedback.status === "incorrect" ? <span className={studyStyles.correctAnswer}><small>Correct answer</small><strong lang={current.kind === "reading" ? "ja" : undefined}>{feedback.canonical || canonicalAnswer(current.subject, current.kind)}</strong></span> : feedback.status !== "correct" ? <span>{feedback.message}</span> : null}
          </div> : null}
          {sessionError ? <p className={styles.error} role="alert">{sessionError}</p> : null}
          {feedback && (canCorrectAnswer || canAddSynonym || selfAssessment) ? <div className={styles.feedbackActions} aria-label="Answer actions">
            {canCorrectAnswer ? <>
              <Button type="button" tone="danger" data-review-action aria-keyshortcuts={preferences.keyboardShortcuts ? "X" : undefined} disabled={busy} onMouseDown={preservePhoneInputFocus} onClick={() => unresolvedCloseAnswer ? resolveCloseAnswer(false) : advance(false)}><X size={17} aria-hidden />Mark Incorrect{preferences.keyboardShortcuts ? <kbd className={styles.actionKey} aria-hidden>X</kbd> : null}</Button>
              {canSkipQuestion ? <Button type="button" tone="ghost" data-review-action aria-keyshortcuts={preferences.keyboardShortcuts ? "A Alt+A" : undefined} disabled={busy} onMouseDown={preservePhoneInputFocus} onClick={skipCurrentQuestion}><SkipForward size={17} aria-hidden />Skip{preferences.keyboardShortcuts ? <kbd className={styles.actionKey} aria-hidden>A</kbd> : null}</Button> : null}
              <Button type="button" tone="primary" data-review-action aria-keyshortcuts={preferences.keyboardShortcuts ? "C" : undefined} disabled={busy} onMouseDown={preservePhoneInputFocus} onClick={() => unresolvedCloseAnswer ? resolveCloseAnswer(true) : advance(true)}><Check size={17} aria-hidden />Mark Correct{preferences.keyboardShortcuts ? <kbd className={styles.actionKey} aria-hidden>C</kbd> : null}</Button>
            </> : selfAssessment ? <Button tone="primary" disabled={busy} onClick={() => advance()} state={lessonMutation.isPending ? "loading" : "idle"}>Next<ArrowRight size={17} /></Button> : null}
            {canAddSynonym ? <Button type="button" tone="ghost" data-review-action aria-keyshortcuts={preferences.keyboardShortcuts ? "S" : undefined} disabled={busy} state={addSynonymMutation.isPending ? "loading" : "idle"} onClick={() => addSynonymMutation.mutate({ subject: current.subject, assignmentId: current.assignment.id, kind: current.kind, synonym: synonymCandidate, existingMaterial: material })}><Plus size={17} aria-hidden />Add as synonym{preferences.keyboardShortcuts ? <kbd className={styles.actionKey} aria-hidden>S</kbd> : null}</Button> : null}
          </div> : null}

          {revealStudyDetails ? <div className={`${studyStyles.itemDetailsRegion} ${detailsStyles.region}`} data-open={studyDetailsShouldOpen}>
            <div className={`${studyStyles.itemDetailsDisclosure} ${styles.answerDisclosure}`}>
              {canReplayAudio && (!selfAssessment || feedback) ? <button type="button" aria-keyshortcuts={preferences.keyboardShortcuts ? "R" : undefined} className={studyStyles.itemDetailsButton} disabled={busy || replayingAudio} onClick={() => void replayAudio(current.subject)}><Volume2 size={17} aria-hidden /><span>Replay audio</span>{preferences.keyboardShortcuts ? <kbd>R</kbd> : null}</button> : null}
              <button id="study-item-details-toggle" type="button" data-review-action aria-keyshortcuts={preferences.keyboardShortcuts ? "D" : undefined} className={studyStyles.itemDetailsButton} disabled={busy} aria-controls="study-item-details" aria-expanded={studyDetailsShouldOpen} onClick={toggleStudyDetails}><BookOpen size={17} aria-hidden /><span>{studyDetailsShouldOpen ? "Hide subject details" : "Show subject details"}</span>{preferences.keyboardShortcuts ? <kbd>D</kbd> : null}{studyDetailsShouldOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}</button>
            </div>
            <div className={`${studyStyles.itemDetailsReveal} ${detailsStyles.reveal}`} data-open={studyDetailsExpanded} aria-hidden={!studyDetailsExpanded} inert={!studyDetailsExpanded ? true : undefined}><div>
              <StudySubjectDetailsFrame record={current.subject}>
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
              </StudySubjectDetailsFrame>
            </div></div>
          </div> : null}
        </div></div>

        {srsProgression && preferences.srsProgressionCardDisplayMode !== "hidden" ? <SrsProgressionNotice progression={srsProgression} mode={preferences.srsProgressionCardDisplayMode} /> : null}
        {preferences.keyboardShortcuts ? <p className={studyStyles.keyboardHint}>Press <kbd>Enter</kbd> to {unresolvedCloseAnswer ? "mark correct" : feedback ? "continue" : selfAssessment ? "reveal" : "check"}{revealStudyDetails ? <> · <kbd>D</kbd> toggles details</> : null}{canReplayAudio ? <> · <kbd>R</kbd> replays audio</> : null}</p> : null}
      </div>
  </section></>;
}
