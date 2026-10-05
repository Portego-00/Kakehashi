"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
import { Button } from "@/components/ui/Button";
import {
  canAccessLevelGoals,
  createLevelGoal,
  dateAfterDays,
  goalMilestones,
  goalTrackFraction,
  goalOutcome,
  goalPace,
  goalDaysUntil,
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
import { levelGoalDialTicks } from "../../../../src/features/level-goals/dial";
import { useLevelGoals } from "./use-level-goals";
import styles from "./level-goals.module.css";

export function LevelGoalHomeWidget({
  currentLevel,
  paused,
}: {
  currentLevel: number;
  paused: boolean;
}) {
  const { user } = useSession();
  if (!canAccessLevelGoals(user?.data.username)) return null;
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
  const opener = useRef<HTMLElement | null>(null);
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
      initial={false}
      data-outcome={outcome}
    >
      <header className={styles.header}>
        <h2>
          <Flag size={17} aria-hidden />
          Level goal
        </h2>
        {compact && !goal ? (
          <button
            className={styles.iconButton}
            aria-label="Hide goal widget"
            title="Hide from Home"
            onClick={() => goals.update((s) => ({ ...s, widgetHidden: true }))}
          >
            <X size={17} />
          </button>
        ) : !compact && (!goal || goals.state.widgetHidden) ? (
          <button
            className={styles.textButton}
            onClick={() =>
              goals.update((s) => ({ ...s, widgetHidden: !s.widgetHidden }))
            }
          >
            {goals.state.widgetHidden ? "Show on Home" : "Hide from Home"}
          </button>
        ) : null}
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
              <Button
                tone="primary"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setEditor("new");
                }}
              >
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
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setEditor(reached ? "new" : "edit");
                }}
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
              {reached ? (
                <Button
                  tone="ghost"
                  size="small"
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    setEditor("edit");
                  }}
                >
                  Edit goal
                </Button>
              ) : null}
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
              </details>
            ) : null}
          </>
        )}
      </motion.div>
      {goals.error ? (
        <p role="alert" className={styles.error}>
          {goals.error}
        </p>
      ) : null}
      {editor ? (
        <GoalEditor
          key={editor}
          returnFocus={opener}
          currentLevel={currentLevel}
          progressions={progressions}
          existing={editor === "edit" ? goal : null}
          now={goals.now}
          onClose={() => setEditor(null)}
          onRemove={() =>
            goals.update((s) => ({
              ...replaceGoal(s, null, goals.now),
              widgetHidden: true,
            }))
          }
          onSave={(next) =>
            goals.update((s) => ({
              ...replaceGoal(s, next, goals.now),
              widgetHidden: false,
            }))
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
  onRemove,
  returnFocus,
}: {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  existing: LevelGoal | null;
  now: Date;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  onSave: (goal: LevelGoal) => boolean;
  onRemove: () => boolean;
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
  const [confirmRemove, setConfirmRemove] = useState(false);
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
  const dial = (
    <div className={styles.dial}>
      <label className={styles.dialLabel} htmlFor="goal-target-level">
        TARGET LEVEL
      </label>
      <div className={styles.dialFace}>
        <svg viewBox="0 0 240 240" aria-hidden="true">
          {levelGoalDialTicks(currentLevel, target).map(
            ({ level, active, ...points }) => (
              <line key={level} {...points} data-active={active} />
            ),
          )}
        </svg>
        <div className={styles.dialValue}>
          <motion.input
            key={step}
            id="goal-target-level"
            aria-label="Target level"
            type="number"
            min={currentLevel + 1}
            max={60}
            value={target}
            readOnly={step !== 1}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
        </div>
        <small className={styles.dialMin}>{currentLevel + 1}</small>
        <small className={styles.dialMax}>60</small>
      </div>
      <span className={styles.dialDelta}>
        +{target - currentLevel}{" "}
        {target - currentLevel === 1 ? "level" : "levels"} from here
      </span>
    </div>
  );
  return (
    <GoalDialog
      title={
        saved
          ? "Goal set"
          : existing
            ? "Update your goal"
            : "Your next milestone"
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <div className={styles.editor}>
        {!saved ? (
          <div className={styles.steps} aria-label={`Step ${step + 1} of 3`}>
            {["Direction", "Target", "Commit"].map((label, i) => (
              <div
                key={label}
                data-active={i <= step}
                data-current={i === step}
              >
                <i />
                <span>
                  0{i + 1} {label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <motion.div
          className={styles.stage}
          key={saved ? "saved" : step}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={() => heading.current?.focus()}
        >
          <h3 ref={heading} tabIndex={-1}>
            {saved ? (
              `Level ${target}. Let’s get there.`
            ) : step === 0 ? (
              <>
                Make your next
                <br />
                level count.
              </>
            ) : step === 1 ? (
              "Find your finish line."
            ) : (
              "This is your plan."
            )}
          </h3>
          {saved ? (
            <div className={styles.saved}>
              <motion.div
                initial={reduced ? false : { scale: 0.65, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 17 }}
              >
                <Check size={60} strokeWidth={2.5} />
              </motion.div>
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
              <div className={styles.startHero}>
                <div>
                  <span>YOU ARE HERE</span>
                  <strong>Level {currentLevel}</strong>
                </div>
                <div className={styles.heroPath}>
                  <i />
                  <Flag size={30} />
                </div>
              </div>
              <div className={styles.choices}>
                {(
                  [
                    {
                      id: "level",
                      title: "A level",
                      detail: "Go further",
                      icon: Target,
                    },
                    {
                      id: "duration",
                      title: "A timeframe",
                      detail: "Build momentum",
                      icon: History,
                    },
                    {
                      id: "date",
                      title: "A date",
                      detail: "Aim for a day",
                      icon: Flag,
                    },
                  ] as const
                ).map((choice) => (
                  <motion.button
                    type="button"
                    key={choice.id}
                    aria-pressed={mode === choice.id}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
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
                    <span className={styles.choiceIcon}>
                      <choice.icon size={23} />
                    </span>
                    <span>
                      <strong>{choice.title}</strong>
                      <small>{choice.detail}</small>
                    </span>
                    <span
                      className={styles.choiceCheck}
                      data-selected={mode === choice.id}
                    >
                      {mode === choice.id ? <Check size={14} /> : null}
                    </span>
                  </motion.button>
                ))}
              </div>
            </>
          ) : step === 1 ? (
            <>
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
              {mode !== "level" ? (
                <label className={styles.field}>
                  Target date
                  <input
                    type="date"
                    min={dateAfterDays(1, now)}
                    max={
                      mode === "duration" ? dateAfterDays(3650, now) : undefined
                    }
                    value={effectiveDeadline ?? ""}
                    onChange={(event) => {
                      setDeadline(event.target.value);
                      if (mode === "duration")
                        setDuration(
                          goalDaysUntil(event.target.value, now) ?? 0,
                        );
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
                  <Minus size={22} />
                </button>
                {dial}
                <button
                  aria-label="Raise target level"
                  disabled={target >= 60}
                  onClick={() => setTarget((t) => t + 1)}
                >
                  <Plus size={22} />
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
              <div className={styles.pickerPresets}>
                {[
                  ...new Set([
                    currentLevel + 1,
                    suggestedGoalLevel(
                      currentLevel,
                      effectiveDeadline,
                      pace?.typical ?? null,
                      progressions,
                      now,
                    ),
                    Math.min(60, currentLevel + 10),
                  ]),
                ].map((level) => (
                  <button
                    key={level}
                    aria-pressed={level === target}
                    onClick={() => setTarget(level)}
                  >
                    Level {level}
                  </button>
                ))}
              </div>
              <p className={styles.preview}>
                <span>At your recent pace</span>
                <strong>
                  {arrival ? shortGoalDate(arrival) : "Estimate coming soon"}
                </strong>
              </p>
            </>
          ) : (
            <>
              {dial}
              <div className={styles.planTicket}>
                <div>
                  <span>Level {currentLevel}</span>
                  <ArrowRight size={23} />
                  <strong>Level {target}</strong>
                </div>
                <div>
                  <span>{effectiveDeadline ? "TARGET DATE" : "YOUR PACE"}</span>
                  <strong>
                    {effectiveDeadline
                      ? shortGoalDate(effectiveDeadline)
                      : "No deadline"}
                  </strong>
                </div>
              </div>
              {effectiveDeadline &&
              arrival &&
              localDateKey(new Date(arrival)) > effectiveDeadline ? (
                <p className={styles.feedback}>
                  An ambitious stretch at your current pace. You can adjust it
                  anytime.
                </p>
              ) : null}
            </>
          )}
          {existing && !saved && step === 0 ? (
            <div className={styles.removeGoal}>
              {confirmRemove ? (
                <>
                  <p>Remove this goal and its card?</p>
                  <div>
                    <Button
                      tone="ghost"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Keep goal
                    </Button>
                    <Button
                      tone="ghost"
                      onClick={() => {
                        if (onRemove()) onClose();
                        else
                          setError(
                            "Your goal could not be removed. Please try again.",
                          );
                      }}
                    >
                      Remove goal
                    </Button>
                  </div>
                </>
              ) : (
                <Button tone="ghost" onClick={() => setConfirmRemove(true)}>
                  Remove goal
                </Button>
              )}
            </div>
          ) : null}
        </motion.div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
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
    </GoalDialog>
  );
}

function GoalDialog({
  title,
  onClose,
  children,
  returnFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = returnFocus.current ?? document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement)
        previous.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          aria-label="Close goal setup"
          onClick={onClose}
          autoFocus
        >
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
