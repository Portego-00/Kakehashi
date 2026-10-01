"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  History,
  Minus,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { levelProgressionsQuery } from "@/lib/wanikani/queries";
import { AnalyticsDialog } from "@/features/progress/components/AnalyticsPrimitives";
import { Button } from "@/components/ui/Button";
import {
  canAccessLevelGoals,
  createLevelGoal,
  dateAfterDays,
  goalMilestones,
  goalTrackFraction,
  goalOutcome,
  goalPace,
  goalStatusLabel,
  localDateKey,
  parseGoalDate,
  projectedArrival,
  replaceGoal,
  shortGoalDate,
  suggestedGoalLevel,
  type GoalMode,
  type GoalProgression,
  type LevelGoal,
} from "../../../../src/features/level-goals/model";
import { useLevelGoals } from "./use-level-goals";
import styles from "./level-goals.module.css";

export function LevelGoalHomeWidget({
  currentLevel,
  paused,
}: {
  currentLevel: number;
  paused: boolean;
}) {
  const { user, isDemo } = useSession();
  if (isDemo || !canAccessLevelGoals(user?.data.username)) return null;
  return <HomeGoal currentLevel={currentLevel} paused={paused} />;
}
function HomeGoal({
  currentLevel,
  paused,
}: {
  currentLevel: number;
  paused: boolean;
}) {
  const progressions = useQuery({
    ...levelProgressionsQuery(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return (
    <LevelGoalPanel
      currentLevel={currentLevel}
      progressions={progressions.data ?? []}
      paused={paused}
      compact
    />
  );
}

type PanelProps = {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  paused?: boolean;
  compact?: boolean;
};
export function LevelGoalPanel({
  currentLevel,
  progressions,
  paused = false,
  compact = false,
}: PanelProps) {
  const goals = useLevelGoals(currentLevel, progressions);
  const update = goals.update;
  const [editor, setEditor] = useState<"new" | "edit" | null>(null);
  const reduced = useReducedMotion();
  const goal = goals.state.active;
  const outcome = goal ? goalOutcome(goal, goals.now) : "active";
  const reached = outcome === "reached" || outcome === "late";
  const pace = goalPace(progressions, currentLevel);
  const arrival =
    goal && !paused
      ? projectedArrival(
          goal.targetLevel,
          currentLevel,
          pace?.typical ?? null,
          progressions,
          goals.now,
        )
      : null;
  const behind = !!(
    goal?.deadline &&
    arrival &&
    localDateKey(new Date(arrival)) > goal.deadline
  );
  const visible = goals.allowed && !(compact && goals.state.widgetHidden);
  useEffect(() => {
    if (!visible || !goal?.reachedAt || goal.celebrated) return;
    const timer = window.setTimeout(
      () =>
        update((s) =>
          s.active?.id === goal.id
            ? { ...s, active: { ...s.active, celebrated: true } }
            : s,
        ),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [visible, goal?.id, goal?.reachedAt, goal?.celebrated, update]);
  if (!visible) return null;
  const suggestion = suggestedGoalLevel(
    currentLevel,
    null,
    pace?.typical ?? null,
    progressions,
    goals.now,
  );
  const fraction = goal ? goalTrackFraction(goal, currentLevel) : 0;
  return (
    <motion.section
      id={compact ? undefined : "level-goal"}
      className={`${styles.panel} ${compact ? styles.widget : ""}`}
      aria-label={compact ? "Level goal widget" : "Level goal"}
      layout={!reduced}
      initial={false}
      data-outcome={outcome}
    >
      <header className={styles.header}>
        <h2>
          <Flag size={17} aria-hidden />
          Level goal
        </h2>
        {compact ? (
          <button
            className={styles.iconButton}
            aria-label="Hide goal widget"
            title="Hide from Home"
            onClick={() => goals.update((s) => ({ ...s, widgetHidden: true }))}
          >
            <X size={17} />
          </button>
        ) : (
          <button
            className={styles.textButton}
            onClick={() =>
              goals.update((s) => ({ ...s, widgetHidden: !s.widgetHidden }))
            }
          >
            {goals.state.widgetHidden ? "Show on Home" : "Hide from Home"}
          </button>
        )}
      </header>
      <motion.div
        key={goal ? `${goal.id}:${outcome}` : "empty"}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {!goal ? (
          <div className={styles.empty}>
            <div className={styles.emptyTrack} aria-hidden>
              <span>{currentLevel}</span>
              <i />
              <Flag size={22} />
              <span>{suggestion}</span>
            </div>
            <div>
              <h3>
                {currentLevel === 60
                  ? "You reached level 60"
                  : "Pick your next milestone"}
              </h3>
              <p>
                {currentLevel === 60
                  ? "Your goals stay here as part of your journey."
                  : "A level. A date. Your own pace."}
              </p>
            </div>
            {currentLevel < 60 ? (
              <Button tone="primary" onClick={() => setEditor("new")}>
                Set a goal <ArrowRight size={16} />
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div
                className={styles.destination}
                data-celebrating={(reached && !goal.celebrated) || undefined}
              >
                <span>
                  {reached ? <Check size={18} /> : <Target size={18} />}{" "}
                  {goalStatusLabel(outcome, paused, behind)}
                </span>
                <strong>
                  <small>Level</small> {goal.targetLevel}
                </strong>
                {reached && !goal.celebrated ? (
                  <div className={styles.sparkles} aria-hidden>
                    {Array.from({ length: 8 }, (_, i) => (
                      <i
                        key={i}
                        style={{ "--spark-index": i } as CSSProperties}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.date}>
                <span>
                  {reached
                    ? "Reached"
                    : paused
                      ? "Estimate paused"
                      : "Estimated arrival"}
                </span>
                <strong>
                  {reached
                    ? shortGoalDate(goal.reachedAt)
                    : paused
                      ? "Enjoy your break"
                      : shortGoalDate(arrival)}
                </strong>
                {goal.deadline ? (
                  <small>Target · {shortGoalDate(goal.deadline)}</small>
                ) : (
                  <small>
                    {Math.max(0, goal.targetLevel - currentLevel)} levels to go
                  </small>
                )}
              </div>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Levels reached toward your goal"
              aria-valuemin={goal.startLevel}
              aria-valuemax={goal.targetLevel}
              aria-valuenow={Math.max(
                goal.startLevel,
                Math.min(currentLevel, goal.targetLevel),
              )}
            >
              <span>
                <motion.i
                  initial={false}
                  animate={{ scaleX: fraction }}
                  transition={{
                    duration: reduced ? 0 : 0.55,
                    ease: [0.2, 0, 0, 1],
                  }}
                />
              </span>
              <div>
                {goalMilestones(goal, currentLevel).map((level) => (
                  <b
                    key={level}
                    data-reached={level <= currentLevel}
                    data-current={level === currentLevel}
                  >
                    {level === goal.targetLevel ? (
                      <Flag size={14} aria-hidden />
                    ) : (
                      level
                    )}
                    <small>L{level}</small>
                  </b>
                ))}
              </div>
            </div>
            {outcome === "missed" ? (
              <p className={styles.feedback}>
                The date passed. Your progress still counts.
              </p>
            ) : outcome === "late" ? (
              <p className={styles.feedback}>
                A little later, and you made it.
              </p>
            ) : !arrival && !paused && !reached ? (
              <p className={styles.feedback}>
                Your estimate appears after a completed level.
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button
                tone="primary"
                size="small"
                disabled={reached && currentLevel >= 60}
                onClick={() => setEditor(reached ? "new" : "edit")}
              >
                {reached
                  ? "Next goal"
                  : outcome === "missed"
                    ? "Adjust plan"
                    : "Edit goal"}
                <ArrowRight size={15} />
              </Button>
              {compact ? (
                <a className={styles.textButton} href="/progress#level-goal">
                  Track goal <ArrowRight size={14} />
                </a>
              ) : (
                <span className={styles.pace}>
                  {pace
                    ? `${pace.typical.toLocaleString(undefined, { maximumFractionDigits: 1 })} days / level`
                    : "Learning your pace"}
                </span>
              )}
            </div>
            {!compact ? (
              <details className={styles.details}>
                <summary>
                  Track your journey <ChevronDown size={15} />
                </summary>
                <ol className={styles.journey}>
                  {Array.from(
                    { length: goal.targetLevel - goal.startLevel },
                    (_, i) => goal.startLevel + i + 1,
                  ).map((level) => {
                    const recorded = progressions
                      .filter(
                        (p) =>
                          p.data.level === level &&
                          !p.data.abandoned_at &&
                          p.data.unlocked_at &&
                          Date.parse(p.data.unlocked_at) >=
                            Date.parse(goal.createdAt),
                      )
                      .map((p) => p.data.unlocked_at!)
                      .sort()
                      .at(-1);
                    const predicted = !paused
                      ? projectedArrival(
                          level,
                          currentLevel,
                          pace?.typical ?? null,
                          progressions,
                          goals.now,
                        )
                      : null;
                    return (
                      <li key={level}>
                        <span data-done={level <= currentLevel}>
                          {level <= currentLevel ? (
                            <Check size={14} />
                          ) : (
                            <Flag size={14} />
                          )}
                        </span>
                        <strong>Level {level}</strong>
                        <small>
                          {level <= currentLevel
                            ? recorded
                              ? shortGoalDate(recorded)
                              : "Reached"
                            : predicted
                              ? `~ ${shortGoalDate(predicted)}`
                              : "Ahead"}
                        </small>
                      </li>
                    );
                  })}
                </ol>
                <p className={styles.note}>
                  Estimates use your last {pace?.count ?? 0} completed levels,
                  excluding levels 1–2. Future reviews and breaks can change the
                  dates.
                </p>
                {arrival && pace ? (
                  <p className={styles.note}>
                    Typical pace range:{" "}
                    {shortGoalDate(
                      projectedArrival(
                        goal.targetLevel,
                        currentLevel,
                        pace.faster,
                        progressions,
                        goals.now,
                      ),
                    )}{" "}
                    –{" "}
                    {shortGoalDate(
                      projectedArrival(
                        goal.targetLevel,
                        currentLevel,
                        pace.relaxed,
                        progressions,
                        goals.now,
                      ),
                    )}
                    .
                  </p>
                ) : null}
                <button
                  className={styles.textButton}
                  onClick={() =>
                    goals.update((s) => replaceGoal(s, null, goals.now))
                  }
                >
                  End this goal
                </button>
              </details>
            ) : null}
          </>
        )}
      </motion.div>
      {!compact && goals.state.history.length ? (
        <details className={styles.details}>
          <summary>
            <History size={15} />
            Past goals <span>{goals.state.history.length}</span>
          </summary>
          <ol className={styles.history}>
            {goals.state.history.map((entry, i) => (
              <li key={`${entry.goal.id}:${i}`}>
                <strong>Level {entry.goal.targetLevel}</strong>
                <span>
                  {entry.outcome === "changed"
                    ? "Updated"
                    : entry.outcome === "ended"
                      ? "Ended"
                      : goalStatusLabel(entry.outcome)}
                </span>
                <small>
                  {shortGoalDate(entry.goal.reachedAt ?? entry.archivedAt)}
                </small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {goals.error ? (
        <p role="alert" className={styles.error}>
          {goals.error}
        </p>
      ) : null}
      {editor ? (
        <GoalEditor
          key={editor}
          currentLevel={currentLevel}
          progressions={progressions}
          existing={editor === "edit" ? goal : null}
          now={goals.now}
          onClose={() => setEditor(null)}
          onSave={(next) =>
            goals.update((s) => replaceGoal(s, next, goals.now))
          }
        />
      ) : null}
    </motion.section>
  );
}

function GoalEditor({
  currentLevel,
  progressions,
  existing,
  now,
  onClose,
  onSave,
}: {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  existing: LevelGoal | null;
  now: Date;
  onClose: () => void;
  onSave: (goal: LevelGoal) => boolean;
}) {
  const pace = goalPace(progressions, currentLevel);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<GoalMode>(existing?.mode ?? "level");
  const [duration, setDuration] = useState(existing?.durationDays ?? 30);
  const [deadline, setDeadline] = useState(
    existing?.deadline && existing.deadline > localDateKey(now)
      ? existing.deadline
      : dateAfterDays(30, now),
  );
  const [target, setTarget] = useState(
    Math.max(
      currentLevel + 1,
      existing?.targetLevel ??
        suggestedGoalLevel(
          currentLevel,
          null,
          pace?.typical ?? null,
          progressions,
          now,
        ),
    ),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const reduced = useReducedMotion();
  const effectiveDeadline =
    mode === "level"
      ? null
      : mode === "duration"
        ? dateAfterDays(duration, now)
        : deadline;
  const arrival = projectedArrival(
    target,
    currentLevel,
    pace?.typical ?? null,
    progressions,
    now,
  );
  const valid =
    target > currentLevel &&
    target <= 60 &&
    (mode === "level" ||
      (!!effectiveDeadline &&
        !!parseGoalDate(effectiveDeadline) &&
        effectiveDeadline > localDateKey(now)));
  const heading = useRef<HTMLHeadingElement>(null);
  const chooseTiming = (date: string) =>
    setTarget(
      suggestedGoalLevel(
        currentLevel,
        date,
        pace?.typical ?? null,
        progressions,
        now,
      ),
    );
  const save = () => {
    try {
      const goal = createLevelGoal(
        {
          id: crypto.randomUUID(),
          mode,
          currentLevel,
          targetLevel: target,
          deadline,
          durationDays: duration,
        },
        now,
      );
      if (onSave(goal)) setSaved(true);
      else setError("Your goal could not be saved. Please try again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check your goal.");
    }
  };
  return (
    <AnalyticsDialog
      title={
        saved
          ? "Goal set"
          : existing
            ? "Update your goal"
            : "Your next milestone"
      }
      onClose={onClose}
      className={styles.dialog}
      bodyClassName={styles.editor}
    >
      {!saved ? (
        <div className={styles.steps} aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <i key={i} data-active={i <= step} />
          ))}
        </div>
      ) : null}
      <motion.div
        key={saved ? "saved" : step}
        initial={reduced ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        onAnimationComplete={() => heading.current?.focus()}
      >
        {saved ? (
          <div className={styles.saved}>
            <motion.div
              initial={reduced ? false : { scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <Check size={34} />
            </motion.div>
            <h3 ref={heading} tabIndex={-1}>
              Level {target}. Let’s get there.
            </h3>
            <p>
              {effectiveDeadline
                ? `Your target: ${shortGoalDate(effectiveDeadline)}.`
                : "One level at a time."}
            </p>
            <Button tone="primary" onClick={onClose}>
              Keep going <ArrowRight size={16} />
            </Button>
          </div>
        ) : step === 0 ? (
          <>
            <h3 ref={heading} tabIndex={-1}>
              What are you aiming for?
            </h3>
            <div className={styles.choices}>
              {(
                [
                  {
                    id: "level",
                    title: "A level",
                    detail: "Choose your next milestone",
                    icon: Target,
                  },
                  {
                    id: "duration",
                    title: "A timeframe",
                    detail: "The next few weeks or months",
                    icon: History,
                  },
                  {
                    id: "date",
                    title: "A date",
                    detail: "Give your goal a finish line",
                    icon: Flag,
                  },
                ] as const
              ).map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  aria-pressed={mode === choice.id}
                  onClick={() => {
                    setMode(choice.id);
                    if (choice.id !== "level")
                      chooseTiming(
                        choice.id === "date"
                          ? deadline
                          : dateAfterDays(duration, now),
                      );
                  }}
                >
                  <choice.icon size={22} />
                  <span>
                    <strong>{choice.title}</strong>
                    <small>{choice.detail}</small>
                  </span>
                  {mode === choice.id ? (
                    <Check size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              ))}
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h3 ref={heading} tabIndex={-1}>
              {mode === "level"
                ? "Choose your level"
                : mode === "duration"
                  ? "How much time?"
                  : "Pick your target date"}
            </h3>
            {mode === "duration" ? (
              <div
                className={styles.duration}
                role="group"
                aria-label="Goal timeframe"
              >
                {[14, 30, 90].map((days) => (
                  <button
                    key={days}
                    aria-pressed={duration === days}
                    onClick={() => {
                      setDuration(days);
                      chooseTiming(dateAfterDays(days, now));
                    }}
                  >
                    {days === 14
                      ? "2 weeks"
                      : days === 30
                        ? "1 month"
                        : "3 months"}
                  </button>
                ))}
              </div>
            ) : null}
            {mode === "date" ? (
              <label className={styles.field}>
                Target date
                <input
                  type="date"
                  min={dateAfterDays(1, now)}
                  value={deadline}
                  onChange={(event) => {
                    setDeadline(event.target.value);
                    chooseTiming(event.target.value);
                  }}
                />
              </label>
            ) : null}
            <div className={styles.levelPicker}>
              <button
                aria-label="Lower target level"
                disabled={target <= currentLevel + 1}
                onClick={() => setTarget((t) => t - 1)}
              >
                <Minus size={21} />
              </button>
              <label>
                Target level
                <input
                  aria-label="Target level"
                  type="number"
                  min={currentLevel + 1}
                  max={60}
                  value={target}
                  onChange={(event) => setTarget(Number(event.target.value))}
                />
              </label>
              <button
                aria-label="Raise target level"
                disabled={target >= 60}
                onClick={() => setTarget((t) => t + 1)}
              >
                <Plus size={21} />
              </button>
            </div>
            <input
              className={styles.slider}
              aria-label="Choose target level"
              type="range"
              min={currentLevel + 1}
              max={60}
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
            />
            <p className={styles.preview}>
              {arrival ? (
                <>
                  Your pace puts you here around{" "}
                  <strong>{shortGoalDate(arrival)}</strong>.
                </>
              ) : (
                "Your estimate will grow with your level history."
              )}
            </p>
          </>
        ) : (
          <>
            <div className={styles.review}>
              <Flag size={30} />
              <span>Your next milestone</span>
              <h3 ref={heading} tabIndex={-1}>
                Level {target}
              </h3>
              <div>
                <span>From level {currentLevel}</span>
                <ArrowRight size={20} />
                <span>
                  {effectiveDeadline
                    ? `By ${shortGoalDate(effectiveDeadline)}`
                    : "At your own pace"}
                </span>
              </div>
            </div>
            {effectiveDeadline &&
            arrival &&
            localDateKey(new Date(arrival)) > effectiveDeadline ? (
              <p className={styles.feedback}>
                This is ahead of your recent pace. You can adjust the date
                whenever you need.
              </p>
            ) : null}
            <p className={styles.preview}>
              {arrival
                ? `Estimated arrival · ${shortGoalDate(arrival)}`
                : "We’ll build your estimate as you study."}
            </p>
          </>
        )}
      </motion.div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {!saved ? (
        <footer className={styles.editorFooter}>
          <Button
            tone="ghost"
            onClick={() => (step ? setStep((s) => s - 1) : onClose())}
          >
            {step ? "Back" : "Cancel"}
          </Button>
          <Button
            tone="primary"
            disabled={!valid}
            onClick={() => (step < 2 ? setStep((s) => s + 1) : save())}
          >
            {step === 2
              ? existing
                ? "Update goal"
                : "Create goal"
              : "Continue"}
            <ArrowRight size={16} />
          </Button>
        </footer>
      ) : null}
    </AnalyticsDialog>
  );
}
