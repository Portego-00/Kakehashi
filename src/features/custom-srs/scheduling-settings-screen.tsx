import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { randomUUID } from "expo-crypto";
import { Stack } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customSrsSettingsError, DEFAULT_CUSTOM_SRS_SETTINGS, settingsForPolicy, settingsRevision, stepMinutes } from "../../../web/src/features/custom-srs/srs-settings";
import { useTheme } from "../../utils/theme";
import CustomVocabularyHeader from "./custom-vocabulary-header";
import { useCustomSrs } from "./data";
import { VocabularyButton, VocabularyField, VocabularyMessage } from "./native-controls";
import { goBackFromCustomVocabulary } from "./navigation";
import type { CustomSrsSettings } from "./types";

const STAGES = ["Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened"];
const duration = (minutes: number) => minutes % 1440 === 0 ? `${minutes / 1440}d` : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
function draftFrom(settings: CustomSrsSettings) {
  return { mode: settings.mode, stageIntervals: settings.stageIntervals.map(duration), learningSteps: settings.learningSteps.join(", "), relearningSteps: settings.relearningSteps.join(", "), requestRetention: String(Math.round(settings.requestRetention * 100)), maximumInterval: String(settings.maximumInterval), roundToHour: settings.roundToHour };
}
type Draft = ReturnType<typeof draftFrom>;
function parseDraft(draft: Draft): CustomSrsSettings {
  return { ...draft, stageIntervals: draft.stageIntervals.map((value) => stepMinutes(value.trim())), learningSteps: draft.learningSteps.split(/[\s,]+/).filter(Boolean), relearningSteps: draft.relearningSteps.split(/[\s,]+/).filter(Boolean), requestRetention: Number(draft.requestRetention) / 100, maximumInterval: Number(draft.maximumInterval) };
}

export default function SchedulingSettingsScreen() {
  const srs = useCustomSrs();
  return <SchedulingSettingsAccount key={srs.accountId} srs={srs} />;
}

