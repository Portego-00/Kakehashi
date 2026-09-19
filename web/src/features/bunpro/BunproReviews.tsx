"use client";
import { type CSSProperties, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Info, Volume2, X, RotateCcw, SkipForward, List, Lightbulb, Search, Mic } from "lucide-react";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { speechRecognitionConstructor, type BrowserSpeechRecognition } from "@/features/core-study/speech-recognition";
import { AnkiAnswerContent } from "@/features/core-study/AnkiAnswerContent";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import { bunproQuestionKind, bunproDisplayAnswers, bunproPitchAccents, normalizeMeaning } from "./study-preferences";
import { shouldPauseAfterResult, usesSelfAssessment } from "@/features/core-study/study-preferences";
import { useMobileReviewViewport } from "@/features/core-study/use-mobile-review-viewport";
import { usePhoneStudyInput } from "@/features/core-study/use-phone-study-input";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { BunproProgression } from "./BunproProgression";
import { bunproStage, bunproProgression, type BunproProgression as Progression } from "./progression";
import { bunproAudioUrls, useBunproAudio } from "./use-bunpro-audio";
import { Button, ButtonLink } from "@/components/ui/Button";
import { composeKanaInput } from "@/lib/kana";
import { bunpro } from "./client";
import { bpHead, orderBunproReviews, type MixedBridge } from "@/features/mixed-reviews/ordering";
import { BunproLoading } from "./BunproLoading";
import { BunproDetails } from "./BunproDetails";
import { BunproText, RubyText } from "./BunproText";
import { buildAnswerFeedbackMap, buildReviewQueue, collectAcceptedAnswers, normalizeAnswer, parseQuestionSentence, pendingReviewTotal, pickCanonicalAnswer, reviewContent, sanitizeQuestionContent, sanitizeText, type BunproReviewQueueItem, type BunproReviewQuizIndexResponse, type ReviewMode } from "./model";
import { MixedPreviousBadge } from "@/features/mixed-reviews/MixedPreviousBadge";
import quiz from "@/features/study/study.module.css";
import core from "@/features/core-study/core-study.module.css";
import styles from "./bunpro.module.css";

