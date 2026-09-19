"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Info, Volume2, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { shouldPauseAfterResult } from "@/features/core-study/study-preferences";
import { useMobileReviewViewport } from "@/features/core-study/use-mobile-review-viewport";
import { usePhoneStudyInput } from "@/features/core-study/use-phone-study-input";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { BunproProgression } from "./BunproProgression";
import { bunproStage, bunproProgression, type BunproProgression as Progression } from "./progression";
import { bunproAudioUrls, useBunproAudio } from "./use-bunpro-audio";
import { Button, ButtonLink } from "@/components/ui/Button";
import { composeKanaInput } from "@/lib/kana";
import { bunpro } from "./client";
import { BunproLoading } from "./BunproLoading";
import { BunproDetails } from "./BunproDetails";
import { BunproText, RubyText } from "./BunproText";
import { buildAnswerFeedbackMap, buildReviewQueue, collectAcceptedAnswers, normalizeAnswer, parseQuestionSentence, pendingReviewTotal, pickCanonicalAnswer, reviewContent, sanitizeQuestionContent, sanitizeText, shuffleReviewQueue, type BunproReviewQueueItem, type BunproReviewQuizIndexResponse, type ReviewMode } from "./model";
import quiz from "@/features/study/study.module.css";
import core from "@/features/core-study/core-study.module.css";
import styles from "./bunpro.module.css";

