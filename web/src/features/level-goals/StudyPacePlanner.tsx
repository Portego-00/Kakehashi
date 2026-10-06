"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  SlidersHorizontal,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { loadWebSettings, saveWebSettings } from "@/features/settings/settings";
import {
  canAccessLevelGoals,
  createLevelGoal,
  dateAfterDays,
  replaceGoal,
  shortGoalDate,
  suggestedGoalLevel,
} from "../../../../src/features/level-goals/model";
import {
  planForLessons,
  planForPace,
  projectStudyWorkload,
  subjectsPerLevel,
  type PlannerAssignment,
  type PlannerSubject,
  type StudyPlan,
} from "../../../../src/features/level-goals/planner";
import { useLevelGoals } from "./use-level-goals";
import styles from "./study-pace-planner.module.css";

type Props = {
  currentLevel: number;
  assignments: readonly PlannerAssignment[];
  subjects: readonly PlannerSubject[];
  loading?: boolean;
  paused?: boolean;
};
export function StudyPacePlanner(props: Props) {
  const { user } = useSession();
  const settings = useWebSettings(user?.data.username ?? "");
  const [open, setOpen] = useState(false);
  if (
    !canAccessLevelGoals(user?.data.username) ||
    settings.workspace.studyPacePlannerEnabled !== true
  )
    return null;
  return (
    <div className={styles.planner}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="study-pace-planner"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={17} />
        <span>Plan your pace</span>
        <ChevronDown size={16} data-open={open} />
      </button>
      {open ? (
        props.loading ? (
          <p className={styles.note}>Loading your study data…</p>
        ) : (
          <PlanEditor {...props} username={user!.data.username} />
        )
      ) : null}
    </div>
  );
}
function PlanEditor({
  currentLevel,
  assignments,
  subjects,
  loading = false,
  paused = false,
  username,
}: Props & { username: string }) {
  const goals = useLevelGoals();
  const settings = useWebSettings(username);
  const count = subjectsPerLevel(subjects, currentLevel);
  const [plan, setPlan] = useState<StudyPlan>(
    () =>
      goals.state.studyPlan ??
      planForLessons(
        {
          daysPerLevel: 7,
          dailyLessons: 20,
          reviewBatch: settings.study.reviewBatchSize,
        },
        settings.study.dailyLessonLimit || 20,
        count,
      ),
  );
  const [applied, setApplied] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();
  const days = useMemo(
    () =>
      projectStudyWorkload(
        assignments,
        subjects,
        plan,
        currentLevel,
        goals.now,
        paused,
      ),
    [assignments, subjects, plan, currentLevel, goals.now, paused],
  );
  const dailyReviews = Math.ceil(
    days.slice(0, 7).reduce((sum, day) => sum + day.total, 0) / 7,
  );
  const peak = Math.max(1, ...days.map((day) => day.total));
  const target =
    goals.state.active && goals.state.active.targetLevel > currentLevel
      ? goals.state.active.targetLevel
      : suggestedGoalLevel(currentLevel, null, null, [], goals.now);
  const deadline = dateAfterDays(
    Math.max(1, target - currentLevel) * plan.daysPerLevel,
    goals.now,
  );
  const change = (next: StudyPlan) => {
    setPlan(next);
    setApplied(false);
    setGoalSaved(false);
    setError("");
  };
  const apply = () => {
    const previous = goals.state.studyPlan;
    if (!goals.update((state) => ({ ...state, studyPlan: plan }))) return;
    try {
      const latest = loadWebSettings(window.localStorage, username);
      saveWebSettings(window.localStorage, username, {
        ...latest,
        study: {
          ...latest.study,
          dailyLessonLimit: plan.dailyLessons,
          reviewBatchSizeEnabled: true,
          reviewBatchSize: plan.reviewBatch,
        },
      });
      setApplied(true);
    } catch {
      goals.update((state) => ({ ...state, studyPlan: previous }));
      setError("Your study settings could not be saved. Please try again.");
    }
  };
  const useDate = () => {
    const goal = createLevelGoal(
      {
        id: crypto.randomUUID(),
        mode: "date",
        currentLevel,
        targetLevel: target,
        deadline,
      },
      goals.now,
    );
    if (
      goals.update((state) => ({
        ...replaceGoal(state, goal, goals.now),
        widgetHidden: false,
        studyPlan: plan,
      }))
    )
      setGoalSaved(true);
  };
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    text: string,
    update: (value: number) => void,
    disabled = false,
  ) => (
    <label className={styles.control}>
      <span>
        {label}
        <strong>{text}</strong>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled || loading || paused}
        onChange={(event) => update(Number(event.target.value))}
      />
    </label>
  );
  return (
    <motion.div
      id="study-pace-planner"
      className={styles.body}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
    >
      {paused ? (
        <p className={styles.note}>
          Planning is paused while you’re on vacation.
        </p>
      ) : null}
      <div className={styles.heading}>
        <div>
          <span>Target pace</span>
          <strong>
            {plan.daysPerLevel}
            <small> days / level</small>
          </strong>
        </div>
        {currentLevel < 60 ? (
          <div className={styles.destination}>
            <span>Level {target} · target date</span>
            <strong>{shortGoalDate(deadline)}</strong>
          </div>
        ) : null}
      </div>
      <div className={styles.presets} role="group" aria-label="Pace shortcuts">
        {[7, 14, 30].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={plan.daysPerLevel === value}
            disabled={!count || loading || paused || currentLevel >= 60}
            onClick={() => change(planForPace(plan, value, count))}
          >
            {value === 7 ? "A week" : value === 14 ? "Two weeks" : "A month"}
          </button>
        ))}
      </div>
      {range(
        "Days per level",
        plan.daysPerLevel,
        3,
        Math.max(60, plan.daysPerLevel),
        1,
        `${plan.daysPerLevel} days`,
        (value) => change(planForPace(plan, value, count)),
        !count || currentLevel >= 60,
      )}
      {range(
        "Daily lessons",
        plan.dailyLessons,
        1,
        50,
        1,
        `${plan.dailyLessons} / day`,
        (value) => change(planForLessons(plan, value, count)),
      )}
      {range(
        "Reviews per session",
        plan.reviewBatch,
        5,
        100,
        5,
        `${plan.reviewBatch} items`,
        (value) => change({ ...plan, reviewBatch: value }),
      )}
      {!count ? (
        <p className={styles.note}>
          {loading
            ? "Loading your level subjects…"
            : "Level subjects are unavailable. Workload preview is still available; linked pace needs your catalog."}
        </p>
      ) : (
        <p className={styles.note}>
          About {count} subjects / level ·{" "}
          {Math.ceil(count / plan.dailyLessons)} days to cover at this lesson
          pace.
        </p>
      )}
      <div className={styles.workload} aria-live="polite">
        <strong>
          ~{dailyReviews}
          <small> reviews / day</small>
        </strong>
        <span>
          ~{Math.ceil(dailyReviews / plan.reviewBatch)} sessions · next 7 days
        </span>
      </div>
      <ol
        className={styles.chart}
        aria-label="Estimated review workload for 14 days"
      >
        {days.map((day, i) => (
          <li
            key={day.date}
            aria-label={`${shortGoalDate(day.date)}: ${day.total} estimated reviews, ${day.known} already scheduled`}
          >
            <div>
              <motion.i
                className={styles.existing}
                animate={{ height: `${(day.existing / peak) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              />
              <motion.i
                className={styles.newLessons}
                animate={{ height: `${(day.lessons / peak) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              />
            </div>
            <span>
              {i === 0 ? "Today" : i === 6 ? "7d" : i === 13 ? "14d" : ""}
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.legend}>
        <span>
          <i />
          Existing items
        </span>
        <span>
          <i />
          New lessons
        </span>
        <small>Peak {Math.max(...days.map((day) => day.total))}</small>
      </div>
      <details className={styles.method}>
        <summary>How estimates work</summary>
        <p>
          Assumes correct, on-time reviews and enough unlocked lessons each day.
          Unlocks and accuracy can change your level-up date. Smaller sessions
          split due reviews; they don’t make them arrive sooner. Your actual
          Review forecast stays above.
        </p>
      </details>
      <footer className={styles.actions}>
        <Button tone="primary" disabled={loading || paused} onClick={apply}>
          {applied ? (
            <>
              <Check size={16} />
              Plan applied
            </>
          ) : (
            <>
              Apply daily plan <ArrowRight size={16} />
            </>
          )}
        </Button>
        {currentLevel < 60 ? (
          <button
            type="button"
            className={styles.dateAction}
            disabled={paused || loading || !count}
            onClick={useDate}
          >
            {goalSaved ? "Goal date updated" : "Use date for my goal"}
          </button>
        ) : (
          <ButtonLink href="/progress#level-goal" tone="ghost">
            Your level journey
          </ButtonLink>
        )}
      </footer>
      <p className={styles.note}>
        Apply sets your daily lesson limit and review session size.
      </p>
      {goals.error || error ? (
        <p role="alert" className={styles.error}>
          {error || goals.error}
        </p>
      ) : null}
    </motion.div>
  );
}
