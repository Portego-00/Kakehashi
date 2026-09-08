import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, type NotebookPage, type NotebookState } from "./model";
import { NotebookApiError } from "./use-notebooks";
import { usePageDraft } from "./use-page-draft";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function seed() {
  return applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title: "Grammar", content: [{ id: "p", type: "paragraph", content: [{ type: "text", text: "First note" }] }] } }).state;
}
function draftEntries() {
  return Object.keys(localStorage).filter((key) => key.startsWith("kakehashi:notebooks:draft:")).map((key) => ({ key, value: JSON.parse(localStorage.getItem(key)!) }));
}
async function tick(milliseconds = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); }); }

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); sessionStorage.clear(); });

describe("notebook page draft persistence", () => {
  it("saves edits made during an outstanding request using the next revision", async () => {
    let state = seed();
    const firstSave = deferred<NotebookState>();
    const save = vi.fn().mockImplementationOnce(() => firstSave.promise).mockImplementation(async (draft) => {
      state = applyNotebookMutation(state, { action: "update_page", pageId: "page", expectedRevision: draft.baseRevision, patch: { title: draft.title, icon: draft.icon, content: draft.content } }).state;
      return state;
    });
    const { result } = renderHook(() => usePageDraft(state.pages[0], "account-a", save));
    await tick();
    act(() => result.current.update({ title: "First edit" }));
    let completion!: Promise<boolean>;
    act(() => { completion = result.current.flush(); });
    act(() => result.current.update({ title: "Second edit during save" }));
    state = applyNotebookMutation(state, { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "First edit" } }).state;
    await act(async () => { firstSave.resolve(state); expect(await completion).toBe(true); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ title: "Second edit during save", baseRevision: 1 });
    expect(state.pages[0].title).toBe("Second edit during save");
    expect(result.current.status).toBe("saved");
    expect(draftEntries()).toHaveLength(0);
  });

  it("recovers an unsaved draft after a failed save and unmount without exposing it to another account", async () => {
    const page = seed().pages[0];
    const save = vi.fn().mockRejectedValue(new Error("Offline"));
    const original = renderHook(() => usePageDraft(page, "account-a", save));
    await tick();
    act(() => original.result.current.update({ title: "My private unsaved notes" }));
    await act(async () => { expect(await original.result.current.flush()).toBe(false); });
    expect(original.result.current.status).toBe("error");
    original.unmount();
    const otherAccount = renderHook(() => usePageDraft(page, "account-b", save));
    await tick();
    expect(otherAccount.result.current.draft.title).toBe("Grammar");
    otherAccount.unmount();
    const recovered = renderHook(() => usePageDraft(page, "account-a", save));
    await tick();
    expect(recovered.result.current.draft.title).toBe("My private unsaved notes");
    expect(recovered.result.current.status).toBe("unsaved");
  });

  it("keeps a conflicting draft until the user deliberately loads the current saved page", async () => {
    const page = seed().pages[0];
    const save = vi.fn().mockRejectedValue(new NotebookApiError("This page changed elsewhere.", 409));
    const { result } = renderHook(() => usePageDraft(page, "account-a", save));
    await tick();
    act(() => result.current.update({ title: "My draft" }));
    await act(async () => { expect(await result.current.flush()).toBe(false); });
    expect(result.current.status).toBe("conflict");
    expect(result.current.draft.title).toBe("My draft");
    act(() => result.current.update({ title: "Continued writing during conflict" }));
    await tick(150);
    expect(draftEntries().some((entry) => entry.value.title === "Continued writing during conflict")).toBe(true);
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
    act(() => result.current.discard({ ...page, revision: 2, title: "Cloud title" }));
    expect(result.current.draft.title).toBe("Cloud title");
    expect(result.current.status).toBe("saved");
    expect(draftEntries()).toHaveLength(0);
  });

  it("shows a newly captured block when the open page has no local edits", async () => {
    const state = seed();
    const page = state.pages[0];
    const { result, rerender } = renderHook(({ currentPage }: { currentPage: NotebookPage }) => usePageDraft(currentPage, "account-a", vi.fn()), { initialProps: { currentPage: page } });
    await tick();
    const captured = applyNotebookMutation(state, { action: "append_blocks", pageId: page.id, blocks: [{ id: "word", type: "vocabulary", props: { subjectId: 88, label: "猫" } }] }).state.pages[0];
    rerender({ currentPage: captured });
    await tick();
    expect(result.current.draft.content.map((block) => block.id)).toEqual(["p", "word"]);
    expect(result.current.editorEpoch).toBe(1);
  });

  it("preserves local writing when a study capture changes the saved page", async () => {
    const state = seed();
    const page = state.pages[0];
    const save = vi.fn();
    const { result, rerender } = renderHook(({ currentPage }: { currentPage: NotebookPage }) => usePageDraft(currentPage, "account-a", save), { initialProps: { currentPage: page } });
    await tick();
    act(() => result.current.update({ title: "Unsaved grammar notes" }));
    const captured = applyNotebookMutation(state, { action: "append_blocks", pageId: page.id, blocks: [{ id: "word", type: "vocabulary", props: { subjectId: 88, label: "猫" } }] }).state.pages[0];
    rerender({ currentPage: captured });
    await tick();
    expect(result.current.status).toBe("conflict");
    expect(result.current.draft.title).toBe("Unsaved grammar notes");
    await act(async () => { expect(await result.current.flush()).toBe(false); });
    expect(save).not.toHaveBeenCalled();
    expect(draftEntries().some((entry) => entry.value.title === "Unsaved grammar notes")).toBe(true);
  });

  it("reconciles a capture received while an earlier save response is still pending", async () => {
    const state = seed();
    const page = state.pages[0];
    const save = deferred<NotebookState>();
    const { result, rerender } = renderHook(({ currentPage }: { currentPage: NotebookPage }) => usePageDraft(currentPage, "account-a", () => save.promise), { initialProps: { currentPage: page } });
    await tick();
    act(() => result.current.update({ title: "Saved title" }));
    let completion!: Promise<boolean>;
    act(() => { completion = result.current.flush(); });
    const saved = applyNotebookMutation(state, { action: "update_page", pageId: page.id, expectedRevision: 0, patch: { title: "Saved title" } }).state;
    const captured = applyNotebookMutation(saved, { action: "append_blocks", pageId: page.id, blocks: [{ id: "word", type: "vocabulary", props: { subjectId: 88, label: "猫" } }] }).state.pages[0];
    rerender({ currentPage: captured });
    await tick();
    await act(async () => { save.resolve(saved); expect(await completion).toBe(true); });
    await tick();
    expect(result.current.draft.content.map((block) => block.id)).toEqual(["p", "word"]);
    expect(result.current.draft.baseRevision).toBe(2);
  });

  it("does not erase another writer's recovery draft when a save completes", async () => {
    const page = seed().pages[0];
    const saveA = deferred<NotebookState>();
    const writerA = renderHook(() => usePageDraft(page, "account-a", () => saveA.promise));
    const writerB = renderHook(() => usePageDraft(page, "account-a", vi.fn()));
    await tick();
    act(() => writerA.result.current.update({ title: "Writer A" }));
    let completion!: Promise<boolean>;
    act(() => { completion = writerA.result.current.flush(); });
    act(() => writerB.result.current.update({ title: "Writer B unsaved" }));
    await tick(150);
    expect(draftEntries().some((entry) => entry.value.title === "Writer B unsaved")).toBe(true);
    const saved = applyNotebookMutation(seed(), { action: "update_page", pageId: page.id, expectedRevision: 0, patch: { title: "Writer A" } }).state;
    await act(async () => { saveA.resolve(saved); expect(await completion).toBe(true); });
    expect(draftEntries().some((entry) => entry.value.title === "Writer B unsaved")).toBe(true);
  });

  it("rotates recovery ownership when a duplicated tab inherits the original pointer", async () => {
    const page = seed().pages[0];
    const writerA = renderHook(() => usePageDraft(page, "account-a", vi.fn()));
    await tick();
    act(() => writerA.result.current.update({ title: "Original tab draft" }));
    await tick(150);
    const originalKey = draftEntries()[0].key;
    const inheritedPointer = sessionStorage.getItem("kakehashi:notebooks:draft-owner:account-a:page");
    expect(inheritedPointer).toBe(originalKey);
    const saveB = vi.fn(async (draft) => applyNotebookMutation(seed(), { action: "update_page", pageId: "page", expectedRevision: draft.baseRevision, patch: { title: draft.title, icon: draft.icon, content: draft.content } }).state);
    const duplicate = renderHook(() => usePageDraft(page, "account-a", saveB));
    await tick();
    expect(duplicate.result.current.draft.title).toBe("Original tab draft");
    expect(sessionStorage.getItem("kakehashi:notebooks:draft-owner:account-a:page")).not.toBe(originalKey);
    act(() => writerA.result.current.update({ title: "Original tab kept writing" }));
    await tick(150);
    act(() => duplicate.result.current.update({ title: "Duplicated tab notes" }));
    await act(async () => { expect(await duplicate.result.current.flush()).toBe(true); });
    expect(JSON.parse(localStorage.getItem(originalKey)!).title).toBe("Original tab kept writing");
  });

  it("does not restore malformed editor content from recovery storage", async () => {
    const page = seed().pages[0];
    localStorage.setItem("kakehashi:notebooks:draft:account-a:page", JSON.stringify({ title: "Invalid draft", icon: "", content: [{ id: "bad", type: "unknown-block" }], baseRevision: 0 }));
    const { result } = renderHook(() => usePageDraft(page, "account-a", vi.fn()));
    await tick();
    expect(result.current.draft.title).toBe("Grammar");
    expect(result.current.status).toBe("saved");
  });
});
