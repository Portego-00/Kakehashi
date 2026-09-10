import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { saveNotebookDrawing } from "../handwriting-api";
import { useNativeInlineHandwriting } from "../use-native-inline-handwriting";
import { createNativeInkJournal, nativeInkDraftKey } from "../native-inline-journal";
import type { NativeCanvasHandle, NativeCanvasProps, NativeCanvasState } from "../native-inline-view";
import type { NativeInkGeometry, NativeInkStart } from "../native-inline-contract";

let mockCanvasProps: NativeCanvasProps;
let mockHandle: jest.Mocked<NativeCanvasHandle>;
jest.mock("../../../utils/store", () => ({ useAuthStore: { getState: () => ({ apiToken: "fixture-token", userData: { id: 42, username: "Portego" } }) } }));
jest.mock("../handwriting-api", () => ({ ...jest.requireActual("../handwriting-api"), loadNotebookDrawing: jest.fn(), saveNotebookDrawing: jest.fn() }));
jest.mock("../native-inline-view", () => {
  const React = jest.requireActual("react");
  const Canvas = (props: NativeCanvasProps) => { mockCanvasProps = props; React.useImperativeHandle(props.ref, () => mockHandle); return null; };
  return { isNativeInlineHandwritingAvailable: () => true, getNativeInlineCanvas: () => Canvas };
});

const blockId = "controls-block";
const input: NativeInkStart = { blockId, drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384, geometry: { rect: { x: 20, y: 100, width: 768, height: 384 }, clipRect: { x: 20, y: 100, width: 768, height: 384 }, viewport: { width: 1000, height: 700 }, revision: 0 } };
const payload = { inkFormat: "pencilkit-v1" as const, inkBase64: "AA==", previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 768, height: 384 };
const saved = { inkFormat: "pencilkit-v1" as const, drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 768, height: 384 };
let actions: ReturnType<typeof useNativeInlineHandwriting>["editorProps"];
let overlay: ReturnType<typeof useNativeInlineHandwriting>["overlay"];
let cache: Map<string, string>;
const persist = jest.fn<Promise<void>, []>();
function Harness() { const hook = useNativeInlineHandwriting("42", "controls-page", persist); actions = hook.editorProps; overlay = hook.overlay; return hook.overlay; }
function nativeState(patch: Partial<NativeCanvasState> = {}): NativeCanvasState { return { sessionId: mockCanvasProps.document.sessionId, revision: 4, width: 768, height: 384, minimumWidth: 128, minimumHeight: 96, hasInk: true, canUndo: true, canRedo: false, ...patch }; }
function activity(drawing: boolean) { act(() => mockCanvasProps.onToolActivity?.({ nativeEvent: { sessionId: mockCanvasProps.document.sessionId, drawing } } as Parameters<NonNullable<NativeCanvasProps["onToolActivity"]>>[0])); }
async function open() {
  render(<Harness />);
  await act(async () => { await actions.onNativeHandwritingStart!(input); });
  expect(mockCanvasProps.active).toBe(false);
  act(() => mockCanvasProps.onReady({ nativeEvent: nativeState() } as Parameters<NativeCanvasProps["onReady"]>[0]));
}
async function save(sourceId = "") { let result; await act(async () => { result = await actions.onNativeHandwritingSave!(blockId, sourceId); }); return result; }
function journal() { return createNativeInkJournal(AsyncStorage, nativeInkDraftKey("42", "controls-page", blockId)); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function layout(geometry: NativeInkGeometry) { await act(async () => { await actions.onNativeHandwritingLayout!(blockId, geometry); }); }

beforeEach(() => {
  jest.clearAllMocks(); cache = new Map(); persist.mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => cache.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { cache.set(key, value); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => { cache.delete(key); });
  jest.mocked(saveNotebookDrawing).mockResolvedValue(saved);
  mockHandle = {
    exportDrawing: jest.fn(async () => ({ ...payload, sessionId: mockCanvasProps.document.sessionId, revision: 4 })),
    flushDraft: jest.fn(async () => undefined), acknowledgeSave: jest.fn(async (_revision: number, _drawingId: string) => true),
    undo: jest.fn(async () => undefined), redo: jest.fn(async () => undefined),
    resizePaper: jest.fn(async (width: number, height: number) => nativeState({ width, height, revision: 5 })),
    setToolsVisible: jest.fn(async (_visible: boolean) => undefined),
  };
});

it("can save and finish after native resize rejects without changing the original paper", async () => {
  await open(); mockHandle.resizePaper.mockRejectedValueOnce(new Error("The resize could not finish"));
  await act(async () => { await expect(actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 })).rejects.toThrow("resize"); });
  expect(mockCanvasProps.paperSize).toEqual({ width: 768, height: 384 });
  expect(mockCanvasProps.inputEnabled).toBe(true);
  expect(await save()).toEqual(saved);
  await act(async () => { await actions.onNativeHandwritingCommitted!(blockId, saved.drawingId); });
  expect(actions.nativeHandwritingState).toBeNull(); expect(await journal().read(saved.drawingId)).toBeNull();
});

