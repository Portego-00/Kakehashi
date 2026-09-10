import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Eraser, Hand, Highlighter, Pencil, Plus, Redo2, Undo2 } from "lucide-react";
import { encodeInlineInk, INLINE_INK_MAX_POINTS, INLINE_INK_MAX_STROKES, parseInlineInk, type InlineInkDocument, type InlineInkStroke } from "../../../web/src/features/notebooks/inline-ink";
import type { NotebookDrawingPayload } from "../../../web/src/features/notebooks/handwriting";
import { hitsInlineStroke, paintInlineInk } from "./inline-handwriting-renderer";

type Tool = "pen" | "marker" | "eraser" | "scroll";
type ActivePointer = { id: number; before: InlineInkDocument; stroke?: InlineInkStroke; changed: boolean };
export interface InlineHandwritingProps {
  blockId: string;
  drawingId: string;
  width: number;
  height: number;
  onLoad: (blockId: string, drawingId: string) => Promise<InlineInkDocument | null>;
  onPersist: (blockId: string, drawingId: string, document: InlineInkDocument) => Promise<void>;
  onSave: (blockId: string, drawingId: string, payload: NotebookDrawingPayload) => Promise<void>;
}

function copy(document: InlineInkDocument) { return parseInlineInk(document); }
function message(error: unknown) { return error instanceof Error ? error.message : "Your handwriting could not be saved. Try again."; }

