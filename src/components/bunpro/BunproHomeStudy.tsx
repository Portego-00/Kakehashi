import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useBunproDashboard } from "../../hooks/useBunproDashboard";
import { summarizeBunproQueue } from "../../utils/bunproQueue";
import { useTheme } from "../../utils/theme";

type Props = { wanikaniCount?: number; refreshKey?: number };
type ReviewMode = "all" | "grammar" | "vocab";

// Match the web study cards in both light and dark themes.
const cardColors = { learn: "#082832", review: "#c64949", text: "#ffffff" };
const expandMotion = { duration: 240, easing: Easing.bezier(0.2, 0, 0, 1), reduceMotion: ReduceMotion.System };
const collapseMotion = { ...expandMotion, duration: 180 };

function Disclosure({ expanded, children, shadowGutter = false }: { expanded: boolean; children: React.ReactNode; shadowGutter?: boolean }) {
  const contentHeight = useSharedValue(0);
  const motion = expanded ? expandMotion : collapseMotion;
  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(expanded ? contentHeight.value : 0, motion),
    opacity: withTiming(expanded ? 1 : 0, motion),
  }));

  return <Animated.View
    style={[styles.disclosure, shadowGutter && styles.shadowGutter, animatedStyle]}
    pointerEvents={expanded ? "auto" : "none"}
    accessibilityElementsHidden={!expanded}
    importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
  >
    {/* Keep intrinsic measurement independent of the animated height, including while closed. */}
    <View style={styles.disclosureContent} onLayout={event => { contentHeight.value = event.nativeEvent.layout.height; }}>
      {children}
    </View>
  </Animated.View>;
}

function DisclosureChevron({ expanded, color, size = 20 }: { expanded: boolean; color: string; size?: number }) {
  const motion = expanded ? expandMotion : collapseMotion;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? "180deg" : "0deg", motion) }],
  }));
  return <Animated.View style={animatedStyle} accessible={false}>
    <Ionicons name="chevron-down" size={size} color={color} />
  </Animated.View>;
}

function Goal({ done, goal, batch }: { done: number; goal: number; batch: number }) {
  const segments = Math.min(Math.max(goal, 1), 20);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Daily Bunpro lesson goal"
      accessibilityValue={{ min: 0, max: Math.max(goal, 1), now: Math.min(done, goal), text: `${done} of ${goal} learned; next batch ${batch}` }} style={styles.goal}>
      {Array.from({ length: segments }, (_, index) => {
        const position = index * Math.max(goal, 1) / segments;
        return <View key={index} style={[styles.segment, position < done && styles.segmentDone]} />;
      })}
    </View>
  );
}

function CountBadge({ children }: { children: string }) {
  return <View style={styles.countBadge}><Text style={styles.count}>{children}</Text></View>;
}

