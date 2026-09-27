import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ReviewScreen from "./reviews";
import BunproReviewScreen from "../../src/screens/BunproReviewScreen";
import type { MixedReviewAccuracy, MixedReviewAnswer, MixedReviewBridge, MixedReviewLane, MixedReviewProgress } from "../../src/types/mixedReviews";
import { createMixedReviewState, mixedWrapUpLimits, reportMixedReviewError, reportMixedReviewHead } from "../../src/utils/mixedReviews";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import { createBunproReviewSavePolicy } from "../../src/utils/bunproReviewSavePolicy";

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
  const wrapUpSize = useSettingsStore((state) => state.reviewWrapUpTargetSubjects);
  const [state, setState] = useState(() => createMixedReviewState(mode));
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
    onAnswer: (answer: MixedReviewAnswer) => {
      setPrevious(answer);
      // Preserve an earlier miss when the same item is later mastered.
      setAnswers((current) => ({ ...current, [answer.id]: { ...answer, correct: (current[answer.id]?.correct ?? true) && answer.correct } }));
    },
  }])) as Record<MixedReviewLane, Pick<MixedReviewBridge, "report" | "reportError" | "reportProgress" | "reportAccuracy" | "reportPending" | "reportSaving" | "onAnswer">>, [state.lanes]);
  const onWrapUp = () => {
    if (isSaving) { Alert.alert("Saving answer", "Please wait until this answer has been saved before wrapping up."); return; }
    if (wrapUp) return;
    const remaining = Object.fromEntries(state.lanes.map((lane) => [lane, Math.max(0, (laneProgress[lane]?.total ?? 0) - (laneProgress[lane]?.completed ?? 0))]));
    setWrapUp({ id: 1, limits: mixedWrapUpLimits(state.lanes, remaining, state.active, Math.min(20, Math.max(5, wrapUpSize))) });
  };
  const bridge = (lane: MixedReviewLane): MixedReviewBridge => ({
    ...callbacks[lane], active: !state.complete && state.active === lane && (state.started || Boolean(state.errors[lane])),
    previous, progress, accuracy, onExit: exit, onWrapUp,
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
        <Text style={[styles.title, { color: theme.textColor }]}>Mixed reviews complete</Text>
        <Text style={[styles.summary, { color: theme.textSecondary }]}>{progress.completed} completed · {accuracy.answered ? Math.round(accuracy.correct / accuracy.answered * 100) : 0}% accuracy</Text>
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
          {displayedAnswers.map((answer) => <TouchableOpacity key={answer.id} accessibilityRole="button" disabled={!answer.subjectId && !answer.bunproSubject?.slug} onPress={() => openAnswer(answer)} style={[styles.resultRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.itemTitle, { color: theme.textColor }]}>{answer.title}</Text>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={{ color: theme.textSecondary }}>{answer.source === "wanikani" ? "WaniKani" : "Bunpro"}</Text>
              <Text style={{ color: answer.correct ? theme.primary : theme.textSecondary }}>{answer.correct ? "Correct" : "Missed"}</Text>
              {answer.saveStatus === "unconfirmed" ? <Text style={{ color: theme.textSecondary }}>Save unconfirmed</Text> : null}
            </View>
          </TouchableOpacity>)}
          {!displayedAnswers.length ? <Text style={{ color: theme.textSecondary }}>No {resultFilter} items.</Text> : null}
        </> : null}
        <TouchableOpacity accessibilityRole="button" style={[styles.done, { backgroundColor: theme.primary }]} onPress={leave}><Text style={styles.doneLabel}>Back to home</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView> : null}
    <ReviewScreen mixed={bridge("wanikani")} />
    {state.lanes.filter((lane): lane is "grammar" | "vocab" => lane !== "wanikani").map((lane) => <BunproReviewScreen key={lane} initialMode={lane} mixed={bridge(lane)} savePolicy={bunproSavePolicy} />)}
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
