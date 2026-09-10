import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotebookEditor from "../../../../src/features/notebooks/NotebookEditor.dom";
import { InlineHandwriting, type InlineHandwritingProps } from "../../../../src/features/notebooks/inline-handwriting";
import { HandwritingResizeFrame, type HandwritingResizeFrameProps } from "../../../../src/features/notebooks/handwriting-resize-frame";
import type { NotebookEditorProps } from "../../../../src/features/notebooks/editor-contract";
import type { NativeInkState } from "../../../../src/features/notebooks/native-inline-contract";
import { decodeInlineInk, type InlineInkDocument } from "./inline-ink";

const original = { drawingId: "8b7f489d-1f66-4667-800a-f83ed02dd170", width: 768, height: 1024 };
const saved = { drawingId: "457fa6e1-cf08-4d02-9f02-25b0a1449aa3", inkFormat: "strokes-v1" as const, width: 768, height: 384 };
const empty: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [] };
const preview = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
function props(overrides: Partial<NotebookEditorProps> = {}): NotebookEditorProps {
  return {
    pageId: "handwriting-test-page", value: [{ id: "text", type: "paragraph", content: "Practice" }],
    theme: "dark", subjects: [], sentences: [], pages: [], handwritingAvailable: true, inlineHandwritingAvailable: true,
    onChange: vi.fn().mockResolvedValue(undefined), onOpenPage: vi.fn().mockResolvedValue(undefined),
    onOpenSubject: vi.fn().mockResolvedValue(undefined), onSaveSentence: vi.fn(),
    onLoadHandwritingPreview: vi.fn().mockResolvedValue(preview), onEditHandwriting: vi.fn().mockResolvedValue(original), onHandwritingCommitted: vi.fn().mockResolvedValue(undefined),
    onLoadInlineHandwriting: vi.fn().mockResolvedValue(empty), onPersistInlineHandwriting: vi.fn().mockResolvedValue(undefined),
    onSaveInlineHandwriting: vi.fn().mockResolvedValue(saved), onInlineHandwritingCommitted: vi.fn().mockResolvedValue(undefined),
    nativeHandwritingAvailable: true, nativeHandwritingState: null, onNativeHandwritingStart: vi.fn().mockResolvedValue(undefined), onNativeHandwritingLayout: vi.fn().mockResolvedValue(undefined),
    onNativeHandwritingPaperColor: vi.fn().mockResolvedValue(undefined), onNativeHandwritingCommand: vi.fn().mockResolvedValue(undefined), onNativeHandwritingResize: vi.fn().mockResolvedValue(undefined), onNativeHandwritingSave: vi.fn().mockResolvedValue({ ...saved, inkFormat: "pencilkit-v1" }),
    onNativeHandwritingCommitted: vi.fn().mockResolvedValue(undefined), onNativeHandwritingClose: vi.fn().mockResolvedValue(undefined), ...overrides,
  };
}
function canvasProps(overrides: Partial<InlineHandwritingProps> = {}): InlineHandwritingProps {
  return { blockId: "canvas-block", drawingId: "", width: 768, height: 384, onLoad: vi.fn().mockResolvedValue(null), onPersist: vi.fn().mockResolvedValue(undefined), onSave: vi.fn().mockResolvedValue(undefined), ...overrides };
}
const context = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn() };
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({ media, matches: false, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
  vi.stubGlobal("PointerEvent", class extends MouseEvent { pointerId: number; pointerType: string; pressure: number; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "pen"; this.pressure = init.pressure ?? 0.5; } });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const paper = this.hasAttribute("data-handwriting-paper");
    const width = this instanceof HTMLCanvasElement ? 768 : paper ? Number.parseFloat(this.style.width) || 600 : this.matches(".nb-native-ink-stage") && this.closest("[data-fullscreen]") ? 1000 : 690;
    const height = this instanceof HTMLCanvasElement ? 384 : paper ? Number.parseFloat(this.style.height) || 300 : this.matches(".nb-native-ink-stage") && this.closest("[data-fullscreen]") ? 600 : 768;
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} };
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(preview);
  // jsdom omits Range geometry; ProseMirror uses it when undo restores a text cursor.
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function area() { const canvas = await screen.findByRole("img", { name: "Handwriting drawing area" }); await waitFor(() => expect(screen.getByRole("button", { name: "Pen" })).toBeEnabled()); return canvas; }
function stroke(canvas: HTMLElement, x = 20, y = 30, pointerType = "pen", ending: "up" | "cancel" | "capture" = "up") {
  fireEvent.pointerDown(canvas, { pointerId: 7, pointerType, clientX: x, clientY: y, pressure: 0.5, button: 0 });
  fireEvent.pointerMove(canvas, { pointerId: 7, pointerType, clientX: x + 50, clientY: y + 20, pressure: 0.8 });
  if (ending === "cancel") fireEvent.pointerCancel(canvas, { pointerId: 7, pointerType });
  else if (ending === "capture") fireEvent.lostPointerCapture(canvas, { pointerId: 7, pointerType });
  else fireEvent.pointerUp(canvas, { pointerId: 7, pointerType, clientX: x + 50, clientY: y + 20, pressure: 0 });
}

