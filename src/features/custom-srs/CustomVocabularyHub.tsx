import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontStyles } from "../../utils/fonts";
import * as Haptics from "../../utils/haptics";
import { getBestContrastTextColor, useSubjectColors, withAlpha } from "../../utils/subjectColors";
import { useTheme } from "../../utils/theme";
import { CUSTOM_VOCABULARY_PACKS, CUSTOM_VOCABULARY_WORDS, getCustomVocabularyPack } from "./catalog";
import { customPackProgress, useCustomSrs } from "./data";
import CustomVocabularyHeader from "./custom-vocabulary-header";
import { goBackFromCustomVocabulary } from "./navigation";
import { customWordUsesKanji } from "./subject";
import type { CustomSrsAssignment, CustomVocabularyPack, CustomVocabularyWord } from "./types";

const PACK_FILTERS = ["All packs", "My packs", "Kana", "Kanji"];
const STAGE_NAMES = ["New lesson", "Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened", "Burned"];

export function customVocabularyPackLabel(pack: CustomVocabularyPack) {
  if (pack.levelRange) return `Kanji · Levels ${pack.levelRange.min}–${pack.levelRange.max}`;
  return pack.script === "hiragana" ? "Hiragana" : pack.script === "katakana" ? "Katakana" : "Kana";
}

function assignmentLabel(assignment?: CustomSrsAssignment) {
  if (!assignment) return "";
  if (assignment.stage > 0 && assignment.stage < 9 && assignment.availableAt && Date.parse(assignment.availableAt) <= Date.now()) return "Review due";
  return STAGE_NAMES[assignment.stage];
}

