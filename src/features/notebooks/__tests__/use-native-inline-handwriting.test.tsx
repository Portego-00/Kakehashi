import { act, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadNotebookDrawing, saveNotebookDrawing } from "../handwriting-api";
import { useNativeInlineHandwriting } from "../use-native-inline-handwriting";
import { createNativeInkJournal, nativeInkDraftKey } from "../native-inline-journal";
import { inlineHandwritingDraftKey } from "../inline-handwriting-drafts";
import { encodeInlineInk, type InlineInkDocument } from "../../../../web/src/features/notebooks/inline-ink";
import type { NativeCanvasExport, NativeCanvasHandle, NativeCanvasProps, NativeCanvasState } from "../native-inline-view";
import type { NativeInkStart } from "../native-inline-contract";

let mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
let mockAvailable = true;
let mockCanvasProps: NativeCanvasProps | null = null;
let mockHandle: jest.Mocked<NativeCanvasHandle>;
jest.mock("../../../utils/store", () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock("../handwriting-api", () => ({ ...jest.requireActual("../handwriting-api"), loadNotebookDrawing: jest.fn(), saveNotebookDrawing: jest.fn() }));
jest.mock("../native-inline-view", () => {
  const React = jest.requireActual("react");
  const Canvas = (props: NativeCanvasProps) => {
    mockCanvasProps = props;
    React.useImperativeHandle(props.ref, () => mockHandle);
    return null;
  };
  return { isNativeInlineHandwritingAvailable: () => mockAvailable, getNativeInlineCanvas: () => mockAvailable ? Canvas : null };
});

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const payload = { inkFormat: "pencilkit-v1" as const, inkBase64: "AA==", previewBase64: png, width: 768, height: 384 };
const saved = { inkFormat: "pencilkit-v1" as const, drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 768, height: 384 };
const differentId = "00a00000-0000-4000-8000-000000000099";
const input: NativeInkStart = { blockId: "block", drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384, geometry: { rect: { x: 20, y: 60, width: 768, height: 384 }, clipRect: { x: 0, y: 0, width: 1000, height: 700 }, viewport: { width: 1000, height: 700 }, revision: 0 } };
let cache: Map<string, string>;
let actions: ReturnType<typeof useNativeInlineHandwriting>["editorProps"];
const persist = jest.fn<Promise<void>, []>();
function Harness({ account = "42", page = "page", editorKey = "editor", themeBackground = "#ffffff" }: { account?: string; page?: string; editorKey?: string; themeBackground?: string }) {
  const hook = useNativeInlineHandwriting(account, page, persist, editorKey, themeBackground);
  actions = hook.editorProps;
  return hook.overlay;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function journal(account = "42", page = "page") { return createNativeInkJournal(AsyncStorage, nativeInkDraftKey(account, page, "block")); }
function nativeEvent(patch: Partial<NativeCanvasState> = {}) {
  if (!mockCanvasProps) throw new Error("Native canvas is not mounted");
  const next: NativeCanvasState = { sessionId: mockCanvasProps.document.sessionId, width: 768, height: 384, revision: 4, minimumWidth: 128, minimumHeight: 96, hasInk: true, canUndo: true, canRedo: false, ...patch };
  act(() => mockCanvasProps!.onReady({ nativeEvent: next } as Parameters<NativeCanvasProps["onReady"]>[0]));
}
async function open(value = input) {
  await act(async () => { await actions.onNativeHandwritingStart!(value); });
  nativeEvent();
}
async function save(sourceId = "") {
  let result;
  await act(async () => { result = await actions.onNativeHandwritingSave!("block", sourceId); });
  return result;
}
beforeEach(() => {
  jest.clearAllMocks(); cache = new Map(); mockAvailable = true; mockCanvasProps = null;
  mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => cache.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { cache.set(key, value); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => { cache.delete(key); });
  persist.mockResolvedValue(undefined);
  jest.mocked(saveNotebookDrawing).mockResolvedValue(saved);
  jest.mocked(loadNotebookDrawing).mockResolvedValue({ ...saved, ...payload });
  mockHandle = {
    exportDrawing: jest.fn(async () => ({ ...payload, sessionId: mockCanvasProps!.document.sessionId, revision: 4 })),
    flushDraft: jest.fn(async () => undefined), acknowledgeSave: jest.fn(async (_revision: number, _drawingId: string) => true),
    undo: jest.fn(async () => undefined), redo: jest.fn(async () => undefined),
    resizePaper: jest.fn(async (width: number, height: number) => ({ width, height, sessionId: mockCanvasProps!.document.sessionId, revision: 4, minimumWidth: 128, minimumHeight: 96, hasInk: true, canUndo: true, canRedo: false })),
    setToolsVisible: jest.fn(async (_visible: boolean) => undefined),
  };
});

it("hides native editing in old binaries without mounting or reading drawings", async () => {
  mockAvailable = false; render(<Harness />);
  expect(actions.nativeHandwritingAvailable).toBe(false);
  await expect(actions.onNativeHandwritingStart!(input)).rejects.toThrow("latest iPad build");
  expect(mockCanvasProps).toBeNull();
  expect(loadNotebookDrawing).not.toHaveBeenCalled();
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});

it("retains a failed upload locally, restores editing and reuses the uploaded asset after a page save fails", async () => {
  render(<Harness />); await open();
  jest.mocked(saveNotebookDrawing).mockRejectedValueOnce(new Error("offline"));
  await expect(save()).rejects.toThrow("offline");
  expect((await journal().read(""))?.payload).toEqual(payload);
  expect(mockCanvasProps?.inputEnabled).toBe(true);
  expect(await save()).toEqual(saved);
  persist.mockRejectedValueOnce(new Error("page save failed"));
  await act(async () => { await expect(actions.onNativeHandwritingCommitted!("block", saved.drawingId)).rejects.toThrow("page save failed"); });
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(mockHandle.acknowledgeSave).not.toHaveBeenCalled();
  expect(await save(saved.drawingId)).toEqual(saved);
  expect(saveNotebookDrawing).toHaveBeenCalledTimes(2);
  await act(async () => { await actions.onNativeHandwritingCommitted!("block", saved.drawingId); });
  expect(mockHandle.acknowledgeSave).toHaveBeenCalledWith(4, saved.drawingId);
  expect(await journal().read(saved.drawingId)).toBeNull();
  expect(actions.nativeHandwritingState).toBeNull();
});

it("keeps portable recovery byte-for-byte until the converted PencilKit reference and native acknowledgement are durable", async () => {
  const ink: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [{ id: "old-pen", tool: "pen", color: "#111111", width: 4, points: [[10, 20, 0.75], [80, 90, 0.5]] }] };
  const oldKey = inlineHandwritingDraftKey("42", "page", "block");
  const raw = JSON.stringify({ version: 1, sourceId: "", inkBase64: encodeInlineInk(ink) });
  cache.set(oldKey, raw);
  render(<Harness />); await open();
  expect(mockCanvasProps?.document).toEqual(expect.objectContaining({ inkFormat: "strokes-v1", inkBase64: encodeInlineInk(ink) }));
  expect(cache.get(oldKey)).toBe(raw);
  expect(loadNotebookDrawing).not.toHaveBeenCalled();
  await save();
  const pageGate = deferred<void>(); const pageStarted = deferred<void>();
  persist.mockImplementationOnce(() => { pageStarted.resolve(); return pageGate.promise; });
  let committing!: Promise<void>;
  act(() => { committing = actions.onNativeHandwritingCommitted!("block", saved.drawingId); });
  await pageStarted.promise;
  expect(cache.get(oldKey)).toBe(raw);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(mockHandle.acknowledgeSave).not.toHaveBeenCalled();
  await act(async () => { pageGate.resolve(); await committing; });
  expect(cache.has(oldKey)).toBe(false);
  expect(await journal().read(saved.drawingId)).toBeNull();
});

it("preserves both recoveries if native acknowledgement fails after the page persists", async () => {
  const oldKey = inlineHandwritingDraftKey("42", "page", "block");
  const ink: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [] };
  cache.set(oldKey, JSON.stringify({ version: 1, sourceId: "", inkBase64: encodeInlineInk(ink) }));
  render(<Harness />); await open(); await save();
  mockHandle.acknowledgeSave.mockRejectedValueOnce(new Error("native journal busy"));
  await act(async () => { await expect(actions.onNativeHandwritingCommitted!("block", saved.drawingId)).rejects.toThrow("native journal busy"); });
  expect(cache.has(oldKey)).toBe(true);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
});

