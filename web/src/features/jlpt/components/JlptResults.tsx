"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Dumbbell,
  Link2,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { assignmentsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import {
  answerForQuestion,
  scoreJlptSession,
  waniKaniKanjiInsight,
} from "../engine";
import { OFFICIAL_TYPE_LABELS, SKILL_LABELS } from "../structure";
import type {
  JlptPerformanceSlice,
  JlptQuestion,
  JlptSession,
  JlptSkill,
} from "../types";
import styles from "./JlptResults.module.css";
import { JlptVerbalSceneIllustration } from "./JlptVerbalScene";

function performanceGrade(percent: number) {
  if (percent >= 80) return "strong";
  if (percent >= 60) return "developing";
  return "focus";
}

function overallOutcome(percent: number) {
  if (percent >= 85) return "Strong work on this question set.";
  if (percent >= 70) return "A solid base with a few clear gaps.";
  if (percent >= 50) return "Your next study priorities are clear.";
  return "Focus the foundation before adding more difficulty.";
}

function practiceButtonLabel(skills: readonly JlptSkill[]) {
  if (skills.length === 0) return "Practice weak areas";
  const labels = skills.map((skill) => SKILL_LABELS[skill]);
  if (labels.length === 1) return `Practice ${labels[0]}`;
  if (labels.length === 2) return `Practice ${labels[0]} & ${labels[1]}`;
  return `Practice ${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function PerformanceRow({ slice }: { slice: JlptPerformanceSlice }) {
  return (
    <div
      className={styles.performanceRow}
      data-grade={performanceGrade(slice.percent)}
    >
      <div className={styles.performanceLabel}>
        <strong>{slice.label}</strong>
        <span>
          {slice.correct} of {slice.total} correct
        </span>
      </div>
      <div className={styles.performanceMeasure}>
        <div
          className={styles.performanceTrack}
          role="progressbar"
          aria-label={`${slice.label}: ${slice.percent}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={slice.percent}
        >
          <span style={{ width: `${slice.percent}%` }} />
        </div>
        <strong>{slice.percent}%</strong>
      </div>
    </div>
  );
}

function ResultsWaniKaniInsight({
  session,
  questions,
  weakest,
}: {
  session: JlptSession;
  questions: readonly JlptQuestion[];
  weakest: JlptPerformanceSlice | null;
}) {
  const assignments = useQuery(assignmentsQuery());
  const subjects = useQuery(subjectsQuery("types=kanji"));
  const insight = useMemo(() => {
    if (!assignments.data || !subjects.data) return null;
    const guruIds = new Set(
      assignments.data
        .filter(
          (assignment) =>
            assignment.data.subject_type === "kanji" &&
            assignment.data.srs_stage >= 5,
        )
        .map((assignment) => assignment.data.subject_id),
    );
    const guruKanji = new Set(
      subjects.data
        .filter((subject) => guruIds.has(subject.id))
        .map((subject) => subject.data.characters)
        .filter((characters): characters is string => Boolean(characters)),
    );
    return waniKaniKanjiInsight(session, questions, guruKanji);
  }, [assignments.data, questions, session, subjects.data]);

  if (!insight || insight.tested === 0) return null;
  const coverage = Math.round((insight.guru / insight.tested) * 100);
  const skillLag = weakest && weakest.id !== "kanji" ? weakest.label : null;
  const interpretation =
    coverage >= 70 && (insight.quizPercent ?? 0) >= 70 && skillLag
      ? `Your WaniKani foundation held up here; ${skillLag.toLocaleLowerCase()} is the clearer next focus.`
      : coverage >= 70
        ? "You have already reached Guru or higher on most of the kanji that appeared here."
        : "Some kanji in this session are still ahead of your current WaniKani progress.";

  return (
    <section
      className={styles.waniKaniInsight}
      aria-labelledby="wk-insight-title"
    >
      <Link2 size={20} aria-hidden />
      <div>
        <h2 id="wk-insight-title">WaniKani context</h2>
        <p>{interpretation}</p>
        <span>
          <strong>
            {insight.guru}/{insight.tested}
          </strong>{" "}
          kanji from this session are Guru+
          {insight.quizPercent === null
            ? ""
            : ` · ${insight.quizPercent}% on kanji questions`}
        </span>
      </div>
    </section>
  );
}

