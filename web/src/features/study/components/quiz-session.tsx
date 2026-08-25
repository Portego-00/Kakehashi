"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Headphones, RotateCcw, Volume2, X } from "lucide-react";
import { advanceStudySession, answerStudyQuestion, getSessionSummary } from "../engine";
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

function subjectTypeLabel(question: StudyQuestion) {
  if (question.subjectType === "radical") return "Radical";
  if (question.subjectType === "kanji") return "Kanji";
  return "Vocabulary";
}

export function promptTypePresentation(question: StudyQuestion): { label: string; tone: PromptTone } {
  if (["meaning", "kana-to-meaning", "listening", "listening-meaning"].includes(question.kind)) return { label: "Meaning", tone: "meaning" };
  if (["reading", "meaning-to-reading"].includes(question.kind)) return { label: "Reading", tone: "reading" };
  if (["kana-to-kanji", "similar-kanji"].includes(question.kind)) return { label: "Kanji", tone: "other" };
  if (question.kind === "listening-characters") return { label: "Vocabulary", tone: question.subjectType === "kana_vocabulary" ? "reading" : "other" };
  return { label: "Answer", tone: questionUsesKanaComposition(question) ? "reading" : "other" };
}

export function QuizSession({ scope, initialSession, onExit, onRestartMistakes }: { scope: StudyStorageScope; initialSession: StudySession; onExit: () => void; onRestartMistakes: (subjectIds: number[]) => void }) {
  const [session, setSession] = useState(initialSession);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const question = session.questions[session.currentIndex];
  const answer = question ? session.answers.find((item) => item.questionId === question.id) : undefined;
  const progress = session.questions.length ? Math.round(((session.currentIndex + 1) / session.questions.length) * 100) : 0;
  const listeningSession = session.mode === "listening";
  const displayedCurrent = listeningSession ? Math.floor(session.currentIndex / 2) + 1 : session.currentIndex + 1;
  const displayedTotal = listeningSession ? Math.ceil(session.questions.length / 2) : session.questions.length;
  const promptType = question ? promptTypePresentation(question) : null;
  const kanaComposition = question ? questionUsesKanaComposition(question) : false;

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (answer) next(); else commit(value);
      }
      if (!answer && question?.choices && /^[1-4]$/.test(event.key)) {
        const choice = question.choices[Number(event.key) - 1];
        if (choice) commit(choice);
      }
      if (event.key.toLocaleLowerCase() === "r" && question?.audioUrl) playAudio(question.audioUrl);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, commit, next, question, value]);

  if (session.complete || !question) {
    const summary = getSessionSummary(session);
    return (
      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultMark} data-perfect={summary.accuracy === 100}><Check size={34} aria-hidden="true" /></div>
        <h2 id="results-title">Session complete</h2>
        <p>{summary.accuracy >= 90 ? "Strong recall. Keep the interval wide." : summary.accuracy >= 70 ? "Good work. A short pass on the misses will help." : "This set is worth another focused pass."}</p>
        <dl className={styles.resultStats}><div><dt>Accuracy</dt><dd>{summary.accuracy}%</dd></div><div><dt>Correct</dt><dd>{summary.correct}</dd></div><div><dt>Answered</dt><dd>{summary.total}</dd></div></dl>
        <div className={styles.resultActions}>
          {summary.incorrectSubjectIds.length ? <button className={styles.primaryButton} type="button" onClick={() => onRestartMistakes(summary.incorrectSubjectIds)}><RotateCcw size={17} /> Review {summary.incorrectSubjectIds.length} misses</button> : null}
          <button className={styles.secondaryButton} type="button" onClick={() => { clearStudySession(scope, session.mode); onExit(); }}>Back to setup</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.quizShell} aria-labelledby="question-prompt">
      <div className={styles.quizTopbar}>
        <span className={styles.numeric}>{displayedCurrent} / {displayedTotal}</span>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={session.currentIndex + 1} aria-valuemin={1} aria-valuemax={session.questions.length}><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
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
        })}</div></> : <form className={styles.answerForm} data-result={answer ? answer.correct ? "correct" : "incorrect" : undefined} onSubmit={(event) => { event.preventDefault(); if (answer) next(); else commit(value); }}><label className={styles.promptTypeStrip} data-tone={promptType?.tone} htmlFor="study-answer"><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong>{kanaComposition ? <small>Romaji → かな</small> : null}</label><div className={styles.answerInputRow} data-result={answer ? answer.correct ? "correct" : "incorrect" : undefined}><input ref={inputRef} id="study-answer" autoFocus autoComplete="off" spellCheck={false} lang={kanaComposition ? "ja" : undefined} value={value} onChange={(event) => setValue(kanaComposition ? composeKanaInput(event.target.value) : event.target.value)} readOnly={Boolean(answer)} aria-label={`${subjectTypeLabel(question)} ${promptType?.label ?? "answer"}`} aria-invalid={answer ? !answer.correct : undefined} aria-describedby="study-answer-status" /><button type="submit" className={styles.primaryButton} disabled={!answer && !value.trim()}>{answer ? <ArrowRight size={18} /> : <Check size={18} />}{answer ? "Next" : "Check"}</button></div><div id="study-answer-status" className={styles.answerStatus} role="status" aria-live="polite">{answer ? <><span className={styles.answerVerdict} data-correct={answer.correct}>{answer.correct ? <Check size={18} /> : <X size={18} />}<strong>{answer.correct ? "Correct" : "Incorrect"}</strong></span>{!answer.correct ? <span className={styles.correctAnswer}><small>Correct answer</small><strong lang={kanaComposition ? "ja" : undefined}>{question.displayAnswer}</strong></span> : null}</> : kanaComposition ? <span>Romaji converts to hiragana as you type.</span> : null}</div></form>}

        {answer ? <>{question.choices ? <div className={styles.choiceFeedback} data-correct={answer.correct} role="status" aria-live="polite"><span className={styles.answerVerdict} data-correct={answer.correct}>{answer.correct ? <Check size={18} /> : <X size={18} />}<strong>{answer.correct ? "Correct" : "Incorrect"}</strong></span>{!answer.correct ? <span className={styles.correctAnswer}><small>Correct answer</small><strong>{question.displayAnswer}</strong></span> : null}{question.stopAfterAnswer !== false ? <button className={styles.primaryButton} onClick={next}>Next <ArrowRight size={17} /></button> : null}</div> : null}{question.enableSentenceBreakdown && question.sentence?.tokens?.length ? <div className={styles.sentenceBreakdown}><div lang="ja">{question.sentence.tokens.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && question.sentence.tokens[selectedToken] ? <p><strong>{question.sentence.tokens[selectedToken].text}</strong> · {question.sentence.tokens[selectedToken].type}{question.sentence.tokens[selectedToken].reading ? ` · ${question.sentence.tokens[selectedToken].reading}` : ""}{question.sentence.tokens[selectedToken].meaning ? ` · ${question.sentence.tokens[selectedToken].meaning}` : ""}</p> : <p>Select an underlined grammar or vocabulary token for details.</p>}</div> : null}</> : null}
        {question.audioUrl ? <p className={styles.keyboardHint}><Headphones size={15} /> Press <kbd>R</kbd> to replay</p> : <p className={styles.keyboardHint}>Press <kbd>Enter</kbd> to check and continue</p>}
      </div>
    </section>
  );
}
