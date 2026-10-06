import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useAuthStore, useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import * as Haptics from "../../utils/haptics";
import {
  canAccessLevelGoals,
  createLevelGoal,
  dateAfterDays,
  replaceGoal,
  shortGoalDate,
  suggestedGoalLevel,
} from "./model";
import {
  planForLessons,
  planForPace,
  projectStudyWorkload,
  subjectsPerLevel,
  type PlannerAssignment,
  type PlannerSubject,
  type StudyPlan,
} from "./planner";
import { useLevelGoals } from "./use-level-goals";

type Props = {
  currentLevel: number;
  assignments: readonly PlannerAssignment[];
  subjects: readonly PlannerSubject[];
  loading?: boolean;
  paused?: boolean;
};

export function StudyPacePlanner(props: Props) {
  const username = useAuthStore((state) => state.userData?.username);
  const enabled = useSettingsStore(
    (state) => state.homeStudyPacePlannerEnabled,
  );
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  if (!canAccessLevelGoals(username) || enabled !== true) return null;
  return (
    <View style={[styles.planner, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan your pace"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
          void Haptics.selectionAsync();
        }}
        style={styles.toggle}
      >
        <Ionicons name="options-outline" size={18} color={theme.primary} />
        <Text style={[styles.toggleText, { color: theme.textColor }]}>
          Plan your pace
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {open ? (
        props.loading ? (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Loading your study data…
          </Text>
        ) : (
          <PlanEditor {...props} />
        )
      ) : null}
    </View>
  );
}

export function StudyPacePlannerSetting() {
  const username = useAuthStore((state) => state.userData?.username);
  const enabled = useSettingsStore(
    (state) => state.homeStudyPacePlannerEnabled,
  );
  const setEnabled = useSettingsStore(
    (state) => state.setHomeStudyPacePlannerEnabled,
  );
  const { theme } = useTheme();
  if (!canAccessLevelGoals(username)) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ color: theme.textColor, fontSize: 14, fontWeight: "600" }}
        >
          Plan your pace
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          Show the pace planner inside Review forecast.
        </Text>
      </View>
      <Switch
        accessibilityLabel="Plan your pace"
        value={enabled === true}
        onValueChange={setEnabled}
        trackColor={{ true: theme.primary }}
      />
    </View>
  );
}

