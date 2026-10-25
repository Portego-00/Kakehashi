import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { createStudyDateFilter, localStudyDate, parseStudyDate, studyDateRange, type StudyDateField, type StudyDateFilter } from "../utils/studyDateFilter";
import { useTheme } from "../utils/theme";

const expandMotion = { duration: 240, easing: Easing.bezier(0.2, 0, 0, 1), reduceMotion: ReduceMotion.System };
const collapseMotion = { ...expandMotion, duration: 180 };

function DateDisclosure({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  const contentHeight = useSharedValue(0);
  const motion = expanded ? expandMotion : collapseMotion;
  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(expanded ? contentHeight.value : 0, motion),
    opacity: withTiming(expanded ? 1 : 0, motion),
  }));

  return <Animated.View
    style={[styles.disclosure, animatedStyle]}
    pointerEvents={expanded ? "auto" : "none"}
    accessibilityElementsHidden={!expanded}
    importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
  >
    <View style={styles.disclosureContent} onLayout={(event) => { contentHeight.value = event.nativeEvent.layout.height; }}>
      {children}
    </View>
  </Animated.View>;
}

export function StudyDateFilterControls({ value, onChange }: { value?: StudyDateFilter | null; onChange: (value: StudyDateFilter | null) => void }) {
  const { theme } = useTheme();
  const [endpoint, setEndpoint] = useState<"from" | "to" | null>(null);
  const [month, setMonth] = useState(() => parseStudyDate(value?.from ?? "") ?? new Date());
  const [jumpToMonth, setJumpToMonth] = useState(false);
  const today = localStudyDate(new Date());
  const range = studyDateRange(value ?? createStudyDateFilter("started_at"));
  const chooseField = (field: StudyDateField | null) => {
    if (!field) {
      setEndpoint(null);
      setJumpToMonth(false);
      onChange(null);
      return;
    }
    onChange({ ...range, field });
  };

  const option = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.option, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}15` : theme.cardBackground }]}>
      <Text style={{ color: active ? theme.primary : theme.textColor, fontSize: 14, fontWeight: active ? "600" : "400" }}>{label}</Text>
    </TouchableOpacity>
  );

  const chooseDate = (date: string) => {
    if (!value || !endpoint) return;
    const next = { ...range, [endpoint]: date };
    if (endpoint === "from" && date > range.to) next.to = date;
    if (endpoint === "to" && date < range.from) next.from = date;
    onChange(next);
    setEndpoint(null);
    setJumpToMonth(false);
  };
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return <View>
    <View style={styles.options}>
      {option("Any date", !value, () => chooseField(null))}
      {option("Lesson completed", value?.field === "started_at", () => chooseField("started_at"))}
      {option("Unlocked", value?.field === "unlocked_at", () => chooseField("unlocked_at"))}
    </View>
    <DateDisclosure expanded={Boolean(value)}>
      <View style={styles.rangeContent}>
        <View style={styles.dateFields}>
          {(["from", "to"] as const).map((key) => {
            const date = parseStudyDate(range[key])!;
            return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`${key === "from" ? "Start" : "End"} date`} accessibilityState={{ expanded: endpoint === key }} onPress={() => { setEndpoint(endpoint === key ? null : key); setMonth(date); setJumpToMonth(false); }} style={[styles.dateField, { borderColor: endpoint === key ? theme.primary : theme.border, backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{key === "from" ? "Start" : "End"}</Text>
              <View style={styles.dateValue}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: theme.textColor, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>{date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Text>
                <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>;
          })}
        </View>
        <DateDisclosure expanded={Boolean(value) && endpoint !== null}>
          <View style={styles.calendarContent}>
            <View style={[styles.calendar, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
              <View style={styles.monthHeader}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={theme.textColor} /></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose month and year" accessibilityState={{ expanded: jumpToMonth }} onPress={() => setJumpToMonth(!jumpToMonth)} style={styles.monthTitle}><Text style={{ color: theme.textColor, fontWeight: "600" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text><Ionicons name={jumpToMonth ? "chevron-up" : "chevron-down"} size={14} color={theme.textSecondary} /></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() >= new Date().getMonth()} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={theme.textSecondary} /></TouchableOpacity>
              </View>
              {jumpToMonth ? <View style={styles.dateFields}>
                <Picker accessibilityLabel="Month" style={[styles.monthPicker, { color: theme.textColor }]} itemStyle={{ color: theme.textColor, fontSize: 16 }} selectedValue={month.getMonth()} onValueChange={(next: number) => setMonth(new Date(month.getFullYear(), next, 1))}>
                  {Array.from({ length: 12 }, (_, index) => <Picker.Item key={index} label={new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" })} value={index} />)}
                </Picker>
                <Picker accessibilityLabel="Year" style={[styles.monthPicker, { color: theme.textColor }]} itemStyle={{ color: theme.textColor, fontSize: 16 }} selectedValue={month.getFullYear()} onValueChange={(next: number) => setMonth(new Date(next, month.getMonth(), 1))}>
                  {Array.from({ length: new Date().getFullYear() - 2011 }, (_, index) => new Date().getFullYear() - index).map((year) => <Picker.Item key={year} label={String(year)} value={year} />)}
                </Picker>
              </View> : null}
              <View style={styles.days}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <View key={`weekday-${index}`} style={styles.cell}><Text style={{ color: theme.textSecondary, fontSize: 12 }}>{day}</Text></View>)}
                {Array.from({ length: cells }, (_, index) => {
                  const day = index - firstWeekday + 1;
                  if (day < 1 || day > daysInMonth) return <View key={index} style={styles.cell} />;
                  const date = new Date(month.getFullYear(), month.getMonth(), day);
                  const key = localStudyDate(date);
                  const selected = key === range.from || key === range.to;
                  const inRange = key >= range.from && key <= range.to;
                  return <TouchableOpacity key={index} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} accessibilityState={{ selected, disabled: key > today }} disabled={key > today} onPress={() => chooseDate(key)} style={[styles.cell, { backgroundColor: selected ? theme.primary : inRange ? `${theme.primary}15` : "transparent", borderRadius: selected ? 8 : 0, opacity: key > today ? 0.3 : 1 }]}><Text style={{ color: selected ? "white" : theme.textColor, fontWeight: selected ? "600" : "400" }}>{day}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
          </View>
        </DateDisclosure>
      </View>
    </DateDisclosure>
  </View>;
}

const styles = StyleSheet.create({
  disclosure: { overflow: "hidden" },
  disclosureContent: { position: "absolute", top: 0, left: 0, right: 0 },
  rangeContent: { paddingTop: 12 },
  calendarContent: { paddingTop: 12 },
  dateValue: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  dateFields: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1, padding: 12, borderWidth: 1, borderRadius: 12, gap: 4 },
  dateLabel: { fontSize: 12, fontWeight: "500" },
  calendar: { borderWidth: 1, borderRadius: 12, padding: 8 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12 },
  arrow: { padding: 12 },
  days: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.285714%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  monthPicker: { flex: 1 },
});
