import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";
import type { AnkiDroidCollectionItem } from "../modules/AnkiDroid";
import {
  clearAnkiDroidExportConfig,
  exportContextSentenceToAnkiDroid,
  guessAnkiDroidFieldMappings,
  loadAnkiDroidExportConfig,
  loadAnkiDroidFields,
  loadAnkiDroidSetupData,
  saveAnkiDroidExportConfig,
  type AnkiDroidExportConfig,
} from "../services/ankiDroidService";
import { useTheme } from "../utils/theme";

interface AnkiDroidExportButtonProps {
  japanese: string;
  english: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface AnkiDroidSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: AnkiDroidExportConfig) => void | Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not export this sentence to AnkiDroid.";
}

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ];
}

function AnkiDroidSetupModal({
  visible,
  onClose,
  onSave,
}: AnkiDroidSetupModalProps) {
  const { theme } = useTheme();
  const [decks, setDecks] = useState<AnkiDroidCollectionItem[]>([]);
  const [noteTypes, setNoteTypes] = useState<AnkiDroidCollectionItem[]>([]);
  const [deckId, setDeckId] = useState("");
  const [noteTypeId, setNoteTypeId] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [japaneseFieldIndex, setJapaneseFieldIndex] = useState(0);
  const [englishFieldIndex, setEnglishFieldIndex] = useState(1);
  const [tags, setTags] = useState("kakehashi context-sentence");
  const [loading, setLoading] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    Promise.all([loadAnkiDroidSetupData(), loadAnkiDroidExportConfig()])
      .then(([setup, storedConfig]) => {
        if (cancelled) return;
        setDecks(setup.decks);
        setNoteTypes(setup.noteTypes);

        const storedDeckIsAvailable = setup.decks.some(
          (deck) => deck.id === storedConfig?.deckId
        );
        const storedNoteTypeIsAvailable = setup.noteTypes.some(
          (noteType) => noteType.id === storedConfig?.noteTypeId
        );
        setDeckId(
          storedDeckIsAvailable
            ? storedConfig!.deckId
            : setup.decks[0]?.id ?? ""
        );
        setNoteTypeId(
          storedNoteTypeIsAvailable
            ? storedConfig!.noteTypeId
            : setup.noteTypes[0]?.id ?? ""
        );
        setTags(storedConfig?.tags.join(" ") || "kakehashi context-sentence");
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !noteTypeId) {
      setFields([]);
      return;
    }

    let cancelled = false;
    setLoadingFields(true);
    setErrorMessage(null);

    Promise.all([loadAnkiDroidFields(noteTypeId), loadAnkiDroidExportConfig()])
      .then(([loadedFields, storedConfig]) => {
        if (cancelled) return;
        setFields(loadedFields);

        if (
          storedConfig?.noteTypeId === noteTypeId &&
          storedConfig.fields.length === loadedFields.length &&
          storedConfig.fields.every(
            (field, index) => field === loadedFields[index]
          )
        ) {
          setJapaneseFieldIndex(storedConfig.japaneseFieldIndex);
          setEnglishFieldIndex(storedConfig.englishFieldIndex);
        } else {
          const guessed = guessAnkiDroidFieldMappings(loadedFields);
          setJapaneseFieldIndex(guessed.japaneseFieldIndex);
          setEnglishFieldIndex(guessed.englishFieldIndex);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFields([]);
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });

    return () => {
      cancelled = true;
    };
  }, [noteTypeId, visible]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === deckId),
    [deckId, decks]
  );
  const selectedNoteType = useMemo(
    () => noteTypes.find((noteType) => noteType.id === noteTypeId),
    [noteTypeId, noteTypes]
  );
  const canSave =
    !!selectedDeck &&
    !!selectedNoteType &&
    fields.length >= 2 &&
    japaneseFieldIndex !== englishFieldIndex &&
    !loadingFields &&
    !saving;

  const handleSave = async () => {
    if (!canSave || !selectedDeck || !selectedNoteType) return;

    const config: AnkiDroidExportConfig = {
      deckId: selectedDeck.id,
      deckName: selectedDeck.name,
      noteTypeId: selectedNoteType.id,
      noteTypeName: selectedNoteType.name,
      fields,
      japaneseFieldIndex,
      englishFieldIndex,
      tags: parseTags(tags),
    };

    setSaving(true);
    setErrorMessage(null);
    try {
      await saveAnkiDroidExportConfig(config);
      await onSave(config);
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (Platform.OS !== "android") return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.backgroundColor }]}
        behavior="height"
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerAction}>
            <Text style={[styles.headerActionText, { color: theme.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.textColor }]}>AnkiDroid Export</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerAction}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text
                style={[
                  styles.headerActionText,
                  { color: canSave ? theme.primary : theme.textSecondary },
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>Loading your AnkiDroid collection…</Text>
          </View>
        ) : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.description, { color: theme.textSecondary }]}>Choose where Kakehashi should put the Japanese sentence and English translation. Other fields are left empty.</Text>

            {errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  { borderColor: theme.error ?? "#d92c2c" },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={20} color={theme.error ?? "#d92c2c"} />
                <Text selectable style={[styles.errorText, { color: theme.textColor }]}>{errorMessage}</Text>
              </View>
            )}

            <PickerField label="Deck" theme={theme}>
              <Picker
                selectedValue={deckId}
                onValueChange={(value) => setDeckId(String(value))}
                style={{ color: theme.textColor }}
                dropdownIconColor={theme.textColor}
              >
                {decks.map((deck) => (
                  <Picker.Item key={deck.id} label={deck.name} value={deck.id} />
                ))}
              </Picker>
            </PickerField>

            <PickerField label="Note type" theme={theme}>
              <Picker
                selectedValue={noteTypeId}
                onValueChange={(value) => setNoteTypeId(String(value))}
                style={{ color: theme.textColor }}
                dropdownIconColor={theme.textColor}
              >
                {noteTypes.map((noteType) => (
                  <Picker.Item
                    key={noteType.id}
                    label={noteType.name}
                    value={noteType.id}
                  />
                ))}
              </Picker>
            </PickerField>

            {loadingFields ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <PickerField label="Japanese sentence field" theme={theme}>
                  <Picker
                    selectedValue={japaneseFieldIndex}
                    onValueChange={(value) => setJapaneseFieldIndex(Number(value))}
                    style={{ color: theme.textColor }}
                    dropdownIconColor={theme.textColor}
                  >
                    {fields.map((field, index) => (
                      <Picker.Item key={`${field}-${index}`} label={field} value={index} />
                    ))}
                  </Picker>
                </PickerField>

                <PickerField label="English translation field" theme={theme}>
                  <Picker
                    selectedValue={englishFieldIndex}
                    onValueChange={(value) => setEnglishFieldIndex(Number(value))}
                    style={{ color: theme.textColor }}
                    dropdownIconColor={theme.textColor}
                  >
                    {fields.map((field, index) => (
                      <Picker.Item key={`${field}-${index}`} label={field} value={index} />
                    ))}
                  </Picker>
                </PickerField>
              </>
            )}

            {japaneseFieldIndex === englishFieldIndex && (
              <Text style={[styles.validationText, { color: theme.error ?? "#d92c2c" }]}>Choose two different fields.</Text>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textColor }]}>Tags</Text>
              <TextInput
                value={tags}
                onChangeText={setTags}
                placeholder="kakehashi context-sentence"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.tagsInput,
                  {
                    color: theme.textColor,
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              />
              <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>Separate tags with spaces or commas.</Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PickerField({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ReturnType<typeof useTheme>["theme"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.textColor }]}>{label}</Text>
      <View
        style={[
          styles.pickerContainer,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function AnkiDroidExportButton({
  japanese,
  english,
  compact = false,
  style,
}: AnkiDroidExportButtonProps) {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);

  if (Platform.OS !== "android") return null;

  const exportWithConfig = async (config: AnkiDroidExportConfig) => {
    setExporting(true);
    try {
      await exportContextSentenceToAnkiDroid(config, { japanese, english });
      setExported(true);
      ToastAndroid.show(`Added to ${config.deckName}`, ToastAndroid.SHORT);
    } catch (error: any) {
      if (error?.code === "FIELDS_CHANGED") {
        await clearAnkiDroidExportConfig();
        setSetupVisible(true);
        return;
      }
      Alert.alert("AnkiDroid Export", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const handlePress = async () => {
    if (exporting || exported) return;
    setExporting(true);
    try {
      const config = await loadAnkiDroidExportConfig();
      if (!config) {
        setSetupVisible(true);
        return;
      }
      await exportWithConfig(config);
    } catch (error) {
      Alert.alert("AnkiDroid Export", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          exported ? "Sentence added to AnkiDroid" : "Add sentence to AnkiDroid"
        }
        activeOpacity={0.8}
        disabled={exporting || exported}
        onPress={handlePress}
        style={[
          styles.exportButton,
          compact && styles.exportButtonCompact,
          {
            borderColor: exported ? "#2e9b56" : theme.primary,
            backgroundColor: exported
              ? "rgba(46,155,86,0.12)"
              : theme.cardBackground,
          },
          style,
        ]}
      >
        {exporting ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Ionicons
            name={exported ? "checkmark" : "albums-outline"}
            size={compact ? 16 : 17}
            color={exported ? "#2e9b56" : theme.primary}
          />
        )}
        {!compact && (
          <Text
            style={[
              styles.exportButtonText,
              { color: exported ? "#2e9b56" : theme.primary },
            ]}
          >
            {exported ? "Added" : "Anki"}
          </Text>
        )}
      </TouchableOpacity>

      <AnkiDroidSetupModal
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        onSave={exportWithConfig}
      />
    </>
  );
}

export function AnkiDroidExportSettingsButton() {
  const { theme } = useTheme();
  const [config, setConfig] = useState<AnkiDroidExportConfig | null>(null);
  const [setupVisible, setSetupVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      void loadAnkiDroidExportConfig().then(setConfig);
    }
  }, [setupVisible]);

  if (Platform.OS !== "android") return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSetupVisible(true)}
        style={[styles.settingsButton, { borderColor: theme.border }]}
      >
        <View
          style={[
            styles.settingsIcon,
            { backgroundColor: `${theme.primary}18` },
          ]}
        >
          <Ionicons name="albums-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsTitle, { color: theme.textColor }]}>AnkiDroid Export</Text>
          <Text style={[styles.settingsSubtitle, { color: theme.textSecondary }]}>
            {config
              ? `${config.deckName} · ${config.noteTypeName}`
              : "Choose a deck, note type, and field mapping"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      <AnkiDroidSetupModal
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        onSave={(savedConfig) => setConfig(savedConfig)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  exportButton: {
    minHeight: 34,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  exportButtonCompact: {
    width: 34,
    minWidth: 34,
    paddingHorizontal: 0,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerAction: {
    minWidth: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  stateText: {
    fontSize: 15,
    textAlign: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  tagsInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  fieldHint: {
    fontSize: 12,
  },
  validationText: {
    fontSize: 13,
    marginTop: -10,
  },
  settingsButton: {
    minHeight: 68,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: {
    flex: 1,
    gap: 3,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  settingsSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
