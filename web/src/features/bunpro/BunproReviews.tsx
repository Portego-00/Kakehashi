"use client";
import { useReviewAnswerFocus } from "@/features/study/use-review-answer-focus";
import { ReviewSettingsButton } from "@/features/study/components/ReviewSettingsButton";
import { advanceReviewRetrySchedule, createReviewRetrySchedule, insertReviewRetry, orderReviewRetries, retainWrapUpReviews } from "@/features/study/review-queue";
import { useReviewOrdering } from "@/features/core-study/use-review-ordering";
import { studyShortcutAction, shortcutLabel, DEFAULT_STUDY_SHORTCUTS } from "@/features/settings/study-shortcuts";
import { type CSSProperties, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, TriangleAlert, Check, Info, Volume2, X, RotateCcw, SkipForward, List, Lightbulb, Search, Mic } from "lucide-react";
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
import { composeKanaInput, finalizeKanaInput } from "@/lib/kana";
import { bunpro } from "./client";
import { createBunproReviewSavePolicy } from "./review-save-policy";
import { BunproSaveWarning } from "./BunproSaveWarning";
import { bpHead, orderBunproReviews, type MixedBridge } from "@/features/mixed-reviews/ordering";
import { BunproLoading } from "./BunproLoading";
import { BunproDetails } from "./BunproDetails";
import { BunproSentence, BunproText, RubyText } from "./BunproText";
import { buildAnswerFeedbackMap, buildReviewQueue, loadedReviewIds, reviewKey, reviewType, collectAcceptedAnswers, normalizeAnswer, parseQuestionSentence, pendingReviewTotal, pickCanonicalAnswer, reviewContent, sanitizeQuestionContent, sanitizeText, type BunproReviewQueueItem, type BunproReviewQuizIndexResponse, type ReviewMode } from "./model";
import { ReviewAccuracy } from "@/features/study/components/ReviewAccuracy";
import { ReviewExitGuard } from "@/features/core-study/ReviewExitGuard";
import { ReviewDetailsReveal } from "@/features/study/components/ReviewDetailsReveal";
import { SessionResults } from "@/features/mixed-reviews/SessionResults";
import type { SessionResult } from "@/features/mixed-reviews/session-results";
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
  const savedProgressions = useRef(new Map<string, Progression>());
  const [mode, setMode] = useState<ReviewMode>(initialMode ?? "all");
  const [phase, setPhase] = useState<"choose" | "loading" | "review" | "complete">(lessonSession ? "review" : "choose");
  const [reviewSettingsOpen, setReviewSettingsOpen] = useState(false);
  const [queue, setQueue] = useState<BunproReviewQueueItem[]>(() => lessonSession ? buildReviewQueue(lessonSession) : []);
  useReviewOrdering(preferences, (next) => setQueue((pending) => pending.length ? [pending[0], ...orderBunproReviews(pending.slice(1), next)] : pending));
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
  const [saveFailure, setSaveFailure] = useState<{ canContinue: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAccuracy, setPendingAccuracy] = useState<{ id: string; correct: boolean } | null>(null);
  const [backgroundAdvance, setBackgroundAdvance] = useState(false);
  const drafts = useRef(new Map<string, string>());
  const [visitedDetails, setVisitedDetails] = useState<string | null>(null);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [localSavePolicy] = useState(createBunproReviewSavePolicy);
  const savePolicy = mixed?.bunproSavePolicy ?? localSavePolicy;
  const unsavedCount = results.filter(item => item.saveFailed).length;
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const [durationMs, setDurationMs] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  // Includes answers whose save failed, so paging and missed-answer practice do not submit them twice.
  const [handledIds, setHandledIds] = useState(new Set<string>());
  const locked = useRef(false);
  const composing = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useReviewAnswerFocus(inputRef, mixed?.active !== false);
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  async function start() {
    if (locked.current) return;
    locked.current = true;
    audio.stop(); setProgression(null);
    savedProgressions.current.clear();
    setPhase("loading"); setError(""); setSaveFailure(null);
    try {
      const data = await bunpro<BunproReviewQuizIndexResponse>(`action=queue&mode=${mode}`);
      sessionLimit.current = preferences.reviewBatchSizeEnabled ? Math.max(1, preferences.reviewBatchSize) : Infinity;
      const items = orderBunproReviews(buildReviewQueue(data), preferences).slice(0, sessionLimit.current);
      if (!Number.isInteger(data.review_session_id) || data.review_session_id <= 0) throw new Error("Bunpro did not return a valid review session. Please try again.");
      if (!items.length && pendingReviewTotal(data) > 0) throw new Error("Bunpro reports pending reviews but returned no questions. Please try again.");
      if (!mixed) localSavePolicy.succeeded();
      setSessionStartedAt(Date.now()); setDurationMs(0);
      setQueue(items); setReviewTotal(Math.min(sessionLimit.current, Math.max(items.length, pendingReviewTotal(data)))); setSessionId(data.review_session_id); setResults([]); setHandledIds(new Set()); setCompletedCount(0);
      setAnkiRevealed(false); setOutcome(null); setInput(""); setHint(""); setDetailsOverride(null);
      setPhase(items.length ? "review" : "complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load reviews."); setPhase("choose"); }
    finally { locked.current = false; }
  }
  const total = Math.max(reviewTotal, completedCount + queue.length);
  const reportMixedResults = useEffectEvent(() => mixed?.reportResults?.({ items: results, durationMs, pendingCount: 0 }));
  useEffect(() => { reportMixedResults(); }, [results, durationMs]);
  const current = queue[0];
  const currentKey = current ? reviewKey(current) : "";
  const currentReviewType = current ? reviewType(current) : "review";
  const specialReviewLabel = currentReviewType === "ghost_review" ? "Ghost review" : currentReviewType === "self_study_review" ? "Self-study review" : "";
  const stageLabel = currentReviewType === "ghost_review"
    ? current?.data.attributes.is_slain ? "Ghost cleared" : typeof current?.data.attributes.streak === "number" ? `Ghost ${current.data.attributes.streak + 1}` : ""
    : currentReviewType === "review" && current ? bunproStage(current.data.attributes).label : "";
  const accuracyResults = pendingAccuracy && !results.some(item => item.id === pendingAccuracy.id) ? [...results, pendingAccuracy] : results;
  const countedResults = accuracyResults.filter(item => !outcome || item.id !== `bunpro:${currentKey}`);
  const currentResult = accuracyResults.find(item => item.id === `bunpro:${currentKey}`);
  const answerAccuracy = { answered: countedResults.length + (outcome ? 1 : 0), correct: countedResults.filter(item => item.correct).length + (outcome && (currentResult?.correct ?? outcome.correct) ? 1 : 0) };
  const reportMixedAccuracy = useEffectEvent(() => mixed?.reportAccuracy?.(answerAccuracy));
  useEffect(() => { reportMixedAccuracy(); }, [answerAccuracy.correct, answerAccuracy.answered]);
  const reportMixedProgress = useEffectEvent(() => mixed?.reportProgress?.({ completed: completedCount, total }));
  useEffect(() => { reportMixedProgress(); }, [completedCount, total]);
  const startedFromCard = useRef(false);
  const startFromCard = useEffectEvent(() => { void start(); });
  useEffect(() => {
    if (!initialMode || !connection.data?.connected || startedFromCard.current) return;
    startedFromCard.current = true;
    startFromCard();
  }, [initialMode, connection.data?.connected]);
  const retrySchedule = useRef(createReviewRetrySchedule());
  const mixedPrevious = useRef<string | undefined>(undefined);
  const reportMixed = useEffectEvent(() => {
    const previous = mixedPrevious.current;
    mixedPrevious.current = currentKey;
    const head = bpHead(current, Boolean(previous && previous === currentKey && preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect), Math.max(queue.length, total - completedCount));
    mixed?.report(head ? { ...head, pending: queue.map(item => ({ id: reviewKey(item), subjectId: reviewKey(item), open: handledIds.has(reviewKey(item)) || pendingAccuracy?.id === `bunpro:${reviewKey(item)}` })), activate: (id) => {
      rememberDraft();
      setInput(drafts.current.get(id) ?? ""); drafts.current.delete(id);
      setOutcome(null); setHint(""); setAnkiRevealed(false); setDetailsOverride(null); setAlternativesOpen(false);
      setQueue(pending => {
      const selected = pending.find(item => reviewKey(item) === id);
      return !selected || pending[0] === selected ? pending : [selected, ...pending.filter(item => item !== selected)];
      });
    } } : null);
  });
  const mixedFailed = !saving && Boolean(error || (phase === "choose" && connection.error));
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
  const jitaiFamily = resolveJitaiFontFamily(preferences, `bunpro:${currentKey}`);
  const displayAnswers = bunproDisplayAnswers(question);
  const paused = Boolean(outcome && shouldPauseAfterResult(outcome.correct ? "correct" : "incorrect", preferences));
  const details = Boolean(revealed && (detailsOverride ?? (paused && preferences.showAnswerStopSubjectDetails)));
  if (details && current && visitedDetails !== currentKey) setVisitedDetails(currentKey);
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
    if (preferences.autoplayAudio) void audio.play(bunproAudioUrls(question, "female"));
  }
  function gradeSelf(correct: boolean) {
    if (!ankiRevealed || outcome || saving) return;
    const graded = { correct, entered: answer };
    setOutcome(graded);
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    void advance(undefined, graded);
  }
  function check() {
    if (!current || !content || outcome || saving || composing.current || !input.trim()) return;
    const submitted = questionKind === "reading" ? finalizeKanaInput(input) : input;
    setInput(submitted);
    const correct = questionKind === "meaning" ? displayAnswers.some((value) => normalizeMeaning(value) === normalizeMeaning(submitted)) : collectAcceptedAnswers(question).includes(normalizeAnswer(submitted));
    const alternate = buildAnswerFeedbackMap(question.alternate_answers).get(normalizeAnswer(submitted));
    if (!correct && alternate) { setHint(alternate); return; }
    setHint(correct ? "" : buildAnswerFeedbackMap(question.wrong_answers).get(normalizeAnswer(submitted)) ?? "");
    setOutcome({ correct, entered: submitted });
    if (preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    if (preferences.autoplayAudio && (correct || preferences.pauseOnWrong)) void audio.play(bunproAudioUrls(question, "female"));
  }
  const latestAnswer = useRef<{ id?: string; input: string; active: boolean }>({ input: "", active: true });
  useEffect(() => { latestAnswer.current = { id: currentKey, input, active: mixed?.active !== false }; }, [currentKey, input, mixed?.active]);
  function rememberDraft() { const latest = latestAnswer.current; if (latest.id) drafts.current.set(latest.id, latest.input); }
  function focusAnswer() { if (latestAnswer.current.active) inputRef.current?.focus(); }
  async function advance(correctOverride?: boolean, graded?: Outcome, continueWithoutSaving = false) {
    const resolvedOutcome = graded ?? outcome;
    if (!current || !content || !resolvedOutcome || locked.current) return;
    if (continueWithoutSaving && !saveFailure?.canContinue) return;
    const result = correctOverride === undefined ? resolvedOutcome : { ...resolvedOutcome, correct: correctOverride };
    if (correctOverride !== undefined && preferences.answerFeedbackSoundEnabled) playAnswerFeedback(correctOverride);
    setOutcome(result);
    recognitionRef.current?.stop();
    locked.current = true; setSaving(true); setError(""); setSaveFailure(null); audio.stop();
    setDetailsOverride(false); setAlternativesOpen(false);
    setPendingAccuracy({ id: `bunpro:${currentKey}`, correct: result.correct });
    const previousSchedule = retrySchedule.current;
    const retryRandom = result.correct ? 0 : Math.random();
    retrySchedule.current = advanceReviewRetrySchedule(previousSchedule, [currentKey], result.correct, retryRandom);
    const retryImmediately = !result.correct && preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect;
    // Keep submissions serialized, but don't make the next loaded question wait on the network.
    const showNextNow = queue.length > 1 && !retryImmediately && !saveFailure;
    const notifyAnswer = () => mixed?.onAnswer?.({ id: `bunpro:${currentKey}`, source: "bunpro", title: sanitizeText(content.attributes.title) || answer, correct: result.correct, bunproSubject: content.slug ? { kind: content.kind, slug: content.slug } : undefined });
    function showQuestion(next: BunproReviewQueueItem[]) {
      setAnkiRevealed(false); setAlternativesOpen(false); setHintLevel(2); setQueue(next);
      setInput(next[0] ? drafts.current.get(reviewKey(next[0])) ?? "" : "");
      if (next[0]) drafts.current.delete(reviewKey(next[0]));
      setOutcome(null); setHint(""); setDetailsOverride(null);
      requestAnimationFrame(() => focusAnswer());
    }
    if (showNextNow) {
      setBackgroundAdvance(true);
      const next = result.correct ? queue.slice(1) : insertReviewRetry(queue.slice(1), [current], { random: retryRandom });
      showQuestion(orderReviewRetries(next, new Set([...handledIds, currentKey]), reviewKey, reviewKey, retrySchedule.current));
      notifyAnswer();
    }
    try {
      let next = queue.slice(1);
      const isRepeat = handledIds.has(currentKey);
      let handled = handledIds;
      let expectedTotal = reviewTotal;
      // Bunpro's lesson quiz saves only correct answers; misses remain local until learned.
      if (!isRepeat && (!lessonSession || result.correct)) {
        let response: (Partial<BunproReviewQuizIndexResponse> & Record<string, unknown>) | null = null;
        const saveFailed = continueWithoutSaving;
        if (!continueWithoutSaving) try {
          response = await bunpro<typeof response>("", { method: "POST", body: JSON.stringify({ action: "review", reviewId: current.data.id, reviewType: currentReviewType, reviewableId: current.data.attributes.reviewable_id, sessionId, correct: result.correct, mode, ...(lessonSession ? { context: "learn" } : {}), requestMore: !lessonSession && handledIds.size + queue.filter((item) => !handledIds.has(reviewKey(item))).length < sessionLimit.current && queue.filter((item) => !handledIds.has(reviewKey(item))).length <= 1, reviewableType: content.kind === "grammar" ? "GrammarPoint" : "Vocab", ...loadedReviewIds(queue) }) });
          savePolicy.succeeded();
        } catch (cause) {
          const failure = savePolicy.failed(cause);
          setSaveFailure({ canContinue: !failure.pause });
          const message = cause instanceof Error ? cause.message : "Bunpro review could not be saved.";
          throw new Error(failure.pause ? `${message} ${failure.message}` : message);
        }
        const change = saveFailed || currentReviewType !== "review" ? undefined : bunproProgression(currentKey, sanitizeText(content.attributes.title) || answer, current.data.attributes, response);
        if (change) savedProgressions.current.set(currentKey, change);
        void queryClient.invalidateQueries({ queryKey: ["bunpro", "due"] });
        void queryClient.invalidateQueries({ queryKey: ["bunpro", "forecast"] });
        if (lessonSession) void queryClient.invalidateQueries({ queryKey: ["bunpro", "lesson-queue"] });
        handled = new Set(handledIds).add(currentKey);
        setHandledIds(handled);
        const seen = new Set([...handled, ...next.map(reviewKey)]);
        next = [...next, ...(lessonSession ? [] : orderBunproReviews(buildReviewQueue(response ?? {}), preferences)).filter((item) => !seen.has(reviewKey(item)))];
        let remainingSlots = Math.max(0, sessionLimit.current - handled.size);
        next = next.filter((item) => handled.has(reviewKey(item)) || remainingSlots-- > 0);
        expectedTotal = Math.min(sessionLimit.current, Math.max(expectedTotal, handled.size + next.filter((item) => !handled.has(reviewKey(item))).length));
        setReviewTotal(expectedTotal);
        const sessionResult: SessionResult = {
          id: `bunpro:${currentKey}`, source: "bunpro", kind: content.kind,
          title: sanitizeText(content.attributes.title) || answer, meaning: sanitizeText(content.attributes.meaning), correct: result.correct,
          href: content.slug ? `/bunpro/${content.kind}/${encodeURIComponent(content.slug)}` : undefined,
          sentence: { parts: sentence, answer },
          translation: typeof question.translation === "string" ? question.translation : undefined,
          audioUrls: bunproAudioUrls(question, "female"), previousStage: change?.from ?? (stageLabel || specialReviewLabel), stage: change?.to, saveFailed,
        };
        setResults((previous) => [...previous, sessionResult]);
      }
      if (!result.correct) {
        if (preferences.backToBackQuestions && preferences.backToBackImmediateRetryIncorrect) next.unshift(current);
        else next = insertReviewRetry(next, [current], { random: retryRandom });
      }
      // A short response is a page, not completion. Retry fetching without resubmitting a saved answer.
      if (!lessonSession && !next.length && handled.size < expectedTotal) {
        const more = await bunpro<BunproReviewQuizIndexResponse>(`action=queue&mode=${mode}`);
        if (!Number.isInteger(more.review_session_id) || more.review_session_id <= 0) throw new Error("Could not load the next review batch. Press Next to retry.");
        const page = buildReviewQueue(more);
        // Unconfirmed saves can still be due remotely. Count only returned overlap;
        // a failed response may also have arrived after Bunpro accepted the answer.
        const remaining = Math.max(0, pendingReviewTotal(more) - page.filter(item => handled.has(reviewKey(item))).length);
        next = orderBunproReviews(page, preferences).filter((item) => !handled.has(reviewKey(item))).slice(0, Math.max(0, sessionLimit.current - handled.size));
        if (!next.length && remaining > 0) throw new Error("Bunpro still has reviews pending but returned no new questions. Press Next to retry.");
        setSessionId(more.review_session_id);
        setReviewTotal(Math.min(sessionLimit.current, Math.max(handled.size + next.length, handled.size + remaining)));
      }
      if (!showNextNow) notifyAnswer();
      if (result.correct) {
        const change = savedProgressions.current.get(currentKey);
        if (change?.to) {
          if (mixed?.reportBunproProgression) mixed.reportBunproProgression(change);
          else setProgression(change);
        }
        savedProgressions.current.delete(currentKey);
        setCompletedCount(count => count + 1);
      }
      next = orderReviewRetries(next, handled, reviewKey, reviewKey, retrySchedule.current, retryImmediately);
      if (!showNextNow) showQuestion(next);
      else setQueue(pending => {
        // Mixed reviews may have promoted a due retry while this save was pending.
        const visible = pending[0] && next.find(item => reviewKey(item) === reviewKey(pending[0]));
        return visible && visible !== next[0] ? [visible, ...next.filter(item => item !== visible)] : next;
      });
      if (!next.length) { setDurationMs(Date.now() - sessionStartedAt); setPhase("complete"); }
    } catch (cause) {
      retrySchedule.current = previousSchedule;
      if (showNextNow) {
        rememberDraft();
        setQueue(queue); setInput(result.entered); setOutcome(result); setAnkiRevealed(ankiRevealed); setHint(hint); setDetailsOverride(false);
        requestAnimationFrame(() => focusAnswer());
      }
      setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Please try again.");
    }
    finally { locked.current = false; setSaving(false); setBackgroundAdvance(false); setPendingAccuracy(null); }
  }

  function resetAnswer() {
    audio.stop(); setAnkiRevealed(false); setOutcome(null); setHint(""); setInput(""); setError(""); setSaveFailure(null); setDetailsOverride(null); setAlternativesOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function skip() {
    if (!preferences.allowSkippingReviews || locked.current || !current || handledIds.has(currentKey)) return;
    recognitionRef.current?.stop();
    // Defer the question within this session without sending a grade to Bunpro.
    setQueue((items) => [...items.slice(1), items[0]]); setHintLevel(2);
    resetAnswer();
  }
  function wrapUp(limit = preferences.reviewWrapUpSize) {
    const retained = retainWrapUpReviews(queue, new Set([...handledIds, ...(currentKey && mixed?.active !== false ? [currentKey] : [])]), reviewKey, Math.max(0, limit));
    const pending = retained.filter((item) => !handledIds.has(reviewKey(item))).length;
    sessionLimit.current = handledIds.size + pending;
    setReviewTotal(completedCount + retained.length);
    setQueue(retained);
    if (!retained.length) { setDurationMs(Date.now() - sessionStartedAt); setPhase("complete"); }
  }
  const appliedWrapUp = useRef<number | undefined>(undefined);
  const applyMixedWrapUp = useEffectEvent(() => {
    if (saving || !mixed?.wrapUpRequest || appliedWrapUp.current === mixed.wrapUpRequest.id) return;
    appliedWrapUp.current = mixed.wrapUpRequest.id;
    wrapUp(mixed.wrapUpRequest.limit);
  });
  // Apply each parent-issued wrap-up command once to this independently owned queue.
  useEffect(() => { applyMixedWrapUp(); }, [mixed?.wrapUpRequest?.id, saving]);
  useEffect(() => { if (mixed?.active === false) recognitionRef.current?.stop(); }, [mixed?.active]);
  const autoAdvance = useEffectEvent(() => { void advance(); });
  useEffect(() => {
    if (reviewSettingsOpen || mixed?.active === false || !outcome || saving || error) return;
    if (selfAssessment) return;
    if (paused || audio.playing || audio.error || details || alternativesOpen) return;
    const timer = window.setTimeout(autoAdvance, preferences.answerStopBehavior === "never" ? 550 : 350);
    return () => window.clearTimeout(timer);
  }, [reviewSettingsOpen, outcome, selfAssessment, paused, saving, error, audio.playing, audio.error, details, alternativesOpen, preferences.answerStopBehavior, mixed?.active]);
  useEffect(() => {
    if (!progression) return;
    const timer = window.setTimeout(() => setProgression(null), 3000);
    return () => window.clearTimeout(timer);
  }, [progression]);
  const studyKeys = preferences.studyShortcuts ?? DEFAULT_STUDY_SHORTCUTS;
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (saving || document.querySelector("dialog[open]") || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || composing.current || !(target instanceof HTMLElement) || target.closest("select, textarea, [contenteditable=true]")) return;
    if (target.closest("input") && target !== inputRef.current) return;
    const action = studyShortcutAction(event.key, studyKeys);
    if (action === "progress" && !target.closest("input, button, a")) { event.preventDefault(); if (outcome) void advance(); else if (selfAssessment) revealAnswer(); else check(); return; }
    if (!revealed && target.closest("input")) return;
    if (selfAssessment && ankiRevealed && !outcome && (action === "markIncorrect" || action === "markCorrect")) { event.preventDefault(); gradeSelf(action === "markCorrect"); }
    if (action === "hint" && content?.kind === "grammar") { event.preventDefault(); setHintLevel((level) => (level + 1) % 5); }
    if (action === "skip" && preferences.allowSkippingReviews && queue.length > 1) { event.preventDefault(); skip(); }
    if (!revealed) return;
    if (action === "details" && content?.slug) { event.preventDefault(); setDetailsOverride(!details); }
    if (hasAudio && action === "replayAudio") { event.preventDefault(); void replayAudio(); }
    if (!outcome) return;
    if (action === "alternatives") { event.preventDefault(); setAlternativesOpen(!alternativesOpen); }
    if (current && !handledIds.has(currentKey)) {
      if (action === "undo") { event.preventDefault(); resetAnswer(); }
      if (action === "markIncorrect" || action === "markCorrect") { event.preventDefault(); void advance(action === "markCorrect"); }
    }
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
  if (phase === "complete") return <SessionResults progression={<BunproProgression progression={progression} mode={preferences.srsProgressionCardDisplayMode} />} items={results} durationMs={durationMs} pendingCount={0} title={results.length ? lessonSession ? "Lesson quiz complete" : "Bunpro reviews complete" : "No Bunpro reviews waiting"} onContinue={onContinueLessons} onRestart={() => setPhase("choose")} />;
  if (!current || !content) return null;
  const valid = Boolean(answer && sanitizeQuestionContent(question.content));
  const showQuestionHints = hintLevel >= 2 || revealed;
  const showTranslation = (questionKind !== "meaning" && hintLevel >= 1) || revealed;
  const displayTotal = mixed?.progress?.total ?? total;
  const displayCompleted = mixed?.progress?.completed ?? completedCount;
  const saveFailureNotice = outcome && saveFailure ? <div className={quiz.answerStatus}><p className={core.error} role="alert">{error} Your current answer is kept on screen.</p>{saveFailure.canContinue ? <Button type="button" tone="ghost" disabled={saving} onClick={() => void advance(undefined, undefined, true)}>Continue without saving</Button> : null}</div> : null;
  return <main ref={reviewViewportRef} className={`${quiz.quizShell} ${styles.reviewShell} ${!selfAssessment ? quiz.typedReviewShell : ""}`} data-study-session="active" data-advancing={(saving && !backgroundAdvance) || undefined} style={{ "--jitai-font": jitaiFamily } as CSSProperties}>
      <ReviewExitGuard pendingSubjects={saving ? 1 : 0} />
      <div className={quiz.quizTopbar}><span>{mixed ? "Mixed reviews" : "Bunpro"} · {Math.min(displayCompleted + 1, displayTotal)} / {displayTotal}</span><div className={quiz.progressTrack} role="progressbar" aria-label="Review progress" aria-valuenow={displayCompleted} aria-valuemin={0} aria-valuemax={Math.max(1, displayTotal)}><span style={{ transform: `scaleX(${displayCompleted / Math.max(1, displayTotal)})` }} /></div><div className={quiz.quizTopbarActions}><ReviewAccuracy {...(mixed?.accuracy ?? answerAccuracy)} />{!lessonSession && !mixed?.wrapUpRequest && (mixed?.progress ? mixed.progress.total - mixed.progress.completed : queue.length) > preferences.reviewWrapUpSize ? <Button tone="ghost" size="small" disabled={saving} onClick={() => mixed?.onWrapUp ? mixed.onWrapUp() : wrapUp()}>Wrap Up {preferences.reviewWrapUpSize}</Button> : null}{preferences.reviewSearchButtonEnabled ? <ButtonLink className={quiz.iconButton} href={`/search?q=${encodeURIComponent(sanitizeText(content.attributes.title))}`} target="_blank" tone="ghost" aria-label="Search this item"><Search size={18} /></ButtonLink> : null}<ReviewSettingsButton disabled={saving} onOpenChange={(open) => { setReviewSettingsOpen(open); if (open) recognitionRef.current?.stop(); }} /><ButtonLink className={quiz.iconButton} href="/dashboard" tone="ghost" aria-label="Pause and exit session"><X size={19} /></ButtonLink></div></div>
      {mixed?.active ? <MixedPreviousBadge key={mixed.previous?.id} answer={mixed.previous} claimAnimation={mixed.claimPreviousAnimation} animate={preferences.reviewAnimatePreviousQuestion} /> : null}
      <header className={`${quiz.questionCard} ${styles.sentenceArea}`} aria-label="Bunpro review">
          {specialReviewLabel ? <p>{specialReviewLabel}</p> : null}
          {handledIds.has(currentKey) ? <p>Retrying missed item</p> : null}
          {question.tense && (!selfAssessment || showQuestionHints) ? <p className={showQuestionHints ? undefined : styles.concealedHint} aria-hidden={!showQuestionHints}><BunproText value={question.tense} /></p> : null}
          <div className={styles.sentence} lang="ja" style={{ fontSize: `calc(clamp(1.6rem, 3vw, 2.8rem) * ${preferences.reviewCharacterFontScale})` }}><BunproSentence parts={sentence}><span className={styles.blank} data-correct={outcome?.correct}><RubyText text={revealed ? answer : input || "　　"} /></span></BunproSentence></div>
          {question.word_prompt && (!selfAssessment || showQuestionHints) ? <p lang="ja" className={showQuestionHints ? undefined : styles.concealedHint} aria-hidden={!showQuestionHints}><BunproText value={question.word_prompt} /></p> : null}
          {!selfAssessment || showTranslation ? <div className={`${styles.translation} ${showTranslation ? "" : styles.concealedHint}`} aria-hidden={!showTranslation}><BunproText value={question.translation} /></div> : null}
          {hintLevel >= 3 ? <div className={styles.grammarHint} aria-live="polite">{hintLevel >= 4 ? <p lang="ja"><BunproText value={content.attributes.nuance} /></p> : null}<p><BunproText value={content.attributes.nuance_translation} /></p>{question.extra_info ? <p><BunproText value={question.extra_info} /></p> : null}</div> : null}
          <div className={quiz.reviewPromptMetadata} aria-label="Question status">{preferences.showReviewItemLevelAndSrsStage ? <><span>{sanitizeText(content.attributes.level || content.attributes.jlpt_level)}</span>{stageLabel ? <span>{stageLabel}</span> : null}</> : null}<span>{`${completedCount} completed`}</span></div>
      </header>
      <div className={quiz.answerArea}>
        {!valid ? <p role="alert">This review is missing its sentence or accepted answers. Pause and reload the queue before continuing.</p> : selfAssessment ? <>
          {!outcome ? <AnkiAnswerContent studyKeys={studyKeys} detailsOpen={details} keyboardShortcuts={preferences.keyboardShortcuts} revealed={ankiRevealed} questionKind={questionKind}
            meaningAnswer={questionKind === "meaning" ? answer : sanitizeText(content.attributes.meaning)} readingAnswer={questionKind === "reading" ? answer : sanitizeText(content.attributes.kana)}
            groupQuestions={preferences.ankiMode === "both" && preferences.ankiGroupQuestions}
            otherMeaningAnswers={questionKind === "meaning" ? displayAnswers.filter((value) => value !== answer) : []} otherReadingAnswers={questionKind === "reading" ? displayAnswers.filter((value) => value !== answer) : []}
            partsOfSpeech={Array.isArray(content.attributes.jmdict_pos) ? content.attributes.jmdict_pos.filter((value): value is string => typeof value === "string") : [sanitizeText(content.attributes.part_of_speech_translation)].filter(Boolean)} pitchAccents={bunproPitchAccents(content.attributes)}
            showOtherAcceptedAnswersAndUserSynonyms={preferences.ankiShowOtherAcceptedAnswersAndUserSynonyms} showWaniKaniGrammarTags={preferences.ankiShowWaniKaniGrammarTags} showPitchAccentNumbers={preferences.ankiShowPitchAccentNumbers} showPitchAccentGraph={preferences.ankiShowPitchAccentGraph}
            showReplayAudioButton={preferences.ankiShowReplayAudioButton && hasAudio} buttonlessMode={preferences.ankiButtonlessMode} replayingAudio={audio.playing}
            onReveal={revealAnswer} onReplayAudio={replayAudio} onGradeIncorrect={() => gradeSelf(false)} onGradeCorrect={() => gradeSelf(true)} onShowDetails={() => setDetailsOverride(!details)} onSkip={preferences.allowSkippingReviews && queue.length > 1 ? skip : undefined} /> : <Button tone="primary" disabled={saving} onClick={() => void advance()}><ArrowRight size={18} aria-hidden />{saveFailure ? "Retry save" : "Next"}</Button>}
          {saveFailureNotice}
        </> : <form className={quiz.answerForm} onSubmit={(event) => { event.preventDefault(); if (outcome) void advance(); else check(); }}>
          <label className={quiz.promptTypeStrip} data-tone={questionKind} htmlFor={answerId}><span>{content.kind === "grammar" ? "Grammar" : "Vocabulary"}</span><strong>{questionKind === "meaning" ? "Meaning" : "Reading"}</strong>{questionKind === "reading" ? <small>Romaji → かな</small> : null}</label>
          <div className={quiz.answerInputRow} data-result={outcome ? outcome.correct ? "correct" : "incorrect" : hint ? "warning" : undefined}>
            <input key={currentKey} ref={answerInputRef} autoFocus={mixed?.active !== false} id={answerId} aria-label="Your answer" value={input} readOnly={Boolean(outcome)} disabled={saving && !backgroundAdvance} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" aria-describedby={hint ? `${helperId} ${helperId}-feedback` : helperId} placeholder={questionKind === "meaning" ? "Type the meaning…" : "Type kana or romaji…"} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; setInput(event.currentTarget.value); }} onChange={(event) => { setInput(composing.current || questionKind === "meaning" ? event.target.value : composeKanaInput(event.target.value)); setHint(""); }} onKeyDown={(event) => { if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault(); }} />
            <Button className={quiz.primaryButton} type="submit" tone="primary" onMouseDown={(event) => { if (phoneInput) event.preventDefault(); }} disabled={saving || (!outcome && !input.trim())} state={saving && phoneInput ? "loading" : "idle"}>{outcome ? <ArrowRight size={18} aria-hidden /> : <Check size={18} aria-hidden />}{outcome ? saveFailure ? "Retry save" : "Next" : "Check"}</Button>
          </div>
          <p id={helperId} className="sr-only">{questionKind === "meaning" ? "Enter the English meaning." : "Kana and romaji are accepted."}</p>
          {saveFailureNotice}
        </form>}
        {hint ? <div id={`${helperId}-feedback`} role="status" className={!outcome ? styles.closeFeedback : quiz.answerStatus}>{!outcome ? <strong><TriangleAlert size={19} aria-hidden /> Close — try another answer</strong> : null}<p>{hint}</p></div> : null}
        <div className={`${styles.answerControls} ${quiz.reviewTools} ${quiz.reviewAnswerControls}`} aria-label="Answer controls">
          {preferences.voiceAnswers && !outcome ? <Button type="button" tone="ghost" aria-label="Answer with voice" disabled={listening || saving} onClick={startVoiceAnswer}><Mic size={18} aria-hidden />{listening ? "Listening…" : "Speak"}</Button> : null}
          {content.kind === "grammar" ? <Button tone="ghost" aria-label={`Hint level ${hintLevel} of 4`} onClick={() => setHintLevel((level) => (level + 1) % 5)}><Lightbulb size={17} aria-hidden />Hint <span className={styles.hintDots} aria-hidden>{Array.from({ length: 4 }, (_, i) => <span key={i} data-active={i < hintLevel} />)}</span></Button> : null}
          {outcome ? <>
            <Button tone="ghost" disabled={saving || handledIds.has(currentKey)} onClick={resetAnswer}><RotateCcw size={17} aria-hidden />Undo{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(studyKeys.undo)}</kbd> : null}</Button>
            <Button tone="ghost" disabled={!content.slug || saving} aria-controls={detailsId} aria-expanded={details} onClick={() => setDetailsOverride(!details)}><Info size={17} aria-hidden />{details ? "Hide Info" : "Info"}{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(studyKeys.details)}</kbd> : null}</Button>
            <Button tone="ghost" disabled={saving} aria-controls={alternativesId} aria-expanded={alternativesOpen} onClick={() => setAlternativesOpen(!alternativesOpen)}><List size={17} aria-hidden />Alternatives{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(studyKeys.alternatives)}</kbd> : null}</Button>
            <Button tone="ghost" disabled={!hasAudio || saving} aria-label={audio.playing ? "Replay audio" : "Audio"} onClick={() => void replayAudio()}><Volume2 size={17} aria-hidden />{hasAudio ? "Audio" : "No audio"}{preferences.keyboardShortcuts && hasAudio ? <kbd aria-hidden>{shortcutLabel(studyKeys.replayAudio)}</kbd> : null}</Button>
            <Button tone={outcome.correct ? "ghost" : "primary"} disabled={saving || handledIds.has(currentKey)} onClick={() => void advance(!outcome.correct)}>{outcome.correct ? <X size={17} aria-hidden /> : <Check size={17} aria-hidden />}{outcome.correct ? "Mark Incorrect" : "Mark Correct"}{preferences.keyboardShortcuts ? <kbd aria-hidden>{shortcutLabel(outcome.correct ? studyKeys.markIncorrect : studyKeys.markCorrect)}</kbd> : null}</Button>
          </> : null}
          {preferences.allowSkippingReviews ? <Button tone="ghost" disabled={saving || handledIds.has(currentKey) || queue.length < 2} onClick={skip} title="Move this question to the end without saving an answer"><SkipForward size={17} aria-hidden />Skip</Button> : null}
        </div>
        <div className={quiz.reviewProgressionSlot}>
          <BunproProgression progression={mixed?.reportBunproProgression ? mixed.bunproProgression ?? null : progression} mode={preferences.srsProgressionCardDisplayMode} />
        </div>
        <ReviewDetailsReveal open={Boolean(outcome && alternativesOpen)} revealInViewport>{outcome && alternativesOpen ? <section className={styles.alternatives} id={alternativesId}><h3>Accepted answers</h3><ul>{accepted.map((value) => <li key={value} lang="ja">{value}</li>)}</ul>{alternativeFeedback.length ? <><h3>Other answers</h3><p>These answers need a different form or nuance for this question.</p><dl>{alternativeFeedback.map(([value, message]) => <div key={value}><dt lang="ja">{value}</dt><dd>{message}</dd></div>)}</dl></> : null}</section> : null}</ReviewDetailsReveal>
        <div className={quiz.reviewKeyboardHint}>
          <p className={quiz.keyboardHint}>{preferences.keyboardShortcuts ? (outcome ? <>Press <kbd>{shortcutLabel(studyKeys.progress)}</kbd> {saveFailure ? "to retry saving" : "to continue"} · <kbd>{shortcutLabel(studyKeys.details)}</kbd> toggles details{hasAudio ? <> · <kbd>{shortcutLabel(studyKeys.replayAudio)}</kbd> replays audio</> : null}</> : selfAssessment ? ankiRevealed ? <><kbd>{shortcutLabel(studyKeys.markIncorrect)}</kbd> marks wrong · <kbd>{shortcutLabel(studyKeys.markCorrect)}</kbd> marks correct{hasAudio ? <> · <kbd>{shortcutLabel(studyKeys.replayAudio)}</kbd> replays audio</> : null}</> : <>Press <kbd>{shortcutLabel(studyKeys.progress)}</kbd> to reveal</> : <>Press <kbd>{shortcutLabel(studyKeys.progress)}</kbd> to check</>) : "Keyboard shortcuts are off"}</p>
        </div>
        {speechError ? <p role="status">{speechError}</p> : null}
        {audio.error ? <p role="status" className={core.answerHelper}>{audio.error}</p> : null}
        {!mixed ? <BunproSaveWarning count={unsavedCount} /> : null}
        {outcome ? <div role="status" className={quiz.answerStatus}><strong className={quiz.answerVerdict} data-correct={outcome.correct}>{outcome.correct ? "Correct" : "Incorrect"}</strong><p>{outcome.correct ? "Your answer is correct." : <>The answer is <span lang="ja">{answer}</span>.</>}</p>{paused && preferences.showAnswerStopSubjectDetails ? <div className={core.answerStopDetails}><span>Expected answer</span><strong lang="ja">{answer}</strong></div> : null}{error && !saveFailure ? <p className={core.error} role="alert">{error} Your current answer is kept on screen.</p> : null}</div> : null}
      </div>
      <ReviewDetailsReveal open={details} revealInViewport>{revealed && (details || visitedDetails === currentKey) && content.slug ? <div id={detailsId} className={styles.reviewDetails}><BunproDetails key={`${content.kind}:${content.slug}`} kind={content.kind} slug={content.slug} review={currentReviewType === "review" ? current.data.attributes : undefined} /></div> : null}</ReviewDetailsReveal>
  </main>;
}
