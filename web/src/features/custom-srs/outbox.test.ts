import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWebLocks } from "@/test/web-locks";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { customSrsOutboxKey, enqueueCustomSrsMutation, flushCustomSrsOutbox, projectCustomSrsOutbox, readCustomSrsOutbox, rememberCustomSrsRemote, retryCustomSrsOutbox, saveCustomSrsOutbox, type PendingCustomSrsMutation, type RemoteStateResponse } from "./outbox";
import type { CustomVocabularyPack } from "./types";

const pack: CustomVocabularyPack = {
  id: "pack", title: "Pack", description: "Pack", script: "hiragana",
  words: ["いち", "に"].map((word) => ({ id: word, characters: word, reading: word, meanings: [word], partsOfSpeech: ["noun"], meaningMnemonic: "A word.", contextSentences: [] })),
};
const scope = "1234";
const now = new Date("2026-09-01T10:00:00Z");
const initial = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
const remote: RemoteStateResponse = { available: true, state: initial, revision: 0 };
const one = "11111111-1111-4111-8111-111111111111";
const two = "22222222-2222-4222-8222-222222222222";
const lesson = (wordId: string, eventId: string): PendingCustomSrsMutation => ({
  payload: { action: "complete_lesson", wordId, eventId: eventId === "one" ? one : two, accountId: scope }, createdAt: now.toISOString(),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("durable custom SRS outbox", () => {
  beforeEach(() => { window.localStorage.clear(); vi.stubGlobal("navigator", { locks: createTestWebLocks() }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("stores multiple answers in one durable account envelope with fixed replay times", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    await enqueueCustomSrsMutation(scope, lesson("に", "two"), [pack], remote);
    const restored = readCustomSrsOutbox(scope)!;
    expect(restored.pending.map((entry) => entry.payload.eventId)).toEqual([one, two]);
    expect(projectCustomSrsOutbox(restored, [pack]).assignments["に"]).toMatchObject({ stage: 1, startedAt: now.toISOString() });
    expect(readCustomSrsOutbox("other")).toBeNull();
  });

  it("does not erase an answer enqueued by another tab while an earlier request is awaiting ACK", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const first = deferred<RemoteStateResponse>();
    let active = true;
    const sender = vi.fn(() => first.promise);
    const worker = flushCustomSrsOutbox(scope, sender, vi.fn(), () => active);
    await vi.waitFor(() => expect(sender).toHaveBeenCalledOnce());
    const updatedByOtherTab = readCustomSrsOutbox(scope)!;
    saveCustomSrsOutbox(scope, { ...updatedByOtherTab, pending: [...updatedByOtherTab.pending, lesson("に", "two")] });
    active = false;
    first.resolve({ available: true, state: completeCustomLesson(initial, "いち", now), revision: 1 });
    await worker;
    const restored = readCustomSrsOutbox(scope)!;
    expect(restored.pending.map((entry) => entry.payload.eventId)).toEqual([two]);
    expect(projectCustomSrsOutbox(restored, [pack]).assignments["に"].stage).toBe(1);
  });

  it("does not let an older ACK overwrite a newer cloud snapshot observed in another tab", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const first = deferred<RemoteStateResponse>();
    const sender = vi.fn(() => first.promise);
    const worker = flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    await vi.waitFor(() => expect(sender).toHaveBeenCalledOnce());
    const newest = completeCustomLesson(completeCustomLesson(initial, "いち", now), "に", now);
    await rememberCustomSrsRemote(scope, { available: true, state: newest, revision: 7 });
    first.resolve({ available: true, state: completeCustomLesson(initial, "いち", now), revision: 2 });
    await worker;
    expect(readCustomSrsOutbox(scope)!.confirmed).toEqual({ state: newest, revision: 7 });
    expect(readCustomSrsOutbox(scope)!.pending).toHaveLength(0);
  });

  it("retries an uncertain delivery with its original event ID and removes it only after success", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const sender = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue({ available: true, state: completeCustomLesson(initial, "いち", now), revision: 1 });
    await flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    expect(readCustomSrsOutbox(scope)).toMatchObject({ syncError: "Connection lost", attempts: 1, pending: [lesson("いち", "one")] });
    await flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    expect(sender).toHaveBeenCalledOnce();
    await retryCustomSrsOutbox(scope);
    await flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    expect(sender.mock.calls[1][0]).toEqual(sender.mock.calls[0][0]);
    expect(readCustomSrsOutbox(scope)).toMatchObject({ pending: [], syncError: "", attempts: 0 });
  });

  it("retains authorization failures for explicit retry instead of looping requests", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const sender = vi.fn().mockRejectedValue(Object.assign(new Error("Wrong account"), { status: 403 }));
    await flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    await flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    expect(sender).toHaveBeenCalledOnce();
    expect(readCustomSrsOutbox(scope)).toMatchObject({ syncError: "Wrong account", retryAt: Number.MAX_SAFE_INTEGER });
    expect(readCustomSrsOutbox(scope)!.pending).toHaveLength(1);
  });

  it("shares a single account sender between multiple mounted consumers", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const response = deferred<RemoteStateResponse>();
    const sender = vi.fn(() => response.promise);
    const first = flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    const second = flushCustomSrsOutbox(scope, sender, vi.fn(), () => true);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(sender).toHaveBeenCalledOnce());
    response.resolve({ available: true, state: completeCustomLesson(initial, "いち", now), revision: 1 });
    await Promise.all([first, second]);
    expect(sender).toHaveBeenCalledOnce();
  });

  it("protects unreadable pending answers rather than silently resetting them", async () => {
    window.localStorage.setItem(customSrsOutboxKey(scope), "not valid JSON");
    await expect(enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote)).rejects.toThrow("could not be read");
    expect(window.localStorage.getItem(customSrsOutboxKey(scope))).toBe("not valid JSON");
  });

  it("does not deliver previously queued answers when safe cross-tab locking is unavailable", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    vi.stubGlobal("navigator", {});
    const sender = vi.fn();
    await expect(flushCustomSrsOutbox(scope, sender, vi.fn(), () => true)).rejects.toThrow("Web Locks");
    expect(sender).not.toHaveBeenCalled();
    expect(readCustomSrsOutbox(scope)!.pending).toHaveLength(1);
  });

  it("rejects invalid commands before they can poison the durable delivery queue", async () => {
    const invalidId = lesson("いち", "one");
    invalidId.payload.eventId = "not-a-uuid";
    await expect(enqueueCustomSrsMutation(scope, invalidId, [pack], remote)).rejects.toThrow("invalid");
    const tooManyAttempts: PendingCustomSrsMutation = {
      createdAt: now.toISOString(),
      payload: { accountId: scope, action: "submit_review", wordId: "いち", incorrectAnswers: 101, eventId: one, expectedAssignmentUpdatedAt: now.toISOString() },
    };
    await expect(enqueueCustomSrsMutation(scope, tooManyAttempts, [pack], remote)).rejects.toThrow("invalid");
    expect(readCustomSrsOutbox(scope)).toBeNull();
  });

  it("does not review a later occurrence against an earlier answer that has not synced", async () => {
    await enqueueCustomSrsMutation(scope, lesson("いち", "one"), [pack], remote);
    const laterReview: PendingCustomSrsMutation = {
      createdAt: new Date("2026-09-02T10:00:00Z").toISOString(),
      payload: { accountId: scope, action: "submit_review", wordId: "いち", incorrectAnswers: 0, eventId: two, expectedAssignmentUpdatedAt: now.toISOString() },
    };
    await expect(enqueueCustomSrsMutation(scope, laterReview, [pack], remote)).rejects.toThrow("earlier answer is still syncing");
    expect(readCustomSrsOutbox(scope)!.pending).toHaveLength(1);
  });

  it("does not project an old review onto a later occurrence after another device reviewed it", async () => {
    const learned = completeCustomLesson(initial, "いち", now);
    const reviewedAt = new Date("2026-09-02T10:00:00Z");
    const entry: PendingCustomSrsMutation = {
      createdAt: reviewedAt.toISOString(),
      payload: { accountId: scope, action: "submit_review", wordId: "いち", incorrectAnswers: 0, eventId: one, expectedAssignmentUpdatedAt: now.toISOString() },
    };
    await enqueueCustomSrsMutation(scope, entry, [pack], { available: true, state: learned, revision: 1 });
    const otherDevice = recordCustomReview(learned, "いち", 0, reviewedAt, "other");
    await rememberCustomSrsRemote(scope, { available: true, state: otherDevice, revision: 2 });
    const projected = projectCustomSrsOutbox(readCustomSrsOutbox(scope)!, [pack]);
    expect(projected).toEqual(otherDevice);
    expect(projected.assignments["いち"].correctReviews).toBe(1);
  });
});
