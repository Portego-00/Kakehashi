"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  Headphones,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JAPANESE_VOICE_DOWNLOAD_LABEL } from "@/features/speech/japanese-voice-assets";
import { useJapaneseVoice } from "@/features/speech/use-japanese-voice";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import {
  advanceJlptSession,
  answerCurrentJlptQuestion,
  answerForQuestion,
  currentJlptQuestionId,
  expireJlptSection,
  jlptListeningPlaybackScript,
  recordJlptListeningPlay,
  releaseJlptListeningPlay,
  remainingSectionSeconds,
  startNextJlptSection,
} from "../engine";
import {
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPE_LABELS,
  SKILL_LABELS,
} from "../structure";
import type { JlptQuestion, JlptSession } from "../types";
import styles from "../jlpt.module.css";
import { JlptVerbalSceneIllustration } from "./JlptVerbalScene";

const JapaneseReader = dynamic(() =>
  import("@/features/content/JapaneseReader").then(
    (module) => module.JapaneseReader,
  ),
);

function formatTimer(seconds: number | null) {
  if (seconds === null) return "Untimed";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement
  );
}

export function JlptSessionView({
  session,
  questions,
  onSessionChange,
  onQuestionAnswered,
  onPauseAndExit,
  answerFeedbackSoundEnabled,
}: {
  session: JlptSession;
  questions: readonly JlptQuestion[];
  onSessionChange: (session: JlptSession) => void;
  onQuestionAnswered?: (question: JlptQuestion) => void;
  onPauseAndExit: () => void;
  answerFeedbackSoundEnabled: boolean;
}) {
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const questionId = currentJlptQuestionId(session);
  const question = questionId ? questionById.get(questionId) : undefined;
  const storedAnswer = question
    ? answerForQuestion(session, question.id)
    : undefined;
  const [selection, setSelection] = useState({
    sessionId: session.id,
    questionId: questionId ?? "",
    optionId: storedAnswer?.selectedOptionId ?? "",
  });
  const [compositionSelection, setCompositionSelection] = useState({
    sessionId: session.id,
    questionId: questionId ?? "",
    optionIds: storedAnswer?.selectedOrderOptionIds ?? ([] as string[]),
  });
  const compositionQuestion = Boolean(question?.sentenceComposition);
  const selectedOrderOptionIds =
    storedAnswer?.selectedOrderOptionIds ??
    (compositionSelection.sessionId === session.id &&
    compositionSelection.questionId === questionId
      ? compositionSelection.optionIds
      : []);
  const selectedOptionId =
    compositionQuestion && question?.sentenceComposition
      ? (selectedOrderOptionIds[question.sentenceComposition.starredPosition] ??
        "")
      : (storedAnswer?.selectedOptionId ??
        (selection.sessionId === session.id &&
        selection.questionId === questionId
          ? selection.optionId
          : ""));
  const {
    checked: voiceChecked,
    supported: voiceSupported,
    downloaded: voiceDownloaded,
    activity: voiceActivity,
    activeSentence: voiceActiveSentence,
    progress: voiceProgress,
    error: voiceError,
    download: downloadVoice,
    cancelDownload: cancelVoiceDownload,
    play: playVoice,
    stop: stopVoice,
  } = useJapaneseVoice();
  const listeningText = question ? jlptListeningPlaybackScript(question) : "";
  const [nowMs, setNowMs] = useState(() => Date.now());
  const seconds = remainingSectionSeconds(session, new Date(nowMs));
  const [exitOpen, setExitOpen] = useState(false);
  const [audioFailure, setAudioFailure] = useState({
    questionId: "",
    message: "",
  });
  const audioError =
    audioFailure.questionId === questionId
      ? audioFailure.message
      : question?.listening && voiceError
        ? voiceError
        : "";
  const expirationHandled = useRef(false);
  const sessionRef = useRef(session);
  const structure = JLPT_MOCK_STRUCTURES[session.level];
  const section = structure.sections[session.currentSectionIndex];
  const questionIds =
    session.sectionQuestionIds[session.currentSectionIndex] ?? [];
  const allQuestionIds = session.sectionQuestionIds.flat();
  const answeredCount = session.answers.filter((answer) =>
    allQuestionIds.includes(answer.questionId),
  ).length;
  const progress = allQuestionIds.length
    ? Math.round((answeredCount / allQuestionIds.length) * 100)
    : 0;
  const canReveal = Boolean(
    storedAnswer && session.mode !== "mock" && session.immediateFeedback,
  );
  const advanceQuestionIsAudioOnly =
    session.mode === "mock" &&
    (question?.officialType === "listening-task" ||
      question?.officialType === "listening-key-points");
  const spokenQuestionOnly =
    question?.officialType === "listening-outline" ||
    question?.officialType === "listening-integrated";
  const verbalExpression = question?.officialType === "listening-verbal";
  const verbalScene = verbalExpression
    ? question.listening?.verbalScene
    : undefined;
  const passageGroup = question?.passage?.groupId
    ? questionIds
        .map((id) => questionById.get(id))
        .filter(
          (candidate): candidate is JlptQuestion =>
            candidate?.passage?.groupId === question.passage?.groupId,
        )
        .toSorted(
          (left, right) =>
            (left.passage?.blankOrder ??
              left.passage?.groupQuestionIndex ??
              0) -
            (right.passage?.blankOrder ??
              right.passage?.groupQuestionIndex ??
              0),
        )
    : [];
  const passageQuestionPosition = passageGroup.findIndex(
    (candidate) => candidate.id === question?.id,
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    stopVoice();
    return stopVoice;
  }, [questionId, stopVoice]);

  useEffect(() => {
    expirationHandled.current = false;
    if (session.mode !== "mock" || session.status !== "active") return;
    const update = () => {
      const currentTime = new Date();
      const next = remainingSectionSeconds(session, currentTime);
      setNowMs(currentTime.getTime());
      if (next === 0 && !expirationHandled.current) {
        expirationHandled.current = true;
        stopVoice();
        onSessionChange(expireJlptSection(session));
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [onSessionChange, session, stopVoice]);

  const chooseOption = (optionId: string) => {
    if (!questionId || storedAnswer || session.status !== "active") return;
    if (compositionQuestion) {
      setCompositionSelection((current) => {
        const optionIds =
          current.sessionId === session.id && current.questionId === questionId
            ? current.optionIds
            : [];
        return {
          sessionId: session.id,
          questionId,
          optionIds: optionIds.includes(optionId)
            ? optionIds.filter((candidate) => candidate !== optionId)
            : [...optionIds, optionId],
        };
      });
      return;
    }
    setSelection({ sessionId: session.id, questionId, optionId });
  };

  const submitAnswer = () => {
    if (
      !question ||
      !selectedOptionId ||
      storedAnswer ||
      (compositionQuestion &&
        selectedOrderOptionIds.length !== question.options.length)
    )
      return;
    const next = answerCurrentJlptQuestion(
      session,
      question,
      selectedOptionId,
      new Date(),
      compositionQuestion ? selectedOrderOptionIds : undefined,
    );
    if (next === session) return;
    const submittedAnswer = answerForQuestion(next, question.id);
    if (
      submittedAnswer &&
      session.mode !== "mock" &&
      session.immediateFeedback &&
      answerFeedbackSoundEnabled
    )
      playAnswerFeedback(submittedAnswer.correct);
    onQuestionAnswered?.(question);
    onSessionChange(next);
  };

  const continueSession = () => {
    if (!storedAnswer) return;
    stopVoice();
    onSessionChange(advanceJlptSession(session));
  };

  const playListening = () => {
    if (!question?.listening || session.status !== "active") return;
    const allowedPlays =
      session.mode === "mock" ? 1 : question.listening.maxPlays;
    const usedPlays = session.listeningPlays[question.id] ?? 0;
    if (usedPlays >= allowedPlays) return;
    if (!voiceChecked) return;
    if (!voiceSupported) {
      setAudioFailure({
        questionId: question.id,
        message:
          session.mode === "mock"
            ? "The Kakehashi Japanese voice is unavailable in this browser. The transcript remains hidden in mock mode."
            : "The Kakehashi Japanese voice is unavailable in this browser. A transcript fallback is shown below.",
      });
      return;
    }
    if (!voiceDownloaded) {
      void downloadVoice();
      return;
    }
    setAudioFailure({ questionId: question.id, message: "" });
    const next = recordJlptListeningPlay(session, question);
    sessionRef.current = next;
    onSessionChange(next);
    const releaseFailedPlay = () => {
      const current = sessionRef.current;
      const released = releaseJlptListeningPlay(current, question.id);
      if (released !== current) {
        sessionRef.current = released;
        onSessionChange(released);
      }
    };
    void Promise.resolve(
      playVoice(listeningText, { speed: question.listening.rate }),
    ).then((played) => {
      if (played === false) releaseFailedPlay();
    }, releaseFailedPlay);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        exitOpen ||
        isTypingTarget(event.target) ||
        session.status !== "active"
      )
        return;
      if (/^[1-4]$/.test(event.key) && question && !storedAnswer) {
        const option = question.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          chooseOption(option.id);
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (storedAnswer) continueSession();
        else submitAnswer();
        return;
      }
      if (event.code === "Space" && question?.listening) {
        event.preventDefault();
        playListening();
        return;
      }
      if (event.key.toLocaleLowerCase() === "p") {
        event.preventDefault();
        setExitOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (session.status === "section-complete") {
    const nextSection = structure.sections[session.currentSectionIndex + 1];
    return (
      <main className={styles.examShell} data-study-session="active">
        <div className={styles.sectionComplete}>
          <span className={styles.completeIcon}>
            <LockKeyhole size={28} aria-hidden />
          </span>
          <span className={styles.eyebrow}>
            {session.level} representative mock
          </span>
          <h1>{section?.shortTitle ?? "Section"} complete</h1>
          <p>
            Your answers are locked. Correct answers stay hidden until all timed
            sections are complete.
          </p>
          {nextSection ? (
            <div className={styles.nextSectionCard}>
              <span>Up next</span>
              <strong>{nextSection.title}</strong>
              <small>
                {nextSection.durationMinutes} minutes · timer starts when you
                continue
              </small>
            </div>
          ) : null}
          <Button
            tone="primary"
            onClick={() => onSessionChange(startNextJlptSection(session))}
          >
            Begin {nextSection?.shortTitle ?? "next section"}
          </Button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setExitOpen(true)}
          >
            Pause and return to JLPT
          </button>
        </div>
        {exitOpen ? (
          <ExitDialog
            onCancel={() => setExitOpen(false)}
            onConfirm={onPauseAndExit}
          />
        ) : null}
      </main>
    );
  }

  if (!question || !section) {
    return (
      <main className={styles.examShell} data-study-session="active">
        <div className={styles.sectionComplete}>
          <h1>This quiz could not continue</h1>
          <p>The saved question is no longer in this bank.</p>
          <Button onClick={onPauseAndExit}>Return to JLPT</Button>
        </div>
      </main>
    );
  }

  const allowedPlays = question.listening
    ? session.mode === "mock"
      ? 1
      : question.listening.maxPlays
    : 0;
  const usedPlays = session.listeningPlays[question.id] ?? 0;
  const playAvailable = usedPlays < allowedPlays;
  const voiceChecking = !voiceChecked;
  const voiceDownloading = voiceActivity === "downloading";
  const voiceActive = Boolean(
    listeningText &&
      voiceActiveSentence === listeningText &&
      (voiceActivity === "synthesizing" || voiceActivity === "playing"),
  );
  const voiceBusy = voiceActivity !== "idle";
  const listeningButtonLabel = voiceChecking
    ? "Checking voice…"
    : !voiceSupported
      ? "Voice unavailable"
      : voiceDownloading
        ? `Cancel download${voiceProgress === null ? "" : ` · ${voiceProgress}%`}`
        : !voiceDownloaded
          ? `Download voice · ${JAPANESE_VOICE_DOWNLOAD_LABEL}`
          : voiceActive
            ? voiceActivity === "synthesizing"
              ? "Creating audio…"
              : "Playing audio"
            : usedPlays
              ? playAvailable
                ? "Play again"
                : "Audio played"
              : "Play audio";

  return (
    <main className={styles.examShell} data-study-session="active">
      <header className={styles.examHeader}>
        <div className={styles.examIdentity}>
          <span className={styles.levelMark}>{session.level}</span>
          <div>
            <strong>
              {session.mode === "mock"
                ? "Representative mock"
                : session.mode === "weak"
                  ? "Weak-area practice"
                  : "Quick quiz"}
            </strong>
            <span>
              {session.mode === "mock" ? section.shortTitle : "Mixed skills"}
            </span>
          </div>
        </div>
        <div className={styles.examProgressCopy}>
          <span>
            Question {session.currentQuestionIndex + 1} of {questionIds.length}
            {session.mode === "mock"
              ? ` · Section ${session.currentSectionIndex + 1} of ${structure.sections.length}`
              : ""}
          </span>
          <strong>{progress}% complete</strong>
        </div>
        <div className={styles.examControls}>
          {session.mode === "mock" ? (
            <span
              className={styles.timer}
              data-urgent={(seconds !== null && seconds <= 300) || undefined}
              aria-label={`${formatTimer(seconds)} remaining`}
            >
              <Clock3 size={17} aria-hidden />
              {formatTimer(seconds)}
            </span>
          ) : null}
          <button
            type="button"
            className={styles.pauseButton}
            onClick={() => setExitOpen(true)}
            aria-label="Pause and exit"
          >
            <Pause size={18} aria-hidden />
            <span>Pause</span>
          </button>
        </div>
        <div
          className={styles.progressTrack}
          aria-label={`${progress}% complete`}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className={styles.questionStage} key={question.id}>
        <section
          className={styles.questionPanel}
          aria-labelledby="jlpt-question"
        >
          <div className={styles.questionMeta}>
            <span>{SKILL_LABELS[question.skill]}</span>
            <span>{OFFICIAL_TYPE_LABELS[question.officialType]}</span>
            {passageGroup.length > 1 && passageQuestionPosition >= 0 ? (
              <span>
                {question.passage?.blankOrder
                  ? "Passage blank"
                  : "Passage question"}{" "}
                {passageQuestionPosition + 1} of {passageGroup.length}
              </span>
            ) : null}
          </div>
          <p className={styles.instruction}>{question.instruction}</p>
          {question.passage ? (
            <article className={styles.passage} lang="ja">
              {question.passage.title ? (
                <h2>{question.passage.title}</h2>
              ) : null}
              {session.mode === "mock" ? (
                <p>{question.passage.body}</p>
              ) : (
                <div className={styles.practiceInspectableText}>
                  <JapaneseReader
                    text={question.passage.body}
                    ariaLabel="Inspectable reading passage"
                    appearance="inline"
                    tokenDecoration="plain"
                    inspectorMode="floating"
                    subjectReturnTo="/jlpt"
                  />
                </div>
              )}
              {question.passage.sourceLabel ? (
                <small>{question.passage.sourceLabel}</small>
              ) : null}
            </article>
          ) : null}
          {verbalExpression ? (
            <h1 id="jlpt-question" className={styles.stem}>
              Look at the illustration and listen.
            </h1>
          ) : advanceQuestionIsAudioOnly ? (
            <h1 id="jlpt-question" className={styles.stem}>
              Listen to the situation and question, then the passage.
            </h1>
          ) : spokenQuestionOnly ? (
            <h1 id="jlpt-question" className={styles.stem}>
              Listen for the question after the passage.
            </h1>
          ) : session.mode === "mock" ? (
            <h1 id="jlpt-question" className={styles.stem} lang="ja">
              {question.stem}
            </h1>
          ) : (
            <div
              id="jlpt-question"
              className={`${styles.stem} ${styles.practiceInspectableText}`}
              role="heading"
              aria-level={1}
              lang="ja"
            >
              <JapaneseReader
                text={question.stem}
                ariaLabel="Inspectable question sentence"
                appearance="inline"
                tokenDecoration="plain"
                inspectorMode="floating"
                subjectReturnTo="/jlpt"
              />
            </div>
          )}
          {verbalScene ? (
            <JlptVerbalSceneIllustration scene={verbalScene} />
          ) : null}
          {question.focus ? (
            <div className={styles.focusWord} lang="ja">
              {question.focus}
            </div>
          ) : null}

          {compositionQuestion && question.sentenceComposition ? (
            <div className={styles.compositionBuilder}>
              <ol aria-label="Your sentence order">
                {question.options.map((_, index) => {
                  const optionId = selectedOrderOptionIds[index];
                  const option = question.options.find(
                    (candidate) => candidate.id === optionId,
                  );
                  const starred =
                    index === question.sentenceComposition!.starredPosition;
                  return (
                    <li key={index} data-starred={starred || undefined}>
                      <span className={styles.compositionPosition} aria-hidden>
                        {starred ? "★" : index + 1}
                      </span>
                      {option ? (
                        <button
                          type="button"
                          lang="ja"
                          disabled={Boolean(storedAnswer)}
                          onClick={() => chooseOption(option.id)}
                          aria-label={`Remove ${option.label} from position ${index + 1}`}
                        >
                          {option.label}
                        </button>
                      ) : (
                        <span className={styles.compositionEmpty}>
                          Choose a fragment
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                className={styles.compositionClear}
                disabled={
                  !selectedOrderOptionIds.length || Boolean(storedAnswer)
                }
                onClick={() =>
                  setCompositionSelection({
                    sessionId: session.id,
                    questionId: question.id,
                    optionIds: [],
                  })
                }
              >
                Clear order
              </button>
            </div>
          ) : null}

          {question.listening ? (
            <div className={styles.listeningBox}>
              <div className={styles.listeningLead}>
                <span className={styles.listeningIcon}>
                  <Headphones size={22} aria-hidden />
                </span>
                <div>
                  <strong>Listening audio</strong>
                  <span>
                    {session.mode === "mock"
                      ? "One forward item play · stimulus heard once"
                      : `${allowedPlays} total practice plays`}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                tone={voiceDownloaded ? "primary" : "default"}
                state={
                  voiceDownloading ? "loading" : voiceError ? "error" : "idle"
                }
                interactiveWhileLoading={voiceDownloading}
                onClick={voiceDownloading ? cancelVoiceDownload : playListening}
                disabled={
                  voiceChecking ||
                  !voiceSupported ||
                  (voiceDownloaded && (!playAvailable || voiceBusy))
                }
                aria-keyshortcuts="Space"
              >
                {!voiceDownloaded && !voiceDownloading ? (
                  <Download size={17} aria-hidden />
                ) : usedPlays ? (
                  <RotateCcw size={17} aria-hidden />
                ) : (
                  <Play size={17} aria-hidden />
                )}
                {listeningButtonLabel}
              </Button>
              <span className={styles.playCount}>
                {usedPlays}/{allowedPlays}
              </span>
              {audioError ? (
                <div className={styles.audioFallback} role="alert">
                  <strong>{audioError}</strong>
                  {session.mode === "mock" ? (
                    <p>The transcript remains hidden until review.</p>
                  ) : (
                    <p lang="ja">{question.listening.script}</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className={styles.options}
            role="group"
            aria-label="Answer choices"
          >
            {question.options.map((option, index) => {
              const selected = compositionQuestion
                ? selectedOrderOptionIds.includes(option.id)
                : selectedOptionId === option.id;
              const correct =
                canReveal &&
                !compositionQuestion &&
                option.id === question.correctOptionId;
              const wrong =
                canReveal &&
                !compositionQuestion &&
                selected &&
                option.id !== question.correctOptionId;
              return (
                <button
                  type="button"
                  className={styles.option}
                  data-selected={selected || undefined}
                  data-correct={correct || undefined}
                  data-wrong={wrong || undefined}
                  aria-pressed={selected}
                  disabled={Boolean(storedAnswer)}
                  onClick={() => chooseOption(option.id)}
                  key={option.id}
                >
                  <span className={styles.optionKey}>{index + 1}</span>
                  <span
                    lang={
                      question.listening?.audioOnlyOptions ? undefined : "ja"
                    }
                  >
                    {question.listening?.audioOnlyOptions
                      ? `Choice ${index + 1}`
                      : option.label}
                  </span>
                  {correct ? (
                    <Check size={18} aria-label="Correct answer" />
                  ) : wrong ? (
                    <X size={18} aria-label="Your answer was incorrect" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {canReveal ? (
            <aside
              className={styles.answerFeedback}
              data-correct={storedAnswer?.correct || undefined}
              role="status"
              aria-live="polite"
            >
              <span>
                {storedAnswer?.correct ? (
                  <Check size={19} aria-hidden />
                ) : (
                  <X size={19} aria-hidden />
                )}
              </span>
              <div>
                <strong>
                  {storedAnswer?.correct ? "Correct" : "Not quite"}
                </strong>
                <p>{question.explanation}</p>
                {compositionQuestion && question.sentenceComposition ? (
                  <p lang="ja">
                    <strong>Correct order:</strong>{" "}
                    {question.sentenceComposition.canonicalOrderOptionIds
                      .map(
                        (optionId) =>
                          question.options.find(
                            (option) => option.id === optionId,
                          )?.label,
                      )
                      .filter(Boolean)
                      .join("　")}
                  </p>
                ) : null}
              </div>
            </aside>
          ) : storedAnswer ? (
            <p className={styles.answerLocked}>
              <LockKeyhole size={15} aria-hidden /> Answer recorded. Results
              stay hidden until this session is complete.
            </p>
          ) : null}
        </section>
      </div>

      <footer className={styles.examFooter}>
        <span className={styles.keyboardCue}>
          <Volume2 size={15} aria-hidden /> <kbd>1</kbd>–<kbd>4</kbd>{" "}
          {compositionQuestion ? "add fragments" : "choose"} · <kbd>Enter</kbd>{" "}
          continue{question.listening ? " · Space plays audio" : ""}
        </span>
        {storedAnswer ? (
          <Button
            tone="primary"
            onClick={continueSession}
            aria-keyshortcuts="Enter"
          >
            {session.currentQuestionIndex === questionIds.length - 1
              ? session.mode === "mock" &&
                session.currentSectionIndex < structure.sections.length - 1
                ? "Finish section"
                : "See results"
              : "Next question"}
          </Button>
        ) : (
          <Button
            tone="primary"
            disabled={
              !selectedOptionId ||
              (compositionQuestion &&
                selectedOrderOptionIds.length !== question.options.length)
            }
            onClick={submitAnswer}
            aria-keyshortcuts="Enter"
          >
            {session.mode === "mock" ? "Record answer" : "Check answer"}
          </Button>
        )}
      </footer>

      {exitOpen ? (
        <ExitDialog
          onCancel={() => setExitOpen(false)}
          onConfirm={onPauseAndExit}
        />
      ) : null}
    </main>
  );
}

function ExitDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        className={styles.exitDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jlpt-exit-title"
      >
        <span className={styles.dialogIcon}>
          <Pause size={23} aria-hidden />
        </span>
        <h2 id="jlpt-exit-title">Pause this session?</h2>
        <p>
          Your answers and remaining section time will be saved on this device.
          The official JLPT does not allow pausing; this is a Kakehashi practice
          accommodation.
        </p>
        <div className={styles.dialogActions}>
          <Button onClick={onCancel}>Keep testing</Button>
          <Button tone="primary" onClick={onConfirm}>
            Pause & exit
          </Button>
        </div>
      </section>
    </div>
  );
}
