import { NativeModules, Platform } from "react-native";

export interface AnkiDroidCollectionItem {
  id: string;
  name: string;
}

interface AnkiDroidInterface {
  isAvailable(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  getDecks(): Promise<AnkiDroidCollectionItem[]>;
  getNoteTypes(): Promise<AnkiDroidCollectionItem[]>;
  getFields(noteTypeId: string): Promise<string[]>;
  addNote(
    deckId: string,
    noteTypeId: string,
    fields: string[],
    tags: string[]
  ): Promise<string>;
}

const nativeModule = NativeModules.AnkiDroid as AnkiDroidInterface | undefined;

export default (
  Platform.OS === "android" ? nativeModule ?? null : null
) as AnkiDroidInterface | null;