export default function CustomVocabularyHub({ packId }: { packId?: string } = {}) {
  const params = useLocalSearchParams<{ packId?: string }>();
  const selectedPackId = packId ?? params.packId;
  const selectedPack = selectedPackId ? getCustomVocabularyPack(selectedPackId) : undefined;
  const { theme } = useTheme();
  const colors = useSubjectColors();
  const vocabularyInk = getBestContrastTextColor(colors.vocabulary);
  const insets = useSafeAreaInsets();
  const customSrs = useCustomSrs();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const enrolledIds = useMemo(() => new Set(customSrs.state.enrolledPackIds), [customSrs.state.enrolledPackIds]);
  const packs = useMemo(() => CUSTOM_VOCABULARY_PACKS.filter((pack) => {
    if (filter === 1 && !enrolledIds.has(pack.id)) return false;
    if (filter === 2 && pack.script === "kanji") return false;
    if (filter === 3 && pack.script !== "kanji") return false;
    return !normalizedQuery || `${pack.title} ${pack.description}`.toLocaleLowerCase().includes(normalizedQuery)
      || pack.words.some((word) => `${word.characters} ${word.reading} ${word.meanings.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery));
  }), [enrolledIds, filter, normalizedQuery]);
  const words = useMemo(() => selectedPack?.words.filter((word) => !normalizedQuery
    || `${word.characters} ${word.reading} ${word.meanings.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery)) ?? [], [selectedPack, normalizedQuery]);
  const progress = selectedPack ? customPackProgress(customSrs.state, selectedPack) : undefined;
  const isEnrolled = selectedPack ? enrolledIds.has(selectedPack.id) : false;
  const error = actionError ?? customSrs.error;
  const goBack = () => goBackFromCustomVocabulary(selectedPackId ? "/custom-vocabulary" : "/(app)/(tabs)");

  async function pullToRefresh() {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try {
      await customSrs.refresh();
    } catch {
      // The shared cloud state exposes the error and the retry action below.
    } finally {
      setPullRefreshing(false);
    }
  }

  async function enroll() {
    if (!selectedPack || enrolling) return;
    setEnrolling(true);
    setActionError(null);
    try {
      await customSrs.enrollPack(selectedPack.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Could not add this pack. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  function openStudy(mode: "lessons" | "reviews") {
    void Haptics.selectionAsync();
    router.push({ pathname: `/custom-vocabulary/${mode}`, params: selectedPack ? { packId: selectedPack.id } : {} } as never);
  }

  const search = (
    <View style={[styles.search, { backgroundColor: theme.cardBackground }]}>
      <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={selectedPack ? "Find a word" : "Find a pack or word"}
        placeholderTextColor={theme.textLight}
        accessibilityLabel={selectedPack ? "Find a word in this pack" : "Find a pack or word"}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.textColor }]}
      />
    </View>
  );

  function studyRow(mode: "lessons" | "reviews", count: number) {
    const disabled = customSrs.loading || count === 0;
    const label = mode === "lessons" ? "Lessons" : "Reviews";
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start ${selectedPack ? "" : "all custom "}${mode}, ${count} ${mode === "lessons" ? "available" : "due"}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => openStudy(mode)}
      style={({ pressed }) => [styles.studyRow, mode === "reviews" && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={mode === "lessons" ? "book-outline" : "refresh-outline"} size={20} color={disabled ? theme.textSecondary : colors.vocabulary} />
      <Text style={[styles.studyLabel, { color: disabled ? theme.textSecondary : theme.textColor }]}>{label}</Text>
      <Text style={[styles.studyCount, { color: disabled ? theme.textSecondary : colors.vocabulary }]}>{customSrs.loading ? "—" : count}</Text>
      <Ionicons name="chevron-forward" size={16} color={disabled ? theme.textLight : colors.vocabulary} />
    </Pressable>;
  }

  const header = (
    <View style={styles.listHeader}>
      {selectedPack ? <>
        <View style={[styles.packSummary, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.cardHeading}>
            <Ionicons name="albums-outline" size={20} color={colors.vocabulary} />
            <Text selectable style={[styles.summaryMeta, { color: theme.textColor }]}>{customVocabularyPackLabel(selectedPack)} · {selectedPack.words.length} words</Text>
            {isEnrolled ? <Ionicons name="checkmark-circle" size={19} color={colors.vocabulary} accessibilityLabel="Added to my packs" /> : null}
          </View>
          <Text selectable style={[styles.description, { color: theme.textSecondary }]}>{selectedPack.description}</Text>
          {isEnrolled && progress ? <View style={styles.packProgress}>
            <Text selectable style={[styles.meta, { color: theme.textSecondary }]}>{progress.total - progress.lessons} of {progress.total} learned{progress.burned ? ` · ${progress.burned} burned` : ""}</Text>
            <View accessibilityRole="progressbar" accessibilityLabel="Pack learning progress" accessibilityValue={{ min: 0, max: progress.total, now: progress.total - progress.lessons }} style={[styles.progressTrack, { backgroundColor: withAlpha(colors.vocabulary, 0.14) }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.vocabulary, width: `${100 * (progress.total - progress.lessons) / Math.max(progress.total, 1)}%` }]} />
            </View>
          </View> : null}
        </View>
          {!isEnrolled ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${selectedPack.title} to my packs`}
            accessibilityState={{ disabled: enrolling || customSrs.loading }}
            disabled={enrolling || customSrs.loading}
            onPress={() => void enroll()}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.vocabulary, opacity: pressed || enrolling || customSrs.loading ? 0.65 : 1 }]}
          >
            {enrolling ? <ActivityIndicator color={vocabularyInk} /> : <Ionicons name="add" size={20} color={vocabularyInk} />}
            <Text style={[styles.primaryButtonText, { color: vocabularyInk }]}>{enrolling ? "Adding pack…" : "Add to my packs"}</Text>
          </Pressable> : <View style={[styles.studyGroup, { backgroundColor: theme.cardBackground }]}>
            {studyRow("lessons", progress?.lessons ?? 0)}
            {studyRow("reviews", progress?.due ?? 0)}
          </View>}
      </> : <>
        {enrolledIds.size > 0 ? <View style={[styles.studyGroup, { backgroundColor: theme.cardBackground }]}>
          {studyRow("lessons", customSrs.lessonWords.length)}
          {studyRow("reviews", customSrs.reviewWords.length)}
        </View> : null}
      </>}
      {error ? <View style={[styles.error, { borderColor: theme.error }]}>
        <Text selectable accessibilityRole="alert" style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setActionError(null); void customSrs.refresh().catch(() => {}); }} style={styles.retry}>
          <Text style={[styles.buttonText, { color: theme.textColor }]}>Retry sync</Text>
        </Pressable>
      </View> : null}
      {search}
      {!selectedPack ? <SegmentedControl values={PACK_FILTERS} selectedIndex={filter} onChange={(event) => setFilter(event.nativeEvent.selectedSegmentIndex)} appearance={theme.isDark ? "dark" : "light"} style={styles.filters} /> : null}
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.textColor }]}>{selectedPack ? "Vocabulary" : PACK_FILTERS[filter]}</Text>
        <Text selectable style={[styles.meta, { color: theme.textSecondary }]}>{selectedPack ? `${words.length} words` : normalizedQuery || filter > 0 ? `${packs.length} packs` : `${CUSTOM_VOCABULARY_PACKS.length} packs · ${CUSTOM_VOCABULARY_WORDS.length} words`}</Text>
      </View>
      {customSrs.loading ? <ActivityIndicator accessibilityLabel="Loading cloud progress" color={colors.vocabulary} /> : null}
    </View>
  );

  function renderPack({ item: pack }: { item: CustomVocabularyPack }) {
    const packProgress = customPackProgress(customSrs.state, pack);
    const enrolled = enrolledIds.has(pack.id);
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pack.title}, ${pack.words.length} words${enrolled ? ", added to my packs" : ""}`}
      accessibilityHint={`${customVocabularyPackLabel(pack)}.${enrolled ? ` ${packProgress.total - packProgress.lessons} of ${packProgress.total} learned. ${packProgress.due} reviews due.` : ""} Opens pack details.`}
      onPress={() => { void Haptics.selectionAsync(); router.push({ pathname: "/custom-vocabulary", params: { packId: pack.id } } as never); }}
      style={({ pressed }) => [styles.packCard, { backgroundColor: theme.cardBackground, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.cardHeading}>
        <View style={styles.cardCopy}>
          <Text style={[styles.packTitle, { color: theme.textColor }]}>{pack.title}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{customVocabularyPackLabel(pack)} · {pack.words.length} words</Text>
        </View>
        {enrolled ? <Ionicons name="checkmark-circle" size={20} color={colors.vocabulary} /> : null}
        <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
      </View>
      <View style={styles.wordPreviews} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pack.words.slice(0, 3).map((word) => <View key={word.id} style={[styles.wordPreview, { backgroundColor: colors.vocabulary }]}>
          <Text numberOfLines={1} style={[styles.wordPreviewText, fontStyles.japaneseText, { color: vocabularyInk }]}>{word.characters}</Text>
        </View>)}
        {pack.words.length > 3 ? <Text style={[styles.previewRemaining, { color: theme.textSecondary }]}>+{pack.words.length - 3}</Text> : null}
      </View>
      {enrolled ? <View style={styles.cardProgress}>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{packProgress.total - packProgress.lessons}/{packProgress.total} learned</Text>
        {packProgress.due > 0 ? <Text style={[styles.dueLabel, { color: theme.textColor }]}>{packProgress.due} due</Text> : null}
      </View> : null}
    </Pressable>;
  }

  function renderWord({ item: word }: { item: CustomVocabularyWord }) {
    const status = assignmentLabel(customSrs.state.assignments[word.id]);
    return <Pressable accessibilityRole="button" accessibilityLabel={`${word.characters}, ${word.meanings[0]}${status ? `, ${status}` : ""}`} onPress={() => router.push({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId: word.id } } as never)} style={({ pressed }) => [styles.wordRow, { backgroundColor: theme.cardBackground, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.wordTile, { backgroundColor: colors.vocabulary }]}>
        <Text style={[styles.wordCharacters, fontStyles.japaneseText, { color: vocabularyInk }]}>{word.characters}</Text>
      </View>
      <View style={styles.wordCopy}>
        <Text style={[styles.meaning, { color: theme.textColor }]}>{word.meanings[0]}</Text>
        {customWordUsesKanji(word) ? <Text style={[styles.reading, fontStyles.japaneseText, { color: theme.textSecondary }]}>{word.reading}</Text> : null}
        {status ? <Text style={[styles.meta, { color: theme.textSecondary }]}>{status}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
    </Pressable>;
  }

  if (selectedPackId && !selectedPack) return <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
    <Stack.Screen options={{ headerShown: false, title: "Vocabulary packs" }} />
    <CustomVocabularyHeader title="Vocabulary packs" onBack={goBack} />
    <View style={styles.empty}>
      <Text selectable style={[styles.description, { color: theme.textColor }]}>This pack could not be found.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/custom-vocabulary" as never)} style={styles.retry}><Text style={{ color: colors.vocabulary }}>Explore packs</Text></Pressable>
    </View>
  </View>;

  const listProps = {
    contentInsetAdjustmentBehavior: "never" as const,
    keyboardShouldPersistTaps: "handled" as const,
    keyboardDismissMode: "on-drag" as const,
    style: { backgroundColor: theme.backgroundColor },
    contentContainerStyle: { paddingHorizontal: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 },
    ListHeaderComponent: header,
    ListEmptyComponent: <View style={styles.empty}><Text selectable style={[styles.description, { color: theme.textSecondary }]}>{normalizedQuery ? "No matches. Try another word or meaning." : filter === 1 ? "Choose a pack from All packs to start learning." : "No words to show."}</Text></View>,
    refreshControl: <RefreshControl refreshing={pullRefreshing} onRefresh={() => { void pullToRefresh(); }} tintColor={colors.vocabulary} />,
  };

  return <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
    <Stack.Screen options={{ headerShown: false, title: selectedPack?.title ?? "Vocabulary packs" }} />
    <CustomVocabularyHeader title={selectedPack?.title ?? "Vocabulary packs"} onBack={goBack} />
    {selectedPack ? <FlatList {...listProps} key={selectedPack.id} data={words} keyExtractor={(word) => word.id} renderItem={renderWord} ItemSeparatorComponent={PackSeparator} />
      : <FlatList {...listProps} key="packs" data={packs} keyExtractor={(pack) => pack.id} renderItem={renderPack} ItemSeparatorComponent={PackSeparator} />}
  </View>;
}

function PackSeparator() { return <View style={styles.packSeparator} />; }

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listHeader: { gap: 12, paddingTop: 12, paddingBottom: 12 },
  description: { fontSize: 14, lineHeight: 21 },
  packSummary: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 12 },
  summaryMeta: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 19, fontVariant: ["tabular-nums"] },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  packProgress: { gap: 8 },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5 },
  search: { minHeight: 44, borderRadius: 10, borderCurve: "continuous", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 12 },
  filters: { height: 34 },
  studyGroup: { borderRadius: 14, borderCurve: "continuous", paddingHorizontal: 14 },
  studyRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  studyLabel: { flex: 1, fontSize: 16, fontWeight: "600" },
  studyCount: { fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { fontSize: 16, fontWeight: "600" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  packCard: { padding: 14, borderRadius: 14, borderCurve: "continuous", gap: 10 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  packTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  wordPreviews: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordPreview: { minHeight: 30, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, maxWidth: "30%", flexShrink: 1 },
  wordPreviewText: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  previewRemaining: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  cardProgress: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  dueLabel: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  packSeparator: { height: 8 },
  wordRow: { minHeight: 76, padding: 12, borderRadius: 14, borderCurve: "continuous", flexDirection: "row", gap: 12, alignItems: "center" },
  wordTile: { width: "38%", maxWidth: 180, minHeight: 48, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  wordCopy: { flex: 1, gap: 3, minWidth: 0 },
  wordCharacters: { fontSize: 21, lineHeight: 29, fontWeight: "600", textAlign: "center" },
  reading: { fontSize: 14, lineHeight: 20 },
  meaning: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  empty: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  error: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  errorText: { fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 4 },
});