/** A canvas in the document's own scroll layer. No native overlay or modal. */
export function InlineHandwriting(props: InlineHandwritingProps) {
  const actions = useRef(props); actions.current = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef({
    blockId: props.blockId, drawingId: props.drawingId, mounted: true, loaded: false, saving: false,
    document: { version: 1, width: props.width, height: props.height, strokes: [] } as InlineInkDocument,
    active: null as ActivePointer | null, undo: [] as InlineInkDocument[], redo: [] as InlineInkDocument[],
    points: 0, frame: 0, tail: Promise.resolve(),
  });
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<InlineInkStroke["color"]>("#222222");
  const [width, setWidth] = useState(3);
  const [finger, setFinger] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [meta, setMeta] = useState({ width: props.width, height: props.height, strokes: 0, undo: false, redo: false });

  const repaint = useCallback(() => {
    const scope = session.current;
    if (scope.frame || !scope.mounted) return;
    scope.frame = requestAnimationFrame(() => {
      scope.frame = 0;
      const element = canvas.current;
      if (!element || !scope.mounted) return;
      if (element.width !== scope.document.width) element.width = scope.document.width;
      if (element.height !== scope.document.height) element.height = scope.document.height;
      const context = element.getContext("2d");
      if (context) paintInlineInk(context, scope.document);
    });
  }, []);
  const updateMeta = useCallback(() => {
    const scope = session.current;
    scope.points = scope.document.strokes.reduce((total, stroke) => total + stroke.points.length, 0);
    if (scope.mounted) setMeta({ width: scope.document.width, height: scope.document.height, strokes: scope.document.strokes.length, undo: !!scope.undo.length, redo: !!scope.redo.length });
    repaint();
  }, [repaint]);
  const persist = useCallback((document: InlineInkDocument) => {
    const scope = session.current;
    const snapshot = copy(document);
    // Submit before leaving this JS turn: a destroyed WebView cannot run a
    // queued continuation. The native host serializes writes by block scope.
    const callback = actions.current.onPersist;
    let pending: Promise<void>;
    try { pending = Promise.resolve(callback(scope.blockId, scope.drawingId, snapshot)); }
    catch (caught) { pending = Promise.reject(caught); }
    scope.tail = Promise.all([scope.tail.catch(() => undefined), pending]).then(() => undefined);
    void scope.tail.catch(() => undefined);
    void pending.catch((caught) => { if (scope.mounted) setError(message(caught)); });
    return pending;
  }, []);
  const changed = useCallback((before: InlineInkDocument) => {
    const scope = session.current;
    scope.undo.push(before); if (scope.undo.length > 30) scope.undo.shift();
    scope.redo = [];
    if (scope.mounted) { setDirty(true); setError(""); }
    updateMeta();
    void persist(scope.document);
  }, [persist, updateMeta]);
  const finish = useCallback(() => {
    const scope = session.current;
    const active = scope.active;
    if (!active) return;
    scope.active = null;
    try { if (canvas.current?.hasPointerCapture(active.id)) canvas.current.releasePointerCapture(active.id); } catch { /* Already cancelled by the browser. */ }
    if (active.changed) changed(active.before);
  }, [changed]);

  useEffect(() => {
    const scope = session.current;
    let current = true;
    setLoading(true); setError(""); scope.loaded = false;
    void actions.current.onLoad(scope.blockId, scope.drawingId).then((loaded) => {
      if (!current || !scope.mounted) return;
      if (!loaded && scope.drawingId) throw new Error("This handwriting could not be loaded. Your saved drawing is unchanged.");
      scope.document = loaded ? copy(loaded) : { version: 1, width: props.width, height: props.height, strokes: [] };
      scope.loaded = true;
      setLoading(false); updateMeta();
    }).catch((caught) => { if (current && scope.mounted) { setLoading(false); setError(message(caught)); } });
    return () => { current = false; };
  }, [props.width, props.height, retry, updateMeta]);
  useEffect(() => {
    const scope = session.current;
    scope.mounted = true;
    const flush = () => finish();
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      // Save an unfinished gesture as real ink, never silently discard it.
      scope.mounted = false; finish();
      if (scope.frame) cancelAnimationFrame(scope.frame);
      window.removeEventListener("pagehide", flush); window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [finish]);

  const point = (event: Pick<PointerEvent, "clientX" | "clientY" | "pressure">): [number, number, number] | null => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const document = session.current.document;
    const x = Math.max(0, Math.min(document.width, (event.clientX - rect.left) * document.width / rect.width));
    const y = Math.max(0, Math.min(document.height, (event.clientY - rect.top) * document.height / rect.height));
    const pressure = Number.isFinite(event.pressure) && event.pressure > 0 ? Math.min(1, event.pressure) : 0.5;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(pressure * 1000) / 1000];
  };
  const addPoint = (event: Pick<PointerEvent, "clientX" | "clientY" | "pressure">) => {
    const scope = session.current; const active = scope.active; const next = point(event);
    if (!active || !next) return;
    if (active.stroke) {
      const last = active.stroke.points.at(-1);
      if (last && Math.hypot(last[0] - next[0], last[1] - next[1]) < 0.2) return;
      if (scope.points >= INLINE_INK_MAX_POINTS) { finish(); setError("This area is full. Add another handwriting block to continue."); return; }
      active.stroke.points.push(next); scope.points++; active.changed = true;
    } else {
      const strokes = scope.document.strokes.filter((stroke) => !hitsInlineStroke(stroke, next[0], next[1], 10));
      if (strokes.length !== scope.document.strokes.length) { scope.document.strokes = strokes; active.changed = true; }
    }
    repaint();
  };
  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    const scope = session.current;
    if (!scope.loaded || scope.saving || scope.active || tool === "scroll" || (event.pointerType === "touch" && !finger) || (event.pointerType !== "pen" && event.pointerType !== "touch" && event.pointerType !== "mouse") || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation();
    if (tool !== "eraser" && (scope.document.strokes.length >= INLINE_INK_MAX_STROKES || scope.points >= INLINE_INK_MAX_POINTS)) { setError("This area is full. Add another handwriting block to continue."); return; }
    if (!point(event)) return;
    const before = copy(scope.document);
    const stroke: InlineInkStroke | undefined = tool === "eraser" ? undefined : { id: `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, tool, color, width: tool === "marker" ? Math.min(24, width * 4) : width, points: [] };
    if (stroke) scope.document.strokes.push(stroke);
    scope.active = { id: event.pointerId, before, stroke, changed: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer cancellation still flushes the stroke. */ }
    addPoint(event);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (session.current.active?.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const samples = event.nativeEvent.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event.nativeEvent]) addPoint(sample);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (session.current.active?.id !== event.pointerId) return;
    event.stopPropagation();
    if (event.type === "pointerup") addPoint(event);
    finish();
  };
  const history = (redo: boolean) => {
    finish(); const scope = session.current;
    const source = redo ? scope.redo : scope.undo; const target = redo ? scope.undo : scope.redo;
    const restored = source.pop(); if (!restored) return;
    target.push(copy(scope.document)); scope.document = restored;
    setDirty(true); setError(""); updateMeta(); void persist(scope.document);
  };
  const grow = () => {
    finish(); const scope = session.current; const before = copy(scope.document);
    scope.document.height = Math.min(4096, scope.document.height + 384); changed(before);
  };
  const save = async () => {
    const scope = session.current;
    if (!scope.loaded || scope.saving) return;
    finish(); scope.saving = true; setSaving(true); setError("");
    try {
      const document = copy(scope.document);
      await persist(document);
      await scope.tail;
      if (!scope.mounted) return;
      const output = window.document.createElement("canvas");
      output.width = document.width; output.height = document.height;
      const context = output.getContext("2d");
      if (!context) throw new Error("Handwriting could not be exported. Your draft is still on this device.");
      paintInlineInk(context, document);
      const url = output.toDataURL("image/png");
      if (!url.startsWith("data:image/png;base64,")) throw new Error("Handwriting could not be exported. Your draft is still on this device.");
      await actions.current.onSave(scope.blockId, scope.drawingId, { inkFormat: "strokes-v1", inkBase64: encodeInlineInk(document), previewBase64: url.slice("data:image/png;base64,".length), width: document.width, height: document.height });
      if (scope.mounted) setDirty(false);
    } catch (caught) { if (scope.mounted) setError(message(caught)); }
    finally { scope.saving = false; if (scope.mounted) setSaving(false); }
  };
  const locked = loading || saving || !session.current.loaded;

  return <figure className="nb-handwriting nb-inline-ink" contentEditable={false} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <div className="nb-ink-tools" role="toolbar" aria-label="Handwriting tools">
      <div className="nb-ink-tool-scroll">
        <button type="button" className="nb-icon-button" aria-label="Pen" aria-pressed={tool === "pen"} disabled={locked} onClick={() => { finish(); setTool("pen"); }}><Pencil size={18} /></button>
        <button type="button" className="nb-icon-button" aria-label="Marker" aria-pressed={tool === "marker"} disabled={locked} onClick={() => { finish(); setTool("marker"); }}><Highlighter size={18} /></button>
        <button type="button" className="nb-icon-button" aria-label="Erase stroke" aria-pressed={tool === "eraser"} disabled={locked} onClick={() => { finish(); setTool("eraser"); }}><Eraser size={18} /></button>
        <label className="nb-ink-color" title="Ink color"><span className="nb-ink-sr-only">Ink color</span><input type="color" aria-label="Ink color" value={color} disabled={locked} onChange={(event) => setColor(event.target.value as InlineInkStroke["color"])} /></label>
        <label className="nb-ink-width"><span className="nb-ink-sr-only">Stroke width</span><select aria-label="Stroke width" value={width} disabled={locked} onChange={(event) => setWidth(Number(event.target.value))}><option value={1.5}>Thin</option><option value={3}>Medium</option><option value={6}>Thick</option></select></label>
        <button type="button" className="nb-icon-button" aria-label="Undo handwriting" disabled={locked || !meta.undo} onClick={() => history(false)}><Undo2 size={18} /></button>
        <button type="button" className="nb-icon-button" aria-label="Redo handwriting" disabled={locked || !meta.redo} onClick={() => history(true)}><Redo2 size={18} /></button>
        <button type="button" className="nb-icon-button" aria-label="Scroll page" aria-pressed={tool === "scroll"} disabled={locked} onClick={() => { finish(); setTool(tool === "scroll" ? "pen" : "scroll"); }}><Hand size={18} /></button>
      </div>
      <button type="button" className="nb-ink-done" disabled={locked} onClick={() => void save()}><Check size={18} />{saving ? "Saving…" : "Done"}</button>
    </div>
    <canvas ref={canvas} width={meta.width} height={meta.height} className="nb-ink-canvas" role="img" aria-label="Handwriting drawing area" data-stroke-count={meta.strokes} style={{ touchAction: tool === "scroll" ? "pan-y" : "none", aspectRatio: `${meta.width} / ${meta.height}` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onContextMenu={(event) => event.preventDefault()} />
    {loading ? <div className="nb-ink-status" role="status">Loading handwriting…</div> : null}
    <div className="nb-ink-footer">
      <label><input type="checkbox" checked={finger} disabled={locked} onChange={(event) => { finish(); setFinger(event.target.checked); }} />Draw with finger</label>
      <span className="nb-ink-save-state">{tool === "scroll" ? "Scroll mode" : dirty ? "Unsaved changes" : ""}</span>
      <button type="button" disabled={locked || meta.height >= 4096} onClick={grow}><Plus size={16} />More space</button>
    </div>
    {error ? <div className="nb-ink-error" role="alert">{error}{!session.current.loaded ? <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button> : null}</div> : null}
  </figure>;
}
