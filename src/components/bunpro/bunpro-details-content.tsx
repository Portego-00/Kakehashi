import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { BunproLearnContentItem } from "../../types/bunpro";
import { getBunproReviewableDetails } from "../../utils/bunproApi";
import { bunproStage } from "../../utils/bunpro-progression";
import { useTheme } from "../../utils/theme";
import { useBunproAudio } from "../../hooks/useBunproAudio";
import { useOptionalScreenIsFocused } from "../../utils/navigation-focus";
import { stripFuriganaAndTags } from "../../utils/japaneseHtmlNormalization";
import { sanitizeText } from "../../../web/src/features/bunpro/model";
import { BunproContext } from "./BunproContext";
import { BunproCoverage } from "./bunpro-coverage";
import BunproDetailsDOM from "./bunpro-details-dom";

const conjugations = new Set(["う-Verbs", "る-Verbs", "する", "くる", "るverb-ない", "うverb--ない", "る-verb-past", "う-verb-past", "る-verb-neg-past", "う-verb-neg-past", "verb-て", "verbて-request", "ている1", "よう-おう", "たい", "Verb[potential]", "命令形", "ば", "たら", "causative", "Verb[passive]", "causative-passive", "てください", "ましょう"]);

export function BunproDetailsContent({ kind, slug, content, review, deckId, active = true, initialTab = "Details" }: { kind: "grammar" | "vocab"; slug: string; content?: BunproLearnContentItem; review?: Record<string, unknown>; deckId?: number; active?: boolean; initialTab?: "Details" | "Examples" | "Context" }) {
  const { theme } = useTheme();
  const [data, setData] = useState<BunproLearnContentItem | null>(content ?? null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heroHeight = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const [stuck, setStuck] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const audio = useBunproAudio();
  const focused = useOptionalScreenIsFocused();
  const { stop } = audio;
  useEffect(() => { if (!active || !focused) void stop(); }, [active, focused, stop]);
  useEffect(() => {
    if (content) { setData(content); return; }
    const controller = new AbortController();
    setData(null); setError("");
    getBunproReviewableDetails({ kind, slug, signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load details."); });
    return () => controller.abort();
  }, [kind, slug, content, attempt]);
  const attributes: Record<string, unknown> = data?.data.attributes ?? {};
  const title = stripFuriganaAndTags(typeof attributes.title === "string" ? attributes.title : "");
  const coverage = useMemo(() => {
    const ids = Array.isArray(attributes.coverage_vocab_ids) ? new Set(attributes.coverage_vocab_ids.map(Number)) : null;
    return data?.included?.filter(item => item.type === "reviewable_base_attribute_mixed" && item.attributes.type_snake === "vocab" && (!ids || ids.has(Number(item.attributes.id ?? item.id)))) ?? [];
  }, [data, attributes.coverage_vocab_ids]);
  const progress = review ?? data?.included?.find(item => item.type === "review")?.attributes;
  const tabs: ("Details" | "Examples" | "Context")[] = kind === "vocab" ? ["Details", "Examples", "Context"] : ["Details", "Examples"];
  const openLink = async (url: string) => { if (/^https:\/\//.test(url)) await Linking.openURL(url); };
  if (!data) return <View style={{ padding: 24 }}>{error ? <><Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.textColor }}>Retry details</Text></Pressable></> : <ActivityIndicator accessibilityLabel="Loading Bunpro details" />}</View>;
  return <ScrollView nestedScrollEnabled ref={scroll} stickyHeaderIndices={[1]} onScroll={event => setStuck(event.nativeEvent.contentOffset.y >= heroHeight.current && heroHeight.current > 0)} scrollEventThrottle={16} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
    <View onLayout={event => { heroHeight.current = event.nativeEvent.layout.height; }} style={{ padding: 24, gap: 8 }}><Text accessibilityRole="header" selectable style={{ fontSize: 36, color: theme.textColor }}>{title}</Text><Text selectable style={{ color: theme.textSecondary, fontSize: 18 }}>{sanitizeText(attributes.furigana || attributes.kana)}</Text><Text selectable style={{ color: theme.textColor, fontSize: 18 }}>{sanitizeText(attributes.meaning)}</Text><Text style={{ color: theme.textSecondary }}>{kind === "grammar" ? "Grammar" : "Vocabulary"} · {sanitizeText(attributes.level || attributes.jlpt_level)}</Text></View>
    <View style={{ backgroundColor: theme.backgroundColor, borderBottomWidth: 1, borderBottomColor: theme.border }}><Pressable accessibilityRole="button" accessibilityLabel={`Back to ${title}`} disabled={!stuck} onPress={() => scroll.current?.scrollTo({ y: 0, animated: false })} style={{ display: stuck ? "flex" : "none", paddingHorizontal: 24, paddingTop: 8, minHeight: 44 }}><Text numberOfLines={1} style={{ fontSize: 16, color: theme.textColor }}>{title}</Text><Text numberOfLines={1} style={{ color: theme.textSecondary }}>{sanitizeText(attributes.meaning)}</Text></Pressable><View accessibilityRole="tablist" style={{ flexDirection: "row", paddingHorizontal: 16 }}>{tabs.map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => { void stop(); setTab(label); }} style={{ minHeight: 48, padding: 12, borderBottomWidth: 2, borderBottomColor: tab === label ? "#cc5b5d" : "transparent" }}><Text style={{ color: theme.textColor, fontWeight: tab === label ? "600" : "400" }}>{label}</Text></Pressable>)}</View></View>
    {tab === "Context" ? active && focused ? <View style={{ padding: 24 }}><BunproContext key={slug} query={stripFuriganaAndTags(String(attributes.title ?? ""))} /></View> : null : <>
      {tab === "Details" ? <ReviewProgress review={progress} kind={kind} /> : null}
      <BunproDetailsDOM key={`${data.data.id}:${tab}`} attributes={attributes} included={data.included ?? []} kind={kind} resourceId={data.data.id} tab={tab as "Details" | "Examples"} theme={{ background: theme.backgroundColor, text: theme.textColor, muted: theme.textSecondary, border: theme.border, surface: theme.cardBackground }} playingId={audio.playingKey} onPlay={async (id, urls) => { if (active && focused) await audio.play(id, urls); }} onOpenLink={openLink} dom={{ matchContents: true, scrollEnabled: false, style: { backgroundColor: theme.backgroundColor } }} />
      {audio.error ? <Text accessibilityRole="alert" style={{ paddingHorizontal: 24, color: theme.error }}>{audio.error}</Text> : null}
      {tab === "Details" && kind === "grammar" && conjugations.has(String(attributes.slug)) && /^[1-9]\d*$/.test(data.data.id) ? <View style={{ padding: 24, gap: 8 }}><Text style={{ color: theme.textColor, fontSize: 20, fontWeight: "600" }}>Practice {title} in Kaijugation</Text><Pressable accessibilityRole="link" onPress={() => { void openLink(`https://kaijugation.bunpro.jp/create/${data.data.id}/${encodeURIComponent(String(attributes.slug))}`); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "#cc5b5d", fontWeight: "600" }}>Play! ↗</Text></Pressable></View> : null}
      {tab === "Details" && coverage.length ? <BunproCoverage vocabulary={coverage} deckId={deckId} /> : null}
    </>}
  </ScrollView>;
}

function ReviewProgress({ review, kind }: { review?: Record<string, unknown>; kind: "grammar" | "vocab" }) {
  const { theme } = useTheme();
  const stage = bunproStage(review);
  const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : "—";
  const inputTypes: Record<string, string> = { Cloze: "Cloze (Manual)", Translate: "Manual Translation", Reading: "Manual Reading", Reveal: "Reveal" };
  const input = String(review?.default_input_type ?? "");
  return <View style={{ paddingHorizontal: 24, gap: 12 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "600", color: theme.textColor }}>Your Progress</Text>{review ? <>{[["Current stage", stage.label || "Not started"], ["Next review", typeof review.next_review === "string" && Date.parse(review.next_review) <= Date.now() ? "Now" : date(review.next_review)], ["First studied", date(review.started_studying_at)], ["Times studied", review.times_studied ?? "—"], ["Accuracy", typeof review.accuracy === "number" ? `${review.accuracy}%` : "—"], ["Ghost count", review.ghost_count ?? "—"]].map(([label, value]) => <View key={String(label)} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.textSecondary }}>{String(label)}</Text><Text selectable style={{ color: theme.textColor }}>{String(value)}</Text></View>)}<View style={{ flexDirection: "row", gap: 4 }}>{Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: 6, backgroundColor: i < (stage.number ?? 0) ? "#cc5b5d" : theme.border }} />)}</View></> : <Text style={{ color: theme.textSecondary }}>Not studied yet</Text>}<Text style={{ color: theme.textSecondary }}>Review Type: {inputTypes[input] ?? (input || (kind === "grammar" ? "Cloze (Manual)" : "Not set"))}</Text></View>;
}
