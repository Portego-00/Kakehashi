import { SettingsLabel } from "../../ui/settings/settings-search";
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../utils/theme";
import { useLearningContentStore } from "./store";
import { useActiveContent, packageManager } from "./package-store";
import { packageSummary, type TranslationPackage } from "./resolver";
import { selectTranslationPackage } from "./import-file";

export function ContentLanguageSetting() {
  const { theme } = useTheme();
  const enabled = useLearningContentStore(s => s.enabled);
  const setEnabled = useLearningContentStore(s => s.setEnabled);
  const active = useActiveContent();
  const imported = packageManager.state(s => s.packet);
  const hydrated = packageManager.state(s => s.hydrated);
  const storageError = packageManager.state(s => s.error);
  const [candidate, setCandidate] = useState<TranslationPackage | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void packageManager.hydrate(); }, []);
  const levelRanges = (levels: number[]) => {
    const parts: string[] = [];
    for (let i = 0; i < levels.length; i++) {
      const first = levels[i]; let last = first;
      while (levels[i + 1] === last + 1) last = levels[++i];
      parts.push(first === last ? String(first) : `${first}–${last}`);
    }
    return parts.join(", ");
  };
  const summaryText = (packet: TranslationPackage) => {
    const count = packageSummary(packet);
    return `${count.radical + count.kanji + count.vocabulary + count.kana_vocabulary} items · ${count.sentences} sentences · Levels ${levelRanges(count.levels)}`;
  };
  const detailsText = (packet: TranslationPackage) => {
    const count = packageSummary(packet);
    return `${packet.name}\n${count.radical} radicals · ${count.kanji} kanji · ${count.vocabulary + count.kana_vocabulary} vocabulary\n${packet.schemaVersion === 3 && packet.scope === "display-and-synonyms" ? "Includes explicit synonym answers for account transfer." : "Display only. Import a format v3 file to transfer synonyms."}`;
  };
  async function pick() {
    setBusy(true); setError(null);
    try { const packet = await selectTranslationPackage(); if (packet) setCandidate(packet); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the file. Your current package is unchanged."); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (!candidate) return;
    setBusy(true); setError(null);
    try { await packageManager.activate(candidate); setEnabled(true); setCandidate(null); }
    catch { setError("Could not save the package. Your current content is unchanged. Please try again."); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError(null);
    try { await packageManager.reset(); setCandidate(null); }
    catch { setError("Could not remove the translation package. Your current package is unchanged."); }
    finally { setBusy(false); }
  }
  const disabled = busy || !hydrated;
  const button = (label: string, action: () => void) => <TouchableOpacity
    accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled}
    onPress={action} style={[styles.button, {borderColor: theme.border, opacity: disabled ? 0.5 : 1}]}>
    <Text style={{color: theme.primary, fontSize: 14}}>{label}</Text>
  </TouchableOpacity>;
  return <View>
    <View style={styles.settingItem}>
      <Ionicons name="language-outline" size={24} color={theme.primary} style={styles.settingIcon} />
      <View style={styles.settingTextContainer}>
        <SettingsLabel style={[styles.settingText, {color: theme.textColor}]}>Optional translation package</SettingsLabel>
        <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>Load meanings and example sentences from a file.</Text>
      </View>
      <Switch accessibilityLabel="Use translation package" value={enabled}
        trackColor={{true: theme.primary}} style={{flexShrink: 0}}
        onValueChange={enabled => setEnabled(enabled)} />
    </View>
    <View style={styles.packageArea}>
      <Text style={{color: theme.textColor, fontWeight: "600"}}>{imported ? "Imported package" : "No translation package loaded"}</Text>
      {active && <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>{active.language} · v{active.version}{"\n"}{summaryText(active)}</Text>}
      {active && button(showDetails ? "Hide package details" : "Package details", () => setShowDetails(value => !value))}
      {active && showDetails && <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>{detailsText(active)}</Text>}
      {button(busy ? "Processing…" : "Import translation file", () => {void pick();})}
      {candidate && <View style={[styles.preview, {borderColor: theme.border}]}>
        <Text style={{color: theme.textColor, fontWeight: "600"}}>Language: {candidate.language} · {candidate.name} · v{candidate.version}</Text>
        <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>{summaryText(candidate)}{"\n"}{candidate.schemaVersion === 3 && candidate.scope === "display-and-synonyms" ? "Display + synonym suggestions" : "Display only"}</Text>
        <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>Replaces the current package. Format checked; translation accuracy is not verified.</Text>
        {button("Use this package", () => {void activate();})}
        {button("Cancel", () => setCandidate(null))}
      </View>}
      {imported && button("Remove translation package", () => Alert.alert(
        "Remove translation package?", "Translations will use the original English. Your account and study progress will stay the same.",
        [{text: "Cancel", style: "cancel"}, {text: "Remove", onPress: () => {void reset();}}]))}
      {(error || storageError) && <Text accessibilityRole="alert" style={[styles.settingSubtext, {color: theme.textColor}]}>{error || storageError}</Text>}
      <Text style={[styles.settingSubtext, {color: theme.textSecondary}]}>Stored on this device. Missing translations use English.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  settingItem: {flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12},
  settingIcon: {marginRight: 16},
  settingTextContainer: {flex: 1, minWidth: 0, marginRight: 12},
  settingText: {fontSize: 16},
  settingSubtext: {fontSize: 14, marginTop: 4},
  packageArea: {paddingHorizontal: 16, paddingBottom: 16},
  button: {borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 10},
  preview: {borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12},
});