it("can close with a durable native flush after a failed resize, without a cloud upload", async () => {
  await open(); mockHandle.resizePaper.mockRejectedValueOnce(new Error("Finish the current Pencil stroke before resizing"));
  await act(async () => { await expect(actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 })).rejects.toThrow(); });
  await act(async () => { await actions.onNativeHandwritingClose!(blockId); });
  expect(mockHandle.flushDraft).toHaveBeenCalledTimes(1); expect(mockHandle.setToolsVisible).toHaveBeenCalledWith(false);
  expect(overlay).toBeNull(); expect(saveNotebookDrawing).not.toHaveBeenCalled();
});

it("uses native gesture validation and recovers when the JavaScript tool-end event is missing", async () => {
  await open(); activity(true);
  mockHandle.resizePaper.mockRejectedValueOnce(new Error("Finish the current Pencil stroke before resizing"));
  await act(async () => { await expect(actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 })).rejects.toThrow("Pencil stroke"); });
  expect(mockCanvasProps.paperSize.height).toBe(384);
  // PencilKit is now idle, but the corresponding bridge event was dropped.
  await act(async () => { await actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 }); });
  expect(mockHandle.resizePaper).toHaveBeenCalledTimes(2);
  expect(mockCanvasProps.paperSize.height).toBe(576);
});

it("recovers from a save attempted during a real stroke after the native tool ends", async () => {
  await open(); activity(true);
  mockHandle.exportDrawing.mockRejectedValueOnce(new Error("Finish the current Pencil stroke before saving"));
  await expect(save()).rejects.toThrow("Pencil stroke");
  expect(mockCanvasProps.inputEnabled).toBe(true); expect(saveNotebookDrawing).not.toHaveBeenCalled();
  activity(false);
  expect(await save()).toEqual(saved);
});

it("keeps the captured native stroke active during export while refusing new touches, then restores input on failure", async () => {
  await open(); activity(true);
  const gate = deferred<Awaited<ReturnType<NativeCanvasHandle["exportDrawing"]>>>(); const started = deferred<void>();
  mockHandle.exportDrawing.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  let saving!: Promise<unknown>;
  act(() => { saving = actions.onNativeHandwritingSave!(blockId, ""); });
  const rejected = expect(saving).rejects.toThrow("Pencil stroke");
  await started.promise;
  expect(mockCanvasProps.active).toBe(true);
  expect(mockCanvasProps.inputEnabled).toBe(false);
  await act(async () => { gate.reject(new Error("Finish the current Pencil stroke before saving")); await rejected; });
  expect(mockCanvasProps.active).toBe(true); expect(mockCanvasProps.inputEnabled).toBe(true);
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});

it("rejects horizontal resizing but accepts a vertical extension without changing ink width", async () => {
  await open();
  await expect(actions.onNativeHandwritingResize!(blockId, { width: 900, height: 384 })).rejects.toThrow();
  expect(mockHandle.resizePaper).not.toHaveBeenCalled();
  await act(async () => { await actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 }); });
  expect(mockHandle.resizePaper).toHaveBeenCalledWith(768, 576);
  expect(mockCanvasProps.paperSize).toEqual({ width: 768, height: 576 });
});

it("allows vertical extension when existing ink extends beyond the fixed paper width", async () => {
  await open();
  act(() => mockCanvasProps.onChange({ nativeEvent: nativeState({ minimumWidth: 900 }) } as Parameters<NativeCanvasProps["onChange"]>[0]));
  mockHandle.resizePaper.mockResolvedValueOnce(nativeState({ height: 576, minimumWidth: 900, revision: 5 }));
  await act(async () => { await actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 }); });
  expect(mockHandle.resizePaper).toHaveBeenCalledWith(768, 576);
  expect(mockCanvasProps.paperSize).toEqual({ width: 768, height: 576 });
  expect(actions.nativeHandwritingState?.minimumWidth).toBe(900);
  expect(mockHandle.exportDrawing).not.toHaveBeenCalled();
});

it("keeps uploaded ink fixed during page handoff while allowing access to the native tools", async () => {
  await open(); await save();
  expect(mockCanvasProps.inputEnabled).toBe(false);
  for (const command of ["undo", "redo", "finger"] as const) {
    await act(async () => { await expect(actions.onNativeHandwritingCommand!(blockId, command, true)).rejects.toThrow("syncing"); });
  }
  expect(mockHandle.undo).not.toHaveBeenCalled(); expect(mockHandle.redo).not.toHaveBeenCalled(); expect(mockCanvasProps.fingerDrawing).toBe(false);
  await act(async () => { await actions.onNativeHandwritingCommand!(blockId, "tools", true); });
  expect(mockHandle.setToolsVisible).toHaveBeenCalledWith(true);
  await expect(actions.onNativeHandwritingPaperColor!(blockId, "#202020")).rejects.toThrow();
  await expect(actions.onNativeHandwritingResize!(blockId, { width: 768, height: 576 })).rejects.toThrow();
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
});