type Outcome = { correct: boolean; entered: string };
const labels = { grammar: "Grammar", vocab: "Vocabulary", all: "Grammar & vocabulary" };
export function BunproReviews({ initialMode, lessonSession, onContinueLessons }: { initialMode?: ReviewMode; lessonSession?: BunproReviewQuizIndexResponse; onContinueLessons?: () => void } = {}) {
  const { user } = useSession();
  const preferences = useWebSettings(user?.data.username ?? "anonymous").study;
  const queryClient = useQueryClient();
  const phoneInput = usePhoneStudyInput();
  const audio = useBunproAudio();
  const [progression, setProgression] = useState<Progression | null>(null);
  const [mode, setMode] = useState<ReviewMode>(initialMode ?? "all");
  const [phase, setPhase] = useState<"choose" | "loading" | "review" | "complete">(lessonSession ? "review" : "choose");
  const reviewViewportRef = useMobileReviewViewport<HTMLElement>(phase === "review");
  const [queue, setQueue] = useState<BunproReviewQueueItem[]>(() => lessonSession ? buildReviewQueue(lessonSession) : []);
  const [reviewTotal, setReviewTotal] = useState(lessonSession ? buildReviewQueue(lessonSession).length : 0);
  const [sessionId, setSessionId] = useState(lessonSession?.review_session_id ?? 0);
  const [input, setInput] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ title: string; correct: boolean }[]>([]);
  const [submitted, setSubmitted] = useState(new Set<string>());
  const locked = useRef(false);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  async function start() {
    if (locked.current) return;
    locked.current = true;
    audio.stop(); setProgression(null);
    setPhase("loading"); setError("");
    try {
      const data = await bunpro<BunproReviewQuizIndexResponse>(`action=queue&mode=${mode}`);
      const items = shuffleReviewQueue(buildReviewQueue(data));
      if (!Number.isInteger(data.review_session_id) || data.review_session_id <= 0) throw new Error("Bunpro did not return a valid review session. Please try again.");
      if (!items.length && pendingReviewTotal(data) > 0) throw new Error("Bunpro reports pending reviews but returned no questions. Please try again.");
      setQueue(items); setReviewTotal(Math.max(items.length, pendingReviewTotal(data))); setSessionId(data.review_session_id); setResults([]); setSubmitted(new Set());
      setOutcome(null); setInput(""); setHint(""); setDetailsOverride(null);
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
  const content = current ? reviewContent(current) : null;
  const question = content?.question ?? {};
  const sentence = parseQuestionSentence(sanitizeQuestionContent(question.content));
  const answer = pickCanonicalAnswer(question);
  const paused = Boolean(outcome && shouldPauseAfterResult(outcome.correct ? "correct" : "incorrect", preferences));
  const details = Boolean(outcome && (detailsOverride ?? (paused && preferences.showAnswerStopSubjectDetails)));
  const hasAudio = bunproAudioUrls(question, "both").length > 0;
  function replayAudio() { return audio.play(bunproAudioUrls(question, preferences.vocabularyAudioVoice)); }
  function check() {
    if (!current || !content || outcome || saving || composing.current || !input.trim()) return;
    const correct = collectAcceptedAnswers(question).includes(normalizeAnswer(input));
    const alternate = buildAnswerFeedbackMap(question.alternate_answers).get(normalizeAnswer(input));
    if (!correct && alternate) { setHint(alternate); return; }
    setHint(correct ? "" : buildAnswerFeedbackMap(question.wrong_answers).get(normalizeAnswer(input)) ?? "");
    setOutcome({ correct, entered: input });
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    if (preferences.autoplayAudio && (correct || preferences.pauseOnWrong)) void replayAudio();
  }
  async function advance() {
    if (!current || !content || !outcome || locked.current) return;
    locked.current = true; setSaving(true); setError(""); audio.stop();
    try {
      let next = queue.slice(1);
      const isRepeat = submitted.has(current.data.id);
      let saved = submitted;
      let expectedTotal = reviewTotal;
      if (!isRepeat) {
        const response = await bunpro<Partial<BunproReviewQuizIndexResponse> & Record<string, unknown>>("", { method: "POST", body: JSON.stringify({ action: "review", reviewId: current.data.id, sessionId, correct: outcome.correct, mode, ...(lessonSession ? { context: "learn" } : {}), requestMore: !lessonSession && queue.filter((item) => !submitted.has(item.data.id)).length <= 10, reviewableType: content.kind === "grammar" ? "GrammarPoint" : "Vocab", loadedIds: queue.filter((item) => !submitted.has(item.data.id)).map((item) => Number(item.data.id)) }) });
        setProgression(bunproProgression(current.data.id, sanitizeText(content.attributes.title) || answer, current.data.attributes, response));
        void queryClient.invalidateQueries({ queryKey: ["bunpro", "due"] });
        if (lessonSession) void queryClient.invalidateQueries({ queryKey: ["bunpro", "lesson-queue"] });
        saved = new Set(submitted).add(current.data.id);
        setSubmitted(saved);
        const seen = new Set([...saved, ...next.map((item) => item.data.id)]);
        next = [...next, ...(lessonSession ? [] : shuffleReviewQueue(buildReviewQueue(response))).filter((item) => !seen.has(item.data.id))];
        expectedTotal = Math.max(expectedTotal, saved.size + next.filter((item) => !saved.has(item.data.id)).length);
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
        next = shuffleReviewQueue(buildReviewQueue(more)).filter((item) => !saved.has(item.data.id));
        if (!next.length && pendingReviewTotal(more) > 0) throw new Error("Bunpro still has reviews pending but returned no new questions. Press Next to retry.");
        setSessionId(more.review_session_id);
        setReviewTotal(Math.max(saved.size + next.length, saved.size + pendingReviewTotal(more)));
      }
      setQueue(next); setInput(""); setOutcome(null); setHint(""); setDetailsOverride(null);
      if (!next.length) setPhase("complete");
      else requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Please try again."); }
    finally { locked.current = false; setSaving(false); }
  }
  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (!outcome || paused || detailsOverride === true || saving || error || audio.playing) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [outcome, paused, detailsOverride, saving, error, audio.playing, preferences.answerStopBehavior]);
  useEffect(() => {
    if (!progression) return;
    const timer = window.setTimeout(() => setProgression(null), 3000);
    return () => window.clearTimeout(timer);
  }, [progression]);
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (event.repeat || event.isComposing || composing.current || !(target instanceof HTMLElement) || target.closest("button, a, select, textarea, [contenteditable=true]")) return;
    if (event.key === "Enter" && !target.closest("input")) { event.preventDefault(); if (outcome) void advance(); else check(); }
    if (outcome && event.key === " " && !target.closest("input")) { event.preventDefault(); void replayAudio(); }
  });
  useEffect(() => {
    if (phase !== "review" || !preferences.keyboardShortcuts) return;
    const listener = (event: KeyboardEvent) => shortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [phase, preferences.keyboardShortcuts]);
  if (phase === "choose" && initialMode && connection.isPending) return <BunproLoading kind="reviews" />;
  if (phase === "choose") return <main className={styles.chooser}><div className={styles.row}><h1>Bunpro reviews</h1><ButtonLink href="/dashboard" tone="ghost">Back</ButtonLink></div><p>Choose what you want to review.</p><fieldset className={styles.choices}><legend>Review type</legend>{(["grammar", "vocab", "all"] as const).map((value) => <label key={value}><input type="radio" name="bunpro-mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span>{labels[value]}</span></label>)}</fieldset>{connection.isPending ? <p role="status">Checking Bunpro connection…</p> : connection.data?.connected ? <Button tone="primary" onClick={start}>Start reviews</Button> : <ButtonLink href="/settings#bunpro-api-key">Add Bunpro API key</ButtonLink>}{error || connection.error ? <p role="alert">{error || connection.error?.message}</p> : null}</main>;
  if (phase === "loading") return <BunproLoading kind="reviews" />;
  if (phase === "complete") return <main className={styles.chooser}><BunproProgression progression={progression} mode={preferences.srsProgressionCardDisplayMode} /><h1>{results.length ? lessonSession ? "Lesson quiz complete" : "Bunpro reviews complete" : "No Bunpro reviews waiting"}</h1><p>{results.length ? `${results.length} reviews saved · ${results.filter((item) => item.correct).length} correct on the first attempt` : `You are caught up with ${labels[mode].toLowerCase()}.`}</p>{results.length ? <ul className={styles.results}>{results.map((item, index) => <li key={index}><span lang="ja">{item.title}</span><span>{item.correct ? "Correct" : "Practiced again"}</span></li>)}</ul> : null}<div className="cluster"><ButtonLink href="/dashboard" tone="primary">Back to home</ButtonLink>{onContinueLessons ? <Button onClick={onContinueLessons}>Continue lessons</Button> : <Button onClick={() => setPhase("choose")}>Check for more</Button>}</div></main>;
  if (!current || !content) return null;
  const valid = Boolean(answer && sanitizeQuestionContent(question.content));
  const total = Math.max(reviewTotal, results.length + queue.filter((item) => !submitted.has(item.data.id)).length);
  return <main ref={reviewViewportRef} className={`${quiz.quizShell} ${styles.reviewShell}`} data-study-session="active">
      <div className={quiz.quizTopbar}><span>Bunpro · {Math.min(results.length + 1, total)} / {total}</span><div className={quiz.progressTrack} role="progressbar" aria-label="Review progress" aria-valuenow={results.length} aria-valuemin={0} aria-valuemax={Math.max(1, total)}><span style={{ transform: `scaleX(${results.length / Math.max(1, total)})` }} /></div><div className={quiz.quizTopbarActions}><ButtonLink className={quiz.iconButton} href="/dashboard" tone="ghost" aria-label="Pause and exit session"><X size={19} /></ButtonLink></div></div>
      <header className={`${quiz.questionCard} ${styles.sentenceArea}`} aria-label="Bunpro review">
          {submitted.has(current.data.id) ? <p>Practice again</p> : null}
          {question.tense ? <p><BunproText value={question.tense} /></p> : null}
          <div className={styles.sentence} lang="ja" style={{ fontSize: `calc(clamp(1.6rem, 3vw, 2.8rem) * ${preferences.reviewCharacterFontScale})` }}><RubyText text={sentence.beforeBlank} />{sentence.hasBlank ? <span className={styles.blank} data-correct={outcome?.correct}><RubyText text={outcome ? answer : input || "　　"} /></span> : null}<RubyText text={sentence.afterBlank} /></div>
          {question.word_prompt ? <p lang="ja"><BunproText value={question.word_prompt} /></p> : null}
          <div className={styles.translation}><BunproText value={question.translation} /></div>
      </header>
      <div className={quiz.answerArea}>
        <BunproProgression progression={progression} mode={preferences.srsProgressionCardDisplayMode} idleContent={<div className={core.itemMeta}>{preferences.showReviewItemLevelAndSrsStage ? <><span>{sanitizeText(content.attributes.level || content.attributes.jlpt_level)}</span>{bunproStage(current.data.attributes).label ? <span>{bunproStage(current.data.attributes).label}</span> : null}</> : null}<span>{submitted.has(current.data.id) ? "Practice again" : `${results.length} completed`}</span></div>} />
        {!valid ? <p role="alert">This review is missing its sentence or accepted answers. Pause and reload the queue before continuing.</p> : <form className={quiz.answerForm} onSubmit={(event) => { event.preventDefault(); if (outcome) void advance(); else check(); }}>
          <label className={quiz.promptTypeStrip} data-tone="reading" htmlFor="bunpro-answer"><span>{content.kind === "grammar" ? "Grammar" : "Vocabulary"}</span><strong>Reading</strong><small>Romaji → かな</small></label>
          <div className={quiz.answerInputRow} data-result={outcome ? outcome.correct ? "correct" : "incorrect" : undefined}>
            <input key={current.data.id} ref={inputRef} autoFocus id="bunpro-answer" aria-label="Your answer" style={{ fontSize: `calc(var(--text-md) * ${preferences.reviewInputFontScale})` }} value={input} readOnly={Boolean(outcome)} disabled={saving} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" aria-describedby="bunpro-answer-helper" placeholder="Type kana or romaji…" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; setInput(event.currentTarget.value); }} onChange={(event) => setInput(composing.current ? event.target.value : composeKanaInput(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault(); }} />
            <Button className={quiz.primaryButton} type="submit" tone="primary" onMouseDown={(event) => { if (phoneInput) event.preventDefault(); }} disabled={saving || (!outcome && !input.trim())} state={saving && phoneInput ? "loading" : "idle"}>{outcome ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}{outcome ? "Next" : "Check"}</Button>
          </div>
          <p id="bunpro-answer-helper" className="sr-only">Kana and romaji are accepted.</p>
        </form>}
        {outcome ? <div className={quiz.reviewTools} aria-label="Answer controls">
          <Button className={quiz.textButton} tone="ghost" disabled={!hasAudio || saving} aria-label={audio.playing ? "Replay audio" : "Audio"} onClick={() => void replayAudio()}><Volume2 size={17} aria-hidden /><span>{hasAudio ? "Audio" : "No audio"}</span></Button>
          
          <Button className={quiz.textButton} tone="ghost" disabled={!outcome || !content.slug || saving} aria-controls="bunpro-review-details" aria-expanded={details} onClick={() => { const open = !details; setDetailsOverride(open); if (open) requestAnimationFrame(() => document.getElementById("bunpro-review-details")?.scrollIntoView({ block: "start", behavior: "smooth" })); }}><Info size={17} aria-hidden /><span>Info</span></Button>
        </div> : null}
        <p className={quiz.keyboardHint}>{preferences.keyboardShortcuts ? (outcome ? "Enter advances · Space plays audio" : "Press Enter to check") : "Keyboard shortcuts are off"}</p>
        {audio.error ? <p role="status" className={core.answerHelper}>{audio.error}</p> : null}
        {hint ? <p role="status">{hint}</p> : null}
        {outcome ? <div role="status" className={quiz.answerStatus}><strong className={quiz.answerVerdict} data-correct={outcome.correct}>{outcome.correct ? "Correct" : "Incorrect"}</strong><p>{outcome.correct ? "Your answer is correct." : <>The answer is <span lang="ja">{answer}</span>.</>}</p>{paused && preferences.showAnswerStopSubjectDetails ? <div className={core.answerStopDetails}><span>Expected answer</span><strong lang="ja">{answer}</strong></div> : null}{error ? <p className={core.error} role="alert">{error} Your current answer is kept on screen.</p> : null}</div> : null}
        {details && content.slug ? <div id="bunpro-review-details"><BunproDetails key={`${content.kind}:${content.slug}`} kind={content.kind} slug={content.slug} /></div> : null}
      </div>
  </main>;
}