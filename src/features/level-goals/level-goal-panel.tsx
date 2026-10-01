import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useTheme } from "../../utils/theme";
import * as Haptics from "../../utils/haptics";
import { useLevelGoals } from "./use-level-goals";
import {
  goalMilestones,
  goalTrackFraction,
  goalOutcome,
  goalPace,
  goalStatusLabel,
  localDateKey,
  projectedArrival,
  replaceGoal,
  shortGoalDate,
  suggestedGoalLevel,
  type GoalProgression,
} from "./model";

export function LevelGoalPanel({
  currentLevel,
  progressions,
  paused = false,
}: {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  paused?: boolean;
}) {
  const { theme } = useTheme();
  const focused = useIsFocused();
  const goals = useLevelGoals(currentLevel, progressions);
  const update = goals.update;
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(false);
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
  const visible = goals.allowed && !goals.state.widgetHidden;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(
      goal ? 100 * goalTrackFraction(goal, currentLevel) : 0,
      { duration: reduced ? 0 : 550 },
    );
  }, [goal, currentLevel, fill, reduced]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));
  useEffect(() => {
    if (!focused || !visible || !goal?.reachedAt || goal.celebrated) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    const timer = setTimeout(
      () =>
        update((s) =>
          s.active?.id === goal.id
            ? { ...s, active: { ...s.active, celebrated: true } }
            : s,
        ),
      1800,
    );
    return () => clearTimeout(timer);
  }, [focused, visible, goal?.id, goal?.reachedAt, goal?.celebrated, update]);
  if (!goals.allowed) return null;
  const color = theme.primary;
  const text = { color: theme.textColor };
  const muted = { color: theme.textSecondary };
  const open = (fresh = false) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: "/level-goal",
      params: fresh ? { fresh: "1" } : {},
    });
  };
  const action = (
    label: string,
    onPress: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: primary ? 16 : 0,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: primary ? color : "transparent",
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      })}
    >
      <Text
        style={{
          color: primary ? "#fff" : color,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      {primary ? (
        <Ionicons name="arrow-forward" size={15} color="#fff" />
      ) : null}
    </Pressable>
  );
  if (!visible)
    return (
      <View style={{ marginBottom: 16, alignItems: "flex-start" }}>
        {action("Show level goal", () =>
          goals.update((s) => ({ ...s, widgetHidden: false })),
        )}
      </View>
    );
  return (
    <Animated.View
      layout={reduced ? undefined : LinearTransition.duration(250)}
      entering={reduced ? undefined : FadeInDown.duration(250)}
      exiting={reduced ? undefined : FadeOutUp.duration(160)}
      style={{
        backgroundColor: theme.cardBackground,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        borderCurve: "continuous",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="flag-outline" size={17} color={color} />
          <Text style={{ ...text, fontSize: 16, fontWeight: "700" }}>
            Level goal
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide goal widget"
          hitSlop={8}
          onPress={() => goals.update((s) => ({ ...s, widgetHidden: true }))}
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      {!goal ? (
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ ...text, fontSize: 36, fontWeight: "700" }}>
              {currentLevel}
            </Text>
            <View
              style={{ flex: 1, height: 2, backgroundColor: theme.border }}
            />
            <Ionicons name="flag" size={22} color={color} />
            <Text style={{ color, fontSize: 36, fontWeight: "700" }}>
              {suggestedGoalLevel(
                currentLevel,
                null,
                pace?.typical ?? null,
                progressions,
                goals.now,
              )}
            </Text>
          </View>
          <Text style={{ ...text, fontSize: 20, fontWeight: "700" }}>
            {currentLevel >= 60
              ? "You reached level 60"
              : "Pick your next milestone"}
          </Text>
          {currentLevel < 60
            ? action("Set a goal", () => open(true), true)
            : null}
        </View>
      ) : (
        <Animated.View
          key={`${goal.id}:${outcome}`}
          entering={reduced ? undefined : FadeInDown.duration(220)}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {reached ? (
                  <Animated.View
                    entering={
                      reduced ? undefined : ZoomIn.springify().damping(16)
                    }
                  >
                    <Ionicons name="checkmark-circle" size={18} color={color} />
                  </Animated.View>
                ) : null}
                <Text style={{ ...muted, fontSize: 12 }}>
                  {goalStatusLabel(outcome, paused, behind)}
                </Text>
              </View>
              <Text
                selectable
                style={{
                  ...text,
                  fontSize: 52,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -2,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "500", letterSpacing: 0 }}
                >
                  Level{" "}
                </Text>
                {goal.targetLevel}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4, flex: 1 }}>
              <Text style={{ ...muted, fontSize: 11 }}>
                {reached
                  ? "Reached"
                  : paused
                    ? "Estimate paused"
                    : "Estimated arrival"}
              </Text>
              <Text
                selectable
                style={{ color, fontSize: 22, fontWeight: "700" }}
              >
                {reached
                  ? shortGoalDate(goal.reachedAt)
                  : paused
                    ? "On vacation"
                    : arrival
                      ? shortGoalDate(arrival)
                      : "Learning your pace"}
              </Text>
              <Text selectable style={{ ...muted, fontSize: 11 }}>
                {goal.deadline
                  ? `Target · ${shortGoalDate(goal.deadline)}`
                  : `${Math.max(0, goal.targetLevel - currentLevel)} levels to go`}
              </Text>
            </View>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Levels reached toward your goal"
            accessibilityValue={{
              min: goal.startLevel,
              max: goal.targetLevel,
              now: Math.max(
                goal.startLevel,
                Math.min(currentLevel, goal.targetLevel),
              ),
            }}
            style={{ marginTop: 22, marginBottom: 38 }}
          >
            <View
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                top: 15,
                height: 3,
                backgroundColor: theme.border,
              }}
            >
              <Animated.View
                style={[{ height: 3, backgroundColor: color }, fillStyle]}
              />
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {goalMilestones(goal, currentLevel).map((level) => (
                <View key={level} style={{ width: 32, alignItems: "center" }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor:
                        level === currentLevel ? color : theme.cardBackground,
                      borderWidth: 2,
                      borderColor: level <= currentLevel ? color : theme.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {level === goal.targetLevel ? (
                      <Ionicons
                        name={reached ? "checkmark" : "flag"}
                        size={14}
                        color={level === currentLevel ? "#fff" : color}
                      />
                    ) : (
                      <Text
                        style={{
                          color:
                            level === currentLevel
                              ? "#fff"
                              : level <= currentLevel
                                ? color
                                : theme.textSecondary,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {level}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      ...muted,
                      fontSize: 10,
                      position: "absolute",
                      top: 39,
                    }}
                  >
                    L{level}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {outcome === "missed" || outcome === "late" ? (
            <Text style={{ ...muted, fontSize: 13, marginBottom: 14 }}>
              {outcome === "missed"
                ? "The date passed. Your progress still counts."
                : "A little later, and you made it."}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            {action(
              reached
                ? "Next goal"
                : outcome === "missed"
                  ? "Adjust plan"
                  : "Edit goal",
              () => open(reached),
              true,
              reached && currentLevel >= 60,
            )}
            {action(expanded ? "Close tracker" : "Track journey", () =>
              setExpanded(!expanded),
            )}
          </View>
          {expanded ? (
            <Animated.View
              entering={reduced ? undefined : FadeInDown.duration(200)}
              style={{
                marginTop: 16,
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
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
                const projected = paused
                  ? null
                  : projectedArrival(
                      level,
                      currentLevel,
                      pace?.typical ?? null,
                      progressions,
                      goals.now,
                    );
                return (
                  <View
                    key={level}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Ionicons
                      name={
                        level <= currentLevel
                          ? "checkmark-circle"
                          : "flag-outline"
                      }
                      size={17}
                      color={
                        level <= currentLevel ? color : theme.textSecondary
                      }
                    />
                    <Text
                      style={{
                        ...text,
                        flex: 1,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Level {level}
                    </Text>
                    <Text selectable style={{ ...muted, fontSize: 12 }}>
                      {level <= currentLevel
                        ? recorded
                          ? shortGoalDate(recorded)
                          : "Reached"
                        : projected
                          ? `~ ${shortGoalDate(projected)}`
                          : "Ahead"}
                    </Text>
                  </View>
                );
              })}
              <Text
                style={{
                  ...muted,
                  fontSize: 11,
                  lineHeight: 17,
                  marginTop: 14,
                }}
              >
                {pace
                  ? `Based on your last ${pace.count} completed levels · ${pace.typical.toFixed(1)} days / level.`
                  : "Complete a level to start building your estimate."}{" "}
                Dates can shift with reviews and breaks.
              </Text>
              {action("End this goal", () => {
                goals.update((s) => replaceGoal(s, null, goals.now));
              })}
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
      {goals.state.history.length ? (
        <View
          style={{
            marginTop: 16,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          {action(
            `${history ? "Hide" : "Past"} goals · ${goals.state.history.length}`,
            () => setHistory(!history),
          )}
          {history
            ? goals.state.history.map((entry, i) => (
                <View
                  key={`${entry.goal.id}:${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ ...text, fontSize: 13, fontWeight: "600" }}>
                    Level {entry.goal.targetLevel}
                  </Text>
                  <Text style={{ ...muted, fontSize: 11, flex: 1 }}>
                    {entry.outcome === "changed"
                      ? "Updated"
                      : entry.outcome === "ended"
                        ? "Ended"
                        : goalStatusLabel(entry.outcome)}
                  </Text>
                  <Text selectable style={{ ...muted, fontSize: 11 }}>
                    {shortGoalDate(entry.goal.reachedAt ?? entry.archivedAt)}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
      {goals.error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.error, fontSize: 13, marginTop: 12 }}
        >
          {goals.error}
        </Text>
      ) : null}
    </Animated.View>
  );
}