/** Mounted only for eligible accounts, beside their normal study queues. */
export default function BunproHomeStudy({ wanikaniCount, refreshKey }: Props) {
  const { theme } = useTheme();
  const { eligible, status, due, queue, error, refreshing, refresh } = useBunproDashboard({ scope: "home", refreshKey });
  const [expanded, setExpanded] = useState<"learn" | "review" | null>(null);
  const [mixedOpen, setMixedOpen] = useState(false);
  const summary = useMemo(() => summarizeBunproQueue(queue), [queue]);
  const accent = cardColors.review;
  const learnText = cardColors.text;
  const reviewText = cardColors.text;
  const grammar = due?.total_due_grammar;
  const vocab = due?.total_due_vocab;
  const total = grammar === undefined || vocab === undefined ? undefined : grammar + vocab;
  const count = (value?: number) => value === undefined ? "—" : value.toLocaleString();
  const startLessons = (deckId?: number | null) => router.push({ pathname: "/bunpro-lessons", params: deckId ? { deckId: String(deckId) } : {} });
  const startReviews = (mode: ReviewMode, mixed = false) => router.push({ pathname: mixed ? "/mixed-reviews" : "/bunpro-reviews", params: { mode } });

  if (!eligible || status === "disabled") return null;
  return (
    <View style={styles.container} testID="bunpro-home-study">
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>Bunpro</Text>
        {refreshing ? <ActivityIndicator size="small" color={accent} accessibilityLabel="Refreshing Bunpro" /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Bunpro connection and settings" onPress={() => router.push("/(app)/(bunpro-tabs)")} style={styles.settings}>
          <Ionicons name="settings-outline" size={19} color={theme.textSecondary} />
        </Pressable>
      </View>
      {status === "unconfigured" ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/(bunpro-tabs)")} style={[styles.connect, { borderColor: theme.border }]}>
          <Text style={[styles.actionTitle, { color: theme.textColor }]}>Connect Bunpro</Text>
          <Text style={{ color: theme.textSecondary }}>Add your API key to study grammar and vocabulary here.</Text>
        </Pressable>
      ) : (
        <>
          <View style={[styles.panel, { backgroundColor: cardColors.learn }]}>
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Start Bunpro lessons" onPress={() => startLessons(summary.next?.deckId)} style={[styles.mainAction, styles.learnAction]}>
                <View style={styles.learnHeading}>
                  <Text style={[styles.actionTitle, { color: learnText }]}>Learn</Text>
                  <Text style={styles.goalCount}>{queue ? `${summary.overall.done} / ${summary.overall.dailyGoal}` : "—"}</Text>
                </View>
                <Goal done={summary.overall.done} goal={summary.overall.dailyGoal} batch={summary.overall.nextBatch} />
                {!queue || summary.noDecksInQueue ? <Text style={[styles.subtitle, { color: learnText }]}>{queue ? "No decks queued" : "Loading lesson queue…"}</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose Bunpro lesson deck" accessibilityState={{ expanded: expanded === "learn" }} onPress={() => setExpanded(current => current === "learn" ? null : "learn")} style={[styles.expand, expanded === "learn" && styles.expandOpen]}>
                <DisclosureChevron expanded={expanded === "learn"} color={learnText} />
              </Pressable>
            </View>
            <Disclosure expanded={expanded === "learn"}>
              <View style={styles.breakdown}>
                {summary.queue.filter(deck => deck.deckId !== null).map(deck => (
                  <Pressable key={deck.key} accessibilityRole="button" accessibilityLabel={`Learn ${deck.deckTitle}`} onPress={() => startLessons(deck.deckId)} style={styles.deck}>
                    <View style={styles.row}>
                      <Text style={[styles.deckTitle, { color: learnText }]}>{deck.deckTitle}</Text>
                      <Text style={[styles.smallCount, { color: learnText }]}>{deck.done} / {deck.dailyGoal}</Text>
                    </View>
                    <Goal done={deck.done} goal={deck.dailyGoal} batch={Math.min(deck.remaining, deck.batchSize || deck.remaining)} />
                  </Pressable>
                ))}
                {queue && summary.noDecksInQueue ? <Text style={[styles.empty, { color: learnText }]}>No decks in your learn queue.</Text> : null}
                <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://bunpro.jp/dashboard"); }} style={styles.queueSettings}>
                  <Text style={[styles.subtitle, { color: learnText }]}>Learn queue settings on Bunpro</Text>
                  <Ionicons name="open-outline" size={16} color={learnText} />
                </Pressable>
              </View>
            </Disclosure>
          </View>
          <View style={[styles.panel, { backgroundColor: accent }]}>
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Bunpro reviews: grammar and vocabulary, ${count(total)} due`} onPress={() => startReviews("all")} style={styles.mainAction}>
                <View style={styles.copy}>
                  <Text style={[styles.actionTitle, { color: reviewText }]}>Review</Text>
                  <Text style={[styles.subtitle, { color: reviewText }]}>All Reviews</Text>
                </View>
                <CountBadge>{count(total)}</CountBadge>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose Bunpro review type" accessibilityState={{ expanded: expanded === "review" }} onPress={() => setExpanded(current => current === "review" ? null : "review")} style={[styles.expand, expanded === "review" && styles.expandOpen]}>
                <DisclosureChevron expanded={expanded === "review"} color={reviewText} />
              </Pressable>
            </View>
            <Disclosure expanded={expanded === "review"}>
              <View style={styles.breakdown}>
                {([["grammar", "Grammar only", grammar], ["vocab", "Vocabulary only", vocab]] as const).map(([mode, label, value]) => (
                  <Pressable key={mode} accessibilityRole="button" accessibilityLabel={`Bunpro ${label} reviews`} onPress={() => startReviews(mode)} style={styles.mainAction}>
                    <Text style={[styles.deckTitle, { color: reviewText }]}>{label}</Text>
                    <CountBadge>{count(value)}</CountBadge>
                  </Pressable>
                ))}
              </View>
            </Disclosure>
          </View>
          <View>
            <Pressable accessibilityRole="button" accessibilityLabel="Mix with WaniKani reviews" accessibilityState={{ expanded: mixedOpen }} onPress={() => setMixedOpen(current => !current)} style={styles.mixedToggle}>
              <Ionicons name="shuffle" size={20} color={theme.textColor} />
              <Text style={[styles.mixedTitle, { color: theme.textColor }]}>Mix with WaniKani reviews</Text>
              <DisclosureChevron expanded={mixedOpen} size={18} color={theme.textSecondary} />
            </Pressable>
            <Disclosure expanded={mixedOpen} shadowGutter>
              <View style={styles.mixedOptions}>
                {([["grammar", "Grammar", grammar], ["vocab", "Vocabulary", vocab], ["all", "Grammar + vocabulary", total]] as const).map(([mode, label, value]) => {
                  const combined = value === undefined || wanikaniCount === undefined ? undefined : value + wanikaniCount;
                  return (
                    <Pressable key={mode} accessibilityRole="button" accessibilityLabel={`Start mixed ${label} reviews`} onPress={() => startReviews(mode, true)} style={[styles.panel, styles.mixedOption]}>
                      <View style={styles.row}>
                        <Text style={styles.mixedCardTitle}>{label}</Text>
                        <CountBadge>{count(combined)}</CountBadge>
                      </View>
                      <Text style={styles.mixedBreakdown}>WaniKani <Text style={styles.mixedNumber}>{count(wanikaniCount)}</Text> + Bunpro <Text style={styles.mixedNumber}>{count(value)}</Text></Text>
                      <View style={styles.row}>
                        <Text style={styles.mixedStart}>Start mixed reviews</Text>
                        <Ionicons name="arrow-forward" size={19} color={cardColors.text} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Disclosure>
          </View>
          {error ? (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <Text selectable style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.retry}><Text style={{ color: theme.textColor, fontWeight: "600" }}>Retry</Text></Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 16, marginBottom: 8 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: "700" },
  settings: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  disclosure: { overflow: "hidden" },
  disclosureContent: { position: "absolute", width: "100%", top: 0 },
  shadowGutter: { marginHorizontal: -8 },
  panel: { borderRadius: 12, boxShadow: "0 3px 7px #00000022" },
  topRow: { flexDirection: "row", alignItems: "center", minHeight: 88, paddingRight: 16 },
  mainAction: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 52 },
  learnAction: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  learnHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  copy: { flex: 1, gap: 5, minWidth: 0 },
  actionTitle: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  countBadge: { minWidth: 36, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#ffffff", borderRadius: 10, flexShrink: 0 },
  count: { color: "#444444", fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "center" },
  goalCount: { color: cardColors.text, fontSize: 15, fontVariant: ["tabular-nums"] },
  smallCount: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  expand: { width: 48, height: 50, borderWidth: 1, borderColor: "#ffffff55", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  expandOpen: { backgroundColor: "#ffffff22" },
  goal: { flexDirection: "row", gap: 5, height: 9 },
  segment: { flex: 1, borderRadius: 2, backgroundColor: "#ffffff4d" },
  segmentDone: { backgroundColor: "#e7a2a2" },
  breakdown: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ffffff33" },
  deck: { gap: 6, padding: 16, minHeight: 64 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  deckTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  queueSettings: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, padding: 12 },
  empty: { padding: 16, fontSize: 14 },
  mixedToggle: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: 10 },
  mixedTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  mixedOptions: { gap: 12, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 8 },
  mixedOption: { gap: 12, padding: 16, backgroundColor: cardColors.learn },
  mixedCardTitle: { flex: 1, color: cardColors.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  mixedBreakdown: { color: "#ffffffce", fontSize: 14, lineHeight: 21 },
  mixedNumber: { color: cardColors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  mixedStart: { flex: 1, color: cardColors.text, fontSize: 14, fontWeight: "600" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  errorText: { flex: 1, fontSize: 13 },
  retry: { padding: 12, minHeight: 44 },
  connect: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6 },
});
