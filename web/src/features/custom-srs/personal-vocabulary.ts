import { z } from "zod";
import type { CustomVocabularyPack, CustomVocabularyWord } from "./types";

export const PERSONAL_WORD_LIMIT = 10_000;
export const IMPORT_WORD_LIMIT = 1_000;
export const IMPORT_BYTE_LIMIT = 2_000_000;
export const personalId = z.string().regex(/^personal:[0-9a-f-]{36}$/i);
const text = (max: number) => z.string().trim().max(max);
const sentence = z.object({ ja: text(1000).min(1), en: text(1000).min(1) }).strict();
export const personalWordSchema = z.object({
  characters: text(120).min(1), reading: text(160).min(1),
  meanings: z.array(text(200).min(1)).min(1).max(20),
  partsOfSpeech: z.array(text(80).min(1)).max(10),
  meaningMnemonic: text(3000), readingMnemonic: text(3000).optional(),
  contextSentences: z.array(sentence).max(5),
}).strict();
export type PersonalWordInput = z.infer<typeof personalWordSchema>;
export const personalOperationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_deck"), id: personalId, title: text(100).min(1) }).strict(),
  z.object({ action: z.literal("rename_deck"), id: personalId, title: text(100).min(1) }).strict(),
  z.object({ action: z.literal("create_word"), id: personalId, deckId: personalId, word: personalWordSchema }).strict(),
  z.object({ action: z.literal("edit_word"), id: personalId, word: personalWordSchema }).strict(),
  z.object({ action: z.literal("archive_word"), id: personalId, archived: z.boolean() }).strict(),
]);
export type PersonalOperation = z.infer<typeof personalOperationSchema>;
export const personalMutationSchema = z.object({
  accountId: z.string().min(1).max(128), eventId: z.string().uuid(), expectedRevision: z.number().int().min(0),
  operations: z.array(personalOperationSchema).min(1).max(IMPORT_WORD_LIMIT + 1),
}).strict();
export type PersonalMutation = z.infer<typeof personalMutationSchema>;
export const personalEntrySchema = z.discriminatedUnion("kind", [
  z.object({ id: personalId, kind: z.literal("deck"), deckId: z.null(), revision: z.number().int().positive(), data: z.object({ title: text(100).min(1) }) }),
  z.object({ id: personalId, kind: z.literal("word"), deckId: personalId, revision: z.number().int().positive(), data: z.object({ word: personalWordSchema, archived: z.boolean() }) }),
]);
export type PersonalEntry = z.infer<typeof personalEntrySchema>;
export type PersonalLibrary = { revision: number; entries: Record<string, PersonalEntry> };
export const EMPTY_PERSONAL_LIBRARY: PersonalLibrary = { revision: 0, entries: {} };
export const personalPageSchema = z.object({
  revision: z.number().int().min(0), entries: z.array(personalEntrySchema).max(200),
  cursor: z.object({ revision: z.number().int().min(0), id: z.string().max(64) }).nullable(),
});

export function wordIdentity(word: Pick<PersonalWordInput, "characters" | "reading">) {
  const kana = word.reading.normalize("NFKC").replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
  return JSON.stringify([word.characters.normalize("NFKC").trim(), kana.trim()]);
}

export function personalLibraryPacks(library: PersonalLibrary): CustomVocabularyPack[] {
  const decks = Object.values(library.entries).filter((entry) => entry.kind === "deck");
  const words = new Map<string, CustomVocabularyWord[]>();
  for (const entry of Object.values(library.entries)) {
    if (entry.kind !== "word" || entry.data.archived) continue;
    const group = words.get(entry.deckId) ?? [];
    group.push({ ...entry.data.word, id: entry.id });
    words.set(entry.deckId, group);
  }
  return decks.map((entry) => ({ id: entry.id, title: entry.data.title, description: "Your private vocabulary deck.", script: "mixed", words: words.get(entry.id) ?? [] }));
}

export function preparePersonalOperations(operations: PersonalOperation[]) {
  return operations.map((operation) => operation.action === "create_word" || operation.action === "edit_word"
    ? { ...operation, identityKey: wordIdentity(operation.word) } : operation);
}