describe("native PencilKit handwriting in the notebook", () => {
  const state = (blockId: string): NativeInkState => ({ blockId, sessionId: "native-session", revision: 1, width: 768, height: 384, minimumWidth: 160, minimumHeight: 128, canUndo: true, canRedo: true, hasInk: true, busy: false });
  function inserted(editor: NotebookEditorProps) { return vi.mocked(editor.onChange).mock.calls.at(-1)![0].find((block) => block.type === "handwriting")!; }
  async function activate(editor: NotebookEditorProps, view: ReturnType<typeof render>) {
    fireEvent.click(screen.getByRole("button", { name: "Add handwriting" }));
    const block = inserted(editor);
    await waitFor(() => expect(editor.onNativeHandwritingStart).toHaveBeenCalled());
    view.rerender(<NotebookEditor {...editor} nativeHandwritingState={state(block.id)} />);
    await screen.findByRole("button", { name: "Tools" });
    return block;
  }
  it("opens a real native canvas in the measured paper and locks text and page scrolling", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    expect(block.props).toEqual({ drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384, paperColor: "auto", previewFormat: "" });
    expect(editor.onNativeHandwritingStart).toHaveBeenCalledWith(expect.objectContaining({ blockId: block.id, drawingId: "", geometry: expect.objectContaining({ rect: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }), clipRect: expect.any(Object), viewport: { width: window.innerWidth, height: window.innerHeight } }) }));
    expect(document.querySelector(".nb-mobile")).toHaveAttribute("data-native-handwriting", "true");
    expect(screen.getByRole("button", { name: "Tools" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Handwriting drawing area" })).not.toBeInTheDocument();
    expect(editor.onEditHandwriting).not.toHaveBeenCalled();
  });
  it("routes native tools, undo, redo and finger drawing to the active canvas", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo handwriting" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo handwriting" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Draw with finger" }));
    expect(editor.onNativeHandwritingCommand).toHaveBeenCalledWith(block.id, "tools", undefined);
    expect(editor.onNativeHandwritingCommand).toHaveBeenCalledWith(block.id, "undo", undefined);
    expect(editor.onNativeHandwritingCommand).toHaveBeenCalledWith(block.id, "redo", undefined);
    expect(editor.onNativeHandwritingCommand).toHaveBeenCalledWith(block.id, "finger", true);
  });
  it("saves native ink in the same block and acknowledges only after the notebook persists", async () => {
    const persisted = deferred<void>();
    const onChange = vi.fn().mockImplementation((blocks) => blocks.some((block: { props?: { drawingId?: string } }) => block.props?.drawingId === saved.drawingId) ? persisted.promise : Promise.resolve());
    const editor = props({ onChange }); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(editor.onNativeHandwritingSave).toHaveBeenCalledWith(block.id, ""));
    expect(onChange.mock.calls.at(-1)![0]).toEqual(expect.arrayContaining([expect.objectContaining({ id: block.id, type: "handwriting", props: { ...saved, inkFormat: "pencilkit-v1", paperColor: "auto", previewFormat: "" } })]));
    expect(editor.onNativeHandwritingCommitted).not.toHaveBeenCalled();
    await act(async () => { persisted.resolve(); });
    await waitFor(() => expect(editor.onNativeHandwritingCommitted).toHaveBeenCalledWith(block.id, saved.drawingId));
  });
  it("saves before Scroll page releases the active canvas", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Scroll page" }));
    await waitFor(() => expect(editor.onNativeHandwritingCommitted).toHaveBeenCalledWith(block.id, saved.drawingId));
    expect(editor.onNativeHandwritingClose).not.toHaveBeenCalled();
    view.rerender(<NotebookEditor {...editor} nativeHandwritingState={null} />);
    expect(document.querySelector(".nb-mobile")).not.toHaveAttribute("data-native-handwriting");
  });
  it("shows a failed commit and retries with the new asset reference", async () => {
    const committed = vi.fn().mockRejectedValueOnce(new Error("Commit failed. Retry Done.")).mockResolvedValue(undefined);
    const editor = props({ onNativeHandwritingCommitted: committed }); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getAllByText("Commit failed. Retry Done.").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(committed).toHaveBeenCalledTimes(2));
    expect(editor.onNativeHandwritingSave).toHaveBeenLastCalledWith(block.id, saved.drawingId);
    await waitFor(() => expect(screen.queryByText("Commit failed. Retry Done.")).not.toBeInTheDocument());
  });
  it("retains recovery and does not insert returned ink after the editor closes", async () => {
    const upload = deferred<typeof saved>(); const editor = props({ onNativeHandwritingSave: vi.fn().mockReturnValue(upload.promise) });
    const view = render(<NotebookEditor {...editor} />); await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(editor.onNativeHandwritingSave).toHaveBeenCalled()); view.unmount();
    await act(async () => { upload.resolve(saved); });
    expect(editor.onNativeHandwritingCommitted).not.toHaveBeenCalled();
    expect(vi.mocked(editor.onChange).mock.calls.flatMap(([blocks]) => blocks).some((block) => block.props?.drawingId === saved.drawingId)).toBe(false);
  });
  it("opens existing PencilKit originals inline without calling the modal editor", async () => {
    const editor = props({ value: [{ id: "legacy-ink", type: "handwriting", props: original }] }); render(<NotebookEditor {...editor} />);
    fireEvent.click(await screen.findByRole("button", { name: "Write" }));
    await waitFor(() => expect(editor.onNativeHandwritingStart).toHaveBeenCalledWith(expect.objectContaining({ blockId: "legacy-ink", drawingId: original.drawingId, inkFormat: "pencilkit-v1" })));
    expect(editor.onEditHandwriting).not.toHaveBeenCalled();
  });
  it.each(["Done", "Scroll page"])("recovers %s after a rejected resize instead of keeping a rejected save prerequisite", async (action) => {
    const editor = props({ onNativeHandwritingResize: vi.fn().mockRejectedValue(new Error("Finish the current stroke before resizing.")) });
    const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.keyDown(screen.getByRole("button", { name: "Resize writing height" }), { key: "ArrowDown" });
    await waitFor(() => expect(editor.onNativeHandwritingResize).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText("Finish the current stroke before resizing.").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("button", { name: action })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(editor.onNativeHandwritingSave).toHaveBeenCalledWith(block.id, ""));
    await waitFor(() => expect(editor.onNativeHandwritingCommitted).toHaveBeenCalledWith(block.id, saved.drawingId));
    await waitFor(() => expect(screen.queryByText("Finish the current stroke before resizing.")).not.toBeInTheDocument());
  });
  it("can leave a failed native session without waiting for resize or save and retains recovery", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    view.rerender(<NotebookEditor {...editor} nativeHandwritingState={{ ...state(block.id), error: "Native drawing could not open" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave writing" }));
    await waitFor(() => expect(editor.onNativeHandwritingClose).toHaveBeenCalledWith(block.id));
    expect(editor.onNativeHandwritingSave).not.toHaveBeenCalled();
    expect(editor.onNativeHandwritingCommitted).not.toHaveBeenCalled();
    view.rerender(<NotebookEditor {...editor} nativeHandwritingState={null} />);
    await screen.findByText("Drawing kept on this iPad. Tap Write to continue.");
    expect(document.querySelector(".nb-native-handwriting")).not.toHaveAttribute("data-fullscreen");
    expect(document.querySelector(".nb-mobile")).not.toHaveAttribute("data-native-handwriting");
  });
  it("coalesces pending resize previews and waits for the final size before Done", async () => {
    const first = deferred<void>(); const last = deferred<void>();
    const resize = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
    const editor = props({ onNativeHandwritingResize: resize }); const view = render(<NotebookEditor {...editor} />); await activate(editor, view);
    const handle = screen.getByRole("button", { name: "Resize writing height" });
    fireEvent.pointerDown(handle, { pointerId: 4, pointerType: "pen", clientX: 100, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 4, pointerType: "pen", clientX: 400, clientY: 125 });
    fireEvent.pointerMove(handle, { pointerId: 4, pointerType: "pen", clientX: 500, clientY: 150 });
    fireEvent.pointerUp(handle, { pointerId: 4, pointerType: "pen", clientX: 600, clientY: 175 });
    expect(resize).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); });
    expect(resize).toHaveBeenCalledTimes(2);
    expect(resize.mock.calls[1][1].width).toBe(768);
    expect(editor.onNativeHandwritingSave).not.toHaveBeenCalled();
    await act(async () => { last.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(editor.onNativeHandwritingSave).toHaveBeenCalled());
  });
  it("enters and exits full screen with the same paper, block and native session", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    const paper = document.querySelector("[data-handwriting-paper]");
    await waitFor(() => expect(editor.onNativeHandwritingLayout).toHaveBeenCalled());
    const originalGeometry = vi.mocked(editor.onNativeHandwritingLayout!).mock.calls.at(-1)![1];
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(document.querySelector(".nb-native-handwriting")).toHaveAttribute("data-fullscreen", "true");
    await waitFor(() => expect(vi.mocked(editor.onNativeHandwritingLayout!).mock.calls.at(-1)![1].rect.width).toBeGreaterThan(originalGeometry.rect.width));
    expect(document.querySelector("[data-handwriting-paper]")).toBe(paper);
    expect(editor.onNativeHandwritingStart).toHaveBeenCalledTimes(1);
    expect(editor.onNativeHandwritingClose).not.toHaveBeenCalled();
    expect(editor.onNativeHandwritingResize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(document.querySelector(".nb-native-handwriting")).not.toHaveAttribute("data-fullscreen");
    await waitFor(() => expect(vi.mocked(editor.onNativeHandwritingLayout!).mock.calls.at(-1)![1].rect.width).toBe(originalGeometry.rect.width));
    expect(document.querySelector("[data-handwriting-paper]")).toBe(paper);
    expect(vi.mocked(editor.onNativeHandwritingLayout!).mock.calls.every(([id]) => id === block.id)).toBe(true);
  });
  it("routes Pencil taps on controls without focusing the text editor or creating another session", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); await activate(editor, view);
    const button = screen.getByRole("button", { name: "Full screen" });
    fireEvent.pointerDown(button, { pointerId: 9, pointerType: "pen", clientX: 30, clientY: 40 });
    fireEvent.pointerUp(button, { pointerId: 9, pointerType: "pen", clientX: 30, clientY: 40 });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeEnabled();
    expect(document.activeElement).not.toHaveAttribute("aria-label", "Notebook page content");
    expect(editor.onNativeHandwritingStart).toHaveBeenCalledTimes(1);
  });
  it("changes paper color in place, keeps it through native save and chooses the matching preview", async () => {
    const editor = props({ onNativeHandwritingSave: vi.fn().mockResolvedValue({ ...saved, inkFormat: "pencilkit-v1", previewFormat: "themed-v1" }) });
    const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Cream" }));
    await waitFor(() => expect(editor.onNativeHandwritingPaperColor).toHaveBeenCalledWith(block.id, "#fff8e7"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cream" })).toHaveAttribute("aria-pressed", "true"));
    expect(inserted(editor)).toMatchObject({ id: block.id, props: { paperColor: "#fff8e7" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(editor.onNativeHandwritingCommitted).toHaveBeenCalled());
    expect(inserted(editor)).toMatchObject({ id: block.id, props: { drawingId: saved.drawingId, paperColor: "#fff8e7", previewFormat: "themed-v1" } });
    await waitFor(() => expect(editor.onLoadHandwritingPreview).toHaveBeenLastCalledWith(saved.drawingId, "light"));
  });
  it("applies live custom color input events to native paper and notebook metadata", async () => {
    const editor = props(); const view = render(<NotebookEditor {...editor} />); const block = await activate(editor, view);
    fireEvent.input(screen.getByLabelText("Custom paper color"), { target: { value: "#244c3e" } });
    await waitFor(() => expect(editor.onNativeHandwritingPaperColor).toHaveBeenCalledWith(block.id, "#244c3e"));
    await waitFor(() => expect(inserted(editor)).toMatchObject({ id: block.id, props: { paperColor: "#244c3e" } }));
    expect(document.querySelector(".nb-native-handwriting")).toHaveStyle({ "--nb-paper-color": "#244c3e" });
  });
  it("updates automatic paper and transparent ink previews when the app theme changes", async () => {
    const editor = props({ nativeHandwritingAvailable: false, theme: "dark", themeBackground: "#0A0A0A", value: [{ id: "themed", type: "handwriting", props: { ...original, paperColor: "auto", previewFormat: "themed-v1" } }] });
    const view = render(<NotebookEditor {...editor} />);
    await waitFor(() => expect(editor.onLoadHandwritingPreview).toHaveBeenCalledWith(original.drawingId, "dark"));
    expect(document.querySelector(".nb-handwriting")).toHaveStyle({ "--nb-paper-color": "#0a0a0a" });
    view.rerender(<NotebookEditor {...editor} theme="light" themeBackground="#FBF6ED" />);
    await waitFor(() => expect(editor.onLoadHandwritingPreview).toHaveBeenLastCalledWith(original.drawingId, "light"));
    expect(document.querySelector(".nb-handwriting")).toHaveStyle({ "--nb-paper-color": "#fbf6ed" });
  });
  it("reports failed native color changes without changing the notebook metadata", async () => {
    const editor = props({ onNativeHandwritingPaperColor: vi.fn().mockRejectedValue(new Error("Paper could not be updated")) });
    const view = render(<NotebookEditor {...editor} />); await activate(editor, view);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(screen.getAllByText("Paper could not be updated").length).toBeGreaterThan(0));
    expect(inserted(editor)).toMatchObject({ props: { paperColor: "auto" } });
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  });
  it("shows portable previews but hides drawing creation in a binary without the native canvas", async () => {
    render(<NotebookEditor {...props({ nativeHandwritingAvailable: false, value: [{ id: "portable", type: "handwriting", props: saved }] })} />);
    expect(screen.queryByRole("button", { name: "Add handwriting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pen" })).not.toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Handwritten notebook content" })).toHaveAttribute("src", preview);
  });
});

describe("inline canvas recovery and tools", () => {
  it("ignores palm touches until finger drawing is explicitly enabled", async () => {
    const options = canvasProps(); render(<InlineHandwriting {...options} />); const canvas = await area();
    stroke(canvas, 20, 30, "touch"); expect(options.onPersist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Draw with finger" })); stroke(canvas, 20, 30, "touch");
    await waitFor(() => expect(options.onPersist).toHaveBeenCalled()); expect(canvas).toHaveAttribute("data-stroke-count", "1");
  });
  it.each(["cancel", "capture"] as const)("preserves a stroke after pointer %s", async (ending) => {
    const options = canvasProps(); render(<InlineHandwriting {...options} />); stroke(await area(), 20, 30, "pen", ending);
    await waitFor(() => expect(options.onPersist).toHaveBeenCalled()); expect(vi.mocked(options.onPersist).mock.calls.at(-1)![2].strokes[0].points).toHaveLength(2);
  });
  it("uses coalesced Pencil samples and normalizes missing pressure and out-of-bounds points", async () => {
    const options = canvasProps(); render(<InlineHandwriting {...options} />); const canvas = await area();
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", clientX: 20, clientY: 30, pressure: 0.5 });
    const move = new PointerEvent("pointermove", { bubbles: true, pointerId: 1, pointerType: "pen", clientX: 40, clientY: 50 });
    Object.defineProperty(move, "getCoalescedEvents", { value: () => [{ clientX: 25, clientY: 35, pressure: Number.NaN }, { clientX: 900, clientY: -50, pressure: 2 }] });
    fireEvent(canvas, move); fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: "pen" });
    expect(vi.mocked(options.onPersist).mock.calls.at(-1)![2].strokes[0].points).toEqual([[20, 30, 0.5], [25, 35, 0.5], [768, 0, 1]]);
  });
  it("undoes, redoes and erases a whole stroke while submitting snapshots in order", async () => {
    const options = canvasProps(); render(<InlineHandwriting {...options} />); const canvas = await area(); stroke(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Undo handwriting" })); expect(canvas).toHaveAttribute("data-stroke-count", "0");
    fireEvent.click(screen.getByRole("button", { name: "Redo handwriting" })); expect(canvas).toHaveAttribute("data-stroke-count", "1");
    fireEvent.click(screen.getByRole("button", { name: "Erase stroke" })); stroke(canvas, 45, 40); expect(canvas).toHaveAttribute("data-stroke-count", "0");
    expect(vi.mocked(options.onPersist).mock.calls.map((call) => call[2].strokes.length)).toEqual([1, 0, 1, 0]);
  });
  it("submits a final gesture immediately on unmount even when a previous native write is pending", async () => {
    const earlier = deferred<void>(); const options = canvasProps({ onPersist: vi.fn().mockReturnValue(earlier.promise) });
    const view = render(<InlineHandwriting {...options} />); const canvas = await area(); stroke(canvas);
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", clientX: 120, clientY: 130, pressure: 0.5 });
    view.unmount(); expect(options.onPersist).toHaveBeenCalledTimes(2);
    expect(vi.mocked(options.onPersist).mock.calls[1][2].strokes).toHaveLength(2); await act(async () => { earlier.resolve(); });
  });
  it("retains strokes and retries after a failed local write without uploading prematurely", async () => {
    const options = canvasProps({ onPersist: vi.fn().mockRejectedValueOnce(new Error("Storage full")).mockResolvedValue(undefined) });
    render(<InlineHandwriting {...options} />); const canvas = await area(); stroke(canvas);
    await screen.findByText("Storage full"); expect(canvas).toHaveAttribute("data-stroke-count", "1"); expect(options.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" })); await waitFor(() => expect(options.onSave).toHaveBeenCalled());
  });
  it("adds paper space and allows page scrolling without drawing in scroll mode", async () => {
    const options = canvasProps(); render(<InlineHandwriting {...options} />); const canvas = await area();
    fireEvent.click(screen.getByRole("button", { name: "More space" })); expect(canvas).toHaveAttribute("height", "768");
    expect(options.onPersist).toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Scroll page" })); stroke(canvas);
    expect(canvas.style.touchAction).toBe("pan-y"); expect(canvas).toHaveAttribute("data-stroke-count", "0");
  });
});

describe("handwriting area vertical resizing", () => {
  function frameProps(overrides: Partial<HandwritingResizeFrameProps> = {}): HandwritingResizeFrameProps {
    return { width: 400, height: 300, scale: 0.5, minHeight: 128, maxHeight: 4096, onResizeCommit: vi.fn().mockResolvedValue(undefined), onResizePreview: vi.fn(), onResizeCancel: vi.fn(), children: <canvas aria-label="Original ink" />, ...overrides };
  }
  function drag(handle: HTMLElement, x: number, y: number, end: "up" | "cancel" | "capture" = "up") {
    fireEvent.pointerDown(handle, { pointerId: 3, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 3, pointerType: "touch", clientX: 100 + x, clientY: 100 + y });
    if (end === "cancel") fireEvent.pointerCancel(handle, { pointerId: 3, pointerType: "touch" });
    else if (end === "capture") fireEvent.lostPointerCapture(handle, { pointerId: 3, pointerType: "touch" });
    else fireEvent.pointerUp(handle, { pointerId: 3, pointerType: "touch", clientX: 100 + x, clientY: 100 + y });
  }
  it("keeps paper width fixed while changing height and preserving the ink element", async () => {
    const options = frameProps(); render(<HandwritingResizeFrame {...options} />); const ink = screen.getByLabelText("Original ink");
    expect(screen.queryByRole("button", { name: "Resize writing width" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resize writing area" })).not.toBeInTheDocument();
    drag(screen.getByRole("button", { name: "Resize writing height" }), 500, 25);
    await waitFor(() => expect(options.onResizeCommit).toHaveBeenCalledWith({ width: 400, height: 350 }));
    expect(document.querySelector("[data-handwriting-paper]")).toHaveStyle({ width: "200px", height: "175px" });
    expect(screen.getByLabelText("Original ink")).toBe(ink);
  });
  it("bounds height by native ink extents and maximum paper size", async () => {
    const options = frameProps({ minHeight: 240 }); render(<HandwritingResizeFrame {...options} />);
    drag(screen.getByRole("button", { name: "Resize writing height" }), -500, -500);
    await waitFor(() => expect(options.onResizeCommit).toHaveBeenCalledWith({ width: 400, height: 240 }));
    drag(screen.getByRole("button", { name: "Resize writing height" }), 5000, 5000);
    await waitFor(() => expect(options.onResizeCommit).toHaveBeenLastCalledWith({ width: 400, height: 4096 }));
  });
  it.each(["cancel", "capture"] as const)("rolls back once on pointer %s without committing", (ending) => {
    const options = frameProps(); render(<HandwritingResizeFrame {...options} />);
    drag(screen.getByRole("button", { name: "Resize writing height" }), 50, 40, ending);
    expect(options.onResizeCommit).not.toHaveBeenCalled();
    expect(options.onResizeCancel).toHaveBeenCalledExactlyOnceWith({ width: 400, height: 300 });
    expect(options.onResizePreview).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-handwriting-paper]")).toHaveStyle({ width: "200px", height: "150px" });
  });
  it("rolls back a failed commit and permits another resize", async () => {
    const options = frameProps({ onResizeCommit: vi.fn().mockRejectedValueOnce(new Error("Finish the current stroke before resizing.")).mockResolvedValue(undefined) }); render(<HandwritingResizeFrame {...options} />);
    drag(screen.getByRole("button", { name: "Resize writing height" }), 0, 30);
    await screen.findByText("Finish the current stroke before resizing.");
    expect(document.querySelector("[data-handwriting-paper]")).toHaveStyle({ width: "200px", height: "150px" });
    drag(screen.getByRole("button", { name: "Resize writing height" }), 0, 20);
    await waitFor(() => expect(options.onResizeCommit).toHaveBeenLastCalledWith({ width: 400, height: 340 }));
  });
  it("supports vertical keyboard resizing and ignores horizontal arrows", async () => {
    const options = frameProps(); render(<HandwritingResizeFrame {...options} />); const handle = screen.getByRole("button", { name: "Resize writing height" });
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true }); expect(options.onResizeCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: "ArrowDown", shiftKey: true });
    await waitFor(() => expect(options.onResizeCommit).toHaveBeenCalledWith({ width: 400, height: 332 }));
  });
});
