import React, { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  clearBunproApiToken,
  getStoredBunproApiToken,
  saveBunproApiToken,
  validateBunproApiToken,
} from "../../../utils/bunproApi";
import { useOptionalScreenIsFocused } from "../../../utils/navigation-focus";
import { isPortegoUsername } from "../../../utils/portegoAccess";
import { useAuthStore, useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function BunproReviewSettingsSection() {
  const username = useAuthStore(state => state.userData?.username);
  const userId = useAuthStore(state => state.userData?.id);
  return isPortegoUsername(username)
    ? <BunproReviewSettingsContent key={`${userId}:${username}`} />
    : null;
}

function BunproReviewSettingsContent() {
  const { theme, updateSectionOffset } = useSettingsControllerContext();
  const settings = useSettingsStore(state => state);
  const focused = useOptionalScreenIsFocused();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  const mounted = useRef(true);
  const mutationInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    setLoading(true);
    void getStoredBunproApiToken().then(token => {
      if (!active) return;
      setHasApiKey(Boolean(token));
      setLoading(false);
    });
    return () => { active = false; };
  }, [focused]);

  const saveApiKey = async () => {
    if (loading || mutationInFlight.current) return;
    const apiKey = apiKeyInput.trim();
    if (!apiKey) {
      setStatus({ message: "Enter your Bunpro API key first.", error: true });
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    setStatus({ message: "Validating Bunpro API key…", error: false });
    try {
      const valid = await validateBunproApiToken(apiKey);
      if (!mounted.current) return;
      if (!valid) {
        setStatus({ message: "That API key is invalid or Bunpro is unavailable right now.", error: true });
        return;
      }
      await saveBunproApiToken(apiKey);
      if (!mounted.current) return;
      setHasApiKey(true);
      setApiKeyInput("");
      setStatus({ message: "Bunpro API key saved.", error: false });
    } catch {
      if (mounted.current) setStatus({ message: "The API key could not be saved. Please try again.", error: true });
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const removeApiKey = async () => {
    if (loading || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    setStatus(null);
    try {
      await clearBunproApiToken();
      const remainingToken = await getStoredBunproApiToken();
      if (!mounted.current) return;
      if (remainingToken) {
        setStatus({ message: "The API key could not be removed. Please try again.", error: true });
        return;
      }
      setHasApiKey(false);
      setApiKeyInput("");
      setStatus({ message: "Bunpro API key removed.", error: false });
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const toggles = [
    ["Show details on wrong answer", "Open Bunpro item details after an incorrect answer.", "information-circle-outline", settings.showDetailsOnWrongAnswer, settings.setShowDetailsOnWrongAnswer],
    ["Answer feedback sounds", "Play a sound for correct and incorrect Bunpro answers.", "volume-high-outline", settings.answerFeedbackSoundEnabled, settings.setAnswerFeedbackSoundEnabled],
    ["Bunpro keyboard shortcuts", "Use a physical keyboard to control Bunpro reviews.", "keypad-outline", settings.reviewKeyboardShortcutsEnabled, settings.setReviewKeyboardShortcutsEnabled],
    ["Hide Bunpro furigana", "Tap a word in Bunpro reviews to keep its reading visible. Tap again to hide it.", "eye-off-outline", settings.bunproHideFurigana, settings.setBunproHideFurigana],
  ] as const;
  const busy = loading || saving;

  return (
    <View
      style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
      onLayout={event => updateSectionOffset("bunproReviews", event.nativeEvent.layout.y)}
    >
      <Text style={[styles.sectionTitle, { color: theme.textColor, borderBottomColor: theme.border }]}>Bunpro reviews</Text>
      <View style={styles.settingItemColumn}>
        <View style={[styles.settingRow, { marginBottom: 8 }]}>
          <Ionicons name="key-outline" size={24} color={theme.primary} style={styles.settingIcon} />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>Bunpro API key</Text>
            <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
              {loading ? "Checking saved API key…" : hasApiKey ? "An API key is saved. Paste a new key to replace it." : "Add your API key to connect Bunpro."}
            </Text>
          </View>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Bunpro API key"
            value={apiKeyInput}
            onChangeText={value => { setApiKeyInput(value); setStatus(null); }}
            placeholder="Paste Bunpro API key"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            secureTextEntry
            editable={!busy}
            style={[styles.textInput, { flex: 1, marginTop: 0, borderColor: theme.border, color: theme.textColor }]}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Save Bunpro API key"
            disabled={busy}
            onPress={() => void saveApiKey()}
            style={[styles.inputIconButton, { backgroundColor: theme.primary }, busy && styles.syncButtonDisabled]}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={24} color="#fff" />}
          </TouchableOpacity>
          {hasApiKey ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove Bunpro API key"
              disabled={busy}
              onPress={() => void removeApiKey()}
              style={[styles.inputIconButton, { backgroundColor: theme.error }, busy && styles.syncButtonDisabled]}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
        {status ? <Text accessibilityLiveRegion="polite" style={[styles.settingSubtext, { color: status.error ? theme.error : theme.textSecondary }]}>{status.message}</Text> : null}
      </View>
      {hasApiKey && !loading ? toggles.map(([label, description, icon, value, onChange]) => (
        <View key={label} style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons name={icon} size={24} color={theme.primary} style={styles.settingIcon} />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>{label}</Text>
            <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>{description}</Text>
          </View>
          <Switch
            accessibilityLabel={label}
            value={value ?? false}
            onValueChange={onChange}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>
      )) : null}
    </View>
  );
}
