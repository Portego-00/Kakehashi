"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Headphones, RotateCcw, Volume2, X } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import { advanceStudySession, answerStudyQuestion, getSessionSummary, getStudyItemProgress } from "../engine";
import { composeKanaInput, questionUsesKanaComposition } from "../kana-composition";
import { clearStudySession, saveStudySession } from "../storage";
import type { StudyQuestion, StudySession } from "../types";
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

interface QuizSessionProps {
  scope: StudyStorageScope;
  initialSession: StudySession;
  subjects?: Subject[];
  showDetailsAtAnswerStops?: boolean;
  keyboardShortcuts?: boolean;
  onExit: () => void;
  onRestartMistakes: (subjectIds: number[]) => void;
}

export function QuizSession({ scope, initialSession, subjects = [], showDetailsAtAnswerStops = false, keyboardShortcuts = true, onExit, onRestartMistakes }: QuizSessionProps) {
  const [session, setSession] = useState(initialSession);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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
  const progress = displayedTotal ? Math.round((displayedCurrent / displayedTotal) * 100) : 0;
  const promptType = question ? promptTypePresentation(question) : null;
  const kanaComposition = question ? questionUsesKanaComposition(question) : false;
  const currentSubject = question ? subjects.find((subject) => subject.id === question.subjectId) : undefined;
  const detailsAvailable = Boolean(answer && currentSubject && question?.stopAfterAnswer !== false);
  const detailsVisible = detailsAvailable && (detailsOverride ?? showDetailsAtAnswerStops);
  const toggleDetails = useCallback(() => setDetailsOverride((current) => !(current ?? showDetailsAtAnswerStops)), [showDetailsAtAnswerStops]);

  const commit = useCallback((candidate: string) => {
    if (!question || answer || !candidate.trim()) return;
    const next = answerStudyQuestion(session, candidate);
    setSession(next);
    saveStudySession(scope, next);
  }, [answer, question, scope, session]);

  const next = useCallback(() => {
    if (!answer) return;
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
  }, [answer, scope, session]);

  useEffect(() => {
    if (question?.autoPlayAudio) playAudio(question.audioUrl);
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
    const summary = getSessionSummary(session);
    return (
      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultMark} data-perfect={summary.accuracy === 100}><Check size={34} aria-hidden="true" /></div>
        <h2 id="results-title">Session complete</h2>
        <p>{summary.accuracy >= 90 ? "Strong recall. Keep the interval wide." : summary.accuracy >= 70 ? "Good work. A short pass on the misses will help." : "This set is worth another focused pass."}</p>
        <dl className={styles.resultStats}><div><dt>Accuracy</dt><dd>{summary.accuracy}%</dd></div><div><dt>Correct</dt><dd>{summary.correct}</dd></div><div><dt>Items</dt><dd>{getStudyItemProgress(session.questions, session.currentIndex).total}</dd></div></dl>
        <div className={styles.resultActions}>
          {summary.incorrectSubjectIds.length ? <button className={styles.primaryButton} type="button" onClick={() => onRestartMistakes(summary.incorrectSubjectIds)}><RotateCcw size={17} /> Review {summary.incorrectSubjectIds.length} misses</button> : null}
          <button className={styles.secondaryButton} type="button" onClick={() => { clearStudySession(scope, session.mode); onExit(); }}>Back to setup</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.quizShell} data-type={question.subjectType} aria-labelledby="question-prompt">
      <div className={styles.quizTopbar}>
        <span className={styles.numeric}>{displayedCurrent} / {displayedTotal}</span>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={displayedCurrent} aria-valuemin={1} aria-valuemax={displayedTotal}><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
        <button type="button" className={styles.iconButton} onClick={onExit} aria-label="Pause and exit session"><X size={19} /></button>
      </div>

      <div className={styles.questionCard} data-type={question.subjectType}>
        {question.audioUrl ? <button id="question-prompt" className={styles.audioButton} type="button" onClick={() => playAudio(question.audioUrl)} aria-label={`${question.promptLabel}. Play audio`}><Volume2 size={29} /><span>{question.sourceTitle ? `Play ${question.sourceTitle} clip` : "Play pronunciation"}</span><kbd>R</kbd></button> : <h2 id="question-prompt" lang={question.kind === "meaning-to-reading" ? "en" : "ja"}>{question.prompt}</h2>}
        {question.sentenceAudioEnabled ? <button className={styles.textButton} type="button" onClick={() => speakJapanese(question.sentence?.ja)}><Volume2 size={16} /> Play sentence</button> : null}
        {question.imageUrl && answer ? <Image className={styles.contextImage} src={question.imageUrl} alt={`Scene from ${question.sourceTitle ?? "the listening example"}`} width={560} height={315} sizes="(max-width: 42rem) 90vw, 28rem" loader={passthroughImageLoader} unoptimized /> : null}
        {question.sentence && (!question.hideTranslationUntilTap || translationRevealed || answer) ? <p className={styles.sentenceTranslation}>{question.sentence.en}</p> : question.sentence ? <button className={styles.textButton} type="button" onClick={() => setTranslationRevealed(true)}>Show translation</button> : null}
      </div>

      <div className={styles.answerArea}>
        {question.choices ? <><div className={styles.promptTypeStrip} data-tone={promptType?.tone}><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong></div><div className={styles.choiceGrid} role="group" aria-label="Answer choices">{question.choices.map((choice, index) => {
          const selected = answer?.value === choice;
          const correctChoice = answer && question.acceptedAnswers.includes(choice);
          return <button type="button" key={choice} className={styles.choiceButton} data-selected={selected} data-correct={correctChoice} disabled={Boolean(answer)} onClick={() => commit(choice)}><kbd>{index + 1}</kbd><span lang={question.kind === "listening-meaning" || question.kind === "listening" ? "en" : "ja"}>{choice}</span>{selected ? answer?.correct ? <Check size={18} /> : <X size={18} /> : null}</button>;
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

        {answer ? <>{question.choices ? <div className={styles.choiceFeedback} data-correct={answer.correct} role="status" aria-live="polite"><span className={styles.answerVerdict} data-correct={answer.correct}>{answer.correct ? <Check size={18} /> : <X size={18} />}<strong>{answer.correct ? "Correct" : "Incorrect"}</strong></span>{!answer.correct ? <span className={styles.correctAnswer}><small>Correct answer</small><strong>{question.displayAnswer}</strong></span> : null}{question.stopAfterAnswer !== false ? <button className={styles.primaryButton} onClick={next}>Next <ArrowRight size={17} /></button> : null}</div> : null}{question.enableSentenceBreakdown && question.sentence?.tokens?.length ? <div className={styles.sentenceBreakdown}><div lang="ja">{question.sentence.tokens.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && question.sentence.tokens[selectedToken] ? <p><strong>{question.sentence.tokens[selectedToken].text}</strong> · {question.sentence.tokens[selectedToken].type}{question.sentence.tokens[selectedToken].reading ? ` · ${question.sentence.tokens[selectedToken].reading}` : ""}{question.sentence.tokens[selectedToken].meaning ? ` · ${question.sentence.tokens[selectedToken].meaning}` : ""}</p> : <p>Select an underlined grammar or vocabulary token for details.</p>}</div> : null}</> : null}
        {keyboardShortcuts ? question.audioUrl ? <p className={styles.keyboardHint}><Headphones size={15} /> Press <kbd>R</kbd> to replay{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : <p className={styles.keyboardHint}>Press <kbd>Enter</kbd> to {answer ? "continue" : "check"}{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : null}
      </div>
    </section>
  );
}
