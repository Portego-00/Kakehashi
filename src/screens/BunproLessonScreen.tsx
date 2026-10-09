import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { BunproLearnContentItem, BunproReviewQuizIndexResponse } from "../types/bunpro";
import { getBunproLearnIndex, getBunproLearnQuiz, getBunproQueue } from "../utils/bunproApi";
import { getBunproLessonBatchSize, selectBunproLessonDeck, summarizeBunproQueue } from "../utils/bunproQueue";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import { BunproDetailsContent } from "../components/bunpro/bunpro-details-content";
import BunproReviewScreen, { buildReviewQueue } from "./BunproReviewScreen";

const tuple = (item: BunproLearnContentItem): ["GrammarPoint" | "Vocab", number] => [item.data.type === "vocab" ? "Vocab" : "GrammarPoint", Number(item.data.attributes.id || item.data.id)];

export default function BunproLessonScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const requestedDeck = Number(params.deckId) || undefined;
  const allowed = isPortegoUsername(userData?.username);
  const [phase, setPhase] = useState<"loading" | "details" | "quiz-loading" | "quiz" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [pool, setPool] = useState<BunproLearnContentItem[]>([]);
  const [size, setSize] = useState(1);
  const [index, setIndex] = useState(0);
  const [batchNumber, setBatchNumber] = useState(1);
  const [deck, setDeck] = useState<{ id: number; title: string } | null>(null);
  const [quiz, setQuiz] = useState<BunproReviewQuizIndexResponse | null>(null);
  const quizQueue = useMemo(() => quiz ? buildReviewQueue(quiz) : [], [quiz]);
  const generation = useRef(0);
  const lock = useRef(false);
  const emptyDecks = useRef<number[]>([]);
  const controller = useRef<AbortController | null>(null);
  const items = pool.slice(0, size);
  const current = items[index];

  const load = useCallback(async (preferredDeck?: number) => {
    if (!allowed) return;
    const token = ++generation.current;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setPhase("loading"); setError(""); setQuiz(null);
    try {
      const summary = summarizeBunproQueue(await getBunproQueue({ signal: request.signal }));
      const skipped = new Set(emptyDecks.current);
      let selected = selectBunproLessonDeck(summary, preferredDeck, [...skipped]);
      while (selected?.deckId) {
        const response = await getBunproLearnIndex({ deckId: selected.deckId, signal: request.signal });
        if (token !== generation.current) return;
        const content = (response.content ?? []).filter(item => ["grammar_point", "vocab"].includes(item.data.type) && Number.isInteger(tuple(item)[1]) && tuple(item)[1] > 0).slice(0, selected.remaining || selected.remainingItemsInDeck || response.content.length);
        if (content.length) {
          setPool(content); setSize(getBunproLessonBatchSize(selected)); setIndex(0);
          setDeck({ id: selected.deckId, title: selected.deckTitle }); setPhase("details"); return;
        }
        skipped.add(selected.deckId); emptyDecks.current = [...skipped];
        selected = selectBunproLessonDeck(summary, undefined, [...skipped]);
      }
      setPool([]); setDeck(null); setPhase("done");
    } catch (cause) {
      if (token === generation.current && !request.signal.aborted) { setError(cause instanceof Error ? cause.message : "Could not load lessons."); setPhase("error"); }
    }
  }, [allowed]);

  useEffect(() => { const requestGeneration = generation; void load(requestedDeck); return () => { requestGeneration.current++; controller.current?.abort(); }; }, [load, requestedDeck]);
  async function startQuiz() {
    if (!deck || !items.length || lock.current) return;
    lock.current = true;
    const token = ++generation.current;
    setPhase("quiz-loading"); setError("");
    try {
      const response = await getBunproLearnQuiz({ deckId: deck.id, reviewables: items.map(tuple) });
      if (token !== generation.current) return;
      if (!Number.isInteger(response.review_session_id) || response.review_session_id <= 0 || !buildReviewQueue(response).length) throw new Error("Bunpro did not return lesson questions for this batch. Please try again.");
      setQuiz(response); setPhase("quiz");
    } catch (cause) { if (token === generation.current) { setError(cause instanceof Error ? cause.message : "Could not start the lesson quiz."); setPhase("details"); } }
    finally { lock.current = false; }
  }
  const nextBatch = () => {
    setBatchNumber(value => value + 1); setQuiz(null); setIndex(0);
    // Refresh provider counts and content after every quiz, as on web.
    void load(requestedDeck);
  };
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={{ minHeight: 48, padding: 12, justifyContent: "center", opacity: disabled ? .4 : 1 }}><Text style={{ color: theme.textColor, fontWeight: "600" }}>{label}</Text></Pressable>;
  if (!allowed) return <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: theme.backgroundColor }}><Text style={{ color: theme.textColor }}>Lessons are currently enabled only for the Portego account.</Text></SafeAreaView>;
  if (phase === "quiz" && quiz) return <BunproReviewScreen key={quiz.review_session_id} initialQueue={quizQueue} initialReviewSessionId={quiz.review_session_id} initialMode="all" submissionContext="learn" completeTitle="Lesson quiz complete" completeButtonLabel="Continue lessons" onComplete={nextBatch} onBack={() => router.back()} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
    <StatusBar style={theme.statusBarStyle} />
    <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 12 }}>
      {button("Back", () => router.back())}<View style={{ flex: 1 }}><Text style={{ color: theme.textColor, fontWeight: "600" }}>Bunpro lessons</Text><Text style={{ color: theme.textSecondary }}>{deck?.title ?? ""} · Batch {batchNumber}{items.length ? ` · ${index + 1}/${items.length}` : ""}</Text></View>
    </View>
    {phase === "loading" || phase === "quiz-loading" ? <View style={{ flex: 1, justifyContent: "center", gap: 16 }}><ActivityIndicator color={theme.textColor} /><Text style={{ color: theme.textSecondary, textAlign: "center" }}>{phase === "loading" ? "Loading Bunpro lessons…" : "Preparing quiz…"}</Text></View> : phase === "error" ? <View style={{ padding: 24 }}><Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text>{button("Retry lessons", () => { void load(requestedDeck); })}</View> : phase === "done" || !current ? <View style={{ padding: 24 }}><Text style={{ color: theme.textColor, fontSize: 24 }}>Lessons complete</Text><Text style={{ color: theme.textSecondary }}>No more lessons are available in your learn queue.</Text>{button("Back to home", () => router.back())}</View> : <>
      <BunproDetailsContent key={`${current.data.type}:${current.data.id}`} content={current} kind={current.data.type === "vocab" ? "vocab" : "grammar"} slug={String(current.data.attributes.slug ?? "")} deckId={deck?.id} />
      {error ? <Text accessibilityRole="alert" style={{ padding: 12, color: theme.error }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
        {button("Previous", () => setIndex(value => value - 1), index === 0)}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Lesson batch" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", flexDirection: "row" }}>{items.map((item, i) => <Pressable key={item.data.id} accessibilityRole="button" accessibilityLabel={`Lesson ${i + 1}: ${String(item.data.attributes.title)}`} accessibilityState={{ selected: i === index }} onPress={() => setIndex(i)} style={{ minWidth: 28, minHeight: 44, alignItems: "center", justifyContent: "center" }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === index ? "#cc5b5d" : theme.border }} /></Pressable>)}</ScrollView>
        {button(index + 1 < items.length ? "Next" : "Start Quiz", () => { if (index + 1 < items.length) setIndex(value => value + 1); else void startQuiz(); })}
      </View>
    </>}
  </SafeAreaView>;
}
