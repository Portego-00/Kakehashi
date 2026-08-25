import { describe, expect, it } from "vitest";
import { createListRepository, listStorageKey, subscribeSubjectLists, type ListStorage } from "./lists";

class MemoryStorage implements ListStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("subject list persistence", () => {
  it("namespaces collections per WaniKani user", () => {
    expect(listStorageKey("Alice")).not.toBe(listStorageKey("Bob"));
    expect(listStorageKey("Alice")).toBe(listStorageKey("alice"));
  });

  it("creates, renames, reorders and deletes lists", () => {
    const storage = new MemoryStorage();
    let id = 0;
    const repository = createListRepository(storage, "alice", () => new Date("2026-08-06T00:00:00Z"), () => `list-${++id}`);
    const first = repository.create("First");
    const second = repository.create("Second");
    repository.rename(first.id, "Core kanji");
    repository.reorder(second.id, 0);
    expect(repository.load().map((list) => list.name)).toEqual(["Second", "Core kanji"]);
    repository.remove(second.id);
    expect(repository.load().map((list) => list.id)).toEqual([first.id]);
  });

  it("deduplicates and reorders subject ids", () => {
    const storage = new MemoryStorage();
    const repository = createListRepository(storage, "alice", undefined, () => "one");
    repository.create("Study");
    repository.addSubject("one", 10);
    repository.addSubject("one", 20);
    repository.addSubject("one", 10);
    repository.reorderSubject("one", 20, 0);
    expect(repository.load()[0].subjectIds).toEqual([20, 10]);
    repository.removeSubject("one", 20);
    expect(repository.load()[0].subjectIds).toEqual([10]);
  });

  it("recovers from corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(listStorageKey("alice"), "not json");
    expect(createListRepository(storage, "alice").load()).toEqual([]);
  });

  it("notifies mounted dashboard and study consumers when a list changes", () => {
    const storage = new MemoryStorage();
    const repository = createListRepository(storage, "alice", undefined, () => "one");
    let changes = 0;
    const unsubscribe = subscribeSubjectLists("alice", () => { changes += 1; });

    repository.create("Study");
    repository.addSubject("one", 10);
    unsubscribe();

    expect(changes).toBe(2);
  });
});
