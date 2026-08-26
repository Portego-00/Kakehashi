"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Headphones, LoaderCircle, RotateCcw, Volume2, X } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import { advanceStudySession, answerStudyQuestion, getSessionSummary, getStudyItemProgress } from "../engine";
import { playAnswerFeedback } from "../feedback-audio";
import { composeKanaInput, questionUsesKanaComposition } from "../kana-composition";
import { clearStudySession, saveStudySession } from "../storage";
import type { StudyAnswer, StudyQuestion, StudySession } from "../types";
import type { StudyStorageScope } from "../storage";
import styles from "../study.module.css";

function playAudio(url?: string) {
  if (!url || typeof Audio === "undefined") return;
  const audio = new Audio(url);
  void audio.play();
}

function speakJapanese(value?: string) {
  if (!value || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "ja-JP";
  window.speechSynthesis.speak(utterance);
}

function passthroughImageLoader({ src }: { src: string }) {
  return src;
}

type PromptTone = "meaning" | "reading" | "other";
type ItemDetailsTab = "meaning" | "reading" | "context";

function subjectTypeLabel(question: StudyQuestion) {
  if (question.subjectType === "radical") return "Radical";
  if (question.subjectType === "kanji") return "Kanji";
  return "Vocabulary";
}

function plainMnemonic(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&(quot|#39|amp|lt|gt|nbsp);/g, (entity) => ({ "&quot;": '"', "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " " }[entity] ?? entity)).replace(/\s+/g, " ").trim();
}

export function promptTypePresentation(question: StudyQuestion): { label: string; tone: PromptTone } {
  if (["meaning", "kana-to-meaning", "listening", "listening-meaning"].includes(question.kind)) return { label: "Meaning", tone: "meaning" };
  if (["reading", "meaning-to-reading"].includes(question.kind)) return { label: "Reading", tone: "reading" };
  if (["kana-to-kanji", "similar-kanji"].includes(question.kind)) return { label: "Kanji", tone: "other" };
  if (question.kind === "listening-characters") return { label: "Vocabulary", tone: question.subjectType === "kana_vocabulary" ? "reading" : "other" };
  return { label: "Answer", tone: questionUsesKanaComposition(question) ? "reading" : "other" };
}

export function itemDetailsTabForQuestion(question: StudyQuestion): ItemDetailsTab {
  if (["reading", "meaning-to-reading"].includes(question.kind)) return "reading";
  if (question.kind === "context") return "context";
  return "meaning";
}

function isListeningQuestion(question?: StudyQuestion) {
  return question?.kind === "listening" || question?.kind === "listening-characters" || question?.kind === "listening-meaning";
}

function ItemDetails({ subject, activeTab, onTabChange }: { subject: Subject; activeTab: ItemDetailsTab; onTabChange: (tab: ItemDetailsTab) => void }) {
  const meanings = [...new Set([
    ...subject.data.meanings.filter((meaning) => meaning.accepted_answer).map((meaning) => meaning.meaning),
    ...subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist").map((meaning) => meaning.meaning),
  ])];
  const readings = [...new Set((subject.data.readings ?? []).filter((reading) => reading.accepted_answer).map((reading) => reading.reading))];
  const partsOfSpeech = (subject.data.parts_of_speech ?? []).map((part) => part.replaceAll("_", " "));
  const contexts = subject.data.context_sentences ?? [];
  const tabs: Array<{ id: ItemDetailsTab; label: string }> = [
    { id: "meaning", label: "Meaning" },
    ...(readings.length || subject.data.reading_mnemonic ? [{ id: "reading" as const, label: "Reading" }] : []),
    ...(contexts.length ? [{ id: "context" as const, label: "Context" }] : []),
  ];
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <section id="study-item-details" className={styles.itemDetails} aria-labelledby="study-item-details-title">
      <header className={styles.itemDetailsHeader}>
        <div><h3 id="study-item-details-title">Item details</h3><p>Level {subject.data.level} · {subject.object.replace("_", " ")}</p></div>
        <Link className={styles.itemDetailsLink} href={`/subjects/${subject.id}`} target="_blank" rel="noopener noreferrer"><span>Open full details</span><ExternalLink size={15} aria-hidden /></Link>
      </header>

      <nav className={styles.itemDetailsTabs} data-count={tabs.length} role="tablist" aria-label="Item details">
        {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`study-item-tab-${tab.id}`} aria-selected={selectedTab === tab.id} aria-controls={`study-item-panel-${tab.id}`} tabIndex={selectedTab === tab.id ? 0 : -1} onClick={() => onTabChange(tab.id)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; const nextTab = tabs[nextIndex]; onTabChange(nextTab.id); window.requestAnimationFrame(() => document.getElementById(`study-item-tab-${nextTab.id}`)?.focus()); }}>{tab.label}</button>)}
      </nav>

      {selectedTab === "meaning" ? <section id="study-item-panel-meaning" role="tabpanel" aria-labelledby="study-item-tab-meaning" className={styles.itemDetailsPanel}>
        <dl className={styles.itemDetailsFacts}>
          <div><dt>Meaning</dt><dd>{meanings.join(" · ") || subject.data.slug}</dd></div>
          {partsOfSpeech.length ? <div><dt>Word type</dt><dd>{partsOfSpeech.join(" · ")}</dd></div> : null}
        </dl>
        {subject.data.meaning_mnemonic ? <section className={styles.itemDetailsNote}><h4>Meaning mnemonic</h4><p>{plainMnemonic(subject.data.meaning_mnemonic)}</p>{subject.data.meaning_hint ? <p><strong>Hint:</strong> {plainMnemonic(subject.data.meaning_hint)}</p> : null}</section> : <p className={styles.itemDetailsEmpty}>No meaning mnemonic is available for this item.</p>}
      </section> : null}

      {selectedTab === "reading" ? <section id="study-item-panel-reading" role="tabpanel" aria-labelledby="study-item-tab-reading" className={styles.itemDetailsPanel}>
        <dl className={styles.itemDetailsFacts}><div><dt>Accepted readings</dt><dd lang="ja">{readings.join(" · ")}</dd></div></dl>
        {subject.data.reading_mnemonic ? <section className={styles.itemDetailsNote}><h4>Reading mnemonic</h4><p>{plainMnemonic(subject.data.reading_mnemonic)}</p>{subject.data.reading_hint ? <p><strong>Hint:</strong> {plainMnemonic(subject.data.reading_hint)}</p> : null}</section> : <p className={styles.itemDetailsEmpty}>No reading mnemonic is available for this item.</p>}
      </section> : null}

      {selectedTab === "context" ? <section id="study-item-panel-context" role="tabpanel" aria-labelledby="study-item-tab-context" className={`${styles.itemDetailsPanel} ${styles.itemDetailsContext}`}>
        {contexts.map((context) => <div key={`${context.ja}:${context.en}`}><p lang="ja">{context.ja}</p><p>{context.en}</p></div>)}
      </section> : null}
    </section>
  );
}

