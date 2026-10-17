import { createPackageManager, PACKAGE_STORAGE_KEY } from "../package-store";
import { parsePackageText, packageSummary, resolveTranslatedMeaning } from "../resolver";
import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {values.set(key, value);}),
    removeItem: jest.fn(async (key: string) => {values.delete(key);}),
    multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, values.get(key) ?? null] as [string, string | null])),
    multiSet: jest.fn(async (pairs: [string, string][]) => {pairs.forEach(([key, value]) => values.set(key, value));}),
    multiRemove: jest.fn(async (keys: string[]) => {keys.forEach(key => values.delete(key));}),
  };
}
const packet = parsePackageText(JSON.stringify(data));
it("persists chunked content across restart and removes imported content", async () => {
  const storage = memoryStorage();
  const manager = createPackageManager(storage as any);
  await manager.activate(packet);
  expect(manager.state.getState().packet?.version).toBe(packet.version);
  const restarted = createPackageManager(storage as any);
  await restarted.hydrate();
  expect(restarted.state.getState().packet).toEqual(packet);
  await restarted.reset();
  expect(restarted.state.getState().packet).toBeNull();
  expect(storage.values.size).toBe(0);
});
it("preserves both active and saved content when a new write fails", async () => {
  const storage = memoryStorage(); const manager = createPackageManager(storage as any);
  await manager.activate(packet);
  const before = storage.values.get(PACKAGE_STORAGE_KEY);
  storage.multiSet.mockRejectedValueOnce(new Error("disk full"));
  await expect(manager.activate({...packet, version: "new"})).rejects.toThrow("disk full");
  expect(manager.state.getState().packet).toEqual(packet);
  expect(storage.values.get(PACKAGE_STORAGE_KEY)).toBe(before);
  const restarted = createPackageManager(storage as any); await restarted.hydrate();
  expect(restarted.state.getState().packet).toEqual(packet);
});
it("keeps old pointer after index write failure", async () => {
  const storage = memoryStorage(); const manager = createPackageManager(storage as any);
  await manager.activate(packet);
  storage.setItem.mockRejectedValueOnce(new Error("disk full"));
  await expect(manager.activate({...packet, version: "new"})).rejects.toThrow();
  const restarted = createPackageManager(storage as any); await restarted.hydrate();
  expect(restarted.state.getState().packet).toEqual(packet);
});
it("falls back safely for damaged cache and can then import a valid package", async () => {
  const storage = memoryStorage(); storage.values.set(PACKAGE_STORAGE_KEY, "bad json");
  const manager = createPackageManager(storage as any); await manager.hydrate();
  expect(manager.state.getState().packet).toBeNull();
  expect(manager.state.getState().error).not.toBeNull();
  await manager.activate(packet); expect(manager.state.getState().error).toBeNull();
});
it("supports image radicals by ID and null characters in schema 2", () => {
  const entry = JSON.parse(JSON.stringify(packet.subjects["440"]));
  entry.source.type = "radical"; entry.source.word = null; entry.source.readingsJa = [];
  const radical = parsePackageText(JSON.stringify({...packet, schemaVersion: 2, subjects: {"1": entry}}));
  expect(packageSummary(radical).radical).toBe(1);
  expect(resolveTranslatedMeaning(radical, {id: 1, object: "radical", characters: null, meanings: entry.source.meaningsEn.map((meaning: string) => ({meaning}))})).not.toBeNull();
  expect(() => parsePackageText(JSON.stringify({...radical, schemaVersion: 1}))).toThrow();
  entry.source.type = "kanji";
  expect(() => parsePackageText(JSON.stringify({...radical, subjects: {"1": entry}}))).toThrow();
});
it("rejects malformed, unsupported and oversized files", () => {
  expect(() => parsePackageText("broken")).toThrow("JSON");
  expect(() => parsePackageText(JSON.stringify({...packet, scope: "write"}))).toThrow();
  expect(() => parsePackageText("x".repeat(20 * 1024 * 1024 + 1))).toThrow("20 MB");
});

it("loads a small v2 sample with kanji, vocabulary and kana examples", () => {
  const {readFileSync} = require("node:fs");
  const {resolve} = require("node:path");
  const loaded = parsePackageText(readFileSync(resolve(process.cwd(), "tests/fixtures/translation-packages/wanikani-tr-seviye-08.json"), "utf8"));
  expect(packageSummary(loaded)).toEqual({radical: 0, kanji: 1, vocabulary: 1, kana_vocabulary: 1, sentences: 6, levels: [8]});
  for (const [id, entry] of Object.entries(loaded.subjects)) {
    const subject = {id: Number(id), object: entry.source.type, characters: entry.source.word,
      meanings: entry.source.meaningsEn.map(meaning => ({meaning})), readings: entry.source.readingsJa.map(reading => ({reading}))};
    expect(resolveTranslatedMeaning(loaded, subject)?.primary).toBe(entry.meaning.primary);
  }
});

it("persists the v3 example across restart", async () => {
  const {readFileSync} = require("node:fs");
  const {resolve} = require("node:path");
  const combined = parsePackageText(readFileSync(resolve(process.cwd(), "translation-packages/example-tr-v3.json"), "utf8"));
  const storage = memoryStorage(); const manager = createPackageManager(storage as any);
  await manager.activate(combined);
  const restarted = createPackageManager(storage as any); await restarted.hydrate();
  expect(Object.keys(restarted.state.getState().packet!.subjects)).toHaveLength(5);
  expect(restarted.state.getState().packet).toEqual(combined);
  await restarted.reset(); expect(storage.values.size).toBe(0);
});
