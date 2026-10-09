import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import { DEFAULT_STUDY_SHORTCUTS, STUDY_SHORTCUT_LABELS, type StudyShortcutAction } from "../../utils/bunpro-study-shortcuts";
import type { ReviewOrderSetting } from "../../utils/reviewOrdering";
import { useBunproApiKeyAdded } from "../../hooks/use-bunpro-api-key-added";

const orders: [ReviewOrderSetting, string][] = [["random", "Random"], ["ascendingSrsStage", "Lower SRS first"], ["descendingSrsStage", "Higher SRS first"], ["currentLevelFirst", "Current level first"], ["lowestLevelFirst", "Lowest level first"], ["newestAvailableFirst", "Newest available first"], ["oldestAvailableFirst", "Oldest available first"], ["longestRelativeWait", "Most overdue first"]];

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={[styles.row, { borderBottomColor: theme.border }]}>
      <Text style={{ color: theme.textColor, flex: 1 }}>{label}</Text><Text style={{ color: theme.textSecondary }}>{options.find(option => option[0] === value)?.[1] ?? String(value)} ▾</Text>
    </Pressable>
    {open ? <View style={{ paddingLeft: 16 }}>{options.map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={`${label}: ${title}`} accessibilityState={{ checked: value === key }} onPress={() => { onChange(key); setOpen(false); }} style={styles.option}><Text style={{ color: theme.textColor }}>{value === key ? "✓ " : ""}{title}</Text></Pressable>)}</View> : null}
  </View>;
}

