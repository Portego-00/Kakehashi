import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";
import "./handwriting-resize-frame.css";

export type HandwritingPaperSize = { width: number; height: number };
export interface HandwritingResizeFrameProps extends HandwritingPaperSize {
  /** CSS pixels per paper point. A gesture retains its starting scale. */
  scale: number;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  children: ReactNode;
  onResizeStart?: () => void;
  onResizePreview?: (size: HandwritingPaperSize) => void;
  onResizeCommit: (size: HandwritingPaperSize) => Promise<void>;
  onResizeCancel?: (size: HandwritingPaperSize) => void;
}
type Gesture = { pointerId: number; y: number; scale: number; before: HandwritingPaperSize; size: HandwritingPaperSize };
const MAX_PIXELS = 16_000_000;
const finite = (value: number | undefined, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Extend or trim the bottom of the paper without changing its width or ink coordinates. */
export function HandwritingResizeFrame(props: HandwritingResizeFrameProps) {
  const actions = useRef(props); actions.current = props;
  const current = useRef<HandwritingPaperSize>({ width: props.width, height: props.height });
  const active = useRef<Gesture | null>(null);
  const committing = useRef(false);
  const mounted = useRef(true);
  const [size, setSize] = useState(current.current);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const scale = Math.max(0.01, finite(props.scale, 1));
  const bounded = (height: number, width: number): HandwritingPaperSize => {
    const options = actions.current;
    const minHeight = Math.max(1, Math.min(4096, Math.ceil(finite(options.minHeight, 128))));
    const maxHeight = Math.max(minHeight, Math.min(4096, Math.floor(finite(options.maxHeight, 4096)), Math.floor(MAX_PIXELS / width)));
    return { width, height: Math.max(minHeight, Math.min(maxHeight, Math.round(finite(height, current.current.height)))) };
  };
  const apply = (next: HandwritingPaperSize) => { current.current = next; if (mounted.current) setSize(next); };
  const preview = (next: HandwritingPaperSize) => { apply(next); actions.current.onResizePreview?.(next); };
  // Rollback has one native notification, never a second competing preview write.
  const rollback = (before: HandwritingPaperSize) => { apply(before); actions.current.onResizeCancel?.(before); };
  useEffect(() => {
    if (!active.current && !committing.current) apply({ width: props.width, height: props.height });
  }, [props.width, props.height]);
  useEffect(() => { if (props.disabled) setError(""); }, [props.disabled]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const gesture = active.current; active.current = null;
      if (gesture) { current.current = gesture.before; actions.current.onResizeCancel?.(gesture.before); }
    };
  }, []);
  const commit = async (before: HandwritingPaperSize, next: HandwritingPaperSize) => {
    if (next.height === before.height) { actions.current.onResizeCancel?.(before); return; }
    committing.current = true; setPending(true); setError("");
    try { await actions.current.onResizeCommit(next); }
    catch (caught) { rollback(before); if (mounted.current) setError(caught instanceof Error ? caught.message : "This size could not be saved. Try resizing again."); }
    finally { committing.current = false; if (mounted.current) setPending(false); }
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (props.disabled || committing.current || active.current || (event.pointerType === "mouse" && event.button !== 0) || !Number.isFinite(event.clientY)) return;
    event.preventDefault(); event.stopPropagation();
    const before = { ...current.current };
    active.current = { pointerId: event.pointerId, y: event.clientY, scale, before, size: before };
    setError(""); actions.current.onResizeStart?.();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Cancellation still restores the prior size. */ }
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = active.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !Number.isFinite(event.clientY)) return;
    event.preventDefault(); event.stopPropagation();
    gesture.size = bounded(gesture.before.height + (event.clientY - gesture.y) / gesture.scale, gesture.before.width);
    preview(gesture.size);
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = active.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (event.type === "pointerup") move(event);
    active.current = null;
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Capture may have been cancelled already. */ }
    if (event.type === "pointerup") void commit(gesture.before, gesture.size); else rollback(gesture.before);
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (props.disabled || committing.current || active.current || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const before = { ...current.current }; const step = event.shiftKey ? 32 : 8;
    const next = bounded(before.height + (event.key === "ArrowDown" ? step : -step), before.width);
    actions.current.onResizeStart?.(); preview(next); void commit(before, next);
  };
  return <div className="nb-paper-resize-container">
    <div className="nb-paper-frame" style={{ width: size.width * scale, height: size.height * scale }}>
      <div className="nb-paper-content" data-handwriting-paper="true" style={{ width: size.width * scale, height: size.height * scale }}>{props.children}</div>
      <button type="button" className="nb-paper-resize nb-paper-resize-height" aria-label="Resize writing height" title="Drag to change paper height" disabled={props.disabled || pending} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyboard}><GripHorizontal size={20} /></button>
    </div>
    {error ? <p className="nb-paper-resize-error" role="alert">{error}</p> : null}
  </div>;
}
