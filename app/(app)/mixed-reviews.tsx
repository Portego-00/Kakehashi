import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ReviewScreen from "./reviews";
import { ReviewPreviousAnswerCard } from "../../src/components/ReviewPreviousAnswerCard";
import BunproReviewScreen from "../../src/screens/BunproReviewScreen";
import type { MixedReviewAccuracy, MixedReviewAnswer, MixedReviewBridge, MixedReviewLane, MixedReviewProgress } from "../../src/types/mixedReviews";
import { createMixedReviewState, mixedWrapUpLimits, reportMixedReviewError, reportMixedReviewHead, recordMixedReviewAnswer } from "../../src/utils/mixedReviews";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import { useBunproAudio, bunproAudioUrls } from "../../src/hooks/useBunproAudio";
import type { BunproProgression } from "../../src/utils/bunpro-progression";
import { BunproReviewSettingsSheet } from "../../src/components/bunpro/bunpro-review-settings-sheet";
import { BunproProgressionCard } from "../../src/components/bunpro/bunpro-progression-card";
import { createBunproReviewSavePolicy } from "../../src/utils/bunproReviewSavePolicy";

const MixedWaniKaniScreen = React.memo(ReviewScreen, (before, after) =>
  before?.mixed?.active === false && after?.mixed?.active === false &&
  before.mixed?.wrapUpRequest?.id === after.mixed?.wrapUpRequest?.id);
const MixedBunproScreen = React.memo(BunproReviewScreen, (before, after) =>
  before?.mixed?.active === false && after?.mixed?.active === false &&
  before.mixed?.wrapUpRequest?.id === after.mixed?.wrapUpRequest?.id && before.savePolicy === after.savePolicy);

const LANE_NAMES = { wanikani: "WaniKani", grammar: "Bunpro grammar", vocab: "Bunpro vocabulary" };

export default function MixedReviewsRoute() {
  const username = useAuthStore((state) => state.userData?.username);
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === "grammar" || params.mode === "vocab" ? params.mode : "all";
  const { theme } = useTheme();
  if (!isPortegoUsername(username)) {
    return <SafeAreaView style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
      <Text style={{ color: theme.textColor }}>Mixed reviews are not available for this account.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.button}><Text style={{ color: theme.primary }}>Back</Text></TouchableOpacity>
    </SafeAreaView>;
  }
  return <MixedReviewSession key={mode} mode={mode} />;
}