type Outcome = { correct: boolean; entered: string };
const labels = { grammar: "Grammar", vocab: "Vocabulary", all: "Grammar & vocabulary" };
export function BunproReviews({ initialMode, lessonSession, onContinueLessons, mixed }: { mixed?: MixedBridge; initialMode?: ReviewMode; lessonSession?: BunproReviewQuizIndexResponse; onContinueLessons?: () => void } = {}) {
  const id = useId();
  const answerId = `${id}-bunpro-answer`;
  const detailsId = `${id}-bunpro-details`;
  const alternativesId = `${id}-bunpro-alternatives`;
  const helperId = `${id}-bunpro-helper`;
  const { user } = useSession();
  const preferences = useWebSettings(user?.data.username ?? "anonymous").study;
  useEffect(() => { void installCustomJitaiFonts(preferences.jitaiCustomFonts).catch(() => undefined); }, [preferences.jitaiCustomFonts]);
  const queryClient = useQueryClient();
  const phoneInput = usePhoneStudyInput();
  const audio = useBunproAudio();
  const [progression, setProgression] = useState<Progression | null>(null);
  const [mode, setMode] = useState<ReviewMode>(initialMode ?? "all");
  const [phase, setPhase] = useState<"choose" | "loading" | "review" | "complete">(lessonSession ? "review" : "choose");
  const [queue, setQueue] = useState<BunproReviewQueueItem[]>(() => lessonSession ? buildReviewQueue(lessonSession) : []);
  const [reviewTotal, setReviewTotal] = useState(lessonSession ? buildReviewQueue(lessonSession).length : 0);
  const [sessionId, setSessionId] = useState(lessonSession?.review_session_id ?? 0);
  const [ankiRevealed, setAnkiRevealed] = useState(false);
  const sessionLimit = useRef(Infinity);
  const [input, setInput] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hint, setHint] = useState("");
  const [hintLevel, setHintLevel] = useState(2);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ title: string; correct: boolean }[]>([]);
  const [submitted, setSubmitted] = useState(new Set<string>());
  const locked = useRef(false);
  const composing = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  async function start() {
    if (locked.current) return;
    locked.current = true;
    audio.stop(); setProgression(null);
    setPhase("loading"); setError("");
    try {
      const data = await bunpro<BunproReviewQuizIndexResponse>(`action=queue&mode=${mode}`);
      sessionLimit.current = preferences.reviewBatchSizeEnabled ? Math.max(1, preferences.reviewBatchSize) : Infinity;
      const items = orderBunproReviews(buildReviewQueue(data), preferences).slice(0, sessionLimit.current);
      if (!Number.isInteger(data.review_session_id) || data.review_session_id <= 0) throw new Error("Bunpro did not return a valid review session. Please try again.");
      if (!items.length && pendingReviewTotal(data) > 0) throw new Error("Bunpro reports pending reviews but returned no questions. Please try again.");
      setQueue(items); setReviewTotal(Math.min(sessionLimit.current, Math.max(items.length, pendingReviewTotal(data)))); setSessionId(data.review_session_id); setResults([]); setSubmitted(new Set());
      setAnkiRevealed(false); setOutcome(null); setInput(""); setHint(""); setDetailsOverride(null);
      setPhase(items.length ? "review" : "complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load reviews."); setPhase("choose"); }
    finally { locked.current = false; }
  }
  const startedFromCard = useRef(false);
  const startFromCard = useEffectEvent(() => { void start(); });
  useEffect(() => {
    if (!initialMode || !connection.data?.connected || startedFromCard.current) return;
    startedFromCard.current = true;
    startFromCard();
  }, [initialMode, connection.data?.connected]);
  const current = queue[0];
  const mixedPrevious = useRef<string | undefined>(undefined);
  const reportMixed = useEffectEvent(() => {
    const previous = mixedPrevious.current;
    mixedPrevious.current = current?.data.id;
    mixed?.report(bpHead(current, Boolean(previous && previous === current?.data.id && preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect)));
  });
  const mixedFailed = phase === "choose" && Boolean(error || connection.error);
  const reportMixedError = useEffectEvent(() => mixed?.reportError?.(mixedFailed));
  useEffect(() => { reportMixedError(); }, [mixedFailed]);
  useEffect(() => { if (phase === "review" || phase === "complete") reportMixed(); }, [queue, phase]);
  useEffect(() => { if (mixed?.active) inputRef.current?.focus(); }, [mixed?.active]);
  const content = current ? reviewContent(current) : null;
  const question = content?.question ?? {};
  const sentence = parseQuestionSentence(sanitizeQuestionContent(question.content));
  const answer = pickCanonicalAnswer(question);
  const questionKind = bunproQuestionKind(current);
  const selfAssessment = usesSelfAssessment(questionKind, preferences);
  const revealed = Boolean(outcome || (selfAssessment && ankiRevealed));
  const reviewViewportRef = useMobileReviewViewport<HTMLElement>(mixed?.active !== false && phase === "review" && !selfAssessment);
  const jitaiFamily = resolveJitaiFontFamily(preferences, `bunpro:${current?.data.id ?? ""}`);
  const displayAnswers = bunproDisplayAnswers(question);
  const paused = Boolean(outcome && shouldPauseAfterResult(outcome.correct ? "correct" : "incorrect", preferences));
  const details = Boolean(revealed && (detailsOverride ?? (paused && preferences.showAnswerStopSubjectDetails)));
  const accepted = displayAnswers;
  const alternativeFeedback = [...buildAnswerFeedbackMap(question.alternate_answers)];
  const hasAudio = bunproAudioUrls(question, "both").length > 0;
  function replayAudio() { return audio.play(bunproAudioUrls(question, preferences.vocabularyAudioVoice)); }
  function startVoiceAnswer() {
    if (!preferences.voiceAnswers || outcome || selfAssessment || saving) return;
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) { setSpeechError("Speech recognition is not available in this browser."); return; }
    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = questionKind === "reading" ? "ja-JP" : "en-US";
    recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { setInput(event.results[0]?.[0]?.transcript?.trim() || ""); setSpeechError(""); };
    recognition.onerror = () => setSpeechError("Speech recognition could not hear an answer. You can keep typing.");
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition; setListening(true); setSpeechError("");
    try { recognition.start(); } catch { setListening(false); setSpeechError("Speech recognition could not start. You can keep typing."); }
  }
  function revealAnswer() {
    if (revealed || !selfAssessment || !current) return;
    setAnkiRevealed(true);
    if (preferences.autoplayAudio) void replayAudio();
  }
  function gradeSelf(correct: boolean) {
    if (!ankiRevealed || outcome || saving) return;
    setOutcome({ correct, entered: answer });
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
  }
  function check() {
    if (!current || !content || outcome || saving || composing.current || !input.trim()) return;
    const correct = questionKind === "meaning" ? displayAnswers.some((value) => normalizeMeaning(value) === normalizeMeaning(input)) : collectAcceptedAnswers(question).includes(normalizeAnswer(input));
    const alternate = buildAnswerFeedbackMap(question.alternate_answers).get(normalizeAnswer(input));
    if (!correct && alternate) { setHint(alternate); return; }
    setHint(correct ? "" : buildAnswerFeedbackMap(question.wrong_answers).get(normalizeAnswer(input)) ?? "");
    setOutcome({ correct, entered: input });
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    if (preferences.autoplayAudio && (correct || preferences.pauseOnWrong)) void replayAudio();
  }
  async function advance() {
    if (!current || !content || !outcome || locked.current) return;
    recognitionRef.current?.stop();
    locked.current = true; setSaving(true); setError(""); audio.stop();
    try {
      let next = queue.slice(1);
      const isRepeat = submitted.has(current.data.id);
      let saved = submitted;
      let expectedTotal = reviewTotal;
      if (!isRepeat) {
        const response = await bunpro<Partial<BunproReviewQuizIndexResponse> & Record<string, unknown>>("", { method: "POST", body: JSON.stringify({ action: "review", reviewId: current.data.id, sessionId, correct: outcome.correct, mode, ...(lessonSession ? { context: "learn" } : {}), requestMore: !lessonSession && submitted.size + queue.filter((item) => !submitted.has(item.data.id)).length < sessionLimit.current && queue.filter((item) => !submitted.has(item.data.id)).length <= 10, reviewableType: content.kind === "grammar" ? "GrammarPoint" : "Vocab", loadedIds: queue.filter((item) => !submitted.has(item.data.id)).map((item) => Number(item.data.id)) }) });
        setProgression(bunproProgression(current.data.id, sanitizeText(content.attributes.title) || answer, current.data.attributes, response));
        void queryClient.invalidateQueries({ queryKey: ["bunpro", "due"] });
        void queryClient.invalidateQueries({ queryKey: ["bunpro", "forecast"] });
        if (lessonSession) void queryClient.invalidateQueries({ queryKey: ["bunpro", "lesson-queue"] });
        saved = new Set(submitted).add(current.data.id);
        setSubmitted(saved);
        const seen = new Set([...saved, ...next.map((item) => item.data.id)]);
        next = [...next, ...(lessonSession ? [] : orderBunproReviews(buildReviewQueue(response), preferences)).filter((item) => !seen.has(item.data.id))];
        let remainingSlots = Math.max(0, sessionLimit.current - saved.size);
        next = next.filter((item) => saved.has(item.data.id) || remainingSlots-- > 0);
        expectedTotal = Math.min(sessionLimit.current, Math.max(expectedTotal, saved.size + next.filter((item) => !saved.has(item.data.id)).length));
        setReviewTotal(expectedTotal);
        setResults((previous) => [...previous, { title: sanitizeText(content.attributes.title) || answer, correct: outcome.correct }]);
      }
      if (!outcome.correct) {
        if (preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect) next.unshift(current);
        else next.push(current);
      }
      // A short response is a page, not completion. Retry fetching without resubmitting a saved answer.
      if (!lessonSession && !next.length && saved.size < expectedTotal) {
        const more = await bunpro<BunproReviewQuizIndexResponse>(`action=queue&mode=${mode}`);
        if (!Number.isInteger(more.review_session_id) || more.review_session_id <= 0) throw new Error("Could not load the next review batch. Press Next to retry.");
        next = orderBunproReviews(buildReviewQueue(more), preferences).filter((item) => !saved.has(item.data.id)).slice(0, Math.max(0, sessionLimit.current - saved.size));
        if (!next.length && pendingReviewTotal(more) > 0) throw new Error("Bunpro still has reviews pending but returned no new questions. Press Next to retry.");
        setSessionId(more.review_session_id);
        setReviewTotal(Math.min(sessionLimit.current, Math.max(saved.size + next.length, saved.size + pendingReviewTotal(more))));
      }
      mixed?.onAnswer?.({ id: `bunpro:${current.data.id}`, source: "bunpro", title: sanitizeText(content.attributes.title) || answer, correct: outcome.correct });
      setAnkiRevealed(false); setAlternativesOpen(false); setHintLevel(2); setQueue(next); setInput(""); setOutcome(null); setHint(""); setDetailsOverride(null);
      if (!next.length) setPhase("complete");
      else requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Please try again."); }
    finally { locked.current = false; setSaving(false); }
  }
  function resetAnswer() {
    audio.stop(); setAnkiRevealed(false); setOutcome(null); setHint(""); setInput(""); setError(""); setDetailsOverride(null); setAlternativesOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function skip() {
    if (!preferences.allowSkippingReviews || locked.current || !current || submitted.has(current.data.id)) return;
    recognitionRef.current?.stop();
    // Defer the question within this session without sending a grade to Bunpro.
    setQueue((items) => [...items.slice(1), items[0]]); setHintLevel(2);
    resetAnswer();
  }
  function wrapUp() {
    const retained = queue.slice(0, Math.max(1, preferences.reviewWrapUpSize));
    const pending = retained.filter((item) => !submitted.has(item.data.id)).length;
    sessionLimit.current = submitted.size + pending;
    setReviewTotal(sessionLimit.current);
    setQueue(retained);
  }
  useEffect(() => { if (mixed?.active === false) recognitionRef.current?.stop(); }, [mixed?.active]);
  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (mixed?.active === false || !outcome || paused || saving || error || audio.playing || audio.error || details || alternativesOpen) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [outcome, paused, saving, error, audio.playing, audio.error, details, alternativesOpen, preferences.answerStopBehavior, mixed?.active]);
  useEffect(() => {
    if (!progression) return;
    const timer = window.setTimeout(() => setProgression(null), 3000);
    return () => window.clearTimeout(timer);
  }, [progression]);
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || composing.current || !(target instanceof HTMLElement) || target.closest("button, a, select, textarea, [contenteditable=true]")) return;
    if (event.key === "Enter" && !target.closest("input")) { event.preventDefault(); if (outcome) void advance(); else if (selfAssessment) revealAnswer(); else check(); }
    if (selfAssessment && ankiRevealed && !outcome && (event.key === "1" || event.key === "2")) { event.preventDefault(); gradeSelf(event.key === "2"); }
    if (revealed && event.key.toLowerCase() === "d") { event.preventDefault(); setDetailsOverride(!details); }
    if (revealed && event.key.toLowerCase() === "r") { event.preventDefault(); void replayAudio(); }
    if (revealed && event.key === " " && !target.closest("input")) { event.preventDefault(); void replayAudio(); }
  });
  useEffect(() => {
    if (mixed?.active === false || phase !== "review" || !preferences.keyboardShortcuts) return;
    const listener = (event: KeyboardEvent) => shortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [phase, preferences.keyboardShortcuts, mixed?.active]);
  if (phase === "choose" && initialMode && connection.isPending) return <BunproLoading kind="reviews" />;
  if (phase === "choose") return <main className={styles.chooser}><div className={styles.row}><h1>Bunpro reviews</h1><ButtonLink href="/dashboard" tone="ghost">Back</ButtonLink></div><p>Choose what you want to review.</p><fieldset className={styles.choices}><legend>Review type</legend>{(["grammar", "vocab", "all"] as const).map((value) => <label key={value}><input type="radio" name="bunpro-mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span>{labels[value]}</span></label>)}</fieldset>{connection.isPending ? <p role="status">Checking Bunpro connection…</p> : connection.data?.connected ? <Button tone="primary" onClick={start}>Start reviews</Button> : <ButtonLink href="/settings#bunpro-api-key">Add Bunpro API key</ButtonLink>}{error || connection.error ? <p role="alert">{error || connection.error?.message}</p> : null}</main>;
  if (phase === "loading") return <BunproLoading kind="reviews" />;
  if (phase === "complete") return <main className={styles.chooser}><BunproProgression progression={progression} mode={preferences.srsProgressionCardDisplayMode} /><h1>{results.length ? lessonSession ? "Lesson quiz complete" : "Bunpro reviews complete" : "No Bunpro reviews waiting"}</h1><p>{results.length ? `${results.length} reviews saved · ${results.filter((item) => item.correct).length} correct on the first attempt` : `You are caught up with ${labels[mode].toLowerCase()}.`}</p>{results.length ? <ul className={styles.results}>{results.map((item, index) => <li key={index}><span lang="ja">{item.title}</span><span>{item.correct ? "Correct" : "Practiced again"}</span></li>)}</ul> : null}<div className="cluster"><ButtonLink href="/dashboard" tone="primary">Back to home</ButtonLink>{onContinueLessons ? <Button onClick={onContinueLessons}>Continue lessons</Button> : <Button onClick={() => setPhase("choose")}>Check for more</Button>}</div></main>;
  if (!current || !content) return null;
  const valid = Boolean(answer && sanitizeQuestionContent(question.content));
  const total = Math.max(reviewTotal, results.length + queue.filter((item) => !submitted.has(item.data.id)).length);
  return <main ref={reviewViewportRef} className={`${quiz.quizShell} ${styles.reviewShell}`} data-study-session="active" style={{ "--jitai-font": jitaiFamily } as CSSProperties}>
      <div className={quiz.quizTopbar}><span>Bunpro · {Math.min(results.length + 1, total)} / {total}</span><div className={quiz.progressTrack} role="progressbar" aria-label="Review progress" aria-valuenow={results.length} aria-valuemin={0} aria-valuemax={Math.max(1, total)}><span style={{ transform: `scaleX(${results.length / Math.max(1, total)})` }} /></div><div className={quiz.quizTopbarActions}>{!lessonSession && queue.length > preferences.reviewWrapUpSize ? <Button tone="ghost" size="small" disabled={saving} onClick={wrapUp}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}{preferences.reviewSearchButtonEnabled ? <ButtonLink href={`/search?q=${encodeURIComponent(sanitizeText(content.attributes.title))}`} target="_blank" tone="ghost" aria-label="Search this item"><Search size={18} /></ButtonLink> : null}<ButtonLink className={quiz.iconButton} href="/dashboard" tone="ghost" aria-label="Pause and exit session"><X size={19} /></ButtonLink></div></div>
      {mixed?.active ? <MixedPreviousBadge key={mixed.previous?.id} answer={mixed.previous} animate={preferences.reviewAnimatePreviousQuestion} /> : null}
      <header className={`${quiz.questionCard} ${styles.sentenceArea}`} aria-label="Bunpro review">
          {submitted.has(current.data.id) ? <p>Practice again</p> : null}
          {(hintLevel >= 2 || revealed) && question.tense ? <p><BunproText value={question.tense} /></p> : null}
          <div className={styles.sentence} lang="ja" style={{ fontSize: `calc(clamp(1.6rem, 3vw, 2.8rem) * ${preferences.reviewCharacterFontScale})` }}><RubyText text={sentence.beforeBlank} />{sentence.hasBlank ? <span className={styles.blank} data-correct={outcome?.correct}><RubyText text={revealed ? answer : input || "　　"} /></span> : null}<RubyText text={sentence.afterBlank} /></div>
          {(hintLevel >= 2 || revealed) && question.word_prompt ? <p lang="ja"><BunproText value={question.word_prompt} /></p> : null}
          {(questionKind !== "meaning" && hintLevel >= 1) || revealed ? <div className={styles.translation}><BunproText value={question.translation} /></div> : null}
          {hintLevel >= 3 ? <div className={styles.grammarHint} aria-live="polite">{hintLevel >= 4 ? <p lang="ja"><BunproText value={content.attributes.nuance} /></p> : null}<p><BunproText value={content.attributes.nuance_translation} /></p>{question.extra_info ? <p><BunproText value={question.extra_info} /></p> : null}</div> : null}
      </header>
      <div className={quiz.answerArea}>
        <BunproProgression progression={progression} mode={preferences.srsProgressionCardDisplayMode} idleContent={<div className={core.itemMeta}>{preferences.showReviewItemLevelAndSrsStage ? <><span>{sanitizeText(content.attributes.level || content.attributes.jlpt_level)}</span>{bunproStage(current.data.attributes).label ? <span>{bunproStage(current.data.attributes).label}</span> : null}</> : null}<span>{submitted.has(current.data.id) ? "Practice again" : `${results.length} completed`}</span></div>} />
        {!valid ? <p role="alert">This review is missing its sentence or accepted answers. Pause and reload the queue before continuing.</p> : selfAssessment ? <>
          {!outcome ? <AnkiAnswerContent revealed={ankiRevealed} hideAnswerCompletely={preferences.ankiHideAnswerCompletely} questionKind={questionKind}
            meaningAnswer={questionKind === "meaning" ? answer : sanitizeText(content.attributes.meaning)} readingAnswer={questionKind === "reading" ? answer : sanitizeText(content.attributes.kana)}
            groupQuestions={preferences.ankiMode === "both" && preferences.ankiGroupQuestions}
            otherMeaningAnswers={questionKind === "meaning" ? displayAnswers.filter((value) => value !== answer) : []} otherReadingAnswers={questionKind === "reading" ? displayAnswers.filter((value) => value !== answer) : []}
            partsOfSpeech={Array.isArray(content.attributes.jmdict_pos) ? content.attributes.jmdict_pos.filter((value): value is string => typeof value === "string") : [sanitizeText(content.attributes.part_of_speech_translation)].filter(Boolean)} pitchAccents={bunproPitchAccents(content.attributes)}
            showOtherAcceptedAnswersAndUserSynonyms={preferences.ankiShowOtherAcceptedAnswersAndUserSynonyms} showWaniKaniGrammarTags={preferences.ankiShowWaniKaniGrammarTags} showPitchAccentNumbers={preferences.ankiShowPitchAccentNumbers} showPitchAccentGraph={preferences.ankiShowPitchAccentGraph}
            showReplayAudioButton={preferences.ankiShowReplayAudioButton && hasAudio} buttonlessMode={preferences.ankiButtonlessMode} replayingAudio={audio.playing}
            onReveal={revealAnswer} onReplayAudio={replayAudio} onGradeIncorrect={() => gradeSelf(false)} onGradeCorrect={() => gradeSelf(true)} onShowDetails={() => setDetailsOverride(!details)} onSkip={preferences.allowSkippingReviews && queue.length > 1 ? skip : undefined} /> : <Button tone="primary" disabled={saving} onClick={() => void advance()}><ArrowRight size={18} aria-hidden />Next</Button>}
        </> : <form className={quiz.answerForm} onSubmit={(event) => { event.preventDefault(); if (outcome) void advance(); else check(); }}>
          <label className={quiz.promptTypeStrip} data-tone={questionKind} htmlFor={answerId}><span>{content.kind === "grammar" ? "Grammar" : "Vocabulary"}</span><strong>{questionKind === "meaning" ? "Meaning" : "Reading"}</strong>{questionKind === "reading" ? <small>Romaji → かな</small> : null}</label>
          <div className={quiz.answerInputRow} data-result={outcome ? outcome.correct ? "correct" : "incorrect" : undefined}>
            <input key={current.data.id} ref={inputRef} autoFocus={mixed?.active !== false} id={answerId} aria-label="Your answer" style={{ fontSize: `calc(var(--text-md) * ${preferences.reviewInputFontScale})` }} value={input} readOnly={Boolean(outcome)} disabled={saving} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" aria-describedby={helperId} placeholder={questionKind === "meaning" ? "Type the meaning…" : "Type kana or romaji…"} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; setInput(event.currentTarget.value); }} onChange={(event) => setInput(composing.current || questionKind === "meaning" ? event.target.value : composeKanaInput(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault(); }} />
            {preferences.voiceAnswers && !outcome ? <Button type="button" tone="ghost" aria-label="Answer with voice" disabled={listening || saving} onClick={startVoiceAnswer}><Mic size={18} aria-hidden />{listening ? "Listening…" : "Speak"}</Button> : null}
            <Button className={quiz.primaryButton} type="submit" tone="primary" onMouseDown={(event) => { if (phoneInput) event.preventDefault(); }} disabled={saving || (!outcome && !input.trim())} state={saving && phoneInput ? "loading" : "idle"}>{outcome ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}{outcome ? "Next" : "Check"}</Button>
          </div>
          <p id={helperId} className="sr-only">{questionKind === "meaning" ? "Enter the English meaning." : "Kana and romaji are accepted."}</p>
        </form>}
        <div className={styles.answerControls} aria-label="Answer controls">
          {content.kind === "grammar" ? <Button tone="ghost" aria-label={`Hint level ${hintLevel} of 4`} onClick={() => setHintLevel((level) => (level + 1) % 5)}><Lightbulb size={17} aria-hidden />Hint <span className={styles.hintDots} aria-hidden>{Array.from({ length: 4 }, (_, i) => <span key={i} data-active={i < hintLevel} />)}</span></Button> : null}
          {outcome ? <>
            <Button tone="ghost" disabled={saving || submitted.has(current.data.id)} onClick={resetAnswer}><RotateCcw size={17} aria-hidden />Undo</Button>
            <Button tone="ghost" disabled={!content.slug || saving} aria-controls={detailsId} aria-expanded={details} onClick={() => setDetailsOverride(!details)}><Info size={17} aria-hidden />{details ? "Hide Info" : "Info"}</Button>
            <Button tone="ghost" disabled={saving} aria-controls={alternativesId} aria-expanded={alternativesOpen} onClick={() => setAlternativesOpen(!alternativesOpen)}><List size={17} aria-hidden />Alternatives</Button>
            <Button tone="ghost" disabled={!hasAudio || saving} aria-label={audio.playing ? "Replay audio" : "Audio"} onClick={() => void replayAudio()}><Volume2 size={17} aria-hidden />{hasAudio ? "Audio" : "No audio"}</Button>
            <Button tone={outcome.correct ? "ghost" : "primary"} disabled={saving || submitted.has(current.data.id)} onClick={() => setOutcome({ ...outcome, correct: !outcome.correct })}>{outcome.correct ? <X size={17} aria-hidden /> : <Check size={17} aria-hidden />}{outcome.correct ? "Mark Incorrect" : "Mark Correct"}</Button>
          </> : null}
          {preferences.allowSkippingReviews ? <Button tone="ghost" disabled={saving || submitted.has(current.data.id) || queue.length < 2} onClick={skip} title="Move this question to the end without saving an answer"><SkipForward size={17} aria-hidden />Skip</Button> : null}
        </div>
        {outcome && alternativesOpen ? <section className={styles.alternatives} id={alternativesId}><h3>Accepted answers</h3><ul>{accepted.map((value) => <li key={value} lang="ja">{value}</li>)}</ul>{alternativeFeedback.length ? <><h3>Other answers</h3><p>These answers need a different form or nuance for this question.</p><dl>{alternativeFeedback.map(([value, message]) => <div key={value}><dt lang="ja">{value}</dt><dd>{message}</dd></div>)}</dl></> : null}</section> : null}
        <p className={quiz.keyboardHint}>{preferences.keyboardShortcuts ? (outcome ? "Enter advances · Space plays audio" : selfAssessment ? ankiRevealed ? "1 marks wrong · 2 marks correct · Space plays audio" : "Press Enter to reveal" : "Press Enter to check") : "Keyboard shortcuts are off"}</p>
        {speechError ? <p role="status">{speechError}</p> : null}
        {audio.error ? <p role="status" className={core.answerHelper}>{audio.error}</p> : null}
        {hint ? <p role="status">{hint}</p> : null}
        {outcome ? <div role="status" className={quiz.answerStatus}><strong className={quiz.answerVerdict} data-correct={outcome.correct}>{outcome.correct ? "Correct" : "Incorrect"}</strong><p>{outcome.correct ? "Your answer is correct." : <>The answer is <span lang="ja">{answer}</span>.</>}</p>{paused && preferences.showAnswerStopSubjectDetails ? <div className={core.answerStopDetails}><span>Expected answer</span><strong lang="ja">{answer}</strong></div> : null}{error ? <p className={core.error} role="alert">{error} Your current answer is kept on screen.</p> : null}</div> : null}
        {details && content.slug ? <div id={detailsId} className={styles.reviewDetails}><BunproDetails key={`${content.kind}:${content.slug}`} kind={content.kind} slug={content.slug} review={current.data.attributes} /></div> : null}
      </div>
  </main>;
}