function PlanEditor({
  currentLevel,
  assignments,
  subjects,
  loading = false,
  paused = false,
}: Props) {
  const goals = useLevelGoals();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const lessonLimit = useSettingsStore((state) => state.dailyLessonLimit);
  const batchSize = useSettingsStore((state) => state.reviewBatchSize);
  const count = subjectsPerLevel(subjects, currentLevel);
  const [plan, setPlan] = useState<StudyPlan>(
    () =>
      goals.state.studyPlan ??
      planForLessons(
        { daysPerLevel: 7, dailyLessons: 20, reviewBatch: batchSize },
        lessonLimit || 20,
        count,
      ),
  );
  const [applied, setApplied] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [method, setMethod] = useState(false);
  const [error, setError] = useState("");
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
      // One persisted update keeps the linked settings together.
      useSettingsStore.setState({
        dailyLessonLimit: plan.dailyLessons,
        reviewBatchSizeEnabled: true,
        reviewBatchSize: plan.reviewBatch,
      });
      setApplied(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      goals.update((state) => ({ ...state, studyPlan: previous }));
      setError("Your study settings could not be saved. Please try again.");
    }
  };
  const useDate = () => {
    const goal = createLevelGoal(
      {
        id: `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    ) {
      setGoalSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  const note = { color: theme.textSecondary };
  const control = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    text: string,
    update: (value: number) => void,
    unavailable = false,
  ) => (
    <View style={styles.control}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textColor }]}>{label}</Text>
        <Text style={[styles.amount, { color: theme.primary }]}>{text}</Text>
      </View>
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={unavailable || loading || paused}
        onValueChange={update}
        onSlidingComplete={() => void Haptics.selectionAsync()}
        minimumTrackTintColor={theme.primary}
        maximumTrackTintColor={theme.border}
        thumbTintColor={theme.primary}
      />
    </View>
  );
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(200)}
      style={styles.body}
    >
      {paused ? (
        <Text style={[styles.note, note]}>
          Planning is paused while you’re on vacation.
        </Text>
      ) : null}
      <View style={styles.row}>
        <View>
          <Text style={[styles.note, note]}>Target pace</Text>
          <Text style={[styles.pace, { color: theme.textColor }]}>
            {plan.daysPerLevel}
            <Text style={styles.unit}> days / level</Text>
          </Text>
        </View>
        {currentLevel < 60 ? (
          <View style={styles.destination}>
            <Text style={[styles.note, note]}>
              Level {target} · target date
            </Text>
            <Text style={[styles.amount, { color: theme.textColor }]}>
              {shortGoalDate(deadline)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.presets}>
        {[7, 14, 30].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{
              selected: plan.daysPerLevel === value,
              disabled: !count || loading || paused || currentLevel >= 60,
            }}
            disabled={!count || loading || paused || currentLevel >= 60}
            onPress={() => {
              change(planForPace(plan, value, count));
              void Haptics.selectionAsync();
            }}
            style={[
              styles.preset,
              {
                borderColor:
                  plan.daysPerLevel === value ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color:
                  plan.daysPerLevel === value
                    ? theme.primary
                    : theme.textSecondary,
              }}
            >
              {value === 7 ? "A week" : value === 14 ? "Two weeks" : "A month"}
            </Text>
          </Pressable>
        ))}
      </View>
      {control(
        "Days per level",
        plan.daysPerLevel,
        3,
        Math.max(60, plan.daysPerLevel),
        1,
        `${plan.daysPerLevel} days`,
        (value) => change(planForPace(plan, value, count)),
        !count || currentLevel >= 60,
      )}
      {control(
        "Daily lessons",
        plan.dailyLessons,
        1,
        50,
        1,
        `${plan.dailyLessons} / day`,
        (value) => change(planForLessons(plan, value, count)),
      )}
      {control(
        "Reviews per session",
        plan.reviewBatch,
        5,
        100,
        5,
        `${plan.reviewBatch} items`,
        (value) => change({ ...plan, reviewBatch: value }),
      )}
      <Text style={[styles.note, note]}>
        {count
          ? `About ${count} subjects / level · ${Math.ceil(count / plan.dailyLessons)} days to cover at this lesson pace.`
          : loading
            ? "Loading your level subjects…"
            : "Level subjects are unavailable. Workload preview is still available; linked pace needs your catalog."}
      </Text>
      <View accessibilityLiveRegion="polite">
        <Text
          testID="planner-workload"
          style={[styles.workload, { color: theme.textColor }]}
        >
          ~{dailyReviews}
          <Text style={styles.unit}> reviews / day</Text>
        </Text>
        <Text style={[styles.note, note]}>
          ~{Math.ceil(dailyReviews / plan.reviewBatch)} sessions · next 7 days
        </Text>
      </View>
      <View style={styles.chart}>
        {days.map((day, i) => (
          <View
            key={day.date}
            accessible
            accessibilityLabel={`${shortGoalDate(day.date)}: ${day.total} estimated reviews, ${day.known} already scheduled`}
            style={styles.column}
          >
            <View style={styles.bar}>
              <View
                style={{
                  height: (day.existing / peak) * 80,
                  backgroundColor: theme.primary,
                  width: "100%",
                }}
              />
              <View
                style={{
                  height: (day.lessons / peak) * 80,
                  backgroundColor: theme.textSecondary,
                  opacity: 0.4,
                  width: "100%",
                }}
              />
            </View>
            <Text style={[styles.axis, note]}>
              {i === 0 ? "Today" : i === 6 ? "7d" : i === 13 ? "14d" : ""}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.note, { color: theme.primary }]}>
          Existing items
        </Text>
        <Text style={[styles.note, note]}>New lessons</Text>
        <Text style={[styles.note, note]}>
          Peak {Math.max(...days.map((day) => day.total))}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: method }}
        onPress={() => setMethod((value) => !value)}
        style={styles.method}
      >
        <Text style={[styles.note, note]}>
          How estimates work {method ? "−" : "+"}
        </Text>
      </Pressable>
      {method ? (
        <Text style={[styles.note, note]}>
          Assumes correct, on-time reviews and enough unlocked lessons each day.
          Unlocks and accuracy can change your level-up date. Smaller sessions
          split due reviews; they don’t make them arrive sooner. Your actual
          Review forecast stays above.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={loading || paused}
        accessibilityState={{ disabled: loading || paused }}
        onPress={apply}
        style={[
          styles.apply,
          {
            backgroundColor: theme.primary,
            opacity: loading || paused ? 0.5 : 1,
          },
        ]}
      >
        <Text style={styles.applyText}>
          {applied ? "Plan applied ✓" : "Apply daily plan →"}
        </Text>
      </Pressable>
      {currentLevel < 60 ? (
        <Pressable
          accessibilityRole="button"
          disabled={loading || paused || !count}
          accessibilityState={{ disabled: loading || paused || !count }}
          onPress={useDate}
          style={styles.dateAction}
        >
          <Text style={{ color: theme.primary }}>
            {goalSaved ? "Goal date updated" : "Use date for my goal"}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.note, note]}>
        Apply sets your daily lesson limit and review session size.
      </Text>
      {goals.error || error ? (
        <Text accessibilityRole="alert" style={{ color: theme.error }}>
          {error || goals.error}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  planner: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    paddingTop: 4,
  },
  toggle: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minHeight: 48,
  },
  toggleText: { flex: 1, fontSize: 15, fontWeight: "600" },
  body: { gap: 12, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  destination: { alignItems: "flex-end", gap: 6 },
  pace: { fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 12, fontWeight: "500" },
  note: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 13 },
  amount: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  presets: { flexDirection: "row", gap: 8 },
  preset: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  control: { gap: 6 },
  workload: { fontSize: 25, fontWeight: "700", fontVariant: ["tabular-nums"] },
  chart: { flexDirection: "row", gap: 4 },
  column: { flex: 1, alignItems: "center" },
  bar: { height: 80, width: "100%", justifyContent: "flex-end" },
  axis: { fontSize: 8, minHeight: 16, marginTop: 4 },
  legend: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  method: { minHeight: 32, justifyContent: "center" },
  apply: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  dateAction: { minHeight: 36, justifyContent: "center", alignItems: "center" },
});
