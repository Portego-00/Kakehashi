import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack } from "../../../../web/src/features/custom-srs/model";
import { customVocabularyPacks } from "../catalog";
import { createCustomSrsClient, CustomSrsConflictError, customSrsCacheKey, parseCustomSrsCloudResult, requestCustomSrsCloud } from "../client";

const pack = customVocabularyPacks[0];
const now = new Date("2026-09-07T15:00:00Z");
const initial = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
const learned = completeCustomLesson(initial, pack.words[0].id, now);
const action = { action: "complete_lesson", wordId: pack.words[0].id, eventId: "ff0b0dd3-9a7e-4f36-9017-f0f852aa584f" } as const;
const cache = () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("custom vocabulary cloud state", () => {
  it("uses the exact web catalog and scheduler schema", () => {
    expect(customVocabularyPacks.length).toBeGreaterThanOrEqual(49);
    expect(customVocabularyPacks.flatMap((entry) => entry.words).length).toBeGreaterThanOrEqual(500);
    const result = parseCustomSrsCloudResult({ available: true, state: learned, revision: 3 });
    expect(result.state).toEqual(learned);
  });

  it("accepts JSONB key order but refuses unknown policies and unavailable-cloud responses", () => {
    const policy = Object.fromEntries(Object.entries(learned.policy).reverse());
    expect(parseCustomSrsCloudResult({ available: true, state: { ...learned, policy }, revision: 3 }).state).toEqual(learned);
    expect(() => parseCustomSrsCloudResult({ available: false, state: null, revision: -1 })).toThrow();
    expect(() => parseCustomSrsCloudResult({ available: true, state: { ...learned, policy: { ...policy, version: 2 } }, revision: 3 })).toThrow();
  });

  it("rejects damaged learned cards instead of resetting them to unlearned", () => {
    const damaged = { ...learned, assignments: { ...learned.assignments, [action.wordId]: { ...learned.assignments[action.wordId], card: null } } };
    expect(() => parseCustomSrsCloudResult({ available: true, state: damaged, revision: 3 })).toThrow("could not be read safely");
  });

  it("does not optimistically advance or cache failed saves", async () => {
    const disk = cache();
    const request = jest.fn().mockResolvedValueOnce({ state: initial, revision: 1 }).mockRejectedValueOnce(new Error("Offline"));
    const client = createCustomSrsClient({ request, cache: disk });
    client.setAccount({ id: "account-one", token: "token-one" });
    await client.refresh();
    const writesBefore = disk.setItem.mock.calls.length;
    const save = client.mutate(action);
    expect(client.getSnapshot().syncing).toBe(true);
    expect(client.getSnapshot().state.assignments[action.wordId].stage).toBe(0);
    await expect(save).rejects.toThrow("Offline");
    expect(client.getSnapshot().error).toBe("Offline");
    expect(client.getSnapshot().syncing).toBe(false);
    expect(disk.setItem).toHaveBeenCalledTimes(writesBefore);
  });

  it("returns server-confirmed state and preserves caller event IDs through retries", async () => {
    const request = jest.fn().mockRejectedValueOnce(new Error("Timeout")).mockResolvedValue({ state: learned, revision: 4 });
    const client = createCustomSrsClient({ request, cache: cache() });
    client.setAccount({ id: "account-one", token: "token-one" });
    await expect(client.mutate(action)).rejects.toThrow("Timeout");
    await expect(client.mutate(action)).resolves.toEqual(learned);
    expect(request.mock.calls[0]).toEqual(["token-one", action]);
    expect(request.mock.calls[1]).toEqual(["token-one", action]);
    expect(client.getSnapshot().revision).toBe(4);
  });

  it("resets immediately on logout and ignores requests completing from another account", async () => {
    const pending = deferred<{ state: typeof learned; revision: number }>();
    const disk = cache();
    const client = createCustomSrsClient({ request: jest.fn(() => pending.promise), cache: disk });
    client.setAccount({ id: "account-one", token: "token-one" });
    const refresh = client.refresh();
    client.setAccount(null);
    expect(client.getSnapshot().state.enrolledPackIds).toEqual([]);
    expect(client.getSnapshot().accountId).toBeNull();
    client.setAccount({ id: "account-two", token: "token-two" });
    pending.resolve({ state: learned, revision: 1 });
    await expect(refresh).rejects.toThrow("account changed");
    expect(client.getSnapshot().state.enrolledPackIds).toEqual([]);
    expect(disk.setItem).not.toHaveBeenCalled();
  });

  it("uses account-scoped cached reads without persisting authentication tokens", async () => {
    const disk = cache();
    disk.getItem.mockResolvedValue(JSON.stringify({ available: true, state: learned, revision: 3 }));
    const client = createCustomSrsClient({ request: jest.fn(), cache: disk });
    client.setAccount({ id: "account-one", token: "private-token" });
    await Promise.resolve();
    expect(disk.getItem).toHaveBeenCalledWith(customSrsCacheKey("account-one"));
    expect(client.getSnapshot().state).toEqual(learned);
    expect(JSON.stringify(client.getSnapshot())).not.toContain("private-token");
  });

  it("does not let a stale refresh replace a newer confirmed mutation", async () => {
    const read = deferred<{ state: typeof initial; revision: number }>();
    const request = jest.fn().mockReturnValueOnce(read.promise).mockResolvedValueOnce({ state: learned, revision: 5 });
    const client = createCustomSrsClient({ request, cache: cache() });
    client.setAccount({ id: "account-one", token: "token-one" });
    const refresh = client.refresh();
    await client.mutate(action);
    read.resolve({ state: initial, revision: 4 });
    await refresh;
    expect(client.getSnapshot().state).toEqual(learned);
    expect(client.getSnapshot().revision).toBe(5);
  });

  it("opens a confirmed study queue without waiting for the device cache to finish writing", async () => {
    const pendingCache = deferred<void>();
    const disk = cache();
    disk.setItem.mockReturnValueOnce(pendingCache.promise);
    const client = createCustomSrsClient({
      request: jest.fn().mockResolvedValue({ state: learned, revision: 5 }), cache: disk,
    });
    client.setAccount({ id: "account-one", token: "token-one" });
    let loaded = false;
    const refresh = client.refresh().then(() => { loaded = true; });
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
    expect(loaded).toBe(true);
    expect(client.getSnapshot()).toMatchObject({ loading: false, syncing: false, revision: 5 });
    pendingCache.resolve();
    await refresh;
  });

  it("keeps cache writes ordered without blocking a newer confirmed lesson save", async () => {
    const pendingCache = deferred<void>();
    const disk = cache();
    disk.setItem.mockReturnValueOnce(pendingCache.promise);
    const client = createCustomSrsClient({
      request: jest.fn()
        .mockResolvedValueOnce({ state: initial, revision: 1 })
        .mockResolvedValueOnce({ state: learned, revision: 2 }),
      cache: disk,
    });
    client.setAccount({ id: "account-one", token: "token-one" });
    await client.refresh();
    await expect(client.mutate(action)).resolves.toEqual(learned);
    expect(client.getSnapshot()).toMatchObject({ revision: 2, syncing: false });
    expect(disk.setItem).toHaveBeenCalledTimes(1);
    pendingCache.resolve();
    for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
    expect(disk.setItem).toHaveBeenCalledTimes(2);
    expect(disk.setItem.mock.calls.map(([, value]) => JSON.parse(value).revision)).toEqual([1, 2]);
  });

  it("coalesces repeated confirmed progress to one pending cache write while disk is stalled", async () => {
    const pendingCache = deferred<void>();
    const disk = cache();
    disk.setItem.mockReturnValueOnce(pendingCache.promise);
    let revision = 0;
    const client = createCustomSrsClient({
      request: jest.fn(async () => ({ state: learned, revision: ++revision })), cache: disk,
    });
    client.setAccount({ id: "account-one", token: "token-one" });
    await client.refresh();
    for (let index = 0; index < 20; index += 1) await client.mutate(action);
    expect(client.getSnapshot()).toMatchObject({ revision: 21, loading: false, syncing: false });
    expect(disk.setItem).toHaveBeenCalledTimes(1);
    pendingCache.resolve();
    for (let tick = 0; tick < 100; tick += 1) await Promise.resolve();
    expect(disk.setItem.mock.calls.map(([, value]) => JSON.parse(value).revision)).toEqual([1, 21]);
  });

  it("keeps the latest pending cache snapshot separate for each account", async () => {
    const pendingCache = deferred<void>();
    const disk = cache();
    disk.setItem.mockReturnValueOnce(pendingCache.promise);
    const request = jest.fn()
      .mockResolvedValueOnce({ state: initial, revision: 1 })
      .mockResolvedValueOnce({ state: learned, revision: 2 })
      .mockResolvedValueOnce({ state: initial, revision: 10 })
      .mockResolvedValueOnce({ state: learned, revision: 11 })
      .mockResolvedValueOnce({ state: learned, revision: 3 });
    const client = createCustomSrsClient({ request, cache: disk });
    client.setAccount({ id: "account-one", token: "token-one" });
    await client.refresh();
    await client.mutate(action);
    client.setAccount({ id: "account-two", token: "token-two" });
    await client.refresh();
    await client.mutate(action);
    client.setAccount({ id: "account-one", token: "token-refreshed" });
    await client.refresh();
    expect(client.getSnapshot()).toMatchObject({ accountId: "account-one", revision: 3, syncing: false });
    pendingCache.resolve();
    for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
    expect(disk.setItem.mock.calls.map(([key, value]) => [key, JSON.parse(value).revision])).toEqual([
      [customSrsCacheKey("account-one"), 1],
      [customSrsCacheKey("account-one"), 3],
      [customSrsCacheKey("account-two"), 11],
    ]);
  });

  it("continues caching newer progress after a failed disk write without failing cloud saves", async () => {
    const pendingCache = deferred<void>();
    const disk = cache();
    disk.setItem.mockReturnValueOnce(pendingCache.promise);
    const client = createCustomSrsClient({
      request: jest.fn()
        .mockResolvedValueOnce({ state: initial, revision: 1 })
        .mockResolvedValueOnce({ state: learned, revision: 2 })
        .mockResolvedValueOnce({ state: learned, revision: 3 }),
      cache: disk,
    });
    client.setAccount({ id: "account-one", token: "token-one" });
    await client.refresh();
    await expect(client.mutate(action)).resolves.toEqual(learned);
    pendingCache.reject(new Error("Device storage unavailable"));
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
    expect(disk.setItem.mock.calls.map(([, value]) => JSON.parse(value).revision)).toEqual([1, 2]);
    await expect(client.refresh()).resolves.toEqual(learned);
    expect(disk.setItem.mock.calls.map(([, value]) => JSON.parse(value).revision)).toEqual([1, 2, 3]);
    expect(client.getSnapshot()).toMatchObject({ revision: 3, error: null, loading: false, syncing: false });
  });

  it("deduplicates concurrent refresh and serializes cloud mutations", async () => {
    const pending = deferred<{ state: typeof initial; revision: number }>();
    const request = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ state: learned, revision: 2 });
    const client = createCustomSrsClient({ request, cache: cache() });
    client.setAccount({ id: "account-one", token: "token-one" });
    const first = client.refresh();
    const second = client.refresh();
    expect(client.getSnapshot().syncing).toBe(true);
    expect(first).toBe(second);
    expect(request).toHaveBeenCalledTimes(1);
    pending.resolve({ state: initial, revision: 1 });
    await first;
    expect(client.getSnapshot().syncing).toBe(false);
    await Promise.all([client.mutate(action), client.mutate(action)]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(client.getSnapshot().syncing).toBe(false);
  });

  it("does not treat an unavailable server as successful local-only progress", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ available: false, state: null, revision: -1 }) });
    await expect(requestCustomSrsCloud("token", action, { url: "https://cloud.example", anonKey: "public-key", fetcher })).rejects.toThrow("did not confirm");
  });

  it("preserves a typed conflict through transport and the client mutation queue", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Word no longer due" }) });
    const client = createCustomSrsClient({
      request: (token, mutation) => requestCustomSrsCloud(token, mutation, { url: "https://cloud.example", anonKey: "public-key", fetcher }),
      cache: cache(),
    });
    client.setAccount({ id: "account-one", token: "token-one" });
    const save = client.mutate(action);
    await expect(save).rejects.toBeInstanceOf(CustomSrsConflictError);
    await expect(save).rejects.toMatchObject({ status: 409, name: "CustomSrsConflictError" });
    expect(client.getSnapshot().state.enrolledPackIds).toEqual([]);
    expect(client.getSnapshot().syncing).toBe(false);
  });

  it("does not misclassify unavailable cloud saves as stale-queue conflicts", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Unavailable" }) });
    await expect(requestCustomSrsCloud("token", action, { url: "https://cloud.example", anonKey: "public-key", fetcher })).rejects.not.toBeInstanceOf(CustomSrsConflictError);
  });

  it("sends auth only in headers and uses only the custom edge endpoint", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, state: learned, revision: 2 }) });
    await requestCustomSrsCloud("private-token", action, { url: "https://cloud.example", anonKey: "public-key", fetcher });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://cloud.example/functions/v1/custom-srs");
    expect(init.headers["x-wanikani-token"]).toBe("private-token");
    expect(init.body).not.toContain("private-token");
    expect(init.body).not.toContain("userId");
  });
});
