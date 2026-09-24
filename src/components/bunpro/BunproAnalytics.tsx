import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { useBunproDashboard } from "../../hooks/useBunproDashboard";
import { allocateBunproTiles, BUNPRO_ANALYTICS_STAGES, bunproAnalyticsForecast, bunproAnalyticsSeries, bunproAnalyticsTotal, bunproCalendarDate, bunproReviewAccuracy, bunproReviewCalendar, formatBunproCalendarDate, type BunproAnalyticsData, type BunproAnalyticsKind, type BunproAnalyticsMode } from "../../utils/bunproAnalytics";
import { supportsNativeTabs } from "../../utils/nativeTabs";
import { useTheme } from "../../utils/theme";

const kinds: BunproAnalyticsKind[] = ["grammar", "vocab"];
const labels = { grammar: "Grammar", vocab: "Vocabulary" };
const colors = { grammar: "#cc5b5d", vocab: "#aa80c5" };
const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString();

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={[styles.panel, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
    <Text accessibilityRole="header" style={[styles.panelTitle, { color: theme.textColor }]}>{title}</Text>{children}
  </View>;
}

function Knowledge({ data, kind }: { data: BunproAnalyticsData; kind: BunproAnalyticsKind }) {
  const { theme } = useTheme();
  const stages = BUNPRO_ANALYTICS_STAGES.map(stage => ({ ...stage, value: data.srs?.[kind][stage.key] ?? 0 }));
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  const studied = data.facts?.[kind === "grammar" ? "grammar_studied" : "vocab_studied"] ?? (data.srs ? total : null);
  const due = data.due?.[kind === "grammar" ? "total_due_grammar" : "total_due_vocab"];
  const accuracy = bunproReviewAccuracy(data.reviewTotals, kind);
  const allocations = allocateBunproTiles(stages.map(stage => stage.value));
  const tiles = stages.flatMap((stage, index) => Array.from({ length: allocations[index] }, () => stage.color));
  if (!data.facts && !data.srs && !data.due && !accuracy) return null;
  return <Panel title={labels[kind]}>
    <View style={styles.row}>
      {studied != null ? <View style={styles.grow}><Text style={[styles.largeNumber, { color: theme.textColor }]}>{number(studied)}</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{kind === "grammar" ? "grammar points studied" : "words studied"}</Text></View> : null}
      {due != null ? <Pressable accessibilityRole="button" accessibilityLabel={`Review ${number(due)} Bunpro ${labels[kind].toLowerCase()} items`} onPress={() => router.push({ pathname: "/bunpro-reviews", params: { mode: kind } })} style={[styles.reviewButton, { borderColor: colors.grammar }]}>
        <Text style={[styles.reviewCount, { color: colors.grammar }]}>{number(due)}</Text><View style={styles.inline}><Text style={[styles.caption, { color: theme.textColor }]}>due</Text><Ionicons name="arrow-forward" size={16} color={theme.textColor} /></View>
      </Pressable> : null}
    </View>
    {accuracy ? <View style={[styles.accuracy, { borderColor: theme.border }]}><Text style={[styles.accuracyValue, { color: theme.textColor }]}>{accuracy.accuracy.toFixed(1)}%</Text><View style={styles.grow}><Text style={[styles.body, { color: theme.textColor }]}>Review accuracy</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{number(accuracy.correct)} correct / {number(accuracy.total)} answers</Text></View></View> : null}
    {data.srs ? <>
      <Svg width="100%" height={154} viewBox="0 0 408 185" accessible accessibilityRole="image" accessibilityLabel={`${labels[kind]} SRS composition. ${stages.map(stage => `${stage.label}: ${stage.value}`).join(', ')}. Each hexagon represents approximately 0.5 percent of items.`}>
        {Array.from({ length: 200 }, (_, index) => <Polygon key={index} points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5" transform={`translate(${10 + index % 20 * 20 + (Math.floor(index / 20) % 2 ? 10 : 0)},${11 + Math.floor(index / 20) * 18})`} fill={tiles[index] ?? theme.border} />)}
      </Svg>
      <Text style={[styles.caption, styles.center, { color: theme.textSecondary }]}>{total ? "Each hexagon ≈ 0.5% of SRS items" : "No SRS items yet"}</Text>
      <View style={styles.stageRows}>{stages.map(stage => <View key={stage.key} style={styles.stageRow}>
        <View style={[styles.swatch, { backgroundColor: stage.color }]} /><Text style={[styles.body, styles.grow, { color: theme.textColor }]}>{stage.label}</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{total ? Math.round(stage.value / total * 100) : 0}%</Text><Text style={[styles.stageValue, { color: theme.textColor }]}>{number(stage.value)}</Text>
      </View>)}</View>
      <View style={[styles.footer, { borderColor: theme.border }]}><Text style={[styles.caption, { color: theme.textSecondary }]}>Ghosts · {number(data.srs[kind].ghost)}</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>Self-study · {number(data.srs[kind].self_study)}</Text></View>
    </> : null}
  </Panel>;
}

function JlptProgress({ data, kind }: { data: NonNullable<BunproAnalyticsData["jlpt"]>; kind: BunproAnalyticsKind }) {
  const { theme } = useTheme();
  const levels = (["5", "4", "3", "2", "1"] as const).filter(level => data[kind][level].total_count > 0);
  if (!levels.length) return null;
  return <Panel title={`${labels[kind]} · JLPT`}>
    {levels.map(level => {
      const row = data[kind][level];
      const studied = BUNPRO_ANALYTICS_STAGES.reduce((sum, stage) => sum + row[stage.key], 0);
      return <View key={level} style={styles.jlptRow} accessible accessibilityLabel={`N${level}: ${studied} of ${row.total_count} studied. ${BUNPRO_ANALYTICS_STAGES.map(stage => `${stage.label}: ${row[stage.key]}`).join(', ')}`}>
        <Text style={[styles.jlptLabel, { color: theme.textColor }]}>N{level}</Text><View style={styles.grow}>
          <View style={styles.row}><Text style={[styles.caption, { color: theme.textSecondary }]}>{number(studied)} / {number(row.total_count)}</Text><Text style={[styles.caption, { color: theme.textColor }]}>{Math.min(100, Math.round(studied / row.total_count * 100))}%</Text></View>
          <View style={[styles.jlptTrack, { backgroundColor: theme.border }]}>{BUNPRO_ANALYTICS_STAGES.map(stage => <View key={stage.key} style={{ height: "100%", width: `${row[stage.key] / Math.max(studied, row.total_count) * 100}%`, backgroundColor: stage.color }} />)}</View>
        </View>
      </View>;
    })}
  </Panel>;
}

type Series = ReturnType<typeof bunproAnalyticsSeries>;
function SeriesChart({ title, rows, visibleKinds, forecast = false }: { title: string; rows: Series; visibleKinds: BunproAnalyticsKind[]; forecast?: boolean }) {
  const { theme } = useTheme();
  const [showValues, setShowValues] = useState(false);
  const maximum = Math.max(1, ...rows.flatMap(row => visibleKinds.map(kind => row[kind] ?? 0)));
  const complete = rows.every(row => visibleKinds.every(kind => row[kind] != null));
  const total = rows.reduce((sum, row) => sum + visibleKinds.reduce((count, kind) => count + (row[kind] ?? 0), 0), 0);
  if (!rows.length) return null;
  return <Panel title={title}>
    {complete ? <Text style={[styles.body, { color: theme.textSecondary }]}><Text style={[styles.emphasis, { color: theme.textColor }]}>{number(total)}</Text> {forecast ? "scheduled in this forecast" : "reviews in this period"}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.chart} accessibilityLabel={`${title} chart`}>
      {rows.map(row => <View key={row.key} style={styles.chartColumn} accessible accessibilityLabel={`${row.label}. ${visibleKinds.map(kind => `${labels[kind]}: ${row[kind] ?? 'unavailable'}`).join(', ')}`}>
        <View style={styles.chartBars}>{visibleKinds.map(kind => <View key={kind} style={styles.chartBarColumn}><Text style={[styles.chartValue, { color: theme.textSecondary }]}>{number(row[kind])}</Text><View style={[styles.chartBar, { height: row[kind] == null ? 0 : row[kind] / maximum * 104, backgroundColor: colors[kind] }]} /></View>)}</View>
        <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>{row.label}</Text>
      </View>)}
    </ScrollView>
    <View style={styles.legend}>{visibleKinds.map(kind => <View style={styles.inline} key={kind}><View style={[styles.swatch, { backgroundColor: colors[kind] }]} /><Text style={[styles.caption, { color: theme.textSecondary }]}>{labels[kind]}</Text></View>)}</View>
    <Pressable onPress={() => setShowValues(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: showValues }} style={styles.textButton}><Text style={[styles.body, { color: theme.textColor }]}>{showValues ? "Hide chart data" : "Show chart data"}</Text><Ionicons name={showValues ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} /></Pressable>
    {showValues ? <View style={styles.stageRows}>{rows.map(row => <View key={row.key} style={styles.dataRow}><Text style={[styles.caption, { color: theme.textColor }]}>{row.label}</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{visibleKinds.map(kind => `${labels[kind]} ${number(row[kind])}`).join(" · ")}</Text></View>)}</View> : null}
    {forecast ? <Text style={[styles.caption, { color: theme.textSecondary }]}>New lessons and review results can change this schedule.</Text> : null}
  </Panel>;
}

function ReviewCalendar({ data, mode, endKey }: { data: NonNullable<BunproAnalyticsData["heatmap"]>; mode: BunproAnalyticsMode; endKey?: string }) {
  const { theme } = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showDays, setShowDays] = useState(false);
  const days = useMemo(() => bunproReviewCalendar(data, mode, endKey), [data, mode, endKey]);
  const maximum = Math.max(1, ...days.map(day => day.value));
  const active = days.filter(day => day.value > 0);
  const selected = days.find(day => day.key === selectedKey);
  if (!days.length) return null;
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return <Panel title="Review calendar">
    <Text style={[styles.body, { color: theme.textSecondary }]}><Text style={[styles.emphasis, { color: theme.textColor }]}>{active.length}</Text> days with recorded reviews · last 26 weeks</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.calendar}>
      <View style={styles.calendarWeek}><Text style={[styles.calendarMonth, { color: theme.textSecondary }]}> </Text>{["M", "", "W", "", "F", "", ""].map((day, index) => <Text style={[styles.calendarWeekday, { color: theme.textSecondary }]} key={index}>{day}</Text>)}</View>
      {weeks.map((week, index) => <View style={styles.calendarWeek} key={week[0].key}><Text style={[styles.calendarMonth, { color: theme.textSecondary }]}>{index === 0 || week[0].key.slice(5, 7) !== weeks[index - 1][0].key.slice(5, 7) ? formatBunproCalendarDate(week[0].key, { month: "short" }) : ""}</Text>{week.map(day => <Pressable key={day.key} accessibilityLabel={day.label} accessibilityRole="button" onPress={() => setSelectedKey(day.key)} style={[styles.calendarCell, { backgroundColor: day.value ? colors.grammar : theme.border, opacity: day.value ? 0.35 + 0.65 * Math.sqrt(day.value / maximum) : 1, borderColor: selectedKey === day.key ? theme.textColor : "transparent" }]} />)}</View>)}
    </ScrollView>
    <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: theme.textSecondary }]}>{selected?.label ?? "Tap a day to see its review count."}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDays }} onPress={() => setShowDays(value => !value)} style={styles.textButton}><Text style={[styles.body, { color: theme.textColor }]}>{showDays ? "Hide recorded days" : "Show recorded days"}</Text><Ionicons name={showDays ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} /></Pressable>
    {showDays ? active.length ? active.map(day => <View key={day.key} style={styles.dataRow}><Text style={[styles.caption, { color: theme.textSecondary }]}>{formatBunproCalendarDate(day.key)}</Text><Text style={[styles.caption, { color: theme.textColor }]}>{number(day.value)} reviews</Text></View>) : <Text style={[styles.caption, { color: theme.textSecondary }]}>No recorded reviews in this period.</Text> : null}
  </Panel>;
}

