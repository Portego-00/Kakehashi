import AsyncStorage from "@react-native-async-storage/async-storage";

export type EpubTextPosition = { sectionId: string; offset: number };
export type EpubPassage = { start: EpubTextPosition; end: EpubTextPosition };
export type EpubAnnotation = {
  id: string;
  kind: "bookmark" | "highlight";
  page: number;
  text: string;
  passage?: EpubPassage;
  createdAt: number;
};
export type EpubSelection = { page: number; text: string; passage: EpubPassage };

const keyForBook = (bookId: string) => `epub-annotations:${bookId}`;
let writes = Promise.resolve();

function isPosition(value: unknown): value is EpubTextPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Partial<EpubTextPosition>;
  return typeof position.sectionId === "string" && Number.isInteger(position.offset) && (position.offset ?? -1) >= 0;
}

function isAnnotation(value: unknown): value is EpubAnnotation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<EpubAnnotation>;
  return typeof item.id === "string" && (item.kind === "bookmark" || item.kind === "highlight")
    && Number.isInteger(item.page) && (item.page ?? 0) > 0 && typeof item.text === "string"
    && typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
    && (item.passage ? isPosition(item.passage.start) && isPosition(item.passage.end) : item.kind === "bookmark");
}

export const epubAnnotations = {
  async load(bookId: string): Promise<EpubAnnotation[]> {
    await writes;
    const raw = await AsyncStorage.getItem(keyForBook(bookId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isAnnotation)) {
      throw new Error("Invalid EPUB annotation data");
    }
    return parsed;
  },
  save(bookId: string, annotations: EpubAnnotation[]): Promise<void> {
    const serialized = JSON.stringify(annotations);
    const operation = writes.then(() => AsyncStorage.setItem(keyForBook(bookId), serialized));
    writes = operation.catch(() => {});
    return operation;
  },
  async removeBook(bookId: string) {
    await writes;
    await AsyncStorage.removeItem(keyForBook(bookId));
  },
};
