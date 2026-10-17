import { createCustomSrsState, enrollCustomVocabularyPack, completeCustomLesson, updateCustomSrsSettings } from "../../../../web/src/features/custom-srs/model";
import { DEFAULT_CUSTOM_SRS_SETTINGS } from "../../../../web/src/features/custom-srs/srs-settings";
import { createCustomSrsClient } from "../client";
import { customVocabularyPacks } from "../catalog";
import { EMPTY_PERSONAL_LIBRARY, parsePersonalLibrary, personalLibraryPacks, syncNativePersonalLibrary, type PersonalLibrary } from "../personal-library";

const deckId = "personal:11111111-1111-4111-8111-111111111111";
const wordId = "personal:22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const word = { characters: "橋", reading: "はし", meanings: ["bridge"], partsOfSpeech: ["noun"], meaningMnemonic: "A bridge.", contextSentences: [] };
const library: PersonalLibrary = { revision: 2, entries: {
  [deckId]: { id: deckId, kind: "deck", deckId: null, revision: 1, data: { title: "My reading" } },
  [wordId]: { id: wordId, kind: "word", deckId, revision: 2, data: { word, archived: false } },
} };
function disk() {
  const values = new Map<string, string>();
  return { values, getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((yes) => { resolve = yes; }), resolve: (value: T) => resolve(value) };
}

it("collects every library page at one revision and keeps archived definitions out of study packs", async () => {
  const request = jest.fn().mockResolvedValueOnce({ revision: 2, entries: [library.entries[deckId]], cursor: { revision: 1, id: deckId } }).mockResolvedValueOnce({ revision: 2, entries: [library.entries[wordId]], cursor: null });
  expect(await syncNativePersonalLibrary("token", EMPTY_PERSONAL_LIBRARY, request)).toEqual(library);
  expect(request.mock.calls[1]).toEqual(["token", { action: "read_library", after: 1, afterId: deckId, until: 2 }]);
  const archived: PersonalLibrary = { ...library, entries: { ...library.entries, [wordId]: { id: wordId, kind: "word", deckId, revision: 2, data: { word, archived: true } } } };
  expect(personalLibraryPacks(archived)[0].words).toEqual([]);
});

it("rejects invalid cache identities, repeated cursors, and partial pages without changing the base", async () => {
  expect(() => parsePersonalLibrary({ ...library, entries: { wrong: library.entries[wordId] } })).toThrow();
  const original = structuredClone(library);
  const request = jest.fn().mockResolvedValue({ revision: 3, entries: [], cursor: { revision: 2, id: "" } });
  await expect(syncNativePersonalLibrary("token", library, request)).rejects.toThrow("repeated page");
  expect(library).toEqual(original);
});

it("waits for the complete personal library before resolving a first refresh", async () => {
  const cache = disk();
  const state = { ...enrollCustomVocabularyPack(createCustomSrsState(), personalLibraryPacks(library)[0]), personalLibraryRevision: 2 };
  const page = deferred<PersonalLibrary>();
  const requestLibrary = jest.fn(() => page.promise);
  const client = createCustomSrsClient({ cache, request: jest.fn().mockResolvedValue({ state, revision: 3 }), requestLibrary });
  client.setAccount({ id: "one", token: "token" });
  const refresh = client.refresh();
  for (let index = 0; index < 30; index++) await Promise.resolve();
  expect(client.getSnapshot().loading).toBe(true);
  page.resolve(library);
  await refresh;
  expect(client.getSnapshot()).toMatchObject({ loading: false, library, state });
  await client.refresh();
  expect(requestLibrary).toHaveBeenCalledTimes(1);
});

it("isolates cached libraries and ignores a response after logout", async () => {
  const page = deferred<PersonalLibrary>();
  const client = createCustomSrsClient({ cache: disk(), request: jest.fn().mockResolvedValue({ state: { ...createCustomSrsState(), personalLibraryRevision: 2 }, revision: 1 }), requestLibrary: () => page.promise });
  client.setAccount({ id: "one", token: "token" });
  const refresh = client.refresh();
  for (let index = 0; index < 30; index++) await Promise.resolve();
  client.setAccount(null);
  page.resolve(library);
  await expect(refresh).rejects.toThrow("account changed");
  expect(client.getSnapshot().library).toEqual(EMPTY_PERSONAL_LIBRARY);
});

it("does not let scheduling or library saves overtake queued answers", async () => {
  const cache = disk();
  const request = jest.fn().mockRejectedValue(new Error("Offline"));
  const mutateLibrary = jest.fn();
  const client = createCustomSrsClient({ cache, request, mutateLibrary });
  client.setAccount({ id: "one", token: "token" });
  await expect(client.mutate({ action: "complete_lesson", wordId: customVocabularyPacks[0].words[0].id, eventId })).rejects.toThrow("Offline");
  expect(client.getSnapshot().pendingCount).toBe(1);
  await expect(client.saveSettings({ action: "update_settings", settings: DEFAULT_CUSTOM_SRS_SETTINGS, expectedSettingsRevision: 0, eventId })).rejects.toThrow("finish syncing");
  await expect(client.saveLibrary({ action: "mutate_library", operations: [{ action: "create_deck", id: deckId, title: "My reading" }], expectedRevision: 0, eventId })).rejects.toThrow("finish syncing");
  expect(request).toHaveBeenCalledTimes(1);
  expect(mutateLibrary).not.toHaveBeenCalled();
});

it("retains confirmed progress and retries a failed settings save with the same event", async () => {
  const pack = customVocabularyPacks[0];
  const state = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(), pack), pack.words[0].id);
  const action = { action: "update_settings" as const, settings: { ...DEFAULT_CUSTOM_SRS_SETTINGS, mode: "fsrs" as const }, expectedSettingsRevision: 0, eventId };
  const next = updateCustomSrsSettings(state, action.settings, 0, eventId);
  const request = jest.fn().mockResolvedValueOnce({ state, revision: 1 }).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ state: next, revision: 2 });
  const client = createCustomSrsClient({ cache: disk(), request });
  client.setAccount({ id: "one", token: "token" });
  await client.refresh();
  await expect(client.saveSettings(action)).rejects.toThrow("Offline");
  expect(client.getSnapshot().state).toEqual(state);
  expect(client.getSnapshot().error).toBeNull();
  await client.saveSettings(action);
  expect(request.mock.calls[1][1]).toEqual(request.mock.calls[2][1]);
  expect(client.getSnapshot().state.assignments).toEqual(state.assignments);
  expect(client.getSnapshot().state.policy).toEqual(next.policy);
});

it("refreshes definitions and assignments together after a confirmed library save", async () => {
  const state = { ...enrollCustomVocabularyPack(createCustomSrsState(), personalLibraryPacks(library)[0]), personalLibraryRevision: 2 };
  const mutateLibrary = jest.fn().mockResolvedValue({ revision: 2, added: 1, skipped: 0, changed: 1 });
  const client = createCustomSrsClient({ cache: disk(), request: jest.fn().mockResolvedValue({ state, revision: 3 }), requestLibrary: jest.fn().mockResolvedValue(library), mutateLibrary });
  client.setAccount({ id: "one", token: "token" });
  const action = { action: "mutate_library" as const, operations: [{ action: "create_deck" as const, id: deckId, title: "My reading" }], expectedRevision: 0, eventId };
  await client.saveLibrary(action);
  expect(mutateLibrary).toHaveBeenCalledWith("token", action);
  expect(client.getSnapshot()).toMatchObject({ state, library, loading: false, syncing: false });
});