interface ResultResponse {
  question: StudyQuestion;
  answer: StudyAnswer;
}

interface ResultSubjectGroup {
  subjectId: number;
  subject?: Subject;
  responses: ResultResponse[];
}

function resultSubjectGroups(session: StudySession, subjects: Subject[]): ResultSubjectGroup[] {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const groups = new Map<number, ResultSubjectGroup>();
  session.questions.forEach((question) => {
    const answer = session.answers.find((candidate) => candidate.questionId === question.id);
    if (!answer) return;
    const group = groups.get(question.subjectId) ?? { subjectId: question.subjectId, subject: subjectById.get(question.subjectId), responses: [] };
    group.responses.push({ question, answer });
    groups.set(question.subjectId, group);
  });
  return [...groups.values()];
}

function resultSubjectPresentation(group: ResultSubjectGroup) {
  const first = group.responses[0]?.question;
  const primaryMeaning = group.subject?.data.meanings.find((meaning) => meaning.primary)?.meaning ?? group.subject?.data.meanings[0]?.meaning ?? first?.meaning ?? first?.acceptedAnswers[0] ?? "Subject";
  const characters = group.subject?.data.characters ?? first?.characters ?? group.subject?.data.slug ?? first?.prompt ?? String(group.subjectId);
  const type = first ? subjectTypeLabel(first) : "Subject";
  return { characters, primaryMeaning, type };
}

