import { createInlineHandwritingDraftSession, inlineHandwritingDraftKey } from "../inline-handwriting-drafts";
import { encodeInlineInk, type InlineInkDocument } from "../../../../web/src/features/notebooks/inline-ink";

const ink: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [{ id: "one", tool: "pen", color: "#111111", width: 3, points: [[10, 20, 0.6]] }] };
const newer: InlineInkDocument = { ...ink, strokes: [...ink.strokes, { ...ink.strokes[0], id: "two" }] };
const payload = { inkFormat: "strokes-v1" as const, inkBase64: encodeInlineInk(ink), previewBase64: "unused-by-session", width: ink.width, height: ink.height };
const saved = { inkFormat: "strokes-v1" as const, drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: ink.width, height: ink.height };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function setup() {
  const data = new Map<string, string>(); let current = true;
  const options = {
    key: inlineHandwritingDraftKey("42", `page-${Math.random()}`, "block"),
    cache: { getItem: jest.fn(async (key: string) => data.get(key) || null), setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }), removeItem: jest.fn(async (key: string) => { data.delete(key); }) },
    isCurrent: () => current, loadOriginal: jest.fn(async () => payload), save: jest.fn(async () => saved), persistPage: jest.fn(async (): Promise<void> => undefined),
  };
  return { data, options, session: createInlineHandwritingDraftSession(options), leave: () => { current = false; } };
}

it("recovers completed strokes after remount without uploading and isolates each account/page/block", async () => {
  const { session, options } = setup();
  await session.stage("", ink);
  expect(await createInlineHandwritingDraftSession(options).load("")).toEqual(ink);
  expect(options.save).not.toHaveBeenCalled(); expect(options.loadOriginal).not.toHaveBeenCalled();
  expect(new Set([inlineHandwritingDraftKey("a:b", "c", "d"), inlineHandwritingDraftKey("a", "b:c", "d"), inlineHandwritingDraftKey("a", "b", "c:d")]).size).toBe(3);
});

it("finishes accepted writes after navigation before a remounted session reads", async () => {
  const { session, options, data, leave } = setup(); const gate = deferred<void>();
  options.cache.setItem.mockImplementationOnce(async (key, value) => { await gate.promise; data.set(key, value); });
  const stage = session.stage("", ink); leave();
  const remount = createInlineHandwritingDraftSession({ ...options, isCurrent: () => true }).load("");
  gate.resolve(); await stage;
  expect(await remount).toEqual(ink);
});

it("accepts the final queued snapshot for a captured block after its page closes", async () => {
  const { session, options, leave } = setup();
  await session.stage("", ink); leave(); await session.stage("", newer);
  expect(await createInlineHandwritingDraftSession({ ...options, isCurrent: () => true }).load("")).toEqual(newer);
  await expect(session.save("", payload)).rejects.toThrow("account or page changed");
  expect(options.save).not.toHaveBeenCalled();
});

it("prefers a newer local snapshot that arrives during remote loading", async () => {
  const { session, options } = setup(); const gate = deferred<typeof payload>(); const started = deferred<void>();
  options.loadOriginal.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  const loading = session.load(saved.drawingId); await started.promise;
  await session.stage(saved.drawingId, newer); gate.resolve(payload);
  expect(await loading).toEqual(newer);
});

it("retains local ink across upload and page-persistence failures, reusing a saved asset on retry", async () => {
  const { session, options, data } = setup();
  options.save.mockRejectedValueOnce(new Error("offline"));
  await expect(session.save("", payload)).rejects.toThrow("offline");
  expect(await session.load("")).toEqual(ink);
  expect(await session.save("", payload)).toEqual(saved);
  options.persistPage.mockRejectedValueOnce(new Error("disk full"));
  await expect(session.commit(saved.drawingId)).rejects.toThrow("disk full");
  expect(data.has(options.key)).toBe(true);
  expect(await session.save(saved.drawingId, payload)).toEqual(saved);
  expect(options.save).toHaveBeenCalledTimes(2);
  await session.commit(saved.drawingId);
  expect(data.has(options.key)).toBe(false);
});

it("waits for the page reference to persist before clearing recovery", async () => {
  const { session, options, data } = setup(); const gate = deferred<void>();
  await session.save("", payload);
  options.persistPage.mockImplementationOnce(() => gate.promise);
  const commit = session.commit(saved.drawingId);
  await Promise.resolve(); await Promise.resolve();
  expect(data.has(options.key)).toBe(true);
  gate.resolve(); await commit;
  expect(data.has(options.key)).toBe(false);
});

it("keeps newer local strokes if they arrive during upload", async () => {
  const { session, options } = setup(); const upload = deferred<typeof saved>(); const started = deferred<void>();
  options.save.mockImplementationOnce(() => { started.resolve(); return upload.promise; });
  const saving = session.save("", payload);
  const rejected = expect(saving).rejects.toThrow("changed while saving");
  await started.promise; await session.stage("", newer); upload.resolve(saved); await rejected;
  expect(await session.load("")).toEqual(newer);
});

it("keeps newer local strokes if they arrive while committing an older page reference", async () => {
  const { session, options } = setup(); const gate = deferred<void>(); const started = deferred<void>();
  await session.save("", payload);
  options.persistPage.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  const commit = session.commit(saved.drawingId); await started.promise;
  await session.stage(saved.drawingId, newer); gate.resolve(); await commit;
  expect(await session.load(saved.drawingId)).toEqual(newer);
});

it("does not return an upload to another account/page, while retaining its recovery reference", async () => {
  const { session, options, leave } = setup(); const upload = deferred<typeof saved>(); const started = deferred<void>();
  options.save.mockImplementationOnce(() => { started.resolve(); return upload.promise; });
  const saving = session.save("", payload); const rejected = expect(saving).rejects.toThrow("account or page changed");
  await started.promise; leave(); upload.resolve(saved); await rejected;
  const restored = createInlineHandwritingDraftSession({ ...options, isCurrent: () => true });
  expect(await restored.save("", payload)).toEqual(saved);
  expect(options.save).toHaveBeenCalledTimes(1);
});

it("retains conflicts and malformed drafts without overwriting another revision", async () => {
  const { session, data, options } = setup();
  await session.stage("original", ink);
  await expect(session.load("changed-remotely")).rejects.toThrow("changed elsewhere");
  await expect(session.stage("changed-remotely", newer)).rejects.toThrow("changed elsewhere");
  expect(await session.load("original")).toEqual(ink);
  data.set(options.key, "broken-json");
  await expect(session.stage("original", newer)).rejects.toThrow();
  expect(data.get(options.key)).toBe("broken-json");
});
