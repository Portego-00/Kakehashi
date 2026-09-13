import { createHandwritingDraftSession, handwritingDraftKey } from "../handwriting-drafts";

const payload = { inkBase64: "AA==", previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 1, height: 1 };
const saved = { drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 1, height: 1 };
function setup() {
  const entries = new Map<string, string>();
  const options = {
    key: handwritingDraftKey("42", "page"),
    cache: { getItem: jest.fn(async (key: string) => entries.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { entries.set(key, value); }), removeItem: jest.fn(async (key: string) => { entries.delete(key); }) },
    isCurrent: jest.fn(() => true), edit: jest.fn(async () => payload), load: jest.fn(async () => undefined),
    save: jest.fn(async () => saved), persistPage: jest.fn(async () => undefined), clearNativeDraft: jest.fn(async () => undefined),
  };
  return { entries, options, session: createHandwritingDraftSession(options) };
}

it("retains original ink on failed upload and restores it after reopening", async () => {
  const { options, session, entries } = setup();
  options.save.mockRejectedValueOnce(new Error("Offline"));
  await expect(session.edit()).rejects.toThrow("saved on this device");
  expect(JSON.parse(entries.get(options.key)!).payload).toEqual(payload);
  expect(options.clearNativeDraft).not.toHaveBeenCalled();
  expect(await createHandwritingDraftSession(options).edit()).toEqual(saved);
  expect(options.edit).toHaveBeenLastCalledWith(payload);
});

it("reuses a successful upload after interruption until the block is persisted", async () => {
  const { options, session, entries } = setup();
  expect(await session.edit()).toEqual(saved);
  const reopened = createHandwritingDraftSession(options);
  expect(await reopened.edit()).toEqual(saved);
  expect(options.save).toHaveBeenCalledTimes(1);
  expect(entries.size).toBe(1);
  await reopened.commit(saved.drawingId);
  expect(options.persistPage).toHaveBeenCalledTimes(1);
  expect(options.clearNativeDraft).toHaveBeenCalledTimes(1);
  expect(entries.size).toBe(0);
});

it("keeps recovery ink when persisting the notebook fails", async () => {
  const { options, session, entries } = setup();
  await session.edit();
  options.persistPage.mockRejectedValueOnce(new Error("Disk full"));
  await expect(session.commit(saved.drawingId)).rejects.toThrow("Disk full");
  expect(entries.size).toBe(1);
  expect(options.clearNativeDraft).not.toHaveBeenCalled();
});

it("does not upload handwriting after an account or page change", async () => {
  const { options, session, entries } = setup();
  options.edit.mockImplementationOnce(async () => { options.isCurrent.mockReturnValue(false); return payload; });
  await expect(session.edit()).rejects.toThrow("account or page changed");
  expect(options.save).not.toHaveBeenCalled();
  expect(entries.size).toBe(1);
});

it("does not remove another drawing's pending data", async () => {
  const { options, session, entries } = setup();
  await session.edit();
  await session.commit("different");
  expect(entries.size).toBe(1);
  expect(options.persistPage).not.toHaveBeenCalled();
});

it("isolates drafts by account, page and original drawing", () => {
  const scopes = [["42", "page"], ["43", "page"], ["42", "different"], ["42", "page", saved.drawingId], ["a:b", "c"], ["a", "b:c"]];
  expect(new Set(scopes.map(([account, page, source]) => handwritingDraftKey(account, page, source))).size).toBe(scopes.length);
});