it("retains native and portable recoveries when native ink advanced beyond the acknowledged revision", async () => {
  const oldKey = inlineHandwritingDraftKey("42", "page", "block");
  const ink: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [] };
  cache.set(oldKey, JSON.stringify({ version: 1, sourceId: "", inkBase64: encodeInlineInk(ink) }));
  render(<Harness />); await open(); await save();
  mockHandle.acknowledgeSave.mockResolvedValueOnce(false);
  await act(async () => { await expect(actions.onNativeHandwritingCommitted!("block", saved.drawingId)).rejects.toThrow(); });
  expect(cache.has(oldKey)).toBe(true);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(actions.nativeHandwritingState).not.toBeNull();
});

it("refuses a changed source before the first export/upload and refuses unrelated acknowledgements", async () => {
  render(<Harness />); await open();
  await expect(save(differentId)).rejects.toThrow();
  expect(mockHandle.exportDrawing).not.toHaveBeenCalled(); expect(saveNotebookDrawing).not.toHaveBeenCalled();
  await save();
  await expect(actions.onNativeHandwritingCommitted!("other-block", saved.drawingId)).rejects.toThrow();
  await expect(actions.onNativeHandwritingCommitted!("block", differentId)).rejects.toThrow();
  expect(persist).not.toHaveBeenCalled(); expect(mockHandle.acknowledgeSave).not.toHaveBeenCalled();
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
});