function SessionResults({ scope, session, subjects, showListeningTranslation, onExit, onRestartMistakes }: { scope: StudyStorageScope; session: StudySession; subjects: Subject[]; showListeningTranslation: boolean; onExit: () => void; onRestartMistakes: (subjectIds: number[]) => void }) {
  const summary = getSessionSummary(session);
  const groups = resultSubjectGroups(session, subjects);
  return (
    <section className={styles.results} aria-labelledby="results-title">
      <header className={styles.resultOverview}>
        <div className={styles.resultMark} data-perfect={summary.accuracy === 100}><Check size={28} aria-hidden="true" /></div>
        <div className={styles.resultIntro}><h2 id="results-title">Session results</h2><p>{summary.accuracy >= 90 ? "Strong recall. Keep the interval wide." : summary.accuracy >= 70 ? "Good work. A short pass on the misses will help." : "This set is worth another focused pass."}</p></div>
      </header>

      <dl className={styles.resultStats}><div><dt>Accuracy</dt><dd>{summary.accuracy}%</dd></div><div><dt>Correct responses</dt><dd>{summary.correct} / {session.answers.length}</dd></div><div><dt>Subjects</dt><dd>{groups.length}</dd></div></dl>

      <section className={styles.resultReview} aria-labelledby="response-review-title">
        <header className={styles.resultReviewHeader}><h3 id="response-review-title">Response review</h3><p>{session.answers.length} response{session.answers.length === 1 ? "" : "s"} across {groups.length} subject{groups.length === 1 ? "" : "s"}</p></header>
        <ol className={styles.resultSubjectList}>
          {groups.map((group) => {
            const presentation = resultSubjectPresentation(group);
            const media = group.responses.find(({ question }) => question.imageUrl || question.audioUrl || question.sentence)?.question;
            const correct = group.responses.every(({ answer }) => answer.correct);
            const listening = group.responses.some(({ question }) => isListeningQuestion(question));
            return <li key={group.subjectId}><article className={styles.resultSubject} data-correct={correct}>
              <header className={styles.resultSubjectHeader}>
                <div className={styles.resultSubjectIdentity}><span className={styles.resultSubjectCharacters} data-type={group.responses[0]?.question.subjectType} lang="ja">{presentation.characters}</span><div><h4>{presentation.primaryMeaning}</h4><p>{group.subject ? `Level ${group.subject.data.level} · ` : ""}{presentation.type}</p></div></div>
                <div className={styles.resultSubjectActions}>{media?.audioUrl ? <button type="button" className={styles.resultReplayButton} onClick={() => playAudio(media.audioUrl)} aria-label={`Replay audio for ${presentation.characters}`}><Volume2 size={16} aria-hidden /> Replay</button> : media?.sentenceAudioEnabled && media.sentence ? <button type="button" className={styles.resultReplayButton} onClick={() => speakJapanese(media.sentence?.ja)} aria-label={`Play sentence for ${presentation.characters}`}><Volume2 size={16} aria-hidden /> Play sentence</button> : null}<Link className={styles.resultSubjectLink} href={`/subjects/${group.subjectId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${presentation.characters} subject details`}>View subject <ExternalLink size={14} aria-hidden /></Link></div>
              </header>

              {media?.imageUrl || media?.sentence ? <div className={styles.resultMedia}>{media.imageUrl ? <Image className={styles.resultScene} src={media.imageUrl} alt={`Scene from ${media.sourceTitle ?? "the listening example"}`} width={320} height={180} sizes="(max-width: 42rem) 90vw, 18rem" loader={passthroughImageLoader} unoptimized /> : null}{media.sentence ? <div className={styles.resultSentence}><p lang="ja">{media.sentence.ja}</p>{(!listening || showListeningTranslation) && media.sentence.en ? <p>{media.sentence.en}</p> : null}{media.sourceTitle ? <span>{media.sourceTitle}</span> : null}</div> : null}</div> : null}

              <div className={styles.resultResponseTableWrap}><table className={styles.resultResponseTable} aria-label={`${presentation.characters} responses`}><thead><tr><th>Prompt</th><th>Your answer</th><th>Expected</th><th>Result</th></tr></thead><tbody>{group.responses.map(({ question, answer }) => <tr key={question.id} data-correct={answer.correct}><th scope="row">{promptTypePresentation(question).label}</th><td lang={questionUsesKanaComposition(question) ? "ja" : undefined}>{answer.value || "—"}</td><td lang={questionUsesKanaComposition(question) ? "ja" : undefined}>{question.displayAnswer}</td><td><span className={styles.resultResponseStatus} data-correct={answer.correct}>{answer.correct ? <Check size={15} aria-hidden /> : <X size={15} aria-hidden />}{answer.correct ? "Correct" : "Incorrect"}</span></td></tr>)}</tbody></table></div>
            </article></li>;
          })}
        </ol>
      </section>

      <div className={styles.resultActions}>{summary.incorrectSubjectIds.length ? <button className={styles.primaryButton} data-result-action type="button" onClick={() => onRestartMistakes(summary.incorrectSubjectIds)}><RotateCcw size={17} /> Review {summary.incorrectSubjectIds.length} misses</button> : null}<button className={styles.secondaryButton} data-result-action type="button" onClick={() => { clearStudySession(scope, session.mode); onExit(); }}>Back to setup</button></div>
    </section>
  );
}

