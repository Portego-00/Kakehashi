import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import { JLPT_LEVELS, type JLPTLevel } from "../../utils/jlptClassification";
import {
  LEARNING_PAGE_CRITICAL_THRESHOLD,
  LEARNING_PAGE_NAME_MAX_LENGTH,
  LEARNING_PAGE_SRS_GROUPS,
  LEARNING_PAGE_SRS_GROUP_LABELS,
  LEARNING_PAGE_SUBJECT_TYPES,
  LEARNING_PAGE_SUBJECT_TYPE_LABELS,
  MAX_LEARNING_PAGES,
  MAX_SUBJECT_LEVEL,
  MIN_SUBJECT_LEVEL,
  createLearningPageId,
  isLearningPageFilterEmpty,
  normalizeLearningPageFilter,
  type LearningPage,
  type LearningPageSrsGroup,
  type LearningPageSubjectType,
} from "../../utils/learningPages";

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export default function LearningPageScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pages = useSettingsStore((state) => state.learningPages);
  const initialPage = pages.find((page) => page.id === id);
  const [name, setName] = useState(initialPage?.name ?? "");
  const [subjectTypes, setSubjectTypes] = useState<LearningPageSubjectType[]>(
    initialPage?.filter.subjectTypes ?? [],
  );
  const [levelRangeEnabled, setLevelRangeEnabled] = useState(
    initialPage
      ? initialPage.filter.minLevel !== null || initialPage.filter.maxLevel !== null
      : false,
  );
  const [minLevel, setMinLevel] = useState(initialPage?.filter.minLevel ?? MIN_SUBJECT_LEVEL);
  const [maxLevel, setMaxLevel] = useState(initialPage?.filter.maxLevel ?? MAX_SUBJECT_LEVEL);
  const [jlptLevels, setJlptLevels] = useState<JLPTLevel[]>(initialPage?.filter.jlptLevels ?? []);
  const [srsGroups, setSrsGroups] = useState<LearningPageSrsGroup[]>(initialPage?.filter.srsGroups ?? []);
  const [criticalOnly, setCriticalOnly] = useState(initialPage?.filter.criticalOnly ?? false);
  const [error, setError] = useState("");
  const unavailable = Boolean(id && !pages.some((page) => page.id === id));
  const atLimit = !id && pages.length >= MAX_LEARNING_PAGES;

  const save = () => {
    const current = useSettingsStore.getState();
    if (!name.trim()) { setError("Enter a name for this page."); return; }
    if (id && !current.learningPages.some((page) => page.id === id)) { setError("This page was deleted. Go back to add another."); return; }
    if (!id && current.learningPages.length >= MAX_LEARNING_PAGES) { setError(`You can create up to ${MAX_LEARNING_PAGES} pages.`); return; }
    const filter = normalizeLearningPageFilter({
      subjectTypes,
      minLevel: levelRangeEnabled ? minLevel : null,
      maxLevel: levelRangeEnabled ? maxLevel : null,
      jlptLevels,
      srsGroups,
      criticalOnly,
    });
    if (isLearningPageFilterEmpty(filter)) { setError("Choose at least one filter so this page differs from All."); return; }
    const page: LearningPage = { id: id ?? createLearningPageId(), name: name.trim(), filter };
    current.setLearningPages(id ? current.learningPages.map((entry) => entry.id === id ? page : entry) : [...current.learningPages, page]);
    router.back();
  };
  const remove = () => Alert.alert("Delete Page", `Delete “${name}”?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => {
      const current = useSettingsStore.getState();
      current.setLearningPages(current.learningPages.filter((page) => page.id !== id));
      router.back();
    } },
  ]);

  const labelStyle = { color: theme.textColor, fontSize: 14, fontWeight: "600" as const, marginBottom: 8 };
  const hintStyle = { color: theme.textSecondary, fontSize: 13, marginTop: 6 };
  const fieldStyle = { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 14 };
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => { onPress(); setError(""); }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.cardBackground }}
    >
      <Text style={{ color: selected ? "#fff" : theme.textColor, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  const stepper = (label: string, value: number, setValue: (value: number) => void, min: number, max: number) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ color: theme.textColor, fontSize: 15 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onPress={() => setValue(Math.max(min, value - 1))} style={{ padding: 10, opacity: value <= min ? 0.4 : 1 }}><Text style={{ color: theme.textColor, fontSize: 20 }}>−</Text></Pressable>
        <Text selectable style={{ color: theme.textColor, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "center" }}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()}`} disabled={value >= max} onPress={() => setValue(Math.min(max, value + 1))} style={{ padding: 10, opacity: value >= max ? 0.4 : 1 }}><Text style={{ color: theme.textColor, fontSize: 20 }}>+</Text></Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ backgroundColor: theme.backgroundColor }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
      <Stack.Screen options={{ headerShown: true, title: id ? "Edit Page" : "Add Page", headerStyle: { backgroundColor: theme.headerBackground }, headerTintColor: theme.headerText, headerBackButtonDisplayMode: "minimal" }} />
      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
        Home, lessons and reviews on this page include only items matching these filters.
      </Text>
      <View>
        <Text style={labelStyle}>Page name</Text>
        <TextInput accessibilityLabel="Page name" value={name} onChangeText={(value) => { setName(value); setError(""); }} maxLength={LEARNING_PAGE_NAME_MAX_LENGTH} placeholder="e.g. Kanji & Radicals" placeholderTextColor={theme.textSecondary} style={{ ...fieldStyle, color: theme.textColor, fontSize: 16 }} returnKeyType="done" />
      </View>
      <View>
        <Text style={labelStyle}>Item types</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LEARNING_PAGE_SUBJECT_TYPES.map((type) => chip(
            LEARNING_PAGE_SUBJECT_TYPE_LABELS[type],
            subjectTypes.includes(type),
            () => setSubjectTypes((values) => toggleValue(values, type)),
          ))}
        </View>
        <Text style={hintStyle}>Leave all unselected to include every type.</Text>
      </View>
      <View>
        <Text style={labelStyle}>WaniKani levels</Text>
        <View style={{ ...fieldStyle, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.textColor, fontSize: 15 }}>Limit to a level range</Text>
            <Switch accessibilityLabel="Limit to a level range" value={levelRangeEnabled} onValueChange={(value) => { setLevelRangeEnabled(value); setError(""); }} trackColor={{ false: "#767577", true: theme.primary }} thumbColor="#f4f3f4" />
          </View>
          {levelRangeEnabled ? <>
            {stepper("From level", minLevel, (value) => { setMinLevel(value); if (value > maxLevel) setMaxLevel(value); }, MIN_SUBJECT_LEVEL, MAX_SUBJECT_LEVEL)}
            {stepper("To level", maxLevel, (value) => { setMaxLevel(value); if (value < minLevel) setMinLevel(value); }, MIN_SUBJECT_LEVEL, MAX_SUBJECT_LEVEL)}
          </> : null}
        </View>
      </View>
      <View>
        <Text style={labelStyle}>JLPT levels</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {JLPT_LEVELS.map((level) => chip(level, jlptLevels.includes(level), () => setJlptLevels((values) => toggleValue(values, level))))}
        </View>
        <Text style={hintStyle}>Only kanji and vocabulary have JLPT levels, so radicals are excluded when any are selected.</Text>
      </View>
      <View>
        <Text style={labelStyle}>SRS stages</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LEARNING_PAGE_SRS_GROUPS.map((group) => chip(
            LEARNING_PAGE_SRS_GROUP_LABELS[group],
            srsGroups.includes(group),
            () => setSrsGroups((values) => toggleValue(values, group)),
          ))}
        </View>
        <Text style={hintStyle}>Leave all unselected to include every stage. New lessons and burned items are always included.</Text>
      </View>
      <View>
        <View style={{ ...fieldStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textColor, fontSize: 15, fontWeight: "600" }}>Critical items only</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 3 }}>Reviews answered correctly less than {LEARNING_PAGE_CRITICAL_THRESHOLD}% of the time</Text>
          </View>
          <Switch accessibilityLabel="Critical items only" value={criticalOnly} onValueChange={(value) => { setCriticalOnly(value); setError(""); }} trackColor={{ false: "#767577", true: theme.primary }} thumbColor="#f4f3f4" />
        </View>
      </View>
      {error || unavailable || atLimit ? <Text selectable accessibilityRole="alert" style={{ color: theme.error }}>{error || (unavailable ? "This page was deleted. Go back to add another." : `You can create up to ${MAX_LEARNING_PAGES} pages.`)}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Save Page" disabled={unavailable || atLimit} onPress={save} style={{ backgroundColor: theme.primary, borderRadius: 8, padding: 14, alignItems: "center", opacity: unavailable || atLimit ? 0.4 : 1 }}><Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Save Page</Text></Pressable>
      {id && !unavailable ? <Pressable accessibilityRole="button" accessibilityLabel="Delete Page" onPress={remove} style={{ padding: 12, alignItems: "center" }}><Text style={{ color: theme.error, fontSize: 16 }}>Delete Page</Text></Pressable> : null}
    </ScrollView>
  );
}
