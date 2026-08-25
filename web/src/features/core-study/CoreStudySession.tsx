"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Check, Info, Mic, RotateCcw, Umbrella, Volume2 } from "lucide-react";
import { FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { LoadingState, Skeleton } from "@/components/ui/States";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { composeKanaInput } from "@/lib/kana";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import { useSession } from "@/lib/session";
import { WaniKaniApiError, wkCollection, wkRequest } from "@/lib/wanikani/client";
import { userQuery, wkKeys } from "@/lib/wanikani/queries";
import type { Assignment, ReviewCreateResponse, StudyMaterial, Subject } from "@/types/wanikani";
import { checkAnswer, type AnswerResult, type QuestionKind } from "./answer-checker";
import { createQuestionQueue, kindsForSubject, lessonAssignments, reviewAssignments, type CoreQuestion } from "./queue";
import { deliverReview, enqueueReview, loadReviewOutbox, noteReviewFailure, removeReview } from "./review-outbox";
import { coreSessionKey, lessonsStartedToday, recordLessonStarted, selectCoreAssignments } from "./session-planning";
import { speechRecognitionConstructor, type BrowserSpeechRecognition } from "./speech-recognition";
import { canonicalAnswer, questionOrderForMode, shouldPauseAfterAnswer, usesSelfAssessment } from "./study-preferences";
import { canRevealStudyDetails, vacationDateLabel, vacationStartedAt, vacationStudyMessage, WANIKANI_VACATION_SETTINGS_URL } from "./vacation";
import styles from "./core-study.module.css";

type Mode = "lessons" | "reviews";
type Phase = "loading" | "resume" | "teaching" | "quiz" | "results";
type ErrorCounts = Record<number, { meaning: number; reading: number }>;
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

function subjectColor(subject: Subject) {
  return subject.object === "radical" ? "var(--color-radical)" : subject.object === "kanji" ? "var(--color-kanji)" : "var(--color-vocabulary)";
}

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.meanings[0]?.meaning || subject.data.slug;
}

