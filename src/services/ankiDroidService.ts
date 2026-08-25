import AsyncStorage from "@react-native-async-storage/async-storage";
import AnkiDroid, {
  type AnkiDroidCollectionItem,
} from "../modules/AnkiDroid";

const CONFIG_STORAGE_KEY = "ankidroid-context-export-config-v1";

export interface AnkiDroidExportConfig {
  deckId: string;
  deckName: string;
  noteTypeId: string;
  noteTypeName: string;
  fields: string[];
  japaneseFieldIndex: number;
  englishFieldIndex: number;
  tags: string[];
}

export interface AnkiDroidExportData {
  japanese: string;
  english: string;
}

export interface AnkiDroidSetupData {
  decks: AnkiDroidCollectionItem[];
  noteTypes: AnkiDroidCollectionItem[];
}

export function isValidAnkiDroidExportConfig(
  value: unknown
): value is AnkiDroidExportConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<AnkiDroidExportConfig>;
  return (
    typeof config.deckId === "string" &&
    typeof config.deckName === "string" &&
    typeof config.noteTypeId === "string" &&
    typeof config.noteTypeName === "string" &&
    Array.isArray(config.fields) &&
    config.fields.length >= 2 &&
    config.fields.every((field) => typeof field === "string") &&
    Number.isInteger(config.japaneseFieldIndex) &&
    Number.isInteger(config.englishFieldIndex) &&
    (config.japaneseFieldIndex as number) >= 0 &&
    (config.englishFieldIndex as number) >= 0 &&
    (config.japaneseFieldIndex as number) < config.fields.length &&
    (config.englishFieldIndex as number) < config.fields.length &&
    config.japaneseFieldIndex !== config.englishFieldIndex &&
    Array.isArray(config.tags) &&
    config.tags.every((tag) => typeof tag === "string")
  );
}

export async function loadAnkiDroidExportConfig(): Promise<AnkiDroidExportConfig | null> {
  const stored = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    return isValidAnkiDroidExportConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveAnkiDroidExportConfig(
  config: AnkiDroidExportConfig
): Promise<void> {
  if (!isValidAnkiDroidExportConfig(config)) {
    throw new Error("Invalid AnkiDroid export configuration");
  }
  await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export async function clearAnkiDroidExportConfig(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG_STORAGE_KEY);
}

export function guessAnkiDroidFieldMappings(fields: string[]): {
  japaneseFieldIndex: number;
  englishFieldIndex: number;
} {
  const normalized = fields.map((field) => field.trim().toLowerCase());
  const find = (terms: string[], excludedIndex = -1) =>
    normalized.findIndex(
      (field, index) =>
        index !== excludedIndex && terms.some((term) => field.includes(term))
    );

  const japaneseMatch = find([
    "sentence",
    "expression",
    "japanese",
    "front",
    "word",
  ]);
  const japaneseFieldIndex = japaneseMatch >= 0 ? japaneseMatch : 0;
  const englishMatch = find(
    ["translation", "english", "meaning", "definition", "back"],
    japaneseFieldIndex
  );
  const englishFieldIndex =
    englishMatch >= 0
      ? englishMatch
      : japaneseFieldIndex === 0
        ? 1
        : 0;

  return { japaneseFieldIndex, englishFieldIndex };
}

export function buildAnkiDroidFields(
  config: AnkiDroidExportConfig,
  data: AnkiDroidExportData
): string[] {
  const values = config.fields.map(() => "");
  values[config.japaneseFieldIndex] = data.japanese.trim();
  values[config.englishFieldIndex] = data.english.trim();
  return values;
}

export async function ensureAnkiDroidAccess(): Promise<void> {
  if (!AnkiDroid) {
    throw new Error("AnkiDroid export requires the Android development build.");
  }
  if (!(await AnkiDroid.isAvailable())) {
    throw new Error("Install AnkiDroid to export context sentences.");
  }
  if (!(await AnkiDroid.hasPermission())) {
    const granted = await AnkiDroid.requestPermission();
    if (!granted) {
      throw new Error("Allow Kakehashi access in order to add notes to AnkiDroid.");
    }
  }
}

export async function loadAnkiDroidSetupData(): Promise<AnkiDroidSetupData> {
  await ensureAnkiDroidAccess();
  const [decks, noteTypes] = await Promise.all([
    AnkiDroid!.getDecks(),
    AnkiDroid!.getNoteTypes(),
  ]);
  return { decks, noteTypes };
}

export async function loadAnkiDroidFields(noteTypeId: string): Promise<string[]> {
  await ensureAnkiDroidAccess();
  return AnkiDroid!.getFields(noteTypeId);
}

export async function exportContextSentenceToAnkiDroid(
  config: AnkiDroidExportConfig,
  data: AnkiDroidExportData
): Promise<string> {
  await ensureAnkiDroidAccess();
  if (!data.japanese.trim() || !data.english.trim()) {
    throw new Error("Both the Japanese sentence and translation are required.");
  }
  return AnkiDroid!.addNote(
    config.deckId,
    config.noteTypeId,
    buildAnkiDroidFields(config, data),
    config.tags
  );
}
