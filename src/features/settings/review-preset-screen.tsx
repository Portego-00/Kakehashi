import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import { MAX_REVIEW_PRESETS, REVIEW_PRESET_NAME_MAX_LENGTH, type ReviewPreset } from "../../utils/review-presets";
import { REVIEW_ORDER_OPTIONS, getReviewOrderLabel, type ReviewOrderSetting } from "../../utils/reviewOrdering";

export default function ReviewPresetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const presets = useSettingsStore((state) => state.reviewPresets);
  const initialPreset = presets.find((preset) => preset.id === id);
  const [name, setName] = useState(initialPreset?.name ?? "");
  const [batchSize, setBatchSize] = useState(initialPreset?.batchSize ?? 5);
  const [reviewOrder, setReviewOrder] = useState<ReviewOrderSetting>(initialPreset?.reviewOrder ?? "random");
  const [orderExpanded, setOrderExpanded] = useState(false);
  const [error, setError] = useState("");
  const unavailable = Boolean(id && !presets.some((preset) => preset.id === id));
  const atLimit = !id && presets.length >= MAX_REVIEW_PRESETS;

  const save = () => {
    const current = useSettingsStore.getState();
    if (!name.trim()) { setError("Enter a name for this preset."); return; }
    if (id && !current.reviewPresets.some((preset) => preset.id === id)) { setError("This preset was deleted. Go back to add another."); return; }
    if (!id && current.reviewPresets.length >= MAX_REVIEW_PRESETS) { setError("You can save up to 3 presets."); return; }
    const preset: ReviewPreset = { id: id ?? `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), batchSize, reviewOrder };
    current.setReviewPresets(id ? current.reviewPresets.map((entry) => entry.id === id ? preset : entry) : [...current.reviewPresets, preset]);
    router.back();
  };
  const remove = () => Alert.alert("Delete Preset", `Delete “${name}”?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => {
      const current = useSettingsStore.getState();
      current.setReviewPresets(current.reviewPresets.filter((preset) => preset.id !== id));
      router.back();
    } },
  ]);
  const labelStyle = { color: theme.textColor, fontSize: 14, fontWeight: "600" as const, marginBottom: 8 };
  const fieldStyle = { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 14 };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ backgroundColor: theme.backgroundColor }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
      <Stack.Screen options={{ headerShown: true, title: id ? "Edit Preset" : "Add Preset", headerStyle: { backgroundColor: theme.headerBackground }, headerTintColor: theme.headerText, headerBackButtonDisplayMode: "minimal" }} />
      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Choose the settings for this session preset.</Text>
      <View>
        <Text style={labelStyle}>Preset name</Text>
        <TextInput accessibilityLabel="Preset name" value={name} onChangeText={(value) => { setName(value); setError(""); }} maxLength={REVIEW_PRESET_NAME_MAX_LENGTH} placeholder="e.g. Quick" placeholderTextColor={theme.textSecondary} style={{ ...fieldStyle, color: theme.textColor, fontSize: 16 }} returnKeyType="done" />
      </View>
      <View>
        <Text style={labelStyle}>Batch size</Text>
        <View style={{ ...fieldStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.textColor, fontSize: 15 }}>Reviews per session</Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Decrease preset batch size" disabled={batchSize <= 5} onPress={() => setBatchSize((value) => Math.max(5, value - 5))} style={{ padding: 10, opacity: batchSize <= 5 ? 0.4 : 1 }}><Text style={{ color: theme.textColor, fontSize: 20 }}>−</Text></Pressable>
            <Text selectable style={{ color: theme.textColor, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{batchSize}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Increase preset batch size" disabled={batchSize >= 100} onPress={() => setBatchSize((value) => Math.min(100, value + 5))} style={{ padding: 10, opacity: batchSize >= 100 ? 0.4 : 1 }}><Text style={{ color: theme.textColor, fontSize: 20 }}>+</Text></Pressable>
          </View>
        </View>
      </View>
      <View>
        <Text style={labelStyle}>Review order</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Review order" accessibilityState={{ expanded: orderExpanded }} onPress={() => setOrderExpanded((value) => !value)} style={fieldStyle}><Text style={{ color: theme.textColor, fontSize: 16 }}>{getReviewOrderLabel(reviewOrder)} ▾</Text></Pressable>
        {orderExpanded ? <View style={{ ...fieldStyle, paddingVertical: 4, marginTop: 8 }}>
          {REVIEW_ORDER_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: option.value === reviewOrder }} accessibilityLabel={option.label} onPress={() => { setReviewOrder(option.value); setOrderExpanded(false); }} style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={{ color: theme.primary }}>{option.value === reviewOrder ? "●" : "○"}</Text><Text style={{ color: theme.textColor, fontSize: 15, flex: 1 }}>{option.label}</Text></Pressable>)}
        </View> : null}
      </View>
      {error || unavailable || atLimit ? <Text selectable accessibilityRole="alert" style={{ color: theme.error }}>{error || (unavailable ? "This preset was deleted. Go back to add another." : "You can save up to 3 presets.")}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Save Preset" disabled={unavailable || atLimit} onPress={save} style={{ backgroundColor: theme.primary, borderRadius: 8, padding: 14, alignItems: "center", opacity: unavailable || atLimit ? 0.4 : 1 }}><Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Save Preset</Text></Pressable>
      {id && !unavailable ? <Pressable accessibilityRole="button" accessibilityLabel="Delete Preset" onPress={remove} style={{ padding: 12, alignItems: "center" }}><Text style={{ color: theme.error, fontSize: 16 }}>Delete Preset</Text></Pressable> : null}
    </ScrollView>
  );
}