it("does not upload an export that arrives after switching accounts", async () => {
  render(<Harness />); await open();
  const gate = deferred<NativeCanvasExport>(); const started = deferred<void>();
  const exported = { ...payload, sessionId: mockCanvasProps!.document.sessionId, revision: 4 };
  mockHandle.exportDrawing.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  const saving = save(); const rejected = expect(saving).rejects.toThrow("account or page changed");
  await started.promise; mockAuth.userData.id = 43; gate.resolve(exported); await rejected;
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
  expect(cache.has(nativeInkDraftKey("43", "page", "block"))).toBe(false);
});

it("retains an upload accepted before navigation only under the original account/page", async () => {
  const screen = render(<Harness />); await open();
  const upload = deferred<typeof saved>(); const started = deferred<void>();
  jest.mocked(saveNotebookDrawing).mockImplementationOnce(() => { started.resolve(); return upload.promise; });
  let saving!: Promise<unknown>;
  act(() => { saving = actions.onNativeHandwritingSave!("block", ""); });
  const rejected = expect(saving).rejects.toThrow("account or page changed");
  await started.promise;
  screen.rerender(<Harness page="different-page" />);
  await act(async () => { upload.resolve(saved); await rejected; });
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(cache.has(nativeInkDraftKey("42", "different-page", "block"))).toBe(false);
  expect(actions.nativeHandwritingState).toBeNull();
});

it("rejects a late export after closing and reopening the same writing area", async () => {
  render(<Harness />); await open();
  const oldActions = actions; const oldHandle = mockHandle;
  const gate = deferred<NativeCanvasExport>(); const started = deferred<void>();
  const exported = { ...payload, sessionId: mockCanvasProps!.document.sessionId, revision: 4 };
  oldHandle.exportDrawing.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  let saving!: Promise<unknown>;
  act(() => { saving = oldActions.onNativeHandwritingSave!("block", ""); });
  const rejected = expect(saving).rejects.toThrow(); await started.promise;
  await act(async () => { await actions.onNativeHandwritingClose!("block"); });
  expect(oldHandle.flushDraft).toHaveBeenCalled();
  expect(oldHandle.setToolsVisible).toHaveBeenCalledWith(false);
  await open(); const currentSessionId = mockCanvasProps!.document.sessionId;
  await act(async () => { gate.resolve(exported); await rejected; });
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
  expect(actions.nativeHandwritingState?.sessionId).toBe(currentSessionId);
});

it("retains a stored conflict without downloading or replacing a different remote drawing", async () => {
  await journal().stage("", 4, payload);
  const before = cache.get(nativeInkDraftKey("42", "page", "block"));
  render(<Harness />);
  await expect(actions.onNativeHandwritingStart!({ ...input, drawingId: differentId, inkFormat: "pencilkit-v1" })).rejects.toThrow("changed");
  expect(cache.get(nativeInkDraftKey("42", "page", "block"))).toBe(before);
  expect(loadNotebookDrawing).not.toHaveBeenCalled(); expect(mockCanvasProps).toBeNull();
});