export function JlptResults({
  session,
  questions,
  onPracticeWeakAreas,
  onReturn,
}: {
  session: JlptSession;
  questions: readonly JlptQuestion[];
  onPracticeWeakAreas: (skills: JlptSkill[]) => void;
  onReturn: () => void;
}) {
  const result = useMemo(
    () => scoreJlptSession(session, questions),
    [questions, session],
  );
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const questionNumberById = useMemo(
    () =>
      new Map(
        session.sectionQuestionIds.flat().map((id, index) => [id, index + 1]),
      ),
    [session.sectionQuestionIds],
  );
  const rankedTypes = useMemo(
    () =>
      result.byType.toSorted(
        (left, right) =>
          left.percent - right.percent ||
          right.total - left.total ||
          left.label.localeCompare(right.label),
      ),
    [result.byType],
  );
  const weakSkills = result.bySkill
    .filter((slice) => slice.percent < 70)
    .map((slice) => slice.id as JlptSkill);
  const practiceSkills = weakSkills.length
    ? weakSkills
    : result.weakest
      ? [result.weakest.id as JlptSkill]
      : [];
  const isMock = session.mode === "mock";
  const modeLabel = isMock
    ? "Representative mock exam"
    : session.mode === "weak"
      ? "Weak-area practice"
      : "Quick quiz";
  const pointSwing = result.total ? Math.round(100 / result.total) : 0;
  const typeCountLabel = `${result.byType.length} official question ${result.byType.length === 1 ? "type" : "types"}`;
  const sampleNotice = isMock
    ? `${result.total} representative questions across ${typeCountLabel}. This is raw accuracy—not an official JLPT score or pass prediction. The real test uses scaled scores.`
    : session.mode === "weak"
      ? `${result.total} targeted questions weighted toward prior weak skills. Use this to guide practice, not to judge your overall JLPT level.`
      : `${result.total} questions make this a quick directional sample; one answer changes the result by about ${pointSwing} points. Use it as a study guide, not a JLPT level verdict.`;

  return (
    <main className={styles.page}>
      <button type="button" className={styles.back} onClick={onReturn}>
        <ArrowLeft size={17} aria-hidden /> JLPT home
      </button>

      <header className={styles.summary}>
        <div className={styles.score} aria-label={`${result.percent}% overall`}>
          <strong>{result.percent}%</strong>
          <span>
            {isMock ? "estimated mock accuracy" : "practice accuracy"}
          </span>
          <p>
            {result.correct} correct out of {result.total}
          </p>
        </div>
        <div className={styles.summaryCopy}>
          <p className={styles.context}>
            {session.level} · {modeLabel}
          </p>
          <h1>{isMock ? "Estimated mock performance" : "Quiz results"}</h1>
          <p className={styles.outcome}>{overallOutcome(result.percent)}</p>
          <div className={styles.confidenceNote}>
            <BookOpenCheck size={18} aria-hidden />
            <div>
              <strong>Directional result</strong>
              <p>{sampleNotice}</p>
            </div>
          </div>
          <div className={styles.actions}>
            <Button
              tone="primary"
              disabled={!practiceSkills.length}
              onClick={() => onPracticeWeakAreas(practiceSkills)}
            >
              <Dumbbell size={17} aria-hidden />{" "}
              {practiceButtonLabel(practiceSkills)}
            </Button>
            <Button onClick={onReturn}>Choose another test</Button>
          </div>
        </div>
      </header>

      <section className={styles.priorities} aria-labelledby="priorities-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="priorities-title">What to do next</h2>
            <p>Prioritized from this session only</p>
          </div>
        </div>
        <div className={styles.priorityRows}>
          <div className={styles.priorityRow} data-priority="focus">
            <Target size={20} aria-hidden />
            <div>
              <span>First priority</span>
              <strong>
                {result.weakest
                  ? result.weakest.percent < 70
                    ? `${result.weakest.label} needs the most attention`
                    : result.weakest.percent < 85
                      ? `${result.weakest.label} has the most room to improve`
                      : "No weak skill stood out"
                  : "Take another quiz for a clearer signal"}
              </strong>
              <p>
                {result.weakest
                  ? result.weakest.percent < 85
                    ? `${result.weakest.correct} of ${result.weakest.total} correct (${result.weakest.percent}%). A focused practice set will revisit this skill first.`
                    : `${result.weakest.label} was the lowest relative result at ${result.weakest.correct} of ${result.weakest.total} correct (${result.weakest.percent}%). Keep every skill in rotation.`
                  : "There was not enough scored material to identify a weakest area."}
              </p>
            </div>
          </div>
          {result.strongest && result.strongest.id !== result.weakest?.id ? (
            <div className={styles.priorityRow} data-priority="strength">
              <TrendingUp size={20} aria-hidden />
              <div>
                <span>Keep building</span>
                <strong>{result.strongest.label} led this session</strong>
                <p>
                  {result.strongest.correct} of {result.strongest.total} correct
                  ({result.strongest.percent}%). Keep it in rotation while
                  spending more time on the priority above.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className={styles.breakdownGrid}>
        <section
          className={styles.breakdown}
          aria-labelledby="skill-breakdown-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="skill-breakdown-title">Skills</h2>
              <p>Raw accuracy by study area</p>
            </div>
          </div>
          <div className={styles.performanceList}>
            {result.bySkill.map((slice) => (
              <PerformanceRow slice={slice} key={slice.id} />
            ))}
          </div>
        </section>

        <section
          className={styles.breakdown}
          aria-labelledby="section-breakdown-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="section-breakdown-title">JLPT scoring sections</h2>
              <p>Grouped like the official result report</p>
            </div>
          </div>
          <div className={styles.performanceList}>
            {result.byScoringSection.map((slice) => (
              <PerformanceRow slice={slice} key={slice.id} />
            ))}
          </div>
          <p className={styles.sectionNote}>
            Official sectional pass marks cannot be applied to raw percentages
            because JLPT scoring is scaled.
          </p>
        </section>
      </div>

      <ResultsWaniKaniInsight
        session={session}
        questions={questions}
        weakest={result.weakest}
      />

      <section
        className={styles.typeBreakdown}
        aria-labelledby="type-breakdown-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="type-breakdown-title">Question types</h2>
            <p>
              Lowest accuracy first · {result.byType.length} official types
              represented
            </p>
          </div>
        </div>
        <div className={styles.typeList}>
          {rankedTypes.map((slice) => (
            <div
              className={styles.typeRow}
              data-grade={performanceGrade(slice.percent)}
              key={slice.id}
            >
              <span>{slice.label}</span>
              <small>
                {slice.correct}/{slice.total} correct
                {slice.total === 1 ? " · one-question sample" : ""}
              </small>
              <div className={styles.typeTrack} aria-hidden>
                <span style={{ width: `${slice.percent}%` }} />
              </div>
              <strong>{slice.percent}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section
        className={styles.review}
        id="missed-review"
        aria-labelledby="review-title"
      >
        <div className={styles.reviewHeading}>
          <div>
            <h2 id="review-title">Missed question review</h2>
            <p>Compare your answer, then read why the correct choice fits.</p>
          </div>
          <strong>
            {result.missedQuestionIds.length
              ? `${result.missedQuestionIds.length} to revisit`
              : "No misses"}
          </strong>
        </div>
        {result.missedQuestionIds.length ? (
          <div className={styles.reviewList}>
            {result.missedQuestionIds.map((id, index) => {
              const question = questionById.get(id);
              if (!question) return null;
              const answer = answerForQuestion(session, id);
              const selected = question.options.find(
                (option) => option.id === answer?.selectedOptionId,
              );
              const correct = question.options.find(
                (option) => option.id === question.correctOptionId,
              );
              const selectedLabel = answer?.selectedOrderOptionIds
                ? answer.selectedOrderOptionIds
                    .map(
                      (optionId) =>
                        question.options.find(
                          (option) => option.id === optionId,
                        )?.label,
                    )
                    .filter(Boolean)
                    .join("　")
                : selected?.label;
              const correctLabel = question.sentenceComposition
                ? question.sentenceComposition.canonicalOrderOptionIds
                    .map(
                      (optionId) =>
                        question.options.find(
                          (option) => option.id === optionId,
                        )?.label,
                    )
                    .filter(Boolean)
                    .join("　")
                : correct?.label;
              const questionNumber = questionNumberById.get(id) ?? index + 1;
              return (
                <details
                  className={styles.reviewItem}
                  key={id}
                  open={index === 0}
                >
                  <summary>
                    <span className={styles.reviewNumber}>
                      Question {questionNumber}
                    </span>
                    <span className={styles.reviewSummaryCopy}>
                      <strong lang="ja">{question.stem}</strong>
                      <small>
                        {SKILL_LABELS[question.skill]} ·{" "}
                        {OFFICIAL_TYPE_LABELS[question.officialType]}
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden />
                  </summary>
                  <div className={styles.reviewBody}>
                    {question.passage ? (
                      <article className={styles.reviewPassage} lang="ja">
                        {question.passage.title ? (
                          <strong>{question.passage.title}</strong>
                        ) : null}
                        <p>{question.passage.body}</p>
                      </article>
                    ) : null}
                    {question.officialType === "listening-verbal" &&
                    question.listening?.verbalScene ? (
                      <JlptVerbalSceneIllustration
                        scene={question.listening.verbalScene}
                      />
                    ) : null}
                    {question.listening ? (
                      <div className={styles.reviewTranscript}>
                        <strong>Listening transcript</strong>
                        <p lang="ja">{question.listening.script}</p>
                      </div>
                    ) : null}
                    <div className={styles.answerComparison}>
                      <div data-answer="incorrect">
                        <X size={18} aria-hidden />
                        <span>
                          Your answer
                          <strong lang="ja">
                            {selectedLabel || "No answer"}
                          </strong>
                        </span>
                      </div>
                      <div data-answer="correct">
                        <Check size={18} aria-hidden />
                        <span>
                          Correct answer
                          <strong lang="ja">{correctLabel}</strong>
                        </span>
                      </div>
                    </div>
                    <div className={styles.explanation}>
                      <strong>Why this is correct</strong>
                      <p>{question.explanation}</p>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className={styles.perfectResult}>
            <Check size={22} aria-hidden />
            <div>
              <strong>Every answer was correct</strong>
              <p>
                Keep the skill fresh with another randomized set, or try the
                representative mock when you want a broader sample.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
