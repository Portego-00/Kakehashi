import { createBunproReviewOutbox } from "../bunproReviewOutbox";
import { createBunproReviewSavePolicy } from "../bunproReviewSavePolicy";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("serializes writes, holds later answers on failure, and retries only explicitly", async () => {
  const first = deferred();
  const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const second = jest.fn().mockResolvedValue(undefined);
  const outbox = createBunproReviewOutbox(createBunproReviewSavePolicy(), jest.fn());
  outbox.enqueue({ title: "first", save, skip: jest.fn() });
  outbox.enqueue({ title: "second", save: second, skip: jest.fn() });
  const drained = outbox.drain();
  expect(second).not.toHaveBeenCalled();
  first.reject(new Error("Offline"));
  expect(await drained).toBe(false);
  expect(outbox.snapshot().pending).toBe(2);
  expect(second).not.toHaveBeenCalled();
  outbox.retry();
  expect(await outbox.drain()).toBe(true);
  expect(save).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(1);
  expect(outbox.snapshot().pending).toBe(0);
});

it("marks an explicitly skipped save unconfirmed and continues the queued saves", async () => {
  const outbox = createBunproReviewOutbox(createBunproReviewSavePolicy(), jest.fn());
  const skip = jest.fn();
  outbox.enqueue({ title: "first", save: async () => { throw new Error("Offline"); }, skip });
  outbox.enqueue({ title: "second", save: async () => {}, skip: jest.fn() });
  expect(await outbox.drain()).toBe(false);
  outbox.skip();
  expect(await outbox.drain()).toBe(true);
  expect(skip).toHaveBeenCalledTimes(1);
});

it("does not permit skipping an authentication failure", async () => {
  const outbox = createBunproReviewOutbox(createBunproReviewSavePolicy(), jest.fn());
  const skip = jest.fn();
  outbox.enqueue({ title: "first", save: async () => { throw { status: 401 }; }, skip });
  expect(await outbox.drain()).toBe(false);
  outbox.skip();
  expect(skip).not.toHaveBeenCalled();
  expect(outbox.snapshot().failure?.pause).toBe(true);
});

it("does not start old queued writes after a session reset", async () => {
  const first = deferred();
  const second = jest.fn();
  const outbox = createBunproReviewOutbox(createBunproReviewSavePolicy(), jest.fn());
  outbox.enqueue({ title: "first", save: () => first.promise, skip: jest.fn() });
  outbox.enqueue({ title: "second", save: second, skip: jest.fn() });
  const drained = outbox.drain();
  outbox.reset();
  first.resolve();
  expect(await drained).toBe(false);
  await Promise.resolve();
  expect(second).not.toHaveBeenCalled();
  expect(outbox.snapshot().pending).toBe(0);
});
