import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../../utils/theme";
import * as Haptics from "../../utils/haptics";
import {
  createLevelGoal,
  dateAfterDays,
  goalPace,
  localDateKey,
  projectedArrival,
  shortGoalDate,
  suggestedGoalLevel,
  type GoalMode,
  type GoalProgression,
  type LevelGoal,
} from "./model";

export function LevelGoalEditor({
  currentLevel,
  progressions,
  existing,
  now,
  onSave,
  onClose,
}: {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  existing: LevelGoal | null;
  now: Date;
  onSave: (goal: LevelGoal) => boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [calendar, setCalendar] = useState(false);
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
          id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
          mode,
          currentLevel,
          targetLevel: target,
          deadline,
          durationDays: duration,
        },
        now,
      );
      if (onSave(goal)) {
        setSaved(true);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else setError("Your goal could not be saved. Please try again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check your goal.");
    }
  };
  const color = theme.primary;
  const muted = theme.textSecondary;
  const button = (
    label: string,
    onPress: () => void,
    primary = false,
    disabled = false,
    accessibilityLabel = label,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: primary ? color : theme.cardBackground,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      <Text
        style={{
          color: primary ? "#fff" : muted,
          fontWeight: "600",
          fontSize: 15,
        }}
      >
        {label}
      </Text>
      {primary ? (
        <Ionicons name="arrow-forward" size={17} color="#fff" />
      ) : null}
    </Pressable>
  );
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 50 }}
    >
      {!saved ? (
        <View
          accessibilityLabel={`Step ${step + 1} of 3`}
          style={{ flexDirection: "row", gap: 6 }}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= step ? color : theme.border,
              }}
            />
          ))}
        </View>
      ) : null}
      <Animated.View
        key={saved ? "saved" : step}
        entering={reduced ? undefined : FadeInDown.duration(220)}
        style={{ gap: 22 }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.textColor,
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: -0.5,
          }}
        >
          {saved
            ? `Level ${target}. Let’s get there.`
            : step === 0
              ? "What are you aiming for?"
              : step === 1
                ? mode === "level"
                  ? "Choose your level"
                  : mode === "duration"
                    ? "How much time?"
                    : "Pick your target date"
                : "Your next milestone"}
        </Text>
        {saved ? (
          <View style={{ alignItems: "center", gap: 24, paddingVertical: 30 }}>
            <Ionicons name="checkmark-circle" color={color} size={80} />
            <Text style={{ color: muted, fontSize: 16 }}>
              {effectiveDeadline
                ? `Your target: ${shortGoalDate(effectiveDeadline)}.`
                : "One level at a time."}
            </Text>
            {button("Keep going", onClose, true)}
          </View>
        ) : step === 0 ? (
          <View style={{ gap: 12 }}>
            {(
              [
                {
                  id: "level",
                  title: "A level",
                  detail: "Choose your next milestone",
                  icon: "locate-outline",
                },
                {
                  id: "duration",
                  title: "A timeframe",
                  detail: "The next few weeks or months",
                  icon: "time-outline",
                },
                {
                  id: "date",
                  title: "A date",
                  detail: "Give your goal a finish line",
                  icon: "flag-outline",
                },
              ] as const
            ).map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === choice.id }}
                onPress={() => {
                  setMode(choice.id);
                  if (choice.id !== "level")
                    chooseTiming(
                      choice.id === "date"
                        ? deadline
                        : dateAfterDays(duration, now),
                    );
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 18,
                  minHeight: 82,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: mode === choice.id ? color : theme.border,
                  backgroundColor: theme.cardBackground,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name={choice.icon} size={24} color={color} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      color: theme.textColor,
                      fontSize: 17,
                      fontWeight: "600",
                    }}
                  >
                    {choice.title}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    {choice.detail}
                  </Text>
                </View>
                <Ionicons
                  name={mode === choice.id ? "checkmark" : "arrow-forward"}
                  size={18}
                  color={color}
                />
              </Pressable>
            ))}
          </View>
        ) : step === 1 ? (
          <>
            {mode === "duration" ? (
              <View
                accessibilityLabel="Goal timeframe"
                style={{ flexDirection: "row", gap: 8 }}
              >
                {[14, 30, 90].map((days) => (
                  <View key={days} style={{ flex: 1 }}>
                    {button(
                      days === 14
                        ? "2 weeks"
                        : days === 30
                          ? "1 month"
                          : "3 months",
                      () => {
                        setDuration(days);
                        chooseTiming(dateAfterDays(days, now));
                      },
                      duration === days,
                    )}
                  </View>
                ))}
              </View>
            ) : null}
            {mode === "date" ? (
              <View>
                {button(`Target date · ${shortGoalDate(deadline)}`, () =>
                  setCalendar(!calendar),
                )}
                {calendar ? (
                  <GoalCalendar
                    value={deadline}
                    now={now}
                    onChange={(date) => {
                      setDeadline(date);
                      chooseTiming(date);
                      setCalendar(false);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <View>
                {button(
                  "−",
                  () => setTarget((t) => t - 1),
                  false,
                  target <= currentLevel + 1,
                  "Lower target level",
                )}
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: muted, fontSize: 12 }}>Target level</Text>
                <Text
                  selectable
                  style={{
                    color: theme.textColor,
                    fontSize: 82,
                    fontWeight: "800",
                    letterSpacing: -3,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {target}
                </Text>
              </View>
              <View>
                {button(
                  "+",
                  () => setTarget((t) => t + 1),
                  false,
                  target >= 60,
                  "Raise target level",
                )}
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8,
              }}
            >
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
              ]
                .filter((level) => level <= 60)
                .map((level) => (
                  <View key={level}>
                    {button(
                      `Level ${level}`,
                      () => setTarget(level),
                      target === level,
                    )}
                  </View>
                ))}
            </View>
            <Text style={{ color: muted, textAlign: "center", fontSize: 14 }}>
              {arrival
                ? `Your pace puts you here around ${shortGoalDate(arrival)}.`
                : "Your estimate will grow with your level history."}
            </Text>
          </>
        ) : (
          <View style={{ alignItems: "center", gap: 22, paddingVertical: 20 }}>
            <Ionicons name="flag" size={36} color={color} />
            <Text
              selectable
              style={{
                color: theme.textColor,
                fontSize: 64,
                fontWeight: "800",
                letterSpacing: -2,
              }}
            >
              Level {target}
            </Text>
            <Text selectable style={{ color: muted, fontSize: 15 }}>
              From level {currentLevel} →{" "}
              {effectiveDeadline
                ? `By ${shortGoalDate(effectiveDeadline)}`
                : "At your own pace"}
            </Text>
            <Text style={{ color: muted, fontSize: 13 }}>
              {arrival
                ? `Estimated arrival · ${shortGoalDate(arrival)}`
                : "We’ll build your estimate as you study."}
            </Text>
            {effectiveDeadline &&
            arrival &&
            localDateKey(new Date(arrival)) > effectiveDeadline ? (
              <Text
                style={{
                  color: muted,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: "center",
                }}
              >
                This is ahead of your recent pace. You can adjust the date
                whenever you need.
              </Text>
            ) : null}
          </View>
        )}
      </Animated.View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.error, fontSize: 14 }}
        >
          {error}
        </Text>
      ) : null}
      {!saved ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {button(step ? "Back" : "Cancel", () =>
            step ? setStep((s) => s - 1) : onClose(),
          )}
          {button(
            step === 2
              ? existing
                ? "Update goal"
                : "Create goal"
              : "Continue",
            () => (step < 2 ? setStep((s) => s + 1) : save()),
            true,
            target <= currentLevel ||
              target > 60 ||
              (mode !== "level" &&
                (!effectiveDeadline || effectiveDeadline <= localDateKey(now))),
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function GoalCalendar({
  value,
  now,
  onChange,
}: {
  value: string;
  now: Date;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [month, setMonth] = useState(() => new Date(`${value}T12:00:00`));
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const offset = (first.getDay() + 6) % 7;
  return (
    <View style={{ paddingTop: 16, gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))
          }
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
        </Pressable>
        <Text style={{ color: theme.textColor, fontWeight: "600" }}>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))
          }
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <Text
            key={i}
            style={{
              width: "14.285%",
              textAlign: "center",
              color: theme.textSecondary,
              fontSize: 11,
            }}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: offset + count }, (_, index) => {
          if (index < offset)
            return (
              <View key={index} style={{ width: "14.285%", height: 44 }} />
            );
          const date = localDateKey(
            new Date(
              month.getFullYear(),
              month.getMonth(),
              index - offset + 1,
              12,
            ),
          );
          const disabled = date <= localDateKey(now);
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={new Date(
                `${date}T12:00:00`,
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              accessibilityState={{ selected: date === value, disabled }}
              disabled={disabled}
              onPress={() => onChange(date)}
              style={{
                width: "14.285%",
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: date === value ? theme.primary : "transparent",
                borderRadius: 8,
                opacity: disabled ? 0.3 : 1,
              }}
            >
              <Text
                style={{
                  color: date === value ? "#fff" : theme.textColor,
                  fontSize: 14,
                }}
              >
                {index - offset + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