it("invalidates pending work when the same page replaces its BlockNote editor", async () => {
  const screen = render(<Harness />); await open();
  const gate = deferred<NativeCanvasExport>(); const started = deferred<void>();
  const exported = { ...payload, sessionId: mockCanvasProps!.document.sessionId, revision: 4 };
  mockHandle.exportDrawing.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  let saving!: Promise<unknown>;
  act(() => { saving = actions.onNativeHandwritingSave!("block", ""); });
  const rejected = expect(saving).rejects.toThrow("account or page changed");
  await started.promise; screen.rerender(<Harness editorKey="editor-after-conflict" />);
  await act(async () => { gate.resolve(exported); await rejected; });
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
  expect(actions.nativeHandwritingState).toBeNull();
});

it("keeps the original private recovery if the account changes during page persistence", async () => {
  render(<Harness />); await open(); await save();
  const gate = deferred<void>(); const started = deferred<void>();
  persist.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  let committing!: Promise<void>;
  act(() => { committing = actions.onNativeHandwritingCommitted!("block", saved.drawingId); });
  const rejected = expect(committing).rejects.toThrow("account or page changed");
  await started.promise; mockAuth.userData.id = 43;
  await act(async () => { gate.resolve(); await rejected; });
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(mockHandle.acknowledgeSave).not.toHaveBeenCalled();
});

it("checks the current Portego account before opening an iPad canvas", async () => {
  render(<Harness />); mockAuth.userData.username = "SomeoneElse";
  await expect(actions.onNativeHandwritingStart!(input)).rejects.toThrow("account or page changed");
  expect(mockCanvasProps).toBeNull(); expect(loadNotebookDrawing).not.toHaveBeenCalled();
});


it("retains distinct themed PNGs through a failed upload, native journal, retry and page commit", async () => {
  const darkPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const themed = { ...payload, previewFormat: "themed-v1" as const, darkPreviewBase64: darkPng };
  const themedReference = { ...saved, previewFormat: "themed-v1" as const };
  render(<Harness />); await open();
  mockHandle.exportDrawing.mockImplementation(async () => ({ ...themed, sessionId: mockCanvasProps!.document.sessionId, revision: 4 }));
  jest.mocked(saveNotebookDrawing).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(themedReference);
  await expect(save()).rejects.toThrow("offline");
  expect((await journal().read(""))?.payload).toEqual(themed);
  expect(saveNotebookDrawing).toHaveBeenLastCalledWith("token", "42", themed, expect.any(AbortSignal));
  expect(await save()).toEqual(themedReference);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(themedReference);
  expect((await journal().read(saved.drawingId))?.payload).toEqual(themed);
  await act(async () => { await actions.onNativeHandwritingCommitted!("block", saved.drawingId); });
  expect(persist).toHaveBeenCalled();
  expect(mockHandle.acknowledgeSave).toHaveBeenCalledWith(4, saved.drawingId);
  expect(await journal().read(saved.drawingId)).toBeNull();
});

it("updates automatic and custom paper colors without replacing the native drawing session", async () => {
  const screen = render(<Harness themeBackground="#202020" />); await open();
  const document = mockCanvasProps!.document;
  expect(mockCanvasProps).toEqual(expect.objectContaining({ paperColor: "#202020", paperStyle: "dark" }));
  screen.rerender(<Harness themeBackground="#ffffff" />);
  expect(mockCanvasProps).toEqual(expect.objectContaining({ paperColor: "#ffffff", paperStyle: "light" }));
  await act(async () => { await actions.onNativeHandwritingPaperColor!("block", "#f7efcd"); });
  screen.rerender(<Harness themeBackground="#000000" />);
  expect(mockCanvasProps).toEqual(expect.objectContaining({ paperColor: "#f7efcd", paperStyle: "light" }));
  await act(async () => { await actions.onNativeHandwritingPaperColor!("block", "#000000"); });
  expect(mockCanvasProps).toEqual(expect.objectContaining({ paperColor: "#000000", paperStyle: "dark" }));
  await act(async () => { await actions.onNativeHandwritingPaperColor!("block", "auto"); });
  expect(mockCanvasProps).toEqual(expect.objectContaining({ paperColor: "#000000", paperStyle: "dark" }));
  expect(mockCanvasProps!.document).toBe(document);
  expect(mockHandle.exportDrawing).not.toHaveBeenCalled();
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});
