import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { BunproJsonApiResource } from "../../types/bunpro";
import { getBunproCoverage, saveBunproCoverage } from "../../utils/bunproApi";
import { coverageItems, coverageStage } from "../../../web/src/features/bunpro/coverage";
import { sanitizeText } from "../../../web/src/features/bunpro/model";
import { useTheme } from "../../utils/theme";

const grades = [[0, "Beginner"], [4, "Adept"], [10, "Expert"], [12, "Master"]] as const;

export function BunproCoverage({ vocabulary, deckId }: { vocabulary: BunproJsonApiResource[]; deckId?: number }) {
  const { theme } = useTheme();
  const [reviews, setReviews] = useState<BunproJsonApiResource[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [checking, setChecking] = useState<ReturnType<typeof coverageItems> | null>(null);
  const idsKey = vocabulary.map(item => Number(item.attributes.id ?? item.id)).join(",");
  useEffect(() => {
    const controller = new AbortController();
    setReviews(null); setError("");
    getBunproCoverage(idsKey.split(",").map(Number), controller.signal).then(value => { if (!controller.signal.aborted) setReviews(value); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load vocabulary progress."); });
    return () => controller.abort();
  }, [idsKey, attempt]);
  const items = coverageItems(vocabulary, reviews ?? []);
  const learned = items.filter(item => item.learned);
  const unlearned = items.filter(item => !item.learned);
  const action = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ minHeight: 44, paddingVertical: 10, opacity: disabled ? .4 : 1 }}><Text style={{ color: theme.textColor, fontWeight: "600" }}>{label}</Text></Pressable>;
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <View style={{ padding: 24, gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: theme.textColor, fontSize: 20, fontWeight: "600" }}>Vocab Coverage</Text>
    {reviews ? <Text style={{ color: theme.textSecondary }}>You’ve covered {Math.round(learned.length / Math.max(1, items.length) * 100)}% of this item’s vocabulary · {learned.length}/{items.length}</Text> : error ? <><Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text>{action("Retry progress", () => setAttempt(value => value + 1))}</> : <ActivityIndicator accessibilityLabel="Loading vocabulary progress" />}
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>{action(expanded ? "Collapse List" : "Expand List", () => setExpanded(!expanded))}{action("Knowledge Check", () => setChecking(unlearned), !reviews || !unlearned.length)}</View>
    {expanded && reviews ? [unlearned, learned].map((group, index) => <View key={index} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: theme.textColor, fontWeight: "600" }}>{index ? "Learned items" : "New to you"} ({group.length})</Text>{action(`Select all ${index ? "learned items" : "new to you"}`, () => setSelected(current => group.every(item => current.includes(item.id)) ? current.filter(id => !group.some(item => item.id === id)) : [...new Set([...current, ...group.map(item => item.id)])]))}</View>
      {group.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={`Select ${sanitizeText(item.resource.attributes.title)}`} accessibilityState={{ checked: selected.includes(item.id) }} onPress={() => toggle(item.id)} style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: selected.includes(item.id) ? "#cc5b5d" : theme.border }}>
        <Text style={{ color: theme.textColor, fontSize: 20 }}>{sanitizeText(item.resource.attributes.title)} {selected.includes(item.id) ? "✓" : ""}</Text><Text style={{ color: theme.textSecondary }}>{sanitizeText(item.resource.attributes.kana)} · {sanitizeText(item.resource.attributes.meaning)}</Text>
      </Pressable>)}
    </View>) : null}
    {expanded && selected.length ? <>{action(`Knowledge Check ${selected.length} selected`, () => setChecking(items.filter(item => selected.includes(item.id))))}{action("Stop Selecting", () => setSelected([]))}</> : null}
    {selected.length === 1 && typeof items.find(item => item.id === selected[0])?.resource.attributes.slug === "string" ? action("Open in Bunpro", () => { const item = items.find(item => item.id === selected[0]); if (item) void Linking.openURL(`https://bunpro.jp/vocabs/${encodeURIComponent(String(item.resource.attributes.slug))}`); }) : null}
    {checking ? <KnowledgeCheck items={checking} deckId={deckId} onClose={() => setChecking(null)} onSaved={() => { setSelected([]); setAttempt(value => value + 1); }} /> : null}
  </View>;
}

function KnowledgeCheck({ items, deckId, onClose, onSaved }: { items: ReturnType<typeof coverageItems>; deckId?: number; onClose: () => void; onSaved: () => void }) {
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [assigned, setAssigned] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const pending = useRef<Record<number, number>>({});
  const item = items[index];
  const grade = (streak?: number) => { if (streak !== undefined) { pending.current[item.id] = streak; setAssigned({ ...pending.current }); } setRevealed(false); setIndex(value => value + 1); };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try {
      for (const [streak] of grades) {
        const ids = Object.entries(pending.current).filter(([, value]) => value === streak).map(([id]) => Number(id));
        if (!ids.length) continue;
        await saveBunproCoverage(ids, streak, deckId);
        for (const id of ids) delete pending.current[id];
        setAssigned({ ...pending.current });
      }
      onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save progress."); }
    finally { lock.current = false; setSaving(false); }
  };
  const button = (label: string, onPress: () => void, color?: string) => <Pressable accessibilityRole="button" disabled={saving} onPress={onPress} style={{ minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: color ?? theme.cardBackground, borderColor: theme.border, borderWidth: 1 }}><Text style={{ color: color ? "white" : theme.textColor }}>{label}</Text></Pressable>;
  return <Modal transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}><ScrollView accessibilityViewIsModal style={{ maxHeight: "85%", borderRadius: 12, backgroundColor: theme.backgroundColor }} contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, color: theme.textColor }}>Knowledge Check</Text>
      {item ? <><Text style={{ color: theme.textSecondary }}>{index + 1}/{items.length}</Text><Text style={{ fontSize: 36, color: theme.textColor }}>{sanitizeText(item.resource.attributes.title)}</Text>{revealed ? <><Text style={{ color: theme.textSecondary }}>{sanitizeText(item.resource.attributes.kana)} · {sanitizeText(item.resource.attributes.meaning)}</Text><Text style={{ color: theme.textColor }}>How well do you know this word?</Text>{grades.map(([streak, label]) => <React.Fragment key={streak}>{button(label, () => grade(streak), coverageStage(streak).color)}</React.Fragment>)}</> : button("Show meaning", () => setRevealed(true))}{button("Skip", () => grade())}</> : <><Text style={{ color: theme.textColor }}>Choose where these words start in Bunpro. Skipped words stay unchanged.</Text>{grades.map(([streak, label]) => { const count = Object.values(assigned).filter(value => value === streak).length; return count ? <Text key={streak} style={{ color: theme.textColor }}>{label}: {count}</Text> : null; })}{error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}{button(saving ? "Saving…" : "Save progress", () => { void save(); })}</>}
      {button("Cancel", onClose)}
    </ScrollView></View>
  </Modal>;
}