export function MixedReviewSession({ mode }: { mode: "all" | "grammar" | "vocab" }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reviewSearchEnabled = useSettingsStore(state => state.reviewSearchButtonEnabled);
  const jitaiEnabled = useSettingsStore(state => state.jitaiEnabled);
  const wrapUpSize = useSettingsStore((state) => state.reviewWrapUpTargetSubjects);
  const startedAt = useRef(Date.now());
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState(() => createMixedReviewState(mode));
  useEffect(() => { if (state.complete) { Keyboard.dismiss(); setDuration(Date.now() - startedAt.current); } }, [state.complete]);
  const latestAnswer = useRef<MixedReviewAnswer | null>(null);
  const reportBunproProgression = useCallback((value: BunproProgression) => { if (latestAnswer.current?.id === `bunpro:${value.id}` && latestAnswer.current.correct) setBunproProgression(value); }, []);
  const [bunproProgression, setBunproProgression] = useState<BunproProgression | null>(null);
  const audio = useBunproAudio();
  const audioVoice = useSettingsStore(state => state.vocabularyAudioVoice) ?? "female";
  const promotion = state.promotion;
  const promotionAction = promotion ? state.heads[promotion.lane]?.activate : undefined;
  useEffect(() => { if (promotion) promotionAction?.(promotion.id); }, [promotion, promotionAction]);
  useEffect(() => { if (!bunproProgression) return; const timer = setTimeout(() => setBunproProgression(null), 3000); return () => clearTimeout(timer); }, [bunproProgression]);
  const [bunproSavePolicy] = useState(createBunproReviewSavePolicy);
  const [laneProgress, setLaneProgress] = useState<Partial<Record<MixedReviewLane, MixedReviewProgress>>>({});
  const [laneAccuracy, setLaneAccuracy] = useState<Partial<Record<MixedReviewLane, MixedReviewAccuracy>>>({});
  const [pending, setPending] = useState<Partial<Record<MixedReviewLane, number>>>({});
  const [saving, setSaving] = useState<Partial<Record<MixedReviewLane, boolean>>>({});
  const [previous, setPrevious] = useState<MixedReviewAnswer | null>(null);
  const [answers, setAnswers] = useState<Record<string, MixedReviewAnswer>>({});
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "missed">("all");
  const [wrapUp, setWrapUp] = useState<{ id: number; limits: Record<MixedReviewLane, number> } | null>(null);
  const progress = state.lanes.reduce((sum, lane) => ({ completed: sum.completed + (laneProgress[lane]?.completed ?? 0), total: sum.total + (laneProgress[lane]?.total ?? 0) }), { completed: 0, total: 0 });
  const accuracy = state.lanes.reduce((sum, lane) => ({ correct: sum.correct + (laneAccuracy[lane]?.correct ?? 0), answered: sum.answered + (laneAccuracy[lane]?.answered ?? 0) }), { correct: 0, answered: 0 });
  const pendingCount = state.lanes.reduce((sum, lane) => sum + (pending[lane] ?? 0), 0);
  const isSaving = state.lanes.some((lane) => saving[lane]);
  const unconfirmedCount = Object.values(answers).filter((answer) => answer.saveStatus === "unconfirmed").length;
  useActivityTracking("bunpro_reviews", { enabled: state.started && !state.complete && state.active !== "wanikani" });

  const leave = useCallback(() => {
    router.dismissAll();
    router.replace({ pathname: "/", params: { refreshLessonsReviews: "true" } });
  }, []);
  const exit = useCallback(() => {
    if (isSaving) { Alert.alert("Saving answer", "Please wait until this answer has been saved before leaving."); return; }
    if (!accuracy.answered || state.complete) { leave(); return; }
    Alert.alert("End mixed reviews?", unconfirmedCount ? `${unconfirmedCount} Bunpro answers have unconfirmed saves and may still be due. Other completed reviews are saved.` : "Completed reviews are saved. Unfinished items will remain due.", [
      { text: "Continue reviewing", style: "cancel" }, { text: "End session", onPress: leave },
    ]);
  }, [accuracy.answered, leave, state.complete, isSaving, unconfirmedCount]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exit(); return true; });
    return () => subscription.remove();
  }, [exit]));

  const callbacks = useMemo(() => Object.fromEntries(state.lanes.map((lane) => [lane, {
    report: (head: Parameters<MixedReviewBridge["report"]>[0]) => setState((current) => reportMixedReviewHead(current, lane, head)),
    reportError: (message: string | null) => setState((current) => reportMixedReviewError(current, lane, message)),
    reportProgress: (value: MixedReviewProgress) => setLaneProgress((current) => current[lane]?.completed === value.completed && current[lane]?.total === value.total ? current : { ...current, [lane]: value }),
    reportAccuracy: (value: MixedReviewAccuracy) => setLaneAccuracy((current) => current[lane]?.correct === value.correct && current[lane]?.answered === value.answered ? current : { ...current, [lane]: value }),
    reportPending: (count: number) => setPending((current) => current[lane] === count ? current : { ...current, [lane]: count }),
    reportSaving: (value: boolean) => setSaving((current) => current[lane] === value ? current : { ...current, [lane]: value }),
    onSaveSettled: (answer: MixedReviewAnswer) => {
      setAnswers((current) => ({ ...current, [answer.id]: { ...answer, correct: (current[answer.id]?.correct ?? true) && answer.correct } }));
    },
    onAnswer: (answer: MixedReviewAnswer) => {
      latestAnswer.current = answer;
      setPrevious(answer);
      setState(current => recordMixedReviewAnswer(current, lane, answer.id, answer.correct));
      if (answer.source === "wanikani") setBunproProgression(null);
      if (answer.practiceOnly) return;
      // Preserve an earlier miss when the same item is later mastered.
      setAnswers((current) => ({ ...current, [answer.id]: { ...answer, correct: (current[answer.id]?.correct ?? true) && answer.correct } }));
    },
  }])) as Record<MixedReviewLane, Pick<MixedReviewBridge, "report" | "reportError" | "reportProgress" | "reportAccuracy" | "reportPending" | "reportSaving" | "onAnswer" | "onSaveSettled">>, [state.lanes]);
  const onWrapUp = () => {
    if (isSaving) { Alert.alert("Saving answer", "Please wait until this answer has been saved before wrapping up."); return; }
    if (wrapUp) return;
    const remaining = Object.fromEntries(state.lanes.map((lane) => [lane, Math.max(0, (laneProgress[lane]?.total ?? 0) - (laneProgress[lane]?.completed ?? 0))]));
    const open = Object.fromEntries(state.lanes.map(lane => [lane, new Set(state.heads[lane]?.pending?.filter(question => question.open || (lane === state.active && question.id === (state.heads[lane]?.retryKey ?? state.heads[lane]?.id))).map(question => question.subjectId)).size]));
    setWrapUp({ id: 1, limits: mixedWrapUpLimits(state.lanes, remaining, state.active, Math.min(20, Math.max(5, wrapUpSize)), open) });
  };
  const bridge = (lane: MixedReviewLane): MixedReviewBridge => ({
    ...callbacks[lane], active: !settingsOpen && !state.complete && state.active === lane && (state.started || Boolean(state.errors[lane])),
    bunproProgression, reportBunproProgression, previous, progress, accuracy, onExit: exit, onWrapUp,
    wrapUpRequest: wrapUp ? { id: wrapUp.id, limit: wrapUp.limits[lane] } : undefined,
  });
  const allAnswers = Object.values(answers);
  const displayedAnswers = allAnswers.filter((answer) => resultFilter === "all" || (resultFilter === "correct" ? answer.correct : !answer.correct));
  const openAnswer = (answer: MixedReviewAnswer) => {
    if (answer.subjectId) router.push({ pathname: "/subject/[id]", params: { id: String(answer.subjectId) } });
    else if (answer.bunproSubject?.slug) router.push({ pathname: "/bunpro-reviewable/[kind]/[slug]", params: answer.bunproSubject });
  };
  return <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
    {!state.started && !state.lanes.some((lane) => state.errors[lane]) ? <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loading, { color: theme.textColor }]}>Loading mixed reviews…</Text>
      <TouchableOpacity accessibilityRole="button" onPress={exit} style={styles.button}><Text style={{ color: theme.textSecondary }}>Back</Text></TouchableOpacity>
    </SafeAreaView> : null}
    {state.complete ? <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.results}>
        {audio.error ? <Text accessibilityRole="alert" style={{ color: theme.textSecondary }}>{audio.error}</Text> : null}
        <Text style={[styles.title, { color: theme.textColor }]}>Mixed reviews complete</Text>
        <Text style={[styles.summary, { color: theme.textSecondary }]}>{progress.completed} completed · {accuracy.answered ? Math.round(accuracy.correct / accuracy.answered * 100) : 0}% accuracy</Text>
        <Text style={{ color: theme.textSecondary }}>Session time: {Math.floor(duration / 60000)}m {Math.floor(duration / 1000) % 60}s</Text>
        <BunproProgressionCard progression={bunproProgression} />
        {state.lanes.map((lane) => <View key={lane} style={[styles.resultRow, { borderBottomColor: theme.border }]}>
          <Text style={{ color: theme.textColor, fontSize: 16 }}>{LANE_NAMES[lane]}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 16 }}>{laneProgress[lane]?.completed ?? 0} completed</Text>
        </View>)}
        {pendingCount > 0 ? <Text style={[styles.note, { color: theme.textSecondary }]}>{pendingCount} WaniKani review{pendingCount === 1 ? " is" : "s are"} saved on this device and waiting to sync.</Text> : null}
        {unconfirmedCount ? <Text accessibilityRole="alert" style={[styles.note, { color: theme.textSecondary }]}>{unconfirmedCount} Bunpro answer{unconfirmedCount === 1 ? " has" : "s have"} an unconfirmed save and may still be due in Bunpro.</Text> : null}
        {allAnswers.length ? <>
          <Text style={[styles.subtitle, { color: theme.textColor }]}>Reviewed items</Text>
          <View style={styles.filters}>
            {(["all", "correct", "missed"] as const).map((filter) => <TouchableOpacity key={filter} accessibilityRole="tab" accessibilityState={{ selected: resultFilter === filter }} onPress={() => setResultFilter(filter)} style={[styles.filter, { borderBottomColor: resultFilter === filter ? theme.primary : "transparent" }]}>
              <Text style={{ color: resultFilter === filter ? theme.primary : theme.textSecondary, fontWeight: resultFilter === filter ? "600" : "400" }}>{filter === "all" ? "All" : filter === "correct" ? "Correct" : "Missed"} ({allAnswers.filter((answer) => filter === "all" || (filter === "correct" ? answer.correct : !answer.correct)).length})</Text>
            </TouchableOpacity>)}
          </View>
          {displayedAnswers.map(answer => <View key={answer.id} style={{ paddingVertical: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <TouchableOpacity accessibilityRole="button" disabled={!answer.subjectId && !answer.bunproSubject?.slug} onPress={() => openAnswer(answer)}><Text style={[styles.itemTitle, { color: theme.textColor }]}>{answer.title}</Text><Text style={{ color: theme.textSecondary }}>{answer.meaning}</Text></TouchableOpacity>
            <Text style={{ color: answer.correct ? "#017b37" : theme.textSecondary }}>{answer.source === "wanikani" ? "WaniKani" : "Bunpro"} · {answer.correct ? "Correct" : "Missed"}</Text>
            {answer.question ? <Text selectable style={{ color: theme.textColor }}>{answer.question.replace(/(?:_{2,}|＿{2,})/g, answer.correctAnswer ?? answer.enteredAnswer ?? "____")}</Text> : null}
            {answer.reading ? <Text selectable style={{ color: theme.textSecondary }}>{answer.reading}</Text> : null}
            {answer.translation ? <Text selectable style={{ color: theme.textSecondary }}>{answer.translation}</Text> : null}
            {answer.enteredAnswer ? <Text selectable style={{ color: theme.textColor }}>Your answer: {answer.enteredAnswer}</Text> : null}
            {answer.stage || answer.previousStage ? <Text style={{ color: theme.textSecondary }}>{answer.previousStage}{answer.stage ? ` → ${answer.stage}` : ""}</Text> : null}
            {answer.audioSources && bunproAudioUrls(answer.audioSources, audioVoice).length ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Replay ${answer.title}`} onPress={() => { void audio.play(answer.id, bunproAudioUrls(answer.audioSources ?? {}, audioVoice), audioVoice === "both"); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.textColor }}>{audio.playingKey === answer.id ? "Stop audio" : "Replay audio"}</Text></TouchableOpacity> : null}
            {answer.saveStatus === "unconfirmed" ? <Text style={{ color: theme.textSecondary }}>Save unconfirmed</Text> : null}
          </View>)}
          {!displayedAnswers.length ? <Text style={{ color: theme.textSecondary }}>No {resultFilter} items.</Text> : null}
        </> : null}
        <TouchableOpacity accessibilityRole="button" style={[styles.done, { backgroundColor: theme.primary }]} onPress={leave}><Text style={styles.doneLabel}>Back to home</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView> : null}
    {state.lanes.map((lane) => {
      const laneBridge = bridge(lane);
      return <View key={lane}
        pointerEvents={laneBridge.active ? "auto" : "none"}
        accessibilityElementsHidden={!laneBridge.active}
        importantForAccessibility={laneBridge.active ? "auto" : "no-hide-descendants"}
        style={[StyleSheet.absoluteFillObject, { opacity: laneBridge.active ? 1 : 0, zIndex: laneBridge.active ? 1 : -1 }]}
      >
        {lane === "wanikani" ? <MixedWaniKaniScreen mixed={laneBridge} /> : <MixedBunproScreen initialMode={lane} mixed={laneBridge} savePolicy={bunproSavePolicy} />}
      </View>;
    })}
    {!state.complete && state.active === "wanikani" && state.started ? <>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mixed review settings" disabled={isSaving} onPress={() => { Keyboard.dismiss(); setSettingsOpen(true); }} style={{ position: "absolute", top: wrapUp || progress.total - progress.completed > wrapUpSize ? 184 : 140, right: 16 + (reviewSearchEnabled ? 48 : 0) + (jitaiEnabled ? 48 : 0), minHeight: 44, minWidth: 36, padding: 8, zIndex: 40 }}><Text style={{ color: theme.textColor }}>⚙</Text></TouchableOpacity>
      {bunproProgression ? <View pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 96, left: 24, right: 24 }}><BunproProgressionCard progression={bunproProgression} /></View> : null}
    </> : null}
    <BunproReviewSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    {!state.complete && previous ? <ReviewPreviousAnswerCard answer={previous} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loading: { fontSize: 16, marginTop: 16 },
  button: { padding: 18, minHeight: 48 },
  results: { padding: 24, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700" },
  summary: { fontSize: 17, lineHeight: 24, marginBottom: 12 },
  subtitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontSize: 20, flex: 1 },
  filters: { flexDirection: "row", gap: 16 },
  filter: { paddingVertical: 12, borderBottomWidth: 2, minHeight: 44 },
  note: { fontSize: 14, lineHeight: 21 },
  done: { alignItems: "center", padding: 16, borderRadius: 10, marginTop: 24 },
  doneLabel: { color: "white", fontSize: 16, fontWeight: "600" },
});