it("keeps recovery and supports a Done retry when page persistence fails", async () => {
  await open(); await save(); persist.mockRejectedValueOnce(new Error("Page is offline"));
  await act(async () => { await expect(actions.onNativeHandwritingCommitted!(blockId, saved.drawingId)).rejects.toThrow("offline"); });
  expect(mockCanvasProps.inputEnabled).toBe(true);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  expect(await save(saved.drawingId)).toEqual(saved);
  expect(saveNotebookDrawing).toHaveBeenCalledTimes(1);
  await act(async () => { await actions.onNativeHandwritingCommitted!(blockId, saved.drawingId); });
  expect(overlay).toBeNull();
});

it("preserves the same native session through fullscreen and ignores older geometry that covers the toolbar", async () => {
  await open(); const document = mockCanvasProps.document;
  const fullscreen = { rect: { x: 16, y: 72, width: 968, height: 484 }, clipRect: { x: 16, y: 72, width: 968, height: 484 }, viewport: { width: 1000, height: 700 }, revision: 2 };
  await layout(fullscreen);
  expect(mockCanvasProps.document).toBe(document); expect(mockCanvasProps.paperSize).toEqual({ width: 768, height: 384 });
  expect(overlay!.props.style).toEqual(expect.objectContaining({ top: 72, height: 484 }));
  await layout({ ...fullscreen, clipRect: { x: 0, y: 0, width: 1000, height: 700 }, revision: 1 });
  expect(overlay!.props.style).toEqual(expect.objectContaining({ top: 72, height: 484 }));
  await layout({ ...input.geometry, revision: 3 });
  expect(mockCanvasProps.document).toBe(document); expect(mockHandle.exportDrawing).not.toHaveBeenCalled();
});

it("deactivates fully clipped paper and reactivates the same document when it becomes visible", async () => {
  await open(); const document = mockCanvasProps.document;
  expect(mockCanvasProps.active).toBe(true);
  await layout({ ...input.geometry, clipRect: { x: 20, y: 100, width: 0, height: 0 }, revision: 1 });
  expect(mockCanvasProps.active).toBe(false);
  expect(overlay!.props.style).toEqual(expect.objectContaining({ width: 0, height: 0 }));
  await layout({ ...input.geometry, revision: 2 });
  expect(mockCanvasProps.active).toBe(true); expect(mockCanvasProps.document).toBe(document);
  expect(mockHandle.exportDrawing).not.toHaveBeenCalled(); expect(saveNotebookDrawing).not.toHaveBeenCalled();
});

it("waits for the original native recovery flush before reopening the same canvas", async () => {
  await open(); const oldSession = mockCanvasProps.document.sessionId;
  const gate = deferred<void>();
  mockHandle.flushDraft.mockReturnValueOnce(gate.promise);
  let closing!: Promise<void>;
  act(() => { closing = actions.onNativeHandwritingClose!(blockId); });
  // No new session can be opened until the old native recovery flush completes.
  await expect(actions.onNativeHandwritingStart!(input)).rejects.toThrow();
  await act(async () => { gate.resolve(); await closing; });
  expect(actions.nativeHandwritingState).toBeNull();
  await act(async () => { await actions.onNativeHandwritingStart!(input); });
  expect(mockCanvasProps.document.sessionId).not.toBe(oldSession);
});

it("unlocks drawing after a false native acknowledgement while retaining the uploaded snapshot", async () => {
  await open(); await save(); mockHandle.acknowledgeSave.mockResolvedValueOnce(false);
  await act(async () => { await expect(actions.onNativeHandwritingCommitted!(blockId, saved.drawingId)).rejects.toThrow("Newer handwriting"); });
  expect(mockCanvasProps.inputEnabled).toBe(true);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  await act(async () => { await actions.onNativeHandwritingCommand!(blockId, "undo"); });
  expect(mockHandle.undo).toHaveBeenCalledTimes(1);
});

it("prevents undo while page persistence is in flight and preserves the pending recovery until completion", async () => {
  await open(); await save(); const gate = deferred<void>(); const started = deferred<void>();
  persist.mockImplementationOnce(() => { started.resolve(); return gate.promise; });
  let committing!: Promise<void>;
  act(() => { committing = actions.onNativeHandwritingCommitted!(blockId, saved.drawingId); });
  await started.promise;
  await expect(actions.onNativeHandwritingCommand!(blockId, "undo")).rejects.toThrow("syncing");
  expect(mockHandle.undo).not.toHaveBeenCalled();
  expect(mockCanvasProps.inputEnabled).toBe(false);
  expect((await journal().read(saved.drawingId))?.saved).toEqual(saved);
  await act(async () => { gate.resolve(); await committing; });
  expect(actions.nativeHandwritingState).toBeNull();
});
