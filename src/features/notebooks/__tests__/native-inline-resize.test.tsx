import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { useNativeInlineHandwriting } from "../use-native-inline-handwriting";
import type { NativeCanvasHandle, NativeCanvasProps, NativeCanvasState } from "../native-inline-view";
import type { NativeInkStart } from "../native-inline-contract";

let mockCanvasProps: NativeCanvasProps;
let mockHandle: jest.Mocked<NativeCanvasHandle>;
jest.mock("../../../utils/store", () => ({ useAuthStore: { getState: () => ({ apiToken: "fixture-token", userData: { id: 42, username: "Portego" } }) } }));
jest.mock("../handwriting-api", () => ({ ...jest.requireActual("../handwriting-api"), loadNotebookDrawing: jest.fn(), saveNotebookDrawing: jest.fn() }));
jest.mock("../native-inline-view", () => {
  const React = jest.requireActual("react");
  const Canvas = (props: NativeCanvasProps) => {
    mockCanvasProps = props;
    React.useImperativeHandle(props.ref, () => mockHandle);
    return null;
  };
  return { isNativeInlineHandwritingAvailable: () => true, getNativeInlineCanvas: () => Canvas };
});

let actions: ReturnType<typeof useNativeInlineHandwriting>["editorProps"];
const input: NativeInkStart = {
  blockId: "resize-block", drawingId: "", inkFormat: "pencilkit-v1", width: 768, height: 384,
  geometry: { rect: { x: 20, y: 60, width: 768, height: 384 }, clipRect: { x: 0, y: 0, width: 1000, height: 700 }, viewport: { width: 1000, height: 700 }, revision: 0 },
};
function Harness() {
  const hook = useNativeInlineHandwriting("42", "resize-page", async () => undefined);
  actions = hook.editorProps;
  return hook.overlay;
}
function state(patch: Partial<NativeCanvasState> = {}): NativeCanvasState {
  return { sessionId: mockCanvasProps.document.sessionId, revision: 4, width: 768, height: 384, minimumWidth: 128, minimumHeight: 96, hasInk: true, canUndo: true, canRedo: false, ...patch };
}
function event(next: NativeCanvasState, kind: "onReady" | "onChange" = "onChange") {
  act(() => mockCanvasProps[kind]({ nativeEvent: next } as Parameters<NativeCanvasProps["onReady"]>[0]));
}
async function open() {
  render(<Harness />);
  await act(async () => { await actions.onNativeHandwritingStart!(input); });
  event(state(), "onReady");
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  mockHandle = {
    exportDrawing: jest.fn(async () => { throw new Error("Resize must not export ink"); }),
    flushDraft: jest.fn(async () => undefined), acknowledgeSave: jest.fn(async (_revision: number, _drawingId: string) => true),
    undo: jest.fn(async () => undefined), redo: jest.fn(async () => undefined),
    resizePaper: jest.fn(async (width: number, height: number) => state({ width, height, revision: 5 })),
    setToolsVisible: jest.fn(async (_visible: boolean) => undefined),
  };
});

it("keeps the published paper dimensions when native PencilKit rejects a resize", async () => {
  await open();
  mockHandle.resizePaper.mockRejectedValueOnce(new Error("Finish the current Pencil stroke before resizing."));
  await act(async () => {
    await expect(actions.onNativeHandwritingResize!("resize-block", { width: 768, height: 576 })).rejects.toThrow("Pencil stroke");
  });
  expect(mockHandle.resizePaper).toHaveBeenCalledWith(768, 576);
  expect(actions.nativeHandwritingState).toEqual(expect.objectContaining({ width: 768, height: 384, revision: 4 }));
  expect(mockCanvasProps.paperSize).toEqual({ width: 768, height: 384 });
  expect(mockHandle.exportDrawing).not.toHaveBeenCalled();
});

it("publishes dimensions only after the native resize succeeds", async () => {
  await open();
  const gate = deferred<NativeCanvasState>();
  mockHandle.resizePaper.mockReturnValueOnce(gate.promise);
  let resizing!: Promise<void>;
  act(() => { resizing = actions.onNativeHandwritingResize!("resize-block", { width: 768, height: 576 }); });
  expect(actions.nativeHandwritingState?.height).toBe(384);
  expect(mockCanvasProps.paperSize.height).toBe(384);
  await act(async () => { gate.resolve(state({ height: 576, revision: 5 })); await resizing; });
  expect(actions.nativeHandwritingState).toEqual(expect.objectContaining({ height: 576, revision: 5 }));
  expect(mockCanvasProps.paperSize.height).toBe(576);
});

it("never replaces newer native dimensions with a late resize result or older metadata", async () => {
  await open();
  const gate = deferred<NativeCanvasState>();
  mockHandle.resizePaper.mockReturnValueOnce(gate.promise);
  let resizing!: Promise<void>;
  act(() => { resizing = actions.onNativeHandwritingResize!("resize-block", { width: 768, height: 576 }); });
  const late = state({ height: 576, revision: 5 });
  event(state({ height: 640, revision: 6 }));
  await act(async () => { gate.resolve(late); await resizing; });
  event(state({ height: 384, revision: 4 }));
  expect(actions.nativeHandwritingState).toEqual(expect.objectContaining({ height: 640, revision: 6 }));
  expect(mockCanvasProps.paperSize.height).toBe(640);
});

it("preserves dimensions when native PencilKit rejects resizing during its active tool gesture", async () => {
  await open();
  act(() => mockCanvasProps.onToolActivity!({ nativeEvent: { sessionId: mockCanvasProps.document.sessionId, drawing: true } } as Parameters<NonNullable<NativeCanvasProps["onToolActivity"]>>[0]));
  mockHandle.resizePaper.mockRejectedValueOnce(new Error("Finish the current Pencil stroke before resizing."));
  await expect(actions.onNativeHandwritingResize!("resize-block", { width: 768, height: 576 })).rejects.toThrow();
  expect(mockHandle.resizePaper).toHaveBeenCalledWith(768, 576);
  expect(mockCanvasProps.paperSize.height).toBe(384);
});
