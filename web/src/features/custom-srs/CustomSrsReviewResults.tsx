"use client";

import { ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { ButtonLink } from "@/components/ui/Button";
import type { QuestionKind } from "@/features/core-study/answer-checker";
import { customWordUsesKanji } from "./subject-adapter";
import type { CustomSrsStage, CustomVocabularyWord } from "./types";
import styles from "./custom-srs-review-results.module.css";

export interface CustomReviewOutcome {
  startingStage: CustomSrsStage;
  endingStage: CustomSrsStage;
  nextReviewAt: string | null;
}

export type CustomReviewQuestionMistakes = Record<string, Partial<Record<QuestionKind, number>>>;

interface ReviewResult {
  word: CustomVocabularyWord;
  outcome: CustomReviewOutcome;
  meaningMistakes: number;
  readingMistakes: number | null;
  totalMistakes: number;
}

function strictAccuracy(results: readonly ReviewResult[], kind: QuestionKind) {
  const applicable = kind === "reading" ? results.filter(({ readingMistakes }) => readingMistakes !== null) : results;
  if (!applicable.length) return null;
  const perfect = applicable.filter((result) => (kind === "reading" ? result.readingMistakes : result.meaningMistakes) === 0).length;
  return Math.round((perfect / applicable.length) * 100);
}

function formatAccuracy(value: number | null) {
  return value === null ? "N/A" : `${value}%`;
}

function formatDuration(startedAt: Date, completedAt: Date | null) {
  if (!completedAt) return "0 min";
  return `${Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000))} min`;
}

function formatNextReview(outcome: CustomReviewOutcome) {
  if (outcome.endingStage >= 9) return "No more reviews";
  if (!outcome.nextReviewAt) return "Scheduled";
  const date = new Date(outcome.nextReviewAt);
  if (!Number.isFinite(date.getTime())) return "Scheduled";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function mistakeLabel(count: number) {
  return count ? `${count} ${count === 1 ? "mistake" : "mistakes"}` : "Correct";
}

function ResultStatus({ label, mistakes }: { label: string; mistakes: number }) {
  const correct = mistakes === 0;
  return <div className={styles.answerResult} data-correct={correct}>
    <dt>{label}</dt>
    <dd>{correct ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}<span>{mistakeLabel(mistakes)}</span></dd>
  </div>;
}

export function CustomSrsReviewResults({
  words,
  outcomesByWord,
  mistakesByQuestion,
  startedAt,
  completedAt,
}: {
  words: readonly CustomVocabularyWord[];
  outcomesByWord: Readonly<Record<string, CustomReviewOutcome>>;
  mistakesByQuestion: Readonly<CustomReviewQuestionMistakes>;
  startedAt: Date;
  completedAt: Date | null;
}) {
  const results = useMemo(() => words.flatMap<ReviewResult>((word) => {
    const outcome = outcomesByWord[word.id];
    if (!outcome) return [];
    const meaningMistakes = mistakesByQuestion[word.id]?.meaning ?? 0;
    const readingMistakes = customWordUsesKanji(word) ? mistakesByQuestion[word.id]?.reading ?? 0 : null;
    return [{
      word,
      outcome,
      meaningMistakes,
      readingMistakes,
      totalMistakes: meaningMistakes + (readingMistakes ?? 0),
    }];
  }), [mistakesByQuestion, outcomesByWord, words]);
  const mistakenResults = results.filter(({ totalMistakes }) => totalMistakes > 0);
  const [selectedTab, setSelectedTab] = useState<"mistakes" | "all">(() => mistakenResults.length ? "mistakes" : "all");
  const visibleResults = selectedTab === "mistakes" ? mistakenResults : results;
  const incorrectAttempts = results.reduce((sum, { totalMistakes }) => sum + totalMistakes, 0);
  const testedQuestions = results.reduce((sum, { readingMistakes }) => sum + 1 + Number(readingMistakes !== null), 0);
  const overallAccuracy = testedQuestions ? Math.round((testedQuestions / (testedQuestions + incorrectAttempts)) * 100) : 0;
  const meaningAccuracy = strictAccuracy(results, "meaning");
  const readingAccuracy = strictAccuracy(results, "reading");
  const summary = incorrectAttempts === 0
    ? "Every reviewed word was answered without a mistake."
    : `${mistakenResults.length} ${mistakenResults.length === 1 ? "word needs" : "words need"} another look.`;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "ArrowLeft" || event.key === "Home" ? "mistakes" : "all";
    setSelectedTab(nextTab);
    document.getElementById(`custom-review-${nextTab}-tab`)?.focus({ preventScroll: true });
  };

  return <section className={styles.results} aria-labelledby="custom-review-results-title">
    <header className={styles.header}>
      <div className={styles.resultMark}><Check size={28} aria-hidden /></div>
      <div>
        <h1 id="custom-review-results-title">Custom reviews complete</h1>
        <p>Your answers are saved. {summary}</p>
      </div>
    </header>

    <section className={styles.summary} aria-label="Review summary">
      <div className={styles.accuracyRing}>
        <svg viewBox="0 0 44 44" role="img" aria-label={`${overallAccuracy}% overall accuracy`}>
          <circle className={styles.ringTrack} cx="22" cy="22" r="18" pathLength="100" />
          <circle className={styles.ringValue} cx="22" cy="22" r="18" pathLength="100" style={{ "--accuracy": overallAccuracy } as CSSProperties} />
        </svg>
        <div><strong>{overallAccuracy}%</strong><span>Overall</span></div>
      </div>
      <dl className={styles.stats}>
        <div><dt>Items completed</dt><dd>{results.length}</dd></div>
        <div><dt>Meaning accuracy</dt><dd>{formatAccuracy(meaningAccuracy)}</dd></div>
        <div><dt>Reading accuracy</dt><dd>{formatAccuracy(readingAccuracy)}</dd></div>
        <div><dt>Incorrect attempts</dt><dd>{incorrectAttempts}</dd></div>
        <div><dt>Time studied</dt><dd>{formatDuration(startedAt, completedAt)}</dd></div>
      </dl>
    </section>
    <p className={styles.accuracyNote}>Overall accuracy counts every answer attempt, including retries. Meaning and reading accuracy show the share of words answered without a mistake.</p>

    <section className={styles.breakdown} aria-labelledby="custom-review-breakdown-title">
      <header className={styles.breakdownHeader}>
        <div><h2 id="custom-review-breakdown-title">Review breakdown</h2><p>Check each word’s answers and new SRS stage.</p></div>
        <div className={styles.tabs} role="tablist" aria-label="Review result filter">
          <button id="custom-review-mistakes-tab" type="button" role="tab" tabIndex={selectedTab === "mistakes" ? 0 : -1} aria-selected={selectedTab === "mistakes"} aria-controls="custom-review-result-panel" onClick={() => setSelectedTab("mistakes")} onKeyDown={handleTabKeyDown}>Mistakes ({mistakenResults.length})</button>
          <button id="custom-review-all-tab" type="button" role="tab" tabIndex={selectedTab === "all" ? 0 : -1} aria-selected={selectedTab === "all"} aria-controls="custom-review-result-panel" onClick={() => setSelectedTab("all")} onKeyDown={handleTabKeyDown}>All items ({results.length})</button>
        </div>
      </header>

      <div id="custom-review-result-panel" className={styles.resultPanel} role="tabpanel" aria-labelledby={`custom-review-${selectedTab}-tab`} tabIndex={0}>{visibleResults.length ? <ol className={styles.resultList}>
        {visibleResults.map(({ word, outcome, meaningMistakes, readingMistakes, totalMistakes }) => <li key={word.id}>
          <article className={styles.wordResult} aria-label={`${word.characters} review result`} data-mistakes={totalMistakes}>
            <header className={styles.wordHeader}>
              <Link className={styles.characters} href={`/custom-vocabulary/words/${encodeURIComponent(word.id)}`} lang="ja" aria-label={`Open ${word.characters} subject details`}>{word.characters}</Link>
              <div className={styles.wordIdentity}><h3>{word.meanings[0] ?? word.characters}</h3><p><span lang="ja">{word.reading}</span> · {customWordUsesKanji(word) ? "Vocabulary" : "Kana vocabulary"}</p></div>
              {totalMistakes ? <span className={styles.mistakeCount}>{totalMistakes} {totalMistakes === 1 ? "mistake" : "mistakes"}</span> : <span className={styles.perfectCount}><Check size={15} aria-hidden /> Perfect</span>}
            </header>

            <dl className={styles.answerResults}>
              <ResultStatus label="Meaning" mistakes={meaningMistakes} />
              {readingMistakes !== null ? <ResultStatus label="Reading" mistakes={readingMistakes} /> : null}
            </dl>

            <footer className={styles.wordFooter}>
              <dl className={styles.schedule}>
                <div><dt>SRS stage</dt><dd><SrsStageIcon stage={outcome.startingStage} size={16} /><span>{srsStageLabel(outcome.startingStage)}</span><ArrowRight size={14} aria-hidden /><SrsStageIcon stage={outcome.endingStage} size={16} /><strong>{srsStageLabel(outcome.endingStage)}</strong></dd></div>
                <div><dt>Next review</dt><dd>{formatNextReview(outcome)}</dd></div>
              </dl>
              <ButtonLink href={`/custom-vocabulary/words/${encodeURIComponent(word.id)}`} size="small" tone="ghost" aria-label={`View ${word.characters} details`}>View details<ArrowRight size={15} aria-hidden /></ButtonLink>
            </footer>
          </article>
        </li>)}
      </ol> : <div className={styles.perfectEmpty}><Check size={28} aria-hidden /><div><strong>No mistakes this time</strong><p>Open All items to review the words and their new SRS stages.</p></div></div>}</div>
    </section>

    <div className={styles.actions}>
      <ButtonLink href="/" tone="primary" className={styles.primaryAction}>Back to Dashboard</ButtonLink>
      <ButtonLink href="/custom-vocabulary" tone="ghost">Vocabulary Packs</ButtonLink>
    </div>
  </section>;
}