function SchedulingSettingsAccount({ srs }: { srs: ReturnType<typeof useCustomSrs> }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<{ draft: Draft; revision: number; eventId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const policy = srs.state.policy;
  const draft = editing?.draft ?? draftFrom(settingsForPolicy(policy));
  const settings = parseDraft(draft);
  const validation = customSrsSettingsError(settings);
  const stale = editing !== null && editing.revision !== settingsRevision(policy);
  const blocked = srs.loading || srs.syncing || srs.pendingCount > 0 || Boolean(srs.error);
  const change = (patch: Partial<Draft>) => {
    setEditing({ draft: { ...draft, ...patch }, revision: editing?.revision ?? settingsRevision(policy), eventId: randomUUID() });
    setError(""); setNotice("");
  };
  const reload = async () => {
    setSaving(true); setError("");
    try { await srs.refresh(); setEditing(null); setNotice("Loaded your saved schedule."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reload your schedule."); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (!editing || validation || stale || blocked || saving) return;
    setSaving(true); setError(""); setNotice("");
    try { await srs.saveSettings(settings, editing.revision, editing.eventId); setEditing(null); setNotice("Schedule saved to your account. Existing due dates are unchanged."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your schedule could not be saved. Your edits are still here."); }
    finally { setSaving(false); }
  };
  return <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
    <Stack.Screen options={{ title: "Scheduling settings", headerShown: false }} />
    <CustomVocabularyHeader title="Scheduling settings" onBack={() => goBackFromCustomVocabulary()} />
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 18 }}>
      <VocabularyMessage>One schedule for your custom vocabulary across all packs, personal decks, web, and mobile. Your WaniKani reviews keep their own schedule.</VocabularyMessage>
      {srs.loading ? <VocabularyMessage>Loading your saved schedule…</VocabularyMessage> : null}
      {srs.error ? <><VocabularyMessage error>{srs.error}</VocabularyMessage><VocabularyButton label="Retry sync" busy={saving} onPress={() => { void reload(); }} /></> : null}
      <Text style={{ color: theme.textColor, fontSize: 16, fontWeight: "600" }}>Scheduling mode</Text>
      <SegmentedControl accessibilityLabel="Scheduling mode" values={["WaniKani-style", "Adaptive FSRS"]} selectedIndex={draft.mode === "wanikani" ? 0 : 1} enabled={!saving && !srs.loading} onChange={(event) => change({ mode: event.nativeEvent.selectedSegmentIndex === 0 ? "wanikani" : "fsrs" })} appearance={theme.isDark ? "dark" : "light"} />
      {draft.mode === "wanikani" ? <>
        <VocabularyMessage>Use m for minutes, h for hours, or d for days. Each interval starts when the word reaches that stage.</VocabularyMessage>
        {STAGES.map((stage, index) => <VocabularyField key={stage} label={`${stage} interval`} value={draft.stageIntervals[index]} editable={!saving && !srs.loading} maxLength={12} onChangeText={(value) => change({ stageIntervals: draft.stageIntervals.map((previous, i) => i === index ? value : previous) })} />)}
      </> : <>
        <VocabularyMessage>Intervals adapt to review history. Correct answers use Good; reviews with mistakes use Again.</VocabularyMessage>
        <VocabularyField label="Learning steps" help="1–8 increasing steps, from 1m to 1d. For example: 4h, 8h." value={draft.learningSteps} editable={!saving && !srs.loading} onChangeText={(learningSteps) => change({ learningSteps })} />
        <VocabularyField label="Relearning steps" help="Short steps after forgetting a word. For example: 4h." value={draft.relearningSteps} editable={!saving && !srs.loading} onChangeText={(relearningSteps) => change({ relearningSteps })} />
        <VocabularyField label="Target retention (%)" help="70–99%. Higher retention usually means more reviews." keyboardType="numeric" value={draft.requestRetention} editable={!saving && !srs.loading} onChangeText={(requestRetention) => change({ requestRetention })} />
        <VocabularyField label="Maximum interval (days)" help="1–36,500 days. Caps long-term intervals." keyboardType="numeric" value={draft.maximumInterval} editable={!saving && !srs.loading} onChangeText={(maximumInterval) => change({ maximumInterval })} />
      </>}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Text style={{ flex: 1, color: theme.textColor, fontSize: 16 }}>Group reviews at the start of the hour</Text><Switch accessibilityLabel="Group reviews at the start of the hour" value={draft.roundToHour} disabled={saving || srs.loading} onValueChange={(roundToHour) => change({ roundToHour })} /></View>
      <VocabularyMessage>Changes affect future lessons and reviews. Existing due dates, history, and stages stay intact. Both modes burn words at stage 9.</VocabularyMessage>
      {editing && validation ? <VocabularyMessage error>{validation}</VocabularyMessage> : null}
      {stale ? <VocabularyMessage error>Your saved schedule changed on another device. Reload it before saving again.</VocabularyMessage> : null}
      {blocked && !srs.loading ? <VocabularyMessage>Wait for your progress and saved answers to finish syncing before saving changes.</VocabularyMessage> : null}
      {error ? <VocabularyMessage error>{error}</VocabularyMessage> : null}
      {notice ? <VocabularyMessage>{notice}</VocabularyMessage> : null}
      <VocabularyButton label="Save schedule" primary busy={saving} disabled={!editing || Boolean(validation) || stale || blocked} onPress={() => { void save(); }} />
      <VocabularyButton label="Use WaniKani defaults" disabled={saving || srs.loading} onPress={() => change(draftFrom(DEFAULT_CUSTOM_SRS_SETTINGS))} />
      {editing || error ? <VocabularyButton label="Reload saved settings" disabled={saving} onPress={() => { void reload(); }} /> : null}
      {editing ? <VocabularyMessage>Changes are not saved until you choose Save schedule.</VocabularyMessage> : null}
    </ScrollView>
  </View>;
}