interface QuizSessionProps {
  scope: StudyStorageScope;
  initialSession: StudySession;
  subjects?: Subject[];
  showDetailsAtAnswerStops?: boolean;
  showListeningTranslation?: boolean;
  keyboardShortcuts?: boolean;
  loadingMore?: boolean;
  expectedSubjectCount?: number;
  onExit: () => void;
  onRestartMistakes: (subjectIds: number[]) => void;
}

export function QuizSession({ scope, initialSession, subjects = [], showDetailsAtAnswerStops = false, showListeningTranslation = true, keyboardShortcuts = true, loadingMore = false, expectedSubjectCount, onExit, onRestartMistakes }: QuizSessionProps) {
  const [localSession, setSession] = useState(initialSession);
  const session = useMemo(() => {
    if (localSession.id !== initialSession.id) return initialSession;
    const knownIds = new Set(localSession.questions.map((item) => item.id));
    const incoming = initialSession.questions.filter((item) => !knownIds.has(item.id));
    return incoming.length ? { ...localSession, questions: [...localSession.questions, ...incoming], complete: false } : localSession;
  }, [initialSession, localSession]);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autoPlayedQuestionRef = useRef<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [detailsTab, setDetailsTab] = useState<ItemDetailsTab>(() => {
    const initialQuestion = initialSession.questions[initialSession.currentIndex];
    return initialQuestion ? itemDetailsTabForQuestion(initialQuestion) : "meaning";
  });
  const question = session.questions[session.currentIndex];
  const answer = question ? session.answers.find((item) => item.questionId === question.id) : undefined;
  const { current: displayedCurrent, total: displayedTotal } = getStudyItemProgress(session.questions, session.currentIndex);
  const visibleTotal = loadingMore && expectedSubjectCount ? Math.max(displayedTotal, expectedSubjectCount) : displayedTotal;
  const progress = visibleTotal ? Math.round((displayedCurrent / visibleTotal) * 100) : 0;
  const promptType = question ? promptTypePresentation(question) : null;
  const kanaComposition = question ? questionUsesKanaComposition(question) : false;
  const currentSubject = question ? subjects.find((subject) => subject.id === question.subjectId) : undefined;
  const listeningQuestion = isListeningQuestion(question);
  const previousCompletedSubject = useMemo(() => {
    if (!listeningQuestion || !question) return undefined;
    const previousQuestion = session.questions.slice(0, session.currentIndex).reverse().find((candidate) => candidate.subjectId !== question.subjectId);
    if (!previousQuestion) return undefined;
    const previousQuestions = session.questions.filter((candidate) => candidate.subjectId === previousQuestion.subjectId);
    const previousAnswers = previousQuestions.map((candidate) => session.answers.find((item) => item.questionId === candidate.id));
    if (!previousQuestions.length || previousAnswers.some((item) => !item)) return undefined;
    const subject = subjects.find((candidate) => candidate.id === previousQuestion.subjectId);
    return {
      id: previousQuestion.subjectId,
      characters: previousQuestion.characters ?? subject?.data.characters ?? subject?.data.slug ?? String(previousQuestion.subjectId),
      correct: previousAnswers.every((item) => item?.correct),
    };
  }, [listeningQuestion, question, session.answers, session.currentIndex, session.questions, subjects]);
  const detailsAvailable = Boolean(answer && currentSubject && question?.stopAfterAnswer !== false);
  const detailsVisible = detailsAvailable && (detailsOverride ?? showDetailsAtAnswerStops);
  const waitingForNextQuestion = loadingMore && session.currentIndex >= session.questions.length - 1;
  const toggleDetails = useCallback(() => setDetailsOverride((current) => !(current ?? showDetailsAtAnswerStops)), [showDetailsAtAnswerStops]);

  const commit = useCallback((candidate: string) => {
    if (!question || answer || !candidate.trim()) return;
    const next = answerStudyQuestion(session, candidate);
    const submittedAnswer = next.answers.find((item) => item.questionId === question.id);
    if (submittedAnswer) playAnswerFeedback(submittedAnswer.correct);
    setSession(next);
    saveStudySession(scope, next);
  }, [answer, question, scope, session]);

  const next = useCallback(() => {
    if (!answer) return;
    if (waitingForNextQuestion) return;
    const updated = advanceStudySession(session);
    setSession(updated);
    setValue("");
    setSelectedToken(null);
    setTranslationRevealed(false);
    setDetailsOverride(null);
    const upcomingQuestion = updated.questions[updated.currentIndex];
    setDetailsTab(upcomingQuestion ? itemDetailsTabForQuestion(upcomingQuestion) : "meaning");
    saveStudySession(scope, updated);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [answer, scope, session, waitingForNextQuestion]);

  useEffect(() => {
    if (question?.autoPlayAudio && autoPlayedQuestionRef.current !== question.id) {
      autoPlayedQuestionRef.current = question.id;
      playAudio(question.audioUrl);
    }
    if (question?.autoPlaySentenceAudio) speakJapanese(question.sentence?.ja);
  }, [question?.audioUrl, question?.autoPlayAudio, question?.autoPlaySentenceAudio, question?.id, question?.sentence?.ja]);

  useEffect(() => {
    if (!answer || question?.stopAfterAnswer !== false) return;
    const timer = window.setTimeout(next, 900);
    return () => window.clearTimeout(timer);
  }, [answer, next, question?.stopAfterAnswer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDetailsExpanded(detailsVisible));
    return () => window.cancelAnimationFrame(frame);
  }, [detailsVisible]);

  useEffect(() => {
    if (!detailsExpanded) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      document.getElementById("study-item-details-toggle")?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailsExpanded, question?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!keyboardShortcuts) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (answer) next(); else commit(value);
      }
      if (!answer && question?.choices && /^[1-4]$/.test(event.key)) {
        const choice = question.choices[Number(event.key) - 1];
        if (choice) commit(choice);
      }
      if (event.key.toLocaleLowerCase() === "r" && question?.audioUrl) playAudio(question.audioUrl);
      if (event.key.toLocaleLowerCase() === "d" && detailsAvailable) {
        event.preventDefault();
        toggleDetails();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, commit, detailsAvailable, keyboardShortcuts, next, question, toggleDetails, value]);

  if (session.complete || !question) {
    return <SessionResults scope={scope} session={session} subjects={subjects} showListeningTranslation={showListeningTranslation} onExit={onExit} onRestartMistakes={onRestartMistakes} />;
  }

  return (
    <section className={styles.quizShell} data-type={question.subjectType} aria-labelledby="question-prompt">
      <div className={styles.quizTopbar}>
        <span className={styles.numeric}>{displayedCurrent} / {visibleTotal}</span>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={displayedCurrent} aria-valuemin={1} aria-valuemax={visibleTotal}><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
        <button type="button" className={styles.iconButton} onClick={onExit} aria-label="Pause and exit session"><X size={19} /></button>
      </div>

      {previousCompletedSubject ? <Link className={styles.previousSubjectLink} href={`/subjects/${previousCompletedSubject.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Previous subject: ${previousCompletedSubject.characters}`}><span lang="ja">{previousCompletedSubject.characters}</span><span className={styles.previousSubjectStatus} data-correct={previousCompletedSubject.correct} aria-hidden="true">{previousCompletedSubject.correct ? <Check size={13} /> : <X size={13} />}</span></Link> : null}

      <div className={styles.questionCard} data-type={question.subjectType}>
        {question.imageUrl ? <div className={styles.sceneFrame}><Image className={styles.contextImage} src={question.imageUrl} alt={`Scene from ${question.sourceTitle ?? "the listening example"}`} width={560} height={315} sizes="(max-width: 42rem) 90vw, 28rem" loader={passthroughImageLoader} unoptimized /></div> : null}
        {listeningQuestion && question.sentence ? <><div className={styles.sentencePromptSlot}><p className={styles.sentencePrompt} data-visible={!answer} aria-hidden={Boolean(answer)} lang="ja">{question.sentence.masked}</p><p className={styles.sentencePrompt} data-visible={Boolean(answer)} aria-hidden={!answer} lang="ja">{question.sentence.ja}</p></div>{showListeningTranslation ? <div className={styles.translationReveal}><p className={styles.sentenceTranslation} data-visible={translationRevealed} aria-hidden={!translationRevealed}>{question.sentence.en}</p><button className={styles.textButton} type="button" onClick={() => setTranslationRevealed((current) => !current)}>{translationRevealed ? "Hide translation" : "Show translation"}</button></div> : null}</> : null}
        {question.audioUrl ? <button id="question-prompt" className={styles.audioButton} type="button" onClick={() => playAudio(question.audioUrl)} aria-label={`Replay listening clip${question.sourceTitle ? ` from ${question.sourceTitle}` : ""}`}><Volume2 size={29} /><span>{question.sourceTitle ? `Play ${question.sourceTitle} clip` : "Play pronunciation"}</span><kbd>R</kbd></button> : <h2 id="question-prompt" data-question-kind={question.kind} lang={question.kind === "meaning-to-reading" ? "en" : "ja"}>{question.prompt}</h2>}
        {question.sentenceAudioEnabled ? <button className={styles.textButton} type="button" onClick={() => speakJapanese(question.sentence?.ja)}><Volume2 size={16} /> Play sentence</button> : null}
        {!listeningQuestion && question.sentence && (!question.hideTranslationUntilTap || translationRevealed || answer) ? <p className={styles.sentenceTranslation}>{question.sentence.en}</p> : !listeningQuestion && question.sentence ? <button className={styles.textButton} type="button" onClick={() => setTranslationRevealed(true)}>Show translation</button> : null}
      </div>

      <div className={styles.answerArea}>
        {question.choices ? <><div className={styles.promptTypeStrip} data-tone={promptType?.tone}><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong></div><div className={styles.choiceGrid} role="group" aria-label="Answer choices">{question.choices.map((choice, index) => {
          const selected = answer?.value === choice;
          const correctChoice = answer && question.acceptedAnswers.includes(choice);
          const result = selected ? answer?.correct ? "correct" : "incorrect" : correctChoice ? "correct-answer" : undefined;
          return <button type="button" key={choice} className={styles.choiceButton} data-selected={selected} data-correct={correctChoice} data-result={result} disabled={Boolean(answer)} onClick={() => commit(choice)}><kbd>{index + 1}</kbd><span lang={question.kind === "listening-meaning" || question.kind === "listening" ? "en" : "ja"}>{choice}</span><span className={styles.choiceResult} data-choice-result data-visible={Boolean(result)} aria-hidden={!result}><span data-active={result === "correct"}><Check size={18} />Correct</span><span data-active={result === "incorrect"}><X size={18} />Incorrect</span><span data-active={result === "correct-answer"}><Check size={18} />Correct answer</span></span></button>;
        })}</div></> : <form className={styles.answerForm} data-result={answer ? answer.correct ? "correct" : "incorrect" : undefined} onSubmit={(event) => { event.preventDefault(); if (answer) next(); else commit(value); }}>
          <label className={styles.promptTypeStrip} data-tone={promptType?.tone} htmlFor="study-answer"><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong>{kanaComposition ? <small>Romaji → かな</small> : null}</label>
          <div className={styles.answerInputRow} data-result={answer ? answer.correct ? "correct" : "incorrect" : undefined}>
            <input ref={inputRef} id="study-answer" autoFocus autoComplete="off" spellCheck={false} lang={kanaComposition ? "ja" : undefined} value={value} onChange={(event) => setValue(kanaComposition ? composeKanaInput(event.target.value) : event.target.value)} readOnly={Boolean(answer)} aria-label={`${subjectTypeLabel(question)} ${promptType?.label ?? "answer"}`} aria-invalid={answer ? !answer.correct : undefined} aria-describedby={answer ? "study-answer-status" : undefined} />
            <button type="submit" className={styles.primaryButton} disabled={!answer && !value.trim()}>{answer ? <ArrowRight size={18} /> : <Check size={18} />}{answer ? "Next" : "Check"}</button>
          </div>
          {answer ? <div id="study-answer-status" className={styles.answerStatus} role="status" aria-live="polite"><span className={styles.answerVerdict} data-correct={answer.correct}>{answer.correct ? <Check size={18} /> : <X size={18} />}<strong>{answer.correct ? "Correct" : "Incorrect"}</strong></span>{!answer.correct ? <span className={styles.correctAnswer}><small>Correct answer</small><strong lang={kanaComposition ? "ja" : undefined}>{question.displayAnswer}</strong></span> : null}</div> : null}
        </form>}

        {detailsAvailable && currentSubject ? <div className={styles.itemDetailsRegion} data-open={detailsExpanded}>
          <div className={styles.itemDetailsDisclosure}>
            <button id="study-item-details-toggle" type="button" className={styles.itemDetailsButton} aria-expanded={detailsVisible} aria-controls="study-item-details" onClick={toggleDetails}><BookOpen size={17} aria-hidden /><span>{detailsVisible ? "Hide item details" : "Show item details"}</span>{keyboardShortcuts ? <kbd>D</kbd> : null}{detailsVisible ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}</button>
          </div>
          <div className={styles.itemDetailsReveal} data-open={detailsExpanded} aria-hidden={!detailsVisible} inert={!detailsVisible ? true : undefined}><div><ItemDetails subject={currentSubject} activeTab={detailsTab} onTabChange={setDetailsTab} /></div></div>
        </div> : null}

        {question.choices && question.stopAfterAnswer !== false ? <div className={styles.choiceActions} data-choice-actions data-visible={Boolean(answer)} aria-hidden={!answer} inert={!answer ? true : undefined}><button className={styles.primaryButton} onClick={next} disabled={!answer || waitingForNextQuestion} tabIndex={answer ? 0 : -1}>{waitingForNextQuestion ? <><LoaderCircle className={styles.spinner} size={17} /> Finding next clip</> : <>Next <ArrowRight size={17} /></>}</button></div> : null}
        {answer && question.enableSentenceBreakdown && question.sentence?.tokens?.length ? <div className={styles.sentenceBreakdown}><div lang="ja">{question.sentence.tokens.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && question.sentence.tokens[selectedToken] ? <p><strong>{question.sentence.tokens[selectedToken].text}</strong> · {question.sentence.tokens[selectedToken].type}{question.sentence.tokens[selectedToken].reading ? ` · ${question.sentence.tokens[selectedToken].reading}` : ""}{question.sentence.tokens[selectedToken].meaning ? ` · ${question.sentence.tokens[selectedToken].meaning}` : ""}</p> : <p>Select an underlined grammar or vocabulary token for details.</p>}</div> : null}
        {keyboardShortcuts ? question.audioUrl ? <p className={styles.keyboardHint}><Headphones size={15} /> Press <kbd>R</kbd> to replay{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : <p className={styles.keyboardHint}>Press <kbd>Enter</kbd> to {answer ? "continue" : "check"}{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : null}
      </div>
    </section>
  );
}
