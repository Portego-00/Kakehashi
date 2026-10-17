import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SettingsFoldout } from "../../ui/settings/settings-foldout";
import { SettingsIcon } from "../../ui/settings/settings-icon";
import { useTheme } from "../../utils/theme";
import { useLearningContentStore } from "./store";
import { packageManager } from "./package-store";
import { packageSummary, type TranslationPackage } from "./resolver";
import { selectTranslationPackage } from "./import-file";

export function ContentLanguageSetting() {
  const { theme } = useTheme();
  const enabled = useLearningContentStore((s) => s.enabled);
  const setEnabled = useLearningContentStore((s) => s.setEnabled);
  const imported = packageManager.state((s) => s.packet);
  const hydrated = packageManager.state((s) => s.hydrated);
  const storageError = packageManager.state((s) => s.error);
  const [candidate, setCandidate] = useState<TranslationPackage | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void packageManager.hydrate();
  }, []);
  const levelRanges = (levels: number[]) => {
    const parts: string[] = [];
    for (let i = 0; i < levels.length; i++) {
      const first = levels[i];
      let last = first;
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
    return `${packet.name}\n${count.radical} radicals · ${count.kanji} kanji · ${count.vocabulary + count.kana_vocabulary} vocabulary\n${packet.scope === "display-and-synonyms" ? "Includes reviewed synonym suggestions." : "Display only."}`;
  };
  async function pick() {
    setBusy(true);
    setError(null);
    try {
      const packet = await selectTranslationPackage();
      if (packet) setCandidate(packet);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not read the file. Your current package is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    if (!candidate) return;
    setBusy(true);
    setError(null);
    try {
      await packageManager.activate(candidate);
      setEnabled(true);
      setCandidate(null);
    } catch {
      setError(
        "Could not save the package. Your current content is unchanged. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await packageManager.reset();
      setEnabled(false);
      setCandidate(null);
    } catch {
      setError(
        "Could not remove the translation package. Your current package is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || !hydrated;
  const button = (
    label: string,
    action: () => void,
    primary = false,
    destructive = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => [
        styles.button,
        primary && { backgroundColor: theme.primary, borderRadius: 10 },
        { opacity: disabled ? 0.5 : pressed ? 0.65 : 1 },
      ]}
    >
      <Text
        style={{
          color: primary ? "#fff" : destructive ? theme.error : theme.primary,
          fontSize: 15,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const canTransfer =
    enabled &&
    imported?.language === "tr" &&
    imported.schemaVersion === 3 &&
    imported.scope === "display-and-synonyms";
  return (
    <SettingsFoldout
      title="Translation package"
      icon="language-outline"
      theme={theme}
      description={
        imported && enabled
          ? `${imported.language.toUpperCase()} · On this device`
          : "Optional meanings and example translations"
      }
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[styles.label, { color: theme.textColor }]}>
              Use translation package
            </Text>
            <Text style={[styles.help, { color: theme.textSecondary }]}>
              {imported
                ? "Show imported meanings and example sentences"
                : "Import a file to get started"}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Use translation package"
            value={!!imported && enabled}
            disabled={disabled || !imported}
            trackColor={{ true: theme.primary }}
            onValueChange={setEnabled}
          />
        </View>
        <View style={[styles.package, { borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textColor }]}>
            {imported ? "Imported package" : "No translation package loaded"}
          </Text>
          {imported && (
            <Text style={[styles.help, { color: theme.textSecondary }]}>
              {imported.language.toUpperCase()} · v{imported.version}
              {"\n"}
              {summaryText(imported)}
            </Text>
          )}
          {imported &&
            button(
              showDetails ? "Hide package details" : "Package details",
              () => setShowDetails((value) => !value),
            )}
          {imported && showDetails && (
            <Text
              selectable
              style={[styles.help, { color: theme.textSecondary }]}
            >
              {detailsText(imported)}
            </Text>
          )}
          {button(
            busy ? "Processing…" : "Import translation file",
            () => {
              void pick();
            },
            !candidate,
          )}
        </View>
        {candidate && (
          <View
            style={[
              styles.preview,
              {
                backgroundColor: theme.backgroundColor,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: theme.textColor }]}>
              {candidate.name}
            </Text>
            <Text style={[styles.help, { color: theme.textSecondary }]}>
              {candidate.language.toUpperCase()} · v{candidate.version}
              {"\n"}
              {summaryText(candidate)}
            </Text>
            <Text style={[styles.help, { color: theme.textSecondary }]}>
              Replaces the current package. Review the file’s translations
              before use.
            </Text>
            {button(
              "Use this package",
              () => {
                void activate();
              },
              true,
            )}
            {button("Cancel", () => setCandidate(null))}
          </View>
        )}
        {canTransfer && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Turkish synonym transfer"
            onPress={() => router.push("/turkish-synonyms")}
            style={[styles.row, styles.transfer, { borderColor: theme.border }]}
          >
            <SettingsIcon
              name="cloud-upload-outline"
              size={22}
              color={theme.primary}
            />
            <View style={styles.flex}>
              <Text style={[styles.label, { color: theme.textColor }]}>
                Turkish synonyms
              </Text>
              <Text style={[styles.help, { color: theme.textSecondary }]}>
                Review suggestions before adding to WaniKani
              </Text>
            </View>
            <SettingsIcon
              name="chevron-forward"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        )}
        {imported &&
          button(
            "Remove translation package",
            () =>
              Alert.alert(
                "Remove translation package?",
                "Translations will use the original English. Your account and study progress will stay the same.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                      void reset();
                    },
                  },
                ],
              ),
            false,
            true,
          )}
        {(error || storageError) && (
          <Text
            accessibilityRole="alert"
            style={[styles.help, { color: theme.error }]}
          >
            {error || storageError}
          </Text>
        )}
        <Text style={[styles.help, { color: theme.textSecondary }]}>
          Stored on this device. Missing translations use English. Accepted
          answers change only if you separately confirm a synonym transfer.
        </Text>
      </View>
    </SettingsFoldout>
  );
}
const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: "600" },
  help: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  package: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 4 },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  transfer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingBottom: 4,
  },
});
