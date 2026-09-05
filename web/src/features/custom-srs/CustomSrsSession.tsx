"use client";

import { ArrowRight, Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LoadingState, Skeleton } from "@/components/ui/States";
import { checkAnswer, type AnswerResult, type QuestionKind } from "@/features/core-study/answer-checker";
import { createQuestionQueue } from "@/features/core-study/queue";
import { orderCoreAssignments } from "@/features/core-study/session-planning";
import coreStyles from "@/features/core-study/core-study.module.css";
import type { WebSettings } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { SubjectDetailPanels, type SubjectDetailTab } from "@/features/subjects/components/SubjectDetail";
import { fetchImmersionExamples } from "@/features/study/immersion";
import studyStyles from "@/features/study/study.module.css";
import { composeKanaInput } from "@/lib/kana";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { CustomSrsProgressionToast, type CustomSrsProgression } from "./CustomSrsProgressionToast";
import { customLessonWords, customReviewWords, nextCustomReviewAt } from "./model";
import { nextCustomSrsStage } from "./scheduler";
import { customAssignmentToWaniKani, customWordToSubject, customWordUsesKanji } from "./subject-adapter";
import type { CustomSrsStage, CustomSrsState, CustomVocabularyPack, CustomVocabularyWord } from "./types";
import { useCustomSrs } from "./use-custom-srs";

type CustomStudyMode = "lessons" | "reviews";
type SessionPhase = "teaching" | "quiz" | "results";

type CustomQuestion = {
  word: CustomVocabularyWord;
  kind: QuestionKind;
};

const DEFAULT_LESSON_BATCH_SIZE = 5;

function primaryMeaning(word: CustomVocabularyWord) {
  return word.meanings[0] ?? word.characters;
}

type CustomQueuePreferences = WebSettings["study"];

export function createCustomQuestionQueue(
  words: readonly CustomVocabularyWord[],
  state: CustomSrsState,
  mode: CustomStudyMode,
  preferences: CustomQueuePreferences,
  randomFn: () => number = Math.random,
): CustomQuestion[] {
  const subjects = words.map(customWordToSubject);
  const wordsBySubjectId = new Map(subjects.map((subject, index) => [subject.id, words[index]]));
  const assignments = words.flatMap((word) => {
    const assignment = state.assignments[word.id];
    return assignment ? [customAssignmentToWaniKani(assignment, word)] : [];
  });
  const orderedAssignments = orderCoreAssignments(assignments, subjects, mode, {
    ...preferences,
    reviewOrder: mode === "reviews" ? preferences.customReviewOrder : preferences.reviewOrder,
  }, { randomFn });
  return createQuestionQueue(orderedAssignments, subjects, {
    mode,
    shuffleSubjects: false,
    answerOrder: mode === "lessons" ? preferences.lessonQuestionOrder : preferences.reviewQuestionOrder,
    reviewQuestionOrderEnabled: mode === "reviews" && preferences.reviewQuestionOrderEnabled,
    backToBackQuestions: mode === "reviews" && preferences.backToBackQuestions,
    maxQuestionGap: 10,
    randomFn,
  }).flatMap((question) => {
    const word = wordsBySubjectId.get(question.subject.id);
    return word ? [{ word, kind: question.kind }] : [];
  });
}

function subjectColor() {
  return "var(--color-vocabulary)";
}