function audioFor(subject: Subject) {
  return subject.data.pronunciation_audios?.find((audio) => audio.content_type === "audio/mpeg") || subject.data.pronunciation_audios?.[0];
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
  const [synonymDraft, setSynonymDraft] = useState("");
  const [displayNow, setDisplayNow] = useState(() => Date.now());
  const [ankiRevealed, setAnkiRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceAvailable = useSyncExternalStore(noopSubscribe, () => Boolean(speechRecognitionConstructor()), () => false);

  useEffect(() => { void installCustomJitaiFonts(preferences.jitaiCustomFonts).catch(() => undefined); }, [preferences.jitaiCustomFonts]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLessonStartsToday(lessonsStartedToday(window.localStorage, username));
      setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [username]);

  const assignmentQuery = useQuery({
    queryKey: ["core-study", mode, "assignments"],
    queryFn: () => wkCollection<Assignment>(mode === "reviews" ? "assignments?immediately_available_for_review=true" : "assignments?immediately_available_for_lessons=true"),
    enabled: currentUserQuery.isSuccess && !isOnVacation,
    staleTime: 30_000,
  });
  const available = useMemo(() => mode === "reviews" ? reviewAssignments(assignmentQuery.data || []) : lessonAssignments(assignmentQuery.data || []), [assignmentQuery.data, mode]);
  const candidateAssignments = available;
  const candidateIds = useMemo(() => candidateAssignments.map((assignment) => assignment.data.subject_id), [candidateAssignments]);
  const subjectsQuery = useQuery({
    queryKey: ["core-study", mode, "subjects", candidateIds.join(",")],
    queryFn: async () => {
      if (!candidateIds.length) return [];
      const chunks: number[][] = [];
      for (let index = 0; index < candidateIds.length; index += 500) chunks.push(candidateIds.slice(index, index + 500));
      return (await Promise.all(chunks.map((ids) => wkCollection<Subject>(`subjects?ids=${ids.join(",")}`)))).flat();
    },
    enabled: assignmentQuery.isSuccess && !isOnVacation,
    staleTime: 24 * 60 * 60_000,
  });
  const subjects = subjectsQuery.data || EMPTY_SUBJECTS;
  const dailyRemaining = preferences.dailyLessonLimit > 0 ? Math.max(0, preferences.dailyLessonLimit - lessonStartsToday) : Number.POSITIVE_INFINITY;
  const assignmentLimit = mode === "lessons" ? Math.min(preferences.lessonsBatchSize, dailyRemaining) : preferences.reviewBatchSize;
  const selectedAssignments = useMemo(() => selectCoreAssignments(candidateAssignments, subjects, mode, preferences, assignmentLimit), [candidateAssignments, subjects, mode, preferences, assignmentLimit]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const selectedSubjects = useMemo(() => selectedAssignments.map((assignment) => subjectById.get(assignment.data.subject_id)).filter((subject): subject is Subject => Boolean(subject)), [selectedAssignments, subjectById]);
  const selectedIds = useMemo(() => selectedAssignments.map((assignment) => assignment.data.subject_id), [selectedAssignments]);
  const materialsQuery = useQuery({
    queryKey: ["core-study", mode, "materials", selectedIds.join(",")],
    queryFn: () => selectedIds.length ? wkCollection<StudyMaterial>(`study_materials?subject_ids=${selectedIds.join(",")}`) : Promise.resolve([]),
    enabled: subjectsQuery.isSuccess && !isOnVacation,
    staleTime: 5 * 60_000,
  });

  const questionOrder = questionOrderForMode(mode, preferences);
  const makeQueue = useMemo(() => () => createQuestionQueue(selectedAssignments, selectedSubjects, { shuffleSubjects: false, answerOrder: questionOrder }), [selectedAssignments, selectedSubjects, questionOrder]);

  useEffect(() => {
    if (!subjectsQuery.isSuccess) return;
    const queue = makeQueue();
    const timer = window.setTimeout(() => {
      let restored: SessionSnapshot | null = null;
      try {
        const raw = window.localStorage.getItem(coreSessionKey(username, mode));
        const parsed = raw ? JSON.parse(raw) as Partial<SessionSnapshot> : null;
        const age = parsed?.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : 0;
        if (parsed && Array.isArray(parsed.questionIds) && parsed.completed && parsed.errors && Array.isArray(parsed.submittedIds) && age <= SESSION_MAX_AGE) restored = parsed as SessionSnapshot;
      } catch { window.localStorage.removeItem(coreSessionKey(username, mode)); }

      const byId = new Map(queue.map((question) => [question.id, question]));
      const restoredQueue = restored?.questionIds.map((id) => byId.get(id)).filter((question): question is CoreQuestion => Boolean(question)) || [];
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
        const startedAt = new Date().toISOString();
        setSessionStartedAt(startedAt);
        setQuestions(queue);
        setTotalQuestions(queue.length);
        setPhase(mode === "lessons" && selectedSubjects.length ? "teaching" : queue.length ? "quiz" : "results");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [subjectsQuery.isSuccess, selectedAssignments, selectedSubjects, mode, makeQueue, username]);

  useEffect(() => {
    if (phase !== "quiz") return;
    const snapshot: SessionSnapshot = { savedAt: new Date().toISOString(), startedAt: sessionStartedAt, questionIds: questions.map((question) => question.id), completed, errors, submittedIds };
    window.localStorage.setItem(coreSessionKey(username, mode), JSON.stringify(snapshot));
  }, [phase, questions, completed, errors, submittedIds, mode, sessionStartedAt, username]);

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
  const material = current ? materialsQuery.data?.find((item) => item.data.subject_id === current.subject.id) : undefined;
  const baseProgress = createQuestionQueue(selectedAssignments, selectedSubjects, { shuffleSubjects: false, answerOrder: questionOrder }).length;
  const progress = totalQuestions || baseProgress;
  const answered = Math.max(0, progress - questions.length);
  const sessionItemIds = new Set([...questions.map((question) => question.assignment.id), ...submittedIds]);
  const totalItems = sessionItemIds.size || selectedAssignments.length;
  const completedItems = submittedIds.filter((id) => sessionItemIds.has(id)).length;

  const reviewMutation = useMutation({
    mutationFn: async (payload: { assignmentId: number; counts: { meaning: number; reading: number } }) => {
      if (isOnVacation) throw new Error(vacationStudyMessage("reviews"));
      const entry = enqueueReview(window.localStorage, username, { assignmentId: payload.assignmentId, incorrectMeaningAnswers: payload.counts.meaning, incorrectReadingAnswers: payload.counts.reading, createdAt: new Date().toISOString() });
      setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
      try {
        await deliverReview(entry, {
          readAssignment: (assignmentId) => wkRequest<Assignment>(`assignments/${assignmentId}`, { cache: "no-store", fresh: true }),
          submitReview: async (queued) => { await wkRequest<ReviewCreateResponse>("reviews", { method: "POST", body: { review: { assignment_id: queued.assignmentId, incorrect_meaning_answers: queued.incorrectMeaningAnswers, incorrect_reading_answers: queued.incorrectReadingAnswers, created_at: queued.createdAt } } }); },
        });
        removeReview(window.localStorage, username, payload.assignmentId);
        setOutboxCount(loadReviewOutbox(window.localStorage, username).length);
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
  const synonymMutation = useMutation({
    mutationFn: async (synonym: string) => {
      const meaningSynonyms = Array.from(new Set([...(material?.data.meaning_synonyms || []), synonym.trim()]));
      if (material) return wkRequest<StudyMaterial>(`study_materials/${material.id}`, { method: "PUT", body: { study_material: { meaning_synonyms: meaningSynonyms, meaning_note: material.data.meaning_note, reading_note: material.data.reading_note } } });
      return wkRequest<StudyMaterial>("study_materials", { method: "POST", body: { study_material: { subject_id: current?.subject.id, meaning_synonyms: meaningSynonyms } } });
    },
    onSuccess: async () => { setSynonymDraft(""); await materialsQuery.refetch(); },
  });

  function playAudio(subject: Subject) {
    const audio = audioFor(subject);
    if (audio) void new Audio(audio.url).play();
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
    const result = checkAnswer(current.subject, current.kind, answer, material);
    setFeedback(result);
    if (result.status === "blocked") return;
    const correct = result.status === "correct" || result.status === "close";
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (result.status === "correct" && preferences.autoplayAudio && audioFor(current.subject)) playAudio(current.subject);
  }

  function gradeSelf(correct: boolean) {
    if (!current || feedback) return;
    const canonical = canonicalAnswer(current.subject, current.kind);
    setFeedback({ status: correct ? "correct" : "incorrect", message: correct ? "Marked correct by self-assessment." : `Marked incorrect. The answer is ${canonical}.`, canonical });
    setLastCorrect(correct);
    if (!correct) setErrors((previous) => ({ ...previous, [current.assignment.id]: { meaning: previous[current.assignment.id]?.meaning || 0, reading: previous[current.assignment.id]?.reading || 0, [current.kind]: (previous[current.assignment.id]?.[current.kind] || 0) + 1 } }));
    if (correct && preferences.autoplayAudio && audioFor(current.subject)) playAudio(current.subject);
  }

  async function advance() {
    if (!current || !feedback || feedback.status === "blocked") {
      setFeedback(null);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSessionError("");
    const remaining = questions.slice(1);
    if (!lastCorrect) {
      setQuestions([...remaining, current]);
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const finishedKinds = [...(completed[current.assignment.id] || []), current.kind].filter((value, index, all) => all.indexOf(value) === index);
    const subjectDone = kindsForSubject(current.subject).every((kind) => finishedKinds.includes(kind));
    try {
      if (subjectDone && !submittedIds.includes(current.assignment.id)) {
        if (mode === "reviews") await reviewMutation.mutateAsync({ assignmentId: current.assignment.id, counts: errors[current.assignment.id] || { meaning: 0, reading: 0 } });
        else await lessonMutation.mutateAsync(current.assignment.id);
        setSubmittedIds((previous) => [...previous, current.assignment.id]);
      }
      setCompleted((previous) => ({ ...previous, [current.assignment.id]: finishedKinds }));
      setQuestions(remaining);
      setAnswer("");
      setFeedback(null);
      setAnkiRevealed(false);
      if (!remaining.length) {
        window.localStorage.removeItem(coreSessionKey(username, mode));
        await Promise.all([queryClient.invalidateQueries({ queryKey: wkKeys.assignments() }), queryClient.invalidateQueries({ queryKey: wkKeys.summary() })]);
        setDisplayNow(Date.now());
        setPhase("results");
      } else window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) {
      setSessionError(formatFailure(cause, mode === "reviews" ? "The completed review is saved locally and will reconcile before another submission." : "The lesson remains in place; retry when the connection returns."));
    }
  }

  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (!feedback || feedback.status === "blocked" || shouldPauseAfterAnswer(lastCorrect, preferences)) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [feedback, lastCorrect, preferences]);

  useEffect(() => {
    if (phase !== "quiz" || !preferences.keyboardShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && feedback && !reviewMutation.isPending && !lessonMutation.isPending) {
        event.preventDefault();
        void advance();
      }
      if (event.key === "Enter" && current && usesSelfAssessment(current.kind, preferences) && !feedback) {
        event.preventDefault();
        if (!ankiRevealed) setAnkiRevealed(true);
      }
      if (ankiRevealed && !feedback && (event.key === "1" || event.key === "2")) {
        event.preventDefault();
        gradeSelf(event.key === "2");
      }
      const active = document.activeElement?.tagName;
      if (event.key === " " && current && active !== "INPUT" && active !== "TEXTAREA" && active !== "BUTTON" && active !== "A") {
        event.preventDefault();
        playAudio(current.subject);
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

  function continueSavedSession() {
    setResumeSnapshot(null);
    setPhase("quiz");
  }

  function restartSession() {
    window.localStorage.removeItem(coreSessionKey(username, mode));
    const queue = makeQueue();
    setResumeSnapshot(null);
    setCompleted({});
    setErrors({});
    setSubmittedIds([]);
    setQuestions(queue);
    setTotalQuestions(queue.length);
    setLessonIndex(0);
    setAnkiRevealed(false);
    setSessionStartedAt(new Date().toISOString());
    setPhase(mode === "lessons" && selectedSubjects.length ? "teaching" : queue.length ? "quiz" : "results");
  }

  if (currentVacationStartedAt) return <div className={styles.stage}><section className={styles.vacationPause} role="status"><div className={styles.vacationIcon}><Umbrella size={28} aria-hidden /></div><div><h1>Vacation Mode</h1><p>{vacationStudyMessage(mode)}</p><span>On vacation since {vacationDateLabel(currentVacationStartedAt)}</span></div><div className="cluster"><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink><a href={WANIKANI_VACATION_SETTINGS_URL} target="_blank" rel="noreferrer">Turn off in WaniKani</a></div></section></div>;
  if (currentUserQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>Study availability could not be checked</h1><p className={styles.error} role="alert">Kakehashi could not confirm whether Vacation Mode is active. No lesson or review session has been started.</p><div className="cluster"><Button onClick={() => void currentUserQuery.refetch()}>Try Again</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></div></div>;
  if (currentUserQuery.isLoading) return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><LoadingState compact label="Checking Vacation Mode" detail="No study session starts until your current account state is confirmed." /></div></div>;
  if (assignmentQuery.error || subjectsQuery.error) return <div className={styles.stage}><div className={styles.loading}><h1>{mode === "lessons" ? "Lessons" : "Reviews"} could not load</h1><p className={styles.error} role="alert">{formatFailure(assignmentQuery.error || subjectsQuery.error, "Refresh when the connection is available.")}</p><Button onClick={() => void assignmentQuery.refetch()}>Try Again</Button></div></div>;
  if (assignmentQuery.isLoading || subjectsQuery.isLoading || phase === "loading") return <div className={styles.stage}><div className={styles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><Skeleton height="4rem" /><LoadingState compact label={`Loading ${mode}`} detail="Fetching the queue and subject details for your first item." /></div></div>;

  if (phase === "resume" && resumeSnapshot) {
    const age = resumeSnapshot.savedAt ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((displayNow - new Date(resumeSnapshot.savedAt).getTime()) / 60_000)), "minute") : "earlier";
    const remainingItems = new Set(questions.map((question) => question.assignment.id)).size;
    return <div className={styles.stage}><section className={styles.resume}><RotateCcw size={36} aria-hidden /><div><h1>Resume {mode}?</h1><p>Your saved session has {remainingItems} {remainingItems === 1 ? "item" : "items"} remaining and was updated {age}.</p></div><div className="cluster"><Button tone="primary" onClick={continueSavedSession}>Continue Session</Button><Button tone="ghost" onClick={restartSession}>Start Fresh</Button><ButtonLink href="/dashboard" tone="ghost">Leave</ButtonLink></div></section></div>;
  }

  if (phase === "teaching") {
    const subject = selectedSubjects[lessonIndex];
    if (!subject) return null;
    const audio = audioFor(subject);
    const context = subject.data.context_sentences?.[0];
    const subjectType = subject.object.replace("_", " ");
    const reading = subject.data.readings?.filter((item) => item.primary).map((item) => item.reading).join(", ");
    const lessonProgress = selectedSubjects.length ? (lessonIndex + 1) / selectedSubjects.length : 0;

    return <div className={styles.studyShell}>
      <article className={styles.lesson} aria-labelledby="lesson-title">
        <header className={styles.promptBand} style={{ "--subject-color": subjectColor(subject), "--jitai-font": resolveJitaiFontFamily(preferences, `lesson:${subject.id}`) } as React.CSSProperties}>
          <div className={styles.bandHeader}>
            <div className={styles.sessionProgress}>
              <span>Lessons</span>
              <strong>{lessonIndex + 1} / {selectedSubjects.length}</strong>
            </div>
            <ButtonLink className={styles.bandAction} href="/dashboard" tone="ghost" size="small">Leave</ButtonLink>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={selectedSubjects.length} aria-valuenow={lessonIndex + 1}>
            <span style={{ "--study-progress": lessonProgress } as React.CSSProperties} />
          </div>
          <div className={styles.subjectGlyph}>{subject.data.characters ? <span className={styles.characters}>{subject.data.characters}</span> : <span className={styles.subjectText}>{subject.data.slug}</span>}</div>
        </header>

        <div className={styles.promptTypeStrip}>
          <span className={styles.promptSubject}>{subjectType}</span>
          <span className={styles.promptDivider} aria-hidden />
          <span className={styles.promptKind}>Lesson</span>
        </div>

        <div className={styles.lessonBody}>
          <section className={styles.lessonLead}>
            <span className={styles.sectionLabel}>Primary meaning</span>
            <h1 id="lesson-title">{primaryMeaning(subject)}</h1>
            {reading ? <p><span>Primary reading</span><strong lang="ja">{reading}</strong></p> : null}
          </section>

          <div className={styles.studyTools} aria-label="Lesson controls">
            <Button className={styles.toolButton} type="button" tone="ghost" disabled={!audio} onClick={() => playAudio(subject)}><Volume2 size={17} aria-hidden /><span>{audio ? "Play audio" : "No audio"}</span></Button>
            <span className={styles.inputMode}><span lang="ja">あ</span><span className={styles.secondaryToolLabel}>{reading ? "Hiragana reading" : "Meaning"}</span></span>
            <ButtonLink className={styles.toolButton} href={`/subjects/${subject.id}`} tone="ghost"><Info size={17} aria-hidden /><span>Subject info</span></ButtonLink>
          </div>

          <div className={styles.lessonSections}>
            <section className={styles.lessonSection}><div><h2>Meaning mnemonic</h2><p>{subject.data.meaning_mnemonic || "No meaning mnemonic is available for this item."}</p>{subject.data.meaning_hint ? <p className={styles.lessonHint}><strong>Hint:</strong> {subject.data.meaning_hint}</p> : null}</div></section>
            {subject.data.reading_mnemonic ? <section className={styles.lessonSection}><div><h2>Reading mnemonic</h2><p>{subject.data.reading_mnemonic}</p>{subject.data.reading_hint ? <p className={styles.lessonHint}><strong>Hint:</strong> {subject.data.reading_hint}</p> : null}</div></section> : null}
            {context ? <section className={styles.lessonSection}><div><h2>Context</h2><p className={styles.contextJapanese} lang="ja">{context.ja}</p><p>{context.en}</p></div></section> : null}
          </div>

          <nav className={styles.lessonNav} aria-label="Lesson navigation"><Button tone="ghost" disabled={lessonIndex === 0} onClick={() => setLessonIndex((index) => Math.max(0, index - 1))}>Previous</Button><Button tone="primary" onClick={() => { if (lessonIndex < selectedSubjects.length - 1) setLessonIndex((index) => index + 1); else setPhase("quiz"); }}>{lessonIndex < selectedSubjects.length - 1 ? "Next Item" : "Start Quiz"}<ArrowRight size={17} /></Button></nav>
        </div>
      </article>
    </div>;
  }

  if (phase === "results") {
    const incorrect = Object.values(errors).reduce((total, row) => total + row.meaning + row.reading, 0);
    const attempts = Math.max(1, progress + incorrect);
    const accuracy = selectedAssignments.length ? Math.round((progress / attempts) * 100) : 0;
    const minutes = Math.max(1, Math.round((displayNow - new Date(sessionStartedAt).getTime()) / 60_000));
    const dailyLimitReached = mode === "lessons" && preferences.dailyLessonLimit > 0 && dailyRemaining <= 0 && available.length > 0;
    return <div className={styles.stage}><section className={styles.results}><Check size={44} style={{ marginInline: "auto", color: "var(--color-success)" }} aria-hidden /><div><h1>{selectedAssignments.length ? `${mode === "lessons" ? "Lessons" : "Reviews"} Complete` : dailyLimitReached ? "Daily Lesson Limit Reached" : `No ${mode} Waiting`}</h1><p>{selectedAssignments.length ? outboxCount ? "Your answers are complete. Saved submissions will reconcile when WaniKani is available." : "Your WaniKani progress is up to date." : dailyLimitReached ? `You have reached today’s ${preferences.dailyLessonLimit}-lesson limit in this browser.` : mode === "lessons" ? "New lessons will appear after you unlock more subjects." : "Come back when the next review becomes available."}</p></div>{selectedAssignments.length ? <div className={styles.resultGrid}><div><div className={styles.resultNumber}>{submittedIds.length}</div><span>items completed</span></div><div><div className={styles.resultNumber}>{accuracy}%</div><span>answer accuracy</span></div><div><div className={styles.resultNumber}>{incorrect}</div><span>incorrect attempts</span></div><div><div className={styles.resultNumber}>{minutes}</div><span>minutes studied</span></div></div> : null}<div className="cluster" style={{ justifyContent: "center" }}><ButtonLink href="/dashboard" tone="primary">Back to Dashboard</ButtonLink>{selectedAssignments.length ? <Button tone="ghost" onClick={() => window.location.reload()}><RotateCcw size={17} />Check for More</Button> : null}</div></section></div>;
  }

  if (!current) return null;
  const feedbackTone = feedback?.status === "correct" ? styles.feedbackCorrect : feedback?.status === "close" || feedback?.status === "blocked" ? styles.feedbackClose : styles.feedbackWrong;
  const mistakes = (errors[current.assignment.id]?.meaning || 0) + (errors[current.assignment.id]?.reading || 0);
  const wrapUpAvailable = mode === "reviews" && !wrapUpActive && new Set(questions.map((question) => question.assignment.id)).size > preferences.reviewWrapUpSize;
  const contextSentences = current.subject.data.context_sentences?.slice(0, 2) || [];
  const selfAssessment = usesSelfAssessment(current.kind, preferences);
  const answerStopped = Boolean(feedback && feedback.status !== "blocked" && shouldPauseAfterAnswer(lastCorrect, preferences));
  const revealStudyDetails = canRevealStudyDetails(mode, feedback?.status);
  const jitaiFamily = resolveJitaiFontFamily(preferences, current.id);
  const subjectType = current.subject.object.replace("_", " ");
  const itemProgress = totalItems ? Math.min(1, completedItems / totalItems) : 0;

  const renderDetails = (idPrefix: string) => <>
    <dl className={styles.detailFacts}>
      <div><dt>Primary meaning</dt><dd>{primaryMeaning(current.subject)}</dd></div>
      {current.subject.data.readings?.length ? <div><dt>Primary reading</dt><dd>{current.subject.data.readings.find((reading) => reading.primary)?.reading}</dd></div> : null}
    </dl>
    <div className={styles.detailActions}>{audioFor(current.subject) ? <Button tone="ghost" onClick={() => playAudio(current.subject)}><Volume2 size={17} />Play Audio</Button> : null}<ButtonLink href={`/subjects/${current.subject.id}`} tone="ghost"><BookOpen size={17} />Open Subject</ButtonLink></div>
    {contextSentences.length ? <section className={styles.railSection}><h2>Context</h2>{contextSentences.map((sentence) => <div key={sentence.ja}><p lang="ja">{sentence.ja}</p><p>{sentence.en}</p></div>)}</section> : null}
    <section className={styles.railSection}>
      <h2>Meaning Synonyms</h2>
      {material?.data.meaning_synonyms.length ? <p>{material.data.meaning_synonyms.join(", ")}</p> : <p>No personal synonyms yet.</p>}
      <form className={styles.synonymForm} onSubmit={(event) => { event.preventDefault(); if (synonymDraft.trim()) synonymMutation.mutate(synonymDraft); }}>
        <Field id={`${idPrefix}-meaning-synonym`} label="Add synonym" name={`${idPrefix}-meaning-synonym`} value={synonymDraft} onChange={(event) => setSynonymDraft(event.target.value)} autoComplete="off" placeholder="e.g. stream…" error={synonymMutation.error ? formatFailure(synonymMutation.error, "Try again.") : undefined} />
        <Button size="small" disabled={!synonymDraft.trim()} state={synonymMutation.isPending ? "loading" : "idle"}>Save Synonym</Button>
      </form>
    </section>
  </>;

  return <div className={styles.studyShell}>
    <section className={styles.question} aria-labelledby="study-prompt-title">
      <header className={styles.promptBand} style={{ "--subject-color": subjectColor(current.subject), "--jitai-font": jitaiFamily } as React.CSSProperties} aria-label={`${mode === "lessons" ? "Lesson quiz" : "Review"} prompt`}>
        <div className={styles.bandHeader}>
          <div className={styles.sessionProgress}><span>{mode === "lessons" ? "Lesson Quiz" : "Reviews"}</span><strong>{Math.min(totalItems, completedItems + 1)} / {totalItems}</strong></div>
          <div className={styles.bandActions}>{wrapUpAvailable ? <Button className={styles.bandAction} tone="ghost" size="small" onClick={wrapUp}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}<ButtonLink className={styles.bandAction} href="/dashboard" tone="ghost" size="small">Pause</ButtonLink></div>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={totalItems} aria-valuenow={completedItems}><span style={{ "--study-progress": itemProgress } as React.CSSProperties} /></div>
        {outboxMessage ? <p className={styles.syncNotice} role="status" aria-live="polite">{outboxMessage}</p> : null}
        <div className={styles.subjectGlyph}>{current.subject.data.characters ? <span className={styles.characters}>{current.subject.data.characters}</span> : <span className={styles.subjectText}>{current.subject.data.slug}</span>}</div>
      </header>

      <div className={styles.promptTypeStrip}>
        <div className={styles.promptIdentity}><span className={styles.promptSubject}>{subjectType}</span><span className={styles.promptDivider} aria-hidden /><h1 className={styles.promptKind} id="study-prompt-title">{current.kind}</h1></div>
        <span className={styles.promptInstruction}>Enter the {current.kind}</span>
      </div>

      <div className={styles.answerRegion}>
        <div className={styles.itemMeta} aria-label="Question status"><span>Level {current.subject.data.level}</span>{preferences.showSrsIndicator ? <span><SrsStageIcon stage={current.assignment.data.srs_stage} size={16} />{srsStageLabel(current.assignment.data.srs_stage)}</span> : null}<span>{mistakes} {mistakes === 1 ? "mistake" : "mistakes"}</span></div>

        {selfAssessment && !feedback ? <section className={styles.ankiCard} aria-label="Self-assessment answer">
          {!ankiRevealed ? <><p>Think of the answer, then reveal it and grade your recall.</p><Button tone="primary" onClick={() => setAnkiRevealed(true)}>Reveal Answer</Button></> : <><span>Expected {current.kind}</span><strong lang={current.kind === "reading" ? "ja" : "en"}>{canonicalAnswer(current.subject, current.kind)}</strong><div className={styles.gradeButtons}><Button tone="danger" onClick={() => gradeSelf(false)}>1 · Missed</Button><Button tone="primary" onClick={() => gradeSelf(true)}>2 · Got it</Button></div></>}
        </section> : null}

        {!selfAssessment ? <form className={styles.answerForm} onSubmit={submit}>
          <label className={styles.answerLabel} htmlFor="review-answer">Your answer</label>
          <div className={styles.answerRow}>
            <input ref={inputRef} id="review-answer" name="review-answer" className={styles.answerInput} value={answer} onChange={(event) => setAnswer(current.kind === "reading" ? composeKanaInput(event.target.value) : event.target.value)} disabled={Boolean(feedback && feedback.status !== "blocked")} aria-describedby="review-answer-helper" autoComplete="off" spellCheck={current.kind !== "reading"} inputMode={current.kind === "reading" ? "text" : undefined} placeholder={current.kind === "reading" ? "Type kana or romaji…" : "Type the English meaning…"} />
            <Button className={styles.checkButton} tone="primary" disabled={!answer.trim() || Boolean(feedback)}>Check Answer</Button>
          </div>
          <p id="review-answer-helper" className={styles.answerHelper}>{current.kind === "reading" ? "Kana and romaji are accepted." : "Accepted meanings and your synonyms are checked."}</p>
          {speechError ? <p className={styles.error} role="alert">{speechError}</p> : null}
        </form> : null}

        <div className={styles.studyTools} aria-label="Answer controls">
          <Button className={styles.toolButton} type="button" tone="ghost" disabled={!audioFor(current.subject)} onClick={() => playAudio(current.subject)}><Volume2 size={17} aria-hidden /><span>{audioFor(current.subject) ? "Audio" : "No audio"}</span></Button>
          <span className={styles.inputMode}><span lang="ja">あ</span><span className={styles.secondaryToolLabel}>{current.kind === "reading" ? "Hiragana / romaji" : "English meaning"}</span></span>
          {preferences.voiceAnswers && !selfAssessment ? <Button className={styles.toolButton} type="button" tone="ghost" disabled={!voiceAvailable || listening || Boolean(feedback)} aria-label={!voiceAvailable ? "Voice answer unavailable" : listening ? "Listening for voice answer" : "Voice answer"} onClick={startVoiceAnswer}><Mic size={17} aria-hidden /><span>{listening ? "Listening…" : "Voice"}</span></Button> : null}
          <Button className={styles.toolButton} type="button" tone="ghost" disabled={!revealStudyDetails} aria-controls="study-item-details" onClick={() => document.getElementById("study-item-details")?.scrollIntoView({ block: "start" })}><Info size={17} aria-hidden /><span>Info</span></Button>
        </div>

        <p className={styles.shortcut}>{preferences.keyboardShortcuts ? "Enter checks or advances · Space plays audio" : "Keyboard shortcuts are off"}</p>

        {feedback ? <div className={`${styles.feedback} ${feedbackTone}`} role="status" aria-live="polite">
          <strong>{feedback.status === "correct" ? "Correct" : feedback.status === "close" ? "Accepted with a typo" : feedback.status === "blocked" ? "Try another answer" : "Incorrect"}</strong>
          <p>{feedback.message}</p>
          {answerStopped && preferences.showAnswerStopSubjectDetails ? <div className={styles.answerStopDetails}><span>Expected answer</span><strong>{canonicalAnswer(current.subject, current.kind)}</strong>{contextSentences[0] ? <p><span lang="ja">{contextSentences[0].ja}</span><br />{contextSentences[0].en}</p> : null}</div> : null}
          {sessionError ? <p className={styles.error} role="alert">{sessionError}</p> : null}
          <Button tone={feedback.status === "incorrect" ? "danger" : "primary"} onClick={() => void advance()} state={reviewMutation.isPending || lessonMutation.isPending ? "loading" : "idle"}>{feedback.status === "blocked" ? "Try Again" : answerStopped ? "Next Question" : "Continue now"}<ArrowRight size={17} /></Button>
        </div> : null}

        {revealStudyDetails ? <section id="study-item-details" className={styles.detailsPanel} aria-labelledby="study-details-title"><div className={styles.detailsHeader}><span className={styles.sectionLabel}>Answer revealed</span><h2 id="study-details-title">Item details</h2></div><div className={styles.detailsGrid}>{renderDetails("study")}</div></section> : null}
      </div>
    </section>
  </div>;
}