export default function BunproAnalytics() {
  const { theme } = useTheme();
  const { analytics: data, status, refreshing, error, refresh } = useBunproDashboard({ scope: "analytics" });
  const [mode, setMode] = useState<BunproAnalyticsMode>("all");
  const visibleKinds = mode === "all" ? kinds : [mode];
  const activity = useMemo(() => bunproAnalyticsSeries(data?.activity ?? null), [data?.activity]);
  const forecast = useMemo(() => bunproAnalyticsForecast(data?.forecast ?? null), [data?.forecast]);
  if (status === "disabled") return null;
  if (!data && status === "loading") return <View style={styles.empty}><ActivityIndicator color={colors.grammar} /><Text style={[styles.body, { color: theme.textSecondary }]}>Loading Bunpro analytics…</Text></View>;
  if (!data) return <View style={styles.empty}>
    <Text style={[styles.panelTitle, { color: theme.textColor }]}>{status === "unconfigured" ? "Connect Bunpro" : "Bunpro analytics are unavailable"}</Text><Text style={[styles.body, styles.center, { color: theme.textSecondary }]}>{error ?? "Add your Bunpro API key to see your grammar and vocabulary progress."}</Text>
    {status !== "unconfigured" ? <Pressable accessibilityRole="button" onPress={() => void refresh()} disabled={refreshing} style={styles.action}><Text style={[styles.body, { color: colors.grammar }]}>Try again</Text></Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/(bunpro-tabs)")} style={styles.action}><Text style={[styles.body, { color: colors.grammar }]}>Bunpro settings</Text></Pressable>
  </View>;
  const facts = data.facts;
  const studied = facts ? bunproAnalyticsTotal(facts.grammar_studied, facts.vocab_studied, mode) : null;
  return <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, supportsNativeTabs() && styles.nativePadding]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.grammar} colors={[colors.grammar]} />}>
    <View accessibilityRole="tablist" style={[styles.filters, { borderColor: theme.border }]}>{([['all', 'All study'], ['grammar', 'Grammar'], ['vocab', 'Vocabulary']] as const).map(([key, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === key }} onPress={() => setMode(key)} key={key} style={[styles.filter, { borderBottomColor: mode === key ? colors.grammar : "transparent" }]}><Text style={[styles.filterLabel, { color: mode === key ? theme.textColor : theme.textSecondary }]}>{label}</Text></Pressable>)}</View>
    {error || data.unavailable.length ? <View accessibilityRole="alert" style={[styles.notice, { borderColor: theme.border }]}><Text style={[styles.body, { color: theme.textSecondary }]}>{error ? "Refresh failed. Showing your last loaded statistics." : "Some Bunpro statistics are unavailable. Other panels are up to date."}</Text><Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void refresh()} style={styles.action}><Text style={[styles.body, { color: colors.grammar }]}>Retry</Text></Pressable></View> : null}
    {facts ? <Panel title="Study streak">
      <View style={styles.row}><View style={styles.grow}><Text style={[styles.largeNumber, { color: theme.textColor }]}>{number(facts.streak)} <Text style={styles.body}>{facts.streak === 1 ? "day" : "days"}</Text></Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{number(facts.days_studied)} days studied in total</Text></View>{studied != null ? <View style={styles.alignEnd}><Text style={[styles.accuracyValue, { color: theme.textColor }]}>{number(studied)}</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>total studied</Text></View> : null}</View>
      <View style={styles.week}>{facts.weekly_streak.map((day, index) => <View key={`${day.day}-${index}`} style={styles.weekDay} accessible accessibilityLabel={`${formatBunproCalendarDate(day.day)}: ${day.val ? "Studied" : "Not studied"}`}>
        <Text style={[styles.weekLabel, { color: theme.textSecondary }]}>{formatBunproCalendarDate(day.day, { weekday: "short" })}</Text><View style={[styles.streakDay, { backgroundColor: day.val ? colors.grammar : theme.border }]}>{day.val ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}</View><Text style={[styles.weekLabel, { color: theme.textSecondary }]}>{bunproCalendarDate(day.day)?.getUTCDate() ?? ""}</Text>
      </View>)}</View>
    </Panel> : null}
    {visibleKinds.map(kind => <Knowledge key={kind} data={data} kind={kind} />)}
    {data.jlpt ? visibleKinds.map(kind => <JlptProgress key={kind} kind={kind} data={data.jlpt!} />) : null}
    {data.heatmap && Object.keys(data.heatmap.grammar).length + Object.keys(data.heatmap.vocab).length > 0 ? <ReviewCalendar data={data.heatmap} mode={mode} endKey={facts?.weekly_streak.at(-1)?.day} /> : null}
    {data.cram && data.cram.sessions.session_count > 0 ? <Panel title="Extra practice"><Text style={[styles.body, { color: theme.textColor }]}>{number(data.cram.sessions.session_count)} cram sessions · {number(data.cram.items.total)} questions</Text><Text style={[styles.caption, { color: theme.textSecondary }]}>{data.cram.items.accuracy}% correct · {data.cram.sessions.total_time}</Text></Panel> : null}
    <SeriesChart title="Upcoming reviews" rows={forecast} visibleKinds={visibleKinds} forecast />
    <SeriesChart title="Review activity" rows={activity} visibleKinds={visibleKinds} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 32, gap: 16 }, nativePadding: { paddingBottom: 120 },
  panel: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 }, panelTitle: { fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  grow: { flex: 1 }, largeNumber: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] }, body: { fontSize: 14, lineHeight: 20 }, caption: { fontSize: 12, lineHeight: 18 }, emphasis: { fontSize: 20, fontWeight: "700" }, center: { textAlign: "center" }, alignEnd: { alignItems: "flex-end" },
  reviewButton: { minWidth: 68, minHeight: 64, borderRadius: 8, borderWidth: 1, padding: 8, alignItems: "center" }, reviewCount: { fontSize: 24, fontWeight: "700" },
  accuracy: { flexDirection: "row", gap: 12, alignItems: "center", borderTopWidth: 1, paddingTop: 12 }, accuracyValue: { fontSize: 24, fontWeight: "700" },
  stageRows: { gap: 8 }, stageRow: { flexDirection: "row", alignItems: "center", gap: 10 }, stageValue: { minWidth: 52, textAlign: "right", fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] }, swatch: { width: 10, height: 10, borderRadius: 2 }, footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, borderTopWidth: 1, paddingTop: 12 },
  jlptRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 4 }, jlptLabel: { fontSize: 15, fontWeight: "700", width: 25 }, jlptTrack: { height: 12, borderRadius: 3, overflow: "hidden", flexDirection: "row", marginTop: 6 },
  filters: { flexDirection: "row", borderBottomWidth: 1 }, filter: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, paddingHorizontal: 4 }, filterLabel: { fontSize: 13, fontWeight: "600" },
  week: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginTop: 4 }, weekDay: { flex: 1, alignItems: "center", gap: 6 }, weekLabel: { fontSize: 11 }, streakDay: { height: 28, width: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 12 }, action: { minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 12 }, notice: { padding: 12, borderRadius: 8, borderWidth: 1 },
  chart: { alignItems: "flex-end", gap: 12, paddingVertical: 8 }, chartColumn: { width: 78, gap: 8 }, chartBars: { height: 134, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4 }, chartBarColumn: { alignItems: "center", width: 37 }, chartValue: { fontSize: 10, marginBottom: 5, fontVariant: ["tabular-nums"] }, chartBar: { width: 25, borderTopLeftRadius: 2, borderTopRightRadius: 2 }, chartLabel: { fontSize: 11, lineHeight: 16, height: 32, textAlign: "center" }, legend: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  textButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }, dataRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, paddingVertical: 4 },
  calendar: { gap: 4, paddingVertical: 8, paddingRight: 24 }, calendarWeek: { gap: 4, width: 16 }, calendarCell: { width: 16, height: 16, borderRadius: 3, borderWidth: 1 }, calendarWeekday: { fontSize: 10, height: 16 }, calendarMonth: { fontSize: 10, height: 18, width: 34 },
});
