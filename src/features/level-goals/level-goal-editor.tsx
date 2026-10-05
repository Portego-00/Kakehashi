import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line } from "react-native-svg";
import Animated, {
  FadeInDown,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../../utils/theme";
import * as Haptics from "../../utils/haptics";
import {
  createLevelGoal,
  dateAfterDays,
  goalPace,
  goalDaysUntil,
  localDateKey,
  projectedArrival,
  shortGoalDate,
  suggestedGoalLevel,
  type GoalMode,
  type GoalProgression,
  type LevelGoal,
} from "./model";
import { levelGoalDialTicks } from "./dial";

export function LevelGoalEditor({
  currentLevel,
  progressions,
  existing,
  now,
  onSave,
  onClose,
  onRemove,
}: {
  currentLevel: number;
  progressions: readonly GoalProgression[];
  existing: LevelGoal | null;
  now: Date;
  onSave: (goal: LevelGoal) => boolean;
  onClose: () => void;
  onRemove?: () => boolean;
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const ruler = useRef<ScrollView>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  useEffect(() => {
    ruler.current?.scrollTo({
      x: Math.max(0, (target - currentLevel - 1) * 46 + 27 - rulerWidth / 2),
      animated: !reduced,
    });
  }, [target, currentLevel, rulerWidth, reduced, step]);
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
        borderRadius: 16,
        backgroundColor: primary ? color : theme.cardBackground,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
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
  const title = saved
    ? `Level ${target}. Let’s get there.`
    : step === 0
      ? "Make your next\nlevel count."
      : step === 1
        ? "Find your finish line."
        : "This is your plan.";
  const targetDial = (
    <View
      style={{
        alignSelf: "center",
        width: 216,
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: muted,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.5,
        }}
      >
        TARGET LEVEL
      </Text>
      <View
        style={{
          width: 200,
          height: 200,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={200}
          height={200}
          viewBox="0 0 240 240"
          style={{ position: "absolute" }}
          accessible={false}
        >
          {levelGoalDialTicks(currentLevel, target).map(
            ({ level, active, ...points }) => (
              <Line
                key={level}
                {...points}
                stroke={active ? color : theme.border}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ),
          )}
        </Svg>

        <Animated.View
          key={target}
          entering={reduced ? undefined : ZoomIn.duration(140)}
        >
          <Text
            accessibilityLabel={`Target level ${target}`}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={{
              color: theme.textColor,
              fontSize: 84,
              lineHeight: 97,
              letterSpacing: 0,
              width: 140,
              paddingHorizontal: 8,
              textAlign: "center",
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {target}
          </Text>
        </Animated.View>

        <Text
          style={{
            position: "absolute",
            bottom: 7,
            left: 30,
            color: muted,
            fontSize: 11,
          }}
        >
          {currentLevel + 1}
        </Text>
        <Text
          style={{
            position: "absolute",
            bottom: 7,
            right: 26,
            color: muted,
            fontSize: 11,
          }}
        >
          60
        </Text>
      </View>
      <Text style={{ color, fontWeight: "600", fontSize: 13 }}>
        +{target - currentLevel}{" "}
        {target - currentLevel === 1 ? "level" : "levels"} from here
      </Text>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 16,
          gap: 16,
        }}
      >
        {!saved ? (
          <View
            accessibilityLabel={`Step ${step + 1} of 3`}
            style={{ flexDirection: "row", gap: 8 }}
          >
            {["Direction", "Target", "Commit"].map((label, i) => (
              <View key={label} style={{ flex: 1, gap: 7 }}>
                <View
                  style={{
                    height: 3,
                    backgroundColor: i <= step ? color : theme.border,
                    borderRadius: 2,
                  }}
                />
                <Text
                  style={{
                    color: i === step ? color : muted,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {`0${i + 1}`} {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Animated.View
          key={saved ? "saved" : step}
          entering={reduced ? undefined : FadeInDown.duration(240)}
          style={{ gap: 16 }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.textColor,
              fontSize: 30,
              lineHeight: 34,
              fontWeight: "800",
              letterSpacing: -1.2,
            }}
          >
            {title}
          </Text>
          {saved ? (
            <View
              style={{ alignItems: "center", gap: 24, paddingVertical: 24 }}
            >
              <Animated.View
                entering={reduced ? undefined : ZoomIn.springify().damping(15)}
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  backgroundColor: color + "18",
                  borderWidth: 2,
                  borderColor: color,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="checkmark" color={color} size={66} />
              </Animated.View>
              <Text style={{ color: muted, fontSize: 16 }}>
                {effectiveDeadline
                  ? `Your target: ${shortGoalDate(effectiveDeadline)}.`
                  : "One level at a time."}
              </Text>
              {button("Keep going", onClose, true)}
            </View>
          ) : step === 0 ? (
            <>
              <View
                style={{
                  backgroundColor: "#14243A",
                  borderRadius: 22,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#A6BEDB",
                      fontSize: 10,
                      lineHeight: 14,
                      width: 52,
                    }}
                  >
                    YOU ARE HERE
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 28,
                      fontWeight: "800",
                      letterSpacing: -1,
                    }}
                  >
                    Level {currentLevel}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", gap: 7, alignItems: "center" }}
                >
                  <View
                    style={{ width: 24, height: 2, backgroundColor: "#7191B8" }}
                  />
                  <Ionicons name="flag" size={30} color="#A3C8FF" />
                </View>
              </View>
              <View style={{ gap: 10 }}>
                {(
                  [
                    {
                      id: "level",
                      title: "A level",
                      detail: "Go further",
                      icon: "locate-outline",
                    },
                    {
                      id: "duration",
                      title: "A timeframe",
                      detail: "Build momentum",
                      icon: "time-outline",
                    },
                    {
                      id: "date",
                      title: "A date",
                      detail: "Aim for a day",
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
                      padding: 12,
                      minHeight: 64,
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: mode === choice.id ? color : theme.border,
                      backgroundColor:
                        mode === choice.id
                          ? color + "0C"
                          : theme.cardBackground,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: color + "15",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={choice.icon} size={23} color={color} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text
                        style={{
                          color: theme.textColor,
                          fontSize: 17,
                          fontWeight: "700",
                        }}
                      >
                        {choice.title}
                      </Text>
                      <Text style={{ color: muted, fontSize: 12 }}>
                        {choice.detail}
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        mode === choice.id
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={23}
                      color={mode === choice.id ? color : theme.border}
                    />
                  </Pressable>
                ))}
              </View>
            </>
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
              {mode !== "level" ? (
                <View>
                  {button(
                    `${mode === "duration" ? "Pick a date" : "Target date"} · ${shortGoalDate(effectiveDeadline!)}`,
                    () => setCalendar(!calendar),
                  )}
                  {calendar ? (
                    <GoalCalendar
                      value={effectiveDeadline!}
                      maxDate={
                        mode === "duration"
                          ? dateAfterDays(3650, now)
                          : undefined
                      }
                      now={now}
                      onChange={(date) => {
                        setDeadline(date);
                        if (mode === "duration") {
                          const days = goalDaysUntil(date, now);
                          if (days) setDuration(days);
                        }
                        chooseTiming(date);
                        setCalendar(false);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
              <View style={{ position: "relative" }}>
                {targetDial}
                <View style={{ position: "absolute", left: 0, top: 90 }}>
                  {button(
                    "−",
                    () => setTarget((t) => t - 1),
                    false,
                    target <= currentLevel + 1,
                    "Lower target level",
                  )}
                </View>
                <View style={{ position: "absolute", right: 0, top: 90 }}>
                  {button(
                    "+",
                    () => setTarget((t) => t + 1),
                    false,
                    target >= 60,
                    "Raise target level",
                  )}
                </View>
              </View>
              <ScrollView
                ref={ruler}
                onLayout={(event) =>
                  setRulerWidth(event.nativeEvent.layout.width)
                }
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 4, paddingHorizontal: 6 }}
                accessibilityLabel="Choose target level"
              >
                {Array.from(
                  { length: 60 - currentLevel },
                  (_, i) => currentLevel + i + 1,
                ).map((level) => (
                  <Pressable
                    key={level}
                    accessibilityRole="button"
                    accessibilityLabel={`Level ${level}`}
                    accessibilityState={{ selected: target === level }}
                    onPress={() => {
                      setTarget(level);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={{
                      width: 42,
                      height: 62,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 10,
                      backgroundColor:
                        level === target ? color + "15" : "transparent",
                    }}
                  >
                    <View
                      style={{
                        height:
                          level === target ? 22 : level % 5 === 0 ? 17 : 10,
                        width: 2,
                        backgroundColor:
                          level === target ? color : theme.border,
                      }}
                    />
                    <Text
                      style={{
                        color: level === target ? color : muted,
                        fontSize: 12,
                        fontWeight: level === target ? "800" : "500",
                      }}
                    >
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                }}
              >
                <Text style={{ color: muted, fontSize: 12 }}>
                  At your recent pace
                </Text>
                <Text
                  style={{
                    color: theme.textColor,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {arrival ? shortGoalDate(arrival) : "Estimate coming soon"}
                </Text>
              </View>
            </>
          ) : (
            <>
              {targetDial}
              <View
                style={{
                  backgroundColor: "#14243A",
                  borderRadius: 22,
                  padding: 22,
                  gap: 22,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#A6BEDB", fontSize: 14 }}>
                    Level {currentLevel}
                  </Text>
                  <Ionicons name="arrow-forward" size={22} color="#A3C8FF" />
                  <Text
                    style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}
                  >
                    Level {target}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: "#34445B" }} />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#A6BEDB", fontSize: 12 }}>
                    {effectiveDeadline ? "TARGET DATE" : "YOUR PACE"}
                  </Text>
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}
                  >
                    {effectiveDeadline
                      ? shortGoalDate(effectiveDeadline)
                      : "No deadline"}
                  </Text>
                </View>
              </View>
              {effectiveDeadline &&
              arrival &&
              localDateKey(new Date(arrival)) > effectiveDeadline ? (
                <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>
                  An ambitious stretch at your current pace. You can adjust it
                  anytime.
                </Text>
              ) : null}
            </>
          )}
          {existing && onRemove && !saved && step === 0 ? (
            <View style={{ gap: 8, marginTop: 16 }}>
              {confirmRemove ? (
                <>
                  <Text style={{ color: muted, fontSize: 13 }}>
                    Remove this goal and its card?
                  </Text>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {button("Keep goal", () => setConfirmRemove(false))}
                    {button("Remove goal", () => {
                      if (onRemove()) onClose();
                      else
                        setError(
                          "Your goal could not be removed. Please try again.",
                        );
                    })}
                  </View>
                </>
              ) : (
                button("Remove goal", () => setConfirmRemove(true))
              )}
            </View>
          ) : null}
        </Animated.View>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: theme.error, fontSize: 14 }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
      {!saved ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            paddingHorizontal: 24,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundColor,
          }}
        >
          {button(step ? "Back" : "Cancel", () =>
            step ? setStep((s) => s - 1) : onClose(),
          )}
          <View style={{ flex: 1 }}>
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
                  (!effectiveDeadline ||
                    effectiveDeadline <= localDateKey(now))),
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function GoalCalendar({
  value,
  now,
  maxDate,
  onChange,
}: {
  value: string;
  now: Date;
  maxDate?: string;
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
          onPress={() => {
            setMonth(
              new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
            );
            Haptics.selectionAsync().catch(() => {});
          }}
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
          onPress={() => {
            setMonth(
              new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
            );
            Haptics.selectionAsync().catch(() => {});
          }}
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
          const disabled =
            date <= localDateKey(now) || (!!maxDate && date > maxDate);
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
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(date);
              }}
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