function formatNextReviewInterval(availableAt: string | null | undefined, stage: number, now: Date) {
  if (stage >= 9) return "Burned";
  if (!availableAt) return "Scheduled";
  const difference = new Date(availableAt).getTime() - now.getTime();
  if (!Number.isFinite(difference) || difference <= 5 * 60_000) return "Now";
  const hours = difference / (60 * 60_000);
  if (hours < 1) return `${Math.ceil(difference / 60_000)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  if (hours < 168) {
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (hours < 720) {
    const weeks = Math.round(hours / 168);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  const months = Math.round(hours / 720);
  return `${months} ${months === 1 ? "month" : "months"}`;
}

export function createCustomCompletionEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function CustomLessonTeaching({
  words,
  packsByWordId,
  state,
  detailSettings,
  immersionSources,
  currentIndex,
  onCurrentIndexChange,
  onStartQuiz,
}: {
  words: readonly CustomVocabularyWord[];
  packsByWordId: ReadonlyMap<string, CustomVocabularyPack>;
  state: CustomSrsState;
  detailSettings: WebSettings["subjectDetails"];
  immersionSources: string[];
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
  onStartQuiz: () => void;
}) {
  const word = words[currentIndex];
  const heroRef = useRef<HTMLElement>(null);
  const activeBatchItemRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<SubjectDetailTab>("meaning");
  const [preserveViewportAfterSubjectChange, setPreserveViewportAfterSubjectChange] = useState(false);
  const [focusTabAfterSubjectChange, setFocusTabAfterSubjectChange] = useState(false);
  const previousWordIdRef = useRef(word?.id);

  useEffect(() => {
    if (!word || previousWordIdRef.current === word.id) return;
    previousWordIdRef.current = word.id;
    if (!preserveViewportAfterSubjectChange) {
      heroRef.current?.scrollIntoView({ block: "start" });
    }
    if (!focusTabAfterSubjectChange) return;
    const subjectId = customWordToSubject(word).id;
    const frame = window.requestAnimationFrame(() => document.getElementById(`custom-lesson-subject-${subjectId}-tab-meaning`)?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusTabAfterSubjectChange, preserveViewportAfterSubjectChange, word]);

  useEffect(() => {
    activeBatchItemRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentIndex]);

  const immersionCharacters = word?.characters;
  const immersion = useQuery({
    queryKey: ["immersion", "custom-vocabulary-detail", immersionCharacters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(immersionCharacters!, immersionSources, signal),
    enabled: Boolean(detailSettings.showImmersionExamples && immersionCharacters),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  if (!word) return null;

  const subject = customWordToSubject(word);
  const pack = packsByWordId.get(word.id);
  const assignment = state.assignments[word.id];
  const characterCount = Array.from(word.characters).length;
  const progress = words.length ? (currentIndex + 1) / words.length : 0;
  const goToWord = (index: number, preserveViewport = false, focusTab = false) => {
    setPreserveViewportAfterSubjectChange(preserveViewport);
    setFocusTabAfterSubjectChange(focusTab);
    setActiveTab("meaning");
    onCurrentIndexChange(index);
  };
  const previous = currentIndex > 0 ? (focusTab: boolean) => goToWord(currentIndex - 1, true, focusTab) : undefined;
  const next = (focusTab: boolean) => {
    if (currentIndex < words.length - 1) goToWord(currentIndex + 1, true, focusTab);
    else {
      heroRef.current?.scrollIntoView({ block: "start" });
      onStartQuiz();
    }
  };
  const customDetailSettings = {
    ...detailSettings,
    showContextSentences: true,
    showPitchAccent: false,
    showKanjiReadingExamples: false,
    showStrokeOrder: false,
    showPatternsOfUse: false,
  };

  return <div className={coreStyles.studyShell} data-subject-detail-type="vocabulary">
    <article className={coreStyles.lesson} aria-labelledby="custom-lesson-title">
      <header ref={heroRef} className={`${coreStyles.lessonSubjectHero} ${coreStyles.fullSubjectContrast}`} style={{ "--subject-color": subjectColor() } as CSSProperties}>
        <div className={coreStyles.lessonHeroBar}>
          <div className={coreStyles.sessionProgress}><span>Custom lessons</span><strong>{currentIndex + 1} / {words.length}</strong></div>
        </div>
        <div className={coreStyles.progressTrack} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={currentIndex + 1}>
          <span style={{ "--study-progress": progress } as CSSProperties} />
        </div>
        <div className={coreStyles.lessonHeroCopy}>
          <SubjectCharacter subject={subject} imageSize="5rem" imageTone="subject" eager className={coreStyles.lessonHeroCharacter} data-character-count={Math.min(characterCount, 12)} />
          <h1 id="custom-lesson-title">{primaryMeaning(word)}</h1>
          <p lang="ja">{word.reading}</p>
        </div>
        <div className={coreStyles.lessonHeroMeta}>
          <span>{customWordUsesKanji(word) ? "Vocabulary" : "Kana vocabulary"}</span>
          {word.requiredLevel ? <span>WaniKani level {word.requiredLevel}+</span> : null}
          {pack ? <span>{pack.title}</span> : null}
        </div>
      </header>

      <div className={coreStyles.lessonSubjectDetails}>
        <SubjectDetailPanels
          key={subject.id}
          record={subject}
          assignment={assignment ? customAssignmentToWaniKani(assignment, word) : undefined}
          materialLoading={false}
          materialsKey={["custom-srs", "read-only-materials", word.id]}
          relatedSubjects={[]}
          pitchAccents={[]}
          usagePatterns={[]}
          immersionExamples={immersion.data ?? []}
          immersionLoading={immersion.isLoading}
          immersionFailed={immersion.isError}
          settings={customDetailSettings}
          returnTo="/custom-vocabulary"
          idPrefix={`custom-lesson-subject-${subject.id}`}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          sequentialNavigation={{ previous, next }}
          allowStudyMaterialEditing={false}
        />
      </div>

      <nav className={coreStyles.lessonFooter} aria-label="Custom lesson navigation">
        <button type="button" className={coreStyles.lessonFooterArrow} aria-label="Previous lesson" disabled={!previous} onClick={() => previous?.(false)}>
          <ChevronLeft size={20} aria-hidden /><span>Previous</span>
        </button>
        <div className={coreStyles.lessonBatchItems} role="list" aria-label="Lessons in this batch">
          {words.map((batchWord, index) => {
            const active = index === currentIndex;
            const batchSubject = customWordToSubject(batchWord);
            return <span key={batchWord.id} role="listitem"><button
              type="button"
              className={coreStyles.lessonBatchItem}
              style={{ "--lesson-item-color": subjectColor() } as CSSProperties}
              data-active={active || undefined}
              aria-current={active ? "step" : undefined}
              aria-label={`Lesson ${index + 1}: ${primaryMeaning(batchWord)}`}
              title={primaryMeaning(batchWord)}
              ref={active ? activeBatchItemRef : undefined}
              onClick={() => goToWord(index)}
            ><SubjectCharacter subject={batchSubject} imageSize="1.35rem" imageTone="subject" /></button></span>;
          })}
        </div>
        <button type="button" className={coreStyles.lessonFooterArrow} aria-label={currentIndex === words.length - 1 ? "Start lesson quiz" : "Next lesson"} onClick={() => next(false)}>
          <span>{currentIndex === words.length - 1 ? "Start quiz" : "Next"}</span><ChevronRight size={20} aria-hidden />
        </button>
      </nav>
    </article>
  </div>;
}

export function CustomSrsSession({
  mode,
  packs = CUSTOM_VOCABULARY_PACKS,
  lessonBatchSize = DEFAULT_LESSON_BATCH_SIZE,
}: {
  mode: CustomStudyMode;
  packs?: readonly CustomVocabularyPack[];
  lessonBatchSize?: number;
}) {
  const { user } = useSession();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const scope = waniKaniUserId(user) || "pending";
  const customSrs = useCustomSrs(scope, packs);

  if (customSrs.isLoading) return <div className={coreStyles.stage}><div className={coreStyles.loading}><Skeleton height="2rem" /><Skeleton height="18rem" /><LoadingState compact label="Loading custom vocabulary" detail="Checking your Kakehashi SRS before building this session." /></div></div>;

  return <CustomSrsSessionGate
    mode={mode}
    packs={packs}
    lessonBatchSize={lessonBatchSize}
    detailSettings={webSettings.subjectDetails}
    studySettings={webSettings.study}
    customSrs={customSrs}
  />;
}

function CustomSrsSessionGate({
  mode,
  packs,
  lessonBatchSize,
  detailSettings,
  studySettings,
  customSrs,
}: {
  mode: CustomStudyMode;
  packs: readonly CustomVocabularyPack[];
  lessonBatchSize: number;
  detailSettings: WebSettings["subjectDetails"];
  studySettings: WebSettings["study"];
  customSrs: ReturnType<typeof useCustomSrs>;
}) {
  const [admitted, setAdmitted] = useState(() => !customSrs.error);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  if (!admitted) return <div className={coreStyles.stage}><section className={coreStyles.loading}>
    <h1>Custom vocabulary could not load</h1>
    <p className={coreStyles.error} role="alert">{retryError || customSrs.error}</p>
    <div className="cluster">
      <Button tone="primary" state={retrying ? "loading" : "idle"} onClick={async () => {
        setRetrying(true);
        setRetryError("");
        try {
          const result = await customSrs.refresh();
          if (result.error) {
            setRetryError(result.error instanceof Error ? result.error.message : "Custom vocabulary is still unavailable. Try again shortly.");
            return;
          }
          setAdmitted(true);
        } catch (cause) {
          setRetryError(cause instanceof Error ? cause.message : "Custom vocabulary is still unavailable. Try again shortly.");
        } finally {
          setRetrying(false);
        }
      }}>Try Again</Button>
      <ButtonLink href="/custom-vocabulary" tone="ghost">Back to Vocabulary Packs</ButtonLink>
    </div>
  </section></div>;

  return <ReadyCustomSrsSession
    mode={mode}
    packs={packs}
    lessonBatchSize={lessonBatchSize}
    detailSettings={detailSettings}
    studySettings={studySettings}
    state={customSrs.state}
    completeLesson={customSrs.completeLesson}
    submitReview={customSrs.submitReview}
    hookSaving={customSrs.isSaving}
  />;
}

function ReadyCustomSrsSession({
  mode,
  packs,
  lessonBatchSize,
  detailSettings,
  studySettings,
  state,
  completeLesson,
  submitReview,
  hookSaving,
}: {
  mode: CustomStudyMode;
  packs: readonly CustomVocabularyPack[];
  lessonBatchSize: number;
  detailSettings: WebSettings["subjectDetails"];
  studySettings: WebSettings["study"];
  state: CustomSrsState;
  completeLesson: ReturnType<typeof useCustomSrs>["completeLesson"];
  submitReview: ReturnType<typeof useCustomSrs>["submitReview"];
  hookSaving: boolean;
}) {
  const [startedAt, setStartedAt] = useState(() => new Date());
  const packsByWordId = useMemo(() => {
    const result = new Map<string, CustomVocabularyPack>();
    for (const pack of packs) for (const word of pack.words) result.set(word.id, pack);
    return result;
  }, [packs]);
  const batchSize = Number.isFinite(lessonBatchSize) ? Math.max(1, Math.trunc(lessonBatchSize)) : DEFAULT_LESSON_BATCH_SIZE;
  const [sessionWords, setSessionWords] = useState(() => mode === "lessons"
    ? customLessonWords(state, packs).slice(0, batchSize)
    : customReviewWords(state, packs, startedAt));
  const [queue, setQueue] = useState(() => createCustomQuestionQueue(sessionWords, state, mode, studySettings));
  const [phase, setPhase] = useState<SessionPhase>(() => mode === "lessons" && sessionWords.length ? "teaching" : sessionWords.length ? "quiz" : "results");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [incorrectByWord, setIncorrectByWord] = useState<Record<string, number>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [correctAnswerCount, setCorrectAnswerCount] = useState(0);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [lastProgression, setLastProgression] = useState<CustomSrsProgression | null>(null);
  const dismissProgression = useCallback(() => setLastProgression(null), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const committedWordsRef = useRef(new Set<string>());
  const [committedWordIds, setCommittedWordIds] = useState<ReadonlySet<string>>(() => new Set());
  const eventIdsRef = useRef(new Map<string, string>());
  const currentQuestion = queue[0];
  const currentWord = currentQuestion?.word;
  const currentKind = currentQuestion?.kind;
  const currentSubject = useMemo(() => currentWord ? customWordToSubject(currentWord) : null, [currentWord]);
  const currentAssignment = currentWord ? state.assignments[currentWord.id] : undefined;
  const total = sessionWords.length;
  const displayedCurrent = Math.min(total, completedCount + 1);
  const itemProgress = total ? displayedCurrent / total : 0;
  // Keep successful completions excluded even while the shared snapshot catches up.
  const remainingLessons = mode === "lessons"
    ? customLessonWords(state, packs).filter((word) => !committedWordIds.has(word.id))
    : [];
  const nextBatchCount = Math.min(batchSize, remainingLessons.length);

  function startNextLessonBatch() {
    if (mode !== "lessons" || phase !== "results" || committingRef.current || hookSaving) return;
    const nextWords = remainingLessons.slice(0, batchSize);
    if (!nextWords.length) return;

    setSessionWords(nextWords);
    setQueue(createCustomQuestionQueue(nextWords, state, mode, studySettings));
    setStartedAt(new Date());
    setCompletedAt(null);
    setCompletedCount(0);
    setCorrectAnswerCount(0);
    setIncorrectByWord({});
    setLastProgression(null);
    resetForNextQuestion();
    setLessonIndex(0);
    setPhase("teaching");
    window.requestAnimationFrame(() => document.getElementById("custom-lesson-title")?.closest("header")?.scrollIntoView({ block: "start" }));
  }

  const startQuiz = () => {
    setPhase("quiz");
    setLessonIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (phase !== "quiz") return;
    const frame = window.requestAnimationFrame(() => {
      if (feedback) document.getElementById("custom-study-advance")?.focus();
      else inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentKind, currentWord?.id, feedback, phase]);

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!currentSubject || !currentKind || feedback || committingRef.current || hookSaving) return;
    const result = checkAnswer(currentSubject, currentKind, answer);
    setFeedback(result);
    setCommitError("");
    if (result.status === "incorrect") {
      setIncorrectByWord((current) => ({ ...current, [currentWord!.id]: (current[currentWord!.id] ?? 0) + 1 }));
    }
  }

  function resetForNextQuestion() {
    setAnswer("");
    setFeedback(null);
    setCommitError("");
  }

  async function advanceQuiz() {
    if (!currentWord || !feedback || committingRef.current || hookSaving) return;
    if (feedback.status === "blocked") {
      resetForNextQuestion();
      return;
    }
    if (feedback.status === "incorrect") {
      setQueue((current) => current.length > 1 ? [...current.slice(1), current[0]] : current);
      resetForNextQuestion();
      return;
    }
    if (committedWordsRef.current.has(currentWord.id)) return;

    const hasAnotherQuestionForWord = queue.slice(1).some((question) => question.word.id === currentWord.id);
    if (hasAnotherQuestionForWord) {
      setCorrectAnswerCount((count) => count + 1);
      setQueue((current) => current.slice(1));
      resetForNextQuestion();
      return;
    }

    committingRef.current = true;
    setCommitting(true);
    setCommitError("");
    const reviewedAt = new Date();
    const startingStage = (currentAssignment?.stage ?? 0) as CustomSrsStage;
    const incorrectAnswers = incorrectByWord[currentWord.id] ?? 0;

    try {
      let eventId = eventIdsRef.current.get(currentWord.id);
      if (!eventId) {
        eventId = createCustomCompletionEventId();
        eventIdsRef.current.set(currentWord.id, eventId);
      }
      let nextState: CustomSrsState | null;
      if (mode === "lessons") {
        nextState = await completeLesson(currentWord.id, eventId);
      } else {
        nextState = await submitReview(currentWord.id, incorrectAnswers, eventId);
      }
      if (nextState === null) throw new Error("Your custom SRS progress could not be saved in this browser.");

      committedWordsRef.current.add(currentWord.id);
      setCommittedWordIds((current) => new Set(current).add(currentWord.id));
      const expectedEndingStage = mode === "lessons" ? 1 : nextCustomSrsStage(startingStage, incorrectAnswers);
      const nextAssignment = nextState.assignments[currentWord.id];
      const endingStage = (nextAssignment?.stage ?? expectedEndingStage) as CustomSrsStage;
      setLastProgression({
        startingStage,
        endingStage,
        nextReviewInterval: formatNextReviewInterval(nextAssignment?.availableAt, endingStage, reviewedAt),
      });
      setCompletedCount((count) => count + 1);
      setCorrectAnswerCount((count) => count + 1);
      setCompletedAt(reviewedAt);
      const remainingQueue = queue.filter((question) => question.word.id !== currentWord.id);
      setQueue((current) => current.filter((question) => question.word.id !== currentWord.id));
      resetForNextQuestion();
      if (!remainingQueue.length) setPhase("results");
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : "Your custom SRS progress could not be saved. Try again.");
    } finally {
      committingRef.current = false;
      setCommitting(false);
    }
  }

  if (phase === "teaching") {
    return <CustomLessonTeaching
      words={sessionWords}
      packsByWordId={packsByWordId}
      state={state}
      detailSettings={detailSettings}
      immersionSources={studySettings.immersionKitAnimeSources}
      currentIndex={lessonIndex}
      onCurrentIndexChange={setLessonIndex}
      onStartQuiz={startQuiz}
    />;
  }

  if (phase === "results" || !currentWord || !currentSubject) {
    const incorrect = Object.values(incorrectByWord).reduce((sum, count) => sum + count, 0);
    const attempts = correctAnswerCount + incorrect;
    const accuracy = attempts ? Math.round((correctAnswerCount / attempts) * 100) : 0;
    const minutes = completedCount && completedAt ? Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000)) : 0;
    const nextReview = mode === "reviews" ? nextCustomReviewAt(state, packs) : null;
    const emptyTitle = mode === "lessons" ? "No custom lessons waiting" : "No custom reviews waiting";
    const completeTitle = mode === "lessons"
      ? nextBatchCount ? "Lesson batch complete" : "Custom lessons complete"
      : "Custom reviews complete";
    return <div className={coreStyles.stage}>
      <CustomSrsProgressionToast progression={lastProgression} mode={studySettings.srsProgressionCardDisplayMode} onDismiss={dismissProgression} />
      <section className={coreStyles.results}>
        <Check size={44} style={{ marginInline: "auto", color: "var(--color-success)" }} aria-hidden />
        <div><h1>{completedCount ? completeTitle : emptyTitle}</h1><p>{completedCount
          ? mode === "lessons" ? "These words are now in Apprentice I. Their reviews stay in Kakehashi and are never submitted to WaniKani." : "Your answers have been saved to Kakehashi’s custom vocabulary SRS."
          : mode === "lessons" ? "Enroll a vocabulary pack or finish the lessons already in progress." : nextReview ? `The next custom review is scheduled for ${nextReview.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.` : "Come back after completing custom vocabulary lessons."}</p></div>
        {completedCount ? <div className={coreStyles.resultGrid}>
          <div><div className={coreStyles.resultNumber}>{completedCount}</div><span>items completed</span></div>
          <div><div className={coreStyles.resultNumber}>{accuracy}%</div><span>answer accuracy</span></div>
          <div><div className={coreStyles.resultNumber}>{incorrect}</div><span>incorrect attempts</span></div>
          <div><div className={coreStyles.resultNumber}>{minutes}</div><span>minutes studied</span></div>
        </div> : null}
        {nextBatchCount ? <p>{remainingLessons.length} {remainingLessons.length === 1 ? "lesson" : "lessons"} remaining.</p> : null}
        <div className="cluster" style={{ justifyContent: "center" }}>
          {nextBatchCount ? <Button tone="primary" onClick={startNextLessonBatch} disabled={committing || hookSaving}>Next batch ({nextBatchCount})<ArrowRight size={17} aria-hidden /></Button> : null}
          <ButtonLink href="/custom-vocabulary" tone={nextBatchCount ? "ghost" : "primary"}>Vocabulary Packs</ButtonLink>
          {completedCount && mode === "lessons" ? <ButtonLink href="/custom-vocabulary/reviews" tone="ghost">Review Due Items</ButtonLink> : null}
        </div>
      </section>
    </div>;
  }

  const feedbackTitle = feedback?.status === "correct" ? "Correct" : feedback?.status === "close" ? "Accepted with a typo" : feedback?.status === "blocked" ? "Try another answer" : "Incorrect";
  const nextButtonLabel = commitError ? "Retry Save" : feedback?.status === "blocked" ? "Try Again" : "Next";
  const isReadingQuestion = currentKind === "reading";
  const promptLabel = isReadingQuestion ? "Reading" : "Meaning";
  const resultTone = feedback
    ? feedback.status === "correct" ? "correct" : feedback.status === "incorrect" ? "incorrect" : "warning"
    : undefined;
  const reviewCharacterScale = studySettings.reviewCharacterFontScale ?? 1;
  const reviewInputScale = studySettings.reviewInputFontScale ?? 1;
  const reviewCharacterSize = `clamp(${2.75 * reviewCharacterScale}rem, ${9 * reviewCharacterScale}vw, ${6.5 * reviewCharacterScale}rem)`;
  const acceptedAnswer = feedback?.canonical ?? (isReadingQuestion ? currentWord.reading : currentWord.meanings[0]);

  return <section
    className={studyStyles.quizShell}
    data-study-session="active"
    data-type={customWordUsesKanji(currentWord) ? "vocabulary" : "kana_vocabulary"}
    aria-labelledby="question-prompt"
  >
    <CustomSrsProgressionToast progression={lastProgression} mode={studySettings.srsProgressionCardDisplayMode} onDismiss={dismissProgression} />
    <div className={studyStyles.quizTopbar}>
      <span className={studyStyles.numeric}>{displayedCurrent} / {total}</span>
      <div className={studyStyles.progressTrack} role="progressbar" aria-label="Study progress" aria-valuenow={displayedCurrent} aria-valuemin={1} aria-valuemax={total}>
        <span style={{ transform: `scaleX(${itemProgress})` }} />
      </div>
      <div className={studyStyles.quizTopbarActions}>
        <Link className={studyStyles.iconButton} href="/custom-vocabulary" aria-label="Pause and exit session"><X size={19} aria-hidden /></Link>
      </div>
    </div>

    <div className={studyStyles.questionCard} data-type={customWordUsesKanji(currentWord) ? "vocabulary" : "kana_vocabulary"}>
      <h2
        id="question-prompt"
        data-question-kind={currentKind}
        data-character-scale={reviewCharacterScale}
        lang="ja"
        style={{ fontSize: reviewCharacterSize }}
      >{currentWord.characters}</h2>
    </div>

    <div className={studyStyles.answerArea}>
      <form
        className={studyStyles.answerForm}
        data-result={resultTone}
        onSubmit={(event) => {
          if (feedback) {
            event.preventDefault();
            void advanceQuiz();
            return;
          }
          submitAnswer(event);
        }}
      >
        <label className={studyStyles.promptTypeStrip} data-tone={isReadingQuestion ? "reading" : "meaning"} htmlFor="custom-review-answer">
          <span>Vocabulary</span><strong>{promptLabel}</strong>{isReadingQuestion ? <small>Romaji → かな</small> : null}
        </label>
        <div className={studyStyles.answerInputRow} data-result={resultTone}>
          <input
            ref={inputRef}
            id="custom-review-answer"
            name="custom-review-answer"
            value={answer}
            onChange={(event) => setAnswer(isReadingQuestion ? composeKanaInput(event.target.value) : event.target.value)}
            readOnly={Boolean(feedback)}
            disabled={committing || hookSaving}
            aria-label={`Vocabulary ${promptLabel}`}
            aria-invalid={feedback?.status === "incorrect" || feedback?.status === "blocked" ? true : undefined}
            aria-describedby={feedback ? "custom-review-answer-status" : undefined}
            autoComplete="off"
            lang={isReadingQuestion ? "ja" : undefined}
            spellCheck={false}
            inputMode={isReadingQuestion ? "text" : undefined}
            style={{ fontSize: `${reviewInputScale}rem` }}
          />
          <button
            id={feedback ? "custom-study-advance" : undefined}
            type="submit"
            className={studyStyles.primaryButton}
            disabled={committing || hookSaving || (!feedback && !answer.trim())}
          >
            {feedback?.status === "blocked" ? <RotateCcw size={18} aria-hidden /> : feedback ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}
            {feedback ? nextButtonLabel : "Check"}
          </button>
        </div>
      </form>

      <div className={studyStyles.answerStopReveal} data-answer-stop data-visible={Boolean(feedback)} aria-hidden={!feedback} inert={!feedback ? true : undefined}>
        <div className={studyStyles.answerStopContent}>
          {feedback ? <div id="custom-review-answer-status" className={studyStyles.answerStatus} role="status" aria-live="polite">
            <span className={studyStyles.answerVerdict} data-correct={feedback.status === "correct"} data-warning={feedback.status === "close" || feedback.status === "blocked" || undefined}>
              {feedback.status === "blocked" ? <RotateCcw size={18} aria-hidden /> : feedback.status === "correct" || feedback.status === "close" ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
              <strong>{feedbackTitle}</strong>
            </span>
            {feedback.status === "incorrect" ? <span className={studyStyles.correctAnswer}><small>Correct answer</small><strong lang={isReadingQuestion ? "ja" : undefined}>{acceptedAnswer}</strong></span> : feedback.status === "blocked" || feedback.status === "close" ? <span>{feedback.message}</span> : null}
          </div> : null}
          {commitError ? <p className={coreStyles.error} role="alert">{commitError}</p> : null}
        </div>
      </div>

      {studySettings.keyboardShortcuts ? <p className={studyStyles.keyboardHint}>Press <kbd>Enter</kbd> to {feedback?.status === "blocked" ? "try again" : feedback ? "continue" : "check"}</p> : null}
    </div>
  </section>;
}
