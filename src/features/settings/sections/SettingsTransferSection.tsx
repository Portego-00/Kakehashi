import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SettingsIcon } from "../../../ui/settings/settings-icon";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { applySettingsBackup, serializeSettingsBackup } from "../settings-transfer";
import { exportSettingsFile, pickSettingsBackup } from "../settings-transfer-files";
import { styles } from "../styles";

type TransferAction = "export" | "import";

function confirmImport() {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Import settings?",
      "Apply the preferences in this file to this device?",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Import", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function SettingsTransferSection() {
  const { theme, themeMode, setThemeMode, updateSectionOffset } =
    useSettingsControllerContext();
  const [busy, setBusy] = useState<TransferAction | null>(null);
  const transferring = useRef(false);

  async function transfer(action: TransferAction) {
    if (transferring.current) return;
    if (!useSettingsStore.persist.hasHydrated()) {
      Alert.alert("Settings are loading", "Try again in a moment.");
      return;
    }

    transferring.current = true;
    setBusy(action);
    try {
      if (action === "export") {
        const contents = serializeSettingsBackup(useSettingsStore.getState(), themeMode);
        if (await exportSettingsFile(contents) === "saved") {
          Alert.alert("Settings exported", "The settings file is in the folder you selected.");
        }
      } else {
        const backup = await pickSettingsBackup();
        if (!backup || !(await confirmImport())) return;
        applySettingsBackup(backup);
        if (backup.themeMode) await setThemeMode(backup.themeMode);
        Alert.alert("Settings imported", "Your preferences have been applied.");
      }
    } catch (error) {
      if (action === "export") {
        Alert.alert("Couldn’t export settings", "Try saving the settings file again.");
      } else {
        Alert.alert(
          "Couldn’t import settings",
          error instanceof Error ? error.message : "Try choosing the settings file again.",
        );
      }
    } finally {
      transferring.current = false;
      setBusy(null);
    }
  }

  return (
    <SettingsSectionSurface
      style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
      onLayout={(event) => updateSectionOffset("settingsTransfer", event.nativeEvent.layout.y)}
    >
      <Text style={[styles.sectionTitle, { color: theme.textColor, borderBottomColor: theme.border }]}>
        Settings Transfer
      </Text>
      {([
        {
          action: "export",
          label: "Export Settings",
          description: "Save a copy of your preferences",
          icon: "upload",
        },
        {
          action: "import",
          label: "Import Settings",
          description: "Apply preferences from a settings file",
          icon: "rowCloudDownload",
        },
      ] as const).map(({ action, label, description, icon }) => (
        <TouchableOpacity
          key={action}
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={busy !== null}
          onPress={() => void transfer(action)}
          style={[
            styles.settingItem,
            { borderBottomColor: action === "import" ? "transparent" : theme.border },
          ]}
        >
          <SettingsIcon name={icon} size={24} color={theme.primary} style={styles.settingIcon} />
          <View style={styles.settingTextContainer}>
            <SettingsLabel style={[styles.settingText, { color: theme.textColor }]}>
              {label}
            </SettingsLabel>
            <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
              {description}
            </Text>
          </View>
          {busy === action ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <SettingsIcon name="chevron-forward" size={20} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      ))}
    </SettingsSectionSurface>
  );
}
