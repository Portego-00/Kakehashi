import {
  ArrowRight,
  Clock3,
  Gauge,
  Headphones,
  History,
  Keyboard,
  Pause,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  approximateMockQuestionCount,
  JLPT_MOCK_STRUCTURES,
} from "../structure";
import {
  JLPT_LEVELS,
  type JlptLevel,
  type JlptQuizMode,
  type JlptSession,
} from "../types";
import styles from "../jlpt.module.css";

const LEVEL_COPY: Record<JlptLevel, { label: string; summary: string }> = {
  N5: {
    label: "Foundation",
    summary:
      "Basic words, sentence patterns, notices, and short everyday exchanges.",
  },
  N4: {
    label: "Elementary",
    summary:
      "Familiar daily situations with broader vocabulary and connected reading.",
  },
  N3: {
    label: "Bridge",
    summary:
      "Everyday Japanese at near-natural speed, longer texts, and more nuanced grammar.",
  },
  N2: {
    label: "Upper intermediate",
    summary:
      "Articles, commentary, argument structure, and varied near-natural-speed listening.",
  },
  N1: {
    label: "Advanced",
    summary:
      "Abstract reasoning, precise usage, complex texts, and dense spoken information.",
  },
};

function statusLabel(session: JlptSession) {
  if (session.status === "complete") return "Results ready";
  if (session.status === "section-complete") return "Section complete";
  if (session.status === "paused") return "Paused";
  return "In progress";
}

