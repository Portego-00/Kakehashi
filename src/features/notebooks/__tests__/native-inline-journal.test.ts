import { createNativeInkJournal, nativeInkDraftKey } from "../native-inline-journal";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const payload = { inkFormat: "pencilkit-v1" as const, inkBase64: "AA==", previewBase64: png, width: 768, height: 384 };
const saved = { inkFormat: "pencilkit-v1" as const, drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 768, height: 384 };
function setup() {
  const data = new Map<string, string>();
  const cache = {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { data.delete(key); }),
  };
  const key = nativeInkDraftKey("42", "page", "block");
  return { data, cache, key, journal: createNativeInkJournal(cache, key) };
}

it("recovers exact native bytes with distinct account, page and block keys", async () => {
  const { journal, cache, key } = setup();
  await journal.stage("", 2, payload);
  expect(await createNativeInkJournal(cache, key).read("")).toEqual(expect.objectContaining({ revision: 2, payload }));
  for (const otherKey of [nativeInkDraftKey("43", "page", "block"), nativeInkDraftKey("42", "other", "block"), nativeInkDraftKey("42", "page", "other")]) {
    expect(await createNativeInkJournal(cache, otherKey).read("")).toBeNull();
  }
  expect(new Set([nativeInkDraftKey("a:b", "c", "d"), nativeInkDraftKey("a", "b:c", "d"), nativeInkDraftKey("a", "b", "c:d")]).size).toBe(3);
});

it("reuses an uploaded asset for identical ink, but requires a new asset after ink or paper changes", async () => {
  const { journal } = setup();
  const item = await journal.stage("", 2, payload);
  await journal.uploaded(item, saved);
  expect((await journal.stage(saved.drawingId, 3, payload)).saved).toEqual(saved);
  expect((await journal.stage(saved.drawingId, 4, { ...payload, inkBase64: "AQ==" })).saved).toBeUndefined();
  const changed = await journal.stage("", 5, payload);
  await journal.uploaded(changed, saved);
  expect((await journal.stage(saved.drawingId, 6, { ...payload, width: 800 })).saved).toBeUndefined();
});

it("accepts its uploaded replacement ID but retains recovery when a different block reference arrives", async () => {
  const { journal, data, key } = setup();
  const item = await journal.stage("", 2, payload);
  await journal.uploaded(item, saved);
  expect((await journal.read(saved.drawingId))?.sourceId).toBe("");
  const before = data.get(key);
  await expect(journal.stage("00a00000-0000-4000-8000-000000000099", 3, payload)).rejects.toThrow("changed");
  expect(data.get(key)).toBe(before);
});

it.each(["broken-json", JSON.stringify({ version: 1, sourceId: "", revision: -1, payload }), JSON.stringify({ version: 1, sourceId: "", revision: 1, payload: { ...payload, inkFormat: "strokes-v1" } }), JSON.stringify({ version: 1, sourceId: "", revision: 1, payload, saved: { ...saved, width: 999 } })])("keeps malformed or mismatched recovery instead of replacing it", async (raw) => {
  const { journal, data, key } = setup();
  data.set(key, raw);
  await expect(journal.stage("", 2, payload)).rejects.toThrow();
  expect(data.get(key)).toBe(raw);
});

it("does not let an older upload completion overwrite a newer recovered drawing", async () => {
  const { journal } = setup();
  const older = await journal.stage("", 1, payload);
  await journal.stage("", 2, { ...payload, inkBase64: "AQ==" });
  await expect(journal.uploaded(older, saved)).rejects.toThrow();
  expect((await journal.read(""))?.payload.inkBase64).toBe("AQ==");
});

it("only clears the acknowledged saved snapshot, retaining ink written after that acknowledgement began", async () => {
  const { journal } = setup();
  const older = await journal.stage("", 1, payload);
  await journal.uploaded(older, saved);
  const acknowledged = (await journal.read(saved.drawingId))!;
  await journal.stage(saved.drawingId, 2, { ...payload, inkBase64: "AQ==" });
  await journal.clear(acknowledged);
  expect((await journal.read(""))?.payload.inkBase64).toBe("AQ==");
  const latest = await journal.stage("", 3, payload);
  await journal.uploaded(latest, saved);
  await journal.clear((await journal.read(saved.drawingId))!);
  expect(await journal.read(saved.drawingId)).toBeNull();
});

it("waits for accepted writes before a remounted journal reads the same private key", async () => {
  const { journal, cache, key, data } = setup();
  let finish!: () => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  cache.setItem.mockImplementationOnce(async (key, value) => { began(); await gate; data.set(key, value); });
  const staging = journal.stage("", 1, payload);
  await started;
  const remount = createNativeInkJournal(cache, key).read("");
  finish(); await staging;
  expect((await remount)?.payload).toEqual(payload);
});