export function BunproReviewSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const hasBunproApiKey = useBunproApiKeyAdded(visible);
  const { theme, themeMode, setThemeMode } = useTheme();
  const settings = useSettingsStore(state => state);
  if (!visible) return null;
  const toggle = (key: keyof typeof settings, setter: keyof typeof settings, label: string, disabled = false) => <View key={key} style={[styles.row, { borderBottomColor: theme.border }]}>
    <Text style={{ color: theme.textColor, flex: 1 }}>{label}</Text><Switch accessibilityLabel={label} value={Boolean(settings[key])} disabled={disabled} onValueChange={value => (settings[setter] as (value: boolean) => void)(value)} />
  </View>;
  const heading = (title: string) => <Text accessibilityRole="header" style={[styles.heading, { color: theme.textColor }]}>{title}</Text>;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close Bunpro review settings" onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.cardBackground || theme.backgroundColor, borderColor: theme.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.textColor }]}>Bunpro review settings</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.textSecondary }}>Changes save automatically. Your current question and answer stay in place; ordering changes apply to remaining questions.</Text>
          {heading("Appearance")}
          <Choice label="Theme" value={themeMode ?? "system"} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"], ["midnight", "Midnight"], ["sepia", "Sepia"]]} onChange={setThemeMode} />
          <Choice label="Question text size" value={settings.reviewCharacterFontScale ?? 1} options={[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.4].map(value => [value, `${Math.round(value * 100)}%`])} onChange={settings.setReviewCharacterFontScale} />
          <Choice label="Answer text size" value={settings.reviewInputFontScale ?? 1} options={[0.7, 0.8, 0.9, 1, 1.1, 1.2].map(value => [value, `${Math.round(value * 100)}%`])} onChange={settings.setReviewInputFontScale} />
          {toggle("showReviewItemLevelAndSrsStage", "setShowReviewItemLevelAndSrsStage", "Show level and SRS stage")}
          {toggle("showVocabularyFrequency", "setShowVocabularyFrequency", "Show vocabulary frequency")}
          {toggle("showVocabContextSentencesInReviews", "setShowVocabContextSentencesInReviews", "Show context sentences")}
          {toggle("jitaiEnabled", "setJitaiEnabled", "Jitai font randomization")}
          <Choice label="SRS progression display" value={settings.srsProgressionCardDisplayMode ?? "normal"} options={[["normal", "Full"], ["compact", "Minimal"], ["hidden", "Off"]]} onChange={settings.setSrsProgressionCardDisplayMode} />
          {hasBunproApiKey ? <>
            {toggle("bunproHideFurigana", "setBunproHideFurigana", "Hide Bunpro furigana")}
            <Text style={{ color: theme.textSecondary }}>Tap a word to keep its reading visible. Tap again to hide it. Readings reset on the next question.</Text>
          </> : null}
          {heading("Anki mode")}
          {toggle("ankiCardMode", "setAnkiCardMode", "Anki mode")}
          {settings.ankiCardMode ? <>
            <Choice label="Anki questions" value={settings.ankiCardModeScope ?? "both"} options={[["both", "Meanings and readings"], ["meaning", "Meanings only"], ["reading", "Readings only"]]} onChange={value => { settings.setAnkiCardModeScope(value); if (value !== "both") settings.setAnkiGroupQuestions(false); }} />
            {toggle("ankiGroupQuestions", "setAnkiGroupQuestions", "Group meaning and reading", settings.ankiCardModeScope !== "both")}
            {toggle("ankiHideAnswerCompletely", "setAnkiHideAnswerCompletely", "Hide answer completely")}
            {toggle("ankiButtonlessMode", "setAnkiButtonlessMode", "Buttonless Anki mode")}
            {toggle("ankiShowOtherAcceptedAnswersAndUserSynonyms", "setAnkiShowOtherAcceptedAnswersAndUserSynonyms", "Show other accepted answers")}
            {toggle("ankiShowWaniKaniGrammarTags", "setAnkiShowWaniKaniGrammarTags", "Show parts of speech")}
            {toggle("ankiShowPitchAccentNumbers", "setAnkiShowPitchAccentNumbers", "Show pitch accent numbers")}
            {toggle("ankiShowPitchAccentGraph", "setAnkiShowPitchAccentGraph", "Show pitch accent graph")}
            {toggle("ankiShowReplayAudioButton", "setAnkiShowReplayAudioButton", "Show replay audio button")}
          </> : null}
          {heading("Ordering")}
          <Choice label="Review subject order" value={settings.reviewOrder ?? "random"} options={orders} onChange={settings.setReviewOrder} />
          {toggle("reviewTypeOrderEnabled", "setReviewTypeOrderEnabled", "Group by item type")}
          {settings.reviewTypeOrderEnabled ? (settings.reviewTypeOrder ?? []).map((type, index) => <Choice key={index} label={`${["First", "Second", "Third"][index]} item type`} value={type} options={[["radical", "Radical"], ["kanji", "Kanji"], ["vocabulary", "Vocabulary"]]} onChange={value => { const order = [...settings.reviewTypeOrder]; const other = order.indexOf(value); [order[index], order[other]] = [order[other], order[index]]; settings.setReviewTypeOrder(order); }} />) : null}
          {toggle("prioritizeCriticalItems", "setPrioritizeCriticalItems", "Prioritize critical items")}
          {toggle("reviewQuestionOrderEnabled", "setReviewQuestionOrderEnabled", "Force meaning/reading order")}
          {settings.reviewQuestionOrderEnabled ? <Choice label="Question order" value={settings.meaningFirst ? "meaning" : "reading"} options={[["meaning", "Meaning first"], ["reading", "Reading first"]]} onChange={value => settings.setMeaningFirst(value === "meaning")} /> : null}
          {toggle("backToBackQuestions", "setBackToBackQuestions", "Back-to-back questions", settings.ankiCardMode && settings.ankiGroupQuestions)}
          {settings.backToBackQuestions ? toggle("backToBackImmediateRetryIncorrect", "setBackToBackImmediateRetryIncorrect", "Immediate retry on wrong") : null}
          {toggle("reviewBatchSizeEnabled", "setReviewBatchSizeEnabled", "Limit review batch")}
          {settings.reviewBatchSizeEnabled ? <Choice label="Review batch size" value={settings.reviewBatchSize ?? 50} options={Array.from({ length: 20 }, (_, i) => [(i + 1) * 5, String((i + 1) * 5)])} onChange={settings.setReviewBatchSize} /> : null}
          <Choice label="Wrap-up size" value={settings.reviewWrapUpTargetSubjects ?? 10} options={[5, 10, 15, 20].map(value => [value, String(value)])} onChange={settings.setReviewWrapUpTargetSubjects} />
          {heading("Answers and audio")}
          {toggle("disableAutoProgressOnWrong", "setDisableAutoProgressOnWrong", "Pause on wrong answer")}
          {toggle("disableAutoProgressOnCloseAnswer", "setDisableAutoProgressOnCloseAnswer", "Pause on close answer", settings.disableAutoProgressOnCorrect)}
          {toggle("disableAutoProgressOnCorrect", "setDisableAutoProgressOnCorrect", "Pause on correct answer")}
          {toggle("showDetailsOnWrongAnswer", "setShowDetailsOnWrongAnswer", "Show details on wrong answer")}
          {toggle("showAnswerStopSubjectDetails", "setShowAnswerStopSubjectDetails", "Show details on answer pause")}
          {toggle("answerFeedbackSoundEnabled", "setAnswerFeedbackSoundEnabled", "Answer feedback sounds")}
          {toggle("reviewKeyboardShortcutsEnabled", "setReviewKeyboardShortcutsEnabled", "Keyboard shortcuts")}
          {settings.reviewKeyboardShortcutsEnabled ? (Object.keys(DEFAULT_STUDY_SHORTCUTS) as StudyShortcutAction[]).filter(key => key !== "addSynonym").map(key => <Choice key={key} label={STUDY_SHORTCUT_LABELS[key]} value={(settings.bunproStudyShortcuts ?? DEFAULT_STUDY_SHORTCUTS)[key]} options={["Enter", ..."abcdefghijklmnopqrstuvwxyz1234567890"].filter(value => value === (settings.bunproStudyShortcuts ?? DEFAULT_STUDY_SHORTCUTS)[key] || !Object.values(settings.bunproStudyShortcuts ?? DEFAULT_STUDY_SHORTCUTS).includes(value)).map(value => [value, value.length === 1 ? value.toUpperCase() : value])} onChange={value => settings.setBunproStudyShortcuts({ ...(settings.bunproStudyShortcuts ?? DEFAULT_STUDY_SHORTCUTS), [key]: value })} />) : null}
          {toggle("allowSkippingReviews", "setAllowSkippingReviews", "Allow skipping reviews")}
          {toggle("acceptUserSynonymsAsAnswers", "setAcceptUserSynonymsAsAnswers", "Accept user synonyms")}
          {toggle("acceptAnyKanjiOnyomiReading", "setAcceptAnyKanjiOnyomiReading", "Accept any kanji on’yomi reading")}
          {toggle("reviewSearchButtonEnabled", "setReviewSearchButtonEnabled", "Show search button")}
          {toggle("autoplayVocabularyAudio", "setAutoplayVocabularyAudio", "Autoplay vocabulary audio")}
          {toggle("voiceReviewAnswersEnabled", "setVoiceReviewAnswersEnabled", "Voice answers")}
          <Choice label="Voice actor" value={settings.vocabularyAudioVoice ?? "female"} options={[["female", "Female · Kyoko"], ["male", "Male · Kenichi"], ["random", "Random"], ["both", "Both"]]} onChange={settings.setVocabularyAudioVoice} />
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Done with Bunpro review settings" onPress={onClose} style={styles.done}><Text style={{ color: theme.textColor, fontWeight: "600" }}>Done</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "90%", maxWidth: 560, width: "100%", alignSelf: "center", borderWidth: 1, borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  heading: { fontSize: 17, fontWeight: "600", marginTop: 24, marginBottom: 8 },
  row: { minHeight: 48, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  option: { minHeight: 44, justifyContent: "center", paddingVertical: 10 },
  done: { alignSelf: "flex-end", minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center" },
});