export function JlptHub({
  selectedLevel,
  onSelectLevel,
  immediateFeedback,
  onImmediateFeedbackChange,
  onStart,
  startingMode,
  savedSession,
  onResume,
  onDiscard,
}: {
  selectedLevel: JlptLevel;
  onSelectLevel: (level: JlptLevel) => void;
  immediateFeedback: boolean;
  onImmediateFeedbackChange: (enabled: boolean) => void;
  onStart: (mode: Exclude<JlptQuizMode, "weak">) => void;
  startingMode: JlptQuizMode | null;
  savedSession: JlptSession | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const structure = JLPT_MOCK_STRUCTURES[selectedLevel];
  const totalMinutes = structure.sections.reduce(
    (total, section) => total + section.durationMinutes,
    0,
  );
  const levelCopy = LEVEL_COPY[selectedLevel];

  return (
    <main className={styles.hub}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>
            Japanese Language Proficiency Test
          </span>
          <h1>JLPT Quiz</h1>
          <p>
            Original questions shaped around the official level, item-type,
            section, and timing specifications.
          </p>
        </div>
        <div className={styles.researchBadge}>
          <Gauge size={16} aria-hidden /> Official format researched
        </div>
      </header>

      {savedSession ? (
        <section className={styles.resumeBar} aria-label="Saved JLPT session">
          <div className={styles.resumeIcon}>
            <History size={20} aria-hidden />
          </div>
          <div className={styles.resumeCopy}>
            <strong>
              {savedSession.level}{" "}
              {savedSession.mode === "mock"
                ? "mock exam"
                : savedSession.mode === "weak"
                  ? "weak-area practice"
                  : "quick quiz"}
            </strong>
            <span>
              {statusLabel(savedSession)} · {savedSession.answers.length} of{" "}
              {savedSession.sectionQuestionIds.flat().length} answered
            </span>
          </div>
          <div className={styles.resumeActions}>
            <Button tone="primary" size="small" onClick={onResume}>
              {savedSession.status === "complete" ? "View results" : "Resume"}{" "}
              <ArrowRight size={15} aria-hidden />
            </Button>
            <Button tone="ghost" size="small" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </section>
      ) : null}

      <section
        className={styles.levelSection}
        aria-labelledby="jlpt-level-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.step}>01</span>
            <h2 id="jlpt-level-heading">Choose a level</h2>
          </div>
          <p>
            Each official question family has 200 generated renderings. Distinct
            question ideas come first; recurring variants remain labelled beta
            while editorial review continues.
          </p>
        </div>
        <div
          className={styles.levelPicker}
          role="radiogroup"
          aria-label="JLPT level"
        >
          {JLPT_LEVELS.map((level) => (
            <button
              type="button"
              role="radio"
              aria-checked={selectedLevel === level}
              className={styles.levelOption}
              data-selected={selectedLevel === level || undefined}
              key={level}
              onClick={() => onSelectLevel(level)}
            >
              <strong>{level}</strong>
              <span>{LEVEL_COPY[level].label}</span>
            </button>
          ))}
        </div>
        <div className={styles.levelContext} aria-live="polite">
          <strong>
            {selectedLevel} · {levelCopy.label}
          </strong>
          <span>{levelCopy.summary}</span>
        </div>
      </section>

      <section
        className={styles.modeSection}
        aria-labelledby="jlpt-mode-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.step}>02</span>
            <h2 id="jlpt-mode-heading">Choose a session</h2>
          </div>
          <p>
            Both modes prioritize unpracticed semantic items for this WaniKani
            account, then unseen renderings, before cycling a finite family
            pool.
          </p>
        </div>
        <div className={styles.modeGrid}>
          <article className={styles.quickMode}>
            <div className={styles.modeTopline}>
              <Sparkles size={21} aria-hidden />
              <span>5–10 minutes</span>
            </div>
            <h3>Quick Quiz</h3>
            <p>
              Ten randomized, unseen-first questions across the skills
              represented at {selectedLevel}. Move quickly, with optional answer
              feedback.
            </p>
            <ul className={styles.featureList}>
              <li>
                <span>10</span> representative questions
              </li>
              <li>
                <span>Mixed</span> kanji, vocabulary, grammar, reading, and
                listening
              </li>
              <li>
                <span>Fresh</span> avoids repeated question ideas while unseen
                semantic items remain
              </li>
              <li>
                <span>Fast</span> keyboard-first flow
              </li>
            </ul>
            <label className={styles.feedbackToggle}>
              <input
                type="checkbox"
                checked={immediateFeedback}
                onChange={(event) =>
                  onImmediateFeedbackChange(event.target.checked)
                }
              />
              <span aria-hidden>
                <i />
              </span>
              <span>
                <strong>Immediate feedback</strong>
                <small>
                  Show the answer and explanation after each response.
                </small>
              </span>
            </label>
            <Button
              tone="primary"
              wide
              state={startingMode === "quick" ? "loading" : "idle"}
              onClick={() => onStart("quick")}
            >
              Start quick quiz <ArrowRight size={17} aria-hidden />
            </Button>
          </article>

          <article className={styles.mockMode}>
            <div className={styles.modeTopline}>
              <Clock3 size={21} aria-hidden />
              <span>
                Timed · {totalMinutes} minutes published nominal allowance
              </span>
            </div>
            <h3>Representative Mock Exam</h3>
            <p>
              About {approximateMockQuestionCount(selectedLevel)} questions,
              sampled to the official published item-count guide and ordered
              into the real {selectedLevel} timed sections. Correctness stays
              hidden until the end.
            </p>
            <ol className={styles.sectionTimeline}>
              {structure.sections.map((section, index) => (
                <li key={section.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{section.shortTitle}</strong>
                    <small>{section.durationMinutes} minutes</small>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.mockNotes}>
              <span>
                <Headphones size={15} aria-hidden /> One forward play per item;
                the official test uses continuous section audio
              </span>
              <span>
                <Pause size={15} aria-hidden /> Pause is a Kakehashi
                accommodation, not official test behavior
              </span>
            </div>
            <Button
              tone="accent"
              wide
              state={startingMode === "mock" ? "loading" : "idle"}
              onClick={() => onStart("mock")}
            >
              Start timed mock <ArrowRight size={17} aria-hidden />
            </Button>
          </article>
        </div>
      </section>

      <footer className={styles.hubFooter}>
        <Keyboard size={17} aria-hidden />
        <span>
          During a quiz: press <kbd>1</kbd>–<kbd>4</kbd> to choose,{" "}
          <kbd>Enter</kbd> to submit or continue, and <kbd>Space</kbd> to play
          listening audio.
        </span>
      </footer>
    </main>
  );
}
