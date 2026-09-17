import { describe, expect, it, vi } from "vitest";
import { createReviewSync, predictedReviewStage } from "./review-sync";
import { loadReviewOutbox } from "./review-outbox";

function setup(deliver = vi.fn(async () => 4)) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const onConfirmed = vi.fn();
  const onPermissionError = vi.fn();
  const wait = vi.fn<(ms: number, signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined);
  const sync = createReviewSync({ storage, username: "Portego", deliver, onConfirmed, onPermissionError, onChange: vi.fn(), wait });
  return { sync, storage, deliver, onConfirmed, onPermissionError, wait, pending: () => loadReviewOutbox(storage, "Portego") };
}
const row = (assignmentId = 1) => ({ assignmentId, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: "2026-09-17T10:00:00.000Z" });

describe("background review delivery", () => {
  it("durably saves before starting delivery and serializes uploads", async () => {
    let complete!: (stage: number) => void;
    const delivery = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { complete = resolve; })).mockResolvedValue(5);
    const { sync, pending, onConfirmed } = setup(delivery);
    sync.enqueue(row());
    sync.enqueue(row(2));
    expect(pending()).toHaveLength(2);
    expect(delivery).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(delivery).toHaveBeenCalledTimes(1);
    complete(4);
    await sync.settled();
    expect(delivery).toHaveBeenCalledTimes(2);
    expect(onConfirmed.mock.calls.map(([entry, stage]) => [entry.assignmentId, stage])).toEqual([[1, 4], [2, 5]]);
    expect(pending()).toEqual([]);
  });

  it("silently retries transient failures with the original answer and timestamp", async () => {
    const delivery = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("timeout")).mockResolvedValue(4);
    const { sync, pending, wait, onPermissionError } = setup(delivery);
    sync.enqueue(row());
    await sync.settled();
    expect(delivery).toHaveBeenCalledTimes(3);
    expect(delivery.mock.calls.map(([entry]) => entry.createdAt)).toEqual(Array(3).fill(row().createdAt));
    expect(wait.mock.calls.map(call => call[0])).toEqual([500, 1000]);
    expect(pending()).toEqual([]);
    expect(onPermissionError).not.toHaveBeenCalled();
  });

  it("retries exhausted rows again at the end, even when finish arrives during upload", async () => {
    const delivery = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(4);
    const { sync, pending } = setup(delivery);
    sync.enqueue(row());
    sync.finish();
    await sync.settled();
    expect(delivery).toHaveBeenCalledTimes(4);
    expect(pending()).toEqual([]);
    sync.finish();
    await sync.settled();
    expect(delivery).toHaveBeenCalledTimes(4);
  });

  it("retains exhausted rows after the final pass and recovers on reconnect", async () => {
    const delivery = vi.fn().mockRejectedValue(new Error("offline"));
    const { sync, pending, onPermissionError } = setup(delivery);
    sync.enqueue(row());
    sync.finish();
    await sync.settled();
    expect(delivery).toHaveBeenCalledTimes(6);
    expect(pending()[0].attempts).toBe(6);
    expect(onPermissionError).not.toHaveBeenCalled();
    delivery.mockResolvedValue(4);
    sync.retryPending();
    await sync.settled();
    expect(pending()).toEqual([]);
  });

  it.each([401, 403])("stops retries and reports only permission errors (%s)", async (status) => {
    const { sync, pending, deliver, onPermissionError } = setup(vi.fn().mockRejectedValue({ status }));
    sync.enqueue(row());
    sync.enqueue(row(2));
    sync.finish();
    await sync.settled();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(onPermissionError).toHaveBeenCalledOnce();
    expect(pending()).toHaveLength(2);
    sync.retryPending();
    await sync.settled();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("honors rate-limit retry delays", async () => {
    const { sync, wait } = setup(vi.fn().mockRejectedValueOnce({ status: 429, retryAfterMs: 8000 }).mockResolvedValue(4));
    sync.enqueue(row());
    await sync.settled();
    expect(wait.mock.calls[0][0]).toBeGreaterThan(7000);
  });

  it("leaves in-flight rows durable when the screen is closed", async () => {
    let complete!: (stage: number) => void;
    const { sync, pending, onConfirmed } = setup(vi.fn(() => new Promise<number>(resolve => { complete = resolve; })));
    sync.enqueue(row());
    await Promise.resolve();
    sync.dispose();
    complete(4);
    await sync.settled();
    expect(pending()).toHaveLength(1);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("does not claim completion if durable storage fails", () => {
    const { sync, storage, deliver } = setup();
    storage.setItem = () => { throw new Error("quota"); };
    expect(() => sync.enqueue(row())).toThrow("quota");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("keeps every answer in a large offline session", () => {
    const { sync, pending } = setup();
    for (let id = 1; id <= 307; id++) sync.enqueue(row(id));
    expect(pending()).toHaveLength(307);
    sync.dispose();
  });
});

describe("optimistic WaniKani stage", () => {
  it.each([[3,0,0,4], [8,0,0,9], [9,0,0,9], [3,1,0,2], [3,1,1,2], [5,1,0,3], [8,1,1,6], [1,1,1,1], [5,2,1,1]])("predicts stage %s with %s meaning and %s reading errors as %s", (stage, meaning, reading, expected) => {
    expect(predictedReviewStage(stage, meaning, reading)).toBe(expected);
  });
});
