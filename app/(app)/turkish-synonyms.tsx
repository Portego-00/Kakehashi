import {packageManager} from "../../src/features/translation-packages/package-store";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Alert, AppState, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAuthStore} from "../../src/utils/store";
import {useTheme} from "../../src/utils/theme";
import {prepareSynonymPreview, synonymTransport, transferJournal, transferRunner} from "../../src/features/translation-packages/synonym-transfer-api";
import {synonymKey, transferCounts, type StudyState, type TransferFilters, type TransferJob, type TransferRow} from "../../src/features/translation-packages/synonym-transfer";

const stateLabels: Record<StudyState, string> = {learning: "Learning", unstarted: "Lessons not started", burned: "Burned", locked: "Not unlocked"};
export default function TurkishSynonyms() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuthStore(state => state.apiToken);
  const user = useAuthStore(state => state.userData);
  const account = user?.id;
  const maxLevel = Math.min(60, user?.level ?? 1);
  const [filters, setFilters] = useState<TransferFilters>({levels: [maxLevel], types: ["radical", "kanji", "vocabulary"], states: ["learning"]});
  const [from, setFrom] = useState(String(maxLevel));
  const [to, setTo] = useState(String(maxLevel));
  const previewPacket = useRef<unknown>(null);
  const listRef = useRef<FlatList<TransferRow>>(null);
  const [preview, setPreview] = useState<TransferRow[] | null>(null);
  const [job, setJob] = useState<TransferJob | null>(null);
  const [history, setHistory] = useState<TransferJob[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const [previewLevel, setPreviewLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sameAccount = useCallback(() => useAuthStore.getState().apiToken === token && useAuthStore.getState().userData?.id === account, [token, account]);
  const loadHistory = useCallback(async () => {
    if (!account) return;
    try { const jobs = await transferJournal.load(account); if (sameAccount()) setHistory(jobs); }
    catch { if (sameAccount()) setError("Could not read transfer history. Do not start another transfer until this is resolved."); }
  }, [account, sameAccount]);
  useEffect(() => {
    transferRunner.pause(); setPreview(null); setJob(null); setHistory([]); setError(null);
    const level = Math.min(60, useAuthStore.getState().userData?.level ?? 1);
    setFilters({levels: [level], types: ["radical", "kanji", "vocabulary"], states: ["learning"]}); setFrom(String(level)); setTo(String(level));
    void loadHistory();
    return () => {transferRunner.pause();};
  }, [loadHistory]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {if (state !== "active") transferRunner.pause();});
    return () => subscription.remove();
  }, []);
  const fail = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "The operation stopped. You can retry from history.";
    setError(/(?:HTTP |API error: )403/.test(message) ? "Your API token needs permission to create and update Study Materials. Check its permissions, then resume." :
      /(?:HTTP |API error: )401/.test(message) ? "Your WaniKani token is no longer valid. Sign in again before resuming." : message);
  };
  const button = (label: string, action: () => void, disabled = busy) => <TouchableOpacity key={label} accessibilityRole="button" accessibilityState={{disabled}}
    disabled={disabled} onPress={action} style={[styles.button, {borderColor: theme.border, opacity: disabled ? .5 : 1}]}>
    <Text style={{color: theme.primary}}>{label}</Text></TouchableOpacity>;
  const chip = (label: string, selected: boolean, action: () => void, disabled = busy) => <TouchableOpacity key={label} accessibilityRole="checkbox"
    accessibilityLabel={label} accessibilityState={{checked: selected, disabled}} disabled={disabled} onPress={action}
    style={[styles.chip, {borderColor: theme.primary, backgroundColor: selected ? theme.primary : theme.cardBackground, opacity: disabled ? .4 : 1}]}>
    <Text style={{color: selected ? "white" : theme.textColor}}>{label}</Text></TouchableOpacity>;
  function toggle<K extends keyof TransferFilters>(key: K, value: TransferFilters[K][number]) {
    setFilters(current => ({...current, [key]: current[key].includes(value as never) ? current[key].filter(item => item !== value) : [...current[key], value]}));
    setPreview(null); setJob(null);
  }
  async function prepare() {
    if (!token || !account) return;
    if (transferRunner.isRunning()) {setError("Wait for the current transfer to pause."); return;}
    setBusy(true); setError(null); setJob(null);
    try {
      const jobs = await transferJournal.load(account);
      if (jobs.some(saved => saved.rows.some(row => ["pending", "writing", "undoing"].includes(row.status))))
        throw new Error("Finish or undo the unfinished transfer in History before preparing another one.");
      previewPacket.current = packageManager.state.getState().packet;
      const rows = await prepareSynonymPreview(token, filters);
      if (sameAccount()) {setPreview(rows); setShowExisting(false); setPreviewLevel(null); setPage(0);}
    } catch (cause) {if (sameAccount()) fail(cause);}
    finally {setBusy(false);}
  }
  async function execute(saved: TransferJob, operation: "add" | "undo", create = false) {
    if (!token || !sameAccount() || saved.account !== account) return;
    if (create && previewPacket.current !== packageManager.state.getState().packet) {setError("The translation package changed. Prepare a new preview."); return;}
    if (transferRunner.isRunning()) {setError("Wait for the current transfer to pause."); return;}
    setBusy(true); setError(null); setJob(saved); setPreview(null);
    try {
      if (!create) {
        const latest = (await transferJournal.load(saved.account)).find(value => value.id === saved.id);
        if (!latest) throw new Error("Transfer history could not be verified.");
        saved = latest; setJob(saved);
      }
      const executionPacket = packageManager.state.getState().packet;
      await transferRunner.run(saved, synonymTransport(token, () => sameAccount() && (operation === "undo" || packageManager.state.getState().packet === executionPacket), saved.filters, operation === "undo"), sameAccount, () => {
        if (sameAccount()) setJob({...saved, rows: [...saved.rows]});
      }, operation, 5500, create);
    } catch (cause) {if (sameAccount()) fail(cause);}
    finally {setBusy(false); await loadHistory();}
  }
  function confirm(saved: TransferJob, operation: "add" | "undo", create = false) {
    const remaining = transferCounts(saved.rows.filter(row => ["pending", "writing"].includes(row.status)));
    const owned = saved.rows.filter(row => row.status !== "undone").reduce((sum, row) => sum + row.added.length, 0);
    Alert.alert(operation === "add" ? "Add Turkish synonyms to WaniKani?" : "Undo this transfer?",
      operation === "add" ? `Account: ${user?.username}\nLevels: ${saved.filters.levels.slice().sort((a,b) => a-b).join(", ")}\n${remaining.subjects} topics · up to ${remaining.synonyms} new synonyms. Existing synonyms and notes are preserved. These become accepted meaning answers on your account.` :
      `Account: ${user?.username}\nRemove up to ${owned} additions recorded by this transfer and cancel its remaining items. Existing and uncertain additions will be kept.`,
      [{text: "Cancel", style: "cancel"}, {text: operation === "add" ? "Add selected synonyms" : "Undo recorded additions", onPress: () => {void execute(saved, operation, create);}}]);
  }
  function start() {
    if (!account || !preview) return;
    const rows = preview.filter(row => row.selected.length).map(row => ({...row, selected: [...row.selected]}));
    if (!rows.length) return;
    confirm({id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, account, createdAt: new Date().toISOString(),
      filters: {...filters, levels: [...filters.levels], types: [...filters.types], states: [...filters.states]}, rows, operation: "add"}, "add", true);
  }
  const rows = job?.rows ?? preview ?? [];
  const count = transferCounts(rows);
  const availableRows = preview ? rows.filter(row => row.candidates.some(value => !row.existing.some(existing => synonymKey(existing) === synonymKey(value)))) : rows;
  const visibleRows = preview ? (showExisting ? rows : availableRows).filter(row => previewLevel === null || row.level === previewLevel) : rows;
  const pageSize = 30;
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(visibleRows.length / pageSize) - 1));
  useEffect(() => {setPage(0);}, [previewLevel, showExisting]);
  const header = <View style={{padding: 16}}>
    <Text style={[styles.title, {color: theme.textColor}]}>Turkish synonyms</Text>
    <Text style={{color: theme.textSecondary}}>Choose levels and topics, review each meaning, then confirm. This changes your WaniKani account. Suggestions use the explicit synonym answers in your imported translation file. Review them before confirming.</Text>
    {!job && <>
      <Text style={[styles.heading, {color: theme.textColor}]}>Levels</Text>
      <View style={styles.wrap}>{Array.from({length: maxLevel}, (_, i) => i+1).map(level => chip(String(level), filters.levels.includes(level), () => toggle("levels", level), busy || level > maxLevel))}</View>
      <View style={styles.wrap}>
        <Text style={{color: theme.textSecondary}}>From</Text><TextInput accessibilityLabel="First level" value={from} onChangeText={setFrom} editable={!busy} keyboardType="number-pad" style={[styles.input, {color: theme.textColor, borderColor: theme.border}]} />
        <Text style={{color: theme.textSecondary}}>To</Text><TextInput accessibilityLabel="Last level" value={to} onChangeText={setTo} editable={!busy} keyboardType="number-pad" style={[styles.input, {color: theme.textColor, borderColor: theme.border}]} />
        {button("Select range", () => {
          const low = Number(from), high = Number(to);
          if (!Number.isInteger(low) || !Number.isInteger(high) || low < 1 || high < low || high > maxLevel) {setError(`Choose a range from 1 to ${maxLevel}.`); return;}
          setFilters(current => ({...current, levels: Array.from({length: high-low+1}, (_, i) => low+i)})); setPreview(null);
        })}
      </View>
      <Text style={[styles.heading, {color: theme.textColor}]}>Subject types</Text>
      <View style={styles.wrap}>{["radical", "kanji", "vocabulary"].map(type => chip(type === "vocabulary" ? "Vocabulary (including kana)" : type === "kanji" ? "Kanji" : "Radicals", filters.types.includes(type), () => toggle("types", type)))}</View>
      <Text style={[styles.heading, {color: theme.textColor}]}>Study state</Text>
      <View style={styles.wrap}>{(Object.keys(stateLabels) as StudyState[]).map(state => chip(stateLabels[state], filters.states.includes(state), () => toggle("states", state)))}</View>
      {button("Prepare preview", () => {void prepare();}, busy || !token || !account || !filters.levels.length || !filters.types.length || !filters.states.length)}
    </>}
    {!account && <Text style={{color: theme.textColor}}>Sign in to WaniKani before preparing a transfer.</Text>}
    {busy && <Text accessibilityRole="alert" style={[styles.heading, {color: theme.textColor}]}>{job ? `Processed: ${count.completed}/${job.rows.length}` : "Checking current subjects and synonyms…"}</Text>}
    {job && <>
      <Text style={[styles.heading, {color: theme.textColor}]}>{count.completed}/{job.rows.length} processed · {count.added} recorded additions</Text>
      {count.uncertain > 0 && <Text style={{color: theme.textSecondary}}>{count.uncertain} meanings were found after an interrupted request. Ownership could not be verified; undo keeps them.</Text>}
      {busy ? button("Pause after current item", () => transferRunner.pause(), false) : <>
        {job.operation === "add" && job.rows.some(row => ["pending", "writing"].includes(row.status)) && button("Resume transfer", () => confirm(job, "add"))}
        {job.rows.some(row => row.status !== "undone") && button(job.operation === "undo" ? "Continue undo" : "Undo / cancel this transfer", () => confirm(job, "undo"))}
        {button("Back to selection", () => {setJob(null); setPreview(null);})}
      </>}
    </>}
    {preview && <>
      <Text style={[styles.heading, {color: theme.textColor}]}>{count.subjects} selected topics · {count.synonyms} new synonyms</Text>
      <Text style={{color: theme.textSecondary}}>Review the suggestions below. Uncheck a topic or an individual meaning. Existing synonyms are kept and are not added again.</Text>
      <Text style={{color: theme.textSecondary}}>{rows.length - availableRows.length} topics have no new synonyms and are hidden by default.</Text>
      {button(showExisting ? "Hide topics with no new synonyms" : "Show topics with no new synonyms", () => setShowExisting(value => !value))}
      <View style={styles.wrap}>{chip("All selected levels", previewLevel === null, () => setPreviewLevel(null))}{[...new Set(rows.map(row => row.level))].sort((a,b) => a-b).map(level => chip(`Level ${level}`, previewLevel === level, () => setPreviewLevel(level)))}</View>
      {availableRows.length === 0 && <Text style={{color: theme.textSecondary}}>All matching suggestions are already accepted or saved. Nothing new to add.</Text>}
      {button("Deselect all", () => setPreview(current => current!.map(row => ({...row, selected: []}))))}
      {button("Add selected synonyms…", start, busy || !count.synonyms)}
      {!preview.length && <Text style={{color: theme.textSecondary}}>No matching topics with reviewed translations.</Text>}
    </>}
    {error && <Text accessibilityRole="alert" style={[styles.heading, {color: theme.textColor}]}>{error}</Text>}
    {!!history.length && <>
      <Text style={[styles.heading, {color: theme.textColor}]}>History (this device)</Text>
      {history.map(saved => button(`${new Date(saved.createdAt).toLocaleString()} · ${saved.rows.length} topics · ${transferCounts(saved.rows).completed} processed`, () => {setJob(saved); setPreview(null);}))}
    </>}
  </View>;
  const renderRow = ({item}: {item: TransferRow}) => {
    const currentKeys = new Set(item.existing.map(synonymKey));
    return <View style={[styles.card, {backgroundColor: theme.cardBackground, borderColor: theme.border}]}>
      <Text style={[styles.heading, {color: theme.textColor}]}>{item.word} · Level {item.level} · {item.type} · {stateLabels[item.studyState]}</Text>
      {preview && chip("Include this topic", !!item.selected.length, () => setPreview(current => current!.map(row => row.id !== item.id ? row : {...row, selected: row.selected.length ? [] : row.candidates.filter(value => !currentKeys.has(synonymKey(value)))})))}
      <View style={styles.wrap}>{item.candidates.map(value => preview ? chip(`${value}${currentKeys.has(synonymKey(value)) ? " · Existing" : ""}`, item.selected.includes(value), () => setPreview(current => current!.map(row => row.id !== item.id ? row : {...row, selected: row.selected.includes(value) ? row.selected.filter(candidate => candidate !== value) : [...row.selected, value]})), busy || currentKeys.has(synonymKey(value))) : <Text key={value} style={{color: theme.textColor, padding: 6}}>{value}</Text>)}</View>
      {item.existing.length > 0 && <Text style={{color: theme.textSecondary}}>Existing: {item.existing.join(", ")}</Text>}
      {job && <Text style={{color: theme.textSecondary}}>{item.status}{item.added.length ? ` · Added: ${item.added.join(", ")}` : ""}{item.uncertain.length ? ` · Uncertain: ${item.uncertain.join(", ")}` : ""}</Text>}
      {item.error && <Text style={{color: theme.textColor}}>{item.error}</Text>}
    </View>;
  };
  return <View style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.backgroundColor}}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{padding: 16}}><Ionicons name="arrow-back" size={24} color={theme.textColor}/></TouchableOpacity>
    <FlatList ref={listRef} data={visibleRows.slice(safePage * pageSize, (safePage + 1) * pageSize)} ListFooterComponent={<View style={{padding: 16}}><Text style={{color: theme.textSecondary}}>{visibleRows.length ? `Page ${safePage + 1} of ${Math.ceil(visibleRows.length / pageSize)} · ${visibleRows.length} topics` : "No topics to display"}</Text><View style={styles.wrap}>{button("Previous page", () => {setPage(safePage - 1); listRef.current?.scrollToOffset({offset: 0, animated: false});}, busy || safePage === 0)}{button("Next page", () => {setPage(safePage + 1); listRef.current?.scrollToOffset({offset: 0, animated: false});}, busy || (safePage + 1) * pageSize >= visibleRows.length)}</View></View>} keyExtractor={item => String(item.id)} renderItem={renderRow} ListHeaderComponent={header} extraData={{busy, preview, job}} />
  </View>;
}
const styles = StyleSheet.create({title: {fontSize: 24, fontWeight: "700", marginBottom: 8}, heading: {fontSize: 16, fontWeight: "600", marginTop: 14, marginBottom: 8},
  wrap: {flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8}, chip: {borderWidth: 1, borderRadius: 8, padding: 9}, button: {borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 5},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, width: 65}, card: {marginHorizontal: 16, marginBottom: 12, padding: 12, borderWidth: 1, borderRadius: 12}});
